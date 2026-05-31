export function createTaijiBeidouRuntimeEvidencePreview(input = {}) {
  const evidence = input.evidence || {};
  return {
    previewType: "taiji-beidou-runtime-evidence",
    capabilityId: evidence.capabilityId || "preview",
    runtimeKind: "sandbox_local",
    executionStatus: evidence.executionStatus || "preview_only",
    rollbackAvailable: evidence.rollbackAvailable === true,
    providerCallsMade: false,
    secretRead: false,
    secretValueExposed: false,
    deployExecuted: false,
  };
}
