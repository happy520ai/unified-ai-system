import { classifySmokeExecutorResult } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, readJson, writeJson, writeText } from "./phase781-800-common.mjs";

const smoke = readJson("provider-expansion/smoke/bounded-smoke-executor-result.json");
const classification = classifySmokeExecutorResult(smoke);
const result = {
  ...classification,
  completed: true,
  smokeResultClassifierReady: true,
  ...baseSafety(),
};
writeJson("provider-expansion/smoke/smoke-classification-result.json", result);
writeJson("apps/ai-gateway-service/evidence/phase781_800/smoke-classification-result.json", result);
writeText("docs/phase781-800/phase789-smoke-result-classifier.md", phaseDoc({
  phase: "Phase789",
  title: "Smoke Result Classifier",
  goal: "分类 smoke 结果，严格区分 pass、marker missing、provider error、credential invalid、rate limit、timeout、gate block、no approval。",
  facts: [`aggregateClassification=${result.aggregateClassification}`, `smokePassedNewModelCount=${result.smokePassedNewModelCount}`],
  boundaries: ["MODEL_SMOKE_OK marker required for pass", "marker missing is not pass"],
  outputs: ["provider-expansion/smoke/smoke-classification-result.json"],
}));
console.log(JSON.stringify(result, null, 2));
