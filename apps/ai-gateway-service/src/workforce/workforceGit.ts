import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

/** Internal Git boundary for the Workforce guard and owned worktree manager. */
export function createWorkforceGit(repoRoot: string) {
  const disabledHooks = resolve(repoRoot, '.git', `.workforce-disabled-hooks-${randomUUID()}`);
  const prefix = [
    '-c', `core.hooksPath=${disabledHooks}`,
    '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false',
    '-c', 'submodule.recurse=false', '-c', 'protocol.allow=never',
  ];
  async function run(args: string[], timeout = 30_000) {
    const env: NodeJS.ProcessEnv = {};
    for (const key of ['PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'LANG', 'LC_ALL']) {
      if (process.env[key]) env[key] = process.env[key];
    }
    env.GIT_CONFIG_NOSYSTEM = '1';
    env.GIT_CONFIG_GLOBAL = process.platform === 'win32' ? 'NUL' : '/dev/null';
    env.GIT_TERMINAL_PROMPT = '0';
    return exec('git', [...prefix, ...args], { cwd: repoRoot, env, timeout, maxBuffer: 10 * 1024 * 1024 });
  }
  async function assertSafe() {
    // Include repository/worktree config and local includes. Read names only;
    // status itself may invoke a clean filter before any checkout occurs.
    try {
      const { stdout } = await run(['config', '--includes', '--name-only', '--get-regexp', '^(filter\\.|core\\.attributesfile$)']);
      if (stdout.trim()) throw new Error('Workforce refuses Git checkout filter or external attribute configuration.');
    } catch (error) {
      if ((error as { code?: unknown })?.code !== 1) throw error;
    }
  }
  return Object.freeze({ run, assertSafe });
}
