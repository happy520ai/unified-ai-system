export function buildPhase602PreExecutionSafetyGate(options = {}) {
  const readiness = options.readinessImport || {};
  const confirmation = options.finalConfirmation || {};
  const env = options.envPrecheck || {};
  const freshness = options.freshnessTokenBudget || {};
  const rollbackReady = options.rollbackReady !== false;
  const emergencyDisableReady = options.emergencyDisableReady !== false;
  const blocker = chooseBlocker({ readiness, confirmation, env, freshness, rollbackReady, emergencyDisableReady });
  return {
    completed: true,
    preExecutionSafetyGatePassed: blocker === null,
    blocker,
    finalConfirmationVerified: confirmation.finalConfirmationApproved === true,
    providerCallAllowedForOneShot: confirmation.providerCallAllowedForOneShotRequired === true,
    maxRequestsOne: confirmation.maxRequestsOneRequired === true,
    envPrecheckPassed: env.relayBaseUrlEnvPresent === true,
    staleFalse: freshness.stale === false,
    tokenBudgetRespected: freshness.tokenBudgetRespected === true,
    rollbackReady,
    emergencyDisableReady,
    realConfigWriteAllowed: false,
    relayStartAllowed: false,
    requestAttemptLimit: 1,
  };
}

function chooseBlocker({ readiness, confirmation, env, freshness, rollbackReady, emergencyDisableReady }) {
  if (confirmation.finalConfirmationExists !== true) return "final_user_confirmation_missing";
  if (confirmation.finalConfirmationApproved !== true) return confirmation.blocker || "final_confirmation_invalid";
  if (confirmation.providerCallAllowedForOneShotRequired !== true) return "provider_call_not_authorized_for_one_shot";
  if (confirmation.maxRequestsOneRequired !== true) return "max_requests_not_one";
  if (readiness.phase601PreparationSatisfied !== true) return "phase601_required";
  if (env.relayBaseUrlEnvPresent !== true) return "base_url_env_missing";
  if (freshness.stale !== false) return "blocked_by_stale_context";
  if (freshness.tokenBudgetRespected !== true) return "blocked_by_budget";
  if (!rollbackReady) return "rollback_not_ready";
  if (!emergencyDisableReady) return "emergency_disable_not_ready";
  return null;
}
