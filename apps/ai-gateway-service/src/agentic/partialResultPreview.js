/**
 * PartialResultPreview — Real-time intermediate result preview for the agentic loop.
 * Collects and formats partial results as the loop progresses.
 *
 * @module partialResultPreview
 */

export function createPartialResultPreview(options = {}) {
  const maxPreviewItems = options.maxPreviewItems ?? 50;
  const items = [];
  const fileChanges = new Map(); // path → { action, timestamp }

  return {
    /**
     * Record a tool execution result for preview.
     */
    recordToolResult(toolName, params, result) {
      const item = {
        type: "tool_result",
        toolName,
        timestamp: new Date().toISOString(),
        summary: _summarizeToolResult(toolName, params, result),
      };
      items.push(item);
      while (items.length > maxPreviewItems) items.shift();

      // Track file changes
      if (["file_write", "file_edit", "file_insert"].includes(toolName) && params?.path) {
        fileChanges.set(params.path, {
          action: toolName,
          timestamp: item.timestamp,
          status: result?.status || "unknown",
        });
      }

      return item;
    },

    /**
     * Record a thinking/reasoning step.
     */
    recordThinking(text, iteration) {
      const item = {
        type: "thinking",
        iteration,
        timestamp: new Date().toISOString(),
        summary: text ? text.slice(0, 300) : "",
      };
      items.push(item);
      while (items.length > maxPreviewItems) items.shift();
      return item;
    },

    /**
     * Record an error for preview.
     */
    recordError(toolName, error, iteration) {
      const item = {
        type: "error",
        toolName,
        iteration,
        timestamp: new Date().toISOString(),
        summary: typeof error === "string" ? error.slice(0, 200) : (error?.message || "Unknown error"),
      };
      items.push(item);
      while (items.length > maxPreviewItems) items.shift();
      return item;
    },

    /**
     * Get a formatted summary of progress so far.
     */
    getProgressSummary() {
      const toolResults = items.filter(i => i.type === "tool_result");
      const errors = items.filter(i => i.type === "error");
      const thinkings = items.filter(i => i.type === "thinking");

      return {
        totalActions: items.length,
        toolExecutions: toolResults.length,
        errors: errors.length,
        thinkingSteps: thinkings.length,
        filesChanged: Object.fromEntries(fileChanges),
        lastAction: items.length > 0 ? items[items.length - 1] : null,
      };
    },

    /**
     * Get all preview items.
     */
    getItems(filter) {
      if (!filter) return [...items];
      return items.filter(i => i.type === filter);
    },

    /**
     * Get a markdown-formatted progress report.
     */
    formatProgressReport() {
      const summary = this.getProgressSummary();
      let report = `# Progress Report\n\n`;
      report += `- **Total Actions**: ${summary.totalActions}\n`;
      report += `- **Tool Executions**: ${summary.toolExecutions}\n`;
      report += `- **Errors**: ${summary.errors}\n`;
      report += `- **Files Changed**: ${Object.keys(summary.filesChanged).length}\n\n`;

      if (Object.keys(summary.filesChanged).length > 0) {
        report += `## Files Changed\n`;
        for (const [path, info] of Object.entries(summary.filesChanged)) {
          report += `- \`${path}\` (${info.action})\n`;
        }
        report += "\n";
      }

      if (items.length > 0) {
        report += `## Recent Actions\n`;
        for (const item of items.slice(-10)) {
          const icon = item.type === "error" ? "x" : item.type === "thinking" ? "?" : ">";
          report += `${icon} [${item.timestamp}] ${item.summary}\n`;
        }
      }

      return report;
    },

    /**
     * Clear all preview items.
     */
    clear() {
      items.length = 0;
      fileChanges.clear();
    },
  };
}

function _summarizeToolResult(toolName, params, result) {
  switch (toolName) {
    case "file_read":
      return `Read ${params?.path || "file"} (${result?.status || "done"})`;
    case "file_write":
      return `Wrote ${params?.path || "file"} (${result?.status || "done"})`;
    case "file_edit":
      return `Edited ${params?.path || "file"} (${result?.status || "done"})`;
    case "shell_exec":
      return `Executed: ${(params?.command || "").slice(0, 80)} (${result?.status || "done"})`;
    case "web_search":
      return `Searched: ${(params?.query || "").slice(0, 80)}`;
    case "glob":
      return `Glob: ${params?.pattern || "*"} (${result?.files?.length || 0} matches)`;
    case "grep":
      return `Grep: "${(params?.pattern || "").slice(0, 40)}" (${result?.matches?.length || 0} matches)`;
    default:
      return `${toolName}(${JSON.stringify(params || {}).slice(0, 60)}) -> ${result?.status || "done"}`;
  }
}
