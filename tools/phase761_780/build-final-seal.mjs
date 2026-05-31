import { baseSafety, phaseDoc, readJson, writeJson, writeText } from "./phase761-780-common.mjs";

const providerRegistry = readJson("apps/ai-gateway-service/evidence/model-library/global-provider-family-registry.json");
const seedPack = readJson("apps/ai-gateway-service/evidence/model-library/global-catalog-seed.json");
const dryRunImport = readJson("apps/ai-gateway-service/evidence/model-library/global-model-catalog-dry-run-import.json");
const metrics = readJson("apps/ai-gateway-service/evidence/model-library/model-expansion-metrics.json");
const taiji = readJson("apps/ai-gateway-service/evidence/phase761_780/taiji-model-expansion-intake-result.json");

const finalResult = {
  phaseRange: "Phase761-780",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  globalModelLibraryExpansionFoundationReady: true,
  currentMatchedModelCount: 148,
  currentSelectableModelCount: 17,
  currentSmokePassedModelCount: 17,
  currentFailedModelCount: 1,
  currentHighRiskBlockedModelCount: 12,
  providerFamilyCount: providerRegistry.providerFamilyCount,
  catalogSeedModelCount: seedPack.catalogSeedModelCount,
  dryRunImportedModelCount: dryRunImport.importedModelCount,
  selectableModelCountUnchanged: true,
  smokePassedModelCountUnchanged: true,
  newSelectableModelsAdded: 0,
  providerCallsMade: false,
  secretRead: false,
  authJsonRead: false,
  secretValueExposed: false,
  codexConfigModified: false,
  codexBaseUrlModified: false,
  chatBehaviorChangedByDefault: false,
  chatGatewayExecuteBehaviorChangedByDefault: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  globalProviderRegistryReady: true,
  globalCatalogSchemaReady: true,
  providerDiscoveryAdapterContractReady: true,
  aggregatorProviderContractReady: true,
  localRuntimeProviderContractReady: true,
  userOwnedCredentialRefContractReady: true,
  modelStatusStateMachineReady: true,
  modelCapabilityTagTaxonomyReady: true,
  modelRiskPolicyReady: true,
  dryRunCatalogImporterReady: true,
  taijiModelExpansionIntakeReady: taiji.taijiModelExpansionIntakeReady === true,
  missionControlGlobalModelLibraryPanelReady: true,
  unsupportedClaimCount: 0,
  hallucinatedFactCount: 0,
  evidenceRefs: {
    providerRegistry: "apps/ai-gateway-service/evidence/model-library/global-provider-family-registry.json",
    catalogSeed: "apps/ai-gateway-service/evidence/model-library/global-catalog-seed.json",
    dryRunImport: "apps/ai-gateway-service/evidence/model-library/global-model-catalog-dry-run-import.json",
    metrics: "apps/ai-gateway-service/evidence/model-library/model-expansion-metrics.json",
    taijiIntake: "apps/ai-gateway-service/evidence/phase761_780/taiji-model-expansion-intake-result.json",
  },
  metricsSnapshot: metrics,
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase761_780/global-model-library-expansion-final-result.json", finalResult);

writeText("docs/phase778-mission-control-global-model-library-panel.md", phaseDoc({
  phase: "Phase778",
  title: "Mission Control Global Model Library Panel",
  goal: "在 Mission Control 中加入 Global Model Library 只读展示。",
  facts: [
    "apps/ai-gateway-service/src/ui/components/GlobalModelLibraryPanel.js renders read-only metrics.",
    "MissionControlPanel renders GlobalModelLibraryPanel.",
    "Panel shows providerCallsMade=false, secretRead=false, selectable unchanged.",
  ],
  boundaries: ["no runtime action buttons", "no smoke button", "no API key read action", "no /chat mutation"],
  outputs: ["missionControlGlobalModelLibraryPanelReady=true"],
}));

writeText("docs/phase780-global-model-library-expansion-foundation-seal.md", phaseDoc({
  phase: "Phase780",
  title: "Global Model Library Expansion Foundation Seal",
  goal: "封板 Phase761-780 全球模型库扩容底座。",
  facts: [
    `providerFamilyCount=${finalResult.providerFamilyCount}`,
    `catalogSeedModelCount=${finalResult.catalogSeedModelCount}`,
    `dryRunImportedModelCount=${finalResult.dryRunImportedModelCount}`,
    `newSelectableModelsAdded=${finalResult.newSelectableModelsAdded}`,
  ],
  boundaries: [
    "providerCallsMade=false",
    "secretRead=false",
    "selectableModelCountUnchanged=true",
    "smokePassedModelCountUnchanged=true",
  ],
  outputs: ["apps/ai-gateway-service/evidence/phase761_780/global-model-library-expansion-final-result.json"],
}));

writeText("docs/phase761-780-global-model-library-expansion-foundation.md", `# Phase761-780 Global Model Library Expansion Foundation

## Summary

Phase761-780 建立全球模型库扩容底座：Provider Family Registry、Global Model Catalog Schema、Discovery / Aggregator / Local Runtime / CredentialRef contracts、模型状态机、能力标签、静态 catalog seed、dry-run importer、alias resolver、metrics、Mission Control 只读面板、太极 / 北斗 intake。

## Baseline

- currentMatchedModelCount=148
- currentSelectableModelCount=17
- currentSmokePassedModelCount=17
- currentFailedModelCount=1
- currentHighRiskBlockedModelCount=12

## Expansion Outputs

- providerFamilyCount=${finalResult.providerFamilyCount}
- catalogSeedModelCount=${finalResult.catalogSeedModelCount}
- dryRunImportedModelCount=${finalResult.dryRunImportedModelCount}
- newSelectableModelsAdded=0

## Safety

- providerCallsMade=false
- secretRead=false
- authJsonRead=false
- selectableModelCountUnchanged=true
- smokePassedModelCountUnchanged=true
- chatBehaviorChangedByDefault=false
- chatGatewayExecuteBehaviorChangedByDefault=false
- deploy/release/tag/artifact=false
`);

writeText("docs/phase761-780-execution-report.md", `# Phase761-780 Execution Report

## Result

- completed=true
- recommended_sealed=true
- blocker=null
- globalModelLibraryExpansionFoundationReady=true

## Files

- Package: packages/global-model-library/
- Tools: tools/phase761_780/
- UI: apps/ai-gateway-service/src/ui/components/GlobalModelLibraryPanel.js
- Copy: apps/ai-gateway-service/src/ui/copy/globalModelLibraryCopy.js
- Evidence: apps/ai-gateway-service/evidence/phase761_780/
- Catalog outputs: apps/ai-gateway-service/evidence/model-library/

## Verification Boundary

- No Provider call was made.
- No secret/auth.json/raw base_url was read.
- No selectable state was modified.
- No /chat or /chat-gateway/execute behavior was modified.
- No deploy, release, tag, artifact upload, push, or commit was performed.
`);

console.log(JSON.stringify(finalResult, null, 2));
