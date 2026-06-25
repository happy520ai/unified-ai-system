/**
 * Tool Calling Adapter — OpenAI Function Calling 协议转换层
 *
 * 将 agentToolRegistry 的工具定义转为 OpenAI tools 格式,
 * 解析 LLM 响应中的 tool_calls,并执行工具调用。
 *
 * @module toolCallingAdapter
 */

// ============================================================
// 格式转换: agentToolRegistry → OpenAI tools
// ============================================================

/**
 * 将 agentToolRegistry 的工具列表转为 OpenAI function calling tools 格式。
 *
 * @param {Object[]} tools - 从 registry.listTools() 返回的工具数组
 * @returns {Object[]} OpenAI tools 格式数组
 */
export function convertRegistryToOpenAITools(tools) {
  if (!Array.isArray(tools) || tools.length === 0) {
    return [];
  }

  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: truncateDescription(tool.description, 1024),
      parameters: normalizeSchema(tool.inputSchema),
    },
  }));
}

/**
 * 将 agentToolRegistry 的 inputSchema 规范化为 OpenAI 兼容的 JSON Schema。
 * OpenAI 要求 parameters 必须有 type: "object"。
 */
function normalizeSchema(schema) {
  if (!schema || typeof schema !== "object") {
    return { type: "object", properties: {}, additionalProperties: false };
  }

  const normalized = {
    type: schema.type || "object",
    properties: schema.properties || {},
    additionalProperties: schema.additionalProperties ?? false,
  };

  if (Array.isArray(schema.required) && schema.required.length > 0) {
    normalized.required = schema.required;
  }

  return normalized;
}

function truncateDescription(desc, maxLen) {
  if (!desc) return "Tool";
  return desc.length > maxLen ? desc.slice(0, maxLen - 3) + "..." : desc;
}

// ============================================================
// 解析 LLM 响应中的 tool_calls
// ============================================================

/**
 * 从 OpenAI chat completion 响应的 message 中提取 tool_calls。
 *
 * @param {Object} message - choices[0].message
 * @returns {Object[]|null} tool_calls 数组或 null
 */
export function parseToolCallsFromResponse(message) {
  if (!message?.tool_calls || !Array.isArray(message.tool_calls)) {
    return null;
  }

  return message.tool_calls.map((tc) => ({
    id: tc.id,
    type: tc.type || "function",
    name: tc.function?.name || "",
    arguments: safeParseArguments(tc.function?.arguments),
  }));
}

/**
 * 安全解析 tool_call 的 arguments JSON 字符串。
 */
function safeParseArguments(argsStr) {
  if (!argsStr) return {};
  if (typeof argsStr === "object") return argsStr;

  try {
    return JSON.parse(argsStr);
  } catch {
    return { _raw: argsStr };
  }
}

/**
 * 检查 LLM 响应是否包含 tool_calls。
 *
 * @param {Object} providerResponse - createProviderResponse() 的返回值
 * @returns {boolean}
 */
export function hasToolCalls(providerResponse) {
  // Check finish_reason from raw metadata
  if (providerResponse?.raw?.finishReason === "tool_calls") {
    return true;
  }

  // Check toolCalls field directly
  if (Array.isArray(providerResponse?.toolCalls) && providerResponse.toolCalls.length > 0) {
    return true;
  }

  // Check message-level tool_calls
  if (Array.isArray(providerResponse?.message?.tool_calls) && providerResponse.message.tool_calls.length > 0) {
    return true;
  }

  return false;
}

/**
 * 从 providerResponse 中提取 tool_calls。
 *
 * @param {Object} providerResponse
 * @returns {Object[]|null}
 */
export function extractToolCalls(providerResponse) {
  // Priority 1: already parsed toolCalls field
  if (Array.isArray(providerResponse?.toolCalls) && providerResponse.toolCalls.length > 0) {
    return providerResponse.toolCalls;
  }

  // Priority 2: parse from message.tool_calls
  if (providerResponse?.message?.tool_calls) {
    return parseToolCallsFromResponse(providerResponse.message);
  }

  return null;
}

// ============================================================
// 执行 tool_calls 并构建 tool result messages
// ============================================================

/**
 * 执行一组 tool_calls,返回 OpenAI 格式的 tool result messages。
 *
 * @param {Object[]} toolCalls - parseToolCallsFromResponse 的输出
 * @param {Object} toolRegistry - createAgentToolRegistry 的实例
 * @param {Object} [context] - 工具执行上下文覆盖
 * @returns {Promise<Object[]>} tool result messages 数组
 */
