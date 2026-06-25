// CodexContextGatewayPanel - data preparation (computed HTML rows)
import { escapeHtml, escapeAttr, displaySafePath, displaySafeText } from "./CodexContextGatewayPanel-utils.js";

export function preparePanelData(
  preview, usage, trial, benchmark, baseUrlDesign, authorizationDesign,
  humanApprovalReview, readinessReview, preparationReview, oneShotReview,
  customProviderReview, customProviderOneShotReview,
  interactiveTerminalIntake, codexExecIntake,
  repeatedReliabilityDesign, repeatedGuardedTestDesign, repeatedGuardedTestResult,
  repeatedReliabilityClosure, controlledIntegrationPreviewGate,
  runtimeIntegrationApprovalPacket, runtimeCandidateDryRunBundle,
  controlledRuntimeCandidatePath, mainChainFinalApprovalPacket, mainChainDesignPatch,
  phase639RP1ApprovalPreview, phase639RNightlyFallbackPanel,
  phase640RNightlyPermissionedRetryPack, phase641RNightlyRegistrationResultIntake,
  phase640RExternalToolMode, phase641R645RExternalToolBundle, phase646R650RExternalToolClosure,
  copy
) {
  const hash = preview.contextHash || "missing";
  const token = preview.tokenBudget;
  const freshness = preview.freshness;
  const files = preview.relevantFiles;
  const evidence = preview.evidenceIndex;
  const dirty = preview.dirtySummary;
  const prompt = preview.promptPack;

  const badges = copy.boundaryBadges.map((badge) => `<span data-codex-safety-badge="${escapeAttr(badge)}">${escapeHtml(badge)}</span>`).join("");
  const fileRows = files.files.slice(0, 8).map((file) => `
                    <li><code>${escapeHtml(file.path)}</code><span>${escapeHtml(file.reason)}</span></li>`).join("");
  const evidenceRows = evidence.evidenceSummary.slice(0, 6).map((item) => `
                    <li><span>${escapeHtml(displaySafeText(item.phaseId || item.evidenceId))}</span><code>${escapeHtml(displaySafePath(item.path))}</code></li>`).join("");
  const validationRows = usage.validationPlan.commands.slice(0, 5).map((command) => `
                    <li><code>${escapeHtml(command)}</code></li>`).join("");
  const usageChecks = usage.operatorChecklist.items.slice(0, 6).map((item) => `
                    <li>${escapeHtml(item)}</li>`).join("");
  const trialInstruction = trial.nextInstruction.instruction.split("\n").slice(0, 4).map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const benchmarkNext = benchmark.nextInstruction.instruction.split("\n").slice(0, 4).map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const baseUrlRisks = baseUrlDesign.riskReview.risks.slice(0, 5).map((risk) => `
                    <li>${escapeHtml(risk)}</li>`).join("");
  const baseUrlRollback = baseUrlDesign.rollback.steps.slice(0, 5).map((step) => `
                    <li>${escapeHtml(step)}</li>`).join("");
  const baseUrlChecklist = baseUrlDesign.checklist.items.slice(0, 5).map((item) => `
                    <li>${escapeHtml(item)}</li>`).join("");
  const authMissingFields = authorizationDesign.missingAuthorizationFields.slice(0, 8).map((field) => `
                    <li><code>${escapeHtml(field)}</code></li>`).join("");
  const authRequiredFields = authorizationDesign.authorizationIntake.requiredFields.slice(0, 8).map((field) => `
                    <li><code>${escapeHtml(field)}</code></li>`).join("");
  const authSummarySteps = authorizationDesign.dryRunConfigSimulation.summary.slice(0, 5).map((step) => `
                    <li>${escapeHtml(step)}</li>`).join("");
  const relaySimulationSteps = authorizationDesign.relaySimulationPlan.simulationSteps.slice(0, 5).map((step) => `
                    <li>${escapeHtml(step)}</li>`).join("");
  const authChecklist = authorizationDesign.authorizationEvidence.notes.slice(0, 3).map((note) => `
                    <li>${escapeHtml(note)}</li>`).join("");
  const humanApprovalMissingFields = humanApprovalReview.missingFields.slice(0, 8).map((field) => `
                    <li><code>${escapeHtml(field)}</code></li>`).join("");
  const humanApprovalLedgerRows = [
    `packetCompleteness=${humanApprovalReview.authorizationComplete}`,
    `humanApprovalStatus=${humanApprovalReview.humanApprovalStatus}`,
    `guardedRealTestAllowed=${humanApprovalReview.guardedRealTestAllowed}`,
    `finalDecision=${humanApprovalReview.finalDecision}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const readinessMissingFields = readinessReview.missingFields.slice(0, 8).map((field) => `
                    <li><code>${escapeHtml(field)}</code></li>`).join("");
  const readinessLedgerRows = [
    `readinessReviewPassed=${readinessReview.readinessReviewPassed}`,
    `realIntegrationAllowed=${readinessReview.realIntegrationAllowed}`,
    `guardedRealTestAllowed=${readinessReview.guardedRealTestAllowed}`,
    `futureGuardedRealTestCandidate=${readinessReview.futureGuardedRealTestCandidate}`,
    `finalDecision=${readinessReview.finalDecision}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const preparationLedgerRows = [
    `phase600ReadinessSatisfied=${preparationReview.readinessImport.phase600ReadinessSatisfied}`,
    `sessionOverridePreview=${preparationReview.commandPreview.sessionOverrideCommandPreviewGenerated}`,
    `rollbackReady=${preparationReview.rollbackCommandPreview.rollbackCommandPreviewGenerated}`,
    `emergencyDisableReady=${preparationReview.emergencyDisablePreview.emergencyDisablePreviewGenerated}`,
    `realTestExecuted=${preparationReview.realTestExecuted}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const oneShotLedgerRows = [
    `oneShotExecuted=${oneShotReview.oneShotExecuted}`,
    `requestAttemptCount=${oneShotReview.requestAttemptCount}`,
    `responseClassification=${oneShotReview.responseClassification}`,
    `cleanupExecuted=${oneShotReview.cleanupExecuted}`,
    `userCodexConfigModified=${oneShotReview.userCodexConfigModified}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const customProviderLedgerRows = [
    `openaiBaseUrlOverrideHonored=${customProviderReview.openaiBaseUrlOverrideHonored}`,
    `nextRoute=${customProviderReview.nextRoute}`,
    `authJsonRead=${customProviderReview.authJsonRead}`,
    `projectConfigPreviewGenerated=${customProviderReview.projectConfigPreviewGenerated}`,
    `realTestExecuted=${customProviderReview.realTestExecuted}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const customProviderOneShotLedgerRows = [
    `negativeControlExecuted=${customProviderOneShotReview.negativeControlExecuted}`,
    `negativeControlPassed=${customProviderOneShotReview.negativeControlPassed}`,
    `selectedProviderId=${customProviderOneShotReview.selectedProviderId || "null"}`,
    `oneShotExecuted=${customProviderOneShotReview.oneShotExecuted}`,
    `requestAttemptCount=${customProviderOneShotReview.requestAttemptCount}`,
    `authJsonTouched=${customProviderOneShotReview.authJsonTouched}`,
    `persistentConfigWritePerformed=${customProviderOneShotReview.persistentConfigWritePerformed}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const interactiveTerminalIntakeRows = [
    `route=${interactiveTerminalIntake.route}`,
    `selectedProviderId=${interactiveTerminalIntake.selectedProviderId || "null"}`,
    `requestAttemptCount=${interactiveTerminalIntake.requestAttemptCount}`,
    `responseClassification=${interactiveTerminalIntake.responseClassification}`,
    `cleanupStatus=${interactiveTerminalIntake.cleanupStatus}`,
    `configWriteStatus=${interactiveTerminalIntake.configWriteStatus}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const codexExecIntakeRows = [
    `selectedProviderId=${codexExecIntake.selectedProviderId || "null"}`,
    `requestAttemptCount=${codexExecIntake.requestAttemptCount}`,
    `retryAttemptCount=${codexExecIntake.retryAttemptCount}`,
    `responseClassification=${codexExecIntake.responseClassification}`,
    `notProductionReady=${codexExecIntake.notProductionReady}`,
    `noChatIntegration=${codexExecIntake.noChatIntegration}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const repeatedReliabilityRows = [
    `phase610OneShotPassOnce=${repeatedReliabilityDesign.phase610OneShotPassOnce}`,
    `phase611ReliabilityDesignReady=${repeatedReliabilityDesign.phase611ReliabilityDesignReady}`,
    `maxPlannedAttempts=${repeatedReliabilityDesign.maxPlannedAttempts}`,
    `executedYet=${repeatedReliabilityDesign.executedYet}`,
    `notProductionReady=${repeatedReliabilityDesign.notProductionReady}`,
    `notChatIntegrated=${repeatedReliabilityDesign.notChatIntegrated}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const repeatedGuardedTestRows = [
    `phase610OneShotPassOnce=${repeatedGuardedTestDesign.phase610OneShotPassOnce}`,
    `phase611RepeatedReliabilityDesignReady=${repeatedGuardedTestDesign.phase611RepeatedReliabilityDesignReady}`,
    `maxPlannedAttempts=${repeatedGuardedTestDesign.maxPlannedAttempts}`,
    `maxRequestsTotal=${repeatedGuardedTestDesign.maxRequestsTotal}`,
    `phase612ExecutionRequiresExplicitConfirmation=${repeatedGuardedTestDesign.phase612ExecutionRequiresExplicitConfirmation}`,
    `notReleaseReady=${repeatedGuardedTestDesign.notReleaseReady}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const repeatedGuardedResultRows = [
    `repeatedTestExecuted=${repeatedGuardedTestResult.repeatedTestExecuted}`,
    `completedAttempts=${repeatedGuardedTestResult.completedAttempts}`,
    `totalRequestAttemptCount=${repeatedGuardedTestResult.totalRequestAttemptCount}`,
    `totalRetryAttemptCount=${repeatedGuardedTestResult.totalRetryAttemptCount}`,
    `classification=${repeatedGuardedTestResult.repeatedReliabilityClassification}`,
    `allAttemptsPassed=${repeatedGuardedTestResult.allAttemptsPassed}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const repeatedClosureRows = [
    `phase612RepeatedPass=${repeatedReliabilityClosure.phase612RepeatedPass}`,
    `completedAttempts=${repeatedReliabilityClosure.completedAttempts}`,
    `totalRequestAttemptCount=${repeatedReliabilityClosure.totalRequestAttemptCount}`,
    `capabilityBoundary=${repeatedReliabilityClosure.capabilityBoundary}`,
    `nextGate=${repeatedReliabilityClosure.nextGate}`,
    `notChatIntegrated=${repeatedReliabilityClosure.notChatIntegrated}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const controlledIntegrationGateRows = [
    `integrationMode=${controlledIntegrationPreviewGate.integrationMode}`,
    `routeId=${controlledIntegrationPreviewGate.routeId}`,
    `defaultChatIntegrationAllowed=${controlledIntegrationPreviewGate.defaultChatIntegrationAllowed}`,
    `chatGatewayExecuteIntegrationAllowed=${controlledIntegrationPreviewGate.chatGatewayExecuteIntegrationAllowed}`,
    `providerRuntimeModificationAllowed=${controlledIntegrationPreviewGate.providerRuntimeModificationAllowed}`,
    `runtimeIntegrationRequiresSeparateApproval=${controlledIntegrationPreviewGate.runtimeIntegrationRequiresSeparateApproval}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const runtimeApprovalRows = [
    `approvalPacketReady=${runtimeIntegrationApprovalPacket.approvalPacketReady}`,
    `runtimeIntegrationNotExecuted=${runtimeIntegrationApprovalPacket.runtimeIntegrationNotExecuted}`,
    `approvalRequired=${runtimeIntegrationApprovalPacket.approvalRequired}`,
    `notChatIntegrated=${runtimeIntegrationApprovalPacket.notChatIntegrated}`,
    `notChatGatewayExecuteIntegrated=${runtimeIntegrationApprovalPacket.notChatGatewayExecuteIntegrated}`,
    `providerRuntimeModified=${runtimeIntegrationApprovalPacket.providerRuntimeModified}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const runtimeCandidateDryRunRows = [
    `dryRunCandidateSealed=${runtimeCandidateDryRunBundle.dryRunCandidateSealed}`,
    `candidateMode=${runtimeCandidateDryRunBundle.candidateMode}`,
    `routeId=${runtimeCandidateDryRunBundle.routeId}`,
    `runtimeIntegrationExecuted=${runtimeCandidateDryRunBundle.runtimeIntegrationExecuted}`,
    `notChatIntegrated=${runtimeCandidateDryRunBundle.notChatIntegrated}`,
    `providerRuntimeModified=${runtimeCandidateDryRunBundle.providerRuntimeModified}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const controlledRuntimeCandidateRows = [
    `routeId=${controlledRuntimeCandidatePath.routeId}`,
    `dryRunSmokePassed=${controlledRuntimeCandidatePath.dryRunSmokePassed}`,
    `guardedIsolatedOneShotPassed=${controlledRuntimeCandidatePath.guardedIsolatedOneShotPassed}`,
    `isolatedRepeatedReliabilityClassification=${controlledRuntimeCandidatePath.repeatedReliabilityClassification}`,
    `completedAttempts=${controlledRuntimeCandidatePath.completedAttempts}`,
    `totalRequestAttemptCount=${controlledRuntimeCandidatePath.totalRequestAttemptCount}`,
    `totalRetryAttemptCount=${controlledRuntimeCandidatePath.totalRetryAttemptCount}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const controlledRuntimeCandidateBoundaryRows = [
    `codexExecExecutedByThisPhase=${controlledRuntimeCandidatePath.codexExecExecutedByThisPhase}`,
    `providerCallsMadeByThisPhase=${controlledRuntimeCandidatePath.providerCallsMadeByThisPhase}`,
    `runtimeIntegrated=${controlledRuntimeCandidatePath.runtimeIntegrated}`,
    `chatIntegrated=${controlledRuntimeCandidatePath.chatIntegrated}`,
    `chatGatewayExecuteIntegrated=${controlledRuntimeCandidatePath.chatGatewayExecuteIntegrated}`,
    `providerRuntimeModified=${controlledRuntimeCandidatePath.providerRuntimeModified}`,
    `productionReadyClaimed=${controlledRuntimeCandidatePath.productionReadyClaimed}`,
    `releaseReadyClaimed=${controlledRuntimeCandidatePath.releaseReadyClaimed}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const mainChainFinalApprovalRows = [
    `phase621r628rImported=${mainChainFinalApprovalPacket.phase621r628rImported}`,
    `approvalPacketReady=${mainChainFinalApprovalPacket.approvalPacketReady}`,
    `mainChainIntegrationNotExecuted=${mainChainFinalApprovalPacket.mainChainIntegrationNotExecuted}`,
    `finalHumanApprovalRequired=${mainChainFinalApprovalPacket.finalHumanApprovalRequired}`,
    `notProductionReady=${mainChainFinalApprovalPacket.notProductionReady}`,
    `notReleaseReady=${mainChainFinalApprovalPacket.notReleaseReady}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const mainChainFinalBoundaryRows = [
    `chatModified=${mainChainFinalApprovalPacket.chatModified}`,
    `chatGatewayExecuteModified=${mainChainFinalApprovalPacket.chatGatewayExecuteModified}`,
    `providerRuntimeModified=${mainChainFinalApprovalPacket.providerRuntimeModified}`,
    `codexExecExecutedByThisPhase=${mainChainFinalApprovalPacket.codexExecExecutedByThisPhase}`,
    `providerCallsMadeByThisPhase=${mainChainFinalApprovalPacket.providerCallsMadeByThisPhase}`,
    `deployReleasePushCommit=false`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const mainChainDesignPatchRows = [
    `phase629rImported=${mainChainDesignPatch.phase629rImported}`,
    `designPatchReady=${mainChainDesignPatch.designPatchReady}`,
    `patchPreviewOnly=${mainChainDesignPatch.patchPreviewOnly}`,
    `mainChainPatchNotApplied=${mainChainDesignPatch.mainChainPatchNotApplied}`,
    `phase631ApprovalRequired=${mainChainDesignPatch.phase631ApprovalRequired}`,
    `notProductionReady=${mainChainDesignPatch.notProductionReady}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const mainChainDesignPatchBoundaryRows = [
    `chatModified=${mainChainDesignPatch.chatModified}`,
    `chatGatewayExecuteModified=${mainChainDesignPatch.chatGatewayExecuteModified}`,
    `providerRuntimeModified=${mainChainDesignPatch.providerRuntimeModified}`,
    `codexExecExecutedByThisPhase=${mainChainDesignPatch.codexExecExecutedByThisPhase}`,
    `providerCallsMadeByThisPhase=${mainChainDesignPatch.providerCallsMadeByThisPhase}`,
    `deployReleasePushCommit=false`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const phase639rP1ApprovalRows = [
    `P1 main-chain integration approval packet ready=${phase639RP1ApprovalPreview.mainChainApprovalPacketReady}`,
    `P1 provider runtime approval packet ready=${phase639RP1ApprovalPreview.providerRuntimeApprovalPacketReady}`,
    `both implementation not executed=${phase639RP1ApprovalPreview.implementationExecuted === false}`,
    `/chat not modified=${phase639RP1ApprovalPreview.chatModified === false}`,
    `/chat-gateway/execute not modified=${phase639RP1ApprovalPreview.chatGatewayExecuteModified === false}`,
    `provider runtime not modified=${phase639RP1ApprovalPreview.providerRuntimeModified === false}`,
    `Provider not called=${phase639RP1ApprovalPreview.providerCallsMade === false}`,
    `productionReady=false=${phase639RP1ApprovalPreview.productionReady === false}`,
    `releaseReady=false=${phase639RP1ApprovalPreview.releaseReady === false}`,
    `next approval required=${phase639RP1ApprovalPreview.nextApprovalRequired}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const phase639rNightlyFallbackRows = [
    `Task Scheduler status: not registered=${phase639RNightlyFallbackPanel.scheduledTaskRegistered === false}`,
    `blocker: windows_task_scheduler_access_denied=${phase639RNightlyFallbackPanel.originalBlocker === "windows_task_scheduler_access_denied"}`,
    `fallback cmd available=${phase639RNightlyFallbackPanel.fallbackCmdAvailable}`,
    `fallback ps1 available=${phase639RNightlyFallbackPanel.fallbackPs1Available}`,
    `Phase632 preflight required=${phase639RNightlyFallbackPanel.phase632PreflightRequired}`,
    `latest evidence path=${phase639RNightlyFallbackPanel.latestEvidencePath}`,
    `next action: admin/permissioned registration session or manual fallback launcher`,
    `no provider call=${phase639RNightlyFallbackPanel.providerCallsAllowed === false}`,
    `no secret access=${phase639RNightlyFallbackPanel.secretAccessAllowed === false}`,
    `no /chat modification=${phase639RNightlyFallbackPanel.chatModificationAllowed === false}`,
    `no /chat-gateway/execute modification=${phase639RNightlyFallbackPanel.chatGatewayExecuteModificationAllowed === false}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const phase640rNightlyPermissionedRetryRows = [
    `Task Scheduler current status: not registered=${phase640RNightlyPermissionedRetryPack.scheduledTaskRegistered === false}`,
    `fallback launcher available=${phase640RNightlyPermissionedRetryPack.fallbackLauncherAvailable}`,
    `permissioned retry pack ready=${phase640RNightlyPermissionedRetryPack.permissionedRetryPackReady}`,
    `admin checklist ready=${phase640RNightlyPermissionedRetryPack.adminChecklistGenerated}`,
    `verify script ready=${phase640RNightlyPermissionedRetryPack.verifyScriptGenerated}`,
    `result intake example ready=${phase640RNightlyPermissionedRetryPack.resultInputExampleGenerated}`,
    `nightly automation enabled=false=${phase640RNightlyPermissionedRetryPack.nightlyAutomationEnabled === false}`,
    `next action: manually run retry script in a permissioned session`,
    `no auto elevation=${phase640RNightlyPermissionedRetryPack.autoElevationAttempted === false}`,
    `no permission bypass=${phase640RNightlyPermissionedRetryPack.permissionBypassAttempted === false}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const phase641rNightlyRegistrationRows = [
    `result input exists=${phase641RNightlyRegistrationResultIntake.inputExists}`,
    `result input valid=${phase641RNightlyRegistrationResultIntake.inputValid}`,
    `system verification executed=${phase641RNightlyRegistrationResultIntake.systemVerificationExecuted}`,
    `system verification passed=${phase641RNightlyRegistrationResultIntake.systemVerificationPassed}`,
    `Task Scheduler registered=${phase641RNightlyRegistrationResultIntake.scheduledTaskRegistered}`,
    `nightly automation enabled=${phase641RNightlyRegistrationResultIntake.nightlyAutomationEnabled}`,
    `taskName=${phase641RNightlyRegistrationResultIntake.taskName}`,
    `trigger=${phase641RNightlyRegistrationResultIntake.trigger}`,
    `startTimeLocal=${phase641RNightlyRegistrationResultIntake.startTimeLocal}`,
    `NextRunTime=${phase641RNightlyRegistrationResultIntake.nextRunTime ?? "null"}`,
    `LastTaskResult=${phase641RNightlyRegistrationResultIntake.lastTaskResult ?? "null"}`,
    `action contains nightly runner=${phase641RNightlyRegistrationResultIntake.actionValidated}`,
    `Phase632 preflight required=${phase641RNightlyRegistrationResultIntake.phase632PreflightRequired}`,
    `fallback launcher remains available=${phase641RNightlyRegistrationResultIntake.fallbackLauncherAvailable}`,
    `next action: ${phase641RNightlyRegistrationResultIntake.nextAction}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const phase640rExternalToolRows = [
    `External Codex Relay Tool=${phase640RExternalToolMode.externalToolMode}`,
    `Token-saving tool mode=${phase640RExternalToolMode.tokenSavingPreflightRequired}`,
    `model_provider=crs controlled repeated_pass=${phase640RExternalToolMode.modelProviderCrsRepeatedPass}`,
    `Phase632 preflight mandatory=${phase640RExternalToolMode.tokenSavingPreflightRequired}`,
    `Nightly fallback runner available=${phase640RExternalToolMode.fallbackLauncherAvailable}`,
    `Not /chat integrated=${phase640RExternalToolMode.chatIntegrationPlanned === false}`,
    `Not /chat-gateway/execute integrated=${phase640RExternalToolMode.chatGatewayExecuteIntegrationPlanned === false}`,
    `Not provider runtime=${phase640RExternalToolMode.providerRuntimeIntegrationPlanned === false}`,
    `Not production traffic path=${phase640RExternalToolMode.notProductionTrafficPath}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const phase641r645rExternalToolRows = [
    `toolMode=${phase641R645RExternalToolBundle.toolMode}`,
    `Phase632 preflight mandatory=${phase641R645RExternalToolBundle.phase632PreflightMandatory}`,
    `context pack status=${phase641R645RExternalToolBundle.contextPackStatus}`,
    `relevant files status=${phase641R645RExternalToolBundle.relevantFilesStatus}`,
    `token budget status=${phase641R645RExternalToolBundle.tokenBudgetStatus}`,
    `stale gate status=${phase641R645RExternalToolBundle.staleGateStatus}`,
    `full repo scan forbidden=${phase641R645RExternalToolBundle.fullRepoScanForbidden}`,
    `output budget required=${phase641R645RExternalToolBundle.outputBudgetRequired}`,
    `model_provider=crs repeated_pass under controlled test=${phase641R645RExternalToolBundle.crsRepeatedPass}`,
    `nightly safe runner fallback available=${phase641R645RExternalToolBundle.nightlyFallbackAvailable}`,
    `Task Scheduler registered=${phase641R645RExternalToolBundle.scheduledTaskRegistered}`,
    `Not /chat integrated=${phase641R645RExternalToolBundle.chatIntegrationPlanned === false}`,
    `Not /chat-gateway/execute integrated=${phase641R645RExternalToolBundle.chatGatewayExecuteIntegrationPlanned === false}`,
    `Not provider runtime=${phase641R645RExternalToolBundle.providerRuntimeIntegrationPlanned === false}`,
    `productionReady=${phase641R645RExternalToolBundle.productionReady}`,
    `releaseReady=${phase641R645RExternalToolBundle.releaseReady}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const phase646r650rExternalToolRows = [
    `externalToolMode=${phase646R650RExternalToolClosure.externalToolMode}`,
    `daily workflow ready=${phase646R650RExternalToolClosure.dailyWorkflowReady}`,
    `task queue ledger ready=${phase646R650RExternalToolClosure.taskQueueLedgerReady}`,
    `evidence dashboard ready=${phase646R650RExternalToolClosure.evidenceDashboardReady}`,
    `token-saving report ready=${phase646R650RExternalToolClosure.tokenSavingReportReady}`,
    `next-use playbook ready=${phase646R650RExternalToolClosure.nextUsePlaybookReady}`,
    `Phase632 preflight mandatory=${phase646R650RExternalToolClosure.phase632PreflightMandatory}`,
    `context pack status=${phase646R650RExternalToolClosure.contextPackStatus}`,
    `relevant files status=${phase646R650RExternalToolClosure.relevantFilesStatus}`,
    `token budget status=${phase646R650RExternalToolClosure.tokenBudgetStatus}`,
    `stale gate status=${phase646R650RExternalToolClosure.staleGateStatus}`,
    `nightly runner status=${phase646R650RExternalToolClosure.nightlyRunnerStatus}`,
    `fallback launcher status=${phase646R650RExternalToolClosure.fallbackLauncherStatus}`,
    `Not /chat integrated=${phase646R650RExternalToolClosure.chatIntegrationPlanned === false}`,
    `Not /chat-gateway/execute integrated=${phase646R650RExternalToolClosure.chatGatewayExecuteIntegrationPlanned === false}`,
    `Not provider runtime=${phase646R650RExternalToolClosure.providerRuntimeIntegrationPlanned === false}`,
    `productionReady=${phase646R650RExternalToolClosure.productionReady}`,
    `releaseReady=${phase646R650RExternalToolClosure.releaseReady}`,
  ].map((line) => `
                    <li>${escapeHtml(line)}</li>`).join("");
  const actions = copy.actions.map(([action, label]) => `
                  <button type="button" data-codex-context-action="${escapeAttr(action)}">${escapeHtml(label)}</button>`).join("");

  return {
    hash, token, freshness, files, evidence, dirty, prompt,
    badges, fileRows, evidenceRows, validationRows, usageChecks,
    trialInstruction, benchmarkNext, baseUrlRisks, baseUrlRollback,
    baseUrlChecklist, authMissingFields, authRequiredFields, authSummarySteps,
    relaySimulationSteps, authChecklist, humanApprovalMissingFields,
    humanApprovalLedgerRows, readinessMissingFields, readinessLedgerRows,
    preparationLedgerRows, oneShotLedgerRows, customProviderLedgerRows,
    customProviderOneShotLedgerRows, interactiveTerminalIntakeRows,
    codexExecIntakeRows, repeatedReliabilityRows, repeatedGuardedTestRows,
    repeatedGuardedResultRows, repeatedClosureRows, controlledIntegrationGateRows,
    runtimeApprovalRows, runtimeCandidateDryRunRows, controlledRuntimeCandidateRows,
    controlledRuntimeCandidateBoundaryRows, mainChainFinalApprovalRows,
    mainChainFinalBoundaryRows, mainChainDesignPatchRows,
    mainChainDesignPatchBoundaryRows, phase639rP1ApprovalRows,
    phase639rNightlyFallbackRows, phase640rNightlyPermissionedRetryRows,
    phase641rNightlyRegistrationRows, phase640rExternalToolRows,
    phase641r645rExternalToolRows, phase646r650rExternalToolRows, actions,
  };
}
