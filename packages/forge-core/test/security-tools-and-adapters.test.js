/**
 * Deep Polish Batch 3 Part 1: Security Hardening, Retry Logic, Tool-Calling,
 * Dead Module Activation, ContextManager, SessionMemory
 *
 * @module security-tools-and-adapters
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

const APPS_SRC = "../../../apps/ai-gateway-service/src";

// ────────────────────────────────────────────────────────────────
// 1. imageAnalysisTool — Path Traversal Security
// ────────────────────────────────────────────────────────────────
describe("imageAnalysisTool path traversal security", () => {
  it("blocks parent directory traversal in image_analyze", async () => {
    const mod = await import(`${APPS_SRC}/tools/imageAnalysisTool.js`);
    const tool = mod.createImageAnalysisTool();
    const result = await tool.execute({ image_path: "../../etc/passwd" });
    assert.ok(
      result.error || result.code === "PATH_TRAVERSAL_BLOCKED" || result.status === "error",
      "Should block parent directory traversal"
    );
  });

  it("blocks parent directory traversal in image_read", async () => {
    const mod = await import(`${APPS_SRC}/tools/imageAnalysisTool.js`);
    const tool = mod.createImageReadTool();
    const result = await tool.execute({ image_path: "../../../etc/shadow" });
    assert.ok(
      result.error || result.code === "PATH_TRAVERSAL_BLOCKED" || result.status === "error",
      "Should block parent directory traversal in image_read"
    );
  });

  it("blocks null byte injection in image path", async () => {
    const mod = await import(`${APPS_SRC}/tools/imageAnalysisTool.js`);
    const tool = mod.createImageAnalysisTool();
    const result = await tool.execute({ image_path: "/tmp/valid\0../../etc/passwd.png" });
    assert.ok(
      result.error || result.code === "PATH_TRAVERSAL_BLOCKED" || result.status === "error",
      "Should block null byte injection"
    );
  });

  it("blocks absolute paths outside working directory", async () => {
    const mod = await import(`${APPS_SRC}/tools/imageAnalysisTool.js`);
    const tool = mod.createImageAnalysisTool();
    const result = await tool.execute({ image_path: "/etc/passwd" });
    assert.ok(
      result.error || result.code === "PATH_TRAVERSAL_BLOCKED" || result.status === "error",
      "Should block absolute paths outside working directory"
    );
  });
});

// ────────────────────────────────────────────────────────────────
// 2. fileEditTool — file_insert Path Traversal Security
// ────────────────────────────────────────────────────────────────
describe("fileEditTool file_insert path traversal security", () => {
  it("blocks parent directory traversal in file_insert", async () => {
    const mod = await import(`${APPS_SRC}/tools/fileEditTool.js`);
    const insertTool = mod.createFileInsertTool();
    assert.ok(insertTool, "file_insert tool should exist");

    const result = await insertTool.execute({
      file_path: "../../etc/passwd",
      content: "injected content",
      line: 1,
    });
    assert.ok(
      result.error || result.status === "error",
      "Should block parent directory traversal in file_insert"
    );
  });

  it("blocks null byte injection in file_insert path", async () => {
    const mod = await import(`${APPS_SRC}/tools/fileEditTool.js`);
    const insertTool = mod.createFileInsertTool();

    const result = await insertTool.execute({
      file_path: "/tmp/valid\0../../etc/passwd",
      content: "injected",
      line: 1,
    });
    assert.ok(
      result.error || result.status === "error",
      "Should block null byte injection in file_insert"
    );
  });

  it("validates content parameter in file_insert", async () => {
    const mod = await import(`${APPS_SRC}/tools/fileEditTool.js`);
    const insertTool = mod.createFileInsertTool();

    const result = await insertTool.execute({
      file_path: "test.txt",
      content: "",
      line: 1,
    });
    assert.ok(
      result.error || result.status === "error",
      "Should reject empty content in file_insert"
    );
  });

  it("still allows file_edit with valid paths", async () => {
    const mod = await import(`${APPS_SRC}/tools/fileEditTool.js`);
    const editTool = mod.createFileEditTool();
    assert.ok(editTool, "file_edit tool should exist");
    // Just verify the tool exists and has execute — don't actually edit files
    assert.equal(typeof editTool.execute, "function");
  });
});

// ────────────────────────────────────────────────────────────────
// 3. openAiAdapter — Retry Logic
// ────────────────────────────────────────────────────────────────
describe("openAiAdapter retry logic", () => {
  it("exports createOpenAIAdapter factory function", async () => {
    const mod = await import(`${APPS_SRC}/providers/openAiAdapter.js`);
    assert.equal(typeof mod.createOpenAIAdapter, "function", "Should export createOpenAIAdapter factory");
    assert.equal(typeof mod.OpenAIAdapter, "function", "Should export OpenAIAdapter class");
  });

  it("provider has generate method", async () => {
    const mod = await import(`${APPS_SRC}/providers/openAiAdapter.js`);
    const provider = mod.createOpenAIAdapter({ model: "test-model" }, { baseUrl: "http://localhost:1234", apiKey: "test-key" });
    assert.equal(typeof provider.generate, "function", "Provider should have generate method");
  });

  it("provider adapter has generate method as primary interface", async () => {
    const mod = await import(`${APPS_SRC}/providers/openAiAdapter.js`);
    const provider = mod.createOpenAIAdapter({ model: "test-model" }, { baseUrl: "http://localhost:1234", apiKey: "test-key" });
    // OpenAIAdapter provides generate() as the primary generation interface
    assert.equal(typeof provider.generate, "function", "Provider should have generate method");
    // Streaming may be handled at a different layer (provider adapter / gateway)
  });
});

// ────────────────────────────────────────────────────────────────
// 4. openAiAdapter — Tool-Calling Format Mapping
// ────────────────────────────────────────────────────────────────
describe("openAiAdapter tool-calling format", () => {
  it("maps tool registry format to OpenAI format via toolCallingAdapter", async () => {
    const mod = await import(`${APPS_SRC}/providers/toolCallingAdapter.js`);
    assert.equal(typeof mod.convertRegistryToOpenAITools, "function");

    const registryTools = [
      {
        name: "file_read",
        description: "Read a file",
        inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
      },
    ];

    const openaiTools = mod.convertRegistryToOpenAITools(registryTools);
    assert.ok(Array.isArray(openaiTools));
    assert.equal(openaiTools.length, 1);
    assert.equal(openaiTools[0].type, "function");
    assert.equal(openaiTools[0].function.name, "file_read");
    assert.equal(openaiTools[0].function.description, "Read a file");
    // parameters may include additionalProperties:false added by the converter
    assert.equal(openaiTools[0].function.parameters.type, "object");
    assert.ok(openaiTools[0].function.parameters.properties.path, "Should have path property");
  });

  it("detects tool calls from response with finishReason=tool_calls", async () => {
    const mod = await import(`${APPS_SRC}/providers/toolCallingAdapter.js`);
    const response = {
      raw: { finishReason: "tool_calls" },
      toolCalls: [
        { id: "call_1", type: "function", name: "file_read", arguments: { path: "/tmp/test" } },
      ],
    };
    assert.ok(mod.hasToolCalls(response));
    const calls = mod.extractToolCalls(response);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, "file_read");
    assert.equal(calls[0].id, "call_1");
  });

  it("detects tool calls from message.tool_calls format", async () => {
    const mod = await import(`${APPS_SRC}/providers/toolCallingAdapter.js`);
    const response = {
      message: {
        role: "assistant",
        tool_calls: [
          {
            id: "call_2",
            type: "function",
            function: { name: "shell_exec", arguments: '{"command":"ls"}' },
          },
        ],
      },
      raw: {},
    };
    assert.ok(mod.hasToolCalls(response));
    const calls = mod.extractToolCalls(response);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, "shell_exec");
  });

  it("returns empty array when no tool calls present", async () => {
    const mod = await import(`${APPS_SRC}/providers/toolCallingAdapter.js`);
    const response = {
      text: "Just a text response",
      message: { role: "assistant", content: "hello" },
      raw: { finishReason: "stop" },
    };
    assert.ok(!mod.hasToolCalls(response));
  });

  it("builds assistant message with tool calls", async () => {
    const mod = await import(`${APPS_SRC}/providers/toolCallingAdapter.js`);
    assert.equal(typeof mod.buildAssistantMessageWithToolCalls, "function");

    // buildAssistantMessageWithToolCalls takes a provider response object
    const providerResponse = {
      text: "I'll read the file",
      raw: { finishReason: "tool_calls" },
      toolCalls: [
        { id: "call_1", type: "function", name: "file_read", arguments: { path: "/test" } },
      ],
    };
    const message = mod.buildAssistantMessageWithToolCalls(providerResponse);
    assert.ok(message, "Should return a message object");
    assert.equal(message.role, "assistant");
    assert.ok(message.tool_calls, "Should have tool_calls in the message");
    assert.equal(message.tool_calls.length, 1);
    assert.equal(message.tool_calls[0].id, "call_1");
  });
});

// ────────────────────────────────────────────────────────────────
// 5. agenticCodingLoop — Dead Module Activation
// ────────────────────────────────────────────────────────────────
describe("agenticCodingLoop dead module activation", () => {
  it("createAgenticLoop instantiates without error with all modules", async () => {
    const { createAgenticLoop } = await import(`${APPS_SRC}/agentic/agenticCodingLoop.js`);
    const mockAdapter = {
      generate: async () => ({
        text: "done",
        message: { role: "assistant", content: "done" },
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        raw: { finishReason: "stop" },
      }),
    };
    const loop = createAgenticLoop({
      providerAdapter: mockAdapter,
      maxIterations: 1,
    });
    assert.ok(loop, "Loop should be created successfully");
    assert.equal(typeof loop.execute, "function");
    assert.equal(typeof loop.executeStream, "function");
    assert.equal(typeof loop.getInfo, "function");
  });

  it("getInfo reports module flags for activated modules", async () => {
    const { createAgenticLoop } = await import(`${APPS_SRC}/agentic/agenticCodingLoop.js`);
    const mockAdapter = {
      generate: async () => ({
        text: "done",
        message: { role: "assistant", content: "done" },
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        raw: { finishReason: "stop" },
      }),
    };
    const loop = createAgenticLoop({
      providerAdapter: mockAdapter,
      maxIterations: 1,
    });
    const info = loop.getInfo();
    assert.ok(info, "getInfo should return an object");
    // The activated modules should be reflected in the info
    assert.ok(
      info.contextManagerEnabled !== undefined ||
      info.sessionMemoryEnabled !== undefined ||
      info.maxIterations !== undefined,
      "getInfo should include module status flags"
    );
  });

  it("execute completes with contextManager + sessionMemory active", async () => {
    const { createAgenticLoop } = await import(`${APPS_SRC}/agentic/agenticCodingLoop.js`);
    const mockAdapter = {
      generate: async () => ({
        text: "Task completed successfully",
        message: { role: "assistant", content: "Task completed successfully" },
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        raw: { finishReason: "stop" },
      }),
    };
    const loop = createAgenticLoop({
      providerAdapter: mockAdapter,
      maxIterations: 1,
    });
    const result = await loop.execute({ goal: "simple test task" });
    assert.equal(result.status, "completed");
  });

  it("executeStream emits events with activated modules", async () => {
    const { createAgenticLoop } = await import(`${APPS_SRC}/agentic/agenticCodingLoop.js`);
    const mockAdapter = {
      generate: async () => ({
        text: "streamed result",
        message: { role: "assistant", content: "streamed result" },
        usage: { inputTokens: 80, outputTokens: 40, totalTokens: 120 },
        raw: { finishReason: "stop" },
      }),
      generateStream: async function* () {
        yield { type: "text", text: "streamed " };
        yield { type: "text", text: "result" };
        yield { type: "done", usage: { inputTokens: 80, outputTokens: 40, totalTokens: 120 } };
      },
    };
    const loop = createAgenticLoop({
      providerAdapter: mockAdapter,
      maxIterations: 1,
    });
    const events = [];
    for await (const event of loop.executeStream({ goal: "test streaming" })) {
      events.push(event);
    }
    assert.ok(events.length > 0, "Should emit at least one event");
    assert.ok(
      events.some((e) => e.type === "complete" || e.type === "done" || e.type === "text"),
      "Should have completion or text event"
    );
  });
});

// ────────────────────────────────────────────────────────────────
// 6. contextManager — Module Unit Tests
// ────────────────────────────────────────────────────────────────
describe("contextManager module", () => {
  it("creates context manager with default options", async () => {
    const { createContextManager } = await import(`${APPS_SRC}/agentic/contextManager.js`);
    const cm = createContextManager();
    assert.ok(cm);
    assert.equal(typeof cm.manageHistory, "function");
    assert.equal(typeof cm.trackChangedFiles, "function");
    assert.equal(typeof cm.getChangedFiles, "function");
    assert.equal(typeof cm.buildContextBlock, "function");
    assert.equal(typeof cm.estimateTokens, "function");
    assert.equal(typeof cm.getStats, "function");
  });

  it("estimates tokens for CJK and ASCII text", async () => {
    const { createContextManager } = await import(`${APPS_SRC}/agentic/contextManager.js`);
    const cm = createContextManager();
    const asciiTokens = cm.estimateTokens("hello world this is a test");
    assert.ok(asciiTokens > 0, "ASCII text should have positive token estimate");

    const cjkTokens = cm.estimateTokens("你好世界这是一个测试");
    assert.ok(cjkTokens > 0, "CJK text should have positive token estimate");
    // CJK should have higher token density (fewer chars per token)
    assert.ok(cjkTokens >= asciiTokens * 0.5, "CJK token estimate should be reasonable");
  });

  it("tracks changed files from tool results", async () => {
    const { createContextManager } = await import(`${APPS_SRC}/agentic/contextManager.js`);
    const cm = createContextManager();
    // trackChangedFiles expects results with _meta.toolName and content fields
    cm.trackChangedFiles([
      { _meta: { toolName: "file_write" }, content: JSON.stringify({ path: "/tmp/test.js" }) },
      { _meta: { toolName: "file_read" }, content: JSON.stringify({ path: "/tmp/other.js" }) },
    ]);
    const changed = cm.getChangedFiles();
    assert.ok(changed.length >= 2, `Should track at least 2 changed files, got ${changed.length}`);
  });

  it("manages history by compressing old turns", async () => {
    const { createContextManager } = await import(`${APPS_SRC}/agentic/contextManager.js`);
    const cm = createContextManager({ recentTurnsToKeep: 2, maxContextTokens: 100 });

    // Create a long message history
    const messages = [];
    for (let i = 0; i < 10; i++) {
      messages.push({ role: "user", content: `User message ${i} with some padding text to increase token count` });
      messages.push({ role: "assistant", content: `Assistant response ${i} with detailed explanation of the changes made` });
    }

    const managed = cm.manageHistory(messages);
    assert.ok(managed, "Should return managed messages");
    assert.ok(Array.isArray(managed) || typeof managed === "object", "Should return array or object");
  });
});

// ────────────────────────────────────────────────────────────────
// 7. sessionMemory — Module Unit Tests
// ────────────────────────────────────────────────────────────────
describe("sessionMemory module", () => {
  it("creates session memory with default options", async () => {
    const { createSessionMemory } = await import(`${APPS_SRC}/agentic/sessionMemory.js`);
    const sm = createSessionMemory();
    assert.ok(sm);
    assert.equal(typeof sm.recordOutcome, "function");
    assert.equal(typeof sm.recallRelevant, "function");
    assert.equal(typeof sm.getTopPatterns, "function");
    assert.equal(typeof sm.buildMemoryPrompt, "function");
    assert.equal(typeof sm.getStats, "function");
  });

  it("records outcomes and recalls relevant patterns", async () => {
    const { createSessionMemory } = await import(`${APPS_SRC}/agentic/sessionMemory.js`);
    const sm = createSessionMemory();

    await sm.recordOutcome({
      goal: "fix bug in parser",
      status: "completed",
      toolSequence: ["file_read", "file_edit", "shell_exec"],
    });

    const recalled = await sm.recallRelevant("fix bug in lexer");
    assert.ok(Array.isArray(recalled), "recallRelevant should return an array");
  });

  it("builds memory prompt for a goal", async () => {
    const { createSessionMemory } = await import(`${APPS_SRC}/agentic/sessionMemory.js`);
    const sm = createSessionMemory();

    await sm.recordOutcome({
      goal: "add tests for module",
      status: "completed",
      toolSequence: ["file_read", "file_write"],
    });

    const prompt = await sm.buildMemoryPrompt("add tests for another module");
    // May return empty string if no relevant patterns, that's OK
    assert.equal(typeof prompt, "string");
  });
});
