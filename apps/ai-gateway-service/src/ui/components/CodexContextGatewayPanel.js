import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readOperatorPanelPreview } from "../../../../../packages/codex-context-gateway/src/operatorPanelPreview.js";
import { buildUsageWorkflowPreview } from "../../../../../packages/codex-context-gateway/src/usageWorkflow.js";
import { buildRealUsageTrialReport } from "../../../../../packages/codex-context-gateway/src/usageTrialReportBuilder.js";
import { buildRepeatedUsageBenchmarkReport } from "../../../../../packages/codex-context-gateway/src/repeatedUsageBenchmark.js";
import { buildControlledBaseUrlIntegrationDesignReport } from "../../../../../packages/codex-context-gateway/src/baseUrlIntegrationDesign.js";
import { buildAuthorizationEvidenceDryRunSimulationReport } from "../../../../../packages/codex-context-gateway/src/authorizationEvidenceBuilder.js";
import { buildPhase599AuthorizationReviewReport } from "../../../../../packages/codex-context-gateway/src/phase599AuthorizationReviewReport.js";
import { buildPhase600ReadinessReviewReport } from "../../../../../packages/codex-context-gateway/src/phase600ReadinessReviewReport.js";
import { buildPhase601PreparationReport } from "../../../../../packages/codex-context-gateway/src/phase601PreparationReport.js";
import { buildPhase602OneShotReport } from "../../../../../packages/codex-context-gateway/src/phase602OneShotReport.js";
import { buildPhase603PreparationReport } from "../../../../../packages/codex-context-gateway/src/phase603PreparationReport.js";
import { buildPhase604OneShotReport } from "../../../../../packages/codex-context-gateway/src/phase604OneShotReport.js";
import { codexContextGatewayCopy } from "../copy/codexContextGatewayCopy.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));

