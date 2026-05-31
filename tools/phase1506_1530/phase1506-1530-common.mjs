import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1506-1530AIO";
export const routeChoice = "local_self_use_only";
export const title = "Local Dogfooding Framework + Evidence Loop";
export const evidenceDir = "apps/ai-gateway-service/evidence/phase1506_1530";
export const screenshotsDir = `${evidenceDir}/screenshots`;
export const dogfoodingDir = "docs/dogfooding";
export const phaseDogfoodingDir = `${dogfoodingDir}/phase1506-1530`;

export const paths = Object.freeze({
  previousUiSeal: "apps/ai-gateway-service/evidence/phase1486_1505/phase1505-mission-control-ui-seal.json",
  localDogfoodingLedgerSchema: `${dogfoodingDir}/local-self-use-ledger.schema.json`,
  ownerManualNoteTemplate: `${dogfoodingDir}/owner-manual-note.template.json`,
  weeklyReviewTemplate: `${dogfoodingDir}/weekly-review.template.json`,
  knownLimitsDoc: `${dogfoodingDir}/local-dogfooding-known-limits.md`,
  phaseReport: "docs/phase1506-1530-local-dogfooding-framework-seal-report.md",
  dailyStartFlowDoc: `${phaseDogfoodingDir}/daily-start-flow.md`,
  endOfDayReviewFlowDoc: `${phaseDogfoodingDir}/end-of-day-review-flow.md`,
  oneWeekClosureTemplate: `${phaseDogfoodingDir}/one-week-dogfooding-closure.template.json`,
  twoWeekClosureTemplate: `${phaseDogfoodingDir}/two-week-dogfooding-closure.template.json`,
  repairQueueTemplate: `${phaseDogfoodingDir}/repair-queue.template.json`,
  scenarioPack: `${phaseDogfoodingDir}/automated-trial-scenario-pack.json`,
  frameworkResult: `${evidenceDir}/phase1506-local-dogfooding-framework-result.json`,
  weeklyReviewValidation: `${evidenceDir}/phase1507-weekly-review-ledger-validation.json`,
  taskIntake: `${evidenceDir}/phase1508-automated-local-task-intake.json`,
  tokenSavingCounter: `${evidenceDir}/phase1509-token-saving-real-use-counter.json`,
  failureFrictionLedger: `${evidenceDir}/phase1510-failure-friction-ledger.json`,
  misrouteLedger: `${evidenceDir}/phase1511-misroute-ledger.json`,
  securityFalsePositiveLedger: `${evidenceDir}/phase1512-security-false-positive-ledger.json`,
  securityFalseNegativeLedger: `${evidenceDir}/phase1513-security-false-negative-ledger.json`,
  conceptFieldObservationLedger: `${evidenceDir}/phase1514-concept-field-observation-ledger.json`,
  contextGatewayObservationLedger: `${evidenceDir}/phase1515-context-gateway-observation-ledger.json`,
  missionControlUxRepairLoop: `${evidenceDir}/phase1516-mission-control-ux-repair-loop.json`,
  browserScreenshotRecheck: `${evidenceDir}/phase1517-browser-screenshot-recheck.json`,
  manualOperatorNotesIntake: `${evidenceDir}/phase1518-manual-operator-notes-intake.json`,
  closureTemplates: `${evidenceDir}/phase1519-1520-closure-templates.json`,
  evidenceIndex: `${evidenceDir}/phase1521-dogfooding-evidence-index.json`,
  issueClassifier: `${evidenceDir}/phase1522-dogfooding-issue-classifier.json`,
  repairQueue: `${evidenceDir}/phase1523-repair-queue.json`,
  automatedTrialScenarioPack: `${evidenceDir}/phase1524-automated-trial-scenario-pack.json`,
  automatedTrialScenarioRun: `${evidenceDir}/phase1525-automated-trial-scenario-run.json`,
  dailyStartFlow: `${evidenceDir}/phase1526-daily-start-flow.json`,
  endOfDayReviewFlow: `${evidenceDir}/phase1527-end-of-day-review-flow.json`,
  regressionMatrix: `${evidenceDir}/phase1528-dogfooding-regression-matrix.json`,
  knownLimits: `${evidenceDir}/phase1529-known-limits.json`,
  seal: `${evidenceDir}/phase1530-local-dogfooding-framework-seal.json`,
  validation: `${evidenceDir}/phase1506-1530-validation-result.json`,
});

