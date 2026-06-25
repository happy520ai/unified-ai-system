// CodexContextGatewayPanel - evidence reader functions (Phase 629R - 650R)
import { readJsonEvidence, } from "./CodexContextGatewayPanel-utils.js";
import { repoRoot } from "./CodexContextGatewayPanel-readers-a.js";

function readEvidence(relativePath) {
  return readJsonEvidence(repoRoot, relativePath);
}

export function readPhase629RMainChainFinalHumanApprovalPacket() {
  const fallback = {
    blocker: "main_chain_final_approval_packet_evidence_missing",
    phase621r628rImported: false,
    approvalPacketReady: false,
    selectedProviderId: "crs",
    mainChainIntegrationNotExecuted: true,
    finalHumanApprovalRequired: true,
    chatModified: false,
    chatGatewayExecuteModified: false,
    providerRuntimeModified: false,
    codexExecExecutedByThisPhase: false,
    providerCallsMadeByThisPhase: false,
    notProductionReady: true,
    notReleaseReady: true,
    nextPhase: "Phase630R-Fix Main Chain Integration Design Patch",
  };

  const parsed = readEvidence("apps/ai-gateway-service/evidence/phase629r/main-chain-integration-final-human-approval-packet-result.json");
  if (!parsed) return fallback;

  return {
    ...fallback,
    blocker: parsed.blocker ?? null,
    phase621r628rImported: parsed.phase621r628rImported === true,
    approvalPacketReady: parsed.approvalPacketReady === true,
    selectedProviderId: parsed.missionControlPreview?.selectedProviderId ?? fallback.selectedProviderId,
    mainChainIntegrationNotExecuted: parsed.mainChainIntegrationExecuted !== true,
    finalHumanApprovalRequired: parsed.missionControlPreview?.finalHumanApprovalRequired !== false,
    chatModified: parsed.chatModified === true,
    chatGatewayExecuteModified: parsed.chatGatewayExecuteModified === true,
    providerRuntimeModified: parsed.providerRuntimeModified === true,
    codexExecExecutedByThisPhase: parsed.codexExecExecutedByThisPhase === true,
    providerCallsMadeByThisPhase: parsed.providerCallsMadeByThisPhase === true,
    notProductionReady: parsed.missionControlPreview?.notProductionReady !== false,
    notReleaseReady: parsed.missionControlPreview?.notReleaseReady !== false,
    nextPhase: parsed.missionControlPreview?.nextPhase ?? fallback.nextPhase,
  };
}

export function readPhase630RMainChainIntegrationDesignPatch() {
  const fallback = {
    blocker: "main_chain_design_patch_evidence_missing",
    phase629rImported: false,
    designPatchReady: false,
    selectedProviderId: "crs",
    patchId: "phase630r-main-chain-route-patch-preview",
    patchMode: "design_preview_only",
    patchpreviewOnly: false,
    mainChainPatchNotApplied: true,
    targetEntryPointsPreview: ["/chat", "/chat-gateway/execute"],
    targetEntryPointsModified: [],
    chatModified: false,
    chatGatewayExecuteModified: false,
    providerRuntimeModified: false,
    codexExecExecutedByThisPhase: false,
    providerCallsMadeByThisPhase: false,
    phase631ApprovalRequired: true,
    notProductionReady: true,
    notReleaseReady: true,
    nextPhase: "Phase631R-Fix Main Chain Isolated Implementation Patch Candidate",
  };

  const parsed = readEvidence("apps/ai-gateway-service/evidence/phase630r/main-chain-integration-design-patch-result.json");
  if (!parsed) return fallback;

  const routePatch = parsed.routePatchPreview ?? {};
  return {
    ...fallback,
    blocker: parsed.blocker ?? null,
    phase629rImported: parsed.phase629rImported === true,
    designPatchReady: parsed.designPatchReady === true,
    selectedProviderId: parsed.missionControlPreview?.selectedProviderId ?? routePatch.selectedProviderId ?? fallback.selectedProviderId,
    patchId: routePatch.patchId ?? fallback.patchId,
    patchMode: routePatch.patchMode ?? fallback.patchMode,
    patchPreviewOnly: parsed.patchPreviewOnly === true,
    mainChainPatchNotApplied: parsed.mainChainIntegrationExecuted !== true,
    targetEntryPointsPreview: routePatch.targetEntryPointsPreview ?? fallback.targetEntryPointsPreview,
    targetEntryPointsModified: routePatch.targetEntryPointsModified ?? fallback.targetEntryPointsModified,
    chatModified: parsed.chatModified === true,
    chatGatewayExecuteModified: parsed.chatGatewayExecuteModified === true,
    providerRuntimeModified: parsed.providerRuntimeModified === true,
    codexExecExecutedByThisPhase: parsed.codexExecExecutedByThisPhase === true,
    providerCallsMadeByThisPhase: parsed.providerCallsMadeByThisPhase === true,
    phase631ApprovalRequired: parsed.missionControlPreview?.phase631ApprovalRequired !== false,
    notProductionReady: parsed.missionControlPreview?.notProductionReady !== false,
    notReleaseReady: parsed.missionControlPreview?.notReleaseReady !== false,
    nextPhase: parsed.missionControlPreview?.nextPhase ?? fallback.nextPhase,
  };
}

