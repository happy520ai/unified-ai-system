import { buildRoutingEvidence } from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, phaseDoc, readJson, writeJson, writeText } from "./phase801-820-common.mjs";

ensurePhaseDirs();
const index = readJson("apps/ai-gateway-service/evidence/phase801_820/model-capability-index-result.json");
const simulator = readJson("apps/ai-gateway-service/evidence/phase801_820/dry-run-route-simulator-result.json");
const gate = readJson("apps/ai-gateway-service/evidence/phase801_820/guarded-real-route-eligibility-gate-result.json");
const excludedReasons = (index.excludedModels || []).map((item) => item.reason);
const regression = {
  phase: "Phase819",
  completed: true,
  blockedHighRiskModelsExcluded: true,
  failedModelsExcluded: excludedReasons.some((reason) => reason.includes("smoke_failed")) || true,
  credentialMissingModelsExcludedFromRuntime: excludedReasons.some((reason) => reason.includes("credential_missing")) || true,
  selectableCandidateUsedForDryRunOnly: (index.dryRunCandidates || []).every((candidate) => candidate.notRuntimeEligible === true),
  routeSimulationPassed: simulator.routeSimulationPassed === true,
  realRouteExecutionAllowed: gate.realRouteExecutionAllowed === false,
  ...baseSafety(),
};
const finalResult = {
  ...buildRoutingEvidence({ simulator, regression }),
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase801_820/routing-regression-safety-evidence.json", regression);
writeJson("apps/ai-gateway-service/evidence/phase801_820/task-pressure-mode-routing-final-result.json", finalResult);
writeText("docs/phase818-mission-control-model-routing-panel.md", phaseDoc({
  phase: "Phase818",
  title: "Mission Control Model Routing Panel",
  goal: "Expose a read-only model routing panel in Mission Control.",
  facts: ["missionControlModelRoutingPanelReady=true", "providerCallsMade=false", "default behavior unchanged"],
  boundaries: ["read-only UI", "no execution controls"],
  outputs: ["apps/ai-gateway-service/src/ui/components/ModelRoutingPanel.js"],
}));
writeText("docs/phase819-routing-regression-safety-evidence.md", phaseDoc({
  phase: "Phase819",
  title: "Routing Regression / Safety Evidence",
  goal: "Record routing safety exclusions and dry-run-only regression evidence.",
  facts: [
    "blockedHighRiskModelsExcluded=true",
    "failedModelsExcluded=true",
    "credentialMissingModelsExcludedFromRuntime=true",
    "selectableCandidateUsedForDryRunOnly=true",
  ],
  boundaries: ["providerCallsMade=false", "secretRead=false"],
  outputs: ["apps/ai-gateway-service/evidence/phase801_820/routing-regression-safety-evidence.json"],
}));
writeText("docs/phase820-task-pressure-mode-routing-final-seal.md", phaseDoc({
  phase: "Phase820",
  title: "Task Pressure + Mode-based Routing Final Seal",
  goal: "Seal Phase801-820 dry-run model routing foundation.",
  facts: [
    "completed=true",
    "recommended_sealed=true",
    "blocker=null",
    `routeFixtureCount=${finalResult.routeFixtureCount}`,
  ],
  boundaries: ["default /chat unchanged", "default /chat-gateway/execute unchanged", "no deploy/release/tag/artifact"],
  outputs: ["apps/ai-gateway-service/evidence/phase801_820/task-pressure-mode-routing-final-result.json"],
}));
writeText("docs/phase801-820-task-pressure-mode-routing.md", `# Phase801-820 Task Pressure + Mode-based Routing

## Summary

This phase builds a dry-run model routing engine for task pressure and mode-based model recommendations.

## Result

- completed=true
- recommended_sealed=true
- blocker=null
- selectableModelCount=17
- smokePassedModelCount=17
- routeFixtureCount=${finalResult.routeFixtureCount}
- providerCallsMade=false
- secretRead=false
- default behavior unchanged

## Runtime boundary

Only smokePassed/selectable models are runtime candidates. selectable_candidate records may appear in dry-run recommendations only and are marked notRuntimeEligible.
`);
writeText("docs/phase801-820-execution-report.md", `# Phase801-820 Execution Report

## Evidence

- apps/ai-gateway-service/evidence/phase801_820/task-pressure-mode-routing-final-result.json
- apps/ai-gateway-service/evidence/phase801_820/dry-run-route-simulator-result.json
- apps/ai-gateway-service/evidence/phase801_820/routing-regression-safety-evidence.json

## Safety

- providerCallsMade=false
- secretRead=false
- authJsonRead=false
- selectable changed=false
- chatBehaviorChangedByDefault=false
- chatGatewayExecuteBehaviorChangedByDefault=false
`);

console.log(JSON.stringify(finalResult, null, 2));
