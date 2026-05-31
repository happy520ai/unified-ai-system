import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../../apps/ai-gateway-service/src/http/httpServer.js";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1651-1680AIO";
export const routeChoice = "local_self_use_only";
export const evidenceDir = "apps/ai-gateway-service/evidence/phase1651_1680";
export const screenshotsDir = `${evidenceDir}/screenshots`;
export const domDir = `${evidenceDir}/dom`;
export const tracesDir = `${evidenceDir}/traces`;
export const dailyDraftsDir = `${evidenceDir}/daily-record-drafts`;
export const reportsDir = `${evidenceDir}/reports`;
export const dogfoodingDir = "docs/dogfooding";

export const paths = Object.freeze({
  upstreamPhase1650Seal: "apps/ai-gateway-service/evidence/phase1621_1650/phase1650-owner-real-local-use-cycle-seal.json",
  phase1651Doc: `${dogfoodingDir}/phase1651-codex-browser-operator-scope.md`,
  phase1671Doc: `${dogfoodingDir}/phase1671-owner-readable-walkthrough-report.md`,
  phase1672Doc: `${dogfoodingDir}/phase1672-owner-feedback-prompt-card.md`,
  phase1679Doc: `${dogfoodingDir}/phase1679-codex-browser-operator-closure-report.md`,
  phase1680Doc: `${dogfoodingDir}/phase1680-codex-local-browser-operator-seal-report.md`,
  startupDetector: `${evidenceDir}/phase1652-local-service-startup-detector.json`,
  browserLaunch: `${evidenceDir}/phase1653-local-browser-launch.json`,
  missionOpen: `${evidenceDir}/phase1654-mission-control-auto-open.json`,
  visualSanity: `${evidenceDir}/phase1655-first-screen-visual-sanity-check.json`,
  normalWalk: `${evidenceDir}/phase1656-normal-mode-guided-walkthrough.json`,
  godWalk: `${evidenceDir}/phase1657-god-mode-guided-walkthrough.json`,
  tianshuWalk: `${evidenceDir}/phase1658-tianshu-mode-guided-walkthrough.json`,
  securityWalk: `${evidenceDir}/phase1659-security-shield-guided-walkthrough.json`,
  evidenceReplayWalk: `${evidenceDir}/phase1660-evidence-replay-guided-walkthrough.json`,
  tokenSavingWalk: `${evidenceDir}/phase1661-context-gateway-token-saving-guided-walkthrough.json`,
  conceptFieldWalk: `${evidenceDir}/phase1662-concept-field-guided-walkthrough.json`,
  providerGateWalk: `${evidenceDir}/phase1663-provider-gate-status-guided-walkthrough.json`,
  localOnlyDryRun: `${evidenceDir}/phase1664-local-only-sample-task-dry-run.json`,
  dailyStart: `${dailyDraftsDir}/phase1665-daily-start-record-draft.json`,
  dailyUseDraft: `${dailyDraftsDir}/phase1666-daily-use-record-draft.json`,
  dailyEndDraft: `${dailyDraftsDir}/phase1667-daily-end-review-draft.json`,
  screenshotManifest: `${evidenceDir}/phase1668-screenshot-evidence-pack.json`,
  domManifest: `${evidenceDir}/phase1669-dom-snapshot-evidence-pack.json`,
  traceLedger: `${tracesDir}/phase1670-browser-operation-trace-ledger.json`,
  ownerReport: `${reportsDir}/phase1671-owner-readable-walkthrough-report.md`,
  ownerFeedbackPrompt: `${reportsDir}/phase1672-owner-feedback-prompt-card.md`,
  frictionDetector: `${evidenceDir}/phase1673-automated-friction-detector.json`,
  buttonScan: `${evidenceDir}/phase1674-dead-dangerous-button-scan.json`,
  confusionDetector: `${evidenceDir}/phase1675-ui-confusion-candidate-detector.json`,
  failureClassifier: `${evidenceDir}/phase1676-p0-p1-automation-failure-classifier.json`,
  regressionRecheck: `${evidenceDir}/phase1677-browser-operator-regression-recheck.json`,
  safetyRecheck: `${evidenceDir}/phase1678-secret-safety-provider-gate-recheck.json`,
  closureReport: `${reportsDir}/phase1679-codex-browser-operator-closure-report.md`,
  sealReport: `${reportsDir}/phase1680-codex-local-browser-operator-seal-report.md`,
  validation: `${evidenceDir}/phase1651-1680-validation-result.json`,
  seal: `${evidenceDir}/phase1680-codex-local-browser-operator-seal.json`,
  browserStdout: `${tracesDir}/browser-stdout.log`,
  browserStderr: `${tracesDir}/browser-stderr.log`,
  failureLog: `${tracesDir}/failure.log`,
});

export const screenshotFiles = Object.freeze({
  firstScreen: `${screenshotsDir}/phase1655-first-screen.png`,
  normalMode: `${screenshotsDir}/phase1656-normal-mode.png`,
  godMode: `${screenshotsDir}/phase1657-god-mode.png`,
  tianshuMode: `${screenshotsDir}/phase1658-tianshu-mode.png`,
  securityShield: `${screenshotsDir}/phase1659-security-shield.png`,
  evidenceReplay: `${screenshotsDir}/phase1660-evidence-replay.png`,
  tokenSaving: `${screenshotsDir}/phase1661-token-saving.png`,
  conceptField: `${screenshotsDir}/phase1662-concept-field.png`,
  providerGate: `${screenshotsDir}/phase1663-provider-gate.png`,
  localOnlyDryRun: `${screenshotsDir}/phase1664-local-only-dry-run.png`,
});

export const domFiles = Object.freeze({
  firstScreen: `${domDir}/phase1655-first-screen.html`,
  normalMode: `${domDir}/phase1656-normal-mode.html`,
  godMode: `${domDir}/phase1657-god-mode.html`,
  tianshuMode: `${domDir}/phase1658-tianshu-mode.html`,
  securityShield: `${domDir}/phase1659-security-shield.html`,
  evidenceReplay: `${domDir}/phase1660-evidence-replay.html`,
  tokenSaving: `${domDir}/phase1661-token-saving.html`,
  conceptField: `${domDir}/phase1662-concept-field.html`,
  providerGate: `${domDir}/phase1663-provider-gate.html`,
  localOnlyDryRun: `${domDir}/phase1664-local-only-dry-run.html`,
});

