import { buildRound2ScenarioMatrix } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, paths, writeDoc, writeJson } from "./phase941-960-common.mjs";

ensurePhaseDirs();
const result = {
  ...buildRound2ScenarioMatrix(),
  ...baseSafety(),
  providerCallsMade: false,
  newProviderRequestsThisPhase: 0,
};

writeJson(paths.scenarioMatrix, result);
writeDoc("phase942-round2-scenario-matrix.md", {
  title: "Phase942 Round 2 Scenario Matrix",
  goal: "Prepare at least 12 Round 2 scenarios with mixed real and dry-run coverage under the 20-request cap.",
  facts: [
    `scenarioCount=${result.scenarioCount}`,
    `plannedRealProviderRequestCount=${result.plannedRealProviderRequestCount}`,
    `plannedDryRunScenarioCount=${result.plannedDryRunScenarioCount}`,
  ],
  boundaries: ["Scenario build does not call Provider.", "Dry-run scenarios are marked dryRunOnly."],
  outputs: [paths.scenarioMatrix],
});
console.log(JSON.stringify(result, null, 2));
