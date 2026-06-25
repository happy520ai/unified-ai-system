import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

let createMetricsCollector;

before(async () => {
  const mod = await import("./metricsCollector.js");
  createMetricsCollector = mod.createMetricsCollector;
});

describe("MetricsCollector — counters", () => {
  it("records HTTP request counts", () => {
    const mc = createMetricsCollector();
    mc.recordHttpRequest("GET", "/health/check", 200, 5);
    mc.recordHttpRequest("GET", "/health/check", 200, 10);
    mc.recordHttpRequest("POST", "/chat", 200, 150);

    const snap = mc.getSnapshot();
    const healthKey = Object.keys(snap.httpRequests).find(k => k.includes("health"));
    assert.ok(healthKey, "should have health check request recorded");
  });

  it("records auth attempts", () => {
    const mc = createMetricsCollector();
    mc.recordAuthAttempt("success");
    mc.recordAuthAttempt("success");
    mc.recordAuthAttempt("failure");

    const snap = mc.getSnapshot();
    const keys = Object.keys(snap.authAttempts);
    assert.ok(keys.length > 0);
  });

  it("records provider calls", () => {
    const mc = createMetricsCollector();
    mc.recordProviderCall("nvidia", "llama-3", 200);
    mc.recordProviderCall("nvidia", "llama-3", 500);

    const snap = mc.getSnapshot();
    assert.ok(Object.keys(snap.providerCalls).length > 0);
  });

  it("records audit events", () => {
    const mc = createMetricsCollector();
    mc.recordAuditEvent("allowed");
    mc.recordAuditEvent("denied");

    const snap = mc.getSnapshot();
    assert.ok(Object.keys(snap.auditEvents).length > 0);
  });
});

describe("MetricsCollector — gauges", () => {
  it("tracks active connections", () => {
    const mc = createMetricsCollector();
    mc.incrementConnections();
    mc.incrementConnections();
    mc.incrementConnections();
    mc.decrementConnections();

    const snap = mc.getSnapshot();
    assert.strictEqual(snap.activeConnections, 2);
  });

  it("connections never go below zero", () => {
    const mc = createMetricsCollector();
    mc.decrementConnections();
    mc.decrementConnections();

    const snap = mc.getSnapshot();
    assert.strictEqual(snap.activeConnections, 0);
  });

  it("tracks WebSocket connections", () => {
    const mc = createMetricsCollector();
    mc.incrementWsConnections();
    mc.incrementWsConnections();
    mc.decrementWsConnections();

    const snap = mc.getSnapshot();
    assert.strictEqual(snap.activeWsConnections, 1);
  });

  it("includes uptime", () => {
    const mc = createMetricsCollector();
    const snap = mc.getSnapshot();
    assert.ok(snap.uptimeSeconds >= 0);
  });

  it("includes memory usage", () => {
    const mc = createMetricsCollector();
    const snap = mc.getSnapshot();
    assert.ok(snap.memory.rss > 0);
    assert.ok(snap.memory.heapUsed > 0);
    assert.ok(snap.memory.heapTotal > 0);
  });
});

describe("MetricsCollector — Prometheus format", () => {
  it("outputs valid Prometheus text format", () => {
    const mc = createMetricsCollector();
    mc.recordHttpRequest("GET", "/health", 200, 5);
    mc.recordAuthAttempt("success");
    mc.incrementConnections();

    const output = mc.formatPrometheus();
    assert.ok(output.includes("# HELP"), "should contain HELP lines");
    assert.ok(output.includes("# TYPE"), "should contain TYPE lines");
    assert.ok(output.includes("gateway_uptime_seconds"), "should have uptime");
    assert.ok(output.includes("gateway_memory_bytes"), "should have memory");
    assert.ok(output.includes("gateway_active_connections"), "should have connections");
    assert.ok(output.includes("# EOF"), "should end with EOF");
  });

  it("includes histogram for request duration", () => {
    const mc = createMetricsCollector();
    mc.recordHttpRequest("GET", "/health", 200, 5);
    mc.recordHttpRequest("GET", "/health", 200, 150);

    const output = mc.formatPrometheus();
    assert.ok(output.includes("http_request_duration_ms_bucket"), "should have histogram buckets");
    assert.ok(output.includes("http_request_duration_ms_sum"), "should have histogram sum");
    assert.ok(output.includes("http_request_duration_ms_count"), "should have histogram count");
    assert.ok(output.includes('le="+Inf"'), "should have +Inf bucket");
  });

  it("normalizes paths (strips query strings)", () => {
    const mc = createMetricsCollector();
    mc.recordHttpRequest("GET", "/health?foo=bar", 200, 5);

    const output = mc.formatPrometheus();
    assert.ok(!output.includes("foo=bar"), "query string should be stripped");
    assert.ok(output.includes("/health"), "path should be preserved");
  });

  it("normalizes UUIDs in paths", () => {
    const mc = createMetricsCollector();
    mc.recordHttpRequest("GET", "/plans/550e8400-e29b-41d4-a716-446655440000/details", 200, 5);

    const output = mc.formatPrometheus();
    assert.ok(output.includes(":id"), "UUIDs should be replaced with :id");
    assert.ok(!output.includes("550e8400"), "raw UUID should not appear");
  });

  it("counter format is correct", () => {
    const mc = createMetricsCollector();
    mc.recordAuthAttempt("success");
    mc.recordAuthAttempt("success");
    mc.recordAuthAttempt("failure");

    const output = mc.formatPrometheus();
    assert.ok(output.includes('auth_attempts_total{outcome="success"} 2'));
    assert.ok(output.includes('auth_attempts_total{outcome="failure"} 1'));
  });
});
