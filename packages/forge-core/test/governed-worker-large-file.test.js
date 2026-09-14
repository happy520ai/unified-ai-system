import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runWithLlmCaller } from '../src/llm-client.js';
import { CoderWorker } from '../src/worker/coder.js';

const OLD = 'export function adjustedTotal(value) { return value - 1; }';
const NEW = 'export function adjustedTotal(value) { return value + 1; }';
const PAGE_MARKER = 'FIRST_PAGE_MARKER_AFTER_FOUR_THOUSAND';
const FIRST_READ = { type: 'read', path: 'large.mjs', offset: 1, limit: 70 };

async function fixture(t) {
  const temporaryRoot = await realpath(tmpdir());
  const root = await mkdtemp(join(temporaryRoot, 'forge-governed-large-'));
  t.after(async () => {
    const owned = await realpath(root);
    assert.equal(dirname(owned), temporaryRoot);
    assert.ok(basename(owned).startsWith('forge-governed-large-'));
    await rm(owned, { recursive: true, force: true });
  });
  const lines = Array.from({ length: 240 }, (_, index) => `// fixture ${String(index).padStart(3, '0')} ${'x'.repeat(90)} 界`);
  lines[0] = 'export const unchangedHeader = "keep header";';
  lines[59] = `// ${PAGE_MARKER}`;
  lines[129] = OLD;
  lines[239] = 'export const untouchedTail = 314159;';
  const original = lines.join('\r\n'), file = join(root, 'large.mjs');
  assert.ok(Buffer.byteLength(original) >= 16 * 1024);
  assert.ok(original.indexOf(PAGE_MARKER) > 4000);
  assert.ok(Buffer.byteLength(original.slice(0, original.indexOf(OLD))) > 8192);
  assert.ok(lines.slice(70, 129).join('\r\n').length > 4000);
  await writeFile(file, original, 'utf8');
  return { root, file, original, lines,
    task: { id: 'large-exact-edit', name: 'Correct the adjustment', type: 'implement',
      prompt: 'Fix adjustedTotal so it increments every numeric input by one; retain all other source bytes.',
      allowed_files: ['large.mjs'] } };
}

function harness(f, next, hooks = {}) {
  const calls = [], before = [], after = [], released = [];
  const worker = new CoderWorker();
  const context = { governanceRequired: true, signal: hooks.signal, governedExecution: {
    async beforeAction(request) {
      before.push(request);
      return { outcome: 'allow', policy: { policyHash: 'large-file-policy' }, approvedParams: request.params,
        executionLease: { release() { released.push(request.toolName); } } };
    },
    async afterAction(receipt) { after.push(receipt); await hooks.afterAction?.(receipt); },
  } };
  return { calls, before, after, released,
    run: () => runWithLlmCaller(async (prompt, system, options) => {
      calls.push({ prompt, system, options });
      const actions = next({ prompt, calls, before, after });
      const text = JSON.stringify(actions);
      assert.ok(Buffer.byteLength(text) < 512, 'the model stub must never regenerate the large file');
      return { text, usage: { inputTokens: 64, outputTokens: 48, totalTokens: 112 } };
    }, () => worker.execute(f.task, f.root, context)),
  };
}

function noFullWriteFallback(calls) {
  for (const { prompt } of calls.slice(1)) {
    assert.doesNotMatch(prompt, /YOUR ONLY JOB:.*"write"|"write" action containing (?:the )?FULL|corrected "write" actions/u);
  }
}

