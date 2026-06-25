/**
 * Deep Polish Batch 4 Part 1: Timer Leak Fix, WebSocket Auth, Async I/O
 *
 * @module deep-polish-batch4-part1
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const APPS_SRC = "../../../apps/ai-gateway-service/src";

// ────────────────────────────────────────────────────────────────
// 1. LSP Timer Leak Fix
// ────────────────────────────────────────────────────────────────
describe("lspTool timer leak fix", () => {
  it("createLspTools returns pool management methods", async () => {
    const { createLspTools } = await import(`${APPS_SRC}/tools/lspTool.js`);
    const lsp = createLspTools({ workingDirectory: tmpdir() });
    assert.ok(lsp.tools, "Should have tools array");
    assert.ok(Array.isArray(lsp.tools), "tools should be an array");
    assert.equal(lsp.tools.length, 4, "Should have 4 LSP tools");
    assert.equal(typeof lsp.shutdownAll, "function", "Should have shutdownAll");
    assert.equal(typeof lsp.getClientCount, "function", "Should have getClientCount");
    assert.equal(typeof lsp.getPoolStats, "function", "Should have getPoolStats");
    assert.equal(lsp.getClientCount(), 0, "Initial client count should be 0");
  });

  it("getPoolStats returns pool metadata", async () => {
    const { createLspTools } = await import(`${APPS_SRC}/tools/lspTool.js`);
    const lsp = createLspTools({
      workingDirectory: tmpdir(),
      maxPoolSize: 3,
      idleTimeoutMs: 1000,
    });
    const stats = lsp.getPoolStats();
    assert.equal(stats.poolSize, 0);
    assert.equal(stats.maxPoolSize, 3);
    assert.equal(stats.idleTimeoutMs, 1000);
    assert.ok(Array.isArray(stats.clients), "Should have clients array");
  });

  it("LSP tools have correct names and schemas", async () => {
    const { createLspTools } = await import(`${APPS_SRC}/tools/lspTool.js`);
    const lsp = createLspTools({ workingDirectory: tmpdir() });
    const names = lsp.tools.map(t => t.name);
    assert.ok(names.includes("lsp_definition"), "Should have lsp_definition");
    assert.ok(names.includes("lsp_references"), "Should have lsp_references");
    assert.ok(names.includes("lsp_hover"), "Should have lsp_hover");
    assert.ok(names.includes("lsp_symbols"), "Should have lsp_symbols");
    for (const tool of lsp.tools) {
      assert.ok(tool.inputSchema, `${tool.name} should have inputSchema`);
      assert.ok(tool.inputSchema.properties, `${tool.name} should have schema properties`);
      assert.ok(tool.isReadOnly, `${tool.name} should be read-only`);
    }
  });

  it("shutdownAll cleans up with no active clients", async () => {
    const { createLspTools } = await import(`${APPS_SRC}/tools/lspTool.js`);
    const lsp = createLspTools({ workingDirectory: tmpdir() });
    // Should not throw even with no active clients
    await lsp.shutdownAll();
    assert.equal(lsp.getClientCount(), 0);
  });
});

// ────────────────────────────────────────────────────────────────
// 2. WebSocket Authentication
// ────────────────────────────────────────────────────────────────
describe("webSocketServer authentication", () => {
  it("createWebSocketServer accepts authenticate option", async () => {
    const { createWebSocketServer } = await import(`${APPS_SRC}/http/webSocketServer.js`);
    const ws = createWebSocketServer({
      authenticate: (req) => req.headers["x-test-token"] === "valid",
      onMessage: () => {},
    });
    assert.ok(ws, "Should create server with authenticate option");
    assert.equal(typeof ws.attach, "function", "Should have attach method");
    assert.equal(typeof ws.broadcast, "function", "Should have broadcast method");
    assert.equal(typeof ws.getConnectionCount, "function", "Should have getConnectionCount");
  });

  it("createWebSocketServer works without authenticate option", async () => {
    const { createWebSocketServer } = await import(`${APPS_SRC}/http/webSocketServer.js`);
    const ws = createWebSocketServer();
    assert.ok(ws, "Should create server without auth");
    assert.equal(ws.getConnectionCount(), 0);
  });

  it("getConnections returns the connections set", async () => {
    const { createWebSocketServer } = await import(`${APPS_SRC}/http/webSocketServer.js`);
    const ws = createWebSocketServer();
    const connections = ws.getConnections();
    assert.ok(connections instanceof Set, "Should return a Set");
    assert.equal(connections.size, 0, "Initially empty");
  });
});

// ────────────────────────────────────────────────────────────────
// 3. SessionStore Async I/O
// ────────────────────────────────────────────────────────────────
describe("sessionStore async I/O", () => {
  let storeDir;
  let createSessionStore;

  before(async () => {
    storeDir = join(tmpdir(), `batch4-session-store-${Date.now()}`);
    const mod = await import(`${APPS_SRC}/agentic/sessionStore.js`);
    createSessionStore = mod.createSessionStore;
  });

  after(async () => {
    try { await rm(storeDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  it("save() returns a Promise", async () => {
    const store = createSessionStore({ storeDir });
    const result = await store.save({ sessionId: "test-async-1", goal: "test goal", status: "completed" });
    assert.ok(result.saved, "Should return saved=true");
    assert.equal(result.sessionId, "test-async-1");
  });

  it("load() returns a Promise that resolves to session data", async () => {
    const store = createSessionStore({ storeDir });
    await store.save({ sessionId: "test-load-1", goal: "load test", status: "completed" });
    const data = await store.load("test-load-1");
    assert.ok(data, "Should load session data");
    assert.equal(data.sessionId, "test-load-1");
    assert.equal(data.goal, "load test");
  });

  it("load() returns null for non-existent session", async () => {
    const store = createSessionStore({ storeDir });
    const data = await store.load("nonexistent-session");
    assert.equal(data, null);
  });

  it("list() returns a Promise with sessions array", async () => {
    const store = createSessionStore({ storeDir });
    await store.save({ sessionId: "list-1", goal: "goal 1" });
    await store.save({ sessionId: "list-2", goal: "goal 2" });
    const result = await store.list();
    assert.ok(result.sessions, "Should have sessions array");
    assert.ok(result.sessions.length >= 2, "Should have at least 2 sessions");
  });

  it("remove() returns a Promise with boolean", async () => {
    const store = createSessionStore({ storeDir });
    await store.save({ sessionId: "remove-1", goal: "to remove" });
    const deleted = await store.remove("remove-1");
    assert.equal(deleted, true, "Should return true on successful delete");
    const deletedAgain = await store.remove("remove-1");
    assert.equal(deletedAgain, false, "Should return false for already deleted");
  });

  it("getLatest() returns a Promise with most recent session", async () => {
    const store = createSessionStore({ storeDir });
    await store.save({ sessionId: "latest-1", goal: "older" });
    await store.save({ sessionId: "latest-2", goal: "newer" });
    const latest = await store.getLatest();
    assert.ok(latest, "Should return latest session");
    assert.equal(latest.goal, "newer");
  });

  it("getSessionCount() returns a Promise with count", async () => {
    const store = createSessionStore({ storeDir: join(storeDir, "count-test") });
    const count0 = await store.getSessionCount();
    assert.equal(count0, 0);
    await store.save({ sessionId: "count-1", goal: "test" });
    const count1 = await store.getSessionCount();
    assert.equal(count1, 1);
  });

  it("exportSession() and importSession() work with async API", async () => {
    const store = createSessionStore({ storeDir });
    await store.save({ sessionId: "export-1", goal: "export test", status: "completed" });
    const exported = await store.exportSession("export-1");
    assert.ok(exported, "Should export session");
    assert.equal(exported.version, "1.0");
    assert.ok(exported.session, "Should have session data");
  });

  it("legacy aliases work with async API", async () => {
    const store = createSessionStore({ storeDir });
    await store.saveSession({ sessionId: "legacy-1", goal: "legacy test" });
    const data = await store.loadSession("legacy-1");
    assert.ok(data, "loadSession should work");
    const sessions = await store.listSessions(10);
    assert.ok(Array.isArray(sessions), "listSessions should return array");
    const deleteResult = await store.deleteSession("legacy-1");
    assert.ok(deleteResult.deleted, "deleteSession should work");
  });
});

// ────────────────────────────────────────────────────────────────
// 4. SessionMemory Async I/O + Lazy Loading
// ────────────────────────────────────────────────────────────────
describe("sessionMemory async I/O and lazy loading", () => {
  let memoryDir;
  let createSessionMemory;

  before(async () => {
    memoryDir = join(tmpdir(), `batch4-session-memory-${Date.now()}`);
    const mod = await import(`${APPS_SRC}/agentic/sessionMemory.js`);
    createSessionMemory = mod.createSessionMemory;
  });

  after(async () => {
    try { await rm(memoryDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  it("createSessionMemory does not throw with empty directory", () => {
    const mem = createSessionMemory({ memoryDir: join(memoryDir, "empty") });
    assert.ok(mem, "Should create without error");
    assert.equal(typeof mem.recordOutcome, "function");
    assert.equal(typeof mem.recallRelevant, "function");
    assert.equal(typeof mem.getStats, "function");
  });

  it("recordOutcome() returns a Promise", async () => {
    const mem = createSessionMemory({ memoryDir });
    const entry = await mem.recordOutcome({
      goal: "test async memory",
      status: "completed",
      toolSequence: ["file_read", "file_write"],
      durationMs: 100,
      iterationCount: 2,
    });
    assert.ok(entry, "Should return entry");
    assert.equal(entry.goal, "test async memory");
    assert.equal(entry.status, "completed");
  });

  it("getStats() returns a Promise with memory stats", async () => {
    const mem = createSessionMemory({ memoryDir });
    await mem.recordOutcome({ goal: "stats test", status: "completed" });
    const stats = await mem.getStats();
    assert.ok(stats, "Should return stats");
    assert.ok(typeof stats.totalEntries === "number", "Should have totalEntries");
    assert.ok(stats.totalEntries >= 1, "Should have at least 1 entry");
  });

  it("recallRelevant() returns a Promise with matching entries", async () => {
    const mem = createSessionMemory({ memoryDir: join(memoryDir, "recall") });
    await mem.recordOutcome({ goal: "fix the parser bug", status: "completed", toolSequence: ["file_read"] });
    await mem.recordOutcome({ goal: "add new feature", status: "completed", toolSequence: ["file_write"] });
    const results = await mem.recallRelevant("fix the parser");
    assert.ok(Array.isArray(results), "Should return array");
  });

  it("buildMemoryPrompt() returns a Promise", async () => {
    const mem = createSessionMemory({ memoryDir: join(memoryDir, "prompt") });
    await mem.recordOutcome({ goal: "build prompt test", status: "completed" });
    const prompt = await mem.buildMemoryPrompt("build prompt test");
    // May be null if no relevant patterns, or a string
    assert.ok(prompt === null || typeof prompt === "string", "Should return null or string");
  });

  it("save() persists to disk and can be reloaded", async () => {
    const dir = join(memoryDir, "persist");
    const mem1 = createSessionMemory({ memoryDir: dir });
    await mem1.recordOutcome({ goal: "persistent memory", status: "completed" });
    await mem1.save();

    // Reload in a new instance
    const mem2 = createSessionMemory({ memoryDir: dir });
    const stats = await mem2.getStats();
    assert.ok(stats.totalEntries >= 1, "Should reload persisted entries");
  });

  it("clear() works synchronously", async () => {
    const mem = createSessionMemory({ memoryDir: join(memoryDir, "clear") });
    await mem.recordOutcome({ goal: "to clear", status: "completed" });
    mem.clear();
    const stats = await mem.getStats();
    assert.equal(stats.totalEntries, 0, "Should clear all entries");
  });

  it("getTopPatterns() works synchronously", async () => {
    const mem = createSessionMemory({ memoryDir: join(memoryDir, "patterns") });
    await mem.recordOutcome({ goal: "fix the parser", status: "completed", toolSequence: ["file_read"] });
    const patterns = mem.getTopPatterns(5);
    assert.ok(Array.isArray(patterns), "Should return array");
  });
});
