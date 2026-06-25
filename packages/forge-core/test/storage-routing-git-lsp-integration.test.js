/**
 * Deep Polish Batch 3 Part 2: SessionStore, SmartModelRouter,
 * GitTools Injection Prevention, LSP Pool Management,
 * AgentToolRegistry LSP Registration, Cross-Module Integration
 *
 * @module storage-routing-git-lsp-integration
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const APPS_SRC = "../../../apps/ai-gateway-service/src";

// ────────────────────────────────────────────────────────────────
// 8. sessionStore — Module Unit Tests
// ────────────────────────────────────────────────────────────────
describe("sessionStore module", () => {
  it("creates session store with default options", async () => {
    const { createSessionStore } = await import(`${APPS_SRC}/agentic/sessionStore.js`);
    const ss = createSessionStore();
    assert.ok(ss);
    assert.equal(typeof ss.save, "function");
    assert.equal(typeof ss.load, "function");
    assert.equal(typeof ss.remove, "function");
    assert.equal(typeof ss.list, "function");
    assert.equal(typeof ss.getLatest, "function");
  });

  it("saves and loads session data", async () => {
    const { createSessionStore } = await import(`${APPS_SRC}/agentic/sessionStore.js`);
    const tmpDir = join(tmpdir(), "session-store-test-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    try {
      const ss = createSessionStore({ storeDir: tmpDir });
      const testData = { goal: "test goal", status: "completed", iterations: 3 };
      await ss.save("test-session-1", testData);

      const loaded = await ss.load("test-session-1");
      assert.ok(loaded, "Should load saved session");
      assert.equal(loaded.goal, "test goal");
      assert.equal(loaded.status, "completed");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("lists saved sessions", async () => {
    const { createSessionStore } = await import(`${APPS_SRC}/agentic/sessionStore.js`);
    const tmpDir = join(tmpdir(), "session-list-test-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    try {
      const ss = createSessionStore({ storeDir: tmpDir });
      await ss.save("s1", { goal: "first" });
      await ss.save("s2", { goal: "second" });

      const result = await ss.list();
      // list() returns { sessions: [...] } not a plain array
      const sessions = result?.sessions || result;
      assert.ok(Array.isArray(sessions), "Should return sessions array");
      assert.ok(sessions.length >= 2, `Should list at least 2 sessions, got ${sessions.length}`);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ────────────────────────────────────────────────────────────────
// 9. smartModelRouter — Module Unit Tests
// ────────────────────────────────────────────────────────────────
describe("smartModelRouter module", () => {
  it("exports analyzeComplexity function", async () => {
    const mod = await import(`${APPS_SRC}/agentic/smartModelRouter.js`);
    assert.equal(typeof mod.analyzeComplexity, "function");
  });

  it("analyzes simple task as low complexity", async () => {
    const { analyzeComplexity } = await import(`${APPS_SRC}/agentic/smartModelRouter.js`);
    const result = analyzeComplexity("fix typo in readme");
    assert.ok(result, "Should return complexity analysis");
    assert.ok(
      result.score < 0.5 || result.tier === "FAST" || result.tier === "STANDARD",
      "Simple task should have low-to-medium complexity"
    );
  });

  it("analyzes complex task as higher complexity", async () => {
    const { analyzeComplexity } = await import(`${APPS_SRC}/agentic/smartModelRouter.js`);
    const complexGoal = "Refactor the entire authentication system to use OAuth2 with PKCE flow, " +
      "update all 15 API endpoints, migrate the database schema, write integration tests for all " +
      "edge cases, and update the documentation across 8 modules";
    const result = analyzeComplexity(complexGoal);
    assert.ok(result, "Should return complexity analysis");
    assert.ok(
      result.score > 0.3 || result.tier === "STANDARD" || result.tier === "POWER",
      "Complex task should have medium-to-high complexity"
    );
  });

  it("exports recommendModel function", async () => {
    const mod = await import(`${APPS_SRC}/agentic/smartModelRouter.js`);
    assert.equal(typeof mod.recommendModel, "function");
    const recommendation = mod.recommendModel("fix a simple bug");
    assert.ok(recommendation, "Should return a model recommendation");
  });

  it("exports inferModelTier function", async () => {
    const mod = await import(`${APPS_SRC}/agentic/smartModelRouter.js`);
    assert.equal(typeof mod.inferModelTier, "function");
  });

  it("exports TIERS constant", async () => {
    const mod = await import(`${APPS_SRC}/agentic/smartModelRouter.js`);
    assert.ok(mod.TIERS, "Should export TIERS");
    assert.ok(Object.keys(mod.TIERS).length >= 3, "Should have at least 3 tiers");
  });
});

// ────────────────────────────────────────────────────────────────
// 10. gitTools — Commit Message Injection Prevention
// ────────────────────────────────────────────────────────────────
describe("gitTools commit message safety", () => {
  it("parseCliArgs handles basic tokenization", async () => {
    const { parseCliArgs } = await import(`${APPS_SRC}/tools/gitTools.js`);
    const args = parseCliArgs('commit -m "fix the bug"');
    assert.deepEqual(args, ["commit", "-m", "fix the bug"]);
  });

  it("parseCliArgs handles single quotes", async () => {
    const { parseCliArgs } = await import(`${APPS_SRC}/tools/gitTools.js`);
    const args = parseCliArgs("log --author='Alice'");
    assert.deepEqual(args, ["log", "--author=Alice"]);
  });

  it("parseCliArgs handles empty input", async () => {
    const { parseCliArgs } = await import(`${APPS_SRC}/tools/gitTools.js`);
    assert.deepEqual(parseCliArgs(""), []);
    assert.deepEqual(parseCliArgs("   "), []);
  });

  it("parseCliArgs passes through arrays unchanged", async () => {
    const { parseCliArgs } = await import(`${APPS_SRC}/tools/gitTools.js`);
    const input = ["commit", "-m", "hello world"];
    assert.deepEqual(parseCliArgs(input), input);
  });

  it("parseCliArgs handles mixed quoted and unquoted segments", async () => {
    const { parseCliArgs } = await import(`${APPS_SRC}/tools/gitTools.js`);
    const args = parseCliArgs('status --porcelain -- "path with spaces/file.js"');
    assert.ok(args.includes("status"));
    assert.ok(args.includes("--porcelain"));
  });

  it("createGitTools returns tool array with git_commit", async () => {
    const { createGitTools } = await import(`${APPS_SRC}/tools/gitTools.js`);
    const tools = createGitTools({ workingDirectory: process.cwd() });
    assert.ok(Array.isArray(tools));
    const commitTool = tools.find((t) => t.name === "git_commit");
    assert.ok(commitTool, "Should include git_commit tool");
    assert.equal(typeof commitTool.execute, "function");
  });

  it("git_commit rejects empty message", async () => {
    const { createGitTools } = await import(`${APPS_SRC}/tools/gitTools.js`);
    const tools = createGitTools({ workingDirectory: process.cwd() });
    const commitTool = tools.find((t) => t.name === "git_commit");
    const result = await commitTool.execute({ message: "" });
    assert.ok(
      result.success === false || result.error,
      "Should reject empty commit message"
    );
  });

  it("createGitTools includes git_log with array-based args", async () => {
    const { createGitTools } = await import(`${APPS_SRC}/tools/gitTools.js`);
    const tools = createGitTools({ workingDirectory: process.cwd() });
    const logTool = tools.find((t) => t.name === "git_log");
    assert.ok(logTool, "Should include git_log tool");
    assert.equal(typeof logTool.execute, "function");
  });
});

// ────────────────────────────────────────────────────────────────
// 11. LSP Pool Management
// ────────────────────────────────────────────────────────────────
describe("lspTool pool management", () => {
  it("createLspTools returns object with tools array and management functions", async () => {
    const { createLspTools } = await import(`${APPS_SRC}/tools/lspTool.js`);
    const result = createLspTools({ workingDirectory: process.cwd() });

    // Should return object, not array
    assert.ok(!Array.isArray(result), "createLspTools should return an object, not an array");
    assert.ok(Array.isArray(result.tools), "Should have tools array");
    assert.equal(typeof result.shutdownAll, "function", "Should have shutdownAll function");
    assert.equal(typeof result.getClientCount, "function", "Should have getClientCount function");
    assert.equal(typeof result.getPoolStats, "function", "Should have getPoolStats function");
  });

  it("tools array has 4 LSP tools", async () => {
    const { createLspTools } = await import(`${APPS_SRC}/tools/lspTool.js`);
    const result = createLspTools({ workingDirectory: process.cwd() });
    assert.equal(result.tools.length, 4, "Should have 4 LSP tools");

    const names = result.tools.map((t) => t.name).sort();
    assert.ok(names.includes("lsp_definition"), "Should have lsp_definition");
    assert.ok(names.includes("lsp_references"), "Should have lsp_references");
    assert.ok(names.includes("lsp_hover"), "Should have lsp_hover");
    assert.ok(names.includes("lsp_symbols"), "Should have lsp_symbols");
  });

  it("pool starts empty", async () => {
    const { createLspTools } = await import(`${APPS_SRC}/tools/lspTool.js`);
    const result = createLspTools({ workingDirectory: process.cwd() });
    assert.equal(result.getClientCount(), 0, "Pool should start empty");
    const stats = result.getPoolStats();
    assert.equal(stats.poolSize, 0);
    assert.equal(stats.maxPoolSize, 5, "Default max pool size should be 5");
    assert.equal(stats.idleTimeoutMs, 5 * 60 * 1000, "Default idle timeout should be 5 minutes");
  });

  it("shutdownAll works on empty pool without error", async () => {
    const { createLspTools } = await import(`${APPS_SRC}/tools/lspTool.js`);
    const result = createLspTools({ workingDirectory: process.cwd() });
    const shutdownResult = await result.shutdownAll();
    // Should not throw
    assert.equal(result.getClientCount(), 0, "Pool should remain empty after shutdown");
  });

  it("accepts custom maxPoolSize and idleTimeoutMs options", async () => {
    const { createLspTools } = await import(`${APPS_SRC}/tools/lspTool.js`);
    const result = createLspTools({
      workingDirectory: process.cwd(),
      maxPoolSize: 3,
      idleTimeoutMs: 10000,
    });
    const stats = result.getPoolStats();
    assert.equal(stats.maxPoolSize, 3, "Should use custom maxPoolSize");
    assert.equal(stats.idleTimeoutMs, 10000, "Should use custom idleTimeoutMs");
  });
});

// ────────────────────────────────────────────────────────────────
// 12. agentToolRegistry — LSP Registration Fix
// ────────────────────────────────────────────────────────────────
describe("agentToolRegistry LSP registration", () => {
  it("registers LSP tools from object return type", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const registry = createAgentToolRegistry({ workingDirectory: process.cwd() });
    const allTools = registry.listTools();

    // Check LSP tools are registered
    const lspTools = allTools.filter((t) => t.name.startsWith("lsp_"));
    assert.equal(lspTools.length, 4, "Should register 4 LSP tools");
  });

  it("exposes shutdownLsp on registry", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const registry = createAgentToolRegistry({ workingDirectory: process.cwd() });
    assert.equal(typeof registry.shutdownLsp, "function", "Registry should have shutdownLsp method");

    // Should work without error
    const result = await registry.shutdownLsp();
    assert.ok(result.status, "shutdownLsp should return status");
  });

  it("includes LSP tools in cacheable tools set", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const registry = createAgentToolRegistry({ workingDirectory: process.cwd() });
    const health = registry.getHealth();

    // LSP read tools should be in cacheable list
    assert.ok(health.cacheableTools.includes("lsp_hover"), "lsp_hover should be cacheable");
    assert.ok(health.cacheableTools.includes("lsp_definition"), "lsp_definition should be cacheable");
    assert.ok(health.cacheableTools.includes("lsp_references"), "lsp_references should be cacheable");
    assert.ok(health.cacheableTools.includes("lsp_diagnostics"), "lsp_diagnostics should be cacheable");
  });

  it("LSP tools have correct properties", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const registry = createAgentToolRegistry({ workingDirectory: process.cwd() });

    const hoverTool = registry.getTool("lsp_hover");
    assert.ok(hoverTool, "Should find lsp_hover tool");
    assert.equal(hoverTool.isReadOnly, true, "LSP tools should be read-only");
    assert.ok(hoverTool.inputSchema, "Should have input schema");
    assert.ok(hoverTool.inputSchema.required.includes("filePath"), "Should require filePath");
  });
});

// ────────────────────────────────────────────────────────────────
// 13. Cross-Module Integration
// ────────────────────────────────────────────────────────────────
describe("deep-polish-batch3 cross-module integration", () => {
  it("agenticLoop integrates contextManager + sessionMemory + sessionStore", async () => {
    const { createAgenticLoop } = await import(`${APPS_SRC}/agentic/agenticCodingLoop.js`);
    const tmpDir = join(tmpdir(), "agentic-integration-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    try {
      const mockAdapter = {
        generate: async () => ({
          text: "I've analyzed the codebase and found the issue.",
          message: { role: "assistant", content: "I've analyzed the codebase and found the issue." },
          usage: { inputTokens: 200, outputTokens: 100, totalTokens: 300 },
          raw: { finishReason: "stop" },
        }),
      };
      const loop = createAgenticLoop({
        providerAdapter: mockAdapter,
        workingDirectory: tmpDir,
        maxIterations: 1,
        memoryDir: join(tmpDir, ".agent-memory"),
        sessionStoreDir: join(tmpDir, ".agent-sessions"),
      });

      const result = await loop.execute({ goal: "analyze the project structure" });
      assert.equal(result.status, "completed");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("tool registry creates full tool set including git + LSP", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const registry = createAgentToolRegistry({ workingDirectory: process.cwd() });
    const health = registry.getHealth();

    // Should have built-in tools + git + LSP
    assert.ok(health.registeredTools > 10, `Should have many tools registered, got ${health.registeredTools}`);
    assert.ok(health.builtInTools > 0, "Should have built-in tools");
  });

  it("all security fixes maintain backward compatibility", async () => {
    // Verify imageAnalysisTool still works for valid paths
    const imgMod = await import(`${APPS_SRC}/tools/imageAnalysisTool.js`);
    const imgTool = imgMod.createImageAnalysisTool();
    assert.equal(typeof imgTool.execute, "function");

    // Verify fileEditTool still works
    const editMod = await import(`${APPS_SRC}/tools/fileEditTool.js`);
    const editTool = editMod.createFileEditTool();
    const insertTool = editMod.createFileInsertTool();
    assert.ok(editTool, "Should have file_edit tool");
    assert.ok(insertTool, "Should have file_insert tool");

    // Verify gitTools still works
    const gitMod = await import(`${APPS_SRC}/tools/gitTools.js`);
    const gitTools = gitMod.createGitTools({ workingDirectory: process.cwd() });
    assert.ok(gitTools.length >= 6, "Should have at least 6 git tools");
  });
});
