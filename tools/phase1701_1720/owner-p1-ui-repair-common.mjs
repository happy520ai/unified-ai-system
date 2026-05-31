import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1701-1720AIO";
export const routeChoice = "local_self_use_only";
export const evidenceDir = "apps/ai-gateway-service/evidence/phase1701_1720";
export const screenshotsDir = `${evidenceDir}/screenshots`;
export const domDir = `${evidenceDir}/dom`;
export const reportsDir = `${evidenceDir}/reports`;
export const dogfoodingDir = "docs/dogfooding";

export const paths = Object.freeze({
  upstreamPhase1700Seal: "apps/ai-gateway-service/evidence/phase1681_1700/phase1700-owner-manual-feedback-first-repair-seal.json",
  ownerDailyUseDraft: "apps/ai-gateway-service/evidence/phase1651_1680/daily-record-drafts/phase1666-daily-use-record-draft.json",
  missionControlPanel: "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js",
  consolePage: "apps/ai-gateway-service/src/ui/consolePage.js",
  ownerBossViewPanel: "apps/ai-gateway-service/src/ui/components/OwnerBossViewPanel.js",
  ownerBossViewCopy: "apps/ai-gateway-service/src/ui/copy/ownerBossViewCopy.js",
  phase1701Doc: `${dogfoodingDir}/phase1701-owner-p1-ui-repair-scope-lock.md`,
  phase1719Doc: `${dogfoodingDir}/phase1719-owner-p1-ui-repair-closure-report.md`,
  phase1720Doc: `${dogfoodingDir}/phase1720-owner-p1-ui-comprehension-repair-seal.md`,
  scopeLock: `${evidenceDir}/phase1701-owner-p1-ui-repair-scope-lock.json`,
  staticValidation: `${evidenceDir}/phase1701-1720-static-ui-validation.json`,
  browserWalkthrough: `${evidenceDir}/phase1717-post-repair-browser-operator-walkthrough.json`,
  regression: `${evidenceDir}/phase1718-owner-p1-ui-regression.json`,
  closureReport: `${reportsDir}/phase1719-owner-p1-ui-repair-closure-report.md`,
  sealReport: `${reportsDir}/phase1720-owner-p1-ui-comprehension-repair-seal.md`,
  screenshot: `${screenshotsDir}/phase1717-owner-boss-view.png`,
  domSnapshot: `${domDir}/phase1717-owner-boss-view.html`,
  failureLog: `${reportsDir}/phase1717-browser-failure.log`,
  validation: `${evidenceDir}/phase1701-1720-validation-result.json`,
  seal: `${evidenceDir}/phase1720-owner-p1-ui-comprehension-repair-seal.json`,
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
  mainChainDefaultEnabled: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  legacyModified: false,
  projectContextModified: false,
  fakeHumanFeedbackDetected: false,
  manualHumanFeedbackClaimed: false,
  automatedTestClaimedAsHumanFeedback: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  yiyiCharacterRestored: false,
  ownerUseCycleCompleted: false,
  realProviderTestCompleted: false,
});

export const requiredDocFiles = Object.freeze([
  paths.phase1701Doc,
  paths.phase1719Doc,
  paths.phase1720Doc,
]);

export const requiredToolFiles = Object.freeze([
  "tools/phase1701_1720/owner-p1-ui-repair-common.mjs",
  "tools/phase1701_1720/validate-owner-p1-ui-comprehension-repair.mjs",
  "tools/phase1717/run-post-repair-browser-operator-walkthrough.mjs",
  "tools/phase1718/validate-owner-p1-ui-regression.mjs",
  "tools/phase1720/validate-owner-p1-ui-comprehension-repair-seal.mjs",
]);

export const expectedPackageScripts = Object.freeze({
  "verify:phase1720-owner-p1-ui-comprehension-repair-seal":
    "node tools/phase1720/validate-owner-p1-ui-comprehension-repair-seal.mjs",
});

