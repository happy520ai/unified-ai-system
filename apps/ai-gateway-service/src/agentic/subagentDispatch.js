/**
 * Subagent Dispatch — 子任务分发引擎
 *
 * 对标 Claude Code 的 subagent 能力:
 * - 将独立子任务分发给子 agent 并行执行
 * - 每个子 agent 有自己的上下文和工具权限
 * - 结果汇总后返回主 agent
 *
 * 用途:
 *   - 并行搜索多个文件
 *   - 并行执行独立修改
 *   - 并行运行多个验证
 *
 * @module subagentDispatch
 */

import { randomUUID } from "node:crypto";
import { buildTool, createInputSchema } from "../claude-code-patterns/agentToolRegistry.js";
import { extractToolCalls, executeToolCalls } from "../providers/toolCallingAdapter.js";

const MAX_CONCURRENT = 5;
const DEFAULT_SUBAGENT_TIMEOUT = 60_000;
const MAX_SUBTASK_ITERATIONS = 10;

/**
 * 创建子任务分发器。
 *
 * @param {Object} options
 * @param {Object} options.providerAdapter - LLM provider adapter
 * @param {Object} [options.toolRegistry] - 工具注册表
 * @param {string} [options.workingDirectory]
 * @param {number} [options.maxConcurrent=5]
 * @param {number} [options.timeoutMs=60000]
 * @returns {Object} 分发器实例
 */
