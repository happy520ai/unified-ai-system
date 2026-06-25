// CodexContextGatewayPanel - evidence reader functions (Phase 607 - 628R)
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonEvidence } from "./CodexContextGatewayPanel-utils.js";

export const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

function readEvidence(relativePath) {
  return readJsonEvidence(repoRoot, relativePath);
}

export function readPhase607InteractiveTerminalIntakePreview() {
  const fallback = {
    blocker: "manual_result_input_missing",
    oneShotExecutionIntakeCompleted: false,
    route: "interactive_terminal_manual_command",
    selectedProviderId: "crs",
    manualResultInputExists: false,
    requestAttemptCount: 0,
    retryAttemptCount: 0,
    testStatus: "blocked",
    responseClassification: "blocked_by_missing_manual_result",
    cleanupStatus: "manual_result_input_missing",
    configWriteStatus: "codexConfigModified=false; projectCodexConfigModified=false",
    nextAction: "provide_docs_phase607r_interactive_terminal_result_input_json",
    ledgerJson: "apps/ai-gateway-service/evidence/phase607r/interactive-terminal-evidence-ledger.json",
    phase604FirstAttemptImported: false,
    phase605RootCauseImported: false,
    manualCommandPackReferenced: false,
  };

  const parsed = readEvidence("apps/ai-gateway-service/evidence/phase607r/interactive-terminal-execution-intake-result.json");
  if (!parsed) return fallback;

  return {
    ...fallback,
    blocker: parsed.blocker ?? fallback.blocker,
    oneShotExecutionIntakeCompleted: parsed.oneShotExecutionIntakeCompleted === true,
    route: parsed.missionControlPreview?.route ?? fallback.route,
    selectedProviderId: parsed.selectedProviderId ?? fallback.selectedProviderId,
    manualResultInputExists: parsed.manualResultInputExists === true,
    requestAttemptCount: Number(parsed.requestAttemptCount ?? fallback.requestAttemptCount),
    retryAttemptCount: Number(parsed.retryAttemptCount ?? fallback.retryAttemptCount),
    testStatus: parsed.testStatus ?? fallback.testStatus,
    responseClassification: parsed.responseClassification ?? fallback.responseClassification,
    cleanupStatus: parsed.missionControlPreview?.cleanupStatus ?? fallback.cleanupStatus,
    configWriteStatus: parsed.missionControlPreview?.configWriteStatus ?? fallback.configWriteStatus,
    nextAction: parsed.missionControlPreview?.nextAction ?? fallback.nextAction,
    ledgerJson: parsed.ledgerJson ?? fallback.ledgerJson,
    phase604FirstAttemptImported: parsed.phase604FirstAttemptImported === true,
    phase605RootCauseImported: parsed.phase605RootCauseImported === true,
    manualCommandPackReferenced: parsed.manualCommandPackReferenced === true,
  };
}

export function readPhase610CodexExecResultIntakePreview() {
  const fallback = {
    blocker: "result_input_missing",
    status: "custom model_provider one-shot not recorded",
    selectedProviderId: "crs",
    requestAttemptCount: 0,
    retryAttemptCount: 0,
    responseClassification: "blocked_by_missing_result",
    stderrWarningNonBlocking: false,
    notProductionReady: true,
    notRepeatedReliabilityProven: true,
    noChatIntegration: true,
    nextAction: "run_phase610r_result_intake_verifier",
  };

  const parsed = readEvidence("apps/ai-gateway-service/evidence/phase610r/codex-exec-one-shot-result-intake.json");
  if (!parsed) return fallback;

  return {
    ...fallback,
    blocker: parsed.blocker ?? null,
    status: parsed.missionControlPreview?.status ?? fallback.status,
    selectedProviderId: parsed.selectedProviderId ?? fallback.selectedProviderId,
    requestAttemptCount: Number(parsed.requestAttemptCount ?? fallback.requestAttemptCount),
    retryAttemptCount: Number(parsed.retryAttemptCount ?? fallback.retryAttemptCount),
    responseClassification: parsed.responseClassification ?? fallback.responseClassification,
    stderrWarningNonBlocking: parsed.stderrWarningNonBlocking === true,
    notProductionReady: parsed.missionControlPreview?.notProductionReady !== false,
    notRepeatedReliabilityProven: parsed.missionControlPreview?.notRepeatedReliabilityProven !== false,
    noChatIntegration: parsed.missionControlPreview?.noChatIntegration !== false,
    nextAction: parsed.responseClassification === "pass" ? "design_repeated_guarded_test_without_chat_integration" : "root_cause_review_no_retry",
  };
}

