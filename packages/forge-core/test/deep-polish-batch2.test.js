/**
 * Deep Polish Batch 2: Async I/O, Multi-turn Subagent, Dead Modules,
 * LSP Zombie Fix, WebSearch Resilience
 *
 * @module deep-polish-batch2
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const APPS_SRC = "../../../apps/ai-gateway-service/src";

// ────────────────────────────────────────────────────────────────
// 1. Async I/O — grepTool
// ────────────────────────────────────────────────────────────────
describe("grepTool async I/O", () => {
  it("searches files asynchronously and returns matches", async () => {
    const { createGrepTool } = await import(`${APPS_SRC}/tools/grepTool.js`);
    const tmpDir = join(process.cwd(), ".test-tmp-grep-async-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    try {
      writeFileSync(join(tmpDir, "hello.js"), "function hello() { return 42; }\nconst x = hello();");
      writeFileSync(join(tmpDir, "world.js"), "const world = 'earth';\nfunction getWorld() { return world; }");

      const tool = createGrepTool();
      const result = await tool.execute({ pattern: "function", path: tmpDir });
      assert.equal(result.status, "success");
      assert.ok(result.matchCount >= 2, "Should find at least 2 function declarations");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns empty matches for non-matching pattern", async () => {
    const { createGrepTool } = await import(`${APPS_SRC}/tools/grepTool.js`);
    const tmpDir = join(process.cwd(), ".test-tmp-grep-empty-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    try {
      writeFileSync(join(tmpDir, "test.txt"), "hello world");
      const tool = createGrepTool();
      const result = await tool.execute({ pattern: "zzzznotfound", path: tmpDir });
      assert.equal(result.status, "success");
      assert.equal(result.matchCount, 0);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("handles file_filter correctly", async () => {
    const { createGrepTool } = await import(`${APPS_SRC}/tools/grepTool.js`);
    const tmpDir = join(process.cwd(), ".test-tmp-grep-filter-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    try {
      writeFileSync(join(tmpDir, "app.js"), "const a = 1;");
      writeFileSync(join(tmpDir, "app.py"), "a = 1");
      const tool = createGrepTool();
      const result = await tool.execute({ pattern: "a", path: tmpDir, file_filter: "*.js" });
      assert.equal(result.status, "success");
      for (const m of result.matches) {
        assert.ok(m.file.endsWith(".js"), "Should only match .js files: " + m.file);
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ────────────────────────────────────────────────────────────────
// 2. Async I/O — globTool
// ────────────────────────────────────────────────────────────────
describe("globTool async I/O", () => {
  it("finds files by glob pattern asynchronously", async () => {
    const { createGlobTool } = await import(`${APPS_SRC}/tools/globTool.js`);
    const tmpDir = join(process.cwd(), ".test-tmp-glob-async-" + Date.now());
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    try {
      writeFileSync(join(tmpDir, "src", "index.js"), "// index");
      writeFileSync(join(tmpDir, "src", "util.js"), "// util");
      writeFileSync(join(tmpDir, "README.md"), "# readme");

      const tool = createGlobTool();
      const result = await tool.execute({ pattern: "**/*.js", path: tmpDir });
      assert.equal(result.status, "success");
      assert.ok(result.matchCount >= 2, "Should find at least 2 .js files");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns empty for non-matching pattern", async () => {
    const { createGlobTool } = await import(`${APPS_SRC}/tools/globTool.js`);
    const tmpDir = join(process.cwd(), ".test-tmp-glob-nomatch-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    try {
      writeFileSync(join(tmpDir, "hello.txt"), "hi");
      const tool = createGlobTool();
      const result = await tool.execute({ pattern: "**/*.rs", path: tmpDir });
      assert.equal(result.status, "success");
      assert.equal(result.matchCount, 0);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ────────────────────────────────────────────────────────────────
// 3. Async I/O — autoContext
// ────────────────────────────────────────────────────────────────
describe("autoContext async I/O", () => {
  it("selects context files asynchronously", async () => {
    const { createAutoContext } = await import(`${APPS_SRC}/agentic/autoContext.js`);
    const tmpDir = join(tmpdir(), "autoctx-async-" + Date.now());
    mkdirSync(join(tmpDir, "src"), { recursive: true });
    try {
      writeFileSync(join(tmpDir, "package.json"), '{"name": "test"}');
      writeFileSync(join(tmpDir, "src", "auth.js"), "// auth module");
      writeFileSync(join(tmpDir, "src", "db.js"), "// database module");

      const ctx = createAutoContext({ workingDirectory: tmpDir, maxFiles: 5 });
      const result = await ctx.selectContext("implement authentication");
      assert.ok(result.totalFilesScanned > 0, "Should scan some files");
      assert.ok(Array.isArray(result.selectedFiles), "Should return selected files array");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("builds context prompt asynchronously", async () => {
    const { createAutoContext } = await import(`${APPS_SRC}/agentic/autoContext.js`);
    const tmpDir = join(tmpdir(), "autoctx-prompt-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    try {
      writeFileSync(join(tmpDir, "index.js"), "// entry point");
      const ctx = createAutoContext({ workingDirectory: tmpDir, maxFiles: 3 });
      const prompt = await ctx.buildContextPrompt("add new feature");
      assert.ok(typeof prompt === "string", "Should return a string prompt");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ────────────────────────────────────────────────────────────────
// 4. Multi-turn Subagent Dispatch
// ────────────────────────────────────────────────────────────────
describe("subagentDispatch multi-turn", () => {
  it("executes single-turn when no tool calls", async () => {
    const { createSubagentDispatch } = await import(`${APPS_SRC}/agentic/subagentDispatch.js`);
    const mockAdapter = {
      generate: async () => ({
        text: "subtask result",
        message: { role: "assistant", content: "subtask result" },
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        raw: { finishReason: "stop" },
      }),
    };
    const dispatch = createSubagentDispatch({ providerAdapter: mockAdapter });
    const result = await dispatch.dispatchAll([{ description: "simple task" }]);
    assert.equal(result.status, "all_completed");
    assert.equal(result.completed, 1);
    assert.equal(result.results[0].result, "subtask result");
  });

  it("handles multi-turn with tool calls", async () => {
    const { createSubagentDispatch } = await import(`${APPS_SRC}/agentic/subagentDispatch.js`);
    let callCount = 0;
    const mockAdapter = {
      generate: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            text: null,
            message: {
              role: "assistant", content: null,
              tool_calls: [{ id: "tc1", type: "function", function: { name: "get_time", arguments: "{}" } }],
            },
            toolCalls: [{ id: "tc1", name: "get_time", arguments: {} }],
            raw: { finishReason: "tool_calls" },
            usage: { inputTokens: 100, outputTokens: 30, totalTokens: 130 },
          };
        }
        return {
          text: "The time is 12:00",
          message: { role: "assistant", content: "The time is 12:00" },
          usage: { inputTokens: 150, outputTokens: 20, totalTokens: 170 },
          raw: { finishReason: "stop" },
        };
      },
    };
    const mockRegistry = {
      listTools: () => [{ name: "get_time", execute: async () => ({ time: "12:00" }) }],
      getTool: (name) => name === "get_time" ? { execute: async () => ({ time: "12:00" }) } : null,
    };
    const dispatch = createSubagentDispatch({ providerAdapter: mockAdapter, toolRegistry: mockRegistry });
    const result = await dispatch.dispatchAll([{ description: "what time is it?" }]);
    assert.equal(result.status, "all_completed");
    assert.equal(result.results[0].iterations, 2);
    assert.ok(result.results[0].result.includes("12:00"));
  });

  it("accumulates token usage across iterations", async () => {
    const { createSubagentDispatch } = await import(`${APPS_SRC}/agentic/subagentDispatch.js`);
    let callCount = 0;
    const mockAdapter = {
      generate: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            text: null,
            message: { role: "assistant", tool_calls: [{ id: "tc1", type: "function", function: { name: "x", arguments: "{}" } }] },
            toolCalls: [{ id: "tc1", name: "x", arguments: {} }],
            raw: { finishReason: "tool_calls" },
            usage: { inputTokens: 100, outputTokens: 30, totalTokens: 130 },
          };
        }
        return {
          text: "done",
          message: { role: "assistant", content: "done" },
          usage: { inputTokens: 200, outputTokens: 20, totalTokens: 220 },
          raw: { finishReason: "stop" },
        };
      },
    };
    const mockRegistry = {
      listTools: () => [{ name: "x", execute: async () => ({ ok: true }) }],
      getTool: (name) => name === "x" ? { execute: async () => ({ ok: true }) } : null,
    };
    const dispatch = createSubagentDispatch({ providerAdapter: mockAdapter, toolRegistry: mockRegistry });
    const result = await dispatch.dispatchAll([{ description: "test" }]);
    assert.equal(result.results[0].usage.totalTokens, 350, "Should accumulate tokens");
  });

  it("respects iteration limit", async () => {
    const { createSubagentDispatch } = await import(`${APPS_SRC}/agentic/subagentDispatch.js`);
    const mockAdapter = {
      generate: async () => ({
        text: null,
        message: { role: "assistant", tool_calls: [{ id: "tc1", type: "function", function: { name: "loop", arguments: "{}" } }] },
        toolCalls: [{ id: "tc1", name: "loop", arguments: {} }],
        raw: { finishReason: "tool_calls" },
        usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 },
      }),
    };
    const mockRegistry = {
      listTools: () => [{ name: "loop", execute: async () => ({ ok: true }) }],
      getTool: (name) => name === "loop" ? { execute: async () => ({ ok: true }) } : null,
    };
    const dispatch = createSubagentDispatch({ providerAdapter: mockAdapter, toolRegistry: mockRegistry });
    const result = await dispatch.dispatchAll([{ description: "infinite loop test" }]);
    assert.equal(result.status, "all_completed");
    assert.ok(result.results[0].iterations <= 10, "Should not exceed MAX_SUBTASK_ITERATIONS");
    assert.ok(result.results[0].result.includes("iteration limit"));
  });
});

// ────────────────────────────────────────────────────────────────
// 5. Prompt Optimizer
// ────────────────────────────────────────────────────────────────
describe("promptOptimizer", () => {
  it("detects refactoring task type", async () => {
    const { createPromptOptimizer } = await import(`${APPS_SRC}/agentic/promptOptimizer.js`);
    const opt = createPromptOptimizer();
    const r = opt.detectTaskType("refactor the authentication module");
    assert.equal(r.type, "refactoring");
    assert.ok(r.confidence > 0);
  });

  it("detects debugging task type", async () => {
    const { createPromptOptimizer } = await import(`${APPS_SRC}/agentic/promptOptimizer.js`);
    const opt = createPromptOptimizer();
    const r = opt.detectTaskType("fix the bug in the login page");
    assert.equal(r.type, "debugging");
  });

  it("detects testing task type", async () => {
    const { createPromptOptimizer } = await import(`${APPS_SRC}/agentic/promptOptimizer.js`);
    const opt = createPromptOptimizer();
    const r = opt.detectTaskType("write unit tests for the parser");
    assert.equal(r.type, "testing");
  });

  it("detects feature task type", async () => {
    const { createPromptOptimizer } = await import(`${APPS_SRC}/agentic/promptOptimizer.js`);
    const opt = createPromptOptimizer();
    const r = opt.detectTaskType("implement a new caching feature");
    assert.equal(r.type, "feature");
  });

  it("optimizes prompt with task-specific guidance", async () => {
    const { createPromptOptimizer } = await import(`${APPS_SRC}/agentic/promptOptimizer.js`);
    const opt = createPromptOptimizer();
    const enhanced = opt.optimize("You are a coding assistant.", "refactor this module");
    assert.ok(enhanced.includes("Task-Specific Guidance"));
    assert.ok(enhanced.includes("refactoring"));
  });

  it("returns base prompt for general tasks", async () => {
    const { createPromptOptimizer } = await import(`${APPS_SRC}/agentic/promptOptimizer.js`);
    const opt = createPromptOptimizer();
    const base = "You are a coding assistant.";
    assert.equal(opt.optimize(base, "do something"), base);
  });
});

// ────────────────────────────────────────────────────────────────
// 6. Partial Result Preview
// ────────────────────────────────────────────────────────────────
describe("partialResultPreview", () => {
  it("records tool results and generates summary", async () => {
    const { createPartialResultPreview } = await import(`${APPS_SRC}/agentic/partialResultPreview.js`);
    const p = createPartialResultPreview();
    p.recordToolResult("file_read", { path: "test.js" }, { status: "success" });
    p.recordToolResult("file_write", { path: "output.js" }, { status: "success" });
    p.recordError("shell_exec", "command not found", 1);
    const s = p.getProgressSummary();
    assert.equal(s.toolExecutions, 2);
    assert.equal(s.errors, 1);
    assert.equal(s.totalActions, 3);
  });

  it("formats progress report", async () => {
    const { createPartialResultPreview } = await import(`${APPS_SRC}/agentic/partialResultPreview.js`);
    const p = createPartialResultPreview();
    p.recordToolResult("file_read", { path: "a.js" }, { status: "success" });
    p.recordThinking("Analyzing code", 1);
    const report = p.formatProgressReport();
    assert.ok(report.includes("Progress Report"));
  });

  it("clears state properly", async () => {
    const { createPartialResultPreview } = await import(`${APPS_SRC}/agentic/partialResultPreview.js`);
    const p = createPartialResultPreview();
    p.recordToolResult("test", {}, {});
    assert.equal(p.getItems().length, 1);
    p.clear();
    assert.equal(p.getItems().length, 0);
  });

  it("respects maxPreviewItems", async () => {
    const { createPartialResultPreview } = await import(`${APPS_SRC}/agentic/partialResultPreview.js`);
    const p = createPartialResultPreview({ maxPreviewItems: 3 });
    for (let i = 0; i < 10; i++) p.recordToolResult("t" + i, {}, {});
    assert.equal(p.getItems().length, 3);
  });

  it("tracks file changes", async () => {
    const { createPartialResultPreview } = await import(`${APPS_SRC}/agentic/partialResultPreview.js`);
    const p = createPartialResultPreview();
    p.recordToolResult("file_write", { path: "/src/app.js" }, { status: "success" });
    p.recordToolResult("file_edit", { path: "/src/util.js" }, { status: "success" });
    const s = p.getProgressSummary();
    assert.ok(Object.keys(s.filesChanged).length === 2);
  });
});

// ────────────────────────────────────────────────────────────────
// 7. Web Search — DuckDuckGo Resilience
// ────────────────────────────────────────────────────────────────
describe("webSearchTool DuckDuckGo resilience", () => {
  it("creates tool correctly", async () => {
    const { createWebSearchTool } = await import(`${APPS_SRC}/tools/webSearchTool.js`);
    const tool = createWebSearchTool({ searchProvider: "duckduckgo" });
    assert.equal(tool.name, "web_search");
    assert.ok(typeof tool.execute === "function");
  });

  it("rejects empty query", async () => {
    const { createWebSearchTool } = await import(`${APPS_SRC}/tools/webSearchTool.js`);
    const tool = createWebSearchTool({ searchProvider: "duckduckgo" });
    const result = await tool.execute({ query: "" });
    assert.equal(result.success, false);
  });

  it("rejects missing query", async () => {
    const { createWebSearchTool } = await import(`${APPS_SRC}/tools/webSearchTool.js`);
    const tool = createWebSearchTool({ searchProvider: "duckduckgo" });
    const result = await tool.execute({});
    assert.equal(result.success, false);
  });
});

// ────────────────────────────────────────────────────────────────
// 8. LSP Tool — Process Lifecycle
// ────────────────────────────────────────────────────────────────
describe("lspTool process lifecycle", () => {
  it("creates 4 tool definitions", async () => {
    const { createLspTools } = await import(`${APPS_SRC}/tools/lspTool.js`);
    const lsp = createLspTools({ workingDirectory: process.cwd() });
    assert.equal(lsp.tools.length, 4);
    assert.ok(lsp.tools.some((t) => t.name === "lsp_definition"));
    assert.ok(lsp.tools.some((t) => t.name === "lsp_references"));
    assert.ok(lsp.tools.some((t) => t.name === "lsp_hover"));
    assert.ok(lsp.tools.some((t) => t.name === "lsp_symbols"));
  });

  it("shutdownAll works when no clients exist", async () => {
    const { createLspTools } = await import(`${APPS_SRC}/tools/lspTool.js`);
    const lsp = createLspTools({ workingDirectory: process.cwd() });
    await lsp.shutdownAll();
    assert.equal(lsp.getClientCount(), 0);
  });

  it("returns error for non-existent file", async () => {
    const { createLspTools } = await import(`${APPS_SRC}/tools/lspTool.js`);
    const lsp = createLspTools({ workingDirectory: process.cwd() });
    const defTool = lsp.tools.find((t) => t.name === "lsp_definition");
    const result = await defTool.execute({ filePath: "nonexistent.ts", line: 0, character: 0 });
    assert.ok(result.found === false || result.error);
  });
});

// ────────────────────────────────────────────────────────────────
// 9. Agentic Loop — Dead Module Wiring
// ────────────────────────────────────────────────────────────────
describe("agenticCodingLoop integration", () => {
  it("creates loop with new options", async () => {
    const { createAgenticLoop } = await import(`${APPS_SRC}/agentic/agenticCodingLoop.js`);
    const mockAdapter = {
      generate: async () => ({
        text: "done",
        message: { role: "assistant", content: "done" },
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        raw: { finishReason: "stop" },
      }),
    };
    const loop = createAgenticLoop({
      providerAdapter: mockAdapter,
      promptOptimizeEnabled: true,
      partialPreviewEnabled: true,
      maxIterations: 1,
    });
    const result = await loop.execute({ goal: "fix the bug in the parser" });
    assert.equal(result.status, "completed");
    assert.ok(result.progressSummary, "Should have progress summary from partialPreview");
  });

  it("works with promptOptimizeEnabled=false", async () => {
    const { createAgenticLoop } = await import(`${APPS_SRC}/agentic/agenticCodingLoop.js`);
    const mockAdapter = {
      generate: async () => ({
        text: "done",
        message: { role: "assistant", content: "done" },
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        raw: { finishReason: "stop" },
      }),
    };
    const loop = createAgenticLoop({
      providerAdapter: mockAdapter,
      promptOptimizeEnabled: false,
      partialPreviewEnabled: false,
      maxIterations: 1,
    });
    const result = await loop.execute({ goal: "test task" });
    assert.equal(result.status, "completed");
    assert.equal(result.progressSummary, undefined, "No progress when disabled");
  });
});
