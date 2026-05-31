import { readFileSync } from "node:fs";
import { readJson, writeJson, pathExists, check, allPassed } from "../phase1903a/ownerAutomationSealCommon.mjs";

const approvalPath = "docs/phase1955p-owner-approval.input.json";
const examplePath = "docs/phase1955p-owner-approval.input.example.json";
const reportPath = "docs/phase1955p-guarded-real-provider-one-shot-rerun-report.md";
const boundaryDocPath = "docs/phase1955p-provider-call-boundary.md";
const classificationDocPath = "docs/phase1955p-one-shot-result-classification.md";
const executorPath = "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.js";
const gatePath = "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js";
const schemaPath = "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationSchema.js";
const runnerPath = "tools/phase1955p/run-guarded-real-provider-one-shot-rerun.mjs";
const oneShotPath = "apps/ai-gateway-service/evidence/phase1955p/guarded-real-provider-one-shot-rerun-result.json";
const boundaryPath = "apps/ai-gateway-service/evidence/phase1955p/provider-one-shot-rerun-safety-boundary.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1955p/phase1955p-seal-result.json";
const validationPath = "apps/ai-gateway-service/evidence/phase1955p/phase1955p-validation-result.json";

const forbiddenPatterns = [
  { id: "dot_env_read", pattern: /readFileSync\(\s*["']\.env["']\s*\)/iu },
  { id: "auth_json_read", pattern: /readFileSync\(\s*["']auth\.json["']\s*\)/iu },
  { id: "authorization_header_literal", pattern: /["']Authorization:["']/u },
  { id: "private_key_marker_literal", pattern: /["']-----BEGIN/u },
];

function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function findHits(path) {
  const text = readText(path);
  return forbiddenPatterns.filter((item) => item.pattern.test(text)).map((item) => ({ file: path, pattern: item.id }));
}

const oneShotRead = readJson(oneShotPath);
const boundaryRead = readJson(boundaryPath);
const sealRead = readJson(sealPath);
const oneShot = oneShotRead.data ?? {};
const boundary = boundaryRead.data ?? {};
const seal = sealRead.data ?? {};
const sourceHits = [executorPath, gatePath, schemaPath, runnerPath].flatMap(findHits);
const attemptCount = Number(seal.requestAttemptCount ?? 0);

const successChecks = [
  check("sealed_success_completed", seal.completed === true),
  check("sealed_success_recommended", seal.recommended_sealed === true),
  check("sealed_success_blocker_null", seal.blocker === null),
  check("guarded_real_provider_call_executed", seal.guardedRealProviderCallExecuted === true),
  check("provider_calls_made_true", seal.providerCallsMade === true),
  check("real_provider_network_attempted_true", seal.realProviderNetworkAttempted === true),
  check("request_attempt_count_one", attemptCount === 1),
  check("one_shot_provider_call_passed", seal.oneShotProviderCallPassed === true),
  check("expected_response_matched", seal.expectedResponseMatched === true),
  check("response_sanitized", seal.responseSanitized === true),
  check("provider_response_metadata_recorded", seal.providerResponseMetadataRecorded === true),
];

const failedChecks = [
  check("failure_completed_true", seal.completed === true),
  check("failure_recommended_false", seal.recommended_sealed === false),
  check("failure_blocker_expected", ["owner_approval_input_missing_or_invalid", "provider_one_shot_failed"].includes(seal.blocker)),
  check("failure_classified_true", seal.failureClassified === true),
  check("one_shot_provider_call_not_passed", seal.oneShotProviderCallPassed === false),
  check("request_attempt_count_valid", attemptCount === 0 || attemptCount === 1),
];

const isSuccessPath = seal.recommended_sealed === true;
const pathChecks = isSuccessPath ? successChecks : failedChecks;

const checks = [
  check("approval_input_exists", pathExists(approvalPath)),
  check("example_doc_exists", pathExists(examplePath)),
  check("report_doc_exists", pathExists(reportPath)),
  check("boundary_doc_exists", pathExists(boundaryDocPath)),
  check("classification_doc_exists", pathExists(classificationDocPath)),
  check("executor_exists", pathExists(executorPath)),
  check("gate_exists", pathExists(gatePath)),
  check("schema_exists", pathExists(schemaPath)),
  check("runner_exists", pathExists(runnerPath)),
  check("one_shot_evidence_parseable", oneShotRead.exists === true && oneShotRead.parseError === null),
  check("boundary_evidence_parseable", boundaryRead.exists === true && boundaryRead.parseError === null),
  check("seal_evidence_parseable", sealRead.exists === true && sealRead.parseError === null),
  check("forbidden_patterns_absent", sourceHits.length === 0, { sourceHits }),
  check("owner_approval_input_present", seal.ownerApprovalInputPresent === true),
  check("owner_approval_input_valid", seal.ownerApprovalInputValid === true),
  check("safe_internal_provider_executor_still_stub_false", seal.safeInternalProviderExecutorStillStub === false),
  check("provider_call_implementation_mode_real_bridge", seal.providerCallImplementationMode === "real_bridge"),
  check("retry_attempt_count_zero", seal.retryAttemptCount === 0),
  check("provider_id_nvidia", seal.providerId === "nvidia"),
  check("model_id_allowed", seal.modelId === "nvidia/llama-3.3-nemotron-super-49b-v1"),
  check("credential_ref_only_true", seal.credentialRefOnly === true),
  check("raw_secret_read_false", seal.rawSecretRead === false),
  check("auth_json_read_false", seal.authJsonRead === false),
  check("dot_env_read_false", seal.dotEnvRead === false),
  check("env_dumped_false", seal.envDumped === false),
  check("secret_value_exposed_false", seal.secretValueExposed === false),
  check("authorization_header_logged_false", seal.authorizationHeaderLogged === false),
  check("chat_route_modified_false", seal.chatRouteModified === false),
  check("chat_gateway_execute_modified_false", seal.chatGatewayExecuteModified === false),
  check("legacy_modified_false", seal.legacyModified === false),
  check("project_context_modified_false", seal.projectContextModified === false),
  check("deploy_release_tag_artifact_false", seal.deployExecuted === false && seal.releaseExecuted === false && seal.tagCreated === false && seal.artifactUploaded === false),
  check("commit_push_false", seal.commitCreated === false && seal.pushExecuted === false),
  check("provider_stability_verified_false", seal.providerStabilityVerified === false),
  check("multi_provider_stability_verified_false", seal.multiProviderStabilityVerified === false),
  check("readiness_claims_false", seal.productionReadyClaimed === false && seal.commercialReadyClaimed === false),
  check("workspace_clean_claimed_false", seal.workspaceCleanClaimed === false),
  check("request_limit_respected", seal.requestLimitRespected === true && attemptCount <= 1),
  check("boundary_matches_safety", boundary.rawSecretRead === false && boundary.authJsonRead === false && boundary.authorizationHeaderLogged === false),
  check("one_shot_matches_seal", oneShot.requestAttemptCount === seal.requestAttemptCount && oneShot.providerCallsMade === seal.providerCallsMade),
  ...pathChecks,
];

const verified = allPassed(checks);
const validation = {
  phase: "Phase1955P",
  name: "Guarded Real Provider One-Shot Rerun Verification",
  completed: true,
  recommended_sealed: verified && isSuccessPath,
  blocker: verified ? seal.blocker : "phase1955p_verification_failed",
  ownerApprovalInputPresent: seal.ownerApprovalInputPresent === true,
  ownerApprovalInputValid: seal.ownerApprovalInputValid === true,
  guardedRealProviderCallExecuted: seal.guardedRealProviderCallExecuted === true,
  providerCallsMade: seal.providerCallsMade === true,
  realProviderNetworkAttempted: seal.realProviderNetworkAttempted === true,
  requestAttemptCount: attemptCount,
  retryAttemptCount: Number(seal.retryAttemptCount ?? 0),
  oneShotProviderCallPassed: seal.oneShotProviderCallPassed === true,
  expectedResponseMatched: seal.expectedResponseMatched === true,
  failureClassified: seal.failureClassified === true,
  checks,
};

writeJson(validationPath, validation);
console.log(JSON.stringify(validation, null, 2));

if (!verified || (isSuccessPath && validation.recommended_sealed !== true)) {
  process.exitCode = 1;
}
