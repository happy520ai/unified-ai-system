import { readJson, writeJson, check } from "../phase1903a/ownerAutomationSealCommon.mjs";

const authorizationPath = "docs/approvals/phase1931p/provider-stability-test-authorization.input.json";
const resultPath = "apps/ai-gateway-service/evidence/phase1931p/provider-stability-test-authorization-result.json";

function isFilled(value, placeholder) {
  return typeof value === "string" && value.trim().length > 0 && value !== placeholder;
}

function containsRawKeyShape(value) {
  return /(sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-|ghp_[A-Za-z0-9_]{20,}|api[_-]?key)/i.test(
    String(value ?? ""),
  );
}

const authRead = readJson(authorizationPath);
const auth = authRead.data ?? {};
const providerIdPresent = isFilled(auth.providerId, "FILL_PROVIDER_ID_HERE");
const modelIdPresent = isFilled(auth.modelId, "FILL_MODEL_ID_HERE");
const credentialRefPresent = isFilled(auth.credentialRef, "FILL_CREDENTIAL_REF_HERE");
const credentialRefOnly = credentialRefPresent && !containsRawKeyShape(auth.credentialRef);
const missingFields = [
  providerIdPresent ? null : "providerId",
  modelIdPresent ? null : "modelId",
  credentialRefPresent ? null : "credentialRef",
].filter(Boolean);

const requiredChecks = [
  check("authorization_parseable", authRead.exists === true && authRead.parseError === null),
  check("approved_true", auth.approved === true),
  check("decision_scope", auth.decision === "approved_for_phase1932p_guarded_execution_only"),
  check("provider_id_present", providerIdPresent),
  check("model_id_present", modelIdPresent),
  check("credential_ref_present", credentialRefPresent),
  check("credential_ref_only", credentialRefOnly || credentialRefPresent === false),
  check("max_requests_min", Number(auth.maxRequests) >= 1),
  check("max_requests_cap", Number(auth.maxRequests) <= 3),
  check("max_cost_non_negative", Number(auth.maxCostUsd) >= 0),
  check("timeout_cap", Number(auth.timeoutMs) <= 30000),
  check("allow_real_provider_call_true", auth.allowRealProviderCall === true),
  check("allow_secret_read_false", auth.allowSecretRead === false),
  check("allow_raw_key_output_false", auth.allowRawKeyOutput === false),
  check("allow_auth_json_read_false", auth.allowAuthJsonRead === false),
  check("allow_env_dump_false", auth.allowEnvDump === false),
  check("allow_deploy_false", auth.allowDeploy === false),
  check("allow_release_false", auth.allowRelease === false),
  check("allow_tag_false", auth.allowTag === false),
  check("allow_artifact_upload_false", auth.allowArtifactUpload === false),
  check("allow_chat_gateway_execute_default_route_change_false", auth.allowChatGatewayExecuteDefaultRouteChange === false),
  check("rollback_method", typeof auth.rollback?.method === "string" && auth.rollback.method.length > 0),
  check("test_prompt", typeof auth.testPrompt === "string" && auth.testPrompt.length > 0),
  check(
    "expected_response_contains",
    typeof auth.expectedResponseContains === "string" && auth.expectedResponseContains.length > 0,
  ),
];

const sealed = missingFields.length === 0 && requiredChecks.every((item) => item.passed);
const result = {
  phase: "Phase1931P",
  name: "Guarded Real Provider Stability Test Authorization",
  completed: true,
  recommended_sealed: sealed,
  blocker: sealed ? null : "provider_authorization_fields_missing",
  authorizationFileGenerated: authRead.exists === true,
  authorizationValidated: true,
  approvedForGuardedPhase1932P: sealed,
  providerIdPresent,
  modelIdPresent,
  credentialRefPresent,
  credentialRefOnly,
  providerId: providerIdPresent ? auth.providerId : "FILL_PROVIDER_ID_HERE",
  modelId: modelIdPresent ? auth.modelId : "FILL_MODEL_ID_HERE",
  maxRequests: Number(auth.maxRequests ?? 0),
  maxCostUsd: Number(auth.maxCostUsd ?? 0),
  timeoutMs: Number(auth.timeoutMs ?? 0),
  realProviderCallExecutedThisPhase: false,
  providerCallsMade: false,
  secretValueExposed: false,
  rawSecretRead: false,
  authJsonRead: false,
  envDumped: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  commercialReadyClaimed: false,
  nextRecommendedPhase: sealed ? "Phase1932P Guarded Real Provider Stability Test Execution" : null,
  missingFields,
  checks: requiredChecks,
};

writeJson(resultPath, result);
console.log(JSON.stringify(result, null, 2));

if (!result.completed || result.blocker !== null) {
  process.exitCode = 1;
}
