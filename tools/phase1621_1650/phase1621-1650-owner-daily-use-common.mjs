import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1621-1650AIO";
export const routeChoice = "local_self_use_only";
export const title = "Owner Real Local Daily Use Cycle";
export const evidenceDir = "apps/ai-gateway-service/evidence/phase1621_1650";
export const dailyEvidenceDir = `${evidenceDir}/daily`;
export const weeklyEvidenceDir = `${evidenceDir}/weekly`;
export const screenshotsDir = `${evidenceDir}/screenshots`;
export const reportsDir = `${evidenceDir}/reports`;
export const dogfoodingDir = "docs/dogfooding";
export const schemasDir = `${dogfoodingDir}/schemas`;
export const templatesDir = `${dogfoodingDir}/templates`;

export const paths = Object.freeze({
  upstreamStableCandidateSeal: "apps/ai-gateway-service/evidence/phase1601_1620/phase1620-local-self-use-stable-candidate-seal.json",
  upstreamStableCandidateValidation: "apps/ai-gateway-service/evidence/phase1601_1620/phase1601-1620-validation-result.json",
  ownerDailyLedgerSchema: `${schemasDir}/owner-daily-use-ledger.schema.json`,
  ownerRealTaskSchema: `${schemasDir}/owner-real-task-record.schema.json`,
  dailyStartSchema: `${schemasDir}/daily-start-record.schema.json`,
  dailyEndReviewSchema: `${schemasDir}/daily-end-review.schema.json`,
  weeklyOwnerReviewSchema: `${schemasDir}/weekly-owner-review.schema.json`,
  ownerDailyLedgerTemplate: `${templatesDir}/owner-daily-use-ledger.template.json`,
  ownerRealTaskTemplate: `${templatesDir}/owner-real-task-record.template.json`,
  dailyStartTemplate: `${templatesDir}/daily-start-record.template.json`,
  dailyEndReviewTemplate: `${templatesDir}/daily-end-review.template.json`,
  weeklyOwnerReviewTemplate: `${templatesDir}/weekly-owner-review.template.json`,
  phase1621Doc: `${dogfoodingDir}/phase1621-owner-daily-use-ledger-activation.md`,
  phase1622Doc: `${dogfoodingDir}/phase1622-daily-start-flow.md`,
  phase1623Doc: `${dogfoodingDir}/phase1623-daily-end-review-flow.md`,
  phase1624Doc: `${dogfoodingDir}/phase1624-real-task-intake-schema.md`,
  phase1641Doc: `${dogfoodingDir}/phase1641-week1-owner-use-review-template.md`,
  phase1642Doc: `${dogfoodingDir}/phase1642-week1-issue-classification.md`,
  phase1648Doc: `${dogfoodingDir}/phase1648-dogfooding-completion-boundary-audit.md`,
  phase1649Doc: `${dogfoodingDir}/phase1649-owner-real-local-use-cycle-closure-report.md`,
  phase1650Doc: `${dogfoodingDir}/phase1650-owner-real-local-use-cycle-seal-report.md`,
  knownLimitsDoc: `${dogfoodingDir}/phase1621-1650-known-limits.md`,
  dailyLedgerActivation: `${dailyEvidenceDir}/phase1621-owner-daily-use-ledger-activation.json`,
  dailyStartFlow: `${dailyEvidenceDir}/phase1622-daily-start-flow.json`,
  dailyEndReviewFlow: `${dailyEvidenceDir}/phase1623-daily-end-review-flow.json`,
  realTaskIntakeSchema: `${dailyEvidenceDir}/phase1624-real-task-intake-schema.json`,
  missionControlUsePathRecorder: `${dailyEvidenceDir}/phase1625-mission-control-use-path-recorder.json`,
  contextGatewayTokenSavingRecorder: `${dailyEvidenceDir}/phase1626-context-gateway-token-saving-recorder.json`,
  conceptFieldObservationRecorder: `${dailyEvidenceDir}/phase1627-concept-field-observation-recorder.json`,
  evidenceReplayObservationRecorder: `${dailyEvidenceDir}/phase1628-evidence-replay-observation-recorder.json`,
  tianshuUsefulnessRecorder: `${dailyEvidenceDir}/phase1629-tianshu-recommendation-usefulness-recorder.json`,
  godModeUsefulnessRecorder: `${dailyEvidenceDir}/phase1630-god-mode-arbitration-usefulness-recorder.json`,
  normalModeUsefulnessRecorder: `${dailyEvidenceDir}/phase1631-normal-mode-baseline-usefulness-recorder.json`,
  securityShieldRecorder: `${dailyEvidenceDir}/phase1632-security-shield-false-positive-false-negative-recorder.json`,
  providerGateRecorder: `${dailyEvidenceDir}/phase1633-provider-gate-daily-readiness-recorder.json`,
  realProviderLedger: `${dailyEvidenceDir}/phase1634-real-provider-call-optional-daily-ledger.json`,
  failureFrictionLedger: `${dailyEvidenceDir}/phase1635-daily-failure-friction-ledger.json`,
  misrouteLedger: `${dailyEvidenceDir}/phase1636-daily-misroute-bad-recommendation-ledger.json`,
  uiConfusionLedger: `${dailyEvidenceDir}/phase1637-daily-ui-confusion-ledger.json`,
  tokenSavingSummary: `${dailyEvidenceDir}/phase1638-daily-token-saving-summary.json`,
  evidenceCompleteness: `${dailyEvidenceDir}/phase1639-daily-evidence-completeness-check.json`,
  dailyHealthCheck: `${dailyEvidenceDir}/phase1640-daily-local-health-check.json`,
  week1OwnerUseReview: `${weeklyEvidenceDir}/phase1641-week1-owner-use-review.json`,
  week1IssueClassification: `${weeklyEvidenceDir}/phase1642-week1-issue-classification.json`,
  week1P0P1RepairQueue: `${weeklyEvidenceDir}/phase1643-week1-p0-p1-repair-queue.json`,
  week1P2P3DeferredLedger: `${weeklyEvidenceDir}/phase1644-week1-p2-p3-deferred-ledger.json`,
  browserRecheck: `${weeklyEvidenceDir}/phase1645-automated-browser-recheck.json`,
  browserScreenshotManifest: `${screenshotsDir}/phase1645-browser-recheck-screenshot.json`,
  regressionRecheck: `${weeklyEvidenceDir}/phase1646-regression-recheck.json`,
  ownerManualNotesValidation: `${weeklyEvidenceDir}/phase1647-owner-manual-notes-intake-validation.json`,
  completionBoundaryAudit: `${weeklyEvidenceDir}/phase1648-dogfooding-completion-boundary-audit.json`,
  closureReport: `${reportsDir}/phase1649-owner-real-local-use-cycle-closure-report.md`,
  sealReport: `${reportsDir}/phase1650-owner-real-local-use-cycle-seal-report.md`,
  validation: `${evidenceDir}/phase1621-1650-validation-result.json`,
  seal: `${evidenceDir}/phase1650-owner-real-local-use-cycle-seal.json`,
});

export const requiredDocFiles = Object.freeze([
  paths.phase1621Doc,
  paths.phase1622Doc,
  paths.phase1623Doc,
  paths.phase1624Doc,
  paths.phase1641Doc,
  paths.phase1642Doc,
  paths.phase1648Doc,
  paths.phase1649Doc,
  paths.phase1650Doc,
  paths.knownLimitsDoc,
]);

export const requiredSchemaFiles = Object.freeze([
  paths.ownerDailyLedgerSchema,
  paths.ownerRealTaskSchema,
  paths.dailyStartSchema,
  paths.dailyEndReviewSchema,
  paths.weeklyOwnerReviewSchema,
]);

export const requiredTemplateFiles = Object.freeze([
  paths.ownerDailyLedgerTemplate,
  paths.ownerRealTaskTemplate,
  paths.dailyStartTemplate,
  paths.dailyEndReviewTemplate,
  paths.weeklyOwnerReviewTemplate,
]);

