export function buildPhase602OneShotExecutor(options = {}) {
  const gate = options.preExecutionSafetyGate || {};
  if (gate.preExecutionSafetyGatePassed !== true) {
    return blockedResult(gate.blocker || "pre_execution_gate_blocked");
  }
  if (options.execute !== true) {
    return blockedResult("explicit_runtime_execution_not_enabled");
  }
  return {
    completed: true,
    oneShotExecuted: false,
    executionSkippedBySafetyHarness: true,
    blocker: "runtime_executor_not_bound_in_verifier",
    requestAttemptCount: 0,
    retryAttemptCount: 0,
    timeoutMs: 0,
    sanitizedOutputRecorded: true,
    sanitizedStdout: "",
    sanitizedStderr: "Phase602 verifier did not bind a real Codex executor.",
    rawBaseUrlValueExposed: false,
    secretValueExposed: false,
    realConfigWritePerformed: false,
  };
}

function blockedResult(blocker) {
  return {
    completed: true,
    oneShotExecuted: false,
    blocker,
    requestAttemptCount: 0,
    retryAttemptCount: 0,
    sanitizedOutputRecorded: true,
    sanitizedStdout: "",
    sanitizedStderr: `blocked:${blocker}`,
    rawBaseUrlValueExposed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
    realConfigWritePerformed: false,
  };
}
