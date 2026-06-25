/**
 * Context Manager — 上下文窗口管理器
 *
 * 桥接 forge-core ContextEngine 到 Agentic Loop,
 * 实现自动上下文压缩、对话历史管理、文件变更追踪。
 *
 * @module contextManager
 */

/**
 * 创建上下文管理器。
 *
 * @param {Object} [options]
 * @param {number} [options.maxContextTokens=32000] - 最大上下文 token 预算
 * @param {number} [options.recentTurnsToKeep=5] - 保留最近 N 轮完整对话
 * @param {number} [options.maxFileContentTokens=2000] - 单文件最大 token 数
 * @returns {Object} 上下文管理器实例
 */
export function createContextManager(options = {}) {
  const maxContextTokens = options.maxContextTokens ?? 32_000;
  const recentTurnsToKeep = options.recentTurnsToKeep ?? 5;
  const maxFileContentTokens = options.maxFileContentTokens ?? 2_000;

  const changedFiles = new Map(); // path -> { lastModified, operation }
  const MAX_CHANGED_FILES = 500; // LRU eviction cap to prevent unbounded memory growth

  /** Evict oldest entries if Map exceeds capacity */
  function safeSetChangedFiles(key, value) {
    changedFiles.delete(key); // delete-then-set moves key to end (most recent)
    changedFiles.set(key, value);
    while (changedFiles.size > MAX_CHANGED_FILES) {
      const oldest = changedFiles.keys().next().value;
      changedFiles.delete(oldest);
    }
  }

  let summarizedHistory = "";

  /**
   * 管理对话历史: 当消息过多时压缩旧消息。
   *
   * @param {Object[]} messages - 当前消息数组
   * @returns {Object[]} 压缩后的消息数组
   */
  function manageHistory(messages) {
    if (!Array.isArray(messages) || messages.length <= 2) {
      return messages;
    }

    // Estimate total tokens in history
    const totalTokens = estimateTokens(messages.map((m) => m.content || "").join("\n"));

    // If within budget, return as-is
    if (totalTokens < maxContextTokens * 0.7) {
      return messages;
    }

    // Find conversation turns (user+assistant pairs)
    const turns = extractTurns(messages);

    if (turns.length <= recentTurnsToKeep) {
      return messages;
    }

    // Summarize old turns
    const oldTurns = turns.slice(0, turns.length - recentTurnsToKeep);
    const recentTurns = turns.slice(turns.length - recentTurnsToKeep);

    const oldSummary = summarizeTurns(oldTurns);
    summarizedHistory = oldSummary;

    // Rebuild messages: system + summary + recent turns
    const systemMsg = messages.find((m) => m.role === "system");
    const result = [];

    if (systemMsg) {
      result.push(systemMsg);
    }

    if (summarizedHistory) {
      result.push({
        role: "system",
        content: `[Previous conversation summary]\n${summarizedHistory}`,
      });
    }

    // Add recent turns
    for (const turn of recentTurns) {
      result.push(...turn.messages);
    }

    return result;
  }

  /**
   * 跟踪文件变更。
   *
   * @param {Object[]} toolResults - 工具执行结果数组
   */
  function trackChangedFiles(toolResults) {
    for (const result of toolResults) {
      const toolName = result._meta?.toolName;
      const content = result.content;

      if (toolName === "file_write" || toolName === "file_read") {
        // Try to extract file path from result
        try {
          const parsed = typeof content === "string" ? JSON.parse(content) : content;
          const path = parsed?.path || parsed?.file || parsed?.filePath;
          if (path) {
            safeSetChangedFiles(path, {
              lastModified: new Date().toISOString(),
              operation: toolName === "file_write" ? "write" : "read",
            });
          }
        } catch {
          // Ignore parse errors
        }
      }

      if (toolName === "shell_exec") {
        // Shell commands may modify files — track working directory
        safeSetChangedFiles("[shell_executed]", {
          lastModified: new Date().toISOString(),
          operation: "shell",
          content: typeof content === "string" ? content.slice(0, 500) : "",
        });
      }
    }
  }

  /**
   * 获取变更文件列表。
   */
  function getChangedFiles() {
    return [...changedFiles.entries()].map(([path, info]) => ({
      path,
      ...info,
    }));
  }

  /**
   * 清除变更文件跟踪。
   */
  function clearChangedFiles() {
    changedFiles.clear();
  }

  /**
   * 构建优化的上下文块 (用于注入 system prompt)。
   *
   * @param {Object} task - 当前任务信息
   * @returns {string} 上下文文本块
   */
  function buildContextBlock(task) {
    const parts = [];

    // Changed files summary
    if (changedFiles.size > 0) {
      parts.push("## Files Modified During This Session");
      for (const [path, info] of changedFiles) {
        if (path === "[shell_executed]") continue;
        parts.push(`- \`${path}\` (${info.operation}, ${info.lastModified})`);
      }
    }

    // History summary
    if (summarizedHistory) {
      parts.push("\n## Prior Conversation Summary");
      parts.push(summarizedHistory);
    }

    return parts.join("\n");
  }

  return {
    manageHistory,
    trackChangedFiles,
    getChangedFiles,
    clearChangedFiles,
    buildContextBlock,
    estimateTokens,
    getStats: () => ({
      maxContextTokens,
      recentTurnsToKeep,
      changedFilesCount: changedFiles.size,
      hasSummarizedHistory: Boolean(summarizedHistory),
    }),
  };
}

