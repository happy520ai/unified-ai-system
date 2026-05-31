export { CODEX_CONTEXT_GATEWAY_BOUNDARY } from "./safetyBoundaryChecker.js";
export { buildNeuralRelevancePreview } from "./neuralRelevancePreview.js";
export { readProjectState } from "./projectStateReader.js";
export { indexPhaseEvidence } from "./phaseEvidenceIndexer.js";
export { summarizeGitDiff } from "./gitDiffSummarizer.js";
export { selectRelevantFiles } from "./relevantFileSelector.js";
export { buildTokenBudgetReport, TOKEN_BUDGET_POLICIES } from "./tokenBudgetPolicy.js";
export { compressLongContext } from "./longContextCompressor.js";
export { buildCodexPromptPack } from "./codexPromptBuilder.js";
export { buildSnapshotPolicy, buildContextHash } from "./contextHashPolicy.js";
export { detectContextFreshness } from "./contextFreshnessDetector.js";
export { guardStaleContext } from "./staleContextGuard.js";
export { buildContextPack, CONTEXT_PACK_SCHEMA_VERSION } from "./contextPackSchema.js";
export { generateContextPack } from "./contextPackGenerator.js";
export { readContextPackPreview } from "./contextPackPreviewReader.js";
export { readTokenBudgetPreview } from "./tokenBudgetPreview.js";
export { readFreshnessPreview } from "./freshnessPreview.js";
export { readRelevantFilesPreview } from "./relevantFilesPreview.js";
export { readEvidenceIndexPreview } from "./evidenceIndexPreview.js";
export { readPromptPackPreview } from "./promptPackPreview.js";
export { readDirtySummaryPreview } from "./dirtySummaryPreview.js";
export { readOperatorPanelPreview } from "./operatorPanelPreview.js";
export { buildOperatorRefreshPreview } from "./operatorRefreshPreview.js";
export { buildOperatorPanelErrorState } from "./operatorPanelErrorState.js";
export { buildUsageWorkflowPreview } from "./usageWorkflow.js";
export { runContextPreflight } from "./contextPreflight.js";
export { runFreshnessGate } from "./freshnessGate.js";
export { buildRelevantFileScopeGate } from "./relevantFileScopeGate.js";
export { loadPromptPack } from "./promptPackLoader.js";
export { planValidationCommands } from "./validationCommandPlanner.js";
export { buildRunnerIntegrationPreview } from "./runnerIntegrationPreview.js";
export { buildRunnerConfigPreview } from "./runnerConfigPreview.js";
export { stopWhenContextStale } from "./staleContextStopper.js";
export { buildUsageEvidence } from "./usageEvidenceBuilder.js";
export { buildOperatorWorkflowChecklist } from "./operatorWorkflowChecklist.js";
export { buildCodexInstructionSnippet } from "./codexInstructionSnippetBuilder.js";
export { buildDryRunCodexTaskWrapper } from "./dryRunCodexTaskWrapper.js";
export { buildUsageFailurePreview } from "./usageFailurePreview.js";
export { enforceUsageTokenBudget } from "./usageTokenBudgetEnforcer.js";
export { buildRelevantFileReadAuditPreview } from "./relevantFileReadAuditPreview.js";
export { buildRunnerHeartbeatPreview } from "./runnerHeartbeatPreview.js";
export { buildRunnerResumePreview } from "./runnerResumePreview.js";
export { runRealUsageTrialPreflight } from "./realUsageTrialPreflight.js";
export { buildRelevantFileUsagePolicy } from "./relevantFileUsagePolicy.js";
export { buildRealUsageTaskPlan } from "./realUsageTaskPlan.js";
export { buildActualReadAudit } from "./actualReadAudit.js";
export { trackContextPackUsage } from "./contextPackUsageTracker.js";
export { buildUsageTrialRegressionPlan } from "./usageTrialRegressionPlanner.js";
export { classifyUsageTrialResult } from "./usageTrialResultClassifier.js";
export { buildNextCodexTaskInstruction } from "./nextCodexTaskInstructionBuilder.js";
export { buildUsageTrialEvidence } from "./usageTrialEvidenceBuilder.js";
export { buildRealUsageTrialReport } from "./usageTrialReportBuilder.js";
export { buildRepeatedTaskPlan } from "./repeatedTaskPlanBuilder.js";
export { buildRepeatedUsageReadAudit } from "./repeatedUsageReadAudit.js";
export { estimateRepeatedTokenSaving } from "./repeatedTokenSavingEstimator.js";
export { buildStaleGuardBenchmarkScenario } from "./staleGuardBenchmarkScenario.js";
export { buildFullRepoScanAvoidanceBenchmark } from "./fullRepoScanAvoidanceBenchmark.js";
export { classifyRepeatedUsageResults } from "./repeatedUsageResultClassifier.js";
export { buildRepeatedUsageAggregateReport } from "./repeatedUsageAggregateReport.js";
export { buildRepeatedUsageEvidence } from "./repeatedUsageEvidenceBuilder.js";
export { buildNextUsageInstruction } from "./nextUsageInstructionBuilder.js";
export { buildRepeatedUsageBenchmarkReport } from "./repeatedUsageBenchmark.js";
export { buildControlledBaseUrlIntegrationDesignReport } from "./baseUrlIntegrationDesign.js";
export { buildBaseUrlConfigPreview } from "./baseUrlConfigPreview.js";
export { buildRelayArchitectureDesign } from "./relayArchitectureDesign.js";
export { buildRelayAuthorizationGate } from "./relayAuthorizationGate.js";
export { buildAccountPoolPolicyDesign } from "./accountPoolPolicyDesign.js";
export { buildCacheMissPolicyDesign } from "./cacheMissPolicyDesign.js";
export { buildRateLimitPolicyDesign } from "./rateLimitPolicyDesign.js";
export { buildRollbackPlan } from "./rollbackPlanBuilder.js";
export { buildBaseUrlRiskReview } from "./baseUrlRiskReview.js";
export { buildControlledIntegrationChecklist } from "./controlledIntegrationChecklist.js";
export { buildBaseUrlEvidence } from "./baseUrlEvidenceBuilder.js";
export { buildAuthorizationEvidenceIntake, buildAuthorizationEvidenceTemplate, AUTHORIZATION_REQUIRED_FIELDS } from "./authorizationEvidenceIntake.js";
export { validateAuthorizationCompleteness } from "./authorizationCompletenessValidator.js";
export { buildDryRunConfigSimulation } from "./dryRunConfigSimulation.js";
export { buildRedactedConfigPreview } from "./redactedConfigPreviewBuilder.js";
export { buildRelaySimulationPlan } from "./relaySimulationPlan.js";
export { buildAccountPoolSimulation } from "./accountPoolSimulation.js";
export { buildCredentialRefSimulation } from "./credentialRefSimulation.js";
export { buildBaseUrlDryRunPolicy } from "./baseUrlDryRunPolicy.js";
export { buildRollbackSimulation } from "./rollbackSimulation.js";
export { buildEmergencyDisableSimulation } from "./emergencyDisableSimulation.js";
export { buildMissionControlAuthorizationPreview } from "./missionControlAuthorizationPreview.js";
export { buildAuthorizationEvidenceDryRunSimulationReport } from "./authorizationEvidenceBuilder.js";
export {
  buildPhase599AuthorizationPacketSchema,
  buildPhase599AuthorizationPacketTemplate,
  buildPhase599ExamplePacket,
  normalizePhase599Packet,
  hasForbiddenRawField,
  PHASE599_AUTHORIZATION_REQUIRED_FIELDS,
  PHASE599_FORBIDDEN_RAW_FIELDS,
  PHASE599_ALLOWED_CONFIG_SCOPES,
} from "./phase599AuthorizationPacketSchema.js";
export { loadPhase599AuthorizationPacket } from "./phase599AuthorizationPacketLoader.js";
export { reviewPhase599AuthorizationCompleteness } from "./phase599AuthorizationCompletenessReview.js";
export { buildPhase599HumanApprovalSchema, PHASE599_HUMAN_APPROVAL_REQUIRED_FIELDS, PHASE599_APPROVAL_DECISIONS } from "./phase599HumanApprovalSchema.js";
export { reviewPhase599HumanApproval } from "./phase599HumanApprovalReview.js";
export { reviewPhase599RollbackReadiness } from "./phase599RollbackReadinessReview.js";
export { reviewPhase599RiskAcceptance, PHASE599_REQUIRED_RISKS } from "./phase599RiskAcceptanceReview.js";
export { reviewPhase599GuardedRealTestReadiness } from "./phase599GuardedRealTestReadiness.js";
export { buildPhase599AuthorizationEvidenceLedger } from "./phase599AuthorizationEvidenceLedger.js";
export { buildPhase599MissionControlAuthorizationReviewPreview } from "./phase599MissionControlAuthorizationReviewPreview.js";
export { buildPhase599AuthorizationReviewReport } from "./phase599AuthorizationReviewReport.js";
export {
  buildPhase600AuthorizationInputExample,
  buildPhase600AuthorizationInputSchema,
  hasPhase600ForbiddenRawField,
  normalizePhase600Input,
  PHASE600_ALLOWED_CONFIG_SCOPES,
  PHASE600_AUTHORIZATION_INPUT_REQUIRED_FIELDS,
  PHASE600_FORBIDDEN_RAW_FIELDS,
} from "./phase600AuthorizationInputSchema.js";
export { loadPhase600AuthorizationInput } from "./phase600AuthorizationInputLoader.js";
export {
  buildPhase600HumanApprovalInputExample,
  buildPhase600HumanApprovalInputSchema,
  normalizePhase600ApprovalRecord,
  PHASE600_APPROVAL_DECISIONS,
  PHASE600_HUMAN_APPROVAL_REQUIRED_FIELDS,
} from "./phase600HumanApprovalInputSchema.js";
export { loadPhase600HumanApprovalRecord } from "./phase600HumanApprovalRecordLoader.js";
export {
  buildPhase600ReadinessEvidenceLedger,
  decidePhase600GuardedRealTestReadiness,
  reviewPhase600AuthorizationCompleteness,
  reviewPhase600BudgetRequestDuration,
  reviewPhase600HumanApprovalConsistency,
  reviewPhase600ReferenceReadiness,
  reviewPhase600RiskAcceptanceReadiness,
  reviewPhase600RollbackEmergencyDisableReadiness,
  PHASE600_REQUIRED_RISKS,
} from "./phase600ReadinessReview.js";
export { buildPhase600MissionControlReadinessPreview } from "./phase600MissionControlReadinessPreview.js";
export { buildPhase600ReadinessReviewReport } from "./phase600ReadinessReviewReport.js";
export { buildPhase601ReadinessImport } from "./phase601ReadinessImport.js";
export { buildPhase601SessionOverrideCommandPreview } from "./phase601SessionOverrideCommandPreview.js";
export { buildPhase601RelayHealthCheckPreview } from "./phase601RelayHealthCheckPreview.js";
export { buildPhase601CredentialAccountPoolPrecheck } from "./phase601CredentialAccountPoolPrecheck.js";
export { buildPhase601OneShotPromptPreview } from "./phase601OneShotPromptPreview.js";
export { buildPhase601BudgetRequestLimitPreview } from "./phase601BudgetRequestLimitPreview.js";
export { buildPhase601RollbackCommandPreview } from "./phase601RollbackCommandPreview.js";
export { buildPhase601EmergencyDisablePreview } from "./phase601EmergencyDisablePreview.js";
export { buildPhase601NonExecutionGuard } from "./phase601NonExecutionGuard.js";
export { buildPhase601GuardedTestChecklist } from "./phase601GuardedTestChecklist.js";
export { buildPhase601ProviderCallPolicyPreview } from "./phase601ProviderCallPolicyPreview.js";
export { buildPhase601PreparationEvidenceLedger } from "./phase601PreparationEvidenceLedger.js";
export { buildPhase601PreparationReport } from "./phase601PreparationReport.js";
export { buildPhase602CommandAssembly } from "./phase602CommandAssembly.js";
export { buildPhase602Cleanup } from "./phase602Cleanup.js";
export { buildPhase602EnvPrecheck } from "./phase602EnvPrecheck.js";
export { buildPhase602EvidenceLedger } from "./phase602EvidenceLedger.js";
export {
  buildPhase602FinalConfirmationExample,
  loadPhase602FinalConfirmation,
} from "./phase602FinalConfirmationLoader.js";
export { buildPhase602OneShotExecutor } from "./phase602OneShotExecutor.js";
export { buildPhase602OneShotReport, phase602OneShotPrompt } from "./phase602OneShotReport.js";
export { buildPhase602PreExecutionSafetyGate } from "./phase602PreExecutionSafetyGate.js";
export { buildPhase602ReadinessImport } from "./phase602ReadinessImport.js";
export { classifyPhase602Response } from "./phase602ResponseClassifier.js";
export { buildPhase603ConfigRollbackPreview } from "./phase603ConfigRollbackPreview.js";
export {
  buildPhase603CustomProviderCommandBundle,
  phase603CustomProviderOneShotPrompt,
  phase603NegativeControlCommandPreview,
} from "./phase603CustomProviderCommandBundle.js";
export { inspectPhase603CodexConfigStructure, parsePhase603ConfigStructureText } from "./phase603ConfigStructureInspector.js";
export { buildPhase603DuplicateProviderTableCheck } from "./phase603DuplicateProviderTableCheck.js";
export { buildPhase603PreparationEvidenceLedger } from "./phase603PreparationEvidenceLedger.js";
export { buildPhase603PreparationReport } from "./phase603PreparationReport.js";
export { buildPhase603ProviderPreviewSchema, renderPhase603ProjectConfigPreviewToml } from "./phase603ProviderPreviewSchema.js";
export { buildPhase604CleanupVerifier } from "./phase604CleanupVerifier.js";
export { buildPhase604ConfigStructureReadiness } from "./phase604ConfigStructureReadiness.js";
export { buildPhase604EvidenceLedger } from "./phase604EvidenceLedger.js";
export {
  buildPhase604FinalConfirmationExample,
  loadPhase604FinalConfirmation,
} from "./phase604FinalConfirmationLoader.js";
export {
  buildPhase604NegativeControlCommandAssembly,
  classifyPhase604NegativeControl,
  executePhase604NegativeControl,
  phase604NegativeControlCommandPreview,
} from "./phase604NegativeControlExecutor.js";
export {
  buildPhase604CustomProviderCommandAssembly,
  buildPhase604PreExecutionSafetyGate,
  executePhase604CustomProviderOneShot,
  phase604CustomProviderOneShotPrompt,
} from "./phase604OneShotExecutor.js";
export { buildPhase604OneShotReport, readPhase604OneShotPromptFromDisk } from "./phase604OneShotReport.js";
export { buildPhase604ProviderRouteSelector } from "./phase604ProviderRouteSelector.js";
export { classifyPhase604Response } from "./phase604ResponseClassifier.js";
export {
  buildIsolatedRuntimeCandidateCommandPreview,
  buildIsolatedRuntimeCandidateContract,
  ISOLATED_RUNTIME_CANDIDATE_ACK,
  ISOLATED_RUNTIME_CANDIDATE_PROVIDER_ID,
  ISOLATED_RUNTIME_CANDIDATE_ROUTE_ID,
} from "./isolatedRuntimeCandidateContract.js";
export { buildIsolatedRuntimeCandidateRoutePreview } from "./isolatedRuntimeCandidateRoute.js";
export { buildCodexContextCodecBridge } from "./contextCodecBridge.js";
export { appendContextCodecPromptPackSection } from "./contextCodecPromptPackBuilder.js";

