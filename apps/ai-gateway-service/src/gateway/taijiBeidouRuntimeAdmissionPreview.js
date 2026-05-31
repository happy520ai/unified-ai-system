export function createTaijiBeidouRuntimeAdmissionPreview(input = {}) {
  const decision = input.decision || {};
  return {
    previewType: "taiji-beidou-runtime-admission",
    capabilityId: decision.capabilityId || "preview",
    admissionStatus: decision.admissionStatus || "preview_only",
    runtimeKind: "sandbox_local",
    autoRuntimeEligible: decision.autoRuntimeEligible === true,
    productionRuntimeEligible: false,
    providerCallsAllowed: false,
    secretReadAllowed: false,
    deployAllowed: false,
  };
}
