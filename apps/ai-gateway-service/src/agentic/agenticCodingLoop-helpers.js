/**
 * Agentic Coding Loop — Pure Helper Functions
 *
 * Extracted utility functions for self-reflection, error recovery,
 * dynamic budget, message compaction, and planning.
 */

import { withProviderTimeout, debugLoop } from "./agenticCodingLoop-constants.js";
import {
  convertRegistryToOpenAITools,
  summarizeToolUsage,
} from "../providers/toolCallingAdapter.js";

// ============================================================
// Feature: Self-Reflection (自反思)
// ============================================================

/**
 * Build a self-reflection system prompt that asks the model to review its
 * own progress at the current iteration.
 */
export function buildReflectionPrompt(iteration, toolResults, plan) {
  const successCount = toolResults.filter((r) => !r._meta?.isError).length;
  const errorCount = toolResults.filter((r) => r._meta?.isError).length;
  const toolNames = toolResults.map((r) => r._meta?.toolName || "unknown").join(", ");

  let planStatus = "";
  if (plan && plan.length > 0) {
    const completed = plan.filter((s) => s.status === "completed").length;
    planStatus = `\nPlan progress: ${completed}/${plan.length} steps completed.`;
  }

  const content =
    `[Self-Reflection — Iteration ${iteration}]\n` +
    `You just executed ${toolResults.length} tool call(s): ${toolNames}.\n` +
    `Results: ${successCount} succeeded, ${errorCount} failed.` +
    planStatus +
    `\n\nPlease briefly reflect:\n` +
    `1. What did you accomplish in the last step?\n` +
    `2. What remains to be done?\n` +
    `3. Are there any issues or blockers you need to address?\n` +
    `Keep your reflection concise (2-4 sentences). Then continue working toward the goal.`;

  return { role: "system", content };
}

// ============================================================
// Feature: Error Recovery Strategies (错误恢复链)
// ============================================================

/**
 * Map of tool names to recovery strategy functions.
 * @type {Map<string, Function>}
 */
const ERROR_RECOVERY_STRATEGIES = new Map([
  [
    "file_edit",
    (error, _toolRegistry) => {
      return (
        "Recovery suggestion: file_edit failed. " +
        "Consider retrying with file_write to overwrite the target file entirely, " +
        "or use file_read first to verify the current file content before attempting another edit."
      );
    },
  ],
  [
    "shell_exec",
    (error, _toolRegistry) => {
      return (
        "Recovery suggestion: shell_exec failed. " +
        "Try simplifying the command — break it into smaller steps, " +
        "verify the working directory, and check that required tools/binaries are available."
      );
    },
  ],
  [
    "web_fetch",
    (error, _toolRegistry) => {
      return (
        "Recovery suggestion: web_fetch failed. " +
        "Try a different URL format (e.g. use HTTPS, remove trailing slashes), " +
        "or verify the URL is accessible. Consider using web_search as an alternative."
      );
    },
  ],
]);

/**
 * Apply an error recovery strategy for a failed tool execution.
 */
export function applyErrorRecovery(toolName, error, toolRegistry) {
  const strategy = ERROR_RECOVERY_STRATEGIES.get(toolName);
  if (typeof strategy === "function") {
    return strategy(error, toolRegistry);
  }
  return null;
}

// ============================================================
// Feature: Dynamic Iteration Budget (动态迭代预算)
// ============================================================

/**
 * Adjust the remaining iteration budget based on recent tool results.
 */
export function adjustIterationBudget(currentBudget, recentResults, iteration, maxIterations) {
  if (!Array.isArray(recentResults) || recentResults.length === 0) {
    return currentBudget;
  }

  const last3 = recentResults.slice(-3);
  const successCount = last3.filter((r) => !r._meta?.isError).length;
  const failCount = last3.filter((r) => r._meta?.isError).length;

  if (last3.length >= 3 && successCount === last3.length) {
    return Math.min(currentBudget + 2, Math.ceil(maxIterations * 1.5));
  }

  if (failCount >= 2) {
    return Math.max(currentBudget - 3, iteration + 2);
  }

  return currentBudget;
}

// ============================================================
// Message Compaction
// ============================================================

/**
 * Compact the messages array by summarizing older iterations while keeping
 * recent iterations in full detail.
 */
export function compactMessages(messages, keepRecent = 5) {
  const systemMsgs = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "system" || (messages[i].role === "user" && i <= 1)) {
      systemMsgs.push(messages[i]);
    }
  }

  const assistantIndices = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "assistant") {
      assistantIndices.push(i);
    }
  }

  if (assistantIndices.length <= keepRecent) {
    return messages;
  }

  const cutoffIndex = assistantIndices[assistantIndices.length - keepRecent];
  const oldMessages = messages.slice(systemMsgs.length, cutoffIndex);
  const recentMessages = messages.slice(cutoffIndex);

  const toolResultCount = oldMessages.filter((m) => m.role === "tool").length;
  const iterationCount = oldMessages.filter((m) => m.role === "assistant").length;

  const keyFindings = [];
  for (const msg of oldMessages) {
    if (msg.role === "tool" && msg.content) {
      try {
        const parsed = typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content;
        if (parsed?.status === "error") {
          keyFindings.push(
            `Error in ${msg._meta?.toolName || "tool"}: ${parsed.error || parsed.message || "unknown"}`
          );
        }
      } catch (_e) {
        // Not JSON — skip silently
      }
    }
  }

  const summaryContent =
    `[Context compacted: ${iterationCount} earlier iterations summarized. ` +
    `${toolResultCount} tool results processed.` +
    (keyFindings.length > 0
      ? " Key issues found: " + keyFindings.slice(0, 5).join("; ")
      : "") +
    ` Continuing with full detail for the last ${keepRecent} iterations.]`;

  const summaryMsg = { role: "system", content: summaryContent };
  return [...systemMsgs, summaryMsg, ...recentMessages];
}

