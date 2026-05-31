export function buildAggregatorProviderContract() {
  return {
    contractName: "aggregator-provider-contract",
    version: "phase765.v1",
    supportedFamilies: ["openrouter", "litellm-compatible", "siliconflow", "modelscope", "volcano-ark"],
    runtimeEnabled: false,
    providerCallsMade: false,
    secretRead: false,
    requiredBoundaries: {
      aggregatorCatalogIsNotRuntimeCall: true,
      aggregatorModelAliasMustResolveToCanonicalId: true,
      userOwnedCredentialRefRequiredForFutureRuntime: true,
      rawSecretAllowed: false,
      selectableUnchangedInDryRun: true,
    },
    adapterSurface: [
      "listCatalogPreview({ dryRun: true })",
      "normalizeAggregatorModel(rawModel)",
      "resolveUpstreamProviderFamily(rawModel)",
      "mapPricingMetadata(rawModel)",
      "buildSmokePlanPreview(record)",
    ],
  };
}
