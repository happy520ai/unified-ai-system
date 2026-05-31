import { readContextPackPreview, readJsonFile, resolveRepoRoot, safeArray } from "./contextPackPreviewReader.js";
import {
  buildPhase600AuthorizationInputExample,
  buildPhase600AuthorizationInputSchema,
} from "./phase600AuthorizationInputSchema.js";
import { loadPhase600AuthorizationInput } from "./phase600AuthorizationInputLoader.js";
import {
  buildPhase600HumanApprovalInputExample,
  buildPhase600HumanApprovalInputSchema,
} from "./phase600HumanApprovalInputSchema.js";
import { loadPhase600HumanApprovalRecord } from "./phase600HumanApprovalRecordLoader.js";
import { buildPhase600MissionControlReadinessPreview } from "./phase600MissionControlReadinessPreview.js";
import {
  buildPhase600ReadinessEvidenceLedger,
  decidePhase600GuardedRealTestReadiness,
  reviewPhase600AuthorizationCompleteness,
  reviewPhase600BudgetRequestDuration,
  reviewPhase600HumanApprovalConsistency,
  reviewPhase600ReferenceReadiness,
  reviewPhase600RiskAcceptanceReadiness,
  reviewPhase600RollbackEmergencyDisableReadiness,
} from "./phase600ReadinessReview.js";

export function buildPhase600ReadinessReviewReport(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const missionControlHtml = String(options.missionControlHtml || "");
  const contextPack = readContextPackPreview({ repoRoot });
  const phaseStatuses = readPhaseStatuses(repoRoot);
  const authorizationPacketInputSchema = buildPhase600AuthorizationInputSchema();
  const humanApprovalRecordInputSchema = buildPhase600HumanApprovalInputSchema();
  const authorizationPacketInputExample = buildPhase600AuthorizationInputExample();
  const humanApprovalRecordInputExample = buildPhase600HumanApprovalInputExample();
  const authorizationPacketInputLoader = loadPhase600AuthorizationInput({ repoRoot, inputPath: options.authorizationInputPath });
  const humanApprovalRecordLoader = loadPhase600HumanApprovalRecord({ repoRoot, inputPath: options.humanApprovalInputPath });
  const packet = authorizationPacketInputLoader.packet || {};
  const authorizationCompletenessReview = reviewPhase600AuthorizationCompleteness(authorizationPacketInputLoader);
  const humanApprovalConsistencyReview = reviewPhase600HumanApprovalConsistency({
    packet,
    approvalLoader: humanApprovalRecordLoader,
    authorizationComplete: authorizationCompletenessReview.authorizationComplete,
  });
  const budgetRequestDurationReadiness = reviewPhase600BudgetRequestDuration(packet);
  const relayAccountPoolCredentialRefReadiness = reviewPhase600ReferenceReadiness(packet);
  const rollbackEmergencyDisableReadiness = reviewPhase600RollbackEmergencyDisableReadiness(packet);
  const riskAcceptanceReadiness = reviewPhase600RiskAcceptanceReadiness(packet);
  const guardedRealTestReadinessDecision = decidePhase600GuardedRealTestReadiness({
    authorizationComplete: authorizationCompletenessReview.authorizationComplete,
    humanApprovalStatus: humanApprovalConsistencyReview.humanApprovalStatus,
    budgetReady: budgetRequestDurationReadiness.budgetReady,
    rollbackReady: rollbackEmergencyDisableReadiness.rollbackReady,
    riskAcceptanceComplete: riskAcceptanceReadiness.riskAcceptanceComplete,
    userExplicitlyApprovedGuardedRealTest: packet.userExplicitlyApprovedGuardedRealTest === true,
  });
  const readinessEvidenceLedger = buildPhase600ReadinessEvidenceLedger({
    authorizationPacket: { inputMissing: authorizationPacketInputLoader.inputMissing, inputPath: authorizationPacketInputLoader.inputPath },
    approvalRecord: { inputMissing: humanApprovalRecordLoader.inputMissing, inputPath: humanApprovalRecordLoader.inputPath },
    authorizationCompleteness: authorizationCompletenessReview,
    humanApprovalConsistency: humanApprovalConsistencyReview,
    budgetReview: budgetRequestDurationReadiness,
    referenceReadiness: relayAccountPoolCredentialRefReadiness,
    rollbackEmergencyDisableReview: rollbackEmergencyDisableReadiness,
    riskAcceptanceReview: riskAcceptanceReadiness,
    readinessDecision: guardedRealTestReadinessDecision,
  });
  const missionControlReadinessPreview = buildPhase600MissionControlReadinessPreview({ missionControlHtml });
  const blocker = buildBlocker({
    authorizationPacketInputLoader,
    authorizationCompletenessReview,
    humanApprovalRecordLoader,
    guardedRealTestReadinessDecision,
  });
  const completed =
    contextPack.completed === true &&
    phaseStatuses.phase592RegressionPassed === true &&
    phaseStatuses.phase593RegressionPassed === true &&
    phaseStatuses.phase594RegressionPassed === true &&
    phaseStatuses.phase595RegressionPassed === true &&
    phaseStatuses.phase596RegressionPassed === true &&
    phaseStatuses.phase597RegressionPassed === true &&
    phaseStatuses.phase598RegressionPassed === true &&
    phaseStatuses.phase599RegressionPassed === true &&
    authorizationPacketInputSchema.completed === true &&
    humanApprovalRecordInputSchema.completed === true &&
    authorizationPacketInputExample.completed === true &&
    humanApprovalRecordInputExample.completed === true &&
    authorizationPacketInputLoader.completed === true &&
    humanApprovalRecordLoader.completed === true &&
    authorizationCompletenessReview.completed === true &&
    humanApprovalConsistencyReview.completed === true &&
    budgetRequestDurationReadiness.completed === true &&
    relayAccountPoolCredentialRefReadiness.completed === true &&
    rollbackEmergencyDisableReadiness.completed === true &&
    riskAcceptanceReadiness.completed === true &&
    guardedRealTestReadinessDecision.completed === true &&
    readinessEvidenceLedger.completed === true &&
    missionControlReadinessPreview.completed === true;

  return {
    completed,
    recommended_sealed: completed,
    blocker,
    phaseRange: "Phase600A-T",
    title: "Codex Context Gateway Authorization Packet Input + Human Approval Record + Guarded Real Test Readiness Review",
    scopeDefined: true,
    authorizationInputReadinessReviewOnly: true,
    humanApprovalRecordReviewOnly: true,
    guardedRealTestReadinessReviewOnly: true,
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
    realIntegrationAllowed: false,
    guardedRealTestAllowed: false,
    futureGuardedRealTestCandidate: guardedRealTestReadinessDecision.futureGuardedRealTestCandidate,
    readinessReviewPassed: guardedRealTestReadinessDecision.readinessReviewPassed,
    authorizationComplete: authorizationCompletenessReview.authorizationComplete,
    humanApprovalStatus: humanApprovalConsistencyReview.humanApprovalStatus,
    missingFields: authorizationCompletenessReview.missingFields,
    nextAction: guardedRealTestReadinessDecision.nextRequiredAction,
    finalDecision: readinessEvidenceLedger.finalDecision,
    contextPack,
    preconditions: phaseStatuses,
    authorizationPacketInputSchema,
    humanApprovalRecordInputSchema,
    authorizationPacketInputExample,
    humanApprovalRecordInputExample,
    authorizationPacketInputLoader,
    humanApprovalRecordLoader,
    authorizationCompletenessReview,
    humanApprovalConsistencyReview,
    budgetRequestDurationReadiness,
    relayAccountPoolCredentialRefReadiness,
    rollbackEmergencyDisableReadiness,
    riskAcceptanceReadiness,
    guardedRealTestReadinessDecision,
    readinessEvidenceLedger,
    missionControlReadinessPreview,
    nextPhaseGateReport: {
      completed: true,
      next:
        blocker === "guarded_real_test_not_authorized_yet"
          ? "Phase601 guarded real test preparation, still no real execution"
          : blocker === null
            ? "Phase601 guarded real test preparation candidate; Phase600 still executed no real test"
            : "complete Phase600 authorization packet and human approval inputs first",
      realIntegrationAllowed: false,
      guardedRealTestAllowed: false,
      blocker,
    },
    evidencePreview: {
      contextHash: contextPack.contextHash,
      authorizationComplete: authorizationCompletenessReview.authorizationComplete,
      humanApprovalStatus: humanApprovalConsistencyReview.humanApprovalStatus,
      readinessReviewPassed: guardedRealTestReadinessDecision.readinessReviewPassed,
      realIntegrationAllowed: false,
      guardedRealTestAllowed: false,
      futureGuardedRealTestCandidate: guardedRealTestReadinessDecision.futureGuardedRealTestCandidate,
      blocker,
      nextAction: guardedRealTestReadinessDecision.nextRequiredAction,
    },
  };
}

