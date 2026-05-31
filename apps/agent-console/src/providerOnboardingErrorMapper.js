export function mapProviderOnboardingError(code) {
  const messages = {
    RAW_SECRET_REJECTED: "This looks like a secret value. Enter only the credential reference name.",
    CREDENTIAL_REF_MISSING: "A credential reference is required before validation can continue.",
    UNSUPPORTED_PROVIDER: "This provider is not enabled for limited beta onboarding.",
    UNSUPPORTED_REFERENCE_TYPE: "Choose env key name, encrypted reference, vault reference, or user secret store reference.",
    PRODUCTION_ENABLEMENT_BLOCKED_FROM_BETA_UI: "Production enablement is blocked from the limited beta UI.",
    EXPLICIT_CONFIRMATION_REQUIRED: "Confirm that this is a reference only and not a secret value.",
  };
  return messages[code] || "Provider onboarding is blocked by governance policy.";
}