export function renderCodexContextGatewayPanel() {
  const preview = readOperatorPanelPreview();
  const usage = buildUsageWorkflowPreview();
  const trial = buildRealUsageTrialReport();
  const benchmark = buildRepeatedUsageBenchmarkReport();
  const baseUrlDesign = buildControlledBaseUrlIntegrationDesignReport();
  const authorizationDesign = buildAuthorizationEvidenceDryRunSimulationReport();
  const humanApprovalReview = buildPhase599AuthorizationReviewReport();
  const readinessReview = buildPhase600ReadinessReviewReport();
  const preparationReview = buildPhase601PreparationReport();
  const oneShotReview = buildPhase602OneShotReport();
  const customProviderReview = buildPhase603PreparationReport();
  const customProviderOneShotReview = buildPhase604OneShotReport();
  const interactiveTerminalIntake = readPhase607InteractiveTerminalIntakePreview();
  const codexExecIntake = readPhase610CodexExecResultIntakePreview();
  const repeatedReliabilityDesign = readPhase611ReliabilityDesignPreview();
  const repeatedGuardedTestDesign = readPhase611RepeatedGuardedTestDesignPreview();
  const repeatedGuardedTestResult = readPhase612RepeatedGuardedReliabilityPreview();
  const repeatedReliabilityClosure = readPhase613RepeatedReliabilityClosurePreview();
  const controlledIntegrationPreviewGate = readPhase614ControlledIntegrationPreviewGate();
  const runtimeIntegrationApprovalPacket = readPhase615RuntimeIntegrationApprovalPacket();
  const runtimeCandidateDryRunBundle = readPhase616R620RRuntimeCandidateDryRunBundle();
  const controlledRuntimeCandidatePath = readPhase621R628RControlledRuntimeCandidatePath();
  const mainChainFinalApprovalPacket = readPhase629RMainChainFinalHumanApprovalPacket();
  const mainChainDesignPatch = readPhase630RMainChainIntegrationDesignPatch();
  const phase639RP1ApprovalPreview = readPhase639RP1ApprovalPreview();
  const phase639RNightlyFallbackPanel = readPhase639RNightlyFallbackOperatorPanel();
  const phase640RNightlyPermissionedRetryPack = readPhase640RNightlyPermissionedRetryPack();
  const phase641RNightlyRegistrationResultIntake = readPhase641RNightlyRegistrationResultIntake();
  const phase640RExternalToolMode = readPhase640RExternalToolMode();
  const phase641R645RExternalToolBundle = readPhase641R645RExternalToolBundle();
  const phase646R650RExternalToolClosure = readPhase646R650RExternalToolClosure();
  const hash = preview.contextHash || "missing";
  const token = preview.tokenBudget;
  const freshness = preview.freshness;
  const files = preview.relevantFiles;
  const evidence = preview.evidenceIndex;
  const dirty = preview.dirtySummary;
  const prompt = preview.promptPack;
  const badges = codexContextGatewayCopy.boundaryBadges.map((badge) => `<span data-codex-safety-badge="${escapeAttr(badge)}">${escapeHtml(badge)}</span>`).join("");
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
  const actions = codexContextGatewayCopy.actions.map(([action, label]) => `
                  <button type="button" data-codex-context-action="${escapeAttr(action)}">${escapeHtml(label)}</button>`).join("");
  const detailPayload = JSON.stringify(buildDetailPayload(preview, usage, trial, benchmark, baseUrlDesign, authorizationDesign, humanApprovalReview, readinessReview, preparationReview, oneShotReview, customProviderReview, customProviderOneShotReview, interactiveTerminalIntake, codexExecIntake, repeatedReliabilityDesign, repeatedGuardedTestDesign, repeatedGuardedTestResult, repeatedReliabilityClosure, controlledIntegrationPreviewGate, runtimeIntegrationApprovalPacket, runtimeCandidateDryRunBundle, controlledRuntimeCandidatePath, mainChainFinalApprovalPacket, mainChainDesignPatch, phase639RP1ApprovalPreview, phase639RNightlyFallbackPanel, phase640RNightlyPermissionedRetryPack, phase641RNightlyRegistrationResultIntake, phase640RExternalToolMode, phase641R645RExternalToolBundle, phase646R650RExternalToolClosure)).replace(/</g, "\\u003c");

  return `
              <section class="codex-context-gateway-panel" id="codex-context-gateway-panel" data-codex-context-panel="true" data-codex-context-hash="${escapeAttr(hash)}" data-codex-stale-status="${freshness.staleStatus ? "stale" : "fresh"}">
                <div class="drilldown-head">
                  <div>
                    <div class="eyebrow">Phase593/594 Operator Preview</div>
                    <h3>${escapeHtml(codexContextGatewayCopy.title)}</h3>
                    <p>${escapeHtml(codexContextGatewayCopy.subtitle)}</p>
                  </div>
                  <span class="tour-chip">dry-run preview</span>
                </div>
                <div class="scenario-boundary-badges codex-context-safety-boundary" id="codex-context-safety-boundary" aria-label="Codex Context Gateway safety boundary">
                  ${badges}
                </div>
                <div class="codex-context-grid">
                  <article class="codex-context-card" id="codex-context-hash-section">
                    <small>Context Hash</small>
                    <strong data-codex-context-hash-value="true">${escapeHtml(hash.slice(0, 16))}...</strong>
                    <span>generatedAt: ${escapeHtml(preview.contextPack.generatedAt || "unknown")}</span>
                  </article>
                  <article class="codex-context-card" id="codex-context-freshness-section">
                    <small>Freshness / Stale</small>
                    <strong data-codex-stale-status-value="true">${freshness.staleStatus ? "stale=true" : "stale=false"}</strong>
                    <span>${escapeHtml(freshness.staleReason || "staleReason=null")}</span>
                  </article>
                  <article class="codex-context-card" id="codex-token-budget-section" data-codex-token-budget="true">
                    <small>Token Budget</small>
                    <strong>${escapeHtml(token.budgetName)} / ${token.maxTokens}</strong>
                    <span>estimated=${token.currentEstimate}; respected=${String(token.budgetRespected)}</span>
                  </article>
                  <article class="codex-context-card" id="codex-dirty-summary-section">
                    <small>Dirty Summary</small>
                    <strong>${dirty.changedFileCount} changed files</strong>
                    <span>workspaceCleanClaimed=false; diff content hidden</span>
                  </article>
                </div>
                <div class="codex-context-preview-grid">
                  <article class="codex-context-preview-card" id="codex-relevant-files-section">
                    <div><strong>Relevant Files</strong><small>${files.relevantFileCount} selected; full repo scan avoided=${String(files.fullRepoScanAvoided)}</small></div>
                    <ul>${fileRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-evidence-index-section">
                    <div><strong>Evidence Refs</strong><small>${evidence.evidenceRefCount} refs indexed; raw evidence not expanded</small></div>
                    <ul>${evidenceRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-prompt-pack-section">
                    <div><strong>Prompt Pack</strong><small>${escapeHtml(prompt.promptPackTitle)}</small></div>
                    <pre>${escapeHtml(displaySafeText(prompt.previewText.slice(0, 520)))}</pre>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-usage-workflow-section" data-codex-usage-workflow-preview="true">
                  <article class="codex-context-preview-card" id="codex-usage-preflight-card">
                    <div><strong>Preflight</strong><small>required files present=${String(usage.preflight.completed)}</small></div>
                    <p>missingRequiredFileBlocks=${String(usage.preflight.missingRequiredFileBlocks)}; realCodexConnectionMade=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-freshness-card">
                    <div><strong>Freshness Gate</strong><small>stale=${String(usage.freshnessGate.stale)}</small></div>
                    <p>staleTrueBlocks=${String(usage.freshnessGate.staleTrueBlocks)}; simulatedStaleBlocked=${String(usage.staleStopper.simulatedStaleBlocked)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-relevant-scope-card">
                    <div><strong>Relevant Files Scope</strong><small>${usage.relevantFileScope.relevantFileCount} files</small></div>
                    <p>fullRepoScanAvoided=${String(usage.relevantFileScope.fullRepoScanAvoided)}; outOfScopeReadRequiresReason=${String(usage.relevantFileScope.outOfScopeReadRequiresReason)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-validation-plan-card">
                    <div><strong>Validation Plan</strong><small>${usage.validationPlan.commands.length} commands</small></div>
                    <ul>${validationRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-dry-run-wrapper-card">
                    <div><strong>Dry-run Task Wrapper</strong><small>ready=${String(usage.dryRunTask.dryRunTaskWrapperWorks)}</small></div>
                    <p>preflight - freshness - relevant scope - prompt pack - validation plan; no real Codex connection.</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-operator-checklist-card">
                    <div><strong>Operator Checklist</strong><small>workspaceCleanClaimForbidden=${String(usage.operatorChecklist.workspaceCleanClaimForbidden)}</small></div>
                    <ul>${usageChecks}</ul>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-usage-trial-section" data-codex-usage-trial-preview="true" data-codex-usage-trial-status="true">
                  <article class="codex-context-preview-card" id="codex-usage-trial-status-card">
                    <div><strong>Phase595 Real Usage Trial</strong><small>status=${escapeHtml(trial.classifier.status)}</small></div>
                    <p>without base_url change; realCodexConnectionMade=false; providerCallsMade=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-trial-context-pack-card">
                    <div><strong>Context Pack Used</strong><small>hash=${escapeHtml(String(trial.contextHash || "").slice(0, 12))}</small></div>
                    <p>contextPackUsed=${String(trial.usageTracker.contextPackUsed)}; promptPackUsed=${String(trial.usageTracker.promptPackUsed)}; staleGateUsed=${String(trial.usageTracker.freshnessGateUsed)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-trial-relevant-files-card">
                    <div><strong>Relevant Files Used</strong><small>${trial.policy.relevantFileCount} relevant files</small></div>
                    <p>expectedReads=${trial.policy.expectedReadFiles.length}; fullRepoScanFlagged=${String(trial.readAudit.fullRepoScanFlagged)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-trial-token-saving-card">
                    <div><strong>Token Saving</strong><small>${trial.tokenSaving.savingPercent}% estimate</small></div>
                    <p>actualPackEstimate=${trial.tokenSaving.actualPackEstimate}; budgetRespected=${String(trial.tokenSaving.budgetRespected)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-trial-validation-card">
                    <div><strong>Validation Status</strong><small>passed=${String(trial.validationExecution.allValidationCommandsPassed)}</small></div>
                    <p>commandsPlanned=${trial.validationPlan.commands.length}; noDangerousCommandExecuted=${String(trial.validationExecution.noDangerousCommandExecuted)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-usage-trial-next-instruction-card">
                    <div><strong>Next Instruction</strong><small>copy-ready prefix</small></div>
                    <ul>${trialInstruction}</ul>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-repeated-benchmark-section" data-codex-repeated-benchmark-preview="true" data-codex-benchmark-executed-count="true">
                  <article class="codex-context-preview-card" id="codex-benchmark-status-card">
                    <div><strong>Phase596 Repeated Benchmark</strong><small>status=${escapeHtml(benchmark.classifier.trialStatus)}</small></div>
                    <p>executedTaskCount=${benchmark.aggregate.executedTaskCount}; failedTaskCount=${benchmark.aggregate.failedTaskCount}; providerCallsMade=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-benchmark-token-saving-card">
                    <div><strong>Average Token Saving</strong><small>${benchmark.aggregate.averageTokenSavingPercent}% estimate</small></div>
                    <p>budgetRespectedForAllTasks=${String(benchmark.tokenSaving.budgetRespectedForAllTasks)}; threshold>=80=${String(benchmark.tokenSaving.savingPercentAboveThreshold)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-benchmark-scope-card">
                    <div><strong>Relevant File Usage</strong><small>${benchmark.policy.relevantFileCount} relevant files</small></div>
                    <p>contextPackUsedForAllTasks=${String(benchmark.aggregate.contextPackUsedForAllTasks)}; relevantFilesUsedForAllTasks=${String(benchmark.aggregate.relevantFilesUsedForAllTasks)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-benchmark-scan-card">
                    <div><strong>Full Repo Scan Avoided</strong><small>flagged=${benchmark.aggregate.fullRepoScanFlaggedCount}</small></div>
                    <p>scanReductionEstimated=${String(benchmark.scanAvoidance.scanReductionEstimated)}; outOfScopeReadReasonsRecorded=${String(benchmark.scanAvoidance.outOfScopeReadReasonsRecorded)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-benchmark-validation-card">
                    <div><strong>Validation Status</strong><small>passed=${String(benchmark.validationExecution.allValidationCommandsPassed)}</small></div>
                    <p>noDangerousCommandExecuted=${String(benchmark.validationExecution.noDangerousCommandExecuted)}; benchmarkStatus=${escapeHtml(benchmark.classifier.trialStatus)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-benchmark-next-card">
                    <div><strong>Next Optimization</strong><small>Phase597 design gate</small></div>
                    <ul>${benchmarkNext}</ul>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-base-url-design-preview-section" data-codex-base-url-design-preview="true" data-codex-base-url-design-only="true" data-codex-base-url-authorization-required="true">
                  <article class="codex-context-preview-card" id="codex-base-url-design-status-card">
                    <div><strong>Phase597 Base URL Design</strong><small>design only</small></div>
                    <p>codexBaseUrlModified=${String(baseUrlDesign.codexBaseUrlModified)}; codexConfigModified=${String(baseUrlDesign.codexConfigModified)}; relayStarted=${String(baseUrlDesign.relayStarted)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-base-url-authorization-card">
                    <div><strong>Authorization Required</strong><small>${escapeHtml(baseUrlDesign.authorization.realIntegrationStatus)}</small></div>
                    <p>allowCodexBaseUrlChangeRequired=${String(baseUrlDesign.authorization.allowCodexBaseUrlChangeRequired)}; approvalRecordRequired=${String(baseUrlDesign.authorization.approvalRecordRequired)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-base-url-account-pool-card">
                    <div><strong>Account Pool Policy</strong><small>${escapeHtml(baseUrlDesign.accountPool.accountPoolRef)}</small></div>
                    <p>concurrencyLimitDefined=${String(baseUrlDesign.accountPool.concurrencyLimitDefined)}; rateLimitDefined=${String(baseUrlDesign.accountPool.rateLimitDefined)}; cacheMissPolicyLinked=${String(baseUrlDesign.accountPool.cacheMissPolicyLinked)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-base-url-rollback-card">
                    <div><strong>Rollback Plan</strong><small>${escapeHtml(baseUrlDesign.rollback.rollbackPlanRef)}</small></div>
                    <ul>${baseUrlRollback}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-base-url-risk-card">
                    <div><strong>Risk Review</strong><small>failure modes covered</small></div>
                    <ul>${baseUrlRisks}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-base-url-next-gate-card">
                    <div><strong>Next Authorization Gate</strong><small>Phase598 dry-run intake</small></div>
                    <ul>${baseUrlChecklist}</ul>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-authorization-preview-section" data-codex-authorization-preview="true" data-codex-authorization-missing-fields="true" data-codex-dry-run-config-simulation="true" data-codex-real-config-write-blocked="true" data-codex-relay-start-blocked="true" data-codex-credential-ref-only="true" data-codex-rollback-simulation="true" data-codex-emergency-disable="true">
                  <article class="codex-context-preview-card" id="codex-auth-status-card">
                    <div><strong>Authorization Status</strong><small>${escapeHtml(authorizationDesign.realIntegrationStatus)}</small></div>
                    <p>authorizationComplete=${String(authorizationDesign.authorizationComplete)}; realIntegrationAllowed=${String(authorizationDesign.realIntegrationAllowed)}; guardedRealTestNotAllowedYet=${String(authorizationDesign.guardedRealTestNotAllowedYet)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-missing-fields-card">
                    <div><strong>Missing Required Fields</strong><small>${authorizationDesign.missingAuthorizationFields.length} missing</small></div>
                    <ul>${authMissingFields}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-required-fields-card">
                    <div><strong>Required Fields</strong><small>future packet template</small></div>
                    <ul>${authRequiredFields}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-simulation-card">
                    <div><strong>Dry-run Config Simulation</strong><small>enabled=false</small></div>
                    <ul>${authSummarySteps}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-redacted-config-card">
                    <div><strong>Redacted Config Preview</strong><small>credentialRef only</small></div>
                    <p>rawBaseUrlValueExposed=${String(authorizationDesign.redactedConfigPreview.rawBaseUrlValueExposed)}; realUserConfigModified=${String(authorizationDesign.redactedConfigPreview.realUserConfigModified)}; projectCodexConfigModified=${String(authorizationDesign.redactedConfigPreview.projectCodexConfigModified)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-relay-card">
                    <div><strong>Relay Simulation</strong><small>simulated upstream only</small></div>
                    <ul>${relaySimulationSteps}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-account-pool-card">
                    <div><strong>Account Pool Simulation</strong><small>${authorizationDesign.accountPoolSimulation.accountPoolRef}</small></div>
                    <p>concurrencyLimitSimulated=${String(authorizationDesign.accountPoolSimulation.concurrencyLimitSimulated)}; perAccountQuotaSimulated=${String(authorizationDesign.accountPoolSimulation.perAccountQuotaSimulated)}; coolingWindowSimulated=${String(authorizationDesign.accountPoolSimulation.coolingWindowSimulated)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-credential-card">
                    <div><strong>CredentialRef Simulation</strong><small>credentialRef only</small></div>
                    <p>rawSecretAccessed=${String(authorizationDesign.credentialRefSimulation.rawSecretAccessed)}; secretValueExposed=${String(authorizationDesign.credentialRefSimulation.secretValueExposed)}; rawWebhookAccessed=${String(authorizationDesign.credentialRefSimulation.rawWebhookAccessed)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-policy-card">
                    <div><strong>Base URL Dry-run Policy</strong><small>real writes forbidden</small></div>
                    <p>realConfigWriteForbidden=${String(authorizationDesign.baseUrlDryRunPolicy.realConfigWriteForbidden)}; realRelayStartForbidden=${String(authorizationDesign.baseUrlDryRunPolicy.realRelayStartForbidden)}; realProviderCallForbidden=${String(authorizationDesign.baseUrlDryRunPolicy.realProviderCallForbidden)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-rollback-card">
                    <div><strong>Rollback Simulation</strong><small>${authorizationDesign.rollbackSimulation.rollbackPlanRef}</small></div>
                    <p>disableRelaySimulated=${String(authorizationDesign.rollbackSimulation.disableRelaySimulated)}; invalidateStaleContextSimulated=${String(authorizationDesign.rollbackSimulation.invalidateStaleContextSimulated)}; preserveEvidenceSimulated=${String(authorizationDesign.rollbackSimulation.preserveEvidenceSimulated)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-emergency-card">
                    <div><strong>Emergency Disable</strong><small>operator alert ready</small></div>
                    <p>relayBlocked=${String(authorizationDesign.emergencyDisableSimulation.relayBlocked)}; accountPoolBlocked=${String(authorizationDesign.emergencyDisableSimulation.accountPoolBlocked)}; staleContextForced=${String(authorizationDesign.emergencyDisableSimulation.staleContextForced)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-auth-evidence-card">
                    <div><strong>Authorization Evidence</strong><small>record only</small></div>
                    <ul>${authChecklist}</ul>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-human-approval-review-section" data-codex-human-approval-review-preview="true" data-codex-authorization-complete-visible="true" data-codex-human-approval-status-visible="true" data-codex-human-approval-missing-fields-visible="true" data-codex-guarded-real-test-allowed-visible="true" data-codex-final-decision-visible="true">
                  <article class="codex-context-preview-card" id="codex-human-approval-status-card">
                    <div><strong>Human Approval Review</strong><small>${escapeHtml(humanApprovalReview.humanApprovalStatus)}</small></div>
                    <p>authorizationComplete=${String(humanApprovalReview.authorizationComplete)}; realIntegrationAllowed=${String(humanApprovalReview.realIntegrationAllowed)}; guardedRealTestAllowed=${String(humanApprovalReview.guardedRealTestAllowed)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-human-approval-missing-fields-card">
                    <div><strong>Authorization Packet Missing Fields</strong><small>${humanApprovalReview.missingFields.length} missing</small></div>
                    <ul>${humanApprovalMissingFields}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-human-approval-final-decision-card">
                    <div><strong>Final Decision</strong><small>${escapeHtml(humanApprovalReview.finalDecision)}</small></div>
                    <p>realConfigWriteAllowed=${String(humanApprovalReview.realConfigWriteAllowed)}; relayStartAllowed=${String(humanApprovalReview.relayStartAllowed)}; providerCallsMade=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-human-approval-ledger-card">
                    <div><strong>Authorization Evidence Ledger</strong><small>review packet only</small></div>
                    <ul>${humanApprovalLedgerRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-human-approval-readiness-card">
                    <div><strong>Guarded Real Test Readiness</strong><small>blocked until all gates pass</small></div>
                    <p>missingHumanApprovalBlocks=${String(humanApprovalReview.guardedRealTestReadiness.missingHumanApprovalBlocks)}; missingExplicitUserApprovalBlocks=${String(humanApprovalReview.guardedRealTestReadiness.missingExplicitUserApprovalBlocks)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-human-approval-next-action-card">
                    <div><strong>Next Required Action</strong><small>no automatic real test</small></div>
                    <p>${escapeHtml(humanApprovalReview.guardedRealTestReadiness.nextRequiredAction)}</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase600-readiness-section" data-codex-phase600-readiness-preview="true" data-codex-phase600-authorization-complete="true" data-codex-phase600-human-approval-status="true" data-codex-phase600-readiness-decision="true" data-codex-phase600-missing-fields="true" data-codex-phase600-next-action="true">
                  <article class="codex-context-preview-card" id="codex-phase600-readiness-status-card">
                    <div><strong>Phase600 Readiness Review</strong><small>${escapeHtml(readinessReview.blocker || "no blocker")}</small></div>
                    <p>authorizationComplete=${String(readinessReview.authorizationComplete)}; humanApprovalStatus=${escapeHtml(readinessReview.humanApprovalStatus)}; readinessReviewPassed=${String(readinessReview.readinessReviewPassed)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase600-readiness-missing-card">
                    <div><strong>Input Missing Fields</strong><small>${readinessReview.missingFields.length} missing</small></div>
                    <ul>${readinessMissingFields}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase600-readiness-decision-card">
                    <div><strong>Readiness Decision</strong><small>${escapeHtml(readinessReview.finalDecision)}</small></div>
                    <p>realIntegrationAllowed=${String(readinessReview.realIntegrationAllowed)}; guardedRealTestAllowed=${String(readinessReview.guardedRealTestAllowed)}; futureGuardedRealTestCandidate=${String(readinessReview.futureGuardedRealTestCandidate)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase600-readiness-boundary-card">
                    <div><strong>Execution Boundary</strong><small>no real execution button</small></div>
                    <p>codexBaseUrlModified=false; relayStarted=false; providerCallsMade=false; realConfigWriteAllowed=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase600-readiness-ledger-card">
                    <div><strong>Readiness Evidence Ledger</strong><small>input + approval review only</small></div>
                    <ul>${readinessLedgerRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase600-readiness-next-action-card">
                    <div><strong>Next Action</strong><small>no automatic base_url change</small></div>
                    <p>${escapeHtml(readinessReview.nextAction)}</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase601-preparation-section" data-codex-phase601-preparation-preview="true" data-codex-phase601-session-override-preview="true" data-codex-phase601-rollback-preview="true" data-codex-phase601-emergency-disable-preview="true" data-codex-phase601-real-test-not-executed="true" data-codex-phase601-final-confirmation-required="true">
                  <article class="codex-context-preview-card" id="codex-phase601-preparation-status-card">
                    <div><strong>Phase601 Preparation</strong><small>${escapeHtml(preparationReview.blocker || "no blocker")}</small></div>
                    <p>readinessImported=${String(preparationReview.readinessImport.phase600EvidenceReadable)}; phase602Candidate=${String(preparationReview.phase602Candidate)}; finalUserConfirmationRequired=${String(preparationReview.finalUserConfirmationRequired)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase601-session-override-card">
                    <div><strong>Session Override Preview</strong><small>command not executed</small></div>
                    <p>${escapeHtml(preparationReview.commandPreview.commandPreview)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase601-rollback-card">
                    <div><strong>Rollback / Emergency</strong><small>preview only</small></div>
                    <ul>${preparationLedgerRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase601-command-bundle-card">
                    <div><strong>Final Command Bundle</strong><small>Phase602 gated</small></div>
                    <p>finalCommandBundlePreviewGenerated=${String(preparationReview.finalCommandBundlePreview.finalCommandBundlePreviewGenerated)}; commandExecuted=false</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase602-one-shot-result-section" data-codex-phase602-one-shot-result-preview="true" data-codex-phase602-request-attempt-count="true" data-codex-phase602-cleanup-status="true" data-codex-phase602-config-write-status="true">
                  <article class="codex-context-preview-card" id="codex-phase602-status-card">
                    <div><strong>Phase602 One-Shot Result</strong><small>${escapeHtml(oneShotReview.blocker || "no blocker")}</small></div>
                    <p>oneShotExecuted=${String(oneShotReview.oneShotExecuted)}; testStatus=${escapeHtml(oneShotReview.testStatus)}; classification=${escapeHtml(oneShotReview.responseClassification)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase602-attempt-card">
                    <div><strong>Request Attempts</strong><small>maxRequests=1</small></div>
                    <p>requestAttemptCount=${oneShotReview.requestAttemptCount}; retryAttemptCount=${oneShotReview.retryAttemptCount}; sessionOverrideUsed=${String(oneShotReview.sessionOverrideUsed)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase602-cleanup-card">
                    <div><strong>Cleanup / Rollback</strong><small>${escapeHtml(oneShotReview.cleanup.rollbackResult)}</small></div>
                    <ul>${oneShotLedgerRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase602-config-write-card">
                    <div><strong>Config Write Status</strong><small>persistent write blocked</small></div>
                    <p>userCodexConfigModified=false; projectCodexConfigModified=false; rawBaseUrlValueExposed=false</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase603-custom-provider-route-section" data-codex-phase603-custom-provider-route-preview="true" data-codex-phase603-openai-base-url-failure="true" data-codex-phase603-auth-json-denylist="true" data-codex-phase603-command-preview="true" data-codex-phase603-real-test-not-executed="true" data-codex-phase603-final-confirmation-required="true">
                  <article class="codex-context-preview-card" id="codex-phase603-route-status-card">
                    <div><strong>Phase603 Custom Provider Route</strong><small>${escapeHtml(customProviderReview.blocker || "no blocker")}</small></div>
                    <p>openai_base_url honored=${String(customProviderReview.openaiBaseUrlOverrideHonored)}; nextRoute=${escapeHtml(customProviderReview.nextRoute)}; finalConfirmationRequired=${String(customProviderReview.finalUserConfirmationRequired)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase603-auth-json-card">
                    <div><strong>auth.json Denylist</strong><small>not read, not touched</small></div>
                    <p>authJsonRead=false; authJsonTouched=false; authJsonCopied=false; authJsonWrittenToEvidence=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase603-config-preview-card">
                    <div><strong>Config Preview</strong><small>preview artifact only</small></div>
                    <p>path=${escapeHtml(customProviderReview.projectConfigPreview.previewPath)}; userCodexConfigModified=false; projectCodexConfigModified=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase603-command-preview-card">
                    <div><strong>Command Bundle Preview</strong><small>not executed</small></div>
                    <p>${escapeHtml(customProviderReview.commandBundle.commandPreview)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase603-rollback-card">
                    <div><strong>Rollback / Emergency</strong><small>preview only</small></div>
                    <ul>${customProviderLedgerRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase603-next-gate-card">
                    <div><strong>Next Gate</strong><small>Phase604 confirmation required</small></div>
                    <p>customProviderOneShotCandidate=${String(customProviderReview.nextPhaseGateReport.customProviderOneShotCandidate)}; commandBundlePreviewReady=${String(customProviderReview.nextPhaseGateReport.commandBundlePreviewReady)}; realTestExecuted=false</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase604-custom-provider-result-section" data-codex-phase604-custom-provider-result-preview="true" data-codex-phase604-negative-control-result="true" data-codex-phase604-selected-provider="true" data-codex-phase604-one-shot-status="true" data-codex-phase604-request-attempt-count="true" data-codex-phase604-auth-json-touched-false="true" data-codex-phase604-persistent-config-write-false="true">
                  <article class="codex-context-preview-card" id="codex-phase604-status-card">
                    <div><strong>Phase604 Custom Provider Test</strong><small>${escapeHtml(customProviderOneShotReview.blocker || "no blocker")}</small></div>
                    <p>finalConfirmationExists=${String(customProviderOneShotReview.finalConfirmation.finalConfirmationExists)}; oneShotExecuted=${String(customProviderOneShotReview.oneShotExecuted)}; classification=${escapeHtml(customProviderOneShotReview.responseClassification)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase604-negative-control-card">
                    <div><strong>Negative-Control</strong><small>${escapeHtml(customProviderOneShotReview.negativeControlClassifier.classification)}</small></div>
                    <p>negativeControlExecuted=${String(customProviderOneShotReview.negativeControlExecuted)}; modelProviderOverrideHonored=${String(customProviderOneShotReview.modelProviderOverrideHonored)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase604-provider-card">
                    <div><strong>Selected Provider</strong><small>${escapeHtml(customProviderOneShotReview.selectedProviderId || "not selected")}</small></div>
                    <p>customProviderExists=${String(customProviderOneShotReview.customProviderExists)}; authJsonRead=false; authJsonTouched=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase604-attempt-card">
                    <div><strong>Request Attempts</strong><small>maxRequests=1</small></div>
                    <p>requestAttemptCount=${customProviderOneShotReview.requestAttemptCount}; retryAttemptCount=${customProviderOneShotReview.retryAttemptCount}; providerCallsMade=${String(customProviderOneShotReview.providerCallsMade)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase604-cleanup-card">
                    <div><strong>Cleanup / Rollback</strong><small>${escapeHtml(customProviderOneShotReview.cleanup.rollbackResult)}</small></div>
                    <ul>${customProviderOneShotLedgerRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase604-next-card">
                    <div><strong>Next Action</strong><small>${escapeHtml(customProviderOneShotReview.nextRoute)}</small></div>
                    <p>contextPackUsed=${String(customProviderOneShotReview.contextPackUsed)}; relevantFilesUsed=${String(customProviderOneShotReview.relevantFilesUsed)}; staleGateUsed=${String(customProviderOneShotReview.staleGateUsed)}</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase607r-interactive-terminal-intake-section" data-codex-phase607r-interactive-terminal-intake="true" data-codex-phase607r-manual-route="true" data-codex-phase607r-config-write-false="true">
                  <article class="codex-context-preview-card" id="codex-phase607r-status-card">
                    <div><strong>Phase607R-Fix Manual Intake</strong><small>${escapeHtml(interactiveTerminalIntake.blocker || "no blocker")}</small></div>
                    <p>oneShotExecutionIntakeCompleted=${String(interactiveTerminalIntake.oneShotExecutionIntakeCompleted)}; codexOneShotExecutedByThisPhase=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase607r-route-card">
                    <div><strong>Manual Interactive Route</strong><small>${escapeHtml(interactiveTerminalIntake.route)}</small></div>
                    <p>selectedProviderId=${escapeHtml(interactiveTerminalIntake.selectedProviderId || "not selected")}; manualResultInputExists=${String(interactiveTerminalIntake.manualResultInputExists)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase607r-classification-card">
                    <div><strong>Response Classification</strong><small>${escapeHtml(interactiveTerminalIntake.responseClassification)}</small></div>
                    <p>testStatus=${escapeHtml(interactiveTerminalIntake.testStatus)}; requestAttemptCount=${interactiveTerminalIntake.requestAttemptCount}; retryAttemptCount=${interactiveTerminalIntake.retryAttemptCount}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase607r-cleanup-card">
                    <div><strong>Cleanup / Config</strong><small>${escapeHtml(interactiveTerminalIntake.cleanupStatus)}</small></div>
                    <ul>${interactiveTerminalIntakeRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase607r-boundary-card">
                    <div><strong>Safety Boundary</strong><small>intake only</small></div>
                    <p>authJsonRead=false; rawBaseUrlValueExposed=false; secretValueExposed=false; providerCallsMadeByThisPhase=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase607r-next-card">
                    <div><strong>Next Action</strong><small>${escapeHtml(interactiveTerminalIntake.nextAction)}</small></div>
                    <p>chatModified=false; chatGatewayExecuteModified=false; deploy/release/tag/push/commit=false</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase610r-codex-exec-intake-section" data-codex-phase610r-codex-exec-intake="true" data-codex-phase610r-one-shot-pass-once="true" data-codex-phase610r-no-chat-integration="true">
                  <article class="codex-context-preview-card" id="codex-phase610r-status-card">
                    <div><strong>Phase610R-Fix Codex Exec Intake</strong><small>${escapeHtml(codexExecIntake.blocker || "no blocker")}</small></div>
                    <p>${escapeHtml(codexExecIntake.status)}; codexOneShotExecutedByThisPhase=false; providerCallsMadeByThisPhase=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase610r-provider-card">
                    <div><strong>Selected Provider</strong><small>${escapeHtml(codexExecIntake.selectedProviderId || "not selected")}</small></div>
                    <p>requestAttemptCount=${codexExecIntake.requestAttemptCount}; retryAttemptCount=${codexExecIntake.retryAttemptCount}; responseClassification=${escapeHtml(codexExecIntake.responseClassification)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase610r-boundary-card">
                    <div><strong>Boundary</strong><small>not production ready</small></div>
                    <ul>${codexExecIntakeRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase610r-next-card">
                    <div><strong>Next Action</strong><small>${escapeHtml(codexExecIntake.nextAction)}</small></div>
                    <p>repeatedReliabilityProven=false; chatIntegrationComplete=false; releaseReadyClaimed=false</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase611r-reliability-design-section" data-codex-phase611r-reliability-design="true" data-codex-phase611r-not-executed="true" data-codex-phase611r-no-chat-integration="true">
                  <article class="codex-context-preview-card" id="codex-phase611r-status-card">
                    <div><strong>Phase611R-Fix Reliability Design</strong><small>${escapeHtml(repeatedReliabilityDesign.blocker || "no blocker")}</small></div>
                    <p>designOnly=true; repeatedReliabilityProven=false; codexOneShotExecutedByThisPhase=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase611r-plan-card">
                    <div><strong>Attempt Plan</strong><small>maxPlannedAttempts=${repeatedReliabilityDesign.maxPlannedAttempts}</small></div>
                    <p>maxRequests=1 per attempt; retryLimit=0; explicit confirmation required; stopOnFailure=true</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase611r-boundary-card">
                    <div><strong>Readiness Boundary</strong><small>not release ready</small></div>
                    <ul>${repeatedReliabilityRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase611r-next-card">
                    <div><strong>Next Action</strong><small>${escapeHtml(repeatedReliabilityDesign.nextAction)}</small></div>
                    <p>providerCallsMadeByThisPhase=false; providerRuntimeModified=false; productionReadyClaimed=false</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase611r-guarded-test-design-section" data-codex-phase611r-guarded-test-design="true" data-codex-phase612-explicit-confirmation-required="true" data-codex-phase611r-max-requests-total="3">
                  <article class="codex-context-preview-card" id="codex-phase611r-guarded-status-card">
                    <div><strong>Phase611R-Fix Guarded Test Design</strong><small>${escapeHtml(repeatedGuardedTestDesign.blocker || "no blocker")}</small></div>
                    <p>designOnly=true; codexExecExecutedByThisPhase=false; providerCallsMadeByThisPhase=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase611r-guarded-budget-card">
                    <div><strong>Budget / Attempts</strong><small>maxRequestsTotal=${repeatedGuardedTestDesign.maxRequestsTotal}</small></div>
                    <p>maxPlannedAttempts=${repeatedGuardedTestDesign.maxPlannedAttempts}; maxRequestsPerAttempt=1; retryLimitPerAttempt=0; stopOnFirstFailure=true</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase611r-guarded-gate-card">
                    <div><strong>Phase612 Gate</strong><small>explicit confirmation required</small></div>
                    <ul>${repeatedGuardedTestRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase611r-guarded-next-card">
                    <div><strong>Next Action</strong><small>${escapeHtml(repeatedGuardedTestDesign.nextAction)}</small></div>
                    <p>notProductionReady=true; notReleaseReady=true; notChatIntegrated=true</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase612r-repeated-result-section" data-codex-phase612r-repeated-result="true" data-codex-phase612r-no-chat-integration="true" data-codex-phase612r-not-production-ready="true">
                  <article class="codex-context-preview-card" id="codex-phase612r-status-card">
                    <div><strong>Phase612R-Fix Reliability Result</strong><small>${escapeHtml(repeatedGuardedTestResult.blocker || "no blocker")}</small></div>
                    <p>selectedProviderId=${escapeHtml(repeatedGuardedTestResult.selectedProviderId)}; repeatedReliabilityClassification=${escapeHtml(repeatedGuardedTestResult.repeatedReliabilityClassification)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase612r-attempts-card">
                    <div><strong>Attempts</strong><small>${repeatedGuardedTestResult.completedAttempts}/${repeatedGuardedTestResult.plannedAttempts}</small></div>
                    <ul>${repeatedGuardedResultRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase612r-boundary-card">
                    <div><strong>Boundary</strong><small>not production ready</small></div>
                    <p>authJsonRead=false; codexConfigModified=false; chatModified=false; chatGatewayExecuteModified=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase612r-next-card">
                    <div><strong>Next Action</strong><small>${escapeHtml(repeatedGuardedTestResult.nextAction)}</small></div>
                    <p>notReleaseReady=true; notChatIntegrated=true; workspaceCleanClaimed=false</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase613r-closure-section" data-codex-phase613r-closure="true" data-codex-phase613r-next-gate-design="true" data-codex-phase613r-no-chat-integration="true">
                  <article class="codex-context-preview-card" id="codex-phase613r-status-card">
                    <div><strong>Phase613R-Fix Boundary Closure</strong><small>${escapeHtml(repeatedReliabilityClosure.blocker || "no blocker")}</small></div>
                    <p>scope=${escapeHtml(repeatedReliabilityClosure.capabilityBoundary)}; selectedProviderId=${escapeHtml(repeatedReliabilityClosure.selectedProviderId)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase613r-proof-card">
                    <div><strong>Repeated Pass Closure</strong><small>${repeatedReliabilityClosure.completedAttempts}/3</small></div>
                    <ul>${repeatedClosureRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase613r-next-gate-card">
                    <div><strong>Next Gate</strong><small>separate phase required</small></div>
                    <p>${escapeHtml(repeatedReliabilityClosure.nextGate)}; UI read-only preview first</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase613r-boundary-card">
                    <div><strong>Non-Claims</strong><small>not release ready</small></div>
                    <p>notProductionReady=true; notReleaseReady=true; notChatGatewayExecuteIntegrated=true</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase614r-preview-gate-section" data-codex-phase614r-preview-gate="true" data-codex-phase614r-read-only-preview="true" data-codex-phase614r-no-runtime-integration="true">
                  <article class="codex-context-preview-card" id="codex-phase614r-status-card">
                    <div><strong>Phase614R-Fix Preview Gate</strong><small>${escapeHtml(controlledIntegrationPreviewGate.blocker || "no blocker")}</small></div>
                    <p>previewOnly=true; runtimeIntegrated=false; routeId=${escapeHtml(controlledIntegrationPreviewGate.routeId)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase614r-contract-card">
                    <div><strong>Route Contract</strong><small>${escapeHtml(controlledIntegrationPreviewGate.integrationMode)}</small></div>
                    <ul>${controlledIntegrationGateRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase614r-boundary-card">
                    <div><strong>Forbidden Entry Points</strong><small>main chain blocked</small></div>
                    <p>/chat=false; /chat-gateway/execute=false; provider_runtime=false; production_router=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase614r-next-card">
                    <div><strong>Next Phase</strong><small>${escapeHtml(controlledIntegrationPreviewGate.nextAction)}</small></div>
                    <p>Phase615R-Fix approval packet only; no direct runtime integration</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase615r-approval-packet-section" data-codex-phase615r-approval-packet="true" data-codex-phase615r-read-only-preview="true" data-codex-phase615r-no-runtime-integration="true">
                  <article class="codex-context-preview-card" id="codex-phase615r-status-card">
                    <div><strong>Phase615R-Fix Approval Packet</strong><small>${escapeHtml(runtimeIntegrationApprovalPacket.blocker || "no blocker")}</small></div>
                    <p>approvalPacketReady=${runtimeIntegrationApprovalPacket.approvalPacketReady}; selectedProviderId=${escapeHtml(runtimeIntegrationApprovalPacket.selectedProviderId)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase615r-policy-card">
                    <div><strong>Policy Packet</strong><small>approval required</small></div>
                    <ul>${runtimeApprovalRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase615r-boundary-card">
                    <div><strong>Runtime Boundary</strong><small>not integrated</small></div>
                    <p>/chat=false; /chat-gateway/execute=false; providerRuntimeModified=false; codexExecExecutedByThisPhase=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase615r-next-card">
                    <div><strong>Next Phase</strong><small>${escapeHtml(runtimeIntegrationApprovalPacket.nextPhase)}</small></div>
                    <p>Phase616R-Fix route contract dry-run only; providerCallsMadeByThisPhase=false</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase616r-620r-dry-run-candidate-section" data-codex-phase616r-620r-dry-run-candidate="true" data-codex-phase616r-620r-read-only-preview="true" data-codex-phase616r-620r-no-runtime-integration="true">
                  <article class="codex-context-preview-card" id="codex-phase616r-620r-status-card">
                    <div><strong>Phase616R-620R Dry-Run Candidate</strong><small>${escapeHtml(runtimeCandidateDryRunBundle.blocker || "no blocker")}</small></div>
                    <p>candidateMode=${escapeHtml(runtimeCandidateDryRunBundle.candidateMode)}; selectedProviderId=${escapeHtml(runtimeCandidateDryRunBundle.selectedProviderId)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase616r-620r-contract-card">
                    <div><strong>Route Contract Dry-Run</strong><small>${escapeHtml(runtimeCandidateDryRunBundle.routeId)}</small></div>
                    <ul>${runtimeCandidateDryRunRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase616r-620r-boundary-card">
                    <div><strong>Main Chain Boundary</strong><small>still blocked</small></div>
                    <p>/chat=false; /chat-gateway/execute=false; providerRuntimeModified=false; providerCallsMadeByThisPhase=false</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase616r-620r-next-card">
                    <div><strong>Next Gate</strong><small>${escapeHtml(runtimeCandidateDryRunBundle.nextPhase)}</small></div>
                    <p>Implementation plan review only; no direct runtime wiring, no deploy, no release</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase621r-628r-runtime-candidate-section" data-codex-phase621r-628r-runtime-candidate="true" data-codex-phase621r-628r-isolated-candidate="true" data-codex-phase621r-628r-no-chat-integration="true" data-codex-phase621r-628r-no-provider-call="true">
                  <article class="codex-context-preview-card" id="codex-phase621r-628r-status-card">
                    <div><strong>Phase621R-628R Isolated Candidate Path</strong><small>${escapeHtml(controlledRuntimeCandidatePath.blocker || "no blocker")}</small></div>
                    <p>selectedProviderId=${escapeHtml(controlledRuntimeCandidatePath.selectedProviderId)}; isolatedRuntimeCandidateWired=${String(controlledRuntimeCandidatePath.isolatedRuntimeCandidateWired)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase621r-628r-reliability-card">
                    <div><strong>Dry-Run Smoke + Guarded Local Reliability</strong><small>${escapeHtml(controlledRuntimeCandidatePath.repeatedReliabilityClassification)}</small></div>
                    <ul>${controlledRuntimeCandidateRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase621r-628r-boundary-card">
                    <div><strong>Runtime Boundary</strong><small>isolated candidate only</small></div>
                    <ul>${controlledRuntimeCandidateBoundaryRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase621r-628r-next-card">
                    <div><strong>Next Gate</strong><small>${escapeHtml(controlledRuntimeCandidatePath.nextPhase)}</small></div>
                    <p>Controlled implementation review only; no direct /chat wiring, no provider runtime modification, no deploy, no release.</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase629r-final-approval-section" data-codex-phase629r-final-approval="true" data-codex-phase629r-read-only-preview="true" data-codex-phase629r-no-main-chain-integration="true" data-codex-phase629r-no-runtime-button="true">
                  <article class="codex-context-preview-card" id="codex-phase629r-status-card">
                    <div><strong>Phase629R-Fix Final Human Approval Packet</strong><small>${escapeHtml(mainChainFinalApprovalPacket.blocker || "no blocker")}</small></div>
                    <p>selectedProviderId=${escapeHtml(mainChainFinalApprovalPacket.selectedProviderId)}; approvalPacketReady=${String(mainChainFinalApprovalPacket.approvalPacketReady)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase629r-readiness-card">
                    <div><strong>Main-Chain Approval Readiness</strong><small>design authorization only</small></div>
                    <ul>${mainChainFinalApprovalRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase629r-boundary-card">
                    <div><strong>Main-Chain Boundary</strong><small>not integrated</small></div>
                    <ul>${mainChainFinalBoundaryRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase629r-next-card">
                    <div><strong>Next Gate</strong><small>${escapeHtml(mainChainFinalApprovalPacket.nextPhase)}</small></div>
                    <p>Phase630R-Fix design patch only; no direct /chat wiring, no /chat-gateway/execute mutation, no provider runtime modification.</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase630r-design-patch-section" data-codex-phase630r-design-patch="true" data-codex-phase630r-read-only-preview="true" data-codex-phase630r-patch-not-applied="true" data-codex-phase630r-no-runtime-button="true">
                  <article class="codex-context-preview-card" id="codex-phase630r-status-card">
                    <div><strong>Phase630R-Fix Design Patch</strong><small>${escapeHtml(mainChainDesignPatch.blocker || "no blocker")}</small></div>
                    <p>selectedProviderId=${escapeHtml(mainChainDesignPatch.selectedProviderId)}; designPatchReady=${String(mainChainDesignPatch.designPatchReady)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase630r-route-preview-card">
                    <div><strong>Route Patch Preview</strong><small>${escapeHtml(mainChainDesignPatch.patchMode)}</small></div>
                    <ul>${mainChainDesignPatchRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase630r-boundary-card">
                    <div><strong>Patch Boundary</strong><small>not applied</small></div>
                    <ul>${mainChainDesignPatchBoundaryRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase630r-next-card">
                    <div><strong>Next Gate</strong><small>${escapeHtml(mainChainDesignPatch.nextPhase)}</small></div>
                    <p>Phase631R-Fix isolated implementation patch candidate only; feature flag off by default; no Provider call.</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase639r-p1-approval-section" data-codex-phase639r-p1-approval-preview="true" data-codex-phase639r-read-only-preview="true" data-codex-phase639r-no-implementation="true" data-codex-phase639r-no-runtime-button="true">
                  <article class="codex-context-preview-card" id="codex-phase639r-status-card">
                    <div><strong>Phase639R P1 Approval Preview</strong><small>${escapeHtml(phase639RP1ApprovalPreview.blocker || "no blocker")}</small></div>
                    <p>mainChainApprovalPacketReady=${String(phase639RP1ApprovalPreview.mainChainApprovalPacketReady)}; providerRuntimeApprovalPacketReady=${String(phase639RP1ApprovalPreview.providerRuntimeApprovalPacketReady)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase639r-readiness-card">
                    <div><strong>Read-Only P1 Approval Status</strong><small>approval packets only</small></div>
                    <ul>${phase639rP1ApprovalRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase639r-boundary-card">
                    <div><strong>P1 Boundary</strong><small>not implemented</small></div>
                    <ul>
                      <li>main-chain candidate preparation only</li>
                      <li>provider runtime candidate preparation only</li>
                      <li>no /chat change, no /chat-gateway/execute change, no provider runtime change</li>
                    </ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase639r-next-card">
                    <div><strong>Next Gate</strong><small>${escapeHtml(phase639RP1ApprovalPreview.nextPhase)}</small></div>
                    <p>Separate approval remains required before any implementation, provider call, deploy, release, push, or commit.</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase639r-nightly-fallback-section" data-codex-phase639r-nightly-fallback-panel="true" data-codex-phase639r-nightly-read-only-preview="true" data-codex-phase639r-nightly-no-register-button="true" data-codex-phase639r-nightly-no-run-button="true">
                  <article class="codex-context-preview-card" id="codex-phase639r-nightly-status-card">
                    <div><strong>Nightly Runner Fallback Panel</strong><small>${escapeHtml(phase639RNightlyFallbackPanel.originalBlocker)}</small></div>
                    <p>scheduledTaskRegistered=${String(phase639RNightlyFallbackPanel.scheduledTaskRegistered)}; nightlyAutomationEnabled=${String(phase639RNightlyFallbackPanel.nightlyAutomationEnabled)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase639r-nightly-state-card">
                    <div><strong>Read-Only Nightly Status</strong><small>fallback launcher only</small></div>
                    <ul>${phase639rNightlyFallbackRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase639r-nightly-launchers-card">
                    <div><strong>Fallback Launchers</strong><small>available, manual only</small></div>
                    <p><code>${escapeHtml(phase639RNightlyFallbackPanel.fallbackCmdPath)}</code></p>
                    <p><code>${escapeHtml(phase639RNightlyFallbackPanel.fallbackPs1Path)}</code></p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase639r-nightly-boundary-card">
                    <div><strong>Execution Boundary</strong><small>not enabled</small></div>
                    <p>Not a daemon, not an infinite loop, not nightly automation enabled; a permissioned Windows session is required before Task Scheduler registration can be retried.</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase640r-nightly-retry-pack-section" data-codex-phase640r-nightly-retry-pack="true" data-codex-phase640r-nightly-read-only-preview="true" data-codex-phase640r-nightly-no-register-button="true" data-codex-phase640r-nightly-no-run-button="true">
                  <article class="codex-context-preview-card" id="codex-phase640r-nightly-status-card">
                    <div><strong>Phase640R Permissioned Retry Pack</strong><small>${escapeHtml(phase640RNightlyPermissionedRetryPack.originalBlocker)}</small></div>
                    <p>permissioned retry pack ready=${String(phase640RNightlyPermissionedRetryPack.permissionedRetryPackReady)}; nightly automation enabled=false; scheduledTaskRegistered=${String(phase640RNightlyPermissionedRetryPack.scheduledTaskRegistered)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase640r-nightly-state-card">
                    <div><strong>Read-Only Retry Status</strong><small>manual permissioned session required</small></div>
                    <ul>${phase640rNightlyPermissionedRetryRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase640r-nightly-scripts-card">
                    <div><strong>Retry Artifacts</strong><small>not executed here</small></div>
                    <p>admin checklist ready: <code>${escapeHtml(phase640RNightlyPermissionedRetryPack.adminChecklistPath)}</code></p>
                    <p>verify script ready: <code>${escapeHtml(phase640RNightlyPermissionedRetryPack.verifyScriptPath)}</code></p>
                    <p>result intake example ready: <code>${escapeHtml(phase640RNightlyPermissionedRetryPack.resultInputExamplePath)}</code></p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase640r-nightly-next-card">
                    <div><strong>Next Action</strong><small>permissioned manual retry</small></div>
                    <p>next action: manually run retry script in a permissioned session. This panel does not register Task Scheduler, does not run nightly runner, and does not call Provider.</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase641r-nightly-registration-intake-section" data-codex-phase641r-nightly-registration-intake="true" data-codex-phase641r-nightly-read-only-preview="true" data-codex-phase641r-nightly-no-register-button="true" data-codex-phase641r-nightly-no-run-button="true">
                  <article class="codex-context-preview-card" id="codex-phase641r-nightly-status-card">
                    <div><strong>Phase641R Registration Result Intake</strong><small>${escapeHtml(phase641RNightlyRegistrationResultIntake.blocker || "no blocker")}</small></div>
                    <p>Task Scheduler registered=${String(phase641RNightlyRegistrationResultIntake.scheduledTaskRegistered)}; nightly automation enabled=${String(phase641RNightlyRegistrationResultIntake.nightlyAutomationEnabled)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase641r-nightly-state-card">
                    <div><strong>Read-Only Intake Status</strong><small>result input + system verification</small></div>
                    <ul>${phase641rNightlyRegistrationRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase641r-nightly-evidence-card">
                    <div><strong>Evidence Paths</strong><small>read-only</small></div>
                    <p><code>docs/phase641r-nightly-registration-result.input.json</code></p>
                    <p><code>docs/phase641r-nightly-registration-result.input.example.json</code></p>
                    <p><code>${escapeHtml(phase641RNightlyRegistrationResultIntake.latestEvidencePath)}</code></p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase641r-nightly-next-card">
                    <div><strong>Next Action</strong><small>confirm or supply result input</small></div>
                    <p>${escapeHtml(phase641RNightlyRegistrationResultIntake.nextAction)}</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase640r-external-tool-section" data-codex-phase640r-external-tool-preview="true" data-codex-phase640r-external-tool-read-only-preview="true" data-codex-phase640r-external-tool-no-chat-button="true" data-codex-phase640r-external-tool-no-chat-gateway-execute-button="true" data-codex-phase640r-external-tool-no-provider-runtime-button="true">
                  <article class="codex-context-preview-card" id="codex-phase640r-external-tool-status-card">
                    <div><strong>External Codex Relay Tool</strong><small>token-saving tool mode</small></div>
                    <p>Codex/crs gateway is external tool mode; main-chain integration frozen; provider runtime integration frozen.</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase640r-external-tool-state-card">
                    <div><strong>Product Boundary</strong><small>read-only preview</small></div>
                    <ul>${phase640rExternalToolRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase640r-external-tool-matrix-card">
                    <div><strong>Capability Matrix</strong><small>external only</small></div>
                    <p><code>${escapeHtml(phase640RExternalToolMode.capabilityMatrixPath)}</code></p>
                    <p>productionReady=false; releaseReady=false; not production traffic path.</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase640r-external-tool-freeze-card">
                    <div><strong>Frozen Direction</strong><small>future reopen requires explicit request</small></div>
                    <p>Main-chain and Provider-runtime phases remain historical references only. Do not continue main-chain phases automatically.</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase641r-645r-external-tool-section" data-codex-phase641r-645r-external-tool-bundle="true" data-codex-phase641r-645r-read-only-preview="true" data-codex-phase641r-645r-no-execution-button="true" data-codex-phase641r-645r-no-provider-call-button="true" data-codex-phase641r-645r-no-deploy-button="true" data-codex-phase641r-645r-no-secret-input="true">
                  <article class="codex-context-preview-card" id="codex-phase641r-645r-external-tool-status-card">
                    <div><strong>External Codex Relay Tool</strong><small>Phase641R-645R productization</small></div>
                    <p>toolMode=${escapeHtml(phase641R645RExternalToolBundle.toolMode)}; CLI wrapper ready=${String(phase641R645RExternalToolBundle.cliWrapperReady)}; operator panel hardened=${String(phase641R645RExternalToolBundle.operatorPanelReady)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase641r-645r-external-tool-state-card">
                    <div><strong>External Tool Guardrails</strong><small>read-only preview</small></div>
                    <ul>${phase641r645rExternalToolRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase641r-645r-external-tool-pack-card">
                    <div><strong>Tool Pack</strong><small>dry-run only</small></div>
                    <p>open-source dry-run pack ready=${String(phase641R645RExternalToolBundle.openSourceDryRunToolPackReady)}; token-saving benchmark rechecked=${String(phase641R645RExternalToolBundle.tokenSavingBenchmarkRechecked)}</p>
                    <p><code>${escapeHtml(phase641R645RExternalToolBundle.evidencePath)}</code></p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase641r-645r-external-tool-boundary-card">
                    <div><strong>Boundary</strong><small>no runtime hooks</small></div>
                    <p>No codex exec button, no Provider call button, no /chat wiring, no /chat-gateway/execute wiring, no provider runtime mutation, no deploy/release/push action.</p>
                  </article>
                </div>
                <div class="codex-context-preview-grid" id="codex-phase646r-650r-external-tool-dashboard-section" data-codex-phase646r-650r-external-tool-dashboard="true" data-codex-phase646r-650r-read-only-preview="true" data-codex-phase646r-650r-no-execution-button="true" data-codex-phase646r-650r-no-provider-call-button="true" data-codex-phase646r-650r-no-chat-integration-button="true" data-codex-phase646r-650r-no-deploy-button="true" data-codex-phase646r-650r-no-secret-input="true">
                  <article class="codex-context-preview-card" id="codex-phase646r-650r-external-tool-status-card">
                    <div><strong>External Tool Daily Workflow</strong><small>Phase646R-650R closure</small></div>
                    <p>dailyWorkflowReady=${String(phase646R650RExternalToolClosure.dailyWorkflowReady)}; taskQueueLedgerReady=${String(phase646R650RExternalToolClosure.taskQueueLedgerReady)}; evidenceDashboardReady=${String(phase646R650RExternalToolClosure.evidenceDashboardReady)}</p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase646r-650r-external-tool-state-card">
                    <div><strong>Read-Only Dashboard State</strong><small>external tool only</small></div>
                    <ul>${phase646r650rExternalToolRows}</ul>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase646r-650r-external-tool-evidence-card">
                    <div><strong>Latest Evidence</strong><small>read-only paths</small></div>
                    <p><code>${escapeHtml(phase646R650RExternalToolClosure.evidencePath)}</code></p>
                    <p><code>${escapeHtml(phase646R650RExternalToolClosure.dailyWorkflowPath)}</code></p>
                    <p><code>${escapeHtml(phase646R650RExternalToolClosure.nextUsePlaybookPath)}</code></p>
                  </article>
                  <article class="codex-context-preview-card" id="codex-phase646r-650r-external-tool-boundary-card">
                    <div><strong>Boundary</strong><small>no execution controls</small></div>
                    <p>No codex exec, no Provider call, no /chat wiring, no /chat-gateway/execute wiring, no provider runtime mutation, no deploy/release/push/commit, productionReady=false, releaseReady=false.</p>
                  </article>
                </div>
                <div class="codex-context-actions" aria-label="Codex Context Gateway preview actions">
                  ${actions}
                </div>
                <div class="codex-context-result is-visible" id="codex-context-preview-detail" data-codex-context-detail="true" tabindex="-1">
                  <strong id="codex-context-preview-title">Context Pack Preview</strong>
                  <p id="codex-context-preview-copy">Context hash, stale status, token budget, relevant files, evidence refs, dirty metadata, prompt pack, usage workflow, and authorization dry-run simulation are read from .codex-context only.</p>
                  <small id="codex-context-preview-boundary-line">providerCallsMade=false; rawSecretAccessed=false; rawWebhookAccessed=false; codexBaseUrlModified=false; codexConfigModified=false; realCodexConnectionMade=false; relayStarted=false; realConfigWriteAllowed=false; relayStartAllowed=false; realIntegrationAllowed=false; chatModified=false; chatGatewayExecuteModified=false</small>
                </div>
                <script type="application/json" id="codex-context-preview-data">${detailPayload}</script>
              </section>`;
}

