export function buildAccountPoolPolicyDesign() {
  return {
    completed: true,
    accountPoolPolicyDefined: true,
    accountPoolRef: "accountPoolRef:future-codex-relay-pool",
    concurrencyLimitDefined: true,
    perAccountQuotaDefined: true,
    rateLimitDefined: true,
    coolingWindowMinutes: 15,
    failureRotationDefined: true,
    cacheMissPolicyLinked: true,
    evidenceAudit: "record accountPoolRef, selected relayRef, quota decision, and redacted failure reason only",
    policy: {
      maxConcurrentPerPool: 2,
      maxConcurrentPerAccount: 1,
      failureRotation: "rotate after rate_limit, auth_error, or malformed relay response",
      cacheMissHandling: "reuse context hash and stable prompt prefix before expanding context",
    },
  };
}
