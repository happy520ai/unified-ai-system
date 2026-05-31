import { auditModeComparison } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase931-940-common.mjs";

ensurePhaseDirs();
const result = {
  ...auditModeComparison({
    phase916930: readJsonIfPresent(paths.phase916RequiredFinal) || {},
    scoreAudit: readJsonIfPresent(paths.score) || {},
  }),
  ...baseSafety(),
};

writeJson(paths.mode, result);
writeDoc("phase935-normal-god-tianshu-comparison-audit.md", {
  title: "Phase935 Normal God Tianshu Comparison Audit",
  goal: "Compare Normal, God, Tianshu, and fallback route quality without overclaiming from a 5-request sample.",
  facts: [
    `bestModeByQuality=${result.bestModeByQuality}`,
    `sampleSizeLimited=${result.sampleSizeLimited}`,
    `recommendationIsPreliminary=${result.recommendationIsPreliminary}`,
  ],
  boundaries: ["Preliminary comparison only.", "No default route change."],
  outputs: [paths.mode],
});
console.log(JSON.stringify(result, null, 2));
