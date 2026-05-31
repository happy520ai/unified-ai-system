import { readMissionControlSource, cropScreenshot, browserScreenshots, commonSafetyFlags, sourceChecks, writePhaseArtifacts } from "../phase377-shared.mjs";

const source = await readMissionControlSource();
const checks = sourceChecks(source);
const result = {
  phase: "Phase377D",
  planComparisonVisible: source.includes("Plan comparison"),
  fastPlanVisible: source.includes("Fast Plan"),
  balancedPlanVisible: source.includes("Balanced Plan"),
  deepReviewPlanVisible: source.includes("Deep Review Plan"),
  recommendedPlanVisible: source.includes("Recommended"),
  rejectedPathVisible: source.includes("rejected path"),
  fallbackReasonVisible: source.includes("fallback reason"),
  providerCallsMade: false,
  ...commonSafetyFlags(),
  validationPassed: source.includes("Plan comparison") && source.includes("credentialRef-only") && !checks.dangerousActionButtonDetected,
};

await cropScreenshot("apps/ai-gateway-service/evidence/phase377a/screenshots/desktop.png", browserScreenshots.comparison, { left: 236, top: 520, width: 1328, height: 620 });

await writePhaseArtifacts({
  reportPath: "docs/phase377d-tianshu-plan-comparison-viewer.md",
  reportLines: [
    "# Phase377D Tianshu Plan Comparison Viewer",
    "",
    "- Fast / Balanced / Deep Review plans are shown side by side.",
    "- Balanced is visually recommended without being loud.",
    "- Rejected path and fallback reason remain visible.",
  ],
  resultPath: "apps/ai-gateway-service/evidence/phase377d/tianshu-plan-comparison-result.json",
  result,
});

await writePhaseArtifacts({
  reportPath: null,
  reportLines: [],
  resultPath: "docs/phase377d-tianshu-plan-comparison-mock.json",
  result: {
    phase: "Phase377D",
    plans: ["fast", "balanced", "deepReview"],
    dryRunOnly: true,
    providerCallsMade: false,
  },
});

console.log(JSON.stringify(result, null, 2));
if (!result.validationPassed) process.exitCode = 1;