export function readPhase639RP1ApprovalPreview() {
  const fallback = {
    blocker: "p1_approval_packet_bundle_evidence_missing",
    mainChainApprovalPacketReady: false,
    providerRuntimeApprovalPacketReady: false,
    p1ApprovalPacketsReady: false,
    implementationExecuted: false,
    mainChainIntegrated: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    providerRuntimeModified: false,
    providerCallsMade: false,
    productionReady: false,
    releaseReady: false,
    nextApprovalRequired: true,
    nextPhase: "Phase640R-Fix P1 Implementation Candidate Review",
  };

  const parsed = readEvidence("apps/ai-gateway-service/evidence/phase639r/p1-approval-packet-bundle-result.json");
  if (!parsed) return fallback;

  return {
    ...fallback,
    blocker: parsed.blocker ?? null,
    mainChainApprovalPacketReady: parsed.mainChainApprovalPacketReady === true,
    providerRuntimeApprovalPacketReady: parsed.providerRuntimeApprovalPacketReady === true,
    p1ApprovalPacketsReady: parsed.p1ApprovalPacketsReady === true,
    implementationExecuted: parsed.implementationExecuted === true,
    mainChainIntegrated: parsed.mainChainIntegrated === true,
    chatModified: parsed.chatModified === true,
    chatGatewayExecuteModified: parsed.chatGatewayExecuteModified === true,
    providerRuntimeModified: parsed.providerRuntimeModified === true,
    providerCallsMade: parsed.providerCallsMade === true,
    productionReady: parsed.productionReady === true,
    releaseReady: parsed.releaseReady === true,
    nextApprovalRequired: parsed.productionReadyClaimed !== true && parsed.releaseReadyClaimed !== true,
    nextPhase: parsed.nextPhase ?? fallback.nextPhase,
  };
}

export function readPhase639RNightlyFallbackOperatorPanel() {
  const fallback = {
    blocker: "nightly_fallback_operator_panel_evidence_missing",
    originalBlocker: "windows_task_scheduler_access_denied",
    scheduledTaskRegistered: false,
    nightlyAutomationEnabled: false,
    fallbackLauncherAvailable: false,
    fallbackCmdAvailable: false,
    fallbackPs1Available: false,
    fallbackCmdPath: "tools/phase638r/run-nightly-safe-runner-once.cmd",
    fallbackPs1Path: "tools/phase638r/run-nightly-safe-runner-once.ps1",
    phase632PreflightRequired: true,
    providerCallsAllowed: false,
    secretAccessAllowed: false,
    chatModificationAllowed: false,
    chatGatewayExecuteModificationAllowed: false,
    deployAllowed: false,
    latestEvidencePath: "apps/ai-gateway-service/evidence/phase638r/nightly-runner-registration-fallback-result.json",
    nextAction: "admin/permissioned registration session or manual fallback launcher",
  };

  const parsed = readEvidence("apps/ai-gateway-service/evidence/phase639r-nightly/nightly-runner-fallback-operator-panel-result.json");
  if (!parsed) return fallback;

  return {
    ...fallback,
    blocker: parsed.blocker ?? null,
    originalBlocker: parsed.originalBlocker ?? fallback.originalBlocker,
    scheduledTaskRegistered: parsed.scheduledTaskRegistered === true,
    nightlyAutomationEnabled: parsed.nightlyAutomationEnabled === true,
    fallbackLauncherAvailable: parsed.fallbackLauncherAvailable === true,
    fallbackCmdAvailable: parsed.fallbackCmdAvailable === true,
    fallbackPs1Available: parsed.fallbackPs1Available === true,
    phase632PreflightRequired: parsed.phase632PreflightRequired !== false,
    latestEvidencePath: parsed.importEvidenceJson ?? fallback.latestEvidencePath,
    nextAction: parsed.nextAction ?? fallback.nextAction,
  };
}

