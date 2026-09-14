import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, open, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { executeAction, createForgeActionGovernanceRequest, applyApprovedForgeActionParams } from '../src/worker/base-action-exec.js';

async function fixture(t, content = 'one\ntwo\nthree\nfour') {
  const parent = await realpath(tmpdir()), root = await mkdtemp(join(parent, 'forge-readable-edit-'));
  t.after(async () => {
    assert.equal(await realpath(root), root); assert.equal(dirname(root), parent);
    await rm(root, { recursive: true, force: false });
  });
  const path = join(root, 'fixture.txt'); await writeFile(path, content);
  const state = { before: [], after: [], released: 0, approvedParams: undefined };
  const opts = { logger: { info() {}, error() {} }, tools: ['read', 'write', 'edit'], governanceRequired: true,
    governedExecution: {
      async beforeAction(request) {
        state.before.push(request);
        return { outcome: 'allow', policy: {}, executionLease: { release() { state.released++; } },
          ...(state.approvedParams === undefined ? {} : { approvedParams: state.approvedParams }) };
      },
      async assertActive() {}, async afterAction(event) { state.after.push(event); },
    } };
  const run = (action, override = {}) => executeAction(action, root, { allowedFiles: ['fixture.txt'] }, { ...opts, ...override });
  return { root, path, state, opts, run };
}

test('read ranges survive the governance mapper and approved argument reconstruction', () => {
  const request = createForgeActionGovernanceRequest({ action: { type: 'read', path: 'fixture.txt', offset: 3, limit: 2 },
    projectRoot: process.cwd(), relativePath: 'fixture.txt' });
  assert.deepEqual(request.params, { file_path: 'fixture.txt', offset: 3, limit: 2 });
  assert.deepEqual(applyApprovedForgeActionParams('read', request.params, process.cwd()),
    { type: 'read', path: 'fixture.txt', offset: 3, limit: 2 });
});

test('governed reads return the exact requested complete line window and metadata', async t => {
  const f = await fixture(t);
  assert.deepEqual(await f.run({ type: 'read', path: 'fixture.txt', offset: 2, limit: 2 }), {
    modified: false, output: 'two\nthree', totalLines: 4, range: { offset: 2, limit: 2 }, nextOffset: 4, truncated: false,
  });
});

test('governed edit refuses ambiguous source without writing', async t => {
  const f = await fixture(t, 'same\nsame');
  await assert.rejects(f.run({ type: 'edit', path: 'fixture.txt', oldString: 'same', newString: 'changed' }),
    { code: 'FORGE_EDIT_SOURCE_AMBIGUOUS' });
  assert.equal(await readFile(f.path, 'utf8'), 'same\nsame');
});

test('governed edit treats dollar replacement syntax as literal text', async t => {
  const f = await fixture(t, 'before TARGET after');
  await f.run({ type: 'edit', path: 'fixture.txt', oldString: 'TARGET', newString: '$&/$1/$$' });
  assert.equal(await readFile(f.path, 'utf8'), 'before $&/$1/$$ after');
});

test('the final approved range replaces the originally requested range', async t => {
  const f = await fixture(t); f.state.approvedParams = { file_path: 'fixture.txt', offset: 3, limit: 1 };
  const result = await f.run({ type: 'read', path: 'fixture.txt', offset: 1, limit: 2 });
  assert.equal(result.output, 'three'); assert.deepEqual(result.range, { offset: 3, limit: 1 });
  assert.deepEqual(f.state.before[0].params, { file_path: 'fixture.txt', offset: 1, limit: 2 });
  assert.deepEqual(f.state.after[0].params, f.state.approvedParams); assert.equal(f.state.released, 1);
});

for (const key of ['offset', 'limit']) {
  for (const value of [0, -1, 1.5, NaN, Infinity, '2', null]) {
    test(`invalid read ${key}=${String(value)} is refused before authorization`, async t => {
      const f = await fixture(t);
      await assert.rejects(f.run({ type: 'read', path: 'fixture.txt', [key]: value }), { code: 'FORGE_READ_RANGE_INVALID' });
      assert.equal(f.state.before.length, 0);
    });
  }
}

