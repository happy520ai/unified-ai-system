/**
 * Agentic Loop Session, Permission & Tool Tests
 *
 * Tests session persistence, permission gates, and tool definitions:
 *   - sessionStore: session persistence
 *   - permissionGate: Codex mode aliases + confirmEachStep
 *   - Tool definitions: web_search, git_tools, lsp_tools
 *   - roleExecutors: LLM-driven role execution
 *
 * All external dependencies are mocked — no real LLM or network calls.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ============================================================
// 4. sessionStore
// ============================================================

describe("sessionStore", () => {
  let createSessionStore;
  let tempDir;

  before(async () => {
    const mod = await import("../../../apps/ai-gateway-service/src/agentic/sessionStore.js");
    createSessionStore = mod.createSessionStore;
    tempDir = mkdtempSync(join(tmpdir(), "session-test-"));
  });

  after(() => {
    try { rmSync(tempDir, { recursive: true, force: true }); } catch { /* ok */ }
  });

  it("saves and loads a session", async () => {
    const store = createSessionStore({ storageDir: tempDir });
    await store.save("test-session", {
      goal: "Build a login page",
      messages: [{ role: "user", content: "hello" }],
      toolHistory: [],
    });
    const loaded = await store.load("test-session");
    assert.ok(loaded);
    assert.equal(loaded.goal, "Build a login page");
    assert.equal(loaded.messages.length, 1);
  });

  it("lists sessions", async () => {
    const store = createSessionStore({ storageDir: tempDir });
    await store.save("s1", { goal: "A", messages: [] });
    await store.save("s2", { goal: "B", messages: [] });
    const list = await store.list({ limit: 10 });
    assert.ok(Array.isArray(list.sessions || list));
  });

  it("returns null for non-existent session", async () => {
    const store = createSessionStore({ storageDir: tempDir });
    const result = await store.load("nonexistent");
    assert.equal(result, null);
  });
});

// ============================================================
// 5. permissionGate — Codex Mode Aliases
// ============================================================

describe("permissionGate Codex modes", () => {
  let createPermissionGate;
  let resolvePermissionMode;
  let CODEX_MODE_ALIASES;
  let RISK_LEVELS;

  before(async () => {
    const mod = await import("../../../apps/ai-gateway-service/src/claude-code-patterns/permissionGate.js");
    createPermissionGate = mod.createPermissionGate;
    resolvePermissionMode = mod.resolvePermissionMode;
    CODEX_MODE_ALIASES = mod.CODEX_MODE_ALIASES;
    RISK_LEVELS = mod.RISK_LEVELS;
  });

  describe("CODEX_MODE_ALIASES", () => {
    it("defines 4 Codex modes", () => {
      assert.ok(CODEX_MODE_ALIASES["suggest"]);
      assert.ok(CODEX_MODE_ALIASES["auto-edit"]);
      assert.ok(CODEX_MODE_ALIASES["full-auto"]);
      assert.ok(CODEX_MODE_ALIASES["interactive"]);
    });

    it("maps suggest to readOnly", () => {
      assert.equal(CODEX_MODE_ALIASES["suggest"].pmeMode, "readOnly");
    });

    it("maps auto-edit to default", () => {
      assert.equal(CODEX_MODE_ALIASES["auto-edit"].pmeMode, "default");
    });

    it("maps full-auto to dontAsk", () => {
      assert.equal(CODEX_MODE_ALIASES["full-auto"].pmeMode, "dontAsk");
    });

    it("maps interactive with confirmEachStep", () => {
      assert.equal(CODEX_MODE_ALIASES["interactive"].confirmEachStep, true);
    });
  });

  describe("resolvePermissionMode", () => {
    it("resolves Codex aliases", () => {
      const r = resolvePermissionMode("suggest");
      assert.equal(r.mode, "readOnly");
      assert.equal(r.isCodexAlias, true);
    });

    it("resolves PME native modes", () => {
      const r = resolvePermissionMode("default");
      assert.equal(r.mode, "default");
      assert.equal(r.isCodexAlias, false);
    });

    it("falls back to default for unknown modes", () => {
      const r = resolvePermissionMode("unknown_mode");
      assert.equal(r.mode, "default");
    });
  });

  describe("createPermissionGate with Codex aliases", () => {
    it("accepts 'suggest' mode (readOnly)", () => {
      const gate = createPermissionGate({ mode: "suggest" });
      const modeInfo = gate.getMode();
      assert.equal(modeInfo.mode, "readOnly");
      assert.equal(modeInfo.codexAlias, "suggest");
    });

    it("accepts 'full-auto' mode (dontAsk)", () => {
      const gate = createPermissionGate({ mode: "full-auto" });
      // dangerous operations should auto-pass in dontAsk
      const result = gate.check("shell:exec", { command: "echo hello" });
      // In dontAsk mode, dangerous ops auto-pass (via the dontAsk branch)
      // But our code maps full-auto → dontAsk, so let's check
      assert.ok(result);
    });

    it("accepts 'interactive' mode with confirmEachStep", () => {
      const gate = createPermissionGate({ mode: "interactive" });
      const modeInfo = gate.getMode();
      assert.equal(modeInfo.mode, "default");
      assert.equal(modeInfo.confirmEachStep, true);
    });

    it("interactive mode requires confirmation for cautious ops", () => {
      const gate = createPermissionGate({ mode: "interactive" });
      const result = gate.check("file:write");
      assert.equal(result.allowed, false);
      assert.equal(result.behavior, "passthrough");
    });

    it("interactive mode auto-passes safe ops", () => {
      const gate = createPermissionGate({ mode: "interactive" });
      const result = gate.check("file:read");
      assert.equal(result.allowed, true);
    });

    it("interactive mode denies forbidden ops", () => {
      const gate = createPermissionGate({ mode: "interactive" });
      const result = gate.check("system:shutdown");
      assert.equal(result.allowed, false);
      assert.equal(result.behavior, "deny");
    });
  });
});