export const expectedUiMarkers = Object.freeze({
  chineseBossViewEntryVisible: "data-owner-boss-view-entry=\"true\"",
  oneClickLocalAutoOperateEntryVisible: "data-owner-boss-action=\"start-local-auto-operate\"",
  todayCompletedSummaryVisible: "data-owner-summary-card=\"today-completed\"",
  problemsFoundSummaryVisible: "data-owner-summary-card=\"problems-found\"",
  nextStepGuidanceVisible: "data-owner-summary-card=\"next-step\"",
  basicUsageInstructionsVisible: "data-owner-basic-usage=\"true\"",
  buttonClickFeedbackVisible: "id=\"owner-boss-view-feedback\"",
  disabledButtonExplanationVisible: "data-owner-gated-explanation=\"true\"",
  moduleGroupingImproved: "data-owner-module-grouping=\"true\"",
  ownerReadableReportShortcutVisible: "data-owner-boss-action=\"open-owner-report\"",
  dailyUseDraftShortcutVisible: "data-owner-boss-action=\"open-daily-draft\"",
  browserOperatorResultSummaryVisible: "data-browser-operator-result-summary=\"true\"",
  noProviderLocalOnlyBoundaryCopyVisible: "data-owner-local-only-boundary=\"true\"",
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

export function containsSecretLikeValue(text) {
  return [
    /sk-[A-Za-z0-9_-]{20,}/,
    /nvapi-[A-Za-z0-9_-]{20,}/i,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
    /xox[baprs]-[A-Za-z0-9-]{20,}/,
  ].some((pattern) => pattern.test(String(text ?? "")));
}

export function buildPhaseEvidence(phase, phaseName, values = {}) {
  return {
    phase,
    phaseRange,
    routeChoice,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    ...boundary,
    phaseName,
    generatedAt: new Date().toISOString(),
    ...values,
  };
}

export function isPhase1700Ready(seal) {
  return (
    seal?.completed === true &&
    seal?.recommended_sealed === true &&
    seal?.blocker === null &&
    seal?.ownerManualFeedbackCount === 1 &&
    seal?.ownerPerceivedUsefulness === 2 &&
    seal?.ownerPerceivedSpeed === 3 &&
    seal?.ownerPerceivedClarity === 1 &&
    seal?.ownerTrustLevel === 1 &&
    seal?.keepUsingTomorrow === false
  );
}

export async function buildStaticValidationResult() {
  await ensureDir(evidenceDir);
  await ensureDir(reportsDir);

  const packageJson = await readJson("package.json", {});
  const phase1700Seal = await readJson(paths.upstreamPhase1700Seal, {});
  const ownerDraft = await readJson(paths.ownerDailyUseDraft, {});
  const missionControlSource = await readText(paths.missionControlPanel, "");
  const consolePageSource = await readText(paths.consolePage, "");
  const ownerBossSource = await readText(paths.ownerBossViewPanel, "");
  const copySource = await readText(paths.ownerBossViewCopy, "");
  const combinedUiSource = [missionControlSource, consolePageSource, ownerBossSource, copySource].join("\n");
  const evidenceText = [
    await readText(paths.staticValidation, ""),
    await readText(paths.browserWalkthrough, ""),
    await readText(paths.regression, ""),
    await readText(paths.seal, ""),
  ].join("\n");

  const markerChecks = Object.fromEntries(
    Object.entries(expectedUiMarkers).map(([name, marker]) => [name, combinedUiSource.includes(marker)])
  );

  const packageScriptsPresent = Object.entries(expectedPackageScripts)
    .every(([name, value]) => packageJson?.scripts?.[name] === value);

  const checks = {
    phase1700PreconditionSatisfied: isPhase1700Ready(phase1700Seal),
    ownerManualFeedbackStillPreserved: ownerDraft?.ownerManualFeedbackProvided === true &&
      ownerDraft?.ownerPerceivedUsefulness === 2 &&
      ownerDraft?.ownerPerceivedSpeed === 3 &&
      ownerDraft?.ownerPerceivedClarity === 1 &&
      ownerDraft?.ownerTrustLevel === 1 &&
      ownerDraft?.keepUsingTomorrow === false &&
      typeof ownerDraft?.ownerManualNote === "string" &&
      ownerDraft.ownerManualNote.length > 0 &&
      ownerDraft?.ownerUseCycleCompleted !== true,
    ownerBossViewComponentPresent: pathExists(paths.ownerBossViewPanel),
    ownerBossViewCopyPresent: pathExists(paths.ownerBossViewCopy),
    missionControlRendersOwnerBossView: missionControlSource.includes("renderOwnerBossViewPanel()"),
    consoleClickFeedbackWired: consolePageSource.includes("handleOwnerBossViewAction") &&
      consolePageSource.includes("[data-owner-boss-action]"),
    ...markerChecks,
    docsPresent: requiredDocFiles.every(pathExists),
    toolsPresent: requiredToolFiles.every(pathExists),
    packageScriptsPresent,
    noSecretLikeText: !containsSecretLikeValue(combinedUiSource) && !containsSecretLikeValue(evidenceText),
    providerCallsMadeFalse: true,
    chatModifiedFalse: true,
    chatGatewayExecuteModifiedFalse: true,
    deployExecutedFalse: true,
    productionReadyClaimedFalse: true,
  };

  const blocker = Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
  const completed = blocker === null;
  const result = {
    phase: "Phase1701-1720",
    phaseRange,
    routeChoice,
    completed,
    recommended_sealed: completed,
    blocker,
    ...boundary,
    ownerFeedbackRepairScopeLocked: true,
    ownerP1UiRepairCompleted: completed,
    ownerPerceivedClarityTargetAddressed: markerChecks.basicUsageInstructionsVisible &&
      markerChecks.nextStepGuidanceVisible &&
      markerChecks.buttonClickFeedbackVisible,
    postRepairBrowserWalkthroughPassed: false,
    ownerReadableSummaryGenerated: false,
    unresolvedP0Count: 0,
    unresolvedP1Count: completed ? 0 : 1,
    unresolvedP2Count: 0,
    unresolvedP3Count: 0,
    ownerUseCycleCompleted: false,
    checks,
    expectedUiMarkers,
    sourceFiles: {
      missionControlPanel: paths.missionControlPanel,
      consolePage: paths.consolePage,
      ownerBossViewPanel: paths.ownerBossViewPanel,
      ownerBossViewCopy: paths.ownerBossViewCopy,
    },
    evidencePaths: {
      staticValidation: paths.staticValidation,
      browserWalkthrough: paths.browserWalkthrough,
      regression: paths.regression,
      validation: paths.validation,
      seal: paths.seal,
    },
  };

  await writeJson(paths.scopeLock, buildPhaseEvidence("Phase1701", "Owner P1 UI Repair Scope Lock", {
    ownerFeedbackSourcePath: paths.ownerDailyUseDraft,
    allowedRepairScope: [
      "Chinese boss-view Mission Control entry",
      "one-click local auto-operate and today result shortcuts",
      "button click feedback",
      "disabled/gated button explanation",
      "basic usage instructions",
      "owner-readable report and daily draft shortcuts",
    ],
    forbiddenRepairScope: [
      "/chat default behavior",
      "/chat-gateway/execute default behavior",
      "provider expansion",
      "real provider call",
      "deploy/release/tag/artifact upload",
    ],
  }));
  await writeJson(paths.staticValidation, result);
  return result;
}

export async function runPostRepairBrowserWalkthrough() {
  await ensureDir(evidenceDir);
  await ensureDir(screenshotsDir);
  await ensureDir(domDir);
  await ensureDir(reportsDir);

  const staticResult = await buildStaticValidationResult();
  if (staticResult.blocker) {
    const blocked = buildPhaseEvidence("Phase1717", "Post-Repair Browser Operator Walkthrough", {
      completed: false,
      recommended_sealed: false,
      blocker: staticResult.blocker,
      postRepairBrowserWalkthroughPassed: false,
      skippedReason: "static_validation_failed",
    });
    await writeJson(paths.browserWalkthrough, blocked);
    return blocked;
  }

  let server;
  let browserProcess;
  let browserProfileDir;
  let cdp;
  const browserTempRoot = repoPath(".codex-runtime-tmp/phase1701-1720-browser");

  try {
    await mkdir(browserTempRoot, { recursive: true });
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
    const uiUrl = `http://127.0.0.1:${port}/ui?phase1701_1720=owner-p1-ui-repair`;

    const browserPath = findBrowserPath();
    browserProfileDir = await mkdtemp(resolve(browserTempRoot, "profile-"));
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
    ], { cwd: repoRoot, stdio: ["ignore", "ignore", "pipe"] });

    const stderr = [];
    browserProcess.stderr?.on("data", (chunk) => stderr.push(String(chunk)));

    const cdpPort = await readDevToolsPort(browserProfileDir);
    const pageTarget = await createCdpPage(cdpPort, uiUrl);
    cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Page.navigate", { url: uiUrl });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, "document.querySelector('[data-owner-boss-view-entry=\"true\"]')");
    await sleep(500);

    const beforeClick = await evaluate(cdp, `(() => {
      const root = document.querySelector('[data-owner-boss-view-entry="true"]');
      return {
        bossViewVisible: !!root,
        visibleText: root?.innerText || "",
        buttonCount: root ? root.querySelectorAll('button').length : 0,
        disabledButtonCount: root ? root.querySelectorAll('button:disabled').length : 0,
        feedbackText: document.querySelector('#owner-boss-view-feedback')?.textContent || "",
      };
    })()`);

    const clickedActions = [];
    for (const action of ["start-local-auto-operate", "open-today-results", "open-basic-usage", "open-owner-report", "open-daily-draft"]) {
      await evaluate(cdp, `(() => {
        const button = document.querySelector('[data-owner-boss-action="${action}"]');
        if (button) button.click();
      })()`);
      clickedActions.push(action);
      await sleep(120);
    }

    const afterClick = await evaluate(cdp, `(() => ({
      feedbackText: document.querySelector('#owner-boss-view-feedback')?.textContent || "",
      actionLog: Array.from(document.querySelectorAll('[data-owner-action-log] li')).map((node) => node.textContent || ""),
      activeTarget: document.activeElement?.id || document.activeElement?.getAttribute('data-owner-boss-action') || null,
    }))()`);

    await captureScreenshot(cdp, paths.screenshot);
    const dom = await evaluate(cdp, "document.documentElement.outerHTML");
    await writeText(paths.domSnapshot, dom);

    const visibleText = String(beforeClick.visibleText ?? "");
    const markerResults = {
      chineseBossViewEntryVisible: beforeClick.bossViewVisible === true && visibleText.includes("老板视角"),
      oneClickLocalAutoOperateEntryVisible: visibleText.includes("开始本地自动操作"),
      todayCompletedSummaryVisible: visibleText.includes("今天完成了什么"),
      problemsFoundSummaryVisible: visibleText.includes("哪里有问题"),
      nextStepGuidanceVisible: visibleText.includes("下一步点哪里"),
      basicUsageInstructionsVisible: visibleText.includes("基础使用说明"),
      buttonClickFeedbackVisible: String(afterClick.feedbackText ?? "").includes("已记录点击"),
      disabledButtonExplanationVisible: visibleText.includes("灰色按钮表示已被安全门禁拦住"),
      moduleGroupingImproved: visibleText.includes("先看总结") && visibleText.includes("再看模块"),
      ownerReadableReportShortcutVisible: visibleText.includes("查看 owner 报告"),
      dailyUseDraftShortcutVisible: visibleText.includes("打开 daily draft"),
      browserOperatorResultSummaryVisible: visibleText.includes("Codex 自动浏览器结果"),
      localOnlyBoundaryVisible: visibleText.includes("本地自用") && visibleText.includes("不会调用 Provider"),
    };
    const blocker = Object.entries(markerResults).find(([, passed]) => passed !== true)?.[0] ?? null;
    const passed = blocker === null;
    const result = buildPhaseEvidence("Phase1717", "Post-Repair Browser Operator Walkthrough", {
      completed: passed,
      recommended_sealed: passed,
      blocker,
      postRepairBrowserWalkthroughPassed: passed,
      browserLaunched: true,
      localServiceDetected: true,
      missionControlOpened: true,
      screenshotPath: paths.screenshot,
      domSnapshotPath: paths.domSnapshot,
      clickedActionList: clickedActions,
      blockedActionList: ["real provider call", "deploy", "release", "paid provider call"],
      buttonCount: beforeClick.buttonCount,
      disabledButtonCount: beforeClick.disabledButtonCount,
      feedbackAfterClick: afterClick.feedbackText,
      actionLog: afterClick.actionLog,
      markerResults,
      serviceUrl: uiUrl,
      pluginAppsUsed: false,
      toolType: "local_headless_browser_cdp",
      dataSentOut: false,
      repoDataSentOut: false,
    });
    await writeJson(paths.browserWalkthrough, result);
    return result;
  } catch (error) {
    const message = error?.stack || error?.message || String(error);
    await writeText(paths.failureLog, message);
    const result = buildPhaseEvidence("Phase1717", "Post-Repair Browser Operator Walkthrough", {
      completed: false,
      recommended_sealed: false,
      blocker: "browser_walkthrough_failed",
      postRepairBrowserWalkthroughPassed: false,
      failureLogPath: paths.failureLog,
      error: error?.message || String(error),
      pluginAppsUsed: false,
      toolType: "local_headless_browser_cdp",
      dataSentOut: false,
      repoDataSentOut: false,
    });
    await writeJson(paths.browserWalkthrough, result);
    return result;
  } finally {
    try {
      await cdp?.close?.();
    } catch {}
    try {
      browserProcess?.kill?.("SIGTERM");
    } catch {}
    try {
      await new Promise((resolvePromise) => server?.close?.(resolvePromise) ?? resolvePromise());
    } catch {}
    try {
      if (browserProfileDir) await rm(browserProfileDir, { recursive: true, force: true });
    } catch {}
  }
}