test('an invalid range in approved parameters is refused before reading', async t => {
  const f = await fixture(t); f.state.approvedParams = { file_path: 'fixture.txt', offset: 0, limit: 2 };
  await assert.rejects(f.run({ type: 'read', path: 'fixture.txt', offset: 1, limit: 1 }), { code: 'FORGE_APPROVED_PARAMS_INVALID' });
  assert.equal(f.state.after[0].error.code, 'FORGE_APPROVED_PARAMS_INVALID'); assert.equal(f.state.released, 1);
});

test('an offset beyond EOF fails while a final page returns its actual line count', async t => {
  const f = await fixture(t);
  await assert.rejects(f.run({ type: 'read', path: 'fixture.txt', offset: 5 }), { code: 'FORGE_READ_RANGE_OUT_OF_BOUNDS' });
  assert.deepEqual(await f.run({ type: 'read', path: 'fixture.txt', offset: 3, limit: Number.MAX_SAFE_INTEGER }), {
    modified: false, output: 'three\nfour', totalLines: 4, range: { offset: 3, limit: 2 }, nextOffset: null, truncated: false,
  });
});

test('read windows preserve CRLF within complete lines and exclude their final delimiter', async t => {
  const f = await fixture(t, 'first\r\nsecond\r\nthird\r\nfourth');
  const result = await f.run({ type: 'read', path: 'fixture.txt', offset: 2, limit: 2 });
  assert.equal(result.output, 'second\r\nthird'); assert.deepEqual(result.range, { offset: 2, limit: 2 });
  assert.equal(result.nextOffset, 4); assert.equal(result.truncated, false);
});

test('UTF-8 byte limits produce whole-line continuation metadata without silent truncation', async t => {
  const first = '界'.repeat(2730), f = await fixture(t, first + '\nok');
  const page = await f.run({ type: 'read', path: 'fixture.txt' });
  assert.equal(page.output, first); assert.equal(Buffer.byteLength(page.output), 8190);
  assert.deepEqual(page.range, { offset: 1, limit: 1 }); assert.equal(page.nextOffset, 2); assert.equal(page.truncated, true);
  const tail = await f.run({ type: 'read', path: 'fixture.txt', offset: page.nextOffset });
  assert.equal(tail.output, 'ok'); assert.equal(tail.nextOffset, null); assert.equal(tail.truncated, false);
});

test('an exactly 8 KiB line succeeds and a longer UTF-8 line explicitly fails', async t => {
  const exact = '界'.repeat(2730) + 'ab', f = await fixture(t, exact);
  assert.equal((await f.run({ type: 'read', path: 'fixture.txt' })).output, exact);
  await writeFile(f.path, exact + 'c');
  await assert.rejects(f.run({ type: 'read', path: 'fixture.txt' }), { code: 'FORGE_READ_LINE_TOO_LARGE' });
});

test('governed reads reject files over 10 MiB before interpreting their bytes', async t => {
  const f = await fixture(t), handle = await open(f.path, 'w');
  try { await handle.truncate(10 * 1024 * 1024 + 1); } finally { await handle.close(); }
  await assert.rejects(f.run({ type: 'read', path: 'fixture.txt', offset: 1, limit: 1 }), { code: 'FORGE_READ_FILE_TOO_LARGE' });
});

test('the 10 MiB file boundary permits a small first-line window', async t => {
  const bytes = Buffer.alloc(10 * 1024 * 1024, 0x61); bytes.write('ok\n');
  const f = await fixture(t, bytes), result = await f.run({ type: 'read', path: 'fixture.txt', offset: 1, limit: 1 });
  assert.equal(result.output, 'ok'); assert.equal(result.totalLines, 2); assert.equal(result.nextOffset, 2);
  assert.equal(result.truncated, false);
});

