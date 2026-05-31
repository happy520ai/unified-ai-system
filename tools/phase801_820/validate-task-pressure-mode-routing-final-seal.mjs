import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const REQUIRED_FILES = [
  "apps/ai-gateway-service/evidence/phase761_780/global-model-library-expansion-final-result.json",
  "apps/ai-gateway-service/evidence/phase781_800/user-owned-provider-expansion-final-result.json",
  "packages/model-routing-engine/package.json",
  "packages/model-routing-engine/src/index.js",
  "packages/model-routing-engine/src/modelRoutingContract.js",
  "packages/model-routing-engine/src/taskPressureClassifier.js",
  "packages/model-routing-engine/src/modeRoutingPolicy.js",
  "packages/model-routing-engine/src/modelCapabilityIndexBuilder.js",
  "packages/model-routing-engine/src/modelRoleAssignment.js",
  "packages/model-routing-engine/src/normalModeSelector.js",
  "packages/model-routing-engine/src/godModeReviewerPoolSelector.js",
  "packages/model-routing-engine/src/tianshuPlannerExecutorSelector.js",
  "packages/model-routing-engine/src/contextPressureRouting.js",
  "packages/model-routing-engine/src/costPressureRouting.js",
  "packages/model-routing-engine/src/latencyPressureRouting.js",
  "packages/model-routing-engine/src/reliabilityPressureRouting.js",
  "packages/model-routing-engine/src/providerFallbackPolicy.js",
  "packages/model-routing-engine/src/candidateScoringEngine.js",
  "packages/model-routing-engine/src/routeExplanationBuilder.js",
  "packages/model-routing-engine/src/dryRunRouteSimulator.js",
  "packages/model-routing-engine/src/guardedRealRouteEligibilityGate.js",
  "packages/model-routing-engine/src/routingFixtures.js",
  "packages/model-routing-engine/src/routingEvidenceBuilder.js",
  "tools/phase801_820/build-model-routing-contract.mjs",
  "tools/phase801_820/run-task-pressure-classifier.mjs",
  "tools/phase801_820/run-mode-routing-policy.mjs",
  "tools/phase801_820/run-model-capability-index-builder.mjs",
  "tools/phase801_820/run-model-role-assignment.mjs",
  "tools/phase801_820/run-normal-mode-selector.mjs",
  "tools/phase801_820/run-god-mode-reviewer-pool-selector.mjs",
  "tools/phase801_820/run-tianshu-planner-executor-selector.mjs",
  "tools/phase801_820/run-pressure-routing-pack.mjs",
  "tools/phase801_820/run-provider-fallback-policy.mjs",
  "tools/phase801_820/run-candidate-scoring-engine.mjs",
  "tools/phase801_820/run-route-explanation-builder.mjs",
  "tools/phase801_820/run-dry-run-route-simulator.mjs",
  "tools/phase801_820/run-guarded-real-route-eligibility-gate.mjs",
  "tools/phase801_820/run-routing-regression-safety-evidence.mjs",
  "tools/phase801_820/validate-task-pressure-mode-routing-final-seal.mjs",
  "apps/ai-gateway-service/src/ui/components/ModelRoutingPanel.js",
  "apps/ai-gateway-service/src/ui/copy/modelRoutingCopy.js",
  "apps/ai-gateway-service/evidence/phase801_820/task-pressure-mode-routing-final-result.json",
  "apps/ai-gateway-service/evidence/phase801_820/routing-regression-safety-evidence.json",
  "apps/ai-gateway-service/evidence/phase801_820/dry-run-route-simulator-result.json",
  "docs/phase801-model-routing-contract.md",
  "docs/phase802-task-pressure-classifier.md",
  "docs/phase803-mode-based-routing-policy.md",
  "docs/phase804-model-capability-index-builder.md",
  "docs/phase805-model-role-assignment-taxonomy.md",
  "docs/phase806-normal-mode-selector.md",
  "docs/phase807-god-mode-reviewer-pool-selector.md",
  "docs/phase808-tianshu-planner-executor-selector.md",
  "docs/phase809-context-pressure-routing.md",
  "docs/phase810-cost-pressure-routing.md",
  "docs/phase811-latency-pressure-routing.md",
  "docs/phase812-reliability-pressure-routing.md",
  "docs/phase813-provider-fallback-policy.md",
  "docs/phase814-candidate-scoring-engine.md",
  "docs/phase815-route-explanation-builder.md",
  "docs/phase816-dry-run-route-simulator.md",
  "docs/phase817-guarded-real-route-eligibility-gate.md",
  "docs/phase818-mission-control-model-routing-panel.md",
  "docs/phase819-routing-regression-safety-evidence.md",
  "docs/phase820-task-pressure-mode-routing-final-seal.md",
  "docs/phase801-820-task-pressure-mode-routing.md",
  "docs/phase801-820-execution-report.md",
];