function buildDetailPayload(preview, usage, trial, benchmark, baseUrlDesign, authorizationDesign, humanApprovalReview, readinessReview, preparationReview, oneShotReview, customProviderReview, customProviderOneShotReview, interactiveTerminalIntake, codexExecIntake, repeatedReliabilityDesign, repeatedGuardedTestDesign, repeatedGuardedTestResult, repeatedReliabilityClosure, controlledIntegrationPreviewGate, runtimeIntegrationApprovalPacket, runtimeCandidateDryRunBundle, controlledRuntimeCandidatePath, mainChainFinalApprovalPacket, mainChainDesignPatch, phase639RP1ApprovalPreview, phase639RNightlyFallbackPanel, phase640RNightlyPermissionedRetryPack, phase641RNightlyRegistrationResultIntake, phase640RExternalToolMode, phase641R645RExternalToolBundle, phase646R650RExternalToolClosure) {
  return {
    contextPack: {
      title: "Context Pack Preview",
      copy: `hash=${preview.contextHash}; phaseSummaryVisible=${preview.contextPack.phaseSummaryVisible}; safetyBoundaryVisible=${preview.contextPack.safetyBoundaryVisible}`,
    },
    tokenBudget: {
      title: "Token Budget Preview",
      copy: `${preview.tokenBudget.budgetName}: estimated=${preview.tokenBudget.currentEstimate}, max=${preview.tokenBudget.maxTokens}, respected=${preview.tokenBudget.budgetRespected}, saving=${preview.tokenBudget.tokenSavingEstimate.savedPercent || 0}%`,
    },
    relevantFiles: {
      title: "Relevant Files Preview",
      copy: `${preview.relevantFiles.relevantFileCount} selected files; selectionMode=${preview.relevantFiles.selectionMode}; fullRepoScanAvoided=${preview.relevantFiles.fullRepoScanAvoided}`,
    },
    promptPack: {
      title: "Prompt Pack Preview",
      copy: `${preview.promptPack.promptPackTitle}; taskSummaryVisible=${preview.promptPack.taskSummaryVisible}; validationCommandsVisible=${preview.promptPack.validationCommandsVisible}`,
    },
    freshness: {
      title: "Freshness Preview",
      copy: `stale=${preview.freshness.staleStatus}; hash=${preview.freshness.contextHash}; simulatedStalePreviewWorks=${preview.freshness.simulatedStalePreviewWorks}`,
    },
    evidenceIndex: {
      title: "Evidence Index Preview",
      copy: `${preview.evidenceIndex.evidenceRefCount} evidence refs; recent=${preview.evidenceIndex.recentPhases.join(", ")}`,
    },
    refreshPreview: {
      title: "Refresh Preview",
      copy: "Dry-run refresh rechecks .codex-context only. No provider call, no Codex base_url change, no Codex config write.",
    },
    copyPrompt: {
      title: "Prompt Preview Copied",
      copy: displaySafeText(preview.promptPack.previewText.slice(0, 900)),
    },
    usageWorkflow: {
      title: "Usage Workflow Preview",
      copy: `preflight=${usage.preflight.completed}; stale=${usage.freshnessGate.stale}; relevantFiles=${usage.relevantFileScope.relevantFileCount}; dryRunOnly=true; realCodexConnectionMade=false`,
    },
    preflight: {
      title: "Context Pack Preflight",
      copy: `contextPackMdExists=${usage.preflight.contextPackMdExists}; contextPackJsonExists=${usage.preflight.contextPackJsonExists}; relevantFilesExists=${usage.preflight.relevantFilesExists}; missingRequiredFileBlocks=${usage.preflight.missingRequiredFileBlocks}`,
    },
    validationPlan: {
      title: "Validation Command Planner",
      copy: usage.validationPlan.commands.join(" | "),
    },
    dryRunWrapper: {
      title: "Dry-run Codex Task Wrapper",
      copy: `preflightExecuted=${usage.dryRunTask.preflightExecuted}; freshnessGateExecuted=${usage.dryRunTask.freshnessGateExecuted}; promptPackLoaded=${usage.dryRunTask.promptPackLoaded}; realCodexConnectionMade=false`,
    },
    failureModes: {
      title: "Failure Mode Preview",
      copy: `missingContextPackBlocks=${usage.failureMode.missingContextPackBlocks}; staleContextBlocks=${usage.failureMode.staleContextBlocks}; tokenBudgetExceededWarns=${usage.failureMode.tokenBudgetExceededWarns}; malformedPromptPackHandled=${usage.failureMode.malformedPromptPackHandled}`,
    },
    operatorChecklist: {
      title: "Operator Checklist",
      copy: usage.operatorChecklist.items.join(" | "),
    },
    usageTrial: {
      title: "Phase595 Real Usage Trial",
      copy: `status=${trial.classifier.status}; contextPackUsed=${trial.usageTracker.contextPackUsed}; relevantFilesUsed=${trial.usageTracker.relevantFilesUsed}; tokenSaving=${trial.tokenSaving.savingPercent}%; validationPassed=${trial.validationExecution.allValidationCommandsPassed}`,
    },
    nextInstruction: {
      title: "Next Codex Task Instruction",
      copy: trial.nextInstruction.instruction,
    },
    repeatedBenchmark: {
      title: "Phase596 Repeated Benchmark",
      copy: `executedTaskCount=${benchmark.aggregate.executedTaskCount}; averageTokenSavingPercent=${benchmark.aggregate.averageTokenSavingPercent}; fullRepoScanFlaggedCount=${benchmark.aggregate.fullRepoScanFlaggedCount}; failedTaskCount=${benchmark.aggregate.failedTaskCount}; benchmarkStatus=${benchmark.classifier.trialStatus}`,
    },
    benchmarkNext: {
      title: "Benchmark Next Step",
      copy: benchmark.aggregate.nextOptimization,
    },
    baseUrlDesign: {
      title: "Phase597 Base URL Design Preview",
      copy: `designOnly=${baseUrlDesign.designOnly}; authorizationStatus=${baseUrlDesign.authorization.realIntegrationStatus}; codexBaseUrlModified=${baseUrlDesign.codexBaseUrlModified}; codexConfigModified=${baseUrlDesign.codexConfigModified}; relayStarted=${baseUrlDesign.relayStarted}; providerCallsMade=${baseUrlDesign.providerCallsMade}`,
    },
    baseUrlConfigPreview: {
      title: "Base URL Config Preview",
      copy: `mode=${baseUrlDesign.configPreview.preview.mode}; targetScope=${baseUrlDesign.configPreview.preview.targetScope}; enabled=${baseUrlDesign.configPreview.preview.enabled}; dryRunOnly=${baseUrlDesign.configPreview.preview.dryRunOnly}; rawBaseUrlValueExposed=${baseUrlDesign.configPreview.rawBaseUrlValueExposed}`,
    },
    baseUrlAuthorization: {
      title: "Authorization Requirements",
      copy: `missingAuthorizationBlocks=${baseUrlDesign.authorization.missingAuthorizationBlocks}; allowCodexBaseUrlChangeRequired=${baseUrlDesign.authorization.allowCodexBaseUrlChangeRequired}; maxRequestsRequired=${baseUrlDesign.authorization.maxRequestsRequired}; maxEstimatedCostUsdRequired=${baseUrlDesign.authorization.maxEstimatedCostUsdRequired}; approvalRecordRequired=${baseUrlDesign.authorization.approvalRecordRequired}`,
    },
    baseUrlRollback: {
      title: "Rollback Plan",
      copy: baseUrlDesign.rollback.steps.join(" | "),
    },
    baseUrlRiskReview: {
      title: "Failure Mode / Risk Review",
      copy: baseUrlDesign.riskReview.risks.join(" | "),
    },
    baseUrlChecklist: {
      title: "Controlled Integration Checklist",
      copy: baseUrlDesign.checklist.items.join(" | "),
    },
    authStatus: {
      title: "Authorization Status",
      copy: `authorizationComplete=${authorizationDesign.authorizationComplete}; realIntegrationStatus=${authorizationDesign.realIntegrationStatus}; realIntegrationAllowed=${authorizationDesign.realIntegrationAllowed}; guardedRealTestNotAllowedYet=${authorizationDesign.guardedRealTestNotAllowedYet}`,
    },
    authMissingFields: {
      title: "Missing Required Fields",
      copy: authorizationDesign.missingAuthorizationFields.join(" | "),
    },
    authDryRunSimulation: {
      title: "Dry-run Config Simulation",
      copy: `simulationStatus=${authorizationDesign.configSimulationReport.simulationStatus}; enabled=${authorizationDesign.dryRunConfigSimulation.enabled}; dryRunOnly=${authorizationDesign.dryRunConfigSimulation.dryRunOnly}; wouldWriteConfig=${authorizationDesign.dryRunConfigSimulation.wouldWriteConfig}; wouldStartRelay=${authorizationDesign.dryRunConfigSimulation.wouldStartRelay}`,
    },
    authRedactedConfig: {
      title: "Redacted Config Preview",
      copy: authorizationDesign.redactedConfigPreview.configSnippetPreview,
    },
    authRelay: {
      title: "Relay Simulation",
      copy: authorizationDesign.relaySimulationPlan.simulationSteps.join(" | "),
    },
    authAccountPool: {
      title: "Account Pool Simulation",
      copy: `accountPoolRef=${authorizationDesign.accountPoolSimulation.accountPoolRef}; concurrencyLimitSimulated=${authorizationDesign.accountPoolSimulation.concurrencyLimitSimulated}; perAccountQuotaSimulated=${authorizationDesign.accountPoolSimulation.perAccountQuotaSimulated}; coolingWindowSimulated=${authorizationDesign.accountPoolSimulation.coolingWindowSimulated}`,
    },
    authCredential: {
      title: "CredentialRef Simulation",
      copy: `credentialRef=${authorizationDesign.credentialRefSimulation.credentialRef}; rawSecretAccessed=${authorizationDesign.credentialRefSimulation.rawSecretAccessed}; rawWebhookAccessed=${authorizationDesign.credentialRefSimulation.rawWebhookAccessed}; simulatedCredentialOnly=${authorizationDesign.credentialRefSimulation.simulatedCredentialOnly}`,
    },
    authPolicy: {
      title: "Base URL Dry-run Policy",
      copy: `realConfigWriteForbidden=${authorizationDesign.baseUrlDryRunPolicy.realConfigWriteForbidden}; realRelayStartForbidden=${authorizationDesign.baseUrlDryRunPolicy.realRelayStartForbidden}; realProviderCallForbidden=${authorizationDesign.baseUrlDryRunPolicy.realProviderCallForbidden}; realSecretReadForbidden=${authorizationDesign.baseUrlDryRunPolicy.realSecretReadForbidden}`,
    },
    authRollback: {
      title: "Rollback Simulation",
      copy: authorizationDesign.rollbackSimulation.steps.join(" | "),
    },
    authEmergency: {
      title: "Emergency Disable Simulation",
      copy: authorizationDesign.emergencyDisableSimulation.summary.join(" | "),
    },
    authEvidence: {
      title: "Authorization Evidence",
      copy: `authorizationEvidenceGenerated=${authorizationDesign.authorizationEvidence.authorizationEvidenceGenerated}; authorizationCompleteness=${authorizationDesign.authorizationEvidence.authorizationCompleteness}; realIntegrationStatus=${authorizationDesign.authorizationEvidence.realIntegrationStatus}; configSimulationStatus=${authorizationDesign.authorizationEvidence.configSimulationStatus}; rollbackSimulationStatus=${authorizationDesign.authorizationEvidence.rollbackSimulationStatus}`,
    },
    humanApprovalReview: {
      title: "Human Approval Review",
      copy: `authorizationComplete=${humanApprovalReview.authorizationComplete}; humanApprovalStatus=${humanApprovalReview.humanApprovalStatus}; realIntegrationAllowed=${humanApprovalReview.realIntegrationAllowed}; guardedRealTestAllowed=${humanApprovalReview.guardedRealTestAllowed}; finalDecision=${humanApprovalReview.finalDecision}`,
    },
    humanApprovalMissingFields: {
      title: "Authorization Packet Missing Fields",
      copy: humanApprovalReview.missingFields.join(" | "),
    },
    guardedRealTestReadiness: {
      title: "Guarded Real Test Readiness",
      copy: `guardedRealTestAllowed=${humanApprovalReview.guardedRealTestReadiness.guardedRealTestAllowed}; incompleteAuthorizationBlocks=${humanApprovalReview.guardedRealTestReadiness.incompleteAuthorizationBlocks}; missingHumanApprovalBlocks=${humanApprovalReview.guardedRealTestReadiness.missingHumanApprovalBlocks}; missingExplicitUserApprovalBlocks=${humanApprovalReview.guardedRealTestReadiness.missingExplicitUserApprovalBlocks}`,
    },
    phase600Readiness: {
      title: "Phase600 Readiness Review",
      copy: `authorizationComplete=${readinessReview.authorizationComplete}; humanApprovalStatus=${readinessReview.humanApprovalStatus}; readinessReviewPassed=${readinessReview.readinessReviewPassed}; realIntegrationAllowed=${readinessReview.realIntegrationAllowed}; guardedRealTestAllowed=${readinessReview.guardedRealTestAllowed}; blocker=${readinessReview.blocker}`,
    },
    phase600MissingFields: {
      title: "Phase600 Missing Fields",
      copy: readinessReview.missingFields.join(" | "),
    },
    phase600NextAction: {
      title: "Phase600 Next Action",
      copy: readinessReview.nextAction,
    },
    phase601Preparation: {
      title: "Phase601 Preparation Preview",
      copy: `blocker=${preparationReview.blocker}; preparationOnly=${preparationReview.preparationOnly}; phase602Candidate=${preparationReview.phase602Candidate}; finalUserConfirmationRequired=${preparationReview.finalUserConfirmationRequired}; realTestExecuted=${preparationReview.realTestExecuted}`,
    },
    phase601CommandBundle: {
      title: "Phase601 Final Command Bundle",
      copy: `commandPreview=${preparationReview.finalCommandBundlePreview.commandPreview}; rollbackPreviewReady=${preparationReview.nextPhaseGateReport.rollbackPreviewReady}; emergencyDisableReady=${preparationReview.nextPhaseGateReport.emergencyDisableReady}; commandExecuted=false`,
    },
    phase602OneShotResult: {
      title: "Phase602 One-Shot Result",
      copy: `blocker=${oneShotReview.blocker}; oneShotExecuted=${oneShotReview.oneShotExecuted}; requestAttemptCount=${oneShotReview.requestAttemptCount}; retryAttemptCount=${oneShotReview.retryAttemptCount}; testStatus=${oneShotReview.testStatus}; responseClassification=${oneShotReview.responseClassification}`,
    },
    phase602Cleanup: {
      title: "Phase602 Cleanup / Rollback",
      copy: `cleanupExecuted=${oneShotReview.cleanupExecuted}; rollbackResult=${oneShotReview.cleanup.rollbackResult}; userCodexConfigModified=${oneShotReview.userCodexConfigModified}; projectCodexConfigModified=${oneShotReview.projectCodexConfigModified}; rawBaseUrlValueExposed=${oneShotReview.rawBaseUrlValueExposed}`,
    },
    phase603CustomProviderRoute: {
      title: "Phase603 Custom Provider Route",
      copy: `openaiBaseUrlOverrideHonored=${customProviderReview.openaiBaseUrlOverrideHonored}; nextRoute=${customProviderReview.nextRoute}; authJsonRead=${customProviderReview.authJsonRead}; commandExecuted=${customProviderReview.commandExecuted}; realTestExecuted=${customProviderReview.realTestExecuted}`,
    },
    phase603CommandBundle: {
      title: "Phase603 Command Bundle Preview",
      copy: `commandPreview=${customProviderReview.commandBundle.commandPreview}; negativeControl=${customProviderReview.negativeControlPlan.commandPreview}; rawBaseUrlValueExposed=${customProviderReview.rawBaseUrlValueExposed}`,
    },
    phase604CustomProviderResult: {
      title: "Phase604 Custom Provider Result",
      copy: `blocker=${customProviderOneShotReview.blocker}; negativeControlExecuted=${customProviderOneShotReview.negativeControlExecuted}; negativeControlPassed=${customProviderOneShotReview.negativeControlPassed}; selectedProviderId=${customProviderOneShotReview.selectedProviderId || "null"}; oneShotExecuted=${customProviderOneShotReview.oneShotExecuted}; requestAttemptCount=${customProviderOneShotReview.requestAttemptCount}; responseClassification=${customProviderOneShotReview.responseClassification}`,
    },
    phase604Cleanup: {
      title: "Phase604 Cleanup / Rollback",
      copy: `cleanupExecuted=${customProviderOneShotReview.cleanupExecuted}; rollbackResult=${customProviderOneShotReview.cleanup.rollbackResult}; authJsonRead=${customProviderOneShotReview.authJsonRead}; authJsonTouched=${customProviderOneShotReview.authJsonTouched}; persistentConfigWritePerformed=${customProviderOneShotReview.persistentConfigWritePerformed}`,
    },
    phase607Intake: {
      title: "Phase607R-Fix Interactive Terminal Intake",
      copy: `route=${interactiveTerminalIntake.route}; selectedProviderId=${interactiveTerminalIntake.selectedProviderId || "null"}; manualResultInputExists=${interactiveTerminalIntake.manualResultInputExists}; requestAttemptCount=${interactiveTerminalIntake.requestAttemptCount}; responseClassification=${interactiveTerminalIntake.responseClassification}; cleanupStatus=${interactiveTerminalIntake.cleanupStatus}; ${interactiveTerminalIntake.configWriteStatus}; nextAction=${interactiveTerminalIntake.nextAction}`,
    },
    phase607Ledger: {
      title: "Phase607R-Fix Evidence Ledger",
      copy: `ledger=${interactiveTerminalIntake.ledgerJson}; phase604FirstAttemptImported=${interactiveTerminalIntake.phase604FirstAttemptImported}; phase605RootCauseImported=${interactiveTerminalIntake.phase605RootCauseImported}; manualCommandPackReferenced=${interactiveTerminalIntake.manualCommandPackReferenced}; codexOneShotExecutedByThisPhase=false; providerCallsMadeByThisPhase=false`,
    },
    phase610rCodexExecResult: {
      title: "Phase610R-Fix Codex Exec Result",
      copy: `status=${codexExecIntake.status}; selectedProviderId=${codexExecIntake.selectedProviderId || "null"}; requestAttemptCount=${codexExecIntake.requestAttemptCount}; retryAttemptCount=${codexExecIntake.retryAttemptCount}; responseClassification=${codexExecIntake.responseClassification}; stderrWarningNonBlocking=${codexExecIntake.stderrWarningNonBlocking}`,
    },
    phase610rBoundary: {
      title: "Phase610R-Fix Boundary",
      copy: `notProductionReady=${codexExecIntake.notProductionReady}; notRepeatedReliabilityProven=${codexExecIntake.notRepeatedReliabilityProven}; noChatIntegration=${codexExecIntake.noChatIntegration}; codexOneShotExecutedByThisPhase=false; providerCallsMadeByThisPhase=false; authJsonRead=false; codexConfigModified=false`,
    },
    phase611rReliabilityDesign: {
      title: "Phase611R-Fix Reliability Design",
      copy: `phase610OneShotPassOnce=${repeatedReliabilityDesign.phase610OneShotPassOnce}; designReady=${repeatedReliabilityDesign.phase611ReliabilityDesignReady}; maxPlannedAttempts=${repeatedReliabilityDesign.maxPlannedAttempts}; executedYet=${repeatedReliabilityDesign.executedYet}; repeatedReliabilityProven=false; productionReadyClaimed=false`,
    },
    phase611rAttemptPlan: {
      title: "Phase611R-Fix Attempt Plan",
      copy: `selectedProviderId=${repeatedReliabilityDesign.selectedProviderId}; maxRequests=1; retryLimit=0; manualOrExplicitExecutionRequired=true; stopOnFailure=true; no /chat integration; not release ready`,
    },
    phase611rGuardedTestDesign: {
      title: "Phase611R-Fix Guarded Test Design",
      copy: `phase610OneShotPassOnce=${repeatedGuardedTestDesign.phase610OneShotPassOnce}; maxPlannedAttempts=${repeatedGuardedTestDesign.maxPlannedAttempts}; maxRequestsTotal=${repeatedGuardedTestDesign.maxRequestsTotal}; codexExecExecutedByThisPhase=false; providerCallsMadeByThisPhase=false`,
    },
    phase611rPhase612Gate: {
      title: "Phase612R-Fix Explicit Confirmation Gate",
      copy: `phase612ExecutionRequiresExplicitConfirmation=${repeatedGuardedTestDesign.phase612ExecutionRequiresExplicitConfirmation}; notProductionReady=${repeatedGuardedTestDesign.notProductionReady}; notReleaseReady=${repeatedGuardedTestDesign.notReleaseReady}; notChatIntegrated=${repeatedGuardedTestDesign.notChatIntegrated}; nextAction=${repeatedGuardedTestDesign.nextAction}`,
    },
    phase612rRepeatedResult: {
      title: "Phase612R-Fix Repeated Result",
      copy: `repeatedTestExecuted=${repeatedGuardedTestResult.repeatedTestExecuted}; selectedProviderId=${repeatedGuardedTestResult.selectedProviderId}; completedAttempts=${repeatedGuardedTestResult.completedAttempts}; totalRequestAttemptCount=${repeatedGuardedTestResult.totalRequestAttemptCount}; repeatedReliabilityClassification=${repeatedGuardedTestResult.repeatedReliabilityClassification}; allAttemptsPassed=${repeatedGuardedTestResult.allAttemptsPassed}`,
    },
    phase612rRepeatedBoundary: {
      title: "Phase612R-Fix Boundary",
      copy: `authJsonRead=false; codexConfigModified=false; projectCodexConfigModified=false; chatModified=false; chatGatewayExecuteModified=false; deploy/release/tag/push/commit=false; productionReadyClaimed=false; releaseReadyClaimed=false`,
    },
    phase613rClosure: {
      title: "Phase613R-Fix Closure",
      copy: `phase612RepeatedPass=${repeatedReliabilityClosure.phase612RepeatedPass}; selectedProviderId=${repeatedReliabilityClosure.selectedProviderId}; completedAttempts=${repeatedReliabilityClosure.completedAttempts}; totalRequestAttemptCount=${repeatedReliabilityClosure.totalRequestAttemptCount}; capabilityBoundary=${repeatedReliabilityClosure.capabilityBoundary}`,
    },
    phase613rNextGate: {
      title: "Phase613R-Fix Next Gate",
      copy: `nextGate=${repeatedReliabilityClosure.nextGate}; notProductionReady=${repeatedReliabilityClosure.notProductionReady}; notReleaseReady=${repeatedReliabilityClosure.notReleaseReady}; notChatIntegrated=${repeatedReliabilityClosure.notChatIntegrated}; notChatGatewayExecuteIntegrated=${repeatedReliabilityClosure.notChatGatewayExecuteIntegrated}`,
    },
    phase614rPreviewGate: {
      title: "Phase614R-Fix Preview Gate",
      copy: `previewOnly=${controlledIntegrationPreviewGate.previewOnly}; routeId=${controlledIntegrationPreviewGate.routeId}; integrationMode=${controlledIntegrationPreviewGate.integrationMode}; runtimeIntegrated=false; chatIntegrated=false; chatGatewayExecuteIntegrated=false`,
    },
    phase614rRouteContract: {
      title: "Phase614R-Fix Route Contract",
      copy: `allowedEntryPoints=${controlledIntegrationPreviewGate.allowedEntryPoints.join(",")}; forbiddenEntryPoints=${controlledIntegrationPreviewGate.forbiddenEntryPoints.join(",")}; maxRequestsDefault=${controlledIntegrationPreviewGate.maxRequestsDefault}; maxRequestsHardLimit=${controlledIntegrationPreviewGate.maxRequestsHardLimit}; retryLimit=0`,
    },
    phase615rApprovalPacket: {
      title: "Phase615R-Fix Approval Packet",
      copy: `approvalPacketReady=${runtimeIntegrationApprovalPacket.approvalPacketReady}; runtimeIntegrationNotExecuted=${runtimeIntegrationApprovalPacket.runtimeIntegrationNotExecuted}; approvalRequired=${runtimeIntegrationApprovalPacket.approvalRequired}; selectedProviderId=${runtimeIntegrationApprovalPacket.selectedProviderId}; productionReadyClaimed=false; releaseReadyClaimed=false`,
    },
    phase615rOperatorChecklist: {
      title: "Phase615R-Fix Operator Checklist",
      copy: `operatorChecklistGenerated=${runtimeIntegrationApprovalPacket.operatorChecklistGenerated}; rollbackPlanGenerated=${runtimeIntegrationApprovalPacket.rollbackPlanGenerated}; emergencyDisablePlanGenerated=${runtimeIntegrationApprovalPacket.emergencyDisablePlanGenerated}; maxRequestsBudgetPolicyGenerated=${runtimeIntegrationApprovalPacket.maxRequestsBudgetPolicyGenerated}; nextPhase=${runtimeIntegrationApprovalPacket.nextPhase}`,
    },
    phase616r620rDryRunCandidate: {
      title: "Phase616R-620R Dry-Run Candidate",
      copy: `dryRunCandidateSealed=${runtimeCandidateDryRunBundle.dryRunCandidateSealed}; candidateMode=${runtimeCandidateDryRunBundle.candidateMode}; selectedProviderId=${runtimeCandidateDryRunBundle.selectedProviderId}; runtimeIntegrationExecuted=${runtimeCandidateDryRunBundle.runtimeIntegrationExecuted}; productionReadyClaimed=false; releaseReadyClaimed=false`,
    },
    phase616r620rRouteContract: {
      title: "Phase616R-620R Route Contract Dry-Run",
      copy: `routeId=${runtimeCandidateDryRunBundle.routeId}; maxRequestsDefault=${runtimeCandidateDryRunBundle.maxRequestsDefault}; maxRequestsHardLimit=${runtimeCandidateDryRunBundle.maxRequestsHardLimit}; retryLimit=${runtimeCandidateDryRunBundle.retryLimit}; /chat=false; /chat-gateway/execute=false; providerRuntimeModified=false; nextPhase=${runtimeCandidateDryRunBundle.nextPhase}`,
    },
    phase621r628rIsolatedCandidate: {
      title: "Phase621R-628R Isolated Runtime Candidate",
      copy: `routeId=${controlledRuntimeCandidatePath.routeId}; dryRunSmokePassed=${controlledRuntimeCandidatePath.dryRunSmokePassed}; guardedIsolatedOneShotPassed=${controlledRuntimeCandidatePath.guardedIsolatedOneShotPassed}; runtimeIntegrated=false; /chat=false; /chat-gateway/execute=false`,
    },
    phase621r628rReliability: {
      title: "Phase621R-628R Guarded Reliability",
      copy: `classification=${controlledRuntimeCandidatePath.repeatedReliabilityClassification}; completedAttempts=${controlledRuntimeCandidatePath.completedAttempts}; totalRequestAttemptCount=${controlledRuntimeCandidatePath.totalRequestAttemptCount}; totalRetryAttemptCount=${controlledRuntimeCandidatePath.totalRetryAttemptCount}; providerCallsMadeByThisPhase=false; codexExecExecutedByThisPhase=false`,
    },
    phase629rFinalApproval: {
      title: "Phase629R-Fix Final Human Approval Packet",
      copy: `phase621r628rImported=${mainChainFinalApprovalPacket.phase621r628rImported}; approvalPacketReady=${mainChainFinalApprovalPacket.approvalPacketReady}; selectedProviderId=${mainChainFinalApprovalPacket.selectedProviderId}; mainChainIntegrationNotExecuted=${mainChainFinalApprovalPacket.mainChainIntegrationNotExecuted}; finalHumanApprovalRequired=${mainChainFinalApprovalPacket.finalHumanApprovalRequired}`,
    },
    phase629rGoNoGo: {
      title: "Phase629R-Fix Final Go/No-Go",
      copy: `chatModified=${mainChainFinalApprovalPacket.chatModified}; chatGatewayExecuteModified=${mainChainFinalApprovalPacket.chatGatewayExecuteModified}; providerRuntimeModified=${mainChainFinalApprovalPacket.providerRuntimeModified}; codexExecExecutedByThisPhase=${mainChainFinalApprovalPacket.codexExecExecutedByThisPhase}; providerCallsMadeByThisPhase=${mainChainFinalApprovalPacket.providerCallsMadeByThisPhase}; nextPhase=${mainChainFinalApprovalPacket.nextPhase}`,
    },
    phase630rDesignPatch: {
      title: "Phase630R-Fix Design Patch",
      copy: `phase629rImported=${mainChainDesignPatch.phase629rImported}; designPatchReady=${mainChainDesignPatch.designPatchReady}; patchPreviewOnly=${mainChainDesignPatch.patchPreviewOnly}; mainChainPatchNotApplied=${mainChainDesignPatch.mainChainPatchNotApplied}; selectedProviderId=${mainChainDesignPatch.selectedProviderId}; phase631ApprovalRequired=${mainChainDesignPatch.phase631ApprovalRequired}`,
    },
    phase630rRoutePreview: {
      title: "Phase630R-Fix Route Patch Preview",
      copy: `patchId=${mainChainDesignPatch.patchId}; patchMode=${mainChainDesignPatch.patchMode}; targetEntryPointsPreview=${mainChainDesignPatch.targetEntryPointsPreview.join(",")}; targetEntryPointsModified=${mainChainDesignPatch.targetEntryPointsModified.join(",") || "none"}; runtimeIntegrated=false; nextPhase=${mainChainDesignPatch.nextPhase}`,
    },
    phase639rP1ApprovalPreview: {
      title: "Phase639R P1 Approval Preview",
      copy: `mainChainApprovalPacketReady=${phase639RP1ApprovalPreview.mainChainApprovalPacketReady}; providerRuntimeApprovalPacketReady=${phase639RP1ApprovalPreview.providerRuntimeApprovalPacketReady}; implementationExecuted=${phase639RP1ApprovalPreview.implementationExecuted}; chatModified=${phase639RP1ApprovalPreview.chatModified}; chatGatewayExecuteModified=${phase639RP1ApprovalPreview.chatGatewayExecuteModified}; providerRuntimeModified=${phase639RP1ApprovalPreview.providerRuntimeModified}; providerCallsMade=${phase639RP1ApprovalPreview.providerCallsMade}; productionReady=${phase639RP1ApprovalPreview.productionReady}; releaseReady=${phase639RP1ApprovalPreview.releaseReady}; nextApprovalRequired=${phase639RP1ApprovalPreview.nextApprovalRequired}`,
    },
    phase639rNightlyFallbackPanel: {
      title: "Phase639R-Nightly Fallback Operator Panel",
      copy: `Task Scheduler status: not registered; blocker: windows_task_scheduler_access_denied; fallback cmd available=${phase639RNightlyFallbackPanel.fallbackCmdAvailable}; fallback ps1 available=${phase639RNightlyFallbackPanel.fallbackPs1Available}; Phase632 preflight required=${phase639RNightlyFallbackPanel.phase632PreflightRequired}; latest evidence path=${phase639RNightlyFallbackPanel.latestEvidencePath}; next action: admin/permissioned registration session or manual fallback launcher; no provider call; no secret access; no /chat modification; no /chat-gateway/execute modification`,
    },
    phase640rNightlyRetryPack: {
      title: "Phase640R-Nightly Permissioned Retry Pack",
      copy: `permissioned retry pack ready=${phase640RNightlyPermissionedRetryPack.permissionedRetryPackReady}; admin checklist ready=${phase640RNightlyPermissionedRetryPack.adminChecklistGenerated}; verify script ready=${phase640RNightlyPermissionedRetryPack.verifyScriptGenerated}; result intake example ready=${phase640RNightlyPermissionedRetryPack.resultInputExampleGenerated}; nightly automation enabled=false; scheduledTaskRegistered=${phase640RNightlyPermissionedRetryPack.scheduledTaskRegistered}; next action: manually run retry script in a permissioned session; no auto elevation; no permission bypass; no Provider call; no /chat or /chat-gateway/execute modification`,
    },
    phase641rNightlyRegistrationIntake: {
      title: "Phase641R-Nightly Registration Result Intake",
      copy: `resultInputExists=${phase641RNightlyRegistrationResultIntake.inputExists}; resultInputValid=${phase641RNightlyRegistrationResultIntake.inputValid}; systemVerificationExecuted=${phase641RNightlyRegistrationResultIntake.systemVerificationExecuted}; scheduledTaskRegistered=${phase641RNightlyRegistrationResultIntake.scheduledTaskRegistered}; nightlyAutomationEnabled=${phase641RNightlyRegistrationResultIntake.nightlyAutomationEnabled}; blocker=${phase641RNightlyRegistrationResultIntake.blocker || "null"}; nextRunTime=${phase641RNightlyRegistrationResultIntake.nextRunTime ?? "null"}; latestEvidencePath=${phase641RNightlyRegistrationResultIntake.latestEvidencePath}`,
    },
    phase640rExternalToolMode: {
      title: "Phase640R External Tool Mode",
      copy: `External Codex Relay Tool; token-saving tool mode; externalToolMode=${phase640RExternalToolMode.externalToolMode}; model_provider=crs controlled repeated_pass=${phase640RExternalToolMode.modelProviderCrsRepeatedPass}; Phase632 preflight mandatory=${phase640RExternalToolMode.tokenSavingPreflightRequired}; notChatIntegrated=${phase640RExternalToolMode.chatIntegrationPlanned === false}; notChatGatewayExecuteIntegrated=${phase640RExternalToolMode.chatGatewayExecuteIntegrationPlanned === false}; notProviderRuntime=${phase640RExternalToolMode.providerRuntimeIntegrationPlanned === false}; notProductionTrafficPath=${phase640RExternalToolMode.notProductionTrafficPath}`,
    },
    phase641r645rExternalToolBundle: {
      title: "Phase641R-645R External Tool Bundle",
      copy: `toolMode=${phase641R645RExternalToolBundle.toolMode}; cliWrapperReady=${phase641R645RExternalToolBundle.cliWrapperReady}; operatorPanelReady=${phase641R645RExternalToolBundle.operatorPanelReady}; nightlySafeRunnerReliabilityChecked=${phase641R645RExternalToolBundle.nightlySafeRunnerReliabilityChecked}; openSourceDryRunToolPackReady=${phase641R645RExternalToolBundle.openSourceDryRunToolPackReady}; tokenSavingBenchmarkRechecked=${phase641R645RExternalToolBundle.tokenSavingBenchmarkRechecked}; notChatIntegrated=${phase641R645RExternalToolBundle.chatIntegrationPlanned === false}; notChatGatewayExecuteIntegrated=${phase641R645RExternalToolBundle.chatGatewayExecuteIntegrationPlanned === false}; notProviderRuntime=${phase641R645RExternalToolBundle.providerRuntimeIntegrationPlanned === false}; providerCallsMade=false; codexExecExecutedByThisBundle=false`,
    },
    phase646r650rExternalToolDashboard: {
      title: "Phase646R-650R Daily Workflow Dashboard",
      copy: `externalToolMode=${phase646R650RExternalToolClosure.externalToolMode}; dailyWorkflowReady=${phase646R650RExternalToolClosure.dailyWorkflowReady}; taskQueueLedgerReady=${phase646R650RExternalToolClosure.taskQueueLedgerReady}; evidenceDashboardReady=${phase646R650RExternalToolClosure.evidenceDashboardReady}; tokenSavingReportReady=${phase646R650RExternalToolClosure.tokenSavingReportReady}; nextUsePlaybookReady=${phase646R650RExternalToolClosure.nextUsePlaybookReady}; notChatIntegrated=${phase646R650RExternalToolClosure.chatIntegrationPlanned === false}; notChatGatewayExecuteIntegrated=${phase646R650RExternalToolClosure.chatGatewayExecuteIntegrationPlanned === false}; notProviderRuntime=${phase646R650RExternalToolClosure.providerRuntimeIntegrationPlanned === false}; productionReady=false; releaseReady=false; providerCallsMade=false; codexExecExecutedByThisBundle=false`,
    },
  };
}

