import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalClientSqliteExecutionReceiptJournal } from "./localClientExecutionReceiptReconciliation.ts";
import { createLocalClientWorkcopyStore, type LocalClientWorkcopyStoreOptions } from "./localClientWorkcopyStore.ts";
import type { LocalClientWindowsProtectedAuthorityAnchor } from "./localClientWindowsProtectedAuthorityAnchor.ts";

const roots: string[] = [];
const cleanup: (() => unknown)[] = [];
const START = 1_800_000_000_000;
const defensiveSupported = typeof (DatabaseSync.prototype as DatabaseSync & { enableDefensive?: unknown }).enableDefensive === "function";
afterEach(async () => {
  vi.restoreAllMocks();
  for (const close of cleanup.splice(0).reverse()) await close();
  for (const root of roots.splice(0)) {
    if (!root.startsWith(join(tmpdir(), "uai-workcopy-test-"))) throw new Error("Unsafe test cleanup path");
    rmSync(root, { recursive: true, force: true });
  }
});
function fixture(overrides: Partial<LocalClientWorkcopyStoreOptions> = {}) {
  const root = mkdtempSync(join(tmpdir(), "uai-workcopy-test-")); roots.push(root);
  let clock = START;
  const protocolKey = Buffer.alloc(32, 11);
  const options: LocalClientWorkcopyStoreOptions = {
    mode: "create", sqlitePath: join(root, "native.sqlite"), storeId: "store-1", resourceId: "doc-1",
    storageKey: Buffer.alloc(32, 27), protocolKey, initialText: "initial", now: () => clock, ...overrides,
  };
  const store = createLocalClientWorkcopyStore(options); cleanup.push(() => store.close());
  const journal = createLocalClientSqliteExecutionReceiptJournal({
    sqlitePath: join(root, "gateway.sqlite"), role: "gateway", hostId: "test-host",
    integrityKey: Buffer.alloc(32, 49), protocolKey, recoveryEncryptionKey: Buffer.alloc(32, 56), now: () => clock,
  }); cleanup.push(() => journal.close());
  let count = 0;
  return { root, store, journal, options, tick: (ms: number) => { clock += ms; },
    open(extra: Partial<LocalClientWorkcopyStoreOptions> = {}) {
      const reopened = createLocalClientWorkcopyStore({ ...options, initialText: undefined, mode: "open", ...extra });
      cleanup.push(() => reopened.close()); return reopened;
    },
    async intent(text = "edited", expectedRevision = 0, payloadOverride?: string) {
      const payload = payloadOverride ?? JSON.stringify({ version: 1, resourceId: "doc-1", expectedRevision, text });
      count += 1;
      const identity = { executionId: `lc-exec-${count.toString(16).padStart(64, "0")}`,
        tenantId: "tenant-one", subjectId: "subject-one", clientId: "client-one", capabilityId: "local_application", actionId: "invoke",
        planFingerprint: count.toString(16).padStart(64, "0"), inputSha256: createHash("sha256").update(JSON.stringify({ payload })).digest("hex") };
      await journal.prepareDispatch(identity);
      return { payload, intent: (await journal.armDispatch(identity)).intent };
    },
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve };
}
// This model has no OS, ACL, HKLM or privileged-broker attestation. Only the
// authority protocol's current/pending behavior is supplied to real SQLite.
class WorkcopyAuthorityModel {
  current: { generation: number; digest: string } | null = null;
  pending: { generation: number; digest: string } | null = null;
  deny = false;
  failPrepareAfter = false;
  failFinalize = false;
  prepares = 0;
  finalizeEntered = deferred();
  finalizeRelease: ReturnType<typeof deferred> | null = null;
  get port() { return this as unknown as LocalClientWindowsProtectedAuthorityAnchor; }
  async inspect() {
    return { state: this.pending ? "pending-recovery" : this.current ? "ready" : "uninitialized",
      currentGeneration: this.current?.generation ?? 0, currentDigest: this.current?.digest ?? null,
      pendingGeneration: this.pending?.generation ?? null, pendingDigest: this.pending?.digest ?? null };
  }
  async assertCurrent(generation: number, digest: string) {
    if (this.deny || this.pending || this.current?.generation !== generation || this.current.digest !== digest) throw new Error("MODEL_AUTHORITY_MISMATCH");
    return { generation, digest };
  }
  async enrollBaseline(digest: string) {
    if (this.pending || (this.current && (this.current.generation !== 1 || this.current.digest !== digest))) throw new Error("MODEL_BASELINE_MISMATCH");
    this.current = { generation: 1, digest }; return this.inspect();
  }
  async prepareNext(generation: number, digest: string) {
    await this.assertCurrent(generation, this.current!.digest); this.prepares += 1;
    this.pending = { generation: generation + 1, digest };
    if (this.failPrepareAfter) { this.failPrepareAfter = false; throw new Error("MODEL_PREPARE_REPLY_LOST"); }
    return this.inspect();
  }
  async finalize(generation: number, digest: string) {
    if (this.pending?.generation !== generation || this.pending.digest !== digest) throw new Error("MODEL_PENDING_MISMATCH");
    this.finalizeEntered.resolve(); await this.finalizeRelease?.promise;
    if (this.failFinalize) { this.failFinalize = false; throw new Error("MODEL_FINALIZE_FAILED"); }
    this.current = this.pending; this.pending = null; return this.inspect();
  }
}
function encryptedState(sqlitePath: string) {
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try { return Buffer.from(db.prepare("SELECT envelope FROM workcopy_state").get()!.envelope as Uint8Array); }
  finally { db.close(); }
}

