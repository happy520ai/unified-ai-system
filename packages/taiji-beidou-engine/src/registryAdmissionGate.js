export function buildRuntimeRegistry(admissionDecisions = []) {
  const admittedCapabilities = admissionDecisions
    .filter((decision) => decision.admissionStatus === "approved_for_sandbox_runtime_only")
    .map((decision) => ({
      capabilityId: decision.capabilityId,
      runtimeKind: "sandbox_local",
      autoRuntimeEligible: true,
      productionRuntimeEligible: false,
      approvalStatus: "approved_for_sandbox_runtime_only",
      rollbackRef: decision.rollbackRef,
      safetyBoundary: decision.safetyBoundary,
      manifest: decision.manifestPreview,
    }));

  return {
    runtimeRegistryVersion: "phase668-auto-runtime-v0",
    runtimeKind: "sandbox_local",
    productionReady: false,
    defaultProviderCallsAllowed: false,
    defaultSecretReadAllowed: false,
    defaultDeployAllowed: false,
    admittedCapabilities,
  };
}