function readPhase607InteractiveTerminalIntakePreview() {
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

  const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase607r/interactive-terminal-execution-intake-result.json");
  if (!existsSync(evidencePath)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, "utf8").replace(/^\uFEFF/, ""));
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
  } catch {
    return fallback;
  }
}

function readPhase610CodexExecResultIntakePreview() {
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

  const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase610r/codex-exec-one-shot-result-intake.json");
  if (!existsSync(evidencePath)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, "utf8").replace(/^\uFEFF/, ""));
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
  } catch {
    return fallback;
  }
}

function readPhase611ReliabilityDesignPreview() {
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

  const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase611r/repeated-custom-model-provider-reliability-design-result.json");
  if (!existsSync(evidencePath)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, "utf8").replace(/^\uFEFF/, ""));
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
  } catch {
    return fallback;
  }
}

function readPhase611RepeatedGuardedTestDesignPreview() {
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

  const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase611r/repeated-guarded-test-design-result.json");
  if (!existsSync(evidencePath)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, "utf8").replace(/^\uFEFF/, ""));
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
  } catch {
    return fallback;
  }
}

function readPhase612RepeatedGuardedReliabilityPreview() {
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

  const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase612r/repeated-guarded-reliability-result.json");
  if (!existsSync(evidencePath)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, "utf8").replace(/^\uFEFF/, ""));
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
  } catch {
    return fallback;
  }
}

