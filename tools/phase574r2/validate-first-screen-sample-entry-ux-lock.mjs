import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase574r2");
const resultPath = resolve(evidenceDir, "first-screen-sample-entry-ux-lock-result.json");
const domSnapshotPath = resolve(evidenceDir, "dom-snapshot.html");
const screenshotPaths = {
  initial: resolve(evidenceDir, "initial-first-screen.png"),
  afterStart: resolve(evidenceDir, "after-click-sample-dry-run.png"),
  detail: resolve(evidenceDir, "detail-drawer-open.png"),
};

const modifiedFiles = [
  "apps/ai-gateway-service/src/ui/consolePage.js",
  "tools/phase574r2/validate-first-screen-sample-entry-ux-lock.mjs",
  "docs/phase574r2-first-screen-sample-entry-ux-lock.md",
  "docs/phase574r2-execution-report.md",
  "apps/ai-gateway-service/evidence/phase574r2/first-screen-sample-entry-ux-lock-result.json",
];

let server;
let browserProcess;
let browserProfileDir;
let cdp;
let currentStep = "not_started";

const result = {
  phase: "Phase574R-2",
  name: "First-Screen Sample Entry UX Lock",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  modifiedFiles,
  chromiumChecks: {
    realBrowserUsed: false,
    chromiumUsed: false,
    screenshotCaptured: false,
    initialMissionControlVisible: false,
    initialSampleEntryVisible: false,
    initialStartButtonVisible: false,
    initialDryRunResultVisible: true,
    initialDetailDrawerVisible: true,
    initialYiyiVisible: true,
    initialCharacterModuleVisible: true,
    initialGuidedShowcaseVisible: true,
    initialFloatingAvatarVisible: true,
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
    deadButtonDetected: true,
  },
  screenshots: screenshotPaths,
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
  rollback: [
    "Delete tools/phase574r2/.",
    "Delete docs/phase574r2-first-screen-sample-entry-ux-lock.md.",
    "Delete docs/phase574r2-execution-report.md.",
    "Delete apps/ai-gateway-service/evidence/phase574r2/.",
    "Revert this phase's consolePage.js interaction-order change only; do not use git reset --hard or git clean without explicit approval.",
  ],
};

