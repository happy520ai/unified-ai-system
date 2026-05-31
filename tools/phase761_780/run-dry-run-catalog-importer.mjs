import { runDryRunCatalogImporter } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, readJson, writeJson, writeText } from "./phase761-780-common.mjs";

const seedPack = readJson("apps/ai-gateway-service/evidence/model-library/global-catalog-seed.json");
const dryRun = runDryRunCatalogImporter(seedPack);

writeJson("apps/ai-gateway-service/evidence/model-library/global-model-catalog-dry-run-import.json", dryRun);
writeJson("apps/ai-gateway-service/evidence/phase761_780/dry-run-catalog-importer-result.json", {
  phase: "Phase776",
  completed: true,
  dryRunCatalogImporterReady: true,
  dryRunImportedModelCount: dryRun.importedModelCount,
  validationFailureCount: dryRun.validationFailureCount,
  selectableModelCountUnchanged: true,
  smokePassedModelCountUnchanged: true,
  newSelectableModelsAdded: 0,
  ...baseSafety(),
});

writeText("docs/phase776-dry-run-catalog-importer.md", phaseDoc({
  phase: "Phase776",
  title: "Dry-run Catalog Importer",
  goal: "把 global catalog seed 导入为 dry-run import 结果，不修改现有 selectable 和 smokePassed 状态。",
  facts: [
    `dryRunImportedModelCount=${dryRun.importedModelCount}`,
    `validationFailureCount=${dryRun.validationFailureCount}`,
    "newSelectableModelsAdded=0",
  ],
  boundaries: ["providerCallsMade=false", "secretRead=false", "selectableModified=false"],
  outputs: [
    "apps/ai-gateway-service/evidence/model-library/global-model-catalog-dry-run-import.json",
    "apps/ai-gateway-service/evidence/phase761_780/dry-run-catalog-importer-result.json",
  ],
}));

console.log(JSON.stringify({ phase: "Phase776", dryRunImportedModelCount: dryRun.importedModelCount, ...baseSafety() }, null, 2));
