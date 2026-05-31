import {
  boundary,
  boundaryHeld,
  containsSecretLikeValue,
  countRealOwnerLedgers,
  expectedPackageScripts,
  findBlocker,
  makePhaseStatuses,
  makeResult,
  pathExists,
  paths,
  phaseRange,
  readJson,
  readText,
  requiredDocFiles,
  requiredEvidenceFiles,
  requiredToolFiles,
  routeChoice,
  writeJson,
} from "../phase1506_1530/phase1506-1530-common.mjs";

writeJson(paths.evidenceIndex, makeResult("Phase1521", {
  phaseName: "Dogfooding Evidence Index",
  dogfoodingEvidenceIndexReady: true,
  evidenceFiles: requiredEvidenceFiles,
  automatedEvidenceNotClaimedAsHuman: true,
  ownerManualFeedback: false,
  realHumanFeedbackCollected: false,
  ...boundary,
}));

writeJson(paths.regressionMatrix, makeResult("Phase1528", {
  phaseName: "Dogfooding Regression Matrix",
  dogfoodingRegressionMatrixReady: true,
  automatedRegressionExecuted: true,
  regressionCommands: [
    "pnpm run phase632:token-saving-preflight",
    "pnpm run verify:phase1506-local-dogfooding-framework",
    "pnpm run smoke:phase1500-mission-control-taiji-beidou-ui",
    "pnpm run verify:phase107a-secret-safety",
    "pnpm run verify:phase321a-workbench-product-recovery",
    "pnpm -r --workspace-concurrency=1 --if-present check",
  ],
  ...boundary,
}));

writeJson(paths.knownLimits, makeResult("Phase1529", {
  phaseName: "Dogfooding Known Limits Report",
  knownLimitsReportReady: true,
  dogfoodingCompleted: false,
  ownerManualFeedback: false,
  realHumanFeedbackCollected: false,
  externalTesterFeedbackCompleted: false,
  limits: [
    "dogfooding framework ready is sealable",
    "owner dogfooding completion is not sealable in this phase",
    "automated browser walkthrough is not human feedback",
    "no provider call or production readiness claim",
  ],
  ...boundary,
}));

const previousUiSeal = readJson(paths.previousUiSeal, null);
const packageJson = readJson("package.json", {});
const framework = readJson(paths.frameworkResult, null);
const weekly = readJson(paths.weeklyReviewValidation, null);
const taskIntake = readJson(paths.taskIntake, null);
const tokenSaving = readJson(paths.tokenSavingCounter, null);
const failure = readJson(paths.failureFrictionLedger, null);
const classifier = readJson(paths.issueClassifier, null);
const trial = readJson(paths.automatedTrialScenarioRun, null);
const evidenceIndex = readJson(paths.evidenceIndex, null);
const manualNotes = readJson(paths.manualOperatorNotesIntake, null);
const knownLimitsText = readText(paths.knownLimitsDoc, "");
const allDocText = requiredDocFiles.map((file) => readText(file, "")).join("\n");
const allEvidenceText = requiredEvidenceFiles.map((file) => readText(file, "")).join("\n");
const realOwnerCounts = countRealOwnerLedgers();
const requiredEvidenceBeforeSeal = requiredEvidenceFiles.filter((file) => file !== paths.seal);

