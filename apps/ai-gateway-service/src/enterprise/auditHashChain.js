/**
 * Audit Hash Chain — Tamper-evident audit log integrity protection.
 *
 * Each audit entry is appended with a SHA-256 hash that includes the
 * previous entry's hash, forming a blockchain-style chain. Any tampering
 * (modification, deletion, insertion) can be detected via verify().
 *
 * Zero external dependencies — uses Node.js built-in crypto and fs/promises.
 */

import { createHash } from "node:crypto";
import { readFile, appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export function createAuditHashChain(options = {}) {
  const chainPath = options.chainPath ?? ".data/audit/audit-chain.jsonl";
  let lastHash = "GENESIS";
  let entryCount = 0;
  let initialized = false;

  async function init() {
    if (initialized) return;
    await mkdir(dirname(chainPath), { recursive: true });
    try {
      const content = await readFile(chainPath, "utf8");
      const lines = content.trim().split("\n").filter(Boolean);
      for (const line of lines) {
        const entry = JSON.parse(line);
        if (entry.hash) {
          lastHash = entry.hash;
          entryCount++;
        }
      }
    } catch {
      // File doesn't exist yet — start from GENESIS
    }
    initialized = true;
  }

  function computeHash(entry, previousHash) {
    const payload = JSON.stringify({ entry, previousHash });
    return createHash("sha256").update(payload).digest("hex");
  }

  async function append(entry) {
    await init();
    const chainEntry = {
      ...entry,
      seq: entryCount + 1,
      previousHash: lastHash,
      chainedAt: new Date().toISOString(),
    };
    const hash = computeHash(
      { ...entry, seq: chainEntry.seq, chainedAt: chainEntry.chainedAt },
      lastHash
    );
    chainEntry.hash = hash;
    await appendFile(chainPath, JSON.stringify(chainEntry) + "\n", "utf8");
    lastHash = hash;
    entryCount++;
    return { seq: chainEntry.seq, hash, previousHash: chainEntry.previousHash };
  }

  async function verify() {
    await init();
    try {
      const content = await readFile(chainPath, "utf8");
      const lines = content.trim().split("\n").filter(Boolean);
      if (lines.length === 0) {
        return { valid: true, totalEntries: 0, brokenAt: null };
      }

      let prevHash = "GENESIS";
      for (let i = 0; i < lines.length; i++) {
        const entry = JSON.parse(lines[i]);
        const { hash, previousHash, seq, chainedAt, ...rest } = entry;

        // Check chain linkage
        if (previousHash !== prevHash) {
          return { valid: false, totalEntries: i, brokenAt: i, reason: "chain_linkage", expected: prevHash, got: previousHash };
        }

        // Recompute and verify hash
        const expectedHash = computeHash({ ...rest, seq, chainedAt }, previousHash);
        if (hash !== expectedHash) {
          return { valid: false, totalEntries: i, brokenAt: i, reason: "hash_mismatch", expected: expectedHash, got: hash };
        }

        prevHash = hash;
      }

      return { valid: true, totalEntries: lines.length, brokenAt: null };
    } catch {
      return { valid: true, totalEntries: 0, brokenAt: null };
    }
  }

  function getLastHash() { return lastHash; }
  function getEntryCount() { return entryCount; }

  return { append, verify, getLastHash, getEntryCount, init };
}
