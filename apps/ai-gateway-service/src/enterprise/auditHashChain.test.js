import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

let createAuditHashChain;

before(async () => {
  const mod = await import("./auditHashChain.js");
  createAuditHashChain = mod.createAuditHashChain;
});

describe("AuditHashChain — basic operations", () => {
  let tempDir;
  let chain;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "audit-hash-test-"));
    chain = createAuditHashChain({ chainPath: join(tempDir, "audit-chain.jsonl") });
  });

  after(async () => {
    // cleanup handled per-test
  });

  it("starts from GENESIS on empty chain", async () => {
    assert.strictEqual(chain.getLastHash(), "GENESIS");
    assert.strictEqual(chain.getEntryCount(), 0);
  });

  it("appends first entry with GENESIS as previousHash", async () => {
    const result = await chain.append({ action: "test.first", outcome: "success" });
    assert.strictEqual(result.seq, 1);
    assert.strictEqual(result.previousHash, "GENESIS");
    assert.ok(result.hash.length === 64, "SHA-256 hex should be 64 chars");
  });

  it("chains entries correctly", async () => {
    const r1 = await chain.append({ action: "first" });
    const r2 = await chain.append({ action: "second" });
    const r3 = await chain.append({ action: "third" });

    assert.strictEqual(r2.previousHash, r1.hash);
    assert.strictEqual(r3.previousHash, r2.hash);
    assert.strictEqual(chain.getEntryCount(), 3);
  });

  it("verify() returns valid for intact chain", async () => {
    await chain.append({ action: "a" });
    await chain.append({ action: "b" });
    await chain.append({ action: "c" });

    const result = await chain.verify();
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.totalEntries, 3);
    assert.strictEqual(result.brokenAt, null);
  });

  it("verify() detects tampered entry", async () => {
    const chainPath = join(tempDir, "audit-chain.jsonl");
    await chain.append({ action: "original" });
    await chain.append({ action: "second" });

    // Tamper with first entry
    const content = await readFile(chainPath, "utf8");
    const lines = content.trim().split("\n");
    const first = JSON.parse(lines[0]);
    first.action = "tampered";
    lines[0] = JSON.stringify(first);
    await writeFile(chainPath, lines.join("\n") + "\n", "utf8");

    const freshChain = createAuditHashChain({ chainPath });
    const result = await freshChain.verify();
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.brokenAt, 0);
    assert.strictEqual(result.reason, "hash_mismatch");
  });

  it("verify() detects deleted entry (broken chain linkage)", async () => {
    const chainPath = join(tempDir, "audit-chain.jsonl");
    await chain.append({ action: "first" });
    await chain.append({ action: "second" });
    await chain.append({ action: "third" });

    // Delete the second entry (middle line)
    const content = await readFile(chainPath, "utf8");
    const lines = content.trim().split("\n");
    lines.splice(1, 1); // remove middle line
    await writeFile(chainPath, lines.join("\n") + "\n", "utf8");

    const freshChain = createAuditHashChain({ chainPath });
    const result = await freshChain.verify();
    assert.strictEqual(result.valid, false);
    // The third entry's previousHash won't match the first entry's hash
    assert.strictEqual(result.brokenAt, 1);
    assert.strictEqual(result.reason, "chain_linkage");
  });

  it("verify() handles empty chain file", async () => {
    const result = await chain.verify();
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.totalEntries, 0);
  });

  it("recovers state from existing chain on restart", async () => {
    const chainPath = join(tempDir, "audit-chain.jsonl");
    await chain.append({ action: "before.restart.1" });
    await chain.append({ action: "before.restart.2" });
    const lastHashBefore = chain.getLastHash();

    // Simulate restart — new instance reading same file
    const freshChain = createAuditHashChain({ chainPath });
    await freshChain.init();

    assert.strictEqual(freshChain.getEntryCount(), 2);
    assert.strictEqual(freshChain.getLastHash(), lastHashBefore);

    // Continue appending
    const r3 = await freshChain.append({ action: "after.restart" });
    assert.strictEqual(r3.seq, 3);
    assert.strictEqual(r3.previousHash, lastHashBefore);

    // Verify entire chain
    const result = await freshChain.verify();
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.totalEntries, 3);
  });

  it("different entries produce different hashes", async () => {
    const r1 = await chain.append({ action: "a" });
    const r2 = await chain.append({ action: "b" });
    assert.notStrictEqual(r1.hash, r2.hash);
  });

  it("preserves all original entry fields", async () => {
    await chain.append({ action: "test", userId: "user-1", outcome: "allowed", details: { ip: "10.0.0.1" } });
    const chainPath = join(tempDir, "audit-chain.jsonl");
    const content = await readFile(chainPath, "utf8");
    const entry = JSON.parse(content.trim());
    assert.strictEqual(entry.action, "test");
    assert.strictEqual(entry.userId, "user-1");
    assert.strictEqual(entry.outcome, "allowed");
    assert.deepStrictEqual(entry.details, { ip: "10.0.0.1" });
    assert.ok(entry.hash);
    assert.ok(entry.previousHash);
    assert.ok(entry.seq);
    assert.ok(entry.chainedAt);
  });
});

describe("AuditHashChain — concurrent appends", () => {
  it("handles sequential rapid appends correctly", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "audit-hash-concurrent-"));
    const chain = createAuditHashChain({ chainPath: join(tempDir, "audit-chain.jsonl") });

    for (let i = 0; i < 20; i++) {
      await chain.append({ action: `rapid-${i}` });
    }

    assert.strictEqual(chain.getEntryCount(), 20);
    const result = await chain.verify();
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.totalEntries, 20);

    await rm(tempDir, { recursive: true, force: true });
  });
});
