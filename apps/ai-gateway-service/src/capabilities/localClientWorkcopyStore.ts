import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { closeSync, existsSync, lstatSync, openSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  createLocalClientDurableExecutionReceipt, verifyLocalClientReceiptReconciliationQuery,
} from "@unified-ai-system/shared-sdk";
import {
  authenticateLocalClientDispatchIntent, type LocalClientDispatchIntent,
  type LocalClientReceiptReconciliationQuery,
} from "./localClientExecutionReceiptReconciliation.ts";
import { LocalClientProtectedSqliteCheckpoint } from "./localClientProtectedSqliteCheckpoint.ts";
import type { LocalClientWindowsProtectedAuthorityAnchor } from "./localClientWindowsProtectedAuthorityAnchor.ts";

const TABLE_SQL = "CREATE TABLE workcopy_state (id INTEGER PRIMARY KEY CHECK (id = 1), envelope BLOB NOT NULL) STRICT";
const MAX_STATE_BYTES = 1_500_000;
const MAX_TEXT_BYTES = 2_048;
const BINDINGS = ["executionId", "intentId", "executionBindingHmac", "tenantBindingHmac",
  "subjectBindingHmac", "clientBindingHmac", "routeBindingHmac", "identityBindingHmac",
  "planFingerprint", "inputSha256", "dispatchFencingToken"] as const;

export interface LocalClientWorkcopyStoreOptions {
  readonly mode: "create" | "open";
  readonly sqlitePath: string;
  readonly storeId: string;
  readonly resourceId: string;
  readonly storageKey: Uint8Array;
  readonly protocolKey: Uint8Array;
  readonly initialText?: string;
  readonly maxOperations?: number;
  readonly now?: () => number;
  readonly protectedAuthority?: LocalClientWindowsProtectedAuthorityAnchor;
}
export type LocalClientWorkcopyStatus = Readonly<{
  state: "not-found" | "prepared" | "armed" | "abandoned" | "completed";
  revision: number | null;
  completedAtMs: number | null;
}>;
export type LocalClientWorkcopyCommitStatus = Readonly<{ state: "completed"; revision: number; completedAtMs: number }>;
type Payload = { version: 1; resourceId: string; expectedRevision: number; text: string };
type Operation = {
  intent: LocalClientDispatchIntent; epoch: number; token: string; expectedRevision: number;
  text: string; state: "prepared" | "armed" | "abandoned" | "completed";
  revision: number | null; completedAtMs: number | null;
};
type State = {
  version: 1; storeId: string; resourceId: string; protocolBinding: string; maxOperations: number;
  epoch: number; lastClockMs: number; revision: number; text: string; operations: Operation[];
};

/** One native resource, not an arbitrary-file adapter. The trusted receiver must
 * claim its journal effect before arm(). Only document bytes plus native commit
 * status are atomic; editor UI and other files are outside this store. An
 * optional independently provisioned authority protects its logical checkpoint;
 * this store does not provision or attest that authority. Starting a verified
 * new session permanently abandons unfinished operations.
 * Capacity has no automatic eviction: terminal evidence must survive retries. */
export class LocalClientWorkcopyStore {
  readonly #db: DatabaseSync;
  readonly #key: Buffer;
  readonly #protocolKey: Buffer;
  readonly #aad: Buffer;
  readonly #options: Pick<LocalClientWorkcopyStoreOptions, "sqlitePath" | "storeId" | "resourceId" | "now">;
  readonly #maxOperations: number;
  #epoch: number | null;
  readonly #protectedConfigured: boolean;
  #protectedCheckpoint: LocalClientProtectedSqliteCheckpoint | null = null;
  #closed = false;
  #closing = false;
  #closePromise: Promise<void> | null = null;
  readonly boundaries = Object.freeze({
    storageMode: "single-host-sqlite", nativeContentAndStatusAtomic: true,
    snapshotRollbackProtected: false, osIdentityAnchored: false,
    editorUiAtomic: false, arbitraryFilesSupported: false,
    journalMode: "wal", synchronous: "full", defensiveEnabled: true,
  });

