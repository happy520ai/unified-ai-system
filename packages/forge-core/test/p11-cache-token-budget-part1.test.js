import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { LLMCache } from '../src/llm-cache/index.js';
import { TokenPredictor } from '../src/token-predictor/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// P11-1  LLMCache — advanced features
// ═══════════════════════════════════════════════════════════════════════════════

describe('LLMCache — P11 advanced features', () => {
  // ── Fuzzy matching ──────────────────────────────────────────────────────

  describe('fuzzy matching', () => {
    it('should return similarity=1 for an exact-match hit', () => {
      const cache = new LLMCache({ maxSize: 100 });
      cache.set('sys', 'What is the capital of France?', 'Paris');
      const hit = cache.get('sys', 'What is the capital of France?');
      assert.ok(hit);
      assert.equal(hit.similarity, 1);
      assert.equal(hit.response, 'Paris');
    });

    it('should return a fuzzy hit for similar prompts', () => {
      const cache = new LLMCache({ maxSize: 100, similarityThreshold: 0.3 });
      cache.set('sys', 'Explain how neural networks work', 'NN response');
      const hit = cache.get('sys', 'Explain how neural networks function');
      assert.ok(hit);
      assert.ok(hit.similarity > 0 && hit.similarity < 1, `similarity was ${hit.similarity}`);
    });

    it('should miss when prompts are too different', () => {
      const cache = new LLMCache({ maxSize: 100, similarityThreshold: 0.85 });
      cache.set('sys', 'Explain quantum physics', 'QP response');
      const hit = cache.get('sys', 'Write a recipe for chocolate cake');
      assert.equal(hit, null);
    });

    it('should skip fuzzy matching when enableFuzzyMatch=false', () => {
      const cache = new LLMCache({ maxSize: 100, enableFuzzyMatch: false, similarityThreshold: 0.3 });
      cache.set('sys', 'Explain neural networks', 'NN response');
      const hit = cache.get('sys', 'Explain neural networks in detail');
      assert.equal(hit, null);
    });
  });

  // ── LRU eviction ────────────────────────────────────────────────────────

  describe('LRU eviction', () => {
    it('should evict the least-recently-used entry when at capacity', async () => {
      const cache = new LLMCache({ maxSize: 3, enableFuzzyMatch: false });
      cache.set('sys', 'quantum physics explanation', 'respA');
      await new Promise(r => setTimeout(r, 20));
      cache.set('sys', 'chocolate cake recipe', 'respB');
      await new Promise(r => setTimeout(r, 20));
      cache.set('sys', 'machine learning algorithms', 'respC');

      // Access A to make it recently used.
      await new Promise(r => setTimeout(r, 20));
      cache.get('sys', 'quantum physics explanation');

      // Insert D — B should be evicted (LRU, oldest lastAccessedAt).
      await new Promise(r => setTimeout(r, 20));
      const result = cache.set('sys', 'ancient roman history', 'respD');
      assert.equal(result.evicted, true);
      assert.equal(result.cacheSize, 3);

      assert.ok(cache.get('sys', 'quantum physics explanation'), 'A should still be cached');
      assert.equal(cache.get('sys', 'chocolate cake recipe'), null, 'B should have been evicted');
    });

    it('should track eviction count in stats', () => {
      const cache = new LLMCache({ maxSize: 2 });
      cache.set('sys', 'p1', 'r1');
      cache.set('sys', 'p2', 'r2');
      cache.set('sys', 'p3', 'r3'); // triggers eviction
      cache.set('sys', 'p4', 'r4'); // triggers eviction

      const stats = cache.getStats();
      assert.equal(stats.evictions, 2);
      assert.equal(stats.size, 2);
    });
  });

  // ── Disk persistence ────────────────────────────────────────────────────

  describe('disk persistence', () => {
    let persistPath;

    before(() => {
      persistPath = join(tmpdir(), 'llm-cache-test-' + Date.now(), 'cache.json');
    });

    it('should persist and load cache entries from disk', async () => {
      const cache1 = new LLMCache({ maxSize: 100 });
      cache1.set('sys', 'prompt alpha', 'response alpha', { outputTokens: 50 });
      cache1.set('sys', 'prompt beta', 'response beta', { outputTokens: 30 });

      await cache1.persist(persistPath);

      const cache2 = new LLMCache({ maxSize: 100 });
      const { loaded } = await cache2.load(persistPath);
      assert.equal(loaded, 2);

      const hit = cache2.get('sys', 'prompt alpha');
      assert.ok(hit);
      assert.equal(hit.response, 'response alpha');
      assert.equal(hit.similarity, 1);
    });

    it('should restore counters after load', async () => {
      const cache1 = new LLMCache({ maxSize: 100 });
      cache1.set('sys', 'prompt x', 'resp x');
      cache1.get('sys', 'prompt x');  // hit
      cache1.get('sys', 'missing');   // miss

      await cache1.persist(persistPath);

      const cache2 = new LLMCache({ maxSize: 100 });
      await cache2.load(persistPath);
      const stats = cache2.getStats();
      assert.equal(stats.hitCount, 1);
      assert.equal(stats.missCount, 1);
    });

    it('should return loaded=0 when file does not exist', async () => {
      const cache = new LLMCache({ maxSize: 100 });
      const result = await cache.load(join(tmpdir(), 'nonexistent-' + Date.now() + '.json'));
      assert.equal(result.loaded, 0);
    });

    it('should return loaded=0 for corrupt JSON', async () => {
      const corruptPath = join(tmpdir(), 'llm-cache-corrupt-' + Date.now() + '.json');
      const { writeFile, mkdir } = await import('node:fs/promises');
      const { dirname } = await import('node:path');
      await mkdir(dirname(corruptPath), { recursive: true });
      await writeFile(corruptPath, '{bad json', 'utf-8');

      const cache = new LLMCache({ maxSize: 100 });
      const result = await cache.load(corruptPath);
      assert.equal(result.loaded, 0);

      await rm(corruptPath, { force: true });
    });

    after(async () => {
      await rm(persistPath, { force: true });
    });
  });

  // ── getStats ────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('should track top queries by hit count', () => {
      const cache = new LLMCache({ maxSize: 100 });
      cache.set('sys', 'popular prompt', 'popular response');
      cache.set('sys', 'rare prompt', 'rare response');

      cache.get('sys', 'popular prompt');
      cache.get('sys', 'popular prompt');
      cache.get('sys', 'popular prompt');
      cache.get('sys', 'rare prompt');

      const stats = cache.getStats();
      assert.ok(stats.topQueries.length >= 2);
      assert.ok(stats.topQueries[0].hitCount >= stats.topQueries[1].hitCount);
      assert.equal(stats.topQueries[0].hitCount, 3);
    });

    it('should report avgSimilarity for exact hits', () => {
      const cache = new LLMCache({ maxSize: 100 });
      cache.set('sys', 'exact q', 'exact r');
      cache.get('sys', 'exact q');

      const stats = cache.getStats();
      assert.equal(stats.avgSimilarity, 1);
    });

    it('should report hitRate correctly', () => {
      const cache = new LLMCache({ maxSize: 100 });
      cache.set('sys', 'q1', 'r1');
      cache.get('sys', 'q1');     // hit
      cache.get('sys', 'miss1');  // miss
      cache.get('sys', 'miss2');  // miss

      const stats = cache.getStats();
      assert.ok(Math.abs(stats.hitRate - 1 / 3) < 0.01);
    });
  });

  // ── Misc ────────────────────────────────────────────────────────────────

  describe('miscellaneous', () => {
    it('should return estimated savings', () => {
      const cache = new LLMCache({ maxSize: 100 });
      cache.set('sys', 'q', 'r', { outputTokens: 1000 });
      cache.get('sys', 'q'); // 1 hit

      const savings = cache.getEstimatedSavings(0.00003);
      assert.ok(savings.tokensSaved > 0);
      assert.ok(savings.estimatedCostSaved > 0);
    });

    it('clear() should reset everything', () => {
      const cache = new LLMCache({ maxSize: 100 });
      cache.set('sys', 'q', 'r');
      cache.get('sys', 'q');
      cache.clear();
      const stats = cache.getStats();
      assert.equal(stats.size, 0);
      assert.equal(stats.hitCount, 0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// P11-2  TokenPredictor
// ═══════════════════════════════════════════════════════════════════════════════

describe('TokenPredictor', () => {
  describe('construction', () => {
    it('should create with default options', () => {
      const tp = new TokenPredictor();
      const status = tp.getStatus();
      assert.equal(status.modelContextWindow, 128_000);
      assert.equal(status.predictionCount, 0);
    });

    it('should accept custom context window', () => {
      const tp = new TokenPredictor({ modelContextWindow: 32_000 });
      assert.equal(tp.getStatus().modelContextWindow, 32_000);
    });
  });

  // ── estimateTokens ──────────────────────────────────────────────────────

  describe('estimateTokens', () => {
    it('should estimate ~4 chars/token for English prose', () => {
      const tp = new TokenPredictor();
      const text = 'The quick brown fox jumps over the lazy dog';
      const tokens = tp.estimateTokens(text);
      // 43 chars → ~11 tokens at 4 chars/token
      assert.ok(tokens >= 8 && tokens <= 15, `got ${tokens}`);
    });

    it('should estimate higher density for code', () => {
      const tp = new TokenPredictor();
      const code = 'function hello() { return console.log("world"); }';
      const tokens = tp.estimateTokens(code);
      // Code has ~2.5 chars/token → more tokens for same length
      const proseTokens = tp.estimateTokens('a'.repeat(code.length));
      assert.ok(tokens > proseTokens, `code tokens ${tokens} should exceed prose ${proseTokens}`);
    });

    it('should estimate ~1.5 tokens per CJK character', () => {
      const tp = new TokenPredictor();
      const cjk = '人工智能机器学习深度学习';
      const tokens = tp.estimateTokens(cjk);
      // 10 CJK chars × 1.5 = 15 tokens
      assert.ok(tokens >= 12 && tokens <= 18, `got ${tokens}`);
    });

    it('should return 0 for empty string', () => {
      const tp = new TokenPredictor();
      assert.equal(tp.estimateTokens(''), 0);
    });

    it('should return 0 for null/undefined', () => {
      const tp = new TokenPredictor();
      assert.equal(tp.estimateTokens(null), 0);
      assert.equal(tp.estimateTokens(undefined), 0);
    });

    it('should return at least 1 for non-empty text', () => {
      const tp = new TokenPredictor();
      assert.ok(tp.estimateTokens('a') >= 1);
    });
  });

  // ── predictOutputTokens ─────────────────────────────────────────────────

  describe('predictOutputTokens', () => {
    it('should return default estimates for known task types', () => {
      const tp = new TokenPredictor();
      const result = tp.predictOutputTokens('implement', 1000);
      assert.ok(result.predicted > 0);
      assert.ok(result.min > 0);
      assert.ok(result.max > result.predicted);
      assert.equal(result.confidence, 0.3); // no history
    });

    it('should fall back to explore defaults for unknown task type', () => {
      const tp = new TokenPredictor();
      const result = tp.predictOutputTokens('unknown-task', 500);
      assert.ok(result.predicted > 0);
    });

    it('should use historical data when enough samples exist', () => {
      const tp = new TokenPredictor();
      tp.recordUsage('implement', 100, 3000);
      tp.recordUsage('implement', 200, 2800);
      tp.recordUsage('implement', 150, 3200);

      const result = tp.predictOutputTokens('implement', 150);
      assert.ok(result.confidence > 0.3);
    });
  });

  // ── wouldExceedBudget ───────────────────────────────────────────────────

  describe('wouldExceedBudget', () => {
    const budget = {
      maxTokens: 10_000,
      maxCost: 1.0,
      costPerInputToken: 0.00003,
      costPerOutputToken: 0.00006,
    };

    it('should allow when under budget', () => {
      const tp = new TokenPredictor();
      const check = tp.wouldExceedBudget(1000, 500, budget);
      assert.equal(check.exceeds, false);
      assert.ok(check.remaining > 0);
    });

    it('should exceed when tokens too high', () => {
      const tp = new TokenPredictor();
      const check = tp.wouldExceedBudget(8000, 5000, budget);
      assert.equal(check.exceeds, true);
    });

    it('should exceed when cost too high', () => {
      const tp = new TokenPredictor();
      // Cost: 5000 * 0.00003 + 5000 * 0.00006 = 0.45 → within 1.0
      // But with 20000 in + 20000 out → 0.6 + 1.2 = 1.8 → exceeds
      const check = tp.wouldExceedBudget(20000, 20000, budget);
      assert.equal(check.exceeds, true);
    });
  });

  // ── recordUsage & accuracy ──────────────────────────────────────────────

  describe('recordUsage and accuracy', () => {
    it('should track task types', () => {
      const tp = new TokenPredictor();
      tp.recordUsage('implement', 100, 200);
      tp.recordUsage('test', 50, 100);
      const status = tp.getStatus();
      assert.ok(status.trackedTaskTypes.includes('implement'));
      assert.ok(status.trackedTaskTypes.includes('test'));
    });

    it('should record predictions for accuracy', () => {
      const tp = new TokenPredictor();
      tp.recordPrediction('implement', 1000, 1100);
      const accuracy = tp.getAccuracy();
      assert.equal(accuracy.predictions, 1);
      assert.ok(accuracy.mape >= 0);
    });
  });

  // ── suggestPromptSize ───────────────────────────────────────────────────

  describe('suggestPromptSize', () => {
    it('should suggest a max input size', () => {
      const tp = new TokenPredictor();
      const suggestion = tp.suggestPromptSize('implement', {
        maxTokens: 10_000,
        maxCost: 1.0,
        costPerInputToken: 0.00003,
        costPerOutputToken: 0.00006,
      });
      assert.ok(suggestion.maxInputTokens > 0);
      assert.ok(suggestion.maxOutputTokens > 0);
    });
  });
});
