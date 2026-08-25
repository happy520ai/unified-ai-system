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
import { createHash, randomUUID } from "node:crypto";

const PROVIDER_OPERATION_TYPES = new Set([
  "image_generation",
  "embedding",
  "text_to_speech",
  "speech_to_text",
]);

export class GatewayService {
  constructor({ providerRegistry, runtimeConfig = {}, healthScorer = null, requestLogger = null, enterpriseAudit = null, governance = null, contentGuardrails = null, weightedTrafficPolicy = null, providerDispatchGate = null }) {
    this.providerRegistry = providerRegistry;
    this.runtimeConfig = runtimeConfig;
    // Optional health scorer — when present, provider call outcomes are recorded
    // to power health-weighted selection in providerSelectionPolicy.
    this.healthScorer = healthScorer;
    // Optional usage ledger — when present, chat attempts are persisted with
    // token counts, latency, provider/model and status so operators can query
    // usage without external tooling. Fake-only preview is fail-open; billable
    // execution can require a durable, fail-closed ledger.
    this.requestLogger = requestLogger;
    // Real provider attempts are authorized into the enterprise audit chain
    // before the adapter is invoked. HTTP request audit remains a separate,
    // higher-level record.
    this.enterpriseAudit = enterpriseAudit;
    // Optional governance checker (e.g. advancedRBAC) — when present and enabled
    // via runtimeConfig.modelAccessEnforce, the selected model is checked against
    // the caller's identity before any provider call is made.
    this.governance = governance;
    this.contentGuardrails = contentGuardrails;
    // 运营可配的加权分流与影子流量(AI_GATEWAY_WEIGHTED_ROUTES_JSON);未配置时为 null,零行为变化。
    this.weightedTrafficPolicy = weightedTrafficPolicy ?? null;
    this.providerDispatchGate = providerDispatchGate;
  }

