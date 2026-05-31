import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";
import {
  boundary,
  containsSecretLikeValue,
  designKnowledgePaths,
  ensureEvidenceDirs,
  evidenceDir,
  evidencePaths,
  hasForbiddenOwnerJargon,
  isDirectRun,
  launcherPaths,
  phaseRange,
  readJson,
  readText,
  repoPath,
  routeChoice,
  upstreamPaths,
  writeJson,
  writeText,
} from "./phase1880-common.mjs";

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

function launcherExists() {
  return existsSync(repoPath(launcherPaths.cmd)) && existsSync(repoPath(launcherPaths.powershell));
}

async function readDesignKnowledge() {
  const entries = [];
  for (const path of designKnowledgePaths) {
    entries.push({ path, textLength: (await readText(path)).trim().length });
  }
  return entries;
}

function phase1860Ready(seal) {
  return seal.completed === true &&
    seal.recommended_sealed === true &&
    seal.blocker === null &&
    seal.checks?.ownerOsShellImplemented === true &&
    seal.checks?.primaryCtaCountOne === true &&
    seal.checks?.todayCompletedCardVisible === true &&
    seal.checks?.problemSignalCardVisible === true &&
    seal.checks?.nextActionCardVisible === true &&
    seal.checks?.advancedModeCollapsedByDefault === true;
}

async function runZeroLearningLauncher() {
  const result = await new Promise((resolveRun) => {
    const child = spawn("pnpm", ["run", "smoke:phase1781-1800-zero-learning-owner-operator"], {
      cwd: repoPath("."),
      shell: true,
      env: {
        ...process.env,
        AI_GATEWAY_PROVIDER_MODE: "fake",
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      },
    });
    const stdout = [];
    const stderr = [];
    child.stdout?.on("data", (chunk) => stdout.push(String(chunk)));
    child.stderr?.on("data", (chunk) => stderr.push(String(chunk)));
    child.once("close", (code) => resolveRun({
      exitCode: code,
      stdout: stdout.join(""),
      stderr: stderr.join(""),
    }));
    child.once("error", (error) => resolveRun({
      exitCode: 1,
      stdout: stdout.join(""),
      stderr: `${stderr.join("")}\n${error.message}`,
    }));
  });
  await writeText(evidencePaths.launcherLog, [
    "Phase1863 Run Zero-Learning Launcher",
    `exitCode=${result.exitCode}`,
    result.stdout,
    result.stderr,
  ].join("\n"));
  return {
    executed: true,
    exitCode: result.exitCode,
    success: result.exitCode === 0,
    logPath: evidencePaths.launcherLog,
  };
}

