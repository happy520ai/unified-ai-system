/**
 * Smart Model Router + Agentic Coding Loop Test Suite
 *
 * Tests for:
 *   - Smart Model Router (complexity analysis + model recommendation)
 *   - Agentic Coding Loop (compact messages, loop options)
 *
 * All external dependencies are mocked - no real LLM or network calls.
 */

import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

// ============================================================
// 1. Smart Model Router
// ============================================================

describe("Smart Model Router", () => {
  let router;

  before(async () => {
    router = await import(
      "../../../apps/ai-gateway-service/src/agentic/smartModelRouter.js"
    );
  });

  describe("TIERS", () => {
    it("should have FAST, STANDARD, and POWER tiers", () => {
      assert.ok(router.TIERS, "TIERS should be defined");
      assert.equal(router.TIERS.FAST, "fast");
      assert.equal(router.TIERS.STANDARD, "standard");
      assert.equal(router.TIERS.POWER, "power");
    });
  });

  describe("analyzeComplexity", () => {
    it("should classify a simple goal as FAST tier with low score", () => {
      const result = router.analyzeComplexity("fix typo in README");
      assert.ok(result, "result should exist");
      assert.ok(typeof result.score === "number", "score should be a number");
      assert.equal(result.tier, router.TIERS.FAST);
      assert.ok(result.score < 0.3, `score ${result.score} should be < 0.3 for FAST`);
      assert.ok(Array.isArray(result.signals), "signals should be an array");
    });

    it("should classify a medium complexity goal as STANDARD tier", () => {
      const result = router.analyzeComplexity(
        "implement a function that parses CSV files, validates each row against a schema, handles malformed data gracefully, and returns structured data objects for the data pipeline module"
      );
      assert.ok(result, "result should exist");
      assert.equal(result.tier, router.TIERS.STANDARD);
      assert.ok(
        result.score >= 0.3 && result.score < 0.65,
        `score ${result.score} should be in STANDARD range [0.3, 0.65)`
      );
    });

    it("should classify a complex goal as POWER tier", () => {
      const result = router.analyzeComplexity(
        "Refactor all 12 files across the project to use the new API pattern, migrate from callbacks to async/await, and add comprehensive tests"
      );
      assert.ok(result, "result should exist");
      assert.equal(result.tier, router.TIERS.POWER);
      assert.ok(
        result.score >= 0.65,
        `score ${result.score} should be >= 0.65 for POWER`
      );
    });

    it("should detect many_files signal for goals mentioning 8 files", () => {
      const result = router.analyzeComplexity("fix bugs in 8 files");
      assert.ok(result, "result should exist");
      const hasManyFiles = result.signals.some((s) => s.startsWith("many_files"));
      assert.ok(hasManyFiles, `signals should include many_files: ${JSON.stringify(result.signals)}`);
    });

    it("should detect multi_round signal for goals with many rounds", () => {
      const result = router.analyzeComplexity(
        "implement all 4 rounds of changes across the codebase"
      );
      assert.ok(result, "result should exist");
      const hasMultiRound = result.signals.some((s) => s.startsWith("multi_round"));
      assert.ok(
        hasMultiRound,
        `signals should include multi_round: ${JSON.stringify(result.signals)}`
      );
    });

    it("should detect short_goal signal for very short goals", () => {
      const result = router.analyzeComplexity("read config");
      assert.ok(result, "result should exist");
      const hasShortGoal = result.signals.some((s) => s.startsWith("short_goal"));
      assert.ok(
        hasShortGoal,
        `signals should include short_goal: ${JSON.stringify(result.signals)}`
      );
    });

    it("should return default STANDARD for null/empty input", () => {
      const result = router.analyzeComplexity(null);
      assert.ok(result, "result should exist even for null");
      assert.equal(result.tier, router.TIERS.STANDARD);
      assert.equal(result.score, 0.5);
      assert.deepStrictEqual(result.signals, []);
    });

    it("should return default STANDARD for non-string input", () => {
      const result = router.analyzeComplexity(42);
      assert.equal(result.tier, router.TIERS.STANDARD);
    });

    it("should clamp score to [0, 1] range", () => {
      const simpleResult = router.analyzeComplexity("fix one line");
      assert.ok(simpleResult.score >= 0, "score should not be negative");
      assert.ok(simpleResult.score <= 1, "score should not exceed 1");
    });
  });

  describe("recommendModel", () => {
    it("should return tier only with null model when no models available", () => {
      const result = router.recommendModel("fix typo in README", {
        availableModels: [],
      });
      assert.ok(result, "result should exist");
      assert.equal(result.tier, router.TIERS.FAST);
      assert.equal(result.recommendedModel, null);
      assert.ok(typeof result.reason === "string", "reason should be a string");
      assert.ok(result.complexity, "complexity should be included");
    });

    it("should return matching model for the detected tier", () => {
      const models = [
        { providerId: "openai", modelId: "gpt-4o-mini", tier: "fast" },
        { providerId: "openai", modelId: "gpt-4o", tier: "standard" },
        { providerId: "anthropic", modelId: "claude-opus-4", tier: "power" },
      ];
      const result = router.recommendModel("fix typo in README", {
        availableModels: models,
      });
      assert.ok(result.recommendedModel, "should recommend a model");
      assert.equal(result.recommendedModel.tier, "fast");
      assert.equal(result.recommendedModel.modelId, "gpt-4o-mini");
    });

    it("should filter by maxCostTier preference", () => {
      const models = [
        { providerId: "openai", modelId: "gpt-4o-mini", tier: "fast" },
        { providerId: "openai", modelId: "gpt-4o", tier: "standard" },
        { providerId: "anthropic", modelId: "claude-opus-4", tier: "power" },
      ];
      const result = router.recommendModel(
        "Refactor all 12 files across the project to use the new API pattern, migrate from callbacks to async/await, and add comprehensive tests",
        {
          availableModels: models,
          preferences: { maxCostTier: "standard" },
        }
      );
      assert.ok(result.recommendedModel, "should recommend a model");
      // POWER tier goal with maxCostTier=standard should fall back to standard or adjacent
      assert.notEqual(
        result.recommendedModel.tier,
        "power",
        "should not recommend power model when maxCostTier is standard"
      );
    });

    it("should fall back to adjacent tier when exact match is unavailable", () => {
      const models = [
        { providerId: "openai", modelId: "gpt-4o", tier: "standard" },
      ];
      // Simple goal wants FAST, but only STANDARD available
      const result = router.recommendModel("fix typo in README", {
        availableModels: models,
      });
      assert.ok(result.recommendedModel, "should still recommend a model");
      assert.equal(result.recommendedModel.modelId, "gpt-4o");
    });

    it("should use inferModelTier when models lack explicit tier", () => {
      const models = [
        { providerId: "meta", modelId: "meta/llama-3.1-8b-instruct" },
        { providerId: "openai", modelId: "gpt-4o" },
      ];
      const result = router.recommendModel("fix typo in README", {
        availableModels: models,
      });
      assert.ok(result.recommendedModel, "should recommend a model");
      // FAST tier goal, llama-8b should be inferred as FAST
      assert.equal(result.recommendedModel.modelId, "meta/llama-3.1-8b-instruct");
    });
  });

  describe("inferModelTier", () => {
    it("should classify llama-3.1-8b-instruct as FAST", () => {
      assert.equal(
        router.inferModelTier("meta/llama-3.1-8b-instruct"),
        router.TIERS.FAST
      );
    });

    it("should classify gpt-4o as STANDARD", () => {
      assert.equal(router.inferModelTier("gpt-4o"), router.TIERS.STANDARD);
    });

    it("should classify claude-opus-4 as POWER", () => {
      assert.equal(router.inferModelTier("claude-opus-4"), router.TIERS.POWER);
    });

    it("should classify deepseek-r1 as POWER", () => {
      assert.equal(router.inferModelTier("deepseek-r1"), router.TIERS.POWER);
    });

    it("should classify gemini-2.0-flash as FAST", () => {
      assert.equal(router.inferModelTier("gemini-2.0-flash"), router.TIERS.FAST);
    });

    it("should default to STANDARD for null/undefined", () => {
      assert.equal(router.inferModelTier(null), router.TIERS.STANDARD);
      assert.equal(router.inferModelTier(undefined), router.TIERS.STANDARD);
    });
  });
});

