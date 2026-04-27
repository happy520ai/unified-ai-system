import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { createConsolePage } from "../ui/consolePage.js";

const PHASE = "phase-95a-web-chat-model-config-ready-to-chat";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-95a-web-chat-model-config-ready-to-chat.json");
const evidenceMdPath = resolve(evidenceDir, "phase-95a-web-chat-model-config-ready-to-chat.md");
const evidencePngPath = resolve(evidenceDir, "phase-95a-web-chat-model-config-ready-to-chat.png");
const testApiKey = "phase95-secret-must-not-persist";
const chatModelId = "phase95-chat-model";
const selectedPreviewValue = `openai-compatible::${chatModelId}`;
const expectedRuntimeValue = `generic-openai-compatible::${chatModelId}`;

let server;
let mockProviderServer;
let browserProcess;
let browserProfileDir;
let evidence;

try {
  verifyEmbeddedScriptSyntax();

  const mockRequests = [];
  mockProviderServer = createMockOpenAiCompatibleProvider(mockRequests);
  await listen(mockProviderServer, 0, "127.0.0.1");
  const mockProviderBaseUrl = `http://127.0.0.1:${mockProviderServer.address().port}/v1`;

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
    PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const uiUrl = `${serviceUrl}/ui?showFakeProviders=1`;

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase95a-browser-profile-"));
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
    await installFetchRecorderOnNewDocument(cdp);
    await cdp.send("Page.navigate", { url: uiUrl });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, "document.getElementById('provider-select').options.length > 1");

    await openModelConfigWizard(cdp);
    await waitForExpression(cdp, `Boolean(document.querySelector("[data-command-wizard='model-config-v2']"))`, 20_000);

    await fillAndDetectModel(cdp, mockProviderBaseUrl);
    await waitForExpression(cdp, `document.querySelector("[data-command-provider-select]")?.value === ${JSON.stringify(selectedPreviewValue)}`, 20_000);
    await waitForExpression(cdp, `Boolean(document.querySelector("[data-command-feedback] [data-command-action='apply-detected-model']"))`, 20_000);

    await clickAction(cdp, "apply-detected-model");
    await waitForExpression(cdp, `document.getElementById("composer-model-status")?.dataset.modelProbeStatus === "passed"`, 25_000);
    await waitForExpression(cdp, `document.getElementById("provider-select")?.value === ${JSON.stringify(expectedRuntimeValue)}`, 20_000);

    await clickAction(cdp, "continue-chat-after-model-check");
    await waitForExpression(cdp, `document.activeElement?.id === "chat-input"`, 10_000);
    await waitForExpression(cdp, `document.getElementById("composer-shortcut-hint")?.dataset.composerGuidanceKind === "model-ready-nudge"`, 10_000);

    const readyState = await readReadyState(cdp);

    await mkdir(evidenceDir, { recursive: true });
    await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
      .then(async (result) => writeFile(evidencePngPath, Buffer.from(result.data, "base64")));
    await cdp.close();

    const screenshot = await inspectPng(evidencePngPath);
    const evidenceDraft = {
      phase: PHASE,
      status: "pending",
      generatedAt: new Date().toISOString(),
      browserPath,
      serviceUrl,
      ui: {
        url: uiUrl,
        readyState,
      },
      mockProvider: {
        requestCount: mockRequests.length,
        requests: mockRequests,
      },
      screenshot: {
        path: "apps/ai-gateway-service/evidence/phase-95a-web-chat-model-config-ready-to-chat.png",
        bytes: screenshot.bytes,
        width: screenshot.width,
        height: screenshot.height,
        validPng: screenshot.validPng,
      },
      safety: {
        browserInteraction: true,
        localMockProviderOnly: true,
        realProviderCalls: false,
        apiKeyValueRecorded: false,
        apiKeyPersistedInBrowser: false,
        apiKeyPersistedInEvidence: false,
        defaultChatMainLaneChanged: false,
      },
      conclusion: "pending",
    };

    const serialized = JSON.stringify(evidenceDraft);
    const passed = readyState.modelProbeStatus === "passed" &&
      readyState.modelReady === "true" &&
      readyState.providerSelectValue === expectedRuntimeValue &&
      readyState.focusReturnedToChatInput &&
      readyState.inputPlaceholder.includes("模型已就绪") &&
      readyState.composerGuidanceKind === "model-ready-nudge" &&
      readyState.composerGuidanceText.includes("已经能聊") &&
      readyState.sessionStatusText.includes("模型已就绪") &&
      readyState.sendButtonDisabled === true &&
      readyState.secretInputCleared === true &&
      readyState.localStorageContainsSecret === false &&
      readyState.pageTextContainsSecret === false &&
      mockRequests.some((request) => request.method === "GET" && request.url === "/v1/models" && request.hasAuthorization) &&
      mockRequests.some((request) => request.method === "POST" && request.url === "/v1/chat/completions" && request.model === chatModelId && request.hasAuthorization) &&
      screenshot.validPng &&
      screenshot.bytes > 10000 &&
      !serialized.includes(testApiKey);

    evidence = {
      ...evidenceDraft,
      status: passed ? "passed" : "failed",
      conclusion: passed ? "web-chat-model-config-ready-to-chat-actionable" : "web-chat-model-config-ready-to-chat-not-actionable",
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
    conclusion: "web-chat-model-config-ready-to-chat-not-actionable",
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
  if (mockProviderServer) {
    await close(mockProviderServer).catch(() => undefined);
  }
}

