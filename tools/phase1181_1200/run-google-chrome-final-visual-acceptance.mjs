import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { buildSafetyFields, buildTokenSavingFields, chromeScreenshotsDir, evidenceDir } from "./phase1181-common.mjs";

const repoRoot = process.cwd();
const resultPath = resolve(evidenceDir, "google-chrome-final-visual-acceptance-result.json");
const screenshotPaths = {
  initial: resolve(chromeScreenshotsDir, "initial-screen.png"),
  afterInput: resolve(chromeScreenshotsDir, "after-input.png"),
  afterPreview: resolve(chromeScreenshotsDir, "after-preview.png"),
  detailsCollapsed: resolve(chromeScreenshotsDir, "details-collapsed.png"),
  detailsExpanded: resolve(chromeScreenshotsDir, "details-expanded.png"),
  responsive1440: resolve(chromeScreenshotsDir, "responsive-1440.png"),
  responsive1024: resolve(chromeScreenshotsDir, "responsive-1024.png"),
  responsive768: resolve(chromeScreenshotsDir, "responsive-768.png")
};

let serviceStartedByScript = false;
let chromeProcess;
let chromeProfileDir;
let cdp;

const chromePath = findChromePath();
const result = {
  phaseRange: "Phase1181-1200",
  completed: false,
  recommended_sealed: false,
  blocker: null,
  googleChromeRequired: true,
  googleChromeAvailable: Boolean(chromePath),
  chromeBrowserUsed: false,
  chromeExecutablePath: chromePath || null,
  chromeVersionCaptured: false,
  chromeUserAgentCaptured: false,
  targetUrl: "http://127.0.0.1:3100/ui#future-minimal-os-panel",
  workbenchReachable: false,
  screenshots: Object.fromEntries(Object.entries(screenshotPaths).map(([key, value]) => [key, toRepoPath(value)])),
  ...buildTokenSavingFields(),
  ...buildSafetyFields()
};

try {
  mkdirSync(chromeScreenshotsDir, { recursive: true });
  if (!chromePath) {
    Object.assign(result, {
      completed: true,
      recommended_sealed: false,
      blocker: "google_chrome_not_available"
    });
  } else {
    const acceptance = await runChromeAcceptance(chromePath);
    Object.assign(result, acceptance);
    result.completed = true;
    result.recommended_sealed = acceptance.chromeVisualAssertionsPassed && acceptance.chromeScreenshotsGenerated;
    result.blocker = result.recommended_sealed ? null : "final_visual_acceptance_failed";
  }
} catch (error) {
  result.completed = true;
  result.recommended_sealed = false;
  result.blocker = classifyError(error);
} finally {
  await closeCdpSilently(cdp);
  await terminateBrowser(chromeProcess);
  if (chromeProfileDir) await rm(chromeProfileDir, { recursive: true, force: true }).catch(() => {});
  writeJson(resultPath, result);
  console.log(JSON.stringify({
    completed: result.completed,
    recommended_sealed: result.recommended_sealed,
    blocker: result.blocker,
    chromeBrowserUsed: result.chromeBrowserUsed,
    chromeScreenshotsGenerated: result.chromeScreenshotsGenerated
  }, null, 2));
  if (!result.recommended_sealed) process.exitCode = 1;
}

async function runChromeAcceptance(executablePath) {
  await ensureWorkbenchService();
  const url = "http://127.0.0.1:3100/ui#future-minimal-os-panel";
  result.targetUrl = url;

  chromeProfileDir = await mkdtemp(resolve(tmpdir(), "phase1181-google-chrome-"));
  chromeProcess = spawn(executablePath, [
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
    `--user-data-dir=${chromeProfileDir}`,
    "--window-size=1536,1024",
    "about:blank"
  ], { cwd: repoRoot, stdio: "ignore" });

  const cdpPort = await readDevToolsPort(chromeProfileDir);
  const browserVersion = await fetch(`http://127.0.0.1:${cdpPort}/json/version`).then((response) => response.json());
  const pageTarget = await createCdpPage(cdpPort, url);
  cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  await setViewport(1536, 1024);
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
  await setViewport(1440, 1000);
  await capture(screenshotPaths.responsive1440);
  await setViewport(1024, 1000);
  await capture(screenshotPaths.responsive1024);
  await setViewport(768, 1000);
  await capture(screenshotPaths.responsive768);
  await setViewport(1536, 1024);

  const inspection = await inspectPage();
  const assertions = buildAssertions(inspection);
  const chromeScreenshotsGenerated = allExist(Object.values(screenshotPaths));
  const chromeVisualAssertionsPassed = Object.entries(assertions).every(([key, value]) => key.includes("Detected") || key.includes("Visible") ? value === false : value === true);

  return {
    googleChromeAvailable: true,
    chromeBrowserUsed: /Google Chrome|Chrome\//.test(browserVersion.Browser || browserVersion["User-Agent"] || ""),
    chromeExecutablePath: executablePath,
    chromeVersionCaptured: Boolean(browserVersion.Browser),
    chromeVersion: browserVersion.Browser || null,
    chromeUserAgentCaptured: Boolean(browserVersion["User-Agent"] || inspection.userAgent),
    chromeUserAgent: browserVersion["User-Agent"] || inspection.userAgent || null,
    localServiceStartedByScript: serviceStartedByScript,
    workbenchReachable: inspection.panelPresent,
    initialScreenCaptured: existsSync(screenshotPaths.initial),
    afterInputCaptured: existsSync(screenshotPaths.afterInput),
    afterPreviewCaptured: existsSync(screenshotPaths.afterPreview),
    detailsCollapsedCaptured: existsSync(screenshotPaths.detailsCollapsed),
    detailsExpandedCaptured: existsSync(screenshotPaths.detailsExpanded),
    responsive1440Captured: existsSync(screenshotPaths.responsive1440),
    responsive1024Captured: existsSync(screenshotPaths.responsive1024),
    responsive768Captured: existsSync(screenshotPaths.responsive768),
    ...assertions,
    chromeScreenshotsGenerated,
    chromeVisualAssertionsPassed
  };
}

