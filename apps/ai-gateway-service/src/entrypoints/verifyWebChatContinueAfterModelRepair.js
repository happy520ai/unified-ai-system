import { spawn } from "node:child_process";
import { writeEvidencePair } from "./entrypointUtils.js";
import { existsSync, readdirSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { createConsolePage } from "../ui/consolePage.js";
import { sleep, listen, findBrowserPath, close } from "./entrypointUtils.js";

const PHASE = "phase-93a-web-chat-continue-after-model-repair";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-93a-web-chat-continue-after-model-repair.json");
const evidenceMdPath = resolve(evidenceDir, "phase-93a-web-chat-continue-after-model-repair.md");
const evidencePngPath = resolve(evidenceDir, "phase-93a-web-chat-continue-after-model-repair.png");
const testApiKey = "phase93-api-key-not-for-evidence";
const chatModelId = "phase93-restored-model";
const expectedRuntimeValue = `generic-openai-compatible::${chatModelId}`;
const endpoint = "https://phase93.example.test/v1";
const failedPrompt = "phase93 continue this failed request after repair";

let server;
let browserProcess;
let browserProfileDir;
let tempRoot;
let evidence;

try {
  verifyEmbeddedScriptSyntax();

  tempRoot = await mkdtemp(resolve(tmpdir(), "phase93a-runtime-store-"));
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
  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase93a-browser-profile-"));
  browserProcess = spawn(browserPath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${browserProfileDir}`,
    "--window-size=1440,1300",
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
          window.__phase93Fetches = [];
          window.__phase93RepairMode = false;
          localStorage.setItem("pme-moving-earth-provider-preference-v1", JSON.stringify({
            value: ${JSON.stringify(expectedRuntimeValue)},
            label: "OpenAI-compatible / ${chatModelId}",
            source: "phase93-continue-after-repair",
            savedAt: new Date().toISOString()
          }));
          const originalFetch = window.fetch.bind(window);
          window.fetch = async (...args) => {
            const raw = args[0];
            const requestUrl = typeof raw === "string" ? raw : (raw && raw.url) || "";
            const path = new URL(requestUrl || "/", window.location.href).pathname;
            window.__phase93Fetches.push(path);
            if (path === "/chat/stream" || path === "/chat/rag/stream") {
              if (window.__phase93RepairMode) {
                return new Response("event: chunk\\ndata: {\\"textDelta\\":\\"continued answer after repair\\"}\\n\\nevent: done\\ndata: {\\"success\\":true,\\"outputText\\":\\"continued answer after repair\\"}\\n\\n", {
                  status: 200,
                  headers: { "content-type": "text/event-stream; charset=utf-8" }
                });
              }
              return new Response(JSON.stringify({
                success: false,
                error: {
                  code: "RESTORED_RUNTIME_CREDENTIAL_REJECTED",
                  message: "Restored runtime credential rejected before repair."
                }
              }), {
                status: 401,
                headers: { "content-type": "application/json; charset=utf-8" }
              });
            }
            if (path === "/chat" || path === "/chat/rag") {
              if (window.__phase93RepairMode) {
                return new Response(JSON.stringify({
                  success: true,
                  data: {
                    selectedProvider: "generic-openai-compatible",
                    selectedModel: ${JSON.stringify(chatModelId)},
                    text: "model probe ok after repair",
                    outputText: "model probe ok after repair"
                  }
                }), {
                  status: 200,
                  headers: { "content-type": "application/json; charset=utf-8" }
                });
              }
              return new Response(JSON.stringify({
                success: false,
                error: {
                  code: "RESTORED_RUNTIME_CREDENTIAL_REJECTED",
                  message: "Restored runtime credential rejected before repair fallback."
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
        source: "phase93-continue-after-repair",
        savedAt: new Date().toISOString()
      }));
      const select = document.getElementById("provider-select");
      select.value = ${JSON.stringify(expectedRuntimeValue)};
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    await waitForExpression(cdp, `document.getElementById("composer-model-status")?.dataset.modelRestoredFromLocal === "true"`, 20_000);

    await sendPrompt(cdp, failedPrompt);
    await waitForExpression(cdp, `document.getElementById("composer-model-status")?.dataset.modelRecoveryRequired === "true"`, 20_000);
    await cdp.evaluate(`document.getElementById("composer-model-config-button").click()`);
    await waitForExpression(cdp, `document.querySelector("[data-model-config-recovery-mode='restore-recovery']") != null`, 20_000);
    await cdp.evaluate(`(() => {
      window.__phase93RepairMode = true;
      document.querySelector("[data-command-action='apply-and-probe-provider']").click();
      return true;
    })()`);
    await waitForExpression(cdp, `document.getElementById("composer-model-status")?.dataset.modelProbeStatus === "passed"`, 20_000);
    await waitForExpression(cdp, `document.querySelector("[data-command-action='continue-last-failed-prompt']") != null`, 20_000);
    const beforeContinueState = await readBeforeContinueState(cdp);

    await cdp.evaluate(`document.querySelector("[data-command-action='continue-last-failed-prompt']").click()`);
    await waitForExpression(cdp, `Array.from(document.querySelectorAll(".message.assistant")).some((node) => node.textContent.includes("continued answer after repair"))`, 20_000);
    const continuedState = await readContinuedState(cdp);

    await mkdir(evidenceDir, { recursive: true });
    await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
      .then(async (result) => writeFile(evidencePngPath, Buffer.from(result.data, "base64")));
    await cdp.close();

    const screenshot = await inspectPng(evidencePngPath);
    const serializedState = JSON.stringify({ beforeContinueState, continuedState });
    const passed = beforeContinueState.continueActionPresent &&
      beforeContinueState.continueActionText.includes("继续刚才的问题") &&
      beforeContinueState.modelProbeStatus === "passed" &&
      continuedState.continuedAnswerPresent &&
      continuedState.repeatedUserPromptCount >= 2 &&
      continuedState.modelProbeStatus === "passed" &&
      continuedState.modelRecoveryRequired === "false" &&
      continuedState.fetches.filter((path) => path === "/chat/rag/stream" || path === "/chat/stream").length >= 2 &&
      !serializedState.includes(testApiKey) &&
      !continuedState.pageTextContainsSecret &&
      !continuedState.localStorageContainsSecret &&
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
        beforeContinueState,
        continuedState,
      },
      screenshot: {
        path: "apps/ai-gateway-service/evidence/phase-93a-web-chat-continue-after-model-repair.png",
        bytes: screenshot.bytes,
        width: screenshot.width,
        height: screenshot.height,
        validPng: screenshot.validPng,
      },
      safety: {
        browserInteraction: true,
        simulatedProviderFailureRepairAndContinueOnly: true,
        realProviderCalls: false,
        apiKeyValueRecorded: false,
        defaultChatMainLaneChanged: false,
        backendBusinessRouteAdded: false,
      },
      conclusion: passed ? "web-chat-continue-after-model-repair-actionable" : "web-chat-continue-after-model-repair-not-actionable",
    };
  } finally {
    await closeCdpSilently(cdp);
  }

  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = evidence.status === "passed" ? 0 : 1;
} catch (error) {
  evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "web-chat-continue-after-model-repair-not-actionable",
  };
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
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
    warning: "Local user credential store for Phase93A verification only.",
    records: [{
      providerId: "generic-openai-compatible",
      apiKey: testApiKey,
      endpoint,
      source: "phase93-continue-after-repair",
      setAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      models: [{
        id: chatModelId,
        displayName: "Phase93 Restored Model",
        capabilities: ["chat", "summary"],
        source: "phase93-continue-after-repair",
        metadata: {
          providerEndpoint: endpoint,
        },
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

async function readBeforeContinueState(cdp) {
  return cdp.evaluate(`(() => {
    const status = document.getElementById("composer-model-status");
    const action = document.querySelector("[data-command-action='continue-last-failed-prompt']");
    return {
      modelProbeStatus: status?.dataset.modelProbeStatus || "",
      modelRecoveryRequired: status?.dataset.modelRecoveryRequired || "",
      continueActionPresent: Boolean(action),
      continueActionText: action?.textContent || "",
      feedbackText: document.querySelector("[data-model-config-recovery-mode='restore-recovery'] [data-command-feedback]")?.textContent || "",
    };
  })()`);
}

async function readContinuedState(cdp) {
  return cdp.evaluate(`(() => {
    const status = document.getElementById("composer-model-status");
    const userMessages = Array.from(document.querySelectorAll(".message.user"));
    const assistantMessages = Array.from(document.querySelectorAll(".message.assistant"));
    return {
      modelProbeStatus: status?.dataset.modelProbeStatus || "",
      modelRecoveryRequired: status?.dataset.modelRecoveryRequired || "",
      continuedAnswerPresent: assistantMessages.some((node) => node.textContent.includes("continued answer after repair")),
      repeatedUserPromptCount: userMessages.filter((node) => node.textContent.includes(${JSON.stringify(failedPrompt)})).length,
      fetches: window.__phase93Fetches || [],
      pageTextContainsSecret: document.body.textContent.includes(${JSON.stringify(testApiKey)}),
      localStorageContainsSecret: Object.keys(localStorage).some((key) => String(localStorage.getItem(key) || "").includes(${JSON.stringify(testApiKey)})),
    };
  })()`);
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

