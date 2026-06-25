import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/** All env vars that ForgeConfig reads — must be cleared for isolation. */
const ALL_FORGE_ENVS = [
  'FORGE_POOL_MAX_CONCURRENT', 'FORGE_POOL_MAX_GOALS', 'FORGE_POOL_AUTO_VERIFY',
  'FORGE_MAX_CONCURRENT', 'FORGE_MAX_TOKENS', 'FORGE_MAX_COST', 'FORGE_MAX_MINUTES',
  'FORGE_CODE_INTEL', 'FORGE_SERVER_PORT', 'FORGE_CORS_ORIGIN', 'FORGE_SNAPSHOT_INTERVAL',
  'FORGE_LLM_PROVIDER', 'FORGE_LLM_MODEL', 'FORGE_LLM_TEMPERATURE', 'FORGE_LLM_MAX_TOKENS',
  'FORGE_GATEWAY_URL', 'FORGE_WORKER_TEMPERATURE', 'FORGE_WORKER_BASH_TIMEOUT',
  'FORGE_VERIFY_MAX_TIER', 'FORGE_METRICS_WINDOW', 'FORGE_METRICS_MAX_RECORDS',
];

function clearForgeEnvs() {
  for (const k of ALL_FORGE_ENVS) delete process.env[k];
}

let ForgeConfig;
before(async () => {
  const mod = await import('../src/config/index.js');
  ForgeConfig = mod.ForgeConfig;
});

