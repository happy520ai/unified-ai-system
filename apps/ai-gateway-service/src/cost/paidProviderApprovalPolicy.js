export const paidApiGuardPolicy = {
  enabled: true,
  manualApprovalRequired: true,
  autoFallbackToPaidDisabled: true,
  paidProviderDefaultAllowed: false,
  fallbackToPaidProviderAutoAllowed: false,
  paidApiCallCount: 0,
  blockedWithoutApproval: [
    "paid provider smoke",
    "MiMo paid route",
    "embedding provider call",
    "external provider fallback",
  ],
};

export function getPaidApiGuardPolicy() {
  return JSON.parse(JSON.stringify(paidApiGuardPolicy));
}
