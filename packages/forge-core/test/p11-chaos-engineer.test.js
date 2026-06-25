/**
 * P11 ChaosEngineer — test suite.
 *
 * Run with:
 *   node --test packages/forge-core/test/p11-chaos-engineer.test.js
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import { ChaosEngineer } from '../src/chaos-engineer/index.js';

describe('ChaosEngineer', () => {
  let chaos;

  before(() => {
    chaos = new ChaosEngineer({ enabled: false, blastRadius: 0.1 });
  });

  // ── Construction ──────────────────────────────────────────────────────

  it('constructs with defaults (disabled)', () => {
    const c = new ChaosEngineer();
    const s = c.getStatus();
    assert.equal(s.enabled, false);
    assert.equal(s.experimentCount, 0);
    assert.equal(s.totalResults, 0);
    assert.ok(Array.isArray(s.availableFaultTypes));
    assert.ok(s.availableFaultTypes.includes('latency_injection'));
  });

  it('constructs with custom options', () => {
    const c = new ChaosEngineer({
      enabled: true, maxConcurrentExperiments: 3,
      blastRadius: 0.5, safetyTimeout: 120000,
    });
    const s = c.getStatus();
    assert.equal(s.enabled, true);
    assert.equal(s.maxConcurrent, 3);
    assert.equal(s.blastRadius, 0.5);
    assert.equal(s.safetyTimeout, 120000);
  });

  // ── defineExperiment ──────────────────────────────────────────────────

  it('defines an experiment with valid config', () => {
    chaos.defineExperiment('latency-test', {
      target: 'worker-pool',
      fault: 'latency_injection',
      faultConfig: { delayMs: 2000, jitterMs: 500 },
      duration: 30000,
      hypothesis: 'System handles 2s latency gracefully',
      successCriteria: { maxErrorRate: 0.1, maxLatencyIncrease: 3000 },
    });
    const s = chaos.getStatus();
    assert.equal(s.experimentCount, 1);
    assert.ok(s.definedExperiments.includes('latency-test'));
  });

  it('throws when target is missing', () => {
    assert.throws(
      () => chaos.defineExperiment('bad1', { fault: 'latency_injection', hypothesis: 'h' }),
      { message: /target module/i },
    );
  });

  it('throws when fault type is unknown', () => {
    assert.throws(
      () => chaos.defineExperiment('bad2', { target: 'x', fault: 'alien_ray', hypothesis: 'h' }),
      { message: /Unknown fault type/ },
    );
  });

  it('throws when hypothesis is missing', () => {
    assert.throws(
      () => chaos.defineExperiment('bad3', { target: 'x', fault: 'latency_injection' }),
      { message: /hypothesis/i },
    );
  });

  // ── Fault types ───────────────────────────────────────────────────────

  it('supports all six fault types', () => {
    const c = new ChaosEngineer();
    const types = c.getStatus().availableFaultTypes;
    for (const t of [
      'latency_injection', 'error_injection', 'resource_starvation',
      'network_partition', 'data_corruption', 'cascade_failure',
    ]) {
      assert.ok(types.includes(t), `should support fault type: ${t}`);
    }
  });

  // ── Dry-run mode (default) ────────────────────────────────────────────

  it('runs experiment in dry-run mode by default', async () => {
    const c = new ChaosEngineer();
    c.defineExperiment('dry-test', {
      target: 'api', fault: 'error_injection',
      faultConfig: { failureRate: 0.5 },
      hypothesis: 'API handles 50% errors',
      successCriteria: { maxErrorRate: 0.3 },
    });
    const result = await c.runExperiment('dry-test');
    assert.equal(result.mode, 'dry-run');
    assert.equal(result.experiment, 'dry-test');
    assert.equal(result.hypothesis, 'API handles 50% errors');
    assert.ok('predictions' in result);
    assert.ok('metrics' in result);
    assert.equal(result.error, null);
  });

  it('predicts latency impact in dry-run for latency_injection', async () => {
    const c = new ChaosEngineer();
    c.defineExperiment('lat-dry', {
      target: 'svc', fault: 'latency_injection',
      faultConfig: { delayMs: 3000, jitterMs: 0 },
      hypothesis: 'Handles 3s latency',
      successCriteria: { maxLatencyIncrease: 5000 },
    });
    const r = await c.runExperiment('lat-dry');
    assert.equal(r.mode, 'dry-run');
    assert.ok(r.predictions.expectedLatencyIncrease >= 2500);
  });

  it('predicts error impact in dry-run for error_injection', async () => {
    const c = new ChaosEngineer();
    c.defineExperiment('err-dry', {
      target: 'svc', fault: 'error_injection',
      faultConfig: { failureRate: 0.8 },
      hypothesis: 'Handles 80% errors',
    });
    const r = await c.runExperiment('err-dry');
    assert.equal(r.predictions.expectedFailureRate, 0.8);
    assert.equal(r.predictions.risk, 'high');
  });

  it('predicts resource starvation impact in dry-run', async () => {
    const c = new ChaosEngineer();
    c.defineExperiment('res-dry', {
      target: 'svc', fault: 'resource_starvation',
      faultConfig: { timeoutReductionRatio: 0.7 },
      hypothesis: 'Handles reduced timeouts',
    });
    const r = await c.runExperiment('res-dry');
    assert.ok(r.predictions.timeoutMultiplier > 0);
  });

  it('predicts network partition impact in dry-run', async () => {
    const c = new ChaosEngineer();
    c.defineExperiment('net-dry', {
      target: 'svc', fault: 'network_partition',
      hypothesis: 'Module survives isolation',
    });
    const r = await c.runExperiment('net-dry');
    assert.equal(r.predictions.risk, 'high');
  });

  it('predicts data corruption impact in dry-run', async () => {
    const c = new ChaosEngineer();
    c.defineExperiment('corrupt-dry', {
      target: 'svc', fault: 'data_corruption',
      faultConfig: { corruptionRate: 0.4, corruptionType: 'truncation' },
      hypothesis: 'Module handles corrupted input',
    });
    const r = await c.runExperiment('corrupt-dry');
    assert.ok(r.predictions.corruptionRate >= 0.3);
  });

  it('predicts cascade failure impact in dry-run', async () => {
    const c = new ChaosEngineer();
    c.defineExperiment('cascade-dry', {
      target: 'svc', fault: 'cascade_failure',
      faultConfig: { dependents: ['modA', 'modB'], failureSpreadRate: 0.8 },
      hypothesis: 'Cascade contained',
    });
    const r = await c.runExperiment('cascade-dry');
    assert.deepEqual(r.predictions.affectedModules, ['modA', 'modB']);
    assert.equal(r.predictions.risk, 'high');
  });

  // ── Real mode guards ──────────────────────────────────────────────────

  it('rejects real run when disabled', async () => {
    const c = new ChaosEngineer({ enabled: false });
    c.defineExperiment('real-blocked', {
      target: 'svc', fault: 'latency_injection',
      hypothesis: 'h',
    });
    await assert.rejects(
      () => c.runExperiment('real-blocked', { dryRun: false }),
      { message: /disabled/i },
    );
  });

  it('rejects running undefined experiment', async () => {
    const c = new ChaosEngineer();
    await assert.rejects(
      () => c.runExperiment('nope'),
      { message: /not found/i },
    );
  });

  // ── getResilienceScore ────────────────────────────────────────────────

  it('returns 0 score when no experiments have run', () => {
    const c = new ChaosEngineer();
    const score = c.getResilienceScore('unknown-module');
    assert.equal(score.score, 0);
    assert.ok(score.weakPoints.length >= 1);
  });

  it('computes resilience score after dry-run experiments', async () => {
    const c = new ChaosEngineer();
    c.defineExperiment('score-test', {
      target: 'modX', fault: 'latency_injection',
      faultConfig: { delayMs: 100, jitterMs: 0 },
      hypothesis: 'Handles 100ms latency',
      successCriteria: { maxLatencyIncrease: 500 },
    });
    await c.runExperiment('score-test');
    const score = c.getResilienceScore('modX');
    assert.ok(typeof score.score === 'number');
    assert.ok(score.score >= 0 && score.score <= 100);
  });

  // ── getHistory ────────────────────────────────────────────────────────

  it('records experiment outcomes in history', async () => {
    const c = new ChaosEngineer();
    c.defineExperiment('hist-test', {
      target: 'svc', fault: 'error_injection',
      faultConfig: { failureRate: 0.2 },
      hypothesis: 'Handles 20% errors',
    });
    await c.runExperiment('hist-test');
    const history = c.getHistory();
    assert.ok(history.length >= 1);
    assert.equal(history[0].experiment, 'hist-test');
  });

  it('filters history by module', async () => {
    const c = new ChaosEngineer();
    c.defineExperiment('h1', { target: 'a', fault: 'latency_injection', hypothesis: 'h' });
    c.defineExperiment('h2', { target: 'b', fault: 'error_injection', hypothesis: 'h' });
    await c.runExperiment('h1');
    await c.runExperiment('h2');
    const filtered = c.getHistory({ module: 'a' });
    assert.ok(filtered.every(r => r.target === 'a'));
  });

  // ── runResilienceSuite ────────────────────────────────────────────────

  it('runs resilience suite for multiple modules in dry-run', async () => {
    const c = new ChaosEngineer();
    const result = await c.runResilienceSuite(['modA', 'modB']);
    assert.ok(result.modules.length === 2);
    for (const m of result.modules) {
      assert.ok(typeof m.overallResilience === 'number');
      assert.ok(m.experiments.length === 7); // 3 latency + 3 error + 1 starvation
      assert.ok(m.summary.total === 7);
    }
  });
});