async function runOwnerOsBrowserRetest() {
  let server;
  let browserProcess;
  let profileDir;
  let cdp;
  const stdout = [];
  const stderr = [];

  try {
    await mkdir(dirname(repoPath(evidencePaths.screenshot)), { recursive: true });
    await mkdir(dirname(repoPath(evidencePaths.domSnapshot)), { recursive: true });

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
    const uiUrl = `http://127.0.0.1:${port}/ui?phase1861_1880=owner-os-retest`;

    const browserPath = findBrowserPath();
    const tempRoot = repoPath(".codex-runtime-tmp/phase1861-1880-browser");
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
    browserProcess.stdout?.on("data", (chunk) => stdout.push(String(chunk)));
    browserProcess.stderr?.on("data", (chunk) => stderr.push(String(chunk)));

    const cdpPort = await readDevToolsPort(profileDir);
    const pageTarget = await createCdpPage(cdpPort, uiUrl);
    cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Page.navigate", { url: uiUrl });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, "document.querySelector('[data-owner-os-shell=\"true\"]')");

    const beforeClick = await inspectOwnerOs(cdp);
    await cdp.evaluate(`(() => {
      document.querySelector('[data-owner-boss-action="run-today-check"]')?.click();
      return true;
    })()`);
    await sleep(300);
    const afterClick = await inspectOwnerOs(cdp);

    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(repoPath(evidencePaths.screenshot), Buffer.from(screenshot.data, "base64"));
    const dom = await cdp.evaluate("document.documentElement.outerHTML");
    await writeText(evidencePaths.domSnapshot, dom);

    const visibleText = afterClick.visibleText || beforeClick.visibleText || "";
    const ownerText = afterClick.ownerText || beforeClick.ownerText || "";
    const assessment = buildAutomatedUsabilityAssessment({
      beforeClick,
      afterClick,
      ownerText,
      visibleText,
      reportPath: upstreamPaths.phase1800ReportHtml,
      screenshotPath: evidencePaths.screenshot,
      domSnapshotPath: evidencePaths.domSnapshot,
    });

    return {
      success: assessment.ownerOsOpened &&
        assessment.primaryCtaClicked &&
        assessment.threeResultCardsVisible &&
        assessment.advancedModeCollapsed &&
        assessment.engineeringJargonLeakDetected === false &&
        assessment.nextStepVisible &&
        assessment.buttonFeedbackVisible,
      serviceUrl: uiUrl,
      screenshotPath: evidencePaths.screenshot,
      domSnapshotPath: evidencePaths.domSnapshot,
      beforeClick,
      afterClick,
      assessment,
      pluginAppUsageAudit: {
        pluginAppsUsed: true,
        pluginName: "Chrome/Edge local headless browser via CDP",
        toolType: "local_headless_browser_cdp",
        purpose: "Phase1861-1880 Owner OS local one-click retest screenshot and DOM evidence",
        whyNeeded: "The retest must verify the local Owner OS path with stable DOM selectors and browser evidence.",
        userAuthorized: true,
        dataSentOut: false,
        repoDataSentOut: false,
        secretExposed: false,
        rawCredentialExposed: false,
        providerCalled: false,
        costRisk: "none",
        evidencePath: evidenceDir,
        rollbackOrDisableMethod: "Delete tools/phase1861_1880, apps/ai-gateway-service/evidence/phase1861_1880, docs/dogfooding/phase1879-owner-os-retest-closure-report.md, and remove package scripts.",
      },
    };
  } finally {
    await writeText(evidencePaths.browserLog, [
      "Phase1864 Owner OS browser retest",
      stdout.join(""),
      stderr.join(""),
    ].join("\n"));
    await closeCdpSilently(cdp);
    await terminateBrowser(browserProcess);
    if (profileDir) await rm(profileDir, { recursive: true, force: true }).catch(() => {});
    if (server) {
      server.closeAllConnections?.();
      await close(server);
    }
  }
}

function buildAutomatedUsabilityAssessment({ beforeClick, afterClick, ownerText, visibleText, reportPath, screenshotPath, domSnapshotPath }) {
  const resultCardLabels = ["今天完成了什么", "发现了什么问题", "下一步我该点哪里"];
  const forbiddenLeak = hasForbiddenOwnerJargon(ownerText);
  const nextStepVisible = ownerText.includes("下一步我该点哪里") &&
    /先点|看三张结果卡|继续使用|重新运行|填写反馈/.test(ownerText);
  const reportReadable = existsSync(repoPath(reportPath));
  return {
    launcherExists: launcherExists(),
    ownerOsOpened: beforeClick.ownerOsVisible === true,
    primaryCtaClicked: afterClick.buttonFeedbackVisible === true,
    threeResultCardsVisible: resultCardLabels.every((label) => ownerText.includes(label)) &&
      beforeClick.threeResultCardsVisible === true,
    advancedModeCollapsed: beforeClick.advancedModeCollapsed === true,
    bossDailyReportOpened: reportReadable,
    reportPath,
    reportReadabilitySelfCheck: reportReadable,
    engineeringJargonLeakDetected: forbiddenLeak,
    nextStepVisible,
    buttonFeedbackVisible: afterClick.buttonFeedbackVisible === true,
    screenshotsGenerated: existsSync(repoPath(screenshotPath)),
    domSnapshotGenerated: existsSync(repoPath(domSnapshotPath)),
    automatedUsabilityAssessmentGenerated: true,
    ownerSatisfactionImprovedClaimed: false,
    ownerManualFeedbackClaimed: false,
    minimalRepairSuggested: forbiddenLeak || !nextStepVisible || afterClick.buttonFeedbackVisible !== true,
    minimalRepairQueue: [
      forbiddenLeak ? "P1: Owner OS first screen still exposes engineering jargon; move wording into Advanced Mode." : null,
      !nextStepVisible ? "P1: Next-step card is not clear enough; rewrite one action in plain Chinese." : null,
      afterClick.buttonFeedbackVisible !== true ? "P1: Primary button lacks visible feedback after click." : null,
    ].filter(Boolean),
    automatedAssessmentSummary: [
      "Automated check only; no owner satisfaction claim.",
      `Owner OS opened: ${beforeClick.ownerOsVisible === true}`,
      `Primary CTA feedback visible: ${afterClick.buttonFeedbackVisible === true}`,
      `Three result cards readable markers present: ${resultCardLabels.every((label) => ownerText.includes(label))}`,
      `Advanced mode collapsed: ${beforeClick.advancedModeCollapsed === true}`,
      `Engineering jargon leak detected: ${forbiddenLeak}`,
    ],
    visibleTextSample: String(visibleText).slice(0, 1200),
  };
}

