import { runCatalogMergeAliasResolverRecheck } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, readJson, writeJson, writeText } from "./phase781-800-common.mjs";

const seed = readJson("apps/ai-gateway-service/evidence/model-library/global-catalog-seed.json");
const enriched = readJson("apps/ai-gateway-service/evidence/model-library/provider-expansion/model-capability-enrichment-result.json");
const recheck = runCatalogMergeAliasResolverRecheck({ existingSeed: seed.models, expansionRecords: enriched.enriched });
const result = {
  ...recheck,
  completed: true,
  catalogMergeAliasResolverRecheckReady: true,
  ...baseSafety(),
};
writeJson("apps/ai-gateway-service/evidence/model-library/provider-expansion/catalog-merge-alias-recheck-result.json", result);
writeJson("apps/ai-gateway-service/evidence/phase781_800/catalog-merge-alias-recheck-result.json", result);
writeText("docs/phase781-800/phase795-global-catalog-merge-alias-resolver-recheck.md", phaseDoc({
  phase: "Phase795",
  title: "Global Catalog Merge + Alias Resolver Recheck",
  goal: "将 expansion records 与 Phase761-780 seed 做 dry-run merge 和 alias recheck。",
  facts: [`mergeInputCount=${result.mergeInputCount}`, `expansionRecordCount=${result.expansionRecordCount}`, `aliasCount=${result.aliasCount}`],
  boundaries: ["no selectable mutation", "dry-run merge only"],
  outputs: ["apps/ai-gateway-service/evidence/model-library/provider-expansion/catalog-merge-alias-recheck-result.json"],
}));
console.log(JSON.stringify(result, null, 2));