export function createSubagentDispatch(options = {}) {
  const providerAdapter = options.providerAdapter;
  const toolRegistry = options.toolRegistry;
  const workingDir = options.workingDirectory || process.cwd();
  const maxConcurrent = options.maxConcurrent ?? MAX_CONCURRENT;
  const timeoutMs = options.timeoutMs ?? DEFAULT_SUBAGENT_TIMEOUT;

  if (!providerAdapter) {
    throw new Error("SubagentDispatch requires a providerAdapter.");
  }

  /**
   * 执行单个子任务 (multi-turn agentic loop with tool calling)。
   *
   * @param {Object} task
   * @param {string} task.id - 任务 ID
   * @param {string} task.description - 任务描述
   * @param {string[]} [task.tools] - 允许的工具列表
   * @param {Object} [task.context] - 额外上下文
   * @returns {Promise<Object>} 子任务结果
   */
  async function executeSubtask(task) {
    const taskId = task.id || randomUUID();
    const startedAt = Date.now();

    const systemPrompt = `You are a focused sub-agent working on a specific task.
Complete the task efficiently using the available tools.
Return a clear, structured result. Do not ask questions — work with what you have.`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: task.description },
    ];

    // Add context if provided
    if (task.context) {
      const contextStr = typeof task.context === "string"
        ? task.context
        : JSON.stringify(task.context, null, 2);
      messages.splice(1, 0, {
        role: "system",
        content: `Additional context:\n${contextStr}`,
      });
    }

    // Build tools list
    let tools = [];
    if (toolRegistry && Array.isArray(task.tools) && task.tools.length > 0) {
      const allTools = toolRegistry.listTools();
      const filtered = allTools.filter((t) => task.tools.includes(t.name));
      const { convertRegistryToOpenAITools } = await import("../providers/toolCallingAdapter.js");
      tools = convertRegistryToOpenAITools(filtered);
    }

    // Multi-turn agentic loop with tool calling
    let iteration = 0;
    let totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    const toolCallLog = [];

    try {
      while (iteration < MAX_SUBTASK_ITERATIONS) {
        iteration++;

        let timerId;
        const response = await Promise.race([
          providerAdapter.generate({
            request: {
              messages,
              tools: tools.length > 0 ? tools : undefined,
              toolChoice: tools.length > 0 ? "auto" : undefined,
              options: { maxOutputTokens: 2048 },
            },
            target: {
              providerId: task.providerId || "openai",
              modelId: task.modelId || "gpt-4o",
            },
          }),
          new Promise((_, reject) => {
            timerId = setTimeout(() => reject(new Error("Subtask timeout")), timeoutMs);
          }),
        ]).finally(() => clearTimeout(timerId));

        // Accumulate token usage
        if (response?.usage) {
          totalUsage.inputTokens += response.usage.inputTokens || 0;
          totalUsage.outputTokens += response.usage.outputTokens || 0;
          totalUsage.totalTokens += response.usage.totalTokens || 0;
        }

        // Check for tool calls
        const toolCalls = extractToolCalls(response);

        if (!toolCalls || toolCalls.length === 0) {
          // Final answer — no more tool calls
          return {
            id: taskId,
            description: task.description,
            status: "completed",
            result: response?.text || "",
            usage: totalUsage,
            iterations: iteration,
            toolCallsMade: toolCallLog.length,
            durationMs: Date.now() - startedAt,
          };
        }

        // Execute tool calls
        if (!toolRegistry) {
          // No tool registry — return response as-is
          return {
            id: taskId,
            description: task.description,
            status: "completed",
            result: response?.text || "(tool calls requested but no registry available)",
            usage: totalUsage,
            iterations: iteration,
            durationMs: Date.now() - startedAt,
          };
        }

        // Add assistant message with tool calls to conversation
        const assistantMsg = {
          role: "assistant",
          content: response?.text || null,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          })),
        };
        messages.push(assistantMsg);

        // Execute all tool calls
        const toolResults = await executeToolCalls(toolCalls, toolRegistry, {
          workingDirectory: workingDir,
        });

        // Log tool calls for traceability
        for (const tc of toolCalls) {
          toolCallLog.push({ name: tc.name, args: tc.arguments });
        }

        // Add tool results to conversation
        for (const result of toolResults) {
          messages.push({
            role: "tool",
            tool_call_id: result.tool_call_id,
            content: typeof result.content === "string"
              ? result.content
              : JSON.stringify(result.content),
          });
        }
      }

      // Hit iteration limit
      return {
        id: taskId,
        description: task.description,
        status: "iteration_limit",
        result: "(iteration limit reached: " + iteration + " iterations)",
        usage: totalUsage,
        iterations: iteration,
        toolCallsMade: toolCallLog.length,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        id: taskId,
        description: task.description,
        status: "error",
        error: error.message,
        iterations: iteration,
        toolCallsMade: toolCallLog.length,
        durationMs: Date.now() - startedAt,
      };
    }
  }

  /**
   * 并行分发多个子任务。
   *
   * @param {Object[]} tasks - 子任务数组
   * @param {Object} [dispatchOptions]
   * @param {string} [dispatchOptions.providerId]
   * @param {string} [dispatchOptions.modelId]
   * @returns {Promise<Object>} 分发结果
   */
  async function dispatchAll(tasks, dispatchOptions = {}) {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return { status: "no_tasks", results: [], summary: "No tasks to dispatch." };
    }

    const startedAt = Date.now();

    // Add provider info to each task
    const enrichedTasks = tasks.map((t) => ({
      ...t,
      providerId: dispatchOptions.providerId || t.providerId,
      modelId: dispatchOptions.modelId || t.modelId,
    }));

    // Execute in batches (respect maxConcurrent)
    const results = [];
    for (let i = 0; i < enrichedTasks.length; i += maxConcurrent) {
      const batch = enrichedTasks.slice(i, i + maxConcurrent);
      const batchResults = await Promise.allSettled(
        batch.map((task) => executeSubtask(task))
      );

      for (const r of batchResults) {
        if (r.status === "fulfilled") {
          results.push(r.value);
        } else {
          results.push({
            status: "error",
            error: r.reason?.message || "Unknown error",
          });
        }
      }
    }

    // Build summary
    const completed = results.filter((r) => r.status === "completed").length;
    const failed = results.filter((r) => r.status === "error").length;

    return {
      status: failed === 0 ? "all_completed" : (completed > 0 ? "partial" : "all_failed"),
      totalTasks: tasks.length,
      completed,
      failed,
      results,
      totalDurationMs: Date.now() - startedAt,
      summary: buildSummary(results),
    };
  }

  /**
   * 构建结果汇总 (用于注入主 agent 的上下文)。
   */
  function buildSummary(results) {
    const parts = [];
    for (const r of results) {
      const statusIcon = r.status === "completed" ? "✓" : "✗";
      parts.push(`[${statusIcon}] ${r.description}`);
      if (r.status === "completed" && r.result) {
        const truncated = r.result.length > 500
          ? r.result.slice(0, 500) + "...[truncated]"
          : r.result;
        parts.push(`    Result: ${truncated}`);
      } else if (r.status === "error") {
        parts.push(`    Error: ${r.error}`);
      }
    }
    return parts.join("\n");
  }

  /**
   * 创建 subagent_dispatch 工具 (供 agentic loop 调用)。
   */
  function createDispatchTool() {
    return buildTool({
      name: "subagent_dispatch",
      description: `Dispatch multiple independent sub-tasks to parallel sub-agents.
Each sub-agent gets its own context and runs a focused mini-task.
Results are collected and summarized for you.

Use this when you have 2+ independent tasks that can run in parallel, such as:
- Searching multiple files simultaneously
- Running independent validations
- Analyzing multiple components in parallel`,
      inputSchema: createInputSchema(
        {
          tasks: {
            type: "array",
            description: "Array of sub-tasks to dispatch",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "Unique task identifier" },
                description: { type: "string", description: "Clear task description for the sub-agent" },
                tools: {
                  type: "array",
                  items: { type: "string" },
                  description: "Tool names the sub-agent can use (e.g. ['file_read', 'grep'])",
                },
              },
              required: ["description"],
            },
          },
        },
        ["tasks"]
      ),
      requiredPermissions: ["agent:dispatch"],
      isReadOnly: true,

      async execute(params) {
        const { tasks } = params;
        return dispatchAll(tasks);
      },
    });
  }

  return {
    dispatchAll,
    executeSubtask,
    createDispatchTool,
    getInfo: () => ({ maxConcurrent, timeoutMs, hasToolRegistry: !!toolRegistry }),
  };
}
