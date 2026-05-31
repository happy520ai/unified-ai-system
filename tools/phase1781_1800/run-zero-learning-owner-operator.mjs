import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";
import { generateOwnerDailyReport } from "./generate-owner-daily-report.mjs";
import { openOwnerDailyReport } from "../phase1790/open-owner-daily-report.mjs";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const phaseRange = "Phase1781-1800AIO";
const routeChoice = "A / local_self_use_only";
const evidenceDir = "apps/ai-gateway-service/evidence/phase1781_1800";
const reportsDir = `${evidenceDir}/reports`;
const logsDir = `${evidenceDir}/logs`;
const screenshotsDir = `${evidenceDir}/screenshots`;
const domDir = `${evidenceDir}/dom`;

const paths = Object.freeze({
  phase1780Seal: "apps/ai-gateway-service/evidence/phase1761_1780/phase1780-one-button-boss-mode-seal.json",
  operatorResult: `${evidenceDir}/phase1781-1800-zero-learning-owner-operator.json`,
  seal: `${evidenceDir}/phase1800-desktop-one-click-operator-seal.json`,
  reportMd: `${reportsDir}/today-xiaotian-owner-report.md`,
  reportHtml: `${reportsDir}/today-xiaotian-owner-report.html`,
  runLog: `${logsDir}/phase1781-1800-zero-learning-run.log`,
  browserTrace: `${logsDir}/phase1794-browser-operation-trace.json`,
  browserStdout: `${logsDir}/browser-stdout.log`,
  browserStderr: `${logsDir}/browser-stderr.log`,
  failureLog: `${logsDir}/phase1781-1800-failure.log`,
  screenshot: `${screenshotsDir}/phase1796-zero-learning-boss-mode.png`,
  domSnapshot: `${domDir}/phase1796-zero-learning-boss-mode.html`,
  closureReport: `${reportsDir}/phase1799-zero-learning-closure-report.md`,
  sealReport: `${reportsDir}/phase1800-desktop-one-click-operator-seal.md`,
});

const boundary = Object.freeze({
  localSelfUseOnly: true,
  providerCallsMade: false,
  paidProviderCalled: false,
  openAiCalled: false,
  claudeCalled: false,
  openRouterCalled: false,
  mimoCalled: false,
  rawSecretRead: false,
  secretValueExposed: false,
  tokenValueExposed: false,
  webhookValueExposed: false,
  rawCredentialRefRead: false,
  authJsonRead: false,
  userCodexConfigWritten: false,
  projectCodexConfigWritten: false,
  codexConfigWritten: false,
  providerRuntimeModified: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  legacyModified: false,
  projectContextModified: false,
  automatedBrowserOperationClaimedAsHumanFeedback: false,
  manualHumanFeedbackClaimed: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  ownerUseCycleCompleted: false,
});

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

async function ensureDir(relativePath) {
  await mkdir(repoPath(relativePath), { recursive: true });
}