  async execute(input, execution = {}) {
    const startedAt = Date.now();
    let request;
    let selection;
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
        let providerCallStarted = false;
        let usageAttemptId = null;
        assertProviderExecutionAllowed({
          providerId: selection.selected.target.providerId,
          providerType: selection.selected.providerType,
          runtimeConfig: this.runtimeConfig,
          shadowRequest: execution.shadow === true,
        });
        await this.#assertUsageLedgerReady(selection);

        if (typeof selection.selected.provider.generateStream !== "function") {
          const error = new Error("Selected provider does not support streaming.");
          error.code = "PROVIDER_STREAMING_UNSUPPORTED";
          error.category = "provider";
          error.retryable = false;
          throw error;
        }

        await this.#reserveProviderDispatch({
          request,
          selection,
          execution,
          attempt: attempt.index + 1,
        });

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
          usageAttemptId = await this.#beginUsageAttempt({
            request,
            selection,
            startedAt,
            shadow: execution.shadow === true,
          });
          providerCallStarted = true;
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

          await this.#recordUsage({
            request,
            selection,
            providerCallAttempted: true,
            startedAt,
            outputText,
            shadow: execution.shadow === true,
            usageAttemptId,
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
          if (!isProviderEvidenceError(error) && providerCallStarted) {
            try {
              await this.#recordUsage({
                request,
                selection,
                providerCallAttempted: true,
                startedAt,
                error,
                outputText,
                shadow: execution.shadow === true,
                usageAttemptId,
              });
            } catch (usageError) {
              throw usageError;
            }
          }
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

  async executeProviderOperation(input, execution = {}) {
    const operation = normalizeProviderOperation(input);
    const startedAt = Date.now();
    const requestId = String(
      input?.context?.requestId
      ?? execution?.transportRequestId
      ?? `provider_operation_${randomUUID()}`,
    );
    const traceId = String(input?.context?.traceId ?? execution?.transportTraceId ?? requestId);
    const request = {
      taskType: operation.operationType,
      context: { requestId, traceId },
      enterpriseIdentity: input?.enterpriseIdentity,
      messages: [],
      options: {},
    };
    const selection = {
      selected: {
        providerType: operation.providerType,
        target: {
          providerId: operation.providerId,
          modelId: operation.modelId,
        },
      },
      metadata: { fallbackAttempt: 1 },
    };
    let providerCallStarted = false;
    let usageAttemptId = null;

    try {
      throwIfExecutionAborted(execution.signal);
      assertProviderExecutionAllowed({
        providerId: operation.providerId,
        providerType: operation.providerType,
        runtimeConfig: this.runtimeConfig,
        shadowRequest: false,
      });
      await this.#assertUsageLedgerReady(selection);
      await this.#reserveProviderDispatch({
        request,
        selection,
        execution,
        attempt: 1,
        requestFingerprint: operation.requestFingerprint,
      });
      usageAttemptId = await this.#beginUsageAttempt({
        request,
        selection,
        startedAt,
        usagePath: operation.path,
        auditPath: `/provider-execution:${operation.operationType}`,
        operationType: operation.operationType,
      });
      throwIfExecutionAborted(execution.signal);
      providerCallStarted = true;
      const result = await operation.invoke();
      throwIfExecutionAborted(execution.signal);
      await this.#recordUsage({
        request,
        selection,
        providerResult: normalizeProviderOperationResult(result),
        providerCallAttempted: true,
        startedAt,
        usageAttemptId,
        usagePath: operation.path,
      });
      writeGatewayLog("provider_operation_completed", {
        requestId,
        traceId,
        operationType: operation.operationType,
        provider: operation.providerId,
        model: operation.modelId,
        durationMs: Date.now() - startedAt,
      });
      return result;
    } catch (error) {
      const cancellation = findExecutionAbortError(error, execution.signal);
      const terminalError = cancellation ?? error;
      try {
        await this.#recordUsage({
          request,
          selection,
          providerCallAttempted: providerCallStarted,
          startedAt,
          error: terminalError,
          usageAttemptId,
          usagePath: operation.path,
        });
      } catch (usageError) {
        throw usageError;
      }
      writeGatewayLog("provider_operation_failed", {
        requestId,
        traceId,
        operationType: operation.operationType,
        provider: operation.providerId,
        model: operation.modelId,
        code: terminalError?.code,
        providerCallAttempted: providerCallStarted,
        durationMs: Date.now() - startedAt,
      });
      throw terminalError;
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
      let providerCallStarted = false;
      let usageAttemptId = null;

      try {
        assertProviderExecutionAllowed({
          providerId: attemptSelection.selected.target.providerId,
          providerType: attemptSelection.selected.providerType,
          runtimeConfig: this.runtimeConfig,
          shadowRequest: execution.shadow === true,
        });
        await this.#assertUsageLedgerReady(attemptSelection);
        await this.#reserveProviderDispatch({
          request,
          selection: attemptSelection,
          execution,
          attempt: attempt.index + 1,
        });
        usageAttemptId = await this.#beginUsageAttempt({
          request,
          selection: attemptSelection,
          startedAt,
          shadow: execution.shadow === true,
        });
        writeGatewayLog("provider_call_start", {
          requestId: request.context.requestId,
          traceId: request.context.traceId,
          provider: attemptSelection.selected.target.providerId,
          model: attemptSelection.selected.target.modelId,
          attempt: attempt.index + 1,
        });
        hooks.onProviderCallStarted?.(attemptSelection);
        providerCallStarted = true;
        const providerResult = await attemptSelection.selected.provider.generate({
          ...createProviderRequest({
            request,
            target: attemptSelection.selected.target,
            execution,
          }),
        });
        throwIfExecutionAborted(execution.signal);
        await this.#recordUsage({
          request,
          selection: attemptSelection,
          providerResult,
          providerCallAttempted: true,
          startedAt,
          shadow: execution.shadow === true,
          usageAttemptId,
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

        if (isProviderEvidenceError(error)) throw error;
        if (providerCallStarted) {
          try {
            await this.#recordUsage({
              request,
              selection: attemptSelection,
              providerCallAttempted: true,
              startedAt,
              error,
              shadow: execution.shadow === true,
              usageAttemptId,
            });
          } catch (usageError) {
            throw usageError;
          }
        } else {
          await this.#recordUsage({
            request,
            selection: attemptSelection,
            providerCallAttempted: false,
            startedAt,
            error,
            shadow: execution.shadow === true,
          });
        }

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

  async #recordUsage({
    request,
    selection,
    providerResult,
    providerCallAttempted = false,
    startedAt,
    error = null,
    outputText = "",
    shadow = false,
    usageAttemptId = null,
    usagePath = null,
  }) {
    const providerType = selection?.selected?.providerType ?? error?.details?.providerType;
    const billable = providerCallAttempted && providerType !== "fake";
    if (!this.requestLogger) {
      if (billable && this.runtimeConfig.realProviderEnabled === true) {
        throw createUsageLedgerFailure("USAGE_LEDGER_UNAVAILABLE");
      }
      return;
    }
    try {
      const usage = providerResult?.usage ?? {};
      const inputTokens = Number(usage.inputTokens ?? 0);
      const outputTokens = Number(usage.outputTokens ?? (outputText ? estimateOutputTokens(outputText) : 0));
      const totalTokens = Number(usage.totalTokens ?? (inputTokens + outputTokens));
      const fallbackAttempt = selection?.metadata?.fallbackAttempt ?? 1;
      const providerReportedCost = Number(providerResult?.estimatedCostUsd ?? usage.estimatedCostUsd);
      const hasProviderReportedCost = Number.isFinite(providerReportedCost) && providerReportedCost >= 0;
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

      await this.requestLogger.log({
        usageAttemptId: usageAttemptId ?? undefined,
        usageEventType: error ? "attempt-failed" : "attempt-completed",
        method: "POST",
        path: usagePath ?? (shadow ? "/v1/chat/completions:shadow" : "/v1/chat/completions"),
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
      writeGatewayLog("usage_ledger_write_failed", { message: err?.message ?? "unknown" });
      if (billable && this.runtimeConfig.realProviderEnabled === true) {
        throw createUsageLedgerFailure(err?.code, err);
      }
    }
  }

  async #beginUsageAttempt({
    request,
    selection,
    startedAt,
    shadow = false,
    usagePath = null,
    auditPath = null,
    operationType = "chat",
  }) {
    if (selection?.selected?.providerType === "fake" || !this.requestLogger) return null;
    const usageAttemptId = randomUUID();
    if (this.runtimeConfig.realProviderEnabled === true) {
      if (!this.enterpriseAudit || typeof this.enterpriseAudit.recordAudit !== "function") {
        throw createProviderAuditFailure("PROVIDER_AUDIT_UNAVAILABLE");
      }
      try {
        await this.enterpriseAudit.recordAudit({
          outcome: "attempt-authorized",
          method: "PROVIDER",
          path: auditPath ?? (shadow ? "/provider-execution:shadow" : "/provider-execution"),
          permission: "provider:execute",
          statusCode: 102,
          identity: request?.enterpriseIdentity,
          details: {
            usageAttemptId,
            providerId: selection?.selected?.target?.providerId,
            modelId: selection?.selected?.target?.modelId,
            shadow,
            operationType,
            promptContentRecorded: false,
            credentialRecorded: false,
          },
        });
      } catch (error) {
        throw createProviderAuditFailure(error?.code, error);
      }
    }
    try {
      await this.requestLogger.log({
        usageAttemptId,
        usageEventType: "attempt-started",
        method: "POST",
        path: usagePath ?? (shadow ? "/v1/chat/completions:shadow" : "/v1/chat/completions"),
        statusCode: 102,
        latencyMs: Date.now() - startedAt,
        provider: selection?.selected?.target?.providerId,
        model: selection?.selected?.target?.modelId,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        costSource: "pending-provider-attempt",
        costEstimateAvailable: false,
        cacheHit: false,
        fallbackUsed: (selection?.metadata?.fallbackAttempt ?? 1) > 1,
        shadow,
        providerCallAttempted: true,
        billable: true,
        traceId: request?.context?.traceId,
        tenantId: request?.enterpriseIdentity?.tenantId ?? request?.context?.tenantId ?? "default",
      });
      return usageAttemptId;
    } catch (error) {
      writeGatewayLog("usage_ledger_reservation_failed", { message: error?.message ?? "unknown" });
      if (this.runtimeConfig.realProviderEnabled === true) {
        throw createUsageLedgerFailure(error?.code, error);
      }
      return null;
    }
  }

  async #assertUsageLedgerReady(selection) {
    if (this.runtimeConfig.realProviderEnabled !== true) return;
    if (selection?.selected?.providerType === "fake") return;
    if (!this.requestLogger || typeof this.requestLogger.assertDurable !== "function") {
      throw createUsageLedgerFailure("USAGE_LEDGER_UNAVAILABLE");
    }
    try {
      await this.requestLogger.assertDurable();
    } catch (error) {
      throw createUsageLedgerFailure(error?.code, error);
    }
  }

  async #reserveProviderDispatch({ request, selection, execution, attempt, requestFingerprint = null }) {
    if (selection?.selected?.providerType === "fake") return null;
    if (!this.providerDispatchGate) {
      if (this.runtimeConfig.requireProviderDispatchGate === true) {
        const error = new Error("Real-provider execution requires the provider dispatch reservation gate.");
        error.code = "PROVIDER_DISPATCH_GATE_UNAVAILABLE";
        error.category = "persistence";
        error.statusCode = 503;
        error.retryable = true;
        throw error;
      }
      return null;
    }
    const resolvedRequestFingerprint = requestFingerprint ?? createHash("sha256")
      .update(stableStringify({
        taskType: request?.taskType,
        messages: request?.messages,
        options: request?.options,
        tools: request?.tools,
        toolChoice: request?.toolChoice,
        parallelToolCalls: request?.parallelToolCalls,
        responseFormat: request?.metadata?.openAiCompatibility?.responseFormat,
        target: selection?.selected?.target,
      }))
      .digest("hex");
    const reservation = await this.providerDispatchGate.reserve({
      dispatchKeyHash: execution?.providerDispatchKeyHash,
      dispatchKeyInvalid: execution?.providerDispatchKeyInvalid === true,
      route: execution?.providerDispatchRoute ?? "/internal",
      invocation: execution?.providerDispatchInvocation ?? 1,
      attempt,
      shadow: execution?.shadow === true,
      tenantId: request?.enterpriseIdentity?.tenantId
        ?? request?.context?.tenantId
        ?? "default",
      providerId: selection?.selected?.target?.providerId,
      modelId: selection?.selected?.target?.modelId,
      requestFingerprint: resolvedRequestFingerprint,
    });
    writeGatewayLog("provider_dispatch_reserved", {
      requestId: request?.context?.requestId,
      traceId: request?.context?.traceId,
      provider: selection?.selected?.target?.providerId,
      model: selection?.selected?.target?.modelId,
      attempt,
      shadow: execution?.shadow === true,
      bypassed: reservation.bypassed,
      reservationFingerprint: reservation.reservationFingerprint,
    });
    return reservation;
  }
}

