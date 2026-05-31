import { readContextPackPreview, readJsonFile, resolveRepoRoot, safeArray } from "./contextPackPreviewReader.js";
import { buildAuthorizationEvidenceDryRunSimulationReport } from "./authorizationEvidenceBuilder.js";
import { buildPhase599AuthorizationPacketSchema, buildPhase599AuthorizationPacketTemplate, PHASE599_ALLOWED_CONFIG_SCOPES } from "./phase599AuthorizationPacketSchema.js";
import { loadPhase599AuthorizationPacket } from "./phase599AuthorizationPacketLoader.js";
import { reviewPhase599AuthorizationCompleteness } from "./phase599AuthorizationCompletenessReview.js";
import { buildPhase599HumanApprovalSchema } from "./phase599HumanApprovalSchema.js";
import { reviewPhase599HumanApproval } from "./phase599HumanApprovalReview.js";
import { reviewPhase599RollbackReadiness } from "./phase599RollbackReadinessReview.js";
import { reviewPhase599RiskAcceptance } from "./phase599RiskAcceptanceReview.js";
import { reviewPhase599GuardedRealTestReadiness } from "./phase599GuardedRealTestReadiness.js";
import { buildPhase599AuthorizationEvidenceLedger } from "./phase599AuthorizationEvidenceLedger.js";
import { buildPhase599MissionControlAuthorizationReviewPreview } from "./phase599MissionControlAuthorizationReviewPreview.js";

