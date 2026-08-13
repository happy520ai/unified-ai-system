import { createProviderRequest } from "../providers/providerMapping.js";
import {
  createAttemptSelection,
  createFallbackAttempts,
  createFallbackExhaustedError,
  createGatewayResponse,
  createRouteFailureEnvelope,
  createRouteSuccessEnvelope,
  createStreamEvent,
  shouldTryFallback,
  writeGatewayLog,
} from "./gatewayServiceHelpers.js";
import { normalizeGatewayRequest } from "./requestNormalizer.js";
import { enforceTokenCostGuard } from "../cost/tokenCostGuard.js";


export class GatewayService {
  constructor({ providerRegistry, runtimeConfig = {}, healthScorer = null, requestLogger = null, governance = null }) {
    this.providerRegistry = providerRegistry;
    this.runtimeConfig = runtimeConfig;
    // Optional health scorer — when present, provider call outcomes are recorded
    // to power health-weighted selection in providerSelectionPolicy.
    this.healthScorer = healthScorer;
    // Optional usage ledger — when present, real chat calls are persisted with
    // token counts, latency, provider/model and status so operators can query
    // usage without external tooling. Fail-open: a ledger error never alters chat.
    this.requestLogger = requestLogger;
    // Optional governance checker (e.g. advancedRBAC) — when present and enabled
    // via runtimeConfig.modelAccessEnforce, the selected model is checked against
    // the caller's identity before any provider call is made.
    this.governance = governance;
  }

  async execute(input) {
    const startedAt = Date.now();
    let request;
    let selection;

    try {
      request = normalizeGatewayRequest(input);
      if (this.runtimeConfig.costGuardEnforce) {
        this.#enforceCostGuard(request);
      }
      const baseSelection = this.providerRegistry.select(request);
      if (this.runtimeConfig.modelAccessEnforce) {
        this.#enforceModelAccess(request, baseSelection);
      }
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
      this.#recordUsage({ request, selection, providerResult, startedAt });
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
      this.#recordUsage({ request, selection, startedAt, error });
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
        let finalProviderRaw;

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
            finalProviderRaw = providerChunk.raw;
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

          // Record successful stream for health-weighted selection
          if (this.healthScorer) {
            this.healthScorer.recordSuccess(
              selection.selected.target.providerId,
              Date.now() - startedAt,
            );
          }

          this.#recordUsage({ request, selection, startedAt, outputText });

          yield createStreamEvent("done", {
            request,
            selection,
            startedAt,
            outputText,
            raw: finalProviderRaw,
            runtimeConfig: this.runtimeConfig,
          });
          return;
        } catch (error) {
          const canFallback = shouldTryFallback(error, attempt, emittedChunk);

          // Record failed stream for health-weighted selection
          if (this.healthScorer) {
            this.healthScorer.recordFailure(
              selection.selected.target.providerId,
              error?.code ?? "unknown",
            );
          }

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

      this.#recordUsage({ request, selection, startedAt, error });

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

        // Record successful call for health-weighted selection
        if (this.healthScorer) {
          this.healthScorer.recordSuccess(
            attemptSelection.selected.target.providerId,
            providerResult.latencyMs ?? (Date.now() - startedAt),
          );
        }

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

        // Record failed call for health-weighted selection
        if (this.healthScorer) {
          this.healthScorer.recordFailure(
            attemptSelection.selected.target.providerId,
            error?.code ?? "unknown",
          );
        }

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

  #enforceCostGuard(request) {
    const guard = enforceTokenCostGuard({
      messages: request.messages,
      maxOutputTokens: request.options?.maxOutputTokens,
      userApprovedHighCost: request.options?.userApprovedHighCost === true,
      provider: request.metadata?.provider,
      model: request.metadata?.model,
    });
    if (!guard.allowed) {
      const error = new Error(
        `Token cost guard blocked the request: ${guard.reasons.join(", ")}.`,
      );
      error.code = "COST_GUARD_BLOCKED";
      error.category = "governance";
      error.retryable = false;
      error.details = { decision: guard.decision, reasons: guard.reasons, estimate: guard.estimate };
      throw error;
    }
  }

  #enforceModelAccess(request, selection) {
    if (!this.governance) return;
    const userId = request.metadata?.userId;
    if (!userId) return; // no identity on the request → skip (backwards compatible)
    const modelId = selection.selected?.target?.modelId;
    if (!modelId) return;

    const allowed = this.governance.checkModelAccess(userId, modelId);
    if (!allowed) {
      const error = new Error(`Model access denied for "${modelId}".`);
      error.code = "MODEL_ACCESS_DENIED";
      error.category = "governance";
      error.retryable = false;
      error.details = { userId, modelId };
      throw error;
    }
  }

  #recordUsage({ request, selection, providerResult, startedAt, error = null, outputText = "" }) {
    if (!this.requestLogger) return;
    try {
      const usage = providerResult?.usage ?? {};
      const inputTokens = Number(usage.inputTokens ?? 0);
      const outputTokens = Number(usage.outputTokens ?? (outputText ? estimateOutputTokens(outputText) : 0));
      const totalTokens = Number(usage.totalTokens ?? (inputTokens + outputTokens));
      const fallbackAttempt = selection?.metadata?.fallbackAttempt ?? 1;

      this.requestLogger.log({
        method: "POST",
        path: "/v1/chat/completions",
        statusCode: error ? 500 : 200,
        latencyMs: providerResult?.latencyMs ?? (Date.now() - startedAt),
        provider: selection?.selected?.target?.providerId,
        model: selection?.selected?.target?.modelId,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd: Math.round(totalTokens * 0.000002 * 100000) / 100000,
        cacheHit: false,
        fallbackUsed: fallbackAttempt > 1,
        error: error ? (error instanceof Error ? error.message : String(error)) : undefined,
        traceId: request?.context?.traceId,
      });
    } catch (err) {
      // Fail-open: a usage-ledger failure must never break or alter the chat path.
      writeGatewayLog("usage_ledger_write_failed", { message: err?.message ?? "unknown" });
    }
  }
}

function estimateOutputTokens(text) {
  return Math.max(0, Math.ceil(String(text ?? "").length / 4));
}

export { createRouteFailureEnvelope };
