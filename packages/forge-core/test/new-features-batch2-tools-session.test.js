/**
 * Phase D: New Feature Tests - Tools & Session Management (Batch 2B)
 *
 * Covers:
 * 9. code_format tool
 * 10. generate_test tool
 * 11. type_check tool
 * 12. Session memory (multi-session)
 * 13. Prompt optimizer
 * 14. Session store (persistence)
 * 15. Partial result preview
 *
 * @module new-features-batch2-tools-session
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, existsSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ============================================================
// 9. code_format Tool
// ============================================================
describe("code_format Tool", () => {
  const testDir = join(process.cwd(), ".test-code-format-batch2");

  before(() => {
    mkdirSync(testDir, { recursive: true });
  });

  after(() => {
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  it("should format a JavaScript file with proper indentation", async () => {
    const { createBuiltInTools } = await import("../../../apps/ai-gateway-service/src/claude-code-patterns/agentToolRegistry.js");
    const tools = createBuiltInTools(testDir);

    // Write poorly formatted file
    const testFile = join(testDir, "messy.js");
    writeFileSync(testFile, "function foo(){\nif(true){\nconsole.log('hi');\n}\n}", "utf-8");

    const formatTool = tools.code_format;
    assert.ok(formatTool, "code_format tool should be registered");
    assert.ok(typeof formatTool.call === "function" || typeof formatTool.execute === "function");

    const callFn = formatTool.call || formatTool.execute;
    const result = await callFn.call(formatTool, { path: "messy.js" });
    assert.strictEqual(result.status, "success");

    const formatted = readFileSync(testFile, "utf-8");
    assert.ok(formatted.endsWith("\n"), "Should end with newline");
    assert.ok(formatted.includes("  "), "Should have indentation");
  });
});

// ============================================================
// 10. generate_test Tool
// ============================================================
describe("generate_test Tool", () => {
  const testDir = join(process.cwd(), ".test-generate-test-batch2");

  before(() => {
    mkdirSync(testDir, { recursive: true });
  });

  after(() => {
    try { rmSync(testDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  it("should generate test file for exported functions", async () => {
    const { createBuiltInTools } = await import("../../../apps/ai-gateway-service/src/claude-code-patterns/agentToolRegistry.js");
    const tools = createBuiltInTools(testDir);

    // Write source file with exports
    const sourceFile = join(testDir, "utils.js");
    writeFileSync(sourceFile, `export function add(a, b) { return a + b; }\nexport function multiply(a, b) { return a * b; }\n`, "utf-8");

    const genTool = tools.generate_test;
    assert.ok(genTool, "generate_test tool should be registered");

    const callFn = genTool.call || genTool.execute;
    const result = await callFn.call(genTool, { source_path: "utils.js" });
    assert.strictEqual(result.status, "success");
    assert.ok(result.exportsTested.includes("add"));
    assert.ok(result.exportsTested.includes("multiply"));

    const testFile = join(testDir, "utils.test.js");
    assert.ok(existsSync(testFile), "Test file should be created");

    const content = readFileSync(testFile, "utf-8");
    assert.ok(content.includes('describe("add"'));
    assert.ok(content.includes('describe("multiply"'));
  });

  it("should warn when no exports found", async () => {
    const { createBuiltInTools } = await import("../../../apps/ai-gateway-service/src/claude-code-patterns/agentToolRegistry.js");
    const tools = createBuiltInTools(testDir);

    const sourceFile = join(testDir, "empty.js");
    writeFileSync(sourceFile, `const x = 1;\n`, "utf-8");

    const genTool = tools.generate_test;
    const callFn = genTool.call || genTool.execute;
    const result = await callFn.call(genTool, { source_path: "empty.js" });
    assert.strictEqual(result.status, "warning");
  });
});

// ============================================================
// 11. type_check Tool
// ============================================================
describe("type_check Tool", () => {
  it("should be registered in built-in tools", async () => {
    const { createBuiltInTools } = await import("../../../apps/ai-gateway-service/src/claude-code-patterns/agentToolRegistry.js");
    const tools = createBuiltInTools(process.cwd());
    const tcTool = tools.type_check;
    assert.ok(tcTool, "type_check tool should be registered");
    assert.ok(tcTool.description.includes("TypeScript"));
  });

  it("should have correct input schema", async () => {
    const { createBuiltInTools } = await import("../../../apps/ai-gateway-service/src/claude-code-patterns/agentToolRegistry.js");
    const tools = createBuiltInTools(process.cwd());
    const tcTool = tools.type_check;
    assert.ok(tcTool.inputSchema.properties.path);
    assert.ok(tcTool.inputSchema.properties.tsconfig);
    assert.ok(tcTool.inputSchema.properties.strict);
  });
});

// ============================================================
// 12. Session Memory (Multi-session)
// ============================================================
describe("Session Memory", () => {
  const memDir = join(process.cwd(), ".test-session-memory-batch2");

  after(() => {
    try { rmSync(memDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  it("should record and recall task outcomes", async () => {
    const { createSessionMemory } = await import("../../../apps/ai-gateway-service/src/agentic/sessionMemory.js");
    const memory = createSessionMemory({ memoryDir: memDir });

    await memory.recordOutcome({
      goal: "Fix the login bug in auth module",
      status: "completed",
      toolSequence: ["file_read", "file_edit", "shell_exec"],
      durationMs: 5000,
      iterationCount: 3,
      keyFindings: ["Bug was in token validation"],
    });

    const relevant = await memory.recallRelevant("Fix the logout bug");
    assert.ok(relevant.length > 0);
    assert.ok(relevant[0].goal.includes("login bug"));
  });

  it("should build memory prompt for relevant experiences", async () => {
    const { createSessionMemory } = await import("../../../apps/ai-gateway-service/src/agentic/sessionMemory.js");
    const memory = createSessionMemory({ memoryDir: memDir });

    await memory.recordOutcome({
      goal: "Add unit tests for the payment module",
      status: "completed",
      toolSequence: ["file_read", "file_write"],
      durationMs: 3000,
      iterationCount: 2,
    });

    const prompt = await memory.buildMemoryPrompt("Add tests for the payment system");
    assert.ok(prompt);
    assert.ok(prompt.includes("Session Memory"));
  });

  it("should track patterns and return top patterns", async () => {
    const { createSessionMemory } = await import("../../../apps/ai-gateway-service/src/agentic/sessionMemory.js");
    const memory = createSessionMemory({ memoryDir: memDir });

    await memory.recordOutcome({
      goal: "Fix bug in parser",
      status: "completed",
      toolSequence: ["file_read", "file_edit"],
    });

    const patterns = memory.getTopPatterns(5);
    assert.ok(Array.isArray(patterns));
    assert.ok(patterns.length > 0);
  });

  it("should save and load from disk", async () => {
    const { createSessionMemory } = await import("../../../apps/ai-gateway-service/src/agentic/sessionMemory.js");
    const memory = createSessionMemory({ memoryDir: memDir });

    await memory.recordOutcome({
      goal: "Persist this memory test",
      status: "completed",
      toolSequence: [],
    });
    await memory.save();

    // Create new instance and verify it loads
    const memory2 = createSessionMemory({ memoryDir: memDir });
    const stats = await memory2.getStats();
    assert.ok(stats.totalEntries > 0);
  });

  it("should return null prompt when no relevant memories", async () => {
    const { createSessionMemory } = await import("../../../apps/ai-gateway-service/src/agentic/sessionMemory.js");
    const memory = createSessionMemory({ memoryDir: join(memDir, "empty") });
    const prompt = await memory.buildMemoryPrompt("something completely unique xyz123");
    assert.strictEqual(prompt, null);
  });
});

// ============================================================
// 13. Prompt Optimizer
// ============================================================
describe("Prompt Optimizer", () => {
  it("should detect task types from goal description", async () => {
    const { createPromptOptimizer } = await import("../../../apps/ai-gateway-service/src/agentic/promptOptimizer.js");
    const optimizer = createPromptOptimizer();

    assert.strictEqual(optimizer.detectTaskType("Fix the bug in the login module").type, "debugging");
    assert.strictEqual(optimizer.detectTaskType("Refactor the database layer").type, "refactoring");
    assert.strictEqual(optimizer.detectTaskType("Add unit tests for the API").type, "testing");
    assert.strictEqual(optimizer.detectTaskType("Optimize the rendering performance").type, "performance");
    assert.strictEqual(optimizer.detectTaskType("Write documentation for the SDK").type, "documentation");
  });

  it("should enhance prompt with task-specific guidance", async () => {
    const { createPromptOptimizer } = await import("../../../apps/ai-gateway-service/src/agentic/promptOptimizer.js");
    const optimizer = createPromptOptimizer();

    const basePrompt = "You are a coding assistant.";
    const enhanced = optimizer.optimize(basePrompt, "Fix the crash in the payment handler");
    assert.ok(enhanced.includes("debugging"));
    assert.ok(enhanced.includes("root cause"));
  });

  it("should return base prompt for unrecognized task types", async () => {
    const { createPromptOptimizer } = await import("../../../apps/ai-gateway-service/src/agentic/promptOptimizer.js");
    const optimizer = createPromptOptimizer();

    const basePrompt = "You are a coding assistant.";
    const result = optimizer.optimize(basePrompt, "xyzzy something unknown");
    assert.strictEqual(result, basePrompt);
  });

  it("should list all task types", async () => {
    const { createPromptOptimizer } = await import("../../../apps/ai-gateway-service/src/agentic/promptOptimizer.js");
    const optimizer = createPromptOptimizer();

    const types = optimizer.getTaskTypes();
    assert.ok(types.includes("refactoring"));
    assert.ok(types.includes("debugging"));
    assert.ok(types.includes("testing"));
    assert.ok(types.includes("feature"));
    assert.ok(types.includes("performance"));
    assert.ok(types.includes("documentation"));
  });
});

// ============================================================
// 14. Session Store (Persistence)
// ============================================================
describe("Session Store", () => {
  const storeDir = join(process.cwd(), ".test-session-store-batch2");

  after(() => {
    try { rmSync(storeDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  it("should save and load a session", async () => {
    const { createSessionStore } = await import("../../../apps/ai-gateway-service/src/agentic/sessionStore.js");
    const store = createSessionStore({ storeDir });

    const result = await store.saveSession({
      sessionId: "test-session-1",
      goal: "Build a feature",
      status: "completed",
      messages: [{ role: "user", content: "Hello" }],
      iterations: 3,
    });

    assert.ok(result.saved);

    const loaded = await store.loadSession("test-session-1");
    assert.ok(loaded);
    assert.strictEqual(loaded.goal, "Build a feature");
    assert.strictEqual(loaded.iterations, 3);
  });

  it("should list saved sessions", async () => {
    const { createSessionStore } = await import("../../../apps/ai-gateway-service/src/agentic/sessionStore.js");
    const store = createSessionStore({ storeDir });

    await store.saveSession({ sessionId: "s1", goal: "Task 1", status: "completed", iterations: 1 });
    await store.saveSession({ sessionId: "s2", goal: "Task 2", status: "completed", iterations: 2 });

    const sessions = await store.listSessions();
    assert.ok(sessions.length >= 2);
  });

  it("should export and import sessions", async () => {
    const { createSessionStore } = await import("../../../apps/ai-gateway-service/src/agentic/sessionStore.js");
    const store = createSessionStore({ storeDir });

    await store.saveSession({ sessionId: "export-test", goal: "Export me", status: "completed" });

    const exported = await store.exportSession("export-test");
    assert.ok(exported);
    assert.strictEqual(exported.version, "1.0");

    const importStore = createSessionStore({ storeDir: join(storeDir, "imported") });
    const importResult = await importStore.importSession(exported);
    assert.ok(importResult.saved);
  });

  it("should return null for non-existent session", async () => {
    const { createSessionStore } = await import("../../../apps/ai-gateway-service/src/agentic/sessionStore.js");
    const store = createSessionStore({ storeDir });

    const loaded = await store.loadSession("does-not-exist");
    assert.strictEqual(loaded, null);
  });
});

// ============================================================
// 15. Partial Result Preview
// ============================================================
describe("Partial Result Preview", () => {
  it("should record tool results and generate summary", async () => {
    const { createPartialResultPreview } = await import("../../../apps/ai-gateway-service/src/agentic/partialResultPreview.js");
    const preview = createPartialResultPreview();

    preview.recordToolResult("file_read", { path: "src/index.js" }, { status: "success" });
    preview.recordToolResult("file_write", { path: "src/index.js" }, { status: "success" });
    preview.recordToolResult("shell_exec", { command: "npm test" }, { status: "success" });

    const summary = preview.getProgressSummary();
    assert.strictEqual(summary.toolExecutions, 3);
    assert.ok(summary.filesChanged["src/index.js"]);
  });

  it("should track file changes", async () => {
    const { createPartialResultPreview } = await import("../../../apps/ai-gateway-service/src/agentic/partialResultPreview.js");
    const preview = createPartialResultPreview();

    preview.recordToolResult("file_write", { path: "new-file.js" }, { status: "success" });
    preview.recordToolResult("file_edit", { path: "existing.js" }, { status: "success" });

    const summary = preview.getProgressSummary();
    assert.ok(summary.filesChanged["new-file.js"]);
    assert.strictEqual(summary.filesChanged["new-file.js"].action, "file_write");
    assert.ok(summary.filesChanged["existing.js"]);
    assert.strictEqual(summary.filesChanged["existing.js"].action, "file_edit");
  });

  it("should record errors and thinking steps", async () => {
    const { createPartialResultPreview } = await import("../../../apps/ai-gateway-service/src/agentic/partialResultPreview.js");
    const preview = createPartialResultPreview();

    preview.recordThinking("Analyzing the codebase structure", 1);
    preview.recordError("file_read", "File not found", 2);

    const summary = preview.getProgressSummary();
    assert.strictEqual(summary.thinkingSteps, 1);
    assert.strictEqual(summary.errors, 1);
  });

  it("should format markdown progress report", async () => {
    const { createPartialResultPreview } = await import("../../../apps/ai-gateway-service/src/agentic/partialResultPreview.js");
    const preview = createPartialResultPreview();

    preview.recordToolResult("file_write", { path: "app.js" }, { status: "success" });
    preview.recordToolResult("shell_exec", { command: "npm test" }, { status: "success" });

    const report = preview.formatProgressReport();
    assert.ok(report.includes("Progress Report"));
    assert.ok(report.includes("app.js"));
  });

  it("should clear all preview items", async () => {
    const { createPartialResultPreview } = await import("../../../apps/ai-gateway-service/src/agentic/partialResultPreview.js");
    const preview = createPartialResultPreview();

    preview.recordToolResult("file_read", { path: "x.js" }, { status: "success" });
    assert.strictEqual(preview.getProgressSummary().toolExecutions, 1);

    preview.clear();
    assert.strictEqual(preview.getProgressSummary().toolExecutions, 0);
  });

  it("should filter items by type", async () => {
    const { createPartialResultPreview } = await import("../../../apps/ai-gateway-service/src/agentic/partialResultPreview.js");
    const preview = createPartialResultPreview();

    preview.recordToolResult("file_read", { path: "a.js" }, { status: "success" });
    preview.recordThinking("Thinking about approach", 1);
    preview.recordError("shell_exec", "Command failed", 2);

    const errors = preview.getItems("error");
    assert.strictEqual(errors.length, 1);
    const thinking = preview.getItems("thinking");
    assert.strictEqual(thinking.length, 1);
  });
});