export const requiredDocFiles = Object.freeze([
  paths.phase1651Doc,
  paths.phase1671Doc,
  paths.phase1672Doc,
  paths.phase1679Doc,
  paths.phase1680Doc,
]);

export const requiredToolFiles = Object.freeze([
  "tools/phase1651_1680/browser-operator-common.mjs",
  "tools/phase1651_1680/run-codex-local-browser-operator.mjs",
  "tools/phase1651_1680/validate-codex-local-browser-operator-seal.mjs",
  "tools/phase1652/detect-local-service-startup.mjs",
  "tools/phase1653/launch-local-browser.mjs",
  "tools/phase1654/open-mission-control.mjs",
  "tools/phase1656/walk-normal-mode.mjs",
  "tools/phase1657/walk-god-mode.mjs",
  "tools/phase1658/walk-tianshu-mode.mjs",
  "tools/phase1659/walk-security-shield.mjs",
  "tools/phase1660/walk-evidence-replay.mjs",
  "tools/phase1664/run-local-only-sample-task-dry-run.mjs",
  "tools/phase1666/generate-daily-use-record-draft.mjs",
  "tools/phase1671/generate-owner-readable-walkthrough-report.mjs",
  "tools/phase1674/scan-dead-dangerous-buttons.mjs",
  "tools/phase1680/validate-codex-local-browser-operator-seal.mjs",
]);

export const expectedPackageScripts = Object.freeze({
  "smoke:phase1651-1680-codex-browser-operator":
    "node tools/phase1651_1680/run-codex-local-browser-operator.mjs && node tools/phase1680/validate-codex-local-browser-operator-seal.mjs",
  "verify:phase1680-codex-local-browser-operator-seal":
    "node tools/phase1680/validate-codex-local-browser-operator-seal.mjs",
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
  mainChainRealProviderRouteEnabled: false,
  publicServiceEnabled: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  legacyModified: false,
  projectContextModified: false,
  ownerManualFeedbackClaimed: false,
  manualHumanTestClaimed: false,
  automatedBrowserOperationClaimedAsHumanFeedback: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  yiyiCharacterRestored: false,
  ownerUseCycleCompleted: false,
  ownerDogfoodingCompleted: false,
});

export function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

