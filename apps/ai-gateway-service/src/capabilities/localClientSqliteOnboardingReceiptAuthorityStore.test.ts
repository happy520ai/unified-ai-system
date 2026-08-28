import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  LOCAL_CLIENT_ONBOARDING_ROLLBACK_MUTATION_DELTA_VERSION,
  LOCAL_CLIENT_SQLITE_ONBOARDING_RECEIPT_AUTHORITY_BOUNDARIES,
  LocalClientSqliteOnboardingReceiptAuthorityStore,
  type LocalClientOnboardingAppliedReceiptInput,
  type LocalClientOnboardingReceiptReference,
  type LocalClientOnboardingRollbackAuthorization,
  type LocalClientOnboardingRollbackClaimReference,
  type LocalClientOnboardingRollbackClaimed,
  type LocalClientSqliteOnboardingReceiptAuthorityStoreOptions,
} from "./localClientSqliteOnboardingReceiptAuthorityStore.ts";

const HOST_ID = "fixture-onboarding-receipt-host-01";
const NAMESPACE = "fixture-onboarding-receipt-authority";
const INTEGRITY_KEY = Buffer.alloc(32, 0x63);

describe("LocalClientSqliteOnboardingReceiptAuthorityStore", () => {
  let root = "";
  let sqlitePath = "";
  let now = 1_910_000_000_000;
  let stores: LocalClientSqliteOnboardingReceiptAuthorityStore[] = [];

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "local-client-onboarding-receipts-"));
    sqlitePath = join(root, "receipts.sqlite");
    now = 1_910_000_000_000;
    stores = [];
  });

  afterEach(async () => {
    for (const store of stores) await store.close();
    await rm(root, { recursive: true, force: true });
  });

  function createStore(
    overrides: Partial<LocalClientSqliteOnboardingReceiptAuthorityStoreOptions> = {},
  ) {
    const store = new LocalClientSqliteOnboardingReceiptAuthorityStore({
      sqlitePath,
      hostId: HOST_ID,
      integrityKey: INTEGRITY_KEY,
      namespace: NAMESPACE,
      ttlMs: 1_000,
      leaseTtlMs: 100,
      maxRows: 4,
      busyTimeoutMs: 1_000,
      now: () => now,
      ...overrides,
    });
    stores.push(store);
    return store;
  }

  function applied(
    overrides: Partial<LocalClientOnboardingAppliedReceiptInput> = {},
  ): LocalClientOnboardingAppliedReceiptInput {
    return {
      identityFingerprint: digest("tenant-sensitive-alpha\0subject-sensitive-operator"),
      profileId: "cursor-mcp-json",
      action: "enable",
      receiptDigest: digest("receipt-sensitive-0001"),
      receiptContentFingerprint: digest("receipt-content-sensitive-0001"),
      appliedAt: new Date(now - 10).toISOString(),
      ...overrides,
    };
  }

  it("publishes a redacted WAL/FULL/defensive receipt-authority boundary", async () => {
    const store = createStore();
    expect(store.status).toMatchObject({
      ...LOCAL_CLIENT_SQLITE_ONBOARDING_RECEIPT_AUTHORITY_BOUNDARIES,
      available: true,
      journalMode: "wal",
      synchronous: "full",
      trustedSchema: false,
      defensive: true,
      ttlMs: 1_000,
      leaseTtlMs: 100,
    });
    const serialized = JSON.stringify(store.status);
    expect(serialized).not.toContain(sqlitePath);
    expect(serialized).not.toContain(HOST_ID);
    expect(serialized).not.toContain(NAMESPACE);
    expect(serialized).not.toContain(INTEGRITY_KEY.toString("hex"));
    expect(serialized).not.toContain(applied().identityFingerprint);
    await expect(store.checkHealth()).resolves.toMatchObject({
      receiptCount: 0,
      appliedCount: 0,
      rollbackPendingCount: 0,
      rolledBackCount: 0,
      activeRollbackClaimCount: 0,
    });

    const db = new DatabaseSync(sqlitePath);
    try {
      expect(String((db.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode).toLowerCase())
        .toBe("wal");
      expect(Number((db.prepare("PRAGMA synchronous").get() as { synchronous: number }).synchronous)).toBe(2);
    } finally {
      db.close();
    }
  });

  it("persists an apply receipt across restart and replays exact recording", async () => {
    const first = createStore();
    const input = applied();
    const recorded = await first.recordApplied(input);
    expect(recorded).toMatchObject({
      success: true,
      recorded: true,
      replayed: false,
      status: "applied",
      mutationDelta: null,
    });
    expect("identityFingerprint" in recorded).toBe(false);
    await first.close();

    const restarted = createStore();
    await expect(restarted.recordApplied(input)).resolves.toMatchObject({
      recorded: false,
      replayed: true,
      status: "applied",
    });
    const claimed = await restarted.authorizeRollback(reference(input));
    expect(claimed).toMatchObject({
      claimed: true,
      reclaimed: false,
      status: "rollback-pending",
      mutationDelta: {
        deltaVersion: LOCAL_CLIENT_ONBOARDING_ROLLBACK_MUTATION_DELTA_VERSION,
        apply: true,
        operation: "rollback",
        profileId: input.profileId,
        receiptDigest: input.receiptDigest,
      },
    });
    if (!isClaimed(claimed)) throw new Error("fixture did not claim rollback");
    expect("identityFingerprint" in claimed.mutationDelta).toBe(false);
  });

  it("fails closed for a different tenant-subject fingerprint", async () => {
    const store = createStore();
    const input = applied();
    await store.recordApplied(input);

    await expect(store.authorizeRollback({
      ...reference(input),
      identityFingerprint: digest("tenant-sensitive-alpha\0different-subject"),
    })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CONFLICT",
      statusCode: 409,
    });
    await expect(store.checkHealth()).resolves.toMatchObject({
      appliedCount: 1,
      activeRollbackClaimCount: 0,
    });
  });

  it("rejects receipt, content, profile, and action conflicts", async () => {
    const store = createStore();
    const input = applied();
    await store.recordApplied(input);

    await expect(store.recordApplied({
      ...input,
      receiptContentFingerprint: digest("different-content"),
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CONFLICT" });
    await expect(store.recordApplied({
      ...input,
      receiptDigest: digest("different-receipt"),
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CONFLICT" });
    await expect(store.authorizeRollback({
      ...reference(input),
      profileId: "vscode-mcp-json",
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CONFLICT" });
    await expect(store.authorizeRollback({
      ...reference(input),
      action: "disable",
    })).rejects.toMatchObject({ code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CONFLICT" });
  });

  it("atomically grants only one rollback claimant across two instances", async () => {
    const first = createStore();
    const second = createStore();
    const input = applied();
    await first.recordApplied(input);

    const results = await Promise.all([
      first.authorizeRollback(reference(input)),
      second.authorizeRollback(reference(input)),
    ]);
    expect(results.filter(isClaimed)).toHaveLength(1);
    const inProgress = results.filter((result) => result.inProgress);
    expect(inProgress).toHaveLength(1);
    expect(inProgress[0]).toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_ROLLBACK_IN_PROGRESS",
      mutationDelta: null,
    });
    await expect(first.checkHealth()).resolves.toMatchObject({
      rollbackPendingCount: 1,
      activeRollbackClaimCount: 1,
    });
  });

  it("reclaims an expired lease with a higher fence and rejects stale completion", async () => {
    const first = createStore({ leaseTtlMs: 100 });
    const second = createStore({ leaseTtlMs: 100 });
    const input = applied();
    await first.recordApplied(input);
    const initial = await first.authorizeRollback(reference(input));
    if (!isClaimed(initial)) throw new Error("fixture did not claim rollback");
    now += 100;

    const reclaimed = await second.authorizeRollback(reference(input));
    expect(reclaimed).toMatchObject({
      claimed: true,
      reclaimed: true,
      code: "LOCAL_CLIENT_ONBOARDING_ROLLBACK_RECLAIMED",
      mutationDelta: initial.mutationDelta,
    });
    if (!isClaimed(reclaimed)) throw new Error("fixture did not reclaim rollback");
    expect(BigInt(reclaimed.lease.fencingToken)).toBeGreaterThan(BigInt(initial.lease.fencingToken));
    await expect(first.markRolledBack(claimReference(input, initial))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CLAIM_STALE",
    });
    await expect(second.markRolledBack({
      ...claimReference(input, reclaimed),
      fencingToken: initial.lease.fencingToken,
    })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CLAIM_STALE",
    });
  });

  it("releases a failed rollback claim for immediate retry", async () => {
    const store = createStore();
    const input = applied();
    await store.recordApplied(input);
    const initial = await store.authorizeRollback(reference(input));
    if (!isClaimed(initial)) throw new Error("fixture did not claim rollback");
    await expect(store.releaseRollbackClaim(claimReference(input, initial))).resolves.toMatchObject({
      released: true,
      status: "applied",
      mutationDelta: null,
    });

    const reclaimed = await store.authorizeRollback(reference(input));
    expect(reclaimed).toMatchObject({ claimed: true, reclaimed: true });
    if (!isClaimed(reclaimed)) throw new Error("fixture did not reclaim rollback");
    expect(BigInt(reclaimed.lease.fencingToken)).toBeGreaterThan(BigInt(initial.lease.fencingToken));
    await expect(store.markRolledBack(claimReference(input, initial))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CLAIM_STALE",
    });
  });

  it("marks rollback once, supports idempotent mark, and never redelivers mutation", async () => {
    const store = createStore();
    const input = applied();
    await store.recordApplied(input);
    const claimed = await store.authorizeRollback(reference(input));
    if (!isClaimed(claimed)) throw new Error("fixture did not claim rollback");
    const claim = claimReference(input, claimed);

    await expect(store.markRolledBack(claim)).resolves.toMatchObject({
      marked: true,
      alreadyRolledBack: false,
      status: "rolled-back",
      mutationDelta: null,
    });
    await expect(store.markRolledBack(claim)).resolves.toMatchObject({
      marked: true,
      alreadyRolledBack: true,
      mutationDelta: null,
    });
    await expect(store.authorizeRollback(reference(input))).resolves.toMatchObject({
      claimed: false,
      replayed: true,
      status: "rolled-back",
      code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_ALREADY_ROLLED_BACK",
      mutationDelta: null,
    });
    await expect(store.recordApplied(input)).resolves.toMatchObject({
      recorded: false,
      replayed: true,
      status: "rolled-back",
      mutationDelta: null,
    });
  });

  it("detects row and metadata HMAC tampering", async () => {
    const rowPath = join(root, "row.sqlite");
    const rowStore = createStore({ sqlitePath: rowPath });
    await rowStore.recordApplied(applied());
    await rowStore.close();
    const rowDb = new DatabaseSync(rowPath);
    try {
      rowDb.prepare(`
        UPDATE local_client_onboarding_receipt_authority
        SET action = 'disable'
      `).run();
    } finally {
      rowDb.close();
    }
    expect(() => createStore({ sqlitePath: rowPath })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_INTEGRITY_INVALID",
    }));

    const metadataPath = join(root, "metadata.sqlite");
    const metadataStore = createStore({ sqlitePath: metadataPath });
    await metadataStore.close();
    const metadataDb = new DatabaseSync(metadataPath);
    try {
      metadataDb.prepare(`
        UPDATE local_client_onboarding_receipt_authority_metadata
        SET last_fencing_token = '99'
      `).run();
    } finally {
      metadataDb.close();
    }
    expect(() => createStore({ sqlitePath: metadataPath })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_INTEGRITY_INVALID",
    }));
  });

  it("fails closed on persisted clock rollback", async () => {
    const first = createStore();
    const second = createStore();
    const input = applied();
    await first.recordApplied(input);
    now += 10;
    await second.checkHealth();
    now -= 1;
    await expect(first.authorizeRollback(reference(input))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CLOCK_INVALID",
      category: "integrity",
    });
  });

  it("enforces capacity and purges only after the bounded retention window", async () => {
    const store = createStore({ ttlMs: 100, maxRows: 1 });
    const first = applied();
    const second = applied({
      receiptDigest: digest("receipt-sensitive-0002"),
      receiptContentFingerprint: digest("receipt-content-sensitive-0002"),
    });
    await store.recordApplied(first);
    await expect(store.recordApplied(second)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CAPACITY",
      statusCode: 429,
      retryable: true,
    });
    now += 100;
    await expect(store.recordApplied({
      ...second,
      appliedAt: new Date(now - 10).toISOString(),
    })).resolves.toMatchObject({ recorded: true });
  });

  it("persists only keyed identity binding, digests, and a bearer HMAC", async () => {
    const store = createStore();
    const rawTenant = "tenant-low-entropy";
    const rawSubject = "operator-low-entropy";
    const identityFingerprint = digest(`${rawTenant}\0${rawSubject}`);
    const input = applied({ identityFingerprint });
    await store.recordApplied(input);
    const claimed = await store.authorizeRollback(reference(input));
    if (!isClaimed(claimed)) throw new Error("fixture did not claim rollback");
    const rawBearer = claimed.lease.token;
    await store.close();

    const bytes = await readAllDatabaseBytes(root);
    for (const forbidden of [
      rawTenant,
      rawSubject,
      identityFingerprint,
      rawBearer,
      "C:\\Users\\private\\client.json",
      "powershell.exe -File private.ps1",
      "--api-key secret",
      HOST_ID,
      NAMESPACE,
      INTEGRITY_KEY.toString("hex"),
    ]) expect(bytes).not.toContain(forbidden);

    const db = new DatabaseSync(sqlitePath);
    try {
      const row = db.prepare(`
        SELECT identity_binding_hmac, receipt_digest,
               receipt_content_fingerprint, rollback_token_digest
        FROM local_client_onboarding_receipt_authority
      `).get() as Record<string, unknown>;
      expect(row.identity_binding_hmac).toMatch(/^[a-f0-9]{64}$/u);
      expect(row.identity_binding_hmac).not.toBe(identityFingerprint);
      expect(row.receipt_digest).toBe(input.receiptDigest);
      expect(row.receipt_content_fingerprint).toBe(input.receiptContentFingerprint);
      expect(row.rollback_token_digest).toMatch(/^[a-f0-9]{64}$/u);
    } finally {
      db.close();
    }
  });

  it("binds database to host, namespace, key, and exact configuration", async () => {
    const store = createStore();
    await store.close();
    expect(() => createStore({ hostId: "fixture-onboarding-receipt-host-02" })).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_HOST_MISMATCH" }),
    );
    expect(() => createStore({ namespace: "another-onboarding-authority" })).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CONFIGURATION_INVALID" }),
    );
    expect(() => createStore({ integrityKey: Buffer.alloc(32, 0x36) })).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_KEY_MISMATCH" }),
    );
    expect(() => createStore({ leaseTtlMs: 101 })).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CONFIGURATION_INVALID" }),
    );
  });

  it("rejects raw receipt/config fields, unsafe paths, and use after close", async () => {
    const store = createStore();
    await expect(store.recordApplied({
      ...applied(),
      receipt: { command: "private-command", path: "C:\\private\\client.json" },
    } as never)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_INPUT_INVALID",
    });
    await expect(store.markRolledBack({} as never)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CLAIM_INVALID",
    });
    expect(() => new LocalClientSqliteOnboardingReceiptAuthorityStore({
      sqlitePath: ":memory:",
      hostId: HOST_ID,
      integrityKey: INTEGRITY_KEY,
    })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CONFIGURATION_INVALID",
    }));

    await store.close();
    await expect(store.recordApplied(applied())).rejects.toMatchObject({
      code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_CLOSED",
    });
    expect(INTEGRITY_KEY.equals(Buffer.alloc(32, 0x63))).toBe(true);
  });
});

function reference(
  input: LocalClientOnboardingAppliedReceiptInput,
): LocalClientOnboardingReceiptReference {
  return Object.freeze({
    identityFingerprint: input.identityFingerprint,
    profileId: input.profileId,
    action: input.action,
    receiptDigest: input.receiptDigest,
    receiptContentFingerprint: input.receiptContentFingerprint,
  });
}

function claimReference(
  input: LocalClientOnboardingAppliedReceiptInput,
  claim: LocalClientOnboardingRollbackClaimed,
): LocalClientOnboardingRollbackClaimReference {
  return Object.freeze({
    ...reference(input),
    leaseToken: claim.lease.token,
    fencingToken: claim.lease.fencingToken,
  });
}

function isClaimed(
  result: LocalClientOnboardingRollbackAuthorization,
): result is LocalClientOnboardingRollbackClaimed {
  return result.claimed;
}

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function readAllDatabaseBytes(root: string): Promise<string> {
  const names = await readdir(root);
  const chunks: Buffer[] = [];
  for (const name of names.filter((candidate) => candidate.startsWith("receipts.sqlite"))) {
    chunks.push(await readFile(join(root, name)));
  }
  return Buffer.concat(chunks).toString("latin1");
}
