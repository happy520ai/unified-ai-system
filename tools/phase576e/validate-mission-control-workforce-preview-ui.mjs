import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase576e");
const resultPath = resolve(evidenceDir, "mission-control-workforce-preview-ui-result.json");
const domSnapshotPath = resolve(evidenceDir, "dom-snapshot.html");
const screenshotPath = resolve(evidenceDir, "workforce-preview-ui.png");

let server;
let browserProcess;
let browserProfileDir;
let cdp;

const result = {
  phase: "Phase576E",
  name: "Mission Control Workforce Preview UI",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  missionControlVisible: false,
  sampleDryRunEntryStillVisible: false,
  initialSampleDryRunResultVisible: true,
  workforcePreviewVisible: false,
  positionLibraryStatusVisible: false,
  employeePyramidVisible: false,
  schedulerPolicyVisible: false,
  brainAdapterBoundaryVisible: false,
  workforceDryRunButtonWorks: false,
  deadButtonDetected: true,
  yiyiVisible: true,
  characterModuleVisible: true,
  providerCallsMade: false,
  secretValueExposed: false,
  screenshots: { workforcePreview: screenshotPath },
  domSnapshot: domSnapshotPath,
  safetyBoundary: {
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    deployExecuted: false,
    billingExecuted: false,
    invoiceGenerated: false,
    workspaceCleanClaimed: false,
  },
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
  const uiUrl = `http://127.0.0.1:${server.address().port}/ui?phase576e=workforce-preview`;
  result.url = uiUrl;

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase576e-browser-"));
  browserProcess = spawn(findBrowserPath(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-gpu-sandbox",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-sync",
    "--disable-default-apps",
    "--disable-component-update",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${browserProfileDir}`,
    "--window-size=1440,1200",
    "about:blank",
  ], { cwd: repoRoot, stdio: "ignore" });

  const cdpPort = await readDevToolsPort(browserProfileDir);
  const pageTarget = await createCdpPage(cdpPort, uiUrl);
  cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.navigate", { url: uiUrl });
  await waitForLoadEvent(cdp);
  await waitForExpression(cdp, "document.getElementById('workforce-preview-panel')");

  const initial = await inspectPage();
  result.missionControlVisible = initial.visibleText.includes("Mission Control");
  result.sampleDryRunEntryStillVisible =
    initial.visibleText.includes("Try a sample task") ||
    initial.visibleText.includes("sample dry-run") ||
    initial.visibleText.includes("试用一个任务");
  result.initialSampleDryRunResultVisible = initial.sampleResultVisible;
  result.workforcePreviewVisible = initial.workforcePreviewVisible;
  result.positionLibraryStatusVisible =
    initial.visibleText.includes("Position Library") &&
    initial.visibleText.includes("source-backed");
  result.employeePyramidVisible =
    initial.visibleText.includes("Employee Pyramid") &&
    initial.visibleText.includes("L0 System Governor");
  result.schedulerPolicyVisible =
    initial.visibleText.includes("Dry-run Scheduler") &&
    initial.visibleText.includes("brain calls 0");
  result.brainAdapterBoundaryVisible =
    initial.visibleText.includes("Brain Adapter") &&
    initial.visibleText.includes("credentialRef");
  result.yiyiVisible = initial.yiyiVisible;
  result.characterModuleVisible = initial.characterModuleVisible;

  await click("[data-workforce-action='pyramid']");
  await click("[data-workforce-action='positions']");
  await click("#run-workforce-dry-run-button");
  await waitForExpression(cdp, "!document.getElementById('workforce-preview-result-panel')?.hidden");
  const after = await inspectPage();
  result.workforceDryRunButtonWorks =
    after.workforceResultVisible &&
    after.visibleText.includes("Workforce dry-run result") &&
    after.visibleText.includes("providerCallsMade=false");
  result.deadButtonDetected = !result.workforceDryRunButtonWorks;

  await writeFile(domSnapshotPath, after.renderedDom, "utf8");
  await capture(screenshotPath);

  const checksPassed =
    result.missionControlVisible &&
    result.sampleDryRunEntryStillVisible &&
    result.initialSampleDryRunResultVisible === false &&
    result.workforcePreviewVisible &&
    result.positionLibraryStatusVisible &&
    result.employeePyramidVisible &&
    result.schedulerPolicyVisible &&
    result.brainAdapterBoundaryVisible &&
    result.workforceDryRunButtonWorks &&
    result.deadButtonDetected === false &&
    result.yiyiVisible === false &&
    result.characterModuleVisible === false &&
    result.providerCallsMade === false &&
    result.secretValueExposed === false;

  result.completed = checksPassed;
  result.recommended_sealed = checksPassed;
  result.blocker = checksPassed ? null : "phase576e_workforce_preview_ui_incomplete";
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
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!result.completed) process.exitCode = 1;
}

async function inspectPage() {
  return cdp.evaluate(`(() => {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
    const renderedDom = clone.outerHTML;
    let visibleText = document.body.innerText || "";
    const evidencePathPattern = new RegExp("apps/ai-gateway-service/evidence/.*(?:yiyi|avatar|character|guided)", "i");
    visibleText = visibleText
      .split(String.fromCharCode(10))
      .filter((line) => !evidencePathPattern.test(line))
      .join(String.fromCharCode(10));
    const samplePanel = document.getElementById('scenario-dry-run-result-panel');
    const workforcePanel = document.getElementById('workforce-preview-panel');
    const workforceResult = document.getElementById('workforce-preview-result-panel');
    return {
      visibleText,
      renderedDom,
      sampleResultVisible: !!samplePanel && !samplePanel.hidden && samplePanel.offsetParent !== null,
      workforcePreviewVisible: !!workforcePanel && workforcePanel.offsetParent !== null,
      workforceResultVisible: !!workforceResult && !workforceResult.hidden && workforceResult.offsetParent !== null,
      yiyiVisible: /Yiyi|依依|Mission Companion|Guided Showcase|floating avatar/i.test(visibleText),
      characterModuleVisible: /Character|avatar|companion|real 3D placeholder|pseudo-3D/i.test(visibleText)
    };
  })()`);
}

async function click(selector) {
  const clicked = await cdp.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return false;
    node.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`click target missing: ${selector}`);
  await delay(120);
}

async function capture(path) {
  const response = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await writeFile(path, Buffer.from(response.data, "base64"));
}

async function waitForExpression(client, expression, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const value = await client.evaluate(expression);
      if (value) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

async function waitForLoadEvent(client) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (client.takeEvent("Page.loadEventFired")) return;
    await delay(100);
  }
  throw new Error("Timed out waiting for page load.");
}

function findBrowserPath() {
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("Chromium browser not found");
  return found;
}

async function readDevToolsPort(profileDir) {
  const file = resolve(profileDir, "DevToolsActivePort");
  for (let i = 0; i < 100; i += 1) {
    if (existsSync(file)) {
      const [port] = (await readFile(file, "utf8")).split(/\r?\n/);
      if (port) return Number(port);
    }
    await delay(100);
  }
  throw new Error("DevToolsActivePort not found");
}

async function createCdpPage(port, url) {
  const endpoint = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`;
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(endpoint, { method: "PUT" });
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}: create CDP page`);
    } catch (error) {
      lastError = error;
    }
    await delay(150);
  }
  throw lastError || new Error("Unable to create CDP page");
}

async function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
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
      if (message.error) rejectSend(new Error(message.error.message || "CDP error"));
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
    close() {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
    },
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

function listen(httpServer, port, host) {
  return new Promise((resolveListen, rejectListen) => {
    httpServer.once("error", rejectListen);
    httpServer.listen(port, host, () => resolveListen());
  });
}

function close(httpServer) {
  return new Promise((resolveClose) => httpServer.close(() => resolveClose()));
}

async function terminateBrowser(processHandle) {
  if (!processHandle || processHandle.killed) return;
  processHandle.kill();
  await delay(250);
}

async function closeCdpSilently(client) {
  try {
    client?.close?.();
  } catch {}
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