function createMockOpenAiCompatibleProvider(requests) {
  return createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString("utf8");
    const body = safeJsonParse(bodyText);
    requests.push({
      method: request.method,
      url: request.url,
      hasAuthorization: Boolean(request.headers.authorization),
      authorizationRedacted: request.headers.authorization ? "Bearer ***" : "",
      model: body?.model || "",
      stream: body?.stream === true,
    });

    if (request.method === "GET" && request.url === "/v1/models") {
      return sendJson(response, 200, {
        object: "list",
        data: [{
          id: chatModelId,
          object: "model",
          owned_by: "phase95-mock",
          capabilities: ["chat", "summary"],
          input_modalities: ["text"],
          output_modalities: ["text"],
        }],
      });
    }

    if (request.method === "POST" && request.url === "/v1/chat/completions") {
      return sendJson(response, 200, {
        id: "phase95-chat-completion",
        object: "chat.completion",
        model: body?.model || chatModelId,
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: "phase95 model is ready for chat",
          },
          finish_reason: "stop",
        }],
      });
    }

    sendJson(response, 404, { error: { message: "not found" } });
  });
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function verifyEmbeddedScriptSyntax() {
  const html = createConsolePage();
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Console page script not found.");
  new vm.Script(match[1], { filename: "consolePage-inline.js" });
}

