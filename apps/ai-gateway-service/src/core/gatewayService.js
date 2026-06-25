import { createProviderRequest } from "../providers/providerMapping.js";
import { normalizeGatewayRequest } from "./requestNormalizer.js";
import { createRequestQueue } from "../providers/requestQueue.js";
import {
  writeGatewayLog,
  createFallbackAttempts,
  createAttemptSelection,
  shouldTryFallback,
  createFallbackExhaustedError,
  createGatewayResponse,
  createStreamEvent,
  createRouteSuccessEnvelope,
  createRouteFailureEnvelope,
} from "./gatewayServiceHelpers.js";

export { createRouteFailureEnvelope } from "./gatewayServiceHelpers.js";

export class GatewayService {
  constructor({ providerRegistry, runtimeConfig = {} }) {
    this.providerRegistry = providerRegistry;
    this.runtimeConfig = runtimeConfig;
    // 请求队列：限制并发，避免触发 provider 速率限制
    // NVIDIA 免费 tier 速率限制严格，并发设为 1（串行处理）
    this.requestQueue = createRequestQueue({
      maxConcurrent: runtimeConfig.maxConcurrent ?? 1,
      maxRetries: runtimeConfig.maxRetries ?? 1,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
    });
  }

  async execute(input) {
    const startedAt = Date.now();
    let request;
    let selection;

    try {
      request = normalizeGatewayRequest(input);

      // 使用请求队列限制并发
      const baseSelection = this.providerRegistry.select(request);
      const attemptResult = await this.requestQueue.execute(
        () => this.#executeWithFallback(request, baseSelection, startedAt),
        { providerId: baseSelection.selected?.target?.providerId, model: baseSelection.selected?.target?.modelId }
      );
      selection = attemptResult.selection;
      const providerResult = attemptResult.providerResult;
      writeGatewayLog("provider_call_completed", {
        requestId: request.context.requestId,
        traceId: request.context.traceId,
        provider: selection.selected.target.providerId,
        model: selection.selected.target.modelId,
        executionStatus: providerResult.executionStatus ?? "success",
        durationMs: Date.now() - startedAt,
        queueStats: this.requestQueue.getStatus(),
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
        queueStats: this.requestQueue.getStatus(),
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