function buildAssertions(inspection) {
  const dangerousButtonDetected = inspection.buttonTexts
    .map((text) => text.toLowerCase())
    .some((text) => ["deploy", "release", "tag", "artifact upload", "production enable", "read secret", "print api key", "????", "??", "??"].some((term) => text.includes(term)));
  return {
    firstScreenFeelsLikeFutureMinimalOS: inspection.panelText.includes("Mission Control")
      && inspection.hasCommandSurface
      && inspection.hasReferenceGrid
      && inspection.homePanelVisible
      && inspection.composerPanelVisible
      && inspection.recommendationPanelVisible
      && inspection.executionPanelVisible
      && inspection.detailsPanelVisible
      && inspection.oldWorkbenchSidebarVisible === false
      && inspection.oldWorkbenchTopbarVisible === false
      && inspection.chatHeroVisible === false
      && inspection.firstViewportUtilityNoiseVisible === false
      && inspection.statusDockVisible === false,
    oldWorkbenchFeelingReduced: inspection.hasRail && inspection.oldWorkbenchSidebarVisible === false && inspection.oldWorkbenchTopbarVisible === false && inspection.statusDockVisible === false,
    leftSidebarHeavyLookRemoved: inspection.railNestedInHome === true && inspection.oldWorkbenchSidebarVisible === false && inspection.railLabelCount >= 5,
    missionInputProminent: inspection.hasMissionInput && inspection.commandSurfaceHeight >= 124 && inspection.composerPanelRect.height >= 360,
    singlePrimaryCtaPresent: inspection.primaryCtaCount === 1,
    threeModeCardsClear: inspection.modeCount === 3,
    bottomStatusDockClean: inspection.statusDockVisible === false && inspection.detailsPanelVisible && inspection.executionPanelVisible,
    floatingNoiseRemoved: !inspection.fixedFloatingNoiseVisible && !/Yiyi|avatar|companion|character|\u4f9d\u4f9d/.test(inspection.bodyText),
    providerEvidenceDiagnosticsCollapsedByDefault: inspection.providerNestedOpen === false && inspection.evidenceNestedOpen === false && inspection.diagnosticsNestedOpen === false,
    dangerousActionButtonDetected: dangerousButtonDetected,
    misleadingProductionCopyDetected: /(\u5df2\u4e0a\u7ebf|\u751f\u4ea7\u542f\u7528\u6210\u529f|production enabled|production is enabled)/i.test(inspection.bodyText),
    characterModuleVisible: /Yiyi|avatar|companion|character|\u4f9d\u4f9d/.test(inspection.bodyText)
  };
}

