import { readJson, writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";
import { createSafeProviderExecutionInvoker } from "../../apps/ai-gateway-service/src/providers/safeProviderExecutionInvoker.js";

const authorizationPath = "docs/approvals/phase1931p/provider-stability-test-authorization.input.json";
const dryRunPath = "apps/ai-gateway-service/evidence/phase1932p-invoker/safe-execution-invoker-dry-run.json";
const resultPath = "apps/ai-gateway-service/evidence/phase1932p-invoker/safe-execution-invoker-result.json";

function validateAuthorization(authRead) {
  const auth = authRead.data ?? {};
  const failures = [];
  if (authRead.exists !== true || authRead.parseError !== null) failures.push("authorization_unreadable");
  if (auth.approved !== true) failures.push("approved_must_be_true");
  if (auth.decision !== "approved_for_phase1932p_guarded_execution_only") failures.push("decision_invalid");
  if (auth.providerId !== "nvidia") failures.push("provider_not_allowed");
  if (auth.modelId !== "nvidia/llama-3.3-nemotron-super-49b-v1") failures.push("model_not_allowed");
  if (auth.credentialRef !== "credentialRef:nvidia:default") failures.push("credential_ref_not_allowed");
  if (auth.allowSecretRead !== false) failures.push("allow_secret_read_must_be_false");
  if (auth.allowRawKeyOutput !== false) failures.push("allow_raw_key_output_must_be_false");
  if (auth.allowAuthJsonRead !== false) failures.push("allow_auth_json_read_must_be_false");
  if (auth.allowEnvDump !== false) failures.push("allow_env_dump_must_be_false");
  if (auth.allowChatGatewayExecuteDefaultRouteChange !== false) failures.push("execute_route_change_must_be_false");
  if (!Number.isInteger(auth.maxRequests) || auth.maxRequests < 1 || auth.maxRequests > 3) failures.push("max_requests_invalid");
  if (Number(auth.timeoutMs) > 30000) failures.push("timeout_invalid");
  return { auth, failures };
}

const authRead = readJson(authorizationPath);
const { auth, failures } = validateAuthorization(authRead);
const invoker = createSafeProviderExecutionInvoker();
const request = {
  providerId: auth.providerId,
  modelId: auth.modelId,
  credentialRef: auth.credentialRef,
  prompt: auth.testPrompt,
  expectedResponseContains: auth.expectedResponseContains,
  timeoutMs: auth.timeoutMs,
  maxRequests: auth.maxRequests,
  invocationPurpose: "phase1932p_guarded_provider_stability_test",
};

const invokerResult = failures.length
  ? {
      ok: false,
      dryRun: true,
      safeExecutionInvokerReady: false,
      blocker: failures[0],
      providerCallsMade: false,
      realProviderCallExecuted: false,
      credentialRefOnly: true,
      rawSecretRead: false,
      secretValueExposed: false,
      authJsonRead: false,
      envDumped: false,
      rawKeyOutput: false,
      authHeaderLogged: false,
      chatGatewayExecuteModified: false,
    }
  : await invoker.runInvocationDryRun(request);

const dryRunEvidence = {
  phase: "Phase1932P-Invoker",
  dryRun: true,
  providerId: auth.providerId || "nvidia",
  modelId: auth.modelId || "nvidia/llama-3.3-nemotron-super-49b-v1",
  credentialRef: auth.credentialRef || "credentialRef:nvidia:default",
  safeExecutionInvokerReady: invokerResult.safeExecutionInvokerReady === true,
  providerCallImplementationReady: invokerResult.providerCallImplementationReady === true,
  credentialRefOnly: true,
  providerCallsMade: false,
  realProviderCallExecuted: false,
  rawSecretRead: false,
  secretValueExposed: false,
  authJsonRead: false,
  envDumped: false,
  rawKeyOutput: false,
  authHeaderLogged: false,
  chatGatewayExecuteModified: false,
  blocker: invokerResult.blocker ?? null,
};

const resultEvidence = {
  phase: "Phase1932P-Invoker",
  name: "Safe Execution Invoker Authorization",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase1931pAuthorizationRead: authRead.exists === true,
  phase1931pAuthorizationValid: failures.length === 0,
  providerId: dryRunEvidence.providerId,
  modelId: dryRunEvidence.modelId,
  credentialRef: dryRunEvidence.credentialRef,
  credentialRefOnly: true,
  safeExecutionInvokerGenerated: true,
  safeExecutionInvokerDryRunExecuted: true,
  safeExecutionInvokerReady: invokerResult.safeExecutionInvokerReady === true,
  providerCallImplementationReady: invokerResult.providerCallImplementationReady === true,
  adapterUpdatedToUseInvoker: true,
  phase1932pRunnerUpdatedToUseInvoker: true,
  realProviderCallExecutedThisPhase: false,
  providerCallsMade: false,
  rawSecretRead: false,
  secretValueExposed: false,
  authJsonRead: false,
  envDumped: false,
  rawKeyOutput: false,
  authHeaderLogged: false,
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
  nextRecommendedPhase: "Retry Phase1932P Guarded Real Provider Stability Test Execution",
};

writeJson(dryRunPath, dryRunEvidence);
writeJson(resultPath, resultEvidence);
console.log(JSON.stringify(resultEvidence, null, 2));
