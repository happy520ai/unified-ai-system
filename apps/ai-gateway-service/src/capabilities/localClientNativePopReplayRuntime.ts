import { createHash } from 'node:crypto';
import { lstatSync, openSync, closeSync, fstatSync, readFileSync, readSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, parse, resolve } from 'node:path';
import { createLocalClientSqlitePopReplayGuard, LOCAL_CLIENT_SQLITE_POP_REPLAY_PROTECTED_SCHEMA_VERSION,
  type LocalClientSqlitePopReplayGuardOptions } from './localClientSqlitePopReplayGuard.ts';
import { createLocalClientNativePopReplayBinding, loadLocalClientNativeAuthority } from './localClientWindowsAuthorityNative.ts';
import { LocalClientPopSnapshotRollbackProtectedReplayGuard, type LocalClientPopReplayCheckpoint } from './localClientPopSnapshotRollbackProtection.ts';
import type { ManagedLocalClientPopReplayGuard, ManagedLocalClientPopReplayGuardStatus,
  ManagedLocalClientPopReplayConsumeInput } from './localClientPopIdentityAuthority.ts';

type NativeConfiguration = Readonly<{ nativeAddonPath: string; nativeAddonSha256: string }>;
export type LocalClientNativePopReplayRuntimeOptions = Omit<LocalClientSqlitePopReplayGuardOptions, 'protectedAuthority' | 'anchorBindingSha256' | 'existingOnly'> & NativeConfiguration;
type Binding = Awaited<ReturnType<typeof createLocalClientNativePopReplayBinding>>;
type SqliteGuard = ReturnType<typeof createLocalClientSqlitePopReplayGuard>;
type Adapter = ReturnType<Binding['createEvidenceAdapter']>;
type Connected = { binding: Binding; guard: SqliteGuard; adapter: Adapter; wrapper: LocalClientPopSnapshotRollbackProtectedReplayGuard };
type RuntimeState = 'initializing' | 'ready' | 'unavailable' | 'closed';
type Controller = { prepare(): Promise<boolean> };
const nativePorts = new WeakMap<object, Controller>();
const MODE = 'windows-native-snapshot-protected-sqlite';

/** Pure opt-in parsing. Actual addon/service checks occur only in the runtime. */
export function readNativePopReplayConfiguration(env: Record<string, unknown>): NativeConfiguration | null {
  const mode = String(env.AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_PROTECTION_MODE ?? 'none').trim().toLowerCase();
  const path = env.AI_GATEWAY_LOCAL_CLIENT_NATIVE_AUTHORITY_ADDON_PATH;
  const digest = env.AI_GATEWAY_LOCAL_CLIENT_NATIVE_AUTHORITY_ADDON_SHA256;
  if (mode === 'none') {
    if (String(path ?? '').trim() || String(digest ?? '').trim()) throw failure('CONFIG_INVALID');
    return null;
  }
  if (mode !== 'windows-native' || process.platform !== 'win32' || typeof path !== 'string' || path !== path.trim()
    || !isAbsolute(path) || path.length > 4096 || /[\u0000-\u001f\u007f]/u.test(path)
    || typeof digest !== 'string' || !/^[a-f0-9]{64}$/u.test(digest)) throw failure('CONFIG_INVALID');
  return Object.freeze({ nativeAddonPath: path, nativeAddonSha256: digest });
}

/** A private source marker permits initial unavailable status, never admission. */
export function isLocalClientNativePopReplayRuntime(value: unknown): value is ManagedLocalClientPopReplayGuard {
  return value !== null && typeof value === 'object' && nativePorts.has(value);
}

export async function prepareLocalClientNativePopReplayRuntime(value: unknown): Promise<boolean> {
  if (!isLocalClientNativePopReplayRuntime(value)) return false;
  return nativePorts.get(value)!.prepare();
}

export function createNonOwningNativePopReplayGuardPort(value: unknown): ManagedLocalClientPopReplayGuard | null {
  if (!isLocalClientNativePopReplayRuntime(value)) return null;
  const port = Object.freeze({ get status() { return value.status; }, consumeOnce: (input: ManagedLocalClientPopReplayConsumeInput) => value.consumeOnce(input) });
  nativePorts.set(port, nativePorts.get(value)!);
  return port;
}

export function createLocalClientNativePopReplayRuntime(options: LocalClientNativePopReplayRuntimeOptions) {
  return new NativePopReplayRuntime(options);
}

