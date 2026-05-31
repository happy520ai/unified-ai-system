export function getProviderOnboardingHelpText() {
  return {
    credentialRef: "Enter a credential reference name such as OPENAI_API_KEY, never an API key value.",
    secretSafety: "Raw keys, bearer tokens, and secret-looking values are rejected before backend validation.",
    betaOnly: "This onboarding wizard is limited beta only and cannot enable production access.",
    quotaBudget: "Non-NVIDIA providers require quota, budget, governance, and credentialRef gates.",
    revokeRotateDisable: "Use revoke, rotate, or disable actions if a reference is stale or no longer authorized.",
  };
}
