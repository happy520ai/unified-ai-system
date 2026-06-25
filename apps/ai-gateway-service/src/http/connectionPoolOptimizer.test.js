// =============================================================================
// connectionPoolOptimizer.test.js — 连接池优化器单元测试
// =============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createConnectionPoolOptimizer } from "./connectionPoolOptimizer.js";

describe("ConnectionPoolOptimizer", () => {
  it("should accept connections within limits", () => {
    const pool = createConnectionPoolOptimizer({ maxConnections: 100, maxConnectionsPerHost: 10 });
    const result = pool.recordConnection("example.com");
    assert.equal(result.accepted, true);
  });

  it("should reject connections when max exceeded", () => {
    const pool = createConnectionPoolOptimizer({ maxConnections: 2, maxConnectionsPerHost: 10 });
    pool.recordConnection("a.com");
    pool.recordConnection("b.com");
    const result = pool.recordConnection("c.com");
    assert.equal(result.accepted, false);
    assert.equal(result.reason, "max_connections_exceeded");
  });

  it("should reject connections when per-host max exceeded", () => {
    const pool = createConnectionPoolOptimizer({ maxConnections: 100, maxConnectionsPerHost: 2 });
    pool.recordConnection("example.com");
    pool.recordConnection("example.com");
    const result = pool.recordConnection("example.com");
    assert.equal(result.accepted, false);
    assert.equal(result.reason, "max_host_connections_exceeded");
  });

  it("should track active connections correctly", () => {
    const pool = createConnectionPoolOptimizer({ maxConnections: 100 });
    pool.recordConnection("a.com");
    pool.recordConnection("b.com");
    const stats = pool.getStats();
    assert.equal(stats.activeConnections, 2);

    pool.recordDisconnection("a.com");
    const stats2 = pool.getStats();
    assert.equal(stats2.activeConnections, 1);
  });

  it("should trigger backpressure at threshold", () => {
    const pool = createConnectionPoolOptimizer({
      maxConnections: 10,
      backpressureThreshold: 0.8,
    });
    // Fill to 80%
    for (let i = 0; i < 8; i++) pool.recordConnection(`${i}.com`);
    const bp = pool.shouldThrottle();
    assert.equal(bp.shouldThrottle, true);
    assert.ok(bp.delayMs > 0);
  });

  it("should not trigger backpressure below threshold", () => {
    const pool = createConnectionPoolOptimizer({
      maxConnections: 10,
      backpressureThreshold: 0.8,
    });
    for (let i = 0; i < 5; i++) pool.recordConnection(`${i}.com`);
    const bp = pool.shouldThrottle();
    assert.equal(bp.shouldThrottle, false);
  });

  it("should return healthy status", () => {
    const pool = createConnectionPoolOptimizer({ maxConnections: 100 });
    pool.recordConnection("a.com");
    const health = pool.getHealth();
    assert.equal(health.status, "healthy");
    assert.equal(health.activeConnections, 1);
  });

  it("should return server config", () => {
    const pool = createConnectionPoolOptimizer();
    const config = pool.getServerConfig();
    assert.ok(config.keepAliveTimeout > 0);
    assert.ok(config.requestTimeout > 0);
  });

  it("should return agent config", () => {
    const pool = createConnectionPoolOptimizer();
    const config = pool.getAgentConfig();
    assert.equal(config.keepAlive, true);
    assert.ok(config.maxSockets > 0);
  });
});