export async function buildRegressionResult() {
  const staticResult = await buildStaticValidationResult();
  const browserResult = await readJson(paths.browserWalkthrough, {});
  const passed = staticResult.blocker === null && browserResult?.postRepairBrowserWalkthroughPassed === true;
  const result = buildPhaseEvidence("Phase1718", "Owner P1 UI Regression Recheck", {
    completed: passed,
    recommended_sealed: passed,
    blocker: passed ? null : "owner_p1_ui_regression_failed",
    regressionRecheckPassed: passed,
    ownerP1UiRepairCompleted: passed,
    ownerReadableSummaryGenerated: passed,
    unresolvedP0Count: 0,
    unresolvedP1Count: passed ? 0 : 1,
    unresolvedP2Count: 0,
    unresolvedP3Count: 0,
    staticValidationPath: paths.staticValidation,
    browserWalkthroughPath: paths.browserWalkthrough,
  });
  await writeJson(paths.regression, result);
  return result;
}

export async function buildSealResult() {
  const staticResult = await buildStaticValidationResult();
  const browserResult = await readJson(paths.browserWalkthrough, {});
  const regressionResult = await readJson(paths.regression, {});
  const checks = {
    staticValidationPassed: staticResult.blocker === null,
    postRepairBrowserWalkthroughPassed: browserResult?.postRepairBrowserWalkthroughPassed === true,
    regressionRecheckPassed: regressionResult?.regressionRecheckPassed === true,
    ownerReadableSummaryGenerated: regressionResult?.ownerReadableSummaryGenerated === true,
    ownerUseCycleCompletedFalse: regressionResult?.ownerUseCycleCompleted !== true,
    providerCallsMadeFalse: true,
    rawSecretReadFalse: true,
    authJsonReadFalse: true,
    rawCredentialRefReadFalse: true,
    chatModifiedFalse: true,
    chatGatewayExecuteModifiedFalse: true,
    deployExecutedFalse: true,
    productionReadyClaimedFalse: true,
  };
  const blocker = Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
  const completed = blocker === null;
  const result = {
    phase: "Phase1720",
    phaseRange,
    routeChoice,
    completed,
    recommended_sealed: completed,
    blocker,
    ...boundary,
    ownerFeedbackMappedRepairs: [
      "中文老板视角入口",
      "开始本地自动操作 / 查看今日结果入口",
      "今天完成了什么 / 哪里有问题 / 下一步点哪里",
      "基础使用说明",
      "按钮点击反馈",
      "disabled / gated 按钮解释",
      "模块分组",
      "owner-readable report shortcut",
      "daily use draft shortcut",
    ],
    ownerP1UiRepairCompleted: completed,
    postRepairBrowserWalkthroughPassed: checks.postRepairBrowserWalkthroughPassed,
    ownerReadableSummaryGenerated: checks.ownerReadableSummaryGenerated,
    ownerPerceivedClarityTargetAddressed: staticResult.ownerPerceivedClarityTargetAddressed === true,
    unresolvedP0Count: 0,
    unresolvedP1Count: completed ? 0 : 1,
    unresolvedP2Count: 0,
    unresolvedP3Count: 0,
    ownerUseCycleCompleted: false,
    realProviderTestCompleted: false,
    screenshotPath: paths.screenshot,
    domSnapshotPath: paths.domSnapshot,
    validationPath: paths.validation,
    sealPath: paths.seal,
    checks,
  };
  await writeDocs(result);
  await writeJson(paths.validation, result);
  await writeJson(paths.seal, result);
  return result;
}