test('governed CoderWorker pages beyond 8 KiB and precisely edits a large real file with small responses', async t => {
  const f = await fixture(t);
  const h = harness(f, ({ prompt, calls }) => {
    if (calls.length === 1) return [FIRST_READ];
    if (calls.length === 2) {
      const nextOffset = /["']?nextOffset["']?\s*:\s*(\d+)/u.exec(prompt)?.[1];
      return nextOffset ? [{ ...FIRST_READ, offset: Number(nextOffset) }] : [];
    }
    if (calls.length === 3 && prompt.includes(OLD)) return [{ type: 'edit', path: 'large.mjs', oldString: OLD, newString: NEW }];
    return [];
  });
  const result = await h.run(), reads = h.after.filter(item => item.actionType === 'read' && item.result);
  assert.equal(reads[0]?.result.totalLines, f.lines.length, 'first read must carry the complete line count');
  assert.deepEqual(reads[0].result.range, { offset: 1, limit: 70 });
  assert.equal(reads[0].result.nextOffset, 71); assert.equal(reads[0].result.truncated, false);
  assert.equal(reads.length, 2); assert.deepEqual(reads[1].result.range, { offset: 71, limit: 70 });
  assert.equal(reads[1].result.nextOffset, 141);
  for (let index = 0; index < reads.length; index++) {
    const { output, range } = reads[index].result;
    assert.ok(Buffer.byteLength(output, 'utf8') <= 8192);
    assert.equal(output, f.lines.slice(range.offset - 1, range.offset - 1 + range.limit).join('\r\n'));
    assert.ok(h.calls[index + 1].prompt.includes(output), 'bounded read context must not be truncated again at 4000 characters');
    assert.equal(reads[index].params.offset, range.offset); assert.equal(reads[index].params.limit, range.limit);
  }
  assert.ok(h.calls[1].prompt.includes(PAGE_MARKER)); assert.ok(h.calls[2].prompt.includes(OLD));
  assert.equal(h.calls.length, 3); noFullWriteFallback(h.calls);
  assert.ok(h.calls.every(call => call.options.maxTokens <= h.calls[0].options.maxTokens && call.options.maxTokens <= 32768));
  assert.deepEqual(h.before.map(item => item.toolName), ['file_read', 'file_read', 'file_edit']);
  assert.deepEqual(h.released, ['file_read', 'file_read', 'file_edit']);
  assert.equal(result.success, true); assert.equal(result.filesModified.length, 1);
  const saved = await readFile(f.file);
  assert.deepEqual(saved, Buffer.from(f.original.replace(OLD, NEW)), 'every unrelated byte, including CRLF and Unicode, must remain intact');
  const module = await import(pathToFileURL(f.file).href);
  for (const value of [0, 41, -4, Number.MAX_SAFE_INTEGER - 1]) assert.equal(module.adjustedTotal(value), value + 1);
  assert.equal(module.unchangedHeader, 'keep header'); assert.equal(module.untouchedTail, 314159);
});

test('governed CoderWorker observes revocation after a read before another model call or mutation', async t => {
  const f = await fixture(t), controller = new AbortController();
  const h = harness(f, () => [FIRST_READ], { signal: controller.signal,
    afterAction(receipt) { if (receipt.actionType === 'read' && receipt.result) controller.abort(new Error('read approval revoked')); },
  });
  await assert.rejects(h.run(), error => error.code === 'FORGE_RUN_ABORTED');
  assert.equal(h.calls.length, 1); assert.deepEqual(h.before.map(item => item.toolName), ['file_read']);
  assert.deepEqual(h.released, ['file_read']); assert.deepEqual(await readFile(f.file), Buffer.from(f.original));
});

test('governed CoderWorker fails an invalid later read range without requesting FULL write or claiming completion', async t => {
  const f = await fixture(t);
  const h = harness(f, ({ calls }) => calls.length === 1 ? [FIRST_READ]
    : calls.length === 2 ? [{ ...FIRST_READ, offset: 0 }] : []);
  let result, failure;
  try { result = await h.run(); } catch (error) { failure = error; }
  assert.ok(failure || result?.success === false);
  assert.equal(failure?.code ?? result.error, 'FORGE_READ_RANGE_INVALID');
  assert.equal(h.calls.length, 2, 'the invalid later range must be requested after a successful first window');
  assert.equal(h.after[0]?.result?.totalLines, f.lines.length);
  noFullWriteFallback(h.calls);
  assert.equal(h.before.some(item => item.toolName === 'file_write' || item.toolName === 'file_edit'), false);
  assert.deepEqual(await readFile(f.file), Buffer.from(f.original));
});

test('governed CoderWorker cannot turn missing read context into a FULL write instruction or completed work', async t => {
  const f = await fixture(t);
  f.task.allowed_files.push('missing.mjs');
  const h = harness(f, ({ calls }) => calls.length === 1 ? [{ ...FIRST_READ, path: 'missing.mjs' }] : []);
  let result, failure;
  try { result = await h.run(); } catch (error) { failure = error; }
  assert.ok(failure || result?.success === false);
  assert.equal(h.calls.length, 1, 'unavailable read context must stop before another model call');
  assert.deepEqual(h.before.map(item => item.toolName), ['file_read']);
  assert.equal(h.after.length, 1); assert.equal(h.after[0].params.file_path, 'missing.mjs');
  assert.equal(h.after[0].error?.code, 'ENOENT');
  noFullWriteFallback(h.calls);
  assert.equal(h.before.some(item => item.toolName === 'file_write' || item.toolName === 'file_edit'), false);
  assert.deepEqual(await readFile(f.file), Buffer.from(f.original));
});

test('governed CoderWorker keeps the existing two-follow-up bound when the model only asks for more reads', async t => {
  const f = await fixture(t), h = harness(f, () => [FIRST_READ]);
  const result = await h.run();
  assert.equal(result.success, false); assert.equal(result.error, 'FORGE_READ_ROUNDS_EXHAUSTED');
  assert.equal(h.calls.length, 3); assert.deepEqual(h.released, ['file_read', 'file_read']);
  assert.deepEqual(h.before.map(item => item.toolName), ['file_read', 'file_read']);
  noFullWriteFallback(h.calls);
  assert.deepEqual(await readFile(f.file), Buffer.from(f.original));
});