function findChromePath() {
  return [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ].find((candidate) => existsSync(candidate)) || null;
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
    const panel = document.getElementById('future-minimal-os-panel');
    const rail = document.querySelector('.future-os-rail');
    const command = document.querySelector('.future-command-surface');
    const isVisible = (node) => {
      if (!node) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 1 && rect.height > 1;
    };
    const intersectsViewport = (node) => {
      if (!isVisible(node)) return false;
      const rect = node.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
    };
    const fixedNoise = Array.from(document.querySelectorAll('body *')).filter((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      if (style.position !== 'fixed' || !isVisible(node)) return false;
      if (node.id === 'future-os-details-panel') return false;
      if (node.classList.contains('toast')) return false;
      return rect.width > 24 && rect.height > 24;
    });
    const provider = document.getElementById('future-provider-credential-module')?.closest('details');
    const evidence = document.getElementById('future-evidence-replay-module')?.closest('details');
    const diagnostics = document.getElementById('future-diagnostics-module')?.closest('details');
    const utilityStrip = document.querySelector('.future-local-utility-strip');
    return {
      userAgent: navigator.userAgent,
      panelPresent: Boolean(panel),
      panelText: panel?.innerText || '',
      bodyText: document.body.innerText || '',
      primaryCtaCount: document.querySelectorAll('[data-primary-cta="true"]').length,
      modeCount: document.querySelectorAll('.future-mode-choice').length,
      hasRail: Boolean(rail),
      railWidth: rail?.getBoundingClientRect().width || 999,
      hasMissionInput: Boolean(document.querySelector('[data-future-mission-input="true"]')),
      hasCommandSurface: Boolean(command),
      commandSurfaceHeight: command?.getBoundingClientRect().height || 0,
      hasStatusDock: Boolean(document.querySelector('[data-system-status-dock="true"]')),
      statusDockText: document.querySelector('[data-system-status-dock="true"]')?.innerText || '',
      statusDockLabels: Array.from(document.querySelectorAll('[data-system-status-dock="true"] span')).map((node) => node.textContent || ''),
      statusDockItemCount: document.querySelectorAll('[data-system-status-dock="true"] > div').length,
      oldWorkbenchSidebarVisible: isVisible(document.querySelector('.sidebar')),
      oldWorkbenchTopbarVisible: isVisible(document.querySelector('.topbar')),
      chatHeroVisible: intersectsViewport(document.querySelector('.chat-hero')),
      firstViewportUtilityNoiseVisible: intersectsViewport(utilityStrip),
      fixedFloatingNoiseVisible: fixedNoise.length > 0,
      fixedFloatingNoiseCount: fixedNoise.length,
      providerNestedOpen: Boolean(provider?.open),
      evidenceNestedOpen: Boolean(evidence?.open),
      diagnosticsNestedOpen: Boolean(diagnostics?.open),
      buttonTexts: Array.from(document.querySelectorAll('button')).map((button) => button.innerText || button.getAttribute('aria-label') || '')
      ,
      hasReferenceGrid: Boolean(document.querySelector('.future-first-screen[data-reference-layout="mission-control-os"]')),
      homePanelVisible: intersectsViewport(document.querySelector('.future-home-panel')),
      composerPanelVisible: intersectsViewport(document.querySelector('.future-composer-panel')),
      recommendationPanelVisible: intersectsViewport(document.querySelector('.future-recommendation-showcase')),
      executionPanelVisible: intersectsViewport(document.querySelector('.future-execution-panel')),
      detailsPanelVisible: intersectsViewport(document.querySelector('.future-details-accordion')),
      statusDockVisible: intersectsViewport(document.querySelector('[data-system-status-dock="true"]')),
      railLabelCount: document.querySelectorAll('.future-rail-label').length,
      railNestedInHome: Boolean(document.querySelector('.future-home-panel .future-os-rail')),
      composerPanelRect: (() => {
        const rect = document.querySelector('.future-composer-panel')?.getBoundingClientRect();
        return rect ? { width: rect.width, height: rect.height } : { width: 0, height: 0 };
      })()
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

async function ensureWorkbenchService() {
  if (await canReachFutureWorkbench()) return;
  await runCommand(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["stop:phase9c"], 45_000, { allowFailure: true });
  await runCommand(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["dev:phase7b"], 45_000);
  serviceStartedByScript = true;
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (await canReachWorkbench()) return;
    await sleep(1000);
  }
  throw new Error("workbench_ui_not_reachable_in_google_chrome");
}

async function canReachFutureWorkbench() {
  try {
    const response = await fetch("http://127.0.0.1:3100/ui", { method: "GET" });
    if (!response.ok) return false;
    const html = await response.text();
    return html.includes("Mission Control OS") && html.includes("future-command-surface");
  } catch {
    return false;
  }
}

async function canReachWorkbench() {
  try {
    const response = await fetch("http://127.0.0.1:3100/ui", { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}

function runCommand(command, args, timeoutMs, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "ignore",
      env: {
        ...process.env,
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
        AI_GATEWAY_PROVIDER_MODE: "fake"
      }
    });
    const timeout = setTimeout(() => {
      child.kill();
      rejectRun(new Error(`command_timeout:${command} ${args.join(" ")}`));
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timeout);
      rejectRun(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolveRun();
      else if (options.allowFailure) resolveRun();
      else rejectRun(new Error(`command_failed:${command} ${args.join(" ")}:${code}`));
    });
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
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
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
  throw new Error("workbench_ui_not_reachable_in_google_chrome");
}

async function waitForExpression(expression) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      if (await cdp.evaluate(`Boolean(${expression})`)) return;
    } catch {}
    await sleep(100);
  }
  throw new Error("google_chrome_screenshot_acceptance_failed");
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

function classifyError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("not_available")) return "google_chrome_not_available";
  if (message.includes("not_reachable")) return "workbench_ui_not_reachable_in_google_chrome";
  if (message.includes("screenshot")) return "google_chrome_screenshot_acceptance_failed";
  return "final_visual_acceptance_failed";
}

function allExist(paths) {
  return paths.every((path) => existsSync(path));
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toRepoPath(path) {
  return path.replace(`${repoRoot}\\`, "").replaceAll("\\", "/");
}
