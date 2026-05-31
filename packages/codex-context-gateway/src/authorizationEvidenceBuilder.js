import { readContextPackPreview, readJsonFile, resolveRepoRoot, sanitizeText, safeArray } from "./contextPackPreviewReader.js";
import { buildControlledBaseUrlIntegrationDesignReport } from "./baseUrlIntegrationDesign.js";
import { buildAuthorizationEvidenceIntake, buildAuthorizationEvidenceTemplate } from "./authorizationEvidenceIntake.js";
import { validateAuthorizationCompleteness } from "./authorizationCompletenessValidator.js";
import { buildDryRunConfigSimulation } from "./dryRunConfigSimulation.js";
import { buildRedactedConfigPreview } from "./redactedConfigPreviewBuilder.js";
import { buildRelaySimulationPlan } from "./relaySimulationPlan.js";
import { buildAccountPoolSimulation } from "./accountPoolSimulation.js";
import { buildCredentialRefSimulation } from "./credentialRefSimulation.js";
import { buildBaseUrlDryRunPolicy } from "./baseUrlDryRunPolicy.js";
import { buildRollbackSimulation } from "./rollbackSimulation.js";
import { buildEmergencyDisableSimulation } from "./emergencyDisableSimulation.js";
import { buildMissionControlAuthorizationPreview } from "./missionControlAuthorizationPreview.js";

