import { spawn } from "node:child_process";
import { writeEvidencePair } from "./entrypointUtils.js";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { createConsolePage } from "../ui/consolePage.js";
import { sleep, listen, findBrowserPath, close } from "./entrypointUtils.js";
import {
  configureModel,
  sendChat,
  waitForChatResult,
  navigateAndWait,
  installFetchRecorderOnNewDocument,
  readPersistedStoreSummary,
  inspectPng,
  readDevToolsPort,
  createCdpPage,
  connectCdp,
  closeCdpSilently,
  waitForExpression,
  terminateBrowser,
} from "./verifyWebChatModelConfigRestartPersistenceHelpers.js";

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

  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
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

async function reservePort() {
  const probe = createServer();
  await listen(probe, 0, "127.0.0.1");
  const port = probe.address().port;
  await close(probe);
  return port;
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

function safeJsonParse(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
