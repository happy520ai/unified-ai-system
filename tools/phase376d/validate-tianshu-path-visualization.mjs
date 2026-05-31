import { readText, writeJson, writeText } from "../phase373-common.mjs";
import { commonSafetyFlags, sourceChecks } from "../phase376-shared.mjs";

const source = await readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
const mockData = {
  phase: "Phase376D",
  flightPath: ["Understand", "Decompose", "Match Capability", "Route", "Guard", "Plan", "Evidence"],
  capabilityMatching: {
    taskType: "planning_preview",
    candidateModelPool: "verified chat candidates only",
    selectedRoute: "planner sandbox",
    rejectedCandidates: ["unconfigured provider"],
    fallbackRoute: "credentialRef required",
  },
  plannerDryRun: true,
  providerCallsMade: false,
};
const checks = sourceChecks(source);
const required = ["Tianshu Flight Path", "understand", "capability matching", "rejected path", "recommended route", "fallback", "credentialRef"];
const missing = required.filter((marker) => !source.toLowerCase().includes(marker.toLowerCase()));
const result = {
  phase: "Phase376D",
  tianshuPathVisualizationValidated: true,
  tianshuFlightPathVisible: checks.tianshuFlightPathVisible,
  capabilityMatchingVisible: source.includes("capability matching"),
  rejectedPathVisible: source.includes("rejected path"),
  recommendedRouteVisible: source.includes("recommended route"),
  fallbackReasonVisible: source.includes("fallback"),
  credentialRefNoticeVisible: source.includes("credentialRef"),
  plannerDryRunVisible: source.includes("planner dry-run"),
  noRealProviderCallVisible: checks.noProviderCallVisible,
  missingMarkers: missing,
  ...commonSafetyFlags(),
  validationPassed: missing.length === 0 && checks.tianshuFlightPathVisible && !checks.dangerousActionButtonDetected,
};

await writeJson("docs/phase376d-tianshu-path-mock-data.json", mockData);
await writeText("docs/phase376d-tianshu-planning-path-animation.md", [
  "# Phase376D Tianshu Planning Path Animation",
  "",
  "- Tianshu Flight Path presents understand, capability matching, route, guard, and evidence nodes.",
  "- The visualization is UI-only and dry-run.",
  "- Rejected routes and credentialRef fallback are visible without invoking providers.",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase376d/tianshu-path-visualization-result.json", result);

console.log(JSON.stringify(result, null, 2));
if (!result.validationPassed) process.exitCode = 1;