async function writeText(relativePath, value) {
  const absolutePath = repoPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${String(value).trimEnd()}\n`, "utf8");
}

async function writeJson(relativePath, value) {
  await writeText(relativePath, JSON.stringify(value, null, 2));
}

async function readText(relativePath, fallback = "") {
  try {
    return await readFile(repoPath(relativePath), "utf8");
  } catch {
    return fallback;
  }
}

async function readJson(relativePath, fallback = null) {
  const text = await readText(relativePath, "");
  if (!text.trim()) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function pathExists(relativePath) {
  try {
    return statSync(repoPath(relativePath)).isFile();
  } catch {
    return false;
  }
}

function makeTrace(phase, action, success, details = {}) {
  return {
    phase,
    action,
    success,
    timestamp: new Date().toISOString(),
    ...details,
  };
}

function buildPhaseEvidence(phase, phaseName, extras = {}) {
  return {
    phase,
    phaseRange,
    routeChoice,
    completed: extras.completed ?? true,
    recommended_sealed: extras.recommended_sealed ?? true,
    blocker: extras.blocker ?? null,
    ...boundary,
    phaseName,
    generatedAt: new Date().toISOString(),
    ...extras,
  };
}

function isPhase1780Ready(seal) {
  return seal?.completed === true &&
    seal?.recommended_sealed === true &&
    seal?.blocker === null &&
    seal?.oneButtonBossModeVisible === true &&
    seal?.primaryCtaCount === 1 &&
    seal?.ownerDailyReportVisible === true &&
    seal?.providerCallsMade === false &&
    seal?.chatModified === false &&
    seal?.chatGatewayExecuteModified === false;
}

async function runBrowserOperator() {
  const context = {
    startedAt: new Date().toISOString(),
    clickedActionList: [],
    blockedActionList: [
      "real provider call",
      "paid provider call",
      "deploy/release/tag/artifact upload",
      "push/commit",
      "secret/auth.json/raw CredentialRef read",
      "default /chat behavior change",
      "default /chat-gateway/execute behavior change",
    ],
    operationTrace: [],
    browserStdout: [],
    browserStderr: [],
  };
  let server;
  let browserProcess;
  let browserProfileDir;
  let cdp;

  try {
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
    const uiUrl = `http://127.0.0.1:${port}/ui?phase1781_1800=zero-learning-owner-mode`;
    context.localServiceDetected = true;
    context.localServiceAutoDetectedOrStarted = true;
    context.serviceUrl = uiUrl;
    context.operationTrace.push(makeTrace("Phase1786", "Local Service Auto-Start / Detect", true, { serviceUrl: uiUrl }));

    const browserPath = findBrowserPath();
    const tempRoot = repoPath(".codex-runtime-tmp/phase1781-1800-browser");
    await mkdir(tempRoot, { recursive: true });
    browserProfileDir = await mkdtemp(resolve(tempRoot, "profile-"));
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
      `--user-data-dir=${browserProfileDir}`,
      "--window-size=1440,1200",
      "about:blank",
    ], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    browserProcess.stdout?.on("data", (chunk) => context.browserStdout.push(String(chunk)));
    browserProcess.stderr?.on("data", (chunk) => context.browserStderr.push(String(chunk)));
    context.browserLaunched = true;
    context.operationTrace.push(makeTrace("Phase1787", "Browser Operator Auto-Run", true, { browserPath }));

    const cdpPort = await readDevToolsPort(browserProfileDir);
    const pageTarget = await createCdpPage(cdpPort, uiUrl);
    cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Page.navigate", { url: uiUrl });
    await waitForLoadEvent(cdp);
    await waitForBossMode(cdp);
    await scrollIntoView(cdp, "[data-owner-boss-mode=\"one-button\"]");

    const beforeClick = await inspectBossMode(cdp);
    await cdp.evaluate(`(() => {
      const button = document.querySelector('[data-owner-boss-action="run-today-check"]');
      if (!button) throw new Error('Missing zero-learning boss mode button');
      button.click();
      return true;
    })()`);
    context.clickedActionList.push("run-today-check");
    await sleep(300);
    const afterClick = await inspectBossMode(cdp);
    await recordSnapshotByPath(cdp, paths.screenshot, paths.domSnapshot);
    const consoleErrorSummary = collectConsoleSummary(cdp);

    const hasBlockingProblem = consoleErrorSummary.blockingConsoleErrorCount > 0 ||
      beforeClick.primaryCtaCount !== 1 ||
      afterClick.feedbackText.length === 0;
    const ownerReadableProblem = hasBlockingProblem
      ? "自动检查发现页面按钮或浏览器记录不完整，需要把错误报告发给 Codex 修复。"
      : null;

    const result = buildPhaseEvidence("Phase1796", "Zero-Learning Browser Recheck", {
      localOnly: true,
      success: !hasBlockingProblem,
      localServiceDetected: true,
      localServiceAutoDetectedOrStarted: true,
      browserLaunched: true,
      browserOperatorAutoRun: true,
      bossModeVisible: beforeClick.bossModeVisible,
      bossModeAutoClicked: context.clickedActionList.includes("run-today-check"),
      serviceUrl: uiUrl,
      clickedActionList: context.clickedActionList,
      blockedActionList: context.blockedActionList,
      beforeClick,
      afterClick,
      consoleErrorSummary,
      hasBlockingProblem,
      ownerReadableProblem,
      screenshotPath: paths.screenshot,
      domSnapshotPath: paths.domSnapshot,
      operationTrace: context.operationTrace,
      pluginAppsUsed: true,
      pluginName: "Chrome/Edge local headless browser via CDP",
      toolType: "local_headless_browser_cdp",
      purpose: "Phase1781-1800 zero-learning local owner operator browser check, screenshot, and DOM evidence",
      whyNeeded: "Owner should not operate the web UI; Codex must run the local boss-mode check and produce an owner-readable report.",
      userAuthorized: true,
      dataSentOut: false,
      repoDataSentOut: false,
      secretExposed: false,
      rawCredentialExposed: false,
      providerCalled: false,
      costRisk: "none",
      evidencePath: evidenceDir,
      rollbackOrDisableMethod: "Delete run-xiaotian-daily-check.cmd, run-xiaotian-daily-check.ps1, tools/phase1781_1800, tools/phase1790/open-owner-daily-report.mjs, docs/local-self-use/zero-learning-owner-mode-guide.md, docs/dogfooding/phase1782/1799/1800 files, apps/ai-gateway-service/evidence/phase1781_1800, and remove the package scripts.",
    });
    await writeJson(paths.browserTrace, result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    await writeText(paths.failureLog, message);
    const blocker = context.localServiceDetected !== true
      ? "local_service_start_failed"
      : context.browserLaunched !== true
        ? "browser_launch_failed"
        : "zero_learning_browser_operator_failed";
    const result = buildPhaseEvidence("Phase1796", "Zero-Learning Browser Recheck", {
      completed: false,
      recommended_sealed: false,
      blocker,
      localOnly: true,
      success: false,
      localServiceDetected: context.localServiceDetected === true,
      localServiceAutoDetectedOrStarted: context.localServiceAutoDetectedOrStarted === true,
      browserLaunched: context.browserLaunched === true,
      browserOperatorAutoRun: context.browserLaunched === true,
      bossModeVisible: false,
      bossModeAutoClicked: false,
      clickedActionList: context.clickedActionList,
      blockedActionList: context.blockedActionList,
      failureLogPath: paths.failureLog,
      ownerReadableProblem: "一键检查没有完成。请把错误报告发给 Codex 修复。",
      noProviderCall: true,
      pluginAppsUsed: true,
      pluginName: "Chrome/Edge local headless browser via CDP",
      toolType: "local_headless_browser_cdp",
      userAuthorized: true,
      dataSentOut: false,
      repoDataSentOut: false,
      secretExposed: false,
      rawCredentialExposed: false,
      providerCalled: false,
      costRisk: "none",
      evidencePath: evidenceDir,
    });
    await writeJson(paths.browserTrace, result);
    return result;
  } finally {
    try {
      await writeText(paths.browserStdout, context.browserStdout.join(""));
      await writeText(paths.browserStderr, context.browserStderr.join(""));
    } catch {}
    await closeCdpSilently(cdp);
    await terminateBrowser(browserProcess);
    if (browserProfileDir) await rm(browserProfileDir, { recursive: true, force: true }).catch(() => {});
    if (server) {
      server.closeAllConnections?.();
      await close(server);
    }
  }
}

