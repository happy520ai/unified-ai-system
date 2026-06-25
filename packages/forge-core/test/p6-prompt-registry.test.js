import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';

// ═══════════════════════════════════════════════════════════════════════════════
//  2. PromptRegistry
// ═══════════════════════════════════════════════════════════════════════════════

describe('PromptRegistry', () => {
  let PromptRegistry;
  const testDir = join(tmpdir(), `forge-test-pr-${Date.now()}`);
  const persistPath = join(testDir, 'prompts.json');

  before(async () => {
    const mod = await import('../src/prompt-registry/index.js');
    PromptRegistry = mod.PromptRegistry;
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // ── Constructor ──────────────────────────────────────────────────────────

  it('should construct with default options', () => {
    const reg = new PromptRegistry();
    assert.equal(reg.persistencePath, null);
    const status = reg.getStatus();
    assert.equal(status.roles, 0);
    assert.equal(status.totalVersions, 0);
    assert.equal(status.activeVersions, 0);
  });

  it('should accept persistencePath option', () => {
    const reg = new PromptRegistry({ persistencePath: '/tmp/test.json' });
    assert.equal(reg.persistencePath, '/tmp/test.json');
  });

  // ── register() ───────────────────────────────────────────────────────────

  it('should register a prompt and auto-set version 1', () => {
    const reg = new PromptRegistry();
    const result = reg.register('coder', 'You are an expert coder.');
    assert.equal(result.role, 'coder');
    assert.equal(result.version, 1);
    assert.ok(result.id.startsWith('pr_'));
  });

  it('should auto-increment version numbers', () => {
    const reg = new PromptRegistry();
    const r1 = reg.register('coder', 'Version one');
    const r2 = reg.register('coder', 'Version two');
    const r3 = reg.register('coder', 'Version three');
    assert.equal(r1.version, 1);
    assert.equal(r2.version, 2);
    assert.equal(r3.version, 3);
  });

  it('should set first version as active by default', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'First version');
    const active = reg.getActive('coder');
    assert.ok(active);
    assert.equal(active.version, 1);
  });

  it('should not auto-set subsequent versions as active', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'First version');
    reg.register('coder', 'Second version');
    const active = reg.getActive('coder');
    assert.equal(active.version, 1, 'Active should still be version 1');
  });

  it('should allow forcing setAsActive on register', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'First version');
    reg.register('coder', 'Second version', { setAsActive: true });
    const active = reg.getActive('coder');
    assert.equal(active.version, 2);
  });

  it('should accept description, author, and tags', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'Content here', {
      description: 'Initial prompt',
      author: 'Alice',
      tags: ['production', 'v1'],
    });
    const entry = reg.get('coder', 1);
    assert.equal(entry.description, 'Initial prompt');
    assert.equal(entry.author, 'Alice');
    assert.deepEqual(entry.tags, ['production', 'v1']);
  });

  it('should throw when role is missing', () => {
    const reg = new PromptRegistry();
    assert.throws(() => reg.register('', 'content'), /role/i);
    assert.throws(() => reg.register(null, 'content'), /role/i);
  });

  it('should throw when content is not a string', () => {
    const reg = new PromptRegistry();
    assert.throws(() => reg.register('coder', 123), /content/i);
    assert.throws(() => reg.register('coder', null), /content/i);
  });

  // ── get() / getActive() ──────────────────────────────────────────────────

  it('should return null for non-existent role', () => {
    const reg = new PromptRegistry();
    assert.equal(reg.get('nonexistent', 1), null);
    assert.equal(reg.getActive('nonexistent'), null);
  });

  it('should return null for non-existent version', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'Version one');
    assert.equal(reg.get('coder', 99), null);
  });

  // ── setActive() ──────────────────────────────────────────────────────────

  it('should set a specific version as active', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'Version one');
    reg.register('coder', 'Version two');
    const ok = reg.setActive('coder', 2);
    assert.equal(ok, true);
    assert.equal(reg.getActive('coder').version, 2);
  });

  it('should return false for non-existent version in setActive', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'Version one');
    const ok = reg.setActive('coder', 99);
    assert.equal(ok, false);
  });

  // ── list() / listRoles() ─────────────────────────────────────────────────

  it('should list all versions for a role (without full content)', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'Long prompt text here', { description: 'v1' });
    reg.register('coder', 'Another long prompt', { description: 'v2' });
    const list = reg.list('coder');
    assert.equal(list.length, 2);
    assert.ok(!('content' in list[0]), 'list entries should not include content');
    assert.ok('contentLength' in list[0]);
    assert.equal(list[0].contentLength, 'Long prompt text here'.length);
  });

  it('should return empty array for unknown role in list()', () => {
    const reg = new PromptRegistry();
    assert.deepEqual(reg.list('unknown'), []);
  });

  it('should list all registered roles', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'Coder prompt');
    reg.register('reviewer', 'Reviewer prompt');
    reg.register('tester', 'Tester prompt');
    const roles = reg.listRoles();
    assert.ok(roles.includes('coder'));
    assert.ok(roles.includes('reviewer'));
    assert.ok(roles.includes('tester'));
    assert.equal(roles.length, 3);
  });

  // ── recordMetric() / compareVersions() ───────────────────────────────────

  it('should record metrics for a version', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'Version one');
    reg.recordMetric('coder', 1, { success: true, quality: 85, tokenUsage: 1200, duration: 500 });
    const entry = reg.get('coder', 1);
    assert.equal(entry.metrics.length, 1);
    assert.equal(entry.metrics[0].quality, 85);
    assert.equal(entry.metrics[0].success, true);
    assert.equal(entry.metrics[0].tokenUsage, 1200);
  });

  it('should not throw when recording metric for non-existent version', () => {
    const reg = new PromptRegistry();
    // Should silently do nothing
    reg.recordMetric('coder', 99, { success: true, quality: 50 });
  });

  it('should compare metrics between two versions', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'Version one');
    reg.register('coder', 'Version two');

    reg.recordMetric('coder', 1, { success: true, quality: 80, tokenUsage: 1000, duration: 400 });
    reg.recordMetric('coder', 1, { success: false, quality: 60, tokenUsage: 1500, duration: 600 });

    reg.recordMetric('coder', 2, { success: true, quality: 90, tokenUsage: 900, duration: 300 });
    reg.recordMetric('coder', 2, { success: true, quality: 95, tokenUsage: 800, duration: 250 });

    const cmp = reg.compareVersions('coder', 1, 2);
    assert.ok(cmp.v1);
    assert.ok(cmp.v2);
    assert.equal(cmp.v1.uses, 2);
    assert.equal(cmp.v2.uses, 2);
    assert.equal(cmp.v1.avgQuality, 70);
    assert.equal(cmp.v2.avgQuality, 92.5);
    assert.equal(cmp.v1.successRate, 0.5);
    assert.equal(cmp.v2.successRate, 1.0);
  });

  // ── getBestVersion() ─────────────────────────────────────────────────────

  it('should return best version by quality', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'V1');
    reg.register('coder', 'V2');
    reg.recordMetric('coder', 1, { success: true, quality: 70 });
    reg.recordMetric('coder', 2, { success: true, quality: 95 });
    const best = reg.getBestVersion('coder', 'quality');
    assert.equal(best.version, 2);
  });

  it('should return best version by tokens (lower is better)', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'V1');
    reg.register('coder', 'V2');
    reg.recordMetric('coder', 1, { success: true, quality: 80, tokenUsage: 500 });
    reg.recordMetric('coder', 2, { success: true, quality: 80, tokenUsage: 2000 });
    const best = reg.getBestVersion('coder', 'tokens');
    assert.equal(best.version, 1);
  });

  it('should return best version by duration (lower is better)', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'V1');
    reg.register('coder', 'V2');
    reg.recordMetric('coder', 1, { success: true, quality: 80, duration: 1000 });
    reg.recordMetric('coder', 2, { success: true, quality: 80, duration: 200 });
    const best = reg.getBestVersion('coder', 'duration');
    assert.equal(best.version, 2);
  });

  it('should return null when no versions have metrics', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'V1');
    const best = reg.getBestVersion('coder', 'quality');
    assert.equal(best, null);
  });

  // ── delete() ─────────────────────────────────────────────────────────────

  it('should delete a version and return true', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'V1');
    reg.register('coder', 'V2');
    const ok = reg.delete('coder', 1);
    assert.equal(ok, true);
    assert.equal(reg.get('coder', 1), null);
    assert.equal(reg.list('coder').length, 1);
  });

  it('should clear active pointer when deleting active version', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'V1');
    assert.equal(reg.getActive('coder').version, 1);
    reg.delete('coder', 1);
    assert.equal(reg.getActive('coder'), null);
  });

  it('should return false when deleting non-existent version', () => {
    const reg = new PromptRegistry();
    assert.equal(reg.delete('coder', 1), false);
  });

  // ── rollback() ───────────────────────────────────────────────────────────

  it('should rollback to the previous version', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'V1');
    reg.register('coder', 'V2', { setAsActive: true });
    assert.equal(reg.getActive('coder').version, 2);
    const prev = reg.rollback('coder');
    assert.ok(prev);
    assert.equal(prev.version, 1);
    assert.equal(reg.getActive('coder').version, 1);
  });

  it('should return null when rolling back with only one version', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'V1');
    const result = reg.rollback('coder');
    assert.equal(result, null);
  });

  it('should return null for non-existent role in rollback', () => {
    const reg = new PromptRegistry();
    assert.equal(reg.rollback('nonexistent'), null);
  });

  // ── getStatus() ──────────────────────────────────────────────────────────

  it('should return accurate status', () => {
    const reg = new PromptRegistry();
    reg.register('coder', 'V1');
    reg.register('coder', 'V2');
    reg.register('reviewer', 'R1');
    const status = reg.getStatus();
    assert.equal(status.roles, 2);
    assert.equal(status.totalVersions, 3);
    assert.equal(status.activeVersions, 2);
  });

  // ── save() / load() persistence ──────────────────────────────────────────

  it('should save and load registry state to/from file', async () => {
    const reg = new PromptRegistry({ persistencePath: persistPath });
    reg.register('coder', 'Persisted prompt V1', { author: 'Bob' });
    reg.register('coder', 'Persisted prompt V2', { setAsActive: true });
    reg.recordMetric('coder', 1, { success: true, quality: 80 });

    const saveResult = await reg.save();
    assert.equal(saveResult.saved, true);
    assert.equal(saveResult.path, persistPath);

    const reg2 = new PromptRegistry({ persistencePath: persistPath });
    const loadResult = await reg2.load();
    assert.equal(loadResult.loaded, true);
    assert.equal(loadResult.entries, 2);

    const active = reg2.getActive('coder');
    assert.ok(active);
    assert.equal(active.version, 2);
    assert.equal(active.content, 'Persisted prompt V2');

    const v1 = reg2.get('coder', 1);
    assert.equal(v1.metrics.length, 1);
    assert.equal(v1.author, 'Bob');
  });

  it('should return loaded false when file does not exist', async () => {
    const reg = new PromptRegistry({ persistencePath: join(testDir, 'nonexistent.json') });
    const result = await reg.load();
    assert.equal(result.loaded, false);
    assert.equal(result.entries, 0);
  });

  it('should return saved false when no persistence path', async () => {
    const reg = new PromptRegistry();
    const result = await reg.save();
    assert.equal(result.saved, false);
    assert.equal(result.path, null);
  });

  // ── maxVersionsPerRole eviction ──────────────────────────────────────────

  it('should evict oldest versions when exceeding maxVersionsPerRole', () => {
    const reg = new PromptRegistry({ maxVersionsPerRole: 3 });
    reg.register('coder', 'V1');
    reg.register('coder', 'V2', { setAsActive: true });
    reg.register('coder', 'V3');
    reg.register('coder', 'V4');
    const list = reg.list('coder');
    assert.ok(list.length <= 3, `Should have at most 3 versions, got ${list.length}`);
  });
});
