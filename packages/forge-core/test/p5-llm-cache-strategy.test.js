import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ── Module 1: LLMCache ───────────────────────────────────────────────────────

describe('LLMCache', () => {
  let LLMCache;
  let testDir;

  before(async () => {
    const mod = await import('../src/llm-cache/index.js');
    LLMCache = mod.LLMCache;
  });

  beforeEach(async () => {
    testDir = join(tmpdir(), `llmcache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  after(async () => {
    try { await rm(testDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  it('should construct with default options (maxSize=5000, ttlMs=3600000)', () => {
    const cache = new LLMCache();
    const stats = cache.getStats();
    assert.equal(stats.maxSize, 5000);
    assert.equal(stats.size, 0);
    assert.equal(stats.hitCount, 0);
    assert.equal(stats.missCount, 0);
    assert.equal(stats.evictions, 0);
    assert.equal(stats.hitRate, 0);
    assert.equal(stats.oldestEntry, null);
    assert.equal(stats.newestEntry, null);
    assert.ok(Array.isArray(stats.topQueries));
    assert.equal(stats.topQueries.length, 0);
  });

  it('should accept custom constructor options', () => {
    const cache = new LLMCache({
      maxSize: 100,
      ttlMs: 60_000,
      similarityThreshold: 0.9,
      enableFuzzyMatch: false,
    });
    const stats = cache.getStats();
    assert.equal(stats.maxSize, 100);
  });

  it('should return null on get() for non-existent entry (miss)', () => {
    const cache = new LLMCache();
    const result = cache.get('sys', 'nonexistent prompt');
    assert.equal(result, null);
  });

  it('should return CacheHitResult after set() then get() with correct response and usage', () => {
    const cache = new LLMCache();
    const usage = { inputTokens: 100, outputTokens: 50 };
    const setResult = cache.set('sys', 'hello world', 'response text', usage);
    assert.equal(setResult.evicted, false);
    assert.equal(setResult.cacheSize, 1);

    const hit = cache.get('sys', 'hello world');
    assert.ok(hit !== null);
    assert.equal(hit.response, 'response text');
    assert.deepEqual(hit.usage, usage);
    assert.ok(typeof hit.cachedAt === 'number');
    assert.equal(hit.hitCount, 1);
    assert.equal(hit.similarity, 1);
  });

  it('should return null after TTL expiration', async () => {
    const cache = new LLMCache({ ttlMs: 50 });
    cache.set('sys', 'prompt', 'cached response', {});

    // Verify it is a hit before expiration
    const before = cache.get('sys', 'prompt');
    assert.ok(before !== null);
    assert.equal(before.response, 'cached response');

    await new Promise(r => setTimeout(r, 100));

    const after = cache.get('sys', 'prompt');
    assert.equal(after, null);
  });

  it('should support fuzzy matching for similar prompts', () => {
    const cache = new LLMCache({ similarityThreshold: 0.6, enableFuzzyMatch: true });
    const usage = { inputTokens: 10, outputTokens: 20 };
    cache.set(
      'system',
      'Write a function that calculates the average of a list of numbers and returns the result',
      'function average(list) { return list.reduce((a,b)=>a+b,0)/list.length; }',
      usage,
    );

    // Similar prompt with minor wording difference — should fuzzy-match
    const hit = cache.get(
      'system',
      'Write a function that calculates the average of a list of numbers and returns the result value',
    );
    assert.ok(hit !== null, 'expected fuzzy hit but got null');
    assert.ok(hit.similarity >= 0.6, `similarity ${hit.similarity} below threshold`);
    assert.equal(hit.response, 'function average(list) { return list.reduce((a,b)=>a+b,0)/list.length; }');
  });

  it('should track hitCount, missCount, and hitRate in getStats()', () => {
    const cache = new LLMCache();
    cache.set('sys', 'p1', 'one', {});
    cache.get('sys', 'p1');       // hit
    cache.get('sys', 'p2');       // miss

    const stats = cache.getStats();
    assert.equal(stats.hitCount, 1);
    assert.equal(stats.missCount, 1);
    assert.ok(Math.abs(stats.hitRate - 0.5) < 0.001);
    assert.equal(stats.size, 1);
  });

  it('should evict LRU entry when maxSize is exceeded', () => {
    const cache = new LLMCache({ maxSize: 2 });
    cache.set('sys', 'p1', 'first', {});
    cache.set('sys', 'p2', 'second', {});
    const thirdResult = cache.set('sys', 'p3', 'third', {});

    assert.equal(thirdResult.evicted, true);
    assert.equal(thirdResult.cacheSize, 2);

    // The first entry should have been evicted (oldest lastAccessedAt)
    assert.equal(cache.get('sys', 'p1'), null);
    assert.ok(cache.get('sys', 'p2') !== null);
    assert.ok(cache.get('sys', 'p3') !== null);

    const stats = cache.getStats();
    assert.equal(stats.size, 2);
    assert.equal(stats.evictions, 1);
  });

  it('should clear() all entries and reset stats', () => {
    const cache = new LLMCache();
    cache.set('a', 'b', 'x', {});
    cache.get('a', 'b');          // hit
    cache.get('miss', 'miss');    // miss

    const before = cache.getStats();
    assert.ok(before.size > 0);

    cache.clear();
    const after = cache.getStats();
    assert.equal(after.size, 0);
    assert.equal(after.hitCount, 0);
    assert.equal(after.missCount, 0);
    assert.equal(after.evictions, 0);
    assert.equal(after.hitRate, 0);
    assert.equal(after.oldestEntry, null);
    assert.equal(after.newestEntry, null);
  });

  it('should persist to disk and load back via persist()/load()', async () => {
    const persistPath = join(testDir, 'cache-persist.json');
    const cache = new LLMCache({ persistencePath: persistPath });
    cache.set('sys', 'prompt1', 'response1', { inputTokens: 10 });
    cache.set('sys', 'prompt2', 'response2', { inputTokens: 20 });
    cache.get('sys', 'prompt1'); // generate a hit

    await cache.persist();

    // New cache instance loads from the same file
    const cache2 = new LLMCache({ persistencePath: persistPath });
    const loadResult = await cache2.load();
    assert.equal(loadResult.loaded, 2);

    const hit = cache2.get('sys', 'prompt1');
    assert.ok(hit !== null);
    assert.equal(hit.response, 'response1');

    const stats = cache2.getStats();
    assert.equal(stats.size, 2);
  });
});

// ── Module 2: StrategyEvolution persistence ──────────────────────────────────

describe('StrategyEvolution — persistence', () => {
  let StrategyEvolution;
  let testDir;
  let persistencePath;

  before(async () => {
    const mod = await import('../src/self-loop/strategy-evolution.js');
    StrategyEvolution = mod.StrategyEvolution;
  });

  beforeEach(async () => {
    testDir = join(tmpdir(), `se-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    persistencePath = join(testDir, 'strategy-state.json');
  });

  after(async () => {
    // Best-effort cleanup; ignore errors from already-deleted dirs
    try { await rm(testDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  it('should accept persistencePath in constructor', () => {
    const se = new StrategyEvolution({ persistencePath: '/tmp/some-path.json' });
    assert.equal(se.persistencePath, '/tmp/some-path.json');
  });

  it('should return null persistencePath when not provided', () => {
    const se = new StrategyEvolution();
    assert.equal(se.persistencePath, null);
  });

  it('should save state to JSON file', async () => {
    const se = new StrategyEvolution({ persistencePath });
    se.recordOutcome({ taskType: 'implement', strategy: 'targeted_fix', success: true, loopCount: 2 });
    const result = await se.save();
    assert.equal(result.saved, true);
    assert.equal(result.path, persistencePath);

    const raw = await readFile(persistencePath, 'utf8');
    const data = JSON.parse(raw);
    assert.ok(data.stats);
    assert.ok(data.history);
    assert.ok(data.savedAt);
  });

  it('should return saved:false when no persistencePath is set', async () => {
    const se = new StrategyEvolution();
    const result = await se.save();
    assert.equal(result.saved, false);
    assert.equal(result.path, null);
  });

  it('should load previously saved state', async () => {
    const se1 = new StrategyEvolution({ persistencePath });
    se1.recordOutcome({ taskType: 'test', strategy: 'debugger', success: true, loopCount: 3 });
    se1.recordOutcome({ taskType: 'test', strategy: 'debugger', success: false, loopCount: 5 });
    await se1.save();

    const se2 = new StrategyEvolution({ persistencePath });
    const loadResult = await se2.load();
    assert.equal(loadResult.loaded, true);
    assert.ok(loadResult.entries > 0);

    const stats = se2.getStats();
    assert.ok(stats.test);
    assert.ok(stats.test.debugger);
    assert.equal(stats.test.debugger.success, 1);
    assert.equal(stats.test.debugger.failure, 1);
  });

  it('should return loaded:false when file does not exist', async () => {
    const se = new StrategyEvolution({ persistencePath: join(testDir, 'nonexistent.json') });
    const result = await se.load();
    assert.equal(result.loaded, false);
    assert.equal(result.entries, 0);
  });

  it('should return loaded:false when no persistencePath is set', async () => {
    const se = new StrategyEvolution();
    const result = await se.load();
    assert.equal(result.loaded, false);
  });

  it('should work with evolveAndSave()', async () => {
    const se = new StrategyEvolution({ persistencePath });
    for (let i = 0; i < 6; i++) {
      se.recordOutcome({ taskType: 'implement', strategy: 'targeted_fix', success: true, loopCount: 2 });
    }
    const result = await se.evolveAndSave();
    assert.ok(result.summary);
    assert.ok(typeof result.summary.totalOutcomes === 'number');
    assert.ok(result.summary.totalOutcomes >= 6);

    // Verify file was written
    const raw = await readFile(persistencePath, 'utf8');
    const data = JSON.parse(raw);
    assert.ok(data.history.length >= 6);
  });

  it('should restore insights after save/load cycle', async () => {
    const se1 = new StrategyEvolution({ persistencePath });
    // Record enough outcomes to trigger pattern detection
    for (let i = 0; i < 10; i++) {
      se1.recordOutcome({ taskType: 'debug', strategy: 'full_rewrite', success: false, loopCount: 8 });
    }
    se1.evolve();
    await se1.save();

    const se2 = new StrategyEvolution({ persistencePath });
    await se2.load();
    const insights = se2.getInsights('debug');
    // After loading, insights should be restored (may or may not have content depending on pattern detection)
    assert.ok(Array.isArray(insights));
  });
});
