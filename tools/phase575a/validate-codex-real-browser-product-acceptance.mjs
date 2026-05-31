import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase575a");
const browserTempRoot = resolve(repoRoot, ".codex-runtime-tmp", "phase575a-browser");
const resultPath = resolve(evidenceDir, "codex-real-browser-product-acceptance-result.json");
const domSnapshotPath = resolve(evidenceDir, "dom-snapshot.html");
const browserStdoutPath = resolve(evidenceDir, "browser-stdout.log");
const browserStderrPath = resolve(evidenceDir, "browser-stderr.log");
const requiredUrl = "http://127.0.0.1:3100/ui?manual=phase575a&fresh=1";
const requiredHost = "127.0.0.1";
const requiredPort = 3100;

const screenshotPaths = {
  initial: resolve(evidenceDir, "initial-first-screen.png"),
  afterStart: resolve(evidenceDir, "after-start-sample-dry-run.png"),
  detail: resolve(evidenceDir, "detail-drawer-open.png"),
};

const modifiedFiles = [
  "apps/ai-gateway-service/src/ui/consolePage.js",
  "tools/phase575a/validate-codex-real-browser-product-acceptance.mjs",
  "docs/phase575a-codex-real-browser-product-acceptance.md",
  "docs/phase575a-execution-report.md",
  "apps/ai-gateway-service/evidence/phase575a/codex-real-browser-product-acceptance-result.json",
];

let server;
let serverStartedByVerifier = false;
let browserProcess;
let browserProfileDir;
let cdp;
let browserStdout = [];
let browserStderr = [];

const result = {
  phase: "Phase575A",
  name: "Codex Real Browser Product Acceptance",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  acceptanceTarget: "Mission Control sample dry-run first-use path",
  modifiedFiles,
  service: {
    requiredUrl,
    requiredHost,
    requiredPort,
    connectedExistingService: false,
    startedService: false,
    currentBuildCompatible: false,
    serviceUrl: null,
  },
  chromiumChecks: {
    realBrowserUsed: false,
    chromiumUsed: false,
    pageUrlOpened: false,
    screenshotCaptured: false,
    initialMissionControlVisible: false,
    initialSampleEntryVisible: false,
    initialStartButtonVisible: false,
    initialDryRunResultVisible: true,
    initialDetailDrawerVisible: true,
    redInitErrorVisible: true,
    listApprovalsFunctionErrorVisible: true,
    clickStartSampleDryRunWorks: false,
    dryRunResultVisibleAfterClick: false,
    missionUnderstandingVisible: false,
    recommendedModeVisible: false,
    tianshuRecommendationVisible: false,
    securityShieldVisible: false,
    providerCredentialRefVisible: false,
    evidenceReplayVisible: false,
    nextStepVisible: false,
    viewDetailsButtonResponds: false,
    detailDrawerVisibleAfterClick: false,
    detailJsonVisible: false,
    sampleDryRunTaskVisible: false,
    detailRecommendedModeVisible: false,
    detailProviderCallsMadeFalse: false,
    detailSecretValueExposedFalse: false,
    detailProductionActionFalse: false,
    detailInvoiceActionFalse: false,
    startButtonResponds: false,
    modeButtonResponds: false,
    shieldButtonResponds: false,
    evidenceButtonResponds: false,
    deadButtonDetected: true,
    yiyiVisible: true,
    characterModuleVisible: true,
    guidedShowcaseVisible: true,
    floatingAvatarVisible: true,
  },
  networkChecks: {
    externalRequestCount: 0,
    providerRequestCount: 0,
    chatGatewayExecuteRequestCount: 0,
    chatRequestCount: 0,
    externalRequests: [],
    providerRequests: [],
  },
  screenshots: screenshotPaths,
  domSnapshot: domSnapshotPath,
  safetyBoundary: {
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    rawSecretAccessed: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    billingExecuted: false,
    invoiceGenerated: false,
    chatGatewayRuntimeModified: false,
    workspaceCleanClaimed: false,
  },
  regressionInputs: {
    basedOnPhase574: true,
    basedOnPhase574R: true,
    basedOnPhase574R2: true,
    basedOnPhase574R3: true,
  },
};

