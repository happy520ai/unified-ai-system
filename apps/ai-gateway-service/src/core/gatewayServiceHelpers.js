import { createRequestId } from "@unified-ai-system/shared-utils";
import { createPinoLogger } from "../logging/pinoLogger.js";

const gatewayLogger = createPinoLogger({ app: "ai-gateway-service", level: "info" });

export function writeGatewayLog(event, details = {}) {
  gatewayLogger.info(event, details);
}

export function createFallbackAttempts(selection, runtimeConfig) {
  const candidates = runtimeConfig?.fallbackEnabled
    ? selection.candidates
    : [selection.selected];

  return candidates.map((candidate, index) => ({
    candidate,
    index,
    isLast: index === candidates.length - 1,
  }));
}

export function createAttemptSelection(baseSelection, candidate, index) {
  const warnings = [...(baseSelection.warnings ?? [])];

  if (index > 0) {
    warnings.push({
      code: "fallback_candidate_selected",
      message: "A fallback candidate was selected for this execution attempt.",
      fallbackAttempt: index + 1,
      target: candidate.target,
    });
  }

  return {
    ...baseSelection,
    selected: candidate,
    warnings,
    metadata: {
      ...baseSelection.metadata,
      fallbackAttempt: index + 1,
    },
  };
}

export function shouldTryFallback(error, attempt, emittedChunk) {
  return !attempt.isLast && !emittedChunk && error?.retryable === true;
}

export function createFallbackExhaustedError() {
  const error = new Error("Provider fallback attempts were exhausted.");
  error.code = "PROVIDER_FALLBACK_EXHAUSTED";
  error.category = "provider";
  error.retryable = false;
  return error;
}

export function createGatewayResponse(request, selection, providerResult, startedAt, runtimeConfig, extraWarnings = []) {
  const target = selection.selected.target;
  const warnings = [...(selection.warnings ?? []), ...extraWarnings, ...(providerResult.warnings ?? [])];
  const trace = createTrace({
    request,
    selection,
    providerResult,
    startedAt,
    warnings,
    runtimeConfig,
  });
  const execution = createExecutionSummary({
    trace,
    outputText: providerResult.text,
    warnings,
  });

  return {
    id: request.context.requestId,
    message: providerResult.text,
    text: providerResult.text,
    outputText: execution.outputText,
    model: target.modelId,
    providerId: target.providerId,
    selectedProvider: execution.selectedProvider,
    selectedModel: execution.selectedModel,
    executionMode: execution.executionMode,
    executionStatus: execution.executionStatus,
    warnings,
    errorSummary: null,
    finishReason: "stop",
    usage: providerResult.usage,
    routing: createRoutingDecision(request.context.requestId, request.context.traceId, selection, trace, warnings),
    metadata: {
      latencyMs: providerResult.latencyMs,
      phase: "phase-7a-1-service-entry",
      execution,
      trace,
      warnings,
      rawProviderMeta: providerResult.raw,
    },
  };
}

export function createStreamEvent(type, { request, selection, startedAt, outputText, textDelta, raw, runtimeConfig }) {
  const target = selection.selected.target;

  return {
    type,
    requestId: request.context.requestId,
    traceId: request.context.traceId,
    selectedProvider: target.providerId,
    selectedModel: target.modelId,
    executionMode: selection.selected.providerType === "fake" ? "fake" : "real",
    executionStatus: type === "done" ? "success" : "streaming",
    textDelta,
    outputText,
    rawProviderMeta: raw,
    meta: {
      phase: "phase-8a-streaming-chain",
      providerMode: runtimeConfig?.providerMode ?? "unknown",
      realProviderEnabled: runtimeConfig?.realProviderEnabled ?? false,
      durationMs: Date.now() - startedAt,
    },
  };
}

export function createRouteSuccessEnvelope(data, { traceId, startedAt }) {
  return {
    success: true,
    code: "ROUTE_OK",
    message: "Route executed successfully.",
    data,
    error: null,
    meta: createRouteMeta({
      requestId: data.id,
      traceId,
      startedAt,
      timestamp: data.metadata.trace.timestamp,
    }),
  };
}

export function createRouteFailureEnvelope(error, params = {}) {
  const startedAt = params.startedAt ?? Date.now();
  const requestId = params.request?.context?.requestId ?? params.requestId ?? createRequestId("route_error");
  const traceId = params.request?.context?.traceId ?? params.traceId ?? requestId;
  const data = createErrorData({
    request: params.request,
    selection: params.selection,
    error,
    startedAt,
    runtimeConfig: params.runtimeConfig,
    requestId,
    traceId,
  });
  const routeError = createRouteError(error, data);

  return {
    success: false,
    code: routeError.code,
    message: routeError.message,
    data,
    error: routeError,
    meta: createRouteMeta({
      requestId,
      traceId,
      startedAt,
      timestamp: data.metadata.trace.timestamp,
    }),
  };
}