export function buildPhase599AuthorizationReviewReport(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const missionControlHtml = String(options.missionControlHtml || "");
  const contextPack = readContextPackPreview({ repoRoot });
  const phase598 = buildAuthorizationEvidenceDryRunSimulationReport({ repoRoot, missionControlHtml });
  const phaseStatuses = readPhaseStatuses(repoRoot);
  const schema = buildPhase599AuthorizationPacketSchema();
  const template = buildPhase599AuthorizationPacketTemplate();
  const loader = loadPhase599AuthorizationPacket({ repoRoot, inputPath: options.inputPath });
  const packet = loader.packet || {};
  const completeness = reviewPhase599AuthorizationCompleteness(loader);
  const humanApprovalSchema = buildPhase599HumanApprovalSchema();
  const humanApproval = reviewPhase599HumanApproval({
    packet,
    authorizationComplete: completeness.authorizationComplete,
  });
  const configScopeReview = buildConfigScopeReview(packet);
  const relayAccountPoolReview = buildRelayAccountPoolReview(packet);
  const credentialRefReview = buildCredentialRefReview(packet);
  const budgetReview = buildBudgetReview(packet);
  const rollbackReview = reviewPhase599RollbackReadiness(packet);
  const riskAcceptanceReview = reviewPhase599RiskAcceptance(packet);
  const guardedRealTestReadiness = reviewPhase599GuardedRealTestReadiness({
    authorizationComplete: completeness.authorizationComplete,
    humanApprovalStatus: humanApproval.humanApprovalStatus,
    budgetReady: budgetReview.budgetReady,
    rollbackReady: rollbackReview.rollbackReady,
    riskAcceptanceComplete: riskAcceptanceReview.riskAcceptanceComplete,
    userExplicitlyApprovedGuardedRealTest: packet.userExplicitlyApprovedGuardedRealTest === true,
  });
  const ledger = buildPhase599AuthorizationEvidenceLedger({
    packetCompleteness: completeness,
    humanApprovalStatus: humanApproval.humanApprovalStatus,
    configScopeReview,
    relayRefReview: relayAccountPoolReview,
    credentialRefReview,
    budgetReview,
    rollbackReview,
    riskAcceptanceReview,
    guardedRealTestReadiness,
    guardedRealTestAllowed: guardedRealTestReadiness.guardedRealTestAllowed,
  });
  const missionControlHumanApprovalPreview = buildPhase599MissionControlAuthorizationReviewPreview({
    missionControlHtml,
    authorizationComplete: completeness.authorizationComplete,
    humanApprovalStatus: humanApproval.humanApprovalStatus,
    guardedRealTestAllowed: guardedRealTestReadiness.guardedRealTestAllowed,
    finalDecision: ledger.finalDecision,
  });
  const nextGuardedRealTestReadinessReport = {
    completed: true,
    guardedRealTestAllowed: guardedRealTestReadiness.guardedRealTestAllowed,
    realIntegrationAllowed: guardedRealTestReadiness.guardedRealTestAllowed,
    realConfigWriteAllowed: false,
    relayStartAllowed: false,
    nextRequiredAction: guardedRealTestReadiness.nextRequiredAction,
  };
  const completed =
    contextPack.completed === true &&
    phase598.completed === true &&
    phaseStatuses.phase592RegressionPassed === true &&
    phaseStatuses.phase593RegressionPassed === true &&
    phaseStatuses.phase594RegressionPassed === true &&
    phaseStatuses.phase595RegressionPassed === true &&
    phaseStatuses.phase596RegressionPassed === true &&
    phaseStatuses.phase597RegressionPassed === true &&
    phaseStatuses.phase598RegressionPassed === true &&
    schema.completed === true &&
    template.completed === true &&
    loader.completed === true &&
    completeness.completed === true &&
    humanApprovalSchema.completed === true &&
    humanApproval.completed === true &&
    configScopeReview.completed === true &&
    relayAccountPoolReview.completed === true &&
    credentialRefReview.completed === true &&
    budgetReview.completed === true &&
    rollbackReview.completed === true &&
    riskAcceptanceReview.completed === true &&
    ledger.completed === true &&
    guardedRealTestReadiness.completed === true &&
    missionControlHumanApprovalPreview.completed === true;

  const blocker = completeness.authorizationComplete !== true
    ? "authorization_packet_incomplete"
    : humanApproval.humanApprovalStatus !== "approved"
      ? "human_approval_missing"
      : null;

  return {
    completed,
    recommended_sealed: completed,
    blocker,
    phaseRange: "Phase599A-T",
    title: "Codex Context Gateway Authorization Packet Completion + Human Approval Review",
    scopeDefined: true,
    authorizationPacketReviewOnly: true,
    humanApprovalReviewOnly: true,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    realCodexConnectionMade: false,
    relayStarted: false,
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
    characterModuleRestored: false,
    workspaceCleanClaimed: false,
    realConfigWriteAllowed: false,
    relayStartAllowed: false,
    realIntegrationAllowed: guardedRealTestReadiness.guardedRealTestAllowed === true,
    guardedRealTestAllowed: guardedRealTestReadiness.guardedRealTestAllowed,
    contextPack,
    phase598,
    preconditions: phaseStatuses,
    authorizationPacketSchema: schema,
    authorizationTemplate: template,
    authorizationPacketLoader: loader,
    authorizationCompletenessReview: completeness,
    humanApprovalSchema,
    humanApprovalReview: humanApproval,
    configScopeReview,
    relayAccountPoolReview,
    credentialRefReview,
    budgetReview,
    rollbackEmergencyDisableReview: rollbackReview,
    riskAcceptanceReview,
    authorizationEvidenceLedger: ledger,
    missionControlHumanApprovalPreview,
    guardedRealTestReadiness,
    nextGuardedRealTestReadinessReport,
    authorizationComplete: completeness.authorizationComplete,
    humanApprovalStatus: humanApproval.humanApprovalStatus,
    missingFields: completeness.missingFields,
    finalDecision: ledger.finalDecision,
    evidencePreview: {
      contextHash: contextPack.contextHash,
      authorizationComplete: completeness.authorizationComplete,
      humanApprovalStatus: humanApproval.humanApprovalStatus,
      realIntegrationAllowed: guardedRealTestReadiness.guardedRealTestAllowed,
      guardedRealTestAllowed: guardedRealTestReadiness.guardedRealTestAllowed,
      blocker,
      nextRequiredAction: guardedRealTestReadiness.nextRequiredAction,
    },
  };
}

function buildConfigScopeReview(packet = {}) {
  const scope = packet.configScope || null;
  return {
    completed: true,
    configScopeReviewWorks: true,
    configScopeRequired: true,
    allowedScopes: PHASE599_ALLOWED_CONFIG_SCOPES,
    configScope: scope,
    configScopeValid: PHASE599_ALLOWED_CONFIG_SCOPES.includes(scope),
    userConfigScopeMarkedHighRisk: scope === "user_config_preview" || scope === null,
    sessionOverrideRecommended: true,
    realConfigWriteAllowed: false,
  };
}

function buildRelayAccountPoolReview(packet = {}) {
  return {
    completed: true,
    relayRefReviewWorks: true,
    accountPoolRefReviewWorks: true,
    rawRelayEndpointExposed: false,
    rawAccountPoolSecretExposed: false,
    relayRefRequired: true,
    accountPoolRefRequired: true,
    relayRef: packet.relayRef || null,
    accountPoolRef: packet.accountPoolRef || null,
    relayRefProvided: isRef(packet.relayRef),
    accountPoolRefProvided: isRef(packet.accountPoolRef),
  };
}

