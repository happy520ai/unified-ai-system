import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase574r");
const resultPath = resolve(evidenceDir, "actual-clickable-sample-dry-run-repair-result.json");
const domSnapshotPath = resolve(evidenceDir, "after-rendered-dom-snapshot.html");
const screenshotPaths = {
  before: resolve(evidenceDir, "before-current-visible-page.png"),
  entry: resolve(evidenceDir, "after-sample-task-entry-visible.png"),
  start: resolve(evidenceDir, "after-click-start-sample-dry-run.png"),
  mission: resolve(evidenceDir, "after-mission-understanding-visible.png"),
  recommended: resolve(evidenceDir, "after-recommended-mode-visible.png"),
  security: resolve(evidenceDir, "after-security-shield-sample-visible.png"),
  provider: resolve(evidenceDir, "after-provider-boundary-visible.png"),
  evidence: resolve(evidenceDir, "after-evidence-replay-sample-visible.png"),
  details: resolve(evidenceDir, "after-click-view-details.png"),
};

const bannedTerms = [
  "Yiyi",
  "依依",
  "Mission Companion",
  "MISSION COMPANION",
  "avatar",
  "companion",
  "character",
  "Guided Showcase",
  "进入依依演示",
  "real 3D placeholder",
  "pseudo-3D",
];

let server;
let browserProcess;
let browserProfileDir;
let cdp;

const result = {
  phase: "Phase574R",
  name: "Actual Clickable Sample Dry-run Experience Repair",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  basedOnUserVisibleConfusion: true,
  phase574ClaimWasInsufficientForVisibleSurface: true,
  sameUserVisibleSurfaceVerified: false,
  realBrowserUsed: false,
  chromiumUsed: false,
  screenshotCaptured: false,
  sampleTaskEntryVisible: false,
  startSampleDryRunButtonVisible: false,
  clickStartSampleDryRunWorks: false,
  dryRunResultPanelVisible: false,
  missionUnderstandingVisible: false,
  recommendedModeVisible: false,
  recommendedMode: "Tianshu",
  normalModeExplained: false,
  godModeExplained: false,
  tianshuModeExplained: false,
  securityShieldExplanationVisible: false,
  providerCredentialRefBoundaryVisible: false,
  evidenceReplayPreviewVisible: false,
  nextStepGuidanceVisible: false,
  skipButtonResponds: false,
  viewDetailsButtonResponds: false,
  deadButtonDetected: false,
  yiyiVisible: false,
  characterModuleVisible: false,
  guidedShowcaseVisible: false,
  floatingAvatarVisible: false,
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
  url: null,
  bannedTermsFound: [],
};

