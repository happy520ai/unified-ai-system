export function buildPhase601CredentialAccountPoolPrecheck(options = {}) {
  return {
    completed: true,
    credentialRefPrecheckPreviewGenerated: true,
    accountPoolPrecheckPreviewGenerated: true,
    credentialRef: options.credentialRef || "credentialRef.codex-relay-authorized",
    accountPoolRef: options.accountPoolRef || "accountPoolRef.codex-pro-pool-authorized",
    precheckSteps: [
      "Validate credentialRef string shape only.",
      "Validate accountPoolRef string shape only.",
      "Do not resolve credentialRef to raw secret.",
      "Do not connect account pool in Phase601.",
    ],
    credentialRefOnly: true,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
    realAccountPoolConnected: false,
  };
}
