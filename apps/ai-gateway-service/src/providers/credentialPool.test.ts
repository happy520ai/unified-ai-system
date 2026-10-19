// =============================================================================
// credentialPool.test.ts — 多 Key 池单元测试
//
// 覆盖：加权分布、过期/零余额跳过、鉴权失败拉黑、指纹掩码、加密持久化往返。
// 全部零网络、零真实凭据。
// =============================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCredentialPool, fingerprintKey } from "./credentialPool.ts";
import type { CredentialPoolOptions, PoolEntry } from "./credentialPool.ts";

const MASTER_KEY = "base64:" + Buffer.alloc(32, 7).toString("base64");

function futureDate(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

function entry(key: string, balance: number, expire: string | null = null, label = ""): PoolEntry {
  return { key, balance, expire, label };
}

function newPool(options: Partial<CredentialPoolOptions> = {}) {
  return createCredentialPool({ env: {}, ...options });
}

/** pick() must yield a key here; fail loudly instead of comparing null. */
function pickOf(pool: ReturnType<typeof createCredentialPool>, providerId: string): string {
  const k = pool.pick(providerId);
  assert.ok(k, `expected a usable key for ${providerId}`);
  return k;
}

/** describe() must be present for these assertions; fail loudly if it is not. */
function descOf(pool: ReturnType<typeof createCredentialPool>, providerId: string) {
  const d = pool.describe(providerId);
  assert.ok(d, `expected a pool description for ${providerId}`);
  return d;
}

describe("CredentialPool", () => {
  it("is inactive for an unconfigured provider", () => {
    const pool = createCredentialPool({ env: {} });
    assert.equal(pool.has("nobody"), false);
    assert.equal(pool.pick("nobody"), null);
    assert.equal(pool.describe("nobody"), null);
  });

  it("selects only from usable keys and skips expired/zero-balance entries", () => {
    const pool = createCredentialPool({ env: {} });
    pool.set("p1", [
      { key: "sk-live", balance: 10, expire: futureDate(5) },
      { key: "sk-expired", balance: 100, expire: futureDate(-1) },
      { key: "sk-broke", balance: 0, expire: futureDate(5) },
    ]);
    const picked = new Set<string>();
    for (let i = 0; i < 200; i++) picked.add(pickOf(pool, "p1"));
    assert.deepEqual([...picked], ["sk-live"]);
    const desc = descOf(pool, "p1");
    assert.equal(desc.size, 3);
    assert.equal(desc.alive, 1);
    assert.equal(desc.exhausted, 2);
  });

  it("weights selection toward higher balance and longer remaining validity", () => {
    const pool = createCredentialPool({
      env: {},
      random: () => 0.5,
    });
    pool.set("p2", [
      { key: "sk-big-long", balance: 1000, expire: futureDate(30) },
      { key: "sk-small-short", balance: 1, expire: futureDate(1) },
    ]);
    const counts: Record<string, number> = { "sk-big-long": 0, "sk-small-short": 0 };
    for (let i = 0; i < 500; i++) counts[pickOf(pool, "p2")] += 1;
    assert.ok(counts["sk-big-long"] > counts["sk-small-short"] * 5,
      `expected heavy skew, saw ${JSON.stringify(counts)}`);
  });

  it("benches a key after a failure and returns it once the bench expires", () => {
    let clock = 1_000_000;
    const pool = createCredentialPool({ env: {}, now: () => clock, benchMs: 1000 });
    pool.set("p3", [
      { key: "sk-a", balance: 10, expire: futureDate(10) },
      { key: "sk-b", balance: 10, expire: futureDate(10) },
    ]);
    pool.record("p3", "sk-a", false, { benchOnFailure: true });
    assert.equal(descOf(pool, "p3").benched, 1);
    assert.equal(descOf(pool, "p3").alive, 1);
    for (let i = 0; i < 50; i++) assert.equal(pickOf(pool, "p3"), "sk-b");

    clock += 1001;
    assert.equal(descOf(pool, "p3").benched, 0);
    assert.equal(descOf(pool, "p3").alive, 2);
  });

  it("does not bench on a non-auth failure and clears a bench on success", () => {
    let clock = 1_000_000;
    const pool = createCredentialPool({ env: {}, now: () => clock, benchMs: 1000 });
    pool.set("p4", [{ key: "sk-a", balance: 10, expire: futureDate(10) }]);
    pool.record("p4", "sk-a", false, { benchOnFailure: false });
    assert.equal(descOf(pool, "p4").benched, 0);
    pool.record("p4", "sk-a", false, { benchOnFailure: true });
    assert.equal(descOf(pool, "p4").benched, 1);
    pool.record("p4", "sk-a", true);
    assert.equal(descOf(pool, "p4").benched, 0);
  });

  it("returns null instead of throwing when every key is benched", () => {
    let clock = 1_000_000;
    const pool = createCredentialPool({ env: {}, now: () => clock, benchMs: 60_000 });
    pool.set("p5", [{ key: "sk-only", balance: 5, expire: futureDate(3) }]);
    pool.record("p5", "sk-only", false, { benchOnFailure: true });
    assert.equal(pool.pick("p5"), null);
    assert.equal(pool.has("p5"), true, "a fully benched pool still exists");
  });

  it("deduplicates repeated keys in one set() call", () => {
    const pool = createCredentialPool({ env: {} });
    pool.set("p6", [
      { key: "sk-dup", balance: 1, expire: futureDate(1) },
      { key: "sk-dup", balance: 99, expire: futureDate(20) },
    ]);
    assert.equal(descOf(pool, "p6").size, 1);
  });

  it("never exposes a raw key through the fingerprint", () => {
    const secret = "sk-test-secret-value";
    const fp = fingerprintKey(secret);
    assert.ok(!fp.includes(secret));
    assert.ok(fp.length < secret.length);
    assert.equal(fp, fingerprintKey(secret), "fingerprint must be stable");
  });
});

describe("CredentialPool encryption", () => {
  it("round-trips a large pool through the encrypted store without a size cap", () => {
    const dir = mkdtempSync(join(tmpdir(), "pool-"));
    const path = join(dir, "pool.json");
    const env = { PME_RUNTIME_CREDENTIAL_MASTER_KEY: MASTER_KEY, PME_CREDENTIAL_POOL_STORE_MODE: "local-file" };
    try {
      const pool = createCredentialPool({ env, storagePath: path });
      const entries = Array.from({ length: 3000 }, (_, i) => ({
        key: `sk-bulk-${String(i).padStart(6, "0")}-${"x".repeat(40)}`,
        balance: 10 + (i % 50),
        expire: futureDate(1 + (i % 30)),
      }));
      const described = pool.set("bulk", entries);
      assert.equal(described.size, 3000);

      // Ciphertext on disk, never plaintext keys.
      const raw = readFileSync(path, "utf8");
      assert.ok(!raw.includes("sk-bulk-000000"), "plaintext key must not be on disk");
      assert.ok(raw.includes("AES-256-GCM"));

      const reloaded = createCredentialPool({ env, storagePath: path });
      assert.equal(reloaded.has("bulk"), true);
      assert.equal(descOf(reloaded, "bulk").size, 3000);
      assert.ok(pickOf(reloaded, "bulk").startsWith("sk-bulk-"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails closed at construction when encrypted mode has no master key", () => {
    const dir = mkdtempSync(join(tmpdir(), "pool-nofail-"));
    try {
      // No master key configured -> the store must refuse to construct rather
      // than silently run unencrypted or accept credentials it cannot persist.
      assert.throws(
        () => createCredentialPool({
          env: { PME_CREDENTIAL_POOL_STORE_MODE: "local-file" },
          storagePath: join(dir, "pool.json"),
        }),
        /RUNTIME_CREDENTIAL_MASTER_KEY_REQUIRED|master key/i,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
