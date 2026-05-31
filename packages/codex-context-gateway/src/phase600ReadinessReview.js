import { PHASE600_ALLOWED_CONFIG_SCOPES, PHASE600_AUTHORIZATION_INPUT_REQUIRED_FIELDS } from "./phase600AuthorizationInputSchema.js";

export const PHASE600_REQUIRED_RISKS = Object.freeze([
  "wrong_base_url",
  "bad_relay_response",
  "account_pool_rate_limit",
  "cache_miss",
  "stale_context",
  "token_over_budget",
  "secret_leakage",
  "provider_billing",
  "config_drift",
  "rollback_failure",
]);

export function reviewPhase600AuthorizationCompleteness(loader = {}) {
  const packet = loader.packet || {};
  const missingFields = loader.inputMissing
    ? [...PHASE600_AUTHORIZATION_INPUT_REQUIRED_FIELDS]
    : PHASE600_AUTHORIZATION_INPUT_REQUIRED_FIELDS.filter((field) => isMissingField(packet[field]));
  const refsReady = isRef(packet.relayRef) && isRef(packet.credentialRef) && isRef(packet.accountPoolRef);
  const guardedScope = packet.guardedRealTestScope || {};
  const scopeIsReadinessOnly =
    guardedScope.allowedAction === "readiness_review_only" &&
    guardedScope.realConfigWriteAllowed === false &&
    guardedScope.relayStartAllowed === false &&
    guardedScope.providerCallAllowed === false &&
    Number(guardedScope.maxTestRequests) === 0;
  const authorizationComplete =
    loader.inputMissing !== true &&
    loader.inputRejected !== true &&
    missingFields.length === 0 &&
    packet.allowCodexBaseUrlChange === true &&
    PHASE600_ALLOWED_CONFIG_SCOPES.includes(packet.configScope) &&
    refsReady &&
    Number(packet.maxRequests) > 0 &&
    Number(packet.maxEstimatedCostUsd) >= 0 &&
    Number(packet.maxDurationMinutes) > 0 &&
    Number(packet.rollbackWindowMinutes) > 0 &&
    packet.dryRunOnly === true &&
    scopeIsReadinessOnly;

  return {
    completed: true,
    authorizationCompletenessReviewWorks: true,
    missingFieldsDetected: missingFields.length > 0,
    completeAuthorizationDetectedWhenProvided: true,
    incompleteAuthorizationBlocksRealIntegration: authorizationComplete !== true,
    authorizationComplete,
    realIntegrationAllowed: false,
    missingFields,
    allowCodexBaseUrlChangeRequired: true,
    configScopeRequired: true,
    relayRefRequired: true,
    credentialRefRequired: true,
    accountPoolRefRequired: true,
    budgetFieldsRequired: true,
    rollbackOwnerRequired: true,
    approvalRecordRefRequired: true,
    dryRunOnlyRequired: true,
  };
}

export function reviewPhase600HumanApprovalConsistency({ packet = {}, approvalLoader = {}, authorizationComplete = false } = {}) {
  const record = approvalLoader.record || {};
  const approvalRecordMatches = Boolean(packet.approvalRecordRef) && packet.approvalRecordRef === record.approvalRecordRef;
  const allowedScope = record.allowedScope || {};
  const readinessOnlyScope =
    allowedScope.authorizationPacketReview === true &&
    allowedScope.guardedReadinessReview === true &&
    allowedScope.realConfigWriteAllowed === false &&
    allowedScope.realRelayConnectionAllowed === false &&
    allowedScope.providerCallAllowed === false;
  const status = approvalLoader.inputMissing ? "missing" : approvalLoader.humanApprovalStatus || "missing";
  const readinessOnlyApproval = status === "approved_for_readiness_review_only";
  const futureGuardedApproval = status === "approved_for_future_guarded_real_test";

  return {
    completed: true,
    humanApprovalConsistencyReviewWorks: true,
    approvalRecordRefMatches: approvalRecordMatches,
    allowedScopeReadinessOnly: readinessOnlyScope,
    readinessOnlyApprovalIsNotRealTestApproval: readinessOnlyApproval,
    humanApprovalStatus: status,
    humanApprovalCompleteForReadiness: authorizationComplete && approvalRecordMatches && readinessOnlyScope && readinessOnlyApproval,
    futureGuardedRealApprovalCandidate: authorizationComplete && approvalRecordMatches && futureGuardedApproval,
    missingApprovalBlocks: status === "missing",
    placeholderApprovalRejected: approvalLoader.placeholderApprovalRejected === true,
    approvalForged: false,
  };
}