// ============================================================
// Internal helpers
// ============================================================

/**
 * 提取对话轮次 (user → assistant/tool 对)。
 */
function extractTurns(messages) {
  const turns = [];
  let currentTurn = null;

  for (const msg of messages) {
    if (msg.role === "system") continue;

    if (msg.role === "user") {
      if (currentTurn) {
        turns.push(currentTurn);
      }
      currentTurn = { messages: [msg], hasToolCalls: false };
    } else if (currentTurn) {
      currentTurn.messages.push(msg);
      if (msg.role === "tool" || msg.tool_calls) {
        currentTurn.hasToolCalls = true;
      }
    }
  }

  if (currentTurn) {
    turns.push(currentTurn);
  }

  return turns;
}

/**
 * 将旧轮次生成摘要。
 */
function summarizeTurns(turns) {
  if (turns.length === 0) return "";

  const summaries = [];

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    const userMsg = turn.messages.find((m) => m.role === "user");
    const assistantMsgs = turn.messages.filter((m) => m.role === "assistant");
    const toolMsgs = turn.messages.filter((m) => m.role === "tool");

    const userContent = userMsg?.content || "[no user message]";
    const assistantContent = assistantMsgs.map((m) => m.content || "").filter(Boolean).join(" ");
    const toolCount = toolMsgs.length;

    let summary = `Turn ${i + 1}: User asked "${truncate(userContent, 100)}"`;
    if (toolCount > 0) {
      summary += `, ${toolCount} tool(s) were called`;
    }
    if (assistantContent) {
      summary += `. Assistant responded: "${truncate(assistantContent, 200)}"`;
    }
    summaries.push(summary);
  }

  return summaries.join("\n");
}

/**
 * 估算 token 数 (CJK 1.5 chars/token, ASCII 4 chars/token)。
 */
function estimateTokens(text) {
  if (!text) return 0;

  let cjkChars = 0;
  let asciiChars = 0;

  for (const char of text) {
    const code = char.codePointAt(0);
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3040 && code <= 0x309f) ||
      (code >= 0x30a0 && code <= 0x30ff)
    ) {
      cjkChars++;
    } else {
      asciiChars++;
    }
  }

  return Math.ceil(cjkChars / 1.5 + asciiChars / 4);
}

function truncate(str, maxLen) {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
}
