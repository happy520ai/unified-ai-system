import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const REQUIRED_FILES = [
  "packages/global-model-library/package.json",
  "packages/global-model-library/src/index.js",
  "packages/global-model-library/src/providerFamilyRegistry.js",
  "packages/global-model-library/src/globalModelCatalogSchema.js",
  "packages/global-model-library/src/providerDiscoveryAdapterContract.js",
  "packages/global-model-library/src/aggregatorProviderContract.js",
  "packages/global-model-library/src/localRuntimeProviderContract.js",
  "packages/global-model-library/src/userOwnedCredentialRefContract.js",
  "packages/global-model-library/src/modelStatusStateMachine.js",
  "packages/global-model-library/src/modelCapabilityTags.js",
  "packages/global-model-library/src/globalCatalogSeedPack.js",
  "packages/global-model-library/src/openAICompatibleImportContract.js",
  "packages/global-model-library/src/catalogBridgeDesign.js",
  "packages/global-model-library/src/chineseModelEcosystemCatalog.js",
  "packages/global-model-library/src/modelAliasResolver.js",
  "packages/global-model-library/src/modelRiskPolicy.js",
  "packages/global-model-library/src/dryRunCatalogImporter.js",
  "packages/global-model-library/src/modelExpansionMetrics.js",
  "packages/global-model-library/src/taijiModelExpansionIntake.js",
  "tools/phase761_780/build-global-model-library-contract.mjs",
  "tools/phase761_780/build-provider-family-registry.mjs",
  "tools/phase761_780/build-global-model-catalog-schema.mjs",
  "tools/phase761_780/build-global-catalog-seed-pack.mjs",
  "tools/phase761_780/run-dry-run-catalog-importer.mjs",
  "tools/phase761_780/run-model-dedup-alias-resolver.mjs",
  "tools/phase761_780/run-model-expansion-metrics.mjs",
  "tools/phase761_780/run-taiji-model-expansion-intake.mjs",
  "apps/ai-gateway-service/src/ui/components/GlobalModelLibraryPanel.js",
  "apps/ai-gateway-service/src/ui/copy/globalModelLibraryCopy.js",
  "docs/phase761-global-model-library-expansion-contract.md",
  "docs/phase762-provider-family-registry.md",
  "docs/phase763-global-model-catalog-schema.md",
  "docs/phase764-provider-discovery-adapter-contract.md",
  "docs/phase765-aggregator-provider-contract.md",
  "docs/phase766-local-runtime-provider-contract.md",
  "docs/phase767-user-owned-credentialref-model-access-contract.md",
  "docs/phase768-model-status-state-machine.md",
  "docs/phase769-model-capability-tag-taxonomy.md",
  "docs/phase770-global-catalog-seed-pack.md",
  "docs/phase771-openai-compatible-provider-import-contract.md",
  "docs/phase772-litellm-openrouter-compatible-catalog-bridge-design.md",
  "docs/phase773-chinese-model-ecosystem-catalog-pack.md",
  "docs/phase774-model-deduplication-alias-resolver.md",
  "docs/phase775-model-risk-block-deprecation-policy.md",
  "docs/phase776-dry-run-catalog-importer.md",
  "docs/phase777-model-library-expansion-evidence-metrics.md",
  "docs/phase778-mission-control-global-model-library-panel.md",
  "docs/phase779-taiji-beidou-model-expansion-intake.md",
  "docs/phase780-global-model-library-expansion-foundation-seal.md",
  "docs/phase761-780-global-model-library-expansion-foundation.md",
  "docs/phase761-780-execution-report.md",
  "apps/ai-gateway-service/evidence/phase761_780/global-model-library-expansion-final-result.json",
  "apps/ai-gateway-service/evidence/phase761_780/provider-family-registry-result.json",
  "apps/ai-gateway-service/evidence/phase761_780/global-catalog-seed-pack-result.json",
  "apps/ai-gateway-service/evidence/phase761_780/dry-run-catalog-importer-result.json",
  "apps/ai-gateway-service/evidence/phase761_780/model-expansion-metrics-result.json",
  "apps/ai-gateway-service/evidence/phase761_780/taiji-model-expansion-intake-result.json",
  "apps/ai-gateway-service/evidence/model-library/global-catalog-seed.json",
  "apps/ai-gateway-service/evidence/model-library/global-provider-family-registry.json",
  "apps/ai-gateway-service/evidence/model-library/global-model-catalog-dry-run-import.json",
  "apps/ai-gateway-service/evidence/model-library/model-alias-resolution-report.json",
  "apps/ai-gateway-service/evidence/model-library/model-expansion-metrics.json",
];

const REQUIRED_FINAL_FLAGS = {
  completed: true,
  recommended_sealed: true,
  blocker: null,
  globalModelLibraryExpansionFoundationReady: true,
  currentMatchedModelCount: 148,
  currentSelectableModelCount: 17,
  currentSmokePassedModelCount: 17,
  currentFailedModelCount: 1,
  currentHighRiskBlockedModelCount: 12,
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
  taijiModelExpansionIntakeReady: true,
  missionControlGlobalModelLibraryPanelReady: true,
  unsupportedClaimCount: 0,
  hallucinatedFactCount: 0,
};