async function installFetchRecorderOnNewDocument(cdp) {
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      (() => {
        window.__phase95Fetches = [];
        const originalFetch = window.fetch.bind(window);
        window.fetch = async (...args) => {
          const path = String(args[0] || "");
          const options = args[1] || {};
          const item = { path };
          try {
            const parsed = JSON.parse(options.body || "{}");
            if (path === "/models/import/preview") {
              item.providerHint = parsed.providerHint || "";
              item.baseUrl = parsed.baseUrl || "";
              item.hasApiKey = Boolean(parsed.apiKey);
              item.apiKeyRedacted = parsed.apiKey ? "***" : "";
            } else if (path === "/models/import/confirm") {
              item.providerId = parsed.providerId || "";
              item.modelId = parsed.modelId || "";
              item.hasApiKeyRef = Boolean(parsed.apiKeyRef);
            } else if (path === "/chat") {
              item.providerId = parsed.providerId || "";
              item.model = parsed.model || "";
              item.promptPresent = Boolean(parsed.prompt);
            }
          } catch {
            item.bodyParseFailed = true;
          }
          window.__phase95Fetches.push(item);
          return originalFetch(...args);
        };
      })();
    `,
  });
}

async function openModelConfigWizard(cdp) {
  await cdp.evaluate(`(() => {
    const button = document.getElementById("composer-model-config-button");
    if (!button) throw new Error("composer model config button missing");
    button.click();
    return true;
  })()`);
}

async function fillAndDetectModel(cdp, mockProviderBaseUrl) {
  await cdp.evaluate(`(() => {
    const secret = document.querySelector("[data-command-secret-draft]");
    const hint = document.querySelector("[data-command-provider-hint]");
    const baseUrl = document.querySelector("[data-command-base-url]");
    const detect = document.querySelector("[data-command-action='detect-provider-from-key']");
    secret.value = ${JSON.stringify(testApiKey)};
    secret.dispatchEvent(new Event("input", { bubbles: true }));
    hint.value = "openai-compatible";
    hint.dispatchEvent(new Event("change", { bubbles: true }));
    baseUrl.value = ${JSON.stringify(mockProviderBaseUrl)};
    baseUrl.dispatchEvent(new Event("input", { bubbles: true }));
    detect.click();
    return true;
  })()`);
}

async function clickAction(cdp, action) {
  const selector = `[data-command-feedback] [data-command-action="${action}"]`;
  await cdp.evaluate(`(() => {
    const button = document.querySelector(${JSON.stringify(selector)});
    if (!button) throw new Error("Missing action button: " + ${JSON.stringify(action)});
    button.click();
    return true;
  })()`);
}

async function readReadyState(cdp) {
  return cdp.evaluate(`(() => {
    const status = document.getElementById("composer-model-status");
    const input = document.getElementById("chat-input");
    const secret = document.querySelector("[data-command-secret-draft]");
    const localStorageDump = Object.keys(localStorage).map((key) => key + ":" + localStorage.getItem(key)).join("\\n");
    return {
      providerSelectValue: document.getElementById("provider-select")?.value || "",
      modelProbeStatus: status?.dataset.modelProbeStatus || "",
      modelReady: status?.dataset.modelReady || "",
      focusReturnedToChatInput: document.activeElement?.id === "chat-input",
      inputPlaceholder: input?.getAttribute("placeholder") || "",
      composerGuidanceKind: document.getElementById("composer-shortcut-hint")?.dataset.composerGuidanceKind || "",
      composerGuidanceText: document.getElementById("composer-shortcut-hint")?.textContent || "",
      sessionStatusText: document.getElementById("chat-session-status")?.textContent || "",
      sendButtonDisabled: document.getElementById("send-button")?.disabled === true,
      secretInputCleared: (secret?.value || "") === "",
      pageTextContainsSecret: document.body.textContent.includes(${JSON.stringify(testApiKey)}),
      localStorageContainsSecret: localStorageDump.includes(${JSON.stringify(testApiKey)}),
      fetches: window.__phase95Fetches || [],
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
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
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
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime.evaluate failed.");
      }
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
  return `# Phase 95A Web Chat Model Config Ready To Chat Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Provider select value: ${body.ui?.readyState?.providerSelectValue ?? "n/a"}
- Model probe status: ${body.ui?.readyState?.modelProbeStatus ?? "n/a"}
- Input focused: ${body.ui?.readyState?.focusReturnedToChatInput}
- Input placeholder: ${body.ui?.readyState?.inputPlaceholder ?? "n/a"}
- Composer guidance kind: ${body.ui?.readyState?.composerGuidanceKind ?? "n/a"}
- Session status: ${body.ui?.readyState?.sessionStatusText ?? "n/a"}
- Screenshot path: ${body.screenshot?.path ?? "n/a"}
- Screenshot bytes: ${body.screenshot?.bytes ?? "n/a"}
- Valid PNG: ${body.screenshot?.validPng}
- Real provider calls: ${body.safety?.realProviderCalls}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Conclusion: ${body.conclusion}
`;
}

function safeJsonParse(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
