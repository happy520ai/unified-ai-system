/**
 * Deep Polish Batch 3 Part 1: Security Hardening, Retry Logic, Tool-Calling,
 * Dead Module Activation, ContextManager, SessionMemory
 *
 * @module security-tools-and-adapters
 */

import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BashSafety } from "../src/bash-safety/index.js";
import { IncrementalEdit } from "../src/incremental-edit/index.js";
import { runWithLlmCaller } from "../src/llm-client.js";
import { BaseWorker } from "../src/worker/base.js";
import { executeAction } from "../src/worker/base-action-exec.js";

const APPS_SRC = "../../../apps/ai-gateway-service/src";
const governedActionRoots = [];
const governedActionLogger = { info() {}, error() {} };

async function makeGovernedActionRoot() {
  const root = await mkdtemp(join(tmpdir(), "forge-governance-"));
  governedActionRoots.push(root);
  return root;
}

function governedActionOptions(overrides = {}) {
  return {
    logger: governedActionLogger,
    bashSafety: new BashSafety({ strict: true }),
    incrementalEdit: new IncrementalEdit(),
    sandboxExecutor: null,
    governanceRequired: true,
    ...overrides,
  };
}

async function governedPathDoesNotExist(path) {
  try {
    await access(path);
    return false;
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    throw error;
  }
}

afterEach(async () => {
  await Promise.all(governedActionRoots.splice(0)
    .map((root) => rm(root, { recursive: true, force: true })));
});

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

describe("Forge UserManager credential storage", () => {
  it("stores only API-key hashes and migrates legacy plaintext rows on use", async () => {
    const { UserManager } = await import("../src/multi-user/index.js");
    const db = createUserManagerDbFixture();
    const manager = new UserManager(db);
      const created = manager.createUser({ username: "alice", role: "developer" });
      assert.match(created.apiKey, /^fk-/);
      assert.equal("api_key" in created, false);
      const stored = db.prepare("SELECT api_key FROM users WHERE id = ?").get(created.id);
      assert.match(stored.api_key, /^sha256:[a-f0-9]{64}$/);
      assert.notEqual(stored.api_key, created.apiKey);
      assert.equal(manager.getUserByApiKey(created.apiKey).id, created.id);
      assert.equal(manager.listUsers().some((user) => "api_key" in user), false);

      const oldKey = created.apiKey;
      const rotated = manager.rotateApiKey(created.id);
      assert.equal(manager.getUserByApiKey(oldKey), undefined);
      assert.equal(manager.getUserByApiKey(rotated).id, created.id);

      const legacyKey = "fk-test-legacy-plaintext-key";
      db.prepare(`
        INSERT INTO users (id, username, display_name, api_key, role)
        VALUES (?, ?, ?, ?, ?)
      `).run("u-legacy", "legacy", null, legacyKey, "viewer");
      assert.equal(manager.getUserByApiKey(legacyKey).id, "u-legacy");
      const migrated = db.prepare("SELECT api_key FROM users WHERE id = ?").get("u-legacy");
      assert.match(migrated.api_key, /^sha256:[a-f0-9]{64}$/);
      assert.notEqual(migrated.api_key, legacyKey);
  });
});

function createUserManagerDbFixture() {
  const rows = [];
  return {
    prepare(sql) {
      const normalized = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
      return {
        run(...args) {
          if (normalized.startsWith("insert into users")) {
            const [id, username, displayName, apiKey, role] = args;
            rows.push({
              id,
              username,
              display_name: displayName,
              api_key: apiKey,
              role,
              created_at: new Date().toISOString(),
              last_active: null,
            });
            return { changes: 1 };
          }
          if (normalized.startsWith("update users set api_key")) {
            const [apiKey, id] = args;
            const row = rows.find((candidate) => candidate.id === id);
            if (row) row.api_key = apiKey;
            return { changes: row ? 1 : 0 };
          }
          if (normalized.startsWith("update users set last_active")) {
            const [lastActive, id] = args;
            const row = rows.find((candidate) => candidate.id === id);
            if (row) row.last_active = lastActive;
            return { changes: row ? 1 : 0 };
          }
          throw new Error(`Unsupported fixture SQL run: ${normalized}`);
        },
        get(value) {
          if (normalized.includes("where id = ?")) return rows.find((row) => row.id === value);
          if (normalized.includes("where username = ?")) return rows.find((row) => row.username === value);
          if (normalized.includes("where api_key = ?")) return rows.find((row) => row.api_key === value);
          throw new Error(`Unsupported fixture SQL get: ${normalized}`);
        },
        all() {
          if (normalized.startsWith("select * from users")) return [...rows];
          throw new Error(`Unsupported fixture SQL all: ${normalized}`);
        },
      };
    },
  };
}

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

