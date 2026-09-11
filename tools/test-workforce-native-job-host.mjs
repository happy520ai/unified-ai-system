// Permanent, credential-free component regression tests; requires an explicit current native build.
import { spawn, execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createConnection, createServer } from 'node:net';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const self = fileURLToPath(import.meta.url), repo = resolve(dirname(self), '..');
const evidenceRoot = join(repo, 'apps/ai-gateway-service/evidence/product-final');
const prefix = '[uai-native-job] ', runFile = promisify(execFile);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const delay = ms => new Promise(resolveWait => setTimeout(resolveWait, ms));
const assert = (value, code) => { if (!value) throw new Error(code); };
const safeCode = error => /^[A-Z0-9_-]+$/i.test(error?.message) ? error.message : 'JOB_HOST_TEST_FAILED';
const inside = (path, root) => { const part = relative(root, path); return part !== '' && part !== '..' && !part.startsWith('..' + sep) && !isAbsolute(part); };
async function until(predicate, code, ms = 8000) {
  const end = Date.now() + ms;
  while (!predicate() && Date.now() < end) await delay(20);
  assert(predicate(), code);
}
async function verifyBuild(value) {
  assert(process.platform === 'win32' && process.arch === 'x64', 'JOB_HOST_TEST_PLATFORM_UNSUPPORTED');
  assert(value && isAbsolute(value), 'JOB_HOST_TEST_BUILD_REQUIRED');
  const build = resolve(value), root = await realpath(evidenceRoot);
  const actualBuild = await realpath(build).catch(() => { throw new Error('JOB_HOST_TEST_BUILD_MISSING'); });
  assert(inside(build, root) && actualBuild === build, 'JOB_HOST_TEST_BUILD_SCOPE');
  const manifestPath = join(build, 'build-manifest.json');
  const info = await lstat(manifestPath).catch(() => { throw new Error('JOB_HOST_TEST_MANIFEST_MISSING'); });
  assert(info.isFile() && !info.isSymbolicLink() && info.size <= 65536, 'JOB_HOST_TEST_MANIFEST_INVALID');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert(manifest.status === 'built' && manifest.protocol === 'uai-native-job-v1' && manifest.output === build
    && Array.isArray(manifest.files) && manifest.files.length === 2, 'JOB_HOST_TEST_MANIFEST_INVALID');
  const targets = [['workforce-native-job-host.exe', 'workforceNativeJobHost.cpp'], ['workforce-native-job-fixture.exe', 'workforceNativeJobHost.fixture.cpp']];
  for (const [name, sourceName] of targets) {
    const source = 'apps/ai-gateway-service/src/native/' + sourceName, file = manifest.files.find(item => item.path === name);
    const executable = join(build, name), executableInfo = await lstat(executable);
    assert(file?.source === source && executableInfo.isFile() && !executableInfo.isSymbolicLink() && executableInfo.size <= 10 * 1024 * 1024, 'JOB_HOST_TEST_ARTIFACT_INVALID');
    assert(file.sha256 === sha256(await readFile(executable)), 'JOB_HOST_TEST_BINARY_HASH_MISMATCH');
    assert(file.sourceSha256 === sha256(await readFile(join(repo, source))), 'JOB_HOST_TEST_SOURCE_HASH_MISMATCH');
  }
  return { build, manifest, hostExe: join(build, targets[0][0]), fixtureExe: join(build, targets[1][0]) };
}
async function fixtureParent() {
  assert(typeof process.send === 'function' && process.argv.length === 8, 'JOB_HOST_TEST_PARENT_ARGUMENTS');
  const [buildDir, eventName, marker, pipe, mode] = process.argv.slice(3);
  const { hostExe, fixtureExe } = await verifyBuild(buildDir);
  assert(/^Local\\UaiNativeRun-[0-9a-f-]{36}$/i.test(eventName) && /^\\\\\.\\pipe\\UaiNativeFixture-[0-9a-f-]{36}$/i.test(pipe)
    && isAbsolute(marker) && inside(marker, await realpath(evidenceRoot)) && ['outer-job', 'native-parent-monitor'].includes(mode), 'JOB_HOST_TEST_PARENT_ARGUMENTS');
  const channel = createConnection(pipe);
  try {
    await new Promise((connected, reject) => {
      const timer = setTimeout(() => reject(new Error('JOB_HOST_TEST_CHANNEL_TIMEOUT')), 5000);
      channel.once('connect', () => { clearTimeout(timer); connected(); });
      channel.once('error', () => { clearTimeout(timer); reject(new Error('JOB_HOST_TEST_CHANNEL_FAILED')); });
    });
    // Detached only in this fixture isolates the host's own parent monitor from Node's outer kill-on-close job.
    const host = spawn(hostExe, ['--parent-pid', String(process.pid), '--cancel-event', eventName, '--timeout-ms', '15000', '--drain-ms', '5000', '--', fixtureExe, '--tree', 'stay', marker],
      { windowsHide: true, detached: mode !== 'outer-job', stdio: ['ignore', channel, channel] });
    host.on('spawn', () => process.send({ hostPid: host.pid }));
    host.on('error', () => process.exit(90));
    host.on('close', code => process.exit(code ?? 91));
  } catch (error) { channel.destroy(); throw error; }
}
async function runTests() {
  let buildDir, outputDir;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; ++i) {
    if (args[i] === '--build-dir' && buildDir === undefined && args[i + 1]) buildDir = args[++i];
    else if (args[i] === '--output-dir' && outputDir === undefined && args[i + 1]) outputDir = args[++i];
    else assert(false, 'JOB_HOST_TEST_ARGUMENTS');
  }
  const { build, manifest, hostExe, fixtureExe } = await verifyBuild(buildDir);
  outputDir ??= join(evidenceRoot, 'native-job-tests-' + randomUUID());
  assert(isAbsolute(outputDir), 'JOB_HOST_TEST_OUTPUT_INVALID');
  outputDir = resolve(outputDir);
  assert(inside(outputDir, await realpath(evidenceRoot)) && await realpath(dirname(outputDir)) === dirname(outputDir), 'JOB_HOST_TEST_OUTPUT_SCOPE');
  await mkdir(outputDir); // Existing evidence is never replaced.
  const directory = join(outputDir, 'fixtures'); await mkdir(directory);
  const runs = [], results = []; let failure, fixtureCleanup = false;
  const running = pid => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
  const boundFrames = run => run.frames.filter(frame => frame.protocol === 'uai-native-job-v1' && frame.eventName === run.eventName && frame.hostPid === run.hostPid && frame.parentPid === run.parent);
  const completed = run => boundFrames(run).find(frame => frame.event === 'completed');
  async function launch(name, { mode = 'stay', timeout = 15000, eventName = 'Local\\UaiNativeRun-' + randomUUID(), parent = process.pid,
    intermediary = false, parentOuterJob = false, extra = [], environmentLeak = false } = {}) {
    const marker = join(directory, name + '.marker'), pipe = '\\\\.\\pipe\\UaiNativeFixture-' + randomUUID();
    const server = intermediary ? createServer() : undefined;
    if (server) await new Promise((listening, reject) => { server.once('error', reject); server.listen(pipe, listening); });
    const child = intermediary
      ? spawn(process.execPath, [self, '--fixture-parent', build, eventName, marker, pipe, parentOuterJob ? 'outer-job' : 'native-parent-monitor'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
      : spawn(hostExe, ['--parent-pid', String(parent), '--cancel-event', eventName, '--timeout-ms', String(timeout), '--drain-ms', '5000', '--', fixtureExe, '--tree', mode, marker, ...extra],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: environmentLeak ? { ...process.env, UAI_FIXTURE_EVENT: eventName } : process.env });
    const run = { name, child, marker, eventName, parent: intermediary ? child.pid : parent, hostPid: intermediary ? undefined : child.pid,
      frames: [], fixture: undefined, exit: false, closed: false, code: null, signal: null, server };
    runs.push(run);
    if (intermediary) child.on('message', message => { if (Number.isInteger(message?.hostPid) && message.hostPid > 0) run.hostPid = message.hostPid; });
    let stdout = '', stderr = '';
    const stdoutData = chunk => {
      if (run.ioError) return;
      stdout += chunk.toString('utf8'); if (stdout.length > 65536) { run.ioError = true; return; }
      for (let index; (index = stdout.indexOf('\n')) >= 0;) {
        const line = stdout.slice(0, index); stdout = stdout.slice(index + 1);
        try { const value = JSON.parse(line); if (Number.isInteger(value.childPid) && value.childPid > 0 && Number.isInteger(value.grandchildPid) && value.grandchildPid > 0) run.fixture = value; else run.ioError = true; }
        catch { run.ioError = true; }
      }
    };
    const stderrData = chunk => {
      if (run.ioError) return;
      stderr += chunk.toString('utf8'); if (stderr.length > 65536) { run.ioError = true; return; }
      for (let index; (index = stderr.indexOf('\n')) >= 0;) {
        const line = stderr.slice(0, index); stderr = stderr.slice(index + 1);
        if (!line.startsWith(prefix)) continue;
        try { if (run.frames.length < 8) run.frames.push(JSON.parse(line.slice(prefix.length))); else run.ioError = true; } catch { run.ioError = true; }
      }
    };
    child.stdout.on('data', stdoutData); child.stderr.on('data', stderrData);
    server?.on('error', () => { run.ioError = true; });
    server?.on('connection', socket => {
      run.channel = socket; let buffer = '';
      socket.on('error', () => { run.ioError = true; });
      socket.on('data', chunk => {
        if (run.ioError) return;
        buffer += chunk.toString('utf8'); if (buffer.length > 65536) { run.ioError = true; return; }
        for (let index; (index = buffer.indexOf('\n')) >= 0;) {
          const line = buffer.slice(0, index + 1); buffer = buffer.slice(index + 1);
          (line.startsWith(prefix) ? stderrData : stdoutData)(Buffer.from(line));
        }
      });
      socket.on('close', () => { run.channelClosed = true; server.close(); });
    });
    child.on('error', () => { run.ioError = true; });
    child.on('exit', (code, signal) => { run.exit = true; run.code = code; run.signal = signal; });
    child.on('close', () => { run.closed = true; });
    return run;
  }
  async function ready(run) {
    await until(() => Boolean(run.fixture && run.hostPid && boundFrames(run).some(frame => frame.event === 'started')), 'FIXTURE_NOT_READY_' + run.name);
    assert(!run.ioError, 'FIXTURE_IO_' + run.name);
    const started = boundFrames(run).find(frame => frame.event === 'started');
    assert(started.killOnClose === true && started.childPid === run.fixture.childPid, 'START_IDENTITY_' + run.name);
    assert(/^[0-9]{18}$/.test(started.hostCreated) && /^[0-9]{18}$/.test(started.childCreated) && BigInt(started.childCreated) >= BigInt(started.hostCreated), 'CREATION_METADATA_' + run.name);
    assert(Number((await readFile(run.marker, 'utf8')).trim()) === run.fixture.grandchildPid, 'MARKER_IDENTITY_' + run.name);
  }
  const noOwnedProcesses = run => !running(run.hostPid) && (!run.fixture || (!running(run.fixture.childPid) && !running(run.fixture.grandchildPid)));
  async function stopped(run, status, code, childExitCode) {
    await until(() => run.closed && (!run.server || run.channelClosed), 'HOST_NOT_CLOSED_' + run.name, 10000);
    const final = completed(run), started = boundFrames(run).find(frame => frame.event === 'started');
    assert(!run.ioError && final?.status === status && final.code === code && final.quiescent === true && final.activeProcesses === 0, 'FINAL_PROOF_' + run.name);
    assert(final.childPid === (run.fixture?.childPid ?? null), 'FINAL_IDENTITY_' + run.name);
    assert(/^[0-9]{18}$/.test(final.hostCreated) && (started ? final.hostCreated === started.hostCreated && final.childCreated === started.childCreated : final.childCreated === null), 'FINAL_CREATION_' + run.name);
    if (childExitCode !== undefined) assert(final.childExitCode === childExitCode, 'CHILD_EXIT_' + run.name);
    await until(() => noOwnedProcesses(run), 'OWNED_PROCESS_REMAINS_' + run.name);
    results.push({ name: run.name, status: 'passed', hostExitCode: run.server ? undefined : run.code, hostSignal: run.server ? undefined : run.signal,
      parentExitCode: run.server ? run.code : undefined, parentSignal: run.server ? run.signal : undefined, hostLivenessStopped: true,
      control: { status: final.status, code: final.code, childExitCode: final.childExitCode, quiescent: true, activeProcesses: 0 }, ownedProcessesRemaining: 0 });
  }
  async function signal(run) { await runFile(fixtureExe, ['--signal', run.eventName], { timeout: 5000, windowsHide: true }); }
  async function forcedStop(run, code) {
    assert(run.child.kill('SIGKILL'), 'KILL_FAILED_' + run.name);
    await until(() => run.closed && (!run.server || run.channelClosed) && noOwnedProcesses(run), code);
    assert(!run.ioError && completed(run) === undefined, 'UNEXPECTED_FINAL_PROOF_' + run.name);
    results.push({ name: run.name, status: 'passed', finalProof: false, wrapperMustReport: 'unknown', ownedProcessesRemaining: 0 });
  }
  try {
    const normal = await launch('normal-descendant-drain', { mode: 'normal' }); await ready(normal); await stopped(normal, 'exited', 'OK', 17);
    const cancelled = await launch('cancel-tree'); await ready(cancelled); await signal(cancelled); await stopped(cancelled, 'cancelled', 'CANCELLED');
    const timeout = await launch('deadline-tree', { timeout: 1500 }); await ready(timeout); await stopped(timeout, 'timeout', 'TIMEOUT');
    const parent = await launch('parent-exit-tree', { intermediary: true }); await ready(parent);
    assert(parent.child.kill('SIGKILL'), 'PARENT_KILL_FAILED'); await stopped(parent, 'parent-exited', 'PARENT_EXITED');
    const outer = await launch('outer-node-job-parent-exit', { intermediary: true, parentOuterJob: true }); await ready(outer); await forcedStop(outer, 'OUTER_JOB_PROCESS_REMAINS');
    const owner = await launch('duplicate-owner'); await ready(owner);
    const duplicate = await launch('duplicate-rejected', { eventName: owner.eventName }); await stopped(duplicate, 'failed', 'EVENT_ALREADY_EXISTS');
    await signal(owner); await stopped(owner, 'cancelled', 'CANCELLED');
    await stopped(await launch('invalid-timeout', { timeout: 99 }), 'failed', 'ARGUMENTS_INVALID');
    await stopped(await launch('wrong-parent', { parent: 1 }), 'failed', 'PARENT_PID_MISMATCH');
    await stopped(await launch('private-event-env-rejected', { environmentLeak: true }), 'failed', 'EVENT_IN_CHILD_ENVIRONMENT');
    const eventName = 'Local\\UaiNativeRun-' + randomUUID();
    await stopped(await launch('private-event-arg-rejected', { eventName, extra: [eventName] }), 'failed', 'CHILD_ARGUMENT_INVALID');
    const forced = await launch('forced-host-exit'); await ready(forced); await forcedStop(forced, 'FORCED_EXIT_PROCESS_REMAINS');
  } catch (error) { failure = safeCode(error); }
  finally {
    for (const run of runs) if (!run.exit) run.child.kill('SIGKILL');
    await until(() => runs.every(run => run.closed), 'CLEANUP_HOST_NOT_CLOSED', 10000).catch(error => { failure ??= safeCode(error); });
    // Killing an intermediary may leave its detached test host briefly draining its own Job Object.
    await until(() => runs.every(run => !run.hostPid || noOwnedProcesses(run)), 'CLEANUP_PROCESS_REMAINS', 10000).catch(error => { failure ??= safeCode(error); });
    for (const run of runs) { run.channel?.destroy(); run.server?.close(); }
  }
  const liveOwned = runs.flatMap(run => [run.hostPid, run.fixture?.childPid, run.fixture?.grandchildPid]).filter(pid => Number.isInteger(pid) && running(pid));
  const unknownHost = runs.some(run => run.server && !run.hostPid);
  if (unknownHost) failure ??= 'OWNED_HOST_IDENTITY_UNCONFIRMED';
  if (liveOwned.length) failure ??= 'OWNED_PROCESS_REMAINS';
  if (!unknownHost && !liveOwned.length) {
    try {
      const actualOutput = await realpath(outputDir), actualFixtures = await realpath(directory);
      assert(actualOutput === outputDir && actualFixtures === join(actualOutput, 'fixtures') && inside(actualFixtures, actualOutput), 'JOB_HOST_TEST_CLEANUP_SCOPE');
      await rm(actualFixtures, { recursive: true, force: false }); fixtureCleanup = true;
    } catch (error) { failure ??= safeCode(error); }
  }
  if (results.length !== 12) failure ??= 'JOB_HOST_TEST_CASES_INCOMPLETE';
  const report = { status: failure ? 'failed' : 'passed', failure, build, sourceAndBinaryHashesVerified: true,
    artifacts: manifest.files.map(({ path, sha256: hash, sourceSha256 }) => ({ path, sha256: hash, sourceSha256 })),
    tests: results, fixtureCleanup, ownedProcessesRemaining: unknownHost ? null : liveOwned.length, realProviderCalls: 0, serviceInstalled: false, readConfinementVerified: false };
  const reportPath = join(outputDir, 'test-report.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, failure, passed: results.length, fixtureCleanup, ownedProcessesRemaining: report.ownedProcessesRemaining, reportPath }));
  if (failure) process.exitCode = 1;
}
try { if (process.argv[2] === '--fixture-parent') await fixtureParent(); else await runTests(); }
catch (error) { console.log(JSON.stringify({ status: 'failed', code: safeCode(error) })); process.exitCode = 1; }
