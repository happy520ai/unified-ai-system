import { createRequestId } from "../../../../packages/shared-utils/src/index.js";
import { createProviderRequest } from "../providers/providerMapping.js";
import { normalizeGatewayRequest } from "./requestNormalizer.js";

export class GatewayService {
  constructor({ providerRegistry, runtimeConfig = {} }) {
    this.providerRegistry = providerRegistry;
    this.runtimeConfig = runtimeConfig;
  }

  async execute(input) {
    const startedAt = Date.now();
    let request;
    let selection;

    try {
      request = normalizeGatewayRequest(input);
      const baseSelection = this.providerRegistry.select(request);
      const attemptResult = await this.#executeWithFallback(request, baseSelection, startedAt);
      selection = attemptResult.selection;
      const providerResult = attemptResult.providerResult;
      writeGatewayLog("provider_call_completed", {
        requestId: request.context.requestId,
        traceId: request.context.traceId,
        provider: selection.selected.target.providerId,
        model: selection.selected.target.modelId,
        executionStatus: providerResult.executionStatus ?? "success",
        durationMs: Date.now() - startedAt,
      });
      const response = createGatewayResponse(request, selection, providerResult, startedAt, this.runtimeConfig, attemptResult.warnings);

      return createRouteSuccessEnvelope(response, {
        traceId: request.context.traceId,
        startedAt,
      });
    } catch (error) {
      writeGatewayLog("provider_call_failed", {
        requestId: request?.context?.requestId,
        traceId: request?.context?.traceId,
        provider: selection?.selected?.target?.providerId,
        model: selection?.selected?.target?.modelId,
        code: error?.code,
        message: error instanceof Error ? error.message : "Gateway route execution failed.",
        durationMs: Date.now() - startedAt,
      });
      return createRouteFailureEnvelope(error, {
        request,
        selection,
        startedAt,
        runtimeConfig: this.runtimeConfig,
      });
    }
  }

  async *executeStream(input) {
    const startedAt = Date.now();
    let request;
    let selection;
    let outputText = "";

    try {
      request = normalizeGatewayRequest(input);
      const baseSelection = this.providerRegistry.select(request);

      for (const attempt of createFallbackAttempts(baseSelection, this.runtimeConfig)) {
        selection = createAttemptSelection(baseSelection, attempt.candidate, attempt.index);

        if (typeof selection.selected.provider.generateStream !== "function") {
          const error = new Error("Selected provider does not support streaming.");
          error.code = "PROVIDER_STREAMING_UNSUPPORTED";
          error.category = "provider";
          error.retryable = false;
          throw error;
        }

        writeGatewayLog("provider_stream_start", {
          requestId: request.context.requestId,
          traceId: request.context.traceId,
          provider: selection.selected.target.providerId,
          model: selection.selected.target.modelId,
          attempt: attempt.index + 1,
        });

        let emittedChunk = false;

        yield createStreamEvent("start", {
          request,
          selection,
          startedAt,
          outputText,
          runtimeConfig: this.runtimeConfig,
        });

        try {
          for await (const providerChunk of selection.selected.provider.generateStream({
            ...createProviderRequest({
              request,
              target: selection.selected.target,
            }),
          })) {
            const textDelta = providerChunk.textDelta ?? "";
            outputText += textDelta;
            emittedChunk = true;

            yield createStreamEvent("chunk", {
              request,
              selection,
              startedAt,
              outputText,
              textDelta,
              raw: providerChunk.raw,
              runtimeConfig: this.runtimeConfig,
            });
          }

          writeGatewayLog("provider_stream_completed", {
            requestId: request.context.requestId,
            traceId: request.context.traceId,
            provider: selection.selected.target.providerId,
            model: selection.selected.target.modelId,
            durationMs: Date.now() - startedAt,
          });

          yield createStreamEvent("done", {
            request,
            selection,
            startedAt,
            outputText,
            runtimeConfig: this.runtimeConfig,
          });
          return;
        } catch (error) {
          const canFallback = shouldTryFallback(error, attempt, emittedChunk);
          writeGatewayLog(canFallback ? "provider_stream_fallback_attempt" : "provider_stream_attempt_failed", {
            requestId: request.context.requestId,
            traceId: request.context.traceId,
            provider: selection.selected.target.providerId,
            model: selection.selected.target.modelId,
            code: error?.code,
            retryable: Boolean(error?.retryable),
            emittedChunk,
            durationMs: Date.now() - startedAt,
          });

          if (!canFallback) {
            throw error;
          }
        }
      }

      throw createFallbackExhaustedError();
    } catch (error) {
      writeGatewayLog("provider_stream_failed", {
        requestId: request?.context?.requestId,
        traceId: request?.context?.traceId,
        provider: selection?.selected?.target?.providerId,
        model: selection?.selected?.target?.modelId,
        code: error?.code,
        message: error instanceof Error ? error.message : "Gateway stream execution failed.",
        durationMs: Date.now() - startedAt,
      });

      yield {
        type: "error",
        envelope: createRouteFailureEnvelope(error, {
          request,
          selection,
          startedAt,
          runtimeConfig: this.runtimeConfig,
        }),
      };
    }
  }

