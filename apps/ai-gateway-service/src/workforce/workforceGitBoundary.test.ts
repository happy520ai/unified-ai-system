import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile, rm, utimes, rename, symlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createWorktreeIsolation } from './worktreeIsolation.js';
import { createGitWorkspaceGuard } from './gitWorkspaceGuard.js';

const exec = promisify(execFile);
let root: string;
let repo: string;
let trees: string;
const savedEnvironment = new Map<string, string | undefined>();
function assertCreated<T extends { success: boolean; worktree?: unknown }>(result: T): asserts result is T & { worktree: NonNullable<T['worktree']> } {
  expect(result.success).toBe(true);
  assert(result.worktree);
}
function environment(key: string, value: string) {
  if (!savedEnvironment.has(key)) savedEnvironment.set(key, process.env[key]);
  process.env[key] = value;
}
function git(cwd: string, args: string[]) {
  const env: NodeJS.ProcessEnv = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP']) env[key] = process.env[key];
  env.GIT_CONFIG_NOSYSTEM = '1';
  env.GIT_CONFIG_GLOBAL = process.platform === 'win32' ? 'NUL' : '/dev/null';
  return exec('git', args, { cwd, env });
}
async function makeRepo(path: string) {
  await mkdir(path, { recursive: true });
  await git(path, ['init', '-q', '-b', 'main']);
  await git(path, ['config', 'user.email', 'git-boundary@test']);
  await git(path, ['config', 'user.name', 'git-boundary-test']);
  await writeFile(join(path, 'README.md'), 'initial\n');
  await git(path, ['add', 'README.md']);
  await git(path, ['commit', '-q', '-m', 'initial']);
}
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'uai-workforce-git-'));
  repo = join(root, 'repo');
  trees = join(root, 'trees');
  await makeRepo(repo);
});
afterEach(async () => {
  for (const [key, value] of savedEnvironment) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  savedEnvironment.clear();
  const rel = relative(resolve(tmpdir()), resolve(root));
  if (!rel || rel.startsWith('..') || isAbsolute(rel) || !rel.startsWith('uai-workforce-git-')) throw new Error('unsafe fixture cleanup');
  await rm(root, { recursive: true, force: true });
});

