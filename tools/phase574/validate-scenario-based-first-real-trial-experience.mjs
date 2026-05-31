import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase574");
const resultPath = resolve(evidenceDir, "scenario-based-first-real-trial-experience-result.json");
const domSnapshotPath = resolve(evidenceDir, "phase574-rendered-dom-snapshot.html");
const screenshotPaths = {
  home: resolve(evidenceDir, "phase574-mission-control-with-sample-task.png"),
  result: resolve(evidenceDir, "phase574-sample-task-dry-run-result.png"),
  security: resolve(evidenceDir, "phase574-security-shield-sample.png"),
  evidence: resolve(evidenceDir, "phase574-evidence-replay-sample.png"),
  provider: resolve(evidenceDir, "phase574-provider-boundary-sample.png"),
};

let server;
let browserProcess;
let browserProfileDir;
let cdp;

const result = {
  phase: "Phase574",
  name: "Scenario-Based First Real Trial Experience",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  basedOnVisibleUserConfusion: true,
  scenarioTrialEntryAdded: false,
  sampleTaskVisible: false,
  dryRunOnly: false,
  sampleTaskRequiresApiKey: false,
  sampleTaskCallsProvider: false,
  sampleTaskTriggersDeploy: false,
  sampleTaskTriggersBilling: false,
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
  realBrowserUsed: false,
  chromiumUsed: false,
  screenshotCaptured: false,
  missionControlReachable: false,
  yiyiVisible: false,
  characterModuleVisible: false,
  guidedShowcaseVisible: false,
  floatingAvatarVisible: false,
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
  missingRequiredTerms: [],
  bannedTermsFound: [],
};

const requiredTerms = [
  "试用一个任务",
  "Try a sample task",
  "sample task",
  "dry-run",
  "preview",
  "no-provider-call",
  "no-secret",
  "no-deploy",
  "no-billing",
  "no-invoice",
  "Mission Understanding",
  "Recommended Mode",
  "Normal",
  "God",
  "Tianshu",
  "task planning",
  "Security Shield",
  "Provider",
  "CredentialRef",
  "Evidence Replay preview",
  "Next Step",
];

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
  "deployment completed",
  "billing enabled",
  "invoice generated",
  "production GA enabled",
];

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
  const uiUrl = `http://127.0.0.1:${server.address().port}/ui?phase574=real-browser`;
  result.url = uiUrl;

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase574-browser-"));
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
  result.missionControlReachable = true;

  await capture(screenshotPaths.home);
  await click("#start-sample-dry-run-button");
  await waitForExpression(cdp, "!document.getElementById('scenario-dry-run-result-panel')?.hidden");

  const state = await inspectPage();
  await writeFile(domSnapshotPath, state.renderedDom, "utf8");
  const text = state.visibleText;
  result.scenarioTrialEntryAdded = state.selectors.scenarioTrial;
  result.sampleTaskVisible = state.selectors.sampleTask && text.includes("Help me decide whether a complex request");
  result.dryRunOnly = text.includes("dry-run") && text.includes("no-provider-call");
  result.missionUnderstandingVisible = text.includes("Mission Understanding");
  result.recommendedModeVisible = text.includes("Recommended Mode") && text.includes("Recommended: Tianshu");
  result.normalModeExplained = text.includes("Normal") && text.includes("single-model");
  result.godModeExplained = text.includes("God") && text.includes("multi-model review");
  result.tianshuModeExplained = text.includes("Tianshu") && text.includes("task planning");
  result.securityShieldExplanationVisible = state.selectors.securityShield && text.includes("Security Shield");
  result.providerCredentialRefBoundaryVisible = state.selectors.providerBoundary && text.includes("CredentialRef");
  result.evidenceReplayPreviewVisible = state.selectors.evidencePreview && text.includes("Evidence Replay preview");
  result.nextStepGuidanceVisible = text.includes("Next Step") && text.includes("Use Normal for simple tasks");
  result.yiyiVisible = text.includes("Yiyi") || text.includes("依依");
  result.characterModuleVisible = text.toLowerCase().includes("character");
  result.guidedShowcaseVisible = text.includes("Guided Showcase") || text.includes("进入依依演示");
  result.floatingAvatarVisible = state.renderedDom.includes("yiyi-live-avatar-stage") || state.renderedDom.includes("yiyi-avatar-layer");
  result.dangerousActionButtonDetected = dangerousActionTerms.some((term) => text.includes(term));
  result.misleadingProductionCopyDetected = misleadingProductionTerms.some((term) => text.includes(term));
  result.missingRequiredTerms = requiredTerms.filter((term) => !text.includes(term));
  result.bannedTermsFound = bannedTerms.filter((term) => text.includes(term) || state.renderedDom.includes(term));

  await scrollAndCapture("scenario-dry-run-result-panel", screenshotPaths.result);
  await scrollAndCapture("security-shield-panel", screenshotPaths.security);
  await scrollAndCapture("scenario-evidence-replay-preview", screenshotPaths.evidence);
  await scrollAndCapture("provider-credentialref-guidance", screenshotPaths.provider);
  result.screenshotCaptured = Object.values(screenshotPaths).every((path) => existsSync(path));

  const checksPassed = result.scenarioTrialEntryAdded &&
    result.sampleTaskVisible &&
    result.dryRunOnly &&
    result.missionUnderstandingVisible &&
    result.recommendedModeVisible &&
    result.normalModeExplained &&
    result.godModeExplained &&
    result.tianshuModeExplained &&
    result.securityShieldExplanationVisible &&
    result.providerCredentialRefBoundaryVisible &&
    result.evidenceReplayPreviewVisible &&
    result.nextStepGuidanceVisible &&
    result.realBrowserUsed &&
    result.screenshotCaptured &&
    result.missionControlReachable &&
    result.missingRequiredTerms.length === 0 &&
    result.bannedTermsFound.length === 0 &&
    !result.yiyiVisible &&
    !result.characterModuleVisible &&
    !result.guidedShowcaseVisible &&
    !result.floatingAvatarVisible &&
    !result.dangerousActionButtonDetected &&
    !result.misleadingProductionCopyDetected &&
    !result.providerCallsMade &&
    !result.secretValueExposed &&
    !result.deployExecuted &&
    !result.billingExecuted &&
    !result.invoiceGenerated &&
    !result.chatGatewayRuntimeModified;

  result.completed = checksPassed;
  result.recommended_sealed = checksPassed;
  result.blocker = checksPassed ? null : "scenario_first_trial_experience_incomplete";
} catch (error) {
  result.blocker = error instanceof Error ? error.message : String(error);
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
    return {
      visibleText: document.body.innerText || '',
      renderedDom: '<!doctype html>\\n' + clone.outerHTML,
      selectors: {
        scenarioTrial: Boolean(document.getElementById('scenario-trial-panel')),
        sampleTask: Boolean(document.getElementById('scenario-sample-task-card')),
        evidencePreview: Boolean(document.getElementById('scenario-evidence-replay-preview')),
        securityShield: Boolean(document.getElementById('security-shield-panel')),
        providerBoundary: Boolean(document.getElementById('provider-credentialref-guidance')),
      }
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
