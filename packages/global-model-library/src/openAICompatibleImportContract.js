export function buildOpenAICompatibleImportContract() {
  return {
    phase: "Phase771",
    contractName: "openai-compatible-provider-import-contract",
    runtimeEnabled: false,
    providerCallsMade: false,
    secretRead: false,
    rawBaseUrlValueExposed: false,
    supportedSurface: [
      "GET /v1/models catalog preview in future authorized phase",
      "POST /v1/chat/completions smoke preview in future authorized phase",
      "OpenAI-compatible error normalization",
      "credentialRef-only account binding",
    ],
    dryRunFixture: {
      providerFamily: "openai-compatible",
      credentialRefRequired: true,
      rawSecretAllowed: false,
      defaultImportedStatus: "credential_missing",
      selectableGate: "not_smoke_verified",
    },
  };
}
