import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// ── Cost Calculator Tests ───────────────────────────────────────────────────

describe('CostCalculator — estimateCost', () => {
  let CostCalculator;

  before(async () => {
    const mod = await import('../src/cost-calculator/index.js');
    CostCalculator = mod.CostCalculator;
  });

  it('should estimate cost for a known model', () => {
    const calc = new CostCalculator();
    const est = calc.estimateCost({ model: 'mimo-v2.5-pro', inputTokens: 5000, outputTokens: 2000 });
    assert.equal(est.model, 'mimo-v2.5-pro');
    // input: (5000 / 1M) * 0.30 = 0.0015
    assert.ok(Math.abs(est.inputCost - 0.0015) < 0.00001, `inputCost should be ~0.0015, got ${est.inputCost}`);
    // output: (2000 / 1M) * 0.60 = 0.0012
    assert.ok(Math.abs(est.outputCost - 0.0012) < 0.00001, `outputCost should be ~0.0012, got ${est.outputCost}`);
    assert.ok(Math.abs(est.totalCost - 0.0027) < 0.00001);
  });

  it('should fall back to default pricing for unknown model', () => {
    const calc = new CostCalculator();
    const est = calc.estimateCost({ model: 'unknown-model', inputTokens: 10000, outputTokens: 5000 });
    // default: (10000/1M)*1.00 = 0.01, (5000/1M)*2.00 = 0.01
    assert.ok(Math.abs(est.totalCost - 0.02) < 0.0001);
    assert.equal(est.model, 'unknown-model');
  });

  it('should handle zero tokens', () => {
    const calc = new CostCalculator();
    const est = calc.estimateCost({ model: 'mimo-v2.5-pro', inputTokens: 0, outputTokens: 0 });
    assert.equal(est.totalCost, 0);
  });

  it('should accept custom pricing via constructor', () => {
    const calc = new CostCalculator({ 'my-model': { input: 0.50, output: 1.00 } });
    const models = calc.getModels();
    assert.ok(models.includes('my-model'));
    const est = calc.estimateCost({ model: 'my-model', inputTokens: 1000000, outputTokens: 1000000 });
    assert.ok(Math.abs(est.inputCost - 0.50) < 0.001);
    assert.ok(Math.abs(est.outputCost - 1.00) < 0.001);
  });
});

describe('CostCalculator — estimateTaskCost', () => {
  let CostCalculator;

  before(async () => {
    const mod = await import('../src/cost-calculator/index.js');
    CostCalculator = mod.CostCalculator;
  });

  it('should use heuristics for implement task type', () => {
    const calc = new CostCalculator();
    const est = calc.estimateTaskCost({ taskType: 'implement', model: 'mimo-v2.5-pro' });
    assert.equal(est.taskType, 'implement');
    assert.equal(est.tokenEstimate.inputTokens, 15000);
    assert.equal(est.tokenEstimate.outputTokens, 8000);
    assert.ok(est.estimate.totalCost > 0);
    assert.ok(est.low.totalCost < est.estimate.totalCost, 'low should be less than estimate');
    assert.ok(est.high.totalCost > est.estimate.totalCost, 'high should be more than estimate');
  });

  it('should allow overriding token estimates', () => {
    const calc = new CostCalculator();
    const est = calc.estimateTaskCost({
      taskType: 'test',
      estimatedInputTokens: 50000,
      estimatedOutputTokens: 20000,
      model: 'default',
    });
    assert.equal(est.tokenEstimate.inputTokens, 50000);
    assert.equal(est.tokenEstimate.outputTokens, 20000);
  });

  it('should use default heuristic for unknown task type', () => {
    const calc = new CostCalculator();
    const est = calc.estimateTaskCost({ taskType: 'unknown-task' });
    assert.equal(est.tokenEstimate.inputTokens, 10000);
    assert.equal(est.tokenEstimate.outputTokens, 5000);
  });
});

