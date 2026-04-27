import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { createConsolePage } from "../ui/consolePage.js";

const PHASE = "phase-91a-web-chat-model-config-restore-recovery";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-91a-web-chat-model-config-restore-recovery.json");
const evidenceMdPath = resolve(evidenceDir, "phase-91a-web-chat-model-config-restore-recovery.md");
const evidencePngPath = resolve(evidenceDir, "phase-91a-web-chat-model-config-restore-recovery.png");
const testApiKey = "phase91-persistable-api-key-not-for-evidence";
const chatModelId = "phase91-restored-model";
const expectedRuntimeValue = `generic-openai-compatible::${chatModelId}`;

let server;
let browserProcess;
let browserProfileDir;
let tempRoot;
let evidence;

try {
  verifyEmbeddedScriptSyntax();

  tempRoot = await mkdtemp(resolve(tmpdir(), "phase91a-runtime-store-"));
  const runtimeCredentialStorePath = resolve(tempRoot, "runtime-credentials.json");
  await writeRuntimeCredentialStore(runtimeCredentialStorePath);

  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "registry-default",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory",
    PME_ENTERPRISE_AUTH_ENABLED: "false",
    PME_RUNTIME_CREDENTIAL_STORE_MODE: "local-file",
    PME_RUNTIME_CREDENTIAL_STORE_PATH: runtimeCredentialStorePath,
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const uiUrl = `${serviceUrl}/ui?showFakeProviders=1`;

  const browserPath = findBrowserPath();
  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase91a-browser-profile-"));
  browserProcess = spawn(browserPath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${browserProfileDir}`,
    "--window-size=1440,1200",
    "about:blank",
  ], {
    cwd: repoRoot,
    stdio: "ignore",
  });

  const cdpPort = await readDevToolsPort(browserProfileDir);
  const pageTarget = await createCdpPage(cdpPort, "about:blank");
  const cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);

  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        (() => {
          window.__phase91Fetches = [];
          localStorage.setItem("pme-moving-earth-provider-preference-v1", JSON.stringify({
            value: ${JSON.stringify(expectedRuntimeValue)},
            label: "OpenAI-compatible / ${chatModelId}",
            source: "phase91-restore-recovery",
            savedAt: new Date().toISOString()
          }));
          const originalFetch = window.fetch.bind(window);
          window.fetch = async (...args) => {
            const raw = args[0];
            const requestUrl = typeof raw === "string" ? raw : (raw && raw.url) || "";
            const path = new URL(requestUrl || "/", window.location.href).pathname;
            window.__phase91Fetches.push(path);
            if (path === "/chat/stream" || path === "/chat/rag/stream") {
              return new Response(JSON.stringify({
                success: false,
                error: {
                  code: "RESTORED_RUNTIME_CREDENTIAL_REJECTED",
                  message: "Restored runtime credential rejected during stream."
                }
              }), {
                status: 401,
                headers: { "content-type": "application/json; charset=utf-8" }
              });
            }
            if (path === "/chat" || path === "/chat/rag") {
              return new Response(JSON.stringify({
                success: false,
                error: {
                  code: "RESTORED_RUNTIME_CREDENTIAL_REJECTED",
                  message: "Restored runtime credential rejected during fallback."
                }
              }), {
                status: 401,
                headers: { "content-type": "application/json; charset=utf-8" }
              });
            }
            return originalFetch(...args);
          };
        })();
      `,
    });
    await cdp.send("Page.navigate", { url: uiUrl });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, `Array.from(document.getElementById("provider-select")?.options || []).some((option) => option.value === ${JSON.stringify(expectedRuntimeValue)})`, 20_000);
    await cdp.evaluate(`(() => {
      localStorage.setItem("pme-moving-earth-provider-preference-v1", JSON.stringify({
        value: ${JSON.stringify(expectedRuntimeValue)},
        label: "OpenAI-compatible / ${chatModelId}",
        source: "phase91-restore-recovery",
        savedAt: new Date().toISOString()
      }));
      const select = document.getElementById("provider-select");
      select.value = ${JSON.stringify(expectedRuntimeValue)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    await waitForExpression(cdp, `document.getElementById("provider-select")?.value === ${JSON.stringify(expectedRuntimeValue)}`, 20_000);
    await waitForExpression(cdp, `document.getElementById("composer-model-status")?.dataset.modelRestoredFromLocal === "true"`, 20_000);

    await sendPrompt(cdp, "restored model should fail and ask for repair");
    const state = await waitForRecoveryState(cdp);

    await mkdir(evidenceDir, { recursive: true });
    await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
      .then(async (result) => writeFile(evidencePngPath, Buffer.from(result.data, "base64")));
    await cdp.close();

    const screenshot = await inspectPng(evidencePngPath);
    const serializedState = JSON.stringify(state);
    const passed = state.providerSelectValue === expectedRuntimeValue &&
      state.modelRestoredFromLocal === "true" &&
      state.modelRecoveryRequired === "true" &&
      state.modelProbeStatus === "failed" &&
      state.modelProbeText.includes("重新检测") &&
      state.modelPreferenceText.includes("修复") &&
      state.modelConfigButtonText.includes("重新检测模型") &&
      state.modelGuideText.includes("本机恢复的模型配置这次发送失败") &&
      state.modelGuideText.includes("重新验证 API Key") &&
      state.assistantText.includes("本机配置已恢复") &&
      state.assistantText.includes("重新检测模型") &&
      state.fetches.some((path) => path === "/chat/stream" || path === "/chat/rag/stream") &&
      state.fetches.some((path) => path === "/chat" || path === "/chat/rag") &&
      !serializedState.includes(testApiKey) &&
      screenshot.validPng &&
      screenshot.bytes > 10000;

    evidence = {
      phase: PHASE,
      status: passed ? "passed" : "failed",
      generatedAt: new Date().toISOString(),
      browserPath,
      serviceUrl,
      ui: {
        url: uiUrl,
        state,
      },
      screenshot: {
        path: "apps/ai-gateway-service/evidence/phase-91a-web-chat-model-config-restore-recovery.png",
        bytes: screenshot.bytes,
        width: screenshot.width,
        height: screenshot.height,
        validPng: screenshot.validPng,
      },
      safety: {
        browserInteraction: true,
        simulatedRestoredCredentialFailureOnly: true,
        realProviderCalls: false,
        apiKeyValueRecorded: false,
        defaultChatMainLaneChanged: false,
        backendBusinessRouteAdded: false,
      },
      conclusion: passed ? "web-chat-model-config-restore-recovery-actionable" : "web-chat-model-config-restore-recovery-not-actionable",
    };
  } finally {
    await closeCdpSilently(cdp);
  }

  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = evidence.status === "passed" ? 0 : 1;
} catch (error) {
  evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "web-chat-model-config-restore-recovery-not-actionable",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  await terminateBrowser(browserProcess);
  if (browserProfileDir) {
    await rm(browserProfileDir, { recursive: true, force: true }).catch(() => undefined);
  }
  if (server) {
    await close(server).catch(() => undefined);
  }
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

function verifyEmbeddedScriptSyntax() {
  const html = createConsolePage();
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Console page script not found.");
  new vm.Script(match[1], { filename: "consolePage-inline.js" });
}

async function writeRuntimeCredentialStore(path) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({
    version: 1,
    warning: "Local user credential store for Phase91A verification only.",
    records: [{
      providerId: "generic-openai-compatible",
      apiKey: testApiKey,
      endpoint: "http://127.0.0.1:9/v1",
      source: "phase91-restore-recovery",
      setAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      models: [{
        id: chatModelId,
        displayName: "Phase91 Restored Model",
        capabilities: ["chat", "summary"],
        source: "phase91-restore-recovery",
      }],
    }],
  }, null, 2), "utf8");
}

async function sendPrompt(cdp, prompt) {
  await cdp.evaluate(`(() => {
    const input = document.getElementById("chat-input");
    input.value = ${JSON.stringify(prompt)};
    input.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("chat-form").requestSubmit();
    return true;
  })()`);
}

async function waitForRecoveryState(cdp) {
  await waitForExpression(cdp, `document.getElementById("composer-model-status")?.dataset.modelRecoveryRequired === "true"`, 20_000);
  await waitForExpression(cdp, `Array.from(document.querySelectorAll(".message.assistant.error")).some((node) => node.textContent.includes("重新检测模型"))`, 20_000);
  return cdp.evaluate(`(() => {
    const status = document.getElementById("composer-model-status");
    const assistant = Array.from(document.querySelectorAll(".message.assistant.error")).at(-1);
    return {
      providerSelectValue: document.getElementById("provider-select")?.value || "",
      modelProbeStatus: status?.dataset.modelProbeStatus || "",
      modelRestoredFromLocal: status?.dataset.modelRestoredFromLocal || "",
      modelCredentialStorage: status?.dataset.modelCredentialStorage || "",
      modelRecoveryRequired: status?.dataset.modelRecoveryRequired || "",
      modelGuideText: document.getElementById("composer-model-guide")?.textContent || "",
      modelProbeText: document.getElementById("composer-model-probe")?.textContent || "",
      modelPreferenceText: document.getElementById("composer-model-preference")?.textContent || "",
      modelConfigButtonText: document.getElementById("composer-model-config-button")?.textContent || "",
      modelConfigButtonAria: document.getElementById("composer-model-config-button")?.getAttribute("aria-label") || "",
      assistantText: assistant?.textContent || "",
      fetches: window.__phase91Fetches || [],
      pageTextContainsSecret: document.body.textContent.includes(${JSON.stringify(testApiKey)}),
      localStorageContainsSecret: Object.keys(localStorage).some((key) => String(localStorage.getItem(key) || "").includes(${JSON.stringify(testApiKey)})),
    };
  })()`);
}

function findBrowserPath() {
  const candidates = [
    process.env.PME_BROWSER_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    ...findVersionedBrowserPaths("C:\\Program Files (x86)\\Microsoft\\EdgeCore", "msedge.exe"),
    ...findVersionedBrowserPaths("C:\\Program Files (x86)\\Microsoft\\EdgeWebView\\Application", "msedge.exe"),
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("No supported headless browser found. Set PME_BROWSER_PATH to chrome.exe or msedge.exe.");
  return found;
}

function findVersionedBrowserPaths(root, executableName) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(root, entry.name, executableName))
    .reverse();
}

async function readDevToolsPort(profileDir) {
  const portFile = resolve(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const [port] = (await readFile(portFile, "utf8")).trim().split(/\r?\n/);
      if (port) return Number(port);
    } catch {
      await sleep(100);
    }
  }
  throw new Error("Timed out waiting for Chrome DevToolsActivePort.");
}

async function createCdpPage(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  if (!response.ok) throw new Error(`Unable to create CDP page: HTTP ${response.status}`);
  return response.json();
}

async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const events = [];
  let nextId = 1;

  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", rejectOpen, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const { resolveSend, rejectSend } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) rejectSend(new Error(message.error.message || JSON.stringify(message.error)));
      else resolveSend(message.result ?? {});
      return;
    }
    if (message.method) events.push(message);
  });

  return {
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolveSend, rejectSend) => pending.set(id, { resolveSend, rejectSend }));
    },
    async evaluate(expression) {
      const result = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed.");
      return result.result?.value;
    },
    takeEvent(method) {
      const index = events.findIndex((event) => event.method === method);
      return index >= 0 ? events.splice(index, 1)[0] : null;
    },
    async close() {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
    },
  };
}

async function closeCdpSilently(cdp) {
  try {
    await cdp?.close();
  } catch {
    // Best-effort cleanup only.
  }
}

async function waitForLoadEvent(cdp) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (cdp.takeEvent("Page.loadEventFired")) return;
    await sleep(100);
  }
  throw new Error("Timed out waiting for page load.");
}

async function waitForExpression(cdp, expression, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      if (await cdp.evaluate(`Boolean(${expression})`)) return true;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for expression: ${expression}; lastError=${lastError || "none"}`);
}

