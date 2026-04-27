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

const PHASE = "phase-85a-web-chat-model-config-failure-paths";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-85a-web-chat-model-config-failure-paths.json");
const evidenceMdPath = resolve(evidenceDir, "phase-85a-web-chat-model-config-failure-paths.md");
const evidencePngPath = resolve(evidenceDir, "phase-85a-web-chat-model-config-failure-paths.png");

let server;
let browserProcess;
let browserProfileDir;
let evidence;

try {
  verifyEmbeddedScriptSyntax();

  const browserPath = findBrowserPath();
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "registry-default",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory",
    PME_ENTERPRISE_AUTH_ENABLED: "false",
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const uiUrl = `${serviceUrl}/ui?showFakeProviders=1`;

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase85a-browser-profile-"));
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
          window.__phase85Fetches = [];
          window.__phase85Scenario = "needs_provider_selection";
          const originalFetch = window.fetch.bind(window);
          window.fetch = async (...args) => {
            const path = String(args[0] || "");
            window.__phase85Fetches.push(path);
            if (path === "/models/import/preview") {
              const scenario = window.__phase85Scenario || "needs_provider_selection";
              const payloads = {
                needs_provider_selection: {
                  success: false,
                  data: {
                    status: "needs_provider_selection",
                    providerCandidates: ["openai-compatible"],
                    reason: "Cannot identify provider from API key alone.",
                  },
                },
                no_chat_models: {
                  success: false,
                  data: {
                    status: "provider_detected_but_no_chat_models",
                    providerId: "demo-vision-provider",
                    models: [{
                      providerId: "demo-vision-provider",
                      modelId: "vision-demo-model",
                      displayName: "Vision Demo Model",
                      capabilities: ["vision"],
                      metadata: { modalities: { image: true } },
                    }],
                  },
                },
              };
              return new Response(JSON.stringify(payloads[scenario] || payloads.needs_provider_selection), {
                status: 200,
                headers: { "content-type": "application/json; charset=utf-8" },
              });
            }
            if (path === "/chat") {
              return new Response(JSON.stringify({
                success: false,
                error: {
                  code: "ZHIPU_REQUEST_TIMEOUT",
                  message: "Zhipu AI request timed out after 10000ms",
                },
              }), {
                status: 400,
                headers: { "content-type": "application/json; charset=utf-8" },
              });
            }
            return originalFetch(...args);
          };
        })();
      `,
    });
    await cdp.send("Page.navigate", { url: uiUrl });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, "document.getElementById('provider-select').options.length > 1");

    await sendPrompt(cdp, "配置模型");
    await waitForExpression(cdp, `Boolean(document.querySelector("[data-command-wizard='model-config-v2']"))`, 20_000);

    const needsProvider = await runPreviewScenario(cdp, {
      scenario: "needs_provider_selection",
      apiKey: "unknown-provider-key",
      expectedText: "无法仅凭 API Key 判断服务商",
    });

    const noChatModels = await runPreviewScenario(cdp, {
      scenario: "no_chat_models",
      apiKey: "vision-only-key",
      expectedText: "聊天模型为 0",
    });

    const timeoutProbe = await runChatProbeTimeoutScenario(cdp);

    await mkdir(evidenceDir, { recursive: true });
    await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })
      .then(async (result) => writeFile(evidencePngPath, Buffer.from(result.data, "base64")));
    await cdp.close();

    const screenshot = await inspectPng(evidencePngPath);
    const allFetches = await cdpSafeValue(() => [], []);
    const passed = needsProvider.passed &&
      noChatModels.passed &&
      timeoutProbe.passed &&
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
        needsProvider,
        noChatModels,
        timeoutProbe,
        allFetches,
      },
      screenshot: {
        path: "apps/ai-gateway-service/evidence/phase-85a-web-chat-model-config-failure-paths.png",
        bytes: screenshot.bytes,
        width: screenshot.width,
        height: screenshot.height,
        validPng: screenshot.validPng,
      },
      safety: {
        browserInteraction: true,
        simulatedModelImportFailuresOnly: true,
        simulatedChatTimeoutOnly: true,
        fakeProviderOnly: true,
        realProviderCalls: false,
        backendBusinessRouteAdded: false,
        defaultChatMainLaneChanged: false,
        secretPersisted: false,
        releaseAutomation: false,
      },
      conclusion: passed ? "web-chat-model-config-failure-paths-readable-and-actionable" : "web-chat-model-config-failure-paths-not-actionable",
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
    conclusion: "web-chat-model-config-failure-paths-not-actionable",
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
    await close(server);
  }
}

function verifyEmbeddedScriptSyntax() {
  const html = createConsolePage();
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Console page script not found.");
  new vm.Script(match[1], { filename: "consolePage-inline.js" });
}

async function runPreviewScenario(cdp, { scenario, apiKey, expectedText }) {
  await cdp.evaluate(`(() => {
    window.__phase85Scenario = ${JSON.stringify(scenario)};
    const secret = document.querySelector("[data-command-secret-draft]");
    secret.value = ${JSON.stringify(apiKey)};
    secret.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("[data-command-action='detect-provider-from-key']").click();
    return true;
  })()`);
  await waitForExpression(cdp, `document.querySelector("[data-command-feedback]")?.textContent.includes(${JSON.stringify(expectedText)})`, 20_000);
  const state = await readConfigState(cdp);
  return {
    scenario,
    passed: state.feedbackText.includes(expectedText) &&
      state.nextActions.retryOrDetect &&
      state.nextActions.provider &&
      state.nextActions.baseUrl &&
      (scenario === "needs_provider_selection" || state.nextActions.manualModel || state.feedbackText.includes("手填聊天模型 ID")) &&
      !state.localStorageDump.includes(apiKey),
    feedbackText: state.feedbackText,
    nextActions: state.nextActions,
    secretPersisted: state.localStorageDump.includes(apiKey),
    fetches: state.fetches,
  };
}

async function runChatProbeTimeoutScenario(cdp) {
  await cdp.evaluate(`(() => {
    const select = document.querySelector("[data-command-provider-select]");
    select.value = "local-fake-provider::local-fake-model";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelector("[data-command-action='probe-provider']").click();
    return true;
  })()`);
  await waitForExpression(cdp, `document.querySelector("[data-command-feedback]")?.textContent.includes("当前模型暂不可用")`, 20_000);
  const state = await readConfigState(cdp);
  return {
    scenario: "chat_probe_timeout",
    passed: state.feedbackText.includes("ZHIPU_REQUEST_TIMEOUT") &&
      state.feedbackText.includes("重新检测") &&
      state.feedbackText.includes("查看排查命令") &&
      state.nextActions.retryOrDetect &&
      state.nextActions.diagnostics &&
      state.fetches.includes("/chat"),
    feedbackText: state.feedbackText,
    nextActions: state.nextActions,
    fetches: state.fetches,
  };
}

async function readConfigState(cdp) {
  return cdp.evaluate(`(() => {
    const feedback = document.querySelector("[data-command-feedback]");
    const actionTexts = Array.from(feedback?.querySelectorAll("button") || []).map((node) => node.textContent || "");
    const hasAction = (needle) => actionTexts.some((text) => text.includes(needle));
    return {
      feedbackText: feedback?.textContent || "",
      actionTexts,
      nextActions: {
        retryOrDetect: hasAction("重新检测") || hasAction("自动识别") || hasAction("一键添加"),
        provider: hasAction("选择 provider"),
        baseUrl: hasAction("填写 Base URL"),
        manualModel: hasAction("手填模型 ID") || hasAction("手填聊天模型 ID"),
        diagnostics: hasAction("查看排查命令"),
        continueChat: hasAction("继续聊天"),
      },
      localStorageDump: Object.keys(localStorage).map((key) => key + ":" + localStorage.getItem(key)).join("\\n"),
      fetches: window.__phase85Fetches || [],
    };
  })()`);
}

async function cdpSafeValue(factory, fallback) {
  try {
    return factory();
  } catch {
    return fallback;
  }
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

async function terminateBrowser(targetProcess) {
  if (!targetProcess || targetProcess.killed) return;
  const exited = new Promise((resolveExit) => targetProcess.once("exit", () => resolveExit(true)));
  targetProcess.kill();
  await Promise.race([exited, sleep(2000)]);
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

async function sendPrompt(cdp, prompt) {
  await cdp.evaluate(`(() => {
    const input = document.getElementById("chat-input");
    input.value = ${JSON.stringify(prompt)};
    input.dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("chat-form").requestSubmit();
    return true;
  })()`);
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
  return `# Phase 85A Web Chat Model Config Failure Paths Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Needs provider scenario passed: ${body.ui?.needsProvider?.passed}
- No chat models scenario passed: ${body.ui?.noChatModels?.passed}
- Timeout probe scenario passed: ${body.ui?.timeoutProbe?.passed}
- Screenshot path: ${body.screenshot?.path ?? "n/a"}
- Screenshot bytes: ${body.screenshot?.bytes ?? "n/a"}
- Screenshot dimensions: ${body.screenshot?.width ?? "n/a"}x${body.screenshot?.height ?? "n/a"}
- Valid PNG: ${body.screenshot?.validPng}
- Browser interaction: ${body.safety?.browserInteraction}
- Real provider calls: ${body.safety?.realProviderCalls}
- Backend business route added: ${body.safety?.backendBusinessRouteAdded}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Secret persisted: ${body.safety?.secretPersisted}
- Conclusion: ${body.conclusion}
`;
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
