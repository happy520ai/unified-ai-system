import {
  REAL_PROVIDER_RUNTIME_ALLOWED_NVIDIA_MODELS,
  REAL_PROVIDER_RUNTIME_BLOCKED_MODELS,
  validateRealProviderRuntimeApproval,
} from "./realProviderRuntimeAuthorizationSchema.js";

export function evaluateCredentialRefProviderRuntimeGate(input = {}) {
  const approval = input.approval || null;
  const runtimeRegistry = input.runtimeRegistry || { admittedCapabilities: [] };
  const executionEvidenceById = input.executionEvidenceById || {};
  const validation = approval ? validateRealProviderRuntimeApproval(approval, input.validationOptions) : {
    authorizationComplete: false,
    failures: ["real_provider_runtime_approval_missing"],
    providerIdAllowedList: ["nvidia"],
    credentialRefOnly: false,
  };
  const capability = runtimeRegistry.admittedCapabilities?.find((item) => item.capabilityId === approval?.capabilityId) ||
    runtimeRegistry.admittedCapabilities?.[0] ||
    null;
  const sandboxExecution = capability ? executionEvidenceById[capability.capabilityId] : null;
  const failures = [...validation.failures];

  if (!capability) failures.push("runtime_admitted_capability_missing");
  if (capability && sandboxExecution?.executionStatus !== "passed") failures.push("sandbox_execution_not_passed");
  if (capability && !capability.rollbackRef) failures.push("rollback_missing");
  if (capability?.safetyBoundary?.providerCallsAllowed !== false) failures.push("sandbox_safety_provider_boundary_broken");
  if (approval?.providerId && approval.providerId !== "nvidia") failures.push("non_nvidia_provider_blocked");
  if (approval?.modelId && !REAL_PROVIDER_RUNTIME_ALLOWED_NVIDIA_MODELS.includes(approval.modelId)) failures.push("model_not_allowed_or_unverified");
  if (approval?.modelId && REAL_PROVIDER_RUNTIME_BLOCKED_MODELS.includes(approval.modelId)) failures.push("failed_or_high_risk_model_blocked");
  if (approval?.allowChatMutation === true) failures.push("chat_mutation_blocked");
  if (approval?.allowChatGatewayExecuteMutation === true) failures.push("execute_mutation_blocked");
  if (approval?.allowDeploy === true) failures.push("deploy_blocked");
  if (approval?.approvalOwner && approval.approvalOwner !== "human-user") failures.push("capability_self_approval_blocked");

  const allowed = failures.length === 0;
  return {
    capabilityId: capability?.capabilityId || approval?.capabilityId || null,
    admissionStatus: allowed ? "approved_for_guarded_real_provider_runtime_v0" : "blocked",
    runtimeKind: "guarded_real_provider_v0",
    providerId: approval?.providerId || "nvidia",
    modelId: approval?.modelId || null,
    credentialRefOnly: validation.credentialRefOnly || false,
    authorizationComplete: validation.authorizationComplete,
    realProviderRuntimeAllowed: allowed,
    providerRuntimeDefaultEnabled: false,
    productionReady: false,
    mainChainRuntimeReady: false,
    nonNvidiaProviderBlocked: true,
    rollbackAvailable: Boolean(capability?.rollbackRef),
    rollbackRef: capability?.rollbackRef || null,
    maxSpawnDepth: 1,
    failures,
    providerCallsAllowed: allowed,
    secretReadAllowed: false,
    deployAllowed: false,
    chatMutationAllowed: false,
    chatGatewayExecuteMutationAllowed: false,
  };
}
