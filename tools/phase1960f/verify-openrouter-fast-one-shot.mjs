import { readFileSync } from "node:fs";
import { allPassed, check, pathExists, readJson, writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1960F";
const runnerPath = "tools/phase1960f/run-openrouter-fast-one-shot.mjs";
const verifierPath = "tools/phase1960f/verify-openrouter-fast-one-shot.mjs";
const approvalDocPath = "docs/phase1960f-owner-approval.md";
const resultPath = "apps/ai-gateway-service/evidence/phase1960f/openrouter-fast-one-shot-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1960f/phase1960f-seal-result.json";
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
    { id: "raw_openrouter_env_assignment", pattern: /OPENROUTER_API_KEY\s*=/u },
    { id: "authorization_header_literal", pattern: /Authorization\s*:\s*Bearer/u },
    { id: "auth_json_raw_read", pattern: /readFileSync\([^)]*auth\.json/u },
    { id: "dot_env_raw_read", pattern: /readFileSync\([^)]*\.env/u },
    { id: "env_dump", pattern: /Object\.entries\(\s*process\.env\s*\)|JSON\.stringify\(\s*process\.env\s*\)/u },
    { id: "raw_secret_store_accessor", pattern: /\.getApiKey\s*\(|\.listRecords\s*\(/u },
  ];
  return patterns.filter((item) => item.pattern.test(text)).map((item) => ({ file: relativePath, pattern: item.id }));
}

function safetyChecks(record, prefix) {
  return [
    check(`${prefix}_credential_ref_only_true`, record.credentialRefOnly === true),
    check(`${prefix}_raw_secret_read_false`, record.rawSecretRead === false),
    check(`${prefix}_auth_json_raw_read_false`, record.authJsonRawRead === false),
    check(`${prefix}_auth_json_read_false`, record.authJsonRead === false),
    check(`${prefix}_dot_env_raw_read_false`, record.dotEnvRawRead === false),
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
    check(`${prefix}_provider_stability_false`, record.providerStabilityVerified === false && record.multiProviderStabilityVerified === false),
    check(`${prefix}_production_commercial_false`, record.productionReadyClaimed === false && record.commercialReadyClaimed === false),
    check(`${prefix}_workspace_clean_claimed_false`, record.workspaceCleanClaimed === false),
  ];
}

const resultRead = readJson(resultPath);
const sealRead = readJson(sealPath);
const result = resultRead.data ?? {};
const seal = sealRead.data ?? {};
const packageText = readText(packageJsonPath);
const approvalDocText = readText(approvalDocPath);
const staticHits = [runnerPath, approvalDocPath].flatMap(findForbiddenStaticHits);
const requestAttemptCount = Number(seal.requestAttemptCount ?? -1);
const resolvable = seal.openRouterCredentialRefResolvable === true;
const oneShotPassed = seal.oneShotProviderCallPassed === true;

const commonChecks = [
  check(`file_exists:${runnerPath}`, pathExists(runnerPath)),
  check(`file_exists:${verifierPath}`, pathExists(verifierPath)),
  check(`file_exists:${approvalDocPath}`, pathExists(approvalDocPath)),
  check(`file_exists:${resultPath}`, pathExists(resultPath)),
  check(`file_exists:${sealPath}`, pathExists(sealPath)),
  check("result_parseable", resultRead.exists === true && resultRead.parseError === null),
  check("seal_parseable", sealRead.exists === true && sealRead.parseError === null),
  check("phase_completed", seal.completed === true),
  check("provider_openrouter", seal.providerId === "openrouter"),
  check("model_openrouter_gpt4o_mini", seal.modelId === "openai/gpt-4o-mini"),
  check("credential_ref_exact", seal.credentialRef === "credentialRef:openrouter:default"),
  check("max_requests_one", Number(seal.maxRequests) === 1),
  check("retry_zero", Number(seal.retryAttemptCount) === 0),
  check("timeout_60000", Number(seal.timeoutMs) === 60000),
  check("stream_false", seal.stream === false),
  check("request_limit_respected", seal.requestLimitRespected === true && requestAttemptCount <= 1),
  check("approval_doc_minimal_present", approvalDocText.includes("Phase1960F") && approvalDocText.includes("Fast Track")),
  check("package_scripts_added", packageText.includes("run:phase1960f-openrouter-fast-one-shot") && packageText.includes("verify:phase1960f-openrouter-fast-one-shot")),
  check("result_matches_seal", result.blocker === seal.blocker && result.requestAttemptCount === seal.requestAttemptCount),
  check("forbidden_static_patterns_absent", staticHits.length === 0, { staticHits }),
  ...safetyChecks(seal, "seal"),
  ...safetyChecks(result, "result"),
];

const blockedChecks = [
  check("blocked_recommended_sealed_false", seal.recommended_sealed === false),
  check("blocked_blocker_credential_missing", seal.blocker === "openrouter_credentialref_still_missing"),
  check("blocked_resolvable_false", seal.openRouterCredentialRefResolvable === false),
  check("blocked_no_provider_call", seal.providerCallsMade === false && seal.externalNetworkRequestMade === false),
  check("blocked_request_attempt_zero", requestAttemptCount === 0),
  check("blocked_one_shot_not_passed", seal.oneShotProviderCallPassed === false),
];

const successChecks = [
  check("success_recommended_sealed_true", seal.recommended_sealed === true),
  check("success_blocker_null", seal.blocker === null),
  check("success_resolvable_true", resolvable),
  check("success_provider_called_once", seal.providerCallsMade === true && seal.realProviderNetworkAttempted === true && requestAttemptCount === 1),
  check("success_one_shot_passed", oneShotPassed),
  check("success_expected_response_matched", seal.expectedResponseMatched === true),
  check("success_response_sanitized", seal.responseSanitized === true),
  check("success_only_one_shot_claim", seal.providerStabilityVerified === false && seal.productionReadyClaimed === false && seal.commercialReadyClaimed === false),
];

const failedCallChecks = [
  check("failed_call_recommended_sealed_false", seal.recommended_sealed === false),
  check("failed_call_resolvable_true", resolvable),
  check("failed_call_request_attempt_valid", requestAttemptCount === 0 || requestAttemptCount === 1),
  check("failed_call_one_shot_not_passed", oneShotPassed === false),
  check("failed_call_blocker_present", typeof seal.blocker === "string" && seal.blocker.length > 0),
];

const branchChecks = !resolvable ? blockedChecks : oneShotPassed ? successChecks : failedCallChecks;
const checks = [...commonChecks, ...branchChecks];
const verified = allPassed(checks);
const verification = {
  phase,
  name: "Phase1960F OpenRouter Fast One-Shot Verification",
  completed: true,
  recommended_sealed: verified,
  blocker: verified ? null : "phase1960f_verification_failed",
  openRouterCredentialRefResolvable: resolvable,
  providerCallsMade: seal.providerCallsMade === true,
  requestAttemptCount,
  oneShotProviderCallPassed: oneShotPassed,
  evidenceSealRecommendedSealed: seal.recommended_sealed === true,
  evidenceBlocker: seal.blocker ?? null,
  rawSecretRead: false,
  secretValueExposed: false,
  authorizationHeaderLogged: false,
  checks,
};

writeJson("apps/ai-gateway-service/evidence/phase1960f/phase1960f-verification-result.json", verification);
console.log(JSON.stringify(verification, null, 2));

if (!verified) {
  process.exitCode = 1;
}
