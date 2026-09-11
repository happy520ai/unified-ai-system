import { constants, closeSync, fstatSync, lstatSync, openSync, readSync, opendirSync, realpathSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { devNull } from 'node:os';

const STAGES = ['critical-js', 'typecheck', 'mcp-management', 'windows-client-boundaries'];
const STATUSES = new Set(['passed', 'failed', 'skipped', 'not_run']);
const REASONS = new Set(['pending', 'completion_not_confirmed', 'command_interrupted', 'command_failed',
  'tests_failed_or_not_executed', 'command_or_report_invalid', 'prior_stage_not_passed',
  'prerequisites_not_completed', 'windows_required', 'git_state_changed_during_validation',
  'validation_incomplete', 'temporary_cleanup_unconfirmed']);
const RUN = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SHA = /^[a-f0-9]{40}$/;
type Source = { head: string | null; worktree: 'clean' | 'dirty' | 'unknown' };
type Environment = { platform: string; arch: string; nodeVersion: string };
type Expected = Environment & { source: Source; now: number };
const record = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value ? Date.parse(value) : NaN;
const safeSource = (value: any): Source => ({ head: typeof value?.head === 'string' && SHA.test(value.head) ? value.head : null,
  worktree: ['clean', 'dirty'].includes(value?.worktree) ? value.worktree : 'unknown' });
const safeReason = (value: unknown) => value == null ? null : REASONS.has(String(value)) ? String(value) : 'unrecognized_reason';

/** Local, unsigned producer claims; never a release approval or running-server identity. */
export function summarizeWindowsVerification(value: unknown, runId: string, expected: Expected) {
  const invalid = () => ({ runId, status: 'invalid', assessment: 'schema_invalid' });
  const parts = RUN.exec(runId);
  const runDate = parts ? `${parts[1]}T${parts[2]}:${parts[3]}:${parts[4]}.${parts[5]}Z` : '';
  if (!RUN.test(runId) || !record(value) || ![1, 2].includes(value.schemaVersion) || value.runId !== runId
      || (value.schemaVersion === 2 && value.profileId !== 'windows-local-v1')
      || !Number.isFinite(date(runDate)) || (value.schemaVersion === 2 && value.startedAt !== runDate)
      || !STATUSES.has(value.status) || !Array.isArray(value.stages) || value.stages.length !== 4
      || !['win32', 'linux', 'darwin'].includes(value.platform) || !['x64', 'arm64', 'ia32'].includes(value.arch)
      || typeof value.nodeVersion !== 'string' || value.nodeVersion.length > 32 || !/^v\d+\.\d+\.\d+$/.test(value.nodeVersion)
      || (value.scratchRetained !== undefined && typeof value.scratchRetained !== 'boolean')
      || (value.schemaVersion === 2 && (!record(value.cleanup) || typeof value.cleanup.confirmed !== 'boolean'))
      || (value.status === 'passed' && (value.reason != null || value.scratchRetained === true))) return invalid();
  const started = date(value.startedAt); const finished = date(value.finishedAt);
  if (!Number.isFinite(started) || (value.finishedAt != null && (!Number.isFinite(finished) || finished < started))) return invalid();
  const stages = [];
  for (let index = 0; index < 4; index++) {
    const stage = value.stages[index];
    if (!record(stage) || stage.id !== STAGES[index] || !STATUSES.has(stage.status)
        || !(stage.exitCode === null || Number.isSafeInteger(stage.exitCode))
        || (stage.cleanupUnconfirmed !== undefined && typeof stage.cleanupUnconfirmed !== 'boolean')
        || (stage.status === 'passed' && stage.reason != null)) return invalid();
    let counts = null;
    if (stage.counts != null) {
      const c = stage.counts;
      if (!record(c) || !['total', 'passed', 'failed', 'skipped'].every(k => Number.isSafeInteger(c[k]) && c[k] >= 0)
          || c.total !== c.passed + c.failed + c.skipped || c.total === 0) return invalid();
      counts = { total: c.total, passed: c.passed, failed: c.failed, skipped: c.skipped };
    }
    if (stage.status === 'passed' && (stage.exitCode !== 0 || stage.cleanupUnconfirmed === true
        || (index < 2 ? counts !== null : !counts || counts.failed !== 0 || counts.passed === 0))) return invalid();
    stages.push({ id: stage.id, status: stage.status, exitCode: stage.exitCode, counts, reason: safeReason(stage.reason) });
  }
  if (value.status === 'passed' && stages.some(s => s.status !== 'passed')) return invalid();
  const source = safeSource(value.source); const sourceAfter = safeSource(value.sourceAfter);
  const hasSkippedTests = stages.some(s => (s.counts?.skipped ?? 0) > 0);
  const cleanup = value.schemaVersion === 2 && value.cleanup?.confirmed === true
    && value.scratchRetained !== true && value.stages.every((s: any) => s.cleanupUnconfirmed !== true) ? 'confirmed' : 'unconfirmed';
  const assessment = !Number.isFinite(finished) ? 'not_finished'
    : started > expected.now + 300_000 || finished > expected.now + 300_000 ? 'future_timestamp'
    : source.worktree !== 'clean' || sourceAfter.worktree !== 'clean' || expected.source.worktree !== 'clean' ? 'source_not_clean'
    : !source.head || source.head !== sourceAfter.head || source.head !== expected.source.head ? 'source_mismatch'
    : value.platform !== 'win32' || value.platform !== expected.platform || value.arch !== expected.arch
      || value.nodeVersion !== expected.nodeVersion ? 'environment_mismatch'
    : value.coverage?.realProviderCallsMade !== false ? 'execution_scope_unconfirmed'
    : cleanup !== 'confirmed' ? 'cleanup_unconfirmed'
    : expected.now - finished > 86_400_000 ? 'stale'
    : value.status !== 'passed' ? 'run_not_passed'
    : hasSkippedTests ? 'tests_skipped' : 'current_scoped_pass';
  return { runId, status: value.status, assessment, source, sourceAfter,
    environment: { platform: value.platform, arch: value.arch, nodeVersion: value.nodeVersion },
    startedAt: value.startedAt, finishedAt: Number.isFinite(finished) ? value.finishedAt : null,
    cleanup, hasSkippedTests, reason: safeReason(value.reason), stages,
    realProviderCallsMade: value.coverage?.realProviderCallsMade === false ? false : null };
}

export function readVerificationSource(repoRoot: string): Source {
  const env: Record<string, string> = { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : devNull, GIT_OPTIONAL_LOCKS: '0' };
  for (const key of Object.keys(process.env)) {
    if (/^(PATH|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT)$/i.test(key) && process.env[key]) env[key] = process.env[key];
  }
  const git = (args: string[]) => {
    const result = spawnSync('git', ['-c', 'core.fsmonitor=false', ...args], { cwd: repoRoot, env,
      encoding: 'utf8', windowsHide: true, timeout: 10_000, maxBuffer: 1_048_576 });
    if (result.error || result.status !== 0) throw new Error('source_unavailable');
    return result.stdout.trim();
  };
  try {
    const head = git(['rev-parse', 'HEAD']);
    const dirty = git(['status', '--porcelain=v1', '--', '.', ':(top,literal,exclude).mcp.json', ':(glob,exclude)**/.env*']);
    return { head: SHA.test(head) ? head : null, worktree: dirty ? 'dirty' : 'clean' };
  } catch { return { head: null, worktree: 'unknown' }; }
}

const sameIdentity = (a: any, b: any) => a.dev === b.dev && a.ino === b.ino && a.size === b.size
  && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;

export function readWindowsVerificationHistory(repoRoot: string, expected: Expected) {
  const result: any = { schema: 'unified-ai-system/verification-history/v1', ok: false, status: 'missing',
    profile: 'windows-local-v1', sourceReference: 'local-checkout', source: expected.source,
    environment: { platform: expected.platform, arch: expected.arch, nodeVersion: expected.nodeVersion },
    freshnessHours: 24, trust: 'local-unsigned-summary', runningDeploymentVerified: false,
    latest: null, runs: [], nextAction: 'Run pnpm verify:windows from a clean checkout on Windows.' };
  try {
    const root = realpathSync(repoRoot);
    const parts = ['apps', 'ai-gateway-service', 'evidence', 'windows-validation'];
    const ancestors: { path: string; stat: any }[] = [];
    let directory = root;
    for (const part of parts) {
      directory = join(directory, part);
      let stat;
      try { stat = lstatSync(directory); } catch (error: any) { if (error.code === 'ENOENT') return result; throw error; }
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('unsafe_path');
      ancestors.push({ path: directory, stat });
    }
    const checkDirectories = () => {
      for (const entry of ancestors) {
        const now = lstatSync(entry.path);
        if (!now.isDirectory() || now.isSymbolicLink() || now.dev !== entry.stat.dev || now.ino !== entry.stat.ino)
          throw new Error('unsafe_path');
      }
    };
    const entries = []; const listing = opendirSync(directory);
    try {
      let entry;
      while ((entry = listing.readSync())) {
        if (entries.length === 100 || !RUN.test(entry.name)) throw new Error('inventory_invalid');
        entries.push(entry);
      }
    } finally { listing.closeSync(); }
    for (const entry of entries.sort((a, b) => b.name.localeCompare(a.name))) {
      let fd: number | undefined;
      try {
        if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('unsafe_path');
        const folder = join(directory, entry.name); const folderBefore = lstatSync(folder);
        if (!folderBefore.isDirectory() || folderBefore.isSymbolicLink()) throw new Error('unsafe_path');
        const file = join(folder, 'result.json'); const before = lstatSync(file);
        if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > 262_144) throw new Error('unsafe_file');
        checkDirectories();
        fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
        if (!sameIdentity(before, fstatSync(fd))) throw new Error('file_changed');
        const bytes = Buffer.alloc(262_145); let length = 0; let count;
        while ((count = readSync(fd, bytes, length, bytes.length - length, null)) > 0 && length < bytes.length) length += count;
        const after = fstatSync(fd); const atPath = lstatSync(file); const folderAfter = lstatSync(folder);
        checkDirectories();
        if (length > 262_144 || length !== before.size || !sameIdentity(before, after) || !sameIdentity(before, atPath)
            || atPath.isSymbolicLink() || atPath.nlink !== 1 || folderAfter.isSymbolicLink()
            || folderBefore.dev !== folderAfter.dev || folderBefore.ino !== folderAfter.ino) throw new Error('file_changed');
        const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length)));
        result.runs.push(summarizeWindowsVerification(data, entry.name, expected));
      } catch { result.runs.push({ runId: entry.name, status: 'invalid', assessment: 'summary_unavailable_or_invalid' }); }
      finally { if (fd !== undefined) closeSync(fd); }
    }
    checkDirectories();
    result.latest = result.runs[0] ?? null;
    result.status = result.latest?.assessment ?? 'missing';
    result.ok = result.status === 'current_scoped_pass';
    if (result.ok) result.nextAction = 'Review retained failures and skipped counts; this scoped result is not release approval.';
  } catch { result.status = 'evidence_path_or_inventory_invalid'; }
  return result;
}
