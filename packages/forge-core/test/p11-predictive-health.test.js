/**
 * P11 PredictiveHealth — test suite.
 *
 * Run with:
 *   node --test packages/forge-core/test/p11-predictive-health.test.js
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import { PredictiveHealth } from '../src/predictive-health/index.js';

describe('PredictiveHealth', () => {
  let health;

  before(() => {
    health = new PredictiveHealth({ historyWindow: 50, alertThreshold: 0.5 });
  });

  // ── Construction ──────────────────────────────────────────────────────

  it('constructs with default options', () => {
    const h = new PredictiveHealth();
    const s = h.getStatus();
    assert.equal(s.monitoredModules, 0);
    assert.equal(s.totalSamples, 0);
  });

  it('constructs with custom options', () => {
    const h = new PredictiveHealth({ historyWindow: 200, alertThreshold: 0.9 });
    const s = h.getStatus();
    assert.equal(s.historyWindow, 200);
    assert.equal(s.alertThreshold, 0.9);
  });

  // ── recordSample ──────────────────────────────────────────────────────

  it('records samples for a module', () => {
    health.recordSample('worker-pool', {
      successRate: 0.95, avgLatency: 1200, errorRate: 0.05,
      queueDepth: 3, memoryUsage: 0.6, cpuUsage: 0.4,
    });
    health.recordSample('worker-pool', {
      successRate: 0.93, avgLatency: 1300, errorRate: 0.06,
      queueDepth: 4, memoryUsage: 0.62, cpuUsage: 0.42,
    });
    const s = health.getStatus();
    assert.equal(s.monitoredModules, 1);
    assert.equal(s.totalSamples, 2);
  });

  it('records samples for multiple modules independently', () => {
    health.recordSample('api-gateway', {
      successRate: 0.99, avgLatency: 200, errorRate: 0.01,
      memoryUsage: 0.3, cpuUsage: 0.2,
    });
    const s = health.getStatus();
    assert.equal(s.monitoredModules, 2);
  });

  // ── predict ───────────────────────────────────────────────────────────

  it('returns healthy status when insufficient data', () => {
    const h = new PredictiveHealth();
    h.recordSample('mod', { successRate: 0.9 });
    const pred = h.predict('mod');
    assert.equal(pred.status, 'healthy');
    assert.ok(pred.recommendations.length > 0);
    assert.ok(pred.recommendations[0].includes('Insufficient data'));
  });

  it('predicts health using linear regression after enough samples', () => {
    const h = new PredictiveHealth({ historyWindow: 100, predictionInterval: 10 });
    // Steadily declining success rate
    for (let i = 0; i < 20; i++) {
      h.recordSample('svc', {
        successRate: 0.99 - i * 0.01,
        avgLatency: 500 + i * 100,
        errorRate: 0.01 + i * 0.01,
        memoryUsage: 0.4 + i * 0.02,
        cpuUsage: 0.3,
        queueDepth: 2,
        activeConnections: 10,
      });
    }
    const pred = h.predict('svc');
    assert.ok(['healthy', 'degrading', 'at_risk', 'critical'].includes(pred.status));
    assert.ok(pred.predictions.length > 0);
    // Each predictions should have expected fields
    for (const p of pred.predictions) {
      assert.ok('metric' in p);
      assert.ok('currentValue' in p);
      assert.ok('predictedValue' in p);
      assert.ok('slope' in p);
      assert.ok('confidence' in p);
    }
  });

  it('detects degrading status when success rate slopes downward', () => {
    const h = new PredictiveHealth({ degradationRateThreshold: 0.01 });
    for (let i = 0; i < 15; i++) {
      h.recordSample('degrader', {
        successRate: 1.0 - i * 0.02,
        avgLatency: 500, errorRate: 0.01,
        memoryUsage: 0.5, cpuUsage: 0.5, queueDepth: 1,
        activeConnections: 5,
      });
    }
    const pred = h.predict('degrader');
    assert.notEqual(pred.status, 'healthy', 'steadily declining success rate should not be healthy');
  });

  // ── detectAnomalies ───────────────────────────────────────────────────

  it('returns empty array when fewer than 5 samples', () => {
    const h = new PredictiveHealth();
    h.recordSample('few', { successRate: 0.9, avgLatency: 100 });
    h.recordSample('few', { successRate: 0.9, avgLatency: 100 });
    assert.deepEqual(h.detectAnomalies('few'), []);
  });

  it('detects anomalous metric via z-score', () => {
    const h = new PredictiveHealth();
    // Establish baseline of ~0.95 success rate
    for (let i = 0; i < 10; i++) {
      h.recordSample('anom', {
        successRate: 0.95 + (Math.random() * 0.02 - 0.01),
        avgLatency: 500 + (Math.random() * 20 - 10),
      });
    }
    // Spike: huge latency anomaly
    h.recordSample('anom', {
      successRate: 0.94,
      avgLatency: 50000, // massive spike
    });
    const anomalies = h.detectAnomalies('anom');
    assert.ok(anomalies.length >= 1, 'should detect at least one anomaly');
    const latencyAnom = anomalies.find(a => a.metric === 'avgLatency');
    assert.ok(latencyAnom, 'should flag avgLatency as anomalous');
    assert.ok(Math.abs(latencyAnom.zScore) > 2, 'z-score should exceed 2');
    assert.ok(['warning', 'critical'].includes(latencyAnom.severity));
  });

  it('returns no anomalies when values are stable', () => {
    const h = new PredictiveHealth();
    for (let i = 0; i < 15; i++) {
      h.recordSample('stable', { successRate: 0.99, avgLatency: 100 });
    }
    // Same value again — z-score will be 0 / undefined
    h.recordSample('stable', { successRate: 0.99, avgLatency: 100 });
    const anomalies = h.detectAnomalies('stable');
    assert.equal(anomalies.length, 0);
  });

  // ── getDegradationTimeline ────────────────────────────────────────────

  it('returns unknown level with fewer than 3 samples', () => {
    const h = new PredictiveHealth();
    h.recordSample('x', { successRate: 0.9 });
    const tl = h.getDegradationTimeline('x');
    assert.equal(tl.currentLevel, 'unknown');
    assert.equal(tl.startedAt, null);
  });

  it('computes degradation timeline for degrading module', () => {
    const h = new PredictiveHealth({ degradationRateThreshold: 0.01 });
    for (let i = 0; i < 20; i++) {
      h.recordSample('degrading-svc', {
        successRate: 1.0 - i * 0.02,
        avgLatency: 500 + i * 200,
        errorRate: 0.01 + i * 0.01,
        memoryUsage: 0.4 + i * 0.02,
        cpuUsage: 0.3,
        queueDepth: 2,
        activeConnections: 10,
      });
    }
    const tl = h.getDegradationTimeline('degrading-svc');
    assert.ok(['healthy', 'mild', 'degrading', 'critical'].includes(tl.currentLevel));
    assert.ok(typeof tl.rate === 'number');
    assert.ok(Array.isArray(tl.metrics));
  });

  // ── suggestPreventiveActions ──────────────────────────────────────────

  it('suggests no_action when everything is healthy', () => {
    const h = new PredictiveHealth();
    for (let i = 0; i < 10; i++) {
      h.recordSample('ok', {
        successRate: 0.99, avgLatency: 100, errorRate: 0.01,
        memoryUsage: 0.3, cpuUsage: 0.2, queueDepth: 1,
        activeConnections: 5,
      });
    }
    const actions = h.suggestPreventiveActions('ok');
    assert.ok(actions.length >= 1);
    const noAction = actions.find(a => a.action === 'no_action');
    assert.ok(noAction, 'should suggest no_action when healthy');
  });

  it('suggests actions for a degrading module', () => {
    // Use small historyWindow so confidence = rSquared * (n/window) is high,
    // and low alertThreshold so predictions pass the confidence gate.
    const h = new PredictiveHealth({
      historyWindow: 25,
      alertThreshold: 0.3,
      predictionInterval: 30,
    });
    // Memory usage climbing from 0.5 toward 0.9 threshold (not yet breached)
    // avgLatency climbing from 500 toward 30000 threshold (not yet breached)
    for (let i = 0; i < 20; i++) {
      h.recordSample('bad', {
        successRate: 0.98 - i * 0.005,   // 0.98 → 0.885 (above 0.8 threshold)
        avgLatency: 500 + i * 800,        // 500 → 15700 (below 30000 threshold)
        errorRate: 0.02 + i * 0.005,      // 0.02 → 0.115 (below 0.2 threshold)
        memoryUsage: 0.5 + i * 0.018,     // 0.5 → 0.842 (below 0.9 threshold)
        cpuUsage: 0.3,
        queueDepth: 5 + i * 2,            // 5 → 43 (below 50 threshold)
        activeConnections: 10 + i * 3,     // 10 → 67 (below 100 threshold)
      });
    }
    const actions = h.suggestPreventiveActions('bad');
    assert.ok(actions.length >= 1);
    // At least one action should not be no_action
    const realActions = actions.filter(a => a.action !== 'no_action');
    assert.ok(realActions.length >= 1, 'degrading module should have real action suggestions');
    // Each action should have required fields
    for (const a of realActions) {
      assert.ok('action' in a);
      assert.ok('reason' in a);
      assert.ok('urgency' in a);
      assert.ok('expectedImpact' in a);
    }
  });

  // ── predictSystemHealth ───────────────────────────────────────────────

  it('aggregates system-wide health prediction', () => {
    const sys = health.predictSystemHealth();
    assert.ok('overallStatus' in sys);
    assert.ok('modules' in sys);
    assert.ok('atRiskModules' in sys);
    assert.ok('recommendations' in sys);
    assert.ok(Array.isArray(sys.modules));
  });
});
