import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

describe('MultiAgentReview', () => {
  let MultiAgentReview, ReviewSeverity, ReviewCategory;

  before(async () => {
    const mod = await import('../src/multi-agent-review/index.js');
    MultiAgentReview = mod.MultiAgentReview;
    ReviewSeverity = mod.ReviewSeverity;
    ReviewCategory = mod.ReviewCategory;
  });

  it('should export ReviewSeverity enum with all values', () => {
    assert.equal(ReviewSeverity.INFO, 'info');
    assert.equal(ReviewSeverity.WARNING, 'warning');
    assert.equal(ReviewSeverity.ERROR, 'error');
    assert.equal(ReviewSeverity.CRITICAL, 'critical');
  });

  it('should freeze ReviewSeverity enum', () => {
    assert.ok(Object.isFrozen(ReviewSeverity));
  });

  it('should export ReviewCategory enum with all values', () => {
    assert.equal(ReviewCategory.LOGIC, 'logic');
    assert.equal(ReviewCategory.SECURITY, 'security');
    assert.equal(ReviewCategory.STYLE, 'style');
    assert.equal(ReviewCategory.PERFORMANCE, 'performance');
    assert.equal(ReviewCategory.MAINTAINABILITY, 'maintainability');
    assert.equal(ReviewCategory.TESTING, 'testing');
  });

  it('should freeze ReviewCategory enum', () => {
    assert.ok(Object.isFrozen(ReviewCategory));
  });

  it('should create instance with default options', () => {
    const reviewer = new MultiAgentReview();
    assert.ok(reviewer instanceof MultiAgentReview);
    const rules = reviewer.getRules();
    assert.ok(rules.length > 0, 'Should have built-in rules');
  });

  it('should create instance with custom options', () => {
    const reviewer = new MultiAgentReview({
      maxIssues: 100,
      severityThreshold: ReviewSeverity.ERROR,
      autoFix: true,
      reviewTimeout: 60000,
      categories: [ReviewCategory.SECURITY],
    });
    assert.ok(reviewer instanceof MultiAgentReview);
  });

  it('should return all built-in rules by default', () => {
    const reviewer = new MultiAgentReview();
    const rules = reviewer.getRules();
    assert.ok(rules.length >= 20, 'Should have at least 20 built-in rules');
  });

  it('should filter rules by category', () => {
    const reviewer = new MultiAgentReview();
    const securityRules = reviewer.getRules({ category: ReviewCategory.SECURITY });
    assert.ok(securityRules.length > 0);
    assert.ok(securityRules.every(r => r.category === ReviewCategory.SECURITY));
  });

  it('should filter rules by severity', () => {
    const reviewer = new MultiAgentReview();
    const errorRules = reviewer.getRules({ severity: ReviewSeverity.ERROR });
    assert.ok(errorRules.length > 0);
    assert.ok(errorRules.every(r => r.severity === ReviewSeverity.ERROR));
  });

  it('should add custom rule and return id', () => {
    const reviewer = new MultiAgentReview();
    const id = reviewer.addRule({
      id: 'custom:test-rule',
      name: 'Test Rule',
      category: ReviewCategory.STYLE,
      severity: ReviewSeverity.WARNING,
      pattern: /test-pattern/,
      message: 'Test message',
    });
    assert.equal(id, 'custom:test-rule');
    const rules = reviewer.getRules();
    assert.ok(rules.some(r => r.id === 'custom:test-rule'));
  });

  it('should auto-generate rule id when omitted', () => {
    const reviewer = new MultiAgentReview();
    const id = reviewer.addRule({
      name: 'Auto ID Rule',
      pattern: /test/,
      message: 'Test',
    });
    assert.ok(id.startsWith('custom-'), 'Should generate id with custom- prefix');
  });

  it('should remove existing rule and return true', () => {
    const reviewer = new MultiAgentReview();
    const rulesBefore = reviewer.getRules();
    const firstRule = rulesBefore[0];
    const removed = reviewer.removeRule(firstRule.id);
    assert.ok(removed);
    const rulesAfter = reviewer.getRules();
    assert.ok(!rulesAfter.some(r => r.id === firstRule.id));
  });

  it('should return false when removing non-existent rule', () => {
    const reviewer = new MultiAgentReview();
    const removed = reviewer.removeRule('non-existent-rule-id');
    assert.ok(!removed);
  });

  it('should pass review for clean code', () => {
    const reviewer = new MultiAgentReview();
    const result = reviewer.review([
      {
        path: 'clean.js',
        original: '',
        modified: 'const x = 1;\nconst y = 2;\n',
        action: 'write',
      },
    ]);
    assert.ok(result.passed);
    assert.equal(result.issues.length, 0);
    assert.ok(result.summary.includes('passed') || result.summary.includes('no issues'));
  });

  it('should detect security issues (eval usage)', () => {
    const reviewer = new MultiAgentReview({
      categories: [ReviewCategory.SECURITY],
    });
    const result = reviewer.review([
      {
        path: 'unsafe.js',
        original: '',
        modified: 'const result = eval(userInput);\n',
        action: 'write',
      },
    ]);
    assert.ok(!result.passed);
    assert.ok(result.issues.some(i => i.rule === 'builtin:sec-eval'));
  });

  it('should detect hardcoded secrets', () => {
    const reviewer = new MultiAgentReview({
      categories: [ReviewCategory.SECURITY],
    });
    const result = reviewer.review([
      {
        path: 'config.js',
        original: '',
        modified: 'const password = "mySecretPassword123";\n',
        action: 'write',
      },
    ]);
    assert.ok(!result.passed);
    assert.ok(result.issues.some(i => i.rule === 'builtin:sec-hardcoded-secret'));
  });

  it('should detect style issues (console.log)', () => {
    const reviewer = new MultiAgentReview({
      categories: [ReviewCategory.STYLE],
      severityThreshold: ReviewSeverity.INFO,
    });
    const result = reviewer.review([
      {
        path: 'debug.js',
        original: '',
        modified: 'console.log("debug info");\n',
        action: 'write',
      },
    ]);
    assert.ok(result.issues.some(i => i.rule === 'builtin:style-console-log'));
  });

  it('should deduplicate issues', () => {
    const reviewer = new MultiAgentReview();
    const code = 'console.log("test");\n';
    const result = reviewer.review([
      { path: 'file.js', original: '', modified: code, action: 'write' },
      { path: 'file.js', original: '', modified: code, action: 'write' },
    ]);
    const duplicates = result.issues.filter(
      (issue, i, arr) => arr.findIndex(x => x.path === issue.path && x.line === issue.line && x.rule === issue.rule) !== i
    );
    assert.equal(duplicates.length, 0, 'Should not have duplicate issues');
  });

  it('should respect maxIssues limit', () => {
    const reviewer = new MultiAgentReview({ maxIssues: 5 });
    const code = Array(20).fill('console.log("test");').join('\n');
    const result = reviewer.review([
      { path: 'file.js', original: '', modified: code, action: 'write' },
    ]);
    assert.ok(result.issues.length <= 5);
  });

  it('should control pass/fail based on severityThreshold', () => {
    const reviewer = new MultiAgentReview({
      severityThreshold: ReviewSeverity.ERROR,
      categories: [ReviewCategory.STYLE],
    });
    const result = reviewer.review([
      {
        path: 'file.js',
        original: '',
        modified: 'console.log("test");\n',
        action: 'write',
      },
    ]);
    assert.ok(result.passed, 'Should pass when only INFO issues exist and threshold is ERROR');
  });

  it('should only report new issues in reviewFile', () => {
    const reviewer = new MultiAgentReview({
      categories: [ReviewCategory.STYLE],
      severityThreshold: ReviewSeverity.INFO,
    });
    const original = 'console.log("existing");\n';
    const modified = 'console.log("existing");\nconsole.log("new");\n';
    const issues = reviewer.reviewFile('file.js', original, modified);
    assert.equal(issues.length, 1, 'Should only report the new console.log');
  });

  it('should generate formatted report', () => {
    const reviewer = new MultiAgentReview();
    const result = reviewer.review([
      {
        path: 'file.js',
        original: '',
        modified: 'eval(userInput);\n',
        action: 'write',
      },
    ]);
    const report = reviewer.generateReport(result);
    assert.ok(report.includes('=== Code Review Report ==='));
    assert.ok(report.includes('Status:'));
    assert.ok(report.includes('Summary:'));
    assert.ok(report.includes('=== End of Report ==='));
  });

  it('should apply fixes from review result', () => {
    const reviewer = new MultiAgentReview();
    const result = {
      issues: [
        {
          path: 'file.js',
          fix: (content) => content.replace('bad', 'good'),
        },
      ],
    };
    const files = [{ path: 'file.js', content: 'bad code' }];
    const { fixed, files: fixedFiles } = reviewer.applyFixes(result, files);
    assert.equal(fixed, 1);
    assert.equal(fixedFiles[0].content, 'good code');
  });

  it('should handle fix function errors gracefully', () => {
    const reviewer = new MultiAgentReview();
    const result = {
      issues: [
        {
          path: 'file.js',
          fix: () => { throw new Error('Fix failed'); },
        },
      ],
    };
    const files = [{ path: 'file.js', content: 'test' }];
    const { fixed } = reviewer.applyFixes(result, files);
    assert.equal(fixed, 0);
  });

  it('should return empty stats initially', () => {
    const reviewer = new MultiAgentReview();
    const stats = reviewer.getStats();
    assert.equal(stats.totalReviews, 0);
    assert.equal(stats.passed, 0);
    assert.equal(stats.failed, 0);
    assert.equal(stats.avgIssuesPerReview, 0);
  });

  it('should return aggregate stats after reviews', () => {
    const reviewer = new MultiAgentReview();
    reviewer.review([{ path: 'a.js', original: '', modified: 'const x = 1;\n', action: 'write' }]);
    reviewer.review([{ path: 'b.js', original: '', modified: 'eval(x);\n', action: 'write' }]);
    const stats = reviewer.getStats();
    assert.equal(stats.totalReviews, 2);
    assert.ok(stats.passed >= 0);
    assert.ok(stats.failed >= 0);
  });

  it('should clear history', () => {
    const reviewer = new MultiAgentReview();
    reviewer.review([{ path: 'a.js', original: '', modified: 'const x = 1;\n', action: 'write' }]);
    reviewer.clear();
    const stats = reviewer.getStats();
    assert.equal(stats.totalReviews, 0);
  });

  it('should return status snapshot', () => {
    const reviewer = new MultiAgentReview();
    const status = reviewer.getStatus();
    assert.ok(typeof status.rules === 'number');
    assert.ok(typeof status.reviews === 'number');
    assert.ok(typeof status.passRate === 'number');
  });
});
