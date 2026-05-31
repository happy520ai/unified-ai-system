export function buildAccountPoolSimulation(options = {}) {
  return {
    completed: true,
    accountPoolSimulationWorks: true,
    accountPoolRef: options.accountPoolRef || "accountPoolRef:phase598-simulated-pool",
    concurrencyLimitSimulated: true,
    perAccountQuotaSimulated: true,
    rateLimitSimulated: true,
    coolingWindowSimulated: true,
    failureRotationSimulated: true,
    cacheMissBehaviorSimulated: true,
    realAccountPoolConnected: false,
    policy: {
      maxConcurrentPerPool: 2,
      maxConcurrentPerAccount: 1,
      perAccountQuota: "small bounded quota per request window",
      rateLimit: "fail closed on repeated limit signals",
      coolingWindowMinutes: 15,
      failureRotation: "rotate after auth_error, rate_limit, or malformed relay response",
      cacheMissHandling: "reuse context hash and stable prompt prefix before expanding context",
      evidenceAudit: "record accountPoolRef, selection outcome, and redacted failure reason only",
    },
  };
}
