// =============================================================================
// sloTracker.test.js — SLO 跟踪器单元测试
// =============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSloTracker } from "./sloTracker.js";

describe("SloTracker", () => {
  it("should record requests and calculate percentiles", () => {
    const tracker = createSloTracker({ windowSizeMs: 60_000 });
    for (let i = 0; i < 100; i++) {
      tracker.record({ latencyMs: 100 + i, statusCode: 200 });
    }
    const percentiles = tracker.getLatencyPercentiles();
    assert.ok(percentiles.p50 > 0);
    assert.ok(percentiles.p95 > percentiles.p50);
    assert.ok(percentiles.p99 >= percentiles.p95);
  });

  it("should calculate error rate", () => {
    const tracker = createSloTracker();
    for (let i = 0; i < 90; i++) tracker.record({ latencyMs: 100, statusCode: 200 });
    for (let i = 0; i < 10; i++) tracker.record({ latencyMs: 100, statusCode: 500 });
    const errorRate = tracker.getErrorRate();
    assert.equal(errorRate.total, 100);
    assert.equal(errorRate.errors, 10);
    assert.ok(Math.abs(errorRate.errorRate - 0.1) < 0.01);
  });

  it("should report SLO compliance", () => {
    const tracker = createSloTracker();
    for (let i = 0; i < 100; i++) {
      tracker.record({ latencyMs: 500, statusCode: 200 });
    }
    const snapshot = tracker.getSnapshot();
    assert.equal(snapshot.sloMet, true);
    assert.equal(snapshot.sloCompliance.latencyP99, true);
    assert.equal(snapshot.sloCompliance.errorRate, true);
  });

  it("should report SLO violation for high error rate", () => {
    const tracker = createSloTracker();
    for (let i = 0; i < 50; i++) tracker.record({ latencyMs: 100, statusCode: 200 });
    for (let i = 0; i < 50; i++) tracker.record({ latencyMs: 100, statusCode: 500 });
    const snapshot = tracker.getSnapshot();
    assert.equal(snapshot.sloMet, false);
    assert.equal(snapshot.sloCompliance.errorRate, false);
  });

  it("should generate latency histogram", () => {
    const tracker = createSloTracker();
    tracker.record({ latencyMs: 50, statusCode: 200 });
    tracker.record({ latencyMs: 150, statusCode: 200 });
    tracker.record({ latencyMs: 5000, statusCode: 200 });
    const histogram = tracker.getLatencyHistogram();
    assert.ok(histogram.length > 0);
    const total = histogram.reduce((sum, b) => sum + b.count, 0);
    assert.equal(total, 3);
  });

  it("should calculate throughput", () => {
    const tracker = createSloTracker();
    tracker.record({ latencyMs: 10, statusCode: 200 });
    // Throughput is calculated from first request to now; even 1 request gives > 0
    const throughput = tracker.getThroughput();
    assert.ok(typeof throughput === "number");
  });

  it("should handle empty tracker", () => {
    const tracker = createSloTracker();
    const snapshot = tracker.getSnapshot();
    assert.equal(snapshot.requestCount, 0);
    assert.equal(snapshot.latency.p50, 0);
  });
});
