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
import {
  compactMessageHistory,
  defineCompactionPolicy,
  estimateContextTokens,
} from "@unified-ai-system/codex-context-gateway";
import {
  extractMessageText,
  findExecutionAbortError,
  throwIfExecutionAborted,
} from "@unified-ai-system/shared-utils";
import { assertProviderExecutionAllowed } from "../providers/providerExecutionGate.ts";


export class GatewayService {
  constructor({ providerRegistry, runtimeConfig = {}, healthScorer = null, requestLogger = null, governance = null, contentGuardrails = null, weightedTrafficPolicy = null }) {
    this.providerRegistry = providerRegistry;
    this.runtimeConfig = runtimeConfig;
    // Optional health scorer — when present, provider call outcomes are recorded
    // to power health-weighted selection in providerSelectionPolicy.
    this.healthScorer = healthScorer;
    // Optional usage ledger — when present, chat attempts are persisted with
    // token counts, latency, provider/model and status so operators can query
    // usage without external tooling. Fail-open: a ledger error never alters chat.
    this.requestLogger = requestLogger;
    // Optional governance checker (e.g. advancedRBAC) — when present and enabled
    // via runtimeConfig.modelAccessEnforce, the selected model is checked against
    // the caller's identity before any provider call is made.
    this.governance = governance;
    this.contentGuardrails = contentGuardrails;
    // 运营可配的加权分流与影子流量(AI_GATEWAY_WEIGHTED_ROUTES_JSON);未配置时为 null,零行为变化。
    this.weightedTrafficPolicy = weightedTrafficPolicy ?? null;
  }

