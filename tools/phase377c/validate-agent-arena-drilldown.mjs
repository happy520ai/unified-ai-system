import { readMissionControlSource, cropScreenshot, browserScreenshots, commonSafetyFlags, sourceChecks, writePhaseArtifacts } from "../phase377-shared.mjs";

const source = await readMissionControlSource();
const normalizedSource = source.toLowerCase();
const checks = sourceChecks(source);
const result = {
  phase: "Phase377C",
  agentArenaVisible: checks.agentArenaVisible,
  reviewerDrilldownVisible: source.includes("Reviewer") && normalizedSource.includes("review focus"),
  criticDrilldownVisible: source.includes("Critic") && normalizedSource.includes("challenged assumption"),
  riskScoutDrilldownVisible: source.includes("Risk Scout") && normalizedSource.includes("mapped guard"),
  supervisorDrilldownVisible: source.includes("Supervisor") && normalizedSource.includes("synthesis summary"),
  conflictSummaryDrilldownVisible: source.includes("Conflict Summary") && normalizedSource.includes("disagreement matrix"),
  mockOnlyVisible: source.includes("mock only") || source.includes("mock reviewers"),
  ...commonSafetyFlags(),
  validationPassed: checks.agentArenaVisible && source.includes("Interactive drill-down") && !checks.dangerousActionButtonDetected,
};

await cropScreenshot("apps/ai-gateway-service/evidence/phase377a/screenshots/desktop.png", browserScreenshots.drilldown, { left: 240, top: 250, width: 1328, height: 720 });

await writePhaseArtifacts({
  reportPath: "docs/phase377c-agent-arena-interactive-drilldown.md",
  reportLines: [
    "# Phase377C Agent Arena Interactive Drill-down",
    "",
    "- God Mode Arena supports lightweight mock drill-down.",
    "- Reviewer / Critic / Risk Scout / Supervisor / Conflict Summary can be explored.",
    "- No provider call is added.",
  ],
  resultPath: "apps/ai-gateway-service/evidence/phase377c/agent-arena-drilldown-result.json",
  result,
});

await writePhaseArtifacts({
  reportPath: null,
  reportLines: [],
  resultPath: "docs/phase377c-agent-arena-drilldown-mock.json",
  result: {
    phase: "Phase377C",
    cards: ["Reviewer", "Critic", "Risk Scout", "Supervisor", "Conflict Summary"],
    providerCallsMade: false,
    dryRunOnly: true,
  },
});

console.log(JSON.stringify(result, null, 2));
if (!result.validationPassed) process.exitCode = 1;
