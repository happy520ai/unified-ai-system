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
    if (args[0] === 'inspect') return result({ stdout: '{"Running":false,"ExitCode":0,"OOMKilled":false}\n' });
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

describe('ContainerSandboxBackend ambiguous lifecycle', () => {
  for (const scenario of ['create-timeout', 'inspect-missing', 'inspect-running', 'truncated']) {
    it(`does not report success for ${scenario} and always attempts removal`, async () => {
      const workspace = await mkdtemp(join(tmpdir(), 'forge-container-lifecycle-'));
      const commands = [];
      const engine = fakeEngine();
      try {
        const backend = new ContainerSandboxBackend({ enginePath, image, workspaceRoots: [workspace],
          runProcess: async (executable, args, options) => {
            commands.push(args[0]);
            if (scenario === 'create-timeout' && args[0] === 'create') return result({ exitCode: -1, timedOut: true });
            if (scenario === 'inspect-missing' && args[0] === 'inspect') return result({ exitCode: 1 });
            if (scenario === 'inspect-running' && args[0] === 'inspect') return result({ stdout: '{"Running":true,"ExitCode":0}' });
            if (scenario === 'truncated' && args[0] === 'start') return result({ truncated: true });
            return engine(executable, args, options);
          },
        });
        if (scenario === 'create-timeout') {
          await assert.rejects(backend.run({ command: 'true', workspace }), (error) =>
            error.code === 'SANDBOX_CREATE_FAILED' && error.cleanupUncertain === false);
          assert.ok(!commands.includes('start'));
        } else {
          const execution = await backend.run({ command: 'true', workspace });
          if (scenario === 'truncated') assert.equal(execution.truncated, true);
          else assert.notEqual(execution.exitCode, 0);
        }
        assert.ok(commands.includes('rm'));
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });
  }
});

describe('ContainerSandboxBackend cancellation and daemon output', () => {
  for (const cancelAt of ['version', 'create']) {
    it(`refuses start after cancellation during ${cancelAt}`, async () => {
      const workspace = await mkdtemp(join(tmpdir(), 'forge-container-cancel-'));
      const controller = new AbortController();
      const commands = [];
      const engine = fakeEngine();
      try {
        const backend = new ContainerSandboxBackend({ enginePath, image, workspaceRoots: [workspace],
          runProcess: async (executable, args, options) => {
            commands.push(args);
            if (args[0] === cancelAt) controller.abort();
            return engine(executable, args, options);
          },
        });
        await assert.rejects(backend.run({ command: 'true', workspace, signal: controller.signal }),
          { code: 'SANDBOX_ABORTED' });
        assert.ok(!commands.some(args => args[0] === 'start'));
        if (cancelAt === 'create') {
          assert.ok(commands.some(args => args[0] === 'rm'));
          const createArgs = commands.find(args => args[0] === 'create');
          assert.equal(createArgs[createArgs.indexOf('--log-driver') + 1], 'none');
        }
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });
  }
});
