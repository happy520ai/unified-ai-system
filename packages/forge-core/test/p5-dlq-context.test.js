import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// ── Module 3: DeadLetterQueue ────────────────────────────────────────────────

describe('DeadLetterQueue', () => {
  let DeadLetterQueue;

  before(async () => {
    const mod = await import('../src/dead-letter-queue/index.js');
    DeadLetterQueue = mod.DeadLetterQueue;
  });

  it('should construct with default maxSize', () => {
    const dlq = new DeadLetterQueue();
    const status = dlq.getStatus();
    assert.equal(status.total, 0);
    assert.equal(status.maxSize, 100);
  });

  it('should add() and return id and position', () => {
    const dlq = new DeadLetterQueue();
    const result = dlq.add({ goalId: 'g1', task: { name: 't1' }, loopCount: 3 });
    assert.ok(result.id.startsWith('dlq-'));
    assert.equal(result.position, 0);
  });

  it('should assign incrementing positions to added entries', () => {
    const dlq = new DeadLetterQueue();
    const r1 = dlq.add({ goalId: 'g1', task: { name: 't1' } });
    const r2 = dlq.add({ goalId: 'g1', task: { name: 't2' } });
    const r3 = dlq.add({ goalId: 'g1', task: { name: 't3' } });
    assert.equal(r1.position, 0);
    assert.equal(r2.position, 1);
    assert.equal(r3.position, 2);
  });

  it('should get() a specific entry by id', () => {
    const dlq = new DeadLetterQueue();
    const { id } = dlq.add({ goalId: 'g1', task: { name: 'task-a' }, loopCount: 5 });
    const entry = dlq.get(id);
    assert.ok(entry);
    assert.equal(entry.id, id);
    assert.equal(entry.goalId, 'g1');
    assert.deepEqual(entry.task, { name: 'task-a' });
    assert.equal(entry.loopCount, 5);
    assert.ok(Array.isArray(entry.tags));
    assert.equal(entry.tags.length, 0);
  });

  it('should return null for get() with unknown id', () => {
    const dlq = new DeadLetterQueue();
    assert.equal(dlq.get('nonexistent'), null);
  });

  it('should list() entries with default pagination', () => {
    const dlq = new DeadLetterQueue();
    for (let i = 0; i < 5; i++) {
      dlq.add({ goalId: 'g1', task: { name: `t${i}` } });
    }
    const items = dlq.list();
    assert.equal(items.length, 5);
  });

  it('should list() with limit and offset pagination', () => {
    const dlq = new DeadLetterQueue();
    for (let i = 0; i < 10; i++) {
      dlq.add({ goalId: 'g1', task: { name: `t${i}` } });
    }
    const page = dlq.list({ limit: 3, offset: 2 });
    assert.equal(page.length, 3);
    assert.equal(page[0].task.name, 't2');
    assert.equal(page[1].task.name, 't3');
    assert.equal(page[2].task.name, 't4');
  });

  it('should list() with goalId filter', () => {
    const dlq = new DeadLetterQueue();
    dlq.add({ goalId: 'g1', task: { name: 't1' } });
    dlq.add({ goalId: 'g2', task: { name: 't2' } });
    dlq.add({ goalId: 'g1', task: { name: 't3' } });

    const g1Items = dlq.list({ goalId: 'g1' });
    assert.equal(g1Items.length, 2);
    assert.ok(g1Items.every(e => e.goalId === 'g1'));

    const g2Items = dlq.list({ goalId: 'g2' });
    assert.equal(g2Items.length, 1);
  });

  it('should retry() — remove entry and return data with _dlqRetryOf', () => {
    const dlq = new DeadLetterQueue();
    const { id } = dlq.add({
      goalId: 'g1',
      task: { name: 'failed-task' },
      strategyHistory: ['targeted_fix'],
      loopCount: 3,
    });

    const retryPayload = dlq.retry(id);
    assert.ok(retryPayload);
    assert.equal(retryPayload.goalId, 'g1');
    assert.equal(retryPayload.task._dlqRetryOf, id);
    assert.equal(retryPayload.task.name, 'failed-task');
    assert.ok(retryPayload.context);
    assert.ok(Array.isArray(retryPayload.context.strategyHistory));

    // Entry should be removed
    assert.equal(dlq.get(id), null);
  });

  it('should return null from retry() for unknown id', () => {
    const dlq = new DeadLetterQueue();
    assert.equal(dlq.retry('no-such-id'), null);
  });

  it('should discard() an entry', () => {
    const dlq = new DeadLetterQueue();
    const { id } = dlq.add({ goalId: 'g1', task: { name: 't1' } });
    const removed = dlq.discard(id);
    assert.equal(removed, true);
    assert.equal(dlq.get(id), null);
  });

  it('should return false from discard() for unknown id', () => {
    const dlq = new DeadLetterQueue();
    assert.equal(dlq.discard('no-such'), false);
  });

  it('should addTag() and removeTag() on entries', () => {
    const dlq = new DeadLetterQueue();
    const { id } = dlq.add({ goalId: 'g1', task: { name: 't1' } });

    const added1 = dlq.addTag(id, 'needs-review');
    assert.equal(added1, true);
    assert.deepEqual(dlq.get(id).tags, ['needs-review']);

    const added2 = dlq.addTag(id, 'flaky-test');
    assert.equal(added2, true);
    assert.deepEqual(dlq.get(id).tags, ['needs-review', 'flaky-test']);

    // Duplicate tag should return false
    const addedDup = dlq.addTag(id, 'needs-review');
    assert.equal(addedDup, false);

    const removed = dlq.removeTag(id, 'needs-review');
    assert.equal(removed, true);
    assert.deepEqual(dlq.get(id).tags, ['flaky-test']);
  });

  it('should return false from addTag()/removeTag() for unknown id', () => {
    const dlq = new DeadLetterQueue();
    assert.equal(dlq.addTag('bad-id', 'tag'), false);
    assert.equal(dlq.removeTag('bad-id', 'tag'), false);
  });

  it('should evict oldest entry at maxSize (ring buffer)', () => {
    const dlq = new DeadLetterQueue({ maxSize: 3 });
    const r1 = dlq.add({ goalId: 'g1', task: { name: 't1' } });
    dlq.add({ goalId: 'g1', task: { name: 't2' } });
    dlq.add({ goalId: 'g1', task: { name: 't3' } });

    // Adding a 4th should evict the first
    dlq.add({ goalId: 'g1', task: { name: 't4' } });

    assert.equal(dlq.get(r1.id), null); // first entry evicted
    assert.equal(dlq.list().length, 3);
  });

  it('should getStats() with totals, byGoalId, byTag, avgLoopCount', () => {
    const dlq = new DeadLetterQueue();
    const { id: id1 } = dlq.add({ goalId: 'g1', task: {}, loopCount: 4 });
    dlq.add({ goalId: 'g1', task: {}, loopCount: 6 });
    dlq.add({ goalId: 'g2', task: {}, loopCount: 2 });
    dlq.addTag(id1, 'critical');

    const stats = dlq.getStats();
    assert.equal(stats.total, 3);
    assert.equal(stats.byGoalId.g1, 2);
    assert.equal(stats.byGoalId.g2, 1);
    assert.equal(stats.byTag.critical, 1);
    assert.equal(stats.avgLoopCount, 4); // (4+6+2)/3
    assert.ok(stats.oldestAt !== null);
    assert.ok(stats.newestAt !== null);
  });

  it('should return zeroed stats when empty', () => {
    const dlq = new DeadLetterQueue();
    const stats = dlq.getStats();
    assert.equal(stats.total, 0);
    assert.equal(stats.avgLoopCount, 0);
    assert.equal(stats.oldestAt, null);
    assert.equal(stats.newestAt, null);
  });

  it('should clear() all entries', () => {
    const dlq = new DeadLetterQueue();
    dlq.add({ goalId: 'g1', task: {} });
    dlq.add({ goalId: 'g2', task: {} });
    const removed = dlq.clear();
    assert.equal(removed, 2);
    assert.equal(dlq.list().length, 0);
  });

  it('should clear() with goalId filter', () => {
    const dlq = new DeadLetterQueue();
    dlq.add({ goalId: 'g1', task: {} });
    dlq.add({ goalId: 'g2', task: {} });
    dlq.add({ goalId: 'g1', task: {} });

    const removed = dlq.clear({ goalId: 'g1' });
    assert.equal(removed, 2);
    assert.equal(dlq.list().length, 1);
    assert.equal(dlq.list()[0].goalId, 'g2');
  });
});

