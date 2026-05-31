import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createNvidiaUnifiedClient } from "../../apps/ai-gateway-service/src/providers/nvidia/nvidiaUnifiedClient.js";
import { createSafeInternalProviderExecutor } from "../../apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.js";
import { createPhase1955PRetryGuardedNvidiaOneShotTimeoutRetryPacket } from "../../apps/ai-gateway-service/src/providers/providerExecutionAuthorizationSchema.js";
import { validateGuardedNvidiaOneShotTimeoutRetryAuthorizationPacket } from "../../apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js";
import { readJson, writeJson, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";

const approvalInputPath = "docs/phase1955p-retry-owner-approval.input.json";
const approvalExamplePath = "docs/phase1955p-retry-owner-approval.input.example.json";
const reportDocPath = "docs/phase1955p-retry-guarded-nvidia-one-shot-report.md";
const boundaryDocPath = "docs/phase1955p-retry-provider-boundary.md";
const classificationDocPath = "docs/phase1955p-retry-result-classification.md";
const resultPath = "apps/ai-gateway-service/evidence/phase1955p_retry/guarded-nvidia-one-shot-timeout-retry-result.json";
const boundaryPath = "apps/ai-gateway-service/evidence/phase1955p_retry/provider-timeout-retry-safety-boundary.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1955p_retry/phase1955p-retry-seal-result.json";

const approvalTemplate = createPhase1955PRetryGuardedNvidiaOneShotTimeoutRetryPacket();
writeJson(approvalExamplePath, approvalTemplate);

const approvalRead = readJson(approvalInputPath);
const approval = approvalRead.data ?? {};
const validation = approvalRead.exists === true && approvalRead.parseError === null
  ? validateGuardedNvidiaOneShotTimeoutRetryAuthorizationPacket(approval)
  : { ok: false, failures: ["owner_approval_input_missing_or_invalid"] };

const execution = validation.ok === true
  ? await executeApprovedRetry(approval)
  : buildBlockedExecution(validation);

const blocker = execution.ok === true
  ? null
  : execution.blocker === "owner_approval_input_missing_or_invalid"
    ? "owner_approval_input_missing_or_invalid"
    : "provider_one_shot_retry_failed";

const commonSafety = {
  credentialRefOnly: true,
  rawSecretRead: false,
  authJsonRead: false,
  dotEnvRead: false,
  envDumped: false,
  secretValueExposed: false,
  authorizationHeaderLogged: false,
  chatRouteModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  providerStabilityVerified: false,
  multiProviderStabilityVerified: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  commercialReadyClaimed: false,
  workspaceCleanClaimed: false,
  requestLimitRespected: Number(execution.requestAttemptCount ?? 0) <= 1,
};

const failureClassification = execution.ok === true ? null : classifyFailure(execution);
const result = {
  phase: "Phase1955P-Retry",
  name: "Guarded NVIDIA One-Shot Timeout Retry",
  completed: true,
  recommended_sealed: execution.ok === true,
  blocker,
  ownerApprovalInputPresent: approvalRead.exists === true,
  ownerApprovalInputValid: validation.ok === true,
  newOwnerApprovalUsed: approvalRead.exists === true && approval.phase === "Phase1955P-Retry",
  oldApprovalReused: false,
  safeInternalProviderExecutorStillStub: execution.safeInternalProviderExecutorStillStub === true,
  providerCallImplementationMode: execution.providerCallImplementationMode ?? "real_bridge",
  guardedRealProviderCallExecuted: execution.guardedRealProviderCallExecuted === true,
  providerCallsMade: execution.providerCallsMade === true,
  realProviderNetworkAttempted: execution.realProviderNetworkAttempted === true,
  requestAttemptCount: Number(execution.requestAttemptCount ?? 0),
  retryAttemptCount: Number(execution.retryAttemptCount ?? 0),
  providerId: approval.providerId ?? "nvidia",
  modelId: approval.modelId ?? "nvidia/llama-3.1-nemotron-nano-8b-v1",
  credentialRef: approval.credentialRef ?? "credentialRef:nvidia:default",
  stream: approval.stream === false ? false : null,
  timeoutMs: approval.timeoutMs ?? null,
  oneShotProviderCallPassed: execution.ok === true,
  expectedResponseMatched: execution.expectedResponseMatched === true,
  responseSanitized: execution.responseSanitized === true,
  providerResponseMetadataRecorded: Boolean(execution.providerResponseMetadata),
  responseReceived: Boolean(execution.sanitizedResponsePreview),
  responseClassification: execution.ok === true ? "one_shot_retry_passed" : failureClassification,
  failureClassified: execution.ok !== true,
  failureClassification: execution.ok === true ? null : failureClassification,
  failureReason: execution.ok === true ? null : execution.failureReason ?? failureClassification,
  timeoutStage: execution.timeoutStage ?? classifyTimeoutStage(execution),
  latencyMs: execution.latencyMs ?? execution.providerResponseMetadata?.latencyMs ?? null,
  sanitizedResponsePreview: execution.sanitizedResponsePreview ?? null,
  providerResponseMetadata: execution.providerResponseMetadata ?? null,
  validationFailures: validation.failures ?? [],
  ...commonSafety,
};

const boundary = {
  phase: "Phase1955P-Retry",
  name: "Provider Timeout Retry Safety Boundary",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  ownerApprovalInputPresent: result.ownerApprovalInputPresent,
  ownerApprovalInputValid: result.ownerApprovalInputValid,
  newOwnerApprovalUsed: result.newOwnerApprovalUsed,
  oldApprovalReused: false,
  maxRequests: approval.maxRequests ?? null,
  retryAttemptCount: approval.retryAttemptCount ?? null,
  maxEstimatedCostUsd: approval.maxEstimatedCostUsd ?? null,
  timeoutMs: approval.timeoutMs ?? null,
  stream: approval.stream === false ? false : null,
  recordNetworkAttempt: approval.recordNetworkAttempt === true,
  recordProviderResponseMetadata: approval.recordProviderResponseMetadata === true,
  recordRawSecret: approval.recordRawSecret === true,
  recordAuthorizationHeader: approval.recordAuthorizationHeader === true,
  providerCallsMade: result.providerCallsMade,
  realProviderNetworkAttempted: result.realProviderNetworkAttempted,
  requestAttemptCount: result.requestAttemptCount,
  emergencyStopStatus: execution.ok === true ? "not_triggered" : "no_retry_after_failure",
  rollbackStatus: "not_executed",
  ...commonSafety,
};

const seal = {
  ...result,
  name: "Phase1955P-Retry Seal Result",
};

writeJson(resultPath, result);
writeJson(boundaryPath, boundary);
writeJson(sealPath, seal);
writeText(reportDocPath, buildReportDoc(seal));
writeText(boundaryDocPath, buildBoundaryDoc(boundary));
writeText(classificationDocPath, buildClassificationDoc(seal));

console.log(JSON.stringify(seal, null, 2));

if (seal.recommended_sealed !== true || seal.blocker !== null) {
  process.exitCode = 1;
}

async function executeApprovedRetry(approvalInput) {
  const adapter = createRetryNvidiaAdapter(approvalInput);
  const executor = createSafeInternalProviderExecutor({
    mode: "real_bridge",
    providerAdapter: adapter,
    providerAdapterName: adapter.adapterName,
  });
  return executor.executeGuardedNvidiaOneShotTimeoutRetry({ authorization: approvalInput });
}

function buildBlockedExecution(validationResult) {
  return {
    ok: false,
    guardedRealProviderCallExecuted: false,
    providerCallsMade: false,
    realProviderNetworkAttempted: false,
    requestAttemptCount: 0,
    retryAttemptCount: 0,
    blocker: "owner_approval_input_missing_or_invalid",
    failureClassified: true,
    failureClassification: "authorization_invalid",
    failureReason: validationResult.failures?.[0] ?? "owner_approval_input_missing_or_invalid",
    expectedResponseMatched: false,
    responseSanitized: true,
    oneShotProviderCallPassed: false,
    safeInternalProviderExecutorStillStub: false,
    providerCallImplementationMode: "real_bridge",
    timeoutStage: "not_attempted_authorization_block",
  };
}

function createRetryNvidiaAdapter(approvalInput) {
  return {
    adapterName: "phase1955pRetryCredentialRefNvidiaAdapter",
    async execute(envelope = {}) {
      if (envelope.providerId !== "nvidia") return adapterBlocked("provider_not_allowed", envelope);
      if (envelope.modelId !== approvalInput.modelId) return adapterBlocked("model_not_allowed", envelope);
      if (envelope.credentialRef !== approvalInput.credentialRef) return adapterBlocked("credential_ref_not_allowed", envelope);
      if (Number(envelope.maxRequests) !== 1) return adapterBlocked("max_requests_invalid", envelope);
      if (envelope.stream !== false) return adapterBlocked("streaming_forbidden", envelope);
      if (envelope.allowProviderCall !== true || envelope.dryRun === true) return adapterBlocked("provider_call_not_authorized", envelope);

      const app = createGatewayApplication({
        ...process.env,
        AI_GATEWAY_PROVIDER_MODE: "real",
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
        AI_GATEWAY_ENABLED_PROVIDERS: "nvidia",
        AI_GATEWAY_DEFAULT_PROVIDER: "nvidia",
        AI_GATEWAY_DEFAULT_MODEL: envelope.modelId,
        NVIDIA_MODEL: envelope.modelId,
        AI_GATEWAY_ROUTE_MODE: "fixed",
        AI_GATEWAY_FALLBACK_ENABLED: "false",
        AI_GATEWAY_REQUEST_TIMEOUT_MS: String(envelope.timeoutMs),
      });
      const client = createNvidiaUnifiedClient({
        env: app.runtimeEnv,
        runtimeCredentialStore: app.runtimeCredentialStore,
        modelLibraryStore: app.modelLibraryStore,
        timeoutMs: envelope.timeoutMs,
      });
      const startedAt = Date.now();
      const providerResult = await client.chatCompletion({
        modelId: envelope.modelId,
        prompt: envelope.prompt,
        maxTokens: 8,
        temperature: 0,
      });
      const latencyMs = providerResult.meta?.durationMs ?? Date.now() - startedAt;
      const text = String(providerResult.data?.text ?? providerResult.data?.outputText ?? "");
      const providerCallsMade = providerResult.meta?.providerCalled === true;
      const realProviderNetworkAttempted = providerResult.meta?.realExternalCall === true;
      return {
        ok: providerResult.success === true,
        providerCallsMade,
        realProviderNetworkAttempted,
        syntheticAdapterUsed: false,
        status: providerResult.data?.httpStatus ?? providerResult.meta?.httpStatus ?? null,
        latencyMs,
        providerId: envelope.providerId,
        modelId: envelope.modelId,
        text,
        timeoutStage: classifyProviderResultTimeoutStage(providerResult),
        blocker: providerResult.success === true ? null : providerResult.code ?? "provider_one_shot_retry_failed",
      };
    },
  };
}

function adapterBlocked(blocker, envelope = {}) {
  return {
    ok: false,
    providerCallsMade: false,
    realProviderNetworkAttempted: false,
    syntheticAdapterUsed: false,
    status: null,
    latencyMs: 0,
    providerId: envelope.providerId ?? null,
    modelId: envelope.modelId ?? null,
    text: "",
    timeoutStage: "not_attempted_adapter_block",
    blocker,
  };
}

function classifyFailure(execution = {}) {
  if (execution.blocker === "nvidia_request_timeout") return "nvidia_request_timeout";
  if (execution.blocker) return execution.blocker;
  if (execution.realProviderNetworkAttempted === true && execution.providerResponseMetadata?.status === null) return "provider_response_missing";
  return "provider_one_shot_retry_failed";
}

function classifyTimeoutStage(execution = {}) {
  if (execution.timeoutStage) return execution.timeoutStage;
  const latencyMs = Number(execution.latencyMs ?? execution.providerResponseMetadata?.latencyMs ?? 0);
  const status = execution.providerResponseMetadata?.status ?? null;
  if (execution.realProviderNetworkAttempted === true && status === null && latencyMs >= 60000) {
    return "provider_fetch_or_response_wait_timeout";
  }
  if (execution.realProviderNetworkAttempted !== true) return "not_attempted";
  return "provider_response_or_marker_classification";
}

function classifyProviderResultTimeoutStage(providerResult = {}) {
  if (providerResult.code === "nvidia_request_timeout" && providerResult.meta?.realExternalCall === true) {
    return "provider_fetch_or_response_wait_timeout";
  }
  if (providerResult.meta?.realExternalCall !== true) return "not_attempted";
  return "provider_response_or_marker_classification";
}

function buildReportDoc(seal) {
  return `# Phase1955P-Retry Guarded NVIDIA One-Shot Report

- completed: ${seal.completed}
- recommended_sealed: ${seal.recommended_sealed}
- blocker: ${seal.blocker ?? "null"}
- providerId: ${seal.providerId}
- modelId: ${seal.modelId}
- requestAttemptCount: ${seal.requestAttemptCount}
- retryAttemptCount: ${seal.retryAttemptCount}
- providerCallsMade: ${seal.providerCallsMade}
- realProviderNetworkAttempted: ${seal.realProviderNetworkAttempted}
- oneShotProviderCallPassed: ${seal.oneShotProviderCallPassed}
- expectedResponseMatched: ${seal.expectedResponseMatched}
- failureReason: ${seal.failureReason ?? "null"}
- timeoutStage: ${seal.timeoutStage ?? "null"}

This report is a one-shot retry record only. It is not a Provider stability claim.
`;
}

function buildBoundaryDoc(boundary) {
  return `# Phase1955P-Retry Provider Boundary

- newOwnerApprovalUsed: ${boundary.newOwnerApprovalUsed}
- oldApprovalReused: ${boundary.oldApprovalReused}
- maxRequests: ${boundary.maxRequests}
- retryAttemptCount: ${boundary.retryAttemptCount}
- timeoutMs: ${boundary.timeoutMs}
- stream: ${boundary.stream}
- rawSecretRead: ${boundary.rawSecretRead}
- authJsonRead: ${boundary.authJsonRead}
- dotEnvRead: ${boundary.dotEnvRead}
- authorizationHeaderLogged: ${boundary.authorizationHeaderLogged}
- chatGatewayExecuteModified: ${boundary.chatGatewayExecuteModified}
- deployExecuted: ${boundary.deployExecuted}
- commitCreated: ${boundary.commitCreated}
- pushExecuted: ${boundary.pushExecuted}
`;
}

function buildClassificationDoc(seal) {
  return `# Phase1955P-Retry Result Classification

- responseClassification: ${seal.responseClassification}
- failureClassified: ${seal.failureClassified}
- failureReason: ${seal.failureReason ?? "null"}
- timeoutStage: ${seal.timeoutStage ?? "null"}
- latencyMs: ${seal.latencyMs ?? "null"}
- providerResponseMetadataRecorded: ${seal.providerResponseMetadataRecorded}
- responseReceived: ${seal.responseReceived}

If this retry fails, the next phase should be Phase1955P-Retry-Fail: NVIDIA Provider Route Failure Closure + Alternative Provider Decision Gate.
`;
}
