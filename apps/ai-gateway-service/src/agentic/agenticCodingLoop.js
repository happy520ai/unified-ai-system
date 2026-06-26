/**
 * Agentic Coding Loop — Core intelligent agent iteration engine
 *
 * Implements the "LLM thinks → calls tools → reads results → continues thinking" loop.
 * @module agenticCodingLoop
 */

import { randomUUID } from "node:crypto";
import {
  hasToolCalls, extractToolCalls, executeToolCalls,
  buildAssistantMessageWithToolCalls, summarizeToolUsage,
} from "../providers/toolCallingAdapter.js";
import { createAgentToolRegistry } from "../claude-code-patterns/agentToolRegistry.js";
import { createAutoContext } from "./autoContext.js";
import { createProjectInstructions } from "./projectInstructions.js";
import { createSubagentDispatch } from "./subagentDispatch.js";
import { createPromptOptimizer } from "./promptOptimizer.js";
import { createPartialResultPreview } from "./partialResultPreview.js";
import { createContextManager } from "./contextManager.js";
import { createSessionMemory } from "./sessionMemory.js";
import { createSessionStore } from "./sessionStore.js";
import { analyzeComplexity } from "./smartModelRouter.js";
import {
  DEFAULT_MAX_ITERATIONS, DEFAULT_MAX_TOKENS_PER_TURN, DEFAULT_SYSTEM_PROMPT,
  debugLoop, withProviderTimeout,
} from "./agenticCodingLoop-constants.js";
import {
  buildReflectionPrompt, applyErrorRecovery, adjustIterationBudget,
  compactMessages, generatePlan, buildInitialMessages, getOpenAITools,
  buildProviderRequest, buildResult, createErrorResult, syncMcpToolsToRegistry,
} from "./agenticCodingLoop-helpers.js";
import { createStreamEvent, truncateForEvent } from "./agenticCodingLoop-stream.js";

/**
 * Create an Agentic Coding Loop instance.
 * @param {Object} options
 * @returns {Object} agenticLoop instance
 */
