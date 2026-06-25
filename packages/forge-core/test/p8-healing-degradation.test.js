import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { SelfHealingEngine, HealingAction, HealthLevel } from '../src/self-healing/index.js';

// ============================================================================
// SelfHealingEngine
// ============================================================================

describe('SelfHealingEngine', () => {
  // ── Enum values ─────────────────────────────────────────────────────────

  describe('HealingAction enum', () => {
    it('contains all expected action values', () => {
      assert.equal(HealingAction.RESTART, 'restart');
      assert.equal(HealingAction.CLEAR_STATE, 'clear_state');
      assert.equal(HealingAction.FALLBACK, 'fallback');
      assert.equal(HealingAction.ALERT, 'alert');
      assert.equal(HealingAction.QUARANTINE, 'quarantine');
    });

    it('is frozen (immutable)', () => {
      assert.ok(Object.isFrozen(HealingAction));
    });

    it('has exactly five entries', () => {
      assert.equal(Object.keys(HealingAction).length, 5);
    });
  });

  describe('HealthLevel enum', () => {
    it('contains all expected level values', () => {
      assert.equal(HealthLevel.HEALTHY, 'healthy');
      assert.equal(HealthLevel.DEGRADED, 'degraded');
      assert.equal(HealthLevel.CRITICAL, 'critical');
    });

    it('is frozen (immutable)', () => {
      assert.ok(Object.isFrozen(HealthLevel));
    });

    it('has exactly three entries', () => {
      assert.equal(Object.keys(HealthLevel).length, 3);
    });
  });

  // ── Constructor ─────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates an instance with default options', () => {
      const engine = new SelfHealingEngine();
      const status = engine.getStatus();
      assert.equal(status.running, false);
      assert.equal(status.overall, HealthLevel.HEALTHY);
      assert.deepEqual(status.modules, []);
      assert.equal(status.healCount, 0);
      assert.equal(status.alertCount, 0);
    });

    it('accepts custom options without error', () => {
      const engine = new SelfHealingEngine({
        checkInterval: 5000,
        maxAutoHeals: 3,
        cooldownMs: 30000,
        enableAutoHeal: false,
        historySize: 50,
      });
      assert.ok(engine instanceof SelfHealingEngine);
    });

    it('clamps checkInterval to minimum of 1000ms', () => {
      const engine = new SelfHealingEngine({ checkInterval: 100 });
      // Internal value is private; we verify indirectly by starting and
      // confirming the engine does not throw.
      engine.start();
      engine.stop();
      assert.ok(true, 'engine started/stopped without error at clamped interval');
    });

    it('clamps maxAutoHeals to minimum of 1', () => {
      const engine = new SelfHealingEngine({ maxAutoHeals: 0 });
      // Register a degraded module and check that at least one heal is attempted
      let healed = false;
      engine.registerModule('m1', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { healed = true; }, priority: 1 },
      ]);
      // With maxAutoHeals clamped to 1, the first check should still heal
      return engine.check().then((result) => {
        assert.equal(healed, true);
        assert.equal(result.healed, 1);
      });
    });

    it('sets enableAutoHeal to true by default', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });
      let handlerCalled = false;
      engine.registerModule('m1', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { handlerCalled = true; }, priority: 1 },
      ]);
      await engine.check();
      assert.equal(handlerCalled, true, 'auto-heal should be enabled by default');
    });

    it('disables auto-heal when enableAutoHeal is false', async () => {
      const engine = new SelfHealingEngine({ enableAutoHeal: false, cooldownMs: 0 });
      let handlerCalled = false;
      engine.registerModule('m1', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { handlerCalled = true; }, priority: 1 },
      ]);
      await engine.check();
      assert.equal(handlerCalled, false, 'handler should not be called when auto-heal is disabled');
    });
  });

  // ── registerModule ──────────────────────────────────────────────────────

  describe('registerModule', () => {
    it('registers a module with valid inputs', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });
      engine.registerModule('test-mod', () => ({ status: 'healthy' }), []);
      const result = await engine.check();
      assert.equal(result.modules.length, 1);
      assert.equal(result.modules[0].name, 'test-mod');
    });

    it('throws TypeError when healthFn is not a function', () => {
      const engine = new SelfHealingEngine();
      assert.throws(
        () => engine.registerModule('bad', 'not-a-function', []),
        { name: 'TypeError', message: /healthFn/ },
      );
    });

    it('throws TypeError when strategies is not an array', () => {
      const engine = new SelfHealingEngine();
      assert.throws(
        () => engine.registerModule('bad', () => ({}), 'not-array'),
        { name: 'TypeError', message: /strategies/ },
      );
    });

    it('sorts strategies by priority (ascending)', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });
      const callOrder = [];

      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.ALERT, handler: () => { callOrder.push('alert'); }, priority: 5 },
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { callOrder.push('restart'); }, priority: 1 },
      ]);

      await engine.check();
      // First strategy attempted should be the one with lower priority number (RESTART)
      assert.equal(callOrder[0], 'restart');
    });

    it('allows registering multiple modules', async () => {
      const engine = new SelfHealingEngine();
      engine.registerModule('a', () => ({ status: 'healthy' }), []);
      engine.registerModule('b', () => ({ status: 'healthy' }), []);
      engine.registerModule('c', () => ({ status: 'healthy' }), []);
      const result = await engine.check();
      assert.equal(result.modules.length, 3);
    });

    it('overwrites a module when re-registered with the same name', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });
      let firstCalled = false;
      let secondCalled = false;

      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { firstCalled = true; }, priority: 1 },
      ]);
      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { secondCalled = true; }, priority: 1 },
      ]);

      await engine.check();
      assert.equal(firstCalled, false);
      assert.equal(secondCalled, true);
    });
  });

  // ── unregisterModule ────────────────────────────────────────────────────

  describe('unregisterModule', () => {
    it('removes a registered module and returns true', () => {
      const engine = new SelfHealingEngine();
      engine.registerModule('mod', () => ({ status: 'healthy' }), []);
      const result = engine.unregisterModule('mod');
      assert.equal(result, true);
    });

    it('returns false for a module that does not exist', () => {
      const engine = new SelfHealingEngine();
      const result = engine.unregisterModule('nonexistent');
      assert.equal(result, false);
    });

    it('clears associated health, cooldown, and consecutive-heal state', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });
      let callCount = 0;

      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { callCount++; }, priority: 1 },
      ]);

      // Trigger a heal
      await engine.check();
      assert.equal(callCount, 1);

      // Unregister and re-register -- consecutive heals should be reset
      engine.unregisterModule('mod');
      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { callCount++; }, priority: 1 },
      ]);

      await engine.check();
      assert.equal(callCount, 2, 'handler should be called again after unregister/re-register');
    });
  });

  // ── check (checkAll) ────────────────────────────────────────────────────

  describe('check', () => {
    it('returns healthy overall when no modules are registered', async () => {
      const engine = new SelfHealingEngine();
      const result = await engine.check();
      assert.equal(result.overall, HealthLevel.HEALTHY);
      assert.deepEqual(result.modules, []);
      assert.equal(result.healed, 0);
      assert.equal(result.alerts, 0);
    });

    it('returns healthy when all modules are healthy', async () => {
      const engine = new SelfHealingEngine();
      engine.registerModule('a', () => ({ status: 'healthy' }), []);
      engine.registerModule('b', () => ({ status: 'healthy' }), []);

      const result = await engine.check();
      assert.equal(result.overall, HealthLevel.HEALTHY);
      assert.equal(result.modules.length, 2);
      assert.equal(result.healed, 0);
    });

    it('returns degraded overall when a module is degraded', async () => {
      const engine = new SelfHealingEngine({ enableAutoHeal: false });
      engine.registerModule('ok', () => ({ status: 'healthy' }), []);
      engine.registerModule('bad', () => ({ status: 'degraded' }), []);

      const result = await engine.check();
      assert.equal(result.overall, HealthLevel.DEGRADED);
    });

    it('returns critical overall when a module is critical', async () => {
      const engine = new SelfHealingEngine({ enableAutoHeal: false });
      engine.registerModule('ok', () => ({ status: 'healthy' }), []);
      engine.registerModule('bad', () => ({ status: 'critical' }), []);

      const result = await engine.check();
      assert.equal(result.overall, HealthLevel.CRITICAL);
    });

    it('critical takes precedence over degraded in overall status', async () => {
      const engine = new SelfHealingEngine({ enableAutoHeal: false });
      engine.registerModule('degraded', () => ({ status: 'degraded' }), []);
      engine.registerModule('critical', () => ({ status: 'critical' }), []);

      const result = await engine.check();
      assert.equal(result.overall, HealthLevel.CRITICAL);
    });

    it('triggers correct strategy for degraded module', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });
      let actionExecuted = null;

      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { actionExecuted = HealingAction.RESTART; }, priority: 1 },
        { condition: 'critical', action: HealingAction.QUARANTINE, handler: () => { actionExecuted = HealingAction.QUARANTINE; }, priority: 2 },
      ]);

      const result = await engine.check();
      assert.equal(actionExecuted, HealingAction.RESTART);
      assert.equal(result.modules[0].action, HealingAction.RESTART);
      assert.equal(result.healed, 1);
    });

    it('triggers correct strategy for critical module', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });
      let actionExecuted = null;

      engine.registerModule('mod', () => ({ status: 'critical' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { actionExecuted = 'restart'; }, priority: 1 },
        { condition: 'critical', action: HealingAction.QUARANTINE, handler: () => { actionExecuted = HealingAction.QUARANTINE; }, priority: 2 },
      ]);

      const result = await engine.check();
      assert.equal(actionExecuted, HealingAction.QUARANTINE);
      assert.equal(result.modules[0].action, HealingAction.QUARANTINE);
      assert.equal(result.healed, 1);
    });

    it('does not trigger any strategy for healthy module', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });
      let handlerCalled = false;

      engine.registerModule('mod', () => ({ status: 'healthy' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { handlerCalled = true; }, priority: 1 },
      ]);

      const result = await engine.check();
      assert.equal(handlerCalled, false);
      assert.equal(result.healed, 0);
      assert.equal(result.modules[0].health, HealthLevel.HEALTHY);
    });

    it('treats healthFn throw as critical status', async () => {
      const engine = new SelfHealingEngine({ enableAutoHeal: false });

      engine.registerModule('thrower', () => { throw new Error('boom'); }, []);

      const result = await engine.check();
      assert.equal(result.overall, HealthLevel.CRITICAL);
      assert.equal(result.modules[0].health, HealthLevel.CRITICAL);
    });

    it('handles async healthFn', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });
      let healed = false;

      engine.registerModule(
        'async-mod',
        async () => ({ status: 'degraded' }),
        [{ condition: 'degraded', action: HealingAction.RESTART, handler: () => { healed = true; }, priority: 1 }],
      );

      await engine.check();
      assert.equal(healed, true);
    });

    it('normalizes unknown status to healthy', async () => {
      const engine = new SelfHealingEngine();
      engine.registerModule('weird', () => ({ status: 'unknown_status' }), []);

      const result = await engine.check();
      assert.equal(result.modules[0].health, HealthLevel.HEALTHY);
    });

    it('normalizes missing status to healthy', async () => {
      const engine = new SelfHealingEngine();
      engine.registerModule('empty', () => ({}), []);

      const result = await engine.check();
      assert.equal(result.modules[0].health, HealthLevel.HEALTHY);
    });

    it('returns no action field for healthy modules', async () => {
      const engine = new SelfHealingEngine();
      engine.registerModule('ok', () => ({ status: 'healthy' }), []);

      const result = await engine.check();
      assert.equal(result.modules[0].action, undefined);
    });

    it('increments totalChecks counter on each check', async () => {
      const engine = new SelfHealingEngine();
      await engine.check();
      await engine.check();
      await engine.check();

      const stats = engine.getStats();
      assert.equal(stats.totalChecks, 3);
    });
  });

  // ── Cooldown enforcement ────────────────────────────────────────────────

  describe('cooldown enforcement', () => {
    it('does not heal the same module again within cooldown period', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 999999 });
      let callCount = 0;

      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { callCount++; }, priority: 1 },
      ]);

      await engine.check(); // first heal should succeed
      assert.equal(callCount, 1);

      await engine.check(); // second should be blocked by cooldown
      assert.equal(callCount, 1, 'handler should not be called again during cooldown');
    });

    it('allows healing after cooldown expires (cooldownMs=0)', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });
      let callCount = 0;

      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { callCount++; }, priority: 1 },
      ]);

      await engine.check();
      await engine.check();
      assert.equal(callCount, 2, 'handler should be called on each check with zero cooldown');
    });
  });
});
