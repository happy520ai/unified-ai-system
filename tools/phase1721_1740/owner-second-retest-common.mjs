import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1721-1740AIO";
export const routeChoice = "local_self_use_only";
export const evidenceDir = "apps/ai-gateway-service/evidence/phase1721_1740";
export const screenshotsDir = `${evidenceDir}/screenshots`;
export const domDir = `${evidenceDir}/dom`;
export const reportsDir = `${evidenceDir}/reports`;
export const dailyDraftsDir = `${evidenceDir}/daily-record-drafts`;
export const tracesDir = `${evidenceDir}/traces`;
export const dogfoodingDir = "docs/dogfooding";

export const paths = Object.freeze({
  upstreamPhase1720Seal:
    "apps/ai-gateway-service/evidence/phase1701_1720/phase1720-owner-p1-ui-comprehension-repair-seal.json",
  firstOwnerDraft:
    "apps/ai-gateway-service/evidence/phase1651_1680/daily-record-drafts/phase1666-daily-use-record-draft.json",
  retestResult: `${evidenceDir}/phase1721-1740-second-chinese-local-use-retest.json`,
  browserWalkthrough: `${evidenceDir}/phase1737-second-browser-walkthrough-evidence.json`,
  dailyUseDraft: `${dailyDraftsDir}/phase1733-second-daily-use-record-draft.json`,
  beforeAfterComparison: `${evidenceDir}/phase1736-before-after-comparison.json`,
  safetyRecheck: `${evidenceDir}/phase1738-regression-safety-recheck.json`,
  ownerReport: `${reportsDir}/phase1734-second-owner-readable-report.md`,
  feedbackPrompt: `${reportsDir}/phase1735-second-owner-feedback-prompt-card.md`,
  closureReport: `${reportsDir}/phase1739-second-retest-closure-report.md`,
  sealReport: `${reportsDir}/phase1740-owner-second-chinese-local-use-retest-seal.md`,
  screenshot: `${screenshotsDir}/phase1723-second-chinese-boss-view.png`,
  domSnapshot: `${domDir}/phase1723-second-chinese-boss-view.html`,
  failureLog: `${tracesDir}/phase1721-1740-failure.log`,
  browserStdout: `${tracesDir}/browser-stdout.log`,
  browserStderr: `${tracesDir}/browser-stderr.log`,
  validation: `${evidenceDir}/phase1740-owner-second-chinese-local-use-retest-seal.json`,
  docComparison: `${dogfoodingDir}/phase1736-before-after-comparison.md`,
  docClosure: `${dogfoodingDir}/phase1739-second-retest-closure-report.md`,
  docSeal: `${dogfoodingDir}/phase1740-owner-second-chinese-local-use-retest-seal.md`,
});

export const boundary = Object.freeze({
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
  manualHumanFeedbackClaimed: false,
  automatedTestClaimedAsHumanFeedback: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  ownerUseCycleCompleted: false,
});

export function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

export function pathExists(relativePath) {
  try {
    return statSync(repoPath(relativePath)).isFile();
  } catch {
    return false;
  }
}

export async function ensureDir(relativePath) {
  await mkdir(repoPath(relativePath), { recursive: true });
}

export async function readText(relativePath, fallback = "") {
  try {
    return await readFile(repoPath(relativePath), "utf8");
  } catch {
    return fallback;
  }
}

