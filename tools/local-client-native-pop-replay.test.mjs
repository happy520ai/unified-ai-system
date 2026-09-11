import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const exec = promisify(execFile);
const script = join(dirname(fileURLToPath(import.meta.url)), 'local-client-native-pop-replay.mjs');
const marker = 'PRIVATE_FIXTURE_MARKER';
function safeEnvironment() {
  const env = {};
  for (const name of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP']) {
    if (process.env[name]) env[name] = process.env[name];
  }
  return env;
}
async function run(args, cwd, extraEnv = {}) {
  try { return { code: 0, ...await exec(process.execPath, [script, ...args], { cwd, env: { ...safeEnvironment(), ...extraEnv } }) }; }
  catch (error) { return { code: error.code, stdout: String(error.stdout ?? ''), stderr: String(error.stderr ?? '') }; }
}

test('native replay enrollment help does not materialize configured secrets', async () => {
  const result = await run(['--help'], dirname(script), { AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_REGISTRY_INTEGRITY_SECRET_REF: marker });
  assert.equal(result.code, 0); assert.match(result.stdout, /enroll-baseline --yes/);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(marker));
});

test('native replay command rejects missing authorization and bad configuration without creating storage', async () => {
  const base = realpathSync(tmpdir()), root = mkdtempSync(join(base, 'uai-native-pop-cli-'));
  const database = join(root, 'replay.sqlite');
  try {
    const native = { AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_STORE_MODE: 'sqlite', AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_PROTECTION_MODE: 'windows-native',
      AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH: database, AI_GATEWAY_LOCAL_CLIENT_HOST_ID: 'cli-fixture-host',
      AI_GATEWAY_LOCAL_CLIENT_NATIVE_AUTHORITY_ADDON_PATH: join(root, 'local-client-authority.node'),
      AI_GATEWAY_LOCAL_CLIENT_NATIVE_AUTHORITY_ADDON_SHA256: 'a'.repeat(64),
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_REGISTRY_INTEGRITY_SECRET_REF: marker };
    const cases = [
      [[], {}], [['enroll-baseline'], native], [['enroll-baseline', '--yes', '--force'], native],
      [['enroll-baseline', '--yes'], {}], [['enroll-baseline', '--yes'], { ...native, AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_STORE_MODE: 'memory' }],
      [['enroll-baseline', '--yes'], { ...native, AI_GATEWAY_LOCAL_CLIENT_NATIVE_AUTHORITY_ADDON_SHA256: marker }],
      [['enroll-baseline', '--yes'], { ...native, AI_GATEWAY_PROVIDER_DISPATCH_SQLITE_PATH: database }],
      [['enroll-baseline', '--yes'], native],
    ];
    for (const [args, env] of cases) {
      const result = await run(args, root, env);
      assert.equal(result.code, 1);
      assert.deepEqual(JSON.parse(result.stdout), { success: false, operation: 'enroll-baseline',
        code: 'LOCAL_CLIENT_NATIVE_POP_ENROLLMENT_REJECTED', outcome: 'not-started',
        message: 'Verify the explicit configuration and inspect existing state before retrying. No state reset or automatic retry was performed.' });
      assert.doesNotMatch(result.stdout + result.stderr, new RegExp(marker));
      for (const path of [database, database + '-wal', database + '-shm']) assert.equal(existsSync(path), false);
    }
  } finally {
    const child = relative(base, resolve(root));
    assert.ok(child.startsWith('uai-native-pop-cli-') && !child.startsWith('..') && !isAbsolute(child));
    rmSync(root, { recursive: true, force: true });
  }
});
