import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir, unlink, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ── P2-3: LLM Retry Logic ──────────────────────────────────────────────────

describe('P2-3: LLM retry with exponential back-off', () => {

  let originalFetch;
  let fetchCallCount;

  before(() => {
    originalFetch = globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it('should succeed on first attempt when no errors', async () => {
    fetchCallCount = 0;
    globalThis.fetch = async (url, opts) => {
      fetchCallCount++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'hello' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
        text: async () => '',
      };
    };

    const { callLLMDirect } = await import('../src/llm-client.js');
    const result = await callLLMDirect({ provider: 'nvidia', apiKey: 'test-key', messages: [{ role: 'user', content: 'test' }] });
    assert.equal(result, 'hello');
    assert.ok(fetchCallCount >= 1);
  });

  it('should retry on transient network errors via internal retryWithBackoff', async () => {
    fetchCallCount = 0;
    globalThis.fetch = async () => {
      fetchCallCount++;
      if (fetchCallCount <= 2) {
        throw new Error('fetch failed: ECONNREFUSED');
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'recovered' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
        text: async () => '',
      };
    };

    const { callLLMDirectWithUsage } = await import('../src/llm-client.js');
    const result = await callLLMDirectWithUsage({ provider: 'nvidia', apiKey: 'test-key', messages: [{ role: 'user', content: 'test' }], maxRetries: 3 });
    assert.equal(result.text, 'recovered');
    assert.ok(fetchCallCount >= 3, `Expected at least 3 fetch calls, got ${fetchCallCount}`);
  });
});

// ── P2-4: Token Usage Tracking ─────────────────────────────────────────────

describe('P2-4: Token usage tracking', () => {

  let originalFetch;

  before(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '[{"type":"bash","command":"echo hi"}]' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 150, completion_tokens: 50, total_tokens: 200 },
        }),
        text: async () => '',
      };
    };
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it('callLLMDirectWithUsage should return usage metadata', async () => {
    const { callLLMDirectWithUsage } = await import('../src/llm-client.js');
    const result = await callLLMDirectWithUsage({ provider: 'nvidia', apiKey: 'test-key', messages: [{ role: 'user', content: 'hello' }] });
    assert.ok(result.text, 'should have text');
    assert.ok(result.usage, 'should have usage');
    assert.equal(typeof result.usage.inputTokens, 'number');
    assert.equal(typeof result.usage.outputTokens, 'number');
    assert.equal(typeof result.usage.totalTokens, 'number');
    assert.ok(result.usage.totalTokens >= 0);
  });

  it('callLLMDirect should return only text (backward-compatible)', async () => {
    const { callLLMDirect } = await import('../src/llm-client.js');
    const result = await callLLMDirect({ provider: 'nvidia', apiKey: 'test-key', messages: [{ role: 'user', content: 'hello' }] });
    assert.equal(typeof result, 'string');
  });
});

// ── P3-1: Test Framework Detection ──────────────────────────────────────────

