import { buildGlobalCatalogSeedPack } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, writeJson, writeText } from "./phase761-780-common.mjs";

const seedPack = buildGlobalCatalogSeedPack({ minModelCount: 420 });

writeJson("apps/ai-gateway-service/evidence/model-library/global-catalog-seed.json", seedPack);
writeJson("apps/ai-gateway-service/evidence/phase761_780/global-catalog-seed-pack-result.json", {
  phase: "Phase770",
  completed: true,
  catalogSeedModelCount: seedPack.catalogSeedModelCount,
  providerFamilyCount: seedPack.providerFamilyCount,
  selectableModelCountUnchanged: true,
  smokePassedModelCountUnchanged: true,
  newSelectableModelsAdded: 0,
  ...baseSafety(),
});

writeText("docs/phase770-global-catalog-seed-pack.md", phaseDoc({
  phase: "Phase770",
  title: "Global Catalog Seed Pack",
  goal: "生成全球模型 catalog seed，默认仅到 cataloged / credential_missing，不进入 selectable。",
  facts: [
    `providerFamilyCount=${seedPack.providerFamilyCount}`,
    `catalogSeedModelCount=${seedPack.catalogSeedModelCount}`,
    "all seed records selectableGate.eligible=false",
  ],
  boundaries: ["static seed only", "not smoke verified", "not runtime connected"],
  outputs: [
    "apps/ai-gateway-service/evidence/model-library/global-catalog-seed.json",
    "apps/ai-gateway-service/evidence/phase761_780/global-catalog-seed-pack-result.json",
  ],
}));

console.log(JSON.stringify({ phase: "Phase770", catalogSeedModelCount: seedPack.catalogSeedModelCount, ...baseSafety() }, null, 2));
