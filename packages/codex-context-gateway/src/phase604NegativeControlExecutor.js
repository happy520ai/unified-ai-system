import { spawnSync } from "node:child_process";

export const phase604BadModelProviderId = "provider_that_should_not_exist_123";

export const phase604NegativeControlPrompt =
  "Reply with one line only: SHOULD_FAIL_IF_MODEL_PROVIDER_OVERRIDE_WORKS.";

export const phase604NegativeControlCommandPreview =
  `codex -c model_provider="${phase604BadModelProviderId}" "${phase604NegativeControlPrompt}"`;

export function buildPhase604NegativeControlCommandAssembly() {
  return {
    completed: true,
    negativeControlCommandAssembled: true,
    commandPreviewOnly: true,
    commandExecuted: false,
    commandPreview: phase604NegativeControlCommandPreview,
    badProviderId: phase604BadModelProviderId,
    prompt: phase604NegativeControlPrompt,
    authJsonRead: false,
    rawBaseUrlValueExposed: false,
  };
}

export function executePhase604NegativeControl(options = {}) {
  const finalConfirmation = options.finalConfirmation || {};
  if (finalConfirmation.finalConfirmationApproved !== true) {
    return blockedNegativeControl(finalConfirmation.blocker || "final_user_confirmation_missing");
  }
  if (options.execute !== true) {
    return blockedNegativeControl("explicit_negative_control_execution_not_enabled");
  }

  const startedAt = Date.now();
  const result = spawnSync("codex", ["-c", `model_provider=${phase604BadModelProviderId}`, phase604NegativeControlPrompt], {
    cwd: options.cwd,
    encoding: "utf8",
    timeout: Math.min(Number(options.timeoutMs || 10 * 60 * 1000), 10 * 60 * 1000),
    windowsHide: true,
  });
  const exitCode = typeof result.status === "number" ? result.status : result.error?.code === "ETIMEDOUT" ? 124 : 1;
  const timedOut = result.error?.code === "ETIMEDOUT";
  const sanitizedStdout = sanitizeOutput(result.stdout);
  const sanitizedStderr = sanitizeOutput(result.stderr || result.error?.message || "");
  const failedAsExpected = exitCode !== 0;
  return {
    completed: true,
    negativeControlExecutionHandled: true,
    negativeControlExecuted: true,
    negativeControlPassed: failedAsExpected,
    blocker: timedOut ? "negative_control_timeout" : failedAsExpected ? null : "model_provider_override_not_honored",
    exitCode,
    timedOut,
    durationMs: Date.now() - startedAt,
    sanitizedOutputRecorded: true,
    sanitizedStdout,
    sanitizedStderr,
    rawBaseUrlValueExposed: false,
    secretValueExposed: false,
    authJsonRead: false,
    retryAttemptCount: 0,
  };
}

export function classifyPhase604NegativeControl(executor = {}) {
  const classification = executor.negativeControlExecuted !== true
    ? executor.blocker === "final_user_confirmation_missing"
      ? "not_executed_missing_confirmation"
      : "not_executed"
    : executor.timedOut
      ? "timeout"
      : executor.negativeControlPassed === true
        ? "failed_as_expected"
        : "unexpectedly_succeeded";
  return {
    completed: true,
    negativeControlResultClassified: true,
    classification,
    negativeControlPassed: classification === "failed_as_expected",
    canContinueToOneShot: classification === "failed_as_expected",
    blocker:
      classification === "unexpectedly_succeeded"
        ? "model_provider_override_not_honored"
        : classification === "timeout"
          ? "negative_control_timeout"
          : executor.blocker || null,
  };
}

function blockedNegativeControl(blocker) {
  return {
    completed: true,
    negativeControlExecutionHandled: true,
    negativeControlExecuted: false,
    negativeControlPassed: false,
    blockedByMissingConfirmation: blocker === "final_user_confirmation_missing",
    blocker,
    requestAttemptCount: 0,
    retryAttemptCount: 0,
    sanitizedOutputRecorded: true,
    sanitizedStdout: "",
    sanitizedStderr: `blocked:${blocker}`,
    rawBaseUrlValueExposed: false,
    secretValueExposed: false,
    authJsonRead: false,
  };
}

function sanitizeOutput(value) {
  return String(value || "")
    .replace(/(api[_-]?key|token|secret|credential|webhook)(\s*[:=]\s*)\S+/gi, "$1$2[REDACTED]")
    .replace(/https?:\/\/[^\s"']+/gi, (url) => (/(token|key|secret|credential|webhook)/i.test(url) ? "[REDACTED_URL]" : "[REDACTED_URL]"))
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [REDACTED]");
}
