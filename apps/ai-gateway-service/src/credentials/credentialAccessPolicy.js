export function evaluateCredentialAccessPolicy({ request = {}, providerScope = "nvidia", modeScope = "normal", userOwned = true } = {}) {
  if (JSON.stringify(request).includes('"secretValue"')) {
    return { allowed: false, code: "SECRET_VALUE_FORBIDDEN" };
  }
  if (userOwned !== true) {
    return { allowed: false, code: "CREDENTIAL_ACCESS_DENIED" };
  }
  if (!["nvidia", "openai", "claude", "openrouter", "mimo"].includes(providerScope)) {
    return { allowed: false, code: "CREDENTIAL_SCOPE_NOT_ALLOWED" };
  }
  if (!["normal", "god", "tianshu"].includes(modeScope)) {
    return { allowed: false, code: "CREDENTIAL_SCOPE_NOT_ALLOWED" };
  }
  if (request?.audit?.traceEnabled === false) {
    return { allowed: false, code: "CREDENTIAL_ACCESS_DENIED", reason: "audit_trace_required" };
  }
  return { allowed: true, code: "CREDENTIAL_ACCESS_ALLOWED" };
}