export function buildAuthorizationEvidenceDryRunSimulationReport(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const missionControlHtml = String(options.missionControlHtml || "");
  const contextPack = readContextPackPreview({ repoRoot });
  const baseUrlDesign = buildControlledBaseUrlIntegrationDesignReport({ repoRoot });
  const phaseStatuses = readPhaseStatuses(repoRoot);
  const authorizationIntake = buildAuthorizationEvidenceIntake({ authorization: options.authorization || {} });
  const authorizationValidation = validateAuthorizationCompleteness(authorizationIntake);
  const authorizationTemplate = buildAuthorizationEvidenceTemplate();
  const redactedConfigPreview = buildRedactedConfigPreview({
    previewId: "phase598-redacted-config-preview",
    targetScope: authorizationIntake.providedFields.configScope || "session_override",
    proposedBaseUrlRef: baseUrlDesign.configPreview?.preview?.proposedBaseUrlRef || "relayRef:phase598-dry-run-preview",
    relayRef: baseUrlDesign.configPreview?.preview?.relayRef || "relayRef:phase598-dry-run-preview",
    credentialRef: authorizationIntake.providedFields.credentialRef || "credentialRef:phase598-approved-only",
    authorizationRef: "authorizationRef:phase598-intake-required",
    rollbackPlanRef: "rollbackPlanRef:phase598-dry-run-preview",
  });
  const dryRunConfigSimulation = buildDryRunConfigSimulation({
    simulationId: "phase598-dry-run-config-simulation",
    configScope: authorizationIntake.providedFields.configScope || "session_override",
    proposedBaseUrlRef: redactedConfigPreview.preview.proposedBaseUrlRef,
    relayRef: redactedConfigPreview.preview.relayRef,
    credentialRef: redactedConfigPreview.preview.credentialRef,
    accountPoolRef: "accountPoolRef:phase598-simulated-pool",
    rollbackPlanRef: "rollbackPlanRef:phase598-dry-run-preview",
    redactedConfigPreview,
  });
  const relaySimulationPlan = buildRelaySimulationPlan({ relayRef: redactedConfigPreview.preview.relayRef });
  const accountPoolSimulation = buildAccountPoolSimulation({ accountPoolRef: "accountPoolRef:phase598-simulated-pool" });
  const credentialRefSimulation = buildCredentialRefSimulation({ credentialRef: redactedConfigPreview.preview.credentialRef });
  const baseUrlDryRunPolicy = buildBaseUrlDryRunPolicy();
  const rollbackSimulation = buildRollbackSimulation({
    previousConfigSnapshotRef: baseUrlDesign.rollback?.rollbackPlanRef || "configSnapshotRef:phase597-design-preview",
    rollbackPlanRef: redactedConfigPreview.preview.rollbackPlanRef,
  });
  const emergencyDisableSimulation = buildEmergencyDisableSimulation();
  const missionControlAuthorizationPreview = buildMissionControlAuthorizationPreview({
    authorizationValidation,
    dryRunConfigSimulation,
    missionControlHtml,
  });
  const configSimulationReport = buildConfigSimulationReport({
    authorizationValidation,
    dryRunConfigSimulation,
    redactedConfigPreview,
    relaySimulationPlan,
    accountPoolSimulation,
    credentialRefSimulation,
    baseUrlDryRunPolicy,
    rollbackSimulation,
  });
  const nextAuthorizationPacketStatus = buildNextAuthorizationPacketStatus({
    authorizationValidation,
    configSimulationReport,
    emergencyDisableSimulation,
  });
  const authorizationEvidence = buildAuthorizationEvidenceRecord({
    authorizationValidation,
    dryRunConfigSimulation,
    relaySimulationPlan,
    credentialRefSimulation,
    rollbackSimulation,
    baseUrlDryRunPolicy,
    emergencyDisableSimulation,
  });
  const completed =
    contextPack.completed === true &&
    baseUrlDesign.completed === true &&
    phaseStatuses.phase592RegressionPassed === true &&
    phaseStatuses.phase593RegressionPassed === true &&
    phaseStatuses.phase594RegressionPassed === true &&
    phaseStatuses.phase595RegressionPassed === true &&
    phaseStatuses.phase596RegressionPassed === true &&
    phaseStatuses.phase597RegressionPassed === true &&
    authorizationIntake.completed === true &&
    authorizationValidation.completed === true &&
    authorizationTemplate.completed === true &&
    redactedConfigPreview.completed === true &&
    dryRunConfigSimulation.completed === true &&
    relaySimulationPlan.completed === true &&
    accountPoolSimulation.completed === true &&
    credentialRefSimulation.completed === true &&
    baseUrlDryRunPolicy.completed === true &&
    rollbackSimulation.completed === true &&
    emergencyDisableSimulation.completed === true &&
    missionControlAuthorizationPreview.completed === true &&
    configSimulationReport.completed === true &&
    nextAuthorizationPacketStatus.completed === true &&
    authorizationEvidence.completed === true;

  return {
    completed,
    recommended_sealed: completed,
    blocker: null,
    phaseRange: "Phase598A-T",
    title: "Codex Context Gateway Authorization Evidence Intake + Dry-Run Config Simulation",
    scopeDefined: true,
    authorizationEvidenceIntakeOnly: true,
    dryRunConfigSimulationOnly: true,
    realConfigWriteAllowed: false,
    relayStartAllowed: false,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    realCodexConnectionMade: false,
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    providerRuntimeModified: false,
    workforceRuntimeModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    mainGatewayRuntimeModified: false,
    relayStarted: false,
    characterModuleRestored: false,
    workspaceCleanClaimed: false,
    contextPack,
    baseUrlDesign,
    preconditions: phaseStatuses,
    authorizationIntake,
    authorizationValidation,
    authorizationTemplate,
    dryRunConfigSimulation,
    redactedConfigPreview,
    relaySimulationPlan,
    accountPoolSimulation,
    credentialRefSimulation,
    baseUrlDryRunPolicy,
    rollbackSimulation,
    emergencyDisableSimulation,
    missionControlAuthorizationPreview,
    configSimulationReport,
    nextAuthorizationPacketStatus,
    authorizationEvidence,
    authorizationComplete: authorizationValidation.authorizationComplete,
    realIntegrationAllowed: false,
    dryRunConfigSimulationAllowed: true,
    realIntegrationStatus: authorizationValidation.realIntegrationStatus,
    missingAuthorizationFields: authorizationValidation.missingFields,
    guardedRealTestNotAllowedYet: true,
    phase592RegressionPassed: phaseStatuses.phase592RegressionPassed,
    phase593RegressionPassed: phaseStatuses.phase593RegressionPassed,
    phase594RegressionPassed: phaseStatuses.phase594RegressionPassed,
    phase595RegressionPassed: phaseStatuses.phase595RegressionPassed,
    phase596RegressionPassed: phaseStatuses.phase596RegressionPassed,
    phase597RegressionPassed: phaseStatuses.phase597RegressionPassed,
    phase592RecommendedSealed: phaseStatuses.phase592RecommendedSealed,
    phase593RecommendedSealed: phaseStatuses.phase593RecommendedSealed,
    phase594RecommendedSealed: phaseStatuses.phase594RecommendedSealed,
    phase595RecommendedSealed: phaseStatuses.phase595RecommendedSealed,
    phase596RecommendedSealed: phaseStatuses.phase596RecommendedSealed,
    phase597RecommendedSealed: phaseStatuses.phase597RecommendedSealed,
    phase592BlockerNull: phaseStatuses.phase592BlockerNull,
    phase593BlockerNull: phaseStatuses.phase593BlockerNull,
    phase594BlockerNull: phaseStatuses.phase594BlockerNull,
    phase595BlockerNull: phaseStatuses.phase595BlockerNull,
    phase596BlockerNull: phaseStatuses.phase596BlockerNull,
    phase597BlockerNull: phaseStatuses.phase597BlockerNull,
    evidencePreview: buildAuthorizationEvidencePreview({
      contextPack,
      authorizationValidation,
      dryRunConfigSimulation,
      configSimulationReport,
      nextAuthorizationPacketStatus,
    }),
  };
}

