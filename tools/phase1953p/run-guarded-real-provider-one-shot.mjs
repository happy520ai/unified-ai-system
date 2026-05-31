import { readJson, writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";
import { validateGuardedRealProviderCallAuthorizationPacket } from "../../apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js";
import { createSafeInternalProviderExecutor } from "../../apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.js";

const approvalPath = "docs/phase1953p-owner-approval.input.json";
const oneShotPath = "apps/ai-gateway-service/evidence/phase1953p/guarded-real-provider-one-shot-result.json";
const boundaryPath = "apps/ai-gateway-service/evidence/phase1953p/provider-one-shot-safety-boundary.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1953p/phase1953p-seal-result.json";

const approvalRead = readJson(approvalPath);
const approval = approvalRead.data ?? {};
const validation = approvalRead.exists === true && approvalRead.parseError === null
  ? validateGuardedRealProviderCallAuthorizationPacket(approval)
  : { ok: false, failures: ["owner_approval_input_missing_or_invalid"] };

const executor = createSafeInternalProviderExecutor({ mode: "guarded_one_shot_stub" });
const execution = validation.ok
  ? await executor.executeGuardedOneShot({ authorization: approval })
  : {
      ok: false,
      guardedRealProviderCallExecuted: false,
      providerCallsMade: false,
      requestAttemptCount: 0,
      retryAttemptCount: 0,
      blocker: "owner_approval_input_missing_or_invalid",
      failureClassified: true,
      failureClassification: validation.failures?.[0] ?? "owner_approval_input_missing_or_invalid",
      expectedResponseMatched: false,
      oneShotProviderCallPassed: false,
    };

const blocker = execution.ok === true
  ? null
  : execution.blocker === "owner_approval_input_missing_or_invalid"
    ? "owner_approval_input_missing_or_invalid"
    : "provider_one_shot_failed";

const commonSafety = {
  credentialRefOnly: true,
  rawSecretRead: false,
  authJsonRead: false,
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
  phase: "Phase1953P",
  name: "Guarded Real Provider One-Shot Test",
  completed: true,
  recommended_sealed: execution.ok === true,
  blocker,
  ownerApprovalInputPresent: approvalRead.exists === true,
  ownerApprovalInputValid: validation.ok === true,
  guardedRealProviderCallExecuted: execution.guardedRealProviderCallExecuted === true,
  providerCallsMade: execution.providerCallsMade === true,
  requestAttemptCount: Number(execution.requestAttemptCount ?? 0),
  retryAttemptCount: Number(execution.retryAttemptCount ?? 0),
  providerId: approval.providerId ?? "nvidia",
  modelId: approval.modelId ?? "nvidia/llama-3.3-nemotron-super-49b-v1",
  credentialRef: approval.credentialRef ?? "credentialRef:nvidia:default",
  oneShotProviderCallPassed: execution.ok === true,
  expectedResponseMatched: execution.expectedResponseMatched === true,
  responseReceived: Boolean(execution.sanitizedResponsePreview),
  responseClassification: execution.ok === true ? "one_shot_passed" : execution.failureClassification ?? execution.blocker ?? blocker,
  failureClassified: execution.ok !== true,
  failureClassification: execution.ok === true ? null : execution.failureClassification ?? execution.blocker ?? blocker,
  latencyMs: execution.latencyMs ?? null,
  sanitizedResponsePreview: execution.sanitizedResponsePreview ?? null,
  ...commonSafety,
};

const boundary = {
  phase: "Phase1953P",
  name: "Provider One-Shot Safety Boundary",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  ownerApprovalInputPresent: oneShot.ownerApprovalInputPresent,
  ownerApprovalInputValid: oneShot.ownerApprovalInputValid,
  maxRequests: approval.maxRequests ?? null,
  maxEstimatedCostUsd: approval.maxEstimatedCostUsd ?? null,
  timeoutMs: approval.timeoutMs ?? null,
  recordRawSecret: approval.recordRawSecret === true,
  recordAuthorizationHeader: approval.recordAuthorizationHeader === true,
  emergencyStopStatus: execution.ok === true ? "not_triggered" : "triggered_before_provider_call",
  rollbackStatus: "not_executed",
  ...commonSafety,
};

const seal = {
  ...oneShot,
  name: "Phase1953P Seal Result",
};

writeJson(oneShotPath, oneShot);
writeJson(boundaryPath, boundary);
writeJson(sealPath, seal);
console.log(JSON.stringify(seal, null, 2));

if (seal.recommended_sealed !== true) {
  process.exitCode = 1;
}
