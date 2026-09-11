import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ spawn: vi.fn(), execFile: vi.fn(), lstat: vi.fn(), readFile: vi.fn(), realpath: vi.fn(), platform: "win32" }));
vi.mock("node:child_process", () => ({ spawn: mocked.spawn, execFile: mocked.execFile }));
vi.mock("node:fs/promises", () => ({ lstat: mocked.lstat, readFile: mocked.readFile, realpath: mocked.realpath }));
vi.mock("node:process", () => ({ pid: 7001, get platform() { return mocked.platform; } }));
import { assertExternalRunnerProcessConfiguration, createExternalRunnerProcess, readExternalRunnerProcessLiveness,
  readExternalRunnerProcessOwner, readExternalRunnerOwnerLiveness } from "./workforceExternalRunnerProcess.ts";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const config = { binary: { path: "E:\\native\\codex.exe", sha256: hash("binary"), platform: "win32" as const, version: "0.153.4" as const },
  windowsHost: { path: "E:\\host\\workforce-native-job-host.exe", sha256: hash("host") } };
const options = () => ({ ...config, args: ["app-server", "--listen", "stdio://"], cwd: "E:\\owned\\worktree", timeoutMs: 5000, drainMs: 100 });
const known = { kind: "windows-job" as const, hostPid: 9001, childPid: 9002, hostCreated: "134335354337170864", childCreated: "134335354337632843" };
const manifest = () => ({ status: "built", protocol: "uai-native-job-v1", files: [{ path: "workforce-native-job-host.exe", sha256: hash("host"),
  source: "apps/ai-gateway-service/src/native/workforceNativeJobHost.cpp", sourceSha256: hash("source") }] });
let live: ReturnType<typeof fixture> | undefined, start: (child: ReturnType<typeof fixture>) => void, onCancel: (() => void) | undefined;
function fixture(args: string[]) {
  const emitter = new EventEmitter(), stdin = new PassThrough(), stdout = new PassThrough(), stderr = new PassThrough();
  const eventName = args[args.indexOf("--cancel-event") + 1];
  const base = { protocol: "uai-native-job-v1", eventName, hostPid: known.hostPid, childPid: known.childPid, parentPid: 7001,
    hostCreated: known.hostCreated, childCreated: known.childCreated };
  let ended = false;
  const child = Object.assign(emitter, { pid: known.hostPid, stdin, stdout, stderr,
    control(value: Record<string, unknown>, fragment = false) {
      const text = "[uai-native-job] " + JSON.stringify({ ...base, ...value }) + "\n";
      if (fragment) { stderr.write(text.slice(0, 17)); stderr.write(text.slice(17, 90)); stderr.write(text.slice(90)); } else stderr.write(text);
    },
    exit(code: number | null, signal: string | null = null) {
      if (ended) return; ended = true; emitter.emit("exit", code, signal); stdout.end(); stderr.end(); emitter.emit("close", code, signal);
    },
    complete(status = "exited", exitCode = 0) {
      child.control({ event: "completed", status, childExitCode: status === "exited" ? exitCode : 1223, quiescent: true, activeProcesses: 0, code: status === "exited" ? "OK" : "CANCELLED" });
      child.exit(status === "exited" ? exitCode : 130);
    },
    kill: vi.fn(() => { child.exit(null, "SIGKILL"); return true; }) });
  return child;
}
beforeEach(() => {
  vi.clearAllMocks(); mocked.platform = "win32"; onCancel = undefined;
  mocked.lstat.mockImplementation(async (path: string) => ({ isFile: () => path !== options().cwd, isDirectory: () => path === options().cwd, isSymbolicLink: () => false, size: 128 }));
  mocked.realpath.mockImplementation(async (path: string) => path);
  mocked.readFile.mockImplementation(async (path: string) => Buffer.from(path.endsWith("build-manifest.json") ? JSON.stringify(manifest())
    : path.endsWith("workforceNativeJobHost.cpp") ? "source" : path.endsWith("workforce-native-job-host.exe") ? "host" : "binary"));
  mocked.execFile.mockImplementation((_file, _args, _options, callback) => { onCancel?.(); callback(null, "", ""); });
  start = child => { child.control({ event: "started", killOnClose: true }, true); };
  mocked.spawn.mockImplementation((_path, args: string[]) => {
    live = fixture(args); queueMicrotask(() => start(live!)); return live;
  });
});
afterEach(() => { live?.kill(); live = undefined; });

