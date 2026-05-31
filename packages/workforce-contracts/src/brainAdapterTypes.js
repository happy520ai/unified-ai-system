export const BRAIN_BINDING_MODES = Object.freeze([
  "none",
  "dry_run",
  "gateway_adapter_preview",
]);

export const DEFAULT_BRAIN_BINDING = Object.freeze({
  mode: "dry_run",
  providerRef: "providerRef.preview",
  modelRef: "modelRef.preview",
  credentialRef: "credentialRef.preview-only",
  allowedModes: ["dry_run", "gateway_adapter_preview"],
  maxRequestsPerTask: 0,
  maxEstimatedCostUsd: 0,
  timeoutMs: 8000,
  fallbackPolicy: "return_preview_contribution",
  approvalRequired: true,
});

export function validateBrainBinding(binding = DEFAULT_BRAIN_BINDING) {
  const modeValid = BRAIN_BINDING_MODES.includes(binding.mode);
  return {
    valid: modeValid && binding.approvalRequired === true,
    modeValid,
    approvalRequiredForRealProviderCall: binding.approvalRequired === true,
  };
}
