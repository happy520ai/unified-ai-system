export const freeModelFirstPolicy = {
  enabled: true,
  defaultPreference: "free-model-first",
  manualApprovalRequiredBeforePaid: true,
  paidProviderDefaultAllowed: false,
  fallbackToPaidProviderAutoAllowed: false,
  notes: [
    "Prefer free/local/non-paid model paths for default local operation.",
    "Do not auto-upgrade a failed free route to a paid provider.",
    "Require a separate human decision before any paid-provider smoke or route.",
  ],
};

export function getFreeModelFirstPolicy() {
  return JSON.parse(JSON.stringify(freeModelFirstPolicy));
}
