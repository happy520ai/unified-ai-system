export const PROVIDER_EXPANSION_ALLOWLIST = Object.freeze([
  "nvidia",
  "openai",
  "anthropic",
  "google-gemini",
  "deepseek",
  "qwen",
  "moonshot-kimi",
  "zhipu-glm",
  "minimax",
  "mistral",
  "openrouter",
  "litellm-compatible",
  "siliconflow",
  "modelscope",
  "volcano-ark",
  "ollama-local",
  "lm-studio-local",
  "vllm-private",
]);

export function buildUserOwnedCredentialRefSetupContract() {
  return {
    phase: "Phase781",
    contractName: "user-owned-provider-credentialref-setup-contract",
    credentialRefOnly: true,
    rawSecretAllowed: false,
    secretRead: false,
    authJsonRead: false,
    allowedProviderFamilies: PROVIDER_EXPANSION_ALLOWLIST,
    setupFlow: [
      "operator creates/stores provider credential outside this phase",
      "operator supplies credentialRef id only",
      "readiness gate validates ref shape and provider allowlist",
      "discovery/smoke require explicit approval packets",
      "smoke pass can only create selectable_candidate in this phase",
    ],
    forbiddenInputs: ["apiKey", "secret", "token", "webhook", "rawBaseUrl", "authJson"],
  };
}

export function validateCredentialRefShape(credentialRef) {
  const value = String(credentialRef ?? "");
  return /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{2,127}$/.test(value) && !/(sk-|nvapi|bearer|token|secret|key=)/i.test(value);
}
