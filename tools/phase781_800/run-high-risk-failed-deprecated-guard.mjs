import { runHighRiskFailedDeprecatedGuard } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, readJson, writeJson, writeText } from "./phase781-800-common.mjs";

const normalized = readJson("provider-expansion/discovery/discovery-normalized-result.json");
const guard = runHighRiskFailedDeprecatedGuard(normalized.normalizedModels);
const result = {
  ...guard,
  completed: true,
  ...baseSafety(),
};
writeJson("provider-expansion/blocked/high-risk-failed-deprecated-guard-result.json", result);
writeJson("apps/ai-gateway-service/evidence/phase781_800/high-risk-failed-deprecated-guard-result.json", result);
writeText("docs/phase781-800/phase793-high-risk-failed-deprecated-model-guard.md", phaseDoc({
  phase: "Phase793",
  title: "High-risk / Failed / Deprecated Model Guard",
  goal: "阻止 high-risk / failed / deprecated / blocked 模型进入 selectable。",
  facts: [`blockedModelCount=${result.blockedModelCount}`, "failedDeprecatedBlocked=true", "highRiskBlocked=true"],
  boundaries: ["blocked statuses cannot become selectable", "future manual review required"],
  outputs: ["provider-expansion/blocked/high-risk-failed-deprecated-guard-result.json"],
}));
console.log(JSON.stringify(result, null, 2));