export function readPhase611ReliabilityDesignPreview() {
  const fallback = {
    blocker: "design_evidence_missing",
    selectedProviderId: "crs",
    phase610OneShotPassOnce: true,
    phase611ReliabilityDesignReady: false,
    maxPlannedAttempts: 3,
    executedYet: false,
    notProductionReady: true,
    notChatIntegrated: true,
    notReleaseReady: true,
    nextAction: "run_phase611r_reliability_design_verifier",
  };

  const parsed = readEvidence("apps/ai-gateway-service/evidence/phase611r/repeated-custom-model-provider-reliability-design-result.json");
  if (!parsed) return fallback;

  return {
    ...fallback,
    blocker: parsed.blocker ?? null,
    selectedProviderId: parsed.selectedProviderId ?? fallback.selectedProviderId,
    phase610OneShotPassOnce: parsed.missionControlPreview?.phase610OneShotPassOnce === true,
    phase611ReliabilityDesignReady: parsed.missionControlPreview?.phase611ReliabilityDesignReady === true,
    maxPlannedAttempts: Number(parsed.maxPlannedAttempts ?? fallback.maxPlannedAttempts),
    executedYet: parsed.missionControlPreview?.executedYet === true,
    notProductionReady: parsed.missionControlPreview?.notProductionReady !== false,
    notChatIntegrated: parsed.missionControlPreview?.notChatIntegrated !== false,
    notReleaseReady: parsed.missionControlPreview?.notReleaseReady !== false,
    nextAction: parsed.completed === true ? "await_explicit_phase612r_reliability_execution_confirmation" : "fix_phase611r_design_verifier",
  };
}

export function readPhase611RepeatedGuardedTestDesignPreview() {
  const fallback = {
    blocker: "guarded_design_evidence_missing",
    selectedProviderId: "crs",
    phase610OneShotPassOnce: true,
    phase611RepeatedReliabilityDesignReady: false,
    maxPlannedAttempts: 3,
    maxRequestsTotal: 3,
    phase612ExecutionRequiresExplicitConfirmation: true,
    notProductionReady: true,
    notReleaseReady: true,
    notChatIntegrated: true,
    nextAction: "run_phase611r_repeated_guarded_test_design_verifier",
  };

  const parsed = readEvidence("apps/ai-gateway-service/evidence/phase611r/repeated-guarded-test-design-result.json");
  if (!parsed) return fallback;

  return {
    ...fallback,
    blocker: parsed.blocker ?? null,
    selectedProviderId: parsed.selectedProviderId ?? fallback.selectedProviderId,
    phase610OneShotPassOnce: parsed.missionControlPreview?.phase610OneShotPassOnce === true,
    phase611RepeatedReliabilityDesignReady: parsed.missionControlPreview?.phase611RepeatedReliabilityDesignReady === true,
    maxPlannedAttempts: Number(parsed.maxPlannedAttempts ?? fallback.maxPlannedAttempts),
    maxRequestsTotal: Number(parsed.maxRequestsTotal ?? fallback.maxRequestsTotal),
    phase612ExecutionRequiresExplicitConfirmation: parsed.missionControlPreview?.phase612ExecutionRequiresExplicitConfirmation !== false,
    notProductionReady: parsed.missionControlPreview?.notProductionReady !== false,
    notReleaseReady: parsed.missionControlPreview?.notReleaseReady !== false,
    notChatIntegrated: parsed.missionControlPreview?.notChatIntegrated !== false,
    nextAction: parsed.completed === true ? "await_explicit_phase612r_guarded_execution_confirmation" : "fix_phase611r_guarded_design_verifier",
  };
}

