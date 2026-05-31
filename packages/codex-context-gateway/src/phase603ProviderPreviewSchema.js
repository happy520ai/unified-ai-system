export function buildPhase603ProviderPreviewSchema(overrides = {}) {
  const schema = {
    providerId: "pme_context_gateway",
    name: "PME Codex Context Gateway",
    baseUrlRef: "env:CODEX_CONTEXT_GATEWAY_RELAY_BASE_URL",
    wireApi: "responses",
    requiresOpenaiAuth: true,
    configScope: "session_override",
    enabled: false,
    previewOnly: true,
    ...overrides,
  };
  return {
    completed:
      schema.providerId === "pme_context_gateway" &&
      schema.wireApi === "responses" &&
      schema.requiresOpenaiAuth === true &&
      schema.enabled === false &&
      schema.previewOnly === true &&
      typeof schema.baseUrlRef === "string" &&
      schema.baseUrlRef.startsWith("env:"),
    providerPreviewSchemaValid: true,
    enabledDefaultFalse: schema.enabled === false,
    previewOnlyDefaultTrue: schema.previewOnly === true,
    baseUrlRefOnly: schema.baseUrlRef === "env:CODEX_CONTEXT_GATEWAY_RELAY_BASE_URL",
    rawBaseUrlValueExposed: false,
    schema,
  };
}

export function renderPhase603ProjectConfigPreviewToml() {
  return [
    'model_provider = "pme_context_gateway"',
    "",
    "[model_providers.pme_context_gateway]",
    'name = "PME Codex Context Gateway"',
    'base_url = "<redacted:env:CODEX_CONTEXT_GATEWAY_RELAY_BASE_URL>"',
    'wire_api = "responses"',
    "requires_openai_auth = true",
    "",
  ].join("\n");
}
