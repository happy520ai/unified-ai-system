import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ContainerSandboxBackend } from '../src/sandbox-executor/container-backend.js';

const image = `example.invalid/forge@sha256:${'a'.repeat(64)}`;
const enginePath = process.platform === 'win32' ? 'C:\\Program Files\\Docker\\docker.exe' : '/usr/bin/docker';

function result(overrides = {}) {
  return {
    exitCode: 0,
    stdout: '',
    stderr: '',
    timedOut: false,
    aborted: false,
    truncated: false,
    ...overrides,
  };
}

function fakeEngine({ removeExitCode = 0, timedOut = false } = {}) {
  return async (_executable, args) => {
    if (args[0] === 'version') return result({ stdout: 'linux\n' });
    if (args[0] === 'image') return result({ stdout: `${JSON.stringify([image])}\n` });
    if (args[0] === 'create') return result({ stdout: `${'b'.repeat(64)}\n` });
    if (args[0] === 'start') return result({ exitCode: timedOut ? -1 : 0, timedOut });
    if (args[0] === 'inspect') return result({ stdout: '{"ExitCode":0,"OOMKilled":false}\n' });
    if (args[0] === 'kill') return result({ exitCode: timedOut ? 1 : 0, stderr: timedOut ? 'kill failed' : '' });
    if (args[0] === 'rm') return result({ exitCode: removeExitCode, stderr: removeExitCode ? 'rm failed' : '' });
    throw new Error(`Unexpected container engine command: ${args.join(' ')}`);
  };
}

describe('ContainerSandboxBackend cleanup verdict', () => {
  it('forces a non-zero result when container removal is uncertain', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'forge-container-cleanup-'));
    try {
      const backend = new ContainerSandboxBackend({
        enginePath,
        image,
        workspaceRoots: [workspace],
        runProcess: fakeEngine({ removeExitCode: 1 }),
      });
      const execution = await backend.run({ command: 'true', workspace });
      assert.equal(execution.exitCode, -1);
      assert.equal(execution.killed, true);
      assert.equal(execution.cleanupUncertain, true);
      assert.equal(execution.killReason, 'container cleanup uncertain');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('cannot report success after timeout even when inspect says exit zero', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'forge-container-timeout-'));
    try {
      const backend = new ContainerSandboxBackend({
        enginePath,
        image,
        workspaceRoots: [workspace],
        runProcess: fakeEngine({ timedOut: true }),
      });
      const execution = await backend.run({ command: 'while :; do :; done', workspace, timeoutMs: 10 });
      assert.equal(execution.exitCode, -1);
      assert.equal(execution.killed, true);
      assert.match(execution.killReason, /timeout/);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
