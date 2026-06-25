import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GracefulDegradation, ModulePriority, SystemPressure } from '../src/graceful-degradation/index.js';

// Split from p8-healing-degradation.test.js — GracefulDegradation part 2

describe('GracefulDegradation (part 2)', () => {
  // ── forceDegradation ────────────────────────────────────────────────────

  describe('forceDegradation', () => {
    const noop = () => {};
    const handlers = { disable: noop, enable: noop, isEnabled: () => true };

    it('forces a specific degradation level regardless of metrics', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('opt', ModulePriority.OPTIONAL, handlers);
      gd.registerModule('low', ModulePriority.LOW, handlers);

      const result = gd.forceDegradation(SystemPressure.HIGH);
      assert.equal(result.previous, SystemPressure.NORMAL);
      assert.equal(result.current, SystemPressure.HIGH);
      assert.ok(result.disabled.includes('opt'));
      assert.ok(result.disabled.includes('low'));
    });

    it('throws for invalid degradation level', () => {
      const gd = new GracefulDegradation();
      assert.throws(
        () => gd.forceDegradation('invalid'),
        { message: /Invalid degradation level/ },
      );
    });

    it('does not disable CRITICAL modules when forced', () => {
      const gd = new GracefulDegradation();
      let criticalDisabled = false;
      gd.registerModule('core', ModulePriority.CRITICAL, {
        disable: () => { criticalDisabled = true; },
        enable: noop,
        isEnabled: () => true,
      });

      gd.forceDegradation(SystemPressure.CRITICAL);
      assert.equal(criticalDisabled, false);
    });
  });

  // ── restoreAll ──────────────────────────────────────────────────────────

  describe('restoreAll', () => {
    const noop = () => {};
    const handlers = { disable: noop, enable: noop, isEnabled: () => true };

    it('re-enables all disabled modules and resets pressure to NORMAL', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('opt', ModulePriority.OPTIONAL, handlers);
      gd.registerModule('low', ModulePriority.LOW, handlers);

      gd.forceDegradation(SystemPressure.CRITICAL);

      const result = gd.restoreAll();
      assert.ok(result.restored.includes('opt'));
      assert.ok(result.restored.includes('low'));
      assert.equal(gd.getStatus().pressure, SystemPressure.NORMAL);
    });

    it('returns empty restored array when nothing is disabled', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('mod', ModulePriority.LOW, handlers);

      const result = gd.restoreAll();
      assert.deepEqual(result.restored, []);
    });
  });

  // ── getDegradationState ─────────────────────────────────────────────────

  describe('getDegradationState', () => {
    const noop = () => {};
    const handlers = { disable: noop, enable: noop, isEnabled: () => true };

    it('returns correct structure', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('mod', ModulePriority.LOW, handlers);

      const state = gd.getDegradationState();
      assert.ok('pressure' in state);
      assert.ok('modules' in state);
      assert.ok('disabledCount' in state);
      assert.ok('totalModules' in state);
    });

    it('tracks disabled count correctly', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('opt', ModulePriority.OPTIONAL, handlers);
      gd.registerModule('low', ModulePriority.LOW, handlers);

      gd.forceDegradation(SystemPressure.MODERATE);
      const state = gd.getDegradationState();
      assert.equal(state.disabledCount, 1);
      assert.equal(state.totalModules, 2);
    });

    it('module entries contain name, priority, enabled, lastChanged', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('mod', ModulePriority.MEDIUM, handlers);

      const state = gd.getDegradationState();
      const mod = state.modules[0];
      assert.equal(mod.name, 'mod');
      assert.equal(mod.priority, ModulePriority.MEDIUM);
      assert.equal(mod.enabled, true);
      assert.ok('lastChanged' in mod);
    });
  });

  // ── getHistory ──────────────────────────────────────────────────────────

  describe('getHistory', () => {
    const noop = () => {};
    const handlers = { disable: noop, enable: noop, isEnabled: () => true };

    it('returns empty array initially', () => {
      const gd = new GracefulDegradation();
      assert.deepEqual(gd.getHistory(), []);
    });

    it('records degrade events', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('opt', ModulePriority.OPTIONAL, handlers);

      gd.evaluate({ memoryUsage: 0.8, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });

      const history = gd.getHistory();
      assert.ok(history.length >= 1);
      assert.equal(history[0].action, 'degrade');
      assert.ok(history[0].modules.includes('opt'));
      assert.ok(typeof history[0].timestamp === 'number');
      assert.ok(typeof history[0].pressure === 'string');
    });

    it('records restore events', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('opt', ModulePriority.OPTIONAL, handlers);

      gd.evaluate({ memoryUsage: 0.8, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      gd.evaluate({ memoryUsage: 0.3, cpuUsage: 0.2, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });

      const history = gd.getHistory();
      const restoreEvents = history.filter((h) => h.action === 'restore');
      assert.ok(restoreEvents.length >= 1);
    });

    it('filters by action type', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('opt', ModulePriority.OPTIONAL, handlers);

      gd.evaluate({ memoryUsage: 0.8, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      gd.evaluate({ memoryUsage: 0.3, cpuUsage: 0.2, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });

      const degrades = gd.getHistory({ action: 'degrade' });
      assert.ok(degrades.every((h) => h.action === 'degrade'));
    });

    it('filters by pressure level', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('opt', ModulePriority.OPTIONAL, handlers);

      gd.evaluate({ memoryUsage: 0.8, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });

      const filtered = gd.getHistory({ pressure: SystemPressure.MODERATE });
      assert.ok(filtered.every((h) => h.pressure === SystemPressure.MODERATE));
    });

    it('respects limit parameter', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('opt', ModulePriority.OPTIONAL, handlers);

      gd.evaluate({ memoryUsage: 0.8, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      gd.evaluate({ memoryUsage: 0.3, cpuUsage: 0.2, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      gd.evaluate({ memoryUsage: 0.9, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });

      const limited = gd.getHistory({ limit: 1 });
      assert.equal(limited.length, 1);
    });

    it('returns entries sorted by timestamp descending', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('opt', ModulePriority.OPTIONAL, handlers);

      gd.evaluate({ memoryUsage: 0.8, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      gd.evaluate({ memoryUsage: 0.3, cpuUsage: 0.2, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      gd.evaluate({ memoryUsage: 0.9, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });

      const history = gd.getHistory();
      for (let i = 1; i < history.length; i++) {
        assert.ok(history[i - 1].timestamp >= history[i].timestamp);
      }
    });
  });

  // ── getStatus ───────────────────────────────────────────────────────────

  describe('getStatus', () => {
    const noop = () => {};
    const handlers = { disable: noop, enable: noop, isEnabled: () => true };

    it('returns correct structure with all expected fields', () => {
      const gd = new GracefulDegradation();
      const status = gd.getStatus();
      assert.ok('pressure' in status);
      assert.ok('degradedModules' in status);
      assert.ok('totalModules' in status);
      assert.ok('thresholds' in status);
      assert.ok('moderate' in status.thresholds);
      assert.ok('high' in status.thresholds);
      assert.ok('critical' in status.thresholds);
    });

    it('reflects degraded module count accurately', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('opt', ModulePriority.OPTIONAL, handlers);
      gd.registerModule('low', ModulePriority.LOW, handlers);

      gd.forceDegradation(SystemPressure.MODERATE);
      const status = gd.getStatus();
      assert.equal(status.degradedModules, 1);
      assert.equal(status.totalModules, 2);
    });
  });

  // ── clear ───────────────────────────────────────────────────────────────

  describe('clear', () => {
    const noop = () => {};
    const handlers = { disable: noop, enable: noop, isEnabled: () => true };

    it('clears all history', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('opt', ModulePriority.OPTIONAL, handlers);

      gd.evaluate({ memoryUsage: 0.8, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      assert.ok(gd.getHistory().length > 0);

      gd.clear();
      assert.deepEqual(gd.getHistory(), []);
    });

    it('preserves module registrations and enabled/disabled state', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('opt', ModulePriority.OPTIONAL, handlers);

      gd.forceDegradation(SystemPressure.MODERATE);
      const stateBefore = gd.getDegradationState();
      assert.equal(stateBefore.modules.find((m) => m.name === 'opt').enabled, false);

      gd.clear();
      const stateAfter = gd.getDegradationState();
      assert.equal(stateAfter.totalModules, 1);
      assert.equal(stateAfter.modules.find((m) => m.name === 'opt').enabled, false, 'disabled state preserved after clear');
    });
  });

  // ── Handler error resilience ────────────────────────────────────────────

  describe('handler error resilience', () => {
    it('continues degradation when disable handler throws', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('broken', ModulePriority.OPTIONAL, {
        disable: () => { throw new Error('disable failed'); },
        enable: () => {},
        isEnabled: () => true,
      });
      gd.registerModule('good', ModulePriority.LOW, {
        disable: () => {},
        enable: () => {},
        isEnabled: () => true,
      });

      // Should not throw despite broken handler
      const result = gd.evaluate({ memoryUsage: 0.9, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      assert.ok(result.disabled.includes('broken'));
      assert.ok(result.disabled.includes('good'));
    });

    it('continues restoration when enable handler throws', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('broken', ModulePriority.OPTIONAL, {
        disable: () => {},
        enable: () => { throw new Error('enable failed'); },
        isEnabled: () => false,
      });

      // Force degrade first
      gd.forceDegradation(SystemPressure.MODERATE);

      // Restore — should not throw despite broken enable handler
      const result = gd.restoreAll();
      assert.ok(result.restored.includes('broken'));
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  describe('edge cases', () => {
    const noop = () => {};
    const handlers = { disable: noop, enable: noop, isEnabled: () => true };

    it('evaluate with no modules registered returns valid result', () => {
      const gd = new GracefulDegradation();
      const result = gd.evaluate({ memoryUsage: 0.99, cpuUsage: 0.99, queueDepth: 100, activeWorkers: 10, maxWorkers: 10 });
      assert.equal(result.pressure, SystemPressure.CRITICAL);
      assert.deepEqual(result.disabled, []);
      assert.deepEqual(result.enabled, []);
      assert.equal(result.changes, 0);
    });

    it('does not re-disable already disabled modules', () => {
      const gd = new GracefulDegradation();
      let disableCount = 0;
      gd.registerModule('opt', ModulePriority.OPTIONAL, {
        disable: () => { disableCount++; },
        enable: noop,
        isEnabled: () => true,
      });

      gd.evaluate({ memoryUsage: 0.8, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      assert.equal(disableCount, 1);

      // Evaluate again at same pressure — should not call disable again
      gd.evaluate({ memoryUsage: 0.8, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      assert.equal(disableCount, 1, 'disable should not be called again for already disabled module');
    });

    it('does not re-enable already enabled modules', () => {
      const gd = new GracefulDegradation();
      let enableCount = 0;
      gd.registerModule('opt', ModulePriority.OPTIONAL, {
        disable: noop,
        enable: () => { enableCount++; },
        isEnabled: () => true,
      });

      // NORMAL pressure — module already enabled, no enable call expected
      gd.evaluate({ memoryUsage: 0.3, cpuUsage: 0.2, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      assert.equal(enableCount, 0, 'enable should not be called for already enabled module');
    });
  });
});
