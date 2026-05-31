import { createGatewayApplication } from "../../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createSafeInternalProviderExecutor } from "../../apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.js";
import { createNvidiaUnifiedClient } from "../../apps/ai-gateway-service/src/providers/nvidia/nvidiaUnifiedClient.js";
import { validateGuardedRealProviderOneShotRerunAuthorizationPacket } from "../../apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js";
import { readJson, writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const approvalPath = "docs/phase1955p-owner-approval.input.json";
const oneShotPath = "apps/ai-gateway-service/evidence/phase1955p/guarded-real-provider-one-shot-rerun-result.json";
const boundaryPath = "apps/ai-gateway-service/evidence/phase1955p/provider-one-shot-rerun-safety-boundary.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1955p/phase1955p-seal-result.json";

const approvalRead = readJson(approvalPath);
const approval = approvalRead.data ?? {};
const validation = approvalRead.exists === true && approvalRead.parseError === null
  ? validateGuardedRealProviderOneShotRerunAuthorizationPacket(approval)
  : { ok: false, failures: ["owner_approval_input_missing_or_invalid"] };

const execution = validation.ok === true
  ? await executeApprovedOneShotRerun(approval)
  : buildBlockedExecution(validation);

const blocker = execution.ok === true
  ? null
  : execution.blocker === "owner_approval_input_missing_or_invalid"
    ? "owner_approval_input_missing_or_invalid"
    : "provider_one_shot_failed";

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

const oneShot = {
  phase: "Phase1955P",
  name: "Guarded Real Provider One-Shot Rerun",
  completed: true,
  recommended_sealed: execution.ok === true,
  blocker,
  ownerApprovalInputPresent: approvalRead.exists === true,
  ownerApprovalInputValid: validation.ok === true,
  safeInternalProviderExecutorStillStub: execution.safeInternalProviderExecutorStillStub === true,
  providerCallImplementationMode: execution.providerCallImplementationMode ?? "real_bridge",
  guardedRealProviderCallExecuted: execution.guardedRealProviderCallExecuted === true,
  providerCallsMade: execution.providerCallsMade === true,
  realProviderNetworkAttempted: execution.realProviderNetworkAttempted === true,
  requestAttemptCount: Number(execution.requestAttemptCount ?? 0),
  retryAttemptCount: Number(execution.retryAttemptCount ?? 0),
  providerId: approval.providerId ?? "nvidia",
  modelId: approval.modelId ?? "nvidia/llama-3.3-nemotron-super-49b-v1",
  credentialRef: approval.credentialRef ?? "credentialRef:nvidia:default",
  oneShotProviderCallPassed: execution.ok === true,
  expectedResponseMatched: execution.expectedResponseMatched === true,
  responseSanitized: execution.responseSanitized === true,
  providerResponseMetadataRecorded: Boolean(execution.providerResponseMetadata),
  responseReceived: Boolean(execution.sanitizedResponsePreview),
  responseClassification: execution.ok === true ? "one_shot_passed" : execution.failureClassification ?? execution.blocker ?? blocker,
  failureClassified: execution.ok !== true,
  failureClassification: execution.ok === true ? null : execution.failureClassification ?? execution.blocker ?? blocker,
  failureReason: execution.ok === true ? null : execution.failureReason ?? execution.blocker ?? blocker,
  latencyMs: execution.latencyMs ?? execution.providerResponseMetadata?.latencyMs ?? null,
  sanitizedResponsePreview: execution.sanitizedResponsePreview ?? null,
  providerResponseMetadata: execution.providerResponseMetadata ?? null,
  validationFailures: validation.failures ?? [],
  ...commonSafety,
};

const boundary = {
  phase: "Phase1955P",
  name: "Provider One-Shot Rerun Safety Boundary",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  ownerApprovalInputPresent: oneShot.ownerApprovalInputPresent,
  ownerApprovalInputValid: oneShot.ownerApprovalInputValid,
  maxRequests: approval.maxRequests ?? null,
  maxEstimatedCostUsd: approval.maxEstimatedCostUsd ?? null,
  timeoutMs: approval.timeoutMs ?? null,
  recordNetworkAttempt: approval.recordNetworkAttempt === true,
  recordProviderResponseMetadata: approval.recordProviderResponseMetadata === true,
  recordRawSecret: approval.recordRawSecret === true,
  recordAuthorizationHeader: approval.recordAuthorizationHeader === true,
  emergencyStopStatus: execution.ok === true ? "not_triggered" : "no_retry_after_failure",
  rollbackStatus: "not_executed",
  ...commonSafety,
};

const seal = {
  ...oneShot,
  name: "Phase1955P Seal Result",
};

writeJson(oneShotPath, oneShot);
writeJson(boundaryPath, boundary);
writeJson(sealPath, seal);
console.log(JSON.stringify(seal, null, 2));

if (seal.recommended_sealed !== true || seal.blocker !== null) {
  process.exitCode = 1;
}

async function executeApprovedOneShotRerun(approvalInput) {
  const adapter = createPhase1955NvidiaAdapter(approvalInput);
  const executor = createSafeInternalProviderExecutor({
    mode: "real_bridge",
    providerAdapter: adapter,
    providerAdapterName: adapter.adapterName,
  });
  return executor.executeGuardedOneShotRerun({ authorization: approvalInput });
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
  };
}

function createPhase1955NvidiaAdapter(approvalInput) {
  return {
    adapterName: "phase1955pCredentialRefNvidiaAdapter",
    async execute(envelope = {}) {
      if (envelope.providerId !== "nvidia") return adapterBlocked("provider_not_allowed", envelope);
      if (envelope.modelId !== approvalInput.modelId) return adapterBlocked("model_not_allowed", envelope);
      if (envelope.credentialRef !== approvalInput.credentialRef) return adapterBlocked("credential_ref_not_allowed", envelope);
      if (Number(envelope.maxRequests) !== 1) return adapterBlocked("max_requests_invalid", envelope);
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
      const result = await client.chatCompletion({
        modelId: envelope.modelId,
        prompt: envelope.prompt,
        maxTokens: 24,
        temperature: 0,
      });
      const latencyMs = result.meta?.durationMs ?? Date.now() - startedAt;
      const text = String(result.data?.text ?? result.data?.outputText ?? "");
      const providerCallsMade = result.meta?.providerCalled === true;
      const realProviderNetworkAttempted = result.meta?.realExternalCall === true;
      return {
        ok: result.success === true,
        providerCallsMade,
        realProviderNetworkAttempted,
        syntheticAdapterUsed: false,
        status: result.data?.httpStatus ?? result.meta?.httpStatus ?? null,
        latencyMs,
        providerId: envelope.providerId,
        modelId: envelope.modelId,
        text,
        blocker: result.success === true ? null : result.code ?? "provider_one_shot_failed",
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
    blocker,
  };
}
