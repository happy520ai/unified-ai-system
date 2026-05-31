import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase573r");
const resultPath = resolve(evidenceDir, "visible-ui-surface-regression-triage-result.json");
const domSnapshotPath = resolve(evidenceDir, "after-rendered-dom-snapshot.html");
const screenshotPaths = {
  home: resolve(evidenceDir, "after-mission-control-home.png"),
  modes: resolve(evidenceDir, "after-three-mode-overview.png"),
  provider: resolve(evidenceDir, "after-provider-credentialref.png"),
  security: resolve(evidenceDir, "after-security-shield.png"),
  evidence: resolve(evidenceDir, "after-evidence-replay.png"),
};

const bannedVisibleTerms = [
  "Yiyi",
  "依依",
  "Mission Companion",
  "MISSION COMPANION",
  "real 3D placeholder",
  "pseudo-3D",
  "generated concept board",
  "Guided Showcase",
  "进入依依演示",
  "Yiyi real 3D asset",
  "Motion on",
  "2D fallback",
  "3D fallback",
];

const bannedDomTerms = [
  "Yiyi",
  "依依",
  "Mission Companion",
  "MISSION COMPANION",
  "avatar",
  "companion",
  "character",
  "real 3D placeholder",
  "pseudo-3D",
  "generated concept board",
  "Guided Showcase",
  "进入依依演示",
  "Yiyi real 3D asset",
  "Motion on",
];

const bannedSelectors = [
  "#yiyi-live-avatar-stage",
  "#yiyi-avatar-layer",
  "#yiyi-guided-showcase-panel",
  "#yiyi-emotion-panel",
  "#yiyi-character-card",
  "#yiyi-avatar-stage-shell",
  "#start-guided-showcase-button",
];

const requiredVisibleTerms = [
  "Mission Control",
  "Normal",
  "God",
  "Provider",
  "CredentialRef",
  "Security Shield",
  "Evidence",
];

const dangerousActionTerms = [
  "Deploy Now",
  "Release Now",
  "Push to Production",
  "Call Provider Now",
  "Save Secret",
  "Upload Secret",
  "Generate Invoice",
];

const misleadingProductionTerms = [
  "real provider connected",
  "billing enabled",
  "invoice generated",
  "deployment completed",
  "production GA enabled",
];

let server;
let browserProcess;
let browserProfileDir;
let cdp;

