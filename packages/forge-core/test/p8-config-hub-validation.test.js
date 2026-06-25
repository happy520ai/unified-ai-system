import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { UnifiedConfigHub } from '../src/config-hub/index.js';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ============================================================================
// UnifiedConfigHub — loadFromEnv, type coercion, loadFromFile, validate,
// getStatus, export/import, clearOverrides, getSchema, edge cases
// ============================================================================

describe('UnifiedConfigHub (validation & env)', () => {
  // ── loadFromEnv() ────────────────────────────────────────────────────────

  describe('loadFromEnv()', () => {
    after(() => {
      delete process.env.FORGE_MEMORY__HOT_MAX_ENTRIES;
      delete process.env.FORGE_LLM__PROVIDER;
      delete process.env.FORGE_SERVER__CORS_ORIGIN;
    });

    it('reads environment variables with the FORGE_ prefix', () => {
      const hub = new UnifiedConfigHub();
      process.env.FORGE_MEMORY__HOT_MAX_ENTRIES = '2000';
      const result = hub.loadFromEnv();
      assert.ok(result.loaded > 0);
      const cfg = hub.get('memory');
      assert.equal(cfg.hotMaxEntries, 2000);
    });

    it('converts snake_case env keys to camelCase', () => {
      const hub = new UnifiedConfigHub();
      process.env.FORGE_SERVER__CORS_ORIGIN = 'http://example.com';
      hub.loadFromEnv();
      const cfg = hub.get('server');
      assert.equal(cfg.corsOrigin, 'http://example.com');
    });

    it('ignores env vars without double underscore separator', () => {
      const hub = new UnifiedConfigHub();
      process.env.FORGE_NODOUBLEUNDERSCORE = 'ignored';
      const result = hub.loadFromEnv();
      const found = result.mappings.some(m => m.envVar === 'FORGE_NODOUBLEUNDERSCORE');
      assert.equal(found, false);
      delete process.env.FORGE_NODOUBLEUNDERSCORE;
    });

    it('returns mappings array with module, key, envVar', () => {
      const hub = new UnifiedConfigHub();
      process.env.FORGE_LLM__PROVIDER = 'openai';
      const result = hub.loadFromEnv();
      const mapping = result.mappings.find(m => m.module === 'llm' && m.key === 'provider');
      assert.ok(mapping);
      assert.equal(mapping.envVar, 'FORGE_LLM__PROVIDER');
    });
  });

  // ── Type coercion from env vars ──────────────────────────────────────────

  describe('type coercion from env vars', () => {
    after(() => {
      delete process.env.FORGE_SERVER__PORT;
      delete process.env.FORGE_POOL__ENABLE_CODE_INTEL;
      delete process.env.FORGE_LLM__TEMPERATURE;
    });

    it('coerces string to number', () => {
      const hub = new UnifiedConfigHub();
      process.env.FORGE_SERVER__PORT = '5555';
      hub.loadFromEnv();
      const cfg = hub.get('server');
      assert.equal(cfg.port, 5555);
      assert.equal(typeof cfg.port, 'number');
    });

    it('coerces "true" to boolean true', () => {
      const hub = new UnifiedConfigHub();
      process.env.FORGE_POOL__ENABLE_CODE_INTEL = 'true';
      hub.loadFromEnv();
      const cfg = hub.get('pool');
      assert.equal(cfg.enableCodeIntel, true);
    });

    it('coerces "false" to boolean false', () => {
      const hub = new UnifiedConfigHub();
      process.env.FORGE_POOL__ENABLE_CODE_INTEL = 'false';
      hub.loadFromEnv();
      const cfg = hub.get('pool');
      assert.equal(cfg.enableCodeIntel, false);
    });

    it('coerces "1" to boolean true', () => {
      const hub = new UnifiedConfigHub();
      process.env.FORGE_POOL__ENABLE_CODE_INTEL = '1';
      hub.loadFromEnv();
      const cfg = hub.get('pool');
      assert.equal(cfg.enableCodeIntel, true);
    });

    it('coerces "0" to boolean false', () => {
      const hub = new UnifiedConfigHub();
      process.env.FORGE_POOL__ENABLE_CODE_INTEL = '0';
      hub.loadFromEnv();
      const cfg = hub.get('pool');
      assert.equal(cfg.enableCodeIntel, false);
    });

    it('coerces float string to number', () => {
      const hub = new UnifiedConfigHub();
      process.env.FORGE_LLM__TEMPERATURE = '0.7';
      hub.loadFromEnv();
      const cfg = hub.get('llm');
      assert.equal(cfg.temperature, 0.7);
    });
  });

  // ── loadFromFile() ───────────────────────────────────────────────────────

  describe('loadFromFile()', () => {
    let tmpDir;

    before(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'p8-config-test-'));
    });

    after(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('loads JSON overrides from a file', async () => {
      const filePath = join(tmpDir, 'config.json');
      writeFileSync(filePath, JSON.stringify({
        server: { port: 7777, corsOrigin: 'http://test.com' },
        llm: { provider: 'anthropic' },
      }));

      const hub = new UnifiedConfigHub();
      const result = await hub.loadFromFile(filePath);
      assert.equal(result.loaded, 3);
      assert.ok(result.modules.includes('server'));
      assert.ok(result.modules.includes('llm'));

      const serverCfg = hub.get('server');
      assert.equal(serverCfg.port, 7777);
      assert.equal(serverCfg.corsOrigin, 'http://test.com');

      const llmCfg = hub.get('llm');
      assert.equal(llmCfg.provider, 'anthropic');
    });

    it('returns loaded=0 for a non-existent file', async () => {
      const hub = new UnifiedConfigHub();
      const result = await hub.loadFromFile(join(tmpDir, 'nonexistent.json'));
      assert.equal(result.loaded, 0);
      assert.deepEqual(result.modules, []);
    });

    it('returns loaded=0 for a corrupt JSON file', async () => {
      const filePath = join(tmpDir, 'corrupt.json');
      writeFileSync(filePath, 'not valid json {{{');

      const hub = new UnifiedConfigHub();
      const result = await hub.loadFromFile(filePath);
      assert.equal(result.loaded, 0);
    });
  });

  // ── validate() ───────────────────────────────────────────────────────────

  describe('validate()', () => {
    it('returns valid for default core configurations', () => {
      const hub = new UnifiedConfigHub();
      const result = hub.validate();
      assert.equal(result.valid, true);
      assert.deepEqual(result.errors, []);
    });

    it('detects type mismatch when override has wrong type', () => {
      const hub = new UnifiedConfigHub();
      hub.set('server', 'port', 'not-a-number');
      const result = hub.validateModule('server');
      const portError = result.errors.find(e => e.key === 'port');
      assert.ok(portError, 'Should detect type mismatch on port');
      assert.ok(portError.message.includes('Expected type "number"'));
    });

    it('returns valid for unknown module (no schema)', () => {
      const hub = new UnifiedConfigHub();
      const result = hub.validateModule('nonexistent');
      assert.equal(result.valid, true);
    });

    it('validates numeric range constraints (min/max)', () => {
      const hub = new UnifiedConfigHub();
      hub.registerSchema('ranged', {
        properties: {
          value: { type: 'number', default: 5, min: 0, max: 10 },
        },
        required: [],
      });
      hub.set('ranged', 'value', 20);
      const result = hub.validateModule('ranged');
      const err = result.errors.find(e => e.key === 'value');
      assert.ok(err);
      assert.ok(err.message.includes('exceeds maximum'));
    });

    it('validates custom validate functions', () => {
      const hub = new UnifiedConfigHub();
      hub.registerSchema('custom', {
        properties: {
          email: {
            type: 'string',
            default: 'test@example.com',
            validate: (v) => v.includes('@') ? null : 'Must contain @',
          },
        },
        required: [],
      });
      hub.set('custom', 'email', 'invalid-email');
      const result = hub.validateModule('custom');
      const err = result.errors.find(e => e.key === 'email');
      assert.ok(err);
      assert.ok(err.message.includes('Must contain @'));
    });

    it('strict mode rejects unknown keys', () => {
      const hub = new UnifiedConfigHub({ strictValidation: true });
      hub.registerSchema('strict', {
        properties: { known: { type: 'string', default: 'ok' } },
        required: [],
      });
      hub.set('strict', 'unknown', 'surprise');
      const result = hub.validateModule('strict');
      const err = result.errors.find(e => e.key === 'unknown');
      assert.ok(err);
      assert.ok(err.message.includes('Unknown configuration key'));
    });

    it('detects missing required fields when defaults are absent', () => {
      const hub = new UnifiedConfigHub();
      hub.registerSchema('reqtest', {
        properties: {
          required_field: { type: 'string' }, // no default
        },
        required: ['required_field'],
      });
      const result = hub.validateModule('reqtest');
      const err = result.errors.find(e => e.key === 'required_field');
      assert.ok(err);
      assert.ok(err.message.includes('Required field'));
    });
  });

  // ── getStatus ────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('returns correct structure with modules, schemas, overrides, envMappings', () => {
      const hub = new UnifiedConfigHub();
      const status = hub.getStatus();
      assert.ok(Array.isArray(status.modules));
      assert.equal(typeof status.schemas, 'number');
      assert.equal(typeof status.overrides, 'number');
      assert.equal(typeof status.envMappings, 'number');
    });

    it('reflects override count accurately', () => {
      const hub = new UnifiedConfigHub();
      hub.set('server', 'port', 3000);
      hub.set('server', 'corsOrigin', 'http://test');
      const status = hub.getStatus();
      assert.equal(status.overrides, 2);
    });

    it('reflects env mapping count after loadFromEnv', () => {
      const hub = new UnifiedConfigHub();
      process.env.FORGE_SERVER__PORT = '1234';
      hub.loadFromEnv();
      const status = hub.getStatus();
      assert.ok(status.envMappings >= 1);
      delete process.env.FORGE_SERVER__PORT;
    });
  });

  // ── export / import ──────────────────────────────────────────────────────

  describe('export and import', () => {
    it('export returns all module configs', () => {
      const hub = new UnifiedConfigHub();
      const exported = hub.export();
      assert.ok('server' in exported);
      assert.ok('memory' in exported);
      assert.equal(exported.server.port, 4500);
    });

    it('import sets overrides from a flat map', () => {
      const hub = new UnifiedConfigHub();
      const result = hub.import({
        server: { port: 6000 },
        llm: { provider: 'openai' },
      });
      assert.equal(result.imported, 2);
      assert.ok(result.modules.includes('server'));
      assert.equal(hub.get('server').port, 6000);
      assert.equal(hub.get('llm').provider, 'openai');
    });

    it('import skips non-object values', () => {
      const hub = new UnifiedConfigHub();
      const result = hub.import({ badkey: 'not-an-object' });
      assert.equal(result.imported, 0);
    });
  });

  // ── clearOverrides / clear ───────────────────────────────────────────────

  describe('clearOverrides and clear', () => {
    it('clearOverrides removes all runtime overrides and env values', () => {
      const hub = new UnifiedConfigHub();
      hub.set('server', 'port', 9000);
      process.env.FORGE_MEMORY__HOT_MAX_ENTRIES = '9999';
      hub.loadFromEnv();
      hub.clearOverrides();
      const cfg = hub.get('server');
      assert.equal(cfg.port, 4500); // back to default
      delete process.env.FORGE_MEMORY__HOT_MAX_ENTRIES;
    });

    it('clearOverrides preserves schemas', () => {
      const hub = new UnifiedConfigHub();
      hub.set('server', 'port', 9000);
      hub.clearOverrides();
      const modules = hub.listModules();
      assert.ok(modules.includes('server'));
    });

    it('clear removes everything including schemas', () => {
      const hub = new UnifiedConfigHub();
      hub.clear();
      assert.deepEqual(hub.listModules(), []);
      assert.equal(hub.getStatus().schemas, 0);
    });
  });

  // ── getSchema ────────────────────────────────────────────────────────────

  describe('getSchema', () => {
    it('returns the schema for a registered module', () => {
      const hub = new UnifiedConfigHub();
      const schema = hub.getSchema('server');
      assert.ok(schema);
      assert.ok(schema.properties.port);
      assert.equal(schema.properties.port.type, 'number');
    });

    it('returns null for an unregistered module', () => {
      const hub = new UnifiedConfigHub();
      const schema = hub.getSchema('nonexistent');
      assert.equal(schema, null);
    });

    it('returns a deep clone (modifications do not affect internal state)', () => {
      const hub = new UnifiedConfigHub();
      const schema = hub.getSchema('server');
      schema.properties.port.default = 99999;
      const freshSchema = hub.getSchema('server');
      assert.equal(freshSchema.properties.port.default, 4500);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('get returns deep-cloned config (mutations do not leak)', () => {
      const hub = new UnifiedConfigHub();
      const cfg1 = hub.get('server');
      cfg1.port = 99999;
      const cfg2 = hub.get('server');
      assert.equal(cfg2.port, 4500);
    });

    it('setMany notifies per key that actually changes', () => {
      const hub = new UnifiedConfigHub();
      let notifications = 0;
      hub.onChange('server', () => { notifications++; });
      hub.setMany('server', { port: 3000, corsOrigin: 'http://new' });
      assert.equal(notifications, 2);
    });

    it('loadFromEnv with no matching env vars returns loaded=0', () => {
      const hub = new UnifiedConfigHub({ envPrefix: 'UNIQUE_PREFIX_XYZ_' });
      const result = hub.loadFromEnv();
      assert.equal(result.loaded, 0);
    });

    it('clearOverrides notifies affected modules', () => {
      const hub = new UnifiedConfigHub();
      hub.set('server', 'port', 9000);
      let notified = false;
      hub.onChange('server', () => { notified = true; });
      hub.clearOverrides();
      assert.equal(notified, true);
    });
  });
});