describe('ForgeConfig', { concurrency: 1 }, () => {
  it('should export ForgeConfig class', () => {
    assert.ok(ForgeConfig);
    assert.strictEqual(typeof ForgeConfig, 'function');
  });

  it('should load defaults when no config file exists', () => {
    const cfg = new ForgeConfig({ configPath: '/nonexistent/forge.config.yaml' });
    assert.strictEqual(cfg.pool.maxConcurrent, 4);
    assert.strictEqual(cfg.pool.maxGoals, 3);
    assert.strictEqual(cfg.budget.maxTokens, 500000);
    assert.strictEqual(cfg.server.port, 4500);
    assert.strictEqual(cfg.llm.provider, 'xiaomi');
    assert.strictEqual(cfg.worker.temperature, 0.1);
    assert.strictEqual(cfg.verification.maxTier, 5);
    assert.strictEqual(cfg.metrics.maxRecords, 5000);
    assert.strictEqual(cfg.priority.explore, 100);
  });

  it('should load and parse a YAML config file', () => {
    const tmpFile = join(tmpdir(), 'forge-test-' + Date.now() + '.yaml');
    writeFileSync(tmpFile, [
      'pool:',
      '  maxConcurrent: 8',
      '  maxGoals: 5',
      '  enableAutoVerify: false',
      'budget:',
      '  maxTokens: 1000000',
      '  maxCost: 25.0',
      'server:',
      '  port: 9000',
      '  corsOrigin: "https://example.com"',
      '  snapshotInterval: 10000',
    ].join('\n'));

    try {
      const cfg = new ForgeConfig({ configPath: tmpFile });
      assert.strictEqual(cfg.pool.maxConcurrent, 8);
      assert.strictEqual(cfg.pool.maxGoals, 5);
      assert.strictEqual(cfg.pool.enableAutoVerify, false);
      assert.strictEqual(cfg.budget.maxTokens, 1000000);
      assert.strictEqual(cfg.budget.maxCost, 25.0);
      assert.strictEqual(cfg.server.port, 9000);
      assert.strictEqual(cfg.server.corsOrigin, 'https://example.com');
      assert.strictEqual(cfg.server.snapshotInterval, 10000);
      // Defaults still present for unset sections
      assert.strictEqual(cfg.worker.temperature, 0.1);
      assert.strictEqual(cfg.priority.explore, 100);
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it('should merge file values with defaults', () => {
    const tmpFile = join(tmpdir(), 'forge-test-merge-' + Date.now() + '.yaml');
    writeFileSync(tmpFile, 'pool:\n  maxConcurrent: 16\n');

    try {
      const cfg = new ForgeConfig({ configPath: tmpFile });
      assert.strictEqual(cfg.pool.maxConcurrent, 16);
      // Other pool defaults preserved
      assert.strictEqual(cfg.pool.maxGoals, 3);
      assert.strictEqual(cfg.pool.enableCodeIntel, true);
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it('should apply environment variable overrides', () => {
    clearForgeEnvs();
    process.env.FORGE_POOL_MAX_CONCURRENT = '12';
    process.env.FORGE_MAX_COST = '50';
    process.env.FORGE_LLM_TEMPERATURE = '0.5';

    try {
      const cfg = new ForgeConfig({ configPath: '/nonexistent' });
      assert.strictEqual(cfg.pool.maxConcurrent, 12);
      assert.strictEqual(cfg.budget.maxCost, 50);
      assert.strictEqual(cfg.llm.temperature, 0.5);
    } finally {
      clearForgeEnvs();
    }
  });

  it('env vars should override file values', () => {
    clearForgeEnvs();
    const tmpFile = join(tmpdir(), 'forge-test-env-' + Date.now() + '.yaml');
    writeFileSync(tmpFile, 'pool:\n  maxConcurrent: 6\n');

    process.env.FORGE_POOL_MAX_CONCURRENT = '20';

    try {
      const cfg = new ForgeConfig({ configPath: tmpFile });
      assert.strictEqual(cfg.pool.maxConcurrent, 20); // env wins
    } finally {
      clearForgeEnvs();
      unlinkSync(tmpFile);
    }
  });

  it('should support get() with dot-path', () => {
    clearForgeEnvs();
    const cfg = new ForgeConfig({ configPath: '/nonexistent' });
    assert.strictEqual(cfg.get('pool.maxConcurrent'), 4);
    assert.strictEqual(cfg.get('budget.maxCost'), 10.0);
    assert.strictEqual(cfg.get('nonexistent.key', 'fallback'), 'fallback');
    assert.strictEqual(cfg.get('pool.nonexistent', 42), 42);
  });

  it('should support set() at runtime', () => {
    clearForgeEnvs();
    const cfg = new ForgeConfig({ configPath: '/nonexistent' });
    assert.strictEqual(cfg.pool.maxConcurrent, 4);

    cfg.set('pool.maxConcurrent', 10);
    assert.strictEqual(cfg.pool.maxConcurrent, 10);
    assert.strictEqual(cfg.get('pool.maxConcurrent'), 10);
  });

  it('should emit change event on set()', () => {
    const cfg = new ForgeConfig({ configPath: '/nonexistent' });
    let changed = false;
    cfg.on('change', () => { changed = true; });

    cfg.set('pool.maxConcurrent', 8);
    assert.ok(changed);
  });

  it('should not emit change when value is the same', () => {
    clearForgeEnvs();
    const cfg = new ForgeConfig({ configPath: '/nonexistent' });
    let changeCount = 0;
    cfg.on('change', () => { changeCount++; });

    cfg.set('pool.maxConcurrent', 4); // same as default
    assert.strictEqual(changeCount, 0);
  });

  it('should support reload()', () => {
    const tmpFile = join(tmpdir(), 'forge-test-reload-' + Date.now() + '.yaml');
    writeFileSync(tmpFile, 'pool:\n  maxConcurrent: 3\n');

    try {
      const cfg = new ForgeConfig({ configPath: tmpFile });
      assert.strictEqual(cfg.pool.maxConcurrent, 3);

      // Modify the file
      writeFileSync(tmpFile, 'pool:\n  maxConcurrent: 7\n');
      cfg.reload();
      assert.strictEqual(cfg.pool.maxConcurrent, 7);
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it('should emit change event on reload when values differ', () => {
    const tmpFile = join(tmpdir(), 'forge-test-reload-evt-' + Date.now() + '.yaml');
    writeFileSync(tmpFile, 'pool:\n  maxConcurrent: 3\n');

    try {
      const cfg = new ForgeConfig({ configPath: tmpFile });
      let changeData = null;
      cfg.on('change', (data) => { changeData = data; });

      writeFileSync(tmpFile, 'pool:\n  maxConcurrent: 9\n');
      cfg.reload();

      assert.ok(changeData);
      assert.strictEqual(changeData.pool.maxConcurrent, 9);
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it('should return a getStatus() summary', () => {
    const cfg = new ForgeConfig({ configPath: '/nonexistent' });
    const status = cfg.getStatus();

    assert.ok(status);
    assert.strictEqual(status.source, '/nonexistent');
    assert.ok(Array.isArray(status.sections));
    assert.ok(status.pool);
    assert.ok(status.budget);
    assert.ok(status.server);
    assert.ok(status.llm);
    assert.ok(status.worker);
    assert.ok(status.verification);
    assert.ok(status.metrics);
    assert.ok(status.priority);
    assert.strictEqual(status.watching, false);
  });

  it('should handle YAML with comments and blank lines', () => {
    const tmpFile = join(tmpdir(), 'forge-test-comments-' + Date.now() + '.yaml');
    writeFileSync(tmpFile, [
      '# Main configuration',
      '',
      'pool:',
      '  # Max parallel workers',
      '  maxConcurrent: 6',
      '',
      '  maxGoals: 2  # inline comment',
      '',
      '# Budget section',
      'budget:',
      '  maxCost: 15.5',
    ].join('\n'));

    try {
      const cfg = new ForgeConfig({ configPath: tmpFile });
      assert.strictEqual(cfg.pool.maxConcurrent, 6);
      assert.strictEqual(cfg.pool.maxGoals, 2);
      assert.strictEqual(cfg.budget.maxCost, 15.5);
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it('should handle boolean and string types correctly', () => {
    const tmpFile = join(tmpdir(), 'forge-test-types-' + Date.now() + '.yaml');
    writeFileSync(tmpFile, [
      'pool:',
      '  enableCodeIntel: false',
      '  enableVerification: true',
      'server:',
      '  corsOrigin: "http://localhost:3000"',
      '  version: "1.0.0"',
    ].join('\n'));

    try {
      const cfg = new ForgeConfig({ configPath: tmpFile });
      assert.strictEqual(cfg.pool.enableCodeIntel, false);
      assert.strictEqual(cfg.pool.enableVerification, true);
      assert.strictEqual(cfg.server.corsOrigin, 'http://localhost:3000');
      assert.strictEqual(cfg.server.version, '1.0.0');
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it('should support watch() and unwatch()', () => {
    clearForgeEnvs();
    const tmpFile = join(tmpdir(), 'forge-test-watch-' + Date.now() + '.yaml');
    writeFileSync(tmpFile, 'pool:\n  maxConcurrent: 1\n');

    const cfg = new ForgeConfig({ configPath: tmpFile });
    try {
      cfg.watch(100);
      assert.strictEqual(cfg.getStatus().watching, true);

      cfg.unwatch();
      assert.strictEqual(cfg.getStatus().watching, false);
    } finally {
      cfg.unwatch();
      unlinkSync(tmpFile);
    }
  });
});
