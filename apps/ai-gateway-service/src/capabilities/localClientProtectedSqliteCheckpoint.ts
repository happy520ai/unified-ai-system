import { createHmac, timingSafeEqual } from "node:crypto";
import { types } from "node:util";
import type { DatabaseSync } from "node:sqlite";
import type { LocalClientWindowsProtectedAuthorityAnchor } from "./localClientWindowsProtectedAuthorityAnchor.ts";

const TABLE = "local_client_protected_checkpoint";
const SCHEMA = `CREATE TABLE ${TABLE} (id INTEGER PRIMARY KEY CHECK (id = 1), generation INTEGER NOT NULL, digest TEXT NOT NULL, mac TEXT NOT NULL) STRICT`;
type Checkpoint = Readonly<{ generation: number; digest: string }>;
type Authority = Pick<LocalClientWindowsProtectedAuthorityAnchor,
  "inspect" | "assertCurrent" | "prepareNext" | "finalize" | "enrollBaseline">;

/** Coordinates one already authenticated logical store with one independently
 * provisioned authority slot. It owns neither the DB nor the authority. A local
 * base plus a pending authority is intentionally NOT repaired by replaying work.
 * This module cannot attest OS provisioning or make an execution target ready. */
export class LocalClientProtectedSqliteCheckpoint {
  readonly #db: DatabaseSync;
  readonly #key: Buffer;
  readonly #binding: string;
  readonly #authority: Authority;
  readonly #readDataDigest: () => string;
  #tail: Promise<void> = Promise.resolve();
  #closing = false;
  #state: "unverified" | "current" | "closed" = "unverified";
  #closePromise: Promise<void> | null = null;

  constructor(options: { db: DatabaseSync; integrityKey: Uint8Array; bindingId: string;
    authority: Authority; readDataDigest: () => string }) {
    if (!(options.integrityKey instanceof Uint8Array) || options.integrityKey.byteLength < 32
      || options.integrityKey.byteLength > 64 || typeof options.bindingId !== "string"
      || !/^[A-Za-z0-9._:-]{1,256}$/u.test(options.bindingId)
      || typeof options.readDataDigest !== "function"
      || ["inspect", "assertCurrent", "prepareNext", "finalize", "enrollBaseline"]
        .some(name => typeof options.authority?.[name as keyof Authority] !== "function")) fail("CONFIGURATION");
    this.#db = options.db;
    this.#key = Buffer.from(options.integrityKey);
    this.#binding = options.bindingId;
    this.#authority = options.authority;
    this.#readDataDigest = options.readDataDigest;
  }

  get status() { return Object.freeze({ state: this.#state }); }

  /** Explicit administrative enrollment; never called by run(), reads or startup.
   * After a lost enrollment reply the exact generation-one baseline may retry.
   * Enrollment failure leaves a local baseline unusable until explicitly resolved. */
  enrollBaseline(): Promise<Checkpoint> {
    return this.#enqueue(async () => {
      let began = false;
      try {
        this.#state = "unverified";
        this.#db.exec("BEGIN IMMEDIATE"); began = true;
        const digest = this.#dataDigest();
        if (!this.#db.prepare("SELECT name FROM sqlite_schema WHERE name = ?").get(TABLE)) {
          this.#db.exec(SCHEMA);
          this.#write({ generation: 1, digest }, true);
        }
        const checkpoint = this.#read();
        if (checkpoint.generation !== 1 || checkpoint.digest !== digest) fail("BASELINE_MISMATCH");
        this.#db.exec("COMMIT"); began = false;
        await this.#authority.enrollBaseline(digest);
        await this.#authority.assertCurrent(1, digest);
        this.#state = "current";
        return checkpoint;
      } catch (error) {
        if (began) this.#rollback();
        throw error;
      }
    });
  }

  /** Recovery authenticates existing bytes and may only finalize their anchor.
   * It cannot accept a callback, create an intent, or repeat an external effect. */
  recover(): Promise<Checkpoint> {
    return this.#enqueue(async () => {
      this.#state = "unverified";
      let began = false;
      try {
        this.#db.exec("BEGIN IMMEDIATE"); began = true;
        const checkpoint = this.#read();
        if (checkpoint.digest !== this.#dataDigest()) fail("DATA_MISMATCH");
        const authority = await this.#authority.inspect();
        if (authority.state === "pending-recovery") {
          if (authority.pendingGeneration !== checkpoint.generation || authority.pendingDigest !== checkpoint.digest) {
            fail("PENDING_BASE_REQUIRES_RECOVERY");
          }
          await this.#authority.finalize(checkpoint.generation, checkpoint.digest);
        }
        await this.#authority.assertCurrent(checkpoint.generation, checkpoint.digest);
        this.#db.exec("COMMIT"); began = false;
        this.#state = "current";
        return checkpoint;
      } catch (error) {
        if (began) this.#rollback();
        throw error;
      }
    });
  }