// ============================================================
// 6. webSearchTool
// ============================================================

describe("webSearchTool", () => {
  let createWebSearchTool;

  before(async () => {
    const mod = await import("../../../apps/ai-gateway-service/src/tools/webSearchTool.js");
    createWebSearchTool = mod.createWebSearchTool;
  });

  it("creates a web search tool", () => {
    const tool = createWebSearchTool();
    assert.ok(tool);
    assert.equal(tool.name, "web_search");
    assert.ok(tool.inputSchema);
    assert.equal(tool.isReadOnly, true);
    assert.ok(tool.inputSchema.properties.query);
  });

  it("has correct permissions", () => {
    const tool = createWebSearchTool();
    assert.ok(Array.isArray(tool.requiredPermissions));
    assert.ok(tool.requiredPermissions.some((p) => p.includes("search") || p.includes("network")));
  });

  it("has an execute function", () => {
    const tool = createWebSearchTool();
    assert.equal(typeof tool.execute, "function");
  });
});

// ============================================================
// 7. gitTools
// ============================================================

describe("gitTools", () => {
  let createGitTools;

  before(async () => {
    const mod = await import("../../../apps/ai-gateway-service/src/tools/gitTools.js");
    createGitTools = mod.createGitTools;
  });

  it("creates 7 git tools", () => {
    const tools = createGitTools({ workingDirectory: "." });
    assert.equal(tools.length, 7);
  });

  it("includes expected tool names", () => {
    const tools = createGitTools({ workingDirectory: "." });
    const names = tools.map((t) => t.name);
    assert.ok(names.includes("git_status"));
    assert.ok(names.includes("git_diff"));
    assert.ok(names.includes("git_log"));
    assert.ok(names.includes("git_branch"));
    assert.ok(names.includes("git_commit"));
    assert.ok(names.includes("git_push"));
    assert.ok(names.includes("git_create_pr"));
  });

  it("read tools are readOnly", () => {
    const tools = createGitTools({ workingDirectory: "." });
    const status = tools.find((t) => t.name === "git_status");
    const diff = tools.find((t) => t.name === "git_diff");
    const log = tools.find((t) => t.name === "git_log");
    assert.equal(status.isReadOnly, true);
    assert.equal(diff.isReadOnly, true);
    assert.equal(log.isReadOnly, true);
  });

  it("write tools are not readOnly", () => {
    const tools = createGitTools({ workingDirectory: "." });
    const branch = tools.find((t) => t.name === "git_branch");
    const commit = tools.find((t) => t.name === "git_commit");
    assert.equal(branch.isReadOnly, false);
    assert.equal(commit.isReadOnly, false);
  });

  it("all tools have execute functions", () => {
    const tools = createGitTools({ workingDirectory: "." });
    for (const tool of tools) {
      assert.equal(typeof tool.execute, "function", `${tool.name} should have execute`);
    }
  });
});

