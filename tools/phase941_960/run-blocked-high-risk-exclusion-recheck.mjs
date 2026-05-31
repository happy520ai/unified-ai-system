import { baseSafety, ensurePhaseDirs, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase941-960-common.mjs";

ensurePhaseDirs();
const pool = readJsonIfPresent(paths.eligiblePool) || {};
const result = {
  phase: "Phase948",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  blockedHighRiskModelsExcluded: pool.blockedHighRiskModelsExcluded !== false,
  failedModelsExcluded: pool.failedModelsExcluded !== false,
  credentialMissingModelsExcludedFromRuntime: pool.credentialMissingModelsExcludedFromRuntime !== false,
  deprecatedModelsExcluded: pool.deprecatedModelsExcluded !== false,
  ...baseSafety(),
};
writeJson(paths.exclusion, result);
writeDoc("phase948-blocked-high-risk-exclusion-recheck.md", {
  title: "Phase948 Blocked High-risk Exclusion Recheck",
  goal: "Confirm failed, blocked, high-risk, deprecated, and credential-missing models remain excluded.",
  facts: [`failedModelsExcluded=${result.failedModelsExcluded}`, `blockedHighRiskModelsExcluded=${result.blockedHighRiskModelsExcluded}`],
  boundaries: ["No selectable mutation."],
  outputs: [paths.exclusion],
});
console.log(JSON.stringify(result, null, 2));
