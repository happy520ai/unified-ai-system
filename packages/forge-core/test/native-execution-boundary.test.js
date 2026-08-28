import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { executeAction } from '../src/worker/base-action-exec.js';
import { autoLint } from '../src/worker/base-syntax-utils.js';
import { selfReview } from '../src/worker/base-self-review.js';

const logger = { info() {}, error() {} };
const bashSafety = { check: () => ({ verdict: 'ALLOWED', reason: null }) };

function recordingSandbox(results = {}) {
  const calls = [];
  return {
    calls,
    execute: async (command, options) => {
      calls.push({ command, options });
      return {
        exitCode: 0,
        stdout: 'sandbox-ok',
        stderr: '',
        killed: false,
        killReason: null,
        ...results,
      };
    },
  };
}

describe('Forge native execution boundary', () => {
  it('routes LLM bash through FULL read-only isolation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'forge-bash-boundary-'));
    const sandboxExecutor = recordingSandbox();
    try {
      const result = await executeAction(
        { type: 'bash', command: 'npm test' },
        root,
        { allowed_files: ['**/*'] },
        { logger, bashSafety, incrementalEdit: {}, tools: ['bash'], sandboxExecutor },
      );
      assert.equal(result.output, 'sandbox-ok');
      assert.equal(sandboxExecutor.calls.length, 1);
      assert.equal(sandboxExecutor.calls[0].options.level, 'full');
      assert.equal(sandboxExecutor.calls[0].options.workspaceMode, 'ro');
      assert.equal(sandboxExecutor.calls[0].options.cwd, root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails closed when LLM bash has no isolation backend', async () => {
    const root = await mkdtemp(join(tmpdir(), 'forge-bash-no-backend-'));
    try {
      await assert.rejects(
        executeAction(
          { type: 'bash', command: 'npm test' },
          root,
          { allowed_files: ['**/*'] },
          { logger, bashSafety, incrementalEdit: {}, tools: ['bash'] },
        ),
        /SANDBOX_BACKEND_UNAVAILABLE/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('turns a non-zero sandbox result into an action failure', async () => {
    const root = await mkdtemp(join(tmpdir(), 'forge-bash-failure-'));
    const sandboxExecutor = recordingSandbox({ exitCode: 1, stderr: 'test failed' });
    try {
      await assert.rejects(
        executeAction(
          { type: 'bash', command: 'npm test' },
          root,
          { allowed_files: ['**/*'] },
          { logger, bashSafety, incrementalEdit: {}, tools: ['bash'], sandboxExecutor },
        ),
        /Sandbox command failed/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects writes through a project symlink or Windows junction', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'forge-path-boundary-'));
    const root = join(parent, 'project');
    const outside = join(parent, 'outside');
    await mkdir(root);
    await mkdir(outside);
    await symlink(outside, join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    try {
      await assert.rejects(
        executeAction(
          { type: 'write', path: 'escape/proof.txt', content: 'must not escape\n' },
          root,
          { allowed_files: ['**/*'] },
          { logger, bashSafety, incrementalEdit: {}, tools: ['write'] },
        ),
        /symlink or junction|outside project root/,
      );
      await assert.rejects(readFile(join(outside, 'proof.txt'), 'utf8'), { code: 'ENOENT' });
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it('runs executable ESLint configuration only in a FULL container', async () => {
    const root = await mkdtemp(join(tmpdir(), 'forge-eslint-boundary-'));
    const file = join(root, 'src', 'sample.js');
    const sandboxExecutor = recordingSandbox();
    await mkdir(join(root, 'src'));
    await writeFile(file, 'export const sample = true;\n', 'utf8');
    try {
      await autoLint(file, 'src/sample.js', logger, { projectRoot: root, sandboxExecutor });
      assert.equal(sandboxExecutor.calls.length, 1);
      assert.match(sandboxExecutor.calls[0].command, /^npx --no-install eslint --fix/);
      assert.equal(sandboxExecutor.calls[0].options.level, 'full');
      assert.equal(sandboxExecutor.calls[0].options.workspaceMode, 'rw');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('runs TypeScript self-review only in a FULL read-only container', async () => {
    const root = await mkdtemp(join(tmpdir(), 'forge-tsc-boundary-'));
    const sandboxExecutor = recordingSandbox();
    await mkdir(join(root, 'src'));
    await writeFile(join(root, 'tsconfig.json'), '{}\n', 'utf8');
    await writeFile(join(root, 'src', 'sample.ts'), 'export const sample: boolean = true;\n', 'utf8');
    try {
      const result = await selfReview(root, [{ path: 'src/sample.ts' }], { sandboxExecutor });
      assert.equal(result.valid, true);
      assert.equal(sandboxExecutor.calls.length, 1);
      assert.match(sandboxExecutor.calls[0].command, /^npx --no-install tsc/);
      assert.equal(sandboxExecutor.calls[0].options.level, 'full');
      assert.equal(sandboxExecutor.calls[0].options.workspaceMode, 'ro');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