import { generateContextPack } from "./contextPackGenerator.js";
import { summarizeGitDiff } from "./gitDiffSummarizer.js";
import { selectRelevantFiles } from "./relevantFileSelector.js";
import { buildTokenBudgetReport } from "./tokenBudgetPolicy.js";

export async function buildCodexContextPack(options) {
  return generateContextPack(options);
}

export async function buildPhase592RegressionFixtures({ repoRoot }) {
  const tasks = [
    {
      name: "codex-context-gateway-default",
      task: "Build a bounded Codex context pack for Phase592 without provider calls.",
      profile: "codex-context-gateway",
      budgetName: "8k",
    },
    {
      name: "mission-control-workforce",
      task: "Prepare Mission Control and Workforce context pack for dry-run branch execution review.",
      profile: "mission-control-workforce",
      budgetName: "16k",
    },
  ];
  const gitDiff = await summarizeGitDiff({ repoRoot });
  const results = tasks.map((task) => {
    const selection = selectRelevantFiles({ task: task.task, gitDiff, profile: task.profile });
    const budget = buildTokenBudgetReport({ task: task.task, relevantFiles: selection.files, gitDiff }, task.budgetName);
    return {
      name: task.name,
      completed: selection.files.length > 0 && budget.budget.respected === true,
      relevantFileCount: selection.files.length,
      tokenBudgetRespected: budget.budget.respected,
      includesMissionControl:
        task.profile !== "mission-control-workforce" ||
        selection.files.some((item) => item.path.includes("workforce") || item.path.includes("consolePage")),
    };
  });
  return {
    completed: results.every((item) => item.completed && item.includesMissionControl),
    contextPackRegressionTestsPassed: results.every((item) => item.tokenBudgetRespected),
    missionControlWorkforceContextPackTestPassed: results.find((item) => item.name === "mission-control-workforce")?.includesMissionControl === true,
    summary: results,
  };
}
