import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";
import { readJson, writeJson } from "../phase632-common.mjs";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const previousEvidencePath = "apps/ai-gateway-service/evidence/phase1885a-owner-os-file-action-result-integration.json";
const evidencePath = "apps/ai-gateway-service/evidence/phase1886a-owner-os-file-action-visual-smoke.json";
const screenshotPath = "apps/ai-gateway-service/evidence/phase1886a/screenshots/owner-os-file-action-result.png";
const domSnapshotPath = "apps/ai-gateway-service/evidence/phase1886a/owner-os-file-action-result.html";
const failureLogPath = "apps/ai-gateway-service/evidence/phase1886a/owner-os-file-action-visual-smoke-failure.log";

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
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

async function ensureDirs() {
  await mkdir(dirname(repoPath(screenshotPath)), { recursive: true });
  await mkdir(dirname(repoPath(domSnapshotPath)), { recursive: true });
  await mkdir(dirname(repoPath(failureLogPath)), { recursive: true });
}

function previousPhaseReady(data) {
  return data.completed === true &&
    data.recommended_sealed === true &&
    data.blocker === null &&
    data.ownerOsShowsFileActionResult === true &&
    data.bossDailyReportIncludesFileAction === true &&
    data.createdFilePathVisible === true &&
    typeof data.displayedFilePath === "string" &&
    data.displayedFilePath.length > 0;
}

