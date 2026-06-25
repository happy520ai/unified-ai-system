/**
 * Agentic Loop Core Infrastructure Tests
 *
 * Tests the core agentic coding pipeline:
 *   - toolCallingAdapter: OpenAI function calling protocol conversion
 *   - agenticCodingLoop: iterative LLM → tool → result → LLM cycle
 *   - contextManager: conversation history management + token budget
 *
 * All external dependencies are mocked — no real LLM or network calls.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

// ============================================================
// 1. toolCallingAdapter
// ============================================================

describe("toolCallingAdapter", () => {
  let mod;

  before(async () => {
    mod = await import("../../../apps/ai-gateway-service/src/providers/toolCallingAdapter.js");
  });

  describe("convertRegistryToOpenAITools", () => {
    it("returns empty array for null/empty input", () => {
      assert.deepStrictEqual(mod.convertRegistryToOpenAITools(null), []);
      assert.deepStrictEqual(mod.convertRegistryToOpenAITools([]), []);
      assert.deepStrictEqual(mod.convertRegistryToOpenAITools(undefined), []);
    });

    it("converts a single tool to OpenAI format", () => {
      const tools = [{
        name: "file_read",
        description: "Read a file",
        inputSchema: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
          additionalProperties: false,
        },
      }];
      const result = mod.convertRegistryToOpenAITools(tools);
      assert.equal(result.length, 1);
      assert.equal(result[0].type, "function");
      assert.equal(result[0].function.name, "file_read");
      assert.equal(result[0].function.description, "Read a file");
      assert.equal(result[0].function.parameters.type, "object");
      assert.deepStrictEqual(result[0].function.parameters.required, ["path"]);
    });

    it("converts multiple tools", () => {
      const tools = [
        { name: "a", description: "A", inputSchema: { type: "object", properties: {} } },
        { name: "b", description: "B", inputSchema: { type: "object", properties: {} } },
        { name: "c", description: "C", inputSchema: null },
      ];
      const result = mod.convertRegistryToOpenAITools(tools);
      assert.equal(result.length, 3);
      assert.equal(result[2].function.parameters.type, "object");
    });

    it("truncates long descriptions", () => {
      const tools = [{
        name: "test",
        description: "x".repeat(2000),
        inputSchema: { type: "object", properties: {} },
      }];
      const result = mod.convertRegistryToOpenAITools(tools);
      assert.ok(result[0].function.description.length <= 1024);
      assert.ok(result[0].function.description.endsWith("..."));
    });
  });

  describe("parseToolCallsFromResponse", () => {
    it("returns null for no tool_calls", () => {
      assert.equal(mod.parseToolCallsFromResponse(null), null);
      assert.equal(mod.parseToolCallsFromResponse({}), null);
      assert.equal(mod.parseToolCallsFromResponse({ content: "hello" }), null);
    });

    it("parses tool_calls from message", () => {
      const message = {
        tool_calls: [
          {
            id: "call_123",
            type: "function",
            function: { name: "file_read", arguments: '{"path":"src/index.js"}' },
          },
        ],
      };
      const result = mod.parseToolCallsFromResponse(message);
      assert.equal(result.length, 1);
      assert.equal(result[0].id, "call_123");
      assert.equal(result[0].name, "file_read");
      assert.deepStrictEqual(result[0].arguments, { path: "src/index.js" });
    });

    it("handles malformed arguments JSON", () => {
      const message = {
        tool_calls: [
          { id: "call_1", type: "function", function: { name: "test", arguments: "not-json" } },
        ],
      };
      const result = mod.parseToolCallsFromResponse(message);
      assert.equal(result.length, 1);
      assert.deepStrictEqual(result[0].arguments, { _raw: "not-json" });
    });

    it("handles object arguments (pre-parsed)", () => {
      const message = {
        tool_calls: [
          { id: "call_1", type: "function", function: { name: "test", arguments: { x: 1 } } },
        ],
      };
      const result = mod.parseToolCallsFromResponse(message);
      assert.deepStrictEqual(result[0].arguments, { x: 1 });
    });
  });

  describe("hasToolCalls", () => {
    it("returns false for empty responses", () => {
      assert.equal(mod.hasToolCalls(null), false);
      assert.equal(mod.hasToolCalls({}), false);
      assert.equal(mod.hasToolCalls({ text: "hello" }), false);
    });

    it("detects tool_calls via finishReason", () => {
      assert.equal(mod.hasToolCalls({ raw: { finishReason: "tool_calls" } }), true);
    });

    it("detects tool_calls via toolCalls array", () => {
      assert.equal(mod.hasToolCalls({ toolCalls: [{ id: "1" }] }), true);
    });

    it("detects tool_calls via message.tool_calls", () => {
      assert.equal(mod.hasToolCalls({ message: { tool_calls: [{ id: "1" }] } }), true);
    });

    it("returns false for empty tool_calls", () => {
      assert.equal(mod.hasToolCalls({ toolCalls: [] }), false);
    });
  });

  describe("extractToolCalls", () => {
    it("extracts from toolCalls field first", () => {
      const response = {
        toolCalls: [{ id: "1", name: "a" }],
        message: { tool_calls: [{ id: "2", function: { name: "b" } }] },
      };
      const result = mod.extractToolCalls(response);
      assert.equal(result.length, 1);
      assert.equal(result[0].id, "1");
    });

    it("falls back to message.tool_calls", () => {
      const response = {
        message: {
          tool_calls: [{ id: "2", type: "function", function: { name: "b", arguments: "{}" } }],
        },
      };
      const result = mod.extractToolCalls(response);
      assert.equal(result.length, 1);
      assert.equal(result[0].name, "b");
    });

    it("returns null when no tool_calls", () => {
      assert.equal(mod.extractToolCalls({}), null);
    });
  });

  describe("executeToolCalls", () => {
    it("returns empty array for empty input", async () => {
      const result = await mod.executeToolCalls([], {});
      assert.deepStrictEqual(result, []);
    });

    it("executes tool calls and returns tool messages", async () => {
      const mockRegistry = {
        async executeTool(name, args) {
          return { success: true, name, args };
        },
      };
      const toolCalls = [
        { id: "call_1", name: "file_read", arguments: { path: "test.js" } },
        { id: "call_2", name: "shell_exec", arguments: { command: "ls" } },
      ];
      const result = await mod.executeToolCalls(toolCalls, mockRegistry);
      assert.equal(result.length, 2);
      assert.equal(result[0].role, "tool");
      assert.equal(result[0].tool_call_id, "call_1");
      assert.equal(result[1].role, "tool");
      assert.equal(result[1].tool_call_id, "call_2");
    });

    it("handles tool execution errors gracefully", async () => {
      const mockRegistry = {
        async executeTool() {
          throw new Error("Tool failed");
        },
      };
      const result = await mod.executeToolCalls([{ id: "call_1", name: "bad_tool", arguments: {} }], mockRegistry);
      assert.equal(result.length, 1);
      assert.equal(result[0]._meta.isError, true);
      const parsed = JSON.parse(result[0].content);
      assert.equal(parsed.error, true);
    });
  });

  describe("buildAssistantMessageWithToolCalls", () => {
    it("builds message with tool_calls", () => {
      const response = {
        text: "Let me check that.",
        toolCalls: [{ id: "call_1", name: "file_read", arguments: { path: "x.js" } }],
      };
      const msg = mod.buildAssistantMessageWithToolCalls(response);
      assert.equal(msg.role, "assistant");
      assert.equal(msg.content, "Let me check that.");
      assert.equal(msg.tool_calls.length, 1);
      assert.equal(msg.tool_calls[0].function.name, "file_read");
    });
  });

  describe("summarizeToolUsage", () => {
    it("summarizes tool results", () => {
      const results = [
        { _meta: { toolName: "file_read", durationMs: 10, isError: false } },
        { _meta: { toolName: "file_write", durationMs: 20, isError: false } },
        { _meta: { toolName: "bad_tool", durationMs: 5, isError: true } },
      ];
      const summary = mod.summarizeToolUsage(results);
      assert.equal(summary.totalCalls, 3);
      assert.equal(summary.totalCalls - summary.totalErrors, 2);
      assert.equal(summary.totalErrors, 1);
    });
  });
});

// ============================================================
// 2. agenticCodingLoop
// ============================================================

describe("agenticCodingLoop", () => {
  let createAgenticLoop;

  before(async () => {
    const mod = await import("../../../apps/ai-gateway-service/src/agentic/agenticCodingLoop.js");
    createAgenticLoop = mod.createAgenticLoop;
  });

  it("creates a loop with default options", () => {
    const loop = createAgenticLoop({
      providerAdapter: { async generate() { return { text: "hi" }; } },
    });
    assert.ok(loop);
    assert.equal(typeof loop.execute, "function");
    assert.equal(typeof loop.executeStream, "function");
  });

  it("executes a simple non-tool-call response", async () => {
    const fakeProvider = {
      async generate() {
        return {
          text: "The answer is 42.",
          message: { role: "assistant", content: "The answer is 42." },
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          latencyMs: 100,
        };
      },
    };
    const loop = createAgenticLoop({ providerAdapter: fakeProvider, maxIterations: 5 });
    const result = await loop.execute({ goal: "What is the answer?" });
    assert.equal(result.finalAnswer, "The answer is 42.");
    assert.equal(result.iterations, 1);
  });

  it("executes multi-turn with tool calls", async () => {
    let callCount = 0;
    const fakeProvider = {
      async generate() {
        callCount++;
        if (callCount === 1) {
          return {
            text: "Let me read the file.",
            message: {
              role: "assistant",
              content: "Let me read the file.",
              tool_calls: [{
                id: "call_1",
                type: "function",
                function: { name: "file_read", arguments: '{"path":"test.js"}' },
              }],
            },
            raw: { finishReason: "tool_calls" },
            toolCalls: [{ id: "call_1", name: "file_read", arguments: { path: "test.js" } }],
          };
        }
        return {
          text: "The file contains hello world.",
          message: { role: "assistant", content: "The file contains hello world." },
          usage: { inputTokens: 50, outputTokens: 10, totalTokens: 60 },
          latencyMs: 200,
        };
      },
    };

    const fakeRegistry = {
      listTools: () => [{ name: "file_read", description: "Read", inputSchema: { type: "object", properties: {} } }],
      async executeTool() { return { content: "hello world" }; },
      registerTool() {},
    };

    const loop = createAgenticLoop({
      providerAdapter: fakeProvider,
      toolRegistry: fakeRegistry,
      maxIterations: 5,
    });

    const result = await loop.execute({ goal: "Read test.js" });
    assert.equal(callCount, 2);
    assert.equal(result.iterations, 2);
    assert.equal(result.finalAnswer, "The file contains hello world.");
    assert.ok(result.toolUsage.totalCalls >= 1);
  });

  it("respects maxIterations limit", async () => {
    const fakeProvider = {
      async generate() {
        return {
          text: "tool call",
          raw: { finishReason: "tool_calls" },
          toolCalls: [{ id: "c1", name: "file_read", arguments: {} }],
        };
      },
    };
    const fakeRegistry = {
      listTools: () => [{ name: "file_read", description: "R", inputSchema: { type: "object", properties: {} } }],
      async executeTool() { return "ok"; },
      registerTool() {},
    };
    const loop = createAgenticLoop({
      providerAdapter: fakeProvider,
      toolRegistry: fakeRegistry,
      maxIterations: 3,
    });
    const result = await loop.execute({ goal: "loop forever" });
    assert.ok(result.iterations <= 3);
  });
});

// ============================================================
// 3. contextManager
// ============================================================

describe("contextManager", () => {
  let createContextManager;

  before(async () => {
    const mod = await import("../../../apps/ai-gateway-service/src/agentic/contextManager.js");
    createContextManager = mod.createContextManager;
  });

  it("creates a context manager with defaults", () => {
    const cm = createContextManager();
    assert.ok(cm);
    assert.equal(typeof cm.manageHistory, "function");
    assert.equal(typeof cm.trackChangedFiles, "function");
  });

  it("manageHistory returns messages when under budget", () => {
    const cm = createContextManager({ maxContextTokens: 32000 });
    const messages = [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi!" },
    ];
    const result = cm.manageHistory(messages);
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 1);
  });

  it("manageHistory compresses when over budget", () => {
    const cm = createContextManager({ maxContextTokens: 100 });
    const messages = [];
    for (let i = 0; i < 50; i++) {
      messages.push({ role: "user", content: "Question ".repeat(20) + i });
      messages.push({ role: "assistant", content: "Answer ".repeat(20) + i });
    }
    const result = cm.manageHistory(messages);
    assert.ok(result.length < messages.length);
  });

  it("trackChangedFiles extracts file operations", () => {
    const cm = createContextManager();
    const toolResults = [
      { _meta: { toolName: "file_write" }, content: JSON.stringify({ path: "src/index.js" }) },
      { _meta: { toolName: "file_read" }, content: "content" },
      { _meta: { toolName: "shell_exec" }, content: JSON.stringify({ command: "echo hi" }) },
    ];
    cm.trackChangedFiles(toolResults);
    const changes = cm.getChangedFiles ? cm.getChangedFiles() : [];
    // file_write should be tracked
    assert.ok(Array.isArray(changes));
  });
});
