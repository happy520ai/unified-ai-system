import { existsSync, readFileSync } from "node:fs";
import { finalPath, repoPath } from "./phase912-915-common.mjs";

const requiredFiles = [
  "packages/model-routing-engine/src/credentialRefSecureResolver.js",
  "packages/model-routing-engine/src/isolatedSecretInjectionAdapter.js",
  "packages/model-routing-engine/src/secretRedactionBoundary.js",
  "packages/model-routing-engine/src/credentialRefInjectionAudit.js",
  "packages/model-routing-engine/src/phase911RerunAuthenticityBridge.js",
  "packages/model-routing-engine/src/routingAuthenticityEvidenceRebinder.js",
  "packages/model-routing-engine/src/realRouteQualityTestDecision.js",
  "tools/phase912_915/build-credentialref-secure-resolution-layer.mjs",
  "tools/phase912_915/run-isolated-secret-injection-dry-run.mjs",
  "tools/phase912_915/validate-credentialref-secure-resolution.mjs",
  "tools/phase912_915/rerun-phase911-real-external-provider-one-shot.mjs",
  "tools/phase912_915/build-phase913-authenticity-evidence.mjs",
  "tools/phase912_915/rebind-authenticity-confirmed-routing-evidence.mjs",
  "tools/phase912_915/build-real-route-quality-test-decision-packet.mjs",
  "tools/phase912_915/validate-phase912-915-final-seal.mjs",
  "docs/phase912-915/phase912-credentialref-secure-resolution-isolated-secret-injection.md",
  "docs/phase912-915/phase913-rerun-phase911-real-external-provider-one-shot.md",
  "docs/phase912-915/phase914-authenticity-confirmed-routing-evidence-rebind.md",
  "docs/phase912-915/phase915-real-route-quality-test-decision-packet.md",
  "docs/phase912-915/phase912-915-execution-report.md",
  "apps/ai-gateway-service/evidence/phase912_915/credentialref-secure-resolution-result.json",
  "apps/ai-gateway-service/evidence/phase912_915/isolated-secret-injection-dry-run-result.json",
  "apps/ai-gateway-service/evidence/phase912_915/phase913-real-external-provider-one-shot-result.json",
  "apps/ai-gateway-service/evidence/phase912_915/phase913-authenticity-evidence.json",
  "apps/ai-gateway-service/evidence/phase912_915/routing-authenticity-evidence-rebind-result.json",
  "apps/ai-gateway-service/evidence/phase912_915/real-route-quality-test-decision-packet.json",
  finalPath,
];
const failures = [];
for (const file of requiredFiles) {
  if (!existsSync(repoPath(file))) failures.push(`missing:${file}`);
}

const result = readJson(finalPath);
expect(result.phaseRange === "Phase912-915", "phase_range");
expect(result.completed === true, "completed");
expect(result.credentialRefSecureResolutionReady === true, "resolution_ready");
expect(result.isolatedSecretInjectionReady === true, "injection_ready");
expect(result.callerReceivesRawSecret === false, "caller_no_raw_secret");
expect(result.secretInjectedOnlyInsideBoundary === true, "inside_boundary");
expect(result.secretWrittenToEvidence === false, "secret_not_evidence");
expect(result.secretWrittenToLogs === false, "secret_not_logs");
expect(result.authJsonRead === false, "auth_json_false");
expect(result.credentialRefOnly === true, "credential_ref_only");
expect(result.requestAttemptCount <= 1, "request_count_lte_1");
expect(result.retryAttemptCount === 0, "retry_zero");
expect(result.budgetExceeded === false, "budget_false");
expect(result.rawSecretRead === false, "raw_secret_false");
expect(result.secretValueExposed === false, "secret_exposed_false");
expect(result.chatBehaviorChangedByDefault === false, "chat_unchanged");
expect(result.chatGatewayExecuteBehaviorChangedByDefault === false, "execute_unchanged");
expect(result.deployExecuted === false, "deploy_false");
expect(result.releaseExecuted === false, "release_false");
expect(result.tagCreated === false, "tag_false");
expect(result.artifactUploaded === false, "artifact_false");
expect(result.phase901910CorrectionPreserved === true, "correction_preserved");
expect(result.previousPhase821900Classification === "simulated_response", "previous_classification");
expect(result.originalEvidenceMutated === false, "original_not_mutated");
expect(result.requiresNewApprovalForBroaderTest === true, "broader_approval_required");
expect(result.unsupportedClaimCount === 0, "unsupported_zero");
expect(result.hallucinatedFactCount === 0, "hallucinated_zero");

if (result.recommended_sealed === true) {
  expect(result.blocker === null, "sealed_blocker_null");
  expect(result.phase913Executed === true, "phase913_executed");
  expect(result.externalProviderApiCallConfirmed === true, "external_confirmed");
  expect(result.networkAttemptRecorded === true, "network_recorded");
  expect(result.outboundTracePresent === true, "outbound_trace");
  expect(result.providerResponseReceived === true, "provider_response");
  expect(result.responseSource === "external_provider", "response_source_external");
  expect(result.authenticityClassification === "external_provider_api_confirmed", "classification_confirmed");
  expect(result.phase914RebindPerformed === true, "rebind_true");
  expect(result.readyForRealRouteQualityTest === true, "ready_quality_true");
} else {
  expect(typeof result.blocker === "string" && result.blocker.length > 0, "unsealed_blocker");
  expect(result.externalProviderApiCallConfirmed === false, "unsealed_not_confirmed");
  expect(result.readyForRealRouteQualityTest === false, "unsealed_not_quality_ready");
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
  externalProviderApiCallConfirmed: result.externalProviderApiCallConfirmed,
  requestAttemptCount: result.requestAttemptCount,
}, null, 2));

function readJson(relativePath) {
  return JSON.parse(readFileSync(repoPath(relativePath), "utf8"));
}

function expect(condition, label) {
  if (!condition) failures.push(label);
}
