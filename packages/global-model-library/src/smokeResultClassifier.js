import { MODEL_SMOKE_MARKER } from "./boundedSmokeExecutorV0.js";

export function classifySmokeResult(result = {}) {
  if (result.notExecuted === true || result.status === "not_executed_no_approval") return "not_executed_no_approval";
  if (result.blockedByGate === true || result.status === "blocked_by_gate") return "blocked_by_gate";
  if (result.timeout === true) return "timeout";
  if (result.rateLimited === true || result.httpStatus === 429) return "rate_limited";
  if (result.credentialInvalid === true || result.httpStatus === 401 || result.httpStatus === 403) return "credential_invalid";
  if (result.providerError === true || Number(result.httpStatus ?? 200) >= 400) return "provider_error";
  if (typeof result.responseText === "string") {
    return result.responseText.includes(MODEL_SMOKE_MARKER) ? "pass" : "response_received_marker_missing";
  }
  return "blocked_by_gate";
}

export function classifySmokeExecutorResult(executorResult = {}) {
  const results = Array.isArray(executorResult.results) ? executorResult.results : [];
  const classified = results.map((item) => ({
    ...item,
    classification: classifySmokeResult(item),
    smokePassed: classifySmokeResult(item) === "pass",
  }));
  return {
    phase: "Phase789",
    status: executorResult.status,
    realSmokeExecuted: executorResult.realSmokeExecuted === true,
    providerCallsMade: executorResult.providerCallsMade === true,
    smokePassedNewModelCount: classified.filter((item) => item.smokePassed).length,
    classified,
    aggregateClassification: executorResult.realSmokeExecuted === true ? "classified" : "not_executed_no_approval",
    secretRead: false,
    selectableModified: false,
  };
}
