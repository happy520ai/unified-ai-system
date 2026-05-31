import { enrichModelCapabilities } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, readJson, writeJson, writeText } from "./phase781-800-common.mjs";

const normalized = readJson("provider-expansion/discovery/discovery-normalized-result.json");
const enriched = enrichModelCapabilities(normalized.normalizedModels);
const result = {
  ...enriched,
  completed: true,
  modelCapabilityEnrichmentReady: true,
  ...baseSafety(),
};
writeJson("apps/ai-gateway-service/evidence/model-library/provider-expansion/model-capability-enrichment-result.json", result);
writeJson("apps/ai-gateway-service/evidence/phase781_800/model-capability-enrichment-result.json", result);
writeText("docs/phase781-800/phase794-model-capability-enrichment.md", phaseDoc({
  phase: "Phase794",
  title: "Model Capability Enrichment from Discovery/Smoke",
  goal: "根据 discovery/smoke 结果补充能力标签；无新增模型时 enrichment count 为 0。",
  facts: [`enrichedModelCount=${result.enrichedModelCount}`],
  boundaries: ["capability enrichment does not imply selectable", "no provider call"],
  outputs: ["apps/ai-gateway-service/evidence/model-library/provider-expansion/model-capability-enrichment-result.json"],
}));
console.log(JSON.stringify(result, null, 2));