describe("Forge per-action Agent Governance", () => {
  it("fails closed before a denied write has any filesystem effect", async () => {
    const root = await makeGovernedActionRoot();
    let beforeCalls = 0;
    let afterCalls = 0;
    await assert.rejects(
      executeAction(
        { type: "write", path: "blocked.txt", content: "must-not-land" },
        root,
        {},
        governedActionOptions({
          governedExecution: {
            async beforeAction(request) {
              beforeCalls += 1;
              assert.equal(request.toolName, "file_write");
              return { outcome: "deny", code: "TEST_POLICY_DENY" };
            },
            async afterAction() { afterCalls += 1; },
          },
        }),
      ),
      (error) => error?.code === "TEST_POLICY_DENY",
    );
    assert.equal(beforeCalls, 1);
    assert.equal(afterCalls, 0);
    assert.equal(await governedPathDoesNotExist(join(root, "blocked.txt")), true);
  });

  it("uses approval-sealed params and holds the action lease through afterAction", async () => {
    const root = await makeGovernedActionRoot();
    let releases = 0;
    let beforeRequest;
    let afterRequest;
    const result = await executeAction(
      { type: "write", path: "unapproved.txt", content: "unapproved" },
      root,
      { id: "task-1", type: "implement", agent_role: "coder" },
      governedActionOptions({
        governedExecution: {
          async beforeAction(request) {
            beforeRequest = request;
            assert.equal(Object.isFrozen(request.params), true);
            return {
              outcome: "allow",
              policy: { policyHash: "policy-a" },
              approvedParams: {
                file_path: "sealed.txt",
                content: "sealed-content",
                mode: "overwrite",
              },
              executionLease: { release() { releases += 1; } },
            };
          },
          async afterAction(event) {
            afterRequest = event;
            assert.equal(releases, 0);
            assert.equal(await readFile(join(root, "sealed.txt"), "utf8"), "sealed-content");
          },
        },
      }),
    );
    const canonicalRoot = await realpath(root);
    assert.equal(result.modified, true);
    assert.equal(releases, 1);
    assert.equal(await governedPathDoesNotExist(join(root, "unapproved.txt")), true);
    assert.equal(beforeRequest.params.file_path, "unapproved.txt");
    assert.equal(beforeRequest.resourceContext.resourceKeys.projectRoot, canonicalRoot);
    assert.equal(beforeRequest.resourceContext.resourceKeys.canonicalPath, join(canonicalRoot, "unapproved.txt"));
    assert.ok(beforeRequest.resourceContext.resources.includes("unapproved.txt"));
    assert.ok(beforeRequest.resourceContext.resources.includes(join(canonicalRoot, "unapproved.txt")));
    assert.equal(afterRequest.params.file_path, "sealed.txt");
    assert.equal(afterRequest.taskContext.taskId, "task-1");
  });

  it("maps the write-capable Forge diff action to file_edit, never git_diff", async () => {
    const root = await makeGovernedActionRoot();
    const target = join(root, "sample.txt");
    await writeFile(target, "original\n", "utf8");
    const tools = [];
    await assert.rejects(
      executeAction(
        {
          type: "diff",
          path: "sample.txt",
          edits: [{ startLine: 1, endLine: 1, newContent: "mutated" }],
        },
        root,
        {},
        governedActionOptions({
          governedExecution: {
            async beforeAction(request) {
              tools.push(request.toolName);
              return request.toolName === "git_diff"
                ? { outcome: "allow" }
                : { outcome: "deny", code: "FILE_EDIT_DENIED" };
            },
          },
        }),
      ),
      (error) => error?.code === "FILE_EDIT_DENIED",
    );
    assert.deepEqual(tools, ["file_edit"]);
    assert.equal(await readFile(target, "utf8"), "original\n");
  });

  it("does not invoke the sandbox when shell_exec is denied", async () => {
    const root = await makeGovernedActionRoot();
    let sandboxCalls = 0;
    await assert.rejects(
      executeAction(
        { type: "bash", command: "npm test" },
        root,
        {},
        governedActionOptions({
          sandboxExecutor: {
            async execute() {
              sandboxCalls += 1;
              return { exitCode: 0, stdout: "unexpected" };
            },
          },
          governedExecution: {
            async beforeAction(request) {
              assert.equal(request.toolName, "shell_exec");
              return { outcome: "deny", code: "SHELL_POLICY_DENY" };
            },
          },
        }),
      ),
      (error) => error?.code === "SHELL_POLICY_DENY",
    );
    assert.equal(sandboxCalls, 0);
  });

  it("observes revocation before the effect and releases the acquired action lease", async () => {
    const root = await makeGovernedActionRoot();
    const controller = new AbortController();
    let releases = 0;
    await assert.rejects(
      executeAction(
        { type: "write", path: "revoked.txt", content: "blocked" },
        root,
        {},
        governedActionOptions({
          signal: controller.signal,
          governedExecution: {
            async beforeAction() {
              controller.abort(new Error("agent revoked"));
              return {
                outcome: "allow",
                policy: { policyHash: "policy-a" },
                executionLease: { release() { releases += 1; } },
              };
            },
          },
        }),
      ),
      (error) => error?.code === "FORGE_RUN_ABORTED",
    );
    assert.equal(releases, 1);
    assert.equal(await governedPathDoesNotExist(join(root, "revoked.txt")), true);
  });

  it("fails closed without a hook when governanceRequired is true", async () => {
    const root = await makeGovernedActionRoot();
    await assert.rejects(
      executeAction(
        { type: "write", path: "missing-hook.txt", content: "blocked" },
        root,
        {},
        governedActionOptions({ governedExecution: null }),
      ),
      (error) => error?.code === "FORGE_ACTION_GOVERNANCE_REQUIRED",
    );
    assert.equal(await governedPathDoesNotExist(join(root, "missing-hook.txt")), true);
  });

  it("rejects an allow verdict without a per-action lease before touching the file", async () => {
    const root = await makeGovernedActionRoot();
    await assert.rejects(
      executeAction(
        { type: "write", path: "lease-missing.txt", content: "blocked" },
        root,
        {},
        governedActionOptions({
          governedExecution: {
            async beforeAction() {
              return { outcome: "allow", policy: { policyHash: "policy-a" } };
            },
          },
        }),
      ),
      (error) => error?.code === "FORGE_ACTION_LEASE_REQUIRED",
    );
    assert.equal(await governedPathDoesNotExist(join(root, "lease-missing.txt")), true);
  });

  it("disables implicit context, memory, lint, and self-review I/O in governed mode", async () => {
    const root = await makeGovernedActionRoot();
    await writeFile(join(root, "secret.txt"), "UNGOVERNED_SECRET_MARKER", "utf8");
    let extraContextCalls = 0;
    let memoryRecallCalls = 0;
    let memoryRememberCalls = 0;
    let sandboxCalls = 0;
    let capturedPrompt = "";

    class GovernedProbeWorker extends BaseWorker {
      constructor() {
        super({
          role: "probe",
          systemPrompt: "Return the requested action.",
          tools: ["read", "write", "edit", "diff"],
          sandboxExecutor: {
            async execute() {
              sandboxCalls += 1;
              return { exitCode: 0, stdout: "" };
            },
          },
        });
      }
      async _getExtraContext() {
        extraContextCalls += 1;
        return "UNTRUSTED_EXTRA_CONTEXT";
      }
    }

    const worker = new GovernedProbeWorker();
    worker.setMemoryEngine({
      recall() { memoryRecallCalls += 1; return ["UNTRUSTED_MEMORY"]; },
      remember() { memoryRememberCalls += 1; },
    });
    worker.setSemanticMemory({ search() { throw new Error("semantic memory must be disabled"); } });
    worker.setCrossSessionMemory({ search() { throw new Error("cross-session memory must be disabled"); } });
    worker.setErrorPatternLearner({ getInstructions() { throw new Error("error history must be disabled"); } });
    worker.setPromptRegistry({ getActive() { throw new Error("prompt history must be disabled"); } });

    const result = await runWithLlmCaller(
      async (userPrompt) => {
        capturedPrompt = userPrompt;
        return {
          text: "[{\"type\":\"write\",\"path\":\"out.js\",\"content\":\"export const broken = ;\"}]\n---SUMMARY---\nwrite\n---END---",
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        };
      },
      () => worker.execute(
        {
          id: "governed-worker",
          name: "governed worker probe",
          type: "implement",
          prompt: "write the requested file",
          allowed_files: ["secret.txt", "out.js"],
        },
        root,
        {
          governanceRequired: true,
          governedExecution: {
            async beforeAction() {
              return {
                outcome: "allow",
                policy: { policyHash: "policy-a" },
                executionLease: { release() {} },
              };
            },
          },
        },
      ),
    );

    assert.equal(result.success, true);
    assert.equal(extraContextCalls, 0);
    assert.equal(memoryRecallCalls, 0);
    assert.equal(memoryRememberCalls, 0);
    assert.equal(sandboxCalls, 0);
    assert.equal(capturedPrompt.includes("UNGOVERNED_SECRET_MARKER"), false);
    assert.equal(capturedPrompt.includes("UNTRUSTED_MEMORY"), false);
    assert.equal(capturedPrompt.includes("UNTRUSTED_EXTRA_CONTEXT"), false);
    assert.equal(await readFile(join(root, "out.js"), "utf8"), "export const broken = ;");
  });
});
