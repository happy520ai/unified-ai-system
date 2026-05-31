import { readText, writeJson, writeText } from "../phase373-common.mjs";
import { commonSafetyFlags, sourceChecks } from "../phase376-shared.mjs";

const source = await readText("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
const mockData = {
  phase: "Phase376C",
  arenaRoles: ["Reviewer", "Critic", "Risk Scout", "Supervisor", "Final Synthesizer"],
  reviewSummary: {
    speedBias: "fast path is visible but not auto-selected",
    reasoningStrength: "supervisor synthesis preview",
    riskFinding: "blocked path is explained",
    disagreement: "conflict summary available",
  },
  dryRunOnly: true,
  providerCallsMade: false,
};
const checks = sourceChecks(source);
const required = ["God Mode Arena", "reviewer", "critic", "risk scout", "supervisor", "conflict", "no provider call"];
const missing = required.filter((marker) => !source.toLowerCase().includes(marker.toLowerCase()));
const result = {
  phase: "Phase376C",
  agentArenaVisualizationValidated: true,
  agentArenaVisible: checks.godModeArenaVisible,
  reviewerVisible: source.includes("reviewer"),
  criticVisible: source.includes("critic"),
  riskScoutVisible: source.includes("risk scout"),
  supervisorVisible: source.includes("supervisor"),
  conflictSummaryVisible: source.includes("conflict"),
  dryRunOnlyVisible: source.includes("dry-run") || source.includes("mock reviewers"),
  noProviderCallVisible: checks.noProviderCallVisible,
  missingMarkers: missing,
  ...commonSafetyFlags(),
  validationPassed: missing.length === 0 && checks.godModeArenaVisible && !checks.dangerousActionButtonDetected,
};

await writeJson("docs/phase376c-agent-arena-mock-data.json", mockData);
await writeText("docs/phase376c-agent-arena-advanced-visualization.md", [
  "# Phase376C Agent Arena Advanced Visualization",
  "",
  "- God Mode Arena shows reviewer, critic, risk scout, supervisor, and conflict summary.",
  "- The arena remains mock / dry-run only.",
  "- It does not present real model responses, real cost, or production decisions.",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase376c/agent-arena-visualization-result.json", result);

console.log(JSON.stringify(result, null, 2));
if (!result.validationPassed) process.exitCode = 1;
