import { resolveModelAliases } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, readJson, writeJson, writeText } from "./phase761-780-common.mjs";

const dryRun = readJson("apps/ai-gateway-service/evidence/model-library/global-model-catalog-dry-run-import.json");
const aliasReport = resolveModelAliases(dryRun.imported);

writeJson("apps/ai-gateway-service/evidence/model-library/model-alias-resolution-report.json", aliasReport);
writeJson("apps/ai-gateway-service/evidence/phase761_780/model-alias-resolution-result.json", {
  phase: "Phase774",
  completed: true,
  modelAliasResolverReady: true,
  inputModelCount: aliasReport.inputModelCount,
  dedupedModelCount: aliasReport.dedupedModelCount,
  aliasCount: aliasReport.aliasCount,
  ...baseSafety(),
});

writeText("docs/phase774-model-deduplication-alias-resolver.md", phaseDoc({
  phase: "Phase774",
  title: "Model Deduplication / Alias Resolver",
  goal: "建立模型去重和 alias resolver dry-run 报告。",
  facts: [
    `inputModelCount=${aliasReport.inputModelCount}`,
    `dedupedModelCount=${aliasReport.dedupedModelCount}`,
    `aliasCount=${aliasReport.aliasCount}`,
  ],
  boundaries: ["alias resolution is dry-run only", "canonical IDs do not imply runtime availability"],
  outputs: ["apps/ai-gateway-service/evidence/model-library/model-alias-resolution-report.json"],
}));

console.log(JSON.stringify({ phase: "Phase774", dedupedModelCount: aliasReport.dedupedModelCount, ...baseSafety() }, null, 2));
