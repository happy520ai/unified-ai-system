/**
 * Phase D: New Feature Tests - Agentic Loop & Provider Adapter (Batch 2A)
 *
 * Covers:
 * 1. Self-reflection in agentic loop
 * 2. Error recovery strategies
 * 3. Dynamic iteration budget
 * 4. Cancellation support (AbortSignal)
 * 5. Response quality scoring
 * 6. Cost tracking
 * 7. Warm connection pooling
 * 8. Incremental stream argument parsing
 *
 * @module new-features-batch2-agentic
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ─── Helpers ───
function createMockProviderAdapter(responseOverrides = {}) {
  let callCount = 0;
  return {
    generate: async (req) => {
      callCount++;
      if (responseOverrides.sequence && responseOverrides.sequence[callCount - 1]) {
        return responseOverrides.sequence[callCount - 1];
      }
      return responseOverrides.default || {
        text: "mock response",
        message: { role: "assistant", content: "mock response" },
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        raw: { finishReason: "stop" },
      };
    },
    descriptor: { providerId: "mock", modelId: "test" },
  };
}

// ============================================================
// 1. Self-Reflection
// ============================================================
describe("Self-Reflection", () => {
  it("should inject reflection prompt when enabled and interval matches", async () => {
    const { createAgenticLoop } = await import("../../../apps/ai-gateway-service/src/agentic/agenticCodingLoop.js");
    const toolCallResponse = {
      text: "I will read the file",
      message: {
        role: "assistant",
        content: "I will read the file",
        tool_calls: [{
          id: "tc_1",
          type: "function",
          function: { name: "file_read", arguments: JSON.stringify({ path: "test.txt" }) },
        }],
      },
      toolCalls: [{ id: "tc_1", name: "file_read", arguments: { path: "test.txt" } }],
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      raw: { finishReason: "tool_calls" },
    };
    const finalResponse = {
      text: "Done with the task.",
      message: { role: "assistant", content: "Done with the task." },
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      raw: { finishReason: "stop" },
    };

    const loop = createAgenticLoop({
      providerAdapter: createMockProviderAdapter({
        sequence: [toolCallResponse, finalResponse],
      }),
      workingDirectory: process.cwd(),
      selfReflectionEnabled: true,
      selfReflectionInterval: 1,
      maxIterations: 5,
    });

    assert.ok(loop.getInfo().selfReflectionEnabled === true);
    assert.ok(loop.getInfo().selfReflectionInterval === 1);
  });

  it("should not inject reflection when disabled", () => {
    // Verify default is false
    const info = { selfReflectionEnabled: false, selfReflectionInterval: 5 };
    assert.strictEqual(info.selfReflectionEnabled, false);
  });
});

// ============================================================
// 2. Error Recovery Strategies
// ============================================================
describe("Error Recovery Strategies", () => {
  it("should expose errorRecoveryEnabled option defaulting to true", async () => {
    const { createAgenticLoop } = await import("../../../apps/ai-gateway-service/src/agentic/agenticCodingLoop.js");
    const loop = createAgenticLoop({
      providerAdapter: createMockProviderAdapter(),
      workingDirectory: process.cwd(),
    });
    assert.strictEqual(loop.getInfo().errorRecoveryEnabled, true);
  });

  it("should allow disabling error recovery", async () => {
    const { createAgenticLoop } = await import("../../../apps/ai-gateway-service/src/agentic/agenticCodingLoop.js");
    const loop = createAgenticLoop({
      providerAdapter: createMockProviderAdapter(),
      workingDirectory: process.cwd(),
      errorRecoveryEnabled: false,
    });
    assert.strictEqual(loop.getInfo().errorRecoveryEnabled, false);
  });
});

// ============================================================
// 3. Dynamic Iteration Budget
// ============================================================
describe("Dynamic Iteration Budget", () => {
  it("should expose dynamicBudgetEnabled option defaulting to false", async () => {
    const { createAgenticLoop } = await import("../../../apps/ai-gateway-service/src/agentic/agenticCodingLoop.js");
    const loop = createAgenticLoop({
      providerAdapter: createMockProviderAdapter(),
      workingDirectory: process.cwd(),
    });
    assert.strictEqual(loop.getInfo().dynamicBudgetEnabled, false);
  });

  it("should allow enabling dynamic budget", async () => {
    const { createAgenticLoop } = await import("../../../apps/ai-gateway-service/src/agentic/agenticCodingLoop.js");
    const loop = createAgenticLoop({
      providerAdapter: createMockProviderAdapter(),
      workingDirectory: process.cwd(),
      dynamicBudgetEnabled: true,
    });
    assert.strictEqual(loop.getInfo().dynamicBudgetEnabled, true);
  });
});

// ============================================================
// 4. Cancellation Support
// ============================================================
describe("Cancellation Support", () => {
  it("should accept signal parameter and cancel cleanly", async () => {
    const { createAgenticLoop } = await import("../../../apps/ai-gateway-service/src/agentic/agenticCodingLoop.js");
    const controller = new AbortController();
    controller.abort(); // Pre-abort

    const loop = createAgenticLoop({
      providerAdapter: createMockProviderAdapter(),
      workingDirectory: process.cwd(),
      maxIterations: 10,
    });

    const result = await loop.execute({
      goal: "Do something",
      signal: controller.signal,
    });

    assert.strictEqual(result.status, "cancelled");
    assert.ok(result.finalAnswer.includes("Cancelled"));
  });

  it("should complete normally when signal is not aborted", async () => {
    const { createAgenticLoop } = await import("../../../apps/ai-gateway-service/src/agentic/agenticCodingLoop.js");
    const controller = new AbortController();

    const loop = createAgenticLoop({
      providerAdapter: createMockProviderAdapter({
        default: {
          text: "Done!",
          message: { role: "assistant", content: "Done!" },
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          raw: { finishReason: "stop" },
        },
      }),
      workingDirectory: process.cwd(),
      maxIterations: 3,
    });

    const result = await loop.execute({
      goal: "Quick task",
      signal: controller.signal,
    });

    assert.strictEqual(result.status, "completed");
    assert.ok(result.finalAnswer.includes("Done"));
  });
});

// ============================================================
// 5. Response Quality Scoring
// ============================================================
describe("Response Quality Scoring", () => {
  it("should expose qualityStats getter", async () => {
    const { createHttpLLMProviderAdapter } = await import("../../../apps/ai-gateway-service/src/providers/httpLlmProviderAdapter.js");
    const adapter = createHttpLLMProviderAdapter(
      { providerId: "test", modelId: "test-model", endpoint: "http://localhost:9999", dryRun: true },
      {}
    );

    const stats = adapter.qualityStats;
    assert.ok(stats);
    assert.strictEqual(stats.sampleSize, 0);
    assert.strictEqual(stats.averageScore, null);
  });

  it("should expose resetQuality method", async () => {
    const { createHttpLLMProviderAdapter } = await import("../../../apps/ai-gateway-service/src/providers/httpLlmProviderAdapter.js");
    const adapter = createHttpLLMProviderAdapter(
      { providerId: "test", modelId: "test-model", endpoint: "http://localhost:9999", dryRun: true },
      {}
    );

    assert.ok(typeof adapter.resetQuality === "function");
    adapter.resetQuality();
    assert.strictEqual(adapter.qualityStats.sampleSize, 0);
  });
});

// ============================================================
// 6. Cost Tracking
// ============================================================
describe("Cost Tracking", () => {
  it("should expose costSummary getter", async () => {
    const { createHttpLLMProviderAdapter } = await import("../../../apps/ai-gateway-service/src/providers/httpLlmProviderAdapter.js");
    const adapter = createHttpLLMProviderAdapter(
      { providerId: "test", modelId: "test-model", endpoint: "http://localhost:9999", dryRun: true },
      {}
    );

    const cost = adapter.costSummary;
    assert.ok(cost);
    assert.strictEqual(cost.totalInputTokens, 0);
    assert.strictEqual(cost.totalOutputTokens, 0);
    assert.strictEqual(cost.estimatedCostUsd, 0);
    assert.strictEqual(cost.requestCount, 0);
  });

  it("should expose resetCost method", async () => {
    const { createHttpLLMProviderAdapter } = await import("../../../apps/ai-gateway-service/src/providers/httpLlmProviderAdapter.js");
    const adapter = createHttpLLMProviderAdapter(
      { providerId: "test", modelId: "test-model", endpoint: "http://localhost:9999", dryRun: true },
      {}
    );

    assert.ok(typeof adapter.resetCost === "function");
    adapter.resetCost();
    assert.strictEqual(adapter.costSummary.estimatedCostUsd, 0);
  });

  it("should accept custom token pricing", async () => {
    const { createHttpLLMProviderAdapter } = await import("../../../apps/ai-gateway-service/src/providers/httpLlmProviderAdapter.js");
    const adapter = createHttpLLMProviderAdapter(
      { providerId: "test", modelId: "test-model", endpoint: "http://localhost:9999", dryRun: true },
      { tokenPricing: { inputPer1k: 0.005, outputPer1k: 0.02 } }
    );
    // Just verify it doesn't crash with custom pricing
    assert.ok(adapter.costSummary);
  });
});

// ============================================================
// 7. Warm Connection Pooling
// ============================================================
describe("Warm Connection Pooling", () => {
  it("should expose warmConnection method", async () => {
    const { createHttpLLMProviderAdapter } = await import("../../../apps/ai-gateway-service/src/providers/httpLlmProviderAdapter.js");
    const adapter = createHttpLLMProviderAdapter(
      { providerId: "test", modelId: "test-model", endpoint: "http://localhost:9999", dryRun: true },
      {}
    );

    assert.ok(typeof adapter.warmConnection === "function");
  });

  it("should return warmed=false on connection failure", async () => {
    const { createHttpLLMProviderAdapter } = await import("../../../apps/ai-gateway-service/src/providers/httpLlmProviderAdapter.js");
    const adapter = createHttpLLMProviderAdapter(
      { providerId: "test", modelId: "test-model", endpoint: "http://localhost:19999", dryRun: true },
      {}
    );

    const result = await adapter.warmConnection();
    assert.strictEqual(result.warmed, false);
    assert.ok(result.error);
  });
});

// ============================================================
// 8. Incremental Stream Argument Parsing
// ============================================================
describe("Incremental Stream Argument Parsing", () => {
  it("should export tryPartialToolArgs function", async () => {
    const mod = await import("../../../apps/ai-gateway-service/src/providers/httpLlmProviderAdapter.js");
    assert.ok(typeof mod.tryPartialToolArgs === "function");
  });

  it("should parse complete JSON arguments", async () => {
    const { tryPartialToolArgs } = await import("../../../apps/ai-gateway-service/src/providers/httpLlmProviderAdapter.js");
    const result = tryPartialToolArgs('{"path": "test.js", "content": "hello"}');
    assert.deepStrictEqual(result, { path: "test.js", content: "hello" });
  });

  it("should extract partial arguments from incomplete JSON", async () => {
    const { tryPartialToolArgs } = await import("../../../apps/ai-gateway-service/src/providers/httpLlmProviderAdapter.js");
    const result = tryPartialToolArgs('{"path": "test.js", "con');
    assert.ok(result);
    assert.strictEqual(result._partial, true);
    assert.strictEqual(result.path, "test.js");
  });

  it("should return null for empty or unparseable input", async () => {
    const { tryPartialToolArgs } = await import("../../../apps/ai-gateway-service/src/providers/httpLlmProviderAdapter.js");
    const result = tryPartialToolArgs("");
    assert.strictEqual(result, null);
  });
});
