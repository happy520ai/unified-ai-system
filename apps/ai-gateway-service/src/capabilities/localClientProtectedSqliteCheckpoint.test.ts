import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalClientProtectedSqliteCheckpoint } from "./localClientProtectedSqliteCheckpoint.ts";
import { createLocalClientSqliteExecutionReceiptJournal } from "./localClientExecutionReceiptReconciliation.ts";
import type { LocalClientWindowsProtectedAuthorityAnchor } from "./localClientWindowsProtectedAuthorityAnchor.ts";

type Authority = ConstructorParameters<typeof LocalClientProtectedSqliteCheckpoint>[0]["authority"];
type Inspection = Awaited<ReturnType<Authority["inspect"]>>;
type Checkpoint = { generation: number; digest: string };
const finalizers: (() => Promise<void>)[] = [];
afterEach(async () => { for (const finalize of finalizers.splice(0).reverse()) await finalize(); vi.restoreAllMocks(); });
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

/** Behavioral authority model only. No ACL, HKLM, privileged process or Windows
 * attestation is exercised or certified by this fixture. */
class MemoryAuthority implements Authority {
  current: Checkpoint | null = null;
  pending: Checkpoint | null = null;
  failPrepare: "before" | "after" | null = null;
  failFinalize = false;
  prepareEntered = deferred();
  prepareRelease: ReturnType<typeof deferred> | null = null;
  async inspect(): Promise<Inspection> {
    return { state: this.pending ? "pending-recovery" : this.current ? "ready" : "uninitialized",
      currentGeneration: this.current?.generation ?? 0, currentDigest: this.current?.digest ?? null,
      pendingGeneration: this.pending?.generation ?? null, pendingDigest: this.pending?.digest ?? null } as Inspection;
  }
  async assertCurrent(generation: number, digest: string) {
    if (this.pending || this.current?.generation !== generation || this.current.digest !== digest) throw new Error("MODEL_AUTHORITY_MISMATCH");
    return { generation, digest };
  }
  async enrollBaseline(digest: string) {
    if (this.pending || (this.current && (this.current.generation !== 1 || this.current.digest !== digest))) throw new Error("MODEL_ENROLLMENT_MISMATCH");
    this.current = { generation: 1, digest }; return this.inspect();
  }
  async prepareNext(generation: number, digest: string) {
    if (this.pending || this.current?.generation !== generation) throw new Error("MODEL_PREPARE_MISMATCH");
    this.prepareEntered.resolve();
    await this.prepareRelease?.promise;
    const fault = this.failPrepare; this.failPrepare = null;
    if (fault === "before") throw new Error("MODEL_PREPARE_FAILED_BEFORE");
    this.pending = { generation: generation + 1, digest };
    if (fault === "after") throw new Error("MODEL_PREPARE_RESPONSE_LOST");
    return this.inspect();
  }
  async finalize(generation: number, digest: string) {
    if (this.pending?.generation !== generation || this.pending.digest !== digest) throw new Error("MODEL_FINALIZE_MISMATCH");
    if (this.failFinalize) { this.failFinalize = false; throw new Error("MODEL_FINALIZE_UNAVAILABLE"); }
    this.current = this.pending; this.pending = null; return this.inspect();
  }
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "protected-checkpoint-test-"));
  const sqlitePath = join(root, "state.sqlite");
  let db = new DatabaseSync(sqlitePath);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; CREATE TABLE document (value TEXT NOT NULL) STRICT; INSERT INTO document VALUES ('initial')");
  const authority = new MemoryAuthority();
  const key = Buffer.alloc(32, 41);
  const coordinators: LocalClientProtectedSqliteCheckpoint[] = [];
  function readDataDigest() { return createHash("sha256").update(JSON.stringify(db.prepare("SELECT value FROM document").all())).digest("hex"); }
  function coordinator(bindingId = "test:document", integrityKey = key) {
    const value = new LocalClientProtectedSqliteCheckpoint({ db, integrityKey, bindingId, authority, readDataDigest });
    coordinators.push(value); return value;
  }
  const checkpoint = coordinator();
  finalizers.push(async () => {
    for (const entry of coordinators) await entry.close(); db.close();
    const target = resolve(root);
    if (!target.startsWith(`${resolve(tmpdir())}\\protected-checkpoint-test-`) && !target.startsWith(`${resolve(tmpdir())}/protected-checkpoint-test-`)) throw new Error("Unsafe test cleanup target");
    rmSync(target, { recursive: true, force: true });
  });
  return { root, authority, checkpoint, coordinator, key, readDataDigest, get db() { return db; },
    content: () => String(db.prepare("SELECT value FROM document").get()!.value),
    write: (text: string) => { db.prepare("UPDATE document SET value = ?").run(text); },
    row: () => db.prepare("SELECT generation, digest FROM local_client_protected_checkpoint").get(),
    saveSnapshot() { db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); copyFileSync(sqlitePath, join(root, "snapshot.sqlite")); },
    async restoreSnapshot() {
      for (const entry of coordinators) await entry.close(); db.close();
      copyFileSync(join(root, "snapshot.sqlite"), sqlitePath); db = new DatabaseSync(sqlitePath); return coordinator();
    },
  };
}