describe('Workforce real Git ownership boundary', () => {
  it('attests only its own current worktree, exact plan and approved baseline', async () => {
    const { assertOwnedWorkforceWorktree } = await import('./worktreeIsolation.js');
    expect(typeof assertOwnedWorkforceWorktree).toBe('function');
    const manager = createWorktreeIsolation({ repoRoot: repo, worktreeRoot: trees });
    const created = await manager.create({ planId: 'attested' });
    assertCreated(created);
    const baselineRevision = (await git(repo, ['rev-parse', 'HEAD'])).stdout.trim();
    const expected = { planId: 'attested', baselineRevision };
    const proof = await assertOwnedWorkforceWorktree(manager, created.worktree.worktreeId, expected);
    expect(proof).toMatchObject({ ...expected, path: created.worktree.path, branch: created.worktree.branch });
    expect(Object.isFrozen(proof)).toBe(true);
    await expect(assertOwnedWorkforceWorktree(manager, created.worktree.worktreeId, { ...expected, planId: 'other-plan' })).rejects.toThrow();
    await expect(assertOwnedWorkforceWorktree(manager, created.worktree.worktreeId, { ...expected, baselineRevision: 'f'.repeat(40) })).rejects.toThrow();
    // @ts-expect-error Missing baseline must also fail at the runtime boundary.
    await expect(assertOwnedWorkforceWorktree(manager, created.worktree.worktreeId, { planId: 'attested' })).rejects.toThrow();
    let forgedCalls = 0;
    await expect(assertOwnedWorkforceWorktree({ assertCurrent() { forgedCalls++; return proof; } }, created.worktree.worktreeId, expected)).rejects.toThrow();
    expect(forgedCalls).toBe(0);
    await writeFile(join(created.worktree.path, 'README.md'), 'candidate edit\n');
    await expect(assertOwnedWorkforceWorktree(manager, created.worktree.worktreeId, expected)).resolves.toMatchObject(expected);
    await git(created.worktree.path, ['add', 'README.md']);
    await git(created.worktree.path, ['commit', '-q', '-m', 'unexpected commit']);
    await expect(assertOwnedWorkforceWorktree(manager, created.worktree.worktreeId, expected)).rejects.toThrow();
    expect((await manager.remove(created.worktree.worktreeId)).success).toBe(true);
    await expect(assertOwnedWorkforceWorktree(manager, created.worktree.worktreeId, expected)).rejects.toThrow();
  });

  it('ignores repository-redirection environment for both checks and creation', async () => {
    const other = join(root, 'other');
    await makeRepo(other);
    await writeFile(join(repo, 'README.md'), 'dirty original\n');
    environment('GIT_DIR', join(other, '.git'));
    environment('GIT_WORK_TREE', other);
    environment('GIT_CONFIG_COUNT', '1');
    environment('GIT_CONFIG_KEY_0', 'core.bare');
    environment('GIT_CONFIG_VALUE_0', 'false');
    const checked = await createGitWorkspaceGuard({ cwd: repo }).check();
    expect(checked.blocked).toBe(true);
    const manager = createWorktreeIsolation({ repoRoot: repo, worktreeRoot: trees });
    const created = await manager.create({ planId: 'redirect', newBranch: 'workforce/redirect-test' });
    assertCreated(created);
    expect((await git(repo, ['branch', '--list', 'workforce/redirect-test'])).stdout).toContain('workforce/redirect-test');
    expect((await git(other, ['branch', '--list', 'workforce/redirect-test'])).stdout.trim()).toBe('');
    expect((await manager.remove(created.worktree.worktreeId)).success).toBe(true);
  });

  it('does not run checkout hooks and refuses local clean/process filters before status or checkout', async () => {
    const marker = join(root, 'hook-ran');
    const hook = join(repo, '.git', 'hooks', 'post-checkout');
    await writeFile(hook, `#!/bin/sh\nprintf hook > '${marker.replaceAll('\\', '/')}'\n`, { mode: 0o700 });
    const manager = createWorktreeIsolation({ repoRoot: repo, worktreeRoot: trees });
    const created = await manager.create({ planId: 'hooks' });
    assertCreated(created);
    expect(existsSync(marker)).toBe(false);
    await manager.remove(created.worktree.worktreeId);
    await git(repo, ['config', 'filter.probe.clean', 'cat']);
    const checked = await createGitWorkspaceGuard({ cwd: repo }).check();
    expect(checked.blocked).toBe(true);
    expect((await createGitWorkspaceGuard({ cwd: repo }).getGitStatus()).success).toBe(false);
    expect((await manager.create({ planId: 'filter' })).success).toBe(false);
  });

  it('cannot redirect removal by mutating create/list/status records', async () => {
    const victim = join(root, 'user-owned');
    await mkdir(victim);
    await writeFile(join(victim, 'keep.txt'), 'keep');
    const manager = createWorktreeIsolation({ repoRoot: repo, worktreeRoot: trees });
    const created = await manager.create({ planId: 'immutable' });
    assertCreated(created);
    const id = created.worktree.worktreeId;
    const ownedPath = created.worktree.path;
    for (const record of [created.worktree, manager.list().worktrees[0], manager.getStatus(id).worktree]) {
      assert(record, "The owned worktree receipt must exist before mutation is attempted.");
      try { Object.assign(record, { path: victim, branch: 'main', createdAt: '2000-01-01T00:00:00.000Z' }); } catch { /* immutable receipt */ }
    }
    const removed = await manager.remove(id);
    expect.soft(existsSync(join(victim, 'keep.txt'))).toBe(true);
    expect(removed.success).toBe(true);
    expect(await readFile(join(victim, 'keep.txt'), 'utf8')).toBe('keep');
    expect(existsSync(ownedPath)).toBe(false);
    expect((await git(repo, ['branch', '--list', 'main'])).stdout).toContain('main');
  });

  it('never scans or deletes unregistered old directories during cleanup', async () => {
    const unknown = join(trees, 'old-user-folder');
    await mkdir(unknown, { recursive: true });
    await writeFile(join(unknown, 'keep.txt'), 'keep');
    await utimes(unknown, new Date(0), new Date(0));
    const manager = createWorktreeIsolation({ repoRoot: repo, worktreeRoot: trees });
    expect(await manager.cleanup(1)).toMatchObject({ success: true, totalCleaned: 0 });
    expect(await readFile(join(unknown, 'keep.txt'), 'utf8')).toBe('keep');
  });

  it('preserves an existing branch and permits an explicitly retained new branch', async () => {
    const manager = createWorktreeIsolation({ repoRoot: repo, worktreeRoot: trees });
    const before = (await git(repo, ['rev-parse', 'main'])).stdout;
    expect((await manager.create({ planId: 'old', newBranch: 'main' })).success).toBe(false);
    expect((await git(repo, ['rev-parse', 'main'])).stdout).toBe(before);
    const created = await manager.create({ planId: 'retain' });
    assertCreated(created);
    expect(await manager.remove(created.worktree.worktreeId, { preserveBranch: true })).toMatchObject({ success: true, branchPreserved: true });
    expect((await git(repo, ['branch', '--list', created.worktree.branch])).stdout).toContain(created.worktree.branch);
  });

  it('retains a locked worktree on cleanup failure and supports a verified retry', async () => {
    const manager = createWorktreeIsolation({ repoRoot: repo, worktreeRoot: trees });
    const created = await manager.create({ planId: 'locked' });
    assertCreated(created);
    await git(repo, ['worktree', 'lock', created.worktree.path]);
    expect(await manager.removeByPlanId('locked')).toMatchObject({ success: false, removedCount: 0 });
    expect(manager.list().count).toBe(1);
    expect(existsSync(created.worktree.path)).toBe(true);
    await git(repo, ['worktree', 'unlock', created.worktree.path]);
    expect(await manager.removeByPlanId('locked')).toMatchObject({ success: true, removedCount: 1 });
    expect(manager.list().count).toBe(0);
  });

  it('refuses filters inherited through a local include without executing them', async () => {
    const config = join(root, 'included-config');
    await writeFile(config, '[filter "probe"]\n\tprocess = never-execute-this\n');
    await git(repo, ['config', 'include.path', config]);
    expect((await createGitWorkspaceGuard({ cwd: repo }).check()).blocked).toBe(true);
    const manager = createWorktreeIsolation({ repoRoot: repo, worktreeRoot: trees });
    expect((await manager.create({ planId: 'included-filter' })).success).toBe(false);
    expect(existsSync(trees)).toBe(false);
  });

  it('does not delete a same-name branch recreated after external removal', async () => {
    const manager = createWorktreeIsolation({ repoRoot: repo, worktreeRoot: trees });
    const created = await manager.create({ planId: 'branch-reused' });
    assertCreated(created);
    await git(repo, ['worktree', 'remove', created.worktree.path]);
    await git(repo, ['branch', '-D', created.worktree.branch]);
    await writeFile(join(repo, 'README.md'), 'user changed branch\n');
    await git(repo, ['add', 'README.md']);
    await git(repo, ['commit', '-q', '-m', 'user change']);
    await git(repo, ['branch', created.worktree.branch, 'HEAD']);
    const expected = (await git(repo, ['rev-parse', created.worktree.branch])).stdout;
    const removed = await manager.remove(created.worktree.worktreeId);
    expect.soft(removed.success).toBe(false);
    expect((await git(repo, ['rev-parse', created.worktree.branch])).stdout).toBe(expected);
    expect(manager.list().count).toBe(1);
  });

  it('supports a linked source worktree and rejects a replaced worktree root before cleanup', async () => {
    const source = join(root, 'linked-source');
    await git(repo, ['worktree', 'add', '-b', 'linked', source, 'HEAD']);
    const manager = createWorktreeIsolation({ repoRoot: source, worktreeRoot: trees });
    const created = await manager.create({ planId: 'linked' });
    assertCreated(created);
    await rename(trees, join(root, 'owned-before-replacement'));
    const replacement = join(root, 'replacement');
    await mkdir(replacement);
    await symlink(replacement, trees, process.platform === 'win32' ? 'junction' : 'dir');
    expect((await manager.removeByPlanId('linked')).success).toBe(false);
    expect(manager.list().count).toBe(1);
    expect(existsSync(join(root, 'owned-before-replacement'))).toBe(true);
  });
});
