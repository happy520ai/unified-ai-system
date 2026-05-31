import { readJson, writeJson, check, allPassed } from "../phase1903a/ownerAutomationSealCommon.mjs";

const resultPath = "apps/ai-gateway-service/evidence/phase1932p/guarded-real-provider-stability-test-result.json";
const validationPath = "apps/ai-gateway-service/evidence/phase1932p/guarded-real-provider-stability-test-validation-result.json";

const read = readJson(resultPath);
const result = read.data ?? {};
const blocker = result.blocker ?? null;
const requestAttemptCount = Number(result.requestAttemptCount ?? 0);
const successfulResponseCount = Number(result.successfulResponseCount ?? 0);
const failedResponseCount = Number(result.failedResponseCount ?? 0);
const responseContainsExpectedMarkerCount = Number(result.responseContainsExpectedMarkerCount ?? 0);

const safetyChecks = [
  check("raw_secret_read_false", result.rawSecretRead === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("env_dumped_false", result.envDumped === false),
  check("raw_key_output_false", result.rawKeyOutput === false),
  check("auth_header_logged_false", result.authHeaderLogged === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("tag_created_false", result.tagCreated === false),
  check("artifact_uploaded_false", result.artifactUploaded === false),
  check("commit_created_false", result.commitCreated === false),
  check("push_executed_false", result.pushExecuted === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("legacy_modified_false", result.legacyModified === false),
  check("project_context_modified_false", result.projectContextModified === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
  check("production_ready_claimed_false", result.productionReadyClaimed === false),
  check("public_launch_ready_claimed_false", result.publicLaunchReadyClaimed === false),
  check("commercial_ready_claimed_false", result.commercialReadyClaimed === false),
];

const successState = blocker === null
  && result.recommended_sealed === true
  && result.realProviderCallExecuted === true
  && result.providerCallsMade === true
  && requestAttemptCount >= 1
  && requestAttemptCount <= 3
  && successfulResponseCount === requestAttemptCount
  && failedResponseCount === 0
  && responseContainsExpectedMarkerCount === requestAttemptCount;

const blockedState = (blocker === "safe_provider_runtime_entry_missing" || blocker === "safe_execution_invoker_missing" || blocker === "safe_provider_call_implementation_missing")
  && result.recommended_sealed === false
  && result.realProviderCallExecuted === false
  && result.providerCallsMade === false
  && requestAttemptCount === 0
  && successfulResponseCount === 0
  && failedResponseCount === 0;

const blockedBySafeExecutionInvoker = blocker === "safe_execution_invoker_missing"
  && result.providerRuntimeCoreReady === true
  && result.resolvedCredentialRef === true
  && result.stabilityClassification === "not_executed_safe_execution_invoker_missing";

const blockedBySafeProviderCallImplementation = blocker === "safe_provider_call_implementation_missing"
  && result.providerRuntimeCoreReady === true
  && result.resolvedCredentialRef === true
  && result.safeExecutionInvokerReady === true
  && (result.safeProviderCallImplementationReady === false || result.providerCallImplementationReady === true)
  && result.stabilityClassification === "not_executed_safe_provider_call_implementation_missing";

const failedState = blocker === "provider_stability_attempt_failed"
  && result.recommended_sealed === false
  && result.realProviderCallExecuted === true
  && result.providerCallsMade === true
  && failedResponseCount > 0;

const checks = [
  check("result_json_parseable", read.exists === true && read.parseError === null),
  check("completed_true", result.completed === true),
  check("provider_id_nvidia", result.providerId === "nvidia"),
  check("model_id_allowed", result.modelId === "nvidia/llama-3.3-nemotron-super-49b-v1"),
  check("credential_ref_only", result.credentialRefOnly === true),
  check("request_attempt_count_cap", requestAttemptCount >= 0 && requestAttemptCount <= 3),
  check("adapter_fields_present", "safeRuntimeEntryDetected" in result && "blockedBeforeProviderCall" in result),
  check("core_fields_present", blocker === "safe_execution_invoker_missing" ? blockedBySafeExecutionInvoker : true),
  check("invoker_fields_present", blocker === "safe_provider_call_implementation_missing" ? blockedBySafeProviderCallImplementation : true),
  check("state_supported", successState || blockedState || failedState, {
    successState,
    blockedState,
    failedState,
    blocker,
  }),
  ...safetyChecks,
];

const validation = {
  phase: "Phase1932P",
  name: "Guarded Real Provider Stability Test Validation",
  completed: true,
  recommended_sealed: successState && allPassed(checks),
  blocker: successState && allPassed(checks) ? null : (blocker || "phase1932p_validation_failed"),
  successState,
  blockedState,
  failedState,
  blockedBySafeExecutionInvoker,
  blockedBySafeProviderCallImplementation,
  providerId: result.providerId ?? null,
  modelId: result.modelId ?? null,
  credentialRefOnly: result.credentialRefOnly === true,
  requestAttemptCount,
  successfulResponseCount,
  failedResponseCount,
  responseContainsExpectedMarkerCount,
  stabilityClassification: result.stabilityClassification ?? null,
  realProviderCallExecuted: result.realProviderCallExecuted === true,
  providerCallsMade: result.providerCallsMade === true,
  rawSecretRead: result.rawSecretRead === true,
  secretValueExposed: result.secretValueExposed === true,
  authJsonRead: result.authJsonRead === true,
  envDumped: result.envDumped === true,
  rawKeyOutput: result.rawKeyOutput === true,
  authHeaderLogged: result.authHeaderLogged === true,
  deployExecuted: result.deployExecuted === true,
  releaseExecuted: result.releaseExecuted === true,
  tagCreated: result.tagCreated === true,
  artifactUploaded: result.artifactUploaded === true,
  commitCreated: result.commitCreated === true,
  pushExecuted: result.pushExecuted === true,
  chatGatewayExecuteModified: result.chatGatewayExecuteModified === true,
  legacyModified: result.legacyModified === true,
  projectContextModified: result.projectContextModified === true,
  workspaceCleanClaimed: result.workspaceCleanClaimed === true,
  productionReadyClaimed: result.productionReadyClaimed === true,
  publicLaunchReadyClaimed: result.publicLaunchReadyClaimed === true,
  commercialReadyClaimed: result.commercialReadyClaimed === true,
  checks,
};

writeJson(validationPath, validation);
console.log(JSON.stringify(validation, null, 2));

if (validation.recommended_sealed !== true || validation.blocker !== null) {
  process.exitCode = 1;
}
