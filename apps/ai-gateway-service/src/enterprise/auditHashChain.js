/**
 * Audit Hash Chain — tamper-evident, cross-process-safe local audit integrity.
 *
 * Every entry includes the previous entry hash. Appends and verification use an
 * adjacent exclusive lock file so two gateway processes cannot both extend the
 * same tail. The whole chain is revalidated while the lock is held; stale local
 * state is never trusted for an append.
 *
 * This detects modification, middle deletion, insertion, corruption, and
 * concurrent-writer races. Detecting a complete rollback or replacement still
 * requires a checkpoint stored outside the writable gateway filesystem.
 */

import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  stat,
  unlink,
  utimes,
} from "node:fs/promises";
import { dirname } from "node:path";
import { hostname } from "node:os";
import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_LOCK_TIMEOUT_MS = 5_000;
const DEFAULT_STALE_LOCK_MS = 60_000;
const DEFAULT_LOCK_RETRY_MIN_MS = 10;
const DEFAULT_LOCK_RETRY_MAX_MS = 100;

export function createAuditHashChain(options = {}) {
  const chainPath = options.chainPath ?? ".data/audit/audit-chain.jsonl";
  const lockPath = options.lockPath ?? `${chainPath}.lock`;
  const lockTimeoutMs = clampInteger(options.lockTimeoutMs, DEFAULT_LOCK_TIMEOUT_MS, 100, 60_000);
  const staleLockMs = clampInteger(options.staleLockMs, DEFAULT_STALE_LOCK_MS, 1_000, 10 * 60_000);
  const lockRetryMinMs = clampInteger(options.lockRetryMinMs, DEFAULT_LOCK_RETRY_MIN_MS, 1, 1_000);
  const lockRetryMaxMs = clampInteger(
    options.lockRetryMaxMs,
    DEFAULT_LOCK_RETRY_MAX_MS,
    lockRetryMinMs,
    2_000,
  );
  let lastHash = "GENESIS";
  let entryCount = 0;
  let initialized = false;
  let lockContentionCount = 0;
  let staleLockRecoveryCount = 0;
  let lockTimeoutCount = 0;

  function computeHash(entry, previousHash) {
    const payload = JSON.stringify({ entry, previousHash });
    return createHash("sha256").update(payload).digest("hex");
  }

  async function readVerifiedState() {
    let content;
    try {
      content = await readFile(chainPath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") {
        lastHash = "GENESIS";
        entryCount = 0;
        initialized = true;
        return { lastHash, entryCount };
      }
      throw error;
    }

    const lines = content.trim().split("\n").filter(Boolean);
    let previousHash = "GENESIS";
    for (let index = 0; index < lines.length; index += 1) {
      let entry;
      try {
        entry = JSON.parse(lines[index]);
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
    }

    lastHash = previousHash;
    entryCount = lines.length;
    initialized = true;
    return { lastHash, entryCount };
  }

  async function withChainLock(operation) {
    await mkdir(dirname(chainPath), { recursive: true });
    const lock = await acquireExclusiveLock({
      lockPath,
      timeoutMs: lockTimeoutMs,
      staleMs: staleLockMs,
      retryMinMs: lockRetryMinMs,
      retryMaxMs: lockRetryMaxMs,
      onContention: () => { lockContentionCount += 1; },
      onStaleRecovery: () => { staleLockRecoveryCount += 1; },
      onTimeout: () => { lockTimeoutCount += 1; },
    });
    try {
      return await operation();
    } finally {
      await lock.release();
    }
  }

  async function init() {
    if (initialized) return;
    await withChainLock(readVerifiedState);
  }

  async function append(entry) {
    return withChainLock(async () => {
      // Another process may have appended since this instance initialized.
      // Always derive the next sequence and hash from a freshly verified tail.
      await readVerifiedState();
      const chainEntry = {
        ...entry,
        seq: entryCount + 1,
        previousHash: lastHash,
        chainedAt: new Date().toISOString(),
      };
      const hash = computeHash(
        { ...entry, seq: chainEntry.seq, chainedAt: chainEntry.chainedAt },
        lastHash,
      );
      chainEntry.hash = hash;

      const descriptor = await open(chainPath, "a", 0o600);
      try {
        await descriptor.writeFile(`${JSON.stringify(chainEntry)}\n`, "utf8");
        // A successful protected operation must not only reach Node's buffers.
        await descriptor.sync();
      } finally {
        await descriptor.close();
      }

      lastHash = hash;
      entryCount += 1;
      return { seq: chainEntry.seq, hash, previousHash: chainEntry.previousHash };
    });
  }

  async function verify() {
    try {
      return await withChainLock(async () => {
        await readVerifiedState();
        return { valid: true, totalEntries: entryCount, brokenAt: null };
      });
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
      if (error?.code === "AUDIT_CHAIN_LOCK_TIMEOUT") {
        return {
          valid: false,
          totalEntries: entryCount,
          brokenAt: null,
          reason: "lock_timeout",
          error: String(error.message),
        };
      }
      throw error;
    }
  }

  function getLastHash() { return lastHash; }
  function getEntryCount() { return entryCount; }

  function getHealth() {
    return {
      initialized,
      entryCount,
      lastHashFingerprint: lastHash === "GENESIS" ? "GENESIS" : lastHash.slice(0, 12),
      crossProcessAppendSafe: true,
      lockTimeoutMs,
      staleLockMs,
      lockHeartbeatMs: Math.max(1_000, Math.floor(staleLockMs / 3)),
      lockContentionCount,
      staleLockRecoveryCount,
      lockTimeoutCount,
      externalCheckpointConfigured: false,
      rollbackDetectionBoundary: "external-checkpoint-required",
      pathExposed: false,
    };
  }

  return { append, verify, getLastHash, getEntryCount, getHealth, init };
}

async function acquireExclusiveLock({
  lockPath,
  timeoutMs,
  staleMs,
  retryMinMs,
  retryMaxMs,
  onContention,
  onStaleRecovery,
  onTimeout,
}) {
  const deadline = Date.now() + timeoutMs;
  const nonce = randomUUID();
  let attempt = 0;

  while (true) {
    let descriptor;
    try {
      descriptor = await open(lockPath, "wx", 0o600);
      await descriptor.writeFile(JSON.stringify({
        version: 1,
        nonce,
        pid: process.pid,
        hostname: hostname(),
        acquiredAt: new Date().toISOString(),
      }), "utf8");
      await descriptor.sync();
      const heartbeat = setInterval(() => {
        void refreshOwnedLock(lockPath, nonce);
      }, Math.max(1_000, Math.floor(staleMs / 3)));
      heartbeat.unref();

      return {
        async release() {
          clearInterval(heartbeat);
          try {
            await descriptor.close();
          } finally {
            await removeOwnedLock(lockPath, nonce);
          }
        },
      };
    } catch (error) {
      if (descriptor) {
        try { await descriptor.close(); } catch { /* best effort */ }
      }
      if (error?.code !== "EEXIST") throw error;
      onContention?.();
    }

    if (await removeStaleLock(lockPath, staleMs)) {
      onStaleRecovery?.();
      continue;
    }
    if (Date.now() >= deadline) {
      onTimeout?.();
      throw createLockTimeoutError();
    }

    const backoff = Math.min(retryMaxMs, retryMinMs * (attempt + 1));
    attempt += 1;
    await delay(backoff);
  }
}

async function removeStaleLock(lockPath, staleMs) {
  let lockStat;
  try {
    lockStat = await stat(lockPath);
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    return false;
  }
  if (Date.now() - lockStat.mtimeMs < staleMs) return false;
  try {
    const owner = JSON.parse(await readFile(lockPath, "utf8"));
    if (owner?.hostname === hostname() && isProcessAlive(owner?.pid)) return false;
  } catch {
    // Malformed stale locks are recoverable after the full stale interval.
  }
  try {
    await unlink(lockPath);
    return true;
  } catch (error) {
    return error?.code === "ENOENT";
  }
}

async function refreshOwnedLock(lockPath, nonce) {
  try {
    const owner = JSON.parse(await readFile(lockPath, "utf8"));
    if (owner?.nonce !== nonce) return;
    const now = new Date();
    await utimes(lockPath, now, now);
  } catch {
    // The holder will discover any ownership or filesystem failure when the
    // protected append or release completes. Never recreate a missing lock.
  }
}

async function removeOwnedLock(lockPath, nonce) {
  try {
    const current = JSON.parse(await readFile(lockPath, "utf8"));
    if (current?.nonce !== nonce) return;
    await unlink(lockPath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      // Leaving an uncertain lock behind is fail-closed; a bounded stale-lock
      // recovery will handle it rather than deleting another owner's lock.
    }
  }
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

function createLockTimeoutError() {
  const error = new Error("Audit hash chain lock acquisition timed out; protected writes remain blocked.");
  error.code = "AUDIT_CHAIN_LOCK_TIMEOUT";
  error.category = "audit";
  error.retryable = true;
  return error;
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function isProcessAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}
