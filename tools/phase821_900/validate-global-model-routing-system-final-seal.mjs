import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

function readJson(relativePath) {
  const path = repoPath(relativePath);
  if (!existsSync(path)) {
    throw new Error(`missing required file: ${relativePath}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const finalResult = readJson("apps/ai-gateway-service/evidence/phase821_900/global-model-routing-system-final-result.json");
const requiredFiles = [
  "tools/phase821_900/run-selectable-admission-gate.mjs",
  "tools/phase821_900/run-guarded-real-route-executor.mjs",
  "tools/phase821_900/run-route-evidence-ledger.mjs",
  "tools/phase821_900/run-route-failure-classifier.mjs",
  "tools/phase821_900/run-route-rollback-disable.mjs",
  "tools/phase821_900/run-route-quality-scoring.mjs",
  "tools/phase821_900/run-surrogate-soak-runner.mjs",
  "tools/phase821_900/run-god-tianshu-ensemble-optimizer.mjs",
  "tools/phase821_900/run-global-model-continuous-refresh.mjs",
  "tools/phase821_900/run-routing-learning-regression.mjs",
  "tools/phase821_900/run-final-integrated-evidence-audit.mjs",
  "apps/ai-gateway-service/src/ui/components/RealModelRoutingPanel.js",
  "apps/ai-gateway-service/src/ui/components/ModelRoutingSurrogateSoakPanel.js",
  "apps/ai-gateway-service/src/ui/components/GodTianshuEnsemblePanel.js",
  "apps/ai-gateway-service/src/ui/components/GlobalModelOpsPanel.js",
  "apps/ai-gateway-service/src/ui/copy/realModelRoutingCopy.js",
  "apps/ai-gateway-service/src/ui/copy/modelRoutingSurrogateSoakCopy.js",
  "apps/ai-gateway-service/src/ui/copy/godTianshuEnsembleCopy.js",
  "apps/ai-gateway-service/src/ui/copy/globalModelOpsCopy.js",
  "docs/phase821-900/global-model-routing-system.md",
];

for (const file of requiredFiles) {
  assert(existsSync(repoPath(file)), `missing required file: ${file}`);
}

assert(finalResult.phaseRange === "Phase821-900", "phaseRange must be Phase821-900");
assert(finalResult.completed === true, "completed must be true");
assert(finalResult.blocker === null || typeof finalResult.blocker === "string", "blocker must be null or string");
assert(finalResult.routeEvidenceLedgerReady === true, "routeEvidenceLedgerReady must be true");
assert(finalResult.routeQualityScoringReady === true, "routeQualityScoringReady must be true");
assert(finalResult.surrogateSoakCompleted === true, "surrogateSoakCompleted must be true");
assert(finalResult.codexSurrogateReviewed === true, "codexSurrogateReviewed must be true");
assert(finalResult.humanReviewed === false, "humanReviewed must be false");
assert(finalResult.realSevenDaySoakCompleted === false, "realSevenDaySoakCompleted must be false");
assert(finalResult.godTianshuEnsembleOptimized === true, "godTianshuEnsembleOptimized must be true");
assert(finalResult.globalModelContinuousRefreshReady === true, "globalModelContinuousRefreshReady must be true");
assert(finalResult.routingLearningReady === true, "routingLearningReady must be true");
assert(finalResult.selectableDriftGuardPassed === true, "selectableDriftGuardPassed must be true");
assert(finalResult.blockedHighRiskModelsExcluded === true, "blockedHighRiskModelsExcluded must be true");
assert(finalResult.failedModelsExcluded === true, "failedModelsExcluded must be true");
assert(finalResult.credentialMissingModelsExcludedFromRuntime === true, "credentialMissingModelsExcludedFromRuntime must be true");
assert(finalResult.maxTotalProviderRequestsRespected === true, "maxTotalProviderRequestsRespected must be true");
assert(finalResult.budgetExceeded === false, "budgetExceeded must be false");
assert(finalResult.rawSecretRead === false, "rawSecretRead must be false");
assert(finalResult.secretValueExposed === false, "secretValueExposed must be false");
assert(finalResult.authJsonRead === false, "authJsonRead must be false");
assert(finalResult.credentialRefOnly === true, "credentialRefOnly must be true");
assert(finalResult.unauthorizedSelectableChangeDetected === false, "unauthorizedSelectableChangeDetected must be false");
assert(finalResult.chatBehaviorChangedByDefault === false, "chatBehaviorChangedByDefault must be false");
assert(finalResult.chatGatewayExecuteBehaviorChangedByDefault === false, "chatGatewayExecuteBehaviorChangedByDefault must be false");
assert(finalResult.deployExecuted === false, "deployExecuted must be false");
assert(finalResult.releaseExecuted === false, "releaseExecuted must be false");
assert(finalResult.tagCreated === false, "tagCreated must be false");
assert(finalResult.artifactUploaded === false, "artifactUploaded must be false");
assert(finalResult.totalProviderRequests <= 30, "totalProviderRequests must respect cap");
assert(finalResult.estimatedCostUsdTotal <= finalResult.maxEstimatedCostUsdTotal, "estimated cost must respect cap");

if (finalResult.recommended_sealed === true) {
  assert(finalResult.blocker === null, "sealed result must not have blocker");
  assert(finalResult.guardedRealRoutingReady === true, "sealed result requires guarded real routing ready");
  assert(finalResult.normalModeRealRouteReady === true, "sealed result requires normal real route ready");
  assert(finalResult.godModeRealRouteReady === true, "sealed result requires god real route ready");
  assert(finalResult.tianshuModeRealRouteReady === true, "sealed result requires tianshu real route ready");
  assert(finalResult.fallbackRuntimeReady === true, "sealed result requires fallback runtime ready");
  assert(finalResult.providerCallsMade === true, "sealed guarded real routing must record providerCallsMade=true");
}

console.log(JSON.stringify({
  phaseRange: finalResult.phaseRange,
  passed: true,
  completed: finalResult.completed,
  recommended_sealed: finalResult.recommended_sealed,
  blocker: finalResult.blocker,
  providerCallsMade: finalResult.providerCallsMade,
  totalProviderRequests: finalResult.totalProviderRequests,
  credentialRefOnly: finalResult.credentialRefOnly,
}, null, 2));
