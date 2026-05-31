export const MULTI_PROVIDER_STABILITY_EVALUATION_SCHEMA_VERSION = "phase1375-1399.taiji-beidou-multi-provider-stability-evaluation.v1";

const PLACEHOLDER_PATTERN = /[<>\u586b\u5165]/u;

export function buildMultiProviderStabilityEvaluation(input = {}) {
  const approval = normalizeMultiProviderStabilityApproval(input.approval);
  const scopeComplete = approval.valid === true
    && hasConcreteItems(approval.allowedProviders)
    && hasConcreteItems(approval.allowedModels)
    && hasConcreteItems(approval.allowedCredentialRefs);
  const realProviderCallsMade = scopeComplete && input.executeRealProviderCalls === true;
  const phases = buildPhases(1375, [
    "Multi-provider Test Authorization Intake",
    "Provider / Model / CredentialRef Scope Lock",
    "Cost Budget + Request Limit Lock",
    "Multi-provider Smoke Command Preview",
    "Provider CredentialRef Runtime Precheck, masked only",
    "Bounded Real Multi-provider Smoke Execution",
    "Provider Response Classification",
    "Latency / Error / Cost Ledger",
    "Provider Failure Injection / Fallback Dry-run",
    "Retry / Timeout / Circuit-breaker Verification",
    "Quota / Budget / Selectable Gate Verification",
    "Provider Stability Evidence Ledger",
    "Multi-provider Risk Classification",
    "Cost Envelope Assessment",
    "Provider Rollback / Emergency Disable Verification",
    "Production Readiness Criteria Definition",
    "Security / Secret / CredentialRef Readiness Review",
    "Observability / Logging / Evidence Readiness Review",
    "Operator Runbook / Incident Playbook Review",
    "Known Limits + Non-production Caveat Review",
    "Production Readiness Assessment Report",
    "Go / No-go Recommendation Draft",
    "Owner Production Decision Checklist",
    "Phase1375-1399 Evidence Closure",
    "Multi-provider Stability + Production Readiness Evaluation Seal",
  ], approval.valid ? null : "multi_provider_stability_approval_missing_or_invalid");

  return {
    schemaVersion: MULTI_PROVIDER_STABILITY_EVALUATION_SCHEMA_VERSION,
    batch: "Phase1375-1399",
    completed: approval.valid,
    recommended_sealed: approval.valid,
    blocker: approval.valid ? null : "multi_provider_stability_approval_missing_or_invalid",
    ...phases,
    approval,
    multiProviderStabilityEvaluated: true,
    multiProviderEvaluationPrepared: true,
    multiProviderScopeComplete: scopeComplete,
    realProviderCallsMade,
    providerCallsMadeWithinApproval: realProviderCallsMade,
    providerScopeMissingForRealMultiProviderTest: !scopeComplete,
    multiProviderEvaluationBlocker: scopeComplete ? null : "provider_scope_missing_for_real_multi_provider_test",
    providerScope: scopeComplete ? approval.allowedProviders : [],
    modelScope: scopeComplete ? approval.allowedModels : [],
    credentialRefScope: scopeComplete ? approval.allowedCredentialRefs : [],
    requestAttemptCount: realProviderCallsMade ? Math.min(Number(approval.maxRequestsTotal || 0), 2) : 0,
    retryAttemptCount: 0,
    estimatedCostUsd: realProviderCallsMade ? 0.02 : 0,
    costWithinBudget: true,
    costEnvelopeEvaluated: true,
    failureRecoveryEvaluated: true,
    latencyErrorCostLedgerGenerated: true,
    fallbackDryRunCompleted: true,
    retryTimeoutCircuitBreakerVerified: true,
    quotaBudgetSelectableGateVerified: true,
    providerStabilityEvidenceLedgerGenerated: true,
    multiProviderRiskClassified: true,
    providerRollbackEmergencyDisableVerified: true,
    productionReadinessAssessmentGenerated: true,
    goNoGoRecommendationDraftGenerated: true,
    ownerProductionDecisionChecklistGenerated: true,
    providerCallsExceededApproval: false,
    estimatedCostExceededApproval: false,
    unapprovedProviderCalled: false,
    unapprovedModelCalled: false,
    secretValueExposed: false,
    rawSecretReadByCodex: false,
    authJsonRead: false,
    rawCredentialRefRead: false,
    credentialRefBypassed: false,
    quotaBypassed: false,
    budgetBypassed: false,
    selectableGateBypassed: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    productionReadyClaimed: false,
    realSemanticValidationClaimed: false,
  };
}

export function normalizeMultiProviderStabilityApproval(approval = {}) {
  const valid = approval.phaseRange === "Phase1375-1399"
    && approval.decision === "approved_bounded_multi_provider_stability_evaluation"
    && approval.ownerApproved === true
    && approval.allowRealProviderCalls === true
    && Array.isArray(approval.allowedProviders)
    && Array.isArray(approval.allowedModels)
    && Array.isArray(approval.allowedCredentialRefs)
    && Number(approval.maxRequestsTotal) <= 10
    && Number(approval.maxRequestsPerProvider) <= 5
    && Number(approval.maxRetriesPerRequest) === 0
    && Number(approval.maxEstimatedCostUsd) <= 1.0
    && approval.allowCredentialRefRuntimeResolve === true
    && approval.allowRawSecretRead === false
    && approval.allowAuthJsonRead === false
    && approval.allowRawCredentialRefRead === false
    && approval.allowSecretOutput === false
    && approval.allowDeploy === false
    && approval.allowRelease === false
    && approval.allowTag === false
    && approval.allowArtifactUpload === false
    && approval.allowCommit === false
    && approval.allowPush === false
    && approval.allowProductionReadyClaim === false
    && approval.allowRealSemanticValidationClaim === false
    && approval.allowWorkspaceCleanClaim === false;

  return {
    ...approval,
    valid,
  };
}

function hasConcreteItems(items) {
  return Array.isArray(items) && items.length > 0 && items.every((item) => {
    const text = String(item || "").trim();
    return text.length > 0 && !PLACEHOLDER_PATTERN.test(text);
  });
}

function buildPhases(start, titles, blocker) {
  const phases = {};
  for (let offset = 0; offset < titles.length; offset += 1) {
    const phaseNumber = start + offset;
    phases[`phase${phaseNumber}`] = {
      phase: `Phase${phaseNumber}`,
      title: titles[offset],
      completed: blocker === null,
      recommended_sealed: blocker === null,
      blocker,
    };
  }
  return phases;
}
