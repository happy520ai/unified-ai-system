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

const PHASE = "phase-89a-web-chat-model-config-restart-persistence";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-89a-web-chat-model-config-restart-persistence.json");
const evidenceMdPath = resolve(evidenceDir, "phase-89a-web-chat-model-config-restart-persistence.md");
const evidencePngPath = resolve(evidenceDir, "phase-89a-web-chat-model-config-restart-persistence.png");
const testApiKey = "phase89-persistable-api-key-not-for-evidence";
const chatModelId = "phase89-persisted-chat-model";
const selectedPreviewValue = `openai-compatible::${chatModelId}`;
const expectedRuntimeValue = `generic-openai-compatible::${chatModelId}`;
const reloadPrompt = "first reload chat marker";
const restartPrompt = "first restart chat marker";
const reloadAnswerMarker = "phase89-reload-chat-marker";
const restartAnswerMarker = "phase89-restart-chat-marker";

let server;
let mockProviderServer;
let browserProcess;
let browserProfileDir;
let tempRoot;
let evidence;

try {
  verifyEmbeddedScriptSyntax();

  tempRoot = await mkdtemp(resolve(tmpdir(), "phase89a-runtime-store-"));
  const runtimeCredentialStorePath = resolve(tempRoot, "runtime-credentials.json");
  const servicePort = await reservePort();
  const mockRequests = [];
  mockProviderServer = createMockOpenAiCompatibleProvider(mockRequests);
  await listen(mockProviderServer, 0, "127.0.0.1");
  const mockProviderBaseUrl = `http://127.0.0.1:${mockProviderServer.address().port}/v1`;

  const browserPath = findBrowserPath();
  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase89a-browser-profile-"));
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

    server = await startGatewayServer({ servicePort, runtimeCredentialStorePath });
    const serviceUrl = `http://127.0.0.1:${servicePort}`;
    const uiUrl = `${serviceUrl}/ui?showFakeProviders=1`;

    await navigateAndWait(cdp, uiUrl);
    await waitForExpression(cdp, "document.getElementById('provider-select').options.length > 1");
    await configureModel(cdp, mockProviderBaseUrl);
    await waitForExpression(cdp, `document.getElementById("provider-select")?.value === ${JSON.stringify(expectedRuntimeValue)}`, 20_000);
    await waitForExpression(cdp, `JSON.parse(localStorage.getItem("pme-moving-earth-provider-preference-v1") || "{}").value === ${JSON.stringify(expectedRuntimeValue)}`, 20_000);

    const persistedStoreAfterConfigure = await readPersistedStoreSummary(runtimeCredentialStorePath);

    await navigateAndWait(cdp, uiUrl);
    await waitForExpression(cdp, `document.getElementById("provider-select")?.value === ${JSON.stringify(expectedRuntimeValue)}`, 20_000);
    await sendChat(cdp, reloadPrompt);
    const reloadState = await waitForChatResult(cdp, reloadAnswerMarker);

    await close(server);
    server = null;

    server = await startGatewayServer({ servicePort, runtimeCredentialStorePath });
    await navigateAndWait(cdp, uiUrl);
    await waitForExpression(cdp, `document.getElementById("provider-select")?.value === ${JSON.stringify(expectedRuntimeValue)}`, 20_000);
    await sendChat(cdp, restartPrompt);
    const restartState = await waitForChatResult(cdp, restartAnswerMarker);

    await mkdir(evidenceDir, { recursive: true });
    await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
      .then(async (result) => writeFile(evidencePngPath, Buffer.from(result.data, "base64")));
    await cdp.close();

    const screenshot = await inspectPng(evidencePngPath);
    const mockSummary = summarizeMockRequests(mockRequests);
    const evidenceDraft = {
      phase: PHASE,
      status: "pending",
      generatedAt: new Date().toISOString(),
      browserPath,
      service: {
        url: serviceUrl,
        samePortRestart: true,
        runtimeCredentialStoreMode: "local-file",
        runtimeCredentialStorePathPresent: existsSync(runtimeCredentialStorePath),
      },
      ui: {
        url: uiUrl,
        mockProviderBaseUrl,
        reloadState,
        restartState,
      },
      persistedStore: persistedStoreAfterConfigure,
      mockProvider: mockSummary,
      screenshot: {
        path: "apps/ai-gateway-service/evidence/phase-89a-web-chat-model-config-restart-persistence.png",
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
        apiKeyPersistedInEvidence: false,
        defaultChatMainLaneChanged: false,
        backendBusinessRouteAdded: false,
      },
      conclusion: "pending",
    };

    const passed = persistedStoreAfterConfigure.recordCount === 1 &&
      persistedStoreAfterConfigure.providers.includes("generic-openai-compatible") &&
      persistedStoreAfterConfigure.modelIds.includes(chatModelId) &&
      reloadState.providerSelectValue === expectedRuntimeValue &&
      reloadState.preferenceValue === expectedRuntimeValue &&
      reloadState.assistantAnswerIncludesExpectedMarker === true &&
      reloadState.chatStreamFetch?.providerId === "generic-openai-compatible" &&
      reloadState.chatStreamFetch?.model === chatModelId &&
      restartState.providerSelectValue === expectedRuntimeValue &&
      restartState.preferenceValue === expectedRuntimeValue &&
      restartState.assistantAnswerIncludesExpectedMarker === true &&
      restartState.chatStreamFetch?.providerId === "generic-openai-compatible" &&
      restartState.chatStreamFetch?.model === chatModelId &&
      restartState.inputClearedAfterSend === true &&
      restartState.focusReturnedToChatInput === true &&
      restartState.localStorageContainsSecret === false &&
      restartState.pageTextContainsSecret === false &&
      mockSummary.streamChatRequestCount >= 2 &&
      mockSummary.streamModels.includes(chatModelId) &&
      screenshot.validPng &&
      screenshot.bytes > 10000 &&
      !JSON.stringify(evidenceDraft).includes(testApiKey);

    evidence = {
      ...evidenceDraft,
      status: passed ? "passed" : "failed",
      conclusion: passed ? "web-chat-model-config-restart-persistence-connected" : "web-chat-model-config-restart-persistence-not-connected",
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
    conclusion: "web-chat-model-config-restart-persistence-not-connected",
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
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function startGatewayServer({ servicePort, runtimeCredentialStorePath }) {
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
  const nextServer = createGatewayHttpServer(application);
  await listen(nextServer, servicePort, "127.0.0.1");
  return nextServer;
}

function createMockOpenAiCompatibleProvider(requests) {
  return createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString("utf8");
    const body = safeJsonParse(bodyText);
    const prompt = Array.isArray(body?.messages) ? body.messages.map((item) => item.content).join("\n").slice(0, 200) : "";
    requests.push({
      method: request.method,
      url: request.url,
      hasAuthorization: Boolean(request.headers.authorization),
      authorizationRedacted: request.headers.authorization ? "Bearer ***" : "",
      model: body?.model || "",
      stream: body?.stream === true,
      prompt,
    });

    if (request.method === "GET" && request.url === "/v1/models") {
      return sendJson(response, 200, {
        object: "list",
        data: [{
          id: chatModelId,
          object: "model",
          owned_by: "phase89-mock",
          capabilities: ["chat", "summary"],
          input_modalities: ["text"],
          output_modalities: ["text"],
        }],
      });
    }

    if (request.method === "POST" && request.url === "/v1/chat/completions") {
      const marker = prompt.includes(restartPrompt) ? restartAnswerMarker : reloadAnswerMarker;
      if (body?.stream === true) {
        response.writeHead(200, { "content-type": "text/event-stream; charset=utf-8" });
        response.write(`data: ${JSON.stringify({
          id: "phase89-chat-stream-1",
          object: "chat.completion.chunk",
          model: body?.model || chatModelId,
          choices: [{ index: 0, delta: { content: "phase89 persisted chat answer " }, finish_reason: null }],
        })}\n\n`);
        response.write(`data: ${JSON.stringify({
          id: "phase89-chat-stream-2",
          object: "chat.completion.chunk",
          model: body?.model || chatModelId,
          choices: [{ index: 0, delta: { content: marker }, finish_reason: null }],
        })}\n\n`);
        response.write("data: [DONE]\n\n");
        response.end();
        return;
      }

      return sendJson(response, 200, {
        id: "phase89-chat-completion",
        object: "chat.completion",
        model: body?.model || chatModelId,
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: "phase89 config probe answer",
          },
          finish_reason: "stop",
        }],
      });
    }

    sendJson(response, 404, { error: { message: "not found" } });
  });
}

