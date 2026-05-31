import {
  buildAggregatorProviderContract,
  buildCatalogBridgeDesign,
  buildChineseModelEcosystemCatalogPack,
  buildGlobalModelLibraryExpansionContract,
  buildLocalRuntimeProviderContract,
  buildModelCapabilityTagTaxonomy,
  buildModelRiskPolicy,
  buildModelStatusStateMachine,
  buildOpenAICompatibleImportContract,
  buildProviderDiscoveryAdapterContract,
  buildUserOwnedCredentialRefContract,
} from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, writeJson, writeText } from "./phase761-780-common.mjs";

const contract = buildGlobalModelLibraryExpansionContract();
const discoveryContract = buildProviderDiscoveryAdapterContract();
const aggregatorContract = buildAggregatorProviderContract();
const localRuntimeContract = buildLocalRuntimeProviderContract();
const credentialRefContract = buildUserOwnedCredentialRefContract();
const statusMachine = buildModelStatusStateMachine();
const capabilityTags = buildModelCapabilityTagTaxonomy();
const openAiCompatible = buildOpenAICompatibleImportContract();
const bridgeDesign = buildCatalogBridgeDesign();
const chineseCatalog = buildChineseModelEcosystemCatalogPack();
const riskPolicy = buildModelRiskPolicy();

writeJson("apps/ai-gateway-service/evidence/phase761_780/global-model-library-contract-result.json", {
  phaseRange: "Phase761-780",
  contract,
  discoveryContract,
  aggregatorContract,
  localRuntimeContract,
  credentialRefContract,
  statusMachine,
  capabilityTags,
  openAiCompatible,
  bridgeDesign,
  chineseCatalog,
  riskPolicy,
  ...baseSafety(),
});

writeText("docs/phase761-global-model-library-expansion-contract.md", phaseDoc({
  phase: "Phase761",
  title: "Global Model Library Expansion Contract",
  goal: "建立全球模型库扩容总契约，用于后续 Provider family、catalog schema、dry-run import 和 Mission Control 只读展示。",
  facts: [
    "Baseline matchedModelCount=148, selectableModelCount=17, smokePassedModelCount=17, failedModelCount=1, highRiskBlockedModelCount=12.",
    "Global expansion is catalog/contract/dry-run only.",
  ],
  boundaries: ["runtimeEnabled=false", "providerCallsMade=false", "selectableModified=false"],
  outputs: ["apps/ai-gateway-service/evidence/phase761_780/global-model-library-contract-result.json"],
}));

writeText("docs/phase764-provider-discovery-adapter-contract.md", phaseDoc({
  phase: "Phase764",
  title: "Provider Discovery Adapter Contract",
  goal: "定义未来 Provider discovery adapter 的标准输出和安全边界。",
  facts: discoveryContract.requiredAdapterMethods,
  boundaries: discoveryContract.dryRunRules,
  outputs: ["providerDiscoveryAdapterContractReady=true"],
}));

writeText("docs/phase765-aggregator-provider-contract.md", phaseDoc({
  phase: "Phase765",
  title: "Aggregator Provider Contract",
  goal: "定义 OpenRouter、LiteLLM-compatible 等聚合器 catalog bridge 的只读契约。",
  facts: aggregatorContract.supportedFamilies.map((family) => `supported family: ${family}`),
  boundaries: Object.entries(aggregatorContract.requiredBoundaries).map(([key, value]) => `${key}=${value}`),
  outputs: ["aggregatorProviderContractReady=true"],
}));

writeText("docs/phase766-local-runtime-provider-contract.md", phaseDoc({
  phase: "Phase766",
  title: "Local Runtime Provider Contract",
  goal: "定义 Ollama、LM Studio、private vLLM 的本地 runtime catalog 契约。",
  facts: localRuntimeContract.supportedFamilies.map((family) => `supported local family: ${family}`),
  boundaries: localRuntimeContract.localRuntimeRules,
  outputs: ["localRuntimeProviderContractReady=true"],
}));