function normalizeProviderOperation(input) {
  if (!input || typeof input !== "object") {
    throw createProviderOperationError("PROVIDER_OPERATION_INPUT_INVALID", "Provider operation input must be an object.");
  }
  const operationType = String(input.operationType ?? "").trim();
  if (!PROVIDER_OPERATION_TYPES.has(operationType)) {
    throw createProviderOperationError("PROVIDER_OPERATION_TYPE_INVALID", "Provider operation type is not supported.");
  }
  const providerId = normalizeProviderOperationIdentifier(input.providerId, "providerId");
  const providerType = normalizeProviderOperationIdentifier(input.providerType ?? providerId, "providerType");
  const modelId = normalizeProviderOperationIdentifier(input.modelId, "modelId");
  const path = String(input.path ?? "").trim();
  if (!path.startsWith("/") || path.length > 2_048 || /[\u0000-\u001f\u007f]/u.test(path)) {
    throw createProviderOperationError("PROVIDER_OPERATION_PATH_INVALID", "Provider operation path is invalid.");
  }
  const requestFingerprint = String(input.requestFingerprint ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(requestFingerprint)) {
    throw createProviderOperationError(
      "PROVIDER_OPERATION_FINGERPRINT_INVALID",
      "Provider operation requestFingerprint must be a SHA-256 digest.",
    );
  }
  if (typeof input.invoke !== "function") {
    throw createProviderOperationError("PROVIDER_OPERATION_INVOKE_REQUIRED", "Provider operation invoke must be a function.");
  }
  return { operationType, providerId, providerType, modelId, path, requestFingerprint, invoke: input.invoke };
}