const REQUIRED_FINAL_FLAGS = {
  phaseRange: "Phase801-820",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  modelRoutingEngineReady: true,
  taskPressureClassifierReady: true,
  modeRoutingPolicyReady: true,
  modelCapabilityIndexReady: true,
  modelRoleAssignmentReady: true,
  normalModeSelectorReady: true,
  godModeReviewerPoolSelectorReady: true,
  tianshuPlannerExecutorSelectorReady: true,
  candidateScoringEngineReady: true,
  routeExplanationBuilderReady: true,
  dryRunRouteSimulatorReady: true,
  guardedRealRouteEligibilityGateReady: true,
  missionControlModelRoutingPanelReady: true,
  selectableModelCount: 17,
  smokePassedModelCount: 17,
  routeFixtureCount: 10,
  routeSimulationPassed: true,
  blockedHighRiskModelsExcluded: true,
  failedModelsExcluded: true,
  credentialMissingModelsExcludedFromRuntime: true,
  selectableCandidateUsedForDryRunOnly: true,
  providerCallsMade: false,
  secretRead: false,
  authJsonRead: false,
  secretValueExposed: false,
  chatBehaviorChangedByDefault: false,
  chatGatewayExecuteBehaviorChangedByDefault: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  unsupportedClaimCount: 0,
  hallucinatedFactCount: 0,
};

const failures = [];

for (const file of REQUIRED_FILES) {
  if (!existsSync(resolve(repoRoot, file))) failures.push(`missing required file: ${file}`);
}

const packageJson = readJsonIfPresent("package.json");
if (!packageJson?.scripts?.["run:phase801-820-task-pressure-mode-routing"]) {
  failures.push("missing package script run:phase801-820-task-pressure-mode-routing");
}
if (!packageJson?.scripts?.["verify:phase801-820-task-pressure-mode-routing"]) {
  failures.push("missing package script verify:phase801-820-task-pressure-mode-routing");
}

const phase761 = readJsonIfPresent("apps/ai-gateway-service/evidence/phase761_780/global-model-library-expansion-final-result.json");
if (phase761?.completed !== true || phase761?.recommended_sealed !== true) {
  failures.push("Phase761-780 evidence must be sealed before routing phase");
}
const phase781 = readJsonIfPresent("apps/ai-gateway-service/evidence/phase781_800/user-owned-provider-expansion-final-result.json");
if (phase781?.completed !== true || phase781?.recommended_sealed !== true) {
  failures.push("Phase781-800 evidence must be sealed or gate ready before routing phase");
}

const finalResult = readJsonIfPresent("apps/ai-gateway-service/evidence/phase801_820/task-pressure-mode-routing-final-result.json");
if (finalResult) {
  for (const [key, expected] of Object.entries(REQUIRED_FINAL_FLAGS)) {
    if (finalResult[key] !== expected) {
      failures.push(`final result ${key} expected ${JSON.stringify(expected)} got ${JSON.stringify(finalResult[key])}`);
    }
  }
  if (finalResult.routeFixtureCount < 10) failures.push("routeFixtureCount must be >= 10");
  if (finalResult.newSelectableModelsAdded && finalResult.newSelectableModelsAdded !== 0) failures.push("newSelectableModelsAdded must stay 0");
}

const simulator = readJsonIfPresent("apps/ai-gateway-service/evidence/phase801_820/dry-run-route-simulator-result.json");
if (simulator) {
  if (simulator.routeFixtureCount < 10) failures.push("simulator routeFixtureCount must be >= 10");
  if (simulator.providerCallsMade !== false) failures.push("simulator providerCallsMade must be false");
  if (!Array.isArray(simulator.routes) || simulator.routes.some((route) => !route.routeExplanation)) {
    failures.push("every simulated route must include routeExplanation");
  }
  if (simulator.routes?.some((route) => route.dryRunOnly !== true)) failures.push("all simulated routes must be dryRunOnly");
}

const regression = readJsonIfPresent("apps/ai-gateway-service/evidence/phase801_820/routing-regression-safety-evidence.json");
if (regression) {
  for (const key of [
    "blockedHighRiskModelsExcluded",
    "failedModelsExcluded",
    "credentialMissingModelsExcludedFromRuntime",
    "selectableCandidateUsedForDryRunOnly",
  ]) {
    if (regression[key] !== true) failures.push(`regression ${key} must be true`);
  }
}

const panel = readTextIfPresent("apps/ai-gateway-service/src/ui/components/ModelRoutingPanel.js");
if (panel) {
  for (const marker of [
    "Model Routing",
    "task pressure",
    "mode recommendation",
    "providerCallsMade=false",
    "default behavior unchanged",
  ]) {
    if (!panel.includes(marker)) failures.push(`ModelRoutingPanel marker missing: ${marker}`);
  }
  for (const forbidden of [
    "立即真实调用",
    "把候选模型加入 selectable",
    "读取 API Key",
    "部署",
    "修改 /chat",
    "修改 /chat-gateway/execute",
  ]) {
    if (panel.includes(forbidden)) failures.push(`ModelRoutingPanel contains forbidden copy: ${forbidden}`);
  }
}

const missionControl = readTextIfPresent("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
if (missionControl && !missionControl.includes("renderModelRoutingPanel")) {
  failures.push("MissionControlPanel must render ModelRoutingPanel");
}

if (failures.length > 0) {
  console.error(JSON.stringify({ phaseRange: "Phase801-820", passed: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  phaseRange: "Phase801-820",
  passed: true,
  completed: true,
  recommended_sealed: true,
  routeFixtureCount: finalResult.routeFixtureCount,
  providerCallsMade: finalResult.providerCallsMade,
  secretRead: finalResult.secretRead,
  selectableModified: false,
}, null, 2));

function readJsonIfPresent(relativePath) {
  const path = resolve(repoRoot, relativePath);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function readTextIfPresent(relativePath) {
  const path = resolve(repoRoot, relativePath);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}