for (const [name, bytes] of [['invalid UTF-8', Buffer.from([0xc3, 0x28])], ['NUL', Buffer.from('safe\0unsafe')]]) {
  test(`governed reads refuse ${name}`, async t => {
    const f = await fixture(t, bytes);
    await assert.rejects(f.run({ type: 'read', path: 'fixture.txt' }), { code: 'FORGE_READ_FILE_INVALID' });
  });
}

test('missing governed reads fail through before/after hooks instead of suggesting a write', async t => {
  const f = await fixture(t); await rm(f.path);
  await assert.rejects(f.run({ type: 'read', path: 'fixture.txt' }), { code: 'ENOENT' });
  assert.equal(f.state.before.length, 1); assert.equal(f.state.after[0].error.code, 'ENOENT');
  assert.equal(f.state.after[0].result, undefined); assert.equal(f.state.released, 1);
});

for (const [name, content, oldString, code] of [
  ['empty source', 'unchanged', '', 'FORGE_EDIT_PARAMS_INVALID'],
  ['absent source', 'unchanged', 'missing', 'FORGE_EDIT_SOURCE_NOT_FOUND'],
  ['overlapping matches', 'aaa', 'aa', 'FORGE_EDIT_SOURCE_AMBIGUOUS'],
  ['whitespace mismatch', '  return value;', '\treturn value;', 'FORGE_EDIT_SOURCE_NOT_FOUND'],
]) {
  test(`strict governed edit rejects ${name} with original bytes intact`, async t => {
    const f = await fixture(t, content);
    await assert.rejects(f.run({ type: 'edit', path: 'fixture.txt', oldString, newString: 'replacement' }), { code });
    assert.equal(await readFile(f.path, 'utf8'), content);
  });
}

test('a governance hook alone enables exact editing even without governanceRequired', async t => {
  const f = await fixture(t, 'same same');
  await assert.rejects(f.run({ type: 'edit', path: 'fixture.txt', oldString: 'same', newString: 'replacement' },
    { governanceRequired: false }), { code: 'FORGE_EDIT_SOURCE_AMBIGUOUS' });
  assert.equal(await readFile(f.path, 'utf8'), 'same same');
});

test('the approved edit text is used literally rather than the original action payload', async t => {
  const f = await fixture(t, 'alpha TARGET omega');
  f.state.approvedParams = { file_path: 'fixture.txt', old_string: 'TARGET', new_string: '$& approved', allow_multiple: false };
  await f.run({ type: 'edit', path: 'fixture.txt', oldString: 'alpha', newString: 'unapproved' });
  assert.equal(await readFile(f.path, 'utf8'), 'alpha $& approved omega');
  assert.deepEqual(f.state.after[0].params, f.state.approvedParams);
});

test('a later window of a file larger than 16 KiB supports an edit with all outside bytes preserved', async t => {
  const lines = Array.from({ length: 520 }, (_, index) => `line-${String(index + 1).padStart(3, '0')}: stable text outside the intended change`);
  lines[360] = 'unique-target: old value';
  const original = lines.join('\r\n'), f = await fixture(t, original);
  assert.ok(Buffer.byteLength(original) > 16384);
  const window = await f.run({ type: 'read', path: 'fixture.txt', offset: 351, limit: 20 });
  assert.equal(window.output, lines.slice(350, 370).join('\r\n')); assert.equal(window.nextOffset, 371);
  const replacement = 'unique-target: $& literal new value', expected = original.replace('unique-target: old value', () => replacement);
  const result = await f.run({ type: 'edit', path: 'fixture.txt', oldString: 'unique-target: old value', newString: replacement });
  assert.equal(result.modified, true);
  const actual = await readFile(f.path);
  assert.ok(actual.equals(Buffer.from(expected)));
  assert.equal(createHash('sha256').update(actual).digest('hex'), createHash('sha256').update(expected).digest('hex'));
  assert.equal(f.state.released, 2);
});

