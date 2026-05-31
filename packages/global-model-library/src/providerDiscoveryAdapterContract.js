export function buildProviderDiscoveryAdapterContract() {
  return {
    contractName: "provider-discovery-adapter-contract",
    version: "phase764.v1",
    runtimeEnabled: false,
    providerCallsMade: false,
    secretRead: false,
    purpose: "Describe how a future provider-specific discovery adapter may convert remote or local catalog data into Global Model Catalog records.",
    requiredAdapterMethods: [
      "describeProviderFamily()",
      "buildDiscoveryPlan({ credentialRef, dryRun })",
      "normalizeDiscoveredModel(rawModel)",
      "classifyDiscoveryRisk(normalizedModel)",
      "toGlobalModelRecord(normalizedModel)",
    ],
    requiredOutputFields: [
      "providerFamily",
      "providerId",
      "discoveryMode",
      "credentialPolicy",
      "records",
      "riskSummary",
      "providerCallsMade",
      "secretRead",
    ],
    dryRunRules: [
      "dryRun defaults to true",
      "providerCallsMade must stay false",
      "raw secret values are never accepted",
      "credentialRef is referenced by id only",
      "discovered models must not become selectable",
    ],
  };
}
