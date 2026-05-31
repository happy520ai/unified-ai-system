export const THREE_MODE_UI_MARKERS = Object.freeze({
  tabs: ["normal", "god", "tianshu"],
  route: "/three-mode/execute",
  actualWorkbenchSource: "apps/ai-gateway-service/src/ui/consolePage.js",
  telemetryMarkers: [
    "three-mode-telemetry-output",
    "estimatedTokenUsage",
    "estimatedCost",
    "quotaStatus",
    "budgetStatus",
    "policyStatus",
    "credentialStatus",
  ],
  providerBetaMarkers: [
    "provider-setup-beta-panel",
    "credential-ref-form",
    "provider-beta-status-badge",
    "provider-validation-result-panel",
    "credentialRefOnly=true",
    "secretValueAllowed=false",
    "not production",
  ],
});
