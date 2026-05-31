export const realModelRoutingCopy = Object.freeze({
  title: "Guarded Real Model Routing",
  subtitle: "CredentialRef-only route execution gate. If credential evidence is missing, Provider calls stay blocked.",
  badges: [
    "guarded self-use only",
    "selectable + smokePassed required",
    "maxTotalProviderRequests=30",
    "rawSecretRead=false",
    "default /chat unchanged",
  ],
  safetyLines: [
    "No selectable candidate is executed as runtime.",
    "No cataloged, credential_missing, failed, high_risk, blocked, or deprecated model enters real routing.",
    "No raw API key, webhook, auth.json, or base URL is displayed.",
    "No deploy, release, tag, artifact upload, commit, or push action is exposed.",
  ],
});
