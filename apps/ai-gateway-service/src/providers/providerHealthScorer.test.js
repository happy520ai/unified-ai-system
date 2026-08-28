// =============================================================================
// providerHealthScorer.test.js — 健康评分引擎单元测试
// =============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createProviderHealthScorer } from "./providerHealthScorer.js";

describe("ProviderHealthScorer", () => {
  it("should return 50 for new provider with no data", () => {
    const scorer = createProviderHealthScorer();
    const score = scorer.getScore("new-provider");
    assert.equal(score, 50);
  });

  it("should increase score for successful requests", () => {
    const scorer = createProviderHealthScorer();
    scorer.recordSuccess("p1", 200);
    scorer.recordSuccess("p1", 300);
    scorer.recordSuccess("p1", 100);
    const score = scorer.getScore("p1");
    assert.ok(score > 50, `Expected score > 50, got ${score}`);
  });

  it("should decrease score for failed requests", () => {
    const scorer = createProviderHealthScorer();
    scorer.recordFailure("p1", 500);
    scorer.recordFailure("p1", 500);
    scorer.recordFailure("p1", 500);
    const score = scorer.getScore("p1");
    // Failures reduce success rate component, but freshness keeps score near default
    assert.ok(score <= 50, `Expected score <= 50, got ${score}`);
  });

  it("should calculate weighted score correctly", () => {
    const scorer = createProviderHealthScorer();
    // 10 successes, 0 failures
    for (let i = 0; i < 10; i++) {
      scorer.recordSuccess("p1", 100);
    }
    const score = scorer.getScore("p1");
    assert.ok(score >= 80, `Expected score >= 80, got ${score}`);
  });

  it("should rank providers by score", () => {
    const scorer = createProviderHealthScorer();
    // p1: all success
    for (let i = 0; i < 10; i++) scorer.recordSuccess("p1", 100);
    // p2: all failure
    for (let i = 0; i < 10; i++) scorer.recordFailure("p2", 500);
    const ranked = scorer.getRankedProviders(["p1", "p2"]);
    assert.equal(ranked[0], "p1");
    assert.equal(ranked[1], "p2");
  });

  it("should return all scores", () => {
    const scorer = createProviderHealthScorer();
    scorer.recordSuccess("p1", 100);
    scorer.recordSuccess("p2", 200);
    const allScores = scorer.getAllScores();
    assert.ok(allScores.p1 !== undefined);
    assert.ok(allScores.p2 !== undefined);
  });

  it("should handle mixed success/failure", () => {
    const scorer = createProviderHealthScorer();
    // 7 successes, 3 failures
    for (let i = 0; i < 7; i++) scorer.recordSuccess("p1", 100);
    for (let i = 0; i < 3; i++) scorer.recordFailure("p1", 500);
    const score = scorer.getScore("p1");
    // Fresh and mostly successful — score in healthy range
    assert.ok(score >= 50, `Expected score >= 50, got ${score}`);
  });

  it("should expose a bounded observation snapshot for trusted routing facts", () => {
    const scorer = createProviderHealthScorer();
    assert.deepEqual(scorer.getSnapshot("unknown"), {
      sampleCount: 0,
      successRate: null,
      p50LatencyMs: null,
    });
    scorer.recordSuccess("p1", 100);
    scorer.recordFailure("p1", "timeout");
    scorer.recordSuccess("p1", 300);
    assert.deepEqual(scorer.getSnapshot("p1"), {
      sampleCount: 3,
      successRate: 2 / 3,
      p50LatencyMs: 300,
    });
    assert.equal(Object.isFrozen(scorer.getSnapshot("p1")), true);
  });

  it("should rank only the latest shared 100-event window instead of retaining stale successes", () => {
    const scorer = createProviderHealthScorer();
    for (let i = 0; i < 100; i++) scorer.recordSuccess("p1", 100);
    for (let i = 0; i < 100; i++) scorer.recordFailure("p1", "outage");
    assert.deepEqual(scorer.getSnapshot("p1"), {
      sampleCount: 100,
      successRate: 0,
      p50LatencyMs: null,
    });
    assert.ok(scorer.getScore("p1") <= 20);
  });
});