export const boundary = Object.freeze({
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
  manualHumanTestClaimed: false,
  ownerManualFeedback: false,
  realHumanFeedbackCollected: false,
  dogfoodingCompleted: false,
  ownerDogfoodingCompletedClaimed: false,
  externalTesterFeedbackCompleted: false,
  fakeHumanFeedbackDetected: false,
  automatedEvidenceNotClaimedAsHuman: true,
});

export const phaseDefinitions = Object.freeze([
  [1506, "Owner Daily Dogfooding Ledger v1"],
  [1507, "Weekly Review Schema v1"],
  [1508, "Real Task Intake Panel"],
  [1509, "Token Saving Real-Use Counter"],
  [1510, "Failure / Friction Ledger"],
  [1511, "Misroute Ledger"],
  [1512, "Security False Positive Ledger"],
  [1513, "Security False Negative Ledger"],
  [1514, "Concept Field Real-Use Observation Ledger"],
  [1515, "Context Gateway Real-Use Observation Ledger"],
  [1516, "Mission Control UX Repair Loop"],
  [1517, "Real Browser Screenshot Recheck"],
  [1518, "Manual Operator Notes Intake"],
  [1519, "One-Week Dogfooding Closure Template"],
  [1520, "Two-Week Dogfooding Closure Template"],
  [1521, "Dogfooding Evidence Index"],
  [1522, "Dogfooding Issue Classifier"],
  [1523, "Dogfooding P0/P1/P2/P3 Repair Queue"],
  [1524, "Automated Trial Scenario Pack"],
  [1525, "Automated Trial Scenario Browser Run"],
  [1526, "Local Self-Use Daily Start Flow"],
  [1527, "Local Self-Use End-of-Day Review Flow"],
  [1528, "Dogfooding Regression Matrix"],
  [1529, "Dogfooding Known Limits Report"],
  [1530, "Local Dogfooding Framework Seal"],
]);

export const requiredDocFiles = Object.freeze([
  paths.localDogfoodingLedgerSchema,
  paths.ownerManualNoteTemplate,
  paths.weeklyReviewTemplate,
  paths.knownLimitsDoc,
  paths.phaseReport,
  paths.dailyStartFlowDoc,
  paths.endOfDayReviewFlowDoc,
  paths.oneWeekClosureTemplate,
  paths.twoWeekClosureTemplate,
  paths.repairQueueTemplate,
  paths.scenarioPack,
]);

export const requiredEvidenceFiles = Object.freeze([
  paths.frameworkResult,
  paths.weeklyReviewValidation,
  paths.taskIntake,
  paths.tokenSavingCounter,
  paths.failureFrictionLedger,
  paths.misrouteLedger,
  paths.securityFalsePositiveLedger,
  paths.securityFalseNegativeLedger,
  paths.conceptFieldObservationLedger,
  paths.contextGatewayObservationLedger,
  paths.missionControlUxRepairLoop,
  paths.browserScreenshotRecheck,
  paths.manualOperatorNotesIntake,
  paths.closureTemplates,
  paths.evidenceIndex,
  paths.issueClassifier,
  paths.repairQueue,
  paths.automatedTrialScenarioPack,
  paths.automatedTrialScenarioRun,
  paths.dailyStartFlow,
  paths.endOfDayReviewFlow,
  paths.regressionMatrix,
  paths.knownLimits,
  paths.seal,
]);

