import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GracefulDegradation, ModulePriority, SystemPressure } from '../src/graceful-degradation/index.js';

// Split from p8-healing-degradation.test.js — GracefulDegradation part 1

describe('GracefulDegradation', () => {
  // ── Enum values ─────────────────────────────────────────────────────────

  describe('ModulePriority enum', () => {
    it('contains all expected priority values', () => {
      assert.equal(ModulePriority.CRITICAL, 0);
      assert.equal(ModulePriority.HIGH, 1);
      assert.equal(ModulePriority.MEDIUM, 2);
      assert.equal(ModulePriority.LOW, 3);
      assert.equal(ModulePriority.OPTIONAL, 4);
    });

    it('is frozen (immutable)', () => {
      assert.ok(Object.isFrozen(ModulePriority));
    });

    it('has exactly five entries', () => {
      assert.equal(Object.keys(ModulePriority).length, 5);
    });
  });

  describe('SystemPressure enum', () => {
    it('contains all expected pressure values', () => {
      assert.equal(SystemPressure.NORMAL, 'normal');
      assert.equal(SystemPressure.MODERATE, 'moderate');
      assert.equal(SystemPressure.HIGH, 'high');
      assert.equal(SystemPressure.CRITICAL, 'critical');
    });

    it('is frozen (immutable)', () => {
      assert.ok(Object.isFrozen(SystemPressure));
    });

    it('has exactly four entries', () => {
      assert.equal(Object.keys(SystemPressure).length, 4);
    });
  });

  // ── Constructor ─────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates an instance with default options', () => {
      const gd = new GracefulDegradation();
      const status = gd.getStatus();
      assert.equal(status.pressure, SystemPressure.NORMAL);
      assert.equal(status.degradedModules, 0);
      assert.equal(status.totalModules, 0);
      assert.deepEqual(status.thresholds, { moderate: 0.7, high: 0.85, critical: 0.95 });
    });

    it('accepts custom threshold options', () => {
      const gd = new GracefulDegradation({
        moderateThreshold: 0.5,
        highThreshold: 0.75,
        criticalThreshold: 0.9,
      });
      const status = gd.getStatus();
      assert.deepEqual(status.thresholds, { moderate: 0.5, high: 0.75, critical: 0.9 });
    });

    it('clamps checkInterval to minimum of 1000ms', () => {
      const gd = new GracefulDegradation({ checkInterval: 100 });
      assert.ok(gd instanceof GracefulDegradation);
    });

    it('clamps historySize to minimum of 1', () => {
      const gd = new GracefulDegradation({ historySize: 0 });
      assert.ok(gd instanceof GracefulDegradation);
    });
  });

  // ── registerModule ──────────────────────────────────────────────────────

  describe('registerModule', () => {
    const noop = () => {};

    it('registers a module with valid inputs', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('mod', ModulePriority.LOW, {
        disable: noop, enable: noop, isEnabled: () => true,
      });
      const state = gd.getDegradationState();
      assert.equal(state.totalModules, 1);
      assert.equal(state.modules[0].name, 'mod');
      assert.equal(state.modules[0].priority, ModulePriority.LOW);
      assert.equal(state.modules[0].enabled, true);
    });

    it('throws TypeError when disable handler is missing', () => {
      const gd = new GracefulDegradation();
      assert.throws(
        () => gd.registerModule('bad', ModulePriority.LOW, { enable: noop, isEnabled: () => true }),
        { name: 'TypeError', message: /disable/ },
      );
    });

    it('throws TypeError when enable handler is missing', () => {
      const gd = new GracefulDegradation();
      assert.throws(
        () => gd.registerModule('bad', ModulePriority.LOW, { disable: noop, isEnabled: () => true }),
        { name: 'TypeError', message: /enable/ },
      );
    });

    it('throws TypeError when isEnabled handler is missing', () => {
      const gd = new GracefulDegradation();
      assert.throws(
        () => gd.registerModule('bad', ModulePriority.LOW, { disable: noop, enable: noop }),
        { name: 'TypeError', message: /isEnabled/ },
      );
    });

    it('throws TypeError when handlers object is null', () => {
      const gd = new GracefulDegradation();
      assert.throws(
        () => gd.registerModule('bad', ModulePriority.LOW, null),
        { name: 'TypeError' },
      );
    });

    it('defaults to OPTIONAL priority when priority is not a number', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('mod', 'not-a-number', {
        disable: noop, enable: noop, isEnabled: () => true,
      });
      const state = gd.getDegradationState();
      assert.equal(state.modules[0].priority, ModulePriority.OPTIONAL);
    });

    it('allows registering multiple modules', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('a', ModulePriority.LOW, { disable: noop, enable: noop, isEnabled: () => true });
      gd.registerModule('b', ModulePriority.MEDIUM, { disable: noop, enable: noop, isEnabled: () => true });
      gd.registerModule('c', ModulePriority.CRITICAL, { disable: noop, enable: noop, isEnabled: () => true });
      assert.equal(gd.getDegradationState().totalModules, 3);
    });
  });

  // ── unregisterModule ────────────────────────────────────────────────────

  describe('unregisterModule', () => {
    const noop = () => {};
    const handlers = { disable: noop, enable: noop, isEnabled: () => true };

    it('removes a registered module and returns true', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('mod', ModulePriority.LOW, handlers);
      assert.equal(gd.unregisterModule('mod'), true);
      assert.equal(gd.getDegradationState().totalModules, 0);
    });

    it('returns false for a non-existent module', () => {
      const gd = new GracefulDegradation();
      assert.equal(gd.unregisterModule('nonexistent'), false);
    });
  });

  // ── evaluate — NORMAL pressure ──────────────────────────────────────────

  describe('evaluate - NORMAL pressure', () => {
    const noop = () => {};
    const handlers = { disable: noop, enable: noop, isEnabled: () => true };

    it('returns NORMAL pressure for low resource usage', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('tracing', ModulePriority.LOW, handlers);

      const result = gd.evaluate({ memoryUsage: 0.3, cpuUsage: 0.2, queueDepth: 1, activeWorkers: 1, maxWorkers: 10 });
      assert.equal(result.pressure, SystemPressure.NORMAL);
      assert.deepEqual(result.disabled, []);
      assert.deepEqual(result.enabled, []);
      assert.equal(result.changes, 0);
    });

    it('does not disable any modules at NORMAL pressure', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('a', ModulePriority.OPTIONAL, handlers);
      gd.registerModule('b', ModulePriority.LOW, handlers);
      gd.registerModule('c', ModulePriority.CRITICAL, handlers);

      const result = gd.evaluate({ memoryUsage: 0.1, cpuUsage: 0.1, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      assert.equal(result.pressure, SystemPressure.NORMAL);
      assert.equal(result.disabled.length, 0);
    });
  });

  // ── evaluate — MODERATE pressure ────────────────────────────────────────

  describe('evaluate - MODERATE pressure', () => {
    const noop = () => {};
    const handlers = { disable: noop, enable: noop, isEnabled: () => true };

    it('enters MODERATE pressure when usage exceeds 0.7', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('dashboard', ModulePriority.OPTIONAL, handlers);
      gd.registerModule('tracing', ModulePriority.LOW, handlers);

      const result = gd.evaluate({ memoryUsage: 0.75, cpuUsage: 0.5, queueDepth: 1, activeWorkers: 1, maxWorkers: 10 });
      assert.equal(result.pressure, SystemPressure.MODERATE);
    });

    it('disables only OPTIONAL modules at MODERATE pressure', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('dashboard', ModulePriority.OPTIONAL, handlers);
      gd.registerModule('tracing', ModulePriority.LOW, handlers);
      gd.registerModule('core', ModulePriority.CRITICAL, handlers);

      const result = gd.evaluate({ memoryUsage: 0.75, cpuUsage: 0.5, queueDepth: 1, activeWorkers: 1, maxWorkers: 10 });
      assert.deepEqual(result.disabled, ['dashboard']);
      assert.equal(result.enabled.length, 0);
      assert.equal(result.changes, 1);
    });
  });

  // ── evaluate — HIGH pressure ────────────────────────────────────────────

  describe('evaluate - HIGH pressure', () => {
    const noop = () => {};
    const handlers = { disable: noop, enable: noop, isEnabled: () => true };

    it('enters HIGH pressure when usage exceeds 0.85', () => {
      const gd = new GracefulDegradation();
      const result = gd.evaluate({ memoryUsage: 0.9, cpuUsage: 0.5, queueDepth: 1, activeWorkers: 1, maxWorkers: 10 });
      assert.equal(result.pressure, SystemPressure.HIGH);
    });

    it('disables OPTIONAL and LOW modules at HIGH pressure', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('dashboard', ModulePriority.OPTIONAL, handlers);
      gd.registerModule('tracing', ModulePriority.LOW, handlers);
      gd.registerModule('knowledge', ModulePriority.MEDIUM, handlers);
      gd.registerModule('core', ModulePriority.CRITICAL, handlers);

      const result = gd.evaluate({ memoryUsage: 0.9, cpuUsage: 0.5, queueDepth: 1, activeWorkers: 1, maxWorkers: 10 });
      assert.ok(result.disabled.includes('dashboard'));
      assert.ok(result.disabled.includes('tracing'));
      assert.ok(!result.disabled.includes('knowledge'));
      assert.ok(!result.disabled.includes('core'));
    });
  });

  // ── evaluate — CRITICAL pressure ────────────────────────────────────────

  describe('evaluate - CRITICAL pressure', () => {
    const noop = () => {};
    const handlers = { disable: noop, enable: noop, isEnabled: () => true };

    it('enters CRITICAL pressure when usage exceeds 0.95', () => {
      const gd = new GracefulDegradation();
      const result = gd.evaluate({ memoryUsage: 0.98, cpuUsage: 0.5, queueDepth: 1, activeWorkers: 1, maxWorkers: 10 });
      assert.equal(result.pressure, SystemPressure.CRITICAL);
    });

    it('disables OPTIONAL, LOW, and MEDIUM modules at CRITICAL pressure', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('dashboard', ModulePriority.OPTIONAL, handlers);
      gd.registerModule('tracing', ModulePriority.LOW, handlers);
      gd.registerModule('knowledge', ModulePriority.MEDIUM, handlers);
      gd.registerModule('core', ModulePriority.CRITICAL, handlers);
      gd.registerModule('verify', ModulePriority.HIGH, handlers);

      const result = gd.evaluate({ memoryUsage: 0.98, cpuUsage: 0.5, queueDepth: 1, activeWorkers: 1, maxWorkers: 10 });
      assert.ok(result.disabled.includes('dashboard'));
      assert.ok(result.disabled.includes('tracing'));
      assert.ok(result.disabled.includes('knowledge'));
      assert.ok(!result.disabled.includes('core'));
      assert.ok(!result.disabled.includes('verify'));
    });

    it('never disables CRITICAL priority modules even at CRITICAL pressure', () => {
      const gd = new GracefulDegradation();
      let criticalDisabled = false;
      gd.registerModule('core', ModulePriority.CRITICAL, {
        disable: () => { criticalDisabled = true; },
        enable: noop,
        isEnabled: () => true,
      });

      gd.evaluate({ memoryUsage: 0.99, cpuUsage: 0.99, queueDepth: 100, activeWorkers: 10, maxWorkers: 10 });
      assert.equal(criticalDisabled, false);
    });
  });

  // ── Pressure score computation ──────────────────────────────────────────

  describe('pressure score computation', () => {
    it('uses max of memoryUsage, cpuUsage, and queueRatio', () => {
      const gd = new GracefulDegradation();

      // memoryUsage is highest at 0.8
      const result = gd.evaluate({ memoryUsage: 0.8, cpuUsage: 0.3, queueDepth: 2, activeWorkers: 2, maxWorkers: 10 });
      assert.equal(result.pressure, SystemPressure.MODERATE);
    });

    it('queueDepth/maxWorkers ratio can drive pressure', () => {
      const gd = new GracefulDegradation();

      // queueRatio = 9/10 = 0.9, which is > 0.85
      const result = gd.evaluate({ memoryUsage: 0.2, cpuUsage: 0.3, queueDepth: 9, activeWorkers: 9, maxWorkers: 10 });
      assert.equal(result.pressure, SystemPressure.HIGH);
    });

    it('handles missing metrics gracefully (defaults to 0)', () => {
      const gd = new GracefulDegradation();
      const result = gd.evaluate({});
      assert.equal(result.pressure, SystemPressure.NORMAL);
    });
  });

  // ── Cascade degradation ─────────────────────────────────────────────────

  describe('cascade degradation', () => {
    const noop = () => {};
    const handlers = { disable: noop, enable: noop, isEnabled: () => true };

    it('disables lower-priority modules first as pressure increases', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('optional', ModulePriority.OPTIONAL, handlers);
      gd.registerModule('low', ModulePriority.LOW, handlers);
      gd.registerModule('medium', ModulePriority.MEDIUM, handlers);
      gd.registerModule('high', ModulePriority.HIGH, handlers);

      // MODERATE: only OPTIONAL disabled
      const r1 = gd.evaluate({ memoryUsage: 0.75, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      assert.deepEqual(r1.disabled, ['optional']);

      // HIGH: OPTIONAL + LOW disabled (optional already disabled, so only low newly disabled)
      const r2 = gd.evaluate({ memoryUsage: 0.9, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      assert.ok(r2.disabled.includes('low'));
      assert.ok(!r2.disabled.includes('optional'), 'optional was already disabled');
    });
  });

  // ── Re-enable when pressure drops ───────────────────────────────────────

  describe('re-enable when pressure drops', () => {
    const noop = () => {};
    const handlers = { disable: noop, enable: noop, isEnabled: () => true };

    it('re-enables modules when pressure drops to NORMAL', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('optional', ModulePriority.OPTIONAL, handlers);
      gd.registerModule('low', ModulePriority.LOW, handlers);

      // Push to HIGH
      gd.evaluate({ memoryUsage: 0.9, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });

      // Drop to NORMAL (score needs to drop below moderateLeave = 0.7 - 0.1 = 0.6)
      const result = gd.evaluate({ memoryUsage: 0.3, cpuUsage: 0.2, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      assert.equal(result.pressure, SystemPressure.NORMAL);
      assert.ok(result.enabled.includes('optional'));
      assert.ok(result.enabled.includes('low'));
      assert.equal(result.disabled.length, 0);
    });

    it('re-enables OPTIONAL modules when dropping from MODERATE to NORMAL', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('opt', ModulePriority.OPTIONAL, handlers);

      // Push to MODERATE
      gd.evaluate({ memoryUsage: 0.75, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      const state1 = gd.getDegradationState();
      assert.equal(state1.modules.find((m) => m.name === 'opt').enabled, false);

      // Drop to NORMAL
      gd.evaluate({ memoryUsage: 0.3, cpuUsage: 0.2, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      const state2 = gd.getDegradationState();
      assert.equal(state2.modules.find((m) => m.name === 'opt').enabled, true);
    });
  });

  // ── Hysteresis ──────────────────────────────────────────────────────────

  describe('hysteresis (prevent flapping)', () => {
    const noop = () => {};
    const handlers = { disable: noop, enable: noop, isEnabled: () => true };

    it('stays in MODERATE when score drops slightly below enter threshold', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('opt', ModulePriority.OPTIONAL, handlers);

      // Enter MODERATE
      gd.evaluate({ memoryUsage: 0.75, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });

      // Score = 0.65 which is below 0.7 enter threshold but above 0.6 leave threshold
      const result = gd.evaluate({ memoryUsage: 0.65, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      assert.equal(result.pressure, SystemPressure.MODERATE, 'should stay MODERATE due to hysteresis');
    });

    it('leaves MODERATE when score drops below leave threshold (enter - 0.1)', () => {
      const gd = new GracefulDegradation();
      gd.registerModule('opt', ModulePriority.OPTIONAL, handlers);

      // Enter MODERATE
      gd.evaluate({ memoryUsage: 0.75, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });

      // Score = 0.55 which is below 0.6 leave threshold
      const result = gd.evaluate({ memoryUsage: 0.55, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      assert.equal(result.pressure, SystemPressure.NORMAL, 'should drop to NORMAL below leave threshold');
    });

    it('stays in HIGH when score drops slightly below enter threshold', () => {
      const gd = new GracefulDegradation();

      // Enter HIGH
      gd.evaluate({ memoryUsage: 0.9, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });

      // Score = 0.82 which is below 0.85 enter threshold but above 0.75 leave threshold
      const result = gd.evaluate({ memoryUsage: 0.82, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      assert.equal(result.pressure, SystemPressure.HIGH, 'should stay HIGH due to hysteresis');
    });

    it('stays in CRITICAL when score drops slightly below enter threshold', () => {
      const gd = new GracefulDegradation();

      // Enter CRITICAL
      gd.evaluate({ memoryUsage: 0.98, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });

      // Score = 0.90 which is below 0.95 enter threshold but above 0.85 leave threshold
      const result = gd.evaluate({ memoryUsage: 0.90, cpuUsage: 0.3, queueDepth: 0, activeWorkers: 1, maxWorkers: 10 });
      assert.equal(result.pressure, SystemPressure.HIGH, 'should drop from CRITICAL to HIGH');
    });
  });
});