writeText("docs/phase767-user-owned-credentialref-model-access-contract.md", phaseDoc({
  phase: "Phase767",
  title: "User-owned CredentialRef Model Access Contract",
  goal: "定义用户自有 API Key 的 credentialRef-only 接入协议。",
  facts: credentialRefContract.requiredFields.map((field) => `required field: ${field}`),
  boundaries: credentialRefContract.forbiddenFields.map((field) => `forbidden raw field: ${field}`),
  outputs: ["userOwnedCredentialRefContractReady=true"],
}));

writeText("docs/phase768-model-status-state-machine.md", phaseDoc({
  phase: "Phase768",
  title: "Model Status State Machine",
  goal: "建立 discovered 到 selectable 的模型状态机和失败态。",
  facts: [`happyPath=${statusMachine.happyPath.join(" -> ")}`, `failureStates=${statusMachine.failureStates.join(", ")}`],
  boundaries: ["dryRunDefaultMaxStatus=credential_missing", "selectable requires future smoke evidence"],
  outputs: ["modelStatusStateMachineReady=true"],
}));

writeText("docs/phase769-model-capability-tag-taxonomy.md", phaseDoc({
  phase: "Phase769",
  title: "Model Capability Tag Taxonomy",
  goal: "建立统一模型能力标签体系。",
  facts: capabilityTags.tags.map((tag) => `capability tag: ${tag}`),
  boundaries: ["seedTagInferenceIsHeuristic=true", "task tool tags cannot enter ordinary Chat dropdown without future gate"],
  outputs: ["modelCapabilityTagTaxonomyReady=true"],
}));

writeText("docs/phase771-openai-compatible-provider-import-contract.md", phaseDoc({
  phase: "Phase771",
  title: "OpenAI-compatible Provider Import Contract",
  goal: "定义 OpenAI-compatible provider catalog import 契约。",
  facts: openAiCompatible.supportedSurface,
  boundaries: ["rawSecretAllowed=false", "rawBaseUrlValueExposed=false", "defaultImportedStatus=credential_missing"],
  outputs: ["openAICompatibleImportContractReady=true"],
}));

writeText("docs/phase772-litellm-openrouter-compatible-catalog-bridge-design.md", phaseDoc({
  phase: "Phase772",
  title: "LiteLLM / OpenRouter-compatible Catalog Bridge Design",
  goal: "设计 LiteLLM / OpenRouter compatible catalog bridge，不调用任何 API。",
  facts: bridgeDesign.bridgeContracts.map((item) => `${item.bridgeId}: ${item.mode}`),
  boundaries: ["openRouterApiCalled=false", "liteLlmApiCalled=false", "secretRead=false"],
  outputs: ["catalogBridgeDesignReady=true"],
}));

writeText("docs/phase773-chinese-model-ecosystem-catalog-pack.md", phaseDoc({
  phase: "Phase773",
  title: "Chinese Model Ecosystem Catalog Pack",
  goal: "覆盖中文模型生态 provider family seed。",
  facts: chineseCatalog.providerFamiliesCovered.map((family) => `covered family: ${family}`),
  boundaries: ["seed only", "no provider call", "no selectable activation"],
  outputs: ["chineseModelEcosystemCatalogPackReady=true"],
}));

writeText("docs/phase775-model-risk-block-deprecation-policy.md", phaseDoc({
  phase: "Phase775",
  title: "Model Risk / Block / Deprecation Policy",
  goal: "定义模型 high_risk、blocked、deprecated 判定策略。",
  facts: [`hardBlocks=${riskPolicy.hardBlocks.join(", ")}`, `highRiskReasons=${riskPolicy.highRiskReasons.join(", ")}`],
  boundaries: [riskPolicy.rule],
  outputs: ["modelRiskPolicyReady=true"],
}));

console.log(JSON.stringify({ phaseRange: "Phase761-780", contractDocsWritten: true, ...baseSafety() }, null, 2));