export function createAgenticLoop(options = {}) {
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const maxTokensPerTurn = options.maxTokensPerTurn ?? DEFAULT_MAX_TOKENS_PER_TURN;
  const systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const workingDirectory = options.workingDirectory ?? process.cwd();
  const permissionMode = options.permissionMode ?? "default";
  const checkpointDir = options.checkpointDir || null;
  const planningEnabled = options.planningEnabled ?? false;
  const maxPlanSteps = options.maxPlanSteps ?? 10;
  const selfReflectionEnabled = options.selfReflectionEnabled ?? false;
  const selfReflectionInterval = options.selfReflectionInterval ?? 5;
  const errorRecoveryEnabled = options.errorRecoveryEnabled ?? true;
  const dynamicBudgetEnabled = options.dynamicBudgetEnabled ?? false;
  const promptOptimizeEnabled = options.promptOptimizeEnabled ?? true;
  const partialPreviewEnabled = options.partialPreviewEnabled ?? true;

  const toolRegistry = options.toolRegistry ?? createAgentToolRegistry({
    workingDirectory,
    permissionChecker: options.permissionGate
      ? { check: (action) => options.permissionGate.check(action, { permissionMode }) }
      : null,
  });
  if (options.mcpBridge) syncMcpToolsToRegistry(options.mcpBridge, toolRegistry);

  const autoContext = createAutoContext({ workingDirectory, maxFiles: options.maxContextFiles ?? 10 });
  const projectInstructions = createProjectInstructions({ workingDirectory });
  const providerAdapter = options.providerAdapter;
  if (!providerAdapter) throw new Error("AgenticLoop requires a providerAdapter.");

  const subagentDispatch = createSubagentDispatch({
    providerAdapter, workingDirectory, maxConcurrent: options.maxConcurrent ?? 5,
  });
  const promptOptimizer = createPromptOptimizer();
  const partialPreview = createPartialResultPreview();
  const contextManager = createContextManager({
    maxContextTokens: options.maxContextTokens ?? 32_000, recentTurnsToKeep: options.recentTurnsToKeep ?? 5,
  });
  const sessionMemory = createSessionMemory({ memoryDir: options.memoryDir || undefined });
  const sessionStore = createSessionStore({ storeDir: options.sessionStoreDir || undefined });

  const dispatchTool = subagentDispatch.createDispatchTool();
  if (typeof toolRegistry.registerTool === "function") toolRegistry.registerTool(dispatchTool);

  // ── Shared helpers ──────────────────────────────────────────────

  async function enhancePrompt(basePrompt, goal) {
    let p = basePrompt +
      `\n\n## Working Directory\nYour current working directory is: ${workingDirectory}\nWhen using file_read, file_write, or shell_exec, relative paths are resolved from this directory. Always prefer relative paths when working within this directory.`;
    try { const s = projectInstructions.buildInstructionsPrompt({ goal, workingDirectory }); if (s) p += "\n\n## Project Instructions\n" + s; } catch (_e) { debugLoop("project instructions load failed", _e); }
    try { const c = await autoContext.buildContextPrompt(goal); if (c) p += "\n\n## Project Context\n" + c; } catch (_e) { debugLoop("auto context selection failed", _e); }
    if (promptOptimizeEnabled) { try { p = promptOptimizer.optimize(p, goal); } catch (_e) { debugLoop("prompt optimizer failed", _e); } }
    if ((await sessionMemory.getStats()).totalEntries > 0) { try { const m = await sessionMemory.buildMemoryPrompt(goal); if (m) p += "\n\n" + m; } catch (_e) { debugLoop("session memory recall failed", _e); } }
    return p;
  }

  function compactIfNeeded(messages) {
    const c = compactMessages(messages, 5);
    if (c !== messages) { messages.length = 0; for (const m of c) messages.push(m); }
    if (messages.length > 20) { try { const m = contextManager.manageHistory(messages); if (m.length < messages.length) { messages.length = 0; for (const x of m) messages.push(x); } } catch (_e) { debugLoop("non-fatal operation failed", _e); } }
  }

  async function processToolResults(toolCalls, toolResults, messages, allToolResults, iteration, plan) {
    for (const r of toolResults) {
      messages.push({ role: "tool", tool_call_id: r.tool_call_id, content: r.content });
      allToolResults.push(r);
    }
    try { contextManager.trackChangedFiles(toolResults); } catch (_e) { debugLoop("non-fatal operation failed", _e); }
    if (partialPreviewEnabled) { for (const r of toolResults) { const n = r._meta?.toolName || "unknown"; r._meta?.isError ? partialPreview.recordError(n, r.content, iteration) : partialPreview.recordToolResult(n, r._meta?.params || {}, r); } }
    if (errorRecoveryEnabled) { for (const r of toolResults) { if (r._meta?.isError) { const n = r._meta?.toolName || "unknown"; const rec = applyErrorRecovery(n, r.content, toolRegistry); if (rec) messages.push({ role: "system", content: `[Error Recovery] Tool "${n}" failed. ${rec}` }); } } }
    if (selfReflectionEnabled && iteration % selfReflectionInterval === 0) messages.push(buildReflectionPrompt(iteration, toolResults, plan));
    return toolResults;
  }

  async function finalize(sessionId, goal, status, messages, trace, allToolResults, totalUsage, startedAt, iteration, effectiveMax, plan) {
    try { await sessionMemory.recordOutcome({ goal, status, toolSequence: allToolResults.map(r => r._meta?.toolName).filter(Boolean), durationMs: Date.now() - startedAt, iterationCount: iteration, keyFindings: [] }); await sessionMemory.save(); } catch (_e) { debugLoop("non-fatal operation failed", _e); }
    try { await sessionStore.save({ sessionId, goal, status, messages: messages.slice(-20), trace: trace.slice(-30), usage: totalUsage, iterations: Math.min(iteration, effectiveMax), plan, durationMs: Date.now() - startedAt }); } catch (_e) { debugLoop("non-fatal operation failed", _e); }
  }

  // ── execute (non-streaming) ─────────────────────────────────────

  async function execute(input) {
    if (!input || typeof input !== "object") return createErrorResult("AGENTIC_INPUT_INVALID", "Input must be an object with a 'goal' property.");
    let sessionId = randomUUID();
    const startedAt = Date.now();
    const goal = typeof input.goal === "string" ? input.goal : String(input.goal ?? "");
    if (!goal.trim()) return createErrorResult("AGENTIC_GOAL_EMPTY", "Goal is required and must be a non-empty string.");

    const enhancedPrompt = await enhancePrompt(systemPrompt, goal);
    const taskComplexity = analyzeComplexity(goal);
    const messages = buildInitialMessages(enhancedPrompt, goal, input.messages);
    const tools = getOpenAITools(toolRegistry, input.toolAllowlist);
    const trace = [];
    const allToolResults = [];
    let totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let finalAnswer = "";
    let iteration = 0;
    let status = "completed";

    trace.push({ type: "complexity_analysis", score: taskComplexity.score, tier: taskComplexity.tier, signals: taskComplexity.signals });
    let effectiveMaxIterations = maxIterations;

    // Checkpoint resume
    if (input.resumeFromCheckpoint) {
      try {
        const { readFile: readFileAsync, stat: statAsync } = await import("node:fs/promises");
        const { resolve: resolvePath } = await import("node:path");
        const checkpointPath = resolvePath(input.resumeFromCheckpoint);
        const cpDir = resolvePath(workingDirectory || ".");
        if (!checkpointPath.startsWith(cpDir)) { debugLoop("checkpoint path rejected", "Path outside working directory"); }
        else {
          const cpStat = await statAsync(checkpointPath);
          if (cpStat.size > 10 * 1024 * 1024) { debugLoop("checkpoint rejected", `File too large: ${cpStat.size} bytes`); }
          else {
            const cp = JSON.parse(await readFileAsync(checkpointPath, "utf-8"));
            if (Array.isArray(cp.messages) && cp.messages.length > 0) {
              messages.length = 0; for (const m of cp.messages) messages.push(m);
              totalUsage = cp.totalUsage || totalUsage; iteration = cp.iteration || 0; sessionId = cp.sessionId || sessionId; status = "resumed";
            }
          }
        }
      } catch (_e) { debugLoop("checkpoint restore failed", _e); }
    }

    // Planning phase
    let plan = null; let planStepIndex = 0;
    if (planningEnabled) {
      plan = await generatePlan(goal, providerAdapter, buildProviderRequest({ messages, tools, providerId: input.providerId, modelId: input.modelId, maxTokensPerTurn }), maxPlanSteps);
      if (plan) {
        const planSummary = plan.map(s => `  ${s.step}. ${s.action}`).join("\n");
        const updatedPrompt = enhancedPrompt + `\n\n## Execution Plan\nThe following plan has been generated for this task. Follow it step by step:\n${planSummary}\n\nAfter completing each step, acknowledge which step you completed.`;
        messages.length = 0; for (const m of buildInitialMessages(updatedPrompt, goal, input.messages)) messages.push(m);
        trace.push({ type: "planning", planSteps: plan.length, plan: plan.map(s => ({ step: s.step, action: s.action })) });
      }
    }

    // Main loop
    for (iteration = iteration > 0 ? iteration + 1 : 1; iteration <= effectiveMaxIterations; iteration++) {
      if (input.signal?.aborted) { status = "cancelled"; finalAnswer = `[Cancelled by user at iteration ${iteration}]`; trace.push({ iteration, type: "cancelled", message: "Loop cancelled by user via AbortSignal.", timestamp: new Date().toISOString() }); break; }
      const iterStartedAt = Date.now();
      compactIfNeeded(messages);
      const providerRequest = buildProviderRequest({ messages, tools, providerId: input.providerId, modelId: input.modelId, maxTokensPerTurn });
      if (input.signal?.aborted) { status = "cancelled"; finalAnswer = `[Cancelled by user at iteration ${iteration}]`; trace.push({ iteration, type: "cancelled", message: "Loop cancelled by user via AbortSignal (before provider call).", timestamp: new Date().toISOString() }); break; }

      let providerResponse;
      try { providerResponse = await withProviderTimeout(providerAdapter.generate(providerRequest)); }
      catch (error) {
        status = "error";
        trace.push({ iteration, type: "error", code: error?.code || "PROVIDER_ERROR", message: error instanceof Error ? error.message : "Provider call failed.", timestamp: new Date().toISOString() });
        return buildResult({ sessionId, goal, status, finalAnswer: finalAnswer || `Error at iteration ${iteration}: ${error.message}`, iterations: iteration, messages, trace, allToolResults, totalUsage, startedAt });
      }
      if (!providerResponse) {
        status = "error"; trace.push({ iteration, type: "error", code: "PROVIDER_EMPTY_RESPONSE", message: "Provider returned null/undefined response.", timestamp: new Date().toISOString() });
        return buildResult({ sessionId, goal, status, finalAnswer: finalAnswer || `Provider returned empty response at iteration ${iteration}.`, iterations: iteration, messages, trace, allToolResults, totalUsage, startedAt });
      }

      if (providerResponse?.usage) {
        totalUsage.inputTokens += providerResponse.usage.inputTokens ?? 0; totalUsage.outputTokens += providerResponse.usage.outputTokens ?? 0; totalUsage.totalTokens += providerResponse.usage.totalTokens ?? 0;
        const tokenBudget = options.tokenBudget ?? 100_000;
        if (totalUsage.totalTokens > tokenBudget && trace[trace.length - 1]?.type !== "token_budget_warning") trace.push({ iteration, type: "token_budget_warning", message: `Token usage (${totalUsage.totalTokens}) exceeds budget (${tokenBudget}). Consider wrapping up.`, totalTokens: totalUsage.totalTokens, budget: tokenBudget, timestamp: new Date().toISOString() });
        if (totalUsage.totalTokens > tokenBudget * 1.5) { status = "token_budget_exhausted"; trace.push({ iteration, type: "token_budget_hard_stop", message: `Token usage (${totalUsage.totalTokens}) exceeds hard limit (${tokenBudget * 1.5}). Loop terminated.`, totalTokens: totalUsage.totalTokens, hardLimit: tokenBudget * 1.5, timestamp: new Date().toISOString() }); if (!finalAnswer) finalAnswer = `[Token budget exhausted (${totalUsage.totalTokens} tokens used, limit was ${tokenBudget * 1.5}). Last context is in the message history.]`; break; }
      }

      if (hasToolCalls(providerResponse)) {
        const toolCalls = extractToolCalls(providerResponse);
        if (!toolCalls || toolCalls.length === 0) { finalAnswer = providerResponse?.text || ""; trace.push({ iteration, type: "final_answer", textLength: finalAnswer.length, note: "hasToolCalls=true but extractToolCalls returned null/empty", durationMs: Date.now() - iterStartedAt, timestamp: new Date().toISOString() }); try { if (typeof input.onIteration === "function") input.onIteration(iteration, { type: "final_answer", text: finalAnswer, durationMs: Date.now() - iterStartedAt }); } catch (_cbErr) { debugLoop("onIteration callback error:", _cbErr); } break; }
        messages.push(buildAssistantMessageWithToolCalls(providerResponse));
        trace.push({ iteration, type: "tool_calls", toolCalls: toolCalls.map((tc) => ({ name: tc.name, args: tc.arguments })), tokenUsage: providerResponse?.usage ? { inputTokens: providerResponse.usage.inputTokens ?? 0, outputTokens: providerResponse.usage.outputTokens ?? 0 } : undefined, durationMs: Date.now() - iterStartedAt, timestamp: new Date().toISOString() });
        const toolResults = await executeToolCalls(toolCalls, toolRegistry, { workingDirectory, sessionId });
        await processToolResults(toolCalls, toolResults, messages, allToolResults, iteration, plan);
        trace.push({ iteration, type: "tool_results", results: toolResults.map((r) => ({ tool_call_id: r.tool_call_id, isError: r._meta?.isError, durationMs: r._meta?.durationMs })), timestamp: new Date().toISOString() });
        if (errorRecoveryEnabled) { for (const r of toolResults) { if (r._meta?.isError) { const n = r._meta?.toolName || "unknown"; const rec = applyErrorRecovery(n, r.content, toolRegistry); if (rec) trace.push({ iteration, type: "error_recovery", toolName: n, recovery: rec, timestamp: new Date().toISOString() }); } } }
        if (selfReflectionEnabled && iteration % selfReflectionInterval === 0) trace.push({ iteration, type: "self_reflection", message: `Self-reflection prompt injected at iteration ${iteration}.`, timestamp: new Date().toISOString() });
        if (dynamicBudgetEnabled) { const prev = effectiveMaxIterations; effectiveMaxIterations = adjustIterationBudget(effectiveMaxIterations, allToolResults, iteration, maxIterations); if (effectiveMaxIterations !== prev) trace.push({ iteration, type: "budget_adjustment", previousBudget: prev, newBudget: effectiveMaxIterations, reason: effectiveMaxIterations > prev ? "Good progress — extending budget" : "Repeated errors — shrinking budget", timestamp: new Date().toISOString() }); }
        if (checkpointDir) { try { const { mkdirSync, writeFileSync } = await import("node:fs"); mkdirSync(checkpointDir, { recursive: true }); writeFileSync(`${checkpointDir}/checkpoint-${sessionId}.json`, JSON.stringify({ sessionId, iteration, messages: messages.slice(0, -toolResults.length), totalUsage, status: "checkpoint", savedAt: new Date().toISOString() }, null, 2)); } catch (_e) { debugLoop("checkpoint save failed", _e); } }
        if (plan && planStepIndex < plan.length) { plan[planStepIndex].status = "completed"; planStepIndex++; if (planStepIndex < plan.length) plan[planStepIndex].status = "in_progress"; }
        try { if (typeof input.onIteration === "function") input.onIteration(iteration, { type: "tool_calls_executed", toolCalls, toolResults, durationMs: Date.now() - iterStartedAt }); } catch (_cbErr) { debugLoop("onIteration callback error:", _cbErr); }
        continue;
      }

      finalAnswer = providerResponse?.text || "";
      trace.push({ iteration, type: "final_answer", textLength: finalAnswer.length, durationMs: Date.now() - iterStartedAt, tokenUsage: providerResponse?.usage ? { inputTokens: providerResponse.usage.inputTokens ?? 0, outputTokens: providerResponse.usage.outputTokens ?? 0 } : undefined, timestamp: new Date().toISOString() });
      try { if (typeof input.onIteration === "function") input.onIteration(iteration, { type: "final_answer", text: finalAnswer, durationMs: Date.now() - iterStartedAt }); } catch (_cbErr) { debugLoop("onIteration callback error:", _cbErr); }
      break;
    }

    if (iteration > effectiveMaxIterations && !finalAnswer) { status = status === "cancelled" ? "cancelled" : "max_iterations_reached"; if (status !== "cancelled") finalAnswer = `[Agentic loop reached maximum iterations (${effectiveMaxIterations}). Last context is in the message history.]`; }
    const result = buildResult({ sessionId, goal, status, finalAnswer, iterations: Math.min(iteration, effectiveMaxIterations), messages, trace, allToolResults, totalUsage, startedAt, plan });
    if (partialPreviewEnabled) { result.progressSummary = partialPreview.getProgressSummary(); partialPreview.clear(); }
    await finalize(sessionId, goal, status, messages, trace, allToolResults, totalUsage, startedAt, iteration, effectiveMaxIterations, plan);
    result.contextStats = contextManager.getStats();
    return result;
  }

  // ── executeStream (SSE streaming) ───────────────────────────────

  async function* executeStream(input) {
    if (!input || typeof input !== "object") { yield createStreamEvent("error", { code: "AGENTIC_INPUT_INVALID", message: "Input must be an object with a 'goal' property." }); return; }
    const sessionId = randomUUID(); const startedAt = Date.now();
    const goal = typeof input.goal === "string" ? input.goal : String(input.goal ?? "");
    if (!goal.trim()) { yield createStreamEvent("error", { code: "AGENTIC_GOAL_EMPTY", message: "Goal is required and must be a non-empty string." }); return; }

    const enhancedStreamPrompt = await enhancePrompt(systemPrompt, goal);
    analyzeComplexity(goal);
    const messages = buildInitialMessages(enhancedStreamPrompt, goal, input.messages);
    const tools = getOpenAITools(toolRegistry, input.toolAllowlist);
    const allToolResults = [];
    let totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let iteration = 0;
    yield createStreamEvent("start", { sessionId, goal, maxIterations });

    for (iteration = 1; iteration <= maxIterations; iteration++) {
     try {
      if (input.signal?.aborted) { yield createStreamEvent("cancelled", { iteration, message: "Loop cancelled by user via AbortSignal." }); yield createStreamEvent("complete", { sessionId, finalAnswer: `[Cancelled by user at iteration ${iteration}]`, iterations: iteration, status: "cancelled", toolUsage: summarizeToolUsage(allToolResults), usage: totalUsage, durationMs: Date.now() - startedAt }); return; }
      yield createStreamEvent("iteration_start", { iteration, maxIterations });
      compactIfNeeded(messages);
      const providerRequest = buildProviderRequest({ messages, tools, providerId: input.providerId, modelId: input.modelId, maxTokensPerTurn });
      if (input.signal?.aborted) { yield createStreamEvent("cancelled", { iteration, message: "Loop cancelled by user via AbortSignal (before provider call)." }); yield createStreamEvent("complete", { sessionId, finalAnswer: `[Cancelled by user at iteration ${iteration}]`, iterations: iteration, status: "cancelled", toolUsage: summarizeToolUsage(allToolResults), usage: totalUsage, durationMs: Date.now() - startedAt }); return; }

      let providerResponse;
      try { providerResponse = await withProviderTimeout(providerAdapter.generate(providerRequest)); }
      catch (error) { yield createStreamEvent("error", { code: error?.code || "PROVIDER_ERROR", message: error instanceof Error ? error.message : "Provider call failed.", recoverable: error?.retryable ?? false }); return; }

      if (providerResponse?.usage) {
        totalUsage.inputTokens += providerResponse.usage.inputTokens ?? 0; totalUsage.outputTokens += providerResponse.usage.outputTokens ?? 0; totalUsage.totalTokens += providerResponse.usage.totalTokens ?? 0;
        const streamTokenBudget = options.tokenBudget ?? 100_000;
        if (totalUsage.totalTokens > streamTokenBudget) yield createStreamEvent("token_budget_warning", { totalTokens: totalUsage.totalTokens, budget: streamTokenBudget });
        if (totalUsage.totalTokens > streamTokenBudget * 1.5) { yield createStreamEvent("complete", { sessionId, finalAnswer: `[Token budget exhausted (${totalUsage.totalTokens} tokens, limit ${streamTokenBudget * 1.5})]`, iterations: iteration, status: "token_budget_exhausted", toolUsage: summarizeToolUsage(allToolResults), usage: totalUsage, durationMs: Date.now() - startedAt }); return; }
      }

      if (providerResponse?.text) yield createStreamEvent("thinking", { text: providerResponse.text });

      if (hasToolCalls(providerResponse)) {
        const toolCalls = extractToolCalls(providerResponse);
        if (!toolCalls || toolCalls.length === 0) { yield createStreamEvent("answer", { text: providerResponse?.text || "" }); yield createStreamEvent("iteration_end", { iteration, hasToolCalls: false }); yield createStreamEvent("complete", { sessionId, finalAnswer: providerResponse?.text || "", iterations: iteration, toolUsage: summarizeToolUsage(allToolResults), usage: totalUsage, durationMs: Date.now() - startedAt }); return; }
        messages.push(buildAssistantMessageWithToolCalls(providerResponse));
        for (const tc of toolCalls) yield createStreamEvent("tool_call_start", { id: tc.id, tool: tc.name, params: tc.arguments });
        const toolResults = await executeToolCalls(toolCalls, toolRegistry, { workingDirectory, sessionId });
        await processToolResults(toolCalls, toolResults, messages, allToolResults, iteration, null);
        for (const r of toolResults) yield createStreamEvent("tool_call_result", { tool_call_id: r.tool_call_id, tool: r._meta?.toolName, result: truncateForEvent(r.content), durationMs: r._meta?.durationMs, isError: r._meta?.isError });
        if (errorRecoveryEnabled) { for (const r of toolResults) { if (r._meta?.isError) { const n = r._meta?.toolName || "unknown"; const rec = applyErrorRecovery(n, r.content, toolRegistry); if (rec) yield createStreamEvent("error_recovery", { toolName: n, recovery: rec }); } } }
        if (selfReflectionEnabled && iteration % selfReflectionInterval === 0) { yield createStreamEvent("self_reflection", { iteration, message: "Self-reflection prompt injected." }); }
        yield createStreamEvent("iteration_end", { iteration, hasToolCalls: true });
        continue;
      }

      yield createStreamEvent("answer", { text: providerResponse?.text || "" });
      yield createStreamEvent("iteration_end", { iteration, hasToolCalls: false });
      yield createStreamEvent("complete", { sessionId, finalAnswer: providerResponse?.text || "", iterations: iteration, toolUsage: summarizeToolUsage(allToolResults), usage: totalUsage, durationMs: Date.now() - startedAt });
      return;
     } catch (err) {
        debugLoop("executeStream unexpected error at iteration " + iteration, err);
        yield createStreamEvent("error", { code: "STREAM_UNEXPECTED_ERROR", message: err?.message || "Unexpected error in stream loop." });
        return;
      }
    }

    try { await sessionMemory.recordOutcome({ goal, status: "max_iterations_reached", toolSequence: allToolResults.map(r => r._meta?.toolName).filter(Boolean), durationMs: Date.now() - startedAt, iterationCount: iteration }); await sessionMemory.save(); } catch (_e) { debugLoop("non-fatal operation failed", _e); }
    try { await sessionStore.save({ sessionId: randomUUID(), goal, status: "max_iterations_reached", usage: totalUsage, iterations: maxIterations, durationMs: Date.now() - startedAt }); } catch (_e) { debugLoop("non-fatal operation failed", _e); }
    yield createStreamEvent("complete", { sessionId, finalAnswer: `[Max iterations (${maxIterations}) reached]`, iterations: maxIterations, status: "max_iterations_reached", toolUsage: summarizeToolUsage(allToolResults), usage: totalUsage, durationMs: Date.now() - startedAt, progressSummary: partialPreviewEnabled ? partialPreview.getProgressSummary() : undefined });
  }

  return {
    execute,
    executeStream,
    getToolRegistry: () => toolRegistry,
    getAutoContext: () => autoContext,
    getProjectInstructions: () => projectInstructions,
    getSubagentDispatch: () => subagentDispatch,
    getInfo: () => ({
      maxIterations, maxTokensPerTurn, workingDirectory, permissionMode,
      planningEnabled, maxPlanSteps, selfReflectionEnabled, selfReflectionInterval,
      errorRecoveryEnabled, dynamicBudgetEnabled,
      toolCount: toolRegistry.listTools().length,
      hasMcpBridge: Boolean(options.mcpBridge),
      hasAutoContext: true, hasProjectInstructions: true,
      hasSubagentDispatch: true, hasContextManager: true,
      hasSessionMemory: true, hasSessionStore: true, hasSmartModelRouter: true,
    }),
  };
}
