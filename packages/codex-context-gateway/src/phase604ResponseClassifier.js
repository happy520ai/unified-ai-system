export function classifyPhase604Response(options = {}) {
  const executor = options.executor || {};
  let responseClassification = "invalid_response";
  let testStatus = "blocked";
  let failureReason = null;

  if (executor.oneShotExecuted !== true) {
    responseClassification = blockerToClassification(executor.blocker);
    failureReason = executor.blocker || "one_shot_not_executed";
  } else if (executor.timedOut) {
    responseClassification = "timeout";
    testStatus = "timeout";
    failureReason = "custom_provider_one_shot_timeout";
  } else if (isValidAck(executor.sanitizedStdout)) {
    responseClassification = "pass";
    testStatus = "pass";
  } else {
    responseClassification = "invalid_response";
    testStatus = "failed";
    failureReason = "valid_context_gateway_model_provider_ack_missing";
  }

  return {
    completed: true,
    responseClassified: true,
    testStatusRecorded: true,
    testStatus,
    responseClassification,
    failureReasonRecordedWhenFailed: failureReason !== null,
    failureReason,
    passRequiresValidAck: true,
  };
}

function blockerToClassification(blocker) {
  if (blocker === "final_user_confirmation_missing") return "blocked_by_missing_confirmation";
  if (blocker === "model_provider_override_not_honored") return "blocked_by_model_provider_override_not_honored";
  if (blocker === "custom_provider_missing") return "blocked_by_custom_provider_missing";
  if (blocker === "blocked_by_stale_context") return "blocked_by_stale_context";
  if (blocker === "blocked_by_budget") return "blocked_by_budget";
  if (blocker === "negative_control_timeout") return "timeout";
  return "blocked";
}

function isValidAck(value) {
  const lines = String(value || "").trim().split(/\r?\n/).filter(Boolean);
  return lines.length === 1 && lines[0] === "CONTEXT_GATEWAY_MODEL_PROVIDER_OK";
}