  async execute(input, execution = {}) {
    const startedAt = Date.now();
    let request;
    let selection;
    let providerCallAttempted = false;
    let compactionWarnings = [];

    try {
      throwIfExecutionAborted(execution.signal);
      request = normalizeGatewayRequest(input);
      compactionWarnings = this.#applyContextCompaction(request);
      this.#enforceContentGuardrails(request);
      if (this.runtimeConfig.costGuardEnforce) {
        this.#enforceCostGuard(request);
      }
      let baseSelection = this.providerRegistry.select(request);
      if (this.runtimeConfig.modelAccessEnforce) {
        this.#enforceModelAccess(request, baseSelection);
      }
      // 加权分流:运营配置命中时覆写目标 provider(影子请求自身不再套用,防递归)。
      if (this.weightedTrafficPolicy && !execution.shadow) {
        const weighted = this.weightedTrafficPolicy.apply(request);
        if (weighted?.overrideProviderId && weighted.overrideProviderId !== baseSelection.selected.target.providerId) {
          const shadowOfWeighted = request;
          shadowOfWeighted.providerId = weighted.overrideProviderId;
          baseSelection = this.providerRegistry.select(shadowOfWeighted);
          writeGatewayLog("weighted_route_applied", {
            requestId: request.context.requestId,
            routeName: weighted.routeName,
            provider: weighted.overrideProviderId,
            durationMs: 0,
          });
        }
      }
      const attemptResult = await this.#executeWithFallback(request, baseSelection, startedAt, execution, {
        onAttemptSelected: (attemptSelection) => {
          selection = attemptSelection;
        },
        onProviderCallStarted: () => {
          providerCallAttempted = true;
        },
      });
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
      this.#recordUsage({
        request,
        selection,
        providerResult,
        providerCallAttempted,
        startedAt,
        shadow: execution.shadow === true,
      });
      const response = createGatewayResponse(request, selection, providerResult, startedAt, this.runtimeConfig, [...compactionWarnings, ...attemptResult.warnings]);

      // 影子流量:主响应已定,旁路复制到 shadow provider,仅观测不影响主响应。
      if (this.weightedTrafficPolicy && !execution.shadow) {
        this.#fireShadowTraffic(request, execution);
      }
      return createRouteSuccessEnvelope(response, {
        traceId: request.context.traceId,
        startedAt,
      });
    } catch (error) {
      const cancellation = findExecutionAbortError(error, execution.signal);
      if (cancellation) {
        writeGatewayLog("provider_call_cancelled", {
          requestId: request?.context?.requestId,
          traceId: request?.context?.traceId,
          code: cancellation.code,
          durationMs: Date.now() - startedAt,
        });
        this.#recordUsage({
          request,
          selection,
          providerCallAttempted,
          startedAt,
          error: cancellation,
          shadow: execution.shadow === true,
        });
        throw cancellation;
      }
      writeGatewayLog("provider_call_failed", {
        requestId: request?.context?.requestId,
        traceId: request?.context?.traceId,
        provider: selection?.selected?.target?.providerId,
        model: selection?.selected?.target?.modelId,
        code: error?.code,
        message: error instanceof Error ? error.message : "Gateway route execution failed.",
        durationMs: Date.now() - startedAt,
      });
      this.#recordUsage({
        request,
        selection,
        providerCallAttempted,
        startedAt,
        error,
        shadow: execution.shadow === true,
      });
      return createRouteFailureEnvelope(error, {
        request,
        selection,
        startedAt,
        runtimeConfig: this.runtimeConfig,
      });
    }
  }

  async *executeStream(input, execution = {}) {
    const startedAt = Date.now();
    let request;
    let selection;
    let outputText = "";
    let providerCallAttempted = false;

    try {
      throwIfExecutionAborted(execution.signal);
      request = normalizeGatewayRequest(input);
      this.#applyContextCompaction(request);
      this.#enforceContentGuardrails(request);
      if (this.runtimeConfig.costGuardEnforce) {
        this.#enforceCostGuard(request);
      }
      const baseSelection = this.providerRegistry.select(request);

      for (const attempt of createFallbackAttempts(baseSelection, this.runtimeConfig)) {
        throwIfExecutionAborted(execution.signal);
        selection = createAttemptSelection(baseSelection, attempt.candidate, attempt.index);
        assertProviderExecutionAllowed({
          providerId: selection.selected.target.providerId,
          providerType: selection.selected.providerType,
          runtimeConfig: this.runtimeConfig,
          shadowRequest: execution.shadow === true,
        });

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
        providerCallAttempted = true;

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
              execution,
            }),
          })) {
            throwIfExecutionAborted(execution.signal);
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

          this.#recordUsage({
            request,
            selection,
            providerCallAttempted,
            startedAt,
            outputText,
            shadow: execution.shadow === true,
          });

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
          const cancellation = findExecutionAbortError(error, execution.signal);
          if (cancellation) {
            writeGatewayLog("provider_stream_cancelled", {
              requestId: request.context.requestId,
              traceId: request.context.traceId,
              provider: selection.selected.target.providerId,
              model: selection.selected.target.modelId,
              code: cancellation.code,
              emittedChunk,
              durationMs: Date.now() - startedAt,
            });
            throw cancellation;
          }
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
      const cancellation = findExecutionAbortError(error, execution.signal);
      if (cancellation) {
        this.#recordUsage({
          request,
          selection,
          providerCallAttempted,
          startedAt,
          error: cancellation,
          shadow: execution.shadow === true,
        });
        throw cancellation;
      }
      writeGatewayLog("provider_stream_failed", {
        requestId: request?.context?.requestId,
        traceId: request?.context?.traceId,
        provider: selection?.selected?.target?.providerId,
        model: selection?.selected?.target?.modelId,
        code: error?.code,
        message: error instanceof Error ? error.message : "Gateway stream execution failed.",
        durationMs: Date.now() - startedAt,
      });

      this.#recordUsage({
        request,
        selection,
        providerCallAttempted,
        startedAt,
        error,
        shadow: execution.shadow === true,
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

  getContentGuardrailHealth() {
    return this.contentGuardrails?.getHealth?.() ?? { status: "disabled" };
  }

  async #executeWithFallback(request, baseSelection, startedAt, execution, hooks = {}) {
    let lastError;
    const fallbackWarnings = [];

    for (const attempt of createFallbackAttempts(baseSelection, this.runtimeConfig)) {
      throwIfExecutionAborted(execution.signal);
      const attemptSelection = createAttemptSelection(baseSelection, attempt.candidate, attempt.index);
      hooks.onAttemptSelected?.(attemptSelection);

      try {
        assertProviderExecutionAllowed({
          providerId: attemptSelection.selected.target.providerId,
          providerType: attemptSelection.selected.providerType,
          runtimeConfig: this.runtimeConfig,
          shadowRequest: execution.shadow === true,
        });
        writeGatewayLog("provider_call_start", {
          requestId: request.context.requestId,
          traceId: request.context.traceId,
          provider: attemptSelection.selected.target.providerId,
          model: attemptSelection.selected.target.modelId,
          attempt: attempt.index + 1,
        });
        hooks.onProviderCallStarted?.(attemptSelection);
        const providerResult = await attemptSelection.selected.provider.generate({
          ...createProviderRequest({
            request,
            target: attemptSelection.selected.target,
            execution,
          }),
        });
        throwIfExecutionAborted(execution.signal);

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

        const cancellation = findExecutionAbortError(error, execution.signal);
        if (cancellation) throw cancellation;

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

  // Long-conversation compaction on the chat path. Fail-open: a compaction
  // error never blocks the request. Returns a warnings array for the response.
  #applyContextCompaction(request) {
    const config = this.runtimeConfig?.chatContextCompaction;
    if (!config || !Array.isArray(request.messages)) return [];
    const thresholdMessages = Number(config.thresholdMessages ?? 0);
    const maxContextTokens = Number(config.maxContextTokens ?? 0);
    if (thresholdMessages <= 0 && maxContextTokens <= 0) return [];

    const overThreshold = (
      (thresholdMessages > 0 && request.messages.length > thresholdMessages)
      || (maxContextTokens > 0
        && estimateContextTokens(request.messages.map((message) =>
          typeof message?.content === "string" ? message.content : "").join("\n")) > maxContextTokens)
    );
    if (!overThreshold) return [];

    try {
      const { messages, report } = compactMessageHistory(request.messages, defineCompactionPolicy({
        summaryStyle: "turns",
        keepRecentTurns: Number(config.keepRecentTurns ?? 10),
        maxContextTokens: maxContextTokens > 0 ? maxContextTokens : null,
        turnSummaryPrefix: "[Previous conversation summary]",
      }));
      if (!report.compacted) return [];
      request.messages = messages;
      request.metadata = {
        ...(request.metadata ?? {}),
        contextCompaction: {
          originalCount: report.originalCount,
          resultCount: report.resultCount,
          summarizedTurns: report.summarizedTurns,
          originalTokens: report.originalTokens,
          resultTokens: report.resultTokens,
        },
      };
      return [{
        code: "context_compacted",
        message: `Long conversation compacted: ${report.originalCount} → ${report.resultCount} messages (${report.summarizedTurns} turns summarized).`,
        details: {
          originalCount: report.originalCount,
          resultCount: report.resultCount,
          summarizedTurns: report.summarizedTurns,
          originalTokens: report.originalTokens,
          resultTokens: report.resultTokens,
          retainedSignals: report.retainedSignals,
          droppedSignals: report.droppedSignals,
        },
      }];
    } catch {
      // Compaction is best-effort; never fail a chat because of it.
      return [];
    }
  }

  #enforceContentGuardrails(request) {
    if (!this.contentGuardrails) return;
    const violations = [];
    const violationRoles = [];
    for (const message of request.messages ?? []) {
      const text = extractMessageText(message.content);
      if (!text.trim()) continue;
      const result = this.contentGuardrails.scan(text, {
        direction: "input",
        role: message.role,
      });
      if (!result.safe) {
        violations.push(...result.violations.map((violation) => violation.type));
        violationRoles.push(message.role ?? "unknown");
      }
    }
    if (violations.length === 0) return;
    const error = new Error("The request was blocked by the input content security policy.");
    error.code = "CONTENT_GUARDRAIL_BLOCKED";
    error.category = "governance";
    error.retryable = false;
    error.details = {
      violationTypes: [...new Set(violations)],
      messageRoles: [...new Set(violationRoles)],
    };
    throw error;
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

  #fireShadowTraffic(request, execution) {
    try {
      const shadowTarget = this.weightedTrafficPolicy.shouldShadow(request);
      if (!shadowTarget) return;
      const shadowRequest = {
        ...request,
        providerId: shadowTarget.providerId,
        metadata: {
          ...(request.metadata ?? {}),
          shadowTraffic: { routeName: shadowTarget.routeName, percent: shadowTarget.percent },
        },
      };
      const shadowTimeoutMs = Math.min(
        120_000,
        Math.max(1_000, Number(this.runtimeConfig.shadowTimeoutMs ?? 30_000)),
      );
      const signals = [execution.signal, AbortSignal.timeout(shadowTimeoutMs)].filter(Boolean);
      const shadowSignal = signals.length === 1 ? signals[0] : AbortSignal.any(signals);
      void this.execute(shadowRequest, { ...execution, shadow: true, signal: shadowSignal })
        .then((result) => {
          writeGatewayLog("shadow_traffic_completed", {
            requestId: request.context?.requestId,
            routeName: shadowTarget.routeName,
            provider: shadowTarget.providerId,
            success: result?.success === true,
            durationMs: 0,
          });
        })
        .catch((error) => {
          writeGatewayLog("shadow_traffic_failed", {
            requestId: request.context?.requestId,
            routeName: shadowTarget.routeName,
            provider: shadowTarget.providerId,
            code: error?.code,
            durationMs: 0,
          });
        });
    } catch {
      // 影子流量失败绝不影响主路径。
    }
  }

  #recordUsage({
    request,
    selection,
    providerResult,
    providerCallAttempted = false,
    startedAt,
    error = null,
    outputText = "",
    shadow = false,
  }) {
    if (!this.requestLogger) return;
    try {
      const usage = providerResult?.usage ?? {};
      const inputTokens = Number(usage.inputTokens ?? 0);
      const outputTokens = Number(usage.outputTokens ?? (outputText ? estimateOutputTokens(outputText) : 0));
      const totalTokens = Number(usage.totalTokens ?? (inputTokens + outputTokens));
      const fallbackAttempt = selection?.metadata?.fallbackAttempt ?? 1;
      const providerType = selection?.selected?.providerType ?? error?.details?.providerType;
      const providerReportedCost = Number(providerResult?.estimatedCostUsd ?? usage.estimatedCostUsd);
      const hasProviderReportedCost = Number.isFinite(providerReportedCost) && providerReportedCost >= 0;
      const billable = providerCallAttempted && providerType !== "fake";
      const hasTokenEstimate = totalTokens > 0;
      const costEstimateAvailable = !billable || hasProviderReportedCost || hasTokenEstimate;
      const estimatedCostUsd = !billable
        ? 0
        : hasProviderReportedCost
          ? providerReportedCost
          : hasTokenEstimate
            ? Math.round(totalTokens * 0.000002 * 100000) / 100000
            : 0;
      const costSource = !providerCallAttempted
        ? "not-attempted"
        : providerType === "fake"
          ? "non-billable-fake"
          : hasProviderReportedCost
            ? "provider-reported"
            : hasTokenEstimate
              ? "static-fallback-estimate"
              : "unavailable-after-attempt";

      this.requestLogger.log({
        method: "POST",
        path: shadow ? "/v1/chat/completions:shadow" : "/v1/chat/completions",
        statusCode: error ? 500 : 200,
        latencyMs: providerResult?.latencyMs ?? (Date.now() - startedAt),
        provider: selection?.selected?.target?.providerId ?? error?.details?.providerId,
        model: selection?.selected?.target?.modelId,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd,
        costSource,
        costEstimateAvailable,
        cacheHit: false,
        fallbackUsed: fallbackAttempt > 1,
        shadow,
        providerCallAttempted,
        billable,
        error: error ? (error instanceof Error ? error.message : String(error)) : undefined,
        traceId: request?.context?.traceId,
        tenantId: request?.enterpriseIdentity?.tenantId ?? request?.context?.tenantId ?? "default",
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
