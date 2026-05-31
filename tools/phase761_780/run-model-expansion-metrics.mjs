import { buildModelExpansionMetrics } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, readJson, writeJson, writeText } from "./phase761-780-common.mjs";

const providerRegistry = readJson("apps/ai-gateway-service/evidence/model-library/global-provider-family-registry.json");
const seedPack = readJson("apps/ai-gateway-service/evidence/model-library/global-catalog-seed.json");
const dryRunImport = readJson("apps/ai-gateway-service/evidence/model-library/global-model-catalog-dry-run-import.json");
const aliasReport = readJson("apps/ai-gateway-service/evidence/model-library/model-alias-resolution-report.json");
const metrics = buildModelExpansionMetrics({ providerRegistry, seedPack, dryRunImport, aliasReport });

writeJson("apps/ai-gateway-service/evidence/model-library/model-expansion-metrics.json", metrics);
writeJson("apps/ai-gateway-service/evidence/phase761_780/model-expansion-metrics-result.json", {
  phase: "Phase777",
  completed: true,
  modelExpansionMetricsReady: true,
  ...metrics,
  ...baseSafety(),
});

writeText("docs/phase777-model-library-expansion-evidence-metrics.md", phaseDoc({
  phase: "Phase777",
  title: "Model Library Expansion Evidence / Metrics",
  goal: "生成模型扩容 evidence metrics，证明当前 17 个 selectable/smokePassed 未变化。",
  facts: [
    `currentMatchedModelCount=${metrics.currentMatchedModelCount}`,
    `currentSelectableModelCount=${metrics.currentSelectableModelCount}`,
    `currentSmokePassedModelCount=${metrics.currentSmokePassedModelCount}`,
    `providerFamilyCount=${metrics.providerFamilyCount}`,
    `catalogSeedModelCount=${metrics.catalogSeedModelCount}`,
    `dryRunImportedModelCount=${metrics.dryRunImportedModelCount}`,
  ],
  boundaries: ["newSelectableModelsAdded=0", "providerCallsMade=false", "secretRead=false"],
  outputs: [
    "apps/ai-gateway-service/evidence/model-library/model-expansion-metrics.json",
    "apps/ai-gateway-service/evidence/phase761_780/model-expansion-metrics-result.json",
  ],
}));

console.log(JSON.stringify({ phase: "Phase777", dryRunImportedModelCount: metrics.dryRunImportedModelCount, ...baseSafety() }, null, 2));
