/**
 * P11 CodebaseSearch — construction, index building, search, related files,
 * file signatures, stats, and edge cases.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { CodebaseSearch } from '../src/codebase-search/index.js';

describe('CodebaseSearch', () => {
  let tmpDir;

  before(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'cs-test-'));

    // Create a small project tree
    await mkdir(join(tmpDir, 'src'), { recursive: true });

    await writeFile(
      join(tmpDir, 'src', 'auth.js'),
      [
        "import { hashPassword } from './crypto.js';",
        '',
        '/** Authenticate a user with email and password. */',
        'export async function authenticateUser(email, password) {',
        '  const hashed = await hashPassword(password);',
        '  return { token: "jwt-token", user: email };',
        '}',
        '',
        'export class AuthService {',
        '  constructor(config) {',
        '    this.config = config;',
        '  }',
        '  async login(email, password) {',
        '    return authenticateUser(email, password);',
        '  }',
        '}',
      ].join('\n'),
    );

    await writeFile(
      join(tmpDir, 'src', 'crypto.js'),
      [
        "import { createHash } from 'node:crypto';",
        '',
        '/** Hash a plaintext password with SHA-256. */',
        'export function hashPassword(plaintext) {',
        '  return createHash("sha256").update(plaintext).digest("hex");',
        '}',
        '',
        'export function verifyPassword(plaintext, hash) {',
        '  return hashPassword(plaintext) === hash;',
        '}',
      ].join('\n'),
    );

    await writeFile(
      join(tmpDir, 'src', 'database.js'),
      [
        '/** Database connection manager for PostgreSQL. */',
        'export class DatabaseManager {',
        '  constructor(connectionString) {',
        '    this.connectionString = connectionString;',
        '    this.pool = null;',
        '  }',
        '  async connect() {',
        '    this.pool = { connected: true };',
        '  }',
        '  async query(sql, params) {',
        '    return { rows: [], sql };',
        '  }',
        '}',
        '',
        'export function createDatabase(url) {',
        '  return new DatabaseManager(url);',
        '}',
      ].join('\n'),
    );

    await writeFile(
      join(tmpDir, 'src', 'utils.js'),
      [
        '/** Format a date as ISO string. */',
        'export function formatDate(date) {',
        '  return date.toISOString();',
        '}',
        '',
        '/** Deep clone an object using structured clone. */',
        'export function deepClone(obj) {',
        '  return structuredClone(obj);',
        '}',
      ].join('\n'),
    );
  });

  after(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  // ── Construction ──────────────────────────────────────────────────────

  it('should construct with default options', () => {
    const search = new CodebaseSearch();
    assert.ok(search instanceof CodebaseSearch);
  });

  it('should construct with custom maxResults and minScore', () => {
    const search = new CodebaseSearch({ maxResults: 20, minScore: 0.5 });
    assert.ok(search instanceof CodebaseSearch);
  });

  it('should construct with custom tokenWeights', () => {
    const search = new CodebaseSearch({ tokenWeights: { auth: 3 } });
    assert.ok(search instanceof CodebaseSearch);
  });

  // ── buildIndex ────────────────────────────────────────────────────────

  it('should build an index from a project directory', async () => {
    const search = new CodebaseSearch();
    const stats = await search.buildIndex(tmpDir);
    assert.equal(stats.fileCount, 4);
    assert.ok(stats.tokenCount > 0, 'should have tokens');
    assert.ok(stats.indexSize > 0, 'should have index entries');
  });

  it('should report correct file count after indexing', async () => {
    const search = new CodebaseSearch();
    const stats = await search.buildIndex(tmpDir);
    assert.equal(stats.fileCount, 4, 'four source files');
  });

  // ── search ────────────────────────────────────────────────────────────

  it('should return relevant results for authentication query', async () => {
    const search = new CodebaseSearch();
    await search.buildIndex(tmpDir);
    const results = search.search('authenticate user login');
    assert.ok(results.length > 0, 'should find at least one result');
    assert.ok(results[0].path.includes('auth'), 'top result should be auth file');
  });

  it('should include score, matchedTerms, highlights, and relevance in results', async () => {
    const search = new CodebaseSearch();
    await search.buildIndex(tmpDir);
    const results = search.search('password hash');
    assert.ok(results.length > 0);
    const r = results[0];
    assert.equal(typeof r.score, 'number');
    assert.ok(Array.isArray(r.matchedTerms));
    assert.ok(Array.isArray(r.highlights));
    assert.equal(typeof r.relevance, 'string');
  });

  it('should return empty array for empty query', async () => {
    const search = new CodebaseSearch();
    await search.buildIndex(tmpDir);
    const results = search.search('');
    assert.deepEqual(results, []);
  });

  it('should return empty array for query with only stop words', async () => {
    const search = new CodebaseSearch();
    await search.buildIndex(tmpDir);
    const results = search.search('const let var');
    assert.deepEqual(results, []);
  });

  it('should support fileFilter option', async () => {
    const search = new CodebaseSearch();
    await search.buildIndex(tmpDir);
    const results = search.search('hash password', { fileFilter: 'crypto' });
    for (const r of results) {
      assert.ok(r.path.includes('crypto'), `path ${r.path} should include crypto`);
    }
  });

  it('should respect maxResults option', async () => {
    const search = new CodebaseSearch();
    await search.buildIndex(tmpDir);
    const results = search.search('function export class', { maxResults: 1 });
    assert.ok(results.length <= 1);
  });

  it('should rank database query for database terms', async () => {
    const search = new CodebaseSearch();
    await search.buildIndex(tmpDir);
    const results = search.search('database connection postgresql pool');
    assert.ok(results.length > 0);
    assert.ok(
      results[0].path.includes('database'),
      `expected database file first, got ${results[0].path}`,
    );
  });

  // ── getRelatedFiles ───────────────────────────────────────────────────

  it('should find related files via imports', async () => {
    const search = new CodebaseSearch();
    await search.buildIndex(tmpDir);
    const related = search.getRelatedFiles('src/auth.js');
    assert.ok(Array.isArray(related));
    // auth.js imports from crypto.js
    const cryptoRelation = related.find(r => r.path.includes('crypto'));
    assert.ok(cryptoRelation, 'should find crypto.js as related');
    assert.equal(cryptoRelation.relation, 'imports');
  });

  it('should return empty array for unknown file', async () => {
    const search = new CodebaseSearch();
    await search.buildIndex(tmpDir);
    const related = search.getRelatedFiles('nonexistent.js');
    assert.deepEqual(related, []);
  });

  // ── getFileSignature ──────────────────────────────────────────────────

  it('should return file signature with exports, classes, functions, types, imports', async () => {
    const search = new CodebaseSearch();
    await search.buildIndex(tmpDir);
    const sig = search.getFileSignature('src/auth.js');
    assert.ok(sig);
    assert.ok(Array.isArray(sig.exports));
    assert.ok(Array.isArray(sig.classes));
    assert.ok(Array.isArray(sig.functions));
    assert.ok(Array.isArray(sig.types));
    assert.ok(Array.isArray(sig.imports));
    assert.ok(sig.exports.includes('authenticateUser'), 'should include authenticateUser export');
    assert.ok(sig.classes.includes('AuthService'), 'should include AuthService class');
    assert.ok(sig.functions.includes('authenticateUser'), 'should include authenticateUser function');
  });

  it('should return null for unknown file signature', async () => {
    const search = new CodebaseSearch();
    await search.buildIndex(tmpDir);
    const sig = search.getFileSignature('nope.js');
    assert.equal(sig, null);
  });

  // ── getStats ──────────────────────────────────────────────────────────

  it('should return stats with fileCount, tokenCount, avgTokensPerFile, topTerms', async () => {
    const search = new CodebaseSearch();
    await search.buildIndex(tmpDir);
    const stats = search.getStats();
    assert.equal(stats.fileCount, 4);
    assert.ok(stats.tokenCount > 0);
    assert.ok(stats.avgTokensPerFile > 0);
    assert.ok(Array.isArray(stats.topTerms));
  });

  it('should return zero stats before building index', () => {
    const search = new CodebaseSearch();
    const stats = search.getStats();
    assert.equal(stats.fileCount, 0);
    assert.equal(stats.tokenCount, 0);
    assert.equal(stats.avgTokensPerFile, 0);
    assert.deepEqual(stats.topTerms, []);
  });

  // ── Edge cases ────────────────────────────────────────────────────────

  it('should handle buildIndex on an empty directory', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'cs-empty-'));
    try {
      const search = new CodebaseSearch();
      const stats = await search.buildIndex(emptyDir);
      assert.equal(stats.fileCount, 0);
      assert.equal(stats.tokenCount, 0);
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });

  it('should return empty search results on empty index', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'cs-empty2-'));
    try {
      const search = new CodebaseSearch();
      await search.buildIndex(emptyDir);
      const results = search.search('authentication');
      assert.deepEqual(results, []);
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });

  it('search relevance should be one of: very-high, high, medium, low, marginal', async () => {
    const search = new CodebaseSearch();
    await search.buildIndex(tmpDir);
    const results = search.search('password hash crypto');
    const validRelevance = new Set(['very-high', 'high', 'medium', 'low', 'marginal']);
    for (const r of results) {
      assert.ok(validRelevance.has(r.relevance), `unexpected relevance: ${r.relevance}`);
    }
  });
});