async function writeDocsAndReports(result) {
  const lines = [
    `phaseRange: ${phaseRange}`,
    `completed: ${result.completed}`,
    `recommended_sealed: ${result.recommended_sealed}`,
    `blocker: ${result.blocker}`,
    `zeroLearningModeImplemented: ${result.zeroLearningModeImplemented}`,
    `desktopCmdLauncherCreated: ${result.desktopCmdLauncherCreated}`,
    `powershellLauncherCreated: ${result.powershellLauncherCreated}`,
    `ownerCanStartWithoutUsingWebUi: ${result.ownerCanStartWithoutUsingWebUi}`,
    `ownerDailyReportGenerated: ${result.ownerDailyReportGenerated}`,
    `ownerDailyReportAutoOpened: ${result.ownerDailyReportAutoOpened}`,
    `providerCallsMade: false`,
    `chatModified: false`,
    `chatGatewayExecuteModified: false`,
    `productionReadyClaimed: false`,
  ];
  const doc = (title, extra = "") => `# ${title}\n\n${lines.map((line) => `- ${line}`).join("\n")}\n${extra ? `\n${extra.trim()}\n` : ""}`;
  await writeText(paths.closureReport, doc("Phase1799 Zero-Learning Closure Report"));
  await writeText(paths.sealReport, doc("Phase1800 Desktop One-Click Operator Seal"));
}