function buildAuthorizationEvidencePreview({ contextPack, authorizationValidation, dryRunConfigSimulation, configSimulationReport, nextAuthorizationPacketStatus }) {
  return {
    contextHash: contextPack.contextHash,
    authorizationComplete: authorizationValidation.authorizationComplete,
    realIntegrationStatus: authorizationValidation.realIntegrationStatus,
    dryRunConfigSimulationAllowed: dryRunConfigSimulation.dryRunConfigSimulationAllowed,
    configScope: dryRunConfigSimulation.configScope,
    missingFields: authorizationValidation.missingFields,
    simulationStatus: configSimulationReport.configSimulationReportGenerated ? configSimulationReport.simulationStatus : "unknown",
    nextRequiredUserAction: nextAuthorizationPacketStatus.nextRequiredUserAction,
  };
}

function buildConfigSimulationReport(options = {}) {
  const missingFields = safeArray(options.authorizationValidation?.missingFields);
  return {
    completed: true,
    configSimulationReportGenerated: true,
    simulatedConfigOnly: true,
    noRealConfigWriteStated: true,
    noBaseUrlChangeStated: true,
    noRelayStartStated: true,
    noProviderCallStated: true,
    noSecretReadStated: true,
    missingAuthorizationFields: missingFields,
    nextRequiredUserAction: missingFields.length
      ? `Provide ${missingFields.join(", ")} before any guarded real test can be reviewed.`
      : "Continue with the dry-run simulation record; real config writes remain blocked in this phase.",
    simulationStatus: "simulated_config_only",
  };
}

function buildNextAuthorizationPacketStatus(options = {}) {
  const missingFields = safeArray(options.authorizationValidation?.missingFields);
  return {
    completed: true,
    authorizationStatusReportGenerated: true,
    authorizationComplete: options.authorizationValidation?.authorizationComplete === true,
    realIntegrationAllowed: false,
    missingFields,
    nextRequiredUserAction: missingFields.length
      ? "Complete the missing authorization fields and resubmit the packet."
      : "Dry-run complete; a later guarded real-test phase would still require explicit user approval.",
    guardedRealTestNotAllowedYet: true,
    realIntegrationStatus: options.authorizationValidation?.realIntegrationStatus || "blocked_pending_specific_authorization",
  };
}