test('write corruption fails verification and cannot publish modified=true', async t => {
  const f = await fixture(t, 'original TARGET text'), handle = await open(f.path, 'r');
  const prototype = Object.getPrototypeOf(handle), originalWrite = prototype.writeFile;
  await handle.close();
  t.mock.method(prototype, 'writeFile', async function () { return originalWrite.call(this, 'corrupted', 'utf8'); });
  await assert.rejects(f.run({ type: 'edit', path: 'fixture.txt', oldString: 'TARGET', newString: 'new' }), { code: 'FORGE_EDIT_VERIFY_FAILED' });
  assert.equal(f.state.after[0].result, undefined); assert.equal(f.state.after[0].error.code, 'FORGE_EDIT_VERIFY_FAILED');
  assert.equal(f.state.released, 1);
});

test('path escape and approved path escape are rejected without modifying the owned file', async t => {
  const f = await fixture(t, 'original');
  await assert.rejects(f.run({ type: 'read', path: '../outside.txt', offset: 1, limit: 1 }), /Path traversal blocked/);
  f.state.approvedParams = { file_path: '../outside.txt', offset: 1, limit: 1 };
  await assert.rejects(f.run({ type: 'read', path: 'fixture.txt' }), /Path traversal blocked/);
  assert.equal(await readFile(f.path, 'utf8'), 'original');
});

test('symlink or junction components cannot be read through the governed path', async t => {
  const f = await fixture(t), nested = join(f.root, 'nested'); await mkdir(nested); await writeFile(join(nested, 'fixture.txt'), 'owned target');
  await symlink(nested, join(f.root, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(f.run({ type: 'read', path: 'alias/fixture.txt' }), /symlink|junction/);
});

test('cancellation before authorization and before the effect leaves the file unchanged', async t => {
  const f = await fixture(t, 'original TARGET text'), controller = new AbortController();
  controller.abort(new Error('fixture cancelled'));
  await assert.rejects(f.run({ type: 'edit', path: 'fixture.txt', oldString: 'TARGET', newString: 'changed' },
    { signal: controller.signal }), { code: 'FORGE_RUN_ABORTED' });
  assert.equal(f.state.before.length, 0);
  const later = new AbortController(), authorize = f.opts.governedExecution.beforeAction;
  f.opts.governedExecution.beforeAction = async request => { const result = await authorize(request); later.abort(); return result; };
  await assert.rejects(f.run({ type: 'edit', path: 'fixture.txt', oldString: 'TARGET', newString: 'changed' },
    { signal: later.signal }), { code: 'FORGE_RUN_ABORTED' });
  assert.equal(await readFile(f.path, 'utf8'), 'original TARGET text'); assert.equal(f.state.released, 1);
});

test('a denied commit fence blocks the edit before writing', async t => {
  const f = await fixture(t, 'original TARGET text');
  f.opts.governedExecution.assertActive = async () => { throw Object.assign(new Error('fixture fence revoked'), { code: 'FIXTURE_FENCED' }); };
  await assert.rejects(f.run({ type: 'edit', path: 'fixture.txt', oldString: 'TARGET', newString: 'changed' }), { code: 'FIXTURE_FENCED' });
  assert.equal(await readFile(f.path, 'utf8'), 'original TARGET text'); assert.equal(f.state.released, 1);
});

test('unparameterized non-governed reads retain their existing compatibility behavior', async t => {
  const content = 'x'.repeat(9000), f = await fixture(t, content);
  const result = await f.run({ type: 'read', path: 'fixture.txt' }, { governanceRequired: false, governedExecution: null });
  assert.deepEqual(result, { modified: false, output: content.slice(0, 8000) });
  await rm(f.path);
  const missing = await f.run({ type: 'read', path: 'fixture.txt' }, { governanceRequired: false, governedExecution: null });
  assert.match(missing.output, /Use "write" action to create/);
});