describe('CostCalculator — compareModels & getCheapestModel', () => {
  let CostCalculator;

  before(async () => {
    const mod = await import('../src/cost-calculator/index.js');
    CostCalculator = mod.CostCalculator;
  });

  it('should return models sorted by cost with rank', () => {
    const calc = new CostCalculator();
    const comparison = calc.compareModels({ inputTokens: 10000, outputTokens: 5000 });
    assert.ok(comparison.length >= 4, 'should have at least 4 models');
    assert.equal(comparison[0].rank, 1);
    // Verify sorted ascending
    for (let i = 1; i < comparison.length; i++) {
      assert.ok(comparison[i].totalCost >= comparison[i - 1].totalCost, 'should be sorted ascending');
    }
    // 'default' should not appear
    assert.ok(!comparison.some(c => c.model === 'default'));
  });

  it('getCheapestModel should return a valid model name', () => {
    const calc = new CostCalculator();
    const cheapest = calc.getCheapestModel('implement');
    const models = calc.getModels();
    assert.ok(models.includes(cheapest), 'cheapest should be a registered model');
    assert.notEqual(cheapest, 'default');
  });
});

describe('CostCalculator — registry management', () => {
  let CostCalculator;

  before(async () => {
    const mod = await import('../src/cost-calculator/index.js');
    CostCalculator = mod.CostCalculator;
  });

  it('addModel should register a new model', () => {
    const calc = new CostCalculator();
    calc.addModel('custom-llm', { input: 0.10, output: 0.20 });
    assert.ok(calc.getModels().includes('custom-llm'));
    const pricing = calc.getPricing('custom-llm');
    assert.equal(pricing.input, 0.10);
    assert.equal(pricing.output, 0.20);
  });

  it('removeModel should remove a model', () => {
    const calc = new CostCalculator();
    calc.addModel('temp-model', { input: 1, output: 1 });
    assert.ok(calc.removeModel('temp-model'));
    assert.ok(!calc.getModels().includes('temp-model'));
  });

  it('removeModel should protect default', () => {
    const calc = new CostCalculator();
    assert.equal(calc.removeModel('default'), false);
    assert.ok(calc.getModels().includes('default'));
  });

  it('getPricing should indicate fallback for unknown model', () => {
    const calc = new CostCalculator();
    const pricing = calc.getPricing('totally-unknown');
    assert.equal(pricing.isFallback, true);
  });
});

describe('CostCalculator — formatCost', () => {
  let CostCalculator;

  before(async () => {
    const mod = await import('../src/cost-calculator/index.js');
    CostCalculator = mod.CostCalculator;
  });

  it('should format zero as $0.00', () => {
    assert.equal(CostCalculator.formatCost(0), '$0.00');
  });

  it('should format sub-cent with 4 decimals', () => {
    assert.equal(CostCalculator.formatCost(0.0012), '$0.0012');
  });

  it('should format >= $0.01 with 2 decimals', () => {
    assert.equal(CostCalculator.formatCost(1.234), '$1.23');
  });
});

// ── Structured Logger Tests ─────────────────────────────────────────────────

describe('ForgeLogger — LogLevel enum', () => {
  it('should export frozen LogLevel', async () => {
    const { LogLevel } = await import('../src/logger/index.js');
    assert.equal(LogLevel.DEBUG, 'debug');
    assert.equal(LogLevel.INFO, 'info');
    assert.equal(LogLevel.WARN, 'warn');
    assert.equal(LogLevel.ERROR, 'error');
    assert.equal(LogLevel.SILENT, 'silent');
    assert.ok(Object.isFrozen(LogLevel));
  });
});

