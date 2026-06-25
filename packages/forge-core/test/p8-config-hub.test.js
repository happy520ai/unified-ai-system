import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { UnifiedConfigHub } from '../src/config-hub/index.js';

// ============================================================================
// UnifiedConfigHub — Constructor, registerSchema, get/set, reset, subscriptions
// ============================================================================

describe('UnifiedConfigHub', () => {
  // ── Constructor ──────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates an instance with default options', () => {
      const hub = new UnifiedConfigHub();
      const status = hub.getStatus();
      assert.ok(status.schemas > 0, 'Core schemas should be pre-registered');
      assert.equal(status.overrides, 0);
      assert.equal(status.envMappings, 0);
    });

    it('pre-registers all core schemas', () => {
      const hub = new UnifiedConfigHub();
      const modules = hub.listModules();
      const expectedCore = ['pool', 'budget', 'server', 'llm', 'worker', 'verification', 'metrics', 'memory', 'cost', 'scaling', 'errors', 'prompts', 'cache', 'priority'];
      for (const name of expectedCore) {
        assert.ok(modules.includes(name), `Core schema "${name}" should be pre-registered`);
      }
    });

    it('accepts a custom envPrefix', () => {
      const hub = new UnifiedConfigHub({ envPrefix: 'MYAPP_' });
      process.env.MYAPP_SERVER__PORT = '9999';
      hub.loadFromEnv();
      const cfg = hub.get('server');
      assert.equal(cfg.port, 9999);
      delete process.env.MYAPP_SERVER__PORT;
    });

    it('accepts global defaults option', () => {
      const hub = new UnifiedConfigHub({ defaults: { custom: 'value' } });
      assert.ok(hub);
    });

    it('accepts strictValidation option', () => {
      const hub = new UnifiedConfigHub({ strictValidation: true });
      assert.ok(hub);
    });
  });

  // ── registerSchema ───────────────────────────────────────────────────────

  describe('registerSchema', () => {
    it('registers a new module schema successfully', () => {
      const hub = new UnifiedConfigHub();
      hub.registerSchema('mymodule', {
        properties: {
          setting1: { type: 'string', default: 'hello' },
          setting2: { type: 'number', default: 42 },
        },
        required: ['setting1'],
      });
      const cfg = hub.get('mymodule');
      assert.equal(cfg.setting1, 'hello');
      assert.equal(cfg.setting2, 42);
    });

    it('overwrites an existing schema for the same module name', () => {
      const hub = new UnifiedConfigHub();
      hub.registerSchema('test', { properties: { a: { type: 'string', default: 'x' } }, required: [] });
      hub.registerSchema('test', { properties: { b: { type: 'number', default: 99 } }, required: [] });
      const cfg = hub.get('test');
      assert.equal(cfg.b, 99);
      assert.equal(cfg.a, undefined);
    });

    it('handles schema with empty properties', () => {
      const hub = new UnifiedConfigHub();
      hub.registerSchema('empty', { properties: {}, required: [] });
      const cfg = hub.get('empty');
      assert.deepEqual(cfg, {});
    });

    it('handles schema without required array', () => {
      const hub = new UnifiedConfigHub();
      hub.registerSchema('opt', {
        properties: { x: { type: 'number', default: 10 } },
      });
      const cfg = hub.get('opt');
      assert.equal(cfg.x, 10);
    });
  });

  // ── get() resolution ─────────────────────────────────────────────────────

  describe('get() resolution', () => {
    it('returns schema defaults when no overrides exist', () => {
      const hub = new UnifiedConfigHub();
      const cfg = hub.get('server');
      assert.equal(cfg.port, 4500);
      assert.equal(cfg.corsOrigin, '*');
    });

    it('overrides take precedence over defaults', () => {
      const hub = new UnifiedConfigHub();
      hub.set('server', 'port', 8080);
      const cfg = hub.get('server');
      assert.equal(cfg.port, 8080);
    });

    it('env vars take precedence over overrides', () => {
      const hub = new UnifiedConfigHub();
      hub.set('server', 'port', 8080);
      process.env.FORGE_SERVER__PORT = '9090';
      hub.loadFromEnv();
      const cfg = hub.get('server');
      assert.equal(cfg.port, 9090);
      delete process.env.FORGE_SERVER__PORT;
    });

    it('returns empty object for unknown module without schema', () => {
      const hub = new UnifiedConfigHub();
      const cfg = hub.get('nonexistent');
      assert.deepEqual(cfg, {});
    });

    it('returns overrides for unknown module that has overrides set', () => {
      const hub = new UnifiedConfigHub();
      hub.set('unknown', 'key', 'value');
      const cfg = hub.get('unknown');
      assert.equal(cfg.key, 'value');
    });
  });

  // ── set() and setMany() ──────────────────────────────────────────────────

  describe('set() and setMany()', () => {
    it('set returns true when value changes', () => {
      const hub = new UnifiedConfigHub();
      const changed = hub.set('server', 'port', 3000);
      assert.equal(changed, true);
    });

    it('set returns false when value is the same', () => {
      const hub = new UnifiedConfigHub();
      hub.set('server', 'port', 3000);
      const changed = hub.set('server', 'port', 3000);
      assert.equal(changed, false);
    });

    it('set supports nested dot-separated keys', () => {
      const hub = new UnifiedConfigHub();
      hub.registerSchema('nested', { properties: {}, required: [] });
      hub.set('nested', 'a.b.c', 42);
      const cfg = hub.get('nested');
      assert.equal(cfg.a.b.c, 42);
    });

    it('setMany sets multiple overrides at once', () => {
      const hub = new UnifiedConfigHub();
      hub.setMany('server', { port: 3000, corsOrigin: 'http://localhost' });
      const cfg = hub.get('server');
      assert.equal(cfg.port, 3000);
      assert.equal(cfg.corsOrigin, 'http://localhost');
    });

    it('setMany with empty object does nothing harmful', () => {
      const hub = new UnifiedConfigHub();
      hub.setMany('server', {});
      const cfg = hub.get('server');
      assert.equal(cfg.port, 4500); // default still intact
    });
  });

  // ── reset() ──────────────────────────────────────────────────────────────

  describe('reset()', () => {
    it('clears overrides for a module, restoring defaults', () => {
      const hub = new UnifiedConfigHub();
      hub.set('server', 'port', 9999);
      assert.equal(hub.get('server').port, 9999);
      hub.reset('server');
      assert.equal(hub.get('server').port, 4500);
    });

    it('is safe to call reset on a module with no overrides', () => {
      const hub = new UnifiedConfigHub();
      hub.reset('server');
      assert.equal(hub.get('server').port, 4500);
    });

    it('notifies subscribers when reset occurs', () => {
      const hub = new UnifiedConfigHub();
      hub.set('server', 'port', 9999);
      let notified = false;
      hub.onChange('server', () => { notified = true; });
      hub.reset('server');
      assert.equal(notified, true);
    });
  });

  // ── subscribe (onChange) ─────────────────────────────────────────────────

  describe('onChange subscriptions', () => {
    it('notifies subscriber when a module config changes', () => {
      const hub = new UnifiedConfigHub();
      let callCount = 0;
      hub.onChange('server', () => { callCount++; });
      hub.set('server', 'port', 3000);
      assert.equal(callCount, 1);
    });

    it('passes module name and resolved config to the callback', () => {
      const hub = new UnifiedConfigHub();
      let receivedModule = null;
      let receivedConfig = null;
      hub.onChange('server', (mod, cfg) => {
        receivedModule = mod;
        receivedConfig = cfg;
      });
      hub.set('server', 'port', 3001);
      assert.equal(receivedModule, 'server');
      assert.equal(receivedConfig.port, 3001);
    });

    it('does not notify when value does not change', () => {
      const hub = new UnifiedConfigHub();
      hub.set('server', 'port', 3000);
      let callCount = 0;
      hub.onChange('server', () => { callCount++; });
      hub.set('server', 'port', 3000);
      assert.equal(callCount, 0);
    });

    it('unsubscribe function stops further notifications', () => {
      const hub = new UnifiedConfigHub();
      let callCount = 0;
      const unsub = hub.onChange('server', () => { callCount++; });
      hub.set('server', 'port', 3001);
      assert.equal(callCount, 1);
      unsub();
      hub.set('server', 'port', 3002);
      assert.equal(callCount, 1); // still 1
    });

    it('supports multiple subscribers for the same module', () => {
      const hub = new UnifiedConfigHub();
      let count1 = 0;
      let count2 = 0;
      hub.onChange('server', () => { count1++; });
      hub.onChange('server', () => { count2++; });
      hub.set('server', 'port', 4000);
      assert.equal(count1, 1);
      assert.equal(count2, 1);
    });

    it('subscriber errors are silently caught', () => {
      const hub = new UnifiedConfigHub();
      hub.onChange('server', () => { throw new Error('boom'); });
      hub.set('server', 'port', 5000);
      assert.ok(true);
    });
  });
});
