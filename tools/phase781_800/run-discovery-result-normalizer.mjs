import { normalizeDiscoveryResult } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, readJson, writeJson, writeText } from "./phase781-800-common.mjs";

const discovery = readJson("provider-expansion/discovery/provider-discovery-result.json");
const normalized = normalizeDiscoveryResult(discovery);
const result = {
  ...normalized,
  completed: true,
  discoveryResultNormalizerReady: true,
  ...baseSafety(),
};
writeJson("provider-expansion/discovery/discovery-normalized-result.json", result);
writeJson("apps/ai-gateway-service/evidence/phase781_800/discovery-normalized-result.json", result);
writeText("docs/phase781-800/phase786-discovery-result-normalizer.md", phaseDoc({
  phase: "Phase786",
  title: "Discovery Result Normalizer",
  goal: "把 discovery 结果标准化为 Global Model Catalog record；无 discovery 时数量为 0。",
  facts: [`normalizedModelCount=${result.normalizedModelCount}`],
  boundaries: ["discovered does not mean smokePassed", "normalized models are not selectable"],
  outputs: ["provider-expansion/discovery/discovery-normalized-result.json"],
}));
console.log(JSON.stringify(result, null, 2));