async function inspectOwnerOs(cdp) {
  return await cdp.evaluate(`(() => {
    const root = document.querySelector('[data-owner-os-shell="true"]');
    const feedback = document.querySelector('#owner-boss-view-feedback');
    const ownerText = root?.innerText || '';
    return {
      ownerOsVisible: Boolean(root),
      primaryCtaCount: root ? root.querySelectorAll('[data-owner-boss-action="run-today-check"]').length : 0,
      totalButtonCount: root ? root.querySelectorAll('button').length : 0,
      threeResultCardsVisible: root ? ['today-completed','problems-found','next-action'].every((id) => root.querySelector('[data-owner-summary-card="' + id + '"]')) : false,
      advancedModeCollapsed: Boolean(document.querySelector('#owner-advanced-system-details:not([open])')),
      reportSurfaceVisible: Boolean(root?.querySelector('[data-owner-daily-report-surface="true"]')),
      buttonFeedbackVisible: Boolean(feedback?.innerText?.trim()) && !/未开始/.test(feedback.innerText),
      feedbackText: feedback?.innerText?.trim() || '',
      ownerText,
      visibleText: document.body?.innerText || '',
    };
  })()`);
}

export async function runOwnerOsOneClickRetest() {
  await ensureEvidenceDirs();
  const designKnowledgeEntries = await readDesignKnowledge();
  const phase1860Seal = await readJson(upstreamPaths.phase1860Seal, {});
  const preconditionPassed = phase1860Ready(phase1860Seal);
  const launcherPresence = {
    cmd: existsSync(repoPath(launcherPaths.cmd)),
    powershell: existsSync(repoPath(launcherPaths.powershell)),
  };

  if (!preconditionPassed) {
    const result = {
      phase: "Phase1880",
      phaseRange,
      completed: false,
      recommended_sealed: false,
      blocker: "phase1860_precondition_not_satisfied",
      ...boundary,
      designKnowledgeRead: designKnowledgeEntries.every((entry) => entry.textLength > 0),
      launcherExists: launcherPresence.cmd && launcherPresence.powershell,
      ownerOsOpened: false,
      primaryCtaClicked: false,
      threeResultCardsVisible: false,
      advancedModeCollapsed: false,
      bossDailyReportOpened: false,
      screenshotsGenerated: false,
      domSnapshotGenerated: false,
      automatedUsabilityAssessmentGenerated: false,
      minimalRepairExecuted: false,
    };
    await writeJson(evidencePaths.retest, result);
    await writeJson(evidencePaths.seal, result);
    return result;
  }

  const launcherRun = await runZeroLearningLauncher();
  const browserRetest = await runOwnerOsBrowserRetest();
  const assessment = browserRetest.assessment;
  const allEvidenceText = [
    JSON.stringify(assessment),
    await readText(upstreamPaths.phase1800ReportMd),
    await readText(upstreamPaths.phase1800ReportHtml),
  ].join("\n");

  const blocker = [
    [launcherPresence.cmd && launcherPresence.powershell, "launcher_missing"],
    [launcherRun.success, "zero_learning_launcher_failed"],
    [browserRetest.success, "owner_os_one_click_retest_failed"],
    [!containsSecretLikeValue(allEvidenceText), "secret_like_value_detected_in_retest_evidence"],
  ].find(([passed]) => passed !== true)?.[1] ?? null;

  const result = {
    phase: "Phase1880",
    phaseRange,
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
    ...boundary,
    designKnowledgeRead: designKnowledgeEntries.every((entry) => entry.textLength > 0),
    launcherExists: launcherPresence.cmd && launcherPresence.powershell,
    ownerOsOpened: assessment.ownerOsOpened,
    primaryCtaClicked: assessment.primaryCtaClicked,
    threeResultCardsVisible: assessment.threeResultCardsVisible,
    advancedModeCollapsed: assessment.advancedModeCollapsed,
    bossDailyReportOpened: assessment.bossDailyReportOpened,
    reportPath: assessment.reportPath,
    engineeringJargonLeakDetected: assessment.engineeringJargonLeakDetected,
    nextStepVisible: assessment.nextStepVisible,
    buttonFeedbackVisible: assessment.buttonFeedbackVisible,
    screenshotsGenerated: assessment.screenshotsGenerated,
    domSnapshotGenerated: assessment.domSnapshotGenerated,
    automatedUsabilityAssessmentGenerated: true,
    automatedUsabilityAssessmentPath: evidencePaths.retest,
    screenshotPath: evidencePaths.screenshot,
    domSnapshotPath: evidencePaths.domSnapshot,
    launcherRun,
    browserRetest: {
      serviceUrl: browserRetest.serviceUrl,
      screenshotPath: browserRetest.screenshotPath,
      domSnapshotPath: browserRetest.domSnapshotPath,
      beforeClick: browserRetest.beforeClick,
      afterClick: browserRetest.afterClick,
    },
    minimalRepairExecuted: false,
    minimalRepairQueue: assessment.minimalRepairQueue,
    noOwnerSatisfactionClaimed: true,
    noManualFeedbackClaimed: true,
    pluginAppUsageAudit: browserRetest.pluginAppUsageAudit,
    currentSealScope: "Owner OS one-click local retest automation and automated usability assessment only.",
    notSealedScope: [
      "owner satisfaction improvement",
      "production readiness",
      "public launch readiness",
      "real provider execution",
      "new product functionality",
    ],
  };

  await writeJson(evidencePaths.retest, result);
  await writeText(evidencePaths.closureReport, buildClosureReport(result));
  await writeJson(evidencePaths.seal, result);
  return result;
}

