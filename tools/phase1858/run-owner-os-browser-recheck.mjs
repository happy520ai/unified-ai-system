import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";
import {
  boundary,
  evidenceDir,
  evidencePaths,
  repoPath,
  writeJson,
  writeText,
} from "../phase1841_1860/phase1860-common.mjs";

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
    await mkdir(dirname(repoPath(evidencePaths.screenshot)), { recursive: true });
    await mkdir(dirname(repoPath(evidencePaths.domSnapshot)), { recursive: true });
    await mkdir(dirname(repoPath(evidencePaths.browserRecheck)), { recursive: true });

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
    const uiUrl = `http://127.0.0.1:${port}/ui?phase1841_1860=owner-os`;

    const browserPath = findBrowserPath();
    const tempRoot = repoPath(".codex-runtime-tmp/phase1841-1860-browser");
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
      "--window-size=1440,1200",
      "about:blank",
    ], { cwd: repoPath("."), stdio: ["ignore", "pipe", "pipe"] });

    const cdpPort = await readDevToolsPort(profileDir);
    const pageTarget = await createCdpPage(cdpPort, uiUrl);
    cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.navigate", { url: uiUrl });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, "document.querySelector('[data-owner-os-shell=\"true\"]')");
    await cdp.evaluate("document.querySelector('[data-owner-os-shell=\"true\"]').scrollIntoView({block:'start'})");

    const clickResult = await cdp.evaluate(`(() => {
      const button = document.querySelector('[data-owner-boss-action="run-today-check"]');
      button?.click();
      const root = document.querySelector('[data-owner-os-shell="true"]');
      return {
        buttonClicked: Boolean(button),
        feedbackText: document.querySelector('#owner-boss-view-feedback')?.textContent?.trim() || '',
        actionLogText: document.querySelector('[data-owner-action-log]')?.textContent?.trim() || '',
        visibleText: root?.innerText || '',
      };
    })()`);

    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(repoPath(evidencePaths.screenshot), Buffer.from(screenshot.data, "base64"));
    const dom = await cdp.evaluate("document.documentElement.outerHTML");
    await writeText(evidencePaths.domSnapshot, dom);

    const inspection = await cdp.evaluate(`(() => {
      const root = document.querySelector('[data-owner-os-shell="true"]');
      return {
        ownerOsVisible: Boolean(root),
        primaryCtaCount: root ? root.querySelectorAll('[data-owner-boss-action="run-today-check"]').length : 0,
        threeCardsVisible: root ? ['today-completed','problems-found','next-action'].every((id) => root.querySelector('[data-owner-summary-card="' + id + '"]')) : false,
        reportSurfaceVisible: Boolean(root?.querySelector('[data-owner-daily-report-surface="true"]')),
        advancedModeCollapsed: Boolean(document.querySelector('#owner-advanced-system-details:not([open])')),
        forbiddenOwnerTextVisible: root ? /Phase\\d+|verifier|trace|raw evidence path|CredentialRef|Provider Gate|\\bDOM\\b|\\bJSON\\b|token budget|regression matrix/i.test(root.innerText) : true,
      };
    })()`);

    const completed = inspection.ownerOsVisible &&
      inspection.primaryCtaCount === 1 &&
      inspection.threeCardsVisible &&
      inspection.reportSurfaceVisible &&
      inspection.advancedModeCollapsed &&
      inspection.forbiddenOwnerTextVisible === false &&
      clickResult.buttonClicked &&
      clickResult.feedbackText.length > 0;

    const result = {
      phase: "Phase1858",
      phaseRange: "Phase1841-1860AIO",
      completed,
      recommended_sealed: completed,
      blocker: completed ? null : "owner_os_browser_recheck_failed",
      ...boundary,
      serviceUrl: uiUrl,
      screenshotPath: evidencePaths.screenshot,
      domSnapshotPath: evidencePaths.domSnapshot,
      inspection,
      clickResult,
      pluginAppUsageAudit: {
        pluginAppsUsed: true,
        pluginName: "Chrome/Edge local headless browser via CDP",
        toolType: "local_headless_browser_cdp",
        purpose: "Phase1858 Owner OS screenshot and DOM recheck",
        dataSentOut: false,
        repoDataSentOut: false,
        secretExposed: false,
        rawCredentialExposed: false,
        providerCalled: false,
        costRisk: "none",
        evidencePath: evidenceDir,
      },
    };
    await writeJson(evidencePaths.browserRecheck, result);
    console.log(JSON.stringify(result, null, 2));
    if (!completed) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    await writeText(evidencePaths.failureLog, message);
    const result = {
      phase: "Phase1858",
      phaseRange: "Phase1841-1860AIO",
      completed: false,
      recommended_sealed: false,
      blocker: "owner_os_browser_recheck_failed",
      ...boundary,
      failureLogPath: evidencePaths.failureLog,
      pluginAppUsageAudit: {
        pluginAppsUsed: true,
        pluginName: "Chrome/Edge local headless browser via CDP",
        toolType: "local_headless_browser_cdp",
        purpose: "Phase1858 Owner OS screenshot and DOM recheck",
        dataSentOut: false,
        repoDataSentOut: false,
        secretExposed: false,
        rawCredentialExposed: false,
        providerCalled: false,
        costRisk: "none",
        evidencePath: evidenceDir,
      },
    };
    await writeJson(evidencePaths.browserRecheck, result);
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