function buildAuthorizationEvidenceRecord(options = {}) {
  return {
    completed: true,
    authorizationEvidenceGenerated: true,
    notes: [
      "Authorization evidence intake is recorded for dry-run simulation only.",
      "Incomplete authorization blocks real integration.",
      "Provider calls, secret reads, relay start, and real config writes remain false.",
    ],
    authorizationCompleteness: options.authorizationValidation?.authorizationComplete === true ? "complete" : "incomplete",
    realIntegrationStatus: options.authorizationValidation?.realIntegrationStatus || "blocked_pending_specific_authorization",
    configSimulationStatus: options.dryRunConfigSimulation?.simulationStatus || "dry_run_preview_only",
    relaySimulationStatus: options.relaySimulationPlan?.simulatedUpstreamOnly === true ? "simulated_only" : "unknown",
    credentialBoundary: options.credentialRefSimulation?.credentialRefOnly === true ? "credentialRef-only" : "unknown",
    rollbackSimulationStatus: options.rollbackSimulation?.rollbackSimulationWorks === true ? "simulated" : "unknown",
    safetyBoundary: {
      providerCallsMade: false,
      rawSecretAccessed: false,
      secretValueExposed: false,
      rawWebhookAccessed: false,
      webhookValueExposed: false,
      codexConfigModified: false,
      codexBaseUrlModified: false,
      realCodexConnectionMade: false,
      relayStarted: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      deployExecuted: false,
      releaseExecuted: false,
      tagCreated: false,
      artifactUploaded: false,
    },
  };
}

function readPhaseStatuses(repoRoot) {
  const phase592 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase592t/codex-context-gateway-closure-result.json").data || {};
  const phase593 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase593t/codex-context-gateway-operator-panel-closure-result.json").data || {};
  const phase594 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase594t/usage-workflow-runner-integration-preview-closure-result.json").data || {};
  const phase595 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase595t/real-usage-trial-closure-result.json").data || {};
  const phase596 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase596a-t-codex-context-repeated-usage-benchmark.json").data || {};
  const phase597 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase597a-t-controlled-base-url-integration-design.json").data || {};
  return {
    phase592Completed: phase592.completed === true,
    phase592RecommendedSealed: phase592.recommended_sealed === true,
    phase592BlockerNull: phase592.blocker === null,
    phase592RegressionPassed: phase592.completed === true && phase592.recommended_sealed === true && phase592.blocker === null,
    phase593Completed: phase593.completed === true,
    phase593RecommendedSealed: phase593.recommended_sealed === true,
    phase593BlockerNull: phase593.blocker === null,
    phase593RegressionPassed: phase593.completed === true && phase593.recommended_sealed === true && phase593.blocker === null,
    phase594Completed: phase594.completed === true,
    phase594RecommendedSealed: phase594.recommended_sealed === true,
    phase594BlockerNull: phase594.blocker === null,
    phase594RegressionPassed: phase594.completed === true && phase594.recommended_sealed === true && phase594.blocker === null,
    phase595Completed: phase595.completed === true,
    phase595RecommendedSealed: phase595.recommended_sealed === true,
    phase595BlockerNull: phase595.blocker === null,
    phase595RegressionPassed: phase595.completed === true && phase595.recommended_sealed === true && phase595.blocker === null,
    phase596RegressionPassed: phase596.completed === true && phase596.recommended_sealed === true && phase596.blocker === null,
    phase596Completed: phase596.completed === true,
    phase596RecommendedSealed: phase596.recommended_sealed === true,
    phase596BlockerNull: phase596.blocker === null,
    phase597RegressionPassed: phase597.completed === true && phase597.recommended_sealed === true && phase597.blocker === null,
    phase597Completed: phase597.completed === true,
    phase597RecommendedSealed: phase597.recommended_sealed === true,
    phase597BlockerNull: phase597.blocker === null,
  };
}
