import { readJson, writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";
import { createCredentialRefProviderRuntimeAdapter } from "../../apps/ai-gateway-service/src/providers/credentialRefProviderRuntimeAdapter.js";
import { createCredentialRefResolverRuntime } from "../../apps/ai-gateway-service/src/providers/credentialRefResolverRuntime.js";
import { createSafeProviderExecutionInvoker } from "../../apps/ai-gateway-service/src/providers/safeProviderExecutionInvoker.js";
import { createSafeProviderCallImplementation } from "../../apps/ai-gateway-service/src/providers/safeProviderCallImplementation.js";

const authorizationPath = "docs/approvals/phase1931p/provider-stability-test-authorization.input.json";
const resultPath = "apps/ai-gateway-service/evidence/phase1932p/guarded-real-provider-stability-test-result.json";

const ALLOWED_PROVIDER_ID = "nvidia";
const ALLOWED_MODEL_ID = "nvidia/llama-3.3-nemotron-super-49b-v1";
const ALLOWED_CREDENTIAL_REF = "credentialRef:nvidia:default";
const EXPECTED_MARKER = "PME_PROVIDER_STABILITY_OK";

function isCredentialRef(value) {
  return typeof value === "string" && /^credentialRef:[a-z0-9_.:-]+$/i.test(value);
}

function containsRawKeyShape(value) {
  return /(sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-|ghp_[A-Za-z0-9_]{20,}|api[_-]?key|bearer\s+[a-z0-9._-]{16,})/i.test(
    String(value ?? ""),
  );
}

function validateAuthorization(authRead) {
  const auth = authRead.data ?? {};
  const failures = [];
  if (authRead.exists !== true || authRead.parseError !== null) failures.push("authorization_file_unreadable");
  if (auth.approved !== true) failures.push("approved_must_be_true");
  if (auth.decision !== "approved_for_phase1932p_guarded_execution_only") failures.push("decision_invalid");
  if (auth.allowRealProviderCall !== true) failures.push("allow_real_provider_call_required");
  for (const key of [
    "allowSecretRead",
    "allowRawKeyOutput",
    "allowAuthJsonRead",
    "allowEnvDump",
    "allowDeploy",
    "allowRelease",
    "allowTag",
    "allowArtifactUpload",
    "allowChatGatewayExecuteDefaultRouteChange",
  ]) {
    if (auth[key] !== false) failures.push(`${key}_must_be_false`);
  }
  if (auth.providerId !== ALLOWED_PROVIDER_ID) failures.push("provider_not_allowed");
  if (auth.modelId !== ALLOWED_MODEL_ID) failures.push("model_not_allowed");
  if (auth.credentialRef !== ALLOWED_CREDENTIAL_REF) failures.push("credential_ref_not_allowed");
  if (!isCredentialRef(auth.credentialRef)) failures.push("credential_ref_required");
  if (containsRawKeyShape(auth.credentialRef)) failures.push("credential_ref_contains_raw_key_shape");
  if (!Number.isInteger(auth.maxRequests) || auth.maxRequests < 1 || auth.maxRequests > 3) failures.push("max_requests_invalid");
  if (Number(auth.maxCostUsd) < 0) failures.push("max_cost_invalid");
  if (Number(auth.timeoutMs) > 30000) failures.push("timeout_invalid");
  if (auth.testPrompt !== `Return exactly: ${EXPECTED_MARKER}`) failures.push("test_prompt_invalid");
  if (auth.expectedResponseContains !== EXPECTED_MARKER) failures.push("expected_marker_invalid");
  return { auth, failures };
}

function buildResult(overrides = {}) {
  return {
    phase: "Phase1932P",
    name: "Guarded Real Provider Stability Test Execution",
    completed: true,
    recommended_sealed: false,
    blocker: "safe_provider_runtime_entry_missing",
    providerId: ALLOWED_PROVIDER_ID,
    modelId: ALLOWED_MODEL_ID,
    credentialRefOnly: true,
    credentialRef: ALLOWED_CREDENTIAL_REF,
    requestAttemptCount: 0,
    successfulResponseCount: 0,
    failedResponseCount: 0,
    responseContainsExpectedMarkerCount: 0,
    stabilityClassification: "not_executed_safe_provider_runtime_entry_missing",
    realProviderCallExecuted: false,
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
    nextRecommendedPhase: "Phase1932P-Safe Execution Invoker Authorization",
    ...overrides,
  };
}

const authRead = readJson(authorizationPath);
const { auth, failures } = validateAuthorization(authRead);

if (failures.length > 0) {
  const result = buildResult({
    blocker: "phase1931p_authorization_invalid",
    authorizationValid: false,
    authorizationFailures: failures,
    stabilityClassification: "not_executed_authorization_invalid",
    providerId: auth.providerId || ALLOWED_PROVIDER_ID,
    modelId: auth.modelId || ALLOWED_MODEL_ID,
    credentialRef: isCredentialRef(auth.credentialRef) ? auth.credentialRef : null,
  });
  writeJson(resultPath, result);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  const safeProviderCallImplementation = createSafeProviderCallImplementation();
  const safeInvoker = createSafeProviderExecutionInvoker({ safeProviderCallImplementation });
  const implementationDryRun = await safeProviderCallImplementation.runProviderCallDryRun({
    providerId: auth.providerId,
    modelId: auth.modelId,
    credentialRef: auth.credentialRef,
    prompt: auth.testPrompt,
    expectedResponseContains: auth.expectedResponseContains,
    timeoutMs: auth.timeoutMs,
    invocationPurpose: "phase1932p_guarded_provider_stability_test",
  });

  if (implementationDryRun.providerCallImplementationReady !== true) {
    const result = buildResult({
      authorizationValid: true,
      authorizationFailures: [],
      blocker: "safe_provider_call_implementation_missing",
      safeRuntimeEntryDetected: true,
      safeRuntimeEntryName: "safeProviderExecutionInvoker.invokeProvider",
      safeRuntimeEntryRequired: true,
      safeExecutionInvokerReady: safeInvoker.safeExecutionInvokerReady === true,
      safeProviderCallImplementationReady: safeInvoker.providerCallImplementationReady === true,
      providerCallImplementationReady: false,
      providerRuntimeCoreReady: true,
      resolvedCredentialRef: true,
      safeRuntimeEntryDetectionReason: "Safe execution invoker is ready, but safe provider call implementation did not pass its dry-run contract.",
      blockedBeforeProviderCall: true,
      requestAttemptCount: 0,
      successfulResponseCount: 0,
      failedResponseCount: 0,
      responseContainsExpectedMarkerCount: 0,
      stabilityClassification: "not_executed_safe_provider_call_implementation_missing",
      realProviderCallExecuted: false,
      providerCallsMade: false,
    });
    writeJson(resultPath, result);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  } else {
  const resolverRuntime = createCredentialRefResolverRuntime({
    safeExecutionInvoker: safeInvoker.invokeProvider,
    safeExecutionInvokerName: "safeProviderExecutionInvoker.invokeProvider",
  });
  const adapter = createCredentialRefProviderRuntimeAdapter({ resolverRuntime });
  const attemptResults = [];
  for (let attemptIndex = 0; attemptIndex < auth.maxRequests; attemptIndex += 1) {
    const attempt = await adapter.runGuardedProviderStabilityRequest({
      providerId: auth.providerId,
      modelId: auth.modelId,
      credentialRef: auth.credentialRef,
      prompt: auth.testPrompt,
      expectedResponseContains: auth.expectedResponseContains,
      timeoutMs: auth.timeoutMs,
      maxRequests: auth.maxRequests,
      invocationPurpose: "phase1932p_guarded_provider_stability_test",
      dryRun: false,
    });
    attemptResults.push(attempt);
    if (attempt.providerCallsMade !== true || attempt.responseContainsExpectedMarker !== true) {
      break;
    }
  }
  const adapterResult = attemptResults[attemptResults.length - 1] ?? {};
  const requestAttemptCount = attemptResults.filter((item) => item.providerCallsMade === true).length;
  const successfulResponseCount = attemptResults.filter((item) => item.providerCallsMade === true && item.responseContainsExpectedMarker === true).length;
  const failedResponseCount = attemptResults.filter((item) => item.providerCallsMade === true && item.responseContainsExpectedMarker !== true).length;
  const responseContainsExpectedMarkerCount = successfulResponseCount;
  const markerMatched = requestAttemptCount === auth.maxRequests && responseContainsExpectedMarkerCount === auth.maxRequests;
  const providerFailed = failedResponseCount > 0;
  const result = buildResult({
    authorizationValid: true,
    authorizationFailures: [],
    blocker: adapterResult.blocker === "provider_runtime_core_missing" || adapterResult.blocker === "safe_execution_invoker_missing"
      ? "safe_execution_invoker_missing"
      : adapterResult.blocker === "safe_provider_call_implementation_missing"
        ? "safe_provider_call_implementation_missing"
      : providerFailed ? "provider_stability_attempt_failed" : null,
    recommended_sealed: adapterResult.providerCallsMade === true && markerMatched,
    safeRuntimeEntryDetected: adapterResult.safeRuntimeEntryDetected === true,
    safeRuntimeEntryName: adapterResult.safeRuntimeEntryName ?? null,
    safeRuntimeEntryRequired: true,
    safeExecutionInvokerReady: safeInvoker.safeExecutionInvokerReady === true,
    safeProviderCallImplementationReady: safeInvoker.providerCallImplementationReady === true,
    providerCallImplementationReady: implementationDryRun.providerCallImplementationReady === true,
    providerCallImplementationName: safeInvoker.providerCallImplementationName ?? null,
    providerRuntimeCoreReady: adapterResult.providerRuntimeCoreReady === true,
    resolvedCredentialRef: adapterResult.resolvedCredentialRef === true,
    safeRuntimeEntryDetectionReason: adapterResult.blocker === "safe_provider_call_implementation_missing"
      ? "Safe provider call implementation is ready, but no authorized safe internal provider executor is available for real calls."
      : adapterResult.blocker === "safe_execution_invoker_missing"
      ? "CredentialRef resolver runtime exists, but no safe execution invoker has been injected for real Provider calls."
      : adapterResult.blocker === "provider_runtime_core_missing"
        ? "CredentialRef-only adapter exists, but no complete safe Provider runtime core has been injected."
      : null,
    blockedBeforeProviderCall: adapterResult.providerCallsMade !== true,
    requestAttemptCount,
    successfulResponseCount,
    failedResponseCount,
    responseContainsExpectedMarkerCount,
    stabilityClassification: adapterResult.providerCallsMade !== true
      ? adapterResult.blocker === "safe_provider_call_implementation_missing"
        ? "not_executed_safe_provider_call_implementation_missing"
        : adapterResult.blocker === "safe_execution_invoker_missing"
        ? "not_executed_safe_execution_invoker_missing"
        : "not_executed_safe_provider_runtime_entry_missing"
      : markerMatched ? "guarded_3_of_3_pass" : "provider_stability_attempt_failed",
    realProviderCallExecuted: adapterResult.realProviderCallExecuted === true,
    providerCallsMade: adapterResult.providerCallsMade === true,
    sanitizedResponsePreview: adapterResult.sanitizedResponsePreview ?? null,
  });
  writeJson(resultPath, result);
  console.log(JSON.stringify(result, null, 2));
  if (result.recommended_sealed !== true || result.blocker !== null) {
    process.exitCode = 1;
  }
  }
}
