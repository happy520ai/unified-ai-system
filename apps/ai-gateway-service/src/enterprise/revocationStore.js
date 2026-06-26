/**
 * Unified Persistent Revocation Store
 *
 * Consolidates token/key revocation across multiple subsystems into a single
 * persistent JSON store. Survives service restarts via atomic file writes.
 *
 * Supports four revocation sources:
 *   - api_key: API Key Manager revocations
 *   - enterprise_user: Enterprise Governance user revocations
 *   - autonomy: Autonomy Budget token revocations
 *   - task_claim: Task Claim token revocations
 *
 * Zero external dependencies -- uses Node.js built-in crypto and fs/promises.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";

export function createRevocationStore(options = {}) {
  const storePath = options.storePath ?? ".data/enterprise/revocations.json";
  const revocations = new Map(); // tokenHash -> revocation record
  let dirty = false;
  let loaded = false;

  function normalizeToHash(tokenOrHash) {
    // If it looks like a raw API key (starts with uai-), hash it
    if (typeof tokenOrHash === "string" && tokenOrHash.startsWith("uai-")) {
      return createHash("sha256").update(tokenOrHash).digest("hex");
    }
    // If it's already a hex hash (64 chars), use as-is
    if (typeof tokenOrHash === "string" && /^[a-f0-9]{64}$/i.test(tokenOrHash)) {
      return tokenOrHash.toLowerCase();
    }
    // Otherwise hash it (for enterprise tokens, bearer tokens, etc.)
    return createHash("sha256").update(String(tokenOrHash)).digest("hex");
  }

  async function load() {
    if (loaded) return;
    await mkdir(dirname(storePath), { recursive: true });
    try {
      const raw = await readFile(storePath, "utf8");
      const data = JSON.parse(raw);
      if (data && typeof data === "object" && data.revocations) {
        for (const [hash, record] of Object.entries(data.revocations)) {
          revocations.set(hash, record);
        }
      }
    } catch {
      // File doesn't exist or is corrupt -- start fresh
    }
    loaded = true;
  }

  async function revoke(tokenOrHash, metadata = {}) {
    if (!loaded) await load();
    const hash = normalizeToHash(tokenOrHash);
    if (revocations.has(hash)) {
      return { alreadyRevoked: true, hash, record: revocations.get(hash) };
    }
    const record = {
      revokedAt: new Date().toISOString(),
      revokedBy: metadata.revokedBy ?? "system",
      reason: metadata.reason ?? null,
      source: metadata.source ?? "unknown",
    };
    revocations.set(hash, record);
    dirty = true;
    await flush();
    return { alreadyRevoked: false, hash, record };
  }

  async function isRevoked(tokenOrHash) {
    if (!loaded) await load();
    const hash = normalizeToHash(tokenOrHash);
    return revocations.has(hash);
  }

  async function flush() {
    if (!dirty) return;
    const data = {
      version: 1,
      updatedAt: new Date().toISOString(),
      count: revocations.size,
      revocations: Object.fromEntries(revocations),
    };
    const tmpPath = storePath + ".tmp";
    await writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
    await rename(tmpPath, storePath);
    dirty = false;
  }

  function getStats() {
    const bySource = {};
    for (const record of revocations.values()) {
      bySource[record.source] = (bySource[record.source] ?? 0) + 1;
    }
    return {
      totalRevocations: revocations.size,
      bySource,
      loaded,
      dirty,
      storePath,
    };
  }

  function listRevocations(options = {}) {
    const limit = options.limit ?? 100;
    const source = options.source ?? null;
    const results = [];
    for (const [hash, record] of revocations) {
      if (source && record.source !== source) continue;
      results.push({
        keyFingerprint: hash.slice(0, 12) + "...",
        ...record,
      });
      if (results.length >= limit) break;
    }
    return results;
  }

  return { load, revoke, isRevoked, flush, getStats, listRevocations };
}
