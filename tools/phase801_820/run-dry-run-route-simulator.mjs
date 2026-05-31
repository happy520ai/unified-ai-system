import { ROUTING_FIXTURES, runDryRunRouteSimulator } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, phaseDoc, readJson, writeJson, writeText } from "./phase801-820-common.mjs";

ensurePhaseDirs();
const index = readJson("apps/ai-gateway-service/evidence/phase801_820/model-capability-index-result.json");
const simulation = runDryRunRouteSimulator(ROUTING_FIXTURES, index);
const result = {
  ...simulation,
  completed: true,
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase801_820/dry-run-route-simulator-result.json", result);
writeText("docs/phase816-dry-run-route-simulator.md", phaseDoc({
  phase: "Phase816",
  title: "Dry-run Route Simulator",
  goal: "Run at least 10 task fixtures through dry-run routing and record route explanations.",
  facts: [`routeFixtureCount=${result.routeFixtureCount}`, `routeSimulationPassed=${result.routeSimulationPassed}`],
  boundaries: ["providerCallsMade=false", "dryRunOnly=true"],
  outputs: ["apps/ai-gateway-service/evidence/phase801_820/dry-run-route-simulator-result.json"],
}));

console.log(JSON.stringify({
  phase: result.phase,
  routeFixtureCount: result.routeFixtureCount,
  routeSimulationPassed: result.routeSimulationPassed,
  providerCallsMade: false,
}, null, 2));