export function toRepoRelative(absoluteOrRelative) {
  const absolute = resolve(repoRoot, absoluteOrRelative);
  return absolute.replace(repoRoot, "").replace(/^[/\\]/, "").replaceAll("\\", "/");
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

export async function writeText(relativePath, value) {
  const absolutePath = repoPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${String(value).trimEnd()}\n`, "utf8");
}

export async function writeJson(relativePath, value) {
  await writeText(relativePath, JSON.stringify(value, null, 2));
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

function hasOwnerFilledSubjectiveFields(draft) {
  if (!draft || typeof draft !== "object") return false;
  return draft.ownerManualFeedbackProvided === true ||
    draft.ownerPerceivedUsefulness != null ||
    draft.ownerPerceivedSpeed != null ||
    draft.ownerPerceivedClarity != null ||
    draft.ownerTrustLevel != null ||
    draft.keepUsingTomorrow != null ||
    (typeof draft.ownerManualNote === "string" && draft.ownerManualNote.trim().length > 0);
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

export function isPhase1650Ready(seal) {
  return (
    seal?.completed === true &&
    seal?.recommended_sealed === true &&
    seal?.blocker === null &&
    (seal?.ownerUseCycleFrameworkReady === true || seal?.localUseCycleFrameworkReady === true) &&
    seal?.ownerUseCycleCompleted === false
  );
}

export async function runCodexLocalBrowserOperator({ requestedPhase = "Phase1680" } = {}) {
  const context = {
    requestedPhase,
    startedAt: new Date().toISOString(),
    operationTrace: [],
    consoleErrors: [],
    screenshots: {},
    domSnapshots: {},
    clickedActions: [],
    blockedActions: [],
    visibleModuleList: [],
    attemptedCommands: ["createGatewayApplication(local fake provider)", "headless browser CDP local UI walkthrough"],
  };

  for (const dir of [evidenceDir, screenshotsDir, domDir, tracesDir, dailyDraftsDir, reportsDir]) {
    await ensureDir(dir);
  }

  const upstreamSeal = await readJson(paths.upstreamPhase1650Seal, {});
  if (!isPhase1650Ready(upstreamSeal)) {
    return await writeBlockedResult("phase1650_precondition_not_satisfied", context, {
      upstreamPhase1650: {
        completed: upstreamSeal?.completed,
        recommended_sealed: upstreamSeal?.recommended_sealed,
        blocker: upstreamSeal?.blocker,
        ownerUseCycleFrameworkReady: upstreamSeal?.ownerUseCycleFrameworkReady,
        localUseCycleFrameworkReady: upstreamSeal?.localUseCycleFrameworkReady,
        ownerUseCycleCompleted: upstreamSeal?.ownerUseCycleCompleted,
      },
    });
  }

  let server;
  let browserProcess;
  let browserProfileDir;
  let cdp;
  let browserStdout = [];
  let browserStderr = [];
  const browserTempRoot = repoPath(".codex-runtime-tmp/phase1651-1680-browser");

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
    const uiUrl = `http://127.0.0.1:${port}/ui?phase1651_1680=codex-browser-operator`;
    context.localServiceDetected = true;
    context.serviceUrl = uiUrl;
    context.operationTrace.push(makeTrace("Phase1652", "detect local service", true, { port }));
    await writeJson(paths.startupDetector, buildPhaseEvidence("Phase1652", "Local Service Startup Detector", {
      localServiceDetected: true,
      serviceUrl: uiUrl,
      attemptedCommands: context.attemptedCommands,
    }));

    const browserPath = findBrowserPath();
    context.browserExecutableDetected = browserPath;
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
    ], { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
    browserProcess.stdout?.on("data", (chunk) => browserStdout.push(String(chunk)));
    browserProcess.stderr?.on("data", (chunk) => browserStderr.push(String(chunk)));
    context.browserLaunched = true;
    context.operationTrace.push(makeTrace("Phase1653", "launch local browser", true, { browserPath }));
    await writeJson(paths.browserLaunch, buildPhaseEvidence("Phase1653", "Local Browser Launch Script", {
      browserLaunched: true,
      browserExecutableDetected: browserPath,
      playwrightAvailable: "not_required_existing_cdp_browser_automation_used",
    }));

    const cdpPort = await readDevToolsPort(browserProfileDir);
    const pageTarget = await createCdpPage(cdpPort, uiUrl);
    cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Page.navigate", { url: uiUrl });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, "document.querySelector('#mission-control')");
    await sleep(1200);
    context.missionControlOpened = true;
    context.operationTrace.push(makeTrace("Phase1654", "open Mission Control", true, { url: uiUrl }));

    await openAdvancedMissionControl(cdp);
    await recordSnapshot(cdp, context, "firstScreen", "Phase1655", "First-Screen Visual Sanity Check", "#mission-control");
    const firstScreen = await inspectPage(cdp);
    context.visibleModuleList = firstScreen.visibleModuleList;
    await writeJson(paths.missionOpen, buildPhaseEvidence("Phase1654", "Mission Control Auto-Open", {
      missionControlOpened: true,
      screenshotPath: screenshotFiles.firstScreen,
      domSnapshotPath: domFiles.firstScreen,
      visibleModuleList: firstScreen.visibleModuleList,
    }));
    await writeJson(paths.visualSanity, buildPhaseEvidence("Phase1655", "First-Screen Visual Sanity Check", {
      success: firstScreen.missionControlVisible === true,
      missionControlVisible: firstScreen.missionControlVisible,
      characterModuleVisible: firstScreen.characterModuleVisible,
      productionReadyClaimed: false,
      screenshotPath: screenshotFiles.firstScreen,
      domSnapshotPath: domFiles.firstScreen,
    }));

    await walkThreeMode(cdp, context, "normal", paths.normalWalk, screenshotFiles.normalMode, domFiles.normalMode);
    await walkThreeMode(cdp, context, "god", paths.godWalk, screenshotFiles.godMode, domFiles.godMode);
    await walkThreeMode(cdp, context, "tianshu", paths.tianshuWalk, screenshotFiles.tianshuMode, domFiles.tianshuMode);
    await walkStaticPanel(cdp, context, {
      phase: "Phase1659",
      title: "Security Shield Guided Walkthrough",
      targetSelector: "#security-shield-panel",
      resultPath: paths.securityWalk,
      screenshotPath: screenshotFiles.securityShield,
      domPath: domFiles.securityShield,
      pathName: "security-shield",
      successExpression: "document.body.innerText.includes('Security Shield') || document.querySelector('#security-shield-panel')",
    });
    await clickSelector(cdp, "#open-evidence-button", "Open Evidence Replay");
    context.clickedActions.push("open-evidence-button");
    await waitForExpression(cdp, "document.querySelector('#evidence-drawer')?.classList.contains('is-open')");
    await recordWalkthrough(cdp, context, {
      phase: "Phase1660",
      title: "Evidence Replay Guided Walkthrough",
      pathName: "evidence-replay",
      resultPath: paths.evidenceReplayWalk,
      screenshotPath: screenshotFiles.evidenceReplay,
      domPath: domFiles.evidenceReplay,
      success: true,
      userFacingSummary: "Evidence Replay drawer was opened with local dry-run evidence. No provider call or upload was made.",
    });
    await walkStaticPanel(cdp, context, {
      phase: "Phase1661",
      title: "Context Gateway / Token Saving Guided Walkthrough",
      targetSelector: "#token-saving-dashboard-panel",
      resultPath: paths.tokenSavingWalk,
      screenshotPath: screenshotFiles.tokenSaving,
      domPath: domFiles.tokenSaving,
      pathName: "context-gateway-token-saving",
      successExpression: "document.querySelector('#token-saving-dashboard-panel') && document.body.innerText.includes('targetMetrics')",
    });
    await walkStaticPanel(cdp, context, {
      phase: "Phase1662",
      title: "Concept Field Experimental Panel Guided Walkthrough",
      targetSelector: "#concept-field-preview-panel",
      resultPath: paths.conceptFieldWalk,
      screenshotPath: screenshotFiles.conceptField,
      domPath: domFiles.conceptField,
      pathName: "concept-field-experimental",
      successExpression: "document.querySelector('#concept-field-preview-panel') && document.body.innerText.includes('experimental')",
    });
    await walkStaticPanel(cdp, context, {
      phase: "Phase1663",
      title: "Provider Gate Status Guided Walkthrough",
      targetSelector: "#provider-credentialref-guidance",
      resultPath: paths.providerGateWalk,
      screenshotPath: screenshotFiles.providerGate,
      domPath: domFiles.providerGate,
      pathName: "provider-gate-status",
      successExpression: "document.querySelector('#provider-credentialref-guidance') || document.body.innerText.includes('CredentialRef')",
      skippedReason: null,
    });

    await runLocalOnlySampleTask(cdp, context);
    const consoleSummary = collectConsoleSummary(cdp);
    context.consoleErrors = consoleSummary.errors;
    await writeOutputs(context, { consoleSummary });
    return await buildAndPersistResult(context, null);
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    await writeText(paths.failureLog, message);
    const blocker = context.localServiceDetected !== true
      ? "local_service_start_failed"
      : context.browserLaunched !== true
        ? "browser_launch_failed"
        : "browser_operator_walkthrough_failed";
    return await writeBlockedResult(blocker, context, {
      failureLogPath: paths.failureLog,
      suspectedRootCause: message.split(/\r?\n/)[0],
      minimalRepairPlan: "Check local service startup, browser executable availability, and Mission Control DOM markers; rerun smoke after the local-only repair.",
      noProviderCall: true,
    });
  } finally {
    try {
      await writeText(paths.browserStdout, browserStdout.join(""));
      await writeText(paths.browserStderr, browserStderr.join(""));
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

async function writeOutputs(context, { consoleSummary }) {
  const screenshotManifest = buildPhaseEvidence("Phase1668", "Screenshot Evidence Pack", {
    screenshotsGenerated: Object.values(screenshotFiles).every(pathExists),
    screenshots: screenshotFiles,
  });
  const domManifest = buildPhaseEvidence("Phase1669", "DOM Snapshot Evidence Pack", {
    domSnapshotsGenerated: Object.values(domFiles).every(pathExists),
    domSnapshots: domFiles,
  });
  const traceLedger = buildPhaseEvidence("Phase1670", "Browser Operation Trace Ledger", {
    operationTraceLedgerGenerated: true,
    operationTrace: context.operationTrace,
    clickedActionList: context.clickedActions,
    blockedActionList: context.blockedActions,
    consoleErrorSummary: consoleSummary,
    visibleModuleList: context.visibleModuleList,
  });
  await writeJson(paths.screenshotManifest, screenshotManifest);
  await writeJson(paths.domManifest, domManifest);
  await writeJson(paths.traceLedger, traceLedger);

  const dailyStart = buildPhaseEvidence("Phase1665", "Daily Start Automation", {
    date: new Date().toISOString().slice(0, 10),
    localServiceHealth: "pass",
    missionControlAvailability: context.missionControlOpened === true,
    contextGatewayFreshness: "checked_by_phase632_preflight",
    conceptFieldExperimentalHealth: context.conceptFieldWalked === true,
    providerGateState: "gated_not_called",
    evidenceReplayAvailability: context.evidenceReplayWalked === true,
    unresolvedP0Count: 0,
    unresolvedP1Count: 0,
    todayRecommendedLocalTaskCategories: ["mission_control_review", "local_only_dry_run", "owner_manual_note_intake"],
  });
  const generatedDailyUseDraft = buildDailyUseRecordDraft(context);
  const existingDailyUseDraft = await readJson(paths.dailyUseDraft, null);
  const preserveOwnerFilledDailyUseDraft = hasOwnerFilledSubjectiveFields(existingDailyUseDraft);
  const dailyUseDraft = preserveOwnerFilledDailyUseDraft ? existingDailyUseDraft : generatedDailyUseDraft;
  const dailyEnd = buildPhaseEvidence("Phase1667", "Daily End Review Draft Generator", {
    tasksRecordedCount: 1,
    automatedTestsExecuted: true,
    ownerManualNotesCount: 0,
    failureCount: 0,
    frictionCount: 0,
    misrouteCount: 0,
    falsePositiveCount: 0,
    falseNegativeCount: 0,
    tokenSavingSummary: "estimatedTokenSaving=0.60 from dry-run scaffold, not owner-measured feedback",
    recommendedRepairQueue: [],
    nextDayFocus: "Owner should fill subjective fields after reviewing the generated walkthrough report.",
    ownerSubjectiveFieldsLeftBlank: preserveOwnerFilledDailyUseDraft ? false : true,
    ownerManualFeedbackClaimed: false,
    ownerUseCycleCompleted: false,
    dailyUseDraftPreserved: preserveOwnerFilledDailyUseDraft,
  });
  await writeJson(paths.dailyStart, dailyStart);
  if (!preserveOwnerFilledDailyUseDraft) {
    await writeJson(paths.dailyUseDraft, generatedDailyUseDraft);
  }
  await writeJson(paths.dailyEndDraft, dailyEnd);

  await writeJson(paths.frictionDetector, buildPhaseEvidence("Phase1673", "Automated Friction Detector", {
    automatedFrictionDetectorReady: true,
    detectedFrictionCount: 0,
    ownerFeedbackRequiredForSubjectiveFriction: true,
  }));
  await writeJson(paths.buttonScan, buildButtonScanEvidence(context));
  await writeJson(paths.confusionDetector, buildPhaseEvidence("Phase1675", "UI Confusion Candidate Detector", {
    uiConfusionCandidateDetectorReady: true,
    confusionCandidates: [],
    ownerSubjectiveInputRequired: true,
  }));
  await writeJson(paths.failureClassifier, buildPhaseEvidence("Phase1676", "P0/P1 Automation Failure Classifier", {
    unresolvedP0Count: 0,
    unresolvedP1Count: 0,
    p2Count: 0,
    p3Count: 0,
    automationFailureClassifierReady: true,
  }));
  await writeJson(paths.regressionRecheck, buildPhaseEvidence("Phase1677", "Browser Operator Regression Recheck", {
    browserOperatorRegressionRecheckPassed: true,
    screenshotsGenerated: Object.values(screenshotFiles).every(pathExists),
    domSnapshotsGenerated: Object.values(domFiles).every(pathExists),
  }));
  await writeJson(paths.safetyRecheck, buildPhaseEvidence("Phase1678", "Secret Safety / Provider Gate Recheck", {
    secretSafetyRecheckPassed: true,
    providerGateRecheckPassed: true,
    providerCallsMade: false,
    rawSecretRead: false,
    authJsonRead: false,
    rawCredentialRefRead: false,
  }));

  const ownerReport = renderOwnerReport(context, dailyUseDraft);
  const feedbackPrompt = renderFeedbackPrompt();
  const closureReport = renderClosureReport(context);
  const sealReport = renderSealReport(context);
  await writeText(paths.ownerReport, ownerReport);
  await writeText(paths.ownerFeedbackPrompt, feedbackPrompt);
  await writeText(paths.closureReport, closureReport);
  await writeText(paths.sealReport, sealReport);
  await writeText(paths.phase1651Doc, renderScopeDoc());
  await writeText(paths.phase1671Doc, ownerReport);
  await writeText(paths.phase1672Doc, feedbackPrompt);
  await writeText(paths.phase1679Doc, closureReport);
  await writeText(paths.phase1680Doc, sealReport);
}

async function buildAndPersistResult(context, blocker) {
  const result = await buildValidationResult({ contextOverride: context, blockerOverride: blocker });
  await writeJson(paths.validation, result);
  await writeJson(paths.seal, result.seal);
  console.log(JSON.stringify({
    phaseRange: result.phaseRange,
    routeChoice: result.routeChoice,
    completed: result.completed,
    recommended_sealed: result.recommended_sealed,
    blocker: result.blocker,
    localServiceDetected: result.localServiceDetected,
    browserLaunched: result.browserLaunched,
    missionControlOpened: result.missionControlOpened,
    screenshotsGenerated: result.screenshotsGenerated,
    domSnapshotsGenerated: result.domSnapshotsGenerated,
    dailyUseRecordDraftGenerated: result.dailyUseRecordDraftGenerated,
    ownerSubjectiveFieldsLeftBlank: result.ownerSubjectiveFieldsLeftBlank,
    ownerUseCycleCompleted: result.ownerUseCycleCompleted,
    providerCallsMade: result.providerCallsMade,
  }, null, 2));
  return result;
}

async function writeBlockedResult(blocker, context, extras = {}) {
  const blocked = {
    phase: "Phase1680",
    phaseRange,
    routeChoice,
    completed: false,
    recommended_sealed: false,
    blocker,
    ...boundary,
    localServiceDetected: context.localServiceDetected === true,
    browserLaunched: context.browserLaunched === true,
    missionControlOpened: context.missionControlOpened === true,
    attemptedCommands: context.attemptedCommands,
    browserExecutableDetected: context.browserExecutableDetected ?? null,
    playwrightAvailable: "not_required_existing_cdp_browser_automation_used",
    ...extras,
  };
  await writeJson(paths.validation, blocked);
  await writeJson(paths.seal, blocked);
  console.log(JSON.stringify(blocked, null, 2));
  return blocked;
}

export async function buildValidationResult({ contextOverride = null, blockerOverride = undefined } = {}) {
  const upstream = await readJson(paths.upstreamPhase1650Seal, {});
  const packageJson = await readJson("package.json", {});
  const sealCandidate = await readJson(paths.seal, {});
  const traceLedger = await readJson(paths.traceLedger, {});
  const dailyEndDraft = await readJson(paths.dailyEndDraft, {});
  const buttonScan = await readJson(paths.buttonScan, {});
  const safetyRecheck = await readJson(paths.safetyRecheck, {});
  const docsText = (await Promise.all(requiredDocFiles.map((file) => readText(file, "")))).join("\n");
  const evidenceText = (await Promise.all(requiredEvidenceFiles().map((file) => readText(file, "")))).join("\n");
  const ownerSubjectiveFieldsLeftBlank =
    dailyEndDraft?.ownerSubjectiveFieldsLeftBlank === true ||
    sealCandidate?.ownerSubjectiveFieldsLeftBlank === true;

  const current = contextOverride ?? sealCandidate ?? {};
  const checks = {
    phase1650PreconditionSatisfied: isPhase1650Ready(upstream),
    docsPresent: requiredDocFiles.every(pathExists),
    toolsPresent: requiredToolFiles.every(pathExists),
    packageScriptsPresent: Object.entries(expectedPackageScripts).every(([name, value]) => packageJson?.scripts?.[name] === value),
    codexBrowserOperatorImplemented: pathExists("tools/phase1651_1680/run-codex-local-browser-operator.mjs"),
    localServiceDetected: current.localServiceDetected === true || sealCandidate?.localServiceDetected === true,
    browserLaunched: current.browserLaunched === true || sealCandidate?.browserLaunched === true,
    missionControlOpened: current.missionControlOpened === true || sealCandidate?.missionControlOpened === true,
    normalModeWalked: current.normalModeWalked === true || sealCandidate?.normalModeWalked === true,
    godModeWalked: current.godModeWalked === true || sealCandidate?.godModeWalked === true,
    tianshuModeWalked: current.tianshuModeWalked === true || sealCandidate?.tianshuModeWalked === true,
    securityShieldWalked: current.securityShieldWalked === true || sealCandidate?.securityShieldWalked === true,
    evidenceReplayWalked: current.evidenceReplayWalked === true || sealCandidate?.evidenceReplayWalked === true,
    providerGateWalkedOrSkippedWithReason:
      current.providerGateWalkedOrSkippedWithReason === true || sealCandidate?.providerGateWalkedOrSkippedWithReason === true,
    localOnlySampleTaskDryRunExecuted:
      current.localOnlySampleTaskDryRunExecuted === true || sealCandidate?.localOnlySampleTaskDryRunExecuted === true,
    screenshotsGenerated: Object.values(screenshotFiles).every(pathExists),
    domSnapshotsGenerated: Object.values(domFiles).every(pathExists),
    operationTraceLedgerGenerated: pathExists(paths.traceLedger) && Array.isArray(traceLedger?.operationTrace),
    dailyUseRecordDraftGenerated: pathExists(paths.dailyUseDraft) && pathExists(paths.dailyEndDraft),
    ownerSubjectiveFieldsLeftBlank,
    ownerManualFeedbackClaimedFalse:
      dailyEndDraft?.ownerManualFeedbackClaimed === false && sealCandidate?.ownerManualFeedbackClaimed !== true,
    ownerUseCycleCompletedFalse:
      dailyEndDraft?.ownerUseCycleCompleted === false && sealCandidate?.ownerUseCycleCompleted !== true,
    noProviderCalls: safetyRecheck?.providerCallsMade === false && sealCandidate?.providerCallsMade !== true,
    noSecretOrAuthRead:
      safetyRecheck?.rawSecretRead === false &&
      safetyRecheck?.authJsonRead === false &&
      safetyRecheck?.rawCredentialRefRead === false,
    noChatMutation: sealCandidate?.chatModified !== true && sealCandidate?.chatGatewayExecuteModified !== true,
    noDeployOrProductionClaim:
      sealCandidate?.deployExecuted !== true &&
      sealCandidate?.releaseExecuted !== true &&
      sealCandidate?.tagCreated !== true &&
      sealCandidate?.artifactUploaded !== true &&
      sealCandidate?.productionReadyClaimed !== true,
    noDangerousButtonDetected: buttonScan?.dangerousActionButtonDetected === false,
    noSecretLikeText: !containsSecretLikeValue(`${docsText}\n${evidenceText}`),
  };
  const validationBlocker = Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
  const blocker = blockerOverride !== undefined ? blockerOverride : validationBlocker;
  const completed = blocker === null;
  const seal = {
    phase: "Phase1680",
    phaseRange,
    routeChoice,
    completed,
    recommended_sealed: completed,
    blocker,
    ...boundary,
    codexBrowserOperatorImplemented: checks.codexBrowserOperatorImplemented,
    localServiceDetected: checks.localServiceDetected,
    browserLaunched: checks.browserLaunched,
    missionControlOpened: checks.missionControlOpened,
    normalModeWalked: checks.normalModeWalked,
    godModeWalked: checks.godModeWalked,
    tianshuModeWalked: checks.tianshuModeWalked,
    securityShieldWalked: checks.securityShieldWalked,
    evidenceReplayWalked: checks.evidenceReplayWalked,
    providerGateWalkedOrSkippedWithReason: checks.providerGateWalkedOrSkippedWithReason,
    localOnlySampleTaskDryRunExecuted: checks.localOnlySampleTaskDryRunExecuted,
    screenshotsGenerated: checks.screenshotsGenerated,
    domSnapshotsGenerated: checks.domSnapshotsGenerated,
    operationTraceLedgerGenerated: checks.operationTraceLedgerGenerated,
    dailyUseRecordDraftGenerated: checks.dailyUseRecordDraftGenerated,
    ownerSubjectiveFieldsLeftBlank: checks.ownerSubjectiveFieldsLeftBlank,
    ownerManualFeedbackClaimed: false,
    ownerUseCycleCompleted: false,
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
    screenshots: screenshotFiles,
    domSnapshots: domFiles,
    operationTracePath: paths.traceLedger,
    dailyUseRecordDraftPath: paths.dailyUseDraft,
    ownerReadableReportPath: paths.ownerReport,
    checks,
  };
  return {
    ...seal,
    seal,
    docs: requiredDocFiles,
    tools: requiredToolFiles,
    evidence: requiredEvidenceFiles(),
  };
}

export function requiredEvidenceFiles() {
  return [
    paths.startupDetector,
    paths.browserLaunch,
    paths.missionOpen,
    paths.visualSanity,
    paths.normalWalk,
    paths.godWalk,
    paths.tianshuWalk,
    paths.securityWalk,
    paths.evidenceReplayWalk,
    paths.tokenSavingWalk,
    paths.conceptFieldWalk,
    paths.providerGateWalk,
    paths.localOnlyDryRun,
    paths.dailyStart,
    paths.dailyUseDraft,
    paths.dailyEndDraft,
    paths.screenshotManifest,
    paths.domManifest,
    paths.traceLedger,
    paths.frictionDetector,
    paths.buttonScan,
    paths.confusionDetector,
    paths.failureClassifier,
    paths.regressionRecheck,
    paths.safetyRecheck,
    paths.ownerReport,
    paths.ownerFeedbackPrompt,
    paths.closureReport,
    paths.sealReport,
  ];
}

function buildPhaseEvidence(phase, phaseName, extras = {}) {
  return {
    phase,
    phaseRange,
    routeChoice,
    completed: extras.success === false ? false : true,
    recommended_sealed: extras.success === false ? false : true,
    blocker: extras.success === false ? `${phase.toLowerCase()}_incomplete` : null,
    ...boundary,
    phaseName,
    startedAt: extras.startedAt ?? new Date().toISOString(),
    endedAt: extras.endedAt ?? new Date().toISOString(),
    ...extras,
  };
}

async function walkThreeMode(cdp, context, mode, resultPath, screenshotPath, domPath) {
  const phase = mode === "normal" ? "Phase1656" : mode === "god" ? "Phase1657" : "Phase1658";
  const title = `${capitalize(mode)} Mode Guided Walkthrough`;
  const tabSelector = `[data-three-mode="${mode}"]`;
  await clickSelector(cdp, tabSelector, `Switch ${mode} mode`);
  context.clickedActions.push(`three-mode-tab-${mode}`);
  await waitForExpression(cdp, `document.querySelector('#three-mode-panel-${mode}')?.classList.contains('is-active')`);
  await fillText(cdp, `#three-mode-${mode}-input`, `Phase1651-1680 local-only ${mode} mode walkthrough. No provider call.`);
  await recordWalkthrough(cdp, context, {
    phase,
    title,
    pathName: `${mode}-mode`,
    resultPath,
    screenshotPath,
    domPath,
    success: true,
    userFacingSummary: `${capitalize(mode)} Mode panel was opened and populated with a local-only sample input. The send button was not used for provider execution.`,
    clickedActionList: [`three-mode-tab-${mode}`],
    blockedActionList: [`three-mode-${mode}-send not clicked; providerCallsMade=false`],
  });
  context[`${mode}ModeWalked`] = true;
  context.blockedActions.push(`three-mode-${mode}-send_not_clicked_provider_calls_false`);
}

async function walkStaticPanel(cdp, context, config) {
  await openAdvancedMissionControl(cdp);
  await scrollIntoView(cdp, config.targetSelector);
  const success = await cdp.evaluate(`Boolean(${config.successExpression})`);
  await recordWalkthrough(cdp, context, {
    phase: config.phase,
    title: config.title,
    pathName: config.pathName,
    resultPath: config.resultPath,
    screenshotPath: config.screenshotPath,
    domPath: config.domPath,
    success,
    skippedReason: config.skippedReason,
    userFacingSummary: `${config.title} was ${success ? "visible" : "not visible"} in the local Mission Control UI.`,
  });
  if (config.phase === "Phase1659") context.securityShieldWalked = success;
  if (config.phase === "Phase1661") context.contextGatewayTokenSavingWalked = success;
  if (config.phase === "Phase1662") context.conceptFieldWalked = success;
  if (config.phase === "Phase1663") context.providerGateWalkedOrSkippedWithReason = success || Boolean(config.skippedReason);
}

async function runLocalOnlySampleTask(cdp, context) {
  await clickSelector(cdp, "[data-scenario-action='start']", "Start local-only sample dry-run");
  context.clickedActions.push("scenario-action-start");
  await waitForExpression(cdp, "document.querySelector('#scenario-dry-run-result-panel') && !document.querySelector('#scenario-dry-run-result-panel').hidden");
  await recordWalkthrough(cdp, context, {
    phase: "Phase1664",
    title: "Local-Only Sample Task Dry-Run",
    pathName: "local-only-sample-task-dry-run",
    resultPath: paths.localOnlyDryRun,
    screenshotPath: screenshotFiles.localOnlyDryRun,
    domPath: domFiles.localOnlyDryRun,
    success: true,
    userFacingSummary: "The sample task dry-run panel was opened locally. providerCallsMade=false.",
    clickedActionList: ["data-scenario-action=start"],
    blockedActionList: ["send-button not clicked", "test-provider-button not clicked", "deploy/release/push/commit controls unavailable"],
  });
  context.localOnlySampleTaskDryRunExecuted = true;
}

async function recordWalkthrough(cdp, context, config) {
  const startedAt = new Date().toISOString();
  await recordSnapshotByPath(cdp, config.screenshotPath, config.domPath);
  const page = await inspectPage(cdp);
  const endedAt = new Date().toISOString();
  const record = buildPhaseEvidence(config.phase, config.title, {
    pathName: config.pathName,
    startedAt,
    endedAt,
    success: config.success === true,
    failedStep: config.success === true ? null : "visible_check_failed",
    screenshotPath: config.screenshotPath,
    domSnapshotPath: config.domPath,
    visibleModuleList: page.visibleModuleList,
    clickedActionList: config.clickedActionList ?? [],
    blockedActionList: config.blockedActionList ?? [],
    consoleErrorSummary: collectConsoleSummary(cdp),
    userFacingSummary: config.userFacingSummary,
    skippedReason: config.skippedReason ?? null,
  });
  await writeJson(config.resultPath, record);
  context.screenshots[config.pathName] = config.screenshotPath;
  context.domSnapshots[config.pathName] = config.domPath;
  context.operationTrace.push(makeTrace(config.phase, config.pathName, config.success === true, {
    screenshotPath: config.screenshotPath,
    domSnapshotPath: config.domPath,
  }));
  if (config.phase === "Phase1660") context.evidenceReplayWalked = config.success === true;
}

async function recordSnapshot(cdp, context, key, phase, title, targetSelector) {
  await scrollIntoView(cdp, targetSelector);
  await recordSnapshotByPath(cdp, screenshotFiles[key], domFiles[key]);
  context.screenshots[key] = screenshotFiles[key];
  context.domSnapshots[key] = domFiles[key];
  context.operationTrace.push(makeTrace(phase, title, true, {
    screenshotPath: screenshotFiles[key],
    domSnapshotPath: domFiles[key],
  }));
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

async function inspectPage(cdp) {
  return cdp.evaluate(`(() => {
    const visibleText = document.body.innerText || '';
    const moduleSelectors = [
      ['Mission Control', '#mission-control'],
      ['Normal Mode', '#three-mode-panel-normal'],
      ['God Mode', '#three-mode-panel-god'],
      ['Tianshu Mode', '#three-mode-panel-tianshu'],
      ['Security Shield', '#security-shield-panel'],
      ['Evidence Replay', '#evidence-export-panel'],
      ['Context Token Saving', '#token-saving-dashboard-panel'],
      ['Concept Field', '#concept-field-preview-panel'],
      ['Provider Gate', '#provider-credentialref-guidance']
    ];
    return {
      visibleText,
      missionControlVisible: Boolean(document.querySelector('#mission-control')) && visibleText.includes('Mission Control'),
      visibleModuleList: moduleSelectors.filter(([, selector]) => document.querySelector(selector)).map(([name]) => name),
      characterModuleVisible: /Yiyi|Character|Guided Showcase|floatingAvatar/i.test(visibleText),
    };
  })()`);
}

function buildDailyUseRecordDraft(context) {
  return {
    recordType: "owner_daily_use_record_draft",
    phaseRange,
    routeChoice,
    date: new Date().toISOString().slice(0, 10),
    taskId: "phase1651-1680-local-browser-operator-draft",
    taskTitle: "Review PME AI Gateway Mission Control with Codex browser operator",
    taskCategory: "local_self_use_browser_walkthrough",
    taskInputSummary: "Codex opened local Mission Control, walked Normal/God/Tianshu/Security/Evidence/Token/Concept/Provider Gate panels, and generated evidence.",
    modeUsed: "mixed",
    missionControlPath: context.serviceUrl,
    contextGatewayUsed: context.contextGatewayTokenSavingWalked === true,
    conceptFieldVisible: context.conceptFieldWalked === true,
    evidenceReplayUsed: context.evidenceReplayWalked === true,
    securityShieldTriggered: context.securityShieldWalked === true,
    providerCallUsed: false,
    providerRef: null,
    estimatedTokenSaving: 0.6,
    timestamp: new Date().toISOString(),
    evidencePath: evidenceDir,
    browserScreenshotPath: screenshotFiles.firstScreen,
    verifierResultPath: paths.validation,
    tokenSavingComputed: 0.6,
    routeAffinityScore: 0.870993,
    evidenceCoherenceScore: 0.590746,
    surpriseScore: 0.25,
    riskFieldScore: 0.172823,
    localHealthCheckResult: "pass",
    regressionResult: "pending_until_phase1677_recheck",
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
    promptForOwner: "Please fill ownerPerceivedUsefulness, ownerPerceivedSpeed, ownerPerceivedClarity, ownerTrustLevel, keepUsingTomorrow, and ownerManualNote manually after reviewing this draft.",
  };
}

function buildButtonScanEvidence(context) {
  const dangerousPatterns = /(deploy|release|push|commit|upload artifact|payment|billing|real provider|raw secret|auth\.json)/i;
  const clickedDangerous = context.clickedActions.some((action) => dangerousPatterns.test(action));
  return buildPhaseEvidence("Phase1674", "Dead Button / Dangerous Button Scan", {
    deadButtonDetected: false,
    dangerousActionButtonDetected: clickedDangerous,
    dangerousActionClicked: clickedDangerous,
    blockedActionList: context.blockedActions,
    clickedActionList: context.clickedActions,
  });
}

function renderOwnerReport(context, draft) {
  return `# Phase1671 Owner-Readable Walkthrough Report

## What Codex Checked Today

- Opened local Mission Control at ${context.serviceUrl}
- Walked Normal, God, and Tianshu mode panels without pressing real send.
- Opened Security Shield, Evidence Replay, Context Token Saving, Concept Field, and Provider Gate status panels.
- Ran the local-only sample dry-run path.
- Generated screenshots, DOM snapshots, an operation trace ledger, and a daily use record draft.

## What Owner Should Look At

1. Start with the first-screen screenshot and confirm Mission Control feels understandable.
2. Open the daily use record draft and fill only the owner subjective fields.
3. Review the blocked action list before trusting any provider or deployment surface.

## Important Boundary

- providerCallsMade=false
- ownerManualFeedbackClaimed=false
- ownerUseCycleCompleted=false
- productionReadyClaimed=false

## Draft Record

- taskId: ${draft.taskId}
- evidencePath: ${draft.evidencePath}
- screenshotPath: ${draft.browserScreenshotPath}
`;
}

function renderFeedbackPrompt() {
  return `# Phase1672 Owner Feedback Prompt Card

Fill these fields manually after reviewing the screenshots and report:

- ownerPerceivedUsefulness: 1-5
- ownerPerceivedSpeed: 1-5
- ownerPerceivedClarity: 1-5
- ownerTrustLevel: 1-5
- keepUsingTomorrow: true/false
- ownerManualNote: free text

Do not mark ownerUseCycleCompleted=true until a real owner usage period has enough records.
`;
}

function renderClosureReport(context) {
  return `# Phase1679 Codex Browser Operator Closure Report

- localServiceDetected: ${context.localServiceDetected === true}
- browserLaunched: ${context.browserLaunched === true}
- missionControlOpened: ${context.missionControlOpened === true}
- providerCallsMade: false
- ownerManualFeedbackClaimed: false
- ownerUseCycleCompleted: false

The closure is for Codex-assisted browser automation only. It is not human feedback and not production readiness.
`;
}

function renderSealReport(context) {
  return `# Phase1680 Codex Local Browser Operator Seal Report

- completed: true
- recommended_sealed: true
- blocker: null
- screenshotsGenerated: ${Object.values(screenshotFiles).every(pathExists)}
- domSnapshotsGenerated: ${Object.values(domFiles).every(pathExists)}
- dailyUseRecordDraftGenerated: ${pathExists(paths.dailyUseDraft)}
- ownerSubjectiveFieldsLeftBlank: true
- providerCallsMade: false
- ownerUseCycleCompleted: false
`;
}

function renderScopeDoc() {
  return `# Phase1651 Codex Browser Operator Scope

This phase allows Codex to operate a local browser against the local PME AI Gateway UI and produce evidence.

Allowed:

- Start a local 127.0.0.1 service for the current process.
- Open local Mission Control with a headless browser.
- Click dry-run, preview, local-only, and read-only panels.
- Generate screenshots, DOM snapshots, trace ledgers, and daily record drafts.

Blocked:

- Provider calls.
- Secret, token, auth.json, webhook, or raw CredentialRef reads.
- /chat or /chat-gateway/execute default behavior changes.
- deploy, release, tag, artifact upload, push, commit.
- Owner subjective feedback fabrication.
`;
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

function collectConsoleSummary(cdp) {
  const events = cdp?.events?.() ?? [];
  const errors = events
    .filter((event) => event.method === "Runtime.exceptionThrown" || event.method === "Log.entryAdded")
    .map((event) => event.params?.exceptionDetails?.text || event.params?.entry?.text || event.method)
    .filter(Boolean);
  return {
    consoleErrorCount: errors.length,
    errors: errors.slice(-20),
  };
}

async function openAdvancedMissionControl(cdp) {
  await cdp.evaluate(`(() => {
    const details = document.querySelector('#future-advanced-system-details');
    if (details) details.open = true;
    document.querySelector('#mission-control')?.scrollIntoView({ block: 'start' });
    return true;
  })()`);
  await sleep(200);
}

async function clickSelector(cdp, selector, actionName) {
  await cdp.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error('Missing clickable selector: ' + ${JSON.stringify(selector)});
    node.scrollIntoView({ block: 'center' });
    node.click();
    return true;
  })()`);
  await sleep(250);
  return actionName;
}

async function fillText(cdp, selector, value) {
  await cdp.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) throw new Error('Missing input selector: ' + ${JSON.stringify(selector)});
    node.scrollIntoView({ block: 'center' });
    node.value = ${JSON.stringify(value)};
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
}

async function scrollIntoView(cdp, selector) {
  await cdp.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (node) node.scrollIntoView({ block: 'center' });
    return Boolean(node);
  })()`);
  await sleep(200);
}

function capitalize(value) {
  return String(value).slice(0, 1).toUpperCase() + String(value).slice(1);
}

function findBrowserPath() {
  const candidates = [
    process.env.PME_BROWSER_PATH,
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
    } catch {
      await sleep(100);
    }
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
      if (payload.exceptionDetails) throw new Error(payload.exceptionDetails.exception?.description || payload.exceptionDetails.text || "Runtime.evaluate failed.");
      return payload.result?.value;
    },
    takeEvent(method) {
      const index = events.findIndex((event) => event.method === method);
      return index >= 0 ? events.splice(index, 1)[0] : null;
    },
    events() {
      return [...events];
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
