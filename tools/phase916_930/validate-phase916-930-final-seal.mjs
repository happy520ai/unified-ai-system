import { existsSync, readFileSync } from "node:fs";
import { finalPath, repoPath, requiredFinalPath } from "./phase916-930-common.mjs";

const requiredFiles = [
  "packages/model-routing-engine/src/realRouteQualityApprovalGate.js",
  "packages/model-routing-engine/src/realRouteQualityScenarioPack.js",
  "packages/model-routing-engine/src/realRouteQualityEvidenceBuilder.js",
  "tools/phase916_930/build-real-route-quality-approval-gate.mjs",
  "tools/phase916_930/build-real-route-quality-scenario-pack.mjs",
  "tools/phase916_930/run-real-route-quality-gated-executor.mjs",
  "tools/phase916_930/validate-phase916-930-final-seal.mjs",
  "apps/ai-gateway-service/evidence/phase916_930/real-route-quality-approval-gate-result.json",
  "apps/ai-gateway-service/evidence/phase916_930/real-route-quality-scenario-pack.json",
  finalPath,
  requiredFinalPath,
];
const failures = [];
for (const file of requiredFiles) {
  if (!existsSync(repoPath(file))) failures.push(`missing:${file}`);
}

const result = readJson(finalPath);
const requiredResult = readJson(requiredFinalPath);
expect(result.phaseRange === "Phase916-930", "phase_range");
expect(result.completed === true, "completed");
expect(result.blocker === "phase916_930_approval_missing" || result.recommended_sealed === true || typeof result.blocker === "string", "honest_blocker_or_sealed");
expect(JSON.stringify(result) === JSON.stringify(requiredResult), "required_final_matches_canonical_final");
expect(result.totalProviderRequests <= 20, "request_limit");
expect(result.maxTotalProviderRequestsRespected === true, "request_limit_respected");
expect(result.maxRetries === 0, "retry_zero");
expect(result.maxRetriesRespected === true, "retry_respected");
expect(result.maxEstimatedCostUsdTotal <= 1, "budget_limit");
expect(result.budgetExceeded === false, "budget_not_exceeded");
expect(result.providerId === "nvidia", "nvidia_only");
expect(Array.isArray(result.providerAllowlist) && result.providerAllowlist.length === 1 && result.providerAllowlist[0] === "nvidia", "provider_allowlist");
expect(result.credentialRefOnly === true, "credential_ref_only");
expect(result.rawSecretRead === false, "raw_secret_false");
expect(result.secretValueExposed === false, "secret_false");
expect(result.authJsonRead === false, "auth_json_false");
expect(result.selectableModelCountBefore === result.selectableModelCountAfter, "selectable_count_stable");
expect(result.unauthorizedSelectableChangeDetected === false, "no_selectable_change");
expect(result.blockedHighRiskModelsExcluded === true, "blocked_high_risk_excluded");
expect(result.failedModelsExcluded === true, "failed_excluded");
expect(result.credentialMissingModelsExcludedFromRuntime === true, "credential_missing_excluded");
expect(result.chatBehaviorChangedByDefault === false, "chat_false");
expect(result.chatGatewayExecuteBehaviorChangedByDefault === false, "execute_false");
expect(result.deployExecuted === false, "deploy_false");
expect(result.releaseExecuted === false, "release_false");
expect(result.tagCreated === false, "tag_false");
expect(result.artifactUploaded === false, "artifact_false");
expect(result.unsupportedClaimCount === 0, "unsupported_zero");
expect(result.hallucinatedFactCount === 0, "hallucinated_zero");
if (result.recommended_sealed === true) {
  expect(result.realRouteQualityTestExecuted === true, "executed_when_sealed");
  expect(result.providerCallsMade === true, "provider_calls_when_sealed");
  expect(result.externalProviderApiCallConfirmed === true, "external_confirmed_when_sealed");
  expect(result.networkAttemptRecorded === true, "network_recorded_when_sealed");
  expect(result.responseSource === "external_provider", "external_response_source_when_sealed");
  expect(result.normalModeRouteTestPassed === true, "normal_passed_when_sealed");
  expect(result.godModeRouteTestPassed === true, "god_passed_when_sealed");
  expect(result.tianshuModeRouteTestPassed === true, "tianshu_passed_when_sealed");
  expect(result.fallbackRouteTestPassed === true, "fallback_passed_when_sealed");
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  providerCallsMade: result.providerCallsMade,
  totalProviderRequests: result.totalProviderRequests,
}, null, 2));

function readJson(relativePath) {
  return JSON.parse(readFileSync(repoPath(relativePath), "utf8"));
}

function expect(condition, label) {
  if (!condition) failures.push(label);
}
