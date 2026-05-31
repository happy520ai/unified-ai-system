export function buildProviderRateLimitTimeoutPolicy() {
  return {
    phase: "Phase792",
    rateLimitTimeoutPolicyReady: true,
    maxDiscoveryRequests: 3,
    maxSmokeRequests: 5,
    maxRetries: 0,
    timeoutMs: 30000,
    stopOnRateLimit: true,
    stopOnFirstProviderAuthFailure: true,
    providerCallsMade: false,
    secretRead: false,
  };
}
