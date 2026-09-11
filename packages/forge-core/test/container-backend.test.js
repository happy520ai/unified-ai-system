import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough, Writable } from 'node:stream';

import { ContainerSandboxBackend, runContainerEngineProcess } from '../src/sandbox-executor/container-backend.js';

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

describe('ContainerSandboxBackend bounded stdin', () => {
  it('rejects invalid input before attestation or container effects', async () => {
    let calls = 0;
    const backend = new ContainerSandboxBackend({ enginePath, image, workspaceRoots: [process.cwd()],
      runProcess: async () => { calls += 1; throw new Error('must not run'); },
    });
    for (const stdin of [null, 1, true, {}, Buffer.from('input'), 'a'.repeat(65537), 'é'.repeat(32769)]) {
      await assert.rejects(backend.run({ command: 'true', workspace: process.cwd(), stdin }),
        { code: 'SANDBOX_STDIN_INVALID' });
    }
    assert.equal(calls, 0);
  });

  for (const stdin of [undefined, '', 'é'.repeat(32768)]) {
    it(`routes ${stdin === undefined ? 'absent' : stdin === '' ? 'empty' : '64 KiB UTF-8'} stdin only to start`, async () => {
      const workspace = await mkdtemp(join(tmpdir(), 'forge-container-stdin-'));
      const calls = [];
      const engine = fakeEngine();
      try {
        const backend = new ContainerSandboxBackend({ enginePath, image, workspaceRoots: [workspace],
          runProcess: async (executable, args, options) => {
            calls.push({ args, options });
            if (args[0] === 'start' && stdin !== undefined) return result({ stdinFailed: false });
            return engine(executable, args, options);
          },
        });
        const execution = await backend.run({ command: 'true', workspace, stdin });
        assert.equal(execution.exitCode, 0);
        assert.equal(execution.killed, false);
        assert.equal(Object.hasOwn(execution, 'stdinFailed'), stdin !== undefined);
        assert.equal(Object.hasOwn(execution, 'stdin'), false);
        const create = calls.find(call => call.args[0] === 'create');
        const start = calls.find(call => call.args[0] === 'start');
        assert.equal(create.args.includes('-i'), stdin !== undefined);
        assert.equal(start.args.includes('--interactive'), stdin !== undefined);
        for (const call of calls) {
          assert.equal(Object.hasOwn(call.options, 'stdin'), stdin !== undefined && call === start);
          if (stdin) {
            assert.ok(!JSON.stringify(call.args).includes(stdin));
            assert.ok(!JSON.stringify(call.options.env).includes(stdin));
          }
        }
        assert.equal(start.options.stdin, stdin);
        assert.equal(calls.at(-1).args[0], 'rm');
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });
  }

  for (const scenario of ['failed', 'unverified', 'test-failure']) {
    it(`preserves cleanup and reports ${scenario} conservatively`, async () => {
      const workspace = await mkdtemp(join(tmpdir(), 'forge-container-stdin-verdict-'));
      const commands = [];
      const engine = fakeEngine();
      try {
        const backend = new ContainerSandboxBackend({ enginePath, image, workspaceRoots: [workspace],
          runProcess: async (executable, args, options) => {
            commands.push(args[0]);
            if (args[0] === 'start') return result({
              ...(scenario === 'unverified' ? {} : { stdinFailed: scenario === 'failed' }),
              exitCode: scenario === 'test-failure' ? 1 : 0,
            });
            if (args[0] === 'inspect' && scenario === 'test-failure') {
              return result({ stdout: '{"Running":false,"ExitCode":1,"OOMKilled":false}' });
            }
            return engine(executable, args, options);
          },
        });
        const execution = await backend.run({ command: 'true', workspace, stdin: 'ephemeral-input' });
        const failedDelivery = scenario !== 'test-failure';
        assert.equal(execution.exitCode, failedDelivery ? -1 : 1);
        assert.equal(execution.stdinFailed, failedDelivery);
        assert.equal(execution.killed, failedDelivery);
        assert.equal(execution.killReason, failedDelivery ? 'stdin delivery failed' : null);
        assert.equal(execution.cleanupUncertain, false);
        assert.equal(commands.includes('kill'), failedDelivery);
        assert.equal(commands.at(-1), 'rm');
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });
  }
});

describe('runContainerEngineProcess stdin transport', () => {
  it('validates the UTF-8 cap before spawning', (t) => {
    let calls = 0;
    t.mock.method(childProcess, 'spawn', () => { calls += 1; throw new Error('must not spawn'); });
    syncBuiltinESMExports();
    try {
      for (const stdin of [null, {}, Buffer.from('input'), 'é'.repeat(32769)]) {
        assert.throws(() => runContainerEngineProcess(process.execPath, [], { stdin }),
          { code: 'SANDBOX_STDIN_INVALID' });
      }
      assert.equal(calls, 0);
    } finally {
      t.mock.restoreAll();
      syncBuiltinESMExports();
    }
  });

  it('writes exact bounded UTF-8 bytes and ends the pipe without returning input', async () => {
    const stdin = 'é'.repeat(32768);
    const script = "const c=require('node:crypto').createHash('sha256');process.stdin.on('data',b=>c.update(b));process.stdin.on('end',()=>process.stdout.write(c.digest('hex')));";
    const execution = await runContainerEngineProcess(process.execPath, ['-e', script], { stdin });
    assert.equal(execution.exitCode, 0);
    assert.equal(execution.stdinFailed, false);
    assert.equal(execution.stdout, createHash('sha256').update(stdin, 'utf8').digest('hex'));
    assert.equal(execution.stderr, '');
    assert.ok(!JSON.stringify(execution).includes(stdin));
  });

  it('retains absent stdin behavior and treats explicit empty stdin as delivered', async () => {
    for (const stdin of [undefined, '']) {
      const execution = await runContainerEngineProcess(process.execPath,
        ['-e', "process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('ended'));"], { stdin });
      assert.equal(execution.exitCode, 0);
      assert.equal(execution.stdout, 'ended');
      assert.equal(Object.hasOwn(execution, 'stdinFailed'), stdin !== undefined);
      if (stdin !== undefined) assert.equal(execution.stdinFailed, false);
    }
  });

  for (const scenario of ['EPIPE', 'premature-close', 'throw', 'abort', 'process-error']) {
    it(`handles stdin ${scenario} without exposing stream error text or reporting success`, async (t) => {
      const controller = new AbortController();
      const input = 'never-include-this-input-in-a-diagnostic';
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.stdin = new Writable({ write(_chunk, _encoding, callback) {
        if (scenario === 'EPIPE') process.nextTick(() => callback(Object.assign(new Error(input), { code: 'EPIPE' })));
        if (scenario === 'premature-close') process.nextTick(() => child.stdin.destroy());
        if (scenario === 'abort') process.nextTick(() => controller.abort());
        if (scenario === 'process-error') callback();
      } });
      if (scenario === 'process-error') child.stdin.once('finish', () => child.emit('error', new Error(input)));
      if (scenario === 'throw') child.stdin.end = () => { throw new Error(input); };
      let killed = false;
      child.kill = () => {
        if (!killed) process.nextTick(() => child.emit('close', 0));
        killed = true;
      };
      t.mock.method(childProcess, 'spawn', (_executable, args, options) => {
        assert.deepEqual(options.stdio, ['pipe', 'pipe', 'pipe']);
        assert.ok(!JSON.stringify(args).includes(input));
        assert.ok(!JSON.stringify(options.env).includes(input));
        return child;
      });
      syncBuiltinESMExports();
      try {
        const execution = await runContainerEngineProcess(process.execPath, [], { stdin: input, signal: controller.signal });
        assert.equal(execution.exitCode, -1);
        assert.equal(execution.stdinFailed, true);
        assert.equal(execution.aborted, scenario === 'abort');
        assert.equal(killed, true);
        assert.ok(!JSON.stringify(execution).includes(input));
      } finally {
        t.mock.restoreAll();
        syncBuiltinESMExports();
      }
    });
  }
});
