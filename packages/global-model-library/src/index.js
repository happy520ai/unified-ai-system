export { buildProviderFamilyRegistry, buildProviderFamilySafety, REQUIRED_PROVIDER_FAMILIES } from "./providerFamilyRegistry.js";
export {
  buildGlobalModelCatalogSchema,
  canonicalizeModelId,
  createGlobalModelRecord,
  GLOBAL_MODEL_SOURCES,
  GLOBAL_MODEL_STATUSES,
  normalizeGlobalModelStatus,
  normalizeSource,
  validateGlobalModelRecord,
} from "./globalModelCatalogSchema.js";
export { buildProviderDiscoveryAdapterContract } from "./providerDiscoveryAdapterContract.js";
export { buildAggregatorProviderContract } from "./aggregatorProviderContract.js";
export { buildLocalRuntimeProviderContract } from "./localRuntimeProviderContract.js";
export { buildUserOwnedCredentialRefContract } from "./userOwnedCredentialRefContract.js";
export { buildModelStatusStateMachine, canTransitionModelStatus, MODEL_STATUS_TRANSITIONS } from "./modelStatusStateMachine.js";
export { buildModelCapabilityTagTaxonomy, inferCapabilityTagsFromModelId, MODEL_CAPABILITY_TAGS } from "./modelCapabilityTags.js";
export { buildGlobalCatalogSeedPack } from "./globalCatalogSeedPack.js";
export { buildOpenAICompatibleImportContract } from "./openAICompatibleImportContract.js";
export { buildCatalogBridgeDesign } from "./catalogBridgeDesign.js";
export { buildChineseModelEcosystemCatalogPack, CHINESE_MODEL_ECOSYSTEM_FAMILIES } from "./chineseModelEcosystemCatalog.js";
export { resolveModelAliases } from "./modelAliasResolver.js";
export { buildModelRiskPolicy, classifyModelRisk } from "./modelRiskPolicy.js";
export { runDryRunCatalogImporter } from "./dryRunCatalogImporter.js";
export { buildModelExpansionMetrics } from "./modelExpansionMetrics.js";
export { buildTaijiModelExpansionIntake } from "./taijiModelExpansionIntake.js";
export { buildUserOwnedCredentialRefSetupContract, PROVIDER_EXPANSION_ALLOWLIST, validateCredentialRefShape } from "./userOwnedCredentialRefSetup.js";
export { evaluateProviderCredentialReadiness } from "./providerCredentialReadinessGate.js";
export { buildDiscoveryApprovalSchema, validateDiscoveryApproval } from "./discoveryApprovalSchema.js";
export { runProviderDiscoveryAdapterV0 } from "./providerDiscoveryAdapterV0.js";
export { normalizeDiscoveryResult } from "./discoveryResultNormalizer.js";
export { buildSmokeApprovalSchema, validateSmokeApproval } from "./smokeApprovalSchema.js";
export { MODEL_SMOKE_MARKER, MODEL_SMOKE_PROMPT, runBoundedSmokeExecutorV0 } from "./boundedSmokeExecutorV0.js";
export { classifySmokeExecutorResult, classifySmokeResult } from "./smokeResultClassifier.js";
export { runSelectableCandidateGate } from "./selectableCandidateGate.js";
export { evaluateProviderCostQuotaGuard } from "./providerCostQuotaGuard.js";
export { buildProviderRateLimitTimeoutPolicy } from "./providerRateLimitTimeoutPolicy.js";
export { runHighRiskFailedDeprecatedGuard } from "./highRiskFailedDeprecatedGuard.js";
export { enrichModelCapabilities } from "./modelCapabilityEnrichment.js";
export { runCatalogMergeAliasResolverRecheck } from "./catalogMergeAliasResolverRecheck.js";
export { buildProviderExpansionEvidenceLedger } from "./providerExpansionEvidenceLedger.js";

export function buildGlobalModelLibraryExpansionContract() {
  return {
    phaseRange: "Phase761-780",
    name: "Global Model Library Expansion Foundation",
    runtimeEnabled: false,
    providerCallsMade: false,
    discoveryApiCalled: false,
    secretRead: false,
    authJsonRead: false,
    selectableModified: false,
    defaultChatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    currentBaseline: {
      matchedModelCount: 148,
      selectableModelCount: 17,
      smokePassedModelCount: 17,
      failedModelCount: 1,
      highRiskBlockedModelCount: 12,
    },
  };
}
