import { spawnSync } from "node:child_process";

export const phase604CustomProviderOneShotPrompt = [
  "Read .codex-context/current-context-pack.md.",
  "Check .codex-context/context-freshness-report.json and confirm stale=false.",
  "Read .codex-context/relevant-files.json.",
  "Do not edit files.",
  "Do not scan the full repository.",
  "Do not read secrets.",
  "Reply with one line only: CONTEXT_GATEWAY_MODEL_PROVIDER_OK.",
].join("\n");

export function buildPhase604CustomProviderCommandAssembly(options = {}) {
  const selector = options.providerRouteSelector || {};
  const selectedProviderId = selector.selectedProviderId || "not_selected";
  return {
    completed: true,
    customProviderCommandAssembled: true,
    commandAssembled: true,
    modelProviderOverrideUsed: true,
    selectedProviderId,
    selectedProviderIdRecorded: true,
    commandPreview:
      selectedProviderId === "not_selected"
        ? 'codex -c model_provider="<blocked:no-selected-provider>" "<phase604 one-shot prompt>"'
        : `codex -c model_provider="${selectedProviderId}" "<phase604 one-shot prompt>"`,
    realConfigWritePerformed: false,
    commandNotExecutedYet: true,
    rawBaseUrlValueExposed: false,
    authJsonRead: false,
  };
}

export function buildPhase604PreExecutionSafetyGate(options = {}) {
  const finalConfirmation = options.finalConfirmation || {};
  const negativeControl = options.negativeControlClassifier || {};
  const selector = options.providerRouteSelector || {};
  const freshness = options.freshnessTokenBudget || {};
  let blocker = null;
  if (finalConfirmation.finalConfirmationApproved !== true) blocker = finalConfirmation.blocker || "final_user_confirmation_missing";
  else if (negativeControl.canContinueToOneShot !== true) blocker = negativeControl.blocker || "model_provider_override_not_honored";
  else if (selector.providerExists !== true) blocker = "custom_provider_missing";
  else if (freshness.stale !== false) blocker = "blocked_by_stale_context";
  else if (freshness.tokenBudgetRespected !== true) blocker = "blocked_by_budget";

  return {
    completed: true,
    preExecutionSafetyGateEvaluated: true,
    preExecutionSafetyGatePassed: blocker === null,
    blocker,
    finalConfirmationExists: finalConfirmation.finalConfirmationExists === true,
    finalConfirmationVerified: finalConfirmation.finalConfirmationApproved === true,
    negativeControlPassed: negativeControl.canContinueToOneShot === true,
    providerExists: selector.providerExists === true,
    authJsonRead: false,
    stale: freshness.stale === true,
    maxRequestsOne: finalConfirmation.confirmation?.maxRequests === 1,
    retryLimitZero: finalConfirmation.confirmation?.retryLimit === 0,
    persistentConfigWrite: false,
    persistentConfigWriteForbidden: true,
  };
}

export function executePhase604CustomProviderOneShot(options = {}) {
  const gate = options.preExecutionSafetyGate || {};
  const command = options.commandAssembly || {};
  if (gate.preExecutionSafetyGatePassed !== true) {
    return blockedOneShot(gate.blocker || "pre_execution_gate_blocked");
  }
  if (options.execute !== true) {
    return blockedOneShot("explicit_custom_provider_execution_not_enabled");
  }

  const startedAt = Date.now();
  const result = spawnSync("codex", ["-c", `model_provider=${command.selectedProviderId}`, phase604CustomProviderOneShotPrompt], {
    cwd: options.cwd,
    encoding: "utf8",
    timeout: Math.min(Number(options.timeoutMs || 10 * 60 * 1000), 10 * 60 * 1000),
    windowsHide: true,
  });
  const exitCode = typeof result.status === "number" ? result.status : result.error?.code === "ETIMEDOUT" ? 124 : 1;
  const timedOut = result.error?.code === "ETIMEDOUT";
  return {
    completed: true,
    customProviderExecutionHandled: true,
    oneShotExecuted: true,
    providerCallsMade: true,
    requestAttemptCount: 1,
    retryAttemptCount: 0,
    exitCode,
    timedOut,
    durationMs: Date.now() - startedAt,
    selectedProviderId: command.selectedProviderId,
    sanitizedOutputRecorded: true,
    sanitizedStdout: sanitizeOutput(result.stdout),
    sanitizedStderr: sanitizeOutput(result.stderr || result.error?.message || ""),
    rawBaseUrlValueExposed: false,
    secretValueExposed: false,
    authJsonRead: false,
    realConfigWritePerformed: false,
  };
}

function blockedOneShot(blocker) {
  return {
    completed: true,
    customProviderExecutionHandled: true,
    oneShotExecuted: false,
    providerCallsMade: false,
    blocker,
    requestAttemptCount: 0,
    retryAttemptCount: 0,
    sanitizedOutputRecorded: true,
    sanitizedStdout: "",
    sanitizedStderr: `blocked:${blocker}`,
    rawBaseUrlValueExposed: false,
    secretValueExposed: false,
    authJsonRead: false,
    realConfigWritePerformed: false,
  };
}

function sanitizeOutput(value) {
  return String(value || "")
    .replace(/(api[_-]?key|token|secret|credential|webhook)(\s*[:=]\s*)\S+/gi, "$1$2[REDACTED]")
    .replace(/https?:\/\/[^\s"']+/gi, (url) => (/(token|key|secret|credential|webhook)/i.test(url) ? "[REDACTED_URL]" : "[REDACTED_URL]"))
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [REDACTED]");
}
