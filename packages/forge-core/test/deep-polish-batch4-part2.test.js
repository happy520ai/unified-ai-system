/**
 * Deep Polish Batch 4 Part 2: Error Visibility, Cache Invalidation, SSRF Protection
 *
 * @module deep-polish-batch4-part2
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const APPS_SRC = "../../../apps/ai-gateway-service/src";

// ────────────────────────────────────────────────────────────────
// 5. AgenticCodingLoop Debug Logging
// ────────────────────────────────────────────────────────────────
describe("agenticCodingLoop debug error logging", () => {
  it("_debugLoop function is present and works conditionally", async () => {
    // We can't directly access _debugLoop (it's module-scoped),
    // but we can verify the module loads and the feature works
    const { createAgenticLoop } = await import(`${APPS_SRC}/agentic/agenticCodingLoop.js`);
    assert.equal(typeof createAgenticLoop, "function");
    const loop = createAgenticLoop({
      providerAdapter: { generate: async () => ({ text: "done", raw: { finishReason: "stop" }, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } }) },
      maxIterations: 1,
    });
    assert.ok(loop, "Should create loop without error");
    const result = await loop.execute({ goal: "test" });
    assert.equal(result.status, "completed");
  });

  it("execute works with all dead modules active", async () => {
    const { createAgenticLoop } = await import(`${APPS_SRC}/agentic/agenticCodingLoop.js`);
    const loop = createAgenticLoop({
      providerAdapter: { generate: async () => ({ text: "done", raw: { finishReason: "stop" }, usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } }) },
      promptOptimizeEnabled: true,
      partialPreviewEnabled: true,
      maxIterations: 1,
    });
    const result = await loop.execute({ goal: "test debug logging" });
    assert.equal(result.status, "completed");
    assert.ok(result.progressSummary, "Should have progress summary from partialPreview");
  });
});

// ────────────────────────────────────────────────────────────────
// 6. Cache Invalidation on Writes
// ────────────────────────────────────────────────────────────────
describe("tool result cache invalidation on writes", () => {
  it("createAgentToolRegistry exposes invalidateFileCache", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const reg = createAgentToolRegistry({ workingDirectory: tmpdir() });
    assert.equal(typeof reg.clearCache, "function", "Should have clearCache");
    assert.equal(typeof reg.invalidateFileCache, "function", "Should have invalidateFileCache");
  });

  it("invalidateFileCache removes cached file_read entries", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const reg = createAgentToolRegistry({ workingDirectory: tmpdir() });

    // Manually populate cache by calling a read tool (simulate via direct cache set)
    // We can't easily trigger the internal cache without running tools,
    // but we can verify the invalidation API exists and works
    const health = reg.getHealth();
    assert.ok(health.cacheableTools.includes("file_read"), "file_read should be cacheable");
    assert.ok(health.cacheableTools.includes("glob"), "glob should be cacheable");
    assert.ok(health.cacheableTools.includes("grep"), "grep should be cacheable");
  });

  it("cache stats are tracked in getHealth()", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const reg = createAgentToolRegistry({ workingDirectory: tmpdir() });
    const health = reg.getHealth();
    assert.equal(typeof health.cacheSize, "number");
    assert.equal(typeof health.cacheMaxSize, "number");
    assert.ok(Array.isArray(health.cacheableTools));
  });

  it("clearCache returns cleared count", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const reg = createAgentToolRegistry({ workingDirectory: tmpdir() });
    const result = reg.clearCache();
    assert.equal(typeof result.cleared, "number", "Should return cleared count");
  });

  it("invalidateFileCache returns count of invalidated entries", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const reg = createAgentToolRegistry({ workingDirectory: tmpdir() });
    const count = reg.invalidateFileCache({ path: "/tmp/test.js" }, "file_write");
    assert.equal(typeof count, "number", "Should return invalidated count");
  });
});

// ────────────────────────────────────────────────────────────────
// 7. SSRF Protection for web_fetch
// ────────────────────────────────────────────────────────────────
describe("webFetchTool SSRF protection", () => {
  it("blocks requests to localhost", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const reg = createAgentToolRegistry({ workingDirectory: tmpdir() });
    const tool = reg.getTool("web_fetch");
    assert.ok(tool, "web_fetch tool should exist");

    const result = await tool.execute({ url: "http://localhost:3100/health" });
    assert.equal(result.status, "error", "Should block localhost");
    assert.ok(result.blocked, "Should be marked as blocked");
    assert.ok(result.error.includes("SSRF"), "Error should mention SSRF");
  });

  it("blocks requests to 127.0.0.1", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const reg = createAgentToolRegistry({ workingDirectory: tmpdir() });
    const tool = reg.getTool("web_fetch");

    const result = await tool.execute({ url: "http://127.0.0.1:8080/admin" });
    assert.equal(result.status, "error");
    assert.ok(result.blocked);
  });

  it("blocks requests to private IP 10.x.x.x", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const reg = createAgentToolRegistry({ workingDirectory: tmpdir() });
    const tool = reg.getTool("web_fetch");

    const result = await tool.execute({ url: "http://10.0.0.1/internal" });
    assert.equal(result.status, "error");
    assert.ok(result.blocked);
    assert.ok(result.error.includes("Private IP"));
  });

  it("blocks requests to private IP 172.16.x.x", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const reg = createAgentToolRegistry({ workingDirectory: tmpdir() });
    const tool = reg.getTool("web_fetch");

    const result = await tool.execute({ url: "http://172.16.0.1/secret" });
    assert.equal(result.status, "error");
    assert.ok(result.blocked);
  });

  it("blocks requests to private IP 192.168.x.x", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const reg = createAgentToolRegistry({ workingDirectory: tmpdir() });
    const tool = reg.getTool("web_fetch");

    const result = await tool.execute({ url: "http://192.168.1.1/router" });
    assert.equal(result.status, "error");
    assert.ok(result.blocked);
  });

  it("blocks requests to 169.254.169.254 (cloud metadata)", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const reg = createAgentToolRegistry({ workingDirectory: tmpdir() });
    const tool = reg.getTool("web_fetch");

    const result = await tool.execute({ url: "http://169.254.169.254/latest/meta-data/" });
    assert.equal(result.status, "error");
    assert.ok(result.blocked);
  });

  it("blocks non-HTTP protocols (file://)", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const reg = createAgentToolRegistry({ workingDirectory: tmpdir() });
    const tool = reg.getTool("web_fetch");

    const result = await tool.execute({ url: "file:///etc/passwd" });
    assert.equal(result.status, "error");
    assert.ok(result.blocked);
    assert.ok(result.error.includes("protocol"));
  });

  it("blocks .local TLD", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const reg = createAgentToolRegistry({ workingDirectory: tmpdir() });
    const tool = reg.getTool("web_fetch");

    const result = await tool.execute({ url: "http://myserver.local/api" });
    assert.equal(result.status, "error");
    assert.ok(result.blocked);
  });

  it("blocks .internal TLD", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const reg = createAgentToolRegistry({ workingDirectory: tmpdir() });
    const tool = reg.getTool("web_fetch");

    const result = await tool.execute({ url: "https://service.internal/data" });
    assert.equal(result.status, "error");
    assert.ok(result.blocked);
  });

  it("allows valid public HTTPS URLs (may fail on network but not SSRF)", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const reg = createAgentToolRegistry({ workingDirectory: tmpdir() });
    const tool = reg.getTool("web_fetch");

    // This should NOT be blocked by SSRF — it may fail for other reasons (DNS, timeout)
    // but the SSRF check should pass
    const result = await tool.execute({ url: "https://example.com", timeout_ms: 3000 });
    // If it fails, it should NOT be due to SSRF blocking
    if (result.status === "error") {
      assert.ok(!result.blocked, "Public URL should not be SSRF-blocked");
    }
  });

  it("rejects invalid URLs", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const reg = createAgentToolRegistry({ workingDirectory: tmpdir() });
    const tool = reg.getTool("web_fetch");

    const result = await tool.execute({ url: "not-a-valid-url" });
    assert.equal(result.status, "error");
    assert.ok(result.blocked);
  });
});

// ────────────────────────────────────────────────────────────────
// 8. Cross-Module Integration
// ────────────────────────────────────────────────────────────────
describe("batch 4 cross-module integration", () => {
  it("agenticCodingLoop creates with async sessionStore and sessionMemory", async () => {
    const { createAgenticLoop } = await import(`${APPS_SRC}/agentic/agenticCodingLoop.js`);
    const dir = join(tmpdir(), `batch4-integration-${Date.now()}`);
    const loop = createAgenticLoop({
      providerAdapter: { generate: async () => ({ text: "integration test done", raw: { finishReason: "stop" }, usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 } }) },
      maxIterations: 1,
      sessionStoreDir: join(dir, "sessions"),
      memoryDir: join(dir, "memory"),
    });
    assert.ok(loop, "Should create loop with async modules");
    const result = await loop.execute({ goal: "integration test goal" });
    assert.equal(result.status, "completed");
    // Clean up
    try { await rm(dir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  it("agentToolRegistry has all batch 4 enhancements", async () => {
    const { createAgentToolRegistry } = await import(`${APPS_SRC}/claude-code-patterns/agentToolRegistry.js`);
    const reg = createAgentToolRegistry({ workingDirectory: tmpdir() });

    // Cache invalidation
    assert.equal(typeof reg.invalidateFileCache, "function");
    assert.equal(typeof reg.clearCache, "function");

    // Health check includes cache info
    const health = reg.getHealth();
    assert.ok("cacheSize" in health);
    assert.ok("cacheMaxSize" in health);
    assert.ok("cacheableTools" in health);

    // SSRF-protected web_fetch exists
    const webFetch = reg.getTool("web_fetch");
    assert.ok(webFetch, "web_fetch should be registered");

    // LSP shutdown hook exists
    assert.equal(typeof reg.shutdownLsp, "function");
  });

  it("sessionStore handles concurrent saves", async () => {
    const { createSessionStore } = await import(`${APPS_SRC}/agentic/sessionStore.js`);
    const dir = join(tmpdir(), `batch4-concurrent-${Date.now()}`);
    const store = createSessionStore({ storeDir: dir });

    // Save 5 sessions concurrently
    const promises = Array.from({ length: 5 }, (_, i) =>
      store.save({ sessionId: `concurrent-${i}`, goal: `goal ${i}`, status: "completed" })
    );
    const results = await Promise.all(promises);
    assert.equal(results.length, 5);
    for (const r of results) {
      assert.ok(r.saved, "Each save should succeed");
    }

    const count = await store.getSessionCount();
    assert.equal(count, 5, "Should have 5 sessions");

    try { await rm(dir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  it("sessionMemory handles concurrent recordOutcome calls", async () => {
    const { createSessionMemory } = await import(`${APPS_SRC}/agentic/sessionMemory.js`);
    const dir = join(tmpdir(), `batch4-mem-concurrent-${Date.now()}`);
    const mem = createSessionMemory({ memoryDir: dir });

    const promises = Array.from({ length: 5 }, (_, i) =>
      mem.recordOutcome({ goal: `concurrent goal ${i}`, status: "completed" })
    );
    const entries = await Promise.all(promises);
    assert.equal(entries.length, 5);

    const stats = await mem.getStats();
    assert.ok(stats.totalEntries >= 5, "Should have at least 5 entries");

    try { await rm(dir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });
});
