/**
 * E2E Health & Review Tests - Tests 10-11
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MemoryEngine } from '../src/memory-engine/index.js';
import { BashSafety } from '../src/bash-safety/index.js';
import { KnowledgeGraph } from '../src/knowledge-graph/index.js';
import { ErrorPatternLearner } from '../src/error-pattern-learner/index.js';
import { CostAttribution } from '../src/cost-attribution/index.js';
import { HealthDashboard } from '../src/health-dashboard/index.js';
import { MultiAgentReview } from '../src/multi-agent-review/index.js';

describe('E2E Health & Review', () => {
  it('Health dashboard aggregates module status', async () => {
    const dashboard = new HealthDashboard({ refreshInterval: 1000, historySize: 50 });

    const memory = new MemoryEngine();
    const graph = new KnowledgeGraph();
    const costTracker = new CostAttribution();
    const safety = new BashSafety();

    dashboard.registerModule('memory-engine', () => {
      const s = memory.getStatus();
      return { status: 'healthy', details: { hotEntries: s.hot.entries } };
    });

    dashboard.registerModule('knowledge-graph', () => {
      const s = graph.getStatus();
      return { status: 'healthy', details: { files: s.files, edges: s.edges } };
    });

    dashboard.registerModule('cost-attribution', () => {
      const s = costTracker.getStatus();
      return {
        status: s.totalCost > 1.0 ? 'degraded' : 'healthy',
        details: { totalCost: s.totalCost, totalTokens: s.totalTokens },
      };
    });

    dashboard.registerModule('bash-safety', () => {
      const s = safety.getStatus();
      return {
        status: 'healthy',
        details: { blacklistCount: s.blacklistCount, whitelistCount: s.whitelistCount },
      };
    });

    const snapshot1 = await dashboard.refresh();
    assert.strictEqual(snapshot1.status, 'healthy', 'All modules should be healthy initially');
    assert.strictEqual(
      Object.keys(snapshot1.modules).length,
      4,
      'Should have 4 modules in snapshot',
    );

    for (let i = 0; i < 100; i++) {
      costTracker.record({
        goalId: 'g1',
        taskId: `t${i}`,
        workerType: 'coder',
        model: 'default',
        inputTokens: 50000,
        outputTokens: 20000,
        cost: 0.05,
        duration: 100,
      });
    }

    const snapshot2 = await dashboard.refresh();
    assert.strictEqual(
      snapshot2.status,
      'degraded',
      'Overall status should be degraded when cost exceeds threshold',
    );
    assert.strictEqual(
      snapshot2.modules['cost-attribution'].status,
      'degraded',
      'Cost module should be degraded',
    );

    const alerts = dashboard.getAlerts();
    assert.ok(alerts.length > 0, 'Should have at least 1 alert for the status change');
    const costAlert = alerts.find((a) => a.module === 'cost-attribution');
    assert.ok(costAlert, 'Should have an alert for cost-attribution module');

    const history = dashboard.getHistory({ limit: 10 });
    assert.strictEqual(history.length, 2, 'History should have 2 snapshots');

    const uptime = dashboard.getUptime();
    assert.strictEqual(uptime.checksPerformed, 2, 'Should have performed 2 checks');
    assert.strictEqual(uptime.healthyChecks, 1, 'Should have 1 healthy check');
    assert.strictEqual(uptime.degradedChecks, 1, 'Should have 1 degraded check');

    const status = dashboard.getStatus();
    assert.strictEqual(status.moduleCount, 4);
    assert.ok(status.uptime >= 0, 'Uptime should be non-negative');
  });

  it('Multi-agent review catches issues in generated code', () => {
    const reviewer = new MultiAgentReview({
      severityThreshold: 'warning',
      autoFix: false,
    });
    const learner = new ErrorPatternLearner({ minOccurrences: 1 });

    const problematicCode = [
      "// New feature module",
      "const password = 'super-secret-12345678';",
      '',
      'export function processUserInput(input) {',
      '  const result = eval(input);',
      '  return result;',
      '}',
      '',
      'export function fetchData(userId) {',
      '  const query = `SELECT * FROM users WHERE id = ${userId}`;',
      '  return db.execute(query);',
      '}',
      '',
      '// TODO: add proper error handling',
      'export function riskyOperation() {',
      '  console.log("doing risky stuff");',
      '  return Promise.resolve().then(data => data.process());',
      '}',
      '',
    ].join('\n');

    const changes = [
      {
        path: 'src/feature.js',
        original: '',
        modified: problematicCode,
        action: 'write',
      },
    ];

    const result = reviewer.review(changes);

    assert.strictEqual(result.passed, false, 'Review should fail for problematic code');
    assert.ok(result.issues.length > 0, 'Should find at least 1 issue');

    const securityIssues = result.issues.filter((i) => i.category === 'security');
    assert.ok(securityIssues.length > 0, 'Should find security issues (eval, hardcoded secret)');

    const evalIssue = result.issues.find((i) => i.rule === 'builtin:sec-eval');
    assert.ok(evalIssue, 'Should detect eval() usage');

    const secretIssue = result.issues.find((i) => i.rule === 'builtin:sec-hardcoded-secret');
    assert.ok(secretIssue, 'Should detect hardcoded secret');

    const report = reviewer.generateReport(result);
    assert.ok(report.includes('Code Review Report'), 'Report should have the header');
    assert.ok(report.includes('FAILED'), 'Report should show FAILED');

    for (const issue of result.issues) {
      learner.recordError({
        workerType: 'code-gen',
        errorType: `review-${issue.category}`,
        message: `${issue.message} at ${issue.path}:${issue.line}`,
        context: { taskType: 'implement', rule: issue.rule },
      });
    }

    const learnResult = learner.learn();
    assert.ok(learnResult.totalPatterns >= 1, 'Learner should capture review failure patterns');

    const reviewStats = reviewer.getStats();
    assert.strictEqual(reviewStats.totalReviews, 1);
    assert.strictEqual(reviewStats.failed, 1);
  });
});