try {
  currentStep = "create_evidence_dir";
  await mkdir(evidenceDir, { recursive: true });
  currentStep = "create_application";
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory",
  });
  server = createGatewayHttpServer(application);
  currentStep = "listen_server";
  await listen(server, 0, "127.0.0.1");
  const uiUrl = `http://127.0.0.1:${server.address().port}/ui?phase574r2=first-screen-lock`;
  result.url = uiUrl;

  currentStep = "spawn_browser";
  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase574r2-browser-"));
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

  result.chromiumChecks.chromiumUsed = true;
  currentStep = "read_devtools_port";
  const cdpPort = await readDevToolsPort(browserProfileDir);
  currentStep = "create_cdp_page";
  const pageTarget = await createCdpPage(cdpPort, uiUrl);
  currentStep = "connect_cdp";
  cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
  result.chromiumChecks.realBrowserUsed = true;
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.navigate", { url: uiUrl });
  await waitForLoadEvent(cdp);
  await waitForExpression(cdp, "document.getElementById('scenario-trial-panel')");

  const initial = await inspectPage();
  result.chromiumChecks.initialMissionControlVisible = initial.visibleText.includes("Mission Control");
  result.chromiumChecks.initialSampleEntryVisible =
    initial.visibleText.includes("Try a sample task") ||
    initial.visibleText.includes("sample dry-run");
  result.chromiumChecks.initialStartButtonVisible = initial.startButtonVisible;
  result.chromiumChecks.initialDryRunResultVisible = initial.resultVisible;
  result.chromiumChecks.initialDetailDrawerVisible = initial.drawerVisible;
  result.chromiumChecks.initialYiyiVisible = initial.yiyiVisible;
  result.chromiumChecks.initialCharacterModuleVisible = initial.characterModuleVisible;
  result.chromiumChecks.initialGuidedShowcaseVisible = initial.guidedShowcaseVisible;
  result.chromiumChecks.initialFloatingAvatarVisible = initial.floatingAvatarVisible;
  await capture(screenshotPaths.initial);

  await click("#start-sample-dry-run-button");
  await waitForExpression(cdp, "!document.getElementById('scenario-dry-run-result-panel')?.hidden");
  const afterStart = await inspectPage();
  result.chromiumChecks.clickStartSampleDryRunWorks = afterStart.scenarioState === "result-visible";
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

  await click("#open-evidence-button");
  await waitForExpression(cdp, "document.getElementById('evidence-drawer')?.classList.contains('is-open')");
  const afterDetails = await inspectPage();
  result.chromiumChecks.viewDetailsButtonResponds = afterDetails.drawerVisible;
  result.chromiumChecks.detailDrawerVisibleAfterClick = afterDetails.drawerVisible;
  result.chromiumChecks.detailJsonVisible =
    afterDetails.evidenceText.includes("sampleDryRun") &&
    afterDetails.evidenceText.includes('"recommendedMode": "Tianshu"') &&
    afterDetails.evidenceText.includes('"providerCallsMade": false');
  await capture(screenshotPaths.detail);

  result.chromiumChecks.screenshotCaptured = Object.values(screenshotPaths).every((path) => existsSync(path));
  result.chromiumChecks.deadButtonDetected = !result.chromiumChecks.clickStartSampleDryRunWorks ||
    !result.chromiumChecks.viewDetailsButtonResponds;

  const checksPassed =
    result.chromiumChecks.realBrowserUsed &&
    result.chromiumChecks.chromiumUsed &&
    result.chromiumChecks.screenshotCaptured &&
    result.chromiumChecks.initialMissionControlVisible &&
    result.chromiumChecks.initialSampleEntryVisible &&
    result.chromiumChecks.initialStartButtonVisible &&
    !result.chromiumChecks.initialDryRunResultVisible &&
    !result.chromiumChecks.initialDetailDrawerVisible &&
    !result.chromiumChecks.initialYiyiVisible &&
    !result.chromiumChecks.initialCharacterModuleVisible &&
    !result.chromiumChecks.initialGuidedShowcaseVisible &&
    !result.chromiumChecks.initialFloatingAvatarVisible &&
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
    !result.chromiumChecks.deadButtonDetected &&
    !result.safetyBoundary.providerCallsMade &&
    !result.safetyBoundary.secretValueExposed &&
    !result.safetyBoundary.deployExecuted &&
    !result.safetyBoundary.billingExecuted &&
    !result.safetyBoundary.invoiceGenerated;

  result.completed = checksPassed;
  result.recommended_sealed = checksPassed;
  result.blocker = checksPassed ? null : "first_screen_sample_entry_ux_lock_incomplete";
} catch (error) {
  result.blocker = `${currentStep}: ${error instanceof Error ? error.message : String(error)}`;
  try {
    result.runtimeEvents = cdp?.events?.()
      .filter((event) => event.method === "Runtime.exceptionThrown" || event.method === "Log.entryAdded") || [];
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
    const drawer = document.getElementById('evidence-drawer');
    const visibleText = document.body.innerText || '';
    const renderedDom = '<!doctype html>\\n' + clone.outerHTML;
    return {
      url: location.href,
      visibleText,
      renderedDom,
      resultVisible: Boolean(resultPanel) && resultPanel.hidden === false && getComputedStyle(resultPanel).display !== 'none',
      drawerVisible: Boolean(drawer) && drawer.classList.contains('is-open') && drawer.getAttribute('aria-hidden') === 'false',
      evidenceText: document.getElementById('evidence-output')?.innerText || '',
      startButtonVisible: Boolean(document.getElementById('start-sample-dry-run-button')) &&
        getComputedStyle(document.getElementById('start-sample-dry-run-button')).display !== 'none',
      scenarioState: document.getElementById('scenario-trial-panel')?.dataset.scenarioState || '',
      yiyiVisible: visibleText.includes('Yiyi') || visibleText.includes('Mission Companion'),
      characterModuleVisible: visibleText.toLowerCase().includes('character'),
      guidedShowcaseVisible: visibleText.includes('Guided Showcase'),
      floatingAvatarVisible: renderedDom.includes('yiyi-live-avatar-stage') || renderedDom.includes('yiyi-avatar-layer')
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
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(endpoint, { method: "PUT" });
      if (response.ok) return response.json();
      lastError = new Error(`Unable to create CDP page: HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
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
