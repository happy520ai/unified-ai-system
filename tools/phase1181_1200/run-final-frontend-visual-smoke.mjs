import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";
import { buildSafetyFields, buildTokenSavingFields, evidenceDir, screenshotsDir } from "./phase1181-common.mjs";

const repoRoot = process.cwd();
const resultPath = resolve(evidenceDir, "final-frontend-visual-smoke-result.json");
const domSnapshotPath = resolve(evidenceDir, "final-frontend-visual-smoke-dom-snapshot.html");
const screenshotPaths = {
  initial: resolve(screenshotsDir, "initial-screen.png"),
  afterInput: resolve(screenshotsDir, "after-input.png"),
  afterPreview: resolve(screenshotsDir, "after-preview.png"),
  detailsCollapsed: resolve(screenshotsDir, "details-collapsed.png"),
  detailsExpanded: resolve(screenshotsDir, "details-expanded.png"),
  responsive1440: resolve(screenshotsDir, "responsive-1440.png"),
  responsive1024: resolve(screenshotsDir, "responsive-1024.png"),
  responsive768: resolve(screenshotsDir, "responsive-768.png")
};

let server;
let browserProcess;
let browserProfileDir;
let cdp;

const result = {
  phaseRange: "Phase1181-1200",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  realBrowserSmokePassed: false,
  screenshotsGenerated: false,
  responsiveScreenshotsGenerated: false,
  chromeBrowserUsed: false,
  targetUrl: null,
  screenshots: Object.fromEntries(Object.entries(screenshotPaths).map(([key, value]) => [key, toRepoPath(value)])),
  domSnapshotPath: toRepoPath(domSnapshotPath),
  ...buildTokenSavingFields(),
  ...buildSafetyFields()
};

try {
  mkdirSync(screenshotsDir, { recursive: true });
  const smoke = await runSmoke();
  Object.assign(result, smoke);
  result.completed = true;
  result.realBrowserSmokePassed = smoke.visualAssertionsPassed;
  result.screenshotsGenerated = allExist(Object.values(screenshotPaths));
  result.responsiveScreenshotsGenerated = allExist([screenshotPaths.responsive1440, screenshotPaths.responsive1024, screenshotPaths.responsive768]);
  result.recommended_sealed = result.realBrowserSmokePassed && result.screenshotsGenerated && result.responsiveScreenshotsGenerated;
  result.blocker = result.recommended_sealed ? null : "visual_browser_screenshot_failed";
} catch (error) {
  result.completed = true;
  result.recommended_sealed = false;
  result.blocker = error instanceof Error ? error.message : String(error);
} finally {
  await closeCdpSilently(cdp);
  await terminateBrowser(browserProcess);
  if (browserProfileDir) await rm(browserProfileDir, { recursive: true, force: true }).catch(() => {});
  if (server) await closeServer(server);
  writeJson(resultPath, result);
  console.log(JSON.stringify({
    completed: result.completed,
    recommended_sealed: result.recommended_sealed,
    blocker: result.blocker,
    realBrowserSmokePassed: result.realBrowserSmokePassed,
    screenshotsGenerated: result.screenshotsGenerated
  }, null, 2));
  if (!result.recommended_sealed) process.exitCode = 1;
}

