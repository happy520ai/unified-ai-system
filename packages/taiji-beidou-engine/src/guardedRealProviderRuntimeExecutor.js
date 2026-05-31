import { evaluateProviderRuntimeCostQuota } from "./providerRuntimeCostQuotaGuard.js";
import { classifyProviderRuntimeResponse } from "./providerRuntimeFailureClassifier.js";

export async function runGuardedRealProviderRuntimeOneShot(input = {}) {
  const approval = input.approval || null;
  const gate = input.gate || {};
  const providerClient = input.providerClient || null;
  const prompt = "Reply with exactly: TAIJI_BEIDOUREAL_PROVIDER_RUNTIME_OK";

  if (!approval || gate.realProviderRuntimeAllowed !== true) {
    return blockedResult({
      approval,
      gate,
      responseClassification: approval ? "blocked_by_gate" : "blocked_by_missing_approval",
      prompt,
    });
  }

  const quota = evaluateProviderRuntimeCostQuota({
    maxRequests: approval.maxRequests,
    actualRequests: 1,
    maxRetries: approval.maxRetries,
    retryAttemptCount: 0,
    maxEstimatedCostUsd: approval.maxEstimatedCostUsd,
    estimatedCostUsd: 0,
  });

  if (quota.maxRequestsRespected !== true || quota.budgetExceeded === true) {
    return blockedResult({
      approval,
      gate,
      responseClassification: "blocked_by_gate",
      prompt,
      budgetExceeded: quota.budgetExceeded,
    });
  }

  if (typeof providerClient !== "function") {
    return blockedResult({
      approval,
      gate,
      responseClassification: "blocked_by_gate",
      prompt,
    });
  }

  try {
    const response = await providerClient({
      providerId: approval.providerId,
      modelId: approval.modelId,
      credentialRef: approval.credentialRef,
      prompt,
      maxRequests: approval.maxRequests,
    });
    if (response?.blockedBeforeProviderCall === true) {
      return blockedResult({
        approval,
        gate,
        responseClassification: "blocked_by_gate",
        blockedReason: response.blockedReason || "provider_runtime_gate_blocked",
        prompt,
      });
    }
    const responseText = String(response?.text || "");
    return {
      realProviderCallExecuted: true,
      providerId: approval.providerId,
      modelId: approval.modelId,
      capabilityId: approval.capabilityId,
      credentialRefUsed: true,
      rawSecretRead: false,
      secretValueExposed: false,
      requestAttemptCount: 1,
      retryAttemptCount: 0,
      responseReceived: true,
      responseMarkerMatched: responseText.includes("TAIJI_BEIDOUREAL_PROVIDER_RUNTIME_OK"),
      responseClassification: classifyProviderRuntimeResponse({ responseReceived: true, responseText }),
      providerEnvelopeCode: response?.providerEnvelopeCode || null,
      costEstimateUsd: 0,
      budgetExceeded: false,
      maxRequestsRespected: true,
      maxRetriesRespected: true,
      chatBehaviorChanged: false,
      chatGatewayExecuteBehaviorChanged: false,
      deployExecuted: false,
    };
  } catch {
    return {
      realProviderCallExecuted: true,
      providerId: approval.providerId,
      modelId: approval.modelId,
      capabilityId: approval.capabilityId,
      credentialRefUsed: true,
      rawSecretRead: false,
      secretValueExposed: false,
      requestAttemptCount: 1,
      retryAttemptCount: 0,
      responseReceived: false,
      responseMarkerMatched: false,
      responseClassification: "provider_call_failed",
      costEstimateUsd: 0,
      budgetExceeded: false,
      maxRequestsRespected: true,
      maxRetriesRespected: true,
      chatBehaviorChanged: false,
      chatGatewayExecuteBehaviorChanged: false,
      deployExecuted: false,
    };
  }
}

function blockedResult(input) {
  const approval = input.approval || {};
  return {
    realProviderCallExecuted: false,
    providerId: approval.providerId || "nvidia",
    modelId: approval.modelId || null,
    capabilityId: approval.capabilityId || null,
    credentialRefUsed: Boolean(approval.credentialRef),
    rawSecretRead: false,
    secretValueExposed: false,
    requestAttemptCount: 0,
    retryAttemptCount: 0,
    responseReceived: false,
    responseMarkerMatched: false,
    responseClassification: input.responseClassification,
    blockedReason: input.blockedReason || null,
    costEstimateUsd: 0,
    budgetExceeded: input.budgetExceeded === true,
    maxRequestsRespected: Number(approval.maxRequests || 1) <= 3,
    maxRetriesRespected: Number(approval.maxRetries || 0) === 0,
    chatBehaviorChanged: false,
    chatGatewayExecuteBehaviorChanged: false,
    deployExecuted: false,
  };
}