async function inspectPng(path) {
  const stats = await stat(path);
  const buffer = await readFile(path);
  const validPng = buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  return {
    bytes: stats.size,
    width: validPng ? buffer.readUInt32BE(16) : 0,
    height: validPng ? buffer.readUInt32BE(20) : 0,
    validPng,
  };
}

async function terminateBrowser(targetProcess) {
  if (!targetProcess || targetProcess.killed) return;
  const exited = new Promise((resolveExit) => targetProcess.once("exit", () => resolveExit(true)));
  targetProcess.kill();
  await Promise.race([exited, sleep(2000)]);
}

function listen(targetServer, port, host) {
  return new Promise((resolveListen, rejectListen) => {
    targetServer.once("error", rejectListen);
    targetServer.listen(port, host, () => {
      targetServer.off("error", rejectListen);
      resolveListen();
    });
  });
}

function close(targetServer) {
  return new Promise((resolveClose) => targetServer.close(() => resolveClose()));
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 91A Web Chat Model Config Restore Recovery Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Provider select value: ${body.ui?.state?.providerSelectValue ?? "n/a"}
- Restored from local: ${body.ui?.state?.modelRestoredFromLocal ?? "n/a"}
- Recovery required: ${body.ui?.state?.modelRecoveryRequired ?? "n/a"}
- Probe text: ${body.ui?.state?.modelProbeText ?? "n/a"}
- Preference text: ${body.ui?.state?.modelPreferenceText ?? "n/a"}
- Config button: ${body.ui?.state?.modelConfigButtonText ?? "n/a"}
- Guide: ${body.ui?.state?.modelGuideText ?? "n/a"}
- Fetches: ${(body.ui?.state?.fetches ?? []).join(", ")}
- Screenshot path: ${body.screenshot?.path ?? "n/a"}
- Screenshot bytes: ${body.screenshot?.bytes ?? "n/a"}
- Valid PNG: ${body.screenshot?.validPng}
- Real provider calls: ${body.safety?.realProviderCalls}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Conclusion: ${body.conclusion}
`;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