  constructor(options: LocalClientWorkcopyStoreOptions) {
    if (!options || !["create", "open"].includes(options.mode)
      || typeof options.sqlitePath !== "string" || !isAbsolute(options.sqlitePath)
      || !identifier(options.storeId) || !identifier(options.resourceId)
      || !key32(options.storageKey) || !key32(options.protocolKey)
      || timingSafeEqual(options.storageKey, options.protocolKey)
      || (options.now !== undefined && typeof options.now !== "function")
      || (options.mode === "open" && options.initialText !== undefined)) fail("CONFIGURATION");
    if (typeof (DatabaseSync.prototype as DatabaseSync & { enableDefensive?: unknown }).enableDefensive !== "function") {
      fail("DEFENSIVE_UNAVAILABLE");
    }
    this.#maxOperations = options.maxOperations ?? 128;
    this.#protectedConfigured = options.protectedAuthority !== undefined;
    if (!integer(this.#maxOperations) || this.#maxOperations < 1 || this.#maxOperations > 128) fail("CONFIGURATION");
    if (options.mode === "create" && !validText(options.initialText ?? "")) fail("INPUT");
    this.#options = { sqlitePath: resolve(options.sqlitePath), storeId: options.storeId,
      resourceId: options.resourceId, now: options.now };
    this.#protocolKey = Buffer.from(options.protocolKey);
    this.#aad = Buffer.from(JSON.stringify(["uai-workcopy-state", 1, options.storeId, options.resourceId]));
    this.#key = createHmac("sha256", options.storageKey).update(this.#aad).digest();
    let db: DatabaseSync | undefined;
    try {
      if (options.mode === "create") {
        if (existsSync(`${this.#options.sqlitePath}-wal`) || existsSync(`${this.#options.sqlitePath}-shm`)) fail("EXISTS");
        closeSync(openSync(this.#options.sqlitePath, "wx", 0o600));
      } else if (!lstatSync(this.#options.sqlitePath).isFile()
        || lstatSync(this.#options.sqlitePath).isSymbolicLink()) fail("MISSING");
      db = new DatabaseSync(this.#options.sqlitePath);
      this.#db = db;
      const defensive = (db as DatabaseSync & { enableDefensive?: (enabled: boolean) => void }).enableDefensive;
      if (typeof defensive !== "function") fail("DEFENSIVE_UNAVAILABLE");
      defensive.call(db, true);
      db.exec("PRAGMA busy_timeout = 1000; PRAGMA trusted_schema = OFF; PRAGMA synchronous = FULL");
      if (db.prepare("PRAGMA journal_mode = WAL").get()?.journal_mode !== "wal"
        || db.prepare("PRAGMA synchronous").get()?.synchronous !== 2) fail("SCHEMA");
      db.exec("BEGIN IMMEDIATE");
      if (options.mode === "create") {
        if (db.prepare("SELECT name FROM sqlite_schema").all().length !== 0) fail("SCHEMA");
        db.exec(TABLE_SQL);
        const state: State = { version: 1, storeId: options.storeId, resourceId: options.resourceId,
          protocolBinding: this.#protocolBinding(), maxOperations: this.#maxOperations,
          epoch: 1, lastClockMs: this.#now(), revision: 0, text: options.initialText ?? "", operations: [] };
        this.#epoch = 1;
        db.prepare("INSERT INTO workcopy_state (id, envelope) VALUES (1, ?)").run(this.#encrypt(state));
      } else {
        const state = this.#load();
        if (this.#protectedConfigured) {
          // Startup may authenticate/decrypt, but authority validation must
          // precede every logical mutation, including abandoning the old epoch.
          this.#epoch = null;
        } else {
          this.#clock(state);
          this.#startSession(state);
          this.#epoch = state.epoch;
          this.#save(state);
        }
      }
      db.exec("COMMIT");
      if (this.#protectedConfigured) {
        const checkpointKey = createHmac("sha256", this.#key).update("workcopy-checkpoint-key-v1").digest();
        try {
          this.#protectedCheckpoint = new LocalClientProtectedSqliteCheckpoint({
            db, integrityKey: checkpointKey, bindingId: `workcopy:${createHash("sha256").update(this.#aad).digest("hex")}`,
            authority: options.protectedAuthority!,
            readDataDigest: () => createHmac("sha256", this.#key).update("workcopy-logical-state-v1\0")
              .update(JSON.stringify(this.#load())).digest("hex"),
          });
        } finally { checkpointKey.fill(0); }
      }
    } catch (error) {
      try { db?.exec("ROLLBACK"); } catch { /* Opening may fail before a transaction. */ }
      try { db?.close(); } finally { this.#key.fill(0); this.#protocolKey.fill(0); }
      throw error;
    }
  }

  get protectedCheckpointState() { return this.#protectedCheckpoint?.status.state ?? "disabled"; }

  /** Explicit provisioning step, never implicit in open or a document read. */
  async enrollProtectedBaseline() {
    this.#assertOpen();
    if (!this.#protectedCheckpoint) fail("CONFIGURATION");
    return this.#protectedCheckpoint.enrollBaseline();
  }

  /** Read-only finalization: no session advance, document edits or callbacks. */
  async recoverProtectedCheckpoint() {
    this.#assertOpen();
    if (!this.#protectedCheckpoint) fail("CONFIGURATION");
    return this.#protectedCheckpoint.recover();
  }

  async readDocument() {
    return this.#transaction((state) => Object.freeze({ resourceId: state.resourceId, revision: state.revision, text: state.text }));
  }

  async prepare(intent: LocalClientDispatchIntent, payload: string) {
    const authenticated = this.#authenticate(intent, false);
    const parsed = parsePayload(payload, this.#options.resourceId);
    if (authenticated.inputSha256 !== createHash("sha256").update(JSON.stringify({ payload })).digest("hex")) fail("INPUT_BINDING");
    return this.#transaction((state) => {
      const existing = this.#find(state, authenticated);
      if (existing) {
        if (existing.state !== "prepared" || existing.epoch !== state.epoch) fail("STATE");
        return this.#handle(existing);
      }
      if (state.operations.length >= this.#maxOperations) fail("CAPACITY");
      if (parsed.expectedRevision !== state.revision) fail("REVISION_CONFLICT");
      const op: Operation = { intent: authenticated, epoch: state.epoch, token: randomBytes(32).toString("base64url"),
        expectedRevision: parsed.expectedRevision, text: parsed.text, state: "prepared", revision: null, completedAtMs: null };
      state.operations.push(op);
      return this.#handle(op);
    });
  }

  /** Internal authority boundary: invoke only after the receiver's durable claim. */
  async arm(intent: LocalClientDispatchIntent, uri: string): Promise<LocalClientWorkcopyStatus> {
    const authenticated = this.#authenticate(intent, false);
    return this.#transaction((state) => {
      const op = this.#required(state, authenticated, uri);
      if (op.state !== "prepared" && op.state !== "armed") fail("STATE");
      op.state = "armed";
      return status(op);
    });
  }

  async commit(intent: LocalClientDispatchIntent, uri: string, bytes: Uint8Array): Promise<LocalClientWorkcopyCommitStatus> {
    const authenticated = this.#authenticate(intent, true);
    if (!(bytes instanceof Uint8Array) || bytes.byteLength > MAX_TEXT_BYTES) fail("INPUT");
    // Clone caller-owned bytes before entering the write transaction.
    const supplied = Buffer.from(bytes);
    try {
      return await this.#transaction((state) => {
        const op = this.#required(state, authenticated, uri);
        if (!Buffer.from(op.text, "utf8").equals(supplied)) fail("CONTENT_MISMATCH");
        if (op.state === "completed") return committedStatus(op);
        this.#authenticate(authenticated, false);
        if (op.state !== "armed") fail("STATE");
        if (state.revision !== op.expectedRevision) fail("REVISION_CONFLICT");
        if (state.revision === Number.MAX_SAFE_INTEGER) fail("CAPACITY");
        state.text = op.text;
        state.revision += 1;
        op.state = "completed";
        op.revision = state.revision;
        op.completedAtMs = state.lastClockMs;
        return committedStatus(op);
      });
    } finally { supplied.fill(0); }
  }

  async abandon(intent: LocalClientDispatchIntent): Promise<LocalClientWorkcopyStatus> {
    const authenticated = this.#authenticate(intent, true);
    return this.#transaction((state) => {
      const op = this.#find(state, authenticated);
      if (!op) fail("NOT_FOUND");
      if (op.state === "prepared" || op.state === "armed") op.state = "abandoned";
      return status(op);
    });
  }

  async getStatus(intent: LocalClientDispatchIntent): Promise<LocalClientWorkcopyStatus> {
    const authenticated = this.#authenticate(intent, true);
    return this.#transaction((state) => status(this.#find(state, authenticated)));
  }

  async getDurableReceipt(intent: LocalClientDispatchIntent) {
    const authenticated = this.#authenticate(intent, true);
    const key = Buffer.from(this.#protocolKey);
    try {
      const committed = await this.#transaction((state) => {
        const op = this.#find(state, authenticated);
        if (!op || op.state !== "completed") fail("NOT_COMMITTED");
        return { intent: op.intent, completedAtMs: op.completedAtMs! };
      });
      return await createLocalClientDurableExecutionReceipt({ protocolKey: key, ...committed, nowMs: this.#now() });
    } finally { key.fill(0); }
  }

  async getDurableReceiptForQuery(query: LocalClientReceiptReconciliationQuery) {
    this.#assertOpen();
    const key = Buffer.from(this.#protocolKey);
    try {
      const authenticated = await verifyLocalClientReceiptReconciliationQuery({ protocolKey: key, query, nowMs: this.#now() });
      const committed = await this.#transaction((state) => {
        const op = state.operations.find((candidate) => candidate.intent.executionId === authenticated.executionId);
        if (!op) return null;
        if (!BINDINGS.every((field) => op.intent[field] === authenticated[field])) fail("INTENT_BINDING");
        return op.state === "completed" ? { intent: op.intent, completedAtMs: op.completedAtMs! } : null;
      });
      return committed === null ? null : await createLocalClientDurableExecutionReceipt({
        protocolKey: key, ...committed, nowMs: this.#now(),
      });
    } finally { key.fill(0); }
  }

  close(): Promise<void> {
    if (this.#closePromise) return this.#closePromise;
    this.#closing = true;
    this.#closePromise = (async () => {
      await this.#protectedCheckpoint?.close();
      this.#closed = true;
      try { this.#db.close(); } finally { this.#key.fill(0); this.#protocolKey.fill(0); }
    })();
    return this.#closePromise;
  }

  #assertOpen() { if (this.#closed) fail("CLOSED"); }
  #now() { const value = (this.#options.now ?? Date.now)(); if (!integer(value)) fail("CLOCK"); return value; }
  #clock(state: State) { const now = this.#now(); if (now < state.lastClockMs) fail("CLOCK"); state.lastClockMs = now; }
  #protocolBinding() { return createHmac("sha256", this.#protocolKey).update(this.#aad).digest("hex"); }
  #authenticate(intent: LocalClientDispatchIntent, allowExpired: boolean) {
    this.#assertOpen();
    const nowMs = this.#now();
    const result = authenticateLocalClientDispatchIntent(this.#protocolKey, intent, { nowMs, allowExpired });
    if (!allowExpired && (nowMs < result.issuedAtMs || nowMs > result.expiresAtMs)) fail("EXPIRED");
    return result;
  }
  #handle(op: Operation) { return Object.freeze({ uri: `uai-workcopy://operation/${op.token}`, executionId: op.intent.executionId, sessionEpoch: op.epoch }); }
  #find(state: State, intent: LocalClientDispatchIntent) {
    const op = state.operations.find((candidate) => candidate.intent.executionId === intent.executionId);
    if (op && JSON.stringify(op.intent) !== JSON.stringify(intent)) {
      if (Object.keys(intent).some((key) => intent[key as keyof LocalClientDispatchIntent] !== op.intent[key as keyof LocalClientDispatchIntent])) fail("INTENT_BINDING");
    }
    return op;
  }
  #required(state: State, intent: LocalClientDispatchIntent, uri: string) {
    const op = this.#find(state, intent);
    if (!op || uri !== this.#handle(op).uri) fail("OPERATION");
    if (op.state !== "completed" && op.epoch !== state.epoch) fail("SESSION_STALE");
    return op;
  }
  #startSession(state: State) {
    if (state.epoch === Number.MAX_SAFE_INTEGER) fail("CAPACITY");
    state.epoch += 1;
    for (const op of state.operations) if (op.state === "prepared" || op.state === "armed") op.state = "abandoned";
  }
  async #transaction<T>(work: (state: State) => T): Promise<T> {
    this.#assertOpen();
    if (this.#closing) fail("CLOSED");
    const checked = () => {
      const state = this.#load();
      if (this.#epoch === null) this.#startSession(state);
      else if (state.epoch !== this.#epoch) fail("SESSION_STALE");
      this.#clock(state);
      const result = work(state);
      this.#save(state);
      return { result, epoch: state.epoch };
    };
    if (this.#protectedCheckpoint) {
      const committed = await this.#protectedCheckpoint.run(checked);
      this.#epoch = committed.epoch;
      return committed.result;
    }
    this.#db.exec("BEGIN IMMEDIATE");
    try {
      const committed = checked();
      this.#db.exec("COMMIT");
      return committed.result;
    } catch (error) {
      try { this.#db.exec("ROLLBACK"); } catch { await this.close(); }
      throw error;
    }
  }
  #save(state: State) {
    const result = this.#db.prepare("UPDATE workcopy_state SET envelope = ? WHERE id = 1").run(this.#encrypt(state));
    if (result.changes !== 1) fail("INTEGRITY");
  }
  #encrypt(state: State) {
    const plaintext = Buffer.from(JSON.stringify(state));
    try {
      if (plaintext.length > MAX_STATE_BYTES) fail("CAPACITY");
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", this.#key, iv);
      cipher.setAAD(this.#aad);
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
    } finally { plaintext.fill(0); }
  }
  #load(): State {
    const schema = this.#db.prepare("SELECT type, name, sql FROM sqlite_schema LIMIT 3").all();
    const documentSchema = schema.find((row) => row.name === "workcopy_state");
    if (!documentSchema || documentSchema.type !== "table" || documentSchema.sql !== TABLE_SQL
      || schema.some((row) => row !== documentSchema && !(this.#protectedConfigured
        && row.type === "table" && row.name === "local_client_protected_checkpoint"))) fail("SCHEMA");
    const sizes = this.#db.prepare("SELECT id, length(envelope) AS size FROM workcopy_state LIMIT 2").all();
    if (sizes.length !== 1 || sizes[0]?.id !== 1 || !integer(sizes[0]?.size)
      || sizes[0].size < 29 || sizes[0].size > MAX_STATE_BYTES + 28) fail("INTEGRITY");
    const rows = this.#db.prepare("SELECT id, envelope FROM workcopy_state LIMIT 2").all();
    if (rows.length !== 1 || rows[0]?.id !== 1 || !(rows[0]?.envelope instanceof Uint8Array)) fail("INTEGRITY");
    const envelope = Buffer.from(rows[0].envelope);
    if (envelope.length < 29 || envelope.length > MAX_STATE_BYTES + 28) fail("INTEGRITY");
    let plaintext: Buffer | undefined;
    let decrypted: Buffer | undefined;
    try {
      const decipher = createDecipheriv("aes-256-gcm", this.#key, envelope.subarray(0, 12));
      decipher.setAAD(this.#aad);
      decipher.setAuthTag(envelope.subarray(12, 28));
      decrypted = decipher.update(envelope.subarray(28));
      plaintext = Buffer.concat([decrypted, decipher.final()]);
      const state = JSON.parse(plaintext.toString("utf8")) as State;
      this.#validate(state);
      return state;
    } catch { return fail("INTEGRITY"); } finally { plaintext?.fill(0); decrypted?.fill(0); }
  }
  #validate(state: State) {
    if (!exact(state, ["version", "storeId", "resourceId", "protocolBinding", "maxOperations", "epoch", "lastClockMs", "revision", "text", "operations"])
      || state.version !== 1 || state.storeId !== this.#options.storeId || state.resourceId !== this.#options.resourceId
      || state.protocolBinding !== this.#protocolBinding() || state.maxOperations !== this.#maxOperations
      || !integer(state.epoch) || state.epoch < 1 || !integer(state.lastClockMs) || !integer(state.revision)
      || !validText(state.text) || !Array.isArray(state.operations) || state.operations.length > this.#maxOperations) fail("INTEGRITY");
    const executions = new Set<string>();
    const tokens = new Set<string>();
    const revisions = new Set<number>();
    for (const op of state.operations) {
      if (!exact(op, ["intent", "epoch", "token", "expectedRevision", "text", "state", "revision", "completedAtMs"])
        || !integer(op.epoch) || op.epoch < 1 || op.epoch > state.epoch || !integer(op.expectedRevision)
        || op.expectedRevision > state.revision || !validText(op.text) || typeof op.token !== "string"
        || !/^[A-Za-z0-9_-]{43}$/u.test(op.token) || tokens.has(op.token)
        || !["prepared", "armed", "abandoned", "completed"].includes(op.state)) fail("INTEGRITY");
      authenticateLocalClientDispatchIntent(this.#protocolKey, op.intent, { nowMs: state.lastClockMs, allowExpired: true });
      if (executions.has(op.intent.executionId)) fail("INTEGRITY");
      executions.add(op.intent.executionId); tokens.add(op.token);
      if (op.state === "completed") {
        if (!integer(op.revision) || op.revision !== op.expectedRevision + 1 || op.revision > state.revision
          || revisions.has(op.revision) || !integer(op.completedAtMs) || op.completedAtMs > state.lastClockMs
          || op.completedAtMs < op.intent.issuedAtMs || op.completedAtMs > op.intent.expiresAtMs) fail("INTEGRITY");
        revisions.add(op.revision);
        if (op.revision === state.revision && op.text !== state.text) fail("INTEGRITY");
      } else if (op.revision !== null || op.completedAtMs !== null
        || ((op.state === "prepared" || op.state === "armed") && op.epoch !== state.epoch)) fail("INTEGRITY");
    }
    if (revisions.size !== state.revision) fail("INTEGRITY");
  }
}

export function createLocalClientWorkcopyStore(options: LocalClientWorkcopyStoreOptions) { return new LocalClientWorkcopyStore(options); }
function status(op?: Operation): LocalClientWorkcopyStatus {
  return Object.freeze({ state: op?.state ?? "not-found", revision: op?.revision ?? null, completedAtMs: op?.completedAtMs ?? null });
}
function committedStatus(op: Operation): LocalClientWorkcopyCommitStatus {
  if (op.state !== "completed" || op.revision === null || op.completedAtMs === null) fail("NOT_COMMITTED");
  return Object.freeze({ state: "completed", revision: op.revision, completedAtMs: op.completedAtMs });
}
function integer(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 0; }
function identifier(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value); }
function key32(value: unknown): value is Uint8Array { return value instanceof Uint8Array && value.length === 32; }
function validText(value: unknown): value is string {
  return typeof value === "string" && Buffer.byteLength(value, "utf8") <= MAX_TEXT_BYTES && Buffer.from(value).toString("utf8") === value;
}
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
function parsePayload(payload: string, resourceId: string): Payload {
  if (typeof payload !== "string" || payload.length > 4_096) fail("INPUT");
  let parsed: unknown;
  try { parsed = JSON.parse(payload); } catch { fail("INPUT"); }
  if (!exact(parsed, ["version", "resourceId", "expectedRevision", "text"]) || parsed.version !== 1
    || parsed.resourceId !== resourceId || !integer(parsed.expectedRevision) || !validText(parsed.text)) fail("INPUT");
  return parsed as Payload;
}
function fail(code: string): never { throw new Error(`LOCAL_CLIENT_WORKCOPY_${code}`); }