function buildClosureReport(result) {
  return `# Phase1879 Owner OS Retest Closure Report

- phaseRange: ${phaseRange}
- completed: ${result.completed}
- recommended_sealed: ${result.recommended_sealed}
- blocker: ${result.blocker}
- launcherExists: ${result.launcherExists}
- ownerOsOpened: ${result.ownerOsOpened}
- primaryCtaClicked: ${result.primaryCtaClicked}
- threeResultCardsVisible: ${result.threeResultCardsVisible}
- advancedModeCollapsed: ${result.advancedModeCollapsed}
- bossDailyReportOpened: ${result.bossDailyReportOpened}
- engineeringJargonLeakDetected: ${result.engineeringJargonLeakDetected}
- nextStepVisible: ${result.nextStepVisible}
- buttonFeedbackVisible: ${result.buttonFeedbackVisible}
- minimalRepairExecuted: ${result.minimalRepairExecuted}
- providerCallsMade: false
- chatModified: false
- chatGatewayExecuteModified: false
- productionReadyClaimed: false

Automated usability assessment only. No owner satisfaction improvement is claimed.
`;
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

if (isDirectRun(import.meta.url)) {
  const result = await runOwnerOsOneClickRetest();
  console.log(JSON.stringify(result, null, 2));
  if (result.blocker) process.exitCode = 1;
}

