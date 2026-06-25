import { spawn } from "node:child_process";
import { writeEvidencePair } from "./entrypointUtils.js";
import { existsSync, readdirSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { sleep, listen, findBrowserPath, close } from "./entrypointUtils.js";
import {
  MOCK_CHAT_MODEL_ID,
  MOCK_TEST_API_KEY,
  connectCdp,
  createCdpPage,
  readDevToolsPort,
  closeCdpSilently,
  waitForLoadEvent,
  waitForExpression,
  createMockOpenAiCompatibleProvider,
  verifyEmbeddedScriptSyntax,
  installFetchRecorderOnNewDocument,
  openModelConfigWizard,
  fillAndQuickApply,
  clickAction,
  readInitialState,
  readWizardState,
  readSuccessState,
  readReadyState,
} from "./verifyWebChatModelConfigUserJourneyHelpers.js";

const PHASE = "phase-98a-web-chat-model-config-user-journey";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-98a-web-chat-model-config-user-journey.json");
const evidenceMdPath = resolve(evidenceDir, "phase-98a-web-chat-model-config-user-journey.md");
const evidencePngPath = resolve(evidenceDir, "phase-98a-web-chat-model-config-user-journey.png");
const chatModelId = MOCK_CHAT_MODEL_ID;
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

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase98a-browser-profile-"));
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

    const initialState = await readInitialState(cdp);
    await openModelConfigWizard(cdp);
    await waitForExpression(cdp, `Boolean(document.querySelector("[data-command-wizard='model-config-v2']"))`, 20_000);
    const wizardState = await readWizardState(cdp);

    await fillAndQuickApply(cdp, mockProviderBaseUrl);
    await waitForExpression(cdp, `document.getElementById("composer-model-status")?.dataset.modelProbeStatus === "passed"`, 30_000);
    await waitForExpression(cdp, `document.getElementById("provider-select")?.value === ${JSON.stringify(expectedRuntimeValue)}`, 20_000);
    const successState = await readSuccessState(cdp);

    await clickAction(cdp, "continue-chat-after-model-check");
    await waitForExpression(cdp, `document.activeElement?.id === "chat-input"`, 10_000);
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
        initialState,
        wizardState,
        successState,
        readyState,
      },
      mockProvider: {
        requestCount: mockRequests.length,
        requests: mockRequests,
      },
      screenshot: {
        path: "apps/ai-gateway-service/evidence/phase-98a-web-chat-model-config-user-journey.png",
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

    const serialized = JSON.stringify(evidenceDraft);
    const passed = initialState.entryButtonText === "\u914d\u7f6e\u6a21\u578b" &&
      initialState.guideIncludesApiKey === true &&
      initialState.guideIncludesDirectChat === true &&
      wizardState.hasWizard === true &&
      wizardState.stepTitles.some((title) => title.includes("\u9009\u62e9\u6a21\u578b")) &&
      wizardState.stepTitles.some((title) => title.includes("\u7c98\u8d34 Key")) &&
      wizardState.stepTitles.some((title) => title.includes("\u957f\u671f\u542f\u52a8")) &&
      wizardState.quickApplyButtonText === "\u4e00\u952e\u68c0\u6d4b\u5e76\u4fdd\u5b58" &&
      wizardState.hasDetectButton === true &&
      wizardState.feedbackTitle === "\u4e0b\u4e00\u6b65" &&
      wizardState.feedbackHasPasteAction === true &&
      successState.providerSelectValue === expectedRuntimeValue &&
      successState.statusTitle === "\u6a21\u578b\u914d\u7f6e\u5df2\u751f\u6548\uff0c\u53ef\u4ee5\u5f00\u59cb\u804a\u5929" &&
      successState.visibleLines[0]?.includes("\u5f53\u524d\u804a\u5929\u53ef\u7528") &&
      successState.visibleLines.some((line) => line.includes("Provider \u5df2\u8bc6\u522b")) &&
      successState.visibleLines.some((line) => line.includes("\u6a21\u578b\u5df2\u9009\u62e9")) &&
      successState.hasDetails === true &&
      successState.continueChatActionPresent === true &&
      successState.secretInputCleared === true &&
      readyState.focusReturnedToChatInput === true &&
      readyState.composerGuidanceKind === "model-ready-nudge" &&
      readyState.composerGuidanceText.includes("\u5df2\u7ecf\u80fd\u804a") &&
      readyState.inputPlaceholder.includes("\u6a21\u578b\u5df2\u5c31\u7eea") &&
      readyState.pageTextContainsSecret === false &&
      readyState.localStorageContainsSecret === false &&
      mockRequests.some((request) => request.method === "GET" && request.url === "/v1/models" && request.hasAuthorization) &&
      mockRequests.some((request) => request.method === "POST" && request.url === "/v1/chat/completions" && request.model === chatModelId && request.hasAuthorization) &&
      screenshot.validPng &&
      screenshot.bytes > 10000 &&
      !serialized.includes(MOCK_TEST_API_KEY);

    evidence = {
      ...evidenceDraft,
      status: passed ? "passed" : "failed",
      conclusion: passed
        ? "web-chat-model-config-user-journey-readable"
        : "web-chat-model-config-user-journey-not-readable",
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
    conclusion: "web-chat-model-config-user-journey-not-readable",
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

function findVersionedBrowserPaths(root, executableName) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(root, entry.name, executableName))
    .reverse();
}
