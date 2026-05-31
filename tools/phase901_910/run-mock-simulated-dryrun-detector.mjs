import { detectMockSimulatedDryRun } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, loadRouteEvidence, phaseDoc, writeJson, writePhaseDoc } from "./phase901-910-common.mjs";

ensurePhaseDirs();
const result = {
  ...detectMockSimulatedDryRun(loadRouteEvidence()),
  ...baseSafety(),
};
writeJson("apps/ai-gateway-service/evidence/phase901_910/mock-simulated-dryrun-detector-result.json", result);
writePhaseDoc("phase904-mock-simulated-dryrun-detector.md", phaseDoc({
  phase: "Phase904",
  title: "Mock / Simulated / Dry-run Detector",
  goal: "Detect mock, simulated, dry-run, local executor, fixture, static, and synthetic response markers.",
  facts: [`externalProviderConfirmationBlocked=${result.externalProviderConfirmationBlocked}`],
  boundaries: ["detector only", "does not mutate Phase821-900 evidence"],
  outputs: ["apps/ai-gateway-service/evidence/phase901_910/mock-simulated-dryrun-detector-result.json"],
}));
console.log(JSON.stringify(result, null, 2));