function readPhase613RepeatedReliabilityClosurePreview() {
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

  const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase613r/repeated-reliability-result-closure.json");
  if (!existsSync(evidencePath)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, "utf8").replace(/^\uFEFF/, ""));
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
  } catch {
    return fallback;
  }
}

function readPhase614ControlledIntegrationPreviewGate() {
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

  const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase614r/controlled-integration-preview-gate-result.json");
  if (!existsSync(evidencePath)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, "utf8").replace(/^\uFEFF/, ""));
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
  } catch {
    return fallback;
  }
}

function readPhase615RuntimeIntegrationApprovalPacket() {
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

  const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase615r/runtime-integration-approval-packet-result.json");
  if (!existsSync(evidencePath)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, "utf8").replace(/^\uFEFF/, ""));
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
  } catch {
    return fallback;
  }
}

function readPhase616R620RRuntimeCandidateDryRunBundle() {
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

  const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase616r-620r/controlled-runtime-candidate-dry-run-bundle-result.json");
  if (!existsSync(evidencePath)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, "utf8").replace(/^\uFEFF/, ""));
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
  } catch {
    return fallback;
  }
}

function readPhase621R628RControlledRuntimeCandidatePath() {
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

  const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase621r-628r/controlled-runtime-candidate-path-result.json");
  if (!existsSync(evidencePath)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, "utf8").replace(/^\uFEFF/, ""));
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
  } catch {
    return fallback;
  }
}