// ── Module 4: ContextManager ─────────────────────────────────────────────────

describe('ContextManager', () => {
  let ContextManager;

  before(async () => {
    const mod = await import('../src/context-manager/index.js');
    ContextManager = mod.ContextManager;
  });

  it('should construct with default options', () => {
    const cm = new ContextManager();
    const stats = cm.getStats();
    assert.equal(stats.maxTokens, 128_000);
    assert.equal(stats.availableTokens, 112_000); // 128000 - 16000
    assert.equal(stats.totalContextsBuilt, 0);
  });

  it('should estimateTokens() using Math.ceil(text.length / 4)', () => {
    const cm = new ContextManager();
    assert.equal(cm.estimateTokens(''), 0);
    assert.equal(cm.estimateTokens('abcd'), 1);         // 4 chars -> ceil(4/4)=1
    assert.equal(cm.estimateTokens('abcde'), 2);         // 5 chars -> ceil(5/4)=2
    assert.equal(cm.estimateTokens('a'.repeat(100)), 25); // 100/4=25
    assert.equal(cm.estimateTokens('a'.repeat(101)), 26); // ceil(101/4)=26
  });

  it('should return 0 tokens for falsy input', () => {
    const cm = new ContextManager();
    assert.equal(cm.estimateTokens(''), 0);
    assert.equal(cm.estimateTokens(null), 0);
    assert.equal(cm.estimateTokens(undefined), 0);
  });

  it('should buildContext() with focus files included first', () => {
    const cm = new ContextManager({ maxTokens: 100_000, reserveForOutput: 1000 });
    const files = [
      { path: 'src/helper.js', content: 'helper code', relevance: 90 },
      { path: 'src/main.js', content: 'main code', relevance: 50 },
    ];
    const result = cm.buildContext({
      files,
      focusFiles: ['src/main.js'],
    });
    assert.equal(result.truncated, false);
    assert.equal(result.included.length, 2);
    // Focus-file should be first in the included list
    assert.equal(result.included[0].path, 'src/main.js');
    assert.equal(result.included[1].path, 'src/helper.js');
  });

  it('should buildContext() sort non-focus files by relevance descending', () => {
    const cm = new ContextManager({ maxTokens: 100_000, reserveForOutput: 1000 });
    const files = [
      { path: 'a.js', content: 'aaa', relevance: 30 },
      { path: 'b.js', content: 'bbb', relevance: 80 },
      { path: 'c.js', content: 'ccc', relevance: 50 },
    ];
    const result = cm.buildContext({ files, focusFiles: [] });
    assert.equal(result.included[0].path, 'b.js');
    assert.equal(result.included[1].path, 'c.js');
    assert.equal(result.included[2].path, 'a.js');
  });

  it('should buildContext() truncate when exceeding token budget', () => {
    const cm = new ContextManager({ maxTokens: 200, reserveForOutput: 10 });
    const bigContent = 'x'.repeat(400); // ~100 tokens
    const files = [
      { path: 'a.js', content: bigContent, relevance: 90 },
      { path: 'b.js', content: bigContent, relevance: 80 },
      { path: 'c.js', content: bigContent, relevance: 70 },
    ];
    const result = cm.buildContext({ files, focusFiles: [] });
    assert.equal(result.truncated, true);
    assert.ok(result.excluded.length > 0);
  });

  it('should buildContext() exclude low-priority files when budget is tight', () => {
    const cm = new ContextManager({ maxTokens: 150, reserveForOutput: 10 });
    const files = [
      { path: 'big.js', content: 'x'.repeat(500), relevance: 90 },
      { path: 'small.js', content: 'y'.repeat(20), relevance: 50 },
    ];
    const result = cm.buildContext({ files, focusFiles: [] });
    // big.js might get truncated, small.js might be excluded
    assert.ok(result.included.length >= 1);
    assert.equal(result.truncated, true);
  });

  it('should formatContextBlock() produce markdown with ### headers and code fences', () => {
    const cm = new ContextManager();
    const files = [
      { path: 'src/index.js', content: 'console.log("hello")', relevance: 100 },
      { path: 'src/util.js', content: 'export const x = 1', relevance: 80 },
    ];
    const block = cm.formatContextBlock(files);
    assert.ok(block.includes('### src/index.js'));
    assert.ok(block.includes('```'));
    assert.ok(block.includes('console.log("hello")'));
    assert.ok(block.includes('### src/util.js'));
    assert.ok(block.includes('export const x = 1'));
  });

  it('should calculateFileRelevance() return 100 for focus files', () => {
    const cm = new ContextManager();
    const task = { focusFiles: ['src/main.js'] };
    const score = cm.calculateFileRelevance('src/main.js', task);
    assert.equal(score, 100);
  });

  it('should calculateFileRelevance() return 60 for config files', () => {
    const cm = new ContextManager();
    const task = { focusFiles: ['src/main.js'] };
    assert.equal(cm.calculateFileRelevance('package.json', task), 60);
    assert.equal(cm.calculateFileRelevance('tsconfig.json', task), 60);
  });

  it('should calculateFileRelevance() return 10 for documentation files', () => {
    const cm = new ContextManager();
    const task = { focusFiles: ['src/main.js'] };
    assert.equal(cm.calculateFileRelevance('README.md', task), 10);
    assert.equal(cm.calculateFileRelevance('docs/guide.txt', task), 10);
  });

  it('should calculateFileRelevance() return 30 for source files not in focus', () => {
    const cm = new ContextManager();
    const task = { focusFiles: ['src/main.js'] };
    const score = cm.calculateFileRelevance('other/remote.js', task);
    assert.equal(score, 30);
  });

  it('should calculateFileRelevance() return 50 for same-directory files', () => {
    const cm = new ContextManager();
    const task = { focusFiles: ['src/main.js'] };
    const score = cm.calculateFileRelevance('src/helper.js', task);
    assert.equal(score, 50);
  });

  it('should getStats() track usage after buildContext calls', () => {
    const cm = new ContextManager({ maxTokens: 100_000, reserveForOutput: 1000 });
    const files = [{ path: 'a.js', content: 'code', relevance: 50 }];
    cm.buildContext({ files, focusFiles: [] });
    cm.buildContext({ files, focusFiles: [] });

    const stats = cm.getStats();
    assert.equal(stats.totalContextsBuilt, 2);
    assert.ok(stats.avgTokenUsage > 0);
  });

  it('should getStatus() return maxTokens and availableTokens', () => {
    const cm = new ContextManager({ maxTokens: 64_000, reserveForOutput: 8_000 });
    const status = cm.getStatus();
    assert.equal(status.maxTokens, 64_000);
    assert.equal(status.availableTokens, 56_000);
  });
});