// ============================================================
// 2. Agentic Coding Loop (compact messages / loop options)
// ============================================================

describe("Agentic Coding Loop", () => {
  let createAgenticLoop;

  before(async () => {
    const mod = await import(
      "../../../apps/ai-gateway-service/src/agentic/agenticCodingLoop.js"
    );
    createAgenticLoop = mod.createAgenticLoop;
  });

  it("should create a loop with default options", () => {
    const mockAdapter = {
      generate: async () => ({
        text: "done",
        message: { role: "assistant", content: "done" },
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      }),
    };

    const loop = createAgenticLoop({ providerAdapter: mockAdapter });
    const info = loop.getInfo();

    assert.ok(info, "getInfo() should return an object");
    assert.equal(info.maxIterations, 25, "default maxIterations should be 25");
    assert.equal(info.maxTokensPerTurn, 4096, "default maxTokensPerTurn should be 4096");
    assert.equal(info.permissionMode, "default");
    assert.equal(info.planningEnabled, false);
    assert.ok(info.toolCount > 0, "should have registered tools");
    assert.equal(info.hasAutoContext, true);
    assert.equal(info.hasProjectInstructions, true);
    assert.equal(info.hasSubagentDispatch, true);
  });

  it("should accept custom maxIterations and maxTokensPerTurn", () => {
    const mockAdapter = {
      generate: async () => ({
        text: "done",
        message: { role: "assistant", content: "done" },
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      }),
    };

    const loop = createAgenticLoop({
      providerAdapter: mockAdapter,
      maxIterations: 10,
      maxTokensPerTurn: 2048,
    });
    const info = loop.getInfo();

    assert.equal(info.maxIterations, 10);
    assert.equal(info.maxTokensPerTurn, 2048);
  });

  it("should accept planningEnabled option", () => {
    const mockAdapter = {
      generate: async () => ({
        text: "done",
        message: { role: "assistant", content: "done" },
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      }),
    };

    const loop = createAgenticLoop({
      providerAdapter: mockAdapter,
      planningEnabled: true,
      maxPlanSteps: 5,
    });
    const info = loop.getInfo();

    assert.equal(info.planningEnabled, true);
    assert.equal(info.maxPlanSteps, 5);
  });

  it("should throw when providerAdapter is missing", () => {
    assert.throws(
      () => createAgenticLoop({}),
      /providerAdapter/,
      "should throw when providerAdapter is missing"
    );
  });

  it("should expose tool registry via getToolRegistry", () => {
    const mockAdapter = {
      generate: async () => ({
        text: "done",
        message: { role: "assistant", content: "done" },
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      }),
    };

    const loop = createAgenticLoop({ providerAdapter: mockAdapter });
    const registry = loop.getToolRegistry();

    assert.ok(registry, "getToolRegistry should return a registry");
    assert.ok(typeof registry.listTools === "function", "registry should have listTools");
    assert.ok(typeof registry.executeTool === "function", "registry should have executeTool");
  });

  it("should return error for empty goal on execute", async () => {
    const mockAdapter = {
      generate: async () => ({
        text: "done",
        message: { role: "assistant", content: "done" },
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      }),
    };

    const loop = createAgenticLoop({ providerAdapter: mockAdapter });
    const result = await loop.execute({ goal: "" });

    assert.equal(result.status, "error");
    assert.ok(result.error, "should have error object");
    assert.equal(result.error.code, "AGENTIC_GOAL_EMPTY");
  });
});
