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
    let content = null;
    try {
      content = await readFile(chainPath, "utf8");
    } catch {
      // File doesn't exist yet — start from GENESIS
    }
    if (content !== null) {
      // A chain that cannot be parsed (truncation, corruption) must not be
      // silently extended: fail closed instead of continuing from whatever
      // tail happens to remain. Whole-entry removal is still only detectable
      // through verify() or external checkpoints.
      const lines = content.trim().split("\n").filter(Boolean);
      let previousHash = "GENESIS";
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        let entry;
        try {
          entry = JSON.parse(line);
        } catch (error) {
          throw createCorruptChainError("parse_error", index, error);
        }
        const { hash, previousHash: linkedHash, seq, chainedAt, ...rest } = entry ?? {};
        if (linkedHash !== previousHash) {
          throw createCorruptChainError("chain_linkage", index);
        }
        if (seq !== index + 1) {
          throw createCorruptChainError("sequence_mismatch", index);
        }
        const expectedHash = computeHash({ ...rest, seq, chainedAt }, linkedHash);
        if (typeof hash !== "string" || hash !== expectedHash) {
          throw createCorruptChainError("hash_mismatch", index);
        }
        previousHash = hash;
        lastHash = hash;
        entryCount += 1;
      }
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
    try {
      await init();
    } catch (error) {
      if (error?.code === "AUDIT_CHAIN_CORRUPT") {
        return {
          valid: false,
          totalEntries: error.verifiedEntries ?? 0,
          brokenAt: error.brokenAt ?? null,
          reason: error.reason ?? "parse_error",
          error: String(error?.message ?? error),
        };
      }
      throw error;
    }
    let content;
    try {
      content = await readFile(chainPath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") {
        return { valid: true, totalEntries: 0, brokenAt: null };
      }
      return { valid: false, totalEntries: 0, brokenAt: null, reason: "unreadable", error: String(error?.message ?? error) };
    }
    try {
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
    } catch (error) {
      // An unreadable or unparseable chain is a verification failure, never
      // a silent pass.
      return { valid: false, totalEntries: 0, brokenAt: null, reason: "parse_error", error: String(error?.message ?? error) };
    }
  }

  function getLastHash() { return lastHash; }
  function getEntryCount() { return entryCount; }

  function getHealth() {
    return {
      initialized,
      entryCount,
      lastHashFingerprint: lastHash === "GENESIS" ? "GENESIS" : lastHash.slice(0, 12),
      pathExposed: false,
    };
  }

  return { append, verify, getLastHash, getEntryCount, getHealth, init };
}

function createCorruptChainError(reason, brokenAt, cause) {
  const error = new Error("Audit hash chain is corrupt and must be reviewed before appending.");
  error.code = "AUDIT_CHAIN_CORRUPT";
  error.reason = reason;
  error.brokenAt = brokenAt;
  error.verifiedEntries = brokenAt;
  if (cause) error.cause = cause;
  return error;
}