function journalFixture() {
  const base = fixture(); const authority = new MemoryAuthority();
  const options = { sqlitePath: join(base.root, "journal.sqlite"), role: "gateway" as const,
    hostId: "protected-journal-test", integrityKey: Buffer.alloc(32, 52), protocolKey: Buffer.alloc(32, 53),
    recoveryEncryptionKey: Buffer.alloc(32, 54), now: () => 1_800_000_000_000,
    protectedAuthority: authority as unknown as LocalClientWindowsProtectedAuthorityAnchor };
  const journal = createLocalClientSqliteExecutionReceiptJournal(options);
  finalizers.push(() => journal.close());
  const identity = { executionId: `lc-exec-${"a".repeat(64)}`, tenantId: "tenant-one", subjectId: "subject-one",
    clientId: "client-one", capabilityId: "local_application", actionId: "invoke",
    planFingerprint: "b".repeat(64), inputSha256: "c".repeat(64) };
  return { authority, journal, options, identity };
}

describe("protected SQLite checkpoint with an in-memory authority model", () => {
  it("rejects uninitialized use before effects and requires explicit baseline enrollment", async () => {
    const f = fixture(); const effect = vi.fn(() => f.write("forbidden"));
    expect(f.checkpoint.status.state).toBe("unverified");
    await expect(f.checkpoint.run(effect)).rejects.toThrow(); expect(effect).not.toHaveBeenCalled();
    expect(f.authority.current).toBeNull();
    const baseline = await f.checkpoint.enrollBaseline();
    expect(baseline).toEqual({ generation: 1, digest: f.readDataDigest() });
    expect(f.row()).toEqual(baseline); expect(f.authority.current).toEqual(baseline);
    expect(f.checkpoint.status.state).toBe("current");
    expect(await f.checkpoint.enrollBaseline()).toEqual(baseline);
  });

  it("commits content and local generation together and returns only after finalization", async () => {
    const f = fixture(); await f.checkpoint.enrollBaseline();
    const finalize = vi.spyOn(f.authority, "finalize");
    await expect(f.checkpoint.run(() => { f.write("committed"); return "acknowledged"; })).resolves.toBe("acknowledged");
    expect(f.content()).toBe("committed");
    expect(f.row()).toEqual({ generation: 2, digest: f.readDataDigest() });
    expect(f.authority.current).toEqual(f.row()); expect(f.authority.pending).toBeNull();
    expect(finalize).toHaveBeenCalledTimes(1);
    await expect(f.checkpoint.run(f.content)).resolves.toBe("committed");
    expect(f.row()!.generation).toBe(2); expect(finalize).toHaveBeenCalledTimes(1);
  });

  it("rolls back content and generation when authority preparation fails before persistence", async () => {
    const f = fixture(); await f.checkpoint.enrollBaseline(); const before = f.row();
    const effect = vi.fn(() => f.write("attempt")); f.authority.failPrepare = "before";
    await expect(f.checkpoint.run(effect)).rejects.toThrow("MODEL_PREPARE_FAILED_BEFORE");
    expect(effect).toHaveBeenCalledTimes(1); expect(f.content()).toBe("initial"); expect(f.row()).toEqual(before);
    expect(f.checkpoint.status.state).toBe("unverified"); expect(f.authority.pending).toBeNull();
  });

  it("never replays a callback when a lost prepare response leaves authority pending but SQLite at its base", async () => {
    const f = fixture(); await f.checkpoint.enrollBaseline(); f.authority.failPrepare = "after";
    const effect = vi.fn(() => f.write("uncertain"));
    await expect(f.checkpoint.run(effect)).rejects.toThrow("MODEL_PREPARE_RESPONSE_LOST");
    expect(f.content()).toBe("initial"); expect(f.row()!.generation).toBe(1); expect(f.authority.pending?.generation).toBe(2);
    await expect(f.checkpoint.run(effect)).rejects.toThrow();
    await expect(f.checkpoint.recover()).rejects.toThrow();
    expect(effect).toHaveBeenCalledTimes(1); expect(f.authority.current?.generation).toBe(1);
  });

  it("requires explicit finalize-only recovery after content was committed but authority finalization failed", async () => {
    const f = fixture(); await f.checkpoint.enrollBaseline(); f.authority.failFinalize = true;
    const effect = vi.fn(() => f.write("durable"));
    await expect(f.checkpoint.run(effect)).rejects.toThrow("MODEL_FINALIZE_UNAVAILABLE");
    expect(f.content()).toBe("durable"); expect(f.row()!.generation).toBe(2);
    await expect(f.checkpoint.run(effect)).rejects.toThrow(); expect(effect).toHaveBeenCalledTimes(1);
    await f.checkpoint.close(); const reopened = f.coordinator();
    await expect(reopened.recover()).resolves.toEqual(f.row());
    expect(effect).toHaveBeenCalledTimes(1); expect(f.authority.pending).toBeNull();
    expect(f.authority.current).toEqual(f.row()); expect(reopened.status.state).toBe("current");
  });

  it("rejects a restored older SQLite snapshot before invoking any callback", async () => {
    const f = fixture(); await f.checkpoint.enrollBaseline(); f.saveSnapshot();
    await f.checkpoint.run(() => f.write("newer")); const advanced = f.authority.current;
    const reopened = await f.restoreSnapshot(); const effect = vi.fn(() => f.write("must not run"));
    expect(f.content()).toBe("initial");
    await expect(reopened.run(effect)).rejects.toThrow(); await expect(reopened.recover()).rejects.toThrow();
    expect(effect).not.toHaveBeenCalled(); expect(f.authority.current).toEqual(advanced);
  });

  it("serializes admitted work and drains it on close while rejecting new calls", async () => {
    const f = fixture(); await f.checkpoint.enrollBaseline(); f.authority.prepareRelease = deferred();
    const order: string[] = [];
    const first = f.checkpoint.run(() => { order.push("first"); f.write("first"); });
    await f.authority.prepareEntered.promise;
    const second = f.checkpoint.run(() => { order.push("second"); expect(f.content()).toBe("first"); f.write("second"); });
    const closing = f.checkpoint.close(); let closed = false; void closing.then(() => { closed = true; });
    await Promise.resolve(); expect(closed).toBe(false); expect(order).toEqual(["first"]);
    await expect(f.checkpoint.run(() => order.push("forbidden"))).rejects.toThrow("CLOSED");
    f.authority.prepareRelease.resolve(); await Promise.all([first, second, closing]);
    expect(order).toEqual(["first", "second"]); expect(f.content()).toBe("second");
    expect(f.authority.current?.generation).toBe(3); expect(f.checkpoint.status.state).toBe("closed");
    expect(f.db.prepare("SELECT 1 AS open").get()!.open).toBe(1);
  });

  it.each(["UPDATE local_client_protected_checkpoint SET generation = generation + 1",
    "DELETE FROM local_client_protected_checkpoint",
    "CREATE TRIGGER hostile AFTER UPDATE ON local_client_protected_checkpoint BEGIN SELECT 1; END"])("rejects checkpoint tampering before effects: %s", async (sql) => {
    const f = fixture(); await f.checkpoint.enrollBaseline(); f.db.exec(sql);
    const effect = vi.fn(() => f.write("forbidden"));
    await expect(f.checkpoint.run(effect)).rejects.toThrow(); expect(effect).not.toHaveBeenCalled();
  });

  it("rejects changed logical data, another binding, and another integrity key", async () => {
    const f = fixture(); await f.checkpoint.enrollBaseline();
    const effect = vi.fn(() => f.write("forbidden"));
    for (const cp of [f.coordinator("another:document"), f.coordinator("test:document", Buffer.alloc(32, 42))]) {
      await expect(cp.run(effect)).rejects.toThrow("INTEGRITY");
    }
    f.write("out-of-band mutation"); await expect(f.checkpoint.run(effect)).rejects.toThrow("DATA_MISMATCH");
    expect(effect).not.toHaveBeenCalled();
  });

  it("rejects an invalid async callback supplied to the trusted synchronous transaction API", async () => {
    const f = fixture(); await f.checkpoint.enrollBaseline();
    await expect(f.checkpoint.run(async () => { f.write("invalid async"); })).rejects.toThrow("ASYNC_OPERATION");
    expect(f.content()).toBe("initial"); expect(f.authority.current?.generation).toBe(1);
  });

  it("rejects a native async callback before invocation so post-await writes cannot escape rollback", async () => {
    const f = fixture(); await f.checkpoint.enrollBaseline(); const continuation = deferred();
    let invoked = 0;
    const operation = async () => { invoked += 1; await continuation.promise; f.write("late unprotected write"); };
    await expect(f.checkpoint.run(operation)).rejects.toThrow("ASYNC_OPERATION");
    continuation.resolve(); await Promise.resolve();
    expect(invoked).toBe(0); expect(f.content()).toBe("initial");
  });

  it("clones the integrity key without taking ownership of caller bytes", async () => {
    const f = fixture(); await f.checkpoint.enrollBaseline(); f.key.fill(0);
    await expect(f.checkpoint.run(() => f.write("with cloned key"))).resolves.toBeUndefined();
    await f.checkpoint.close(); expect(f.key).toEqual(Buffer.alloc(32));
  });

  it("keeps journal dispatch blocked until enrollment and recovers a committed intent without arming it again", async () => {
    const f = journalFixture();
    await expect(f.journal.prepareDispatch(f.identity)).rejects.toThrow();
    await f.journal.enrollProtectedBaseline(); await f.journal.prepareDispatch(f.identity);
    f.authority.failFinalize = true;
    await expect(f.journal.armDispatch(f.identity)).rejects.toThrow();
    const prepareCalls = vi.spyOn(f.authority, "prepareNext");
    await expect(f.journal.armDispatch(f.identity)).rejects.toThrow(); expect(prepareCalls).not.toHaveBeenCalled();
    await f.journal.recoverProtectedCheckpoint();
    const replay = await f.journal.armDispatch(f.identity);
    expect(replay).toMatchObject({ dispatchAllowed: false, replayed: true, intent: { dispatchFencingToken: "1" } });
    expect((await f.journal.armDispatch(f.identity)).intent).toEqual(replay.intent);
    expect(prepareCalls).not.toHaveBeenCalled();
    expect(f.journal.status).toMatchObject({ databaseSnapshotRollbackProtected: false, protectedCheckpointState: "current" });
  });

  it("rejects reopening a protected journal with its protection option removed", async () => {
    const f = journalFixture(); await f.journal.enrollProtectedBaseline(); await f.journal.close();
    const { protectedAuthority: _authority, ...unprotected } = f.options;
    expect(() => createLocalClientSqliteExecutionReceiptJournal(unprotected)).toThrow();
    expect(f.authority.current?.generation).toBe(1);
  });
});
