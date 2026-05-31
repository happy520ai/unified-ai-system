import { readFileSync } from "node:fs";
import { allPassed, check, pathExists, readJson, writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const approvalInputPath = "docs/phase1955p-retry-owner-approval.input.json";
const approvalExamplePath = "docs/phase1955p-retry-owner-approval.input.example.json";
const reportDocPath = "docs/phase1955p-retry-guarded-nvidia-one-shot-report.md";
const boundaryDocPath = "docs/phase1955p-retry-provider-boundary.md";
const classificationDocPath = "docs/phase1955p-retry-result-classification.md";
const runnerPath = "tools/phase1955p_retry/run-guarded-nvidia-one-shot-timeout-retry.mjs";
const verifierPath = "tools/phase1955p_retry/verify-guarded-nvidia-one-shot-timeout-retry.mjs";
const resultPath = "apps/ai-gateway-service/evidence/phase1955p_retry/guarded-nvidia-one-shot-timeout-retry-result.json";
const boundaryPath = "apps/ai-gateway-service/evidence/phase1955p_retry/provider-timeout-retry-safety-boundary.json";
const validationPath = "apps/ai-gateway-service/evidence/phase1955p_retry/phase1955p-retry-validation-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1955p_retry/phase1955p-retry-seal-result.json";
const oldApprovalPath = "docs/phase1955p-owner-approval.input.json";
const executorPath = "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.js";
const envelopePath = "apps/ai-gateway-service/src/providers/safeProviderRequestEnvelope.js";
const sanitizerPath = "apps/ai-gateway-service/src/providers/safeProviderResponseSanitizer.js";
const gatePath = "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js";
const schemaPath = "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationSchema.js";

function readText(relativePath) {
  try {
    return readFileSync(relativePath, "utf8");
  } catch {
    return "";
  }
}

function findForbiddenStaticHits(relativePath) {
  const text = readText(relativePath);
  const patterns = [
    { id: "dot_env_exact_read", pattern: /readFileSync\(\s*["']\.env["']\s*\)/u },
    { id: "auth_json_exact_read", pattern: /readFileSync\(\s*["']auth\.json["']\s*\)/u },
    { id: "authorization_header_literal", pattern: /["']Authorization:["']/u },
    { id: "private_key_marker_literal", pattern: /["']-----BEGIN/u },
    { id: "dynamic_eval", pattern: /\beval\s*\(|new\s+Function\s*\(|vm\.runIn/u },
  ];
  return patterns.filter((item) => item.pattern.test(text)).map((item) => ({ file: relativePath, pattern: item.id }));
}

function safetyChecks(record, prefix) {
  return [
    check(`${prefix}_credential_ref_only_true`, record.credentialRefOnly === true),
    check(`${prefix}_raw_secret_read_false`, record.rawSecretRead === false),
    check(`${prefix}_auth_json_read_false`, record.authJsonRead === false),
    check(`${prefix}_dot_env_read_false`, record.dotEnvRead === false),
    check(`${prefix}_env_dumped_false`, record.envDumped === false),
    check(`${prefix}_secret_value_exposed_false`, record.secretValueExposed === false),
    check(`${prefix}_authorization_header_logged_false`, record.authorizationHeaderLogged === false),
    check(`${prefix}_chat_route_modified_false`, record.chatRouteModified === false),
    check(`${prefix}_chat_gateway_execute_modified_false`, record.chatGatewayExecuteModified === false),
    check(`${prefix}_legacy_modified_false`, record.legacyModified === false),
    check(`${prefix}_project_context_modified_false`, record.projectContextModified === false),
    check(`${prefix}_deploy_release_tag_artifact_false`, record.deployExecuted === false && record.releaseExecuted === false && record.tagCreated === false && record.artifactUploaded === false),
    check(`${prefix}_commit_push_false`, record.commitCreated === false && record.pushExecuted === false),
    check(`${prefix}_workspace_clean_claimed_false`, record.workspaceCleanClaimed === false),
  ];
}

const resultRead = readJson(resultPath);
const boundaryRead = readJson(boundaryPath);
const sealRead = readJson(sealPath);
const approvalRead = readJson(approvalInputPath);
const oldApprovalRead = readJson(oldApprovalPath);
const result = resultRead.data ?? {};
const boundary = boundaryRead.data ?? {};
const seal = sealRead.data ?? {};
const approval = approvalRead.data ?? {};
const staticHits = [runnerPath, verifierPath, executorPath, envelopePath, sanitizerPath, gatePath, schemaPath].flatMap(findForbiddenStaticHits);
const attemptCount = Number(seal.requestAttemptCount ?? 0);
const successPath = seal.recommended_sealed === true;

const requiredFiles = [
  approvalInputPath,
  approvalExamplePath,
  reportDocPath,
  boundaryDocPath,
  classificationDocPath,
  runnerPath,
  verifierPath,
  resultPath,
  boundaryPath,
  sealPath,
  executorPath,
  envelopePath,
  sanitizerPath,
  gatePath,
  schemaPath,
];

const commonChecks = [
  ...requiredFiles.map((file) => check(`file_exists:${file}`, pathExists(file))),
  check("approval_input_parseable", approvalRead.exists === true && approvalRead.parseError === null),
  check("result_parseable", resultRead.exists === true && resultRead.parseError === null),
  check("boundary_parseable", boundaryRead.exists === true && boundaryRead.parseError === null),
  check("seal_parseable", sealRead.exists === true && sealRead.parseError === null),
  check("forbidden_static_patterns_absent", staticHits.length === 0, { staticHits }),
  check("phase_completed", seal.completed === true),
  check("owner_approval_input_present", seal.ownerApprovalInputPresent === true),
  check("new_owner_approval_used", seal.newOwnerApprovalUsed === true),
  check("old_approval_reused_false", seal.oldApprovalReused === false),
  check("approval_phase_retry", approval.phase === "Phase1955P-Retry"),
  check("approval_decision_retry", approval.decision === "approved_execute_guarded_real_provider_one_shot_timeout_retry"),
  check("provider_id_nvidia", seal.providerId === "nvidia"),
  check("model_id_light_retry_candidate", seal.modelId === "nvidia/llama-3.1-nemotron-nano-8b-v1"),
  check("stream_false", seal.stream === false),
  check("timeout_ms_60000", Number(seal.timeoutMs ?? 0) === 60000),
  check("retry_attempt_count_zero", Number(seal.retryAttemptCount ?? -1) === 0),
  check("request_limit_respected", seal.requestLimitRespected === true && attemptCount <= 1),
  check("response_sanitized_true", seal.responseSanitized === true),
  check("provider_stability_verified_false", seal.providerStabilityVerified === false),
  check("multi_provider_stability_verified_false", seal.multiProviderStabilityVerified === false),
  check("production_commercial_claims_false", seal.productionReadyClaimed === false && seal.commercialReadyClaimed === false),
  check("old_approval_not_equal_current", oldApprovalRead.exists !== true || oldApprovalRead.data?.phase !== seal.phase),
  check("boundary_matches_result", boundary.requestAttemptCount === seal.requestAttemptCount && boundary.providerCallsMade === seal.providerCallsMade),
  check("result_matches_seal", result.requestAttemptCount === seal.requestAttemptCount && result.providerCallsMade === seal.providerCallsMade),
  ...safetyChecks(seal, "seal"),
  ...safetyChecks(boundary, "boundary"),
];

const successChecks = [
  check("success_recommended_sealed_true", seal.recommended_sealed === true),
  check("success_blocker_null", seal.blocker === null),
  check("owner_approval_input_valid", seal.ownerApprovalInputValid === true),
  check("guarded_real_provider_call_executed", seal.guardedRealProviderCallExecuted === true),
  check("provider_calls_made_true", seal.providerCallsMade === true),
  check("real_provider_network_attempted_true", seal.realProviderNetworkAttempted === true),
  check("request_attempt_count_one", attemptCount === 1),
  check("one_shot_provider_call_passed", seal.oneShotProviderCallPassed === true),
  check("expected_response_matched", seal.expectedResponseMatched === true),
  check("provider_response_metadata_recorded", seal.providerResponseMetadataRecorded === true),
];

const failureChecks = [
  check("failure_recommended_sealed_false", seal.recommended_sealed === false),
  check("failure_blocker_expected", ["owner_approval_input_missing_or_invalid", "provider_one_shot_retry_failed"].includes(seal.blocker)),
  check("failure_classified_true", seal.failureClassified === true),
  check("request_attempt_count_valid", attemptCount === 0 || attemptCount === 1),
  check("one_shot_provider_call_not_passed", seal.oneShotProviderCallPassed === false),
];

const checks = [...commonChecks, ...(successPath ? successChecks : failureChecks)];
const verified = allPassed(checks);
const validation = {
  phase: "Phase1955P-Retry",
  name: "Guarded NVIDIA One-Shot Timeout Retry Verification",
  completed: true,
  recommended_sealed: verified && successPath,
  blocker: verified ? seal.blocker : "phase1955p_retry_verification_failed",
  ownerApprovalInputPresent: seal.ownerApprovalInputPresent === true,
  ownerApprovalInputValid: seal.ownerApprovalInputValid === true,
  newOwnerApprovalUsed: seal.newOwnerApprovalUsed === true,
  oldApprovalReused: seal.oldApprovalReused === true,
  guardedRealProviderCallExecuted: seal.guardedRealProviderCallExecuted === true,
  providerCallsMade: seal.providerCallsMade === true,
  realProviderNetworkAttempted: seal.realProviderNetworkAttempted === true,
  requestAttemptCount: attemptCount,
  retryAttemptCount: Number(seal.retryAttemptCount ?? 0),
  oneShotProviderCallPassed: seal.oneShotProviderCallPassed === true,
  expectedResponseMatched: seal.expectedResponseMatched === true,
  failureClassified: seal.failureClassified === true,
  failureReason: seal.failureReason ?? null,
  checks,
};

writeJson(validationPath, validation);
console.log(JSON.stringify(validation, null, 2));

if (!verified || (successPath && validation.recommended_sealed !== true)) {
  process.exitCode = 1;
}
