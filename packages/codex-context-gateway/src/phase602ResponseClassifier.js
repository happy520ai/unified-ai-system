export function classifyPhase602Response(options = {}) {
  const executor = options.executor || {};
  let responseClassification = "invalid_response";
  let testStatus = "blocked";
  let failureReason = null;

  if (executor.oneShotExecuted !== true) {
    responseClassification = blockerToClassification(executor.blocker);
    failureReason = executor.blocker || "one_shot_not_executed";
  } else if (isValidAck(executor.sanitizedStdout)) {
    responseClassification = "pass";
    testStatus = "pass";
  } else {
    responseClassification = "invalid_response";
    testStatus = "failed";
    failureReason = "valid_one_line_ack_missing";
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
  if (blocker === "base_url_env_missing") return "blocked_by_missing_env";
  if (blocker === "blocked_by_stale_context") return "blocked_by_stale_context";
  if (blocker === "blocked_by_budget") return "blocked_by_budget";
  if (blocker === "phase601_required") return "blocked_by_phase601_required";
  return "blocked";
}

function isValidAck(value) {
  const lines = String(value || "").trim().split(/\r?\n/).filter(Boolean);
  return lines.length === 1 && /ack|acknowledg|ok|verified/i.test(lines[0]);
}