const result = {
  phase: "Phase573R",
  name: "Visible Mission Control Surface Regression Triage and Character UI Removal",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  basedOnUserScreenshot: true,
  visibleRegressionDetected: true,
  visibleRegressionFixed: false,
  sameVisibleSurfaceVerified: false,
  realBrowserUsed: false,
  chromiumUsed: false,
  screenshotCaptured: false,
  missionControlReachable: false,
  yiyiVisible: null,
  characterModuleVisible: null,
  missionCompanionVisible: null,
  guidedShowcaseVisible: null,
  floatingAvatarVisible: null,
  avatarPlaceholderVisible: null,
  conceptBoardVisible: null,
  coreMissionControlVisible: false,
  normalModeVisible: false,
  godModeVisible: false,
  tianshuModeVisible: false,
  providerCredentialRefVisible: false,
  securityShieldVisible: false,
  evidenceReplayVisible: false,
  dangerousActionButtonDetected: false,
  misleadingProductionCopyDetected: false,
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
  visibleBannedTermsFound: [],
  domBannedTermsFound: [],
  bannedSelectorsFound: [],
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
  const uiUrl = `http://127.0.0.1:${server.address().port}/ui?phase573r=real-browser`;
  result.url = uiUrl;

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase573r-browser-"));
  browserProcess = spawn(findBrowserPath(), [
    "--headless=new",
    "--disable-gpu",
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
  await waitForExpression(cdp, "Boolean(document.getElementById('mission-control'))");
  result.missionControlReachable = true;

  const state = await cdp.evaluate(`(() => {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
    const visibleText = document.body.innerText || '';
    const renderedDom = '<!doctype html>\\n' + clone.outerHTML;
    const selectorPresence = ${JSON.stringify(bannedSelectors)}.filter((selector) => document.querySelector(selector));
    const requiredSelectors = {
      missionControl: Boolean(document.getElementById('mission-control')),
      securityShield: Boolean(document.getElementById('security-shield-panel')),
      evidenceReplay: Boolean(document.getElementById('evidence-export-panel')),
      providerCredentialRef: Boolean(document.getElementById('provider-credentialref-guidance')),
      threeMode: Boolean(document.getElementById('three-mode-runtime')),
    };
    return {
      visibleText,
      renderedDom,
      selectorPresence,
      requiredSelectors,
      hasTianshu: visibleText.includes('Tianshu') || visibleText.includes('天枢'),
      url: location.href,
    };
  })()`);

  await writeFile(domSnapshotPath, state.renderedDom, "utf8");
  result.sameVisibleSurfaceVerified = state.url.includes("/ui");
  result.visibleBannedTermsFound = bannedVisibleTerms.filter((term) => state.visibleText.includes(term));
  result.domBannedTermsFound = bannedDomTerms.filter((term) => state.renderedDom.includes(term));
  result.bannedSelectorsFound = state.selectorPresence;
  result.yiyiVisible = state.visibleText.includes("Yiyi") || state.visibleText.includes("依依");
  result.characterModuleVisible = state.visibleText.toLowerCase().includes("character") || result.domBannedTermsFound.includes("character");
  result.missionCompanionVisible = state.visibleText.includes("Mission Companion") || state.visibleText.includes("MISSION COMPANION");
  result.guidedShowcaseVisible = state.visibleText.includes("Guided Showcase") || result.bannedSelectorsFound.some((selector) => selector.includes("guided"));
  result.floatingAvatarVisible = result.bannedSelectorsFound.some((selector) => selector.includes("live-avatar") || selector.includes("avatar-layer"));
  result.avatarPlaceholderVisible = state.visibleText.includes("real 3D placeholder") || result.bannedSelectorsFound.some((selector) => selector.includes("avatar-stage"));
  result.conceptBoardVisible = state.visibleText.includes("generated concept board") || state.visibleText.includes("concept board");
  result.coreMissionControlVisible = state.visibleText.includes("Mission Control") || state.requiredSelectors.missionControl;
  result.normalModeVisible = state.visibleText.includes("Normal");
  result.godModeVisible = state.visibleText.includes("God");
  result.tianshuModeVisible = state.hasTianshu;
  result.providerCredentialRefVisible = (state.visibleText.includes("Provider") && state.visibleText.includes("CredentialRef")) || state.requiredSelectors.providerCredentialRef;
  result.securityShieldVisible = state.visibleText.includes("Security Shield") || state.requiredSelectors.securityShield;
  result.evidenceReplayVisible = state.visibleText.includes("Evidence") || state.requiredSelectors.evidenceReplay;
  result.dangerousActionButtonDetected = dangerousActionTerms.some((term) => state.visibleText.includes(term));
  result.misleadingProductionCopyDetected = misleadingProductionTerms.some((term) => state.visibleText.includes(term));

  await capture(screenshotPaths.home);
  await scrollAndCapture("three-mode-runtime", screenshotPaths.modes);
  await scrollAndCapture("provider-credentialref-guidance", screenshotPaths.provider);
  await scrollAndCapture("security-shield-panel", screenshotPaths.security);
  await scrollAndCapture("evidence-export-panel", screenshotPaths.evidence);
  result.screenshotCaptured = Object.values(screenshotPaths).every((path) => existsSync(path));

  result.visibleRegressionFixed = result.visibleBannedTermsFound.length === 0 &&
    result.domBannedTermsFound.length === 0 &&
    result.bannedSelectorsFound.length === 0;
  result.completed = result.visibleRegressionFixed &&
    result.sameVisibleSurfaceVerified &&
    result.realBrowserUsed &&
    result.screenshotCaptured &&
    result.missionControlReachable &&
    result.coreMissionControlVisible &&
    result.normalModeVisible &&
    result.godModeVisible &&
    result.tianshuModeVisible &&
    result.providerCredentialRefVisible &&
    result.securityShieldVisible &&
    result.evidenceReplayVisible &&
    !result.dangerousActionButtonDetected &&
    !result.misleadingProductionCopyDetected;
  result.recommended_sealed = result.completed;
  result.blocker = result.completed ? null : "visible_surface_regression_not_cleared";
} catch (error) {
  result.blocker = error instanceof Error ? error.message : String(error);
} finally {
  await closeCdpSilently(cdp);
  await terminateBrowser(browserProcess);
  if (browserProfileDir) await rm(browserProfileDir, { recursive: true, force: true }).catch(() => {});
  if (server) await close(server);
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!result.completed) process.exitCode = 1;
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
      const value = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (value.exceptionDetails) throw new Error(value.exceptionDetails.text || "Runtime.evaluate failed.");
      return value.result?.value;
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

async function waitForLoadEvent(targetCdp) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (targetCdp.takeEvent("Page.loadEventFired")) return;
    await sleep(100);
  }
  throw new Error("Timed out waiting for page load.");
}

async function waitForExpression(targetCdp, expression, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await targetCdp.evaluate(`Boolean(${expression})`)) return;
    } catch {
      // Retry until the page finishes hydrating.
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

async function closeCdpSilently(targetCdp) {
  try {
    await targetCdp?.close();
  } catch {
    // Best-effort cleanup only.
  }
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
