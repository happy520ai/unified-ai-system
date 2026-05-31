import {
  findBlocker,
  matchesBoundary,
  phaseKeys,
  readJsonIfExists,
  resultPath,
  validationPath,
  writeJson,
} from "./phase1211-1215-common.mjs";

const result = await readJsonIfExists(resultPath, null);

const checks = {
  resultExists: Boolean(result),
  phase1211Completed: result?.phase1211?.completed === true,
  phase1212Completed: result?.phase1212?.completed === true,
  phase1213Completed: result?.phase1213?.completed === true,
  phase1214Completed: result?.phase1214?.completed === true,
  phase1215Completed: result?.phase1215?.completed === true,
  allRecommendedSealed: result?.allRecommendedSealed === true,
  allBlockersNull: result?.allBlockersNull === true,
  scenarioMatrixGenerated: result?.phase1211?.scenarioMatrixGenerated === true,
  scenarioCountAtLeastTen: Number(result?.phase1211?.scenarioCount) >= 10,
  coversProviderRisk: result?.phase1211?.coversProviderRisk === true,
  coversSecretRisk: result?.phase1211?.coversSecretRisk === true,
  coversChatRequest: result?.phase1211?.coversChatRequest === true,
  coversChatGatewayExecuteRequest: result?.phase1211?.coversChatGatewayExecuteRequest === true,
  coversDeployRequest: result?.phase1211?.coversDeployRequest === true,
  coversCostConstraint: result?.phase1211?.coversCostConstraint === true,
  coversCapabilityCandidateTask: result?.phase1211?.coversCapabilityCandidateTask === true,
  boundaryHardeningVerifierGenerated: result?.phase1212?.boundaryHardeningVerifierGenerated === true,
  providerBoundaryAsserted: result?.phase1212?.providerBoundaryAsserted === true,
  secretBoundaryAsserted: result?.phase1212?.secretBoundaryAsserted === true,
  chatBoundaryAsserted: result?.phase1212?.chatBoundaryAsserted === true,
  chatGatewayExecuteBoundaryAsserted: result?.phase1212?.chatGatewayExecuteBoundaryAsserted === true,
  deployBoundaryAsserted: result?.phase1212?.deployBoundaryAsserted === true,
  semanticClaimBoundaryAsserted: result?.phase1212?.semanticClaimBoundaryAsserted === true,
  operatorUxCopyPolished: result?.phase1213?.operatorUxCopyPolished === true,
  dryRunMeaningClear: result?.phase1213?.dryRunMeaningClear === true,
  candidateMeaningClear: result?.phase1213?.candidateMeaningClear === true,
  notMainChainClear: result?.phase1213?.notMainChainClear === true,
  notProviderCallClear: result?.phase1213?.notProviderCallClear === true,
  notRealSemanticValidationClear: result?.phase1213?.notRealSemanticValidationClear === true,
  internalTrialPackGenerated: result?.phase1214?.internalTrialPackGenerated === true,
  feedbackFormGenerated: result?.phase1214?.feedbackFormGenerated === true,
  comprehensionChecklistGenerated: result?.phase1214?.comprehensionChecklistGenerated === true,
  operatorNotesTemplateGenerated: result?.phase1214?.operatorNotesTemplateGenerated === true,
  realHumanFeedbackCollectedFalse: result?.phase1214?.realHumanFeedbackCollected === false,
  codexSelfTestCountedAsHumanFeedbackFalse: result?.phase1214?.codexSelfTestCountedAsHumanFeedback === false,
  dryRunDemonstrationClosureGenerated: result?.phase1215?.dryRunDemonstrationClosureGenerated === true,
  phase1201To1215TraceMapGenerated: result?.phase1215?.phase1201To1215TraceMapGenerated === true,
  demoNarrativeGenerated: result?.phase1215?.demoNarrativeGenerated === true,
  knownLimitsDocumented: result?.phase1215?.knownLimitsDocumented === true,
  dryRunLoopStable: result?.dryRunLoopStable === true,
  demonstrationClosureReady: result?.demonstrationClosureReady === true,
  realHumanFeedbackCollectedFalseTopLevel: result?.realHumanFeedbackCollected === false,
  boundaryMatches: matchesBoundary(result),
  phaseEvidencePresent: phaseKeys.every((key) => Boolean(result?.phaseEvidenceRefs?.[key])),
};

const blocker = findBlocker(checks);
const validation = {
  phase: "Phase1211-1215-AIO",
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
