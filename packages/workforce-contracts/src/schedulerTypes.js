export const DEFAULT_DRY_RUN_SCHEDULER_POLICY = Object.freeze({
  maxCandidateEmployees: 5,
  maxActiveEmployees: 3,
  maxBrainCalls: 0,
  maxBrainCallsFutureDefault: 2,
  timeoutMsPerEmployee: 8000,
  globalTimeoutMs: 30000,
  useCache: true,
  requireEvidence: true,
  requireApprovalForProviderCall: true,
});

export function validateSchedulerPolicy(policy = DEFAULT_DRY_RUN_SCHEDULER_POLICY) {
  return {
    valid:
      policy.maxCandidateEmployees <= 5 &&
      policy.maxActiveEmployees <= 3 &&
      policy.maxBrainCalls === 0 &&
      policy.requireEvidence === true &&
      policy.requireApprovalForProviderCall === true,
    maxCandidateEmployees: policy.maxCandidateEmployees,
    maxActiveEmployees: policy.maxActiveEmployees,
    maxBrainCalls: policy.maxBrainCalls,
  };
}
