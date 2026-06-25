import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

let createRevocationStore;

before(async () => {
  const mod = await import("./revocationStore.js");
  createRevocationStore = mod.createRevocationStore;
});

describe("RevocationStore - basic operations", () => {
  const tempDirs = [];
  let tempDir;
  let store;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "revocation-test-"));
    tempDirs.push(tempDir);
    store = createRevocationStore({ storePath: join(tempDir, "revocations.json") });
    await store.load();
  });

  after(async () => {
    for (const dir of tempDirs) {
      try { await rm(dir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
    }
  });

  it("starts empty after load", () => {
    const stats = store.getStats();
    assert.strictEqual(stats.totalRevocations, 0);
    assert.strictEqual(stats.loaded, true);
  });

  it("revokes a hash token", async () => {
    const fakeHash = "a".repeat(64);
    const result = await store.revoke(fakeHash, { source: "api_key", revokedBy: "admin" });
    assert.strictEqual(result.alreadyRevoked, false);
    assert.ok(store.isRevoked(fakeHash));
  });

  it("detects already-revoked token", async () => {
    const fakeHash = "b".repeat(64);
    await store.revoke(fakeHash, { source: "api_key" });
    const result = await store.revoke(fakeHash, { source: "api_key" });
    assert.strictEqual(result.alreadyRevoked, true);
  });

  it("revokes raw API key (uai- prefix) by hashing", async () => {
    const rawKey = "uai-" + "c".repeat(64);
    await store.revoke(rawKey, { source: "api_key" });
    // Should be revoked when checked with raw key
    assert.ok(store.isRevoked(rawKey));
    // Should also be revoked when checked with the computed hash
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256").update(rawKey).digest("hex");
    assert.ok(store.isRevoked(hash));
  });

  it("returns false for non-revoked token", () => {
    assert.strictEqual(store.isRevoked("d".repeat(64)), false);
  });

  it("persists to disk via atomic write (.tmp + rename)", async () => {
    const storePath = join(tempDir, "revocations.json");
    const fakeHash = "e".repeat(64);
    await store.revoke(fakeHash, { source: "enterprise_user" });

    // Verify file exists and is valid JSON
    const content = await readFile(storePath, "utf8");
    const data = JSON.parse(content);
    assert.strictEqual(data.version, 1);
    assert.ok(data.revocations[fakeHash]);
    assert.strictEqual(data.revocations[fakeHash].source, "enterprise_user");

    // Verify .tmp file does NOT remain
    try {
      await stat(storePath + ".tmp");
      assert.fail(".tmp file should not exist after flush");
    } catch (e) {
      assert.ok(e.code === "ENOENT", ".tmp should be cleaned up");
    }
  });

  it("survives simulated restart (flush -> new instance -> load)", async () => {
    const storePath = join(tempDir, "revocations.json");
    const hash1 = "f".repeat(64);
    const hash2 = "1".repeat(64);
    await store.revoke(hash1, { source: "api_key", reason: "compromised" });
    await store.revoke(hash2, { source: "autonomy", reason: "budget_exceeded" });

    // Simulate restart -- create new store instance
    const freshStore = createRevocationStore({ storePath });
    await freshStore.load();

    assert.ok(freshStore.isRevoked(hash1));
    assert.ok(freshStore.isRevoked(hash2));
    assert.strictEqual(freshStore.getStats().totalRevocations, 2);
  });

  it("tracks revocations by source", async () => {
    await store.revoke("a".repeat(64), { source: "api_key" });
    await store.revoke("b".repeat(64), { source: "api_key" });
    await store.revoke("c".repeat(64), { source: "enterprise_user" });

    const stats = store.getStats();
    assert.strictEqual(stats.bySource.api_key, 2);
    assert.strictEqual(stats.bySource.enterprise_user, 1);
    assert.strictEqual(stats.totalRevocations, 3);
  });

  it("listRevocations returns entries with fingerprint", async () => {
    await store.revoke("a".repeat(64), { source: "api_key" });
    await store.revoke("b".repeat(64), { source: "enterprise_user" });

    const list = store.listRevocations();
    assert.strictEqual(list.length, 2);
    assert.ok(list[0].keyFingerprint.endsWith("..."));
    assert.ok(list[0].revokedAt);
  });

  it("listRevocations filters by source", async () => {
    await store.revoke("a".repeat(64), { source: "api_key" });
    await store.revoke("b".repeat(64), { source: "enterprise_user" });

    const apiKeyOnly = store.listRevocations({ source: "api_key" });
    assert.strictEqual(apiKeyOnly.length, 1);
  });

  it("handles corrupt store file gracefully", async () => {
    const storePath = join(tempDir, "revocations.json");
    await writeFile(storePath, "NOT VALID JSON{{{", "utf8");

    const freshStore = createRevocationStore({ storePath });
    await freshStore.load(); // Should not throw
    assert.strictEqual(freshStore.getStats().totalRevocations, 0);
  });

  it("handles missing store directory (creates it)", async () => {
    const deepPath = join(tempDir, "deep", "nested", "dir", "revocations.json");
    const deepStore = createRevocationStore({ storePath: deepPath });
    await deepStore.load();
    await deepStore.revoke("a".repeat(64), { source: "api_key" });
    assert.ok(deepStore.isRevoked("a".repeat(64)));
  });
});

describe("RevocationStore - concurrent operations", () => {
  const tempDirs = [];

  after(async () => {
    for (const dir of tempDirs) {
      try { await rm(dir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
    }
  });

  it("handles 10 sequential revocations correctly", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "revocation-concurrent-"));
    tempDirs.push(tempDir);
    const store = createRevocationStore({ storePath: join(tempDir, "revocations.json") });
    await store.load();

    for (let i = 0; i < 10; i++) {
      const hash = i.toString(16).padStart(64, "0");
      await store.revoke(hash, { source: "api_key" });
    }

    assert.strictEqual(store.getStats().totalRevocations, 10);

    // Verify all are revoked
    for (let i = 0; i < 10; i++) {
      const hash = i.toString(16).padStart(64, "0");
      assert.ok(store.isRevoked(hash), `Hash ${i} should be revoked`);
    }
  });
});
