import {
  closurePath,
  dogfoodingDir,
  evidenceDir,
  findBlocker,
  issueLedgerPath,
  knownLimitsPath,
  oneMonthReviewGatePath,
  phaseDefinitions,
  repoRoot,
  readJsonIfExists,
  readTextIfExists,
  repairLedgerPath,
  reportPath,
  requiredFrameworkFiles,
  resultPath,
  safetyBoundary,
  twoMonthReviewGatePath,
  validationPath,
  writeJson,
} from "./phase1451-1475-common.mjs";

const result = await readJsonIfExists(resultPath, null);
const packageJson = await readJsonIfExists(`${repoRoot}/package.json`, null);
const issueLedger = await readJsonIfExists(issueLedgerPath, null);
const repairLedger = await readJsonIfExists(repairLedgerPath, null);
const closure = await readJsonIfExists(closurePath, null);
const report = await readTextIfExists(reportPath, "");
const knownLimits = await readTextIfExists(knownLimitsPath, "");
const oneMonthGate = await readTextIfExists(oneMonthReviewGatePath, "");
const twoMonthGate = await readTextIfExists(twoMonthReviewGatePath, "");
const missionControlPanel = await readTextIfExists(`${repoRoot}/apps/ai-gateway-service/src/ui/components/MissionControlPanel.js`, "");
const dogfoodingPanel = await readTextIfExists(`${repoRoot}/apps/ai-gateway-service/src/ui/components/TaijiBeidouRealLocalDogfoodingIntakePanel.js`, "");
const dogfoodingCopy = await readTextIfExists(`${repoRoot}/apps/ai-gateway-service/src/ui/copy/taijiBeidouRealLocalDogfoodingIntakeCopy.js`, "");

