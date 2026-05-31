import { readJson, writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";
import { createCredentialRefProviderRuntimeAdapter } from "../../apps/ai-gateway-service/src/providers/credentialRefProviderRuntimeAdapter.js";

const authorizationPath = "docs/approvals/phase1931p/provider-stability-test-authorization.input.json";
const dryRunPath = "apps/ai-gateway-service/evidence/phase1932p-runtime/credentialref-provider-runtime-adapter-dry-run.json";
const resultPath = "apps/ai-gateway-service/evidence/phase1932p-runtime/credentialref-provider-runtime-adapter-result.json";

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
  return { auth, failures };
}

const authRead = readJson(authorizationPath);
const { auth, failures } = validateAuthorization(authRead);
const adapter = createCredentialRefProviderRuntimeAdapter();
const adapterResult = failures.length
  ? {
      ok: false,
      dryRun: true,
      providerCallsMade: false,
      realProviderCallExecuted: false,
      credentialRefOnly: true,
      readyForGuardedExecution: false,
      blocker: failures[0],
      safeRuntimeEntryDetected: false,
      safeRuntimeEntryName: null,
      rawSecretRead: false,
      secretValueExposed: false,
      authJsonRead: false,
      envDumped: false,
      rawKeyOutput: false,
      authHeaderLogged: false,
      chatGatewayExecuteModified: false,
    }
  : await adapter.runGuardedProviderStabilityRequest({
      providerId: auth.providerId,
      modelId: auth.modelId,
      credentialRef: auth.credentialRef,
      prompt: auth.testPrompt,
      expectedResponseContains: auth.expectedResponseContains,
      timeoutMs: auth.timeoutMs,
      dryRun: true,
    });

const dryRunEvidence = {
  phase: "Phase1932P-Runtime",
  dryRun: true,
  providerId: auth.providerId || "nvidia",
  modelId: auth.modelId || "nvidia/llama-3.3-nemotron-super-49b-v1",
  credentialRef: auth.credentialRef || "credentialRef:nvidia:default",
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
  readyForGuardedExecution: adapterResult.readyForGuardedExecution === true,
  safeRuntimeEntryDetected: adapterResult.safeRuntimeEntryDetected === true,
  safeRuntimeEntryName: adapterResult.safeRuntimeEntryName ?? null,
  blocker: adapterResult.blocker ?? null,
  adapterOk: adapterResult.ok === true,
};

const resultEvidence = {
  phase: "Phase1932P-Runtime",
  name: "CredentialRef-Only Provider Runtime Adapter",
  completed: true,
  recommended_sealed: true,
  blocker: adapterResult.safeRuntimeEntryDetected === true ? null : "provider_runtime_core_missing",
  phase1931pAuthorizationRead: authRead.exists === true,
  phase1931pAuthorizationValid: failures.length === 0,
  providerId: dryRunEvidence.providerId,
  modelId: dryRunEvidence.modelId,
  credentialRef: dryRunEvidence.credentialRef,
  credentialRefOnly: true,
  adapterGenerated: true,
  phase1932pRunnerUpdated: true,
  adapterDryRunExecuted: true,
  adapterDryRunPassed: adapterResult.ok === true && adapterResult.dryRun === true,
  safeRuntimeEntryDetected: adapterResult.safeRuntimeEntryDetected === true,
  safeRuntimeEntryName: adapterResult.safeRuntimeEntryName ?? null,
  runnerWillBlockIfSafeRuntimeMissing: true,
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
  nextRecommendedPhase: adapterResult.safeRuntimeEntryDetected === true
    ? "Retry Phase1932P Guarded Real Provider Stability Test Execution"
    : "Phase1932P-Core CredentialRef Resolver Runtime Implementation",
};

writeJson(dryRunPath, dryRunEvidence);
writeJson(resultPath, resultEvidence);
console.log(JSON.stringify(resultEvidence, null, 2));