function normalizeProviderOperationIdentifier(value, name) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 256 || !/^[A-Za-z0-9._:/-]+$/u.test(normalized)) {
    throw createProviderOperationError(
      "PROVIDER_OPERATION_TARGET_INVALID",
      `${name} must be a portable provider or model identifier.`,
    );
  }
  return normalized;
}

function normalizeProviderOperationResult(result) {
  const rawUsage = result?.data?.usage ?? result?.usage ?? {};
  const inputTokens = Number(rawUsage.inputTokens ?? rawUsage.prompt_tokens ?? rawUsage.input_tokens ?? 0);
  const outputTokens = Number(rawUsage.outputTokens ?? rawUsage.completion_tokens ?? rawUsage.output_tokens ?? 0);
  const totalTokens = Number(rawUsage.totalTokens ?? rawUsage.total_tokens ?? (inputTokens + outputTokens));
  const estimatedCostUsd = Number(
    result?.estimatedCostUsd
      ?? result?.data?.estimatedCostUsd
      ?? rawUsage.estimatedCostUsd,
  );
  return {
    usage: {
      inputTokens: Number.isFinite(inputTokens) && inputTokens >= 0 ? inputTokens : 0,
      outputTokens: Number.isFinite(outputTokens) && outputTokens >= 0 ? outputTokens : 0,
      totalTokens: Number.isFinite(totalTokens) && totalTokens >= 0 ? totalTokens : 0,
      ...(Number.isFinite(estimatedCostUsd) && estimatedCostUsd >= 0 ? { estimatedCostUsd } : {}),
    },
    ...(Number.isFinite(estimatedCostUsd) && estimatedCostUsd >= 0 ? { estimatedCostUsd } : {}),
    latencyMs: Number(result?.latencyMs ?? result?.data?.latencyMs ?? 0) || undefined,
  };
}