try {
  await mkdir(evidenceDir, { recursive: true });
  await mkdir(browserTempRoot, { recursive: true });
  await ensureService();

  browserProfileDir = await mkdtemp(resolve(browserTempRoot, "profile-"));
  browserStdout = [];
  browserStderr = [];
  browserProcess = spawn(findBrowserPath(), buildBrowserArgs(browserProfileDir), {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  browserProcess.stdout?.on("data", (chunk) => browserStdout.push(String(chunk)));
  browserProcess.stderr?.on("data", (chunk) => browserStderr.push(String(chunk)));
  browserProcess.once("exit", (code, signal) => {
    result.browserExit = { code, signal };
  });

  result.chromiumChecks.chromiumUsed = true;
  const cdpPort = await readDevToolsPort(browserProfileDir);
  const pageTarget = await createCdpPage(cdpPort, requiredUrl);
  cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
  result.chromiumChecks.realBrowserUsed = true;
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Page.navigate", { url: requiredUrl });
  await waitForLoadEvent(cdp);
  await waitForExpression(cdp, "document.getElementById('scenario-trial-panel')");
  await sleep(1200);

  const initial = await inspectPage();
  result.chromiumChecks.pageUrlOpened = initial.url === requiredUrl;
  result.chromiumChecks.initialMissionControlVisible = initial.visibleText.includes("Mission Control");
  result.chromiumChecks.initialSampleEntryVisible =
    initial.visibleText.includes("Try a sample task") ||
    initial.visibleText.includes("sample dry-run") ||
    initial.visibleText.includes("\u8bd5\u7528\u4e00\u4e2a\u4efb\u52a1");
  result.chromiumChecks.initialStartButtonVisible = initial.startButtonVisible;
  result.chromiumChecks.initialDryRunResultVisible = initial.resultVisible;
  result.chromiumChecks.initialDetailDrawerVisible = initial.drawerVisible;
  result.chromiumChecks.redInitErrorVisible = hasInitError(initial);
  result.chromiumChecks.listApprovalsFunctionErrorVisible = hasListApprovalsError(initial);
  result.chromiumChecks.yiyiVisible = initial.yiyiVisible;
  result.chromiumChecks.characterModuleVisible = initial.characterModuleVisible;
  result.chromiumChecks.guidedShowcaseVisible = initial.guidedShowcaseVisible;
  result.chromiumChecks.floatingAvatarVisible = initial.floatingAvatarVisible;
  await capture(screenshotPaths.initial);

  await click("#start-sample-dry-run-button");
  await waitForExpression(cdp, "!document.getElementById('scenario-dry-run-result-panel')?.hidden");
  await sleep(500);
  const afterStart = await inspectPage();
  result.chromiumChecks.clickStartSampleDryRunWorks = afterStart.scenarioState === "result-visible";
  result.chromiumChecks.startButtonResponds =
    afterStart.resultVisible &&
    afterStart.toastText.includes("Sample dry-run result is visible");
  result.chromiumChecks.dryRunResultVisibleAfterClick = afterStart.resultVisible;
  result.chromiumChecks.missionUnderstandingVisible = afterStart.visibleText.includes("Mission Understanding");
  result.chromiumChecks.recommendedModeVisible =
    afterStart.visibleText.includes("Recommended Mode") &&
    afterStart.visibleText.includes("Recommended: Tianshu");
  result.chromiumChecks.tianshuRecommendationVisible =
    afterStart.visibleText.includes("Tianshu: task planning") ||
    afterStart.visibleText.includes("recommended mode: Tianshu");
  result.chromiumChecks.securityShieldVisible = afterStart.visibleText.includes("Security Shield");
  result.chromiumChecks.providerCredentialRefVisible =
    afterStart.visibleText.includes("Provider") &&
    afterStart.visibleText.includes("CredentialRef");
  result.chromiumChecks.evidenceReplayVisible = afterStart.visibleText.includes("Evidence Replay preview");
  result.chromiumChecks.nextStepVisible =
    afterStart.visibleText.includes("Use Normal for simple tasks") &&
    afterStart.visibleText.includes("Tianshu for planning");
  await writeFile(domSnapshotPath, afterStart.renderedDom, "utf8");
  await capture(screenshotPaths.afterStart);

  await click("[data-scenario-action='modes']");
  result.chromiumChecks.modeButtonResponds = await waitForFocusedNode("scenario-mode-explainer");
  await click("[data-scenario-action='shield']");
  result.chromiumChecks.shieldButtonResponds = await waitForFocusedNode("security-shield-panel");
  await click("[data-scenario-action='evidence']");
  result.chromiumChecks.evidenceButtonResponds = await waitForFocusedNode("scenario-evidence-replay-preview");

  await click("#open-evidence-button");
  await waitForExpression(cdp, "document.getElementById('evidence-drawer')?.classList.contains('is-open')");
  await sleep(500);
  const afterDetails = await inspectPage();
  result.chromiumChecks.viewDetailsButtonResponds = afterDetails.drawerVisible;
  result.chromiumChecks.detailDrawerVisibleAfterClick = afterDetails.drawerVisible;
  const detailJson = parseJson(afterDetails.evidenceText);
  const sampleDryRun = detailJson?.sampleDryRun ?? {};
  result.chromiumChecks.sampleDryRunTaskVisible = Boolean(sampleDryRun.task);
  result.chromiumChecks.detailRecommendedModeVisible = sampleDryRun.recommendedMode === "Tianshu";
  result.chromiumChecks.detailProviderCallsMadeFalse = sampleDryRun.providerCallsMade === false;
  result.chromiumChecks.detailSecretValueExposedFalse = sampleDryRun.secretValueExposed === false;
  result.chromiumChecks.detailProductionActionFalse = sampleDryRun.productionAction === false;
  result.chromiumChecks.detailInvoiceActionFalse = sampleDryRun.invoiceAction === false;
  result.chromiumChecks.detailJsonVisible =
    result.chromiumChecks.sampleDryRunTaskVisible &&
    result.chromiumChecks.detailRecommendedModeVisible &&
    result.chromiumChecks.detailProviderCallsMadeFalse &&
    result.chromiumChecks.detailSecretValueExposedFalse &&
    result.chromiumChecks.detailProductionActionFalse &&
    result.chromiumChecks.detailInvoiceActionFalse;
  await capture(screenshotPaths.detail);

  result.chromiumChecks.screenshotCaptured = Object.values(screenshotPaths).every((path) => existsSync(path));
  collectNetworkChecks();
  result.safetyBoundary.providerCallsMade = result.networkChecks.providerRequestCount > 0;
  result.safetyBoundary.nonNvidiaProviderCallsMade = result.networkChecks.providerRequests
    .some((item) => !item.url.toLowerCase().includes("nvidia"));
  result.safetyBoundary.chatGatewayRuntimeModified = result.networkChecks.chatGatewayExecuteRequestCount > 0;
  result.chromiumChecks.deadButtonDetected =
    !result.chromiumChecks.startButtonResponds ||
    !result.chromiumChecks.modeButtonResponds ||
    !result.chromiumChecks.shieldButtonResponds ||
    !result.chromiumChecks.evidenceButtonResponds ||
    !result.chromiumChecks.viewDetailsButtonResponds;

  const docsExist = [
    "docs/phase575a-codex-real-browser-product-acceptance.md",
    "docs/phase575a-execution-report.md",
  ].every((path) => existsSync(resolve(repoRoot, path)));
  result.docsExist = docsExist;

  const checksPassed =
    docsExist &&
    result.service.serviceUrl === requiredUrl &&
    (result.service.connectedExistingService || result.service.startedService) &&
    result.chromiumChecks.realBrowserUsed &&
    result.chromiumChecks.chromiumUsed &&
    result.chromiumChecks.pageUrlOpened &&
    result.chromiumChecks.screenshotCaptured &&
    result.chromiumChecks.initialMissionControlVisible &&
    result.chromiumChecks.initialSampleEntryVisible &&
    result.chromiumChecks.initialStartButtonVisible &&
    !result.chromiumChecks.initialDryRunResultVisible &&
    !result.chromiumChecks.initialDetailDrawerVisible &&
    !result.chromiumChecks.redInitErrorVisible &&
    !result.chromiumChecks.listApprovalsFunctionErrorVisible &&
    result.chromiumChecks.clickStartSampleDryRunWorks &&
    result.chromiumChecks.dryRunResultVisibleAfterClick &&
    result.chromiumChecks.missionUnderstandingVisible &&
    result.chromiumChecks.recommendedModeVisible &&
    result.chromiumChecks.tianshuRecommendationVisible &&
    result.chromiumChecks.securityShieldVisible &&
    result.chromiumChecks.providerCredentialRefVisible &&
    result.chromiumChecks.evidenceReplayVisible &&
    result.chromiumChecks.nextStepVisible &&
    result.chromiumChecks.viewDetailsButtonResponds &&
    result.chromiumChecks.detailDrawerVisibleAfterClick &&
    result.chromiumChecks.detailJsonVisible &&
    result.chromiumChecks.sampleDryRunTaskVisible &&
    result.chromiumChecks.detailRecommendedModeVisible &&
    result.chromiumChecks.detailProviderCallsMadeFalse &&
    result.chromiumChecks.detailSecretValueExposedFalse &&
    result.chromiumChecks.detailProductionActionFalse &&
    result.chromiumChecks.detailInvoiceActionFalse &&
    !result.chromiumChecks.deadButtonDetected &&
    !result.chromiumChecks.yiyiVisible &&
    !result.chromiumChecks.characterModuleVisible &&
    !result.chromiumChecks.guidedShowcaseVisible &&
    !result.chromiumChecks.floatingAvatarVisible &&
    result.networkChecks.externalRequestCount === 0 &&
    result.networkChecks.providerRequestCount === 0 &&
    result.networkChecks.chatGatewayExecuteRequestCount === 0 &&
    !result.safetyBoundary.providerCallsMade &&
    !result.safetyBoundary.secretValueExposed &&
    !result.safetyBoundary.rawSecretAccessed &&
    !result.safetyBoundary.deployExecuted &&
    !result.safetyBoundary.billingExecuted &&
    !result.safetyBoundary.invoiceGenerated &&
    !result.safetyBoundary.chatGatewayRuntimeModified &&
    !result.safetyBoundary.workspaceCleanClaimed;

  result.completed = checksPassed;
  result.recommended_sealed = checksPassed;
  result.blocker = checksPassed ? null : "codex_real_browser_product_acceptance_incomplete";
} catch (error) {
  result.blocker = error instanceof Error ? error.message : String(error);
  result.browserExit = result.browserExit || null;
  try {
    result.runtimeEvents = cdp?.events?.()
      .filter((event) => event.method === "Runtime.exceptionThrown" || event.method === "Log.entryAdded") || [];
  } catch {}
} finally {
  try {
    await writeFile(browserStdoutPath, browserStdout.join(""), "utf8");
    await writeFile(browserStderrPath, browserStderr.join(""), "utf8");
    result.browserLogs = {
      stdoutPath: browserStdoutPath,
      stderrPath: browserStderrPath,
      stderrTail: browserStderr.join("").split(/\r?\n/).slice(-40).join("\n"),
    };
  } catch {}
  await closeCdpSilently(cdp);
  await terminateBrowser(browserProcess);
  if (browserProfileDir) await rm(browserProfileDir, { recursive: true, force: true }).catch(() => {});
  if (server && serverStartedByVerifier) {
    server.closeAllConnections?.();
    await close(server);
  }
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!result.completed) process.exitCode = 1;
}

async function ensureService() {
  const existing = await fetchText(requiredUrl, 2500).catch(() => null);
  if (existing && existing.ok && existing.text.includes("AI Gateway Workbench")) {
    result.service.currentBuildCompatible = existing.text.includes("async listApprovals()");
    if (!result.service.currentBuildCompatible) {
      throw new Error("stale_existing_service_on_3100");
    }
    result.service.connectedExistingService = true;
    result.service.serviceUrl = requiredUrl;
    return;
  }

  const application = createGatewayApplication({
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory",
    PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
    PME_AUDIT_LOG_PATH: resolve(repoRoot, ".codex-runtime-tmp", "phase575a-audit.log"),
  });
  server = createGatewayHttpServer(application);
  await listen(server, requiredPort, requiredHost);
  serverStartedByVerifier = true;
  result.service.startedService = true;
  result.service.currentBuildCompatible = true;
  result.service.serviceUrl = requiredUrl;
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return {
      ok: response.ok,
      status: response.status,
      text: await response.text(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildBrowserArgs(profileDir) {
  return [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-gpu-sandbox",
    "--single-process",
    "--no-zygote",
    "--disable-gpu-compositing",
    "--disable-gpu-rasterization",
    "--disable-accelerated-2d-canvas",
    "--disable-accelerated-video-decode",
    "--disable-vulkan",
    "--disable-d3d11",
    "--use-angle=swiftshader",
    "--use-gl=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-sync",
    "--disable-default-apps",
    "--disable-component-update",
    "--disable-crash-reporter",
    "--disable-features=Translate,OptimizationHints,MediaRouter,CalculateNativeWinOcclusion",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDir}`,
    "--window-size=1440,1200",
    "about:blank",
  ];
}

function hasInitError(pageState) {
  const text = `${pageState.visibleText}\n${pageState.toastText}\n${pageState.renderedDom}`;
  return text.includes("\u521d\u59cb\u5316\u5931\u8d25") ||
    text.toLowerCase().includes("initialization failed") ||
    text.toLowerCase().includes("init failed");
}

function hasListApprovalsError(pageState) {
  const text = `${pageState.visibleText}\n${pageState.toastText}\n${pageState.renderedDom}`;
  return text.includes("workbenchApiClient.listApprovals is not a function") ||
    text.includes("listApprovals is not a function");
}

async function inspectPage() {
  return cdp.evaluate(`(() => {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
    const resultPanel = document.getElementById('scenario-dry-run-result-panel');
    const drawer = document.getElementById('evidence-drawer');
    const toast = document.getElementById('toast');
    const visibleText = document.body.innerText || '';
    const renderedDom = '<!doctype html>\\n' + clone.outerHTML;
    return {
      url: location.href,
      visibleText,
      renderedDom,
      resultVisible: Boolean(resultPanel) && resultPanel.hidden === false && getComputedStyle(resultPanel).display !== 'none',
      drawerVisible: Boolean(drawer) && drawer.classList.contains('is-open') && drawer.getAttribute('aria-hidden') === 'false',
      evidenceText: document.getElementById('evidence-output')?.innerText || '',
      toastVisible: Boolean(toast) && toast.classList.contains('is-open'),
      toastText: toast?.innerText || '',
      startButtonVisible: Boolean(document.getElementById('start-sample-dry-run-button')) &&
        getComputedStyle(document.getElementById('start-sample-dry-run-button')).display !== 'none',
      scenarioState: document.getElementById('scenario-trial-panel')?.dataset.scenarioState || '',
      activeElementId: document.activeElement?.id || '',
      yiyiVisible: visibleText.includes('Yiyi') || visibleText.includes('\\u4f9d\\u4f9d') || visibleText.includes('Mission Companion'),
      characterModuleVisible: visibleText.toLowerCase().includes('character') || visibleText.toLowerCase().includes('avatar') || visibleText.toLowerCase().includes('companion'),
      guidedShowcaseVisible: visibleText.includes('Guided Showcase') || visibleText.includes('\\u8fdb\\u5165\\u4f9d\\u4f9d\\u6f14\\u793a'),
      floatingAvatarVisible: renderedDom.includes('yiyi-live-avatar-stage') || renderedDom.includes('yiyi-avatar-layer') || renderedDom.includes('floating-avatar')
    };
  })()`);
}

async function click(selector) {
  const point = await cdp.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error('Missing clickable selector: ' + ${JSON.stringify(selector)});
    node.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) throw new Error('Clickable selector has no visible box: ' + ${JSON.stringify(selector)});
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  await sleep(120);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y, button: "none" });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}

async function waitForFocusedNode(id) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const focused = await cdp.evaluate(`document.activeElement?.id === ${JSON.stringify(id)}`);
    if (focused) return true;
    await sleep(100);
  }
  return false;
}

async function capture(path) {
  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await writeFile(path, Buffer.from(screenshot.data, "base64"));
}

function collectNetworkChecks() {
  const events = cdp?.events?.() ?? [];
  const requests = events
    .filter((event) => event.method === "Network.requestWillBeSent")
    .map((event) => ({
      method: event.params?.request?.method || "",
      url: event.params?.request?.url || "",
    }))
    .filter((item) => item.url);
  const externalRequests = requests.filter((item) => !isAllowedLocalUrl(item.url));
  const providerRequests = requests.filter((item) => isProviderUrl(item.url));
  result.networkChecks.externalRequestCount = externalRequests.length;
  result.networkChecks.providerRequestCount = providerRequests.length;
  result.networkChecks.chatGatewayExecuteRequestCount = requests
    .filter((item) => item.url.includes("/chat-gateway/execute")).length;
  result.networkChecks.chatRequestCount = requests
    .filter((item) => {
      try {
        const url = new URL(item.url);
        return url.pathname === "/chat";
      } catch {
        return false;
      }
    }).length;
  result.networkChecks.externalRequests = externalRequests.slice(0, 20);
  result.networkChecks.providerRequests = providerRequests.slice(0, 20);
}

function isAllowedLocalUrl(value) {
  if (value.startsWith("data:") || value.startsWith("blob:") || value === "about:blank") return true;
  try {
    const url = new URL(value);
    return url.hostname === "127.0.0.1" && Number(url.port) === requiredPort;
  } catch {
    return false;
  }
}

function isProviderUrl(value) {
  const lower = String(value).toLowerCase();
  return lower.includes("api.openai.com") ||
    lower.includes("anthropic.com") ||
    lower.includes("openrouter.ai") ||
    lower.includes("integrate.api.nvidia.com") ||
    lower.includes("mimo");
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
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
      const payload = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (payload.exceptionDetails) throw new Error(payload.exceptionDetails.exception?.description || payload.exceptionDetails.text || "Runtime.evaluate failed.");
      return payload.result?.value;
    },
    takeEvent(method) {
      const index = events.findIndex((event) => event.method === method);
      return index >= 0 ? events.splice(index, 1)[0] : null;
    },
    events() {
      return [...events];
    },
    async close() {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
    },
  };
}

async function waitForLoadEvent(targetCdp) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (targetCdp.takeEvent("Page.loadEventFired")) return;
    await sleep(100);
  }
  throw new Error("Timed out waiting for page load.");
}

async function waitForExpression(targetCdp, expression) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      if (await targetCdp.evaluate(`Boolean(${expression})`)) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

async function closeCdpSilently(targetCdp) {
  try {
    await targetCdp?.close();
  } catch {}
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

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