// ============================================================
// Planning
// ============================================================

/**
 * Generate a step-by-step execution plan from the goal.
 */
export async function generatePlan(goal, providerAdapter, providerRequest, maxSteps) {
  const planningPrompt = `You are a planning assistant. Analyze the following coding task and break it into ${maxSteps} or fewer concrete, actionable steps.

Rules:
- Each step should be a single clear action (read a file, write code, run a test, etc.)
- Steps must be ordered by dependency (earlier steps provide context for later ones)
- Include verification steps where appropriate
- Be specific: mention file names, function names, patterns to look for

Respond ONLY with a JSON array of step objects, no other text:
[
  { "step": 1, "action": "description of what to do", "tools": ["tool_name"], "success_criteria": "how to know it's done" },
  ...
]

Task: ${goal}`;

  const planRequest = {
    ...providerRequest,
    request: {
      ...providerRequest.request,
      messages: [{ role: "user", content: planningPrompt }],
      tools: undefined,
    },
  };

  try {
    const response = await withProviderTimeout(providerAdapter.generate(planRequest));
    const text = response?.text || "";

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return null;

    const steps = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(steps) || steps.length === 0) return null;

    return steps.slice(0, maxSteps).map((s, i) => ({
      step: i + 1,
      action: s.action || s.description || `Step ${i + 1}`,
      tools: Array.isArray(s.tools) ? s.tools : [],
      successCriteria: s.success_criteria || s.successCriteria || "",
      status: "pending",
    }));
  } catch (_e) {
    debugLoop("plan generation failed", _e);
    return null;
  }
}

// ============================================================
// Internal Helpers
// ============================================================

export function buildInitialMessages(systemPrompt, goal, existingMessages) {
  const messages = [{ role: "system", content: systemPrompt }];

  if (Array.isArray(existingMessages) && existingMessages.length > 0) {
    for (const msg of existingMessages) {
      if (msg.role !== "system") {
        messages.push(msg);
      }
    }
  }

  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== "user" || lastMsg.content !== goal) {
    messages.push({ role: "user", content: goal });
  }

  return messages;
}

export function getOpenAITools(toolRegistry, allowlist) {
  const filter = allowlist ? { allowlist } : {};
  const tools = toolRegistry.listTools(filter);
  return convertRegistryToOpenAITools(tools);
}

export function buildProviderRequest({ messages, tools, providerId, modelId, maxTokensPerTurn }) {
  return {
    request: {
      messages,
      tools,
      toolChoice: "auto",
      options: { maxOutputTokens: maxTokensPerTurn },
    },
    target: {
      providerId: providerId || "openai",
      modelId: modelId || "gpt-4o",
    },
  };
}

export function buildResult({ sessionId, goal, status, finalAnswer, iterations, messages, trace, allToolResults, totalUsage, startedAt, plan }) {
  const totalDurationMs = Date.now() - startedAt;
  return {
    sessionId,
    goal,
    status,
    finalAnswer,
    iterations,
    messages,
    trace,
    plan: plan || null,
    toolUsage: summarizeToolUsage(allToolResults),
    usage: totalUsage,
    durationMs: totalDurationMs,
    timing: {
      totalDurationMs,
      averageIterationMs: iterations > 0 ? totalDurationMs / iterations : 0,
    },
  };
}

export function createErrorResult(code, message) {
  return {
    sessionId: randomUUID(),
    goal: "",
    status: "error",
    finalAnswer: "",
    iterations: 0,
    messages: [],
    trace: [{ type: "error", code, message, timestamp: new Date().toISOString() }],
    toolUsage: { totalCalls: 0, totalErrors: 0, totalDurationMs: 0, toolCounts: {} },
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    durationMs: 0,
    timing: { totalDurationMs: 0, averageIterationMs: 0 },
    error: { code, message },
  };
}

import { randomUUID } from "node:crypto";

export async function syncMcpToolsToRegistry(mcpBridge, toolRegistry) {
  try {
    const mcpTools = await mcpBridge.listAllTools();
    if (Array.isArray(mcpTools)) {
      for (const mcpTool of mcpTools) {
        const toolName = mcpTool.name || mcpTool.prefixedName;
        if (toolName && !toolRegistry.getTool(toolName)) {
          const { buildTool, createInputSchema } = await import("../claude-code-patterns/agentToolRegistry.js");
          const tool = buildTool({
            name: toolName,
            description: mcpTool.description || `MCP tool: ${toolName}`,
            inputSchema: mcpTool.inputSchema || createInputSchema({}),
            execute: async (params) => mcpBridge.callTool(toolName, params),
            requiredPermissions: ["mcp:call"],
            isReadOnly: true,
          });
          toolRegistry.registerTool(tool);
        }
      }
    }
  } catch (_e) {
    debugLoop("MCP tool sync failed", _e);
  }
}