async function configureModel(cdp, mockProviderBaseUrl) {
  await openModelConfigWizard(cdp);
  await waitForExpression(cdp, `Boolean(document.querySelector("[data-command-wizard='model-config-v2']"))`, 20_000);
  await fillAndDetectModel(cdp, mockProviderBaseUrl);
  await waitForExpression(cdp, `document.querySelector("[data-command-provider-select]")?.value === ${JSON.stringify(selectedPreviewValue)}`, 20_000);
  await waitForExpression(cdp, `Boolean(document.querySelector("[data-command-feedback] [data-command-action='apply-detected-model']"))`, 20_000);
  await clickAction(cdp, "apply-detected-model");
  await waitForExpression(cdp, `document.getElementById("composer-model-status")?.dataset.modelProbeStatus === "passed"`, 25_000);
  await clickAction(cdp, "persist-detected-model");
  await clickAction(cdp, "continue-chat-after-model-check");
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

async function sendChat(cdp, prompt) {
  await cdp.evaluate(`(() => {
    window.__phase89Fetches = [];
    const input = document.getElementById("chat-input");
    const form = document.getElementById("chat-form");
    input.value = ${JSON.stringify(prompt)};
    input.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    return true;
  })()`);
}

async function waitForChatResult(cdp, expectedMarker) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const state = await readState(cdp, expectedMarker);
    if ((state.assistantAnswerIncludesExpectedMarker && state.composerIdle) || state.assistantErrorText) {
      return state;
    }
    await sleep(150);
  }
  throw new Error(`Timed out waiting for configured-model chat answer: ${expectedMarker}`);
}