try {
  await mkdir(evidenceDir, { recursive: true });
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory",
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const uiUrl = `http://127.0.0.1:${server.address().port}/ui?phase574r=real-click`;
  result.url = uiUrl;

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase574r-browser-"));
  browserProcess = spawn(findBrowserPath(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-gpu-sandbox",
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
    `--user-data-dir=${browserProfileDir}`,
    "--window-size=1440,1200",
    "about:blank",
  ], { cwd: repoRoot, stdio: "ignore" });

  result.chromiumUsed = true;
  const cdpPort = await readDevToolsPort(browserProfileDir);
  const pageTarget = await createCdpPage(cdpPort, uiUrl);
  cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
  result.realBrowserUsed = true;
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.navigate", { url: uiUrl });
  await waitForLoadEvent(cdp);
  await waitForExpression(cdp, "document.getElementById('scenario-trial-panel')");
  await capture(screenshotPaths.before);

  const initial = await inspectPage();
  const controlState = await cdp.evaluate(`(() => ({
    hasSampleControl: Boolean(window.__missionControlSampleDryRun),
    resultHidden: document.getElementById('scenario-dry-run-result-panel')?.hidden,
    buttonText: document.getElementById('start-sample-dry-run-button')?.innerText || '',
    errors: window.__phase574rErrors || []
  }))()`);
  result.controlState = controlState;
  result.sameUserVisibleSurfaceVerified = initial.url.includes("/ui");
  result.sampleTaskEntryVisible = initial.visibleText.includes("试用一个任务") && initial.visibleText.includes("Try a sample task");
  result.startSampleDryRunButtonVisible = initial.visibleText.includes("开始 sample dry-run");
  await capture(screenshotPaths.entry);

  await click("#start-sample-dry-run-button");
  await waitForExpression(cdp, "!document.getElementById('scenario-dry-run-result-panel')?.hidden");
  const afterStart = await inspectPage();
  result.clickStartSampleDryRunWorks = afterStart.scenarioState === "result-visible";
  result.dryRunResultPanelVisible = afterStart.resultVisible;
  result.missionUnderstandingVisible = afterStart.visibleText.includes("Mission Understanding");
  result.recommendedModeVisible = afterStart.visibleText.includes("Recommended Mode") && afterStart.visibleText.includes("Recommended: Tianshu");
  result.normalModeExplained = afterStart.visibleText.includes("Normal: single-model direct response");
  result.godModeExplained = afterStart.visibleText.includes("God: multi-model review");
  result.tianshuModeExplained = afterStart.visibleText.includes("Tianshu: task planning");
  result.nextStepGuidanceVisible = afterStart.visibleText.includes("Use Normal for simple tasks") && afterStart.visibleText.includes("Tianshu for planning");
  await writeFile(domSnapshotPath, afterStart.renderedDom, "utf8");
  await capture(screenshotPaths.start);
  await scrollAndCapture("scenario-dry-run-result-panel", screenshotPaths.mission);
  await scrollAndCapture("scenario-mode-explainer", screenshotPaths.recommended);

  await click("[data-scenario-action='shield']");
  await sleep(300);
  const afterShield = await inspectPage();
  result.securityShieldExplanationVisible = afterShield.visibleText.includes("Security Shield") &&
    afterShield.visibleText.includes("Provider Call Gate") &&
    afterShield.visibleText.includes("dry-run only");
  await capture(screenshotPaths.security);

  await scrollAndCapture("provider-credentialref-guidance", screenshotPaths.provider);
  const afterProvider = await inspectPage();
  result.providerCredentialRefBoundaryVisible = afterProvider.visibleText.includes("Provider") &&
    afterProvider.visibleText.includes("CredentialRef") &&
    (afterProvider.visibleText.includes("no provider call") || afterProvider.visibleText.includes("no-provider-call"));

  await click("[data-scenario-action='evidence']");
  await sleep(300);
  const afterEvidence = await inspectPage();
  result.evidenceReplayPreviewVisible = afterEvidence.visibleText.includes("Evidence Replay preview") &&
    afterEvidence.visibleText.includes("local only") &&
    afterEvidence.visibleText.includes("no external upload");
  await capture(screenshotPaths.evidence);

  await click("#onboarding-dismiss-button");
  await sleep(300);
  const afterSkip = await cdp.evaluate(`(() => {
    const panel = document.getElementById('guided-onboarding-panel');
    return { hidden: panel ? getComputedStyle(panel).display === 'none' : false, active: document.activeElement?.id || '' };
  })()`);
  result.skipButtonResponds = afterSkip.hidden === true || afterSkip.active === "scenario-trial-panel";

  await click("#open-evidence-button");
  await waitForExpression(cdp, "document.getElementById('evidence-drawer')?.classList.contains('is-open')");
  const detailState = await cdp.evaluate(`(() => ({
    drawerOpen: document.getElementById('evidence-drawer')?.classList.contains('is-open') === true,
    text: document.getElementById('evidence-output')?.innerText || ''
  }))()`);
  result.viewDetailsButtonResponds = detailState.drawerOpen && detailState.text.includes("sampleDryRun");
  await capture(screenshotPaths.details);

  const finalState = await inspectPage();
  result.bannedTermsFound = bannedTerms.filter((term) => finalState.visibleText.includes(term) || finalState.renderedDom.includes(term));
  result.yiyiVisible = finalState.visibleText.includes("Yiyi") || finalState.visibleText.includes("依依");
  result.characterModuleVisible = finalState.visibleText.toLowerCase().includes("character");
  result.guidedShowcaseVisible = finalState.visibleText.includes("Guided Showcase") || finalState.visibleText.includes("进入依依演示");
  result.floatingAvatarVisible = finalState.renderedDom.includes("yiyi-live-avatar-stage") || finalState.renderedDom.includes("yiyi-avatar-layer");
  result.deadButtonDetected = !result.clickStartSampleDryRunWorks || !result.skipButtonResponds || !result.viewDetailsButtonResponds;
  result.screenshotCaptured = Object.values(screenshotPaths).every((path) => existsSync(path));

  const checksPassed = result.sameUserVisibleSurfaceVerified &&
    result.realBrowserUsed &&
    result.screenshotCaptured &&
    result.sampleTaskEntryVisible &&
    result.startSampleDryRunButtonVisible &&
    result.clickStartSampleDryRunWorks &&
    result.dryRunResultPanelVisible &&
    result.missionUnderstandingVisible &&
    result.recommendedModeVisible &&
    result.normalModeExplained &&
    result.godModeExplained &&
    result.tianshuModeExplained &&
    result.securityShieldExplanationVisible &&
    result.providerCredentialRefBoundaryVisible &&
    result.evidenceReplayPreviewVisible &&
    result.nextStepGuidanceVisible &&
    result.skipButtonResponds &&
    result.viewDetailsButtonResponds &&
    !result.deadButtonDetected &&
    result.bannedTermsFound.length === 0 &&
    !result.yiyiVisible &&
    !result.characterModuleVisible &&
    !result.guidedShowcaseVisible &&
    !result.floatingAvatarVisible &&
    !result.providerCallsMade &&
    !result.secretValueExposed &&
    !result.deployExecuted &&
    !result.billingExecuted &&
    !result.invoiceGenerated &&
    !result.chatGatewayRuntimeModified;

  result.completed = checksPassed;
  result.recommended_sealed = checksPassed;
  result.blocker = checksPassed ? null : "actual_clickable_sample_dry_run_repair_incomplete";
} catch (error) {
  result.blocker = error instanceof Error ? error.message : String(error);
  try {
    result.runtimeEvents = cdp?.events?.()?.filter((event) => event.method === "Runtime.exceptionThrown" || event.method === "Log.entryAdded") || [];
  } catch {}
} finally {
  await closeCdpSilently(cdp);
  await terminateBrowser(browserProcess);
  if (browserProfileDir) await rm(browserProfileDir, { recursive: true, force: true }).catch(() => {});
  if (server) {
    server.closeAllConnections?.();
    await close(server);
  }
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!result.completed) process.exitCode = 1;
}

async function inspectPage() {
  return cdp.evaluate(`(() => {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
    const resultPanel = document.getElementById('scenario-dry-run-result-panel');
    return {
      url: location.href,
      visibleText: document.body.innerText || '',
      renderedDom: '<!doctype html>\\n' + clone.outerHTML,
      resultVisible: Boolean(resultPanel) && resultPanel.hidden === false,
      scenarioState: document.getElementById('scenario-trial-panel')?.dataset.scenarioState || ''
    };
  })()`);
}

async function click(selector) {
  await cdp.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error('Missing clickable selector: ' + ${JSON.stringify(selector)});
    node.scrollIntoView({ block: 'center' });
    node.click();
    return true;
  })()`);
}

async function scrollAndCapture(id, path) {
  await cdp.evaluate(`document.getElementById(${JSON.stringify(id)})?.scrollIntoView({ block: 'center' })`);
  await sleep(300);
  await capture(path);
}

async function capture(path) {
  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await writeFile(path, Buffer.from(screenshot.data, "base64"));
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
  const endpoint = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`;
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(endpoint, { method: "PUT" });
      if (response.ok) return response.json();
      lastError = new Error(`Unable to create CDP page: HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(150);
  }
  throw lastError || new Error("Unable to create CDP page");
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