export const requiredToolFiles = Object.freeze([
  "tools/phase1506/create-local-dogfooding-ledger.mjs",
  "tools/phase1507/validate-weekly-review-ledger.mjs",
  "tools/phase1508/run-automated-local-task-intake.mjs",
  "tools/phase1509/measure-token-saving-real-use-counter.mjs",
  "tools/phase1510/validate-failure-friction-ledger.mjs",
  "tools/phase1522/classify-dogfooding-issues.mjs",
  "tools/phase1525/run-automated-trial-scenarios.mjs",
  "tools/phase1530/validate-local-dogfooding-framework-seal.mjs",
]);

export const expectedPackageScripts = Object.freeze({
  "smoke:phase1506-local-dogfooding-framework":
    "node tools/phase1506/create-local-dogfooding-ledger.mjs && node tools/phase1507/validate-weekly-review-ledger.mjs && node tools/phase1508/run-automated-local-task-intake.mjs && node tools/phase1509/measure-token-saving-real-use-counter.mjs && node tools/phase1510/validate-failure-friction-ledger.mjs && node tools/phase1522/classify-dogfooding-issues.mjs && node tools/phase1525/run-automated-trial-scenarios.mjs && node tools/phase1530/validate-local-dogfooding-framework-seal.mjs",
  "verify:phase1506-local-dogfooding-framework": "node tools/phase1530/validate-local-dogfooding-framework-seal.mjs",
});

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

export function writeJson(relativePath, value) {
  const absolutePath = resolve(repoRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeText(relativePath, value) {
  const absolutePath = resolve(repoRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${String(value).trimEnd()}\n`, "utf8");
}

export function pathExists(relativePath) {
  try {
    return statSync(resolve(repoRoot, relativePath)).isFile();
  } catch {
    return false;
  }
}

export function listJsonFiles(relativeDir) {
  try {
    return readdirSync(resolve(repoRoot, relativeDir), { withFileTypes: true })
      .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".json")
      .map((entry) => `${relativeDir}/${entry.name}`.replaceAll("\\", "/"))
      .sort();
  } catch {
    return [];
  }
}

export function makePhaseStatuses(blocker = null) {
  return Object.fromEntries(
    phaseDefinitions.map(([phaseNumber, phaseTitle]) => [
      `Phase${phaseNumber}`,
      {
        phase: `Phase${phaseNumber}`,
        phaseNumber,
        title: phaseTitle,
        phaseRange,
        routeChoice,
        completed: blocker === null,
        recommended_sealed: blocker === null,
        blocker,
      },
    ]),
  );
}

export function makeResult(phase, payload = {}) {
  return {
    phase,
    phaseRange,
    routeChoice,
    completed: true,
    recommended_sealed: true,
    blocker: null,
    ...boundary,
    ...payload,
  };
}

export function findBlocker(checks) {
  return Object.entries(checks).find(([, passed]) => passed !== true)?.[0] ?? null;
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

export function countRealOwnerLedgers() {
  const daily = listJsonFiles(`${phaseDogfoodingDir}/daily-ledger`)
    .filter((file) => !/template/i.test(file))
    .map((file) => readJson(file, null))
    .filter((record) => record?.recordType === "owner_daily_ledger" && record?.ownerRecorded === true).length;
  const weekly = listJsonFiles(`${phaseDogfoodingDir}/weekly-review`)
    .filter((file) => !/template/i.test(file))
    .map((file) => readJson(file, null))
    .filter((record) => record?.recordType === "owner_weekly_review" && record?.ownerReviewed === true).length;
  const notes = listJsonFiles(`${phaseDogfoodingDir}/owner-notes`)
    .filter((file) => !/template/i.test(file))
    .map((file) => readJson(file, null))
    .filter((record) => record?.recordType === "owner_manual_note" && record?.ownerProvided === true).length;
  return { daily, weekly, notes };
}

export function boundaryHeld(record) {
  return Object.entries(boundary).every(([key, expected]) => record?.[key] === expected);
}
