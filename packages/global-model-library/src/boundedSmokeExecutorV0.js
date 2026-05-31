export const MODEL_SMOKE_PROMPT = "Reply with exactly: MODEL_SMOKE_OK";
export const MODEL_SMOKE_MARKER = "MODEL_SMOKE_OK";

export function runBoundedSmokeExecutorV0({ smokeApprovalIntake, readiness } = {}) {
  if (smokeApprovalIntake?.approved !== true || readiness?.credentialReady !== true) {
    return {
      phase: "Phase788",
      status: "not_executed_no_approval",
      realSmokeExecuted: false,
      providerCallsMade: false,
      requestAttemptCount: 0,
      retryAttemptCount: 0,
      smokePrompt: MODEL_SMOKE_PROMPT,
      results: [],
      blockedReason: smokeApprovalIntake?.blocker ?? readiness?.failures?.join(";") ?? "approval_missing",
      credentialRefOnly: true,
      secretRead: false,
    };
  }
  return {
    phase: "Phase788",
    status: "blocked_by_gate",
    realSmokeExecuted: false,
    providerCallsMade: false,
    requestAttemptCount: 0,
    retryAttemptCount: 0,
    smokePrompt: MODEL_SMOKE_PROMPT,
    results: [],
    blockedReason: "real_provider_smoke_executor_not_enabled_in_this_environment",
    credentialRefOnly: true,
    secretRead: false,
  };
}
