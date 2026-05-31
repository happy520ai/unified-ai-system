import { ensurePhaseDirs, paths, writeDoc, writeJson } from "./phase941-960-common.mjs";
import { runRound2Mode } from "./round2-runner.mjs";

ensurePhaseDirs();
const result = await runRound2Mode({ mode: "tianshu", outputPhase: "Phase946" });
writeJson(paths.tianshu, result);
writeDoc("phase946-tianshu-mode-round2-real-route-test.md", {
  title: "Phase946 Tianshu Mode Round 2 Real Route Test",
  goal: "Run or block Tianshu mode Round 2 routes under the approval gate.",
  facts: [`providerCallsMade=${result.providerCallsMade}`, `realProviderRequestCount=${result.realProviderRequestCount}`, `blocker=${result.blocker}`],
  boundaries: ["NVIDIA only.", "No retries."],
  outputs: [paths.tianshu],
});
console.log(JSON.stringify(result, null, 2));
