import { existsSync, readFileSync } from "node:fs";
import { finalPath, oneShotPath, repoPath } from "./phase911-common.mjs";

const requiredFiles = [
  "packages/model-routing-engine/src/realExternalProviderOneShotAuthenticity.js",
  "packages/model-routing-engine/src/externalProviderOutboundTrace.js",
  "packages/model-routing-engine/src/externalProviderAuthenticityEvidence.js",
  "tools/phase911/build-real-external-provider-authenticity-approval.mjs",
  "tools/phase911/intake-real-external-provider-authenticity-approval.mjs",
  "tools/phase911/run-real-external-provider-one-shot-authenticity.mjs",
  "tools/phase911/build-real-external-provider-authenticity-evidence.mjs",
  "tools/phase911/validate-real-external-provider-one-shot-authenticity.mjs",
  "docs/phase911/phase911-real-external-provider-one-shot-authenticity-approval.md",
  "docs/phase911/phase911-real-external-provider-one-shot-authenticity-result.md",
  "docs/phase911/phase911-execution-report.md",
  "apps/ai-gateway-service/evidence/phase911/real-external-provider-authenticity-approval-result.json",
  "apps/ai-gateway-service/evidence/phase911/real-external-provider-one-shot-result.json",
  "apps/ai-gateway-service/evidence/phase911/real-external-provider-authenticity-evidence.json",
  "apps/ai-gateway-service/evidence/phase911/real-external-provider-one-shot-authenticity-final-result.json",
];

const missing = requiredFiles.filter((file) => !existsSync(repoPath(file)));
const finalResult = readJson(finalPath);
const oneShot = readJson(oneShotPath);
const failures = [];

if (missing.length) failures.push(`missing_files:${missing.join(",")}`);
expect(finalResult.phase === "Phase911-AIO", "phase");
expect(finalResult.completed === true, "completed");
expect(finalResult.realExternalProviderOneShotApprovalPresent === true, "approval_present");
expect(finalResult.authorizationComplete === true, "authorization_complete");
expect(finalResult.providerId === "nvidia", "provider_nvidia");
expect(typeof finalResult.modelId === "string" && finalResult.modelId.length > 0, "model_id_present");
expect(finalResult.credentialRefOnly === true, "credential_ref_only");
expect(finalResult.mockResponseUsed === false, "mock_false");
expect(finalResult.simulatedResponseUsed === false, "simulated_false");
expect(finalResult.dryRunOnly === false, "dry_run_false");
expect(finalResult.localExecutorOnly === false, "local_executor_false");
expect(finalResult.requestAttemptCount <= 1, "request_count_lte_1");
expect(finalResult.retryAttemptCount === 0, "retry_zero");
expect(finalResult.maxRequestsRespected === true, "max_requests_respected");
expect(finalResult.maxRetriesRespected === true, "max_retries_respected");
expect(finalResult.budgetExceeded === false, "budget_not_exceeded");
expect(finalResult.rawSecretRead === false, "raw_secret_false");
expect(finalResult.secretValueExposed === false, "secret_exposed_false");
expect(finalResult.authJsonRead === false, "auth_json_false");
expect(finalResult.chatBehaviorChangedByDefault === false, "chat_unchanged");
expect(finalResult.chatGatewayExecuteBehaviorChangedByDefault === false, "execute_unchanged");
expect(finalResult.deployExecuted === false, "deploy_false");
expect(finalResult.releaseExecuted === false, "release_false");
expect(finalResult.tagCreated === false, "tag_false");
expect(finalResult.artifactUploaded === false, "artifact_false");
expect(finalResult.phase901910CorrectionPreserved === true, "phase901910_correction_preserved");
expect(finalResult.previousPhase821900Classification === "simulated_response", "previous_classification_preserved");
expect(finalResult.unsupportedClaimCount === 0, "unsupported_claim_zero");
expect(finalResult.hallucinatedFactCount === 0, "hallucinated_fact_zero");

if (finalResult.recommended_sealed === true) {
  expect(finalResult.blocker === null, "sealed_blocker_null");
  expect(finalResult.externalProviderApiCallConfirmed === true, "external_confirmed");
  expect(finalResult.networkAttemptRecorded === true, "network_recorded");
  expect(finalResult.outboundTracePresent === true, "outbound_trace");
  expect(finalResult.providerResponseReceived === true, "provider_response");
  expect(finalResult.responseSource === "external_provider", "response_source_external");
  expect(finalResult.authenticityClassification === "external_provider_api_confirmed", "classification_confirmed");
  expect(oneShot.providerCallAttempted === true, "one_shot_attempted");
} else {
  expect(typeof finalResult.blocker === "string" && finalResult.blocker.length > 0, "unsealed_blocker_present");
  expect(finalResult.externalProviderApiCallConfirmed === false, "unsealed_not_confirmed");
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  recommended_sealed: finalResult.recommended_sealed,
  blocker: finalResult.blocker,
  externalProviderApiCallConfirmed: finalResult.externalProviderApiCallConfirmed,
  requestAttemptCount: finalResult.requestAttemptCount,
}, null, 2));

function readJson(relativePath) {
  return JSON.parse(readFileSync(repoPath(relativePath), "utf8"));
}

function expect(condition, label) {
  if (!condition) failures.push(label);
}