export function readPhase640RNightlyPermissionedRetryPack() {
  const fallback = {
    blocker: "permissioned_retry_pack_evidence_missing",
    originalBlocker: "windows_task_scheduler_access_denied",
    scheduledTaskRegistered: false,
    nightlyAutomationEnabled: false,
    fallbackLauncherAvailable: true,
    permissionedRetryPackReady: false,
    permissionedRetryScriptGenerated: false,
    verifyScriptGenerated: false,
    safeUnregisterScriptGenerated: false,
    adminChecklistGenerated: false,
    resultInputExampleGenerated: false,
    autoElevationAttempted: false,
    permissionBypassAttempted: false,
    windowsTaskRegisteredByThisPhase: false,
    nightlyRunnerExecutedByThisPhase: false,
    adminChecklistPath: "docs/phase640r-nightly-admin-registration-checklist.md",
    verifyScriptPath: "tools/phase640r-nightly/verify-nightly-task-registration.ps1",
    resultInputExamplePath: "docs/phase640r-nightly-registration-result.input.example.json",
    nextAction: "manually run retry script in a permissioned session",
  };

  const parsed = readEvidence("apps/ai-gateway-service/evidence/phase640r-nightly/permissioned-scheduler-registration-retry-pack-result.json");
  if (!parsed) return fallback;

  return {
    ...fallback,
    blocker: parsed.blocker ?? null,
    originalBlocker: parsed.originalBlocker ?? fallback.originalBlocker,
    scheduledTaskRegistered: parsed.scheduledTaskRegistered === true,
    nightlyAutomationEnabled: parsed.nightlyAutomationEnabled === true,
    fallbackLauncherAvailable: parsed.fallbackLauncherAvailable === true,
    permissionedRetryPackReady: parsed.permissionedRetryPackReady === true,
    permissionedRetryScriptGenerated: parsed.permissionedRetryScriptGenerated === true,
    verifyScriptGenerated: parsed.verifyScriptGenerated === true,
    safeUnregisterScriptGenerated: parsed.safeUnregisterScriptGenerated === true,
    adminChecklistGenerated: parsed.adminChecklistGenerated === true,
    resultInputExampleGenerated: parsed.resultInputExampleGenerated === true,
    autoElevationAttempted: parsed.autoElevationAttempted === true,
    permissionBypassAttempted: parsed.permissionBypassAttempted === true,
    windowsTaskRegisteredByThisPhase: parsed.windowsTaskRegisteredByThisPhase === true,
    nightlyRunnerExecutedByThisPhase: parsed.nightlyRunnerExecutedByThisPhase === true,
    adminChecklistPath: "docs/phase640r-nightly-admin-registration-checklist.md",
    verifyScriptPath: "tools/phase640r-nightly/verify-nightly-task-registration.ps1",
    resultInputExamplePath: "docs/phase640r-nightly-registration-result.input.example.json",
  };
}

