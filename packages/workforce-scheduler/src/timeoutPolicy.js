export const dryRunTimeoutPolicy = Object.freeze({
  timeoutMsPerEmployee: 8000,
  globalTimeoutMs: 30000,
});

export function timeoutSummary(policy = dryRunTimeoutPolicy) {
  return {
    timeoutMsPerEmployee: policy.timeoutMsPerEmployee,
    globalTimeoutMs: policy.globalTimeoutMs,
  };
}
