/**
 * Context Manager — 上下文窗口管理器
 *
 * 桥接 forge-core ContextEngine 到 Agentic Loop,
 * 实现自动上下文压缩、对话历史管理、文件变更追踪。
 * 历史压缩委托统一压缩引擎（packages/codex-context-gateway）。
 *
 * @module contextManager
 */
import {
  compactMessageHistory,
  defineCompactionPolicy,
  estimateContextTokens,
} from "@unified-ai-system/codex-context-gateway";

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
   * 管理对话历史: 当消息过多时压缩旧消息（委托统一压缩引擎）。
   *
   * @param {Object[]} messages - 当前消息数组
   * @returns {Object[]} 压缩后的消息数组
   */
  function manageHistory(messages) {
    if (!Array.isArray(messages) || messages.length <= 2) {
      return messages;
    }

    const { messages: result, report } = compactMessageHistory(
      messages,
      defineCompactionPolicy({
        summaryStyle: "turns",
        keepRecentTurns: recentTurnsToKeep,
        maxContextTokens,
        tokenTriggerRatio: 0.7,
        turnSummaryPrefix: "[Previous conversation summary]",
      }),
    );

    if (report.compacted && report.summaryText) {
      summarizedHistory = report.summaryText;
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
 * 估算 token 数 — 委托统一压缩引擎的估算器 (CJK 1.5 chars/token, ASCII 4 chars/token)。
 */
function estimateTokens(text) {
  return estimateContextTokens(text);
}