  getProviderDescriptors() {
    return this.providerRegistry.listDescriptors();
  }

  async #executeWithFallback(request, baseSelection, startedAt) {
    let lastError;
    const fallbackWarnings = [];

    for (const attempt of createFallbackAttempts(baseSelection, this.runtimeConfig)) {
      const attemptSelection = createAttemptSelection(baseSelection, attempt.candidate, attempt.index);

      writeGatewayLog("provider_call_start", {
        requestId: request.context.requestId,
        traceId: request.context.traceId,
        provider: attemptSelection.selected.target.providerId,
        model: attemptSelection.selected.target.modelId,
        attempt: attempt.index + 1,
      });

      try {
        const providerResult = await attemptSelection.selected.provider.generate({
          ...createProviderRequest({
            request,
            target: attemptSelection.selected.target,
          }),
        });

        if (attempt.index > 0) {
          fallbackWarnings.push({
            code: "fallback_executed",
            message: `Primary provider failed; executed fallback provider ${attemptSelection.selected.target.providerId}.`,
            from: baseSelection.selected.target,
            to: attemptSelection.selected.target,
          });
        }

        return {
          selection: attemptSelection,
          providerResult,
          warnings: fallbackWarnings,
        };
      } catch (error) {
        lastError = error;
        const canFallback = shouldTryFallback(error, attempt, false);
        writeGatewayLog(canFallback ? "provider_fallback_attempt" : "provider_attempt_failed", {
          requestId: request.context.requestId,
          traceId: request.context.traceId,
          provider: attemptSelection.selected.target.providerId,
          model: attemptSelection.selected.target.modelId,
          code: error?.code,
          retryable: Boolean(error?.retryable),
          durationMs: Date.now() - startedAt,
        });

        if (!canFallback) {
          throw error;
        }
      }
    }

    throw lastError ?? createFallbackExhaustedError();
  }
}

function writeGatewayLog(event, details = {}) {
  console.error(
    JSON.stringify({
      app: "ai-gateway-service",
      event,
      ...details,
    }),
  );
}

function createFallbackAttempts(selection, runtimeConfig) {
  const candidates = runtimeConfig?.fallbackEnabled
    ? selection.candidates
    : [selection.selected];

  return candidates.map((candidate, index) => ({
    candidate,
    index,
    isLast: index === candidates.length - 1,
  }));
}

function createAttemptSelection(baseSelection, candidate, index) {
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

function shouldTryFallback(error, attempt, emittedChunk) {
  return !attempt.isLast && !emittedChunk && error?.retryable === true;
}

function createFallbackExhaustedError() {
  const error = new Error("Provider fallback attempts were exhausted.");
  error.code = "PROVIDER_FALLBACK_EXHAUSTED";
  error.category = "provider";
  error.retryable = false;
  return error;
}

function createGatewayResponse(request, selection, providerResult, startedAt, runtimeConfig, extraWarnings = []) {
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
    message: providerResult.message,
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

function createStreamEvent(type, { request, selection, startedAt, outputText, textDelta, raw, runtimeConfig }) {
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

function createRouteSuccessEnvelope(data, { traceId, startedAt }) {
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

function createRouteMeta({ requestId, traceId, startedAt, timestamp }) {
  return {
    requestId,
    traceId,
    timestamp,
    durationMs: Date.now() - startedAt,
  };
}

function createTrace({ request, selection, providerResult, startedAt, warnings, runtimeConfig }) {
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

function createErrorData({ request, selection, error, startedAt, runtimeConfig, requestId, traceId }) {
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

function createExecutionSummary({ trace, outputText, warnings, errorSummary = null }) {
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

function createRouteError(error, data) {
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

function sanitizeErrorDetails(details) {
  if (!details || typeof details !== "object") {
    return {};
  }

  const sanitized = { ...details };
  delete sanitized.apiKey;
  delete sanitized.authorization;
  delete sanitized.headers;

  return Object.fromEntries(Object.entries(sanitized).filter(([, value]) => value !== undefined));
}

function createRoutingDecision(requestId, traceId, selection, trace, warnings) {
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

function toRoutingCandidate(candidate) {
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