  run<T>(operation: () => T): Promise<T> {
    // Internal callbacks must remain synchronous SQL-only work. Reject native
    // async functions before invocation; thenable-returning ordinary functions
    // are also invalid, but this boundary is not an arbitrary-code sandbox.
    if (types.isAsyncFunction(operation)) return Promise.reject(new Error("LOCAL_CLIENT_PROTECTED_CHECKPOINT_ASYNC_OPERATION"));
    return this.#enqueue(async () => {
      this.#state = "unverified";
      let began = false;
      try {
        // The write lock spans the asynchronous authority exchange. Every caller
        // sharing this handle is queued, and other connections cannot commit here.
        this.#db.exec("BEGIN IMMEDIATE"); began = true;
        const before = this.#read();
        if (before.digest !== this.#dataDigest()) fail("DATA_MISMATCH");
        const authority = await this.#authority.inspect();
        if (authority.state === "pending-recovery") fail("PENDING_REQUIRES_RECOVERY");
        await this.#authority.assertCurrent(before.generation, before.digest);
        const value = operation();
        if (value && typeof (value as { then?: unknown }).then === "function") fail("ASYNC_OPERATION");
        const digest = this.#dataDigest();
        let after = before;
        if (digest !== before.digest) {
          if (before.generation === Number.MAX_SAFE_INTEGER) fail("CAPACITY");
          after = { generation: before.generation + 1, digest };
          await this.#authority.prepareNext(before.generation, digest);
          this.#write(after, false);
        }
        this.#db.exec("COMMIT"); began = false;
        if (after !== before) await this.#authority.finalize(after.generation, after.digest);
        await this.#authority.assertCurrent(after.generation, after.digest);
        this.#state = "current";
        return value;
      } catch (error) {
        if (began) this.#rollback();
        throw error;
      }
    });
  }

  close(): Promise<void> {
    if (this.#closePromise) return this.#closePromise;
    this.#closing = true;
    this.#closePromise = this.#tail.then(() => { this.#key.fill(0); this.#state = "closed"; });
    return this.#closePromise;
  }

  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.#closing) return Promise.reject(new Error("LOCAL_CLIENT_PROTECTED_CHECKPOINT_CLOSED"));
    const result = this.#tail.then(operation);
    this.#tail = result.then(() => undefined, () => undefined);
    return result;
  }
  #rollback() {
    try { this.#db.exec("ROLLBACK"); } catch {
      this.#closing = true;
      this.#key.fill(0);
      this.#state = "closed";
      fail("ROLLBACK_FAILED");
    }
  }
  #dataDigest() {
    const digest = this.#readDataDigest();
    if (!validDigest(digest)) fail("DATA_DIGEST_INVALID");
    return digest;
  }
  #mac(value: Checkpoint) {
    return createHmac("sha256", this.#key)
      .update(JSON.stringify(["local-client-protected-checkpoint-v1", this.#binding, value.generation, value.digest])).digest("hex");
  }
  #read(): Checkpoint {
    const schema = this.#db.prepare("SELECT type, sql FROM sqlite_schema WHERE name = ?").get(TABLE);
    if (!schema || schema.type !== "table" || schema.sql !== SCHEMA) fail("SCHEMA_INVALID");
    if (this.#db.prepare("SELECT name FROM sqlite_schema WHERE type = 'trigger' AND tbl_name = ? LIMIT 1").get(TABLE)) fail("SCHEMA_INVALID");
    const rows = this.#db.prepare(`SELECT id, generation, digest, mac FROM ${TABLE} LIMIT 2`).all();
    const row = rows[0];
    if (rows.length !== 1 || row?.id !== 1 || !Number.isSafeInteger(row.generation)
      || Number(row.generation) < 1 || !validDigest(row.digest) || !validDigest(row.mac)) fail("INTEGRITY_INVALID");
    const checkpoint = Object.freeze({ generation: Number(row.generation), digest: String(row.digest) });
    if (!timingSafeEqual(Buffer.from(String(row.mac), "hex"), Buffer.from(this.#mac(checkpoint), "hex"))) fail("INTEGRITY_INVALID");
    return checkpoint;
  }
  #write(checkpoint: Checkpoint, insert: boolean) {
    const result = this.#db.prepare(insert
      ? `INSERT INTO ${TABLE} (id, generation, digest, mac) VALUES (1, ?, ?, ?)`
      : `UPDATE ${TABLE} SET generation = ?, digest = ?, mac = ? WHERE id = 1`)
      .run(checkpoint.generation, checkpoint.digest, this.#mac(checkpoint));
    if (result.changes !== 1) fail("INTEGRITY_INVALID");
  }
}

function validDigest(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value); }
function fail(reason: string): never { throw new Error(`LOCAL_CLIENT_PROTECTED_CHECKPOINT_${reason}`); }
