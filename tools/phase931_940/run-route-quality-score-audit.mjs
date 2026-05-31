import { auditRouteQualityScores } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase931-940-common.mjs";

ensurePhaseDirs();
const result = {
  ...auditRouteQualityScores({ phase916930: readJsonIfPresent(paths.phase916RequiredFinal) || {} }),
  ...baseSafety(),
};

writeJson(paths.score, result);
writeJson(paths.qualityAuditLedger, result);
writeDoc("phase934-route-quality-score-audit.md", {
  title: "Phase934 Route Quality Score Audit",
  goal: "Audit derived route quality scores from the 5 Phase916-930 real route evidence records.",
  facts: [
    `routeQualityScoreCount=${result.routeQualityScoreCount}`,
    `averageScore=${result.averageScore}`,
    `scoreOutOfRangeCount=${result.scoreOutOfRangeCount}`,
  ],
  boundaries: ["Derived audit only.", "No route policy runtime change."],
  outputs: [paths.score, paths.qualityAuditLedger],
});
console.log(JSON.stringify(result, null, 2));