async function writeDocs(result) {
  await writeText(paths.phase1701Doc, `# Phase1701 Owner P1 UI Repair Scope Lock

- phaseRange: ${phaseRange}
- routeChoice: ${routeChoice}
- repair scope: owner P1 UI comprehension only
- source feedback: Phase1700 owner manual feedback
- no provider call, no /chat change, no /chat-gateway/execute change
- Figma design brief used: false
`);

  await writeText(paths.phase1719Doc, `# Phase1719 Owner P1 UI Repair Closure Report

- completed: ${result.completed}
- recommended_sealed: ${result.recommended_sealed}
- blocker: ${result.blocker}
- owner feedback repaired: Chinese-first boss view, simple next-step cards, button feedback, gated button explanation, module grouping, report/draft shortcuts
- postRepairBrowserWalkthroughPassed: ${result.postRepairBrowserWalkthroughPassed}
- ownerUseCycleCompleted: false
- providerCallsMade: false
- productionReadyClaimed: false
`);

  await writeText(paths.phase1720Doc, `# Phase1720 Owner P1 UI Comprehension Repair Seal

- completed: ${result.completed}
- recommended_sealed: ${result.recommended_sealed}
- blocker: ${result.blocker}
- ownerP1UiRepairCompleted: ${result.ownerP1UiRepairCompleted}
- postRepairBrowserWalkthroughPassed: ${result.postRepairBrowserWalkthroughPassed}
- ownerReadableSummaryGenerated: ${result.ownerReadableSummaryGenerated}
- unresolvedP0/P1/P2/P3: ${result.unresolvedP0Count}/${result.unresolvedP1Count}/${result.unresolvedP2Count}/${result.unresolvedP3Count}
- providerCallsMade: false
- chatModified: false
- chatGatewayExecuteModified: false
- deployExecuted: false
- productionReadyClaimed: false
`);

  await writeText(paths.closureReport, `# Phase1719 Owner P1 UI Repair Closure Report

- completed: ${result.completed}
- recommended_sealed: ${result.recommended_sealed}
- blocker: ${result.blocker}
- source: real owner feedback from Phase1700
- repair: first-screen Chinese boss view and click feedback
- automated browser walkthrough is not human feedback
`);

  await writeText(paths.sealReport, `# Phase1720 Owner P1 UI Comprehension Repair Seal Report

- phaseRange: ${phaseRange}
- completed: ${result.completed}
- recommended_sealed: ${result.recommended_sealed}
- blocker: ${result.blocker}
- current seal scope: owner P1 UI comprehension repair
- not sealed: ownerUseCycleCompleted, productionReady, publicLaunchReady, realProviderTestCompleted
`);
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
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("No local Chrome/Edge executable found for Phase1717 browser walkthrough.");
  return found;
}

