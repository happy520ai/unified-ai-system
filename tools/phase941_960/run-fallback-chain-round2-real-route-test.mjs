import { auditRound2Fallback } from "../../packages/model-routing-engine/src/index.js";
import { ensurePhaseDirs, paths, writeDoc, writeJson } from "./phase941-960-common.mjs";
import { runRound2Mode } from "./round2-runner.mjs";

ensurePhaseDirs();
const modeResult = await runRound2Mode({ mode: "fallback", outputPhase: "Phase947" });
const result = {
  ...modeResult,
  fallbackAudit: auditRound2Fallback({ fallbackResult: modeResult }),
};
writeJson(paths.fallback, result);
writeDoc("phase947-fallback-chain-round2-real-route-test.md", {
  title: "Phase947 Fallback Chain Round 2 Real Route Test",
  goal: "Run or block fallback Round 2 routes while keeping failed primary models excluded.",
  facts: [`providerCallsMade=${result.providerCallsMade}`, `realProviderRequestCount=${result.realProviderRequestCount}`, `blocker=${result.blocker}`],
  boundaries: ["Failed primary is simulated/excluded before runtime.", "Fallback uses eligible NVIDIA models only."],
  outputs: [paths.fallback],
});
console.log(JSON.stringify(result, null, 2));