function readPhase629RMainChainFinalHumanApprovalPacket() {
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

  const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase629r/main-chain-integration-final-human-approval-packet-result.json");
  if (!existsSync(evidencePath)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, "utf8").replace(/^\uFEFF/, ""));
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
  } catch {
    return fallback;
  }
}

function readPhase630RMainChainIntegrationDesignPatch() {
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

  const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase630r/main-chain-integration-design-patch-result.json");
  if (!existsSync(evidencePath)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, "utf8").replace(/^\uFEFF/, ""));
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
  } catch {
    return fallback;
  }
}

function readPhase639RP1ApprovalPreview() {
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

  const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase639r/p1-approval-packet-bundle-result.json");
  if (!existsSync(evidencePath)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, "utf8").replace(/^\uFEFF/, ""));
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
  } catch {
    return fallback;
  }
}

function readPhase639RNightlyFallbackOperatorPanel() {
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

  const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase639r-nightly/nightly-runner-fallback-operator-panel-result.json");
  if (!existsSync(evidencePath)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, "utf8").replace(/^\uFEFF/, ""));
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
  } catch {
    return fallback;
  }
}

function readPhase640RNightlyPermissionedRetryPack() {
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

  const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase640r-nightly/permissioned-scheduler-registration-retry-pack-result.json");
  if (!existsSync(evidencePath)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, "utf8").replace(/^\uFEFF/, ""));
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
  } catch {
    return fallback;
  }
}