export function readPhase641RNightlyRegistrationResultIntake() {
  const fallback = {
    blocker: "registration_result_input_missing",
    inputExists: false,
    inputValid: false,
    systemVerificationExecuted: false,
    systemVerificationPassed: false,
    scheduledTaskRegistered: false,
    nightlyAutomationEnabled: false,
    taskName: "PME-AI-Gateway-Nightly-Safe-Runner",
    trigger: "daily",
    startTimeLocal: "20:00",
    nextRunTime: null,
    lastTaskResult: null,
    actionValidated: false,
    phase632PreflightRequired: true,
    fallbackLauncherAvailable: true,
    latestEvidencePath: "apps/ai-gateway-service/evidence/phase641r-nightly/registration-result-intake.json",
    nextAction: "provide docs/phase641r-nightly-registration-result.input.json after permissioned registration succeeds",
  };

  const parsed = readEvidence("apps/ai-gateway-service/evidence/phase641r-nightly/registration-result-intake.json");
  if (!parsed) return fallback;

  return {
    ...fallback,
    blocker: parsed.blocker ?? null,
    inputExists: parsed.inputExists === true,
    inputValid: parsed.inputValid === true,
    systemVerificationExecuted: parsed.systemVerificationExecuted === true,
    systemVerificationPassed: parsed.systemVerificationPassed === true,
    scheduledTaskRegistered: parsed.scheduledTaskRegistered === true,
    nightlyAutomationEnabled: parsed.nightlyAutomationEnabled === true,
    taskName: parsed.taskName ?? fallback.taskName,
    trigger: parsed.trigger ?? fallback.trigger,
    startTimeLocal: parsed.startTimeLocal ?? fallback.startTimeLocal,
    nextRunTime: parsed.nextRunTime ?? null,
    lastTaskResult: parsed.lastTaskResult ?? null,
    actionValidated: parsed.actionValidated === true,
    phase632PreflightRequired: parsed.phase632PreflightRequired !== false,
    fallbackLauncherAvailable: parsed.fallbackLauncherAvailable !== false,
    latestEvidencePath: "apps/ai-gateway-service/evidence/phase641r-nightly/registration-result-intake.json",
    nextAction: parsed.nextAction ?? fallback.nextAction,
  };
}

export function readPhase640RExternalToolMode() {
  const fallback = {
    externalToolMode: true,
    mainChainIntegrationPlanned: false,
    chatIntegrationPlanned: false,
    chatGatewayExecuteIntegrationPlanned: false,
    providerRuntimeIntegrationPlanned: false,
    tokenSavingPreflightRequired: true,
    modelProviderCrsRepeatedPass: true,
    nightlySafeRunnerAvailable: true,
    scheduledTaskRegistered: false,
    fallbackLauncherAvailable: true,
    productionReady: false,
    releaseReady: false,
    notProductionTrafficPath: true,
    capabilityMatrixPath: "docs/phase640r-external-tool-capability-matrix.json",
  };

  const parsed = readEvidence(fallback.capabilityMatrixPath);
  if (!parsed) return fallback;

  return {
    ...fallback,
    externalToolMode: parsed.externalToolMode === true,
    mainChainIntegrationPlanned: parsed.mainChainIntegrationPlanned === true,
    chatIntegrationPlanned: parsed.chatIntegrationPlanned === true,
    chatGatewayExecuteIntegrationPlanned: parsed.chatGatewayExecuteIntegrationPlanned === true,
    providerRuntimeIntegrationPlanned: parsed.providerRuntimeIntegrationPlanned === true,
    tokenSavingPreflightRequired: parsed.tokenSavingPreflightRequired !== false,
    modelProviderCrsRepeatedPass: parsed.modelProviderCrsRepeatedPass === true,
    nightlySafeRunnerAvailable: parsed.nightlySafeRunnerAvailable === true,
    scheduledTaskRegistered: parsed.scheduledTaskRegistered === true,
    fallbackLauncherAvailable: parsed.fallbackLauncherAvailable === true,
    productionReady: parsed.productionReady === true,
    releaseReady: parsed.releaseReady === true,
    notProductionTrafficPath:
      parsed.mainChainIntegrationPlanned !== true &&
      parsed.chatIntegrationPlanned !== true &&
      parsed.chatGatewayExecuteIntegrationPlanned !== true &&
      parsed.providerRuntimeIntegrationPlanned !== true,
  };
}