export function readPhase612RepeatedGuardedReliabilityPreview() {
  const fallback = {
    blocker: "repeated_reliability_evidence_missing",
    repeatedTestExecuted: false,
    selectedProviderId: "crs",
    plannedAttempts: 3,
    completedAttempts: 0,
    totalRequestAttemptCount: 0,
    totalRetryAttemptCount: 0,
    repeatedReliabilityClassification: "not_executed",
    allAttemptsPassed: false,
    stoppedReason: "not_executed",
    notProductionReady: true,
    notReleaseReady: true,
    notChatIntegrated: true,
    nextAction: "run_phase612r_repeated_guarded_reliability_test",
  };

  const parsed = readEvidence("apps/ai-gateway-service/evidence/phase612r/repeated-guarded-reliability-result.json");
  if (!parsed) return fallback;

  return {
    ...fallback,
    blocker: parsed.blocker ?? null,
    repeatedTestExecuted: parsed.repeatedTestExecuted === true,
    selectedProviderId: parsed.selectedProviderId ?? fallback.selectedProviderId,
    plannedAttempts: Number(parsed.plannedAttempts ?? fallback.plannedAttempts),
    completedAttempts: Number(parsed.completedAttempts ?? fallback.completedAttempts),
    totalRequestAttemptCount: Number(parsed.totalRequestAttemptCount ?? fallback.totalRequestAttemptCount),
    totalRetryAttemptCount: Number(parsed.totalRetryAttemptCount ?? fallback.totalRetryAttemptCount),
    repeatedReliabilityClassification: parsed.repeatedReliabilityClassification ?? fallback.repeatedReliabilityClassification,
    allAttemptsPassed: parsed.allAttemptsPassed === true,
    stoppedReason: parsed.stoppedReason ?? fallback.stoppedReason,
    notProductionReady: parsed.missionControlPreview?.notProductionReady !== false,
    notReleaseReady: parsed.missionControlPreview?.notReleaseReady !== false,
    notChatIntegrated: parsed.missionControlPreview?.notChatIntegrated !== false,
    nextAction: parsed.allAttemptsPassed === true ? "design_controlled_next_gate_without_chat_integration" : "root_cause_review_no_retry",
  };
}

export function readPhase613RepeatedReliabilityClosurePreview() {
  const fallback = {
    blocker: "closure_evidence_missing",
    phase612RepeatedPass: false,
    selectedProviderId: "crs",
    completedAttempts: 0,
    totalRequestAttemptCount: 0,
    totalRetryAttemptCount: 0,
    capabilityBoundary: "controlled codex exec custom model_provider only",
    nextGate: "controlled integration preview requires separate approval",
    notProductionReady: true,
    notReleaseReady: true,
    notChatIntegrated: true,
    notChatGatewayExecuteIntegrated: true,
    nextAction: "run_phase613r_repeated_reliability_closure_verifier",
  };

  const parsed = readEvidence("apps/ai-gateway-service/evidence/phase613r/repeated-reliability-result-closure.json");
  if (!parsed) return fallback;

  return {
    ...fallback,
    blocker: parsed.blocker ?? null,
    phase612RepeatedPass: parsed.missionControlPreview?.phase612RepeatedPass === true,
    selectedProviderId: parsed.selectedProviderId ?? fallback.selectedProviderId,
    completedAttempts: Number(parsed.completedAttempts ?? fallback.completedAttempts),
    totalRequestAttemptCount: Number(parsed.totalRequestAttemptCount ?? fallback.totalRequestAttemptCount),
    totalRetryAttemptCount: Number(parsed.totalRetryAttemptCount ?? fallback.totalRetryAttemptCount),
    capabilityBoundary: parsed.missionControlPreview?.capabilityBoundary ?? fallback.capabilityBoundary,
    nextGate: parsed.missionControlPreview?.nextGate ?? fallback.nextGate,
    notProductionReady: parsed.missionControlPreview?.notProductionReady !== false,
    notReleaseReady: parsed.missionControlPreview?.notReleaseReady !== false,
    notChatIntegrated: parsed.missionControlPreview?.notChatIntegrated !== false,
    notChatGatewayExecuteIntegrated: parsed.missionControlPreview?.notChatGatewayExecuteIntegrated !== false,
    nextAction: parsed.completed === true ? "design_phase614r_controlled_integration_preview" : fallback.nextAction,
  };
}

