import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ManagedLocalClientPopReplayGuard } from "./localClientPopIdentityAuthority.ts";
import {
  LOCAL_CLIENT_SQLITE_POP_REPLAY_BOUNDARIES,
  LOCAL_CLIENT_SQLITE_POP_REPLAY_SCHEMA_VERSION,
  LocalClientSqlitePopReplayGuard,
  type LocalClientSqlitePopReplayGuardOptions,
} from "./localClientSqlitePopReplayGuard.ts";

const execFileAsync = promisify(execFile);
const HOST_ID = "fixture-pop-replay-host-01";
const NAMESPACE = "fixture-pop-replay";
const KEY_BYTE = 0x5a;
const START_MS = 1_900_000_000_000;

describe("LocalClientSqlitePopReplayGuard", () => {
  let root = "";
  let sqlitePath = "";
  let guards: LocalClientSqlitePopReplayGuard[] = [];

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "local-client-pop-replay-"));
    sqlitePath = join(root, "pop-replay.sqlite");
    guards = [];
  });

  afterEach(async () => {
    for (const guard of guards) guard.close();
    await rm(root, { recursive: true, force: true });
  });

  function createGuard(
    overrides: Partial<LocalClientSqlitePopReplayGuardOptions> = {},
  ): LocalClientSqlitePopReplayGuard {
    const sourceKey = overrides.integrityKey ?? freshKey();
    const guard = new LocalClientSqlitePopReplayGuard({
      sqlitePath,
      hostId: HOST_ID,
      namespace: NAMESPACE,
      maxEntries: 4,
      busyTimeoutMs: 1_000,
      ...overrides,
      integrityKey: sourceKey,
    });
    expect(sourceKey.equals(Buffer.alloc(sourceKey.length))).toBe(true);
    guards.push(guard);
    return guard;
  }

  it("implements the exact durable single-host replay port with WAL/FULL/defensive boundaries", () => {
    const concreteGuard = createGuard();
    const guard: ManagedLocalClientPopReplayGuard = concreteGuard;
    expect(guard.status).toMatchObject({
      available: true,
      durable: true,
      distributed: false,
      mode: "single-host-sqlite-pop-replay",
      authenticatedReplaySet: true,
      snapshotRollbackProtected: false,
      defensiveEnabled: concreteGuard.defensiveEnabled,
      capacityIsolatedByScope: true,
      maxEntries: 4,
      maxEntriesPerScope: 3,
    });
    expect(Object.keys(guard.status)).toHaveLength(10);
    expect(concreteGuard.defensiveEnabled).toBe(typeof (
      DatabaseSync.prototype as DatabaseSync & { enableDefensive?: unknown }
    ).enableDefensive === "function");
      expect(LOCAL_CLIENT_SQLITE_POP_REPLAY_BOUNDARIES).toMatchObject({
      storageMode: "single-host-sqlite-pop-replay",
      journalMode: "wal",
      synchronous: "full",
      trustedSchema: false,
      defensive: "runtime-detected",
      defensiveRequiredForAvailability: false,
        atomicConsume: true,
        capacityIsolation: "per-scope-and-global",
      authenticatedReplaySet: "count+xor-hmac-v1",
      snapshotRollbackProtected: false,
      rowScan: "streamed-and-max-entries-bounded",
      clockRollbackPolicy: "fail-closed",
      rowIntegrity: "hmac-sha256",
        metadataIntegrity: "hmac-sha256",
        rawReplayScopePersisted: false,
        inputIntegrityKeyConsumed: true,
    });

    const db = new DatabaseSync(sqlitePath);
    try {
      expect(String((db.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode).toLowerCase())
        .toBe("wal");
      const metadata = db.prepare(`
        SELECT schema_version, key_binding_hmac, host_binding_hmac,
               namespace_binding_hmac, config_fingerprint, max_entries,
               max_entries_per_scope, busy_timeout_ms, entry_count, entry_accumulator_hmac,
               metadata_hmac
        FROM local_client_pop_replay_metadata
      `).get() as Record<string, unknown>;
      expect(metadata).toMatchObject({
        schema_version: LOCAL_CLIENT_SQLITE_POP_REPLAY_SCHEMA_VERSION,
        max_entries: 4,
        max_entries_per_scope: 3,
        busy_timeout_ms: 1_000,
        entry_count: 0,
      });
      for (const field of [
        "key_binding_hmac",
        "host_binding_hmac",
        "namespace_binding_hmac",
        "config_fingerprint",
        "entry_accumulator_hmac",
        "metadata_hmac",
      ]) expect(metadata[field]).toMatch(/^[a-f0-9]{64}$/u);
    } finally {
      db.close();
    }
  });

  it("rejects the same nonce after restart and persists only keyed replay state", async () => {
    const replayKey = digest("nonce-restart-01");
    const replayScope = digest("scope-restart-01");
    const first = createGuard();
    expect(first.consumeOnce(input(replayKey, START_MS, 1_000, replayScope))).toBe("consumed");
    first.close();

    const second = createGuard();
    expect(second.consumeOnce(input(replayKey, START_MS + 1, 1_000, replayScope))).toBe("replayed");
    second.close();

    const bytes = await readDatabaseFamily(root, "pop-replay.sqlite");
    for (const forbidden of [
      replayKey,
      replayScope,
      HOST_ID,
      NAMESPACE,
      Buffer.alloc(32, KEY_BYTE).toString("hex"),
    ]) expect(bytes.includes(Buffer.from(forbidden, "utf8"))).toBe(false);
    expect(bytes.includes(Buffer.alloc(32, KEY_BYTE))).toBe(false);
    expect(bytes.includes(Buffer.from(replayKey, "hex"))).toBe(false);

    const db = new DatabaseSync(sqlitePath);
    try {
      const row = db.prepare(`
        SELECT replay_key_hmac, scope_hmac, consumed_at_ms, expires_at_ms, row_hmac
        FROM local_client_pop_replay_entries
      `).get() as Record<string, unknown>;
      expect(row.replay_key_hmac).toMatch(/^[a-f0-9]{64}$/u);
      expect(row.scope_hmac).toMatch(/^[a-f0-9]{64}$/u);
      expect(row.row_hmac).toMatch(/^[a-f0-9]{64}$/u);
      expect(row.replay_key_hmac).not.toBe(replayKey);
      expect(row.scope_hmac).not.toBe(replayScope);
    } finally {
      db.close();
    }
  });

  it("allows exactly one consume across two live instances", async () => {
    const first = createGuard();
    const second = createGuard();
    const replayKey = digest("nonce-two-instance-01");
    const results = await Promise.all([
      Promise.resolve().then(() => first.consumeOnce(input(replayKey))),
      Promise.resolve().then(() => second.consumeOnce(input(replayKey))),
    ]);
    expect(results.sort()).toEqual(["consumed", "replayed"]);
  });

  it("allows exactly one consume across two operating-system processes", async () => {
    const initializer = createGuard({ busyTimeoutMs: 5_000 });
    initializer.close();
    const replayKey = digest("nonce-cross-process-01");
    const moduleUrl = pathToFileURL(resolve(
      "apps/ai-gateway-service/src/capabilities/localClientSqlitePopReplayGuard.ts",
    )).href;
    const program = `
      import { LocalClientSqlitePopReplayGuard } from ${JSON.stringify(moduleUrl)};
      const guard = new LocalClientSqlitePopReplayGuard({
        sqlitePath: process.argv[1],
        hostId: ${JSON.stringify(HOST_ID)},
        namespace: ${JSON.stringify(NAMESPACE)},
        integrityKey: Buffer.alloc(32, ${KEY_BYTE}),
        maxEntries: 4,
        busyTimeoutMs: 5000
      });
      try {
        process.stdout.write(guard.consumeOnce({
          replayKeySha256: process.argv[2],
          nowMs: ${START_MS},
          expiresAtMs: ${START_MS + 1_000}
        }));
      } finally {
        guard.close();
      }
    `;
    const runChild = () => execFileAsync(process.execPath, [
      "--no-warnings",
      "--experimental-strip-types",
      "--input-type=module",
      "--eval",
      program,
      sqlitePath,
      replayKey,
    ], { cwd: resolve(".") });
    const results = await Promise.all([runChild(), runChild()]);
    expect(results.map((result) => result.stdout.trim()).sort())
      .toEqual(["consumed", "replayed"]);
  });

  it("atomically isolates per-scope capacity across operating-system processes", async () => {
    const initializer = createGuard({
      sqlitePath: join(root, "scope-cross-process.sqlite"),
      maxEntries: 3,
      maxEntriesPerScope: 1,
      busyTimeoutMs: 5_000,
    });
    initializer.close();
    const processPath = join(root, "scope-cross-process.sqlite");
    const moduleUrl = pathToFileURL(resolve(
      "apps/ai-gateway-service/src/capabilities/localClientSqlitePopReplayGuard.ts",
    )).href;
    const program = `
      import { LocalClientSqlitePopReplayGuard } from ${JSON.stringify(moduleUrl)};
      const guard = new LocalClientSqlitePopReplayGuard({
        sqlitePath: process.argv[1],
        hostId: ${JSON.stringify(HOST_ID)},
        namespace: ${JSON.stringify(NAMESPACE)},
        integrityKey: Buffer.alloc(32, ${KEY_BYTE}),
        maxEntries: 3,
        maxEntriesPerScope: 1,
        busyTimeoutMs: 5000
      });
      try {
        process.stdout.write(guard.consumeOnce({
          replayKeySha256: process.argv[2],
          replayScopeSha256: process.argv[3],
          nowMs: ${START_MS},
          expiresAtMs: ${START_MS + 1_000}
        }));
      } finally {
        guard.close();
      }
    `;
    const runChild = (replayKey: string, replayScope: string) => execFileAsync(process.execPath, [
      "--no-warnings",
      "--experimental-strip-types",
      "--input-type=module",
      "--eval",
      program,
      processPath,
      replayKey,
      replayScope,
    ], { cwd: resolve(".") });
    const scopeA = digest("cross-process-scope-a");
    const sameScopeResults = await Promise.all([
      runChild(digest("cross-process-scope-a-nonce-1"), scopeA),
      runChild(digest("cross-process-scope-a-nonce-2"), scopeA),
    ]);
    expect(sameScopeResults.map((result) => result.stdout.trim()).sort())
      .toEqual(["capacity", "consumed"]);
    await expect(runChild(
      digest("cross-process-scope-b-nonce-1"),
      digest("cross-process-scope-b"),
    )).resolves.toMatchObject({ stdout: "consumed" });
  });

  it("enforces a per-scope quota before the independent global upper bound", () => {
    const guard = createGuard({ maxEntries: 3, maxEntriesPerScope: 2 });
    const scopeA = digest("quota-scope-a");
    const scopeB = digest("quota-scope-b");
    expect(guard.consumeOnce(input(digest("quota-a-1"), START_MS, 1_000, scopeA)))
      .toBe("consumed");
    expect(guard.consumeOnce(input(digest("quota-a-2"), START_MS, 1_000, scopeA)))
      .toBe("consumed");
    expect(guard.consumeOnce(input(digest("quota-a-3"), START_MS, 1_000, scopeA)))
      .toBe("capacity");
    expect(guard.consumeOnce(input(digest("quota-b-1"), START_MS, 1_000, scopeB)))
      .toBe("consumed");
    expect(guard.consumeOnce(input(digest("quota-b-2"), START_MS, 1_000, scopeB)))
      .toBe("capacity");
  });

  it("reserves global capacity for another scope by default", () => {
    const guard = createGuard({ maxEntries: 4 });
    const scopeA = digest("default-quota-scope-a");
    const scopeB = digest("default-quota-scope-b");
    for (let index = 1; index <= 3; index += 1) {
      expect(guard.consumeOnce(input(
        digest(`default-quota-a-${index}`),
        START_MS,
        1_000,
        scopeA,
      ))).toBe("consumed");
    }
    expect(guard.consumeOnce(input(digest("default-quota-a-4"), START_MS, 1_000, scopeA)))
      .toBe("capacity");
    expect(guard.consumeOnce(input(digest("default-quota-b-1"), START_MS, 1_000, scopeB)))
      .toBe("consumed");
  });

  it("preserves scope quota isolation across restart", () => {
    const options = { maxEntries: 3, maxEntriesPerScope: 1 } as const;
    const scopeA = digest("restart-scope-a");
    const scopeB = digest("restart-scope-b");
    const first = createGuard(options);
    expect(first.consumeOnce(input(digest("restart-a-1"), START_MS, 1_000, scopeA)))
      .toBe("consumed");
    first.close();

    const restarted = createGuard(options);
    expect(restarted.consumeOnce(input(digest("restart-a-2"), START_MS + 1, 1_000, scopeA)))
      .toBe("capacity");
    expect(restarted.consumeOnce(input(digest("restart-b-1"), START_MS + 1, 1_000, scopeB)))
      .toBe("consumed");
  });

  it("cleans expired TTL entries before enforcing bounded capacity", () => {
    const guard = createGuard({ maxEntries: 1 });
    expect(guard.consumeOnce(input(digest("nonce-capacity-01"), START_MS, 100))).toBe("consumed");
    expect(guard.consumeOnce(input(digest("nonce-capacity-02"), START_MS + 1, 100)))
      .toBe("capacity");
    expect(guard.consumeOnce(input(digest("nonce-capacity-02"), START_MS + 100, 100)))
      .toBe("consumed");
    expect(guard.consumeOnce(input(digest("nonce-capacity-01"), START_MS + 101, 100)))
      .toBe("capacity");
  });

  it("persists its clock and fails closed on rollback after restart", () => {
    const first = createGuard();
    expect(first.consumeOnce(input(digest("nonce-clock-01"), START_MS + 100))).toBe("consumed");
    first.close();
    const restarted = createGuard();
    expect(() => restarted.consumeOnce(input(digest("nonce-clock-02"), START_MS + 99)))
      .toThrowError(expect.objectContaining({
        code: "LOCAL_CLIENT_POP_REPLAY_CLOCK_ROLLBACK",
        category: "integrity",
      }));
    expect(restarted.status.available).toBe(false);
    expect(restarted.consumeOnce(input(digest("nonce-clock-02"), START_MS + 101)))
      .toBe("consumed");
    expect(restarted.status.available).toBe(true);
  });

  it("detects deleted replay rows and rejects deletion triggers", () => {
    const deletedPath = join(root, "deleted-row.sqlite");
    const deletedGuard = createGuard({ sqlitePath: deletedPath });
    deletedGuard.consumeOnce(input(digest("nonce-deleted-row")));
    deletedGuard.close();
    mutate(deletedPath, "DELETE FROM local_client_pop_replay_entries");
    expect(() => createGuard({ sqlitePath: deletedPath })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_POP_REPLAY_INTEGRITY_INVALID",
    }));

    const triggerPath = join(root, "delete-trigger.sqlite");
    const triggerGuard = createGuard({ sqlitePath: triggerPath });
    mutate(triggerPath, `
      CREATE TRIGGER erase_replay_after_insert
      AFTER INSERT ON local_client_pop_replay_entries
      BEGIN
        DELETE FROM local_client_pop_replay_entries
        WHERE replay_key_hmac = NEW.replay_key_hmac;
      END
    `);
    expect(() => triggerGuard.consumeOnce(input(digest("nonce-trigger-delete"))))
      .toThrowError(expect.objectContaining({
        code: "LOCAL_CLIENT_POP_REPLAY_SCHEMA_INCOMPATIBLE",
      }));
    expect(triggerGuard.status.available).toBe(false);
  });

  it("detects row, scope, and metadata HMAC tampering before cleanup", () => {
    const rowPath = join(root, "row.sqlite");
    const rowGuard = createGuard({ sqlitePath: rowPath });
    rowGuard.consumeOnce(input(digest("nonce-tamper-row")));
    rowGuard.close();
    mutate(rowPath, `
      UPDATE local_client_pop_replay_entries
      SET expires_at_ms = expires_at_ms + 1
    `);
    expect(() => createGuard({ sqlitePath: rowPath })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_POP_REPLAY_INTEGRITY_INVALID",
    }));

    const scopePath = join(root, "scope.sqlite");
    const scopeGuard = createGuard({ sqlitePath: scopePath });
    scopeGuard.consumeOnce(input(
      digest("nonce-tamper-scope"),
      START_MS,
      1_000,
      digest("original-scope"),
    ));
    scopeGuard.close();
    mutate(scopePath, `
      UPDATE local_client_pop_replay_entries
      SET scope_hmac = '${digest("tampered-persisted-scope")}'
    `);
    expect(() => createGuard({ sqlitePath: scopePath })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_POP_REPLAY_INTEGRITY_INVALID",
    }));

    const metadataPath = join(root, "metadata.sqlite");
    const metadataGuard = createGuard({ sqlitePath: metadataPath });
    metadataGuard.close();
    mutate(metadataPath, `
      UPDATE local_client_pop_replay_metadata SET last_clock_ms = 99
    `);
    expect(() => createGuard({ sqlitePath: metadataPath })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_POP_REPLAY_INTEGRITY_INVALID",
    }));
  });

  it("binds the database to its host, namespace, key, and config fingerprint", () => {
    const cases: Array<Readonly<{
      name: string;
      override: Partial<LocalClientSqlitePopReplayGuardOptions>;
      code: string;
    }>> = [
      {
        name: "host",
        override: { hostId: "fixture-pop-replay-host-02" },
        code: "LOCAL_CLIENT_POP_REPLAY_HOST_MISMATCH",
      },
      {
        name: "namespace",
        override: { namespace: "another-pop-replay" },
        code: "LOCAL_CLIENT_POP_REPLAY_NAMESPACE_MISMATCH",
      },
      {
        name: "key",
        override: { integrityKey: Buffer.alloc(32, 0x24) },
        code: "LOCAL_CLIENT_POP_REPLAY_KEY_MISMATCH",
      },
      {
        name: "config",
        override: { maxEntries: 5 },
        code: "LOCAL_CLIENT_POP_REPLAY_CONFIG_MISMATCH",
      },
      {
        name: "scope-config",
        override: { maxEntriesPerScope: 2 },
        code: "LOCAL_CLIENT_POP_REPLAY_CONFIG_MISMATCH",
      },
    ];
    for (const testCase of cases) {
      const casePath = join(root, `${testCase.name}.sqlite`);
      const guard = createGuard({ sqlitePath: casePath });
      guard.close();
      const sourceKey = testCase.override.integrityKey ?? freshKey();
      expect(() => new LocalClientSqlitePopReplayGuard({
        sqlitePath: casePath,
        hostId: HOST_ID,
        namespace: NAMESPACE,
        integrityKey: sourceKey,
        maxEntries: 4,
        busyTimeoutMs: 1_000,
        ...testCase.override,
      })).toThrowError(expect.objectContaining({ code: testCase.code }));
      expect(sourceKey.equals(Buffer.alloc(sourceKey.length))).toBe(true);
    }
  });

  it("strictly rejects malformed input and clears keys on close or failed construction", () => {
    const sourceKey = freshKey();
    const guard = new LocalClientSqlitePopReplayGuard({
      sqlitePath,
      hostId: HOST_ID,
      namespace: NAMESPACE,
      integrityKey: sourceKey,
      maxEntries: 4,
      busyTimeoutMs: 1_000,
    });
    guards.push(guard);
    expect(sourceKey.equals(Buffer.alloc(32))).toBe(true);
    expect(() => guard.consumeOnce({
      ...input(digest("nonce-extra-field")),
      rawNonce: "must-not-be-accepted",
    } as never)).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_POP_REPLAY_INPUT_INVALID",
    }));
    expect(() => guard.consumeOnce(input(digest("nonce-expired"), START_MS, 0)))
      .toThrowError(expect.objectContaining({ code: "LOCAL_CLIENT_POP_REPLAY_INPUT_INVALID" }));
    expect(() => guard.consumeOnce({
      ...input(digest("nonce-invalid-scope")),
      replayScopeSha256: "not-a-digest",
    })).toThrowError(expect.objectContaining({ code: "LOCAL_CLIENT_POP_REPLAY_INPUT_INVALID" }));

    guard.close();
    expect(guard.status).toMatchObject({
      available: false,
      durable: true,
      distributed: false,
      mode: "single-host-sqlite-pop-replay",
      authenticatedReplaySet: true,
      snapshotRollbackProtected: false,
    });
    expect(() => guard.consumeOnce(input(digest("nonce-closed"))))
      .toThrowError(expect.objectContaining({ code: "LOCAL_CLIENT_POP_REPLAY_CLOSED" }));

    const failedKey = freshKey();
    expect(() => new LocalClientSqlitePopReplayGuard({
      sqlitePath: join(root, "invalid.sqlite"),
      hostId: "short",
      namespace: NAMESPACE,
      integrityKey: failedKey,
    })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_POP_REPLAY_CONFIGURATION_INVALID",
    }));
    expect(failedKey.equals(Buffer.alloc(32))).toBe(true);

    const nonIsolatingKey = freshKey();
    expect(() => new LocalClientSqlitePopReplayGuard({
      sqlitePath: join(root, "non-isolating-quota.sqlite"),
      hostId: HOST_ID,
      namespace: NAMESPACE,
      integrityKey: nonIsolatingKey,
      maxEntries: 4,
      maxEntriesPerScope: 4,
    })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_POP_REPLAY_CONFIGURATION_INVALID",
    }));
    expect(nonIsolatingKey.equals(Buffer.alloc(32))).toBe(true);
  });

  it("supports the close(this: void) port contract when close is detached", () => {
    const guard: ManagedLocalClientPopReplayGuard = createGuard();
    const close = guard.close;
    expect(close).toBeTypeOf("function");
    expect(() => close?.()).not.toThrow();
    expect(guard.status.available).toBe(false);
    expect(() => close?.()).not.toThrow();
  });

  it("does not chmod an existing parent directory supplied by the operator", async () => {
    if (process.platform === "win32") return;
    const sharedParent = join(root, "shared-parent");
    await mkdir(sharedParent, { mode: 0o755 });
    await chmod(sharedParent, 0o755);
    const before = (await stat(sharedParent)).mode & 0o777;
    createGuard({ sqlitePath: join(sharedParent, "pop.sqlite") });
    const after = (await stat(sharedParent)).mode & 0o777;
    expect(after).toBe(before);
  });

  it("runs with an honest capability flag when the optional defensive API is unavailable", () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      DatabaseSync.prototype,
      "enableDefensive",
    );
    if (descriptor) {
      Object.defineProperty(DatabaseSync.prototype, "enableDefensive", {
        ...descriptor,
        value: undefined,
      });
    }
    try {
      const guard = createGuard({ sqlitePath: join(root, "no-defensive-api.sqlite") });
      expect(guard.status).toMatchObject({
        available: true,
        durable: true,
        distributed: false,
        mode: "single-host-sqlite-pop-replay",
        authenticatedReplaySet: true,
        snapshotRollbackProtected: false,
        defensiveEnabled: false,
      });
      expect(guard.defensiveEnabled).toBe(false);
      expect(guard.consumeOnce(input(digest("nonce-no-defensive-api")))).toBe("consumed");
    } finally {
      if (descriptor) {
        Object.defineProperty(DatabaseSync.prototype, "enableDefensive", descriptor);
      }
    }
  });

  it("rejects incompatible schema versions", () => {
    const guard = createGuard();
    guard.close();
    mutate(sqlitePath, "PRAGMA user_version = 99");
    expect(() => createGuard()).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_POP_REPLAY_SCHEMA_INCOMPATIBLE",
    }));
  });
});

function freshKey(): Buffer {
  return Buffer.alloc(32, KEY_BYTE);
}

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function input(
  replayKeySha256: string,
  nowMs = START_MS,
  ttlMs = 1_000,
  replayScopeSha256?: string,
) {
  return Object.freeze({
    replayKeySha256,
    ...(replayScopeSha256 === undefined ? {} : { replayScopeSha256 }),
    nowMs,
    expiresAtMs: nowMs + ttlMs,
  });
}

function mutate(path: string, statement: string): void {
  const db = new DatabaseSync(path);
  try { db.exec(statement); } finally { db.close(); }
}

async function readDatabaseFamily(root: string, prefix: string): Promise<Buffer> {
  const names = await readdir(root);
  const chunks: Buffer[] = [];
  for (const name of names.filter((candidate) => candidate.startsWith(prefix))) {
    chunks.push(await readFile(join(root, name)));
  }
  return Buffer.concat(chunks);
}