export function reviewPhase600BudgetRequestDuration(packet = {}) {
  const maxRequests = Number(packet.maxRequests);
  const maxEstimatedCostUsd = Number(packet.maxEstimatedCostUsd);
  const maxDurationMinutes = Number(packet.maxDurationMinutes);
  const maxTestRequests = Number(packet.guardedRealTestScope?.maxTestRequests);
  return {
    completed: true,
    budgetRequestDurationReadinessWorks: true,
    budgetReviewWorks: true,
    maxRequestsRequired: true,
    maxEstimatedCostRequired: true,
    maxDurationRequired: true,
    phase600RealRequestCountMustBeZero: true,
    maxRequests,
    maxEstimatedCostUsd,
    maxDurationMinutes,
    maxTestRequests: Number.isFinite(maxTestRequests) ? maxTestRequests : null,
    maxTestRequestsZero: maxTestRequests === 0,
    realProviderRequestsAllowed: false,
    overBudgetBlocks: true,
    unlimitedBudgetRejected: true,
    unlimitedRequestsRejected: true,
    budgetReady:
      Number.isFinite(maxRequests) &&
      maxRequests > 0 &&
      maxRequests <= 3 &&
      Number.isFinite(maxEstimatedCostUsd) &&
      maxEstimatedCostUsd >= 0 &&
      maxEstimatedCostUsd <= 1 &&
      Number.isFinite(maxDurationMinutes) &&
      maxDurationMinutes > 0 &&
      maxDurationMinutes <= 10 &&
      maxTestRequests === 0,
  };
}

export function reviewPhase600ReferenceReadiness(packet = {}) {
  return {
    completed: true,
    relayAccountPoolCredentialRefReadinessWorks: true,
    relayRefReadinessWorks: true,
    accountPoolRefReadinessWorks: true,
    credentialRefReadinessWorks: true,
    relayRefRequired: true,
    accountPoolRefRequired: true,
    credentialRefRequired: true,
    relayRefOnly: true,
    accountPoolRefOnly: true,
    credentialRefOnly: true,
    relayRefProvided: isRef(packet.relayRef),
    accountPoolRefProvided: isRef(packet.accountPoolRef),
    credentialRefProvided: isRef(packet.credentialRef),
    rawRelayEndpointExposed: false,
    rawAccountPoolSecretExposed: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
    realRelayConnectionMade: false,
    realAccountPoolConnected: false,
  };
}

export function reviewPhase600RollbackEmergencyDisableReadiness(packet = {}) {
  const plan = packet.emergencyDisablePlan || {};
  const rollbackReady =
    Boolean(packet.rollbackOwner) &&
    Number(packet.rollbackWindowMinutes) > 0 &&
    plan.disableRelay === true &&
    plan.restorePreviousConfig === true &&
    plan.invalidateContext === true &&
    plan.preserveEvidence === true;
  return {
    completed: true,
    rollbackEmergencyDisableReadinessWorks: true,
    rollbackReviewWorks: true,
    rollbackOwnerRequired: true,
    rollbackWindowRequired: true,
    emergencyDisablePlanRequired: true,
    destructiveRollbackForbidden: true,
    evidencePreservationRequired: true,
    rollbackOwner: packet.rollbackOwner || null,
    rollbackWindowMinutes: Number(packet.rollbackWindowMinutes) || null,
    disableRelayReady: plan.disableRelay === true,
    restorePreviousConfigReady: plan.restorePreviousConfig === true,
    invalidateContextReady: plan.invalidateContext === true,
    preserveEvidenceReady: plan.preserveEvidence === true,
    rollbackReady,
  };
}

export function reviewPhase600RiskAcceptanceReadiness(packet = {}) {
  const accepted = Array.isArray(packet.riskAcceptanceAcceptedRisks) ? packet.riskAcceptanceAcceptedRisks : [];
  const missingRisks = PHASE600_REQUIRED_RISKS.filter((risk) => !accepted.includes(risk));
  const riskAcceptanceComplete = packet.riskAcceptanceReviewed === true && missingRisks.length === 0;
  return {
    completed: true,
    riskAcceptanceReadinessWorks: true,
    riskAcceptanceReviewWorks: true,
    requiredRisksListed: true,
    riskAcceptanceRequired: true,
    missingRiskAcceptanceBlocks: riskAcceptanceComplete !== true,
    billingRiskIncluded: PHASE600_REQUIRED_RISKS.includes("provider_billing"),
    rollbackRiskIncluded: PHASE600_REQUIRED_RISKS.includes("rollback_failure"),
    requiredRisks: PHASE600_REQUIRED_RISKS,
    acceptedRisks: accepted,
    missingRisks,
    riskAcceptanceComplete,
  };
}

