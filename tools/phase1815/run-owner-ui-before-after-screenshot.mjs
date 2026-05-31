import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const evidenceDir = "apps/ai-gateway-service/evidence/phase1801_1820";
const screenshotsDir = `${evidenceDir}/screenshots`;
const domDir = `${evidenceDir}/dom`;
const paths = Object.freeze({
  result: `${evidenceDir}/phase1815-before-after-screenshot-pack.json`,
  beforeScreenshot: "apps/ai-gateway-service/evidence/phase1781_1800/screenshots/phase1796-zero-learning-boss-mode.png",
  afterScreenshot: `${screenshotsDir}/phase1815-owner-home-after.png`,
  afterDom: `${domDir}/phase1815-owner-home-after.html`,
  failureLog: `${evidenceDir}/phase1815-browser-failure.log`,
});

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

async function writeText(relativePath, value) {
  const absolute = repoPath(relativePath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, `${String(value).trimEnd()}\n`, "utf8");
}

async function pathExists(relativePath) {
  try {
    await readFile(repoPath(relativePath));
    return true;
  } catch {
    return false;
  }
}

function findBrowserPath() {
  const candidates = [
    process.env.PME_BROWSER_PATH,
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("No local Chrome/Edge executable found.");
  return found;
}

async function main() {
  let server;
  let browserProcess;
  let profileDir;
  let cdp;
  try {
    await mkdir(repoPath(screenshotsDir), { recursive: true });
    await mkdir(repoPath(domDir), { recursive: true });
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
    const port = server.address().port;
    const uiUrl = `http://127.0.0.1:${port}/ui?phase1801_1820=owner-ui-design-polish`;

    const browserPath = findBrowserPath();
    const tempRoot = repoPath(".codex-runtime-tmp/phase1801-1820-browser");
    await mkdir(tempRoot, { recursive: true });
    profileDir = await mkdtemp(resolve(tempRoot, "profile-"));
    browserProcess = spawn(browserPath, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-default-apps",
      "--disable-component-update",
      "--disable-crash-reporter",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "--window-size=1440,1180",
      "about:blank",
    ], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });

    const cdpPort = await readDevToolsPort(profileDir);
    const pageTarget = await createCdpPage(cdpPort, uiUrl);
    cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.navigate", { url: uiUrl });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, "document.querySelector('[data-owner-boss-mode=\"one-button\"]')");
    await cdp.evaluate("document.querySelector('[data-owner-boss-mode=\"one-button\"]').scrollIntoView({block:'start'})");

    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(repoPath(paths.afterScreenshot), Buffer.from(screenshot.data, "base64"));
    const dom = await cdp.evaluate("document.documentElement.outerHTML");
    await writeText(paths.afterDom, dom);

    const inspection = await cdp.evaluate(`(() => {
      const root = document.querySelector('[data-owner-boss-mode="one-button"]');
      return {
        ownerHomeVisible: Boolean(root),
        primaryCtaCount: root ? root.querySelectorAll('[data-owner-boss-action="run-today-check"]').length : 0,
        threeCoreCardsVisible: root ? ['today-completed','problems-found','next-action'].every((id) => root.querySelector('[data-owner-summary-card="' + id + '"]')) : false,
        advancedModeCollapsed: Boolean(document.querySelector('#owner-advanced-system-details:not([open])')),
        visibleText: root?.innerText || '',
      };
    })()`);

    const result = {
      phase: "Phase1815",
      phaseRange: "Phase1801-1820AIO",
      completed: inspection.ownerHomeVisible && inspection.primaryCtaCount === 1 && inspection.threeCoreCardsVisible,
      recommended_sealed: inspection.ownerHomeVisible && inspection.primaryCtaCount === 1 && inspection.threeCoreCardsVisible,
      blocker: inspection.ownerHomeVisible && inspection.primaryCtaCount === 1 && inspection.threeCoreCardsVisible ? null : "owner_ui_screenshot_validation_failed",
      beforeScreenshotPath: paths.beforeScreenshot,
      afterScreenshotPath: paths.afterScreenshot,
      domSnapshotPath: paths.afterDom,
      serviceUrl: uiUrl,
      inspection,
      pluginAppsUsed: true,
      pluginName: "Chrome/Edge local headless browser via CDP",
      toolType: "local_headless_browser_cdp",
      purpose: "Phase1815 owner UI before/after screenshot validation",
      dataSentOut: false,
      repoDataSentOut: false,
      secretExposed: false,
      rawCredentialExposed: false,
      providerCalled: false,
      costRisk: "none",
      evidencePath: evidenceDir,
    };
    await writeText(paths.result, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    if (result.blocker) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    await writeText(paths.failureLog, message);
    const result = {
      phase: "Phase1815",
      phaseRange: "Phase1801-1820AIO",
      completed: false,
      recommended_sealed: false,
      blocker: "owner_ui_screenshot_failed",
      failureLogPath: paths.failureLog,
      providerCallsMade: false,
      rawSecretRead: false,
      authJsonRead: false,
      rawCredentialRefRead: false,
      pluginAppsUsed: true,
      pluginName: "Chrome/Edge local headless browser via CDP",
      toolType: "local_headless_browser_cdp",
      dataSentOut: false,
      repoDataSentOut: false,
      secretExposed: false,
      rawCredentialExposed: false,
      providerCalled: false,
      evidencePath: evidenceDir,
    };
    await writeText(paths.result, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  } finally {
    await closeCdpSilently(cdp);
    await terminateBrowser(browserProcess);
    if (profileDir) await rm(profileDir, { recursive: true, force: true }).catch(() => {});
    if (server) {
      server.closeAllConnections?.();
      await close(server);
    }
  }
}

async function readDevToolsPort(profileDir) {
  const activePortFile = resolve(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const text = await readFile(activePortFile, "utf8");
      const [port] = text.trim().split(/\r?\n/);
      if (port) return Number(port);
    } catch {}
    await sleep(100);
  }
  throw new Error("Timed out waiting for DevToolsActivePort.");
}

async function createCdpPage(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`Failed to create CDP page: HTTP ${response.status}`);
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
    const payload = JSON.parse(String(event.data));
    if (payload.id && pending.has(payload.id)) {
      const { resolve: resolvePending, reject } = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) reject(new Error(payload.error.message));
      else resolvePending(payload.result ?? payload);
      return;
    }
    if (payload.method) events.push(payload);
  });
  return {
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolveSend, rejectSend) => pending.set(id, { resolve: resolveSend, reject: rejectSend }));
    },
    async evaluate(expression) {
      const payload = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (payload.exceptionDetails) {
        throw new Error(payload.exceptionDetails.exception?.description || payload.exceptionDetails.text || "Runtime.evaluate failed.");
      }
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

async function waitForLoadEvent(cdp) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (cdp.takeEvent("Page.loadEventFired")) return;
    await sleep(100);
  }
  throw new Error("Timed out waiting for page load.");
}

async function waitForExpression(cdp, expression) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      if (await cdp.evaluate(`Boolean(${expression})`)) return;
    } catch {}
    await sleep(100);
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

async function closeCdpSilently(cdp) {
  try {
    await cdp?.close?.();
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

await main();
