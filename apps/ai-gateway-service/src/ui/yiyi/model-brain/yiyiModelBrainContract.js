export const yiyiModelBrainContract = {
  componentId: "yiyi_model_backed_brain",
  phase: "382",
  defaultMode: "dry_run_no_provider_call",
  modelBackedRuntimeEnabled: false,
  directProviderCallAllowed: false,
  requiresModelLibrary: true,
  requiresCredentialRef: true,
  requiresProviderPolicyGate: true,
  requiresQuotaBudgetGate: true,
  requiresOutputSafetyGate: true,
  allowedOutputs: [
    "speechBubble",
    "emotionState",
    "behaviorState",
    "explanation",
    "recommendedPanel",
    "safeSuggestion",
    "blockedReason",
    "evidenceReference",
    "nextStepHint",
    "confidence",
    "dryRunOnly",
    "modelUsedRef",
    "reasoningSummary",
  ],
  forbiddenOutputs: [
    "executeAction",
    "deploy",
    "release",
    "createTag",
    "uploadArtifact",
    "readSecret",
    "showApiKey",
    "callProviderDirectly",
    "bypassCredentialRef",
    "bypassBudget",
    "modifyEvidence",
    "deleteEvidence",
    "forgeApproval",
    "generateInvoice",
    "exposeHiddenSystemPrompt",
    "medicalDiagnosis",
    "therapyClaim",
    "sensitiveAttributeInference",
  ],
};

export const yiyiModelBrainSafety = {
  modelBackedRuntimeEnabled: false,
  modelBackedDryRun: true,
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  directProviderCallAllowed: false,
  rawSecretAccessed: false,
  secretValueExposed: false,
  actionExecuted: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  evidenceModified: false,
  approvalForged: false,
  billingExecuted: false,
  invoiceGenerated: false,
  productionGaClaimed: false,
  dangerousActionButtonDetected: false,
  workspaceCleanClaimed: false,
  noHiddenSystemPromptLeakage: true,
  noMedicalClaim: true,
  noTherapyClaim: true,
  noSensitiveHealthInference: true,
};

export function createYiyiModelBrainReadiness(overrides = {}) {
  return {
    brainMode: "model_backed_dry_run",
    selectedBrainRoute: "model_backed_dry_run_then_safety_gate",
    modelLibraryRequired: true,
    credentialRefRequired: true,
    providerPolicyGateRequired: true,
    quotaBudgetGateRequired: true,
    outputSafetyGateActive: true,
    providerTestMode: "guarded_provider_test_blocked",
    fallbackBrainMode: "dry_run_mock",
    fallbackReason: "real_provider_test_requires_explicit_phase382_authorization",
    ...yiyiModelBrainSafety,
    ...overrides,
  };
}

export function validateYiyiModelBrainContract(contract = yiyiModelBrainContract) {
  const errors = [];
  if (contract.defaultMode !== "dry_run_no_provider_call") errors.push("defaultMode_must_be_dry_run");
  if (contract.modelBackedRuntimeEnabled !== false) errors.push("runtime_must_be_disabled_by_default");
  if (contract.directProviderCallAllowed !== false) errors.push("direct_provider_call_must_be_false");
  for (const required of ["requiresModelLibrary", "requiresCredentialRef", "requiresProviderPolicyGate", "requiresQuotaBudgetGate", "requiresOutputSafetyGate"]) {
    if (contract[required] !== true) errors.push(`${required}_missing`);
  }
  for (const forbidden of ["executeAction", "readSecret", "callProviderDirectly", "deploy", "modifyEvidence", "forgeApproval", "generateInvoice"]) {
    if (!contract.forbiddenOutputs.includes(forbidden)) errors.push(`missing_forbidden_${forbidden}`);
  }
  return { valid: errors.length === 0, errors };
}
