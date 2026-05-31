const safetyFalseKeys = [
  "providerCallsAllowed",
  "secretReadAllowed",
  "deployAllowed",
  "chatMutationAllowed",
  "chatGatewayExecuteMutationAllowed",
  "codexConfigMutationAllowed",
  "selfApprovalAllowed",
];

export function reviewRuntimeEligibility(input = {}) {
  const manifests = input.manifests || [];
  const artifactsById = input.artifactsById || {};
  return manifests.map((manifest) => reviewCapabilityRuntimeEligibility(manifest, artifactsById[manifest.capabilityId] || {}));
}

export function reviewCapabilityRuntimeEligibility(manifest, artifacts = {}) {
  const failures = [];
  if (!manifest?.capabilityId) failures.push("manifest_missing");
  if (artifacts.verifierResult?.passed !== true) failures.push("verifier_result_not_passed");
  if (!artifacts.rollbackPlan?.disableFlag) failures.push("rollback_plan_missing");
  if (artifacts.dryRunResult?.status !== "passed") failures.push("dry_run_result_not_passed");
  if (manifest?.runtime?.enabledByDefault !== false) failures.push("runtime_enabled_by_default_not_false");
  if (manifest?.runtime?.maxSpawnDepth !== 1) failures.push("max_spawn_depth_not_1");
  for (const key of safetyFalseKeys) {
    if (manifest?.safety?.[key] !== false) failures.push(`${key}_must_be_false`);
  }

  const approved = failures.length === 0;
  return {
    capabilityId: manifest?.capabilityId || "unknown",
    admissionStatus: approved ? "approved_for_sandbox_runtime_only" : "rejected",
    runtimeKind: "sandbox_local",
    autoRuntimeEligible: approved,
    productionRuntimeEligible: false,
    reason: approved ? "verifier_and_safety_boundary_passed_for_sandbox_local_only" : failures.join(","),
    safetyBoundary: {
      providerCallsAllowed: false,
      secretReadAllowed: false,
      deployAllowed: false,
      chatMutationAllowed: false,
      chatGatewayExecuteMutationAllowed: false,
      codexConfigMutationAllowed: false,
      selfApprovalAllowed: false,
    },
    requiredEvidenceRefs: artifacts.evidenceRefs || [],
    rollbackRef: artifacts.rollbackRef || `capabilities/_generated_dry_run/${manifest?.capabilityId}/rollback-plan.json`,
    providerCallsAllowed: false,
    secretReadAllowed: false,
    deployAllowed: false,
    manifestPreview: approved ? createSandboxRuntimeManifest(manifest) : null,
    failures,
  };
}

export function createSandboxRuntimeManifest(manifest) {
  return {
    ...manifest,
    status: "registered_preview",
    runtime: {
      ...(manifest.runtime || {}),
      kind: "sandbox_local",
      enabledByDefault: false,
      autoRuntimeEligible: true,
      maxSpawnDepth: 1,
      ttlSeconds: 300,
      maxRequests: 3,
      maxTokenBudget: 4000,
      maxRuntimeMs: 30000,
    },
    approval: {
      ...(manifest.approval || {}),
      requiredForRuntime: true,
      currentStatus: "approved_for_sandbox_runtime_only",
    },
  };
}
