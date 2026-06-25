import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SelfHealingEngine, HealingAction, HealthLevel } from '../src/self-healing/index.js';

// Split from p8-healing-degradation.test.js — SelfHealingEngine part 2

describe('SelfHealingEngine (part 2)', () => {
  // ── Max auto-heals limit ────────────────────────────────────────────────

  describe('max auto-heals limit', () => {
    it('stops healing after max consecutive heals and emits alert', async () => {
      const engine = new SelfHealingEngine({ maxAutoHeals: 2, cooldownMs: 0 });
      let callCount = 0;

      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { callCount++; }, priority: 1 },
      ]);

      await engine.check(); // heal 1
      assert.equal(callCount, 1);

      await engine.check(); // heal 2
      assert.equal(callCount, 2);

      const result3 = await engine.check(); // should be blocked, emit alert
      assert.equal(callCount, 2, 'handler should not be called after max heals');
      assert.equal(result3.modules[0].action, HealingAction.ALERT);
      assert.equal(result3.alerts, 1);
    });

    it('resets consecutive heal counter when module becomes healthy', async () => {
      const engine = new SelfHealingEngine({ maxAutoHeals: 2, cooldownMs: 0 });
      let callCount = 0;
      let isHealthy = false;

      engine.registerModule('mod', () => ({ status: isHealthy ? 'healthy' : 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { callCount++; }, priority: 1 },
      ]);

      await engine.check(); // heal 1
      await engine.check(); // heal 2
      assert.equal(callCount, 2);

      // Module becomes healthy -- counter should reset
      isHealthy = true;
      await engine.check();

      // Module degrades again -- should be able to heal
      isHealthy = false;
      await engine.check(); // heal 3 (counter was reset)
      assert.equal(callCount, 3, 'counter should reset after healthy check');
    });
  });

  // ── Handler failure & fallback ──────────────────────────────────────────

  describe('handler failure', () => {
    it('tries next strategy when first handler throws', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });
      let fallbackCalled = false;

      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { throw new Error('fail'); }, priority: 1 },
        { condition: 'degraded', action: HealingAction.FALLBACK, handler: () => { fallbackCalled = true; }, priority: 2 },
      ]);

      const result = await engine.check();
      assert.equal(fallbackCalled, true);
      assert.equal(result.healed, 1);
      assert.equal(result.modules[0].action, HealingAction.FALLBACK);
    });

    it('emits alert when all strategies fail', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });

      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { throw new Error('fail1'); }, priority: 1 },
        { condition: 'degraded', action: HealingAction.FALLBACK, handler: () => { throw new Error('fail2'); }, priority: 2 },
      ]);

      const result = await engine.check();
      assert.equal(result.healed, 0);
      assert.equal(result.modules[0].action, HealingAction.ALERT);
      assert.equal(result.alerts, 1);
    });

    it('records failed attempts in history', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });

      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { throw new Error('oops'); }, priority: 1 },
      ]);

      await engine.check();

      const history = engine.getHistory();
      const failedEntries = history.filter((h) => h.success === false);
      assert.ok(failedEntries.length >= 1, 'should have at least one failed history entry');
    });
  });

  // ── Manual heal ─────────────────────────────────────────────────────────

  describe('heal (manual)', () => {
    it('manually heals a degraded module bypassing cooldown', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 999999 });
      let count = 0;

      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { count++; }, priority: 1 },
      ]);

      await engine.check(); // first auto-heal
      assert.equal(count, 1);

      // Auto-heal blocked by cooldown, but manual heal should work
      const result = await engine.heal('mod');
      assert.equal(result.success, true);
      assert.equal(result.action, HealingAction.RESTART);
      assert.equal(count, 2);
    });

    it('returns failure for unregistered module', async () => {
      const engine = new SelfHealingEngine();
      const result = await engine.heal('nonexistent');
      assert.equal(result.success, false);
      assert.equal(result.action, null);
      assert.match(result.message, /not registered/);
    });

    it('returns healthy message when module is already healthy', async () => {
      const engine = new SelfHealingEngine();
      engine.registerModule('mod', () => ({ status: 'healthy' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => {}, priority: 1 },
      ]);

      const result = await engine.heal('mod');
      assert.equal(result.success, true);
      assert.equal(result.action, null);
      assert.match(result.message, /already healthy/);
    });

    it('returns failure when healthFn throws during manual heal', async () => {
      const engine = new SelfHealingEngine();
      engine.registerModule('mod', () => { throw new Error('healthcheck boom'); }, []);

      const result = await engine.heal('mod');
      assert.equal(result.success, false);
      assert.match(result.message, /Health check failed/);
    });

    it('returns failure when no strategy matches the current status', async () => {
      const engine = new SelfHealingEngine();
      engine.registerModule('mod', () => ({ status: 'critical' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => {}, priority: 1 },
      ]);

      const result = await engine.heal('mod');
      assert.equal(result.success, false);
      assert.match(result.message, /No strategy/);
    });
  });

  // ── checkModule ─────────────────────────────────────────────────────────

  describe('checkModule', () => {
    it('checks a specific registered module', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });
      let healed = false;
      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => { healed = true; }, priority: 1 },
      ]);

      const result = await engine.checkModule('mod');
      assert.equal(result.health, HealthLevel.DEGRADED);
      assert.equal(result.healed, true);
      assert.equal(healed, true);
    });

    it('returns healthy for an unregistered module', async () => {
      const engine = new SelfHealingEngine();
      const result = await engine.checkModule('nonexistent');
      assert.equal(result.health, HealthLevel.HEALTHY);
      assert.equal(result.healed, false);
    });
  });

  // ── start / stop ────────────────────────────────────────────────────────

  describe('start and stop', () => {
    it('start sets running to true', () => {
      const engine = new SelfHealingEngine({ checkInterval: 60000 });
      engine.start();
      assert.equal(engine.getStatus().running, true);
      engine.stop();
    });

    it('stop sets running to false', () => {
      const engine = new SelfHealingEngine({ checkInterval: 60000 });
      engine.start();
      engine.stop();
      assert.equal(engine.getStatus().running, false);
    });

    it('calling start twice does not create duplicate timers', () => {
      const engine = new SelfHealingEngine({ checkInterval: 60000 });
      engine.start();
      engine.start(); // should clear previous timer
      engine.stop();
      assert.equal(engine.getStatus().running, false);
    });

    it('calling stop when not running is safe', () => {
      const engine = new SelfHealingEngine();
      engine.stop(); // no-op, should not throw
      assert.equal(engine.getStatus().running, false);
    });
  });

  // ── getStatus ───────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('returns correct structure with all expected fields', () => {
      const engine = new SelfHealingEngine();
      engine.registerModule('a', () => ({ status: 'healthy' }), []);

      const status = engine.getStatus();
      assert.ok('running' in status);
      assert.ok('overall' in status);
      assert.ok('modules' in status);
      assert.ok('healCount' in status);
      assert.ok('alertCount' in status);
      assert.equal(typeof status.running, 'boolean');
      assert.equal(typeof status.overall, 'string');
      assert.ok(Array.isArray(status.modules));
      assert.equal(typeof status.healCount, 'number');
      assert.equal(typeof status.alertCount, 'number');
    });

    it('module entries contain name, health, and lastChecked', () => {
      const engine = new SelfHealingEngine();
      engine.registerModule('mod1', () => ({ status: 'healthy' }), []);

      const status = engine.getStatus();
      assert.equal(status.modules.length, 1);
      assert.equal(status.modules[0].name, 'mod1');
      assert.ok('health' in status.modules[0]);
      assert.ok('lastChecked' in status.modules[0]);
    });

    it('reports healthy when no modules registered', () => {
      const engine = new SelfHealingEngine();
      assert.equal(engine.getStatus().overall, HealthLevel.HEALTHY);
    });
  });

  // ── getStats ────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns correct structure', () => {
      const engine = new SelfHealingEngine();
      const stats = engine.getStats();
      assert.ok('totalChecks' in stats);
      assert.ok('totalHeals' in stats);
      assert.ok('successRate' in stats);
      assert.ok('byModule' in stats);
      assert.ok('byAction' in stats);
    });

    it('computes successRate correctly', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });
      let shouldSucceed = true;

      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        {
          condition: 'degraded',
          action: HealingAction.RESTART,
          handler: () => { if (!shouldSucceed) throw new Error('fail'); },
          priority: 1,
        },
      ]);

      await engine.check(); // success
      shouldSucceed = false;
      await engine.check(); // fail

      const stats = engine.getStats();
      assert.equal(stats.totalHeals, 2);
      assert.equal(stats.successRate, 0.5);
    });

    it('populates byModule breakdown', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });
      engine.registerModule('modA', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => {}, priority: 1 },
      ]);

      await engine.check();

      const stats = engine.getStats();
      assert.ok(stats.byModule['modA']);
      assert.equal(stats.byModule['modA'].heals, 1);
      assert.equal(stats.byModule['modA'].successes, 1);
    });
  });

  // ── getHistory ──────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('returns empty array initially', () => {
      const engine = new SelfHealingEngine();
      assert.deepEqual(engine.getHistory(), []);
    });

    it('records healing events', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });
      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => {}, priority: 1 },
      ]);

      await engine.check();

      const history = engine.getHistory();
      assert.ok(history.length >= 1);
      assert.equal(history[0].module, 'mod');
      assert.equal(history[0].action, HealingAction.RESTART);
      assert.equal(history[0].success, true);
      assert.ok(typeof history[0].timestamp === 'number');
      assert.ok(typeof history[0].duration === 'number');
      assert.ok(typeof history[0].message === 'string');
    });

    it('filters by module name', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });
      engine.registerModule('a', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => {}, priority: 1 },
      ]);
      engine.registerModule('b', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.FALLBACK, handler: () => {}, priority: 1 },
      ]);

      await engine.check();

      const filtered = engine.getHistory({ module: 'a' });
      assert.ok(filtered.every((h) => h.module === 'a'));
    });

    it('filters by action type', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });
      engine.registerModule('a', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => {}, priority: 1 },
      ]);
      engine.registerModule('b', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.FALLBACK, handler: () => {}, priority: 1 },
      ]);

      await engine.check();

      const filtered = engine.getHistory({ action: HealingAction.RESTART });
      assert.ok(filtered.every((h) => h.action === HealingAction.RESTART));
    });

    it('respects the limit parameter', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0, maxAutoHeals: 10 });
      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => {}, priority: 1 },
      ]);

      for (let i = 0; i < 5; i++) {
        await engine.check();
      }

      const limited = engine.getHistory({ limit: 2 });
      assert.equal(limited.length, 2);
    });

    it('returns entries sorted by timestamp descending', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });
      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => {}, priority: 1 },
      ]);

      await engine.check();
      await engine.check();
      await engine.check();

      const history = engine.getHistory();
      for (let i = 1; i < history.length; i++) {
        assert.ok(history[i - 1].timestamp >= history[i].timestamp);
      }
    });
  });

  // ── clear ───────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('resets history, counters, and cooldown state', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0 });
      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => {}, priority: 1 },
      ]);

      await engine.check();
      await engine.check();

      assert.ok(engine.getHistory().length > 0);
      assert.ok(engine.getStats().totalChecks > 0);

      engine.clear();

      assert.deepEqual(engine.getHistory(), []);
      assert.equal(engine.getStats().totalChecks, 0);
      assert.equal(engine.getStats().totalHeals, 0);
      assert.equal(engine.getStats().successRate, 0);
    });

    it('preserves module registrations', async () => {
      const engine = new SelfHealingEngine();
      engine.registerModule('mod', () => ({ status: 'healthy' }), []);
      engine.clear();

      const status = engine.getStatus();
      assert.equal(status.modules.length, 1);
      assert.equal(status.modules[0].name, 'mod');
    });
  });

  // ── History ring buffer ─────────────────────────────────────────────────

  describe('history ring buffer', () => {
    it('trims oldest entries when exceeding historySize', async () => {
      const engine = new SelfHealingEngine({ cooldownMs: 0, historySize: 3, maxAutoHeals: 10 });
      engine.registerModule('mod', () => ({ status: 'degraded' }), [
        { condition: 'degraded', action: HealingAction.RESTART, handler: () => {}, priority: 1 },
      ]);

      for (let i = 0; i < 6; i++) {
        await engine.check();
      }

      // History should not exceed historySize (plus possible alert entries)
      // The ring buffer trims when length > historySize
      const allHistory = engine.getHistory({ limit: 100 });
      assert.ok(allHistory.length <= 3, `expected <= 3 entries, got ${allHistory.length}`);
    });
  });
});