const checks = {
  resultExists: Boolean(result),
  packageSmokeScript:
    packageJson?.scripts?.["smoke:phase1451-1475-real-local-dogfooding-intake"] ===
    "node tools/phase1451-1475/run-real-local-dogfooding-intake.mjs && node tools/phase1451-1475/validate-real-local-dogfooding-intake.mjs",
  packageVerifyScript:
    packageJson?.scripts?.["verify:phase1451-1475-real-local-dogfooding-intake"] ===
    "node tools/phase1451-1475/validate-real-local-dogfooding-intake.mjs",
  completedTrue: result?.completed === true,
  recommendedSealedTrue: result?.recommended_sealed === true,
  blockerAllowed:
    result?.blocker === null ||
    result?.blocker === "real_owner_dogfooding_records_missing" ||
    result?.blocker === "p0_issue_detected",
  phaseRange: result?.phase === "Phase1451-1475-AIO",
  dogfoodingFrameworkFound: result?.dogfoodingFrameworkFound === true,
  intakePreflightPassed: result?.intakePreflightPassed === true,
  requiredFrameworkFilesPresent:
    Array.isArray(result?.requiredFrameworkFilesFound) &&
    requiredFrameworkFiles.every((file) => result.requiredFrameworkFilesFound.includes(file)),
  dogfoodingIntakeStarted: result?.dogfoodingIntakeStarted === true,
  issueRepairLoopReady: result?.issueRepairLoopReady === true,
  dailyLedgerIntakeCompleted: result?.dailyLedgerIntakeCompleted === true,
  weeklyReviewIntakeCompleted: result?.weeklyReviewIntakeCompleted === true,
  ownerFeedbackClassified: result?.ownerFeedbackClassified === true,
  p1RiskReviewed: result?.p1RiskReviewed === true,
  repairPlanGenerated: result?.repairPlanGenerated === true,
  repairLedgerGenerated: result?.repairLedgerGenerated === true,
  dogfoodingEvidenceLinked: result?.dogfoodingEvidenceLinked === true,
  evidenceRefsValidated: result?.evidenceRefsValidated === true,
  missingEvidenceRefsLedgerGenerated: result?.missingEvidenceRefsLedgerGenerated === true,
  ledgerQualityReviewed: result?.ledgerQualityReviewed === true,
  knownLimitsUpdated: result?.knownLimitsUpdated === true,
  oneMonthReviewGatePrepared: result?.oneMonthReviewGatePrepared === true,
  twoMonthReviewGatePrepared: result?.twoMonthReviewGatePrepared === true,
  launchDeferred: result?.launchDeferred === true,
  deployAllowedFalse: result?.deployAllowed === false,
  releaseAllowedFalse: result?.releaseAllowed === false,
  publicLaunchAllowedFalse: result?.publicLaunchAllowed === false,
  post1475RouteRecommendationGenerated: result?.post1475RouteRecommendationGenerated === true,
  dogfoodingIntakeEvidenceClosureGenerated: result?.dogfoodingIntakeEvidenceClosureGenerated === true,
  recordsFabricatedFalse: result?.recordsFabricated === false,
  codexSelfTestCountedAsOwnerFeedbackFalse: result?.codexSelfTestCountedAsOwnerFeedback === false,
  realOneMonthDogfoodingCompletedFalse: result?.realOneMonthDogfoodingCompleted === false,
  realTwoMonthDogfoodingCompletedFalse: result?.realTwoMonthDogfoodingCompleted === false,
  noFakeOwnerCompletion:
    result?.realOwnerDogfoodingRecordCount > 0 || result?.realOwnerDogfoodingCompleted === false,
  missingOwnerRecordsBlockerWhenNoOwnerRecords:
    result?.realOwnerDogfoodingRecordCount > 0 ||
    result?.blocker === "real_owner_dogfooding_records_missing" ||
    result?.blocker === "p0_issue_detected",
  issueLedgerExists: Boolean(issueLedger),
  issueLedgerNotFabricated: issueLedger?.recordsFabricated === false,
  repairLedgerExists: Boolean(repairLedger),
  repairLedgerNotHighRisk: repairLedger?.highRiskRuntimeRepairExecuted === false,
  closureExists: closure?.dogfoodingIntakeEvidenceClosureGenerated === true,
  reportGenerated: report.includes("Phase1451-1475") && report.includes("realOwnerDogfoodingCompleted=false"),
  knownLimitsGenerated:
    knownLimits.includes("not production ready") &&
    knownLimits.includes("real dogfooding duration not completed") &&
    knownLimits.includes("no production launch"),
  oneMonthGateGenerated: oneMonthGate.includes("oneMonthCompleted=false"),
  twoMonthGateGenerated: twoMonthGate.includes("twoMonthCompleted=false"),
  dogfoodingDirGenerated: result?.dogfoodingDir === dogfoodingDir,
  evidenceDirGenerated: result?.evidenceDir === evidenceDir,
  missionControlPanelMounted:
    missionControlPanel.includes("renderTaijiBeidouRealLocalDogfoodingIntakePanel") &&
    missionControlPanel.includes("TaijiBeidouRealLocalDogfoodingIntakePanel.js"),
  dogfoodingPanelReadOnly:
    dogfoodingPanel.includes("data-taiji-real-local-dogfooding-read-only=\"true\"") &&
    !dogfoodingPanel.includes("<button") &&
    dogfoodingCopy.includes("providerCallsMade"),
  dogfoodingCopyBoundary:
    dogfoodingCopy.includes("Real Local Dogfooding Intake") &&
    dogfoodingCopy.includes("no production claim"),
  mainChainDefaultEnabledTrue: result?.mainChainDefaultEnabled === true,
  taijiBeidouDefaultEnabledTrue: result?.taijiBeidouDefaultEnabled === true,
  providerRuntimeDefaultEnabledFalse: result?.providerRuntimeDefaultEnabled === false,
};

for (const [phaseNumber] of phaseDefinitions) {
  const phase = result?.[`Phase${phaseNumber}`];
  checks[`Phase${phaseNumber}.completed`] = phase?.completed === true;
  checks[`Phase${phaseNumber}.recommended_sealed`] = phase?.recommended_sealed === true;
  checks[`Phase${phaseNumber}.blocker`] =
    phase?.blocker === null ||
    phase?.blocker === "real_owner_dogfooding_records_missing" ||
    phase?.blocker === "p0_issue_detected";
}

for (const [key, expected] of Object.entries(safetyBoundary)) {
  checks[`boundary.${key}`] = result?.[key] === expected;
}

const blocker = findBlocker(checks);
const validation = {
  phase: "Phase1451-1475-AIO",
  completed: blocker === null,
  recommended_sealed: blocker === null,
  blocker,
  checks,
};

await writeJson(validationPath, validation);

console.log(JSON.stringify({
  phase: validation.phase,
  completed: validation.completed,
  recommended_sealed: validation.recommended_sealed,
  blocker: validation.blocker,
}, null, 2));

if (blocker) process.exitCode = 1;