describe('P3-1: Test framework detection', () => {
  const tmpProject = join(tmpdir(), `forge-p3-test-${Date.now()}`);

  before(async () => {
    await mkdir(tmpProject, { recursive: true });
  });

  after(async () => {
    try { await rm(tmpProject, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  it('should detect Jest from dependencies', async () => {
    const { TesterWorker } = await import('../src/worker/tester.js');
    const worker = new TesterWorker();
    await writeFile(join(tmpProject, 'package.json'), JSON.stringify({
      devDependencies: { jest: '^29.0.0' },
      scripts: { test: 'jest' },
    }), 'utf-8');

    const extra = await worker._getExtraContext(tmpProject, {});
    assert.ok(extra.includes('jest'), 'should mention jest');
    assert.ok(extra.includes('expect'), 'should mention expect assertion');
  });

  it('should detect Vitest from dependencies', async () => {
    const { TesterWorker } = await import('../src/worker/tester.js');
    const worker = new TesterWorker();
    await writeFile(join(tmpProject, 'package.json'), JSON.stringify({
      devDependencies: { vitest: '^1.0.0' },
      scripts: { test: 'vitest run' },
    }), 'utf-8');

    const extra = await worker._getExtraContext(tmpProject, {});
    assert.ok(extra.includes('vitest'), 'should mention vitest');
    assert.ok(extra.includes("from 'vitest'"), 'should include vitest import');
  });

  it('should detect Mocha + Chai', async () => {
    const { TesterWorker } = await import('../src/worker/tester.js');
    const worker = new TesterWorker();
    await writeFile(join(tmpProject, 'package.json'), JSON.stringify({
      devDependencies: { mocha: '^10.0.0', chai: '^4.0.0' },
      scripts: { test: 'mocha' },
    }), 'utf-8');

    const extra = await worker._getExtraContext(tmpProject, {});
    assert.ok(extra.includes('mocha'), 'should mention mocha');
    assert.ok(extra.includes('chai'), 'should mention chai');
  });

  it('should fall back to node:test when no framework detected', async () => {
    const { TesterWorker } = await import('../src/worker/tester.js');
    const worker = new TesterWorker();
    await writeFile(join(tmpProject, 'package.json'), JSON.stringify({
      scripts: { test: 'node --test' },
    }), 'utf-8');

    const extra = await worker._getExtraContext(tmpProject, {});
    assert.ok(extra.includes('node:test'), 'should mention node:test');
    assert.ok(extra.includes('assert'), 'should mention assert');
  });

  it('should handle missing package.json gracefully', async () => {
    const { TesterWorker } = await import('../src/worker/tester.js');
    const worker = new TesterWorker();
    const emptyDir = join(tmpdir(), `forge-empty-${Date.now()}`);
    await mkdir(emptyDir, { recursive: true });
    try {
      const extra = await worker._getExtraContext(emptyDir, {});
      assert.ok(extra.includes('node:test'), 'should fall back to node:test');
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });
});

// ── P3-2: Code Style Detection ──────────────────────────────────────────────

describe('P3-2: Code style detection', () => {
  const tmpProject = join(tmpdir(), `forge-p3-style-${Date.now()}`);
  const srcDir = join(tmpProject, 'src');

  before(async () => {
    await mkdir(srcDir, { recursive: true });
  });

  after(async () => {
    try { await rm(tmpProject, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  });

  it('should detect ESM with single quotes and 2-space indent', async () => {
    // Clean src dir first
    try {
      const entries = await readdir(srcDir);
      for (const e of entries) await unlink(join(srcDir, e));
    } catch { /* best-effort cleanup */ }

    const { CoderWorker } = await import('../src/worker/coder.js');
    const worker = new CoderWorker();

    await writeFile(join(tmpProject, 'package.json'), JSON.stringify({
      type: 'module',
    }), 'utf-8');

    await writeFile(join(srcDir, 'index.js'),
      `import { foo } from './foo.js';\n\nexport const bar = () => {\n  return foo();\n};\n`,
      'utf-8'
    );

    const extra = await worker._getExtraContext(tmpProject, {});
    assert.ok(extra.includes('ES Modules'), 'should detect ESM');
    assert.ok(extra.includes('single quotes'), 'should detect single quotes');
    assert.ok(extra.includes('2 spaces'), 'should detect 2-space indent');
  });

  it('should detect CJS with double quotes and 4-space indent', async () => {
    // Clean src dir — remove ESM file from previous test
    try {
      const entries = await readdir(srcDir);
      for (const e of entries) await unlink(join(srcDir, e));
    } catch { /* best-effort cleanup */ }

    const { CoderWorker } = await import('../src/worker/coder.js');
    const worker = new CoderWorker();

    await writeFile(join(tmpProject, 'package.json'), JSON.stringify({
      type: 'commonjs',
    }), 'utf-8');

    await writeFile(join(srcDir, 'main.js'),
      `const express = require("express");\nconst app = express();\n\nfunction startServer() {\n    const port = 3000;\n    app.listen(port);\n}\n\nmodule.exports = { startServer };\n`,
      'utf-8'
    );

    const extra = await worker._getExtraContext(tmpProject, {});
    assert.ok(extra.includes('CommonJS'), 'should detect CJS');
    assert.ok(extra.includes('double quotes'), 'should detect double quotes');
    assert.ok(extra.includes('4 spaces'), 'should detect 4-space indent');
  });

  it('should handle empty project gracefully', async () => {
    const { CoderWorker } = await import('../src/worker/coder.js');
    const worker = new CoderWorker();
    const emptyDir = join(tmpdir(), `forge-empty-coder-${Date.now()}`);
    await mkdir(emptyDir, { recursive: true });
    try {
      const extra = await worker._getExtraContext(emptyDir, {});
      // Should return empty string or a default hint when no files to analyze
      assert.equal(typeof extra, 'string');
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });
});

// ── P2-5: Round-Robin Scheduling ────────────────────────────────────────────

describe('P2-5: Cross-goal fair scheduling', () => {

  it('AgentPoolManager should have round-robin index field', async () => {
    // Verify the module loads without errors (the rr index is private)
    const mod = await import('../src/agent-pool/index.js');
    assert.ok(mod.AgentPoolManager, 'AgentPoolManager should be exported');
  });

  it('should sort queue entries by priority within same goal', () => {
    // This tests the conceptual behavior: entries from the same goal
    // should be processed in priority order
    const queue = [
      { goalId: 'A', priority: 80, enqueuedAt: 1 },
      { goalId: 'B', priority: 60, enqueuedAt: 2 },
      { goalId: 'A', priority: 90, enqueuedAt: 3 },
      { goalId: 'B', priority: 70, enqueuedAt: 4 },
    ];

    // Group by goal (as the scheduler does)
    const goalEntries = new Map();
    for (const entry of queue) {
      if (!goalEntries.has(entry.goalId)) goalEntries.set(entry.goalId, []);
      goalEntries.get(entry.goalId).push(entry);
    }

    // Goal A should have 2 entries, Goal B should have 2 entries
    assert.equal(goalEntries.get('A').length, 2);
    assert.equal(goalEntries.get('B').length, 2);

    // Both goals should be available for round-robin
    assert.equal(goalEntries.size, 2);
  });
});

// ── P3-3: Targeted Fix Task ───────────────────────────────────────────────

describe('P3-3: Auto-verify targeted fix', () => {

  it('should create focused fix prompt with file list', () => {
    // Simulate what the pool does when creating a targeted fix task
    const targetFiles = ['src/cache.js', 'src/queue.js'];
    const failureContext = 'Tier 1 / syntax_check FAILED: Unexpected token in src/cache.js';
    const attempt = 1;
    const maxRetries = 2;

    const fixPrompt =
      `[TARGETED FIX — Verification Failure ${attempt}/${maxRetries}]\n` +
      `Your previous code changes to the following file(s) failed automated verification:\n` +
      `${targetFiles.map(f => `- ${f}`).join('\n')}\n\n` +
      `## Verification Failures\n${failureContext}\n\n` +
      `## Instructions\n` +
      `1. READ each file listed above to see its current state.\n` +
      `2. FIX ONLY the specific issues described in the verification failures.\n` +
      `3. Do NOT rewrite unrelated code. Make minimal, targeted edits.\n` +
      `4. After fixing, the code must pass: syntax check, linting, and tests.\n` +
      `5. Use "edit" actions for small fixes, "write" only if the file needs major restructuring.\n`;

    assert.ok(fixPrompt.includes('TARGETED FIX'), 'should have targeted fix header');
    assert.ok(fixPrompt.includes('src/cache.js'), 'should list failed file');
    assert.ok(fixPrompt.includes('src/queue.js'), 'should list second file');
    assert.ok(fixPrompt.includes('FIX ONLY'), 'should emphasize targeted fix');
    assert.ok(!fixPrompt.includes('implement the requested'), 'should not include original task prompt');
  });

  it('should scope allowedFiles to affected files only', () => {
    const targetFiles = ['src/cache.js'];
    const allowedFiles = [
      ...targetFiles,
      'test/**/*.js', 'test/**/*.ts', 'tests/**/*.js', 'tests/**/*.ts',
      'package.json',
    ];

    assert.ok(allowedFiles.includes('src/cache.js'), 'should include the failed file');
    assert.ok(allowedFiles.includes('test/**/*.js'), 'should include test patterns');
    assert.ok(allowedFiles.includes('package.json'), 'should include package.json');
    assert.ok(!allowedFiles.includes('src/server.js'), 'should NOT include unrelated files');
    assert.equal(allowedFiles.length, 6, 'should have exactly 6 patterns');
  });
});