function createProviderOperationError(code, message) {
  return Object.assign(new Error(message), {
    code,
    category: "validation",
    statusCode: 400,
    retryable: false,
  });
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .filter((key) => value[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function estimateOutputTokens(text) {
  return Math.max(0, Math.ceil(String(text ?? "").length / 4));
}

export { createRouteFailureEnvelope };

function createUsageLedgerFailure(code, cause) {
  const normalizedCode = code === "USAGE_LEDGER_UNAVAILABLE"
    ? "USAGE_LEDGER_UNAVAILABLE"
    : "USAGE_LEDGER_WRITE_FAILED";
  const error = new Error(
    normalizedCode === "USAGE_LEDGER_UNAVAILABLE"
      ? "Billable provider execution is blocked because the durable usage ledger is unavailable."
      : "The billable provider result could not be committed to the durable usage ledger.",
  );
  error.code = normalizedCode;
  error.category = "billing";
  error.retryable = true;
  if (cause) error.cause = cause;
  return error;
}

function isUsageLedgerError(error) {
  return error?.code === "USAGE_LEDGER_UNAVAILABLE" || error?.code === "USAGE_LEDGER_WRITE_FAILED";
}

function isProviderEvidenceError(error) {
  return isUsageLedgerError(error)
    || error?.code === "PROVIDER_AUDIT_UNAVAILABLE"
    || error?.code === "PROVIDER_AUDIT_WRITE_FAILED";
}

function createProviderAuditFailure(code, cause) {
  const normalizedCode = code === "PROVIDER_AUDIT_UNAVAILABLE"
    ? "PROVIDER_AUDIT_UNAVAILABLE"
    : "PROVIDER_AUDIT_WRITE_FAILED";
  const error = new Error(
    normalizedCode === "PROVIDER_AUDIT_UNAVAILABLE"
      ? "Billable provider execution is blocked because enterprise audit persistence is unavailable."
      : "Billable provider execution is blocked because its authorization audit could not be committed.",
  );
  error.code = normalizedCode;
  error.category = "audit";
  error.retryable = true;
  if (cause) error.cause = cause;
  return error;
}
