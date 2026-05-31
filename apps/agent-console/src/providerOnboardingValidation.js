export function validateProviderOnboardingInput({ providerId, credentialRefType, credentialRef, productionEnablementRequested = false, confirmation = false } = {}) {
  if (!["nvidia", "openai", "claude", "openrouter", "mimo"].includes(String(providerId))) return { allowed: false, code: "UNSUPPORTED_PROVIDER" };
  if (!["env_key_name", "encrypted_reference", "vault_reference", "user_secret_store_reference"].includes(String(credentialRefType))) return { allowed: false, code: "UNSUPPORTED_REFERENCE_TYPE" };
  if (!String(credentialRef || "").trim()) return { allowed: false, code: "CREDENTIAL_REF_MISSING" };
  if (/sk-|nvapi-|secret|token|bearer\s+/i.test(String(credentialRef)) && !/^[A-Z0-9_]+$/.test(String(credentialRef))) return { allowed: false, code: "RAW_SECRET_REJECTED" };
  if (productionEnablementRequested) return { allowed: false, code: "PRODUCTION_ENABLEMENT_BLOCKED_FROM_BETA_UI" };
  if (!confirmation) return { allowed: false, code: "EXPLICIT_CONFIRMATION_REQUIRED" };
  return { allowed: true, code: "ONBOARDING_INPUT_ACCEPTED_FOR_BACKEND_GATE" };
}