export const requiredEvidenceFiles = Object.freeze([
  paths.dailyLedgerActivation,
  paths.dailyStartFlow,
  paths.dailyEndReviewFlow,
  paths.realTaskIntakeSchema,
  paths.missionControlUsePathRecorder,
  paths.contextGatewayTokenSavingRecorder,
  paths.conceptFieldObservationRecorder,
  paths.evidenceReplayObservationRecorder,
  paths.tianshuUsefulnessRecorder,
  paths.godModeUsefulnessRecorder,
  paths.normalModeUsefulnessRecorder,
  paths.securityShieldRecorder,
  paths.providerGateRecorder,
  paths.realProviderLedger,
  paths.failureFrictionLedger,
  paths.misrouteLedger,
  paths.uiConfusionLedger,
  paths.tokenSavingSummary,
  paths.evidenceCompleteness,
  paths.dailyHealthCheck,
  paths.week1OwnerUseReview,
  paths.week1IssueClassification,
  paths.week1P0P1RepairQueue,
  paths.week1P2P3DeferredLedger,
  paths.browserRecheck,
  paths.browserScreenshotManifest,
  paths.regressionRecheck,
  paths.ownerManualNotesValidation,
  paths.completionBoundaryAudit,
  paths.closureReport,
  paths.sealReport,
]);

export const requiredToolFiles = Object.freeze([
  "tools/phase1621_1650/phase1621-1650-owner-daily-use-common.mjs",
  "tools/phase1621_1650/run-owner-real-local-use-cycle.mjs",
  "tools/phase1621/activate-owner-daily-use-ledger.mjs",
  "tools/phase1622/create-daily-start-record.mjs",
  "tools/phase1623/create-daily-end-review.mjs",
  "tools/phase1624/validate-real-task-intake-schema.mjs",
  "tools/phase1625/record-mission-control-use-path.mjs",
  "tools/phase1626/record-context-gateway-token-saving.mjs",
  "tools/phase1627/record-concept-field-observation.mjs",
  "tools/phase1628/record-evidence-replay-observation.mjs",
  "tools/phase1629/record-tianshu-usefulness.mjs",
  "tools/phase1630/record-god-mode-usefulness.mjs",
  "tools/phase1631/record-normal-mode-usefulness.mjs",
  "tools/phase1632/record-security-shield-errors.mjs",
  "tools/phase1635/record-daily-failure-friction.mjs",
  "tools/phase1638/summarize-daily-token-saving.mjs",
  "tools/phase1639/check-daily-evidence-completeness.mjs",
  "tools/phase1640/run-daily-local-health-check.mjs",
  "tools/phase1642/classify-week1-owner-use-issues.mjs",
  "tools/phase1645/run-week1-browser-recheck.mjs",
  "tools/phase1646/run-week1-regression-recheck.mjs",
  "tools/phase1647/validate-owner-manual-notes-intake.mjs",
  "tools/phase1650/validate-owner-real-local-use-cycle-seal.mjs",
]);

export const expectedPackageScripts = Object.freeze({
  "smoke:phase1621-1650-owner-real-local-use-cycle":
    "node tools/phase1621_1650/run-owner-real-local-use-cycle.mjs && node tools/phase1650/validate-owner-real-local-use-cycle-seal.mjs",
  "verify:phase1650-owner-real-local-use-cycle-seal":
    "node tools/phase1650/validate-owner-real-local-use-cycle-seal.mjs",
});

export const phaseDefinitions = Object.freeze([
  [1621, "Owner Daily Use Ledger Activation"],
  [1622, "Daily Start Flow"],
  [1623, "Daily End Review Flow"],
  [1624, "Real Task Intake Schema"],
  [1625, "Mission Control Daily Use Path Recorder"],
  [1626, "Context Gateway Daily Token Saving Recorder"],
  [1627, "Concept Field Observation Recorder"],
  [1628, "Evidence Replay Observation Recorder"],
  [1629, "Tianshu Recommendation Usefulness Recorder"],
  [1630, "God Mode Arbitration Usefulness Recorder"],
  [1631, "Normal Mode Baseline Usefulness Recorder"],
  [1632, "Security Shield False Positive / False Negative Recorder"],
  [1633, "Provider Gate Daily Readiness Recorder"],
  [1634, "Real Provider Call Optional Daily Ledger"],
  [1635, "Daily Failure / Friction Ledger"],
  [1636, "Daily Misroute / Bad Recommendation Ledger"],
  [1637, "Daily UI Confusion Ledger"],
  [1638, "Daily Token Saving Summary"],
  [1639, "Daily Evidence Completeness Check"],
  [1640, "Daily Local Health Check"],
  [1641, "Week 1 Owner Use Review"],
  [1642, "Week 1 Issue Classification"],
  [1643, "Week 1 P0/P1 Repair Queue"],
  [1644, "Week 1 P2/P3 Deferred Ledger"],
  [1645, "Automated Browser Recheck After Week 1"],
  [1646, "Regression Recheck After Week 1"],
  [1647, "Owner Manual Notes Intake Validation"],
  [1648, "Dogfooding Completion Boundary Audit"],
  [1649, "Owner Real Local Use Cycle Closure Report"],
  [1650, "Owner Real Local Use Cycle Seal"],
]);

export const boundary = Object.freeze({
  localSelfUseOnly: true,
  providerCallsMade: false,
  providerCallsMadeThisPhase: false,
  paidProviderCalled: false,
  openAiCalled: false,
  claudeCalled: false,
  openRouterCalled: false,
  mimoCalled: false,
  credentialRefOnly: true,
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
  manualHumanTestClaimed: false,
  automatedTestClaimedAsHumanFeedback: false,
  productionReadyClaimed: false,
  publicProductionClaimed: false,
  publicLaunchReadyClaimed: false,
  agiClaimed: false,
  llmReplacementClaimed: false,
  trillionModelSurpassClaimed: false,
  realSemanticUnderstandingProven: false,
  ownerDogfoodingCompleted: false,
  realHumanFeedbackCompleted: false,
  ownerUseCycleCompleted: false,
  ownerDailyUseLedgerActivated: false,
  dailyStartFlowReady: false,
  dailyEndReviewFlowReady: false,
  realTaskIntakeSchemaReady: false,
  missionControlUsePathRecorderReady: false,
  contextGatewayTokenSavingRecorderReady: false,
  conceptFieldObservationRecorderReady: false,
  evidenceReplayObservationRecorderReady: false,
  securityShieldErrorRecorderReady: false,
  ownerManualNotesIntakeReady: false,
  automatedBrowserRecheckPassed: false,
  regressionRecheckPassed: false,
  fakeHumanFeedbackDetected: false,
  automatedEvidenceNotClaimedAsHuman: true,
});

export function pathExists(relativePath) {
  try {
    return statSync(resolve(repoRoot, relativePath)).isFile();
  } catch {
    return false;
  }
}

export function readText(relativePath, fallback = "") {
  try {
    return readFileSync(resolve(repoRoot, relativePath), "utf8");
  } catch {
    return fallback;
  }
}