export async function executeToolCalls(toolCalls, toolRegistry, context = {}) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return [];
  }

  // Execute all tool calls in parallel for maximum throughput
  const settled = await Promise.allSettled(
    toolCalls.map(async (tc) => {
      const startedAt = Date.now();
      let resultContent;
      let isError = false;

      try {
        const result = await toolRegistry.executeTool(tc.name, tc.arguments, context);
        resultContent = formatToolResult(result);
        // Detect soft-error returns: executeTool() catches thrown exceptions and returns
        // { status: "error", error: "..." } instead of re-throwing. Built-in tools like
        // shell_exec, web_fetch, code_run also return { status: "error" } on failure.
        if (result && typeof result === "object" && (result.status === "error" || result.error === true)) {
          isError = true;
        }
      } catch (error) {
        isError = true;
        resultContent = JSON.stringify({
          error: true,
          code: error?.code || "TOOL_EXECUTION_ERROR",
          message: error instanceof Error ? error.message : "Tool execution failed.",
        });
      }

      const durationMs = Date.now() - startedAt;

      return {
        role: "tool",
        tool_call_id: tc.id,
        content: resultContent,
        _meta: {
          toolName: tc.name,
          durationMs,
          isError,
        },
      };
    })
  );

  // Extract results preserving input order; rejected promises become error results
  return settled.map((outcome, idx) => {
    if (outcome.status === "fulfilled") {
      return outcome.value;
    }
    // Should rarely happen since each task catches internally, but handle defensively
    const tc = toolCalls[idx];
    return {
      role: "tool",
      tool_call_id: tc.id,
      content: JSON.stringify({
        error: true,
        code: "TOOL_EXECUTION_ERROR",
        message: outcome.reason instanceof Error ? outcome.reason.message : "Tool execution failed.",
      }),
      _meta: {
        toolName: tc.name,
        durationMs: 0,
        isError: true,
      },
    };
  });
}

/**
 * 将工具执行结果格式化为 JSON 字符串,用于 tool message content。
 */
function formatToolResult(result) {
  if (result === undefined || result === null) {
    return JSON.stringify({ success: true, result: null });
  }

  if (typeof result === "string") {
    // Truncate very long results
    if (result.length > 50_000) {
      return result.slice(0, 50_000) + "\n... [truncated]";
    }
    return result;
  }

  try {
    const serialized = JSON.stringify(result);
    if (serialized.length > 50_000) {
      return serialized.slice(0, 50_000) + "\n... [truncated]";
    }
    return serialized;
  } catch {
    return String(result);
  }
}

// ============================================================
// 构建 assistant message (含 tool_calls) 用于对话历史
// ============================================================

/**
 * 从 LLM 响应构建 assistant message,保留 tool_calls 信息。
 *
 * @param {Object} providerResponse - createProviderResponse 的输出
 * @returns {Object} OpenAI 格式的 assistant message
 */
export function buildAssistantMessageWithToolCalls(providerResponse) {
  const message = {
    role: "assistant",
    content: providerResponse?.text || providerResponse?.message?.content || "",
  };

  const toolCalls = extractToolCalls(providerResponse);
  if (toolCalls && toolCalls.length > 0) {
    message.tool_calls = toolCalls.map((tc) => ({
      id: tc.id,
      type: "function",
      function: {
        name: tc.name,
        arguments: typeof tc.arguments === "string" ? tc.arguments : JSON.stringify(tc.arguments),
      },
    }));
  }

  return message;
}

// ============================================================
// 聚合工具使用统计
// ============================================================

/**
 * 汇总多轮迭代的工具使用情况。
 *
 * @param {Object[]} allToolResults - 所有迭代的 tool result messages
 * @returns {Object} 统计摘要
 */
export function summarizeToolUsage(allToolResults) {
  const summary = {
    totalCalls: 0,
    totalErrors: 0,
    totalDurationMs: 0,
    toolCounts: {},
  };

  for (const result of allToolResults) {
    summary.totalCalls++;
    if (result._meta?.isError) summary.totalErrors++;
    if (result._meta?.durationMs) summary.totalDurationMs += result._meta.durationMs;

    const name = result._meta?.toolName || "unknown";
    summary.toolCounts[name] = (summary.toolCounts[name] || 0) + 1;
  }

  return summary;
}
