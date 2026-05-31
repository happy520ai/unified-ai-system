import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const PROVIDER_ID = "mimo";
const PROVIDER_DISPLAY_NAME = "MiMo Token Plan";
const ENDPOINT = "https://token-plan-cn.xiaomimimo.com/v1";

async function main() {
  console.log("[Phase3971A] Xiaomi Provider Readiness Matrix Generator");
  console.log("[Phase3971A] Scanning for provider id:", PROVIDER_ID);

  const sharedConfigPath = resolve(repoRoot, "packages/shared-config/src/index.js");
  const sharedConfig = await readFile(sharedConfigPath, "utf8");

  const adapterPath = resolve(repoRoot, "apps/ai-gateway-service/src/providers/httpLlmProviderAdapter.js");
  const adapterSource = await readFile(adapterPath, "utf8");

  const modelRegistryPath = resolve(repoRoot, "apps/ai-gateway-service/src/model-library/unifiedModelRegistry.js");
  const modelRegistrySource = await readFile(modelRegistryPath, "utf8");

  const credentialRefContractPath = resolve(repoRoot, "apps/ai-gateway-service/src/providers/credentialRefResolverRuntime.contract.js");
  const credentialRefContract = await readFile(credentialRefContractPath, "utf8");

  const safeExecutorContractPath = resolve(repoRoot, "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.contract.js");
  const safeExecutorContract = await readFile(safeExecutorContractPath, "utf8");

  const configDefinesMimo = sharedConfig.includes(`providerId: "${PROVIDER_ID}"`);
  const configEndpointMatch = sharedConfig.includes(ENDPOINT);
  const envKeyDefined = sharedConfig.includes("MIMO_API_KEY");
  const envModelDefined = sharedConfig.includes("MIMO_MODEL");
  const envBaseUrlDefined = sharedConfig.includes("MIMO_BASE_URL");
  const enableFunctionExists = sharedConfig.includes("shouldEnableMimoProvider");

  const adapterHasMimoHandling = adapterSource.includes(`target.providerId === "${PROVIDER_ID}"`);

  const modelRegistryEntry = modelRegistrySource.includes(`providerId: "${PROVIDER_ID}"`);
  const modelRegistryStatusMatch = modelRegistrySource.match(/providerId:\s*"mimo"[\s\S]*?status:\s*"([^"]+)"/);
  const modelRegistryStatus = modelRegistryStatusMatch ? modelRegistryStatusMatch[1] : "not-found";

  const credentialRefHasMimo = credentialRefContract.includes(PROVIDER_ID);
  const safeExecutorAllowsMimo = safeExecutorContract.includes(PROVIDER_ID);

  const smokeRunnerPath = resolve(repoRoot, "tools/phase3974a/run-xiaomi-one-shot-real-provider-smoke.mjs");
  let smokeRunnerExists = false;
  try {
    await readFile(smokeRunnerPath);
    smokeRunnerExists = true;
  } catch {
    smokeRunnerExists = false;
  }

  const blockers = [];
  if (!configDefinesMimo) blockers.push("shared_config_missing");
  if (!adapterHasMimoHandling) blockers.push("adapter_mimo_handling_missing");
  if (!modelRegistryEntry) blockers.push("model_registry_entry_missing");
  if (!credentialRefHasMimo) blockers.push("credentialref_mimo_not_in_allowlist");
  if (!safeExecutorAllowsMimo) blockers.push("safe_executor_mimo_not_allowed");
  if (!smokeRunnerExists) blockers.push("smoke_runner_not_yet_created");

  const matrix = {
    providerId: PROVIDER_ID,
    providerDisplayName: PROVIDER_DISPLAY_NAME,
    endpoint: ENDPOINT,
    adapterExists: adapterHasMimoHandling,
    adapterType: "httpLlmProviderAdapter",
    adapterMimoSpecificHandling: adapterHasMimoHandling,
    configDefinesProvider: configDefinesMimo,
    configEndpointMatch,
    envKeyDefined,
    envModelDefined,
    envBaseUrlDefined,
    enableFunctionExists,
    modelRegistryExists: modelRegistryEntry,
    modelRegistryStatus,
    credentialRefNameExists: credentialRefHasMimo,
    credentialRefInAllowlist: credentialRefHasMimo,
    safeExecutorAllowsProvider: safeExecutorAllowsMimo,
    smokeRunnerExists,
    selectableNow: false,
    realProviderCallAllowedNow: false,
    blockers,
    scanTimestamp: new Date().toISOString(),
  };

  const result = {
    completed: true,
    recommendedSealed: true,
    blocker: blockers.length > 0 ? blockers[0] : null,
    xiaomiProviderReadinessChecked: true,
    providerCallsMade: false,
    secretRead: false,
    rawSecretPrinted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    productionReadyClaimed: false,
    matrix,
  };

  const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-3971a-xiaomi-provider-readiness-matrix");
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, "result.json"), JSON.stringify(result, null, 2), "utf8");

  console.log("[Phase3971A] Provider ID:", PROVIDER_ID);
  console.log("[Phase3971A] Adapter exists:", adapterHasMimoHandling);
  console.log("[Phase3971A] Model registry exists:", modelRegistryEntry, "(status:", modelRegistryStatus + ")");
  console.log("[Phase3971A] CredentialRef in allowlist:", credentialRefHasMimo);
  console.log("[Phase3971A] Safe executor allows:", safeExecutorAllowsMimo);
  console.log("[Phase3971A] Smoke runner exists:", smokeRunnerExists);
  console.log("[Phase3971A] Selectable now:", false);
  console.log("[Phase3971A] Blockers:", blockers.length > 0 ? blockers.join(", ") : "none");
  console.log("[Phase3971A] Provider calls made: false");
  console.log("[Phase3971A] Secret read: false");
  console.log("[Phase3971A] Result written to evidence/phase-3971a-xiaomi-provider-readiness-matrix/result.json");

  return result;
}

main().catch((error) => {
  console.error("[Phase3971A] Fatal:", error.message);
  process.exit(1);
});