describe('ForgeLogger — basic logging', () => {
  let ForgeLogger, LogLevel;

  before(async () => {
    const mod = await import('../src/logger/index.js');
    ForgeLogger = mod.ForgeLogger;
    LogLevel = mod.LogLevel;
  });

  it('should log at info level by default', () => {
    const lines = [];
    const output = { write: (s) => lines.push(s) };
    const logger = new ForgeLogger({ module: 'test', output });

    logger.info('hello world');
    assert.equal(lines.length, 1);
    assert.ok(lines[0].includes('hello world'));
    assert.ok(lines[0].includes('INFO'));
    assert.ok(lines[0].includes('test'));
  });

  it('should filter debug when level is info', () => {
    const lines = [];
    const output = { write: (s) => lines.push(s) };
    const logger = new ForgeLogger({ level: 'info', module: 'test', output });

    logger.debug('should not appear');
    assert.equal(lines.length, 0, 'debug should be filtered');
    // But should still be in buffer
    const entries = logger.getEntries();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].level, 'debug');
  });

  it('should log all levels when set to debug', () => {
    const lines = [];
    const output = { write: (s) => lines.push(s) };
    const logger = new ForgeLogger({ level: 'debug', module: 'test', output });

    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    assert.equal(lines.length, 4);
  });

  it('should suppress all output at SILENT level', () => {
    const lines = [];
    const output = { write: (s) => lines.push(s) };
    const logger = new ForgeLogger({ level: 'silent', module: 'test', output });

    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    assert.equal(lines.length, 0, 'no output at silent level');
    assert.equal(logger.getEntries().length, 4, 'entries still buffered');
  });

  it('should include data in output', () => {
    const lines = [];
    const output = { write: (s) => lines.push(s) };
    const logger = new ForgeLogger({ module: 'test', output });

    logger.info('with data', { key: 'value' });
    assert.ok(lines[0].includes('key'));
    assert.ok(lines[0].includes('value'));
  });

  it('should output JSON when jsonMode is true', () => {
    const lines = [];
    const output = { write: (s) => lines.push(s) };
    const logger = new ForgeLogger({ module: 'test', output, jsonMode: true });

    logger.info('json test', { foo: 'bar' });
    const parsed = JSON.parse(lines[0].trim());
    assert.equal(parsed.level, 'info');
    assert.equal(parsed.module, 'test');
    assert.equal(parsed.message, 'json test');
    assert.equal(parsed.data.foo, 'bar');
  });

  it('should throw on invalid level', () => {
    assert.throws(() => new ForgeLogger({ level: 'invalid' }), /Invalid log level/);
  });
});

describe('ForgeLogger — child, setLevel, getStatus', () => {
  let ForgeLogger;

  before(async () => {
    const mod = await import('../src/logger/index.js');
    ForgeLogger = mod.ForgeLogger;
  });

  it('child should inherit config with new module', () => {
    const lines = [];
    const output = { write: (s) => lines.push(s) };
    const parent = new ForgeLogger({ level: 'warn', module: 'parent', output });
    const child = parent.child('child-module');

    child.info('should not appear'); // filtered by warn level
    child.warn('child warning');
    assert.equal(lines.length, 1);
    assert.ok(lines[0].includes('child-module'));
  });

  it('setLevel should dynamically change filtering', () => {
    const lines = [];
    const output = { write: (s) => lines.push(s) };
    const logger = new ForgeLogger({ level: 'error', module: 'test', output });

    logger.info('filtered');
    assert.equal(lines.length, 0);

    logger.setLevel('debug');
    logger.info('visible now');
    assert.equal(lines.length, 1);
  });

  it('getStatus should return config snapshot', () => {
    const logger = new ForgeLogger({ level: 'warn', module: 'mymod', jsonMode: true });
    const status = logger.getStatus();
    assert.equal(status.level, 'warn');
    assert.equal(status.module, 'mymod');
    assert.equal(status.jsonMode, true);
    assert.equal(status.entryCount, 0);
  });

  it('static create should work as shorthand', () => {
    const logger = ForgeLogger.create('quick', 'debug');
    assert.equal(logger.getLevel(), 'debug');
    const status = logger.getStatus();
    assert.equal(status.module, 'quick');
  });
});

describe('ForgeLogger — ring buffer', () => {
  let ForgeLogger;

  before(async () => {
    const mod = await import('../src/logger/index.js');
    ForgeLogger = mod.ForgeLogger;
  });

  it('should cap entries at 1000', () => {
    const output = { write: () => {} };
    const logger = new ForgeLogger({ level: 'silent', module: 'test', output });

    for (let i = 0; i < 1100; i++) {
      logger.info(`msg-${i}`);
    }
    const entries = logger.getEntries();
    assert.equal(entries.length, 1000, 'should cap at 1000 entries');
    // Oldest should be msg-100
    assert.equal(entries[0].message, 'msg-100');
    // Newest should be msg-1099
    assert.equal(entries[999].message, 'msg-1099');
  });
});
