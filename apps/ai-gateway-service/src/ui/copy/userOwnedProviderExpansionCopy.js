export const userOwnedProviderExpansionCopy = Object.freeze({
  title: "User-owned Provider Expansion",
  subtitle:
    "CredentialRef-only expansion surface for approved provider discovery and bounded smoke. No approval file means no provider execution.",
  boundaryBadges: [
    "credentialRef-only",
    "providerCallsMade=false",
    "rawSecretRead=false",
    "secretValueExposed=false",
    "selectable unchanged",
    "Phase821+ required for selectable admission",
  ],
  safetyLines: [
    "Approval intake is required before any real discovery call.",
    "Smoke approval is separate from discovery approval.",
    "Smoke pass can only become selectable_candidate in this phase.",
    "Failed, deprecated, high-risk, and blocked models stay blocked.",
  ],
});
