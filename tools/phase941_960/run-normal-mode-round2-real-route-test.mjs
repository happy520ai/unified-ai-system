import { ensurePhaseDirs, paths, writeDoc, writeJson } from "./phase941-960-common.mjs";
import { runRound2Mode } from "./round2-runner.mjs";

ensurePhaseDirs();
const result = await runRound2Mode({ mode: "normal", outputPhase: "Phase944" });
writeJson(paths.normal, result);
writeDoc("phase944-normal-mode-round2-real-route-test.md", {
  title: "Phase944 Normal Mode Round 2 Real Route Test",
  goal: "Run or block Normal mode Round 2 routes under the approval gate.",
  facts: [`providerCallsMade=${result.providerCallsMade}`, `realProviderRequestCount=${result.realProviderRequestCount}`, `blocker=${result.blocker}`],
  boundaries: ["NVIDIA only.", "No retries."],
  outputs: [paths.normal],
});
console.log(JSON.stringify(result, null, 2));