export function readPhase614ControlledIntegrationPreviewGate() {
  const fallback = {
    blocker: "preview_gate_evidence_missing",
    previewOnly: false,
    routeId: "codex_exec_crs_preview",
    integrationMode: "preview_only",
    selectedProviderId: "crs",
    allowedEntryPoints: ["mission_control_read_only_preview"],
    forbiddenEntryPoints: ["/chat", "/chat-gateway/execute", "provider_runtime", "production_router"],
    maxRequestsDefault: 1,
    maxRequestsHardLimit: 3,
    defaultChatIntegrationAllowed: false,
    chatGatewayExecuteIntegrationAllowed: false,
    providerRuntimeModificationAllowed: false,
    runtimeIntegrationRequiresSeparateApproval: true,
    notProductionReady: true,
    notReleaseReady: true,
    notChatIntegrated: true,
    notChatGatewayExecuteIntegrated: true,
    nextAction: "run_phase614r_controlled_integration_preview_gate_verifier",
  };

  const parsed = readEvidence("apps/ai-gateway-service/evidence/phase614r/controlled-integration-preview-gate-result.json");
  if (!parsed) return fallback;

  return {
    ...fallback,
    blocker: parsed.blocker ?? null,
    previewOnly: parsed.previewOnly === true,
    routeId: parsed.routeContract?.routeId ?? fallback.routeId,
    integrationMode: parsed.routeContract?.mode ?? fallback.integrationMode,
    selectedProviderId: parsed.missionControlPreview?.selectedProviderId ?? fallback.selectedProviderId,
    allowedEntryPoints: parsed.routeContract?.allowedEntryPoints ?? fallback.allowedEntryPoints,
    forbiddenEntryPoints: parsed.routeContract?.forbiddenEntryPoints ?? fallback.forbiddenEntryPoints,
    maxRequestsDefault: Number(parsed.routeContract?.maxRequestsDefault ?? fallback.maxRequestsDefault),
    maxRequestsHardLimit: Number(parsed.routeContract?.maxRequestsHardLimit ?? fallback.maxRequestsHardLimit),
    defaultChatIntegrationAllowed: parsed.defaultChatIntegrationAllowed === true,
    chatGatewayExecuteIntegrationAllowed: parsed.chatGatewayExecuteIntegrationAllowed === true,
    providerRuntimeModificationAllowed: parsed.providerRuntimeModificationAllowed === true,
    runtimeIntegrationRequiresSeparateApproval: parsed.missionControlPreview?.runtimeIntegrationRequiresSeparateApproval !== false,
    notProductionReady: parsed.missionControlPreview?.notProductionReady !== false,
    notReleaseReady: parsed.missionControlPreview?.notReleaseReady !== false,
    notChatIntegrated: parsed.missionControlPreview?.notChatIntegrated !== false,
    notChatGatewayExecuteIntegrated: parsed.missionControlPreview?.notChatGatewayExecuteIntegrated !== false,
    nextAction: parsed.completed === true ? "phase615r_runtime_integration_approval_packet" : fallback.nextAction,
  };
}