function buildCredentialRefReview(packet = {}) {
  return {
    completed: true,
    credentialRefReviewWorks: true,
    credentialRefRequired: true,
    credentialRefOnly: true,
    credentialRef: packet.credentialRef || null,
    credentialRefProvided: isRef(packet.credentialRef),
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
  };
}

function buildBudgetReview(packet = {}) {
  const maxRequests = Number(packet.maxRequests);
  const maxEstimatedCostUsd = Number(packet.maxEstimatedCostUsd);
  const maxDurationMinutes = Number(packet.maxDurationMinutes);
  const budgetReady = maxRequests > 0 && maxRequests <= 10 && maxEstimatedCostUsd >= 0 && maxEstimatedCostUsd <= 10 && maxDurationMinutes > 0 && maxDurationMinutes <= 120;
  return {
    completed: true,
    budgetReviewWorks: true,
    maxRequestsRequired: true,
    maxEstimatedCostRequired: true,
    maxDurationRequired: true,
    overBudgetBlocks: true,
    currentPacketOverBudget: maxEstimatedCostUsd > 10 || maxRequests > 10 || maxDurationMinutes > 120,
    unlimitedBudgetRejected: true,
    unlimitedRequestsRejected: true,
    maxRequests: Number.isFinite(maxRequests) ? maxRequests : null,
    maxEstimatedCostUsd: Number.isFinite(maxEstimatedCostUsd) ? maxEstimatedCostUsd : null,
    maxDurationMinutes: Number.isFinite(maxDurationMinutes) ? maxDurationMinutes : null,
    budgetReady,
  };
}

function isRef(value) {
  return typeof value === "string" && value.includes(":") && !value.startsWith("[required") && !/^https?:\/\//i.test(value);
}

function readPhaseStatuses(repoRoot) {
  const phase592 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase592t/codex-context-gateway-closure-result.json").data || {};
  const phase593 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase593t/codex-context-gateway-operator-panel-closure-result.json").data || {};
  const phase594 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase594t/usage-workflow-runner-integration-preview-closure-result.json").data || {};
  const phase595 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase595t/real-usage-trial-closure-result.json").data || {};
  const phase596 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase596a-t-codex-context-repeated-usage-benchmark.json").data || {};
  const phase597 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase597a-t-controlled-base-url-integration-design.json").data || {};
  const phase598 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase598a-t-authorization-evidence-dry-run-config-simulation.json").data || {};
  return {
    phase592Completed: phase592.completed === true,
    phase592RecommendedSealed: phase592.recommended_sealed === true,
    phase592BlockerNull: phase592.blocker === null,
    phase592RegressionPassed: phasePassed(phase592),
    phase593Completed: phase593.completed === true,
    phase593RecommendedSealed: phase593.recommended_sealed === true,
    phase593BlockerNull: phase593.blocker === null,
    phase593RegressionPassed: phasePassed(phase593),
    phase594Completed: phase594.completed === true,
    phase594RecommendedSealed: phase594.recommended_sealed === true,
    phase594BlockerNull: phase594.blocker === null,
    phase594RegressionPassed: phasePassed(phase594),
    phase595Completed: phase595.completed === true,
    phase595RecommendedSealed: phase595.recommended_sealed === true,
    phase595BlockerNull: phase595.blocker === null,
    phase595RegressionPassed: phasePassed(phase595),
    phase596Completed: phase596.completed === true,
    phase596RecommendedSealed: phase596.recommended_sealed === true,
    phase596BlockerNull: phase596.blocker === null,
    phase596RegressionPassed: phasePassed(phase596),
    phase597Completed: phase597.completed === true,
    phase597RecommendedSealed: phase597.recommended_sealed === true,
    phase597BlockerNull: phase597.blocker === null,
    phase597RegressionPassed: phasePassed(phase597),
    phase598Completed: phase598.completed === true,
    phase598RecommendedSealed: phase598.recommended_sealed === true,
    phase598BlockerNull: phase598.blocker === null,
    phase598RegressionPassed: phase598.completed === true && phase598.recommended_sealed === true && safeArray(phase598.failed).length === 0,
    dryRunConfigSimulationStillBlocked: phase598.realIntegrationAllowed === false,
  };
}

function phasePassed(phase) {
  return phase.completed === true && phase.recommended_sealed === true && phase.blocker === null;
}
