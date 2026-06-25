/**
 * Tests for P6-P1P2 AdaptiveScaling module.
 *
 * Coverage:
 *   - Constructor defaults and custom options
 *   - All public methods (record, getRecommendedWorkers, applyScaling,
 *     getMetrics, getHistory, setManual, setAutoScaling, getStatus,
 *     reset, isInCooldown)
 *   - Edge cases (empty state, boundaries, cooldown, clamping)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

describe('AdaptiveScaling', () => {
  let AdaptiveScaling;

  before(async () => {
    const mod = await import('../src/adaptive-scaling/index.js');
    AdaptiveScaling = mod.AdaptiveScaling;
  });

  // ── Constructor ────────────────────────────────────────────────────────

  it('should construct with default options', () => {
    const scaler = new AdaptiveScaling();
    const status = scaler.getStatus();
    assert.equal(status.currentWorkers, 4);
    assert.equal(status.minWorkers, 1);
    assert.equal(status.maxWorkers, 16);
    assert.equal(status.autoScaling, true);
    assert.equal(status.cooldown, false);
  });

  it('should accept custom options', () => {
    const scaler = new AdaptiveScaling({
      minWorkers: 2, maxWorkers: 20, currentWorkers: 8,
    });
    const status = scaler.getStatus();
    assert.equal(status.currentWorkers, 8);
    assert.equal(status.minWorkers, 2);
    assert.equal(status.maxWorkers, 20);
  });

  it('should clamp currentWorkers between min and max', () => {
    const s1 = new AdaptiveScaling({ minWorkers: 2, maxWorkers: 10, currentWorkers: 1 });
    assert.equal(s1.getStatus().currentWorkers, 2);

    const s2 = new AdaptiveScaling({ minWorkers: 2, maxWorkers: 10, currentWorkers: 50 });
    assert.equal(s2.getStatus().currentWorkers, 10);
  });

  it('should ensure maxWorkers is at least minWorkers', () => {
    const scaler = new AdaptiveScaling({ minWorkers: 10, maxWorkers: 5 });
    const status = scaler.getStatus();
    assert.equal(status.maxWorkers, 10);
  });

  // ── record() ───────────────────────────────────────────────────────────

  it('should record data points', () => {
    const scaler = new AdaptiveScaling();
    scaler.record({ queueDepth: 10, activeWorkers: 4, avgExecutionTime: 5000, successRate: 0.95 });
    const metrics = scaler.getMetrics();
    assert.equal(metrics.queueDepth.current, 10);
    assert.equal(metrics.successRate.current, 0.95);
  });

  it('should maintain sliding window of samples', () => {
    const scaler = new AdaptiveScaling({ sampleWindow: 3 });
    for (let i = 0; i < 10; i++) {
      scaler.record({ queueDepth: i, activeWorkers: 1, avgExecutionTime: 100, successRate: 1 });
    }
    const metrics = scaler.getMetrics();
    // Only last 3 samples should remain: queueDepth 7, 8, 9
    assert.equal(metrics.queueDepth.current, 9);
    assert.ok(Math.abs(metrics.queueDepth.avg - 8) < 0.01);
  });

  it('should fill in defaults for missing data point fields', () => {
    const scaler = new AdaptiveScaling();
    scaler.record({});
    const metrics = scaler.getMetrics();
    assert.equal(metrics.queueDepth.current, 0);
    assert.equal(metrics.successRate.current, 1);
  });

  // ── getRecommendedWorkers() ────────────────────────────────────────────

  it('should return hold when no samples recorded', () => {
    const scaler = new AdaptiveScaling();
    const rec = scaler.getRecommendedWorkers();
    assert.equal(rec.action, 'hold');
    assert.equal(rec.reason, 'No samples recorded yet');
  });

  it('should recommend scale_up on high utilization with deep queue', () => {
    const scaler = new AdaptiveScaling({ currentWorkers: 4, cooldownMs: 0 });
    // utilization = 4/4 = 1.0 > 0.8, queueDepth 10 > currentWorkers 4
    scaler.record({ queueDepth: 10, activeWorkers: 4, avgExecutionTime: 5000, successRate: 0.95 });
    const rec = scaler.getRecommendedWorkers();
    assert.equal(rec.action, 'scale_up');
    assert.ok(rec.recommended > 4);
    assert.ok(rec.recommended <= 16);
  });

  it('should recommend scale_down on low utilization with shallow queue', () => {
    const scaler = new AdaptiveScaling({ currentWorkers: 10, cooldownMs: 0 });
    // utilization = 2/10 = 0.2 < 0.3, queueDepth 1 < 10*0.5=5
    scaler.record({ queueDepth: 1, activeWorkers: 2, avgExecutionTime: 100, successRate: 1 });
    const rec = scaler.getRecommendedWorkers();
    assert.equal(rec.action, 'scale_down');
    assert.ok(rec.recommended < 10);
    assert.ok(rec.recommended >= 1);
  });

  it('should recommend hold when utilization is in acceptable range', () => {
    const scaler = new AdaptiveScaling({ currentWorkers: 10, cooldownMs: 0 });
    // utilization = 5/10 = 0.5 (between 0.3 and 0.8)
    scaler.record({ queueDepth: 5, activeWorkers: 5, avgExecutionTime: 1000, successRate: 0.9 });
    const rec = scaler.getRecommendedWorkers();
    assert.equal(rec.action, 'hold');
  });

  it('should return hold when auto-scaling is disabled', () => {
    const scaler = new AdaptiveScaling();
    scaler.setAutoScaling(false);
    scaler.record({ queueDepth: 100, activeWorkers: 16, avgExecutionTime: 10000, successRate: 0.5 });
    const rec = scaler.getRecommendedWorkers();
    assert.equal(rec.action, 'hold');
    assert.ok(rec.reason.includes('disabled'));
  });

  it('should return hold during cooldown', () => {
    const scaler = new AdaptiveScaling({ cooldownMs: 60000 });
    scaler.applyScaling(8); // triggers cooldown
    scaler.record({ queueDepth: 100, activeWorkers: 8, avgExecutionTime: 10000, successRate: 0.5 });
    const rec = scaler.getRecommendedWorkers();
    assert.equal(rec.action, 'hold');
    assert.ok(rec.reason.includes('Cooldown'));
  });

  // ── applyScaling() ─────────────────────────────────────────────────────

  it('should apply scaling and clamp to [min, max]', () => {
    const scaler = new AdaptiveScaling({ minWorkers: 2, maxWorkers: 10, currentWorkers: 5 });
    const result = scaler.applyScaling(20);
    assert.equal(result.previous, 5);
    assert.equal(result.current, 10);
    assert.equal(result.change, 5);
  });

  it('should record scaling events', () => {
    const scaler = new AdaptiveScaling();
    scaler.applyScaling(8);
    scaler.applyScaling(4);
    const history = scaler.getHistory();
    assert.equal(history.length, 2);
    assert.equal(history[0].from, 4); // default
    assert.equal(history[0].to, 8);
    assert.equal(history[1].from, 8);
    assert.equal(history[1].to, 4);
  });

  it('should start cooldown after applyScaling', () => {
    const scaler = new AdaptiveScaling({ cooldownMs: 60000 });
    assert.equal(scaler.isInCooldown(), false);
    scaler.applyScaling(8);
    assert.equal(scaler.isInCooldown(), true);
  });

  // ── getMetrics() ───────────────────────────────────────────────────────

  it('should return empty metrics when no samples recorded', () => {
    const scaler = new AdaptiveScaling();
    const m = scaler.getMetrics();
    assert.equal(m.queueDepth.current, 0);
    assert.equal(m.executionTime.avg, 0);
    assert.equal(m.successRate.current, 1);
    assert.equal(m.utilization, 0);
  });

  it('should compute averages and trends from samples', () => {
    const scaler = new AdaptiveScaling();
    for (let i = 1; i <= 5; i++) {
      scaler.record({ queueDepth: i * 10, activeWorkers: i, avgExecutionTime: i * 100, successRate: 0.9 });
    }
    const m = scaler.getMetrics();
    assert.equal(m.queueDepth.current, 50);
    assert.ok(m.queueDepth.avg > 0);
    assert.equal(m.executionTime.avg, 300);
    assert.ok(m.executionTime.p95 > 0);
    assert.equal(m.queueDepth.trend, 'up');
  });

  // ── getHistory() ───────────────────────────────────────────────────────

  it('should filter history by action type', () => {
    const scaler = new AdaptiveScaling({ minWorkers: 1, maxWorkers: 20, currentWorkers: 5 });
    scaler.applyScaling(10); // scale up
    scaler.applyScaling(3);  // scale down
    scaler.applyScaling(8);  // scale up

    const upEvents = scaler.getHistory({ action: 'scale_up' });
    assert.equal(upEvents.length, 2);

    const downEvents = scaler.getHistory({ action: 'scale_down' });
    assert.equal(downEvents.length, 1);
  });

  it('should limit history results', () => {
    const scaler = new AdaptiveScaling();
    scaler.applyScaling(5);
    scaler.applyScaling(6);
    scaler.applyScaling(7);
    const limited = scaler.getHistory({ limit: 2 });
    assert.equal(limited.length, 2);
  });

  // ── setManual() / setAutoScaling() ─────────────────────────────────────

  it('should set manual worker count and disable auto-scaling', () => {
    const scaler = new AdaptiveScaling({ currentWorkers: 4 });
    const result = scaler.setManual(8);
    assert.equal(result.previous, 4);
    assert.equal(result.current, 8);
    assert.equal(scaler.getStatus().autoScaling, false);
  });

  it('should clamp manual count to [min, max]', () => {
    const scaler = new AdaptiveScaling({ minWorkers: 2, maxWorkers: 10 });
    scaler.setManual(100);
    assert.equal(scaler.getStatus().currentWorkers, 10);
    scaler.setManual(0);
    assert.equal(scaler.getStatus().currentWorkers, 2);
  });

  it('should re-enable auto-scaling via setAutoScaling(true)', () => {
    const scaler = new AdaptiveScaling();
    scaler.setAutoScaling(false);
    assert.equal(scaler.getStatus().autoScaling, false);
    scaler.setAutoScaling(true);
    assert.equal(scaler.getStatus().autoScaling, true);
  });

  // ── getStatus() ────────────────────────────────────────────────────────

  it('should return comprehensive status', () => {
    const scaler = new AdaptiveScaling({ minWorkers: 2, maxWorkers: 20, currentWorkers: 6 });
    scaler.record({ queueDepth: 5, activeWorkers: 3, avgExecutionTime: 1000, successRate: 0.95 });
    const status = scaler.getStatus();
    assert.equal(status.currentWorkers, 6);
    assert.equal(status.minWorkers, 2);
    assert.equal(status.maxWorkers, 20);
    assert.equal(status.autoScaling, true);
    assert.equal(status.cooldown, false);
    assert.ok(typeof status.utilization === 'number');
    assert.ok(['up', 'down', 'stable'].includes(status.trend));
  });

  it('should report utilization 0 when no samples', () => {
    const scaler = new AdaptiveScaling();
    assert.equal(scaler.getStatus().utilization, 0);
  });

  // ── reset() ────────────────────────────────────────────────────────────

  it('should reset samples and history but preserve config and workers', () => {
    const scaler = new AdaptiveScaling({ currentWorkers: 8 });
    scaler.record({ queueDepth: 10, activeWorkers: 4, avgExecutionTime: 1000, successRate: 1 });
    scaler.applyScaling(10); // changes currentWorkers to 10
    scaler.reset();

    assert.equal(scaler.getHistory().length, 0);
    assert.equal(scaler.getMetrics().queueDepth.current, 0);
    assert.equal(scaler.isInCooldown(), false);
    // currentWorkers is preserved (not reverted to initial 8)
    assert.equal(scaler.getStatus().currentWorkers, 10);
  });
});