export function readPhase615RuntimeIntegrationApprovalPacket() {
  const fallback = {
    blocker: "approval_packet_evidence_missing",
    approvalPacketReady: false,
    runtimeIntegrationNotExecuted: true,
    approvalRequired: true,
    selectedProviderId: "crs",
    notProductionReady: true,
    notReleaseReady: true,
    notChatIntegrated: true,
    notChatGatewayExecuteIntegrated: true,
    providerRuntimeModified: false,
    operatorChecklistGenerated: false,
    rollbackPlanGenerated: false,
    emergencyDisablePlanGenerated: false,
    maxRequestsBudgetPolicyGenerated: false,
    nextPhase: "Phase616R-Fix Runtime Candidate Route Contract Dry-Run",
  };

  const parsed = readEvidence("apps/ai-gateway-service/evidence/phase615r/runtime-integration-approval-packet-result.json");
  if (!parsed) return fallback;

  return {
    ...fallback,
    blocker: parsed.blocker ?? null,
    approvalPacketReady: parsed.approvalPacketReady === true,
    runtimeIntegrationNotExecuted: parsed.runtimeIntegrationExecuted !== true,
    approvalRequired: parsed.missionControlPreview?.approvalRequired !== false,
    selectedProviderId: parsed.missionControlPreview?.selectedProviderId ?? fallback.selectedProviderId,
    notProductionReady: parsed.missionControlPreview?.notProductionReady !== false,
    notReleaseReady: parsed.missionControlPreview?.notReleaseReady !== false,
    notChatIntegrated: parsed.missionControlPreview?.notChatIntegrated !== false,
    notChatGatewayExecuteIntegrated: parsed.missionControlPreview?.notChatGatewayExecuteIntegrated !== false,
    providerRuntimeModified: parsed.providerRuntimeModified === true,
    operatorChecklistGenerated: parsed.operatorChecklistGenerated === true,
    rollbackPlanGenerated: parsed.rollbackPlanGenerated === true,
    emergencyDisablePlanGenerated: parsed.emergencyDisablePlanGenerated === true,
    maxRequestsBudgetPolicyGenerated: parsed.maxRequestsBudgetPolicyGenerated === true,
    nextPhase: parsed.missionControlPreview?.nextPhase ?? fallback.nextPhase,
  };
}

export function readPhase616R620RRuntimeCandidateDryRunBundle() {
  const fallback = {
    blocker: "dry_run_candidate_evidence_missing",
    dryRunCandidateSealed: false,
    selectedProviderId: "crs",
    routeId: "codex_exec_crs_runtime_candidate_dry_run",
    candidateMode: "dry_run_candidate_only",
    maxRequestsDefault: 1,
    maxRequestsHardLimit: 3,
    retryLimit: 0,
    runtimeIntegrationExecuted: false,
    notProductionReady: true,
    notReleaseReady: true,
    notChatIntegrated: true,
    notChatGatewayExecuteIntegrated: true,
    providerRuntimeModified: false,
    nextPhase: "Phase621R-Fix Runtime Candidate Implementation Plan Review",
  };

  const parsed = readEvidence("apps/ai-gateway-service/evidence/phase616r-620r/controlled-runtime-candidate-dry-run-bundle-result.json");
  if (!parsed) return fallback;

  return {
    ...fallback,
    blocker: parsed.blocker ?? null,
    dryRunCandidateSealed: parsed.dryRunCandidateSealed === true,
    selectedProviderId: parsed.selectedProviderId ?? fallback.selectedProviderId,
    routeId: parsed.routeId ?? fallback.routeId,
    candidateMode: parsed.candidateMode ?? fallback.candidateMode,
    maxRequestsDefault: Number(parsed.maxRequestsDefault ?? fallback.maxRequestsDefault),
    maxRequestsHardLimit: Number(parsed.maxRequestsHardLimit ?? fallback.maxRequestsHardLimit),
    retryLimit: Number(parsed.retryLimit ?? fallback.retryLimit),
    runtimeIntegrationExecuted: parsed.runtimeIntegrationExecuted === true,
    notProductionReady: parsed.missionControlPreview?.notProductionReady !== false,
    notReleaseReady: parsed.missionControlPreview?.notReleaseReady !== false,
    notChatIntegrated: parsed.missionControlPreview?.notChatIntegrated !== false,
    notChatGatewayExecuteIntegrated: parsed.missionControlPreview?.notChatGatewayExecuteIntegrated !== false,
    providerRuntimeModified: parsed.providerRuntimeModified === true,
    nextPhase: parsed.missionControlPreview?.nextPhase ?? fallback.nextPhase,
  };
}

