export function evaluateGuardedRealRouteEligibility(route = {}, options = {}) {
  const approval = options.approval || {};
  const selectedModel = options.selectedModel || null;
  const failures = [];
  if (!selectedModel?.runtimeEligible) failures.push("selected_model_not_runtime_eligible");
  if (!selectedModel?.selectable || !selectedModel?.smokePassed) failures.push("requires_selectable_smoke_passed_model");
  if (!approval.credentialRef) failures.push("credential_ref_required");
  if (approval.providerCallsAllowed !== true) failures.push("provider_calls_allowed_must_be_explicit_true");
  if (!Number.isFinite(approval.maxRequests) || approval.maxRequests < 1) failures.push("max_requests_required");
  if (approval.allowSecretRead === true) failures.push("secret_read_not_allowed");
  return {
    phase: "Phase817",
    guardedRealRouteEligibilityGateReady: true,
    realRouteEligible: failures.length === 0,
    realRouteExecutionAllowed: false,
    failures,
    routeId: route.routeId || null,
    providerCallsMade: false,
    secretRead: false,
    authJsonRead: false,
    rawSecretRead: false,
  };
}