export function createRouteMeta({ requestId, traceId, startedAt, timestamp }) {
  return {
    requestId,
    traceId,
    timestamp,
    durationMs: Date.now() - startedAt,
  };
}

export function createTrace({ request, selection, providerResult, startedAt, warnings, runtimeConfig }) {
  const target = selection.selected.target;

  return {
    selectedProvider: target.providerId,
    selectedModel: target.modelId,
    requestId: request.context.requestId,
    traceId: request.context.traceId,
    timestamp: new Date().toISOString(),
    providerMode: runtimeConfig?.providerMode ?? "unknown",
    routeMode: selection.metadata.mode,
    mode: selection.metadata.mode,
    realProviderEnabled: runtimeConfig?.realProviderEnabled ?? false,
    providerType: selection.selected.providerType,
    executionMode: selection.selected.providerType === "fake" ? "fake" : "real",
    executionStatus: providerResult.executionStatus ?? "success",
    durationMs: Date.now() - startedAt,
    selectionPolicy: selection.metadata.policy,
    warnings,
  };
}

export function createErrorData({ request, selection, error, startedAt, runtimeConfig, requestId, traceId }) {
  const selected = selection?.selected;
  const trace = {
    selectedProvider: selected?.target?.providerId,
    selectedModel: selected?.target?.modelId,
    requestId,
    traceId,
    timestamp: new Date().toISOString(),
    providerMode: runtimeConfig?.providerMode ?? "unknown",
    routeMode: selection?.metadata?.mode,
    mode: selection?.metadata?.mode,
    realProviderEnabled: runtimeConfig?.realProviderEnabled ?? false,
    providerType: selected?.providerType,
    executionMode: selected?.providerType === "fake" ? "fake" : selected ? "real" : "none",
    executionStatus: "error",
    durationMs: Date.now() - startedAt,
    selectionPolicy: selection?.metadata?.policy,
    warnings: selection?.warnings ?? [],
  };
  const data = createExecutionSummary({
    trace,
    outputText: "",
    warnings: trace.warnings,
  });

  return {
    id: requestId,
    ...data,
    finishReason: "error",
    routing: selection ? createRoutingDecision(requestId, traceId, selection, trace, trace.warnings) : undefined,
    metadata: {
      phase: "phase-7a-1-service-entry",
      trace,
    },
  };
}

export function createExecutionSummary({ trace, outputText, warnings, errorSummary = null }) {
  return {
    selectedProvider: trace.selectedProvider ?? null,
    selectedModel: trace.selectedModel ?? null,
    executionMode: trace.executionMode,
    executionStatus: trace.executionStatus,
    outputText,
    warnings,
    errorSummary,
  };
}

export function createRouteError(error, data) {
  return {
    code: error.code ?? "GATEWAY_ROUTE_ERROR",
    type: error.type ?? error.category ?? "internal",
    message: error instanceof Error ? error.message : "Gateway route execution failed.",
    retryable: error.retryable ?? false,
    provider: data.selectedProvider,
    model: data.selectedModel,
    details: sanitizeErrorDetails(error.details),
  };
}

export function sanitizeErrorDetails(details) {
  if (!details || typeof details !== "object") {
    return {};
  }

  const sanitized = { ...details };
  delete sanitized.apiKey;
  delete sanitized.authorization;
  delete sanitized.headers;

  return Object.fromEntries(Object.entries(sanitized).filter(([, value]) => value !== undefined));
}

export function createRoutingDecision(requestId, traceId, selection, trace, warnings) {
  return {
    id: `route-${requestId}`,
    status: selection.selected ? "selected" : "no_route",
    selected: selection.selected?.target,
    candidates: selection.candidates?.map(toRoutingCandidate) ?? [],
    fallbackChain: selection.fallbackChain,
    traceId,
    reasons: selection.reasons,
    metadata: {
      ...selection.metadata,
      trace,
      warnings,
    },
  };
}

export function toRoutingCandidate(candidate) {
  return {
    rank: candidate.rank,
    target: candidate.target,
    score: {
      total: candidate.rank === 1 ? 1 : 0,
    },
    reasons: [candidate.rank === 1 ? "selected by priority policy" : "available fallback candidate"],
    metadata: {
      providerPriority: candidate.providerPriority,
      modelPriority: candidate.modelPriority,
    },
  };
}