export function readPhase641R645RExternalToolBundle() {
  const fallback = {
    toolMode: "external_tool",
    phase632PreflightMandatory: true,
    contextPackStatus: "required",
    relevantFilesStatus: "required",
    tokenBudgetStatus: "required",
    staleGateStatus: "stale=false required",
    fullRepoScanForbidden: true,
    outputBudgetRequired: true,
    crsRepeatedPass: true,
    nightlyFallbackAvailable: true,
    scheduledTaskRegistered: false,
    externalToolMode: true,
    mainChainIntegrationPlanned: false,
    chatIntegrationPlanned: false,
    chatGatewayExecuteIntegrationPlanned: false,
    providerRuntimeIntegrationPlanned: false,
    cliWrapperReady: false,
    operatorPanelReady: false,
    nightlySafeRunnerReliabilityChecked: false,
    openSourceDryRunToolPackReady: false,
    tokenSavingBenchmarkRechecked: false,
    productionReady: false,
    releaseReady: false,
    evidencePath: "apps/ai-gateway-service/evidence/phase641r-645r-external-tool/external-tool-productization-bundle-result.json",
  };

  const parsed = readEvidence(fallback.evidencePath);
  if (!parsed) return fallback;

  return {
    ...fallback,
    externalToolMode: parsed.externalToolMode === true,
    mainChainIntegrationPlanned: parsed.mainChainIntegrationPlanned === true,
    chatIntegrationPlanned: parsed.chatIntegrationPlanned === true,
    chatGatewayExecuteIntegrationPlanned: parsed.chatGatewayExecuteIntegrationPlanned === true,
    providerRuntimeIntegrationPlanned: parsed.providerRuntimeIntegrationPlanned === true,
    cliWrapperReady: parsed.cliWrapperReady === true,
    operatorPanelReady: parsed.operatorPanelReady === true,
    nightlySafeRunnerReliabilityChecked: parsed.nightlySafeRunnerReliabilityChecked === true,
    openSourceDryRunToolPackReady: parsed.openSourceDryRunToolPackReady === true,
    tokenSavingBenchmarkRechecked: parsed.tokenSavingBenchmarkRechecked === true,
    productionReady: parsed.productionReadyClaimed === true,
    releaseReady: parsed.releaseReadyClaimed === true,
  };
}

export function readPhase646R650RExternalToolClosure() {
  const fallback = {
    externalToolMode: true,
    phase632PreflightMandatory: true,
    contextPackStatus: "required",
    relevantFilesStatus: "required",
    tokenBudgetStatus: "required",
    staleGateStatus: "stale=false required",
    nightlyRunnerStatus: "safe_runner_available",
    fallbackLauncherStatus: "fallback_launcher_available",
    dailyWorkflowReady: false,
    taskQueueLedgerReady: false,
    evidenceDashboardReady: false,
    tokenSavingReportReady: false,
    nextUsePlaybookReady: false,
    chatIntegrationPlanned: false,
    chatGatewayExecuteIntegrationPlanned: false,
    providerRuntimeIntegrationPlanned: false,
    productionReady: false,
    releaseReady: false,
    dailyWorkflowPath: "docs/phase646r-external-tool-daily-workflow.md",
    nextUsePlaybookPath: "docs/phase650r-external-tool-next-use-playbook.md",
    evidencePath: "apps/ai-gateway-service/evidence/phase646r-650r-external-tool/external-tool-daily-workflow-closure-result.json",
  };

  const parsed = readEvidence(fallback.evidencePath);
  if (!parsed) return fallback;

  return {
    ...fallback,
    externalToolMode: parsed.externalToolMode === true,
    dailyWorkflowReady: parsed.dailyWorkflowReady === true,
    taskQueueLedgerReady: parsed.taskQueueLedgerReady === true,
    evidenceDashboardReady: parsed.evidenceDashboardReady === true,
    tokenSavingReportReady: parsed.tokenSavingReportReady === true,
    nextUsePlaybookReady: parsed.nextUsePlaybookReady === true,
    productionReady: parsed.productionReadyClaimed === true,
    releaseReady: parsed.releaseReadyClaimed === true,
  };
}
