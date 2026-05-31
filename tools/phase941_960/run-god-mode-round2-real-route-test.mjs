import { ensurePhaseDirs, paths, writeDoc, writeJson } from "./phase941-960-common.mjs";
import { runRound2Mode } from "./round2-runner.mjs";

ensurePhaseDirs();
const result = await runRound2Mode({ mode: "god", outputPhase: "Phase945" });
writeJson(paths.god, result);
writeDoc("phase945-god-mode-round2-real-route-test.md", {
  title: "Phase945 God Mode Round 2 Real Route Test",
  goal: "Run or block God mode Round 2 routes under the approval gate.",
  facts: [`providerCallsMade=${result.providerCallsMade}`, `realProviderRequestCount=${result.realProviderRequestCount}`, `blocker=${result.blocker}`],
  boundaries: ["NVIDIA only.", "No retries."],
  outputs: [paths.god],
});
console.log(JSON.stringify(result, null, 2));
