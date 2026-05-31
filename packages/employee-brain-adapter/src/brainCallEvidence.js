export function buildBrainCallEvidence({ employeeId, title, taskType, binding }) {
  return {
    evidenceId: `brain-preview-${employeeId}`,
    employeeId,
    title,
    taskType,
    bindingMode: binding.mode,
    gatewayAdapterPreviewOnly: binding.mode === "gateway_adapter_preview" || binding.mode === "dry_run",
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    approvalRequiredForRealProviderCall: true,
    timeline: [
      "brain_binding_loaded",
      "credential_ref_boundary_checked",
      "gateway_adapter_preview_built",
      "provider_call_skipped",
      "dry_run_contribution_returned",
    ],
  };
}
