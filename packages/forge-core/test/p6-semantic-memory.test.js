import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════════════
//  1. SemanticMemory
// ═══════════════════════════════════════════════════════════════════════════════

describe('SemanticMemory', () => {
  let SemanticMemory;

  before(async () => {
    const mod = await import('../src/semantic-memory/index.js');
    SemanticMemory = mod.SemanticMemory;
  });

  // ── Constructor ──────────────────────────────────────────────────────────

  it('should construct with default options', () => {
    const sm = new SemanticMemory();
    const stats = sm.getStats();
    assert.equal(stats.documents, 0);
    assert.equal(stats.dimensions, 256);
    assert.equal(stats.vocabulary, 0);
    assert.equal(stats.avgVectorSize, 0);
  });

  it('should accept custom dimensions option', () => {
    const sm = new SemanticMemory({ dimensions: 128 });
    const stats = sm.getStats();
    assert.equal(stats.dimensions, 128);
  });

  it('should accept custom minSimilarity option', () => {
    const sm = new SemanticMemory({ minSimilarity: 0.5 });
    sm.index('doc1', 'Machine learning and artificial intelligence');
    sm.index('doc2', 'The quick brown fox jumps over the lazy dog');
    const results = sm.search('machine learning');
    // With a high threshold the unrelated doc should be filtered out
    for (const r of results) {
      assert.ok(r.score >= 0.5, `Score ${r.score} should be >= 0.5`);
    }
  });

  // ── index() ──────────────────────────────────────────────────────────────

  it('should index a single document and return an IndexResult', () => {
    const sm = new SemanticMemory();
    const result = sm.index('doc1', 'The quick brown fox jumps over the lazy dog');
    assert.equal(result.id, 'doc1');
    assert.equal(result.dimensions, 256);
    assert.ok(result.vectorSize > 0, 'vectorSize should be > 0');
  });

  it('should increment document count after indexing', () => {
    const sm = new SemanticMemory();
    sm.index('a', 'Alpha beta gamma');
    sm.index('b', 'Delta epsilon zeta');
    assert.equal(sm.getStats().documents, 2);
  });

  it('should replace an existing document when re-indexing same id', () => {
    const sm = new SemanticMemory();
    sm.index('doc1', 'First version of the document');
    sm.index('doc1', 'Second version completely different text');
    assert.equal(sm.getStats().documents, 1);
  });

  it('should store metadata on indexed documents', () => {
    const sm = new SemanticMemory();
    sm.index('doc1', 'Some content here', { category: 'test', priority: 1 });
    const results = sm.search('content');
    if (results.length > 0) {
      assert.equal(results[0].metadata.category, 'test');
      assert.equal(results[0].metadata.priority, 1);
    }
  });

  // ── remove() ─────────────────────────────────────────────────────────────

  it('should remove a document and return true', () => {
    const sm = new SemanticMemory();
    sm.index('doc1', 'Removable document content');
    assert.equal(sm.getStats().documents, 1);
    const removed = sm.remove('doc1');
    assert.equal(removed, true);
    assert.equal(sm.getStats().documents, 0);
  });

  it('should return false when removing a non-existent document', () => {
    const sm = new SemanticMemory();
    const removed = sm.remove('nonexistent');
    assert.equal(removed, false);
  });

  // ── search() ─────────────────────────────────────────────────────────────

  it('should return similar documents for a query', () => {
    const sm = new SemanticMemory();
    sm.index('doc1', 'Python programming language and data science');
    sm.index('doc2', 'JavaScript web development and frontend frameworks');
    sm.index('doc3', 'Python machine learning and deep neural networks');

    const results = sm.search('Python data analysis', { minSimilarity: 0.01 });
    assert.ok(results.length > 0, 'Should return at least one result');
    // doc1 and doc3 should score higher than doc2
    assert.ok(results[0].score > 0, 'Top result should have positive score');
  });

  it('should respect the limit option', () => {
    const sm = new SemanticMemory();
    sm.index('a', 'Alpha beta gamma delta');
    sm.index('b', 'Alpha beta epsilon zeta');
    sm.index('c', 'Alpha gamma epsilon theta');
    const results = sm.search('alpha beta gamma', { limit: 2, minSimilarity: 0.01 });
    assert.ok(results.length <= 2, `Should return at most 2 results, got ${results.length}`);
  });

  it('should return results sorted by descending score', () => {
    const sm = new SemanticMemory();
    sm.index('doc1', 'The cat sat on the mat');
    sm.index('doc2', 'A dog chased the cat around the park');
    sm.index('doc3', 'Quantum physics and relativity theory');
    const results = sm.search('cat and dog animals', { minSimilarity: 0.01 });
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].score >= results[i].score, 'Results should be sorted descending');
    }
  });

  it('should filter results by metadataFilter', () => {
    const sm = new SemanticMemory();
    sm.index('doc1', 'Python programming tutorial guide', { lang: 'python' });
    sm.index('doc2', 'Python data analysis library guide', { lang: 'python' });
    sm.index('doc3', 'JavaScript web framework tutorial guide', { lang: 'javascript' });
    const results = sm.search('tutorial guide programming', {
      metadataFilter: { lang: 'python' },
      minSimilarity: 0.01,
    });
    for (const r of results) {
      assert.equal(r.metadata.lang, 'python');
    }
  });

  it('should return empty array when no documents match', () => {
    const sm = new SemanticMemory();
    sm.index('doc1', 'Only one document about cooking recipes');
    const results = sm.search('quantum mechanics physics', { minSimilarity: 0.99 });
    assert.equal(results.length, 0);
  });

  // ── indexBatch() ─────────────────────────────────────────────────────────

  it('should batch-index multiple documents and return count', () => {
    const sm = new SemanticMemory();
    const count = sm.indexBatch([
      { id: 'd1', content: 'First document about science' },
      { id: 'd2', content: 'Second document about art', metadata: { tag: 'art' } },
      { id: 'd3', content: 'Third document about music' },
    ]);
    assert.equal(count, 3);
    assert.equal(sm.getStats().documents, 3);
  });

  it('should return 0 for non-array input to indexBatch', () => {
    const sm = new SemanticMemory();
    assert.equal(sm.indexBatch(null), 0);
    assert.equal(sm.indexBatch('not an array'), 0);
  });

  it('should skip invalid entries in indexBatch', () => {
    const sm = new SemanticMemory();
    const count = sm.indexBatch([
      { id: 'd1', content: 'Valid document text' },
      { id: null, content: 'Missing id' },
      { content: 'Also missing id' },
      null,
      { id: 'd5', content: 'Another valid one' },
    ]);
    assert.equal(count, 2);
  });

  // ── getStats() ───────────────────────────────────────────────────────────

  it('should return correct stats after indexing and removal', () => {
    const sm = new SemanticMemory({ dimensions: 64 });
    sm.index('a', 'Alpha beta gamma');
    sm.index('b', 'Delta epsilon zeta');
    sm.index('c', 'Eta theta iota');
    sm.remove('b');
    const stats = sm.getStats();
    assert.equal(stats.documents, 2);
    assert.equal(stats.dimensions, 64);
    assert.ok(stats.vocabulary > 0);
    assert.ok(stats.avgVectorSize > 0);
  });

  // ── clear() ──────────────────────────────────────────────────────────────

  it('should clear all data', () => {
    const sm = new SemanticMemory();
    sm.index('a', 'Alpha beta');
    sm.index('b', 'Gamma delta');
    sm.clear();
    const stats = sm.getStats();
    assert.equal(stats.documents, 0);
    assert.equal(stats.vocabulary, 0);
  });

  // ── rebuild() ────────────────────────────────────────────────────────────

  it('should rebuild the index and return summary', () => {
    const sm = new SemanticMemory();
    sm.index('a', 'Alpha beta gamma delta');
    sm.index('b', 'Epsilon zeta eta theta');
    sm.index('c', 'Iota kappa lambda mu');
    const result = sm.rebuild();
    assert.equal(result.documents, 3);
    assert.ok(result.vocabulary > 0);
  });

  // ── exportState() / importState() ────────────────────────────────────────

  it('should export and import state preserving documents', () => {
    const sm = new SemanticMemory();
    sm.index('doc1', 'Exportable document content alpha');
    sm.index('doc2', 'Another exportable document beta');
    const state = sm.exportState();

    assert.ok(state.config);
    assert.ok(state.vocabulary);
    assert.ok(state.index);
    assert.ok(state.exportedAt);

    const sm2 = new SemanticMemory();
    sm2.importState(state);
    assert.equal(sm2.getStats().documents, 2);
  });

  it('should handle importState with null gracefully', () => {
    const sm = new SemanticMemory();
    sm.importState(null);
    assert.equal(sm.getStats().documents, 0);
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  it('should handle empty string content', () => {
    const sm = new SemanticMemory();
    const result = sm.index('empty', '');
    assert.equal(result.id, 'empty');
    assert.equal(result.dimensions, 256);
  });

  it('should handle search on empty index', () => {
    const sm = new SemanticMemory();
    const results = sm.search('anything at all');
    assert.equal(results.length, 0);
  });
});
