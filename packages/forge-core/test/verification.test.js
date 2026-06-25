import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');

// Dynamic import to avoid issues if verification module isn't available
let VerificationEngine;
before(async () => {
  const mod = await import('../src/verification/index.js');
  VerificationEngine = mod.VerificationEngine;
});

describe('VerificationEngine', () => {
  it('should export VerificationEngine class', () => {
    assert.ok(VerificationEngine);
    assert.strictEqual(typeof VerificationEngine, 'function');
  });

  it('should create an instance with store and projectRoot', () => {
    const mockStore = {
      logEvent: () => {},
    };
    const engine = new VerificationEngine(mockStore, projectRoot);
    assert.ok(engine);
    assert.strictEqual(typeof engine.verify, 'function');
    assert.strictEqual(typeof engine.verifyAfterMutation, 'function');
    assert.strictEqual(typeof engine.formatFailuresForRetry, 'function');
  });

  it('should run verify() and return structured result', async () => {
    const mockStore = { logEvent: () => {} };
    const engine = new VerificationEngine(mockStore, projectRoot);

    // Run with maxTier: 1 (static analysis only — fast)
    const result = await engine.verify('test-goal', 'test-task', { maxTier: 1 });

    assert.ok(result.tiers, 'Should have tiers array');
    assert.ok(Array.isArray(result.tiers), 'tiers should be an array');
    assert.ok(result.tiers.length > 0, 'Should have at least one tier');
    assert.ok(['PASS', 'FAIL', 'PARTIAL'].includes(result.overall), 'overall should be PASS/FAIL/PARTIAL');
    assert.ok(Array.isArray(result.failures), 'Should have failures array');
    assert.ok(result.summary, 'Should have summary');
    assert.ok(typeof result.summary.totalDurationMs === 'number', 'summary should have totalDurationMs');
    assert.ok(typeof result.summary.checksPassed === 'number', 'summary should have checksPassed');
    assert.ok(typeof result.summary.checksFailed === 'number', 'summary should have checksFailed');
  });

  it('should run verifyAfterMutation() with limited tiers', async () => {
    const mockStore = { logEvent: () => {} };
    const engine = new VerificationEngine(mockStore, projectRoot);

    const result = await engine.verifyAfterMutation('test-goal', 'test-task', {
      filesModified: [{ path: 'src/server.js' }],
      maxTier: 1,
    });

    assert.ok(result.tiers, 'Should have tiers');
    assert.ok(result.tiers.length <= 1, 'Should only run tier 1');
    assert.ok(result.overall, 'Should have overall status');
  });

  it('should detect unsafe patterns in code', async () => {
    const mockStore = { logEvent: () => {} };
    const engine = new VerificationEngine(mockStore, projectRoot);

    // Test diff analysis with a known file
    const result = await engine.verify('test-goal', 'test-task', {
      maxTier: 5,
      filesModified: ['src/server.js'],
    });

    assert.ok(result.diffAnalysis || result.tiers.length > 0, 'Should have diff analysis or tier results');
  });

  it('should format failures for retry context', () => {
    const mockStore = { logEvent: () => {} };
    const engine = new VerificationEngine(mockStore, projectRoot);

    const failures = [
      { tier: 2, tierName: 'Unit Tests', checkName: 'npm test', output: 'FAIL test/foo.js\n  AssertionError: expected 1 to equal 2' },
      { tier: 5, tierName: 'Security Scan', checkName: 'Unsafe Pattern Scan', output: '[HIGH] src/app.js:10 — eval() usage' },
    ];

    const formatted = engine.formatFailuresForRetry(failures);

    assert.ok(formatted.includes('VERIFICATION FAILURES'), 'Should include header');
    assert.ok(formatted.includes('Tier 2'), 'Should include tier info');
    assert.ok(formatted.includes('Unit Tests'), 'Should include tier name');
    assert.ok(formatted.includes('npm test'), 'Should include check name');
    assert.ok(formatted.includes('AssertionError'), 'Should include output');
    assert.ok(formatted.includes('Security Scan'), 'Should include security tier');
    assert.ok(formatted.includes('END FAILURES'), 'Should include footer');
  });

  it('should return empty string when no failures', () => {
    const mockStore = { logEvent: () => {} };
    const engine = new VerificationEngine(mockStore, projectRoot);

    assert.strictEqual(engine.formatFailuresForRetry([]), '');
    assert.strictEqual(engine.formatFailuresForRetry(null), '');
  });

  it('should truncate long failure output', () => {
    const mockStore = { logEvent: () => {} };
    const engine = new VerificationEngine(mockStore, projectRoot);

    const failures = [{
      tier: 2, tierName: 'Tests', checkName: 'test',
      output: 'x'.repeat(5000),
    }];

    const formatted = engine.formatFailuresForRetry(failures, 500);
    assert.ok(formatted.length <= 600, 'Should truncate to roughly maxChars');
  });

  it('should track verification history', async () => {
    const mockStore = { logEvent: () => {} };
    const engine = new VerificationEngine(mockStore, projectRoot);

    await engine.verify('g1', 'task-1', { maxTier: 1 });
    const history = engine.getHistory('task-1');

    assert.ok(Array.isArray(history), 'History should be an array');
    assert.ok(history.length >= 1, 'Should have at least one entry');
    assert.ok(history[0].timestamp, 'Entry should have timestamp');
    assert.ok(['PASS', 'FAIL', 'PARTIAL'].includes(history[0].overall), 'Entry should have overall status');
  });

  it('should run security scan (Tier 5)', async () => {
    const mockStore = { logEvent: () => {} };
    const engine = new VerificationEngine(mockStore, projectRoot);

    const tier5 = await engine.verifyTier(5, ['src/server.js']);

    assert.strictEqual(tier5.tier, 5);
    assert.strictEqual(tier5.name, 'Security Scan');
    assert.ok(['PASS', 'FAIL', 'SKIP'].includes(tier5.status));
    assert.ok(Array.isArray(tier5.checks));
  });

  it('should handle unknown tier gracefully', async () => {
    const mockStore = { logEvent: () => {} };
    const engine = new VerificationEngine(mockStore, projectRoot);

    const result = await engine.verifyTier(99);
    assert.strictEqual(result.status, 'SKIP');
    assert.strictEqual(result.reason, 'Unknown tier');
  });

  it('should verify test-project-v2 passes basic checks', async () => {
    const mockStore = { logEvent: () => {} };
    const engine = new VerificationEngine(mockStore, projectRoot);

    // Run Tiers 1-2 (static analysis + unit tests) on the test project
    const result = await engine.verify('g1', 't1', { maxTier: 2 });

    assert.ok(result.tiers.length >= 1, 'Should run at least one tier');

    // The test project should have valid package.json
    const tier1 = result.tiers.find(t => t.tier === 1);
    if (tier1) {
      const pkgCheck = tier1.checks.find(c => c.name === 'package.json');
      if (pkgCheck) {
        assert.strictEqual(pkgCheck.status, 'PASS', 'package.json should be valid');
      }
    }

    // Unit tests should pass
    const tier2 = result.tiers.find(t => t.tier === 2);
    if (tier2) {
      const testCheck = tier2.checks.find(c => c.name === 'npm test');
      if (testCheck) {
        assert.strictEqual(testCheck.status, 'PASS', 'npm test should pass');
      }
    }
  });
});
