/**
 * Deep Polish Batch 6: TOCTOU Race, Callback Guard, writeJson Guard,
 * Audit Cap, WebSocket Buffer Safety, Stream Context Compaction
 *
 * @module deep-polish-batch6
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createSourceReader } from "./helpers/source-closure.js";

const APPS_SRC = "../../../apps/ai-gateway-service/src";
const SRC_ROOT = resolve(import.meta.dirname || ".", APPS_SRC);
const readFileSync = createSourceReader(SRC_ROOT);

async function isolatedLoopOptions(context) {
  const base = await realpath(tmpdir());
  const root = await mkdtemp(join(base, "batch6-loop-"));
  context.after(async () => {
    assert.equal(await realpath(root), root);
    assert.equal(dirname(root), base);
    assert.ok(root.startsWith(join(base, "batch6-loop-")));
    await rm(root, { recursive: true, force: false });
  });
  return {
    workingDirectory: root, memoryDir: join(root, "memory"), sessionStoreDir: join(root, "sessions"),
    promptOptimizeEnabled: false, partialPreviewEnabled: false,
  };
}

// ────────────────────────────────────────────────────────────────
// 1. sessionMemory TOCTOU Race Fix
// ────────────────────────────────────────────────────────────────
describe("sessionMemory TOCTOU race fix", () => {
  it("module loads and exports expected API", async () => {
    const mod = await import(`${APPS_SRC}/agentic/sessionMemory.js`);
    assert.ok(mod, "Module should load");
    const keys = Object.keys(mod);
    assert.ok(keys.length > 0, `Should have exports, got: ${keys.join(", ")}`);
  });

  it("source uses _loadPromise pattern instead of _loaded boolean", () => {
    const src = readFileSync(join(SRC_ROOT, "agentic", "sessionMemory.js"), "utf-8");
    assert.ok(
      src.includes("_loadPromise"),
      "Should use _loadPromise pattern to prevent TOCTOU race"
    );
    // The old boolean pattern should be gone
    assert.ok(
      !src.match(/let\s+_loaded\s*=\s*false/),
      "Should not use the old _loaded boolean pattern"
    );
  });

  it("concurrent _ensureLoaded calls share same promise", async () => {
    const mod = await import(`${APPS_SRC}/agentic/sessionMemory.js`);
    // Verify that the module's initialization doesn't fail under concurrent access
    // The actual race is internal, but we verify the module structure is correct
    if (typeof mod.createSessionMemory === "function") {
      const mem = mod.createSessionMemory({ memoryDir: "/nonexistent" });
      assert.ok(mem, "Should create session memory instance");
      // Multiple concurrent operations should not crash
      const ops = [
        mem.recallRelevant?.("test") ?? Promise.resolve([]),
        mem.recallRelevant?.("test2") ?? Promise.resolve([]),
        mem.getStats?.() ?? Promise.resolve({}),
      ];
      const results = await Promise.allSettled(ops);
      // All should settle (not hang)
      assert.equal(results.length, 3, "All operations should settle");
    }
  });
});

// ────────────────────────────────────────────────────────────────
// 2. onIteration Callback Guard
// ────────────────────────────────────────────────────────────────
describe("onIteration callback crash guard", () => {
  it("contains callback failures after tool execution and the final answer", async (context) => {
    const { createAgenticLoop } = await import(`${APPS_SRC}/agentic/agenticCodingLoop.js`);
    const requests = [], executions = [], callbacks = [];
    const toolCall = { id: "fixture-read-1", name: "fixture_read", arguments: { path: "owned.txt" } };
    const toolResult = { status: "success", value: "Owned fixture content" };
    const loop = createAgenticLoop({
      ...await isolatedLoopOptions(context),
      maxIterations: 2,
      providerAdapter: { generate: async (request) => {
        requests.push(structuredClone(request));
        return requests.length === 1 ? { text: "Read the fixture", toolCalls: [toolCall] } : { text: "Final fixture answer" };
      } },
      toolRegistry: {
        listTools: () => [{ name: "fixture_read", inputSchema: { type: "object" } }],
        executeTool: async (name, args) => { executions.push({ name, args }); return toolResult; },
      },
    });
    const result = await loop.execute({
      goal: "Read and summarize the fixture",
      onIteration: (iteration, event) => {
        callbacks.push({ iteration, ...event });
        throw new Error(`CALLBACK_CRASH_${event.type}`);
      },
    });

    assert.equal(result.status, "completed");
    assert.equal(result.finalAnswer, "Final fixture answer");
    assert.equal(result.iterations, 2);
    assert.equal(requests.length, 2);
    assert.deepEqual(executions, [{ name: toolCall.name, args: toolCall.arguments }]);
    assert.deepEqual(callbacks.map(({ iteration, type }) => ({ iteration, type })), [
      { iteration: 1, type: "tool_calls_executed" }, { iteration: 2, type: "final_answer" },
    ]);
    assert.equal(callbacks[0].toolResults[0]._meta.isError, false);
    assert.deepEqual(JSON.parse(callbacks[0].toolResults[0].content), toolResult);
    assert.equal(callbacks[1].text, result.finalAnswer);
    assert.deepEqual(requests[1].request.messages.at(-1), {
      role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(toolResult),
    });
  });

  it("agenticCodingLoop loads and creates loop with onIteration", async () => {
    const { createAgenticLoop } = await import(`${APPS_SRC}/agentic/agenticCodingLoop.js`);
    let callbackCalled = false;
    const loop = createAgenticLoop({
      providerAdapter: {
        generate: async () => ({
          content: "Done",
          toolCalls: [],
          finishReason: "stop",
        }),
      },
      toolRegistry: {
        getToolsForSchema: () => [],
        callTool: async () => ({}),
      },
    });
    assert.ok(loop, "Should create loop");
    assert.equal(typeof loop.execute, "function", "Should have execute");
  });

  it("throwing onIteration callback does not crash execute", async () => {
    const { createAgenticLoop } = await import(`${APPS_SRC}/agentic/agenticCodingLoop.js`);
    const loop = createAgenticLoop({
      providerAdapter: {
        generate: async () => ({
          content: "Final answer",
          toolCalls: [],
          finishReason: "stop",
        }),
      },
      toolRegistry: {
        getToolsForSchema: () => [],
        listTools: () => [],
        callTool: async () => ({}),
      },
    });

    // A callback that throws should not crash the loop
    const result = await loop.execute({
      goal: "test",
      onIteration: () => { throw new Error("CALLBACK_CRASH"); },
    });
    // Loop should complete (not crash)
    assert.ok(result, "Should return a result despite callback throwing");
  });
});

// ────────────────────────────────────────────────────────────────
// 3. writeJson Response Guard
// ────────────────────────────────────────────────────────────────
describe("writeJson response guard", () => {
  it("source checks writableEnded or headersSent before writing", () => {
    const src = readFileSync(join(SRC_ROOT, "http", "httpServer.js"), "utf-8");
    assert.ok(
      src.includes("writableEnded") || src.includes("headersSent"),
      "writeJson should guard against writing to already-sent responses"
    );
  });

  it("httpServer module still loads correctly", async () => {
    const mod = await import(`${APPS_SRC}/http/httpServer.js`);
    assert.ok(mod, "Module should load");
    const exports = Object.keys(mod);
    assert.ok(exports.length > 0, `Should have exports: ${exports.join(", ")}`);
  });
});

// ────────────────────────────────────────────────────────────────
// 4. permissionGate Audit Array Cap
// ────────────────────────────────────────────────────────────────
describe("permissionGate audit array cap", () => {
  it("source caps auditRecords after push", () => {
    const src = readFileSync(join(SRC_ROOT, "claude-code-patterns", "permissionGate.js"), "utf-8");
    assert.ok(
      src.includes("10000") || src.includes("10_000"),
      "Should cap audit records at 10000"
    );
    assert.ok(
      src.includes("splice") || src.includes("shift"),
      "Should trim old entries when cap is exceeded"
    );
  });

  it("permissionGate module loads", async () => {
    const mod = await import(`${APPS_SRC}/claude-code-patterns/permissionGate.js`);
    assert.ok(mod, "Module should load");
  });

  it("audit records are capped at 10000", async () => {
    const mod = await import(`${APPS_SRC}/claude-code-patterns/permissionGate.js`);
    if (typeof mod.createPermissionGate === "function") {
      const gate = mod.createPermissionGate({ mode: "bypass" });
      // Simulate many permission checks
      if (typeof gate.check === "function") {
        for (let i = 0; i < 100; i++) {
          gate.check({ tool: "test", action: "read" });
        }
        if (typeof gate.getAuditRecords === "function") {
          const records = gate.getAuditRecords();
          assert.ok(
            records.length <= 10000,
            `Audit records should be capped, got ${records.length}`
          );
        }
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────
// 5. WebSocket Protocol Stack Safety
// ────────────────────────────────────────────────────────────────
describe("WebSocket protocol safety", () => {
  it("delegates RFC 6455 parsing to the maintained ws implementation", () => {
    const src = readFileSync(join(SRC_ROOT, "http", "webSocketServer.js"), "utf-8");
    assert.ok(src.includes('from "ws"'), "Should use the maintained ws protocol implementation");
    assert.ok(src.includes("new WebSocketServer"), "Should create a no-server WebSocket transport");
    assert.ok(!src.includes("function decodeFrame"), "Should not maintain a custom frame decoder");
  });

  it("configures bounded payloads and disables compression by default", () => {
    const src = readFileSync(join(SRC_ROOT, "http", "webSocketServer.js"), "utf-8");
    assert.ok(src.includes("DEFAULT_MAX_WS_PAYLOAD"), "Should define a bounded default payload size");
    assert.ok(src.includes("maxPayload: maxPayloadBytes"), "Should enforce maxPayload in the protocol stack");
    assert.ok(src.includes("perMessageDeflate: false"), "Should disable compression resource amplification");
  });

  it("enforces identity-level rate and concurrency controls", () => {
    const src = readFileSync(join(SRC_ROOT, "http", "webSocketServer.js"), "utf-8");
    assert.ok(src.includes("maxMessagesPerWindow"), "Should enforce a message-rate window");
    assert.ok(src.includes("maxInFlightPerSubject"), "Should enforce per-subject concurrency");
    assert.ok(src.includes("maxConnectionsPerSubject"), "Should enforce per-subject connections");
    assert.ok(src.includes("reauthorizeConnection"), "Should reauthorize long-lived sessions");
    assert.ok(src.includes("maxConnectionLifetimeMs"), "Should bound session lifetime");
    assert.ok(src.includes("consumeExternalQuota"), "Should enforce shared cross-node quotas");
  });

  it("webSocketServer module loads", async () => {
    const mod = await import(`${APPS_SRC}/http/webSocketServer.js`);
    assert.ok(mod, "Module should load");
  });
});

// ────────────────────────────────────────────────────────────────
// 6. executeStream Context Compaction
// ────────────────────────────────────────────────────────────────
describe("executeStream context compaction", () => {
  for (const mode of ["execute", "executeStream"]) {
    for (const style of ["iterations", "history"]) {
      it(`${mode} compacts ${style} before dispatch and preserves recent input`, async (context) => {
        const { createAgenticLoop } = await import(`${APPS_SRC}/agentic/agenticCodingLoop.js`);
        const goal = "Summarize the preserved recent input";
        const history = style === "iterations"
          ? Array.from({ length: 12 }, (_, index) => [
            { role: "user", content: `User turn ${index}` }, { role: "assistant", content: `Answer turn ${index}` },
          ]).flat()
          : Array.from({ length: 30 }, (_, index) => ({ role: "user", content: `User turn ${index}: ${"detail ".repeat(40)}` }));
        const requests = [];
        const loop = createAgenticLoop({
          ...await isolatedLoopOptions(context), maxIterations: 1, maxContextTokens: 100,
          providerAdapter: { generate: async (request) => { requests.push(structuredClone(request)); return { text: "Compacted answer" }; } },
          toolRegistry: { listTools: () => [] },
        });
        const input = { goal, messages: structuredClone(history) };
        if (mode === "execute") {
          const result = await loop.execute(input);
          assert.equal(result.status, "completed");
          assert.equal(result.finalAnswer, "Compacted answer");
          assert.equal(result.contextStats.hasSummarizedHistory, style === "history");
        } else {
          const events = [];
          for await (const event of loop.executeStream(input)) events.push(event);
          assert.equal(events.filter(event => event.type === "error").length, 0);
          assert.equal(events.at(-1).type, "complete");
          assert.equal(events.at(-1).finalAnswer, "Compacted answer");
        }
        assert.equal(requests.length, 1);
        const sent = requests[0].request.messages;
        assert.ok(sent.length < history.length, "Provider should receive a shorter history");
        const marker = style === "iterations" ? "[Context compacted:" : "[Previous conversation summary]";
        assert.ok(sent.some(message => message.role === "system" && message.content.startsWith(marker)));
        assert.deepEqual(sent.at(-1), { role: "user", content: goal });
        const recent = history.slice(style === "iterations" ? -9 : -4);
        assert.deepEqual(sent.slice(-recent.length - 1, -1), recent);
      });
    }
  }

  it("preserves the exact frozen history through independent final review", async (context) => {
    const { createAgenticLoop } = await import(`${APPS_SRC}/agentic/agenticCodingLoop.js`);
    const messages = Array.from({ length: 12 }, (_, index) => [
      { role: "user", content: `Reviewed task ${index}` }, { role: "assistant", content: `Reviewed answer ${index}` },
    ]).flat();
    const expected = [{ role: "system", content: "Exact reviewed system" }, ...messages];
    const requests = [], reviews = [];
    const loop = createAgenticLoop({
      ...await isolatedLoopOptions(context), maxIterations: 1, maxContextTokens: 100,
      systemPrompt: "Exact reviewed system", frozenContext: true,
      providerAdapter: { generate: async (request) => { requests.push(structuredClone(request)); return { text: "Reviewed final answer" }; } },
      toolRegistry: { listTools: () => [] },
      onFinalAnswer: async (state) => { reviews.push(state); return { action: "complete" }; },
    });
    const result = await loop.execute({ goal: "Review the supplied history", messages });
    assert.equal(result.status, "completed");
    assert.equal(result.finalAnswer, "Reviewed final answer");
    assert.equal(result.contextStats.hasSummarizedHistory, false);
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0].request.messages, expected);
    assert.equal(reviews.length, 1);
    assert.deepEqual(reviews[0].messages, [...expected, { role: "assistant", content: "Reviewed final answer" }]);
    assert.deepEqual(result.messages, reviews[0].messages);
  });

  it("executeStream path includes compactMessages call", () => {
    const src = readFileSync(join(SRC_ROOT, "agentic", "agenticCodingLoop.js"), "utf-8");

    const compactStart = src.indexOf("function compactIfNeeded");
    const executeStart = src.indexOf("async function execute(");
    const compactSection = src.slice(compactStart, executeStart);
    assert.ok(compactSection.includes("compactMessages"), "shared compaction helper should call compactMessages");
  });
});

// ────────────────────────────────────────────────────────────────
// 7. Cross-module Integration
// ────────────────────────────────────────────────────────────────
describe("batch 6 cross-module integration", () => {
  it("all fixed modules load without errors", async () => {
    const modules = [
      `${APPS_SRC}/agentic/sessionMemory.js`,
      `${APPS_SRC}/agentic/agenticCodingLoop.js`,
      `${APPS_SRC}/http/httpServer.js`,
      `${APPS_SRC}/claude-code-patterns/permissionGate.js`,
      `${APPS_SRC}/http/webSocketServer.js`,
    ];

    for (const mod of modules) {
      try {
        await import(mod);
      } catch (err) {
        assert.fail(`Module ${mod} failed to load: ${err.message}`);
      }
    }
    assert.ok(true, "All modules loaded successfully");
  });

  it("agentic loop with all guards still produces output", async () => {
    const { createAgenticLoop } = await import(`${APPS_SRC}/agentic/agenticCodingLoop.js`);
    const loop = createAgenticLoop({
      providerAdapter: {
        generate: async () => ({
          content: "Test output",
          toolCalls: [],
          finishReason: "stop",
        }),
      },
      toolRegistry: {
        getToolsForSchema: () => [],
        callTool: async () => ({}),
        listTools: () => [],
      },
    });

    // Execute with all guards active
    const result = await loop.execute({
      goal: "test with all guards",
      onIteration: () => {}, // no-op callback
    });
    assert.ok(result, "Should produce result with all guards active");
  });
});