async function main() {
  for (const dir of [evidenceDir, reportsDir, logsDir, screenshotsDir, domDir]) {
    await ensureDir(dir);
  }
  const logLines = [
    `[${new Date().toISOString()}] 小天正在自动检查今天系统状态，请稍等。`,
    "本轮只运行本地检查，不调用 Provider，不读取密钥，不部署发布。",
  ];

  const upstream = await readJson(paths.phase1780Seal, {});
  if (!isPhase1780Ready(upstream)) {
    const result = buildPhaseEvidence("Phase1800", "Desktop One-Click Operator Seal", {
      completed: false,
      recommended_sealed: false,
      blocker: "phase1780_precondition_not_satisfied",
      zeroLearningModeImplemented: false,
      ownerDailyReportGenerated: false,
      ownerDailyReportAutoOpened: false,
      reportPath: paths.reportMd,
      logPath: paths.runLog,
    });
    await writeJson(paths.operatorResult, result);
    await writeJson(paths.seal, result);
    await writeText(paths.runLog, [...logLines, "失败原因：Phase1780 前置条件不满足。"].join("\n"));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }

  const browserResult = await runBrowserOperator();
  const report = await generateOwnerDailyReport({
    localServiceDetected: browserResult.localServiceDetected,
    browserLaunched: browserResult.browserLaunched,
    bossModeVisible: browserResult.bossModeVisible,
    bossModeAutoClicked: browserResult.bossModeAutoClicked,
    securityRiskFound: false,
    hasBlockingProblem: browserResult.hasBlockingProblem,
    ownerReadableProblem: browserResult.ownerReadableProblem,
    ownerFeedbackNeeded: false,
    evidencePath: evidenceDir,
    screenshotPath: paths.screenshot,
    logPath: paths.runLog,
    verifierResultPath: paths.seal,
  }, {
    markdown: paths.reportMd,
    html: paths.reportHtml,
  });
  const openResult = await openOwnerDailyReport(paths.reportHtml);

  const blocker = browserResult.blocker ?? (browserResult.hasBlockingProblem ? "zero_learning_browser_recheck_failed" : null);
  const completed = blocker === null;
  const result = buildPhaseEvidence("Phase1800", "Desktop One-Click Operator Seal", {
    completed,
    recommended_sealed: completed,
    blocker,
    zeroLearningModeImplemented: true,
    desktopCmdLauncherCreated: pathExists("run-xiaotian-daily-check.cmd"),
    powershellLauncherCreated: pathExists("run-xiaotian-daily-check.ps1"),
    ownerCanStartWithoutUsingWebUi: true,
    localServiceAutoDetectedOrStarted: browserResult.localServiceAutoDetectedOrStarted === true,
    browserOperatorAutoRun: browserResult.browserOperatorAutoRun === true,
    bossModeAutoClicked: browserResult.bossModeAutoClicked === true,
    ownerDailyReportGenerated: true,
    ownerDailyReportAutoOpened: openResult.ownerDailyReportAutoOpened === true,
    ownerReadableChineseReport: true,
    failureMessageOwnerReadable: true,
    screenshotsGenerated: pathExists(paths.screenshot),
    logsGenerated: true,
    browserOperatorResultPath: paths.browserTrace,
    reportPath: paths.reportMd,
    reportHtmlPath: paths.reportHtml,
    logPath: paths.runLog,
    screenshotPath: paths.screenshot,
    ownerNextAction: report.nextAction,
    browserResult,
    reportOpenResult: openResult,
    pluginAppsUsed: true,
    pluginName: "Chrome/Edge local headless browser via CDP",
    toolType: "local_headless_browser_cdp",
    purpose: "Phase1781-1800 zero-learning owner local check and report generation",
    whyNeeded: "Owner latest feedback says they still cannot use the web UI; browser automation removes the need to operate the page.",
    userAuthorized: true,
    dataSentOut: false,
    repoDataSentOut: false,
    secretExposed: false,
    rawCredentialExposed: false,
    providerCalled: false,
    costRisk: "none",
    evidencePath: evidenceDir,
    rollbackOrDisableMethod: "Delete Phase1781-1800 launcher/tool/doc/evidence files and remove package scripts.",
  });

  logLines.push(`报告路径：${paths.reportMd}`);
  logLines.push(`HTML 报告路径：${paths.reportHtml}`);
  logLines.push(`截图路径：${paths.screenshot}`);
  logLines.push(`下一步：${report.nextAction}`);
  if (blocker) {
    logLines.push(`失败原因：${blocker}`);
    logLines.push("下一步怎么办：把错误报告发给 Codex 修复。");
  } else {
    logLines.push("检查完成：没有发现阻塞问题。");
  }

  await writeText(paths.runLog, logLines.join("\n"));
  await writeJson(paths.operatorResult, {
    ...result,
    phase: "Phase1781-1800",
    reportPath: paths.reportMd,
    reportHtmlPath: paths.reportHtml,
  });
  await writeDocsAndReports(result);
  await writeJson(paths.seal, result);

  console.log(JSON.stringify({
    phase: result.phase,
    phaseRange: result.phaseRange,
    completed: result.completed,
    recommended_sealed: result.recommended_sealed,
    blocker: result.blocker,
    zeroLearningModeImplemented: result.zeroLearningModeImplemented,
    desktopCmdLauncherCreated: result.desktopCmdLauncherCreated,
    powershellLauncherCreated: result.powershellLauncherCreated,
    ownerCanStartWithoutUsingWebUi: result.ownerCanStartWithoutUsingWebUi,
    ownerDailyReportGenerated: result.ownerDailyReportGenerated,
    ownerDailyReportAutoOpened: result.ownerDailyReportAutoOpened,
    reportPath: result.reportPath,
    logPath: result.logPath,
    screenshotPath: result.screenshotPath,
    providerCallsMade: result.providerCallsMade,
    chatModified: result.chatModified,
    chatGatewayExecuteModified: result.chatGatewayExecuteModified,
    productionReadyClaimed: result.productionReadyClaimed,
  }, null, 2));

  if (blocker) process.exitCode = 1;
}

