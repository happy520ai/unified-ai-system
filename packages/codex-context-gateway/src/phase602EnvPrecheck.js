export function buildPhase602EnvPrecheck(options = {}) {
  const envName = options.envName || "CODEX_CONTEXT_GATEWAY_RELAY_BASE_URL";
  const present = typeof process.env[envName] === "string" && process.env[envName].length > 0;
  return {
    completed: true,
    relayBaseUrlEnvChecked: true,
    envName,
    relayBaseUrlEnvPresent: present,
    baseUrlSource: `env:${envName}`,
    blocker: present ? null : "base_url_env_missing",
    rawBaseUrlValueExposed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
  };
}