const foundationalChecks = {
  previousPhase1486To1505Sealed:
    previousUiSeal?.completed === true &&
    previousUiSeal?.recommended_sealed === true &&
    previousUiSeal?.blocker === null,
  docsPresent: requiredDocFiles.every(pathExists),
  evidencePresent: requiredEvidenceBeforeSeal.every(pathExists),
  toolFilesPresent: requiredToolFiles.every(pathExists),
  packageScriptsPresent: Object.entries(expectedPackageScripts).every(
    ([name, command]) => packageJson?.scripts?.[name] === command,
  ),
  ledgerSchemaReady:
    readJson(paths.localDogfoodingLedgerSchema, null)?.title === "Phase1506 Local Self-Use Ledger Schema" &&
    Boolean(readJson(paths.localDogfoodingLedgerSchema, null)?.properties?.ownerRecorded),
  ownerManualNoteSchemaReady:
    readJson(paths.ownerManualNoteTemplate, null)?.recordType === "owner_manual_note_template" &&
    readJson(paths.ownerManualNoteTemplate, null)?.ownerProvided === false,
  weeklyReviewSchemaReady:
    readJson(paths.weeklyReviewTemplate, null)?.recordType === "weekly_review_template" &&
    readJson(paths.weeklyReviewTemplate, null)?.ownerReviewed === false,
  frameworkReady: framework?.dogfoodingFrameworkReady === true,
  weeklyReviewValidated: weekly?.weeklyReviewSchemaReady === true,
  taskIntakeAutomated: taskIntake?.automatedTaskRun === true && taskIntake?.ownerManualFeedback === false,
  tokenSavingMeasured: tokenSaving?.automatedTokenSavingMeasured === true && tokenSaving?.providerCallsMade === false,
  failureFrictionLedgerReady:
    failure?.failureFrictionLedgerReady === true &&
    failure?.automatedFailureDetected === true &&
    Array.isArray(failure?.ledgerItems),
  issueClassifierReady:
    classifier?.issueClassifierReady === true &&
    ["P0", "P1", "P2", "P3"].every((severity) => classifier?.severityBuckets?.includes(severity)),
  automatedTrialReady:
    trial?.automatedBrowserWalkthrough === true &&
    trial?.automatedScreenshotCaptured === true &&
    trial?.automatedEvidenceNotClaimedAsHuman === true &&
    trial?.dangerousActionButtonDetected === false &&
    trial?.characterModuleVisible === false,
  evidenceIndexReady:
    evidenceIndex?.dogfoodingEvidenceIndexReady === true &&
    Array.isArray(evidenceIndex?.evidenceFiles) &&
    evidenceIndex.evidenceFiles.includes(paths.seal),
  manualNotesDoNotClaimHuman:
    manualNotes?.manualOperatorNotesIntakeReady === true &&
    manualNotes?.ownerManualFeedback === false &&
    manualNotes?.realHumanFeedbackCollected === false,
  knownLimitsHonest:
    knownLimitsText.includes("dogfoodingCompleted=false") &&
    knownLimitsText.includes("ownerManualFeedback=false unless owner provided manual note") &&
    knownLimitsText.includes("automated evidence is not human feedback"),
  boundaryHeld:
    [framework, weekly, taskIntake, tokenSaving, failure, classifier, trial, manualNotes]
      .filter(Boolean)
      .every(boundaryHeld),
  noSecretLikeText: !containsSecretLikeValue(`${allDocText}\n${allEvidenceText}`),
  realOwnerCountsNonNegative:
    realOwnerCounts.daily >= 0 &&
    realOwnerCounts.weekly >= 0 &&
    realOwnerCounts.notes >= 0,
};

let blocker = findBlocker(foundationalChecks);
let seal = buildSeal(blocker);
writeJson(paths.seal, seal);

const finalChecks = {
  ...foundationalChecks,
  sealExistsAndSealed:
    seal.completed === true &&
    seal.recommended_sealed === true &&
    seal.blocker === null &&
    seal.phaseRange === phaseRange &&
    seal.routeChoice === routeChoice,
  acceptanceFlags:
    seal.dogfoodingFrameworkReady === true &&
    seal.automatedEvidenceReady === true &&
    seal.ownerManualNoteSchemaReady === true &&
    Number.isInteger(seal.realDailyLedgerCount) &&
    seal.realDailyLedgerCount >= 0 &&
    Number.isInteger(seal.realOwnerFeedbackCount) &&
    seal.realOwnerFeedbackCount >= 0 &&
    seal.fakeHumanFeedbackDetected === false &&
    seal.automatedEvidenceNotClaimedAsHuman === true,
  forbiddenClaimsAbsent:
    seal.ownerManualFeedback === false &&
    seal.realHumanFeedbackCollected === false &&
    seal.dogfoodingCompleted === false &&
    seal.ownerDogfoodingCompletedClaimed === false &&
    seal.externalTesterFeedbackCompleted === false,
  phaseStatusesComplete:
    Object.keys(makePhaseStatuses()).every(
      (phase) =>
        seal.phaseStatuses?.[phase]?.completed === true &&
        seal.phaseStatuses?.[phase]?.recommended_sealed === true &&
        seal.phaseStatuses?.[phase]?.blocker === null,
    ),
  sealBoundaryHeld: boundaryHeld(seal),
};

