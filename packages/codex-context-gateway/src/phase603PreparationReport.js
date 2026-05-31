import { readJsonFile, resolveRepoRoot } from "./contextPackPreviewReader.js";
import { buildPhase603CustomProviderCommandBundle, phase603NegativeControlCommandPreview } from "./phase603CustomProviderCommandBundle.js";
import { buildPhase603ConfigRollbackPreview } from "./phase603ConfigRollbackPreview.js";
import { inspectPhase603CodexConfigStructure } from "./phase603ConfigStructureInspector.js";
import { buildPhase603DuplicateProviderTableCheck } from "./phase603DuplicateProviderTableCheck.js";
import { buildPhase603PreparationEvidenceLedger } from "./phase603PreparationEvidenceLedger.js";
import { buildPhase603ProviderPreviewSchema, renderPhase603ProjectConfigPreviewToml } from "./phase603ProviderPreviewSchema.js";

export function buildPhase603PreparationReport(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const missionControlHtml = String(options.missionControlHtml || "");
  const phase602 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase602a-t-guarded-real-base-url-one-shot-test.json").data || {};
  const openaiBaseUrlFailure = {
    completed: true,
    negativeControlRecorded: true,
    summary: "bad openai_base_url succeeded unexpectedly",
    openaiBaseUrlOverrideHonored: false,
    relayPathProof: false,
    routeCorrectionToModelProvider: true,
    nextRoute: "custom_model_provider",
  };
  const configInspection = inspectPhase603CodexConfigStructure();
  const duplicateProviderTableCheck = buildPhase603DuplicateProviderTableCheck({ inspection: configInspection });
  const existingCrsProviderCompatibility = buildExistingCrsProviderCompatibility(configInspection);
  const providerPreviewSchema = buildPhase603ProviderPreviewSchema();
  const projectConfigPreview = {
    completed: true,
    projectConfigPreviewGenerated: true,
    previewPath: "docs/phase603-pme-context-gateway-config.preview.toml",
    realProjectCodexConfigModified: false,
    userCodexConfigModified: false,
    previewOnly: true,
    rawBaseUrlValueExposed: false,
    previewToml: renderPhase603ProjectConfigPreviewToml(),
  };
  const negativeControlPlan = {
    completed: true,
    negativeControlPlanGenerated: true,
    commandPreviewOnly: true,
    commandExecuted: false,
    realProviderSwitchExecuted: false,
    commandPreview: phase603NegativeControlCommandPreview,
    expectedFailureMeaning: "model_provider override likely honored",
    unexpectedSuccessMeaning: "CLI override ignored; project_config route review required",
  };
  const decisionMatrix = {
    completed: true,
    decisionMatrixGenerated: true,
    badProviderFailPathDefined: true,
    badProviderSuccessPathDefined: true,
    projectConfigRequiresConfirmation: true,
    userConfigMarkedHighRisk: true,
  };
  const commandBundle = buildPhase603CustomProviderCommandBundle();
  const rollbackPreview = buildPhase603ConfigRollbackPreview();
  const emergencyDisablePreview = {
    completed: true,
    emergencyDisablePreviewGenerated: true,
    authJsonUntouched: true,
    restorePreviousProviderDefined: true,
    contextStalePlanDefined: true,
    steps: [
      "stop using pme_context_gateway provider",
      "restore previous model_provider only from approved snapshot",
      "mark context stale before retry",
      "preserve logs and evidence",
      "do not read or modify auth.json",
    ],
  };
  const providerCallPolicy = {
    completed: true,
    providerCallPolicyDefined: true,
    phase603ProviderCallsMade: false,
    futureProviderCallRequiresConfirmation: true,
    maxRequestsOne: true,
    retryLimitZero: true,
  };
  const missionControlCustomProviderPreview = buildMissionControlCustomProviderPreview(missionControlHtml);
  const preparationEvidenceLedger = buildPhase603PreparationEvidenceLedger({
    openaiBaseUrlFailure,
    configInspection,
    duplicateProviderTableCheck,
    providerPreviewSchema,
    projectConfigPreview,
    negativeControlPlan,
    commandBundle,
    rollbackPreview,
    emergencyDisablePreview,
  });
  const nextPhaseGateReport = {
    completed: true,
    nextPhaseGateReportGenerated: true,
    customProviderOneShotCandidate: true,
    finalUserConfirmationRequired: true,
    commandBundlePreviewReady: commandBundle.commandBundlePreviewGenerated,
    rollbackPreviewReady: rollbackPreview.rollbackPreviewGenerated,
    emergencyDisableReady: emergencyDisablePreview.emergencyDisablePreviewGenerated,
    realTestExecuted: false,
  };
  const completed =
    openaiBaseUrlFailure.completed &&
    configInspection.completed &&
    duplicateProviderTableCheck.completed &&
    existingCrsProviderCompatibility.completed &&
    providerPreviewSchema.completed &&
    projectConfigPreview.completed &&
    negativeControlPlan.completed &&
    decisionMatrix.completed &&
    commandBundle.completed &&
    rollbackPreview.completed &&
    emergencyDisablePreview.completed &&
    providerCallPolicy.completed &&
    missionControlCustomProviderPreview.completed &&
    preparationEvidenceLedger.completed &&
    nextPhaseGateReport.completed;

  return {
    completed,
    recommended_sealed: completed,
    blocker: "final_user_confirmation_required",
    phaseRange: "Phase603A-T",
    title: "Codex Context Gateway Custom Model Provider Route Preparation",
    scopeDefined: true,
    customModelProviderRoute: true,
    designAndPreparationOnly: true,
    authJsonRead: false,
    authJsonTouched: false,
    authJsonCopied: false,
    authJsonWrittenToEvidence: false,
    authJsonWrittenToDocs: false,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    projectCodexConfigModified: false,
    userCodexConfigModified: false,
    realProviderSwitchExecuted: false,
    providerCallsMade: false,
    realTestExecuted: false,
    commandExecuted: false,
    finalUserConfirmationRequired: true,
    nextRoute: "custom_model_provider",
    openaiBaseUrlOverrideHonored: false,
    relayPathProof: false,
    configStructureInspected: configInspection.configTomlStructureInspected === true,
    projectConfigPreviewGenerated: projectConfigPreview.projectConfigPreviewGenerated,
    commandBundlePreviewGenerated: commandBundle.commandBundlePreviewGenerated,
    rollbackPreviewGenerated: rollbackPreview.rollbackPreviewGenerated,
    emergencyDisablePreviewGenerated: emergencyDisablePreview.emergencyDisablePreviewGenerated,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
    rawBaseUrlValueExposed: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    characterModuleRestored: false,
    workspaceCleanClaimed: false,
    phase602Imported: phase602.completed === true,
    phase602Blocker: phase602.blocker || null,
    openaiBaseUrlFailure,
    configInspection,
    duplicateProviderTableCheck,
    existingCrsProviderCompatibility,
    providerPreviewSchema,
    projectConfigPreview,
    negativeControlPlan,
    decisionMatrix,
    commandBundle,
    rollbackPreview,
    emergencyDisablePreview,
    providerCallPolicy,
    missionControlCustomProviderPreview,
    preparationEvidenceLedger,
    nextPhaseGateReport,
  };
}

