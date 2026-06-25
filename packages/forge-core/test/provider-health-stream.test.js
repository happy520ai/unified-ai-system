/**
 * Provider Health & Stream Diagnostics Test Suite
 *
 * Tests for:
 *   - Provider Health Tracking (health stats in HttpLLMProviderAdapter)
 *   - Stream State Diagnostics (streamState in HttpLLMProviderAdapter)
 *
 * All external dependencies are mocked - no real LLM or network calls.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

// ============================================================
// 1. Provider Health Tracking
// ============================================================

describe("Provider Health Tracking", () => {
  let HttpLLMProviderAdapter;

  before(async () => {
    const mod = await import(
      "../../../apps/ai-gateway-service/src/providers/httpLlmProviderAdapter.js"
    );
    HttpLLMProviderAdapter = mod.HttpLLMProviderAdapter;
  });

  function createDryRunAdapter() {
    return new HttpLLMProviderAdapter(
      {
        providerId: "test-provider",
        modelId: "test-model",
        endpoint: "https://api.test.local/v1",
        apiKey: "test-key-for-dry-run",
        enabled: true,
        dryRun: true,
      },
      {}
    );
  }

  it("should have health fields initialized on creation", () => {
    const adapter = createDryRunAdapter();
    const health = adapter.health;

    assert.ok(health, "health should be defined");
    assert.equal(health.providerId, "test-provider");
    assert.equal(health.modelId, "test-model");
    assert.equal(health.totalRequests, 0, "totalRequests should start at 0");
    assert.equal(health.successfulRequests, 0, "successfulRequests should start at 0");
    assert.equal(health.failedRequests, 0, "failedRequests should start at 0");
    assert.equal(health.successRate, null, "successRate should be null with no requests");
    assert.equal(health.averageLatencyMs, null, "averageLatencyMs should be null with no requests");
    assert.ok(typeof health.uptimeMs === "number", "uptimeMs should be a number");
  });

  it("should not change health stats in dryRun mode", async () => {
    const adapter = createDryRunAdapter();

    // Call generate in dryRun mode
    const response = await adapter.generate({
      request: { messages: [{ role: "user", content: "hello" }] },
      target: { providerId: "test-provider", modelId: "test-model" },
    });

    assert.ok(response, "dryRun response should exist");
    assert.equal(response.executionStatus, "dry_run");

    const health = adapter.health;
    // Dry run bypasses _generateOnce, so health counters stay at 0
    assert.equal(health.totalRequests, 0, "dryRun should not increment totalRequests");
    assert.equal(health.successfulRequests, 0, "dryRun should not increment successfulRequests");
  });

  it("should reset health stats with resetHealth()", () => {
    const adapter = createDryRunAdapter();

    // Manually mutate internal health to simulate prior activity
    adapter._health.totalRequests = 10;
    adapter._health.successfulRequests = 8;
    adapter._health.failedRequests = 2;
    adapter._health.totalLatencyMs = 5000;
    adapter._health.errors = { TIMEOUT: 1, NETWORK: 1 };
    adapter._health.lastSuccessAt = "2025-01-01T00:00:00.000Z";
    adapter._health.lastFailureAt = "2025-01-01T00:01:00.000Z";

    // Verify non-zero state
    assert.equal(adapter.health.totalRequests, 10);

    // Reset
    adapter.resetHealth();

    const health = adapter.health;
    assert.equal(health.totalRequests, 0, "totalRequests should reset to 0");
    assert.equal(health.successfulRequests, 0, "successfulRequests should reset to 0");
    assert.equal(health.failedRequests, 0, "failedRequests should reset to 0");
    assert.equal(health.retriedRequests, 0, "retriedRequests should reset to 0");
    assert.equal(health.successRate, null, "successRate should be null after reset");
    assert.equal(health.averageLatencyMs, null, "averageLatencyMs should be null after reset");
    assert.equal(health.lastSuccessAt, null, "lastSuccessAt should be null after reset");
    assert.equal(health.lastFailureAt, null, "lastFailureAt should be null after reset");
    assert.deepStrictEqual(health.errorDistribution, {}, "errors should be empty after reset");
  });
});

// ============================================================
// 2. Stream State Diagnostics
// ============================================================

describe("Stream State Diagnostics", () => {
  let HttpLLMProviderAdapter;

  before(async () => {
    const mod = await import(
      "../../../apps/ai-gateway-service/src/providers/httpLlmProviderAdapter.js"
    );
    HttpLLMProviderAdapter = mod.HttpLLMProviderAdapter;
  });

  function createDryRunAdapter() {
    return new HttpLLMProviderAdapter(
      {
        providerId: "stream-test",
        modelId: "stream-model",
        endpoint: "https://api.test.local/v1",
        apiKey: "test-key",
        enabled: true,
        dryRun: true,
      },
      {}
    );
  }

  it("should have streamState as null initially", () => {
    const adapter = createDryRunAdapter();
    assert.equal(adapter.streamState, null, "streamState should be null before any stream");
  });

  it("should produce a dry-run stream without setting streamState", async () => {
    const adapter = createDryRunAdapter();

    const chunks = [];
    for await (const chunk of adapter.generateStream({
      request: { messages: [{ role: "user", content: "hi" }] },
      target: { providerId: "stream-test", modelId: "stream-model" },
    })) {
      chunks.push(chunk);
    }

    assert.ok(chunks.length > 0, "dry-run stream should yield at least one chunk");
    assert.ok(chunks[0].textDelta, "chunk should have textDelta");
    assert.ok(chunks[0].raw?.dryRun, "chunk should indicate dryRun");

    // Dry run returns early before setting _streamState
    assert.equal(adapter.streamState, null, "dryRun stream should not set streamState");
  });
});
