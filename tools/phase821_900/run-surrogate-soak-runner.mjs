import { runSurrogateSoak } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, loadCapabilityIndex, writeJson, writePhaseDoc, phaseDoc } from "./phase821-900-common.mjs";

ensurePhaseDirs();
const capabilityIndex = loadCapabilityIndex();
const result = {
  ...runSurrogateSoak({ capabilityIndex }),
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase841_860/real-routing-surrogate-soak-final-result.json", result);
writeJson("model-routing/evidence/surrogate-soak-result.json", result);
writePhaseDoc("phase841-860-real-routing-surrogate-soak.md", phaseDoc({
  phase: "Phase841-860",
  title: "Real Routing Local Self-use Surrogate Soak",
  goal: "Run accelerated Codex surrogate routing checks without claiming human or long-duration soak.",
  facts: [
    `scenarioCount=${result.scenarioCount}`,
    `codexSurrogateReviewed=${result.codexSurrogateReviewed}`,
    `humanReviewed=${result.humanReviewed}`,
    `realSevenDaySoakCompleted=${result.realSevenDaySoakCompleted}`,
  ],
  boundaries: [
    "surrogate soak is accelerated local automation",
    "no Provider calls are made by surrogate dry-run scenarios",
    "blocked and credential-missing red-team cases remain blocked",
  ],
  outputs: ["apps/ai-gateway-service/evidence/phase841_860/real-routing-surrogate-soak-final-result.json"],
}));

console.log(JSON.stringify(result, null, 2));
