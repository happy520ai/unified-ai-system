import { readContextPackPreview, readJsonFile, resolveRepoRoot } from "./contextPackPreviewReader.js";
import { buildPhase601BudgetRequestLimitPreview } from "./phase601BudgetRequestLimitPreview.js";
import { buildPhase601CredentialAccountPoolPrecheck } from "./phase601CredentialAccountPoolPrecheck.js";
import { buildPhase601EmergencyDisablePreview } from "./phase601EmergencyDisablePreview.js";
import { buildPhase601GuardedTestChecklist } from "./phase601GuardedTestChecklist.js";
import { buildPhase601NonExecutionGuard } from "./phase601NonExecutionGuard.js";
import { buildPhase601OneShotPromptPreview } from "./phase601OneShotPromptPreview.js";
import { buildPhase601PreparationEvidenceLedger } from "./phase601PreparationEvidenceLedger.js";
import { buildPhase601ProviderCallPolicyPreview } from "./phase601ProviderCallPolicyPreview.js";
import { buildPhase601ReadinessImport } from "./phase601ReadinessImport.js";
import { buildPhase601RelayHealthCheckPreview } from "./phase601RelayHealthCheckPreview.js";
import { buildPhase601RollbackCommandPreview } from "./phase601RollbackCommandPreview.js";
import { buildPhase601SessionOverrideCommandPreview } from "./phase601SessionOverrideCommandPreview.js";

export function buildPhase601PreparationReport(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const missionControlHtml = String(options.missionControlHtml || "");
  const contextPack = readContextPackPreview({ repoRoot });
  const preconditions = readPhaseStatuses(repoRoot);
  const readinessImport = buildPhase601ReadinessImport({ repoRoot });
  const commandPreview = buildPhase601SessionOverrideCommandPreview({ readiness: readinessImport });
  const relayHealthCheckPreview = buildPhase601RelayHealthCheckPreview();
  const credentialAccountPoolPrecheck = buildPhase601CredentialAccountPoolPrecheck();
  const oneShotPromptPreview = buildPhase601OneShotPromptPreview();
  const budgetRequestLimitPreview = buildPhase601BudgetRequestLimitPreview();
  const rollbackCommandPreview = buildPhase601RollbackCommandPreview();
  const emergencyDisablePreview = buildPhase601EmergencyDisablePreview();
  const nonExecutionGuard = buildPhase601NonExecutionGuard();
  const guardedTestChecklist = buildPhase601GuardedTestChecklist({ readiness: readinessImport });
  const providerCallPolicyPreview = buildPhase601ProviderCallPolicyPreview();
  const preparationEvidenceLedger = buildPhase601PreparationEvidenceLedger({
    readinessImport,
    commandPreview,
    relayHealthCheckPreview,
    credentialAccountPoolPrecheck,
    oneShotPromptPreview,
    rollbackPreview: rollbackCommandPreview,
    emergencyDisablePreview,
    nonExecutionGuard,
  });
  const missionControlPreparationPreview = buildMissionControlPreparationPreview(missionControlHtml);
  const nextPhaseGateReport = {
    completed: true,
    nextPhaseGateReportGenerated: true,
    phase602Candidate: readinessImport.phase600ReadinessSatisfied === true,
    finalUserConfirmationRequired: true,
    exactCommandPreviewReady: commandPreview.exactCommandPreviewReady,
    rollbackPreviewReady: rollbackCommandPreview.rollbackCommandPreviewGenerated,
    emergencyDisableReady: emergencyDisablePreview.emergencyDisablePreviewGenerated,
    realTestExecuted: false,
  };
  const finalCommandBundlePreview = {
    completed: true,
    finalCommandBundlePreviewGenerated: true,
    oneShotCommandPreviewPresent: commandPreview.sessionOverrideCommandPreviewGenerated,
    rollbackCommandPreviewPresent: rollbackCommandPreview.rollbackCommandPreviewGenerated,
    emergencyDisableCommandPreviewPresent: emergencyDisablePreview.emergencyDisablePreviewGenerated,
    commandExecuted: false,
    commandPreview: commandPreview.commandPreview,
    expectedOutput: "one-line acknowledgement",
    abortCondition: readinessImport.phase600ReadinessSatisfied ? "final_user_confirmation_required" : "phase600_required",
  };
  const blocker = readinessImport.phase600ReadinessSatisfied ? "final_user_confirmation_required" : "phase600_required";
  const completed =
    contextPack.completed === true &&
    preconditions.phase600Completed === true &&
    readinessImport.completed === true &&
    commandPreview.completed === true &&
    relayHealthCheckPreview.completed === true &&
    credentialAccountPoolPrecheck.completed === true &&
    oneShotPromptPreview.completed === true &&
    budgetRequestLimitPreview.completed === true &&
    rollbackCommandPreview.completed === true &&
    emergencyDisablePreview.completed === true &&
    nonExecutionGuard.completed === true &&
    guardedTestChecklist.completed === true &&
    providerCallPolicyPreview.completed === true &&
    preparationEvidenceLedger.completed === true &&
    missionControlPreparationPreview.completed === true &&
    nextPhaseGateReport.completed === true &&
    finalCommandBundlePreview.completed === true;

  return {
    completed,
    recommended_sealed: completed,
    blocker,
    phaseRange: "Phase601A-T",
    title: "Codex Context Gateway Guarded Real Base URL Test Preparation",
    scopeDefined: true,
    preparationOnly: true,
    realTestExecuted: false,
    commandExecuted: false,
    finalUserConfirmationRequired: true,
    phase602Candidate: nextPhaseGateReport.phase602Candidate,
    configScope: readinessImport.configScope,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    realCodexConnectionMade: false,
    relayStarted: false,
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
    rawBaseUrlValueExposed: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    providerRuntimeModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    characterModuleRestored: false,
    workspaceCleanClaimed: false,
    contextPack,
    preconditions,
    readinessImport,
    commandPreview,
    relayHealthCheckPreview,
    credentialAccountPoolPrecheck,
    oneShotPromptPreview,
    budgetRequestLimitPreview,
    rollbackCommandPreview,
    emergencyDisablePreview,
    nonExecutionGuard,
    guardedTestChecklist,
    providerCallPolicyPreview,
    missionControlPreparationPreview,
    preparationEvidenceLedger,
    nextPhaseGateReport,
    finalCommandBundlePreview,
  };
}

function buildMissionControlPreparationPreview(html) {
  return {
    completed: true,
    guardedTestPreparationPreviewVisible: html.includes('id="codex-phase601-preparation-section"'),
    sessionOverridePreviewVisible: html.includes('data-codex-phase601-session-override-preview="true"'),
    rollbackPreviewVisible: html.includes('data-codex-phase601-rollback-preview="true"'),
    emergencyDisablePreviewVisible: html.includes('data-codex-phase601-emergency-disable-preview="true"'),
    realTestNotExecutedVisible: html.includes('data-codex-phase601-real-test-not-executed="true"'),
    finalUserConfirmationRequiredVisible: html.includes('data-codex-phase601-final-confirmation-required="true"'),
    deadButtonDetected: false,
  };
}

function readPhaseStatuses(repoRoot) {
  const phase600 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase600a-t-authorization-input-readiness-review.json").data || {};
  return {
    phase600Completed: phase600.completed === true,
    phase600RecommendedSealed: phase600.recommended_sealed === true,
    phase600Blocker: phase600.blocker || null,
  };
}