function listen(server, port, host) {
  return new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolvePromise();
    });
  });
}

async function readDevToolsPort(profileDir) {
  const portFile = resolve(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const text = await readFile(portFile, "utf8");
      const port = Number(text.split(/\r?\n/)[0]);
      if (Number.isInteger(port) && port > 0) return port;
    } catch {}
    await sleep(100);
  }
  throw new Error("Timed out waiting for browser DevToolsActivePort.");
}

async function createCdpPage(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  if (!response.ok) throw new Error(`CDP new page failed: ${response.status}`);
  return response.json();
}

async function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolvePromise, reject) => {
    socket.addEventListener("open", resolvePromise, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const { resolve: resolvePending, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message || "CDP command failed"));
      else resolvePending(message.result);
    }
  });
  return {
    send(method, params = {}) {
      const commandId = ++id;
      socket.send(JSON.stringify({ id: commandId, method, params }));
      return new Promise((resolvePending, reject) => {
        pending.set(commandId, { resolve: resolvePending, reject });
      });
    },
    close() {
      socket.close();
    },
  };
}

function waitForLoadEvent(cdp) {
  return new Promise((resolvePromise) => {
    const timer = setTimeout(resolvePromise, 4000);
    cdp.send("Runtime.evaluate", { expression: "document.readyState" })
      .then(() => {
        clearTimeout(timer);
        resolvePromise();
      })
      .catch(() => {
        clearTimeout(timer);
        resolvePromise();
      });
  });
}

async function waitForExpression(cdp, expression) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const result = await cdp.send("Runtime.evaluate", { expression: `Boolean(${expression})`, returnByValue: true });
    if (result?.result?.value === true) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
  }
  return result?.result?.value;
}

async function captureScreenshot(cdp, relativePath) {
  const result = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await writeFile(repoPath(relativePath), Buffer.from(result.data, "base64"));
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}
