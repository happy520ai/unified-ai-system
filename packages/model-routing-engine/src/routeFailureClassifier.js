export const ROUTE_FAILURE_CLASSES = Object.freeze([
  "pass",
  "provider_error",
  "timeout",
  "marker_missing",
  "budget_exceeded",
  "blocked_by_gate",
  "credential_invalid",
  "not_executed_no_budget",
  "not_executed_no_eligible_model",
  "not_executed_credential_missing",
]);

export function classifyRouteResult(result = {}) {
  if (result.blockedByGate === true) return "blocked_by_gate";
  if (result.credentialReady === false) return "not_executed_credential_missing";
  if (result.budgetExceeded === true) return "budget_exceeded";
  if (result.noBudget === true) return "not_executed_no_budget";
  if (result.noEligibleModel === true) return "not_executed_no_eligible_model";
  if (result.credentialInvalid === true) return "credential_invalid";
  if (result.timeout === true) return "timeout";
  if (result.providerError === true) return "provider_error";
  if (result.markerMissing === true) return "marker_missing";
  if (result.providerCallAttempted === true && result.pass === true) return "pass";
  return "blocked_by_gate";
}

export function buildRouteFailureClassifierReport(results = []) {
  const classifications = results.map((result) => ({
    routeId: result.routeId,
    mode: result.mode,
    responseClassification: result.responseClassification || classifyRouteResult(result),
  }));
  const counts = classifications.reduce((acc, item) => {
    acc[item.responseClassification] = (acc[item.responseClassification] || 0) + 1;
    return acc;
  }, {});
  return {
    phase: "Phase831",
    routeFailureClassifierReady: true,
    classificationCount: classifications.length,
    classifications,
    counts,
    providerCallsMade: results.some((result) => result.providerCallsMade === true),
    secretRead: false,
  };
}