function readPhase641RNightlyRegistrationResultIntake() {
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

  const evidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase641r-nightly/registration-result-intake.json");
  if (!existsSync(evidencePath)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, "utf8").replace(/^\uFEFF/, ""));
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
  } catch {
    return fallback;
  }
}

function readPhase640RExternalToolMode() {
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

  const matrixPath = resolve(repoRoot, fallback.capabilityMatrixPath);
  if (!existsSync(matrixPath)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(matrixPath, "utf8").replace(/^\uFEFF/, ""));
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
  } catch {
    return fallback;
  }
}

function readPhase641R645RExternalToolBundle() {
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

  const evidencePath = resolve(repoRoot, fallback.evidencePath);
  if (!existsSync(evidencePath)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, "utf8").replace(/^\uFEFF/, ""));
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
  } catch {
    return fallback;
  }
}

function readPhase646R650RExternalToolClosure() {
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

  const evidencePath = resolve(repoRoot, fallback.evidencePath);
  if (!existsSync(evidencePath)) return fallback;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, "utf8").replace(/^\uFEFF/, ""));
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
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function displaySafePath(value) {
  const text = String(value ?? "");
  if (/yiyi|avatar|character|guided-showcase|companion/i.test(text)) {
    return text.replace(/[^/]+$/g, "[legacy-module-reference-redacted].json");
  }
  return text;
}

function displaySafeText(value) {
  return String(value ?? "")
    .replace(/Yiyi/gi, "[legacy-module-redacted]")
    .replace(/Character/gi, "[legacy-module-redacted]")
    .replace(/Guided Showcase/gi, "[legacy-module-redacted]")
    .replace(/floating avatar/gi, "[legacy-module-redacted]")
    .replace(/avatar/gi, "[legacy-module-redacted]")
    .replace(/companion/gi, "[legacy-module-redacted]");
}