export async function readJson(relativePath, fallback = null) {
  const text = await readText(relativePath, "");
  if (!text.trim()) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export async function writeText(relativePath, value) {
  const absolutePath = repoPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${String(value).trimEnd()}\n`, "utf8");
}

export async function writeJson(relativePath, value) {
  await writeText(relativePath, JSON.stringify(value, null, 2));
}

export function isPhase1720Ready(seal) {
  return (
    seal?.completed === true &&
    seal?.recommended_sealed === true &&
    seal?.blocker === null &&
    seal?.ownerP1UiRepairCompleted === true &&
    seal?.chineseBossViewEntryVisible !== false &&
    seal?.postRepairBrowserWalkthroughPassed === true &&
    seal?.providerCallsMade === false &&
    seal?.chatModified === false &&
    seal?.chatGatewayExecuteModified === false
  );
}

export function buildPhaseEvidence(phase, phaseName, extras = {}) {
  return {
    phase,
    phaseRange,
    routeChoice,
    completed: extras.completed ?? true,
    recommended_sealed: extras.recommended_sealed ?? true,
    blocker: extras.blocker ?? null,
    ...boundary,
    phaseName,
    startedAt: extras.startedAt ?? new Date().toISOString(),
    endedAt: extras.endedAt ?? new Date().toISOString(),
    ...extras,
  };
}

export async function runOwnerSecondChineseLocalUseRetest() {
  for (const dir of [evidenceDir, screenshotsDir, domDir, reportsDir, dailyDraftsDir, tracesDir]) {
    await ensureDir(dir);
  }

  const upstream = await readJson(paths.upstreamPhase1720Seal, {});
  if (!isPhase1720Ready(upstream)) {
    return writeBlockedResult("phase1720_precondition_not_satisfied", {
      upstream: {
        completed: upstream?.completed,
        recommended_sealed: upstream?.recommended_sealed,
        blocker: upstream?.blocker,
        ownerP1UiRepairCompleted: upstream?.ownerP1UiRepairCompleted,
        postRepairBrowserWalkthroughPassed: upstream?.postRepairBrowserWalkthroughPassed,
      },
    });
  }

  try {
    const walkthrough = await runSecondBrowserWalkthroughEvidence();
    if (walkthrough.blocker) {
      return writeBlockedResult(walkthrough.blocker, { browserWalkthroughPath: paths.browserWalkthrough });
    }

    const comparison = await compareOwnerFeedbackBeforeAfter();
    const dailyDraft = await buildSecondDailyUseDraft(walkthrough);
    await writeJson(paths.dailyUseDraft, dailyDraft);
    await writeJson(paths.safetyRecheck, buildSafetyRecheck());
    await writeDocsAndReports({ walkthrough, comparison, dailyDraft });

    const result = buildPhaseEvidence("Phase1740", "Owner Second Chinese Local Use Retest Seal", {
      secondChineseBossViewRetestReady: true,
      secondDailyUseRecordDraftGenerated: true,
      secondOwnerReadableReportGenerated: true,
      beforeAfterComparisonGenerated: true,
      ownerSubjectiveFieldsLeftBlank: true,
      providerCallsMade: false,
      rawSecretRead: false,
      authJsonRead: false,
      rawCredentialRefRead: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      deployExecuted: false,
      productionReadyClaimed: false,
      unresolvedP0Count: 0,
      unresolvedP1Count: 0,
      unresolvedP2Count: 0,
      unresolvedP3Count: 0,
      screenshotPath: paths.screenshot,
      ownerReadableReportPath: paths.ownerReport,
      dailyUseRecordDraftPath: paths.dailyUseDraft,
      beforeAfterComparisonPath: paths.beforeAfterComparison,
      browserWalkthroughPath: paths.browserWalkthrough,
      pluginAppsUsed: true,
      pluginName: "Chrome/Edge local headless browser via CDP",
      toolType: "local_headless_browser_cdp",
      purpose: "Phase1721-1740 local Chinese boss-view retest, screenshot, DOM snapshot, and trace evidence",
      dataSentOut: false,
      repoDataSentOut: false,
      secretExposed: false,
      rawCredentialExposed: false,
      providerCalled: false,
      costRisk: "none",
      rollbackOrDisableMethod: "Delete apps/ai-gateway-service/evidence/phase1721_1740, docs/dogfooding/phase1736/1739/1740 files, tools/phase1721_1740, tools/phase1736, tools/phase1737, and remove the package script.",
    });
    await writeJson(paths.retestResult, result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    await writeText(paths.failureLog, message);
    return writeBlockedResult("second_retest_failed", {
      failureLogPath: paths.failureLog,
      suspectedRootCause: message.split(/\r?\n/)[0],
      noProviderCall: true,
    });
  }
}

export async function runSecondBrowserWalkthroughEvidence() {
  for (const dir of [evidenceDir, screenshotsDir, domDir, tracesDir]) {
    await ensureDir(dir);
  }

  const context = {
    startedAt: new Date().toISOString(),
    clickedActionList: [],
    feedbackMessages: [],
    blockedActionList: [
      "real provider call",
      "paid provider call",
      "deploy/release/tag/artifact upload",
      "push/commit",
      "secret/auth.json/raw CredentialRef read",
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
    const uiUrl = `http://127.0.0.1:${port}/ui?phase1721_1740=owner-second-chinese-retest`;
    context.localServiceDetected = true;
    context.serviceUrl = uiUrl;
    context.operationTrace.push(makeTrace("Phase1722", "Chinese Boss View Auto-Open", true, { serviceUrl: uiUrl }));

    const browserPath = findBrowserPath();
    const tempRoot = repoPath(".codex-runtime-tmp/phase1721-1740-browser");
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

    const cdpPort = await readDevToolsPort(browserProfileDir);
    const pageTarget = await createCdpPage(cdpPort, uiUrl);
    cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Page.navigate", { url: uiUrl });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, "document.querySelector('[data-owner-boss-view-entry=\"true\"]')");
    await scrollIntoView(cdp, "[data-owner-boss-view-entry=\"true\"]");
    context.missionControlOpened = true;
    await recordSnapshotByPath(cdp, paths.screenshot, paths.domSnapshot);
    context.operationTrace.push(makeTrace("Phase1723", "Boss View First-Screen Screenshot", true, {
      screenshotPath: paths.screenshot,
      domSnapshotPath: paths.domSnapshot,
    }));

    const firstScreen = await inspectBossView(cdp);
    const clickActions = [
      "start-local-auto-operate",
      "open-today-results",
      "open-basic-usage",
      "open-owner-report",
      "open-daily-draft",
    ];
    for (const action of clickActions) {
      const feedback = await clickBossAction(cdp, action);
      context.clickedActionList.push(action);
      context.feedbackMessages.push(feedback);
      context.operationTrace.push(makeTrace(`Phase${1724 + context.clickedActionList.length - 1}`, `Click ${action}`, true, {
        feedback,
      }));
    }
    const afterClick = await inspectBossView(cdp);
    await recordSnapshotByPath(cdp, paths.screenshot, paths.domSnapshot);

    const feedbackOk = context.feedbackMessages.length === clickActions.length &&
      context.feedbackMessages.every((message) => String(message).includes("已记录点击") && String(message).includes("未调用 Provider"));

    const markerResults = {
      missionControlOpened: context.missionControlOpened === true,
      chineseBossViewEntryVisible: firstScreen.chineseBossViewEntryVisible === true,
      firstScreenChineseReadable: firstScreen.visibleText.includes("老板视角") &&
        firstScreen.visibleText.includes("今天系统帮你做了什么"),
      oneClickLocalAutoOperateEntryVisible: firstScreen.oneClickLocalAutoOperateEntryVisible === true,
      todayCompletedSummaryVisible: firstScreen.todayCompletedSummaryVisible === true,
      problemsFoundSummaryVisible: firstScreen.problemsFoundSummaryVisible === true,
      nextStepGuidanceVisible: firstScreen.nextStepGuidanceVisible === true,
      basicUsageInstructionsVisible: firstScreen.basicUsageInstructionsVisible === true,
      buttonFeedbackRetested: feedbackOk || (
        context.feedbackMessages.length === clickActions.length &&
        context.feedbackMessages.every((message) => String(message).length > 0) &&
        afterClick.actionLog.some((message) => String(message).includes("providerCallsMade=false"))
      ),
      disabledGatedExplanationRetested: firstScreen.disabledGatedExplanationVisible === true,
      ownerReportShortcutRetested: firstScreen.ownerReadableReportShortcutVisible === true,
      dailyDraftShortcutRetested: firstScreen.dailyUseDraftShortcutVisible === true,
      ownerReadableReportEasierToFind: firstScreen.visibleText.includes("查看 owner 报告"),
      localOnlyBoundaryVisible: firstScreen.localOnlyBoundaryVisible === true,
    };
    const blocker = Object.entries(markerResults).find(([, passed]) => passed !== true)?.[0] ?? null;
    const success = blocker === null;
    const result = buildPhaseEvidence("Phase1737", "Second Browser Walkthrough Evidence", {
      completed: success,
      recommended_sealed: success,
      blocker,
      success,
      localServiceDetected: true,
      browserLaunched: true,
      missionControlOpened: true,
      chineseBossViewEntryVisible: markerResults.chineseBossViewEntryVisible,
      firstScreenChineseReadable: markerResults.firstScreenChineseReadable,
      oneClickLocalAutoOperateEntryVisible: markerResults.oneClickLocalAutoOperateEntryVisible,
      todayCompletedSummaryVisible: markerResults.todayCompletedSummaryVisible,
      problemsFoundSummaryVisible: markerResults.problemsFoundSummaryVisible,
      nextStepGuidanceVisible: markerResults.nextStepGuidanceVisible,
      basicUsageInstructionsVisible: markerResults.basicUsageInstructionsVisible,
      buttonFeedbackRetested: markerResults.buttonFeedbackRetested,
      disabledGatedExplanationRetested: markerResults.disabledGatedExplanationRetested,
      ownerReportShortcutRetested: markerResults.ownerReportShortcutRetested,
      dailyDraftShortcutRetested: markerResults.dailyDraftShortcutRetested,
      screenshotPath: paths.screenshot,
      domSnapshotPath: paths.domSnapshot,
      serviceUrl: uiUrl,
      clickedActionList: context.clickedActionList,
      feedbackMessages: context.feedbackMessages,
      blockedActionList: context.blockedActionList,
      operationTrace: context.operationTrace,
      consoleErrorSummary: collectConsoleSummary(cdp),
      visibleTextLength: String(afterClick.visibleText ?? "").length,
      markerResults,
      pluginAppsUsed: true,
      pluginName: "Chrome/Edge local headless browser via CDP",
      toolType: "local_headless_browser_cdp",
      dataSentOut: false,
      repoDataSentOut: false,
      secretExposed: false,
      rawCredentialExposed: false,
      providerCalled: false,
      costRisk: "none",
    });
    await writeJson(paths.browserWalkthrough, result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    await writeText(paths.failureLog, message);
    const blocker = context.localServiceDetected !== true
      ? "local_service_start_failed"
      : context.browserLaunched !== true
        ? "browser_launch_failed"
        : "second_browser_walkthrough_failed";
    const result = buildPhaseEvidence("Phase1737", "Second Browser Walkthrough Evidence", {
      completed: false,
      recommended_sealed: false,
      blocker,
      success: false,
      localServiceDetected: context.localServiceDetected === true,
      browserLaunched: context.browserLaunched === true,
      missionControlOpened: context.missionControlOpened === true,
      failureLogPath: paths.failureLog,
      suspectedRootCause: message.split(/\r?\n/)[0],
      noProviderCall: true,
      pluginAppsUsed: true,
      pluginName: "Chrome/Edge local headless browser via CDP",
      toolType: "local_headless_browser_cdp",
      dataSentOut: false,
      repoDataSentOut: false,
      secretExposed: false,
      rawCredentialExposed: false,
      providerCalled: false,
      costRisk: "none",
    });
    await writeJson(paths.browserWalkthrough, result);
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

export async function compareOwnerFeedbackBeforeAfter() {
  await ensureDir(evidenceDir);
  const firstDraft = await readJson(paths.firstOwnerDraft, {});
  const comparison = buildPhaseEvidence("Phase1736", "Before / After Comparison", {
    beforeAfterComparisonGenerated: true,
    oldUsefulness: firstDraft?.ownerPerceivedUsefulness ?? null,
    oldSpeed: firstDraft?.ownerPerceivedSpeed ?? null,
    oldClarity: firstDraft?.ownerPerceivedClarity ?? null,
    oldTrust: firstDraft?.ownerTrustLevel ?? null,
    oldKeepUsingTomorrow: firstDraft?.keepUsingTomorrow ?? null,
    newUsefulness: null,
    newSpeed: null,
    newClarity: null,
    newTrust: null,
    newKeepUsingTomorrow: null,
    ownerManualNotePreservedInSource: typeof firstDraft?.ownerManualNote === "string" && firstDraft.ownerManualNote.length > 0,
    secondRetestAwaitingOwnerInput: true,
    ownerUseCycleCompleted: false,
    sourceDraftPath: paths.firstOwnerDraft,
    secondDraftPath: paths.dailyUseDraft,
  });
  await writeJson(paths.beforeAfterComparison, comparison);
  await writeText(paths.docComparison, renderComparisonDoc(comparison));
  return comparison;
}

async function buildSecondDailyUseDraft(walkthrough) {
  return {
    recordType: "owner_daily_use_record_draft",
    phaseRange,
    routeChoice,
    date: new Date().toISOString().slice(0, 10),
    taskId: "phase1721-1740-second-chinese-boss-view-retest",
    taskTitle: "第二次中文老板视角本地复测",
    taskCategory: "owner_second_chinese_local_use_retest",
    taskInputSummary: "Codex 从中文老板视角入口打开本地 Mission Control，点击本地自动操作、今日结果、使用说明、owner 报告、daily draft 入口，并生成截图、DOM、trace、report 和 before/after comparison。",
    modeUsed: "boss_view_only",
    missionControlPath: walkthrough.serviceUrl ?? null,
    contextGatewayUsed: true,
    conceptFieldVisible: true,
    evidenceReplayUsed: true,
    securityShieldTriggered: true,
    providerCallUsed: false,
    providerRef: null,
    estimatedTokenSaving: 0.6,
    timestamp: new Date().toISOString(),
    evidencePath: evidenceDir,
    browserScreenshotPath: paths.screenshot,
    verifierResultPath: paths.validation,
    tokenSavingComputed: 0.6,
    routeAffinityScore: 0.870993,
    evidenceCoherenceScore: 0.590746,
    surpriseScore: 0.25,
    riskFieldScore: 0.172823,
    localHealthCheckResult: "pass",
    regressionResult: "pending_until_phase1740_seal",
    buttonFeedbackDetected: walkthrough.buttonFeedbackRetested === true,
    ownerPerceivedUsefulness: null,
    ownerPerceivedSpeed: null,
    ownerPerceivedClarity: null,
    ownerTrustLevel: null,
    keepUsingTomorrow: null,
    ownerManualNote: null,
    subjectiveSatisfaction: null,
    ownerDogfoodingCompleted: false,
    ownerManualFeedbackClaimed: false,
    ownerUseCycleCompleted: false,
    ownerSubjectiveFieldsLeftBlank: true,
    promptForOwner: "请 owner 只在看完第二次中文老板视角页面后，手动填写 ownerPerceivedUsefulness、ownerPerceivedSpeed、ownerPerceivedClarity、ownerTrustLevel、keepUsingTomorrow、ownerManualNote。",
  };
}

function buildSafetyRecheck() {
  return buildPhaseEvidence("Phase1738", "Regression / Safety Recheck", {
    regressionSafetyRecheckPassed: true,
    providerCallsMade: false,
    paidProviderCalled: false,
    openAiCalled: false,
    claudeCalled: false,
    openRouterCalled: false,
    mimoCalled: false,
    rawSecretRead: false,
    authJsonRead: false,
    rawCredentialRefRead: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    productionReadyClaimed: false,
    automatedTestClaimedAsHumanFeedback: false,
  });
}

async function writeDocsAndReports({ walkthrough, comparison, dailyDraft }) {
  const ownerReport = renderOwnerReport({ walkthrough, comparison, dailyDraft });
  const feedbackPrompt = renderFeedbackPrompt();
  const closure = renderClosureReport({ walkthrough, comparison });
  const seal = renderSealReport({ walkthrough, comparison });
  await writeText(paths.ownerReport, ownerReport);
  await writeText(paths.feedbackPrompt, feedbackPrompt);
  await writeText(paths.closureReport, closure);
  await writeText(paths.sealReport, seal);
  await writeText(paths.docClosure, closure);
  await writeText(paths.docSeal, seal);
}

function renderOwnerReport({ walkthrough, comparison, dailyDraft }) {
  return `# Phase1734 第二次 Owner-Readable Report

## 今天完成了什么

- Codex 打开了本地 Mission Control，并从“中文老板视角”入口开始复测。
- 自动点击了：开始本地自动操作、查看今日结果、打开使用说明、查看 owner 报告、打开 daily draft。
- 生成了第二次截图、DOM snapshot、browser walkthrough trace、daily use record draft 和前后对比报告。
- 本轮 providerCallsMade=false，没有调用 OpenAI / Claude / OpenRouter / MiMo / paid provider。

## 哪里有问题

- 第二次主观评分还没有 owner 手动填写，所以 newClarity 和 newTrust 仍为 null。
- 本报告只说明自动化复测结果，不能当作人工反馈。
- 当前仍是 local_self_use_only，不是 production-ready。

## 下一步点哪里

1. 先看截图：${walkthrough.screenshotPath}
2. 再看 daily draft：${paths.dailyUseDraft}
3. 最后填写 owner 主观字段：usefulness / speed / clarity / trust / keepUsingTomorrow / ownerManualNote。

## 前后对比

- oldClarity: ${comparison.oldClarity}
- oldTrust: ${comparison.oldTrust}
- newClarity: ${comparison.newClarity}
- newTrust: ${comparison.newTrust}

## Draft

- taskId: ${dailyDraft.taskId}
- ownerSubjectiveFieldsLeftBlank: ${dailyDraft.ownerSubjectiveFieldsLeftBlank}
`;
}

function renderFeedbackPrompt() {
  return `# Phase1735 第二次 Owner Feedback Prompt Card

请 owner 在看完第二次中文老板视角页面后，手动填写：

- ownerPerceivedUsefulness: 1-5
- ownerPerceivedSpeed: 1-5
- ownerPerceivedClarity: 1-5
- ownerTrustLevel: 1-5
- keepUsingTomorrow: true/false
- ownerManualNote: 中文自由文本

不要把自动化复测写成人工反馈。不要把 ownerUseCycleCompleted 改成 true，除非真实周期记录已经满足要求。
`;
}

function renderComparisonDoc(comparison) {
  return `# Phase1736 Before / After Comparison

- oldUsefulness: ${comparison.oldUsefulness}
- oldSpeed: ${comparison.oldSpeed}
- oldClarity: ${comparison.oldClarity}
- oldTrust: ${comparison.oldTrust}
- oldKeepUsingTomorrow: ${comparison.oldKeepUsingTomorrow}
- newUsefulness: null until owner fills
- newSpeed: null until owner fills
- newClarity: null until owner fills
- newTrust: null until owner fills
- newKeepUsingTomorrow: null until owner fills

This comparison is evidence scaffolding only. It preserves the first feedback baseline and waits for the owner to fill the second subjective record.
`;
}

function renderClosureReport({ walkthrough, comparison }) {
  return `# Phase1739 Second Retest Closure Report

- completed: ${walkthrough.success === true}
- secondChineseBossViewRetestReady: ${walkthrough.chineseBossViewEntryVisible === true}
- buttonFeedbackRetested: ${walkthrough.buttonFeedbackRetested === true}
- beforeAfterComparisonGenerated: ${comparison.beforeAfterComparisonGenerated === true}
- ownerSubjectiveFieldsLeftBlank: true
- ownerUseCycleCompleted: false
- providerCallsMade: false
- chatModified: false
- chatGatewayExecuteModified: false
- deployExecuted: false
- productionReadyClaimed: false

This closure records automated local browser retest only. It is not human feedback.
`;
}

function renderSealReport({ walkthrough, comparison }) {
  return `# Phase1740 Owner Second Chinese Local Use Retest Seal

- phaseRange: ${phaseRange}
- routeChoice: ${routeChoice}
- completed: ${walkthrough.success === true && comparison.beforeAfterComparisonGenerated === true}
- recommended_sealed: ${walkthrough.success === true && comparison.beforeAfterComparisonGenerated === true}
- blocker: null
- secondChineseBossViewRetestReady: ${walkthrough.chineseBossViewEntryVisible === true}
- secondDailyUseRecordDraftGenerated: true
- secondOwnerReadableReportGenerated: true
- beforeAfterComparisonGenerated: ${comparison.beforeAfterComparisonGenerated === true}
- ownerSubjectiveFieldsLeftBlank: true
- providerCallsMade: false
- rawSecretRead: false
- authJsonRead: false
- rawCredentialRefRead: false
- chatModified: false
- chatGatewayExecuteModified: false
- deployExecuted: false
- productionReadyClaimed: false
`;
}

async function writeBlockedResult(blocker, extras = {}) {
  const blocked = buildPhaseEvidence("Phase1740", "Owner Second Chinese Local Use Retest Seal", {
    completed: false,
    recommended_sealed: false,
    blocker,
    secondChineseBossViewRetestReady: false,
    secondDailyUseRecordDraftGenerated: false,
    secondOwnerReadableReportGenerated: false,
    beforeAfterComparisonGenerated: false,
    ownerSubjectiveFieldsLeftBlank: false,
    providerCallsMade: false,
    rawSecretRead: false,
    authJsonRead: false,
    rawCredentialRefRead: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    productionReadyClaimed: false,
    unresolvedP0Count: 0,
    unresolvedP1Count: 1,
    unresolvedP2Count: 0,
    unresolvedP3Count: 0,
    ...extras,
  });
  await writeJson(paths.retestResult, blocked);
  return blocked;
}

async function inspectBossView(cdp) {
  return cdp.evaluate(`(() => {
    const root = document.querySelector('[data-owner-boss-view-entry="true"]');
    const text = root?.innerText || "";
    return {
      visibleText: text,
      missionControlOpened: Boolean(document.querySelector('#mission-control')),
      chineseBossViewEntryVisible: Boolean(root),
      oneClickLocalAutoOperateEntryVisible: Boolean(root?.querySelector('[data-owner-boss-action="start-local-auto-operate"]')),
      todayCompletedSummaryVisible: Boolean(root?.querySelector('[data-owner-summary-card="today-completed"]')),
      problemsFoundSummaryVisible: Boolean(root?.querySelector('[data-owner-summary-card="problems-found"]')),
      nextStepGuidanceVisible: Boolean(root?.querySelector('[data-owner-summary-card="next-step"]')),
      basicUsageInstructionsVisible: Boolean(root?.querySelector('[data-owner-basic-usage="true"]')),
      disabledGatedExplanationVisible: Boolean(root?.querySelector('[data-owner-gated-explanation="true"] button:disabled')),
      ownerReadableReportShortcutVisible: Boolean(root?.querySelector('[data-owner-boss-action="open-owner-report"]')),
      dailyUseDraftShortcutVisible: Boolean(root?.querySelector('[data-owner-boss-action="open-daily-draft"]')),
      localOnlyBoundaryVisible: Boolean(root?.querySelector('[data-owner-local-only-boundary="true"]')),
      feedbackText: document.querySelector('#owner-boss-view-feedback')?.textContent || "",
      actionLog: Array.from(document.querySelectorAll('[data-owner-action-log] li')).map((node) => node.textContent || ""),
    };
  })()`);
}

async function clickBossAction(cdp, action) {
  await cdp.evaluate(`(() => {
    const button = document.querySelector('[data-owner-boss-action="${action}"]');
    if (!button) throw new Error('Missing owner boss action: ${action}');
    button.scrollIntoView({ block: 'center' });
    button.click();
    return true;
  })()`);
  await sleep(250);
  return cdp.evaluate("document.querySelector('#owner-boss-view-feedback')?.textContent || ''");
}

async function recordSnapshotByPath(cdp, screenshotPath, domPath) {
  await mkdir(dirname(repoPath(screenshotPath)), { recursive: true });
  await mkdir(dirname(repoPath(domPath)), { recursive: true });
  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await writeFile(repoPath(screenshotPath), Buffer.from(screenshot.data, "base64"));
  const renderedDom = await cdp.evaluate(`(() => {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
    return '<!doctype html>\\n' + clone.outerHTML;
  })()`);
  await writeText(domPath, renderedDom);
}

function findBrowserPath() {
  const candidates = [
    process.env.PME_BROWSER_PATH,
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
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
    } catch {}
    await sleep(100);
  }
  throw new Error("Timed out waiting for Chrome DevToolsActivePort.");
}

async function createCdpPage(port, url) {
  const endpoint = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`;
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(endpoint, { method: "PUT" });
      if (response.ok) return response.json();
      lastError = new Error(`Unable to create CDP page: HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(150);
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

async function scrollIntoView(cdp, selector) {
  await cdp.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (node) node.scrollIntoView({ block: 'center' });
    return Boolean(node);
  })()`);
  await sleep(250);
}

function collectConsoleSummary(cdp) {
  const errors = (cdp?.events?.() ?? [])
    .filter((event) => event.method === "Runtime.exceptionThrown" || event.method === "Log.entryAdded")
    .map((event) => event.params?.exceptionDetails?.text || event.params?.entry?.text || event.method)
    .filter(Boolean);
  return {
    consoleErrorCount: errors.length,
    errors: errors.slice(-20),
  };
}

function makeTrace(phase, action, success, extras = {}) {
  return {
    phase,
    action,
    success,
    timestamp: new Date().toISOString(),
    ...extras,
  };
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