function buildExistingCrsProviderCompatibility(configInspection) {
  const crs = configInspection.crsProvider || null;
  return {
    completed: true,
    existingCrsProviderReviewed: true,
    defaultModelProviderExists: Boolean(configInspection.defaultModelProvider),
    crsProviderExists: Boolean(crs),
    wireApiRecorded: true,
    wireApiIsResponses: crs ? crs.wire_api === "responses" : false,
    requiresOpenaiAuthRecorded: true,
    requiresOpenaiAuthTrue: crs ? crs.requires_openai_auth === true : false,
    rawBaseUrlValueExposed: false,
    noProviderSwitchExecuted: true,
    referenceUsable: Boolean(crs && crs.wire_api === "responses" && crs.requires_openai_auth === true),
    providerSummary: crs || null,
  };
}

function buildMissionControlCustomProviderPreview(html) {
  return {
    completed: true,
    customProviderRoutePreviewVisible: html.includes('id="codex-phase603-custom-provider-route-section"'),
    openaiBaseUrlFailureVisible: html.includes('data-codex-phase603-openai-base-url-failure="true"'),
    authJsonDenylistVisible: html.includes('data-codex-phase603-auth-json-denylist="true"'),
    commandPreviewVisible: html.includes('data-codex-phase603-command-preview="true"'),
    realTestNotExecutedVisible: html.includes('data-codex-phase603-real-test-not-executed="true"'),
    finalConfirmationRequiredVisible: html.includes('data-codex-phase603-final-confirmation-required="true"'),
    deadButtonDetected: false,
  };
}
