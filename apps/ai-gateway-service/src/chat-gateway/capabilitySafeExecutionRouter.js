import { ENDPOINT_TYPES, DIRECT_CHAT_CAPABILITIES } from "../model-library/modelCapabilityRules.js";
import { buildProviderLatencyAccountability } from "./providerLatencyPolicy.js";
import { buildProviderRetryFallbackAccountability, defaultFallbackModelFor } from "./providerRetryFallbackPolicy.js";

export async function executeCapabilitySafePlan({ plan, input, messages, nvidiaClient } = {}) {
  const startedAt = Date.now();
  const steps = [
    { step: "intent_classified", status: "done", intentType: plan?.intentType ?? "unknown" },
    { step: "model_planned", status: plan?.blocked ? "blocked" : "done", modelId: plan?.selected?.modelId ?? null },
  ];

  if (!plan || plan.blocked) {
    return blockedExecution({
      code: plan?.blocker?.code ?? "gateway_plan_blocked",
      message: plan?.blocker?.message ?? "Gateway plan blocked before provider execution.",
      plan,
      steps,
      startedAt,
    });
  }

  const selected = plan.selected;
  if (!selected?.providerId || !selected?.modelId) {
    return blockedExecution({
      code: "gateway_plan_missing_model",
      message: "Gateway plan has no selected model, so no provider can be called.",
      plan,
      steps,
      startedAt,
    });
  }

  if (selected.providerId !== "nvidia") {
    return blockedExecution({
      code: "provider_not_allowed_phase312a",
      message: "Phase312A only allows NVIDIA real provider execution.",
      plan,
      steps,
      startedAt,
    });
  }

  if (!nvidiaClient) {
    return blockedExecution({
      code: "nvidia_client_unavailable",
      message: "NVIDIA unified client is unavailable.",
      plan,
      steps,
      startedAt,
    });
  }

  steps.push({ step: "provider_call_started", status: "running", providerId: "nvidia", endpointType: selected.endpointType });
  const call = await callSelectedEndpoint({ selected, input, messages, nvidiaClient, intentType: plan.intentType });
  const responseShapeOk = call.success === true || Boolean(call.data?.text || call.data?.outputText);
  const nonEmptyOutput = Boolean(extractFinalAnswer(call, selected));
  const latency = buildProviderLatencyAccountability({
    providerCalled: call.meta?.providerCalled === true,
    success: call.success === true,
    code: call.code,
    httpStatus: call.data?.httpStatus ?? call.meta?.httpStatus ?? null,
    durationMs: call.meta?.durationMs ?? 0,
    providerTimeoutMs: call.meta?.providerTimeoutMs,
    startedAt: call.meta?.startedAt,
    completedAt: call.meta?.completedAt,
    timeoutHit: call.meta?.timeoutHit === true,
    timeoutType: call.meta?.timeoutType ?? "none",
    responseShapeOk,
    nonEmptyOutput,
  });
  const retryFallback = buildProviderRetryFallbackAccountability({
    providerCalled: call.meta?.providerCalled === true,
    success: call.success === true,
    code: call.code,
    httpStatus: latency.httpStatus,
    timeoutType: latency.timeoutType,
    latencyRiskLevel: latency.latencyRiskLevel,
    fallbackModel: defaultFallbackModelFor(selected.modelId),
    realFallbackEnabled: false,
  });
  steps[steps.length - 1] = {
    step: "provider_called",
    status: call.success ? "done" : "failed",
    providerId: "nvidia",
    endpointType: selected.endpointType,
    providerCalled: call.meta?.providerCalled === true,
    modelCalled: call.meta?.modelCalled ?? null,
    durationMs: latency.durationMs,
    timeoutHit: latency.timeoutHit,
    httpStatus: latency.httpStatus,
  };

  const finalAnswer = extractFinalAnswer(call, selected);
  return {
    success: call.success === true,
    code: call.success ? "gateway_execution_ok" : call.code,
    message: call.success ? "Gateway execution completed through the planned NVIDIA endpoint." : call.message,
    finalAnswer,
    data: {
      outputText: finalAnswer,
      providerResult: call.data,
    },
    error: call.error ?? null,
    providerResult: call,
    warnings: Array.from(new Set([...(Array.isArray(plan.warnings) ? plan.warnings : []), ...latencyWarnings(latency, retryFallback)])),
    blocker: call.success ? null : { code: call.code, message: call.message },
    meta: {
      providerId: "nvidia",
      modelId: selected.modelId,
      endpointType: selected.endpointType,
      providerCalled: call.meta?.providerCalled === true,
      modelCalled: call.meta?.modelCalled ?? null,
      requestId: call.meta?.requestId ?? null,
      startedAt: call.meta?.startedAt ?? new Date(startedAt).toISOString(),
      completedAt: call.meta?.completedAt ?? new Date().toISOString(),
      durationMs: latency.durationMs,
      providerTimeoutMs: latency.providerTimeoutMs,
      timeoutHit: latency.timeoutHit,
      timeoutType: latency.timeoutType,
      lateResponseReceived: latency.lateResponseReceived,
      httpStatus: latency.httpStatus,
      retryable: retryFallback.retryable,
      retryRecommended: retryFallback.retryRecommended,
      retryAttempted: retryFallback.retryAttempted,
      retryCount: retryFallback.retryCount,
      fallbackEligible: retryFallback.fallbackEligible,
      fallbackAttempted: retryFallback.fallbackAttempted,
      fallbackModel: retryFallback.fallbackModel,
      fallbackReason: retryFallback.fallbackReason,
      latencyRiskLevel: latency.latencyRiskLevel,
      completionConfidence: latency.completionConfidence,
      userVisibleLatencySummary: latency.userVisibleLatencySummary,
      realExternalCall: call.meta?.realExternalCall === true,
      fallbackUsed: call.meta?.fallbackUsed === true || plan.fallbackUsed === true,
      executionSteps: steps,
    },
  };
}