async function readState(cdp, expectedMarker) {
  return cdp.evaluate(`(() => {
    const fetches = window.__phase89Fetches || [];
    const assistantMessages = Array.from(document.querySelectorAll(".message.assistant"));
    const latestAssistant = assistantMessages[assistantMessages.length - 1];
    const latestAssistantText = latestAssistant?.querySelector(".message-text")?.textContent || latestAssistant?.textContent || "";
    const latestAssistantStatus = latestAssistant?.querySelector("[data-message-status]")?.textContent || latestAssistant?.textContent || "";
    const preference = JSON.parse(localStorage.getItem("pme-moving-earth-provider-preference-v1") || "{}");
    const pageText = document.body.textContent || "";
    const localStorageDump = Object.keys(localStorage).map((key) => key + ":" + localStorage.getItem(key)).join("\\n");
    const input = document.getElementById("chat-input");
    const stopButton = document.getElementById("stop-chat-button");
    const form = document.getElementById("chat-form");
    const modelStatus = document.getElementById("composer-model-status");
    const modelGuide = document.getElementById("composer-model-guide");
    const modelProbe = document.getElementById("composer-model-probe");
    const modelPreference = document.getElementById("composer-model-preference");
    return {
      providerSelectValue: document.getElementById("provider-select")?.value || "",
      composerModelReady: modelStatus?.dataset.modelReady || "",
      composerModelProviderId: modelStatus?.dataset.modelProviderId || "",
      composerModelId: modelStatus?.dataset.modelId || "",
      composerModelRestoredFromLocal: modelStatus?.dataset.modelRestoredFromLocal || "",
      composerModelCredentialStorage: modelStatus?.dataset.modelCredentialStorage || "",
      composerModelGuideText: modelGuide?.textContent || "",
      composerModelProbeText: modelProbe?.textContent || "",
      composerModelPreferenceText: modelPreference?.textContent || "",
      preferenceValue: preference.value || "",
      focusReturnedToChatInput: document.activeElement?.id === "chat-input",
      inputClearedAfterSend: (input?.value || "") === "",
      composerIdle: stopButton?.disabled === true && !form?.classList?.contains("is-sending"),
      latestAssistantText,
      latestAssistantStatus,
      assistantAnswerIncludesExpectedMarker: latestAssistantText.includes(${JSON.stringify(expectedMarker)}),
      assistantStatusDone: latestAssistantText.includes(${JSON.stringify(expectedMarker)}),
      assistantErrorText: latestAssistant?.classList?.contains("error") ? latestAssistantText : "",
      localStorageContainsSecret: localStorageDump.includes(${JSON.stringify(testApiKey)}),
      pageTextContainsSecret: pageText.includes(${JSON.stringify(testApiKey)}),
      chatStreamFetch: fetches.find((item) => item.path === "/chat/stream") || null,
      fetches,
    };
  })()`);
}

async function navigateAndWait(cdp, url) {
  await cdp.send("Page.navigate", { url });
  await waitForLoadEvent(cdp);
  await waitForExpression(cdp, "document.getElementById('provider-select') !== null", 15_000);
}