async function runSmoke() {
  const application = createGatewayApplication({
    ...process.env,
    NVIDIA_API_KEY: "",
    OPENAI_API_KEY: "",
    CLAUDE_API_KEY: "",
    OPENROUTER_API_KEY: "",
    MIMO_API_KEY: "",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_PROVIDER_MODE: "fake",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory"
  });
  server = createGatewayHttpServer(application);
  const baseUrl = await listen(server);
  const url = `${baseUrl}/ui?phase1181-1200=visual-smoke`;
  result.targetUrl = url;

  browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase1181-visual-browser-"));
  browserProcess = spawn(findAnyBrowserPath(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-sync",
    "--disable-default-apps",
    "--disable-component-update",
    "--disable-crash-reporter",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=0",
    `--user-data-dir=${browserProfileDir}`,
    "--window-size=1440,1100",
    "about:blank"
  ], { cwd: repoRoot, stdio: "ignore" });

  const cdpPort = await readDevToolsPort(browserProfileDir);
  const pageTarget = await createCdpPage(cdpPort, url);
  cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  await setViewport(1440, 1100);
  await navigate(url);
  await capture(screenshotPaths.initial);
  await type("#future-os-task-input", "帮我检查本轮本地自用方案，列出风险、执行顺序和下一步。");
  await capture(screenshotPaths.afterInput);
  await click("#future-os-preview-button");
  await waitForExpression("document.getElementById('future-os-preview-card')?.dataset.previewVisible === 'true'");
  await capture(screenshotPaths.afterPreview);
  await capture(screenshotPaths.detailsCollapsed);
  await click("#future-os-toggle-details");
  await waitForExpression("!document.getElementById('future-os-details-panel')?.hidden");
  await capture(screenshotPaths.detailsExpanded);
  await setViewport(1440, 1100);
  await capture(screenshotPaths.responsive1440);
  await setViewport(1024, 1000);
  await capture(screenshotPaths.responsive1024);
  await setViewport(768, 1000);
  await capture(screenshotPaths.responsive768);
  await setViewport(1440, 1100);

  const inspection = await inspectPage();
  await writeFile(domSnapshotPath, inspection.renderedDom, "utf8");
  const buttonTexts = inspection.buttonTexts.map((text) => text.toLowerCase());
  const dangerousButtonDetected = buttonTexts.some((text) => ["deploy", "release", "tag", "artifact upload", "production enable", "read secret", "print api key", "真实调用", "部署", "上线"].some((term) => text.includes(term)));

  const visualAssertions = {
    workbenchReachable: inspection.panelPresent,
    firstScreenFeelsLikeFutureMinimalOS: inspection.panelText.includes("Mission Control OS") && inspection.hasCommandSurface,
    oldWorkbenchFeelingReduced: inspection.hasRail && !inspection.panelText.includes("传统后台"),
    leftSidebarHeavyLookRemoved: inspection.railWidth <= 90,
    missionInputProminent: inspection.hasMissionInput && inspection.commandSurfaceHeight >= 180,
    singlePrimaryCtaPresent: inspection.primaryCtaCount === 1,
    threeModeCardsClear: inspection.modeCount === 3,
    bottomStatusDockClean: inspection.hasStatusDock && inspection.panelText.includes("Provider") && inspection.panelText.includes("不会调用"),
    floatingNoiseRemoved: !/Yiyi|avatar|companion|character|依依/.test(inspection.panelText),
    providerEvidenceDiagnosticsCollapsedByDefault: inspection.detailsVisible === true && inspection.providerNestedOpen === false,
    dangerousActionButtonDetected: dangerousButtonDetected,
    misleadingProductionCopyDetected: /(已上线|已经上线|生产启用成功|production enabled|production is enabled)/i.test(inspection.panelText),
    characterModuleVisible: /Yiyi|avatar|companion|character|依依/.test(inspection.panelText)
  };
  const visualAssertionsPassed = Object.entries(visualAssertions).every(([key, value]) => key.includes("Detected") || key.includes("Visible") ? value === false : value === true);

  return {
    ...visualAssertions,
    visualAssertionsPassed,
    initialScreenCaptured: existsSync(screenshotPaths.initial),
    afterInputCaptured: existsSync(screenshotPaths.afterInput),
    afterPreviewCaptured: existsSync(screenshotPaths.afterPreview),
    detailsCollapsedCaptured: existsSync(screenshotPaths.detailsCollapsed),
    detailsExpandedCaptured: existsSync(screenshotPaths.detailsExpanded),
    responsive1440Captured: existsSync(screenshotPaths.responsive1440),
    responsive1024Captured: existsSync(screenshotPaths.responsive1024),
    responsive768Captured: existsSync(screenshotPaths.responsive768)
  };
}