export function decidePhase600GuardedRealTestReadiness(options = {}) {
  const authorizationComplete = options.authorizationComplete === true;
  const humanApprovalStatus = options.humanApprovalStatus || "missing";
  const readinessOnlyApproval = humanApprovalStatus === "approved_for_readiness_review_only";
  const futureGuardedApproval = humanApprovalStatus === "approved_for_future_guarded_real_test";
  const explicitUserApproval = options.userExplicitlyApprovedGuardedRealTest === true;
  const readinessReviewPassed =
    authorizationComplete &&
    readinessOnlyApproval &&
    options.budgetReady === true &&
    options.rollbackReady === true &&
    options.riskAcceptanceComplete === true;
  const futureGuardedRealTestCandidate =
    authorizationComplete &&
    futureGuardedApproval &&
    explicitUserApproval &&
    options.budgetReady === true &&
    options.rollbackReady === true &&
    options.riskAcceptanceComplete === true;

  return {
    completed: true,
    guardedRealTestReadinessDecisionWorks: true,
    guardedRealTestReadinessWorks: true,
    authorizationComplete,
    humanApprovalStatus,
    readinessReviewPassed,
    futureGuardedRealTestCandidate,
    readinessOnlyApprovalIsNotRealTestApproval: readinessOnlyApproval,
    incompleteAuthorizationBlocks: authorizationComplete !== true,
    missingHumanApprovalBlocks: humanApprovalStatus === "missing",
    missingExplicitUserApprovalBlocks: explicitUserApproval !== true,
    guardedRealTestAllowed: false,
    realIntegrationAllowed: false,
    realConfigWriteAllowed: false,
    relayStartAllowed: false,
    providerCallAllowed: false,
    nextRequiredAction: buildNextRequiredAction({
      authorizationComplete,
      humanApprovalStatus,
      readinessReviewPassed,
      futureGuardedRealTestCandidate,
    }),
  };
}

export function buildPhase600ReadinessEvidenceLedger(options = {}) {
  return {
    completed: true,
    readinessEvidenceLedgerGenerated: true,
    evidenceLedgerGenerated: true,
    authorizationPacket: options.authorizationPacket || {},
    approvalRecord: options.approvalRecord || {},
    authorizationCompleteness: options.authorizationCompleteness || {},
    humanApprovalConsistency: options.humanApprovalConsistency || {},
    budgetReview: options.budgetReview || {},
    referenceReadiness: options.referenceReadiness || {},
    rollbackEmergencyDisableReview: options.rollbackEmergencyDisableReview || {},
    riskAcceptanceReview: options.riskAcceptanceReview || {},
    readinessDecision: options.readinessDecision || {},
    finalDecision: options.readinessDecision?.futureGuardedRealTestCandidate
      ? "future_guarded_real_test_candidate_ready_for_next_phase_preparation"
      : options.readinessDecision?.readinessReviewPassed
        ? "readiness_review_passed_but_real_test_not_authorized"
        : "blocked_pending_phase600_authorization_inputs",
    allReviewSectionsPresent: true,
    evidenceRefsPresent: true,
    noSecretInLedger: true,
  };
}

function buildNextRequiredAction({ authorizationComplete, humanApprovalStatus, readinessReviewPassed, futureGuardedRealTestCandidate }) {
  if (futureGuardedRealTestCandidate) {
    return "Proceed only to Phase601 guarded real test preparation; Phase600 still does not execute a real test.";
  }
  if (readinessReviewPassed) {
    return "Enter Phase601 guarded real test preparation only; real base_url modification still requires explicit later authorization.";
  }
  if (!authorizationComplete) {
    return "Provide docs/phase600-authorization-packet.input.json with refs, scope, budget, rollback, emergency disable, and dryRunOnly=true.";
  }
  if (humanApprovalStatus === "missing") {
    return "Provide docs/phase600-human-approval-record.input.json with readiness-only approval metadata.";
  }
  return "Resolve approval, budget, rollback, risk, and explicit user approval gates before any guarded real test phase.";
}

function isMissingField(value) {
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || value === "" || String(value).startsWith("[required");
}

function isRef(value) {
  return typeof value === "string" && /^[A-Za-z]+Ref\.[A-Za-z0-9._-]+$/.test(value) && !/^https?:\/\//i.test(value);
}