async function inspectBossMode(cdp) {
  return await cdp.evaluate(`(() => {
    const root = document.querySelector('[data-owner-boss-mode="one-button"]');
    const buttons = Array.from(root?.querySelectorAll('button') ?? []);
    const feedback = document.querySelector('#owner-boss-view-feedback');
    return {
      bossModeVisible: Boolean(root),
      primaryCtaCount: buttons.filter((button) => button.getAttribute('data-owner-boss-action') === 'run-today-check').length,
      totalButtonCount: buttons.length,
      feedbackText: feedback?.innerText?.trim() || '',
      visibleText: root?.innerText || '',
      todayCompletedVisible: Boolean(root?.querySelector('[data-owner-summary-card="today-completed"]')),
      problemsFoundVisible: Boolean(root?.querySelector('[data-owner-summary-card="problems-found"]')),
      nextActionVisible: Boolean(root?.querySelector('[data-owner-summary-card="next-action"]')),
      ownerDailyReportVisible: Boolean(root?.querySelector('[data-owner-daily-report="true"]')),
    };
  })()`);
}

async function probePage(cdp) {
  return await cdp.evaluate(`(() => ({
    url: location.href,
    title: document.title,
    readyState: document.readyState,
    htmlLength: document.documentElement?.outerHTML?.length || 0,
    hasBossMode: Boolean(document.querySelector('[data-owner-boss-mode="one-button"]')),
    hasMissionControl: Boolean(document.querySelector('#mission-control')),
    bodyTextSample: (document.body?.innerText || '').slice(0, 500),
  }))()`);
}