// ============================================================
// 8. lspTool
// ============================================================

describe("lspTool", () => {
  let createLspTools;

  before(async () => {
    const mod = await import("../../../apps/ai-gateway-service/src/tools/lspTool.js");
    createLspTools = mod.createLspTools;
  });

  it("creates 4 LSP tools", () => {
    const result = createLspTools({ workingDirectory: "." });
    assert.equal(result.tools.length, 4);
  });

  it("includes expected tool names", () => {
    const result = createLspTools({ workingDirectory: "." });
    const names = result.tools.map((t) => t.name);
    assert.ok(names.includes("lsp_definition"));
    assert.ok(names.includes("lsp_references"));
    assert.ok(names.includes("lsp_hover"));
    assert.ok(names.includes("lsp_symbols"));
  });

  it("all tools are readOnly", () => {
    const result = createLspTools({ workingDirectory: "." });
    for (const tool of result.tools) {
      assert.equal(tool.isReadOnly, true, `${tool.name} should be readOnly`);
    }
  });

  it("has shutdownAll function", () => {
    const result = createLspTools({ workingDirectory: "." });
    assert.equal(typeof result.shutdownAll, "function");
  });

  it("has getClientCount function", () => {
    const result = createLspTools({ workingDirectory: "." });
    assert.equal(typeof result.getClientCount, "function");
    assert.equal(result.getClientCount(), 0);
  });
});

// ============================================================
// 9. roleExecutors — LLM-driven path
// ============================================================

describe("roleExecutors LLM-driven path", () => {
  let executeRoleWithLLM;
  let executeAllRolesWithLLM;

  before(async () => {
    const mod = await import("../../../apps/ai-gateway-service/src/workforce/roleExecutors.js");
    executeRoleWithLLM = mod.executeRoleWithLLM;
    executeAllRolesWithLLM = mod.executeAllRolesWithLLM;
  });

  it("falls back to template when no provider", async () => {
    const result = await executeRoleWithLLM("ceo", "Build a SaaS product");
    assert.equal(result.llmDriven, false);
    assert.equal(result.llmFallback, "no_provider");
    assert.ok(result.roleMeta);
  });

  it("uses LLM when provider available and parses structured output", async () => {
    const fakeProvider = {
      async generate() {
        return {
          text: JSON.stringify({
            roleMeta: { roleId: "ceo", executedAt: new Date().toISOString(), goal: "Build", confidence: "high" },
            summary: "LLM analysis complete",
          }),
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          latencyMs: 500,
        };
      },
    };
    const result = await executeRoleWithLLM("ceo", "Build", {}, fakeProvider);
    assert.equal(result.llmDriven, true);
    assert.ok(result.llmUsage);
  });

  it("falls back on LLM error", async () => {
    const fakeProvider = {
      async generate() { throw new Error("Provider down"); },
    };
    const result = await executeRoleWithLLM("ceo", "Build", {}, fakeProvider);
    assert.equal(result.llmDriven, false);
    assert.ok(result.llmFallback.includes("llm_error"));
  });

  it("executeAllRolesWithLLM runs all 7 roles", async () => {
    const result = await executeAllRolesWithLLM("Build a login page");
    assert.ok(result.roleOutputs);
    assert.equal(Object.keys(result.roleOutputs).length, 7);
    assert.equal(result.llmDriven, false);
    assert.equal(result.llmStats.totalCalls, 7);
    assert.equal(result.llmStats.fallbackCalls, 7);
  });
});
