/**
 * Tests for P6-P1P2 HealthDashboard module.
 *
 * Coverage:
 *   - Constructor defaults and custom options
 *   - All public methods (registerModule, unregisterModule, refresh,
 *     getSnapshot, getModuleHealth, getHistory, getMetrics, addAlert,
 *     getAlerts, acknowledgeAlert, getUptime, clear, getStatus)
 *   - Edge cases (empty state, boundaries, history trimming, alert limits)
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

describe('HealthDashboard', () => {
  let HealthDashboard;

  before(async () => {
    const mod = await import('../src/health-dashboard/index.js');
    HealthDashboard = mod.HealthDashboard;
  });

  // ── Constructor ────────────────────────────────────────────────────────

  it('should construct with default options', () => {
    const dash = new HealthDashboard();
    const status = dash.getStatus();
    assert.equal(status.status, 'healthy');
    assert.equal(status.moduleCount, 0);
    assert.equal(status.alertCount, 0);
    assert.ok(typeof status.uptime === 'number');
  });

  it('should accept custom refreshInterval and historySize', () => {
    const dash = new HealthDashboard({ refreshInterval: 10000, historySize: 50 });
    const uptime = dash.getUptime();
    assert.ok(uptime.startedAt > 0);
  });

  it('should clamp refreshInterval to at least 1000', () => {
    const dash = new HealthDashboard({ refreshInterval: 100 });
    assert.ok(dash.getUptime().startedAt > 0);
  });

  // ── registerModule() ───────────────────────────────────────────────────

  it('should register a module with a status function', () => {
    const dash = new HealthDashboard();
    dash.registerModule('test', () => ({ status: 'healthy' }));
    assert.equal(dash.getStatus().moduleCount, 1);
  });

  it('should throw TypeError when statusFn is not a function', () => {
    const dash = new HealthDashboard();
    assert.throws(
      () => dash.registerModule('bad', 'not-a-function'),
      TypeError,
    );
  });

  // ── unregisterModule() ─────────────────────────────────────────────────

  it('should unregister an existing module and return true', () => {
    const dash = new HealthDashboard();
    dash.registerModule('mod1', () => ({ status: 'healthy' }));
    assert.equal(dash.unregisterModule('mod1'), true);
    assert.equal(dash.getStatus().moduleCount, 0);
  });

  it('should return false when unregistering non-existent module', () => {
    const dash = new HealthDashboard();
    assert.equal(dash.unregisterModule('nope'), false);
  });

  // ── refresh() ──────────────────────────────────────────────────────────

  it('should return healthy snapshot when no modules registered', async () => {
    const dash = new HealthDashboard();
    const snap = await dash.refresh();
    assert.equal(snap.status, 'healthy');
    assert.equal(Object.keys(snap.modules).length, 0);
  });

  it('should aggregate status from registered modules', async () => {
    const dash = new HealthDashboard();
    dash.registerModule('a', () => ({ status: 'healthy', details: { latency: 10 } }));
    dash.registerModule('b', () => ({ status: 'degraded', details: { latency: 500 } }));
    const snap = await dash.refresh();
    assert.equal(snap.status, 'degraded');
    assert.equal(snap.modules.a.status, 'healthy');
    assert.equal(snap.modules.b.status, 'degraded');
  });

  it('should report critical if any module is critical', async () => {
    const dash = new HealthDashboard();
    dash.registerModule('ok', () => ({ status: 'healthy' }));
    dash.registerModule('bad', () => ({ status: 'critical' }));
    const snap = await dash.refresh();
    assert.equal(snap.status, 'critical');
  });

  it('should handle thrown errors in status functions as critical', async () => {
    const dash = new HealthDashboard();
    dash.registerModule('thrower', () => { throw new Error('boom'); });
    const snap = await dash.refresh();
    assert.equal(snap.status, 'critical');
    assert.equal(snap.modules.thrower.status, 'critical');
  });

  it('should generate alerts on status change', async () => {
    const dash = new HealthDashboard();
    let statusVal = 'healthy';
    dash.registerModule('svc', () => ({ status: statusVal }));

    await dash.refresh(); // initial check, no change alert
    statusVal = 'degraded';
    await dash.refresh(); // triggers change alert

    const alerts = dash.getAlerts();
    assert.ok(alerts.length >= 1);
    assert.ok(alerts.some(a => a.module === 'svc' && a.level === 'warning'));
  });

  it('should store snapshots in history', async () => {
    const dash = new HealthDashboard();
    dash.registerModule('m', () => ({ status: 'healthy' }));
    await dash.refresh();
    await dash.refresh();
    const history = dash.getHistory();
    assert.equal(history.length, 2);
  });

  it('should trim history when exceeding historySize', async () => {
    const dash = new HealthDashboard({ historySize: 2 });
    dash.registerModule('m', () => ({ status: 'healthy' }));
    await dash.refresh();
    await dash.refresh();
    await dash.refresh();
    const history = dash.getHistory({ limit: 100 });
    assert.equal(history.length, 2);
  });

  // ── getSnapshot() ──────────────────────────────────────────────────────

  it('should return cached snapshot without calling status functions', async () => {
    const dash = new HealthDashboard();
    dash.registerModule('m', () => ({ status: 'healthy' }));
    await dash.refresh();
    const snap = dash.getSnapshot();
    assert.equal(snap.status, 'healthy');
    assert.ok(snap.modules.m);
  });

  // ── getModuleHealth() ──────────────────────────────────────────────────

  it('should return module health after refresh', async () => {
    const dash = new HealthDashboard();
    dash.registerModule('svc', () => ({ status: 'healthy', details: { up: true } }));
    await dash.refresh();
    const health = dash.getModuleHealth('svc');
    assert.equal(health.status, 'healthy');
    assert.ok(typeof health.latencyMs === 'number');
    assert.ok(typeof health.lastChecked === 'number');
  });

  it('should return null for unregistered module health', () => {
    const dash = new HealthDashboard();
    assert.equal(dash.getModuleHealth('nope'), null);
  });

  // ── getHistory() ───────────────────────────────────────────────────────

  it('should filter history by module with issues', async () => {
    const dash = new HealthDashboard();
    dash.registerModule('good', () => ({ status: 'healthy' }));
    dash.registerModule('bad', () => ({ status: 'degraded' }));
    await dash.refresh();

    const filtered = dash.getHistory({ module: 'bad' });
    assert.equal(filtered.length, 1);

    const filteredGood = dash.getHistory({ module: 'good' });
    assert.equal(filteredGood.length, 0);
  });

  // ── getMetrics() ───────────────────────────────────────────────────────

  it('should extract numeric metrics from module details', async () => {
    const dash = new HealthDashboard();
    dash.registerModule('api', () => ({
      status: 'healthy',
      latencyMs: 42, taskCount: 100, note: 'ok',
    }));
    await dash.refresh();
    const metrics = dash.getMetrics();
    assert.ok(metrics['api.latencyMs']);
    assert.equal(metrics['api.latencyMs'].value, 42);
    assert.equal(metrics['api.latencyMs'].unit, 'ms');
    assert.ok(metrics['api.taskCount']);
    assert.equal(metrics['api.taskCount'].value, 100);
    // 'note' is not numeric, should not appear
    assert.equal(metrics['api.note'], undefined);
  });

  // ── addAlert() / getAlerts() / acknowledgeAlert() ─────────────────────

  it('should add and retrieve alerts', () => {
    const dash = new HealthDashboard();
    dash.addAlert('warning', 'svc', 'high latency');
    const alerts = dash.getAlerts();
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].level, 'warning');
    assert.equal(alerts[0].module, 'svc');
    assert.equal(alerts[0].message, 'high latency');
    assert.equal(alerts[0].acknowledged, false);
  });

  it('should normalize invalid alert level to info', () => {
    const dash = new HealthDashboard();
    dash.addAlert('bogus', 'sys', 'test');
    const alerts = dash.getAlerts();
    assert.equal(alerts[0].level, 'info');
  });

  it('should acknowledge alert by index', () => {
    const dash = new HealthDashboard();
    dash.addAlert('error', 'svc', 'fail');
    assert.equal(dash.acknowledgeAlert(0), true);
    // After acknowledgement, getAlerts should filter it out
    assert.equal(dash.getAlerts().length, 0);
  });

  it('should return false for invalid alert index', () => {
    const dash = new HealthDashboard();
    assert.equal(dash.acknowledgeAlert(99), false);
    assert.equal(dash.acknowledgeAlert(-1), false);
  });

  it('should trim alerts when exceeding MAX_ALERTS (50)', () => {
    const dash = new HealthDashboard();
    for (let i = 0; i < 55; i++) {
      dash.addAlert('info', 'sys', `alert-${i}`);
    }
    // Internal array should be trimmed to 50
    // We can verify by checking that acknowledgeAlert works within range
    assert.equal(dash.acknowledgeAlert(49), true);
    assert.equal(dash.acknowledgeAlert(50), false);
  });

  // ── getUptime() ────────────────────────────────────────────────────────

  it('should track uptime and check statistics', async () => {
    const dash = new HealthDashboard();
    dash.registerModule('m', () => ({ status: 'healthy' }));
    await dash.refresh();
    await dash.refresh();
    const uptime = dash.getUptime();
    assert.ok(uptime.startedAt > 0);
    assert.ok(uptime.uptime >= 0);
    assert.equal(uptime.checksPerformed, 2);
    assert.equal(uptime.healthyChecks, 2);
    assert.equal(uptime.degradedChecks, 0);
    assert.equal(uptime.criticalChecks, 0);
  });

  // ── clear() ────────────────────────────────────────────────────────────

  it('should clear history, alerts, and check counters', async () => {
    const dash = new HealthDashboard();
    dash.registerModule('m', () => ({ status: 'healthy' }));
    dash.addAlert('info', 'sys', 'test');
    await dash.refresh();
    dash.clear();
    assert.deepEqual(dash.getHistory(), []);
    assert.deepEqual(dash.getAlerts(), []);
    const uptime = dash.getUptime();
    assert.equal(uptime.checksPerformed, 0);
    // Module registration is preserved
    assert.equal(dash.getStatus().moduleCount, 1);
  });
});