describe("private external runner process ownership", () => {
  it("preflights approved binary and helper source hashes without starting any process", async () => {
    await assertExternalRunnerProcessConfiguration(config);
    expect(mocked.spawn).not.toHaveBeenCalled(); expect(mocked.execFile).not.toHaveBeenCalled();
    await expect(assertExternalRunnerProcessConfiguration({ ...config, binary: { ...config.binary, sha256: "a".repeat(64) } })).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_PROCESS_BINARY_HASH_MISMATCH" });
    await expect(assertExternalRunnerProcessConfiguration({ ...config, windowsHost: { ...config.windowsHost, sha256: "a".repeat(64) } })).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_PROCESS_HOST_HASH_MISMATCH" });
    mocked.readFile.mockImplementation(async (path: string) => Buffer.from(path.endsWith("build-manifest.json") ? JSON.stringify({ ...manifest(), files: [{ ...manifest().files[0], sourceSha256: "a".repeat(64) }] })
      : path.endsWith("workforceNativeJobHost.cpp") ? "source" : path.endsWith("workforce-native-job-host.exe") ? "host" : "binary"));
    await expect(assertExternalRunnerProcessConfiguration(config)).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_PROCESS_HOST_SOURCE_MISMATCH" });
  });

  it("rejects unverified platforms, versions, paths and changed helper files before spawning", async () => {
    mocked.platform = "linux";
    await expect(assertExternalRunnerProcessConfiguration(config)).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_PROCESS_PLATFORM_UNSUPPORTED" });
    mocked.platform = "win32";
    for (const binary of [{ ...config.binary, platform: "darwin" }, { ...config.binary, version: "0.154.0" }, { ...config.binary, path: "E:\\native\\..\\codex.exe" }]) {
      await expect(assertExternalRunnerProcessConfiguration({ ...config, binary } as any)).rejects.toThrow();
    }
    mocked.realpath.mockImplementation(async (path: string) => path === config.windowsHost.path ? "E:\\elsewhere\\workforce-native-job-host.exe" : path);
    await expect(createExternalRunnerProcess(options())).rejects.toThrow(); expect(mocked.spawn).not.toHaveBeenCalled();
  });

  it("rechecks cancellation and current authority after asynchronous preflight, immediately before spawn", async () => {
    const abort = new AbortController(), beforeSpawn = vi.fn(async () => { abort.abort(); });
    await expect(createExternalRunnerProcess({ ...options(), signal: abort.signal, beforeSpawn })).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_PROCESS_CANCELLED" });
    expect(beforeSpawn).toHaveBeenCalledOnce(); expect(mocked.spawn).not.toHaveBeenCalled();
    const revoked = Object.assign(new Error("revoked"), { code: "AGENT_EXECUTION_FENCED" });
    await expect(createExternalRunnerProcess({ ...options(), signal: new AbortController().signal, beforeSpawn: async () => { throw revoked; } })).rejects.toBe(revoked);
    expect(mocked.spawn).not.toHaveBeenCalled();
  });

  it("cancels during startup while the owner is still awaiting the native identity", async () => {
    const abort = new AbortController();
    onCancel = () => live!.complete("cancelled");
    start = child => { child.control({ event: "started", killOnClose: true }); abort.abort(); };
    const owner = await createExternalRunnerProcess({ ...options(), signal: abort.signal });
    await expect(owner.completed).resolves.toMatchObject({ closed: true, quiescent: true, status: "cancelled" });
    expect(mocked.execFile).toHaveBeenCalledTimes(1);
  });

  it("keeps native RPC bytes untouched and requires matched final metadata plus host close", async () => {
    start = child => {
      child.control({ event: "started", eventName: "Local\\UaiNativeRun-wrong", killOnClose: true });
      child.stderr.write("opaque native error\n" + "x".repeat(9000) + "\n");
      child.control({ event: "started", killOnClose: true }, true);
      child.stdin.on("finish", () => child.complete());
    };
    const owner = await createExternalRunnerProcess(options());
    expect(owner.identity).toEqual(known); expect(Object.isFrozen(owner.identity)).toBe(true);
    const rpc = new Promise<string>(resolve => owner.stdout.once("data", chunk => resolve(chunk.toString())));
    live!.stdout.write('{"id":1,"result":{"ok":true}}\n'); expect(await rpc).toBe('{"id":1,"result":{"ok":true}}\n');
    expect(mocked.spawn.mock.calls[0][2]).toMatchObject({ cwd: options().cwd, windowsHide: true, detached: false, stdio: ["pipe", "pipe", "pipe"] });
    expect(mocked.spawn.mock.calls[0][2]).not.toHaveProperty("env"); expect(mocked.spawn.mock.calls[0][2]).not.toHaveProperty("shell");
    await expect(owner.close()).resolves.toEqual({ closed: true, quiescent: true, status: "exited", exitCode: 0 });
    expect(mocked.execFile).not.toHaveBeenCalled();
  });

  it("signals only its private event with a fixed encoded command and makes repeated cancellation idempotent", async () => {
    const owner = await createExternalRunnerProcess(options()); onCancel = () => live!.complete("cancelled");
    const results = await Promise.all([owner.cancel(), owner.cancel(), owner.close()]);
    expect(results.every(result => result.quiescent && result.status === "cancelled")).toBe(true); expect(mocked.execFile).toHaveBeenCalledTimes(1);
    const [file, args, commandOptions] = mocked.execFile.mock.calls[0];
    expect(file).toBe("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe");
    expect(args.slice(0, 4)).toEqual(["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand"]);
    expect(Buffer.from(args[4], "base64").toString("utf16le")).toContain("EventWaitHandleRights]::Modify");
    expect(commandOptions).not.toHaveProperty("env");
    expect(JSON.stringify({ identity: owner.identity, result: results[0] })).not.toContain("UaiNativeRun");
  });

  it("snapshots the private launch inputs before asynchronous file validation", async () => {
    const input = { ...options(), binary: { ...config.binary }, windowsHost: { ...config.windowsHost }, args: ["app-server"] };
    const pending = createExternalRunnerProcess(input);
    input.binary.path = "E:\\changed\\codex.exe"; input.windowsHost.path = "E:\\changed\\workforce-native-job-host.exe";
    input.args.push("unapproved-later-value"); input.timeoutMs = 999999;
    const owner = await pending; onCancel = () => live!.complete("cancelled");
    const [executable, args] = mocked.spawn.mock.calls[0];
    expect(executable).toBe(config.windowsHost.path); expect(args).toContain(config.binary.path);
    expect(args).not.toContain("unapproved-later-value"); expect(args[args.indexOf("--timeout-ms") + 1]).toBe("5000");
    await owner.cancel();
  });

  it("treats a final frame with a changed creation identity as unknown", async () => {
    const owner = await createExternalRunnerProcess(options()); onCancel = () => live!.exit(130);
    live!.control({ event: "completed", status: "cancelled", childCreated: "134335354337632844", childExitCode: 1223, quiescent: true, activeProcesses: 0, code: "CANCELLED" });
    await expect(owner.completed).resolves.toMatchObject({ closed: true, quiescent: false, status: "unknown" });
  });

  it("never trusts unbound final frames or process exit alone", async () => {
    const owner = await createExternalRunnerProcess(options());
    live!.control({ event: "completed", hostPid: 1, status: "exited", childExitCode: 0, quiescent: true, activeProcesses: 0, code: "OK" });
    live!.exit(0);
    await expect(owner.completed).resolves.toEqual({ closed: true, quiescent: false, status: "unknown", exitCode: 0 });
  });

  it("forces only its owned live host after unsuccessful cancellation and retains unknown outcome", async () => {
    const owner = await createExternalRunnerProcess(options()); mocked.execFile.mockImplementation((_file, _args, _options, callback) => callback(new Error("private command omitted"), "", ""));
    await expect(owner.cancel()).resolves.toEqual({ closed: true, quiescent: false, status: "unknown", exitCode: null });
    expect(live!.kill).toHaveBeenCalledWith("SIGKILL");
  });

  it("fails startup safely when the host exits before identity is established", async () => {
    start = child => child.exit(125);
    await expect(createExternalRunnerProcess(options())).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_PROCESS_START_UNCONFIRMED" });
  });

  it("checks original PID creation pairs read-only and fails closed on unavailable or malformed identity", async () => {
    for (const [states, expected] of [[['running', 'stopped'], 'running'], [['stopped', 'stopped'], 'stopped'], [['unknown', 'stopped'], 'unknown']] as const) {
      mocked.execFile.mockImplementation((_file, _args, _options, callback) => callback(null, JSON.stringify(states), ""));
      await expect(readExternalRunnerProcessLiveness(known)).resolves.toBe(expected);
    }
    const command = Buffer.from(mocked.execFile.mock.calls[0][1][4], "base64").toString("utf16le");
    expect(command).toContain("GetProcessById"); expect(command).toContain("ToFileTimeUtc"); expect(command).not.toMatch(/Kill|Stop-Process|EventWaitHandle/u);
    const getter = vi.fn(); const invalid = Object.defineProperty({ ...known }, "hostPid", { enumerable: true, get: getter });
    await expect(readExternalRunnerProcessLiveness(invalid)).resolves.toBe("unknown"); expect(getter).not.toHaveBeenCalled();
    await expect(readExternalRunnerProcessLiveness({ ...known, hostCreated: null })).resolves.toBe("unknown"); expect(mocked.spawn).not.toHaveBeenCalled();
  });
  it("binds the owning Gateway creation identity and checks it without stopping a process", async () => {
    mocked.execFile.mockImplementation((_file, _args, _options, callback) => callback(null, known.hostCreated, ""));
    await expect(readExternalRunnerProcessOwner()).resolves.toEqual({ pid: 7001, created: known.hostCreated });
    for (const status of ["running", "stopped", "unknown"] as const) {
      mocked.execFile.mockImplementation((_file, _args, _options, callback) => callback(null, status, ""));
      await expect(readExternalRunnerOwnerLiveness({ pid: 7001, created: known.hostCreated })).resolves.toBe(status);
    }
    expect(mocked.spawn).not.toHaveBeenCalled();
    for (const call of mocked.execFile.mock.calls) expect(Buffer.from(call[1][4], "base64").toString("utf16le")).not.toMatch(/Stop-Process|Kill|EventWaitHandle/u);
  });
});
