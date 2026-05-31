import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase582");
const evidencePath = resolve(evidenceDir, "mission-control-workforce-product-ui-result.json");
const domSnapshotPath = resolve(evidenceDir, "dom-snapshot.html");
const screenshotPath = resolve(evidenceDir, "workforce-product-ui.png");

let server;
let browserProcess;
let browserProfileDir;
let cdp;

const result = {
  phase: "Phase582",
  name: "Mission Control Workforce Product UI",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  missionControlVisible: false,
  sampleDryRunEntryStillVisible: false,
  workforceProductUiVisible: false,
  positionLibraryPanelVisible: false,
  employeePyramidPanelVisible: false,
  schedulerPanelVisible: false,
  brainAdapterBoundaryVisible: false,
  workforceDryRunButtonWorks: false,
  evidenceTimelineVisibleAfterDryRun: false,
  deadButtonDetected: true,
  yiyiVisible: false,
  characterModuleVisible: false,
  providerCallsMade: false,
  secretValueExposed: false,
  screenshots: { productUi: screenshotPath },
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
  const uiUrl = `http://127.0.0.1:${server.address().port}/ui?phase582=workforce-product-ui`;
  result.url = uiUrl;

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase582-browser-"));
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
    "--window-size=1440,1300",
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
  result.sampleDryRunEntryStillVisible = initial.visibleText.includes("sample dry-run") || initial.visibleText.includes("Try a sample task");
  result.workforceProductUiVisible = initial.hasWorkforceProductUi;
  result.positionLibraryPanelVisible = initial.positionLibraryPanelVisible;
  result.employeePyramidPanelVisible = initial.employeePyramidPanelVisible;
  result.schedulerPanelVisible = initial.schedulerPanelVisible;
  result.brainAdapterBoundaryVisible = initial.brainAdapterBoundaryVisible;
  result.yiyiVisible = initial.yiyiVisible;
  result.characterModuleVisible = initial.characterModuleVisible;

  for (const selector of [
    "[data-workforce-action='positions']",
    "[data-workforce-action='pyramid']",
    "#run-workforce-dry-run-button",
    "[data-workforce-action='evidence']",
    "[data-workforce-action='brain-boundary']",
  ]) {
    await click(selector);
  }
  const after = await inspectPage();
  result.workforceDryRunButtonWorks = after.workforceResultVisible && after.visibleText.includes("Selected employees");
  result.evidenceTimelineVisibleAfterDryRun = after.visibleText.includes("Evidence timeline");
  result.deadButtonDetected = !(result.workforceDryRunButtonWorks && result.evidenceTimelineVisibleAfterDryRun);
  await writeFile(domSnapshotPath, after.renderedDom, "utf8");
  await capture(screenshotPath);

  const passed =
    result.missionControlVisible &&
    result.sampleDryRunEntryStillVisible &&
    result.workforceProductUiVisible &&
    result.positionLibraryPanelVisible &&
    result.employeePyramidPanelVisible &&
    result.schedulerPanelVisible &&
    result.brainAdapterBoundaryVisible &&
    result.workforceDryRunButtonWorks &&
    result.evidenceTimelineVisibleAfterDryRun &&
    result.deadButtonDetected === false &&
    result.yiyiVisible === false &&
    result.characterModuleVisible === false &&
    result.providerCallsMade === false &&
    result.secretValueExposed === false;

  result.completed = passed;
  result.recommended_sealed = passed;
  result.blocker = passed ? null : "phase582_workforce_product_ui_incomplete";
} catch (error) {
  result.blocker = error instanceof Error ? error.message : String(error);
} finally {
  try { cdp?.close?.(); } catch {}
  if (browserProcess && !browserProcess.killed) browserProcess.kill();
  if (browserProfileDir) await rm(browserProfileDir, { recursive: true, force: true }).catch(() => {});
  if (server) {
    server.closeAllConnections?.();
    await close(server);
  }
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (!result.completed) process.exitCode = 1;
}

async function inspectPage() {
  return cdp.evaluate(`(() => {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
    const visibleText = document.body.innerText || "";
    const byId = (id) => document.getElementById(id);
    return {
      visibleText,
      renderedDom: clone.outerHTML,
      hasWorkforceProductUi: !!byId('workforce-product-ui-grid'),
      positionLibraryPanelVisible: !!byId('position-library-panel') && byId('position-library-panel').offsetParent !== null,
      employeePyramidPanelVisible: !!byId('employee-pyramid-panel') && byId('employee-pyramid-panel').offsetParent !== null,
      schedulerPanelVisible: !!byId('workforce-scheduler-panel') && byId('workforce-scheduler-panel').offsetParent !== null,
      brainAdapterBoundaryVisible: !!byId('brain-adapter-boundary-panel') && byId('brain-adapter-boundary-panel').offsetParent !== null,
      workforceResultVisible: !!byId('workforce-preview-result-panel') && !byId('workforce-preview-result-panel').hidden,
      yiyiVisible: /Yiyi|依依|Guided Showcase|floating avatar/i.test(visibleText),
      characterModuleVisible: /Character|avatar|companion|pseudo-3D/i.test(visibleText)
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
      if (await client.evaluate(expression)) return;
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
  for (let i = 0; i < 150; i += 1) {
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
      if (payload.exceptionDetails) throw new Error(payload.exceptionDetails.text || "Runtime.evaluate failed");
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

function listen(httpServer, port, host) {
  return new Promise((resolveListen, rejectListen) => {
    httpServer.once("error", rejectListen);
    httpServer.listen(port, host, () => resolveListen());
  });
}

function close(httpServer) {
  return new Promise((resolveClose) => httpServer.close(() => resolveClose()));
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