function buildBlocker({ authorizationPacketInputLoader, authorizationCompletenessReview, humanApprovalRecordLoader, guardedRealTestReadinessDecision }) {
  if (authorizationPacketInputLoader.inputMissing === true) return "authorization_packet_input_missing";
  if (authorizationCompletenessReview.authorizationComplete !== true) return "authorization_packet_input_incomplete";
  if (humanApprovalRecordLoader.inputMissing === true) return "human_approval_missing";
  if (guardedRealTestReadinessDecision.futureGuardedRealTestCandidate === true) return null;
  return "guarded_real_test_not_authorized_yet";
}

function readPhaseStatuses(repoRoot) {
  const phase592 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase592t/codex-context-gateway-closure-result.json").data || {};
  const phase593 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase593t/codex-context-gateway-operator-panel-closure-result.json").data || {};
  const phase594 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase594t/usage-workflow-runner-integration-preview-closure-result.json").data || {};
  const phase595 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase595t/real-usage-trial-closure-result.json").data || {};
  const phase596 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase596a-t-codex-context-repeated-usage-benchmark.json").data || {};
  const phase597 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase597a-t-controlled-base-url-integration-design.json").data || {};
  const phase598 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase598a-t-authorization-evidence-dry-run-config-simulation.json").data || {};
  const phase599 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase599a-t-authorization-packet-human-approval-review.json").data || {};
  return {
    phase592RegressionPassed: phasePassedStrict(phase592),
    phase593RegressionPassed: phasePassedStrict(phase593),
    phase594RegressionPassed: phasePassedStrict(phase594),
    phase595RegressionPassed: phasePassedStrict(phase595),
    phase596RegressionPassed: phasePassedStrict(phase596),
    phase597RegressionPassed: phasePassedStrict(phase597),
    phase598RegressionPassed: phase598.completed === true && phase598.recommended_sealed === true && safeArray(phase598.failed).length === 0,
    phase599RegressionPassed:
      phase599.completed === true &&
      phase599.recommended_sealed === true &&
      ["authorization_packet_incomplete", "human_approval_missing", null].includes(phase599.blocker),
    phase599Blocker: phase599.blocker ?? null,
  };
}

function phasePassedStrict(phase) {
  return phase.completed === true && phase.recommended_sealed === true && phase.blocker === null;
}
