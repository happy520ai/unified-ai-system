export const providerCallAuthenticityCopy = Object.freeze({
  title: "Provider Call Authenticity",
  subtitle: "Read-only audit of whether route evidence proves an external Provider API call or only a local guarded executor attempt.",
  badges: [
    "authenticity verifier",
    "CredentialRef-only",
    "no raw secret",
    "no auth.json",
    "default routes unchanged",
  ],
  safetyLines: [
    "Mock, simulated, dry-run, and local executor evidence is not promoted to external Provider confirmation.",
    "Unknown or unconfirmed evidence is conservatively downgraded.",
    "No button can read API keys, read auth.json, call a Provider, deploy, or force confirmed status.",
  ],
});