async function callSelectedEndpoint({ selected, input, messages, nvidiaClient, intentType }) {
  const modelId = selected.modelId;
  if (selected.endpointType === ENDPOINT_TYPES.chat) {
    return nvidiaClient.chatCompletion({
      modelId,
      messages,
      prompt: input,
      capability: normalizeChatCapability(selected.capability, intentType),
      maxTokens: 256,
    });
  }

  if (selected.endpointType === ENDPOINT_TYPES.embeddings) {
    return nvidiaClient.embeddings({ modelId, input: input || "phase312a knowledge query" });
  }

  if (selected.endpointType === ENDPOINT_TYPES.rerank) {
    return nvidiaClient.rerank({
      modelId,
      query: input || "phase312a knowledge query",
      passages: [
        "Phase312A validates unified model library routing.",
        "This unrelated passage should rank lower.",
      ],
    });
  }

  if (selected.endpointType === ENDPOINT_TYPES.safety) {
    return nvidiaClient.safety({ modelId, text: input || "This is a harmless safety review request." });
  }

  if (selected.endpointType === ENDPOINT_TYPES.pii) {
    return nvidiaClient.piiDetection({ modelId, text: input || "Contact test@example.com for a harmless PII scan." });
  }

  if (selected.endpointType === ENDPOINT_TYPES.translation) {
    return nvidiaClient.translation({ modelId, text: input || "Hello world.", targetLanguage: "Chinese" });
  }

  return {
    success: false,
    code: "endpoint_not_executable_in_phase312a",
    message: `Endpoint type ${selected.endpointType} is visible in the model library but blocked from generic gateway execution.`,
    data: null,
    error: { code: "endpoint_not_executable_in_phase312a" },
    meta: {
      providerId: selected.providerId,
      modelId,
      endpointType: selected.endpointType,
      providerCalled: false,
      modelCalled: null,
      requestId: null,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
      providerTimeoutMs: 0,
      timeoutHit: false,
      timeoutType: "none",
      lateResponseReceived: false,
      httpStatus: null,
      retryable: false,
      retryRecommended: false,
      retryAttempted: false,
      retryCount: 0,
      fallbackEligible: false,
      fallbackAttempted: false,
      fallbackModel: null,
      fallbackReason: "Endpoint is not executable in generic gateway; fallback is not eligible.",
      latencyRiskLevel: "normal",
      completionConfidence: "failed",
      userVisibleLatencySummary: "未调用 provider。",
      realExternalCall: false,
      fallbackUsed: false,
    },
  };
}

function normalizeChatCapability(capability, intentType) {
  if (DIRECT_CHAT_CAPABILITIES.includes(capability)) return capability;
  if (intentType === "coding" || intentType === "debug_fix") return "chat_coding";
  return "chat_general";
}

function extractFinalAnswer(call, selected) {
  if (typeof call?.data?.text === "string" && call.data.text.trim()) return call.data.text.trim();
  if (typeof call?.data?.outputText === "string" && call.data.outputText.trim()) return call.data.outputText.trim();
  if (selected.endpointType === ENDPOINT_TYPES.embeddings && call?.data?.embeddingReturned) {
    return `Embedding endpoint returned a vector with length ${call.data.vectorLength}.`;
  }
  if (selected.endpointType === ENDPOINT_TYPES.rerank && call?.data?.rankingCount > 0) {
    return `Rerank endpoint returned ${call.data.rankingCount} ranking result(s).`;
  }
  return "";
}

function blockedExecution({ code, message, plan, steps, startedAt }) {
  return {
    success: false,
    code,
    message,
    finalAnswer: "",
    data: null,
    error: { code, message },
    providerResult: null,
    warnings: Array.isArray(plan?.warnings) ? plan.warnings : [],
    blocker: { code, message },
    meta: {
      providerId: plan?.selected?.providerId ?? "nvidia",
      modelId: plan?.selected?.modelId ?? null,
      endpointType: plan?.selected?.endpointType ?? null,
      providerCalled: false,
      modelCalled: null,
      requestId: null,
      startedAt: new Date(startedAt).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      providerTimeoutMs: 0,
      timeoutHit: false,
      timeoutType: "none",
      lateResponseReceived: false,
      httpStatus: null,
      retryable: false,
      retryRecommended: false,
      retryAttempted: false,
      retryCount: 0,
      fallbackEligible: false,
      fallbackAttempted: false,
      fallbackModel: null,
      fallbackReason: plan?.fallbackReason ?? "",
      latencyRiskLevel: "normal",
      completionConfidence: "failed",
      userVisibleLatencySummary: "未调用 provider。",
      realExternalCall: false,
      fallbackUsed: plan?.fallbackUsed === true,
      executionSteps: steps,
    },
  };
}

function latencyWarnings(latency, retryFallback) {
  const warnings = [];
  if (latency.latencyRiskLevel === "slow") warnings.push("provider_response_slow");
  if (latency.latencyRiskLevel === "timeout_handled") warnings.push("provider_timeout_handled");
  if (latency.latencyRiskLevel === "timeout_failed") warnings.push("provider_timeout_failed");
  if (retryFallback.retryRecommended) warnings.push("retry_recommended");
  if (retryFallback.fallbackEligible && !retryFallback.fallbackAttempted) warnings.push("fallback_eligible_not_attempted");
  return warnings;
}