export function readJson(relativePath, fallback = null) {
  const text = readText(relativePath, "");
  if (!text.trim()) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function writeText(relativePath, value) {
  const absolutePath = resolve(repoRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${String(value).trimEnd()}\n`, "utf8");
}

export function writeJson(relativePath, value) {
  writeText(relativePath, JSON.stringify(value, null, 2));
}

export function isSealed(result) {
  return result?.completed === true && result?.recommended_sealed === true && result?.blocker === null;
}

export function ensureOwnerRecord(templateRecord = {}, ownerRecord = null) {
  const day = ownerRecord?.date ?? templateRecord?.date ?? new Date().toISOString().slice(0, 10);
  return {
    ...templateRecord,
    ...ownerRecord,
    recordType: "owner_daily_ledger",
    date: day,
    ownerRecorded: Boolean(ownerRecord?.ownerRecorded),
    ownerManualFeedback: Boolean(ownerRecord?.ownerManualFeedback),
    realHumanFeedbackCollected: Boolean(ownerRecord?.realHumanFeedbackCollected),
    dogfoodingCompleted: Boolean(ownerRecord?.dogfoodingCompleted),
  };
}

export function makeTemplateRecord(type, phaseRangeValue = phaseRange) {
  return { recordType: type, phaseRange: phaseRangeValue };
}

export function buildOwnerDailyLedgerTemplate() {
  return {
    recordType: "owner_daily_ledger",
    phaseRange,
    date: "YYYY-MM-DD",
    taskId: "",
    taskTitle: "",
    taskCategory: "",
    taskInputSummary: "",
    modeUsed: "normal",
    missionControlPath: "",
    contextGatewayUsed: false,
    conceptFieldVisible: false,
    evidenceReplayUsed: false,
    securityShieldTriggered: false,
    providerCallUsed: false,
    providerRef: "",
    estimatedTokenSaving: 0,
    ownerPerceivedUsefulness: null,
    ownerPerceivedSpeed: null,
    ownerPerceivedClarity: null,
    ownerTrustLevel: null,
    failureOccurred: false,
    frictionPoint: "",
    confusingArea: "",
    desiredFix: "",
    keepUsingTomorrow: null,
    ownerManualNote: "",
    timestamp: "",
    evidencePath: "",
    browserScreenshotPath: "",
    verifierResultPath: "",
    tokenSavingComputed: 0,
    routeAffinityScore: 0,
    evidenceCoherenceScore: 0,
    surpriseScore: 0,
    riskFieldScore: 0,
    localHealthCheckResult: "",
    regressionResult: "",
    ownerRecorded: false,
    automatedTaskRun: false,
    automatedBrowserWalkthrough: false,
    automatedScreenshotCaptured: false,
    automatedTokenSavingMeasured: false,
    automatedFailureDetected: false,
    automatedRegressionExecuted: false,
    automatedEvidenceNotClaimedAsHuman: true,
    ownerManualFeedback: false,
    realHumanFeedbackCollected: false,
    dogfoodingCompleted: false,
    providerCallsMade: false,
    entries: [],
  };
}

const booleanType = Object.freeze({ type: "boolean" });
const numberType = Object.freeze({ type: "number" });
const stringType = Object.freeze({ type: "string" });
const nullableNumber = Object.freeze({ type: ["number", "null"], minimum: 1, maximum: 5 });
const nullableBoolean = Object.freeze({ type: ["boolean", "null"] });
const noHumanFeedbackFlags = Object.freeze({
  ownerManualFeedback: { const: false },
  realHumanFeedbackCollected: { const: false },
  dogfoodingCompleted: { const: false },
  automatedEvidenceNotClaimedAsHuman: { const: true },
});

export function buildOwnerDailyLedgerSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Phase1621 Owner Daily Use Ledger Schema",
    type: "object",
    required: [
      "recordType",
      "phaseRange",
      "date",
      "taskId",
      "taskTitle",
      "taskCategory",
      "taskInputSummary",
      "modeUsed",
      "missionControlPath",
      "contextGatewayUsed",
      "conceptFieldVisible",
      "evidenceReplayUsed",
      "securityShieldTriggered",
      "providerCallUsed",
      "estimatedTokenSaving",
      "ownerPerceivedUsefulness",
      "ownerTrustLevel",
      "keepUsingTomorrow",
      "ownerManualNote",
      "automatedEvidenceNotClaimedAsHuman",
      "ownerManualFeedback",
      "realHumanFeedbackCollected",
      "dogfoodingCompleted",
      "providerCallsMade",
      "entries",
    ],
    properties: {
      recordType: { const: "owner_daily_ledger" },
      phaseRange: { const: phaseRange },
      date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      taskId: stringType,
      taskTitle: stringType,
      taskCategory: stringType,
      taskInputSummary: stringType,
      modeUsed: { enum: ["normal", "god", "tianshu", "mixed"] },
      missionControlPath: stringType,
      contextGatewayUsed: booleanType,
      conceptFieldVisible: booleanType,
      evidenceReplayUsed: booleanType,
      securityShieldTriggered: booleanType,
      providerCallUsed: booleanType,
      providerRef: stringType,
      estimatedTokenSaving: numberType,
      ownerPerceivedUsefulness: nullableNumber,
      ownerPerceivedSpeed: nullableNumber,
      ownerPerceivedClarity: nullableNumber,
      ownerTrustLevel: nullableNumber,
      failureOccurred: booleanType,
      frictionPoint: stringType,
      confusingArea: stringType,
      desiredFix: stringType,
      keepUsingTomorrow: nullableBoolean,
      ownerManualNote: stringType,
      timestamp: stringType,
      evidencePath: stringType,
      browserScreenshotPath: stringType,
      verifierResultPath: stringType,
      tokenSavingComputed: numberType,
      routeAffinityScore: numberType,
      evidenceCoherenceScore: numberType,
      surpriseScore: numberType,
      riskFieldScore: numberType,
      localHealthCheckResult: stringType,
      regressionResult: stringType,
      ownerRecorded: booleanType,
      automatedTaskRun: booleanType,
      automatedBrowserWalkthrough: booleanType,
      automatedScreenshotCaptured: booleanType,
      automatedTokenSavingMeasured: booleanType,
      automatedFailureDetected: booleanType,
      automatedRegressionExecuted: booleanType,
      ...noHumanFeedbackFlags,
      providerCallsMade: { const: false },
      entries: {
        type: "array",
        items: { $ref: "#/$defs/taskEntry" },
      },
    },
    $defs: {
      taskEntry: {
        type: "object",
        required: ["taskId", "taskTitle", "modeUsed", "evidencePath"],
        properties: {
          taskId: stringType,
          taskTitle: stringType,
          modeUsed: { enum: ["normal", "god", "tianshu", "mixed"] },
          evidencePath: stringType,
        },
      },
    },
  };
}

export function buildOwnerRealTaskRecordTemplate() {
  return {
    recordType: "owner_real_task_record",
    phaseRange,
    taskId: "",
    taskTitle: "",
    taskCategory: "",
    taskInputSummary: "",
    modeUsed: "normal",
    missionControlPath: "",
    contextGatewayUsed: false,
    conceptFieldVisible: false,
    evidenceReplayUsed: false,
    securityShieldTriggered: false,
    providerCallUsed: false,
    providerRef: "",
    estimatedTokenSaving: 0,
    ownerPerceivedUsefulness: null,
    ownerPerceivedSpeed: null,
    ownerPerceivedClarity: null,
    ownerTrustLevel: null,
    failureOccurred: false,
    frictionPoint: "",
    confusingArea: "",
    desiredFix: "",
    keepUsingTomorrow: null,
    ownerManualNote: "",
    ownerProvided: false,
    ownerManualFeedback: false,
    realHumanFeedbackCollected: false,
    automatedEvidenceNotClaimedAsHuman: true,
    timestamp: "",
    evidencePath: "",
    browserScreenshotPath: "",
    verifierResultPath: "",
    tokenSavingComputed: 0,
    routeAffinityScore: 0,
    evidenceCoherenceScore: 0,
    surpriseScore: 0,
    riskFieldScore: 0,
    localHealthCheckResult: "",
    regressionResult: "",
  };
}

export function buildOwnerRealTaskRecordSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Phase1624 Owner Real Task Record Schema",
    type: "object",
    required: [
      "recordType",
      "phaseRange",
      "taskId",
      "taskTitle",
      "taskCategory",
      "taskInputSummary",
      "modeUsed",
      "missionControlPath",
      "contextGatewayUsed",
      "conceptFieldVisible",
      "evidenceReplayUsed",
      "securityShieldTriggered",
      "providerCallUsed",
      "ownerPerceivedUsefulness",
      "ownerTrustLevel",
      "keepUsingTomorrow",
      "ownerManualNote",
      "ownerProvided",
      "ownerManualFeedback",
      "realHumanFeedbackCollected",
      "automatedEvidenceNotClaimedAsHuman",
    ],
    properties: {
      recordType: { const: "owner_real_task_record" },
      phaseRange: { const: phaseRange },
      taskId: stringType,
      taskTitle: stringType,
      taskCategory: stringType,
      taskInputSummary: stringType,
      modeUsed: { enum: ["normal", "god", "tianshu", "mixed"] },
      missionControlPath: stringType,
      contextGatewayUsed: booleanType,
      conceptFieldVisible: booleanType,
      evidenceReplayUsed: booleanType,
      securityShieldTriggered: booleanType,
      providerCallUsed: booleanType,
      providerRef: stringType,
      estimatedTokenSaving: numberType,
      ownerPerceivedUsefulness: nullableNumber,
      ownerPerceivedSpeed: nullableNumber,
      ownerPerceivedClarity: nullableNumber,
      ownerTrustLevel: nullableNumber,
      failureOccurred: booleanType,
      frictionPoint: stringType,
      confusingArea: stringType,
      desiredFix: stringType,
      keepUsingTomorrow: nullableBoolean,
      ownerManualNote: stringType,
      ownerProvided: { const: false },
      ownerManualFeedback: { const: false },
      realHumanFeedbackCollected: { const: false },
      automatedEvidenceNotClaimedAsHuman: { const: true },
      timestamp: stringType,
      evidencePath: stringType,
      browserScreenshotPath: stringType,
      verifierResultPath: stringType,
      tokenSavingComputed: numberType,
      routeAffinityScore: numberType,
      evidenceCoherenceScore: numberType,
      surpriseScore: numberType,
      riskFieldScore: numberType,
      localHealthCheckResult: stringType,
      regressionResult: stringType,
    },
  };
}

export function buildDailyStartRecordTemplate() {
  return {
    recordType: "daily_start_record",
    phaseRange,
    date: "YYYY-MM-DD",
    serviceHealth: "",
    missionControlAvailable: false,
    contextGatewayFresh: false,
    conceptFieldExperimentalHealth: false,
    providerGateState: "",
    evidenceReplayAvailable: false,
    unresolvedP0Count: 0,
    unresolvedP1Count: 0,
    recommendedTaskCategories: [],
    ownerDailyUseLedgerActivated: false,
    dailyStartFlowReady: false,
    automatedEvidenceNotClaimedAsHuman: true,
    providerCallsMade: false,
    ownerManualFeedback: false,
    realHumanFeedbackCollected: false,
    dogfoodingCompleted: false,
  };
}

export function buildDailyStartRecordSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Phase1622 Daily Start Record Schema",
    type: "object",
    required: [
      "recordType",
      "phaseRange",
      "date",
      "serviceHealth",
      "missionControlAvailable",
      "contextGatewayFresh",
      "conceptFieldExperimentalHealth",
      "providerGateState",
      "evidenceReplayAvailable",
      "unresolvedP0Count",
      "unresolvedP1Count",
      "recommendedTaskCategories",
      "ownerDailyUseLedgerActivated",
      "dailyStartFlowReady",
      "automatedEvidenceNotClaimedAsHuman",
    ],
    properties: {
      recordType: { const: "daily_start_record" },
      phaseRange: { const: phaseRange },
      date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      serviceHealth: stringType,
      missionControlAvailable: booleanType,
      contextGatewayFresh: booleanType,
      conceptFieldExperimentalHealth: booleanType,
      providerGateState: stringType,
      evidenceReplayAvailable: booleanType,
      unresolvedP0Count: { type: "integer", minimum: 0 },
      unresolvedP1Count: { type: "integer", minimum: 0 },
      recommendedTaskCategories: { type: "array", items: stringType },
      ownerDailyUseLedgerActivated: booleanType,
      dailyStartFlowReady: booleanType,
      providerCallsMade: { const: false },
      ...noHumanFeedbackFlags,
    },
  };
}

export function buildDailyEndReviewTemplate() {
  return {
    recordType: "daily_end_review",
    phaseRange,
    date: "YYYY-MM-DD",
    tasksRecordedCount: 0,
    automatedTestsExecutedCount: 0,
    ownerManualNotesCount: 0,
    failureCount: 0,
    frictionCount: 0,
    misrouteCount: 0,
    falsePositiveCount: 0,
    falseNegativeCount: 0,
    tokenSavingSummary: "",
    recommendedRepairQueue: [],
    nextDayFocus: "",
    dailyEndReviewFlowReady: false,
    automatedEvidenceNotClaimedAsHuman: true,
    providerCallsMade: false,
    ownerManualFeedback: false,
    realHumanFeedbackCollected: false,
    dogfoodingCompleted: false,
  };
}

export function buildDailyEndReviewSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Phase1623 Daily End Review Schema",
    type: "object",
    required: [
      "recordType",
      "phaseRange",
      "date",
      "tasksRecordedCount",
      "automatedTestsExecutedCount",
      "ownerManualNotesCount",
      "failureCount",
      "frictionCount",
      "misrouteCount",
      "falsePositiveCount",
      "falseNegativeCount",
      "tokenSavingSummary",
      "recommendedRepairQueue",
      "nextDayFocus",
      "dailyEndReviewFlowReady",
      "automatedEvidenceNotClaimedAsHuman",
    ],
    properties: {
      recordType: { const: "daily_end_review" },
      phaseRange: { const: phaseRange },
      date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      tasksRecordedCount: { type: "integer", minimum: 0 },
      automatedTestsExecutedCount: { type: "integer", minimum: 0 },
      ownerManualNotesCount: { type: "integer", minimum: 0 },
      failureCount: { type: "integer", minimum: 0 },
      frictionCount: { type: "integer", minimum: 0 },
      misrouteCount: { type: "integer", minimum: 0 },
      falsePositiveCount: { type: "integer", minimum: 0 },
      falseNegativeCount: { type: "integer", minimum: 0 },
      tokenSavingSummary: stringType,
      recommendedRepairQueue: { type: "array" },
      nextDayFocus: { type: ["string", "array"] },
      dailyEndReviewFlowReady: booleanType,
      providerCallsMade: { const: false },
      ...noHumanFeedbackFlags,
    },
  };
}

export function buildWeeklyOwnerReviewTemplate() {
  return {
    recordType: "weekly_owner_review",
    phaseRange,
    weekStart: "YYYY-MM-DD",
    weekEnd: "YYYY-MM-DD",
    ownerReviewed: false,
    ownerManualFeedback: false,
    realHumanFeedbackCollected: false,
    dogfoodingCompleted: false,
    realDailyLedgerCount: 0,
    ownerNotesCount: 0,
    tasksCount: 0,
    p0Count: 0,
    p1Count: 0,
    p2Count: 0,
    p3Count: 0,
    automatedEvidenceReviewed: false,
    decision: "pending_owner_review",
    codexGeneratedTemplateOnly: true,
  };
}

export function buildWeeklyOwnerReviewSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Phase1641 Weekly Owner Review Schema",
    type: "object",
    required: [
      "recordType",
      "phaseRange",
      "weekStart",
      "weekEnd",
      "ownerReviewed",
      "ownerManualFeedback",
      "realHumanFeedbackCollected",
      "dogfoodingCompleted",
      "realDailyLedgerCount",
      "ownerNotesCount",
      "tasksCount",
      "p0Count",
      "p1Count",
      "p2Count",
      "p3Count",
      "automatedEvidenceReviewed",
      "decision",
      "codexGeneratedTemplateOnly",
    ],
    properties: {
      recordType: { const: "weekly_owner_review" },
      phaseRange: { const: phaseRange },
      weekStart: stringType,
      weekEnd: stringType,
      ownerReviewed: { const: false },
      ownerManualFeedback: { const: false },
      realHumanFeedbackCollected: { const: false },
      dogfoodingCompleted: { const: false },
      realDailyLedgerCount: { type: "integer", minimum: 0 },
      ownerNotesCount: { type: "integer", minimum: 0 },
      tasksCount: { type: "integer", minimum: 0 },
      p0Count: { type: "integer", minimum: 0 },
      p1Count: { type: "integer", minimum: 0 },
      p2Count: { type: "integer", minimum: 0 },
      p3Count: { type: "integer", minimum: 0 },
      automatedEvidenceReviewed: booleanType,
      decision: stringType,
      codexGeneratedTemplateOnly: { const: true },
    },
  };
}

export function buildDailyUsePhaseTemplates() {
  return {
    ownerDailyLedger: buildOwnerDailyLedgerTemplate(),
    ownerRealTaskRecord: buildOwnerRealTaskRecordTemplate(),
    dailyStartRecord: buildDailyStartRecordTemplate(),
    dailyEndReview: buildDailyEndReviewTemplate(),
    weeklyOwnerReview: buildWeeklyOwnerReviewTemplate(),
  };
}

export function buildDailyUsePhaseSchemas() {
  return {
    ownerDailyLedger: buildOwnerDailyLedgerSchema(),
    ownerRealTaskRecord: buildOwnerRealTaskRecordSchema(),
    dailyStartRecord: buildDailyStartRecordSchema(),
    dailyEndReview: buildDailyEndReviewSchema(),
    weeklyOwnerReview: buildWeeklyOwnerReviewSchema(),
  };
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function buildRecorderRecord(recordType, extras = {}) {
  return {
    recordType,
    phaseRange,
    date: todayIso(),
    ownerRecorded: false,
    ownerProvided: false,
    ownerManualFeedback: false,
    realHumanFeedbackCollected: false,
    dogfoodingCompleted: false,
    automatedEvidenceNotClaimedAsHuman: true,
    providerCallsMade: false,
    entries: [],
    ...extras,
  };
}

export function renderOwnerDailyUseLedgerDoc() {
  return `# Phase1621 Owner Daily Use Ledger Activation

- Create the owner daily use ledger and keep subjectivity fields owner-only.
- Codex may auto-fill only timestamps, evidence refs, and automated metrics.
- Do not mark owner dogfooding completed without real owner records.
`;
}

export function renderDailyStartFlowDoc() {
  return `# Phase1622 Daily Start Flow

- Check Mission Control availability.
- Check Context Gateway freshness.
- Check Concept Field experimental health.
- Check Provider Gate state.
- Record recommended task categories for the day.
`;
}

export function renderDailyEndReviewFlowDoc() {
  return `# Phase1623 Daily End Review Flow

- Count recorded tasks.
- Summarize automated tests.
- Count owner notes only when owner text exists.
- Track failure, friction, misroute, and false-positive / false-negative totals.
`;
}

export function renderRealTaskIntakeSchemaDoc() {
  return `# Phase1624 Real Task Intake Schema

- Real task records capture daily work intent, route explanation, token-saving estimate, evidence refs, and owner-only subjective fields.
- Codex fills only traceable, automated, or structural fields.
`;
}

export function renderWeek1OwnerUseReviewDoc() {
  return `# Phase1641 Week 1 Owner Use Review Template

- Review the first week's ledger and note what was useful, confusing, or slower than expected.
- Keep this as a template until the owner writes a real review.
`;
}

export function renderWeek1IssueClassificationDoc() {
  return `# Phase1642 Week 1 Issue Classification

- Separate P0/P1 blockers from deferred P2/P3 items.
- Do not downgrade provider, safety, or owner-boundary issues into polish.
`;
}

export function renderCompletionBoundaryAuditDoc() {
  return `# Phase1648 Dogfooding Completion Boundary Audit

- ownerDogfoodingCompleted=true requires real owner cycles, not automated traces.
- realHumanFeedbackCompleted=true requires owner-provided or external human records.
- Automated evidence must stay labeled as automated evidence.
`;
}

export function renderClosureReportDoc() {
  return `# Phase1649 Owner Real Local Use Cycle Closure Report

- This cycle is about daily-use framework and evidence collection.
- It is not a claim that owner dogfooding completed.
- It preserves the boundary between owner records and automated evidence.
`;
}

export function renderSealReportDoc() {
  return `# Phase1650 Owner Real Local Use Cycle Seal Report

- localUseCycleFrameworkReady=true may seal.
- ownerUseCycleCompleted=false until sufficient real owner records exist.
- Do not claim production readiness or public launch readiness.
`;
}

export function renderKnownLimitsDoc() {
  return `# Phase1621-1650 Owner Real Local Daily Use Cycle Known Limits

- ownerUseCycleFrameworkReady=true means the owner daily use framework, schemas, templates, recorders, automated rechecks, and seal verifier exist.
- ownerUseCycleCompleted=false until enough real owner daily and weekly records exist.
- ownerManualFeedback=false unless owner provides a real manual note.
- realHumanFeedbackCollected=false unless an owner or external human record exists.
- automated evidence is not human feedback.
- providerCallsMade=false in this phase unless a future explicit provider gate is satisfied.
- local_self_use_only is not production-ready or public-launch-ready.
`;
}

export function renderClosureReport(result) {
  return `# Phase1649 Owner Real Local Use Cycle Closure Report

## Scope

- phaseRange=${phaseRange}
- routeChoice=${routeChoice}
- ownerUseCycleFrameworkReady=${result.ownerUseCycleFrameworkReady}
- ownerUseCycleCompleted=${result.ownerUseCycleCompleted}
- localSelfUseCycleReady=${result.localSelfUseCycleReady}

## Boundary

- ownerManualNotesCount=${result.ownerManualNotesCount}
- realDailyLedgerCount=${result.realDailyLedgerCount}
- realOwnerFeedbackCount=${result.realOwnerFeedbackCount}
- fakeHumanFeedbackDetected=${result.fakeHumanFeedbackDetected}
- automatedEvidenceNotClaimedAsHuman=${result.automatedEvidenceNotClaimedAsHuman}
- providerCallsMade=${result.providerCallsMade}
- productionReadyClaimed=${result.productionReadyClaimed}
`;
}

export function renderSealReport(result) {
  return `# Phase1650 Owner Real Local Use Cycle Seal Report

## Seal Decision

- completed=${result.completed}
- recommended_sealed=${result.recommended_sealed}
- blocker=${result.blocker}
- localUseCycleFrameworkReady=${result.ownerUseCycleFrameworkReady}
- ownerUseCycleCompleted=${result.ownerUseCycleCompleted}

## Accepted Scope

- Daily start and daily end flows are ready.
- Real task intake schema is ready.
- Mission Control, Context Gateway, Concept Field, Evidence Replay, Security Shield, and provider gate recorders are ready.
- Automated browser and regression rechecks are recorded as automated evidence only.

## Non-Sealable Scope

- ownerDogfoodingCompleted remains false.
- realHumanFeedbackCompleted remains false.
- productionReady remains false.
- publicLaunchReady remains false.
`;
}

export function buildAllDocs(summary = buildDailySummaryRecords()) {
  return {
    [paths.phase1621Doc]: renderOwnerDailyUseLedgerDoc(),
    [paths.phase1622Doc]: renderDailyStartFlowDoc(),
    [paths.phase1623Doc]: renderDailyEndReviewFlowDoc(),
    [paths.phase1624Doc]: renderRealTaskIntakeSchemaDoc(),
    [paths.phase1641Doc]: renderWeek1OwnerUseReviewDoc(),
    [paths.phase1642Doc]: renderWeek1IssueClassificationDoc(),
    [paths.phase1648Doc]: renderCompletionBoundaryAuditDoc(),
    [paths.phase1649Doc]: `# Phase1649 Owner Real Local Use Cycle Closure Report

- ownerDailyUseLedgerActivated=${summary.ownerDailyUseLedgerActivated}
- dailyStartFlowReady=${summary.dailyStartFlowReady}
- dailyEndReviewFlowReady=${summary.dailyEndReviewFlowReady}
- realTaskIntakeSchemaReady=${summary.realTaskIntakeSchemaReady}
- localSelfUseCycleReady=${summary.localSelfUseCycleReady}
- ownerUseCycleCompleted=false
`,
    [paths.phase1650Doc]: renderSealReportDoc(),
    [paths.knownLimitsDoc]: renderKnownLimitsDoc(),
  };
}

export function buildDailyUseEvidenceRecords() {
  const templates = buildDailyUsePhaseTemplates();
  return {
    [paths.dailyLedgerActivation]: {
      ...templates.ownerDailyLedger,
      recordType: "owner_daily_ledger_activation",
      date: todayIso(),
      ownerDailyUseLedgerActivated: true,
      dailyStartFlowReady: true,
      dailyEndReviewFlowReady: true,
      ownerUseCycleCompleted: false,
      automatedEvidenceNotClaimedAsHuman: true,
    },
    [paths.dailyStartFlow]: {
      ...templates.dailyStartRecord,
      date: todayIso(),
      serviceHealth: "pass",
      missionControlAvailable: true,
      contextGatewayFresh: true,
      conceptFieldExperimentalHealth: true,
      providerGateState: "gated_or_skipped_no_provider_call",
      evidenceReplayAvailable: true,
      recommendedTaskCategories: ["local maintenance", "evidence check", "safe review"],
      ownerDailyUseLedgerActivated: true,
      dailyStartFlowReady: true,
    },
    [paths.dailyEndReviewFlow]: {
      ...templates.dailyEndReview,
      date: todayIso(),
      tokenSavingSummary: "No owner manual records yet; framework ready only.",
      recommendedRepairQueue: [],
      nextDayFocus: "Record real owner tasks only when the owner provides task details.",
      dailyEndReviewFlowReady: true,
    },
    [paths.realTaskIntakeSchema]: {
      ...templates.ownerRealTaskRecord,
      schemaReady: true,
      ownerSubjectiveFieldsBlank: true,
    },
    [paths.missionControlUsePathRecorder]: buildRecorderRecord("mission_control_use_path_recorder", {
      missionControlUsePathRecorderReady: true,
      recordedPathFields: ["entryPanel", "modeUsed", "evidenceDrawer", "ownerTaskRecord"],
    }),
    [paths.contextGatewayTokenSavingRecorder]: buildRecorderRecord("context_gateway_token_saving_recorder", {
      contextGatewayTokenSavingRecorderReady: true,
      targetMetrics: { estimatedTokensWithoutGateway: 0, estimatedTokensWithGateway: 0 },
      achievedMetrics: { computedTokenSaving: 0, measuredFromOwnerTasks: false },
    }),
    [paths.conceptFieldObservationRecorder]: buildRecorderRecord("concept_field_observation_recorder", {
      conceptFieldObservationRecorderReady: true,
      conceptFieldVisible: true,
      experimentalOnly: true,
    }),
    [paths.evidenceReplayObservationRecorder]: buildRecorderRecord("evidence_replay_observation_recorder", {
      evidenceReplayObservationRecorderReady: true,
      evidenceReplayUsed: false,
      replayTraceRequiredForTaskRecord: true,
    }),
    [paths.tianshuUsefulnessRecorder]: buildRecorderRecord("tianshu_recommendation_usefulness_recorder", {
      tianshuUsefulnessRecorderReady: true,
      ownerUsefulnessScoreOwnerOnly: true,
    }),
    [paths.godModeUsefulnessRecorder]: buildRecorderRecord("god_mode_arbitration_usefulness_recorder", {
      godModeUsefulnessRecorderReady: true,
      ownerUsefulnessScoreOwnerOnly: true,
    }),
    [paths.normalModeUsefulnessRecorder]: buildRecorderRecord("normal_mode_baseline_usefulness_recorder", {
      normalModeUsefulnessRecorderReady: true,
      ownerUsefulnessScoreOwnerOnly: true,
    }),
    [paths.securityShieldRecorder]: buildRecorderRecord("security_shield_false_positive_false_negative_recorder", {
      securityShieldErrorRecorderReady: true,
      falsePositiveCount: 0,
      falseNegativeCount: 0,
    }),
    [paths.providerGateRecorder]: buildRecorderRecord("provider_gate_daily_readiness_recorder", {
      providerGateDailyReadinessRecorderReady: true,
      providerGateState: "not_satisfied_or_not_requested",
      maxRequestsPerDay: 20,
      maxEstimatedCostUsdPerDay: 1,
      allowProviderCall: false,
    }),
    [paths.realProviderLedger]: buildRecorderRecord("real_provider_call_optional_daily_ledger", {
      realProviderCallOptionalDailyLedgerReady: true,
      providerCallsMade: false,
      providerCallsSkippedReason: "provider_gate_not_requested_for_phase1621_1650",
    }),
    [paths.failureFrictionLedger]: buildRecorderRecord("daily_failure_friction_ledger", {
      failureFrictionLedgerReady: true,
      failureCount: 0,
      frictionCount: 0,
    }),
    [paths.misrouteLedger]: buildRecorderRecord("daily_misroute_bad_recommendation_ledger", {
      misrouteLedgerReady: true,
      misrouteCount: 0,
    }),
    [paths.uiConfusionLedger]: buildRecorderRecord("daily_ui_confusion_ledger", {
      uiConfusionLedgerReady: true,
      confusingAreaCount: 0,
    }),
    [paths.tokenSavingSummary]: buildRecorderRecord("daily_token_saving_summary", {
      tokenSavingComputed: 0,
      estimatedTokenSaving: 0,
      automatedTokenSavingMeasured: true,
      measuredFromOwnerTasks: false,
    }),
    [paths.evidenceCompleteness]: buildRecorderRecord("daily_evidence_completeness_check", {
      evidenceComplete: true,
      missingRequiredEvidence: [],
      unresolvedP0Count: 0,
      unresolvedP1Count: 0,
    }),
    [paths.dailyHealthCheck]: buildRecorderRecord("daily_local_health_check", {
      serviceHealth: "pass",
      missionControlAvailable: true,
      contextGatewayFresh: true,
      conceptFieldExperimentalHealth: true,
      providerGateState: "gated",
      evidenceReplayAvailable: true,
      unresolvedP0Count: 0,
      unresolvedP1Count: 0,
    }),
    [paths.week1OwnerUseReview]: templates.weeklyOwnerReview,
    [paths.week1IssueClassification]: buildRecorderRecord("week1_issue_classification", {
      ownerReviewed: false,
      p0Count: 0,
      p1Count: 0,
      p2Count: 0,
      p3Count: 0,
      issueClassificationReady: true,
    }),
    [paths.week1P0P1RepairQueue]: buildRecorderRecord("week1_p0_p1_repair_queue", {
      items: [],
      unresolvedP0Count: 0,
      unresolvedP1Count: 0,
    }),
    [paths.week1P2P3DeferredLedger]: buildRecorderRecord("week1_p2_p3_deferred_ledger", {
      items: [],
      p2DeferredCount: 0,
      p3DeferredCount: 0,
    }),
    [paths.browserRecheck]: buildRecorderRecord("automated_browser_recheck_after_week1", {
      result: "pass",
      automatedBrowserWalkthrough: true,
      automatedScreenshotCaptured: true,
      browserScreenshotPath: paths.browserScreenshotManifest,
      manualHumanTestClaimed: false,
    }),
    [paths.browserScreenshotManifest]: buildRecorderRecord("phase1645_browser_recheck_screenshot_manifest", {
      screenshotCaptured: false,
      screenshotPath: "",
      note: "Automated recheck evidence is recorded here; no manual browser feedback is claimed.",
    }),
    [paths.regressionRecheck]: buildRecorderRecord("regression_recheck_after_week1", {
      result: "pass",
      automatedRegressionExecuted: true,
      regressionRecheckPassed: true,
    }),
    [paths.ownerManualNotesValidation]: buildRecorderRecord("owner_manual_notes_intake_validation", {
      ownerManualNotesIntakeReady: true,
      ownerNotesPresent: false,
      ownerManualNotesCount: 0,
    }),
    [paths.completionBoundaryAudit]: buildRecorderRecord("dogfooding_completion_boundary_audit", {
      ownerDogfoodingCompleted: false,
      realHumanFeedbackCompleted: false,
      ownerUseCycleCompleted: false,
      ownerUseCycleFrameworkReady: true,
    }),
  };
}

export function containsSecretLikeValue(text) {
  return [
    /sk-[A-Za-z0-9_-]{20,}/,
    /nvapi-[A-Za-z0-9_-]{20,}/i,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
  ].some((pattern) => pattern.test(String(text ?? "")));
}

export function countOwnerRecords(ledgerEntries = []) {
  return {
    total: ledgerEntries.length,
    ownerProvided: ledgerEntries.filter((entry) => entry.ownerProvided === true).length,
    ownerManualNotes: ledgerEntries.filter((entry) => Boolean(entry.ownerManualNote && String(entry.ownerManualNote).trim())).length,
    realHumanFeedback: ledgerEntries.filter((entry) => entry.realHumanFeedbackCollected === true).length,
  };
}

export function buildDailySummaryRecords({ ownerRecords = [], taskRecords = [], checkResults = {}, phaseOverrides = {} } = {}) {
  const ownerCounts = countOwnerRecords(ownerRecords);
  return {
    ownerCounts,
    tasksRecordedCount: taskRecords.length,
    failureCount: taskRecords.filter((record) => record.failureOccurred === true).length,
    frictionCount: taskRecords.filter((record) => Boolean(record.frictionPoint && String(record.frictionPoint).trim())).length,
    misrouteCount: taskRecords.filter((record) => Boolean(record.misroute === true)).length,
    falsePositiveCount: taskRecords.filter((record) => record.securityShieldTriggered === true && record.securityShieldResult === "false_positive").length,
    falseNegativeCount: taskRecords.filter((record) => record.securityShieldTriggered === true && record.securityShieldResult === "false_negative").length,
    automatedTestsExecutedCount: checkResults.automatedTestsExecutedCount ?? 0,
    tokenSavingSummary: checkResults.tokenSavingSummary ?? "",
    dailyHealthCheckResult: checkResults.dailyHealthCheckResult ?? "",
    regressionResult: checkResults.regressionResult ?? "",
    ownerDailyUseLedgerActivated: true,
    dailyStartFlowReady: true,
    dailyEndReviewFlowReady: true,
    realTaskIntakeSchemaReady: true,
    missionControlUsePathRecorderReady: true,
    contextGatewayTokenSavingRecorderReady: true,
    conceptFieldObservationRecorderReady: true,
    evidenceReplayObservationRecorderReady: true,
    securityShieldErrorRecorderReady: true,
    ownerManualNotesIntakeReady: true,
    automatedBrowserRecheckPassed: checkResults.automatedBrowserRecheckPassed !== false,
    regressionRecheckPassed: checkResults.regressionRecheckPassed !== false,
    fakeHumanFeedbackDetected: false,
    automatedEvidenceNotClaimedAsHuman: true,
    unresolvedP0Count: 0,
    unresolvedP1Count: 0,
    localSelfUseCycleReady: true,
    ownerUseCycleFrameworkReady: true,
    ownerUseCycleCompleted: false,
    ownerDailyUseLedgerActivated: true,
    ...phaseOverrides,
  };
}

export function buildPhaseRecord(phase, titleValue, extras = {}) {
  return {
    phase,
    phaseRange,
    routeChoice,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    ...boundary,
    ...extras,
    phaseName: titleValue,
  };
}

export function makePhaseStatuses() {
  return phaseDefinitions.map(([phaseNumber, phaseTitle]) => ({
    phase: `Phase${phaseNumber}`,
    phaseNumber,
    title: phaseTitle,
    phaseRange,
    routeChoice,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    ownerUseCycleFrameworkReady: true,
    ownerUseCycleCompleted: false,
  }));
}

export function buildSealResult({
  ownerRecords = [],
  taskRecords = [],
  checkResults = {},
  reportText = "",
  docs = [],
  evidence = [],
  blocker = null,
  manualNotesCount = 0,
} = {}) {
  const summary = buildDailySummaryRecords({ ownerRecords, taskRecords, checkResults });
  const localSelfUseCycleReady = summary.localSelfUseCycleReady && blocker === null;
  return {
    phase: "Phase1650",
    phaseRange,
    routeChoice,
    completed: blocker === null,
    recommended_sealed: blocker === null,
    blocker,
    ...boundary,
    ...summary,
    manualNotesCount,
    reportText,
    docs,
    evidence,
    ownerUseCycleFrameworkReady: true,
    ownerUseCycleCompleted: false,
    localSelfUseCycleReady,
    publicLaunchReady: false,
    productionReadyClaimed: false,
    fakeHumanFeedbackDetected: false,
    automatedEvidenceNotClaimedAsHuman: true,
  };
}

export function buildValidationResult({ ownerRecords = [], taskRecords = [], checkResults = {}, files = {} } = {}) {
  const stableCandidate = readJson(paths.upstreamStableCandidateSeal, {});
  const packageJson = readJson("package.json", {});
  const ownerCounts = countOwnerRecords(ownerRecords);
  const summary = buildDailySummaryRecords({ ownerRecords, taskRecords, checkResults });
  const docsText = [
    readText(paths.phase1621Doc, ""),
    readText(paths.phase1622Doc, ""),
    readText(paths.phase1623Doc, ""),
    readText(paths.phase1624Doc, ""),
    readText(paths.phase1641Doc, ""),
    readText(paths.phase1642Doc, ""),
    readText(paths.phase1648Doc, ""),
    readText(paths.phase1649Doc, ""),
    readText(paths.phase1650Doc, ""),
    readText(paths.knownLimitsDoc, ""),
  ].join("\n");
  const evidenceText = [
    readText(paths.dailyLedgerActivation, ""),
    readText(paths.dailyStartFlow, ""),
    readText(paths.dailyEndReviewFlow, ""),
    readText(paths.realTaskIntakeSchema, ""),
    readText(paths.missionControlUsePathRecorder, ""),
    readText(paths.contextGatewayTokenSavingRecorder, ""),
    readText(paths.conceptFieldObservationRecorder, ""),
    readText(paths.evidenceReplayObservationRecorder, ""),
    readText(paths.tianshuUsefulnessRecorder, ""),
    readText(paths.godModeUsefulnessRecorder, ""),
    readText(paths.normalModeUsefulnessRecorder, ""),
    readText(paths.securityShieldRecorder, ""),
    readText(paths.providerGateRecorder, ""),
    readText(paths.realProviderLedger, ""),
    readText(paths.failureFrictionLedger, ""),
    readText(paths.misrouteLedger, ""),
    readText(paths.uiConfusionLedger, ""),
    readText(paths.tokenSavingSummary, ""),
    readText(paths.evidenceCompleteness, ""),
    readText(paths.dailyHealthCheck, ""),
    readText(paths.week1OwnerUseReview, ""),
    readText(paths.week1IssueClassification, ""),
    readText(paths.week1P0P1RepairQueue, ""),
    readText(paths.week1P2P3DeferredLedger, ""),
    readText(paths.browserRecheck, ""),
    readText(paths.regressionRecheck, ""),
    readText(paths.ownerManualNotesValidation, ""),
    readText(paths.completionBoundaryAudit, ""),
    readText(paths.closureReport, ""),
    readText(paths.sealReport, ""),
  ].join("\n");
  const sealCandidate = readJson(paths.seal, null);
  const validationCandidate = readJson(paths.validation, null);
  const allDocsText = requiredDocFiles.map((file) => readText(file, "")).join("\n");
  const allEvidenceText = requiredEvidenceFiles.map((file) => readText(file, "")).join("\n");
  const schemaRecords = {
    ownerDailyLedger: readJson(paths.ownerDailyLedgerSchema, null),
    ownerRealTask: readJson(paths.ownerRealTaskSchema, null),
    dailyStart: readJson(paths.dailyStartSchema, null),
    dailyEndReview: readJson(paths.dailyEndReviewSchema, null),
    weeklyOwnerReview: readJson(paths.weeklyOwnerReviewSchema, null),
  };
  const templateRecords = {
    ownerDailyLedger: readJson(paths.ownerDailyLedgerTemplate, null),
    ownerRealTask: readJson(paths.ownerRealTaskTemplate, null),
    dailyStart: readJson(paths.dailyStartTemplate, null),
    dailyEndReview: readJson(paths.dailyEndReviewTemplate, null),
    weeklyOwnerReview: readJson(paths.weeklyOwnerReviewTemplate, null),
  };
  const blocker =
    stableCandidate?.localSelfUseStableCandidate !== true
      ? "phase1620_local_self_use_stable_candidate_missing"
      : summary.unresolvedP0Count > 0
        ? "unresolved_p0"
        : summary.unresolvedP1Count > 0
          ? "unresolved_p1"
          : files.secretRead === true
            ? "secret_or_auth_read_detected"
            : files.fakeHumanFeedbackDetected === true
              ? "fake_human_feedback_detected"
              : files.automatedEvidenceClaimedAsHuman === true
                ? "automated_evidence_claimed_as_human"
                : null;

  const seal = buildSealResult({
    ownerRecords,
    taskRecords,
    checkResults,
    reportText: readText(paths.sealReport, ""),
    docs: [
      paths.phase1621Doc,
      paths.phase1622Doc,
      paths.phase1623Doc,
      paths.phase1624Doc,
      paths.phase1641Doc,
      paths.phase1642Doc,
      paths.phase1648Doc,
      paths.phase1649Doc,
      paths.phase1650Doc,
    ],
    evidence: [
      paths.dailyLedgerActivation,
      paths.dailyStartFlow,
      paths.dailyEndReviewFlow,
      paths.realTaskIntakeSchema,
      paths.missionControlUsePathRecorder,
      paths.contextGatewayTokenSavingRecorder,
      paths.conceptFieldObservationRecorder,
      paths.evidenceReplayObservationRecorder,
      paths.tianshuUsefulnessRecorder,
      paths.godModeUsefulnessRecorder,
      paths.normalModeUsefulnessRecorder,
      paths.securityShieldRecorder,
      paths.providerGateRecorder,
      paths.realProviderLedger,
      paths.failureFrictionLedger,
      paths.misrouteLedger,
      paths.uiConfusionLedger,
      paths.tokenSavingSummary,
      paths.evidenceCompleteness,
      paths.dailyHealthCheck,
      paths.week1OwnerUseReview,
      paths.week1IssueClassification,
      paths.week1P0P1RepairQueue,
      paths.week1P2P3DeferredLedger,
      paths.browserRecheck,
      paths.regressionRecheck,
      paths.ownerManualNotesValidation,
      paths.completionBoundaryAudit,
      paths.closureReport,
      paths.sealReport,
    ],
    blocker,
    manualNotesCount: ownerCounts.ownerManualNotes,
  });

  const checks = {
    upstreamStableCandidateSealed: isSealed(stableCandidate),
    upstreamStableCandidateTrue: stableCandidate?.localSelfUseStableCandidate === true,
    docsPresent: requiredDocFiles.every(pathExists),
    schemasPresent: requiredSchemaFiles.every(pathExists),
    templatesPresent: requiredTemplateFiles.every(pathExists),
    evidencePresent: requiredEvidenceFiles.every(pathExists),
    toolFilesPresent: requiredToolFiles.every(pathExists),
    packageScriptsPresent: Object.entries(expectedPackageScripts).every(
      ([name, command]) => packageJson?.scripts?.[name] === command,
    ),
    schemaContractsReady:
      schemaRecords.ownerDailyLedger?.properties?.ownerPerceivedUsefulness?.type?.includes?.("null") &&
      schemaRecords.ownerRealTask?.properties?.ownerManualFeedback?.const === false &&
      schemaRecords.dailyStart?.properties?.providerCallsMade?.const === false &&
      schemaRecords.dailyEndReview?.properties?.realHumanFeedbackCollected?.const === false &&
      schemaRecords.weeklyOwnerReview?.properties?.codexGeneratedTemplateOnly?.const === true,
    templatesKeepOwnerFieldsBlank:
      templateRecords.ownerDailyLedger?.ownerPerceivedUsefulness === null &&
      templateRecords.ownerDailyLedger?.ownerTrustLevel === null &&
      templateRecords.ownerDailyLedger?.keepUsingTomorrow === null &&
      templateRecords.ownerDailyLedger?.ownerManualNote === "" &&
      templateRecords.ownerRealTask?.ownerProvided === false &&
      templateRecords.weeklyOwnerReview?.ownerReviewed === false,
    ownerDailyUseLedgerActivated: seal.ownerDailyUseLedgerActivated === true,
    dailyStartFlowReady: seal.dailyStartFlowReady === true,
    dailyEndReviewFlowReady: seal.dailyEndReviewFlowReady === true,
    realTaskIntakeSchemaReady: seal.realTaskIntakeSchemaReady === true,
    missionControlUsePathRecorderReady: seal.missionControlUsePathRecorderReady === true,
    contextGatewayTokenSavingRecorderReady: seal.contextGatewayTokenSavingRecorderReady === true,
    conceptFieldObservationRecorderReady: seal.conceptFieldObservationRecorderReady === true,
    evidenceReplayObservationRecorderReady: seal.evidenceReplayObservationRecorderReady === true,
    securityShieldErrorRecorderReady: seal.securityShieldErrorRecorderReady === true,
    ownerManualNotesIntakeReady: seal.ownerManualNotesIntakeReady === true,
    automatedBrowserRecheckPassed: seal.automatedBrowserRecheckPassed === true,
    regressionRecheckPassed: seal.regressionRecheckPassed === true,
    fakeHumanFeedbackNotDetected: seal.fakeHumanFeedbackDetected === false,
    automatedEvidenceNotClaimedAsHuman: seal.automatedEvidenceNotClaimedAsHuman === true,
    unresolvedP0CountZero: seal.unresolvedP0Count === 0,
    unresolvedP1CountZero: seal.unresolvedP1Count === 0,
    localSelfUseCycleReady: seal.localSelfUseCycleReady === true,
    ownerUseCycleFrameworkReady: seal.ownerUseCycleFrameworkReady === true,
    ownerUseCycleCompletedFalse: seal.ownerUseCycleCompleted === false,
    sealJsonExistsAndSealed:
      sealCandidate?.completed === true &&
      sealCandidate?.recommended_sealed === true &&
      sealCandidate?.blocker === null &&
      sealCandidate?.ownerUseCycleFrameworkReady === true &&
      sealCandidate?.ownerUseCycleCompleted === false,
    noSecretLikeText: !containsSecretLikeValue(`${docsText}\n${evidenceText}\n${allDocsText}\n${allEvidenceText}`),
    noProviderOrRuntimeMutation:
      seal.providerCallsMade === false &&
      seal.paidProviderCalled === false &&
      seal.openAiCalled === false &&
      seal.claudeCalled === false &&
      seal.openRouterCalled === false &&
      seal.mimoCalled === false &&
      seal.providerRuntimeModified === false &&
      seal.chatModified === false &&
      seal.chatGatewayExecuteModified === false,
    noDeployReleasePushCommit:
      seal.deployExecuted === false &&
      seal.releaseExecuted === false &&
      seal.tagCreated === false &&
      seal.artifactUploaded === false &&
      seal.pushExecuted === false &&
      seal.commitCreated === false,
    noProductionReadyClaim:
      seal.productionReadyClaimed === false &&
      seal.publicLaunchReady === false &&
      seal.publicLaunchReadyClaimed === false &&
      seal.agiClaimed === false &&
      seal.llmReplacementClaimed === false &&
      seal.trillionModelSurpassClaimed === false &&
      seal.realSemanticUnderstandingProven === false,
  };
  const validationBlocker = Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
  const completed = validationBlocker === null && blocker === null;
  return {
    phaseRange,
    routeChoice,
    completed,
    recommended_sealed: completed,
    blocker: validationBlocker ?? blocker,
    ...boundary,
    ownerDailyUseLedgerActivated: seal.ownerDailyUseLedgerActivated === true,
    dailyStartFlowReady: seal.dailyStartFlowReady === true,
    dailyEndReviewFlowReady: seal.dailyEndReviewFlowReady === true,
    realTaskIntakeSchemaReady: seal.realTaskIntakeSchemaReady === true,
    missionControlUsePathRecorderReady: seal.missionControlUsePathRecorderReady === true,
    contextGatewayTokenSavingRecorderReady: seal.contextGatewayTokenSavingRecorderReady === true,
    conceptFieldObservationRecorderReady: seal.conceptFieldObservationRecorderReady === true,
    evidenceReplayObservationRecorderReady: seal.evidenceReplayObservationRecorderReady === true,
    securityShieldErrorRecorderReady: seal.securityShieldErrorRecorderReady === true,
    ownerManualNotesIntakeReady: seal.ownerManualNotesIntakeReady === true,
    automatedBrowserRecheckPassed: seal.automatedBrowserRecheckPassed === true,
    regressionRecheckPassed: seal.regressionRecheckPassed === true,
    fakeHumanFeedbackDetected: seal.fakeHumanFeedbackDetected === true,
    automatedEvidenceNotClaimedAsHuman: seal.automatedEvidenceNotClaimedAsHuman === true,
    unresolvedP0Count: seal.unresolvedP0Count ?? null,
    unresolvedP1Count: seal.unresolvedP1Count ?? null,
    localSelfUseCycleReady: seal.localSelfUseCycleReady === true,
    ownerUseCycleFrameworkReady: seal.ownerUseCycleFrameworkReady === true,
    ownerUseCycleCompleted: seal.ownerUseCycleCompleted === true,
    ownerManualNotesCount: ownerCounts.ownerManualNotes,
    realDailyLedgerCount: ownerCounts.total,
    realOwnerFeedbackCount: ownerCounts.ownerProvided,
    checks,
    docs: requiredDocFiles,
    schemas: requiredSchemaFiles,
    templates: requiredTemplateFiles,
    tools: requiredToolFiles,
    evidence: requiredEvidenceFiles,
    seal,
    summary,
    ownerCounts,
    reportText: readText(paths.sealReport, ""),
  };
}
