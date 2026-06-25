import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BudgetEnforcer } from '../src/budget-enforcer/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// P11-3  BudgetEnforcer
// ═══════════════════════════════════════════════════════════════════════════════

describe('BudgetEnforcer', () => {
  describe('construction', () => {
    it('should create with default budget', () => {
      const be = new BudgetEnforcer();
      const status = be.getStatus();
      assert.equal(status.activeGoals, 0);
      assert.ok(status.globalBudgetRemaining.tokens > 0);
    });

    it('should accept custom global budget', () => {
      const be = new BudgetEnforcer({
        globalBudget: { maxTokens: 500_000, maxCost: 25, maxMinutes: 240 },
      });
      const status = be.getStatus();
      assert.equal(status.globalBudgetRemaining.tokens, 500_000);
    });
  });

  // ── recordUsage ─────────────────────────────────────────────────────────

  describe('recordUsage', () => {
    it('should track token spend per goal', () => {
      const be = new BudgetEnforcer();
      be.registerGoal('g1', { maxTokens: 10_000, maxCost: 5 });
      const result = be.recordUsage('g1', { inputTokens: 500, outputTokens: 300, cost: 0.05 });
      assert.equal(result.usage.tokens, 800);
      assert.equal(result.status, 'ok');
    });

    it('should accumulate across multiple records', () => {
      const be = new BudgetEnforcer();
      be.registerGoal('g1', { maxTokens: 10_000, maxCost: 5 });
      be.recordUsage('g1', { inputTokens: 100, outputTokens: 100, cost: 0.01 });
      const r2 = be.recordUsage('g1', { inputTokens: 200, outputTokens: 200, cost: 0.02 });
      assert.equal(r2.usage.tokens, 600);
      assert.ok(Math.abs(r2.usage.cost - 0.03) < 0.001);
    });

    it('should throw for unknown goal', () => {
      const be = new BudgetEnforcer();
      assert.throws(() => be.recordUsage('unknown', { inputTokens: 1, outputTokens: 1 }), /unknown goal/i);
    });
  });

  // ── canProceed ──────────────────────────────────────────────────────────

  describe('canProceed', () => {
    it('should allow when under budget', () => {
      const be = new BudgetEnforcer();
      be.registerGoal('g1', { maxTokens: 10_000, maxCost: 5 });
      be.recordUsage('g1', { inputTokens: 100, outputTokens: 100, cost: 0.5 });
      const check = be.canProceed('g1', 0.1);
      assert.equal(check.allowed, true);
    });

    it('should block when cost exceeds remaining', () => {
      const be = new BudgetEnforcer();
      be.registerGoal('g1', { maxTokens: 10_000, maxCost: 1.0 });
      be.recordUsage('g1', { inputTokens: 100, outputTokens: 100, cost: 0.9 });
      const check = be.canProceed('g1', 0.5);
      assert.equal(check.allowed, false);
      assert.ok(check.reason);
    });

    it('should block when goal is exceeded', () => {
      const be = new BudgetEnforcer({ throttleAtRatio: 0.5 });
      be.registerGoal('g1', { maxTokens: 1000, maxCost: 1.0 });
      be.recordUsage('g1', { inputTokens: 500, outputTokens: 500, cost: 0.6 });
      // cost ratio 0.6 > throttle 0.5
      const check = be.canProceed('g1', 0.1);
      assert.equal(check.allowed, false);
    });

    it('should block for unknown goal', () => {
      const be = new BudgetEnforcer();
      const check = be.canProceed('nope', 0);
      assert.equal(check.allowed, false);
    });
  });

  // ── Alert thresholds ────────────────────────────────────────────────────

  describe('alert thresholds', () => {
    it('should fire warning at 50%', () => {
      const be = new BudgetEnforcer({ alertThresholds: [0.5, 0.75, 0.9, 1.0] });
      be.registerGoal('g1', { maxTokens: 1000, maxCost: 1.0 });
      const result = be.recordUsage('g1', { inputTokens: 300, outputTokens: 300, cost: 0.55 });
      const warningAlerts = result.alerts.filter(a => a.level === 'warning');
      assert.ok(warningAlerts.length > 0, 'expected at least one warning alert');
    });

    it('should fire critical at 90%', () => {
      const be = new BudgetEnforcer({ alertThresholds: [0.5, 0.75, 0.9, 1.0] });
      be.registerGoal('g1', { maxTokens: 1000, maxCost: 1.0 });
      const result = be.recordUsage('g1', { inputTokens: 500, outputTokens: 500, cost: 0.95 });
      const critAlerts = result.alerts.filter(a => a.level === 'critical');
      assert.ok(critAlerts.length > 0, 'expected critical alert');
    });

    it('should fire exceeded at 100%', () => {
      const be = new BudgetEnforcer({ alertThresholds: [0.5, 0.75, 0.9, 1.0] });
      be.registerGoal('g1', { maxTokens: 1000, maxCost: 1.0 });
      const result = be.recordUsage('g1', { inputTokens: 600, outputTokens: 600, cost: 1.1 });
      const exceededAlerts = result.alerts.filter(a => a.level === 'exceeded');
      assert.ok(exceededAlerts.length > 0, 'expected exceeded alert');
      assert.equal(result.status, 'exceeded');
    });

    it('should not fire the same threshold twice', () => {
      const be = new BudgetEnforcer({ alertThresholds: [0.5, 0.75, 0.9, 1.0] });
      be.registerGoal('g1', { maxTokens: 1000, maxCost: 10 });
      be.recordUsage('g1', { inputTokens: 300, outputTokens: 300, cost: 6 });
      // Second call above same threshold should not duplicate alerts
      const r2 = be.recordUsage('g1', { inputTokens: 50, outputTokens: 50, cost: 0.5 });
      const dupWarning = r2.alerts.filter(a => a.threshold === 0.5);
      assert.equal(dupWarning.length, 0, 'should not duplicate 50% alert');
    });
  });

  // ── getSpendingReport ───────────────────────────────────────────────────

  describe('getSpendingReport', () => {
    it('should include trend field', () => {
      const be = new BudgetEnforcer();
      be.registerGoal('g1', { maxTokens: 10_000, maxCost: 5 });
      be.recordUsage('g1', { inputTokens: 100, outputTokens: 100, cost: 0.01 });

      const report = be.getSpendingReport();
      assert.ok(['increasing', 'stable', 'decreasing'].includes(report.trend));
    });

    it('should report total cost and tokens', () => {
      const be = new BudgetEnforcer();
      be.registerGoal('g1', { maxTokens: 10_000, maxCost: 5 });
      be.registerGoal('g2', { maxTokens: 10_000, maxCost: 5 });
      be.recordUsage('g1', { inputTokens: 100, outputTokens: 100, cost: 0.5 });
      be.recordUsage('g2', { inputTokens: 200, outputTokens: 200, cost: 0.3 });

      const report = be.getSpendingReport();
      assert.equal(report.totalTokens, 600);
      assert.ok(Math.abs(report.totalCost - 0.8) < 0.001);
    });

    it('should list top expensive goals', () => {
      const be = new BudgetEnforcer();
      be.registerGoal('expensive-g', { maxTokens: 10_000, maxCost: 5 });
      be.registerGoal('cheap-g', { maxTokens: 10_000, maxCost: 5 });
      be.recordUsage('expensive-g', { inputTokens: 100, outputTokens: 100, cost: 2.0 });
      be.recordUsage('cheap-g', { inputTokens: 100, outputTokens: 100, cost: 0.1 });

      const report = be.getSpendingReport();
      assert.ok(report.topExpensiveGoals.length >= 2);
      assert.equal(report.topExpensiveGoals[0].goalId, 'expensive-g');
    });
  });

  // ── Global vs per-goal budgets ──────────────────────────────────────────

  describe('global vs per-goal budgets', () => {
    it('should check global budget in canProceed', () => {
      const be = new BudgetEnforcer({
        globalBudget: { maxTokens: 2000, maxCost: 1.0, maxMinutes: 480 },
      });
      be.registerGoal('g1', { maxTokens: 5000, maxCost: 10 });
      be.recordUsage('g1', { inputTokens: 500, outputTokens: 500, cost: 0.8 });

      // Goal has room but global is tight
      const check = be.canProceed('g1', 0.5);
      assert.equal(check.allowed, false);
    });

    it('should report global status via checkGlobal', () => {
      const be = new BudgetEnforcer({
        globalBudget: { maxTokens: 1000, maxCost: 10, maxMinutes: 480 },
      });
      be.registerGoal('g1', { maxTokens: 5000, maxCost: 20 });
      be.recordUsage('g1', { inputTokens: 500, outputTokens: 500, cost: 1 });

      const global = be.checkGlobal();
      assert.ok(global.totalUsage.tokens >= 1000);
    });

    it('should aggregate usage across goals', () => {
      const be = new BudgetEnforcer();
      be.registerGoal('g1', { maxTokens: 10_000, maxCost: 5 });
      be.registerGoal('g2', { maxTokens: 10_000, maxCost: 5 });
      be.recordUsage('g1', { inputTokens: 100, outputTokens: 100, cost: 0.1 });
      be.recordUsage('g2', { inputTokens: 200, outputTokens: 200, cost: 0.2 });

      const all = be.getAllUsage();
      assert.equal(all.size, 2);
      assert.equal(all.get('g1').usage.tokens, 200);
      assert.equal(all.get('g2').usage.tokens, 400);
    });
  });

  // ── suggestBudget ───────────────────────────────────────────────────────

  describe('suggestBudget', () => {
    it('should suggest a budget for a new goal', () => {
      const be = new BudgetEnforcer();
      const suggestion = be.suggestBudget(5, 'high');
      assert.ok(suggestion.suggested.maxTokens > 0);
      assert.ok(suggestion.suggested.maxCost > 0);
      assert.ok(suggestion.confidence > 0);
    });
  });
});
