export function evaluateGuardedRealCallPolicy({ env = process.env, providerConfig = {}, request = {}, resolution = null } = {}) {
  if (JSON.stringify(request).includes('"secretValue"')) {
    return { allowed: false, code: "SECRET_VALUE_FORBIDDEN", providerCallsMade: false };
  }
  if (!resolution?.resolved) {
    return { allowed: false, code: resolution?.code || "CREDENTIAL_RESOLUTION_FAILED", providerCallsMade: false };
  }
  if (providerConfig.userOwned !== true) {
    return { allowed: false, code: "PROVIDER_NOT_USER_OWNED", providerCallsMade: false };
  }
  if (providerConfig.enabled !== true) {
    return { allowed: false, code: "USER_PROVIDER_NOT_ENABLED", providerCallsMade: false };
  }
  if (providerConfig.realCallsAllowed !== true) {
    return { allowed: false, code: "PROVIDER_REAL_CALL_NOT_ALLOWED", providerCallsMade: false };
  }
  if (!["guarded_user_owned_provider_test", "limited_beta"].includes(String(providerConfig.governanceStage || ""))) {
    return { allowed: false, code: "PROVIDER_GOVERNANCE_NOT_ALLOWED", providerCallsMade: false };
  }
  if (env.PHASE328D_GUARDED_REAL_CALLS !== "1") {
    return { allowed: false, code: "GUARDED_REAL_CALL_DISABLED", providerCallsMade: false };
  }
  return { allowed: true, code: "GUARDED_REAL_CALL_ALLOWED", providerCallsMade: false };
}
