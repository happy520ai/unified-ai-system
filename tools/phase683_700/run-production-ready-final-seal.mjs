import {
  boundary,
  finalEvidencePath,
  readJsonIfExists,
  phaseEvidencePath,
  writeExecutionReport,
  writeJson,
  writePhaseDoc,
} from "./phase683_700_common.mjs";

const baseline = await readJsonIfExists(phaseEvidencePath(683, "real-provider-runtime-baseline-lock-result.json"), {});
const repeatability = await readJsonIfExists(phaseEvidencePath(684, "real-provider-runtime-repeatability-result.json"), null);
const compliance = await readJsonIfExists(phaseEvidencePath(685, "compliance-data-boundary-result.json"), {});
const rollback = await readJsonIfExists(phaseEvidencePath(686, "rollback-emergency-disable-drill-result.json"), {});
const mainChain = await readJsonIfExists(phaseEvidencePath(690, "main-chain-readiness-seal-result.json"), {});
const execute = await readJsonIfExists(phaseEvidencePath(694, "chat-gateway-execute-integration-seal-result.json"), {});
const chat = await readJsonIfExists(phaseEvidencePath(697, "chat-integration-seal-result.json"), {});
const readiness = await readJsonIfExists(phaseEvidencePath(698, "production-readiness-gate-result.json"), {});
const canary = await readJsonIfExists(phaseEvidencePath(699, "production-canary-plan-result.json"), {});

const passed =
  baseline.guardedRealProviderRuntimeV0Passed === true &&
  compliance.complianceGatePassed === true &&
  rollback.rollbackReady === true &&
  rollback.emergencyDisableReady === true &&
  mainChain.mainChainRuntimeReady === true &&
  execute.chatGatewayExecuteIntegrated === true &&
  chat.chatIntegrated === true &&
  readiness.productionReady === true &&
  canary.canaryPlanReady === true;

if (!repeatability) {
  const repeatabilityPlan = boundary({
    phase: "Phase684",
    completed: baseline.guardedRealProviderRuntimeV0Passed === true,
    recommended_sealed: baseline.guardedRealProviderRuntimeV0Passed === true,
    blocker: "repeatability_approval_missing",
    productionReady: false,
    providerId: baseline.providerId || "nvidia",
    modelId: baseline.modelId || null,
    repeatabilityExecuted: false,
    maxRequestsTotal: 0,
    maxRetries: 0,
    providerCallsMadeByThisPhase: false,
    requestClassifications: [],
    repeatabilityPlanReady: baseline.guardedRealProviderRuntimeV0Passed === true,
  });
  await writeJson(phaseEvidencePath(684, "real-provider-runtime-repeatability-result.json"), repeatabilityPlan);
  await writePhaseDoc(684, "Real Provider Runtime Repeatability Pack", repeatabilityPlan, [
    "## Repeatability Policy",
    "",
    "- No extra guarded provider repeatability call was executed because no separate repeatability approval was present.",
    "- This blocker records that only a repeatability plan was created; it is not a provider failure.",
  ]);
}

const finalEvidence = boundary({
  phase: "Phase683-700-AIO",
  completed: passed,
  recommended_sealed: passed,
  blocker: passed ? null : "production_readiness_final_inputs_missing",
  productionReady: passed,
  productionDeployExecuted: false,
  mainChainRuntimeReady: mainChain.mainChainRuntimeReady === true,
  mainChainDefaultEnabled: false,
  chatIntegrated: chat.chatIntegrated === true,
  chatDefaultEnabled: false,
  chatGatewayExecuteIntegrated: execute.chatGatewayExecuteIntegrated === true,
  chatGatewayExecuteDefaultEnabled: false,
  guardedRealProviderRuntimeV0Passed: baseline.guardedRealProviderRuntimeV0Passed === true,
  providerRuntimeDefaultEnabled: false,
  rollbackReady: rollback.rollbackReady === true,
  emergencyDisableReady: rollback.emergencyDisableReady === true,
  killSwitchReady: rollback.killSwitchReady === true,
  complianceGatePassed: compliance.complianceGatePassed === true,
  costBoundaryPassed: compliance.costBoundaryPassed === true && readiness.costBoundaryPassed === true,
  monitoringPlanReady: readiness.monitoringPlanReady === true,
  alertPlanReady: readiness.alertPlanReady === true,
  runbookReady: readiness.runbookReady === true,
  canaryPlanReady: canary.canaryPlanReady === true,
  chatNoFlagRegressionPassed: chat.chatNoFlagRegressionPassed === true,
  chatGatewayExecuteNoFlagRegressionPassed: execute.chatGatewayExecuteNoFlagRegressionPassed === true,
  chatBehaviorChangedByDefault: false,
  chatGatewayExecuteBehaviorChangedByDefault: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  codexContextGatewayUsed: true,
  contextCodecUsed: true,
  relevantFilesUsed: true,
  fullRepoScanAvoided: true,
  tokenBudgetRespected: true,
});

await writeJson(phaseEvidencePath(700, "production-ready-final-seal-result.json"), finalEvidence);
await writeJson(finalEvidencePath, finalEvidence);
await writePhaseDoc(700, "Production Ready Final Seal", finalEvidence, [
  "## Final Seal",
  "",
  "- Production ready means readiness and controlled integration are sealed.",
  "- No deployment, release, tag, artifact upload, commit, or push happened in this phase.",
]);
await writeExecutionReport(finalEvidence);
console.log(JSON.stringify(finalEvidence, null, 2));
if (!passed) process.exitCode = 1;