function findAnyBrowserPath() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("visual_browser_not_available");
  return found;
}

async function navigate(url) {
  await cdp.send("Page.navigate", { url });
  await waitForLoadEvent();
  await waitForExpression("document.getElementById('future-minimal-os-panel')");
}

async function setViewport(width, height) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  await sleep(160);
}

async function inspectPage() {
  return cdp.evaluate(`(() => {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
    const panel = document.getElementById('future-minimal-os-panel');
    const rail = document.querySelector('.future-os-rail');
    const command = document.querySelector('.future-command-surface');
    const details = document.getElementById('future-os-details-panel');
    const provider = document.getElementById('future-provider-credential-module')?.closest('details');
    return {
      panelPresent: Boolean(panel),
      panelText: panel?.innerText || '',
      renderedDom: '<!doctype html>\\n' + clone.outerHTML,
      primaryCtaCount: document.querySelectorAll('[data-primary-cta="true"]').length,
      modeCount: document.querySelectorAll('.future-mode-choice').length,
      hasRail: Boolean(rail),
      railWidth: rail?.getBoundingClientRect().width || 999,
      hasMissionInput: Boolean(document.querySelector('[data-future-mission-input="true"]')),
      hasCommandSurface: Boolean(command),
      commandSurfaceHeight: command?.getBoundingClientRect().height || 0,
      hasStatusDock: Boolean(document.querySelector('[data-system-status-dock="true"]')),
      detailsVisible: Boolean(details) && !details.hidden && getComputedStyle(details).display !== 'none',
      providerNestedOpen: Boolean(provider?.open),
      buttonTexts: Array.from(document.querySelectorAll('button')).map((button) => button.innerText || button.getAttribute('aria-label') || '')
    };
  })()`);
}

async function click(selector) {
  const clicked = await cdp.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return false;
    node.scrollIntoView({ block: 'center' });
    node.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`missing_click_target:${selector}`);
  await sleep(180);
}

async function type(selector, text) {
  const typed = await cdp.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return false;
    node.focus();
    node.value = ${JSON.stringify(text)};
    node.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  if (!typed) throw new Error(`missing_type_target:${selector}`);
  await sleep(180);
}

async function capture(path) {
  await writeFile(path, Buffer.from((await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true })).data, "base64"));
}

function listen(targetServer) {
  return new Promise((resolveListen, rejectListen) => {
    targetServer.once("error", rejectListen);
    targetServer.listen(0, "127.0.0.1", () => {
      targetServer.off("error", rejectListen);
      resolveListen(`http://127.0.0.1:${targetServer.address().port}`);
    });
  });
}

function closeServer(targetServer) {
  return new Promise((resolveClose) => {
    targetServer.closeAllConnections?.();
    targetServer.close(() => resolveClose());
  });
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
  throw new Error("devtools_port_timeout");
}

async function createCdpPage(port, url) {
  const endpoint = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`;
  const response = await fetch(endpoint, { method: "PUT" });
  if (!response.ok) throw new Error(`cdp_page_create_failed:${response.status}`);
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
      if (payload.exceptionDetails) throw new Error(payload.exceptionDetails.exception?.description || payload.exceptionDetails.text || "Runtime.evaluate failed");
      return payload.result?.value;
    },
    takeEvent(method) {
      const index = events.findIndex((event) => event.method === method);
      return index >= 0 ? events.splice(index, 1)[0] : null;
    },
    async close() {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
    }
  };
}

async function waitForLoadEvent() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (cdp.takeEvent("Page.loadEventFired")) return;
    await sleep(100);
  }
  throw new Error("page_load_timeout");
}

async function waitForExpression(expression) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      if (await cdp.evaluate(`Boolean(${expression})`)) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`expression_timeout:${expression}`);
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
  try {
    if (!targetProcess.killed) targetProcess.kill("SIGKILL");
  } catch {}
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function allExist(paths) {
  return paths.every((path) => existsSync(path));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toRepoPath(path) {
  return path.replace(`${repoRoot}\\`, "").replaceAll("\\", "/");
}
