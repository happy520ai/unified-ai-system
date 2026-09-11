// Optional Windows integration check: the "codex.exe" fixture is an owned byte-for-byte Node copy, never the native Codex application.
import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createExternalRunnerProcess, readExternalRunnerProcessLiveness, readExternalRunnerProcessOwner,
  readExternalRunnerOwnerLiveness } from '../apps/ai-gateway-service/src/workforce/workforceExternalRunnerProcess.ts';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..'), evidenceRoot = join(repo, 'apps/ai-gateway-service/evidence/product-final');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const assert = (value, code) => { if (!value) throw new Error(code); };
const inside = (path, root) => { const part = relative(root, path); return part !== '' && part !== '..' && !part.startsWith('..' + sep) && !isAbsolute(part); };
const delay = ms => new Promise(done => setTimeout(done, ms));
let outputDir, failure;
try {
  assert(process.platform === 'win32' && process.arch === 'x64', 'NATIVE_PROCESS_TEST_PLATFORM_UNSUPPORTED');
  let buildDir;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; ++i) {
    if (args[i] === '--build-dir' && !buildDir && args[i + 1]) buildDir = args[++i];
    else if (args[i] === '--output-dir' && !outputDir && args[i + 1]) outputDir = args[++i];
    else assert(false, 'NATIVE_PROCESS_TEST_ARGUMENTS');
  }
  assert(buildDir && isAbsolute(buildDir), 'NATIVE_PROCESS_TEST_BUILD_REQUIRED');
  buildDir = await realpath(buildDir);
  assert(inside(buildDir, await realpath(evidenceRoot)), 'NATIVE_PROCESS_TEST_BUILD_SCOPE');
  outputDir ??= join(evidenceRoot, 'native-process-tests-' + randomUUID());
  assert(isAbsolute(outputDir), 'NATIVE_PROCESS_TEST_OUTPUT_INVALID'); outputDir = resolve(outputDir);
  assert(inside(outputDir, await realpath(evidenceRoot)) && await realpath(dirname(outputDir)) === dirname(outputDir), 'NATIVE_PROCESS_TEST_OUTPUT_SCOPE');
  await mkdir(outputDir); const fixtures = join(outputDir, 'fixtures'); await mkdir(fixtures);
  const binaryPath = join(fixtures, 'codex.exe'), fixturePath = join(fixtures, 'fake-rpc.mjs');
  await copyFile(process.execPath, binaryPath);
  const binaryHash = hash(await readFile(binaryPath)); assert(binaryHash === hash(await readFile(process.execPath)), 'NATIVE_PROCESS_TEST_FIXTURE_COPY');
  await writeFile(fixturePath, `import { spawn } from 'node:child_process';
const timer = setInterval(() => {}, 1000);
if (process.argv[2] !== '--grandchild') {
  const child = spawn(process.execPath, [process.argv[1], '--grandchild'], { windowsHide: true, stdio: 'ignore' });
  let input = ''; process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    input += chunk;
    for (let index; (index = input.indexOf('\\n')) >= 0;) {
      const line = input.slice(0, index); input = input.slice(index + 1);
      const request = JSON.parse(line);
      process.stdout.write(JSON.stringify({ id: request.id, result: { echo: request.params, grandchildPid: child.pid } }) + '\\n');
    }
  });
  process.stdin.on('end', () => { clearInterval(timer); process.exit(0); });
}
`, { flag: 'wx' });
  const manifest = JSON.parse(await readFile(join(buildDir, 'build-manifest.json'), 'utf8'));
  const host = manifest.files.find(file => file.path === 'workforce-native-job-host.exe'); assert(host, 'NATIVE_PROCESS_TEST_HOST_MISSING');
  const base = { binary: { path: binaryPath, sha256: binaryHash, version: '0.153.4', platform: 'win32' },
    windowsHost: { path: join(buildDir, host.path), sha256: host.sha256 }, cwd: fixtures, args: [fixturePath], timeoutMs: 10000, drainMs: 1000 };
  const owners = [], results = [], grandchildren = [];
  const alive = id => { try { process.kill(id, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
  async function rpc(owner, id) {
    const response = new Promise((done, reject) => {
      let text = ''; const timer = setTimeout(() => reject(new Error('NATIVE_PROCESS_TEST_RPC_TIMEOUT')), 3000);
      const data = chunk => {
        text += chunk.toString('utf8'); if (!text.includes('\n')) return;
        owner.stdout.off('data', data); clearTimeout(timer);
        try { done(JSON.parse(text.slice(0, text.indexOf('\n')))); } catch { reject(new Error('NATIVE_PROCESS_TEST_RPC_INVALID')); }
      };
      owner.stdout.on('data', data);
    });
    const params = { text: 'owned fixture 中文\nsecond line', value: id };
    owner.stdin.write(JSON.stringify({ id, method: 'echo', params }) + '\n');
    const result = await response;
    assert(result.id === id && JSON.stringify(result.result.echo) === JSON.stringify(params), 'NATIVE_PROCESS_TEST_RPC_CHANGED');
    assert(Number.isInteger(result.result.grandchildPid), 'NATIVE_PROCESS_TEST_DESCENDANT_MISSING'); grandchildren.push(result.result.grandchildPid);
  }
  try {
    const gatewayOwner = await readExternalRunnerProcessOwner();
    assert(gatewayOwner.pid === process.pid && await readExternalRunnerOwnerLiveness(gatewayOwner) === 'running', 'NATIVE_PROCESS_TEST_GATEWAY_OWNER');
    assert(await readExternalRunnerOwnerLiveness({ ...gatewayOwner, created: '134000000000000001' }) === 'stopped', 'NATIVE_PROCESS_TEST_GATEWAY_OWNER_REUSED');
    results.push({ name: 'gateway-owner-creation-identity-read-only', status: 'passed' });
    const graceful = await createExternalRunnerProcess(base); owners.push(graceful); await rpc(graceful, 1);
    assert(await readExternalRunnerProcessLiveness(graceful.identity) === 'running', 'NATIVE_PROCESS_TEST_LIVE_IDENTITY');
    assert(await readExternalRunnerProcessLiveness({ ...graceful.identity, hostCreated: '134000000000000001', childCreated: '134000000000000002' }) === 'stopped', 'NATIVE_PROCESS_TEST_REUSED_IDENTITY');
    const closed = await graceful.close(); assert(closed.closed && closed.quiescent && closed.status === 'exited' && closed.exitCode === 0, 'NATIVE_PROCESS_TEST_GRACEFUL_CLOSE');
    assert(await readExternalRunnerProcessLiveness(graceful.identity) === 'stopped', 'NATIVE_PROCESS_TEST_STOPPED_IDENTITY');
    results.push({ name: 'rpc-graceful-close-original-identity', status: 'passed', ...closed });
    const abort = new AbortController();
    const cancelled = await createExternalRunnerProcess({ ...base, signal: abort.signal }); owners.push(cancelled); await rpc(cancelled, 2);
    abort.abort();
    const cancellation = await cancelled.completed; assert(cancellation.closed && cancellation.quiescent && cancellation.status === 'cancelled', 'NATIVE_PROCESS_TEST_CANCEL');
    results.push({ name: 'rpc-signal-cancel-tree', status: 'passed', ...cancellation });
    const timed = await createExternalRunnerProcess({ ...base, timeoutMs: 1000 }); owners.push(timed); await rpc(timed, 3);
    const deadline = await timed.completed; assert(deadline.closed && deadline.quiescent && deadline.status === 'timeout', 'NATIVE_PROCESS_TEST_DEADLINE');
    results.push({ name: 'rpc-deadline-tree', status: 'passed', ...deadline });
  } catch (error) { failure = /^[A-Z0-9_]+$/u.test(error?.message) ? error.message : 'NATIVE_PROCESS_TEST_FAILED'; }
  finally { await Promise.all(owners.map(owner => owner.cancel())); }
  for (let i = 0; i < 100 && grandchildren.some(alive); ++i) await delay(20);
  const remaining = grandchildren.filter(alive).length; if (remaining) failure ??= 'NATIVE_PROCESS_TEST_DESCENDANT_REMAINS';
  let fixtureCleanup = false;
  if (!failure) {
    const actual = await realpath(fixtures); assert(actual === join(await realpath(outputDir), 'fixtures') && inside(actual, outputDir), 'NATIVE_PROCESS_TEST_CLEANUP_SCOPE');
    await rm(actual, { recursive: true, force: false }); fixtureCleanup = true;
  }
  const report = { status: failure ? 'failed' : 'passed', failure, tests: results, fixtureCleanup, ownedDescendantsRemaining: remaining,
    helperSha256: host.sha256, fixtureBinarySha256: binaryHash, fixtureIsNodeCopy: true, realCodexExecutions: 0, realProviderCalls: 0, readConfinementVerified: false };
  const reportPath = join(outputDir, 'test-report.json'); await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, failure, testsPassed: results.length, fixtureCleanup, ownedDescendantsRemaining: remaining, reportPath }));
  if (failure) process.exitCode = 1;
} catch (error) { console.log(JSON.stringify({ status: 'failed', code: /^[A-Z0-9_]+$/u.test(error?.message) ? error.message : 'NATIVE_PROCESS_TEST_SETUP_FAILED' })); process.exitCode = 1; }