export function readPhase621R628RControlledRuntimeCandidatePath() {
  const fallback = {
    blocker: "controlled_runtime_candidate_path_evidence_missing",
    selectedProviderId: "crs",
    isolatedRuntimeCandidateWired: false,
    routeId: "codex_exec_crs_runtime_candidate_isolated",
    dryRunSmokePassed: false,
    guardedIsolatedOneShotPassed: false,
    repeatedReliabilityClassification: "not_verified",
    completedAttempts: 0,
    totalRequestAttemptCount: 0,
    totalRetryAttemptCount: 0,
    allAttemptsPassed: false,
    runtimeIntegrationExecuted: false,
    runtimeIntegrated: false,
    chatIntegrated: false,
    chatGatewayExecuteIntegrated: false,
    providerRuntimeModified: false,
    codexExecExecutedByThisPhase: false,
    providerCallsMadeByThisPhase: false,
    productionReadyClaimed: false,
    releaseReadyClaimed: false,
    nextPhase: "Phase629R-Fix Controlled Runtime Candidate Implementation Review",
  };

  const parsed = readEvidence("apps/ai-gateway-service/evidence/phase621r-628r/controlled-runtime-candidate-path-result.json");
  if (!parsed) return fallback;

  return {
    ...fallback,
    blocker: parsed.blocker ?? null,
    selectedProviderId: parsed.selectedProviderId ?? fallback.selectedProviderId,
    isolatedRuntimeCandidateWired: parsed.isolatedRuntimeCandidateWired === true,
    routeId: parsed.routeId ?? fallback.routeId,
    dryRunSmokePassed: parsed.dryRunSmokePassed === true,
    guardedIsolatedOneShotPassed: parsed.guardedIsolatedOneShotPassed === true,
    repeatedReliabilityClassification: parsed.missionControlPreview?.isolatedRepeatedReliabilityClassification ?? (parsed.repeatedReliabilityValidated === true ? "isolated_repeated_pass" : fallback.repeatedReliabilityClassification),
    completedAttempts: Number(parsed.completedAttempts ?? fallback.completedAttempts),
    totalRequestAttemptCount: Number(parsed.totalRequestAttemptCount ?? fallback.totalRequestAttemptCount),
    totalRetryAttemptCount: Number(parsed.totalRetryAttemptCount ?? fallback.totalRetryAttemptCount),
    allAttemptsPassed: parsed.allAttemptsPassed === true,
    runtimeIntegrationExecuted: parsed.runtimeIntegrationExecuted === true,
    runtimeIntegrated: parsed.runtimeIntegrated === true,
    chatIntegrated: parsed.chatIntegrated === true,
    chatGatewayExecuteIntegrated: parsed.chatGatewayExecuteIntegrated === true,
    providerRuntimeModified: parsed.providerRuntimeModified === true,
    codexExecExecutedByThisPhase: parsed.codexExecExecutedByThisPhase === true,
    providerCallsMadeByThisPhase: parsed.providerCallsMadeByThisPhase === true,
    productionReadyClaimed: parsed.productionReadyClaimed === true,
    releaseReadyClaimed: parsed.releaseReadyClaimed === true,
    nextPhase: parsed.missionControlPreview?.nextPhase ?? fallback.nextPhase,
  };
}
