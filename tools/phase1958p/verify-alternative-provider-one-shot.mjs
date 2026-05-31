import { readFileSync } from "node:fs";
import { allPassed, check, pathExists, readJson, writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1958P-AlternativeProvider-OneShot";
const runnerPath = "tools/phase1958p/run-alternative-provider-one-shot.mjs";
const verifierPath = "tools/phase1958p/verify-alternative-provider-one-shot.mjs";
const approvalStatementPath = "docs/phase1957p-alternative-provider-approval-statement.md";
const approvalJsonPath = "docs/phase1957p-alternative-provider-owner-approval.input.json";
const reportDocPath = "docs/phase1958p-alternative-provider-one-shot-report.md";
const boundaryDocPath = "docs/phase1958p-provider-call-boundary.md";
const classificationDocPath = "docs/phase1958p-result-classification.md";
const resultPath = "apps/ai-gateway-service/evidence/phase1958p/alternative-provider-one-shot-result.json";
const boundaryPath = "apps/ai-gateway-service/evidence/phase1958p/provider-one-shot-safety-boundary.json";
const validationPath = "apps/ai-gateway-service/evidence/phase1958p/phase1958p-validation-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1958p/phase1958p-seal-result.json";
const executorPath = "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.js";
const envelopePath = "apps/ai-gateway-service/src/providers/safeProviderRequestEnvelope.js";
const sanitizerPath = "apps/ai-gateway-service/src/providers/safeProviderResponseSanitizer.js";
const gatePath = "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js";
const schemaPath = "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationSchema.js";
const contractPath = "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.contract.js";
const resolverContractPath = "apps/ai-gateway-service/src/providers/credentialRefResolverRuntime.contract.js";
const packageJsonPath = "package.json";

function readText(relativePath) {
  try {
    return readFileSync(relativePath, "utf8").replace(/^\uFEFF/u, "");
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
const approvalRead = readJson(approvalJsonPath);
const result = resultRead.data ?? {};
const boundary = boundaryRead.data ?? {};
const seal = sealRead.data ?? {};
const approval = approvalRead.data ?? {};
const packageText = readText(packageJsonPath);
const runnerText = readText(runnerPath);
const contractText = readText(contractPath);
const resolverContractText = readText(resolverContractPath);
const staticHits = [
  runnerPath,
  verifierPath,
  executorPath,
  envelopePath,
  sanitizerPath,
  gatePath,
  schemaPath,
].flatMap(findForbiddenStaticHits);
const successPath = seal.recommended_sealed === true;
const attemptCount = Number(seal.requestAttemptCount ?? 0);

const requiredFiles = [
  runnerPath,
  verifierPath,
  approvalStatementPath,
  approvalJsonPath,
  reportDocPath,
  boundaryDocPath,
  classificationDocPath,
  resultPath,
  boundaryPath,
  validationPath,
  sealPath,
  executorPath,
  envelopePath,
  sanitizerPath,
  gatePath,
  schemaPath,
];

const commonChecks = [
  ...requiredFiles.map((file) => check(`file_exists:${file}`, pathExists(file))),
  check("approval_json_parseable", approvalRead.exists === true && approvalRead.parseError === null),
  check("result_parseable", resultRead.exists === true && resultRead.parseError === null),
  check("boundary_parseable", boundaryRead.exists === true && boundaryRead.parseError === null),
  check("seal_parseable", sealRead.exists === true && sealRead.parseError === null),
  check("forbidden_static_patterns_absent", staticHits.length === 0, { staticHits }),
  check("runner_does_not_read_auth_json_or_dot_env", !runnerText.includes("auth.json") && !runnerText.includes("\".env\"") && !runnerText.includes("'.env'")),
  check("openrouter_allowlist_present", contractText.includes("\"openrouter\"") && contractText.includes("\"openai/gpt-4o-mini\"") && contractText.includes("\"credentialRef:openrouter:default\"")),
  check("openrouter_credential_ref_registered", resolverContractText.includes("\"openrouter\"") && resolverContractText.includes("\"credentialRef:openrouter:default\"")),
  check("package_scripts_added", packageText.includes("run:phase1958p-alternative-provider-one-shot") && packageText.includes("verify:phase1958p-alternative-provider-one-shot")),
  check("phase_completed", seal.completed === true),
  check("owner_approval_text_present", seal.ownerApprovalTextPresent === true),
  check("owner_approval_text_source_of_truth", seal.ownerApprovalTextIsSourceOfTruth === true),
  check("approval_json_present", seal.approvalJsonPresent === true),
  check("approval_text_json_consistent", seal.approvalTextJsonConsistent === true),
  check("provider_id_openrouter", seal.providerId === "openrouter"),
  check("model_id_openrouter_gpt4o_mini", seal.modelId === "openai/gpt-4o-mini"),
  check("credential_ref_openrouter_default", seal.credentialRef === "credentialRef:openrouter:default"),
  check("approval_phase_1958", approval.phase === phase),
  check("approval_decision_alt_provider", approval.decision === "approved_execute_guarded_alternative_provider_one_shot"),
  check("timeout_ms_60000", Number(seal.timeoutMs ?? 0) === 60000),
  check("stream_false", seal.stream === false),
  check("retry_attempt_count_zero", Number(seal.retryAttemptCount ?? -1) === 0),
  check("request_limit_respected", seal.requestLimitRespected === true && attemptCount <= 1),
  check("response_sanitized_true", seal.responseSanitized === true),
  check("provider_stability_verified_false", seal.providerStabilityVerified === false),
  check("multi_provider_stability_verified_false", seal.multiProviderStabilityVerified === false),
  check("production_commercial_claims_false", seal.productionReadyClaimed === false && seal.commercialReadyClaimed === false),
  check("boundary_matches_result", boundary.requestAttemptCount === seal.requestAttemptCount && boundary.providerCallsMade === seal.providerCallsMade),
  check("result_matches_seal", result.requestAttemptCount === seal.requestAttemptCount && result.providerCallsMade === seal.providerCallsMade),
  ...safetyChecks(seal, "seal"),
  ...safetyChecks(boundary, "boundary"),
];

const successChecks = [
  check("success_recommended_sealed_true", seal.recommended_sealed === true),
  check("success_blocker_null", seal.blocker === null),
  check("guarded_alternative_provider_call_executed", seal.guardedAlternativeProviderCallExecuted === true),
  check("provider_calls_made_true", seal.providerCallsMade === true),
  check("real_provider_network_attempted_true", seal.realProviderNetworkAttempted === true),
  check("request_attempt_count_one", attemptCount === 1),
  check("success_count_one", Number(seal.success ?? 0) === 1),
  check("fail_count_zero", Number(seal.fail ?? -1) === 0),
  check("one_shot_provider_call_passed", seal.oneShotProviderCallPassed === true),
  check("expected_response_matched", seal.expectedResponseMatched === true),
  check("provider_response_metadata_recorded", seal.providerResponseMetadataRecorded === true),
];

const failureChecks = [
  check("failure_recommended_sealed_false", seal.recommended_sealed === false),
  check("failure_blocker_expected", [
    "owner_approval_text_missing_or_mismatch",
    "alternative_provider_credential_missing",
    "alternative_provider_one_shot_failed",
  ].includes(seal.blocker)),
  check("failure_classified_true", seal.failureClassified === true),
  check("request_attempt_count_valid", attemptCount === 0 || attemptCount === 1),
  check("one_shot_provider_call_not_passed", seal.oneShotProviderCallPassed === false),
  check("no_retry_after_failure", Number(seal.retryAttemptCount ?? -1) === 0),
];

const checks = [...commonChecks, ...(successPath ? successChecks : failureChecks)];
const verified = allPassed(checks);
const validation = {
  phase,
  name: "Phase1958P Alternative Provider One-Shot Verification",
  completed: true,
  recommended_sealed: verified && successPath,
  blocker: verified ? seal.blocker : "phase1958p_verification_failed",
  ownerApprovalTextPresent: seal.ownerApprovalTextPresent === true,
  approvalTextJsonConsistent: seal.approvalTextJsonConsistent === true,
  guardedAlternativeProviderCallExecuted: seal.guardedAlternativeProviderCallExecuted === true,
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
