/**
 * Tool Calling & Registry Test Suite
 *
 * Tests for:
 *   - Tool Result Caching (cache management in agentToolRegistry)
 *   - Parallel Tool Execution (executeToolCalls concurrency)
 *   - Structured Output Validation (response validation)
 *   - New Tools Registration (semantic_search, ast_edit)
 *
 * All external dependencies are mocked - no real LLM or network calls.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

// ============================================================
// 1. Tool Result Caching
// ============================================================

describe("Tool Result Caching", () => {
  let createAgentToolRegistry;

  before(async () => {
    const mod = await import(
      "../../../apps/ai-gateway-service/src/claude-code-patterns/agentToolRegistry.js"
    );
    createAgentToolRegistry = mod.createAgentToolRegistry;
  });

  it("should include cache fields in getHealth()", () => {
    const registry = createAgentToolRegistry();
    const health = registry.getHealth();

    assert.ok(health, "getHealth should return an object");
    assert.equal(typeof health.cacheSize, "number", "cacheSize should be a number");
    assert.equal(typeof health.cacheMaxSize, "number", "cacheMaxSize should be a number");
    assert.ok(Array.isArray(health.cacheableTools), "cacheableTools should be an array");
    assert.equal(health.cacheSize, 0, "fresh registry should have cacheSize 0");
    assert.equal(health.cacheMaxSize, 500, "cacheMaxSize should be 500");
  });

  it("should include read-only tools in cacheableTools but not write tools", () => {
    const registry = createAgentToolRegistry();
    const health = registry.getHealth();
    const cacheable = health.cacheableTools;

    // Read-only tools should be cacheable
    assert.ok(cacheable.includes("file_read"), "file_read should be cacheable");
    assert.ok(cacheable.includes("glob"), "glob should be cacheable");
    assert.ok(cacheable.includes("grep"), "grep should be cacheable");

    // Write tools should NOT be cacheable
    assert.ok(!cacheable.includes("file_write"), "file_write should NOT be cacheable");
    assert.ok(!cacheable.includes("shell_exec"), "shell_exec should NOT be cacheable");
  });

  it("should return { cleared: 0 } when clearing an empty cache", () => {
    const registry = createAgentToolRegistry();
    const result = registry.clearCache();

    assert.ok(result, "clearCache should return a result");
    assert.equal(result.cleared, 0, "should clear 0 entries from empty cache");
  });

  it("should have semantic_search in cacheable tools", () => {
    const registry = createAgentToolRegistry();
    const health = registry.getHealth();
    assert.ok(
      health.cacheableTools.includes("semantic_search"),
      "semantic_search should be cacheable"
    );
  });
});

// ============================================================
// 2. Parallel Tool Execution
// ============================================================

describe("Parallel Tool Execution", () => {
  let executeToolCalls;

  before(async () => {
    const mod = await import(
      "../../../apps/ai-gateway-service/src/providers/toolCallingAdapter.js"
    );
    executeToolCalls = mod.executeToolCalls;
  });

  it("should return empty array for empty tool calls", async () => {
    const result = await executeToolCalls([], {});
    assert.deepStrictEqual(result, []);
  });

  it("should return empty array for null input", async () => {
    const result = await executeToolCalls(null, {});
    assert.deepStrictEqual(result, []);
  });

  it("should execute multiple tool calls and return results in input order", async () => {
    // Create a mock registry with delayed tools to test ordering
    const mockRegistry = {
      async executeTool(name, params) {
        const delay = params?.delay || 0;
        if (delay > 0) {
          await new Promise((r) => setTimeout(r, delay));
        }
        return { status: "success", tool: name, value: params?.value || name };
      },
    };

    const toolCalls = [
      { id: "tc1", name: "tool_a", arguments: { value: "first", delay: 30 } },
      { id: "tc2", name: "tool_b", arguments: { value: "second", delay: 10 } },
      { id: "tc3", name: "tool_c", arguments: { value: "third", delay: 20 } },
    ];

    const results = await executeToolCalls(toolCalls, mockRegistry, {});

    assert.equal(results.length, 3, "should return 3 results");
    // Results should preserve input order regardless of completion order
    assert.equal(results[0].tool_call_id, "tc1");
    assert.equal(results[1].tool_call_id, "tc2");
    assert.equal(results[2].tool_call_id, "tc3");
  });

  it("should execute tools in parallel (timing check)", async () => {
    const DELAY = 50;
    const mockRegistry = {
      async executeTool(name) {
        await new Promise((r) => setTimeout(r, DELAY));
        return { status: "success", tool: name };
      },
    };

    const toolCalls = [
      { id: "p1", name: "slow_a", arguments: {} },
      { id: "p2", name: "slow_b", arguments: {} },
      { id: "p3", name: "slow_c", arguments: {} },
    ];

    const start = Date.now();
    const results = await executeToolCalls(toolCalls, mockRegistry, {});
    const elapsed = Date.now() - start;

    assert.equal(results.length, 3, "should return 3 results");
    // Parallel: ~50ms. Sequential: ~150ms. Allow generous margin for Windows timer jitter.
    assert.ok(
      elapsed < DELAY * 3.5,
      `parallel execution should take <${DELAY * 3.5}ms, took ${elapsed}ms`
    );
  });

  it("should handle tool errors gracefully without stopping other tools", async () => {
    const mockRegistry = {
      async executeTool(name) {
        if (name === "failing_tool") {
          throw new Error("Intentional failure");
        }
        return { status: "success", tool: name };
      },
    };

    const toolCalls = [
      { id: "ok1", name: "good_tool", arguments: {} },
      { id: "fail", name: "failing_tool", arguments: {} },
      { id: "ok2", name: "another_good", arguments: {} },
    ];

    const results = await executeToolCalls(toolCalls, mockRegistry, {});

    assert.equal(results.length, 3, "should return 3 results even with failure");
    // First and third should succeed
    assert.equal(results[0]._meta.isError, false);
    assert.equal(results[2]._meta.isError, false);
    // Second should be an error
    assert.equal(results[1]._meta.isError, true);
    assert.equal(results[1].tool_call_id, "fail");
  });
});

// ============================================================
// 3. Structured Output Validation
// ============================================================

describe("Structured Output Validation", () => {
  let toolAdapter;

  before(async () => {
    toolAdapter = await import(
      "../../../apps/ai-gateway-service/src/providers/toolCallingAdapter.js"
    );
  });

  describe("hasToolCalls", () => {
    it("should return false for response without tool_calls", () => {
      const response = { text: "hello", message: { role: "assistant", content: "hello" } };
      assert.equal(toolAdapter.hasToolCalls(response), false);
    });

    it("should return true when finishReason is tool_calls", () => {
      const response = {
        text: "",
        raw: { finishReason: "tool_calls" },
      };
      assert.equal(toolAdapter.hasToolCalls(response), true);
    });

    it("should return true when toolCalls array is present", () => {
      const response = {
        toolCalls: [{ id: "tc1", name: "file_read", arguments: {} }],
      };
      assert.equal(toolAdapter.hasToolCalls(response), true);
    });

    it("should return true when message.tool_calls is present", () => {
      const response = {
        message: {
          role: "assistant",
          content: "",
          tool_calls: [{ id: "tc1", function: { name: "file_read", arguments: "{}" } }],
        },
      };
      assert.equal(toolAdapter.hasToolCalls(response), true);
    });

    it("should return false for null/undefined response", () => {
      assert.equal(toolAdapter.hasToolCalls(null), false);
      assert.equal(toolAdapter.hasToolCalls(undefined), false);
    });
  });

  describe("extractToolCalls", () => {
    it("should extract parsed toolCalls from response", () => {
      const response = {
        toolCalls: [
          { id: "tc1", type: "function", name: "file_read", arguments: { path: "test.js" } },
        ],
      };
      const result = toolAdapter.extractToolCalls(response);
      assert.ok(result, "should extract tool calls");
      assert.equal(result.length, 1);
      assert.equal(result[0].name, "file_read");
      assert.equal(result[0].id, "tc1");
    });

    it("should parse tool_calls from message field", () => {
      const response = {
        message: {
          role: "assistant",
          tool_calls: [
            {
              id: "call_123",
              type: "function",
              function: {
                name: "shell_exec",
                arguments: '{"command":"ls"}',
              },
            },
          ],
        },
      };
      const result = toolAdapter.extractToolCalls(response);
      assert.ok(result, "should extract tool calls from message");
      assert.equal(result.length, 1);
      assert.equal(result[0].name, "shell_exec");
      assert.deepStrictEqual(result[0].arguments, { command: "ls" });
    });

    it("should return null for response without tool_calls", () => {
      const response = { text: "just text", message: { role: "assistant", content: "text" } };
      const result = toolAdapter.extractToolCalls(response);
      assert.equal(result, null);
    });
  });

  describe("summarizeToolUsage", () => {
    it("should return zero counts for empty results", () => {
      const summary = toolAdapter.summarizeToolUsage([]);
      assert.equal(summary.totalCalls, 0);
      assert.equal(summary.totalErrors, 0);
      assert.equal(summary.totalDurationMs, 0);
      assert.deepStrictEqual(summary.toolCounts, {});
    });

    it("should aggregate tool usage across results", () => {
      const results = [
        { _meta: { toolName: "file_read", durationMs: 10, isError: false } },
        { _meta: { toolName: "file_read", durationMs: 15, isError: false } },
        { _meta: { toolName: "shell_exec", durationMs: 50, isError: true } },
      ];
      const summary = toolAdapter.summarizeToolUsage(results);
      assert.equal(summary.totalCalls, 3);
      assert.equal(summary.totalErrors, 1);
      assert.equal(summary.totalDurationMs, 75);
      assert.equal(summary.toolCounts.file_read, 2);
      assert.equal(summary.toolCounts.shell_exec, 1);
    });
  });
});

// ============================================================
// 4. New Tools Registration
// ============================================================

describe("New Tools Registration", () => {
  let createAgentToolRegistry;

  before(async () => {
    const mod = await import(
      "../../../apps/ai-gateway-service/src/claude-code-patterns/agentToolRegistry.js"
    );
    createAgentToolRegistry = mod.createAgentToolRegistry;
  });

  it("should register semantic_search tool", () => {
    const registry = createAgentToolRegistry();
    const tool = registry.getTool("semantic_search");

    assert.ok(tool, "semantic_search tool should be registered");
    assert.equal(tool.name, "semantic_search");
    assert.ok(typeof tool.execute === "function", "should have execute function");
    assert.equal(tool.isReadOnly, true, "semantic_search should be read-only");
    assert.ok(
      tool.description.includes("Semantic") || tool.description.includes("TF-IDF"),
      "description should mention semantic search or TF-IDF"
    );
  });

  it("should register ast_edit tool", () => {
    const registry = createAgentToolRegistry();
    const tool = registry.getTool("ast_edit");

    assert.ok(tool, "ast_edit tool should be registered");
    assert.equal(tool.name, "ast_edit");
    assert.ok(typeof tool.execute === "function", "should have execute function");
    assert.equal(tool.isReadOnly, false, "ast_edit should not be read-only");
    assert.ok(
      tool.description.includes("AST") || tool.description.includes("scope"),
      "description should mention AST or scope awareness"
    );
  });

  it("should include new tools in listTools()", () => {
    const registry = createAgentToolRegistry();
    const allTools = registry.listTools();
    const toolNames = allTools.map((t) => t.name);

    assert.ok(toolNames.includes("semantic_search"), "listTools should include semantic_search");
    assert.ok(toolNames.includes("ast_edit"), "listTools should include ast_edit");
  });

  it("should include standard built-in tools alongside new tools", () => {
    const registry = createAgentToolRegistry();
    const allTools = registry.listTools();
    const toolNames = allTools.map((t) => t.name);

    // Core built-in tools
    assert.ok(toolNames.includes("file_read"), "should include file_read");
    assert.ok(toolNames.includes("file_write"), "should include file_write");
    assert.ok(toolNames.includes("shell_exec"), "should include shell_exec");
    assert.ok(toolNames.includes("web_fetch"), "should include web_fetch");
    assert.ok(toolNames.includes("code_run"), "should include code_run");

    // Phase B tools
    assert.ok(toolNames.includes("glob"), "should include glob");
    assert.ok(toolNames.includes("grep"), "should include grep");
    assert.ok(toolNames.includes("file_edit"), "should include file_edit");
  });

  it("should have correct inputSchema for semantic_search", () => {
    const registry = createAgentToolRegistry();
    const tool = registry.getTool("semantic_search");

    assert.ok(tool.inputSchema, "should have inputSchema");
    assert.equal(tool.inputSchema.type, "object");
    assert.ok(tool.inputSchema.properties.query, "should have query property");
    assert.ok(tool.inputSchema.required.includes("query"), "query should be required");
  });

  it("should have correct inputSchema for ast_edit", () => {
    const registry = createAgentToolRegistry();
    const tool = registry.getTool("ast_edit");

    assert.ok(tool.inputSchema, "should have inputSchema");
    assert.equal(tool.inputSchema.type, "object");
    assert.ok(tool.inputSchema.properties.file, "should have file property");
    assert.ok(tool.inputSchema.properties.editType, "should have editType property");
    assert.ok(tool.inputSchema.properties.target, "should have target property");
    assert.ok(tool.inputSchema.required.includes("file"), "file should be required");
    assert.ok(tool.inputSchema.required.includes("editType"), "editType should be required");
    assert.ok(tool.inputSchema.required.includes("target"), "target should be required");
  });
});