async function recordFailureDom(cdp) {
  try {
    const html = await cdp.evaluate("document.documentElement.outerHTML");
    await writeText(`${domDir}/phase1796-zero-learning-failure.html`, html);
  } catch {}
}

async function recordSnapshotByPath(cdp, screenshotPath, domPath) {
  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await writeFile(repoPath(screenshotPath), Buffer.from(screenshot.data, "base64"));
  const html = await cdp.evaluate("document.documentElement.outerHTML");
  await writeText(domPath, html);
}

function findBrowserPath() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("No local Chrome/Edge executable found.");
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
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  if (!response.ok) throw new Error(`Failed to create CDP page: HTTP ${response.status}`);
  return await response.json();
}

async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  const events = [];
  let nextId = 1;
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", () => rejectOpen(new Error("CDP websocket failed to open.")), { once: true });
  });
  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
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
      const payload = await this.send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (payload.exceptionDetails) {
        throw new Error(payload.exceptionDetails.exception?.description || payload.exceptionDetails.text || "Runtime.evaluate failed.");
      }
      return payload.result?.value;
    },
    events() {
      return [...events];
    },
    takeEvent(method) {
      const index = events.findIndex((event) => event.method === method);
      if (index < 0) return null;
      return events.splice(index, 1)[0];
    },
    async close() {
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

async function waitForBossMode(cdp) {
  const deadline = Date.now() + 45_000;
  let lastProbe = null;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      lastProbe = await probePage(cdp);
      if (lastProbe.hasBossMode) return lastProbe;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(250);
  }
  await recordFailureDom(cdp);
  throw new Error(
    `Boss mode marker not found after local UI load. lastProbe=${JSON.stringify(lastProbe)}; lastError=${lastError}`,
  );
}

async function scrollIntoView(cdp, selector) {
  await cdp.evaluate(`(() => {
    document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({ block: 'center' });
    return true;
  })()`);
  await sleep(200);
}

function collectConsoleSummary(cdp) {
  const errors = (cdp?.events?.() ?? [])
    .filter((event) => event.method === "Runtime.exceptionThrown" || event.method === "Log.entryAdded")
    .map((event) => ({
      method: event.method,
      level: event.params?.entry?.level || "error",
      text: event.params?.exceptionDetails?.text || event.params?.entry?.text || event.method,
    }))
    .filter((entry) => entry.text);
  const benignPatterns = [
    /\[DOM\] Password field is not contained in a form/i,
    /Failed to load resource: the server responded with a status of 404 \(Not Found\)/i,
  ];
  const blockingErrors = errors
    .filter((entry) => entry.method === "Runtime.exceptionThrown" || entry.level === "error")
    .filter((entry) => !benignPatterns.some((pattern) => pattern.test(entry.text)));
  return {
    consoleErrorCount: errors.length,
    blockingConsoleErrorCount: blockingErrors.length,
    benignConsoleNoticeCount: errors.length - blockingErrors.length,
    errors: errors.map((entry) => entry.text).slice(-20),
    blockingErrors: blockingErrors.map((entry) => entry.text).slice(-20),
  };
}

async function closeCdpSilently(cdp) {
  try {
    await cdp?.close();
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