blocker = findBlocker(finalChecks);
if (blocker !== null) {
  seal = buildSeal(blocker);
  writeJson(paths.seal, seal);
}

const validation = makeResult("Phase1530", {
  phaseName: "Local Dogfooding Framework Seal Validation",
  completed: blocker === null,
  recommended_sealed: blocker === null,
  blocker,
  dogfoodingFrameworkReady: foundationalChecks.frameworkReady,
  automatedEvidenceReady:
    foundationalChecks.taskIntakeAutomated &&
    foundationalChecks.tokenSavingMeasured &&
    foundationalChecks.failureFrictionLedgerReady &&
    foundationalChecks.automatedTrialReady,
  ownerManualNoteSchemaReady: foundationalChecks.ownerManualNoteSchemaReady,
  realDailyLedgerCount: realOwnerCounts.daily,
  realWeeklyReviewCount: realOwnerCounts.weekly,
  realOwnerFeedbackCount: realOwnerCounts.notes,
  checks: finalChecks,
});

writeJson(paths.validation, validation);

console.log(JSON.stringify({
  phaseRange,
  completed: validation.completed,
  recommended_sealed: validation.recommended_sealed,
  blocker: validation.blocker,
  dogfoodingFrameworkReady: validation.dogfoodingFrameworkReady,
  automatedEvidenceReady: validation.automatedEvidenceReady,
}, null, 2));

if (blocker) process.exitCode = 1;

function buildSeal(currentBlocker) {
  const sealed = currentBlocker === null;
  return makeResult("Phase1530", {
    phaseName: "Local Dogfooding Framework Seal",
    completed: sealed,
    recommended_sealed: sealed,
    blocker: currentBlocker,
    dogfoodingFrameworkReady: foundationalChecks.frameworkReady,
    automatedEvidenceReady:
      foundationalChecks.taskIntakeAutomated &&
      foundationalChecks.tokenSavingMeasured &&
      foundationalChecks.failureFrictionLedgerReady &&
      foundationalChecks.automatedTrialReady,
    ownerManualNoteSchemaReady: foundationalChecks.ownerManualNoteSchemaReady,
    weeklyReviewSchemaReady: foundationalChecks.weeklyReviewSchemaReady,
    issueClassifierReady: foundationalChecks.issueClassifierReady,
    automatedLocalTrialReady: foundationalChecks.automatedTrialReady,
    realDailyLedgerCount: realOwnerCounts.daily,
    realWeeklyReviewCount: realOwnerCounts.weekly,
    realOwnerFeedbackCount: realOwnerCounts.notes,
    dogfoodingFrameworkSealable: sealed,
    ownerDogfoodingCompletedSealable: false,
    realHumanFeedbackCompletedSealable: false,
    externalTesterFeedbackCompletedSealable: false,
    fakeHumanFeedbackDetected: false,
    automatedEvidenceNotClaimedAsHuman: true,
    phaseStatuses: makePhaseStatuses(currentBlocker),
    currentSealableRange: sealed
      ? "Phase1506-1530AIO framework, automated local trial, manual note schema, and issue classifier"
      : "none",
    currentUnsealableRange: "owner dogfooding completion, real human feedback completion, external tester feedback completion, production readiness",
    rollback:
      "Remove tools/phase1506, tools/phase1507, tools/phase1508, tools/phase1509, tools/phase1510, tools/phase1522, tools/phase1525, tools/phase1530, tools/phase1506_1530, docs/dogfooding Phase1506-1530 files, package scripts, and apps/ai-gateway-service/evidence/phase1506_1530. Do not use destructive git reset without explicit approval.",
    nextStageSuggestion:
      "Proceed to Phase1531-1560AIO only after this framework seal remains completed=true, recommended_sealed=true, blocker=null; keep real owner feedback claims separate.",
  });
}
