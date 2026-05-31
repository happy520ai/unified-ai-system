import { auditFallbackReliability } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase931-940-common.mjs";

ensurePhaseDirs();
const result = {
  ...auditFallbackReliability({ phase916930: readJsonIfPresent(paths.phase916RequiredFinal) || {} }),
  ...baseSafety(),
};

writeJson(paths.fallback, result);
writeDoc("phase936-fallback-reliability-audit.md", {
  title: "Phase936 Fallback Reliability Audit",
  goal: "Audit whether fallback used a verified NVIDIA chat model and excluded failed or blocked models.",
  facts: [
    `fallbackRouteTestPassed=${result.fallbackRouteTestPassed}`,
    `fallbackTriggerReason=${result.fallbackTriggerReason}`,
    `fallbackEvidenceComplete=${result.fallbackEvidenceComplete}`,
  ],
  boundaries: ["No failed model is called.", "No new fallback runtime policy is applied."],
  outputs: [paths.fallback],
});
console.log(JSON.stringify(result, null, 2));
