export function createTaijiBeidouRealProviderRuntimeEvidencePreview(input = {}) {
  return {
    previewType: "taiji-beidou-real-provider-runtime-evidence",
    approvalRef: input.approvalRef || "docs/phase675_682-real-provider-runtime-approval.input.json",
    executionRef: input.executionRef || "apps/ai-gateway-service/evidence/phase675_682/guarded-real-provider-runtime-one-shot-result.json",
    responseClassification: input.responseClassification || "blocked_by_missing_approval",
    credentialRefUsed: true,
    rawSecretRead: false,
    rollbackAvailable: input.rollbackAvailable !== false,
    emergencyDisableAvailable: true,
  };
}