async function installFetchRecorderOnNewDocument(cdp) {
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      (() => {
        window.__phase89Fetches = [];
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
            } else if (path === "/chat" || path === "/chat/stream" || path === "/chat/rag" || path === "/chat/rag/stream") {
              item.providerId = parsed.providerId || "";
              item.model = parsed.model || "";
              item.prompt = parsed.prompt || "";
              item.knowledgeRequested = Boolean(parsed.knowledge);
            }
          } catch {
            item.bodyParseFailed = true;
          }
          window.__phase89Fetches.push(item);
          return originalFetch(...args);
        };
      })();
    `,
  });
}

async function readPersistedStoreSummary(path) {
  const parsed = JSON.parse(await readFile(path, "utf8"));
  const records = Array.isArray(parsed?.records) ? parsed.records : [];
  return {
    version: parsed?.version ?? null,
    recordCount: records.length,
    providers: records.map((record) => String(record.providerId || "")),
    endpointConfigured: records.map((record) => Boolean(record.endpoint)),
    modelIds: records.flatMap((record) => Array.isArray(record.models) ? record.models.map((model) => String(model.id || model.modelId || "")) : []),
    apiKeyPresent: records.map((record) => Boolean(record.apiKey)),
  };
}

function summarizeMockRequests(requests) {
  const streamRequests = requests.filter((request) => request.method === "POST" && request.url === "/v1/chat/completions" && request.stream);
  return {
    requestCount: requests.length,
    modelListRequestCount: requests.filter((request) => request.method === "GET" && request.url === "/v1/models").length,
    nonStreamChatRequestCount: requests.filter((request) => request.method === "POST" && request.url === "/v1/chat/completions" && !request.stream).length,
    streamChatRequestCount: streamRequests.length,
    streamModels: Array.from(new Set(streamRequests.map((request) => request.model).filter(Boolean))),
    prompts: requests.map((request) => request.prompt).filter(Boolean),
    authorizationRedacted: requests.every((request) => !request.hasAuthorization || request.authorizationRedacted === "Bearer ***"),
  };
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

async function reservePort() {
  const probe = createServer();
  await listen(probe, 0, "127.0.0.1");
  const port = probe.address().port;
  await close(probe);
  return port;
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

async function terminateBrowser(targetProcess) {
  if (!targetProcess || targetProcess.killed) return;
  const exited = new Promise((resolveExit) => targetProcess.once("exit", () => resolveExit(true)));
  targetProcess.kill();
  await Promise.race([exited, sleep(2000)]);
}

async function inspectPng(path) {
  const stats = await stat(path);
  const buffer = await readFile(path);
  const validPng = buffer.length >= 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  return { bytes: stats.size, width: validPng ? buffer.readUInt32BE(16) : 0, height: validPng ? buffer.readUInt32BE(20) : 0, validPng };
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
  return new Promise((resolveClose, rejectClose) => {
    targetServer.close((error) => {
      if (error) rejectClose(error);
      else resolveClose();
    });
  });
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 89A Web Chat Model Config Restart Persistence Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.service?.url ?? "n/a"}
- Same port restart: ${body.service?.samePortRestart}
- Runtime credential store mode: ${body.service?.runtimeCredentialStoreMode ?? "n/a"}
- Runtime credential store path present: ${body.service?.runtimeCredentialStorePathPresent}
- Persisted providers: ${(body.persistedStore?.providers ?? []).join(", ") || "none"}
- Persisted model ids: ${(body.persistedStore?.modelIds ?? []).join(", ") || "none"}
- Reload provider/model: ${body.ui?.reloadState?.chatStreamFetch?.providerId ?? "n/a"} / ${body.ui?.reloadState?.chatStreamFetch?.model ?? "n/a"}
- Reload answer marker: ${body.ui?.reloadState?.assistantAnswerIncludesExpectedMarker}
- Restart provider/model: ${body.ui?.restartState?.chatStreamFetch?.providerId ?? "n/a"} / ${body.ui?.restartState?.chatStreamFetch?.model ?? "n/a"}
- Restart answer marker: ${body.ui?.restartState?.assistantAnswerIncludesExpectedMarker}
- Stream chat request count: ${body.mockProvider?.streamChatRequestCount ?? "n/a"}
- Local mock provider only: ${body.safety?.localMockProviderOnly}
- Real provider calls: ${body.safety?.realProviderCalls}
- API key persisted in evidence: ${body.safety?.apiKeyPersistedInEvidence}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Screenshot path: ${body.screenshot?.path ?? "n/a"}
- Screenshot bytes: ${body.screenshot?.bytes ?? "n/a"}
- Screenshot dimensions: ${body.screenshot?.width ?? "n/a"}x${body.screenshot?.height ?? "n/a"}
- Valid PNG: ${body.screenshot?.validPng}
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
