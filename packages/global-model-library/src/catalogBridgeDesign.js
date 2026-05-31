export function buildCatalogBridgeDesign() {
  return {
    phase: "Phase772",
    name: "LiteLLM / OpenRouter-compatible Catalog Bridge Design",
    runtimeEnabled: false,
    providerCallsMade: false,
    openRouterApiCalled: false,
    liteLlmApiCalled: false,
    secretRead: false,
    bridgeContracts: [
      {
        bridgeId: "openrouter-compatible-catalog",
        mode: "design_only",
        credentialRefRequired: true,
        selectableByDefault: false,
      },
      {
        bridgeId: "litellm-compatible-catalog",
        mode: "design_only",
        credentialRefRequired: true,
        selectableByDefault: false,
      },
    ],
    dryRunFixture: {
      importedModelStatus: "credential_missing",
      smokePlanStatus: "not_scheduled",
      providerCallsMade: false,
    },
  };
}
