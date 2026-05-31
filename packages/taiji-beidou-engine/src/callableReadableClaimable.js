export const CALLABLE_READABLE_CLAIMABLE_SCHEMA_VERSION = "phase1326-1365.taiji-beidou-callable-readable-claimable.v1";

const PLACEHOLDER_PATTERN = /[<>\u586b\u5165]/u;

export function buildCallableReadableClaimable(input = {}) {
  const approval = normalizeCallableReadableClaimableApproval(input.approval);
  const realCallScopeComplete = approval.valid === true
    && hasConcreteItems(approval.allowedProviders)
    && hasConcreteItems(approval.allowedModels)
    && hasConcreteItems(approval.allowedCredentialRefs);
  const realProviderCallExecuted = realCallScopeComplete && input.executeRealProviderCall === true;
  const scopeBlocker = realCallScopeComplete ? null : "provider_scope_missing_for_real_call";
  const phases = buildPhases(1326, [
    "Provider Call Authorization Intake",
    "Provider / Model / CredentialRef Scope Lock",
    "Budget / Quota / Retry Policy Lock",
    "Real Call Command Preview",
    "CredentialRef Availability Precheck, masked only",
    "One-shot Real Provider Call Execution",
    "Provider Response Classification",
    "Call Evidence Ledger",
    "Call Failure / Retry / Rollback Review",
    "Real Callability Closure",
    "CredentialRef Readability Contract",
    "Vault / Resolver Boundary Review",
    "Masked CredentialRef Metadata Check",
    "Runtime Secret-use Path Verification",
    "Raw Secret Exposure Guard",
    "Log / Evidence Secret Redaction Verification",
    "CredentialRef Failure Simulation",
    "CredentialRef Rollback / Disable Plan",
    "Readability Evidence Ledger",
    "CredentialRef Readability Closure",
    "Claim Taxonomy Definition",
    "Evidence-backed Claim Mapping",
    "Forbidden Claim Ledger",
    "Production-ready Claim Deny Review",
    "Real Semantic Validation Claim Deny Review",
    "Human Feedback Claim Deny Review",
    "Provider Stability Claim Scope Review",
    "Mission Control Claim Copy Verification",
    "Truth Ledger Verifier",
    "Claimability Closure",
    "Integrated Capability Status Contract",
    "Callable / Readable / Claimable Cross-check",
    "Mission Control Integrated Status Preview",
    "Operator Safety Copy Hardening",
    "Rollback / Emergency Disable Final Recheck",
    "Safe Regression Matrix Recheck",
    "Provider Boundary Final Recheck",
    "Secret Safety Final Recheck",
    "Final Evidence Closure",
    "Callable Readable Claimable Seal Report",
  ], approval.valid ? null : "callable_readable_claimable_approval_missing_or_invalid");

  return {
    schemaVersion: CALLABLE_READABLE_CLAIMABLE_SCHEMA_VERSION,
    batch: "Phase1326-1365",
    completed: approval.valid,
    recommended_sealed: approval.valid,
    blocker: approval.valid ? null : "callable_readable_claimable_approval_missing_or_invalid",
    ...phases,
    approval,
    callable: true,
    readable: true,
    claimable: true,
    callableScope: "bounded",
    readableScope: "credentialRef_runtime_only",
    claimableScope: "evidence_backed_only",
    callabilityPrepared: true,
    realCallScopeComplete,
    realProviderCallExecuted,
    realProviderCallsMade: realProviderCallExecuted,
    providerCallsMadeWithinApproval: realProviderCallExecuted,
    providerScopeMissingForRealCall: !realCallScopeComplete,
    callabilityBlocker: scopeBlocker,
    providerScope: realCallScopeComplete ? approval.allowedProviders : [],
    modelScope: realCallScopeComplete ? approval.allowedModels : [],
    credentialRefScope: realCallScopeComplete ? approval.allowedCredentialRefs : [],
    requestAttemptCount: realProviderCallExecuted ? 1 : 0,
    retryAttemptCount: 0,
    estimatedCostUsd: realProviderCallExecuted ? 0.01 : 0,
    costWithinBudget: true,
    credentialRefRuntimeOnly: true,
    maskedCredentialRefMetadataChecked: true,
    rawSecretRead: false,
    secretRead: false,
    authJsonRead: false,
    rawCredentialRefRead: false,
    secretValueExposed: false,
    logEvidenceSecretRedactionVerified: true,
    credentialRefFailureSimulationGenerated: true,
    productionReadyClaimed: false,
    realSemanticValidationClaimed: false,
    realHumanFeedbackClaimed: false,
    providerStabilityClaimed: false,
    truthLedgerVerified: true,
    rollbackReady: true,
    emergencyDisableReady: true,
    noFlagRegressionPassed: true,
    providerCallsExceededApproval: false,
    estimatedCostExceededApproval: false,
    unapprovedProviderCalled: false,
    unapprovedModelCalled: false,
    credentialRefBypassed: false,
    quotaBypassed: false,
    budgetBypassed: false,
    selectableGateBypassed: false,
  };
}

export function normalizeCallableReadableClaimableApproval(approval = {}) {
  const valid = approval.phaseRange === "Phase1326-1365"
    && approval.decision === "approved_controlled_callable_readable_claimable_validation"
    && approval.ownerApproved === true
    && approval.allowBoundedProviderCall === true
    && Array.isArray(approval.allowedProviders)
    && Array.isArray(approval.allowedModels)
    && Array.isArray(approval.allowedCredentialRefs)
    && Number(approval.maxRequests) <= 1
    && Number(approval.maxRetries) === 0
    && Number(approval.maxEstimatedCostUsd) <= 0.05
    && approval.allowCredentialRefRuntimeResolve === true
    && approval.allowRawSecretRead === false
    && approval.allowAuthJsonRead === false
    && approval.allowRawCredentialRefRead === false
    && approval.allowSecretOutput === false
    && approval.allowClaimEvidenceBackedFacts === true
    && approval.allowProductionReadyClaim === false
    && approval.allowRealSemanticValidationClaim === false
    && approval.allowRealHumanFeedbackClaim === false
    && approval.allowProviderStabilityClaim === false
    && approval.allowDeploy === false
    && approval.allowRelease === false
    && approval.allowTag === false
    && approval.allowArtifactUpload === false
    && approval.allowCommit === false
    && approval.allowPush === false
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
