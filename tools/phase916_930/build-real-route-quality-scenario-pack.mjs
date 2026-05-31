import { buildRealRouteQualityScenarioPack } from "../../packages/model-routing-engine/src/index.js";
import { ensurePhaseDirs, phaseDoc, scenarioPath, writeJson, writeText } from "./phase916-930-common.mjs";

ensurePhaseDirs();

const scenarioPack = buildRealRouteQualityScenarioPack();
writeJson(scenarioPath, scenarioPack);
writeText("docs/phase916-930/phase917-real-route-quality-scenario-pack.md", phaseDoc({
  title: "Phase917 Real Route Quality Scenario Pack",
  goal: "Prepare a small self-use scenario pack for future approved NVIDIA-only route quality testing.",
  facts: [
    `scenarioCount=${scenarioPack.scenarioCount}`,
    `maxTotalProviderRequestsPlanned=${scenarioPack.maxTotalProviderRequestsPlanned}`,
  ],
  boundaries: [
    "Scenario pack creation does not call Provider.",
    "Broader execution remains approval-gated.",
  ],
  outputs: [scenarioPath],
}));

console.log(JSON.stringify({
  scenarioPackReady: scenarioPack.scenarioPackReady,
  scenarioCount: scenarioPack.scenarioCount,
}, null, 2));
