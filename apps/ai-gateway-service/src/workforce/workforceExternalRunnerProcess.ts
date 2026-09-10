import { spawn, execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { win32 } from "node:path";
import { pid, platform } from "node:process";
import type { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import type { WorkforceExternalRunnerProfile } from "@unified-ai-system/shared-contracts";
import { externalRunnerError } from "./workforceExternalRunnerProfile.ts";

export type ExternalRunnerProcessIdentity = Readonly<{ kind: "windows-job"; hostPid: number; childPid: number; hostCreated: string; childCreated: string }>;
export type ExternalRunnerOwnerIdentity = Readonly<{ pid: number; created: string }>;
export type ExternalRunnerProcessExit = Readonly<{ closed: boolean; quiescent: boolean;
  status: "exited" | "cancelled" | "timeout" | "parent-exited" | "failed" | "unknown"; exitCode: number | null }>;
export type ExternalRunnerProcessConfiguration = { binary: WorkforceExternalRunnerProfile["binary"]; windowsHost: { path: string; sha256: string } };
export type ExternalRunnerProcessOptions = ExternalRunnerProcessConfiguration & { args: readonly string[]; cwd: string; timeoutMs: number; drainMs?: number;
  signal?: AbortSignal; beforeSpawn?(): Promise<void> };
export type ExternalRunnerProcess = Readonly<{ stdout: Readable; stdin: Writable; identity: ExternalRunnerProcessIdentity;
  completed: Promise<ExternalRunnerProcessExit>; close(): Promise<ExternalRunnerProcessExit>; cancel(): Promise<ExternalRunnerProcessExit> }>;
const PREFIX = "[uai-native-job] ", HASH = /^[a-f0-9]{64}$/u;
const HOST_SOURCE = fileURLToPath(new URL("../native/workforceNativeJobHost.cpp", import.meta.url));
// This verified Windows distribution uses the OS-owned, fixed executable; PATH and user shell profiles are never consulted.
const POWERSHELL = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
const bad = (code: string) => externalRunnerError("WORKFORCE_EXTERNAL_RUNNER_PROCESS_" + code, "The native process owner could not verify or close the original process safely.", 503);
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const integer = (value: unknown, minimum: number, maximum: number): value is number => Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
const created = (value: unknown): value is string => typeof value === "string" && /^[1-9][0-9]{15,19}$/u.test(value) && BigInt(value) <= 18446744073709551615n;
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
function fields(value: unknown, keys: readonly string[]): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).length !== keys.length) throw bad("CONFIGURATION_INVALID");
  const result: Record<string, any> = Object.create(null);
  for (const key of keys) {
    const field = Object.getOwnPropertyDescriptor(value, key);
    if (!field?.enumerable || !("value" in field)) throw bad("CONFIGURATION_INVALID");
    result[key] = field.value;
  }
  return result;
}
function absolute(value: unknown): string {
  if (typeof value !== "string" || value.length > 4096 || !/^[A-Za-z]:[\\/]/u.test(value)
    || value.slice(3).split(/[\\/]/u).some(part => !part || part === "." || part === ".." || /[. ]$/u.test(part) || /[\u0000-\u001f<>:"|?*]/u.test(part))) throw bad("PATH_INVALID");
  return win32.normalize(value);
}
async function regularFile(path: string, maxBytes: number): Promise<Buffer> {
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maxBytes || (await realpath(path)).toLowerCase() !== path.toLowerCase()) throw bad("FILE_INVALID");
  return readFile(path);
}
/** Checks the private, previously approved version/hash binding without executing Codex or reading native configuration. */
export async function assertExternalRunnerProcessConfiguration(options: ExternalRunnerProcessConfiguration): Promise<void> {
  if (platform !== "win32") throw bad("PLATFORM_UNSUPPORTED");
  try {
    const config = fields(options, ["binary", "windowsHost"]), binary = fields(config.binary, ["path", "sha256", "version", "platform"]), host = fields(config.windowsHost, ["path", "sha256"]);
    const binaryPath = absolute(binary.path), hostPath = absolute(host.path);
    if (binary.platform !== "win32" || binary.version !== "0.153.4" || typeof binary.sha256 !== "string" || typeof host.sha256 !== "string" || !HASH.test(binary.sha256) || !HASH.test(host.sha256)
      || win32.basename(binaryPath).toLowerCase() !== "codex.exe" || win32.basename(hostPath) !== "workforce-native-job-host.exe") throw bad("BINARY_PIN_INVALID");
    if (digest(await regularFile(binaryPath, 512 * 1024 * 1024)) !== binary.sha256) throw bad("BINARY_HASH_MISMATCH");
    if (digest(await regularFile(hostPath, 4 * 1024 * 1024)) !== host.sha256) throw bad("HOST_HASH_MISMATCH");
    const manifest = JSON.parse((await regularFile(win32.join(win32.dirname(hostPath), "build-manifest.json"), 65536)).toString("utf8"));
    if (manifest?.status !== "built" || manifest.protocol !== "uai-native-job-v1" || !Array.isArray(manifest.files) || manifest.files.length > 4) throw bad("HOST_MANIFEST_INVALID");
    const entries = manifest.files.filter((item: any) => item?.path === "workforce-native-job-host.exe");
    if (entries.length !== 1 || entries[0].sha256 !== host.sha256 || entries[0].source !== "apps/ai-gateway-service/src/native/workforceNativeJobHost.cpp"
      || entries[0].sourceSha256 !== digest(await regularFile(HOST_SOURCE, 1024 * 1024))) throw bad("HOST_SOURCE_MISMATCH");
    const shell = await lstat(POWERSHELL);
    if (!shell.isFile() || shell.isSymbolicLink() || (await realpath(POWERSHELL)).toLowerCase() !== POWERSHELL.toLowerCase()) throw bad("SYSTEM_SHELL_UNAVAILABLE");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && String(error.code).startsWith("WORKFORCE_EXTERNAL_RUNNER_PROCESS_")) throw error;
    throw bad("CONFIGURATION_UNAVAILABLE");
  }
}
function encodedPowerShell(script: string): Promise<string | null> {
  return new Promise(resolve => {
    execFile(POWERSHELL, ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")],
      { windowsHide: true, timeout: 2500, maxBuffer: 4096, encoding: "utf8" }, (error, stdout) => resolve(error ? null : stdout.trim()));
  });
}
/** Only the caller's live private event is used for cancellation; the event name is never returned or logged. */
async function signalEvent(eventName: string): Promise<void> {
  await encodedPowerShell("$ErrorActionPreference='Stop';try{$e=[System.Threading.EventWaitHandle]::OpenExisting('" + eventName
    + "',[System.Security.AccessControl.EventWaitHandleRights]::Modify);try{if(-not $e.Set()){exit 2}}finally{$e.Dispose()};exit 0}catch{exit 3}");
}
let currentOwner: Promise<ExternalRunnerOwnerIdentity> | undefined;
/** Non-sensitive identity of this Gateway process, used to distinguish a live owner from a restart. */
export function readExternalRunnerProcessOwner(): Promise<ExternalRunnerOwnerIdentity> {
  currentOwner ??= (async () => {
    if (platform !== "win32") throw bad("PLATFORM_UNSUPPORTED");
    const value = await encodedPowerShell("$ErrorActionPreference='Stop';$uaiOwner=[System.Diagnostics.Process]::GetProcessById(" + pid
      + ");try{[Console]::Out.Write($uaiOwner.StartTime.ToFileTimeUtc().ToString())}finally{$uaiOwner.Dispose()}");
    if (!created(value)) throw bad("OWNER_IDENTITY_UNAVAILABLE");
    return Object.freeze({ pid, created: value });
  })().catch(error => { currentOwner = undefined; throw error; });
  return currentOwner;
}
export async function readExternalRunnerOwnerLiveness(value: unknown): Promise<"running" | "stopped" | "unknown"> {
  if (platform !== "win32") return "unknown";
  try {
    const owner = fields(value, ["pid", "created"]);
    if (!integer(owner.pid, 1, 2147483647) || !created(owner.created)) return "unknown";
    const result = await encodedPowerShell("$ErrorActionPreference='Stop';try{$uaiOwner=[System.Diagnostics.Process]::GetProcessById(" + owner.pid
      + ");try{if($uaiOwner.StartTime.ToFileTimeUtc().ToString() -ne '" + owner.created
      + "' -or $uaiOwner.HasExited){[Console]::Out.Write('stopped')}else{[Console]::Out.Write('running')}}finally{$uaiOwner.Dispose()}}catch [System.ArgumentException]{[Console]::Out.Write('stopped')}catch{[Console]::Out.Write('unknown')}");
    return result === "running" || result === "stopped" ? result : "unknown";
  } catch { return "unknown"; }
}
/** Read-only original identity check. A reused PID means that original process stopped; inaccessible identity remains unknown. */
export async function readExternalRunnerProcessLiveness(value: unknown): Promise<"running" | "stopped" | "unknown"> {
  if (platform !== "win32") return "unknown";
  try {
    const identity = fields(value, ["kind", "hostPid", "childPid", "hostCreated", "childCreated"]);
    if (identity.kind !== "windows-job" || !integer(identity.hostPid, 1, 2147483647) || !integer(identity.childPid, 1, 2147483647)
      || identity.hostPid === identity.childPid || !created(identity.hostCreated) || !created(identity.childCreated)
      || BigInt(identity.childCreated) < BigInt(identity.hostCreated)) return "unknown";
    const script = "$ErrorActionPreference='Stop';$r=@();foreach($x in @(@(" + identity.hostPid + ",'" + identity.hostCreated + "'),@(" + identity.childPid + ",'" + identity.childCreated
      + "'))){try{$p=[System.Diagnostics.Process]::GetProcessById([int]$x[0]);try{if($p.StartTime.ToFileTimeUtc().ToString() -ne $x[1] -or $p.HasExited){$r+='stopped'}else{$r+='running'}}finally{$p.Dispose()}}catch [System.ArgumentException]{$r+='stopped'}catch{$r+='unknown'}};[Console]::Out.Write(($r|ConvertTo-Json -Compress))";
    const output = await encodedPowerShell(script); if (output === null) return "unknown";
    const states: unknown = JSON.parse(output);
    if (!Array.isArray(states) || states.length !== 2 || states.some(state => !["running", "stopped", "unknown"].includes(state))) return "unknown";
    return states.includes("running") ? "running" : states.includes("unknown") ? "unknown" : "stopped";
  } catch { return "unknown"; }
}

export async function createExternalRunnerProcess(options: ExternalRunnerProcessOptions): Promise<ExternalRunnerProcess> {
  const signal = options.signal, beforeSpawn = options.beforeSpawn;
  if (signal !== undefined && !(signal instanceof AbortSignal) || beforeSpawn !== undefined && typeof beforeSpawn !== "function") throw bad("CONFIGURATION_INVALID");
  if (signal?.aborted) throw bad("CANCELLED");
  const binary = Object.freeze(fields(options.binary, ["path", "sha256", "version", "platform"])) as WorkforceExternalRunnerProfile["binary"];
  const windowsHost = Object.freeze(fields(options.windowsHost, ["path", "sha256"])) as ExternalRunnerProcessConfiguration["windowsHost"];
  const cwd = absolute(options.cwd), timeoutMs = options.timeoutMs, drainMs = options.drainMs ?? 5000;
  if (!integer(timeoutMs, 100, 3600000) || !integer(drainMs, 100, 30000) || !Array.isArray(options.args) || options.args.length > 192
    || options.args.some(arg => typeof arg !== "string" || arg.length > 16384 || /[\u0000\r\n]/u.test(arg))
    || options.args.reduce((sum, arg) => sum + arg.length + 3, 0) > 30000) throw bad("ARGUMENTS_INVALID");
  const args = [...options.args];
  await assertExternalRunnerProcessConfiguration({ binary, windowsHost });
  const directory = await lstat(cwd);
  if (!directory.isDirectory() || directory.isSymbolicLink() || (await realpath(cwd)).toLowerCase() !== cwd.toLowerCase()) throw bad("WORKTREE_INVALID");
  await beforeSpawn?.();
  if (signal?.aborted) throw bad("CANCELLED");
  const eventName = "Local\\UaiNativeRun-" + randomUUID();
  const child = spawn(absolute(windowsHost.path), ["--parent-pid", String(pid), "--cancel-event", eventName,
    "--timeout-ms", String(timeoutMs), "--drain-ms", String(drainMs), "--", absolute(binary.path), ...args],
    { cwd, windowsHide: true, detached: false, stdio: ["pipe", "pipe", "pipe"] }); // No env option: native inherited authentication remains untouched.
  let identity: ExternalRunnerProcessIdentity | undefined, final: Record<string, any> | undefined;
  let protocolFailure = false, closed = false, settled = false, exitCode: number | null = null, exitSignal: string | null = null;
  let finish!: (result: ExternalRunnerProcessExit) => void, started!: (identity: ExternalRunnerProcessIdentity) => void;
  const completed = new Promise<ExternalRunnerProcessExit>(resolve => { finish = resolve; });
  const startup = new Promise<ExternalRunnerProcessIdentity>(resolve => { started = resolve; });
  let cancelling: Promise<ExternalRunnerProcessExit> | undefined, closing: Promise<ExternalRunnerProcessExit> | undefined;
  function settle(forceUnknown = false) {
    if (settled) return;
    settled = true; clearTimeout(watchdog); signal?.removeEventListener("abort", onAbort);
    const expectedExit = final?.status === "exited" ? final.childExitCode : final?.status === "timeout" ? 124 : final?.status === "failed" ? 125 : 130;
    const verified = !forceUnknown && closed && !protocolFailure && Boolean(identity && final) && exitSignal === null && exitCode === expectedExit;
    finish(Object.freeze({ closed, quiescent: verified && final!.quiescent === true && final!.activeProcesses === 0,
      status: verified ? final!.status : "unknown", exitCode }));
  }
  async function cancel(): Promise<ExternalRunnerProcessExit> {
    if (settled) return completed;
    if (!cancelling) cancelling = (async () => {
      await signalEvent(eventName);
      await Promise.race([completed, pause(drainMs + 250)]);
      if (!closed && !settled) {
        child.kill("SIGKILL"); await Promise.race([completed, pause(1000)]);
        if (!closed) settle(true);
      }
      return completed;
    })();
    return cancelling;
  }
  const watchdog = setTimeout(() => { void cancel(); }, timeoutMs + drainMs + 500);
  const onAbort = () => { void cancel(); };
  function invalidControl() { protocolFailure = true; void cancel(); }
  function frame(line: string) {
    if (!line.startsWith(PREFIX)) return;
    let value: any; try { value = JSON.parse(line.slice(PREFIX.length)); } catch { return; }
    if (!value || value.protocol !== "uai-native-job-v1" || value.eventName !== eventName || value.hostPid !== child.pid || value.parentPid !== pid) return;
    try {
      const common = ["protocol", "eventName", "hostPid", "childPid", "parentPid", "hostCreated", "childCreated", "event"];
      fields(value, [...common, ...(value.event === "started" ? ["killOnClose"] : ["status", "childExitCode", "quiescent", "activeProcesses", "code"])]);
      if (!created(value.hostCreated) || value.childPid !== null && (!integer(value.childPid, 1, 2147483647) || !created(value.childCreated)
        || BigInt(value.childCreated) < BigInt(value.hostCreated)) || value.childPid === null && value.childCreated !== null) throw bad("CONTROL_INVALID");
      if (value.event === "started") {
        if (identity || final || value.killOnClose !== true || value.childPid === null || value.childPid === child.pid) throw bad("CONTROL_INVALID");
        identity = Object.freeze({ kind: "windows-job", hostPid: value.hostPid, childPid: value.childPid, hostCreated: value.hostCreated, childCreated: value.childCreated });
        started(identity); return;
      }
      if (value.event !== "completed" || final || !["exited", "cancelled", "timeout", "parent-exited", "failed"].includes(value.status)
        || typeof value.quiescent !== "boolean" || value.childExitCode !== null && !integer(value.childExitCode, 0, 4294967295)
        || value.activeProcesses !== null && !integer(value.activeProcesses, 0, 4294967295) || value.quiescent && value.activeProcesses !== 0
        || typeof value.code !== "string" || !/^[A-Z][A-Z0-9_]{0,63}$/u.test(value.code)
        || identity && ["hostPid", "childPid", "hostCreated", "childCreated"].some(key => value[key] !== identity![key as keyof ExternalRunnerProcessIdentity])) throw bad("CONTROL_INVALID");
      final = value;
    } catch { invalidControl(); }
  }
  let buffer = "", discarding = false;
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    for (const part of chunk.split(/(?<=\n)/u)) {
      const ended = part.endsWith("\n");
      if (!discarding) { if (buffer.length + part.length > 8192) { buffer = ""; discarding = true; } else buffer += part; }
      if (ended) { if (!discarding) frame(buffer.slice(0, -1)); buffer = ""; discarding = false; }
    }
  });
  child.stdin.on("error", () => { if (!closed) void cancel(); }); // The RPC peer also observes this stream event.
  child.stdout.on("error", invalidControl); child.stderr.on("error", invalidControl);
  child.on("error", () => { protocolFailure = true; });
  child.on("exit", (code, signal) => { exitCode = code; exitSignal = signal; });
  child.on("close", () => { closed = true; settle(); });
  signal?.addEventListener("abort", onAbort, { once: true }); if (signal?.aborted) onAbort();
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const ready = await Promise.race([startup, completed.then(() => { throw bad("START_UNCONFIRMED"); }),
      new Promise<never>((_, reject) => { startupTimer = setTimeout(() => reject(bad("START_TIMEOUT")), Math.min(5000, timeoutMs + 500)); })]);
    return Object.freeze({ stdout: child.stdout, stdin: child.stdin, identity: ready, completed, cancel,
      close() {
        closing ??= (async () => {
          if (!closed && !child.stdin.destroyed) child.stdin.end();
          await Promise.race([completed, pause(250)]);
          return settled ? completed : cancel();
        })();
        return closing;
      } });
  } catch { await cancel(); throw bad("START_UNCONFIRMED"); }
  finally { if (startupTimer !== undefined) clearTimeout(startupTimer); }
}
