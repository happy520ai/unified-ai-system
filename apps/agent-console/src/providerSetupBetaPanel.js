export function buildProviderSetupBetaPanelState() {
  return {
    panelId: "provider-setup-beta-panel",
    betaOnly: true,
    productionGa: false,
    credentialRefOnly: true,
    secretValueAllowed: false,
    directProviderCallFromUi: false,
    supportedProviders: ["nvidia", "openai", "claude", "openrouter", "mimo"],
  };
}