it("rejects an unavailable hardened backend before creating persistent state", () => {
  const root = mkdtempSync(join(tmpdir(), "uai-workcopy-test-")); roots.push(root);
  const sqlitePath = join(root, "unsupported.sqlite");
  const descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, "enableDefensive");
  Object.defineProperty(DatabaseSync.prototype, "enableDefensive", { configurable: true, writable: true, value: undefined });
  try {
    expect(() => createLocalClientWorkcopyStore({ mode: "create", sqlitePath, storeId: "store", resourceId: "doc",
      storageKey: Buffer.alloc(32, 27), protocolKey: Buffer.alloc(32, 11) })).toThrow("DEFENSIVE_UNAVAILABLE");
    expect(existsSync(sqlitePath)).toBe(false);
  } finally {
    if (descriptor) Object.defineProperty(DatabaseSync.prototype, "enableDefensive", descriptor);
    else Reflect.deleteProperty(DatabaseSync.prototype, "enableDefensive");
  }
});

// Native transaction assertions must run on a runtime that can enable the
// required protection. Other runtimes run the refusal test above; a skipped
// transaction suite is explicitly not workcopy feature acceptance evidence.
describe.skipIf(!defensiveSupported)("native governed workcopy transaction", () => {
  it.each(["before-commit", "after-commit"])("survives actual owned-process termination at %s", async (phase) => {
    const f = fixture(); const a = await f.intent(); await f.store.close();
    const env: NodeJS.ProcessEnv = {};
    for (const key of ["PATH", "SystemRoot", "WINDIR", "ComSpec", "PATHEXT", "SystemDrive"]) {
      if (process.env[key]) env[key] = process.env[key];
    }
    const child = spawn(process.execPath, ["--input-type=module", "--eval", CRASH_CHILD], {
      env, windowsHide: true, stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    const exited = once(child, "exit");
    let stage = "";
    const reached = new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.stdout!.on("data", chunk => { stage += chunk.toString(); if (stage.includes(phase)) resolve(); });
      child.stderr!.on("data", () => {}); // Both streams were explicitly configured as pipes.
      child.once("exit", () => { if (!stage.includes(phase)) reject(new Error("CRASH_FIXTURE_EARLY_EXIT")); });
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      child.send({ moduleUrl: new URL("./localClientWorkcopyStore.ts", import.meta.url).href,
        sqlitePath: f.options.sqlitePath, storageKey: Array.from(f.options.storageKey),
        protocolKey: Array.from(f.options.protocolKey), intent: a.intent, payload: a.payload, phase, nowMs: START });
      await Promise.race([reached, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("CRASH_FIXTURE_STAGE_TIMEOUT")), 10_000); })]);
      child.kill("SIGKILL");
      await exited; // Confirm actual termination before reopening SQLite.
      const reopened = f.open();
      expect((await reopened.readDocument()).text).toBe(phase === "after-commit" ? "edited" : "initial");
      expect((await reopened.getStatus(a.intent)).state).toBe(phase === "after-commit" ? "completed" : "abandoned");
      if (phase === "after-commit") {
        const receipt = await reopened.getDurableReceipt(a.intent);
        expect((await reopened.getDurableReceipt(a.intent)).receiptId).toBe(receipt.receiptId);
        expect((await reopened.readDocument()).revision).toBe(1);
      } else await expect(reopened.getDurableReceipt(a.intent)).rejects.toThrow("NOT_COMMITTED");
    } finally {
      clearTimeout(timer);
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      await exited;
    }
  });

  it("requires arming and exact bytes, commits once, and returns stable completed receipts", async () => {
    const f = fixture(); const { intent, payload } = await f.intent();
    const handle = await f.store.prepare(intent, payload);
    expect(handle.uri).toMatch(/^uai-workcopy:\/\/operation\/[A-Za-z0-9_-]{43}$/u);
    expect(await f.store.readDocument()).toEqual({ resourceId: "doc-1", revision: 0, text: "initial" });
    await expect(f.store.commit(intent, handle.uri, Buffer.from("edited"))).rejects.toThrow("STATE");
    await expect(f.store.getDurableReceipt(intent)).rejects.toThrow("NOT_COMMITTED");
    await f.store.arm(intent, handle.uri);
    await expect(f.store.commit(intent, handle.uri, Buffer.from("different"))).rejects.toThrow("CONTENT_MISMATCH");
    await expect(f.store.commit(intent, "file:///private/path", Buffer.from("edited"))).rejects.toThrow("OPERATION");
    const committed = await f.store.commit(intent, handle.uri, Buffer.from("edited"));
    expect(committed).toEqual({ state: "completed", revision: 1, completedAtMs: START });
    expect(await f.store.commit(intent, handle.uri, Buffer.from("edited"))).toEqual(committed);
    expect(await f.store.abandon(intent)).toEqual(committed);
    const receipt = await f.store.getDurableReceipt(intent);
    f.tick(100_000); expect(await f.store.getDurableReceipt(intent)).toEqual(receipt);
    await f.store.close(); const reopened = f.open();
    expect(await reopened.readDocument()).toEqual({ resourceId: "doc-1", revision: 1, text: "edited" });
    expect(await reopened.getDurableReceipt(intent)).toEqual(receipt);
  });

  it("recovers only an actual commit by a full authenticated query", async () => {
    const f = fixture(); const a = await f.intent(); const b = await f.intent("other");
    const handle = await f.store.prepare(a.intent, a.payload);
    const query = await f.journal.createReconciliationQuery(a.intent.executionId);
    expect(await f.store.getDurableReceiptForQuery(query)).toBeNull();
    await f.store.arm(a.intent, handle.uri); await f.store.commit(a.intent, handle.uri, Buffer.from("edited"));
    expect(await f.store.getDurableReceiptForQuery(query)).toEqual(await f.store.getDurableReceipt(a.intent));
    expect(await f.store.getDurableReceiptForQuery(await f.journal.createReconciliationQuery(b.intent.executionId))).toBeNull();
    await expect(f.store.getDurableReceiptForQuery({ ...query, inputSha256: "0".repeat(64) })).rejects.toThrow();
    await expect(f.store.getStatus({ ...a.intent, planFingerprint: "0".repeat(64) })).rejects.toThrow();
  });

  it("serializes competing revisions so only one execution can own each content transition", async () => {
    const f = fixture(); const a = await f.intent("winner"); const b = await f.intent("loser");
    const first = await f.store.prepare(a.intent, a.payload); const second = await f.store.prepare(b.intent, b.payload);
    await f.store.arm(a.intent, first.uri); await f.store.arm(b.intent, second.uri);
    await f.store.commit(a.intent, first.uri, Buffer.from("winner"));
    await expect(f.store.commit(b.intent, second.uri, Buffer.from("loser"))).rejects.toThrow("REVISION_CONFLICT");
    expect((await f.store.getStatus(b.intent)).state).toBe("armed");
    expect((await f.store.readDocument()).text).toBe("winner");
    const c = await f.intent("second", 1); const third = await f.store.prepare(c.intent, c.payload);
    await f.store.arm(c.intent, third.uri); expect((await f.store.commit(c.intent, third.uri, Buffer.from("second"))).revision).toBe(2);
    expect((await f.store.getStatus(a.intent)).revision).toBe(1);
  });

  it("invalidates old live sessions and permanently abandons unfinished operations on restart", async () => {
    const f = fixture(); const a = await f.intent(); const handle = await f.store.prepare(a.intent, a.payload);
    await f.store.arm(a.intent, handle.uri); const reopened = f.open();
    await expect(f.store.commit(a.intent, handle.uri, Buffer.from("edited"))).rejects.toThrow("SESSION_STALE");
    expect((await reopened.getStatus(a.intent)).state).toBe("abandoned");
    await expect(reopened.prepare(a.intent, a.payload)).rejects.toThrow("STATE");
    await expect(reopened.arm(a.intent, handle.uri)).rejects.toThrow();
    await expect(reopened.commit(a.intent, handle.uri, Buffer.from("edited"))).rejects.toThrow();
    expect((await reopened.readDocument()).text).toBe("initial");
  });

  it("does not reauthorize explicitly abandoned intents or infer execution from equal content", async () => {
    const f = fixture(); const a = await f.intent("initial"); const handle = await f.store.prepare(a.intent, a.payload);
    await f.store.abandon(a.intent); expect((await f.store.abandon(a.intent)).state).toBe("abandoned");
    await expect(f.store.prepare(a.intent, a.payload)).rejects.toThrow("STATE");
    await expect(f.store.arm(a.intent, handle.uri)).rejects.toThrow("STATE");
    await expect(f.store.getDurableReceipt(a.intent)).rejects.toThrow("NOT_COMMITTED");
  });

  it("fails closed on bounded capacity without evicting evidence", async () => {
    const f = fixture({ maxOperations: 1 }); const a = await f.intent(); const b = await f.intent();
    await f.store.prepare(a.intent, a.payload); await f.store.abandon(a.intent);
    await expect(f.store.prepare(b.intent, b.payload)).rejects.toThrow("CAPACITY");
    expect((await f.store.getStatus(a.intent)).state).toBe("abandoned");
  });

  it("binds payload bytes, fixed resource, text limits and expiration", async () => {
    const f = fixture(); const a = await f.intent();
    await expect(f.store.prepare(a.intent, `${a.payload} `)).rejects.toThrow("INPUT_BINDING");
    const invalid = [JSON.stringify({ version: 1, resourceId: "other", expectedRevision: 0, text: "x" }),
      JSON.stringify({ version: 1, resourceId: "doc-1", expectedRevision: 0, text: "x", path: "C:/x" }),
      JSON.stringify({ version: 1, resourceId: "doc-1", expectedRevision: 0, text: "中".repeat(683) }),
      JSON.stringify({ version: 1, resourceId: "doc-1", expectedRevision: 0, text: "\ud800" })];
    for (const payload of invalid) { const next = await f.intent("", 0, payload); await expect(f.store.prepare(next.intent, payload)).rejects.toThrow("INPUT"); }
    const handle = await f.store.prepare(a.intent, a.payload); await f.store.arm(a.intent, handle.uri); f.tick(100_000);
    await expect(f.store.commit(a.intent, handle.uri, Buffer.from("edited"))).rejects.toThrow();
    expect((await f.store.readDocument()).revision).toBe(0);
  });

  it("rolls back both content and status when the durable state update fails", async () => {
    const f = fixture(); const a = await f.intent(); const handle = await f.store.prepare(a.intent, a.payload); await f.store.arm(a.intent, handle.uri);
    const prepare = DatabaseSync.prototype.prepare;
    const spy = vi.spyOn(DatabaseSync.prototype, "prepare").mockImplementation(function (this: DatabaseSync, sql: string) {
      if (sql.startsWith("UPDATE workcopy_state")) throw new Error("injected storage failure");
      return prepare.call(this, sql);
    });
    await expect(f.store.commit(a.intent, handle.uri, Buffer.from("edited"))).rejects.toThrow("injected storage failure"); spy.mockRestore();
    expect((await f.store.readDocument()).text).toBe("initial"); expect((await f.store.getStatus(a.intent)).state).toBe("armed");
    await expect(f.store.getDurableReceipt(a.intent)).rejects.toThrow("NOT_COMMITTED");
  });

  it("recovers a durable commit after its acknowledgement was lost without writing twice", async () => {
    const f = fixture(); const a = await f.intent(); const handle = await f.store.prepare(a.intent, a.payload); await f.store.arm(a.intent, handle.uri);
    const exec = DatabaseSync.prototype.exec;
    const spy = vi.spyOn(DatabaseSync.prototype, "exec").mockImplementation(function (this: DatabaseSync, sql: string) {
      exec.call(this, sql); if (sql === "COMMIT") throw new Error("lost commit acknowledgement");
    });
    await expect(f.store.commit(a.intent, handle.uri, Buffer.from("edited"))).rejects.toThrow("lost commit acknowledgement"); spy.mockRestore();
    const reopened = f.open(); expect((await reopened.readDocument()).revision).toBe(1);
    expect((await reopened.getDurableReceipt(a.intent)).status).toBe("completed");
  });

  it("requires explicit creation and rejects missing, corrupted, transplanted or wrong-key state", async () => {
    const f = fixture(); await f.store.close();
    expect(() => createLocalClientWorkcopyStore(f.options)).toThrow();
    for (const extra of [{ storageKey: Buffer.alloc(32, 28) }, { protocolKey: Buffer.alloc(32, 12) },
      { storeId: "store-other" }, { resourceId: "doc-other" }]) expect(() => f.open(extra)).toThrow("INTEGRITY");
    const missing = join(f.root, "missing.sqlite"); expect(() => f.open({ sqlitePath: missing })).toThrow(); expect(existsSync(missing)).toBe(false);
    const db = new DatabaseSync(f.options.sqlitePath); db.prepare("UPDATE workcopy_state SET envelope = ?").run(Buffer.alloc(40)); db.close();
    expect(() => f.open()).toThrow("INTEGRITY");
  });

  it.each(["DELETE FROM workcopy_state", "CREATE TABLE extra(value TEXT)",
    "CREATE TRIGGER untrusted AFTER UPDATE ON workcopy_state BEGIN SELECT 1; END"])("rejects tampered schema or row set: %s", async (sql) => {
    const f = fixture(); await f.store.close(); const db = new DatabaseSync(f.options.sqlitePath); db.exec(sql); db.close();
    expect(() => f.open()).toThrow(/INTEGRITY|SCHEMA/u);
  });

  it("stores document and planned text encrypted and clones caller-owned keys", async () => {
    const f = fixture(); const marker = "workcopy-sensitive-content-marker"; const a = await f.intent(marker);
    const handle = await f.store.prepare(a.intent, a.payload); await f.store.arm(a.intent, handle.uri);
    f.options.storageKey.fill(0); f.options.protocolKey.fill(0);
    await f.store.commit(a.intent, handle.uri, Buffer.from(marker)); await f.store.close();
    expect(readFileSync(f.options.sqlitePath).includes(Buffer.from(marker))).toBe(false);
    await expect(f.store.readDocument()).rejects.toThrow("CLOSED");
  });

  it("rejects clock rollback", async () => {
    const f = fixture(); f.tick(-1); await expect(f.store.readDocument()).rejects.toThrow("CLOCK");
  });

  it("requires independent encryption and protocol keys before creating a database", () => {
    const f = fixture(); const sqlitePath = join(f.root, "same-key.sqlite");
    expect(() => createLocalClientWorkcopyStore({ ...f.options, sqlitePath, storageKey: f.options.protocolKey })).toThrow("CONFIGURATION");
    expect(existsSync(sqlitePath)).toBe(false);
  });

  it("fails closed when this runtime cannot enable SQLite defensive mode", async () => {
    const f = fixture();
    const descriptor = Object.getOwnPropertyDescriptor(DatabaseSync.prototype, "enableDefensive")!;
    Object.defineProperty(DatabaseSync.prototype, "enableDefensive", { ...descriptor, value: undefined });
    try { expect(() => f.open()).toThrow("DEFENSIVE_UNAVAILABLE"); }
    finally { Object.defineProperty(DatabaseSync.prototype, "enableDefensive", descriptor); }
    expect(f.store.boundaries.snapshotRollbackProtected).toBe(false);
    expect((await f.store.readDocument()).revision).toBe(0);
  });

  it("rejects oversized encrypted state before loading it", async () => {
    const f = fixture(); await f.store.close();
    const db = new DatabaseSync(f.options.sqlitePath);
    db.exec("UPDATE workcopy_state SET envelope = zeroblob(1500029)"); db.close();
    expect(() => f.open()).toThrow("INTEGRITY");
  });

  it("MODEL: requires explicit protected enrollment and cannot silently remove the authority option", async () => {
    const model = new WorkcopyAuthorityModel(); const f = fixture({ protectedAuthority: model.port });
    const before = encryptedState(f.options.sqlitePath); const a = await f.intent();
    await expect(f.store.readDocument()).rejects.toThrow(); await expect(f.store.prepare(a.intent, a.payload)).rejects.toThrow();
    expect(encryptedState(f.options.sqlitePath)).toEqual(before); expect(model.current).toBeNull();
    expect(f.store.protectedCheckpointState).toBe("unverified");
    await expect(f.store.enrollProtectedBaseline()).resolves.toMatchObject({ generation: 1 });
    expect(await f.store.readDocument()).toMatchObject({ revision: 0, text: "initial" });
    expect(f.store.boundaries).toMatchObject({ snapshotRollbackProtected: false, osIdentityAnchored: false });
    await f.store.close(); expect(() => f.open({ protectedAuthority: undefined })).toThrow("SCHEMA");
    expect(() => f.open({ protectedAuthority: null as never })).toThrow("CONFIGURATION");
  });

  it("MODEL: protected open and recovery leave the epoch untouched until an authority-verified ordinary operation", async () => {
    const model = new WorkcopyAuthorityModel(); const f = fixture({ protectedAuthority: model.port });
    await f.store.enrollProtectedBaseline(); const a = await f.intent();
    const handle = await f.store.prepare(a.intent, a.payload); await f.store.arm(a.intent, handle.uri);
    const before = encryptedState(f.options.sqlitePath); const reopened = f.open();
    expect(encryptedState(f.options.sqlitePath)).toEqual(before);
    model.deny = true; await expect(reopened.readDocument()).rejects.toThrow("MODEL_AUTHORITY_MISMATCH");
    expect(encryptedState(f.options.sqlitePath)).toEqual(before);
    model.deny = false; await reopened.recoverProtectedCheckpoint();
    expect(encryptedState(f.options.sqlitePath)).toEqual(before);
    expect((await reopened.getStatus(a.intent)).state).toBe("abandoned");
    await expect(f.store.commit(a.intent, handle.uri, Buffer.from("edited"))).rejects.toThrow("SESSION_STALE");
    await expect(reopened.prepare(a.intent, a.payload)).rejects.toThrow("STATE");
    expect((await reopened.readDocument()).text).toBe("initial");
  });

  it("MODEL: restoring an older SQLite snapshot cannot roll content, operation status or epoch back into use", async () => {
    const model = new WorkcopyAuthorityModel(); const f = fixture({ protectedAuthority: model.port });
    await f.store.enrollProtectedBaseline(); const a = await f.intent();
    const handle = await f.store.prepare(a.intent, a.payload); await f.store.arm(a.intent, handle.uri);
    const snapshot = join(f.root, "owned-snapshot.sqlite");
    const db = new DatabaseSync(f.options.sqlitePath); db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); db.close();
    copyFileSync(f.options.sqlitePath, snapshot);
    await f.store.commit(a.intent, handle.uri, Buffer.from("edited")); const advanced = model.current;
    await f.store.close(); copyFileSync(snapshot, f.options.sqlitePath);
    const before = encryptedState(f.options.sqlitePath); const reopened = f.open();
    expect(encryptedState(f.options.sqlitePath)).toEqual(before);
    await expect(reopened.readDocument()).rejects.toThrow("MODEL_AUTHORITY_MISMATCH");
    await expect(reopened.getStatus(a.intent)).rejects.toThrow("MODEL_AUTHORITY_MISMATCH");
    await expect(reopened.commit(a.intent, handle.uri, Buffer.from("edited"))).rejects.toThrow("MODEL_AUTHORITY_MISMATCH");
    await expect(reopened.recoverProtectedCheckpoint()).rejects.toThrow("MODEL_AUTHORITY_MISMATCH");
    expect(encryptedState(f.options.sqlitePath)).toEqual(before); expect(model.current).toEqual(advanced);
  });

  it("MODEL: lost finalization recovers committed status and receipt without repeating the document transition", async () => {
    const model = new WorkcopyAuthorityModel(); const f = fixture({ protectedAuthority: model.port });
    await f.store.enrollProtectedBaseline(); const a = await f.intent();
    const handle = await f.store.prepare(a.intent, a.payload); await f.store.arm(a.intent, handle.uri);
    model.failFinalize = true;
    await expect(f.store.commit(a.intent, handle.uri, Buffer.from("edited"))).rejects.toThrow("MODEL_FINALIZE_FAILED");
    const committed = encryptedState(f.options.sqlitePath); const prepares = model.prepares;
    await expect(f.store.getStatus(a.intent)).rejects.toThrow("PENDING_REQUIRES_RECOVERY");
    await f.store.recoverProtectedCheckpoint(); expect(encryptedState(f.options.sqlitePath)).toEqual(committed);
    const receipt = await f.store.getDurableReceipt(a.intent);
    expect(await f.store.commit(a.intent, handle.uri, Buffer.from("edited"))).toMatchObject({ state: "completed", revision: 1 });
    expect(await f.store.getDurableReceipt(a.intent)).toEqual(receipt); expect(model.prepares).toBe(prepares);
    expect((await f.store.readDocument()).revision).toBe(1);
  });

  it("MODEL: a lost preparation response cannot commit a new session or replay its abandoned writes", async () => {
    const model = new WorkcopyAuthorityModel(); const f = fixture({ protectedAuthority: model.port });
    await f.store.enrollProtectedBaseline(); const a = await f.intent();
    const handle = await f.store.prepare(a.intent, a.payload); await f.store.arm(a.intent, handle.uri);
    const before = encryptedState(f.options.sqlitePath); const reopened = f.open(); model.failPrepareAfter = true;
    await expect(reopened.readDocument()).rejects.toThrow("MODEL_PREPARE_REPLY_LOST");
    expect(encryptedState(f.options.sqlitePath)).toEqual(before);
    await expect(reopened.recoverProtectedCheckpoint()).rejects.toThrow("PENDING_BASE_REQUIRES_RECOVERY");
    await expect(f.store.commit(a.intent, handle.uri, Buffer.from("edited"))).rejects.toThrow("PENDING_REQUIRES_RECOVERY");
    expect(encryptedState(f.options.sqlitePath)).toEqual(before);
  });

  it("MODEL: close drains admitted commits and receipt reads while caller byte mutation cannot change the plan", async () => {
    const model = new WorkcopyAuthorityModel(); const f = fixture({ protectedAuthority: model.port });
    await f.store.enrollProtectedBaseline(); const a = await f.intent();
    const handle = await f.store.prepare(a.intent, a.payload); await f.store.arm(a.intent, handle.uri);
    model.finalizeEntered = deferred(); model.finalizeRelease = deferred();
    const bytes = Buffer.from("edited"); const commit = f.store.commit(a.intent, handle.uri, bytes); bytes.fill(0);
    await model.finalizeEntered.promise;
    const receipt = f.store.getDurableReceipt(a.intent); const closing = f.store.close();
    expect(f.store.close()).toBe(closing); await expect(f.store.readDocument()).rejects.toThrow("CLOSED");
    model.finalizeRelease.resolve();
    await expect(commit).resolves.toMatchObject({ state: "completed", revision: 1 });
    await expect(receipt).resolves.toMatchObject({ executionId: a.intent.executionId, status: "completed" });
    await closing; expect(f.store.protectedCheckpointState).toBe("closed");
  });
});

// Trusted test source only. All data/keys are passed in private IPC, not args.
// No editor, service, provider, shell, or other process is started by this child.
const CRASH_CHILD = `
  import { DatabaseSync } from 'node:sqlite';
  import { writeSync } from 'node:fs';
  process.once('message', async data => {
    const { createLocalClientWorkcopyStore } = await import(data.moduleUrl);
    const store = createLocalClientWorkcopyStore({ mode: 'open', sqlitePath: data.sqlitePath,
      storeId: 'store-1', resourceId: 'doc-1', storageKey: Buffer.from(data.storageKey),
      protocolKey: Buffer.from(data.protocolKey), now: () => data.nowMs });
    const handle = await store.prepare(data.intent, data.payload);
    await store.arm(data.intent, handle.uri);
    const exec = DatabaseSync.prototype.exec;
    DatabaseSync.prototype.exec = function(sql) {
      if (sql !== 'COMMIT') return exec.call(this, sql);
      if (data.phase === 'after-commit') exec.call(this, sql);
      writeSync(1, Buffer.from(data.phase + '\\n'));
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
    };
    await store.commit(data.intent, handle.uri, Buffer.from('edited'));
  });
`;