class NativePopReplayRuntime implements ManagedLocalClientPopReplayGuard {
  readonly #key: Buffer;
  readonly #options: Omit<LocalClientNativePopReplayRuntimeOptions, 'integrityKey'>;
  #connected: Connected | null = null;
  #state: RuntimeState = 'initializing';
  #reason = 'INITIALIZING';
  #closing = false;
  #tail: Promise<void> = Promise.resolve();
  #preparing: Promise<boolean> | null = null;
  #closePromise: Promise<void> | null = null;
  #cleanupFailed = false;
  readonly ready: Promise<boolean>;

  constructor(options: LocalClientNativePopReplayRuntimeOptions) {
    try {
      validateOptions(options);
      this.#key = Buffer.from(options.integrityKey);
      const { integrityKey: _key, ...configuration } = options;
      this.#options = Object.freeze(configuration);
    } finally { clearInputKey(options); }
    nativePorts.set(this, { prepare: () => this.#prepare() });
    this.ready = this.#prepare();
    Object.freeze(this);
  }

  get runtimeStatus() { return Object.freeze({ state: this.#state, reason: this.#reason }); }
  get status(): ManagedLocalClientPopReplayGuardStatus {
    const current = this.#connected;
    if (!this.#closing && !this.#cleanupFailed && this.#state === 'ready' && current?.adapter.status.available === true) return current.wrapper.status;
    return unavailable(current?.wrapper.status);
  }

  readonly consumeOnce = async (input: ManagedLocalClientPopReplayConsumeInput): Promise<'consumed' | 'replayed' | 'capacity'> => {
    if (!await this.#prepare()) throw failure('UNAVAILABLE');
    return this.#enqueue(async () => {
      if (!this.#connected) throw failure('UNAVAILABLE');
      try { return await this.#connected.wrapper.consumeOnce(input); }
      catch {
        if (!this.#closing) { this.#state = 'unavailable'; this.#reason = 'CONSUME_UNCONFIRMED'; }
        await this.#dropConnection();
        // Never retry the failed consume. A later request may bootstrap and
        // reconcile existing bytes before attempting its own proof.
        throw failure('CONSUME_UNCONFIRMED');
      }
    });
  };

  readonly close = (): Promise<void> => {
    if (this.#closePromise) return this.#closePromise;
    this.#closing = true; this.#state = 'closed'; this.#reason = 'CLOSED';
    this.#closePromise = this.#tail.then(async () => {
      try { await this.#dropConnection(); if (this.#cleanupFailed) throw failure('CLOSE_UNCONFIRMED'); }
      finally { this.#key.fill(0); this.#state = 'closed'; this.#reason = this.#cleanupFailed ? 'CLOSE_UNCONFIRMED' : 'CLOSED'; }
    });
    this.#tail = this.#closePromise.then(() => undefined, () => undefined);
    return this.#closePromise;
  };

  #prepare(): Promise<boolean> {
    if (this.#closing || this.#cleanupFailed) return Promise.resolve(false);
    if (this.#preparing) return this.#preparing;
    const pending = this.#enqueue(async () => {
      if (this.#connected && this.status.available) return true;
      this.#state = 'initializing'; this.#reason = 'INITIALIZING';
      try {
        if (this.#connected) {
          const refreshed = await this.#connected.wrapper.refresh();
          if (!refreshed.snapshotRollbackProtected) throw failure('PROTECTION_UNVERIFIED');
        } else this.#connected = await connect(this.#options, this.#key, false);
        if (this.#closing || this.#cleanupFailed) {
          await this.#dropConnection(); return false;
        }
        this.#state = 'ready'; this.#reason = 'VERIFIED'; return true;
      } catch (error) {
        if ((error as { code?: unknown })?.code === 'LOCAL_CLIENT_NATIVE_POP_CLOSE_UNCONFIRMED') this.#cleanupFailed = true;
        try { await this.#dropConnection(); } catch { this.#cleanupFailed = true; }
        if (!this.#closing) { this.#state = 'unavailable'; this.#reason = this.#cleanupFailed ? 'CLOSE_UNCONFIRMED' : 'INITIALIZATION_FAILED'; }
        return false;
      }
    }).catch(() => false);
    this.#preparing = pending;
    void pending.finally(() => { if (this.#preparing === pending) this.#preparing = null; }).catch(() => undefined);
    return pending;
  }

  #enqueue<T>(action: () => Promise<T>): Promise<T> {
    if (this.#closing || this.#cleanupFailed) return Promise.reject(failure(this.#closing ? 'CLOSED' : 'CLOSE_UNCONFIRMED'));
    const pending = this.#tail.then(async () => {
      if (this.#closing || this.#cleanupFailed) throw failure(this.#closing ? 'CLOSED' : 'CLOSE_UNCONFIRMED');
      return action();
    });
    this.#tail = pending.then(() => undefined, () => undefined);
    return pending;
  }

  async #dropConnection() {
    const current = this.#connected; this.#connected = null;
    if (current) {
      try { await current.wrapper.close(); }
      catch {
        this.#cleanupFailed = true; this.#state = this.#closing ? 'closed' : 'unavailable'; this.#reason = 'CLOSE_UNCONFIRMED';
        throw failure('CLOSE_UNCONFIRMED');
      }
    }
  }
}

/** Explicit operator operation; startup and ordinary consume never call this. */
export async function enrollLocalClientNativePopReplayBaseline(options: LocalClientNativePopReplayRuntimeOptions): Promise<LocalClientPopReplayCheckpoint> {
  let key: Buffer | undefined, current: Connected | undefined;
  try {
    validateOptions(options); key = Buffer.from(options.integrityKey);
    options.integrityKey.fill(0);
    const { integrityKey: _key, ...configuration } = options;
    current = await connect(configuration, key, true);
    return await current.guard.readCurrentCheckpoint();
  } finally {
    clearInputKey(options);
    key?.fill(0);
    if (current) await current.wrapper.close();
  }
}

async function connect(options: Omit<LocalClientNativePopReplayRuntimeOptions, 'integrityKey'>, key: Buffer, enroll: boolean): Promise<Connected> {
  let binding: Binding | undefined, guard: SqliteGuard | undefined, wrapper: LocalClientPopSnapshotRollbackProtectedReplayGuard | undefined;
  try {
    const addon = verifyNativeAddon(options.nativeAddonPath, options.nativeAddonSha256);
    const existing = requireExistingProtectedStore(options.sqlitePath, enroll);
    binding = await createLocalClientNativePopReplayBinding(loadLocalClientNativeAuthority(addon));
    if (existing) {
      const current = requireExistingProtectedStore(options.sqlitePath, false);
      if (!current || current.dev !== existing.dev || current.ino !== existing.ino
        || current.size !== existing.size || current.mtimeMs !== existing.mtimeMs) throw failure('STORE_CHANGED');
    }
    const { nativeAddonPath: _path, nativeAddonSha256: _digest, ...sqliteOptions } = options;
    guard = createLocalClientSqlitePopReplayGuard({ ...sqliteOptions, integrityKey: Buffer.from(key),
      protectedAuthority: binding.authority, anchorBindingSha256: binding.anchorBindingSha256,
      ...(existing ? { existingOnly: true as const } : {}) });
    const checkpoint = enroll ? await guard.enrollProtectedBaseline() : await guard.recoverProtectedCheckpoint();
    const adapter = binding.createEvidenceAdapter(checkpoint.storeBindingSha256);
    wrapper = new LocalClientPopSnapshotRollbackProtectedReplayGuard({ checkpointPort: guard, anchorPort: adapter });
    const verified = await wrapper.refresh();
    if (!verified.snapshotRollbackProtected || !adapter.status.available) throw failure('PROTECTION_UNVERIFIED');
    return { binding, guard, adapter, wrapper };
  } catch {
    const outcomes = await Promise.allSettled(wrapper ? [wrapper.close()] : [guard?.close(), binding?.close()]);
    if (outcomes.some(result => result.status === 'rejected')) throw failure('CLOSE_UNCONFIRMED');
    throw failure('INITIALIZATION_FAILED');
  }
}

function requireExistingProtectedStore(path: string, enroll: boolean) {
  let info;
  try { info = lstatSync(path); }
  catch (error) { if (enroll && (error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw failure('STORE_UNAVAILABLE'); }
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size < 100) throw failure('STORE_UNAVAILABLE');
  const fd = openSync(path, 'r');
  try {
    const opened = fstatSync(fd), header = Buffer.alloc(100);
    const count = readSync(fd, header, 0, header.length, 0), after = lstatSync(path);
    if (opened.dev !== info.dev || opened.ino !== info.ino || after.dev !== info.dev || after.ino !== info.ino
      || opened.size !== info.size || after.size !== info.size || after.mtimeMs !== info.mtimeMs || count !== 100
      || header.subarray(0, 16).toString('ascii') !== 'SQLite format 3\0'
      || header.readUInt32BE(60) !== LOCAL_CLIENT_SQLITE_POP_REPLAY_PROTECTED_SCHEMA_VERSION) throw failure('STORE_SCHEMA_REQUIRED');
    // Do not open SQLite just to preflight: even a read-only connection can
    // create WAL/SHM sidecars. The real guard validates schema/HMAC afterward.
    return { dev: info.dev, ino: info.ino, size: info.size, mtimeMs: info.mtimeMs };
  } finally { closeSync(fd); }
}

function verifyNativeAddon(path: string, expectedHash: string) {
  if (process.platform !== 'win32' || !process.env.ProgramData) throw failure('NATIVE_PLATFORM_REQUIRED');
  const expectedPath = resolve(process.env.ProgramData, 'UnifiedAISystem', 'LocalClientAuthority', 'bin', 'local-client-authority.node');
  const compare = (value: string) => resolve(value).toLowerCase();
  if (!isAbsolute(path) || compare(path) !== compare(expectedPath) || compare(realpathSync(path)) !== compare(path)) throw failure('ADDON_PATH_INVALID');
  let ancestor = dirname(path);
  while (true) {
    const info = lstatSync(ancestor);
    if (!info.isDirectory() || info.isSymbolicLink()) throw failure('ADDON_PATH_INVALID');
    const parent = dirname(ancestor); if (parent === ancestor || ancestor === parse(ancestor).root) break; ancestor = parent;
  }
  const before = lstatSync(path);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size < 1 || before.size > 16 * 1024 * 1024) throw failure('ADDON_INVALID');
  const fd = openSync(path, 'r');
  try {
    const opened = fstatSync(fd), bytes = readFileSync(fd), after = lstatSync(path);
    if (opened.dev !== before.dev || opened.ino !== before.ino || after.dev !== before.dev || after.ino !== before.ino
      || bytes.length !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs
      || createHash('sha256').update(bytes).digest('hex') !== expectedHash) throw failure('ADDON_INTEGRITY_INVALID');
  } finally { closeSync(fd); }
  return path;
}

function validateOptions(options: LocalClientNativePopReplayRuntimeOptions) {
  const allowed = new Set(['sqlitePath', 'hostId', 'integrityKey', 'namespace', 'maxEntries', 'maxEntriesPerScope', 'busyTimeoutMs', 'nativeAddonPath', 'nativeAddonSha256']);
  if (!options || typeof options !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(options))
    || !['sqlitePath', 'hostId', 'integrityKey', 'nativeAddonPath', 'nativeAddonSha256'].every(key => Object.hasOwn(options, key))
    || Reflect.ownKeys(options).some(key => typeof key !== 'string' || !allowed.has(key))
    || Object.values(Object.getOwnPropertyDescriptors(options)).some(value => !('value' in value))
    || !Buffer.isBuffer(options.integrityKey) || options.integrityKey.length < 32 || options.integrityKey.length > 64
    || typeof options.sqlitePath !== 'string' || !isAbsolute(options.sqlitePath)
    || typeof options.nativeAddonPath !== 'string' || !isAbsolute(options.nativeAddonPath)
    || typeof options.nativeAddonSha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(options.nativeAddonSha256)
    || typeof options.hostId !== 'string' || options.hostId.length < 8 || options.hostId.length > 256
    || /[\u0000-\u001f\u007f]/u.test(options.hostId)) throw failure('CONFIG_INVALID');
}

function clearInputKey(options: unknown) {
  if (options === null || typeof options !== 'object') return;
  const descriptor = Object.getOwnPropertyDescriptor(options, 'integrityKey');
  if (descriptor && 'value' in descriptor && Buffer.isBuffer(descriptor.value)) descriptor.value.fill(0);
}

function unavailable(prior?: ManagedLocalClientPopReplayGuardStatus): ManagedLocalClientPopReplayGuardStatus {
  return Object.freeze({ ...(prior ?? { durable: true, distributed: false, mode: MODE }), available: false, snapshotRollbackProtected: false });
}
function failure(reason: string) {
  return Object.assign(new Error('Native PoP replay protection is unavailable; verify its enrolled store, pinned addon and installed service.'),
    { code: `LOCAL_CLIENT_NATIVE_POP_${reason}`, category: 'configuration', statusCode: 503, retryable: false });
}