async function main() {
  let server;
  let browserProcess;
  let profileDir;
  let cdp;
  const stdout = [];
  const stderr = [];

  const previousEvidence = readJson(previousEvidencePath).data ?? {};
  const expectedFilePath = previousEvidence.displayedFilePath ?? "";
  const expectedBossDailyLine = `今天小天为你创建了桌面表格：${expectedFilePath}。`;

  try {
    await ensureDirs();
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
    const uiUrl = `http://127.0.0.1:${port}/ui?phase1886a=file-action-visual-smoke`;

    const browserPath = findBrowserPath();
    const tempRoot = repoPath(".codex-runtime-tmp/phase1886a-browser");
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
      "--window-size=1440,1300",
      "about:blank",
    ], { cwd: repoPath("."), stdio: ["ignore", "pipe", "pipe"] });
    browserProcess.stdout?.on("data", (chunk) => stdout.push(String(chunk)));
    browserProcess.stderr?.on("data", (chunk) => stderr.push(String(chunk)));

    const cdpPort = await readDevToolsPort(profileDir);
    const pageTarget = await createCdpPage(cdpPort, uiUrl);
    cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.navigate", { url: uiUrl });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, "document.querySelector('[data-owner-os-shell=\"true\"]')");
    await cdp.evaluate("document.querySelector('[data-owner-os-shell=\"true\"]').scrollIntoView({ block: 'start' })");

    const inspection = await cdp.evaluate(`(() => {
      const expectedFilePath = ${JSON.stringify(expectedFilePath)};
      const expectedBossDailyLine = ${JSON.stringify(expectedBossDailyLine)};
      const root = document.querySelector('[data-owner-os-shell="true"]');
      const card = root?.querySelector('[data-owner-automation-result-card="true"]');
      const report = root?.querySelector('[data-owner-daily-report-surface="true"]');
      const bodyText = document.body?.innerText || '';
      const rootText = root?.innerText || '';
      const cardText = card?.innerText || '';
      const reportText = report?.innerText || '';
      const bulkSelectors = [
        '[data-bulk-file-action]',
        '[data-owner-bulk-file-action]',
        '[data-desktop-bulk-file-action]'
      ];
      const desktopListSelectors = [
        '[data-desktop-file-list]',
        '[data-owner-desktop-file-list]',
        '[data-file-browser="desktop"]'
      ];
      return {
        uiOpened: Boolean(document.querySelector('[data-workbench-root="phase372-workbench-root"]')),
        ownerOsOpened: Boolean(root),
        fileActionResultCardVisible: Boolean(card),
        createdFilePathVisible: rootText.includes(expectedFilePath),
        fileOpenedStatusVisible: rootText.includes('状态：已创建，并已尝试自动打开'),
        noOverwriteStatusVisible: rootText.includes('安全：没有覆盖已有文件，没有读取桌面其他文件'),
        evidenceLinkVisible: rootText.includes('phase1884a-create-desktop-spreadsheet-real-action.json') ||
          rootText.includes('phase1885a-owner-os-file-action-result-integration.json'),
        bossDailyReportFileActionVisible: reportText.includes(expectedBossDailyLine),
        desktopFileListVisible: desktopListSelectors.some((selector) => document.querySelector(selector)) ||
          /桌面文件列表|desktop file list/i.test(bodyText),
        bulkFileActionVisible: bulkSelectors.some((selector) => document.querySelector(selector)) ||
          /批量文件|批量创建|批量操作|bulk file/i.test(bodyText),
        cardText,
        reportText,
        rootText,
      };
    })()`);

    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(repoPath(screenshotPath), Buffer.from(screenshot.data, "base64"));
    const domSnapshot = await cdp.evaluate("document.documentElement.outerHTML");
    await writeFile(repoPath(domSnapshotPath), domSnapshot, "utf8");

    const completed = previousPhaseReady(previousEvidence) &&
      inspection.uiOpened === true &&
      inspection.ownerOsOpened === true &&
      inspection.fileActionResultCardVisible === true &&
      inspection.createdFilePathVisible === true &&
      inspection.fileOpenedStatusVisible === true &&
      inspection.noOverwriteStatusVisible === true &&
      inspection.evidenceLinkVisible === true &&
      inspection.bossDailyReportFileActionVisible === true &&
      inspection.desktopFileListVisible === false &&
      inspection.bulkFileActionVisible === false;

    const result = {
      phase: "Phase1886A",
      routeChoice: "Route A / local_self_use_only",
      completed,
      recommended_sealed: completed,
      blocker: completed ? null : "phase1886a_owner_os_file_action_visual_smoke_failed",
      previousPhaseReady: previousPhaseReady(previousEvidence),
      sourceEvidencePath: previousEvidencePath,
      evidencePath,
      serviceUrl: uiUrl,
      uiOpened: inspection.uiOpened === true,
      ownerOsOpened: inspection.ownerOsOpened === true,
      fileActionResultCardVisible: inspection.fileActionResultCardVisible === true,
      displayedFilePath: expectedFilePath,
      createdFilePathVisible: inspection.createdFilePathVisible === true,
      fileOpenedStatusVisible: inspection.fileOpenedStatusVisible === true,
      noOverwriteStatusVisible: inspection.noOverwriteStatusVisible === true,
      evidenceLinkVisible: inspection.evidenceLinkVisible === true,
      bossDailyReportFileActionVisible: inspection.bossDailyReportFileActionVisible === true,
      desktopFileListVisible: inspection.desktopFileListVisible === true,
      bulkFileActionVisible: inspection.bulkFileActionVisible === true,
      newFileCreated: false,
      desktopScanPerformed: false,
      desktopOtherFilesRead: false,
      readExistingDesktopFiles: false,
      deletedFiles: false,
      movedFiles: false,
      overwrittenFiles: false,
      screenshotPath,
      screenshotsPath: "apps/ai-gateway-service/evidence/phase1886a/screenshots",
      domSnapshotPath,
      inspection,
      providerCallsMade: false,
      rawSecretRead: false,
      authJsonRead: false,
      rawCredentialRefRead: false,
      legacyModified: false,
      legacyScriptsExecuted: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      deployExecuted: false,
      releaseExecuted: false,
      tagCreated: false,
      artifactUploaded: false,
      pushExecuted: false,
      commitCreated: false,
      productionReadyClaimed: false,
      workspaceCleanClaimed: false,
      pluginAppUsageAudit: {
        pluginAppsUsed: true,
        pluginName: "Chrome/Edge local headless browser via CDP",
        toolType: "local_headless_browser_cdp",
        purpose: "Phase1886A Owner OS file action result visual smoke",
        dataSentOut: false,
        repoDataSentOut: false,
        secretExposed: false,
        rawCredentialExposed: false,
        providerCalled: false,
        costRisk: "none",
        evidencePath,
      },
    };
    await writeJson(evidencePath, result);
    console.log(JSON.stringify(result, null, 2));
    if (!completed) process.exitCode = 1;
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    await ensureDirs();
    await writeFile(repoPath(failureLogPath), message, "utf8");
    const result = {
      phase: "Phase1886A",
      routeChoice: "Route A / local_self_use_only",
      completed: false,
      recommended_sealed: false,
      blocker: "phase1886a_owner_os_file_action_visual_smoke_failed",
      sourceEvidencePath: previousEvidencePath,
      evidencePath,
      failureLogPath,
      newFileCreated: false,
      desktopScanPerformed: false,
      desktopOtherFilesRead: false,
      providerCallsMade: false,
      rawSecretRead: false,
      authJsonRead: false,
      rawCredentialRefRead: false,
      legacyModified: false,
      legacyScriptsExecuted: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      deployExecuted: false,
      releaseExecuted: false,
      tagCreated: false,
      artifactUploaded: false,
      pushExecuted: false,
      commitCreated: false,
      productionReadyClaimed: false,
      workspaceCleanClaimed: false,
    };
    await writeJson(evidencePath, result);
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