const REQUIRED_STATUSES = [
  "discovered",
  "cataloged",
  "credential_missing",
  "credential_ready",
  "smoke_pending",
  "smoke_passed",
  "selectable_candidate",
  "selectable",
  "failed",
  "high_risk",
  "blocked",
  "deprecated",
];

const failures = [];

for (const file of REQUIRED_FILES) {
  if (!existsSync(resolve(repoRoot, file))) {
    failures.push(`missing required file: ${file}`);
  }
}

const packageJson = readJsonIfPresent("package.json");
if (!packageJson?.scripts?.["verify:phase761-780-global-model-library-expansion"]) {
  failures.push("missing package script verify:phase761-780-global-model-library-expansion");
}
if (!packageJson?.scripts?.["run:phase761-780-global-model-library-expansion"]) {
  failures.push("missing package script run:phase761-780-global-model-library-expansion");
}

const finalResult = readJsonIfPresent("apps/ai-gateway-service/evidence/phase761_780/global-model-library-expansion-final-result.json");
if (finalResult) {
  for (const [key, expected] of Object.entries(REQUIRED_FINAL_FLAGS)) {
    if (finalResult[key] !== expected) {
      failures.push(`final result ${key} expected ${JSON.stringify(expected)} got ${JSON.stringify(finalResult[key])}`);
    }
  }
  if (Number(finalResult.providerFamilyCount) < 30) failures.push("providerFamilyCount must be >= 30");
  if (Number(finalResult.catalogSeedModelCount) < 400) failures.push("catalogSeedModelCount must be >= 400");
  if (Number(finalResult.dryRunImportedModelCount) < 400) failures.push("dryRunImportedModelCount must be >= 400");
}

const providerRegistry = readJsonIfPresent("apps/ai-gateway-service/evidence/model-library/global-provider-family-registry.json");
if (providerRegistry) {
  const families = providerRegistry.providerFamilies ?? [];
  if (!Array.isArray(families) || families.length < 30) failures.push("provider family registry must contain >= 30 families");
  for (const id of ["nvidia", "openai", "anthropic", "google-gemini", "openrouter", "litellm-compatible", "ollama-local", "siliconflow", "modelscope", "volcano-ark"]) {
    if (!families.some((family) => family.providerFamily === id)) failures.push(`provider family missing: ${id}`);
  }
}

const catalogSeed = readJsonIfPresent("apps/ai-gateway-service/evidence/model-library/global-catalog-seed.json");
if (catalogSeed) {
  const models = catalogSeed.models ?? [];
  if (!Array.isArray(models) || models.length < 400) failures.push("global catalog seed must contain >= 400 models");
  const invalidSelectable = models.filter((model) => model.selectableGate?.eligible === true || model.status === "selectable");
  if (invalidSelectable.length > 0) failures.push("global catalog seed must not add selectable models");
  const invalidStatus = models.filter((model) => !REQUIRED_STATUSES.includes(model.status));
  if (invalidStatus.length > 0) failures.push("global catalog seed contains invalid status values");
  const rawSecretAllowed = models.filter((model) => model.credentialPolicy?.rawSecretAllowed !== false);
  if (rawSecretAllowed.length > 0) failures.push("all seed models must disallow raw secrets");
}

const dryRunImport = readJsonIfPresent("apps/ai-gateway-service/evidence/model-library/global-model-catalog-dry-run-import.json");
if (dryRunImport) {
  if (dryRunImport.providerCallsMade !== false) failures.push("dry-run import providerCallsMade must be false");
  if (dryRunImport.secretRead !== false) failures.push("dry-run import secretRead must be false");
  if (Number(dryRunImport.importedModelCount) < 400) failures.push("dry-run importedModelCount must be >= 400");
  if (dryRunImport.newSelectableModelsAdded !== 0) failures.push("dry-run import must not add selectable models");
}

const panelSource = readTextIfPresent("apps/ai-gateway-service/src/ui/components/GlobalModelLibraryPanel.js");
if (panelSource) {
  for (const marker of [
    "Global Model Library",
    "providerCallsMade=false",
    "secretRead=false",
    "selectable unchanged",
  ]) {
    if (!panelSource.includes(marker)) failures.push(`GlobalModelLibraryPanel marker missing: ${marker}`);
  }
  for (const forbidden of ["立即接入 selectable", "立即真实 smoke", "读取 API key", "真实调用 Provider", "部署", "修改 /chat-gateway/execute"]) {
    if (panelSource.includes(forbidden)) failures.push(`GlobalModelLibraryPanel contains forbidden UI copy: ${forbidden}`);
  }
}

const missionControl = readTextIfPresent("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
if (missionControl && !missionControl.includes("renderGlobalModelLibraryPanel")) {
  failures.push("MissionControlPanel must render GlobalModelLibraryPanel");
}

if (failures.length > 0) {
  console.error(JSON.stringify({ phaseRange: "Phase761-780", passed: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  phaseRange: "Phase761-780",
  passed: true,
  completed: true,
  recommended_sealed: true,
  providerCallsMade: false,
  secretRead: false,
  selectableModified: false,
}, null, 2));

function readJsonIfPresent(relativePath) {
  const path = resolve(repoRoot, relativePath);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function readTextIfPresent(relativePath) {
  const path = resolve(repoRoot, relativePath);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}
