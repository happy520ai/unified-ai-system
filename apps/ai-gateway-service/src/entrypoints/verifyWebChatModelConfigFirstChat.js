import { spawn } from "node:child_process";
import { writeEvidencePair } from "./entrypointUtils.js";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { createConsolePage } from "../ui/consolePage.js";
import { sleep, listen, findBrowserPath, close } from "./entrypointUtils.js";
import { connectCdp, closeCdpSilently, waitForLoadEvent, waitForExpression, readDevToolsPort, createCdpPage, terminateBrowser, inspectPng } from "./verifyWebChatBrowserHelpers.js";

const PHASE = "phase-88a-web-chat-model-config-first-chat";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-88a-web-chat-model-config-first-chat.json");
const evidenceMdPath = resolve(evidenceDir, "phase-88a-web-chat-model-config-first-chat.md");
const evidencePngPath = resolve(evidenceDir, "phase-88a-web-chat-model-config-first-chat.png");
const testApiKey = "phase88-secret-must-not-persist";
const chatModelId = "phase88-chat-model";
const selectedPreviewValue = `openai-compatible::${chatModelId}`;
const expectedRuntimeValue = `generic-openai-compatible::${chatModelId}`;
const firstPrompt = "请用一句话说 first chat live marker";
const firstAnswerMarker = "first-chat-live-marker";

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

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase88a-browser-profile-"));
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

    await clickAction(cdp, "persist-detected-model");
    await waitForExpression(cdp, `JSON.parse(localStorage.getItem("pme-moving-earth-provider-preference-v1") || "{}").value === ${JSON.stringify(expectedRuntimeValue)}`, 20_000);
    await clickAction(cdp, "continue-chat-after-model-check");
    await waitForExpression(cdp, `document.activeElement?.id === "chat-input"`, 10_000);

    await sendFirstChat(cdp);
    const finalState = await waitForFirstChatResult(cdp);

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
        mockProviderBaseUrl,
        finalState,
      },
      mockProvider: {
        requestCount: mockRequests.length,
        requests: mockRequests,
      },
      screenshot: {
        path: "apps/ai-gateway-service/evidence/phase-88a-web-chat-model-config-first-chat.png",
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
        backendBusinessRouteAdded: false,
      },
      conclusion: "pending",
    };

    const passed = finalState.providerSelectValue === expectedRuntimeValue &&
      finalState.composerModelReady === "true" &&
      finalState.preferenceValue === expectedRuntimeValue &&
      finalState.focusReturnedToChatInput === true &&
      finalState.inputClearedAfterSend === true &&
      finalState.sendButtonReady === true &&
      finalState.chatStreamFetch?.providerId === "generic-openai-compatible" &&
      finalState.chatStreamFetch?.model === chatModelId &&
      finalState.chatStreamFetch?.prompt === firstPrompt &&
      finalState.chatStreamFetch?.path === "/chat/stream" &&
      !finalState.fetches.some((item) => item.path === "/chat/rag/stream") &&
      finalState.assistantAnswerIncludesMarker === true &&
      finalState.assistantStatusDone === true &&
      finalState.localStorageContainsSecret === false &&
      finalState.pageTextContainsSecret === false &&
      mockRequests.some((request) => request.method === "POST" && request.url === "/v1/chat/completions" && request.stream === false && request.model === chatModelId && request.hasAuthorization) &&
      mockRequests.some((request) => request.method === "POST" && request.url === "/v1/chat/completions" && request.stream === true && request.model === chatModelId && request.hasAuthorization) &&
      screenshot.validPng &&
      screenshot.bytes > 10000 &&
      !JSON.stringify(evidenceDraft).includes(testApiKey);

    evidence = {
      ...evidenceDraft,
      status: passed ? "passed" : "failed",
      conclusion: passed ? "web-chat-model-config-first-chat-connected" : "web-chat-model-config-first-chat-not-connected",
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
    conclusion: "web-chat-model-config-first-chat-not-connected",
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
    await close(server);
  }
  if (mockProviderServer) {
    await close(mockProviderServer);
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
      prompt: Array.isArray(body?.messages) ? body.messages.map((item) => item.content).join("\n").slice(0, 200) : "",
    });

    if (request.method === "GET" && request.url === "/v1/models") {
      return sendJson(response, 200, {
        object: "list",
        data: [{
          id: chatModelId,
          object: "model",
          owned_by: "phase88-mock",
          capabilities: ["chat", "summary"],
          input_modalities: ["text"],
          output_modalities: ["text"],
        }],
      });
    }

    if (request.method === "POST" && request.url === "/v1/chat/completions") {
      if (body?.stream === true) {
        response.writeHead(200, { "content-type": "text/event-stream; charset=utf-8" });
        response.write(`data: ${JSON.stringify({
          id: "phase88-chat-stream-1",
          object: "chat.completion.chunk",
          model: body?.model || chatModelId,
          choices: [{ index: 0, delta: { content: "phase88 first chat answer " }, finish_reason: null }],
        })}\n\n`);
        response.write(`data: ${JSON.stringify({
          id: "phase88-chat-stream-2",
          object: "chat.completion.chunk",
          model: body?.model || chatModelId,
          choices: [{ index: 0, delta: { content: firstAnswerMarker }, finish_reason: null }],
        })}\n\n`);
        response.write("data: [DONE]\n\n");
        response.end();
        return;
      }

      return sendJson(response, 200, {
        id: "phase88-chat-completion",
        object: "chat.completion",
        model: body?.model || chatModelId,
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: "phase88 config probe answer",
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
        window.__phase88Fetches = [];
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
          window.__phase88Fetches.push(item);
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

async function sendFirstChat(cdp) {
  await cdp.evaluate(`(() => {
    const input = document.getElementById("chat-input");
    const form = document.getElementById("chat-form");
    input.value = ${JSON.stringify(firstPrompt)};
    input.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    return true;
  })()`);
}

async function waitForFirstChatResult(cdp) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const state = await readState(cdp);
    if ((state.assistantAnswerIncludesMarker && state.sendButtonReady) || state.assistantErrorText) {
      return state;
    }
    await sleep(150);
  }
  throw new Error("Timed out waiting for first configured-model chat answer.");
}

async function readState(cdp) {
  return cdp.evaluate(`(() => {
    const fetches = window.__phase88Fetches || [];
    const assistantMessages = Array.from(document.querySelectorAll(".message.assistant"));
    const latestAssistant = assistantMessages[assistantMessages.length - 1];
    const latestAssistantText = latestAssistant?.querySelector(".message-text")?.textContent || latestAssistant?.textContent || "";
    const latestAssistantStatus = latestAssistant?.querySelector("[data-message-status]")?.textContent || latestAssistant?.textContent || "";
    const preference = JSON.parse(localStorage.getItem("pme-moving-earth-provider-preference-v1") || "{}");
    const pageText = document.body.textContent || "";
    const localStorageDump = Object.keys(localStorage).map((key) => key + ":" + localStorage.getItem(key)).join("\\n");
    const input = document.getElementById("chat-input");
    const sendButton = document.getElementById("send-button");
    const stopButton = document.getElementById("stop-chat-button");
    const form = document.getElementById("chat-form");
    const modelStatus = document.getElementById("composer-model-status");
    return {
      providerSelectValue: document.getElementById("provider-select")?.value || "",
      composerModelReady: modelStatus?.dataset.modelReady || "",
      composerModelProviderId: modelStatus?.dataset.modelProviderId || "",
      composerModelId: modelStatus?.dataset.modelId || "",
      preferenceValue: preference.value || "",
      focusReturnedToChatInput: document.activeElement?.id === "chat-input",
      inputClearedAfterSend: (input?.value || "") === "",
      sendButtonReady: (sendButton?.textContent || "").trim() === "发送" && stopButton?.disabled === true && !form?.classList?.contains("is-sending"),
      latestAssistantText,
      latestAssistantStatus,
      assistantAnswerIncludesMarker: latestAssistantText.includes(${JSON.stringify(firstAnswerMarker)}),
      assistantStatusDone: latestAssistantStatus.includes("回答完成") || latestAssistantText.includes(${JSON.stringify(firstAnswerMarker)}),
      assistantErrorText: latestAssistant?.classList?.contains("error") ? latestAssistantText : "",
      localStorageContainsSecret: localStorageDump.includes(${JSON.stringify(testApiKey)}),
      pageTextContainsSecret: pageText.includes(${JSON.stringify(testApiKey)}),
      chatProbeFetch: fetches.find((item) => item.path === "/chat") || null,
      chatStreamFetch: fetches.find((item) => item.path === "/chat/stream") || null,
      fetches,
    };
  })()`);
}

function safeJsonParse(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

