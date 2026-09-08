import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

test('native C++ requires a current exact-file exception and never inherits a broad path exception', async () => {
  const prefix = resolve(tmpdir(), 'language-native-policy-');
  const root = await mkdtemp(prefix);
  const env = Object.fromEntries(['PATH', 'SystemRoot', 'WINDIR', 'ComSpec', 'PATHEXT', 'TEMP', 'TMP']
    .filter(name => process.env[name] !== undefined).map(name => [name, process.env[name]]));
  env.GIT_CONFIG_NOSYSTEM = '1'; env.GIT_CONFIG_GLOBAL = process.platform === 'win32' ? 'NUL' : '/dev/null';
  const git = args => execFileSync('git', ['-C', root, ...args], { env, stdio: 'pipe' });
  const invoke = () => {
    const result = spawnSync(process.execPath, [join(root, 'tools/check-language-policy.mjs'), '--base', 'HEAD~1', '--head', 'HEAD', '--json'], { env, encoding: 'utf8' });
    assert.equal(result.error, undefined); return { status: result.status, data: JSON.parse(result.stdout) };
  };
  try {
    await mkdir(join(root, 'tools')); await mkdir(join(root, 'apps', 'native'), { recursive: true });
    await copyFile(join(dirname(fileURLToPath(import.meta.url)), 'check-language-policy.mjs'), join(root, 'tools/check-language-policy.mjs'));
    git(['init', '-q']);
    const commit = message => git(['-c', 'user.name=Policy fixture', '-c', 'user.email=fixture@example.invalid',
      'commit', '--no-gpg-sign', '--allow-empty', '-qm', message]);
    commit('baseline');
    await writeFile(join(root, 'apps/native/approved.cpp'), '// bounded fixture\n');
    await writeFile(join(root, 'apps/native/unapproved.cpp'), '// bounded fixture\n');
    git(['add', '--', 'apps/native/approved.cpp', 'apps/native/unapproved.cpp']); commit('native source fixture');
    const policy = async exceptions => writeFile(join(root, 'tools/language-policy-allowlist.json'), JSON.stringify({ exceptions }));
    const exception = { type: 'file', value: 'apps/native/approved.cpp', justification: 'Measured native API boundary fixture',
      owner: 'test-fixture', removalBy: '2099-01-01', migrationPlan: 'Reassess this exact native boundary', issueId: 'TEST-NATIVE-1' };
    await policy([]);
    const absent = invoke(); assert.equal(absent.status, 1); assert.equal(absent.data.violations.length, 2);
    await policy([exception]);
    const exact = invoke(); assert.equal(exact.status, 1);
    assert.deepEqual(exact.data.allowed.map(item => item.file), ['apps/native/approved.cpp']);
    assert.deepEqual(exact.data.violations.map(item => item.file), ['apps/native/unapproved.cpp']);
    await policy([{ ...exception, type: 'pathPrefix', value: 'apps/native/' }]);
    const broad = invoke(); assert.equal(broad.status, 1); assert.equal(broad.data.allowed.length, 0); assert.equal(broad.data.violations.length, 2);
    await policy([{ ...exception, type: 'fileSet', value: 'bounded-pair', files: ['apps/native/approved.cpp', 'apps/native/unapproved.cpp'] }]);
    const pair = invoke(); assert.equal(pair.status, 0); assert.equal(pair.data.allowed.length, 2); assert.equal(pair.data.violations.length, 0);
    await policy([{ ...exception, removalBy: '2000-01-01' }]);
    const expired = invoke(); assert.equal(expired.status, 1); assert.equal(expired.data.ok, false); assert.equal(expired.data.allowlistIssues.some(item => item.includes('expired')), true);
  } finally {
    const target = resolve(root);
    assert.equal(target.startsWith(prefix) && dirname(target) + sep === resolve(tmpdir()) + sep, true);
    await rm(target, { recursive: true, force: true });
  }
});
