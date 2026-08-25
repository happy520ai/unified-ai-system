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
const DEFAULT_LOCK_RETRY_MIN_MS = 5;
const DEFAULT_LOCK_RETRY_MAX_MS = 25;
const DEFAULT_FULL_VERIFICATION_INTERVAL = 100;
const MAX_AUDIT_ENTRY_BYTES = 256 * 1024;

export function createAuditHashChain(options = {}) {
  const chainPath = options.chainPath ?? ".data/audit/audit-chain.jsonl";
  const checkpointStore = options.checkpointStore ?? {
    configured: false,
    verify: async () => null,
    verifyTail: async () => null,
    commit: async () => null,
    getHealth: () => ({ configured: false, status: "disabled", mode: "none" }),
  };
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
  const fullVerificationInterval = clampInteger(
    options.fullVerificationInterval,
    DEFAULT_FULL_VERIFICATION_INTERVAL,
    10,
    10_000,
  );
  let lastHash = "GENESIS";
  let entryCount = 0;
  let initialized = false;
  let lockContentionCount = 0;
  let staleLockRecoveryCount = 0;
  let lockTimeoutCount = 0;
  let appendsSinceFullVerification = 0;
  let lastFullVerificationAt = null;
  let lastFullVerificationSequence = 0;

  function computeHash(entry, previousHash) {
    const payload = JSON.stringify({ entry, previousHash });
    return createHash("sha256").update(payload).digest("hex");
  }

  async function readVerifiedState({ collectEntries = false, maxEntries = 1000 } = {}) {
    let content;
    try {
      content = await readFile(chainPath, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") {
        lastHash = "GENESIS";
        entryCount = 0;
        initialized = true;
        await checkpointStore.verify({ entryCount, lastHash, hashes: [] });
        appendsSinceFullVerification = 0;
        lastFullVerificationAt = new Date().toISOString();
        lastFullVerificationSequence = 0;
        return { lastHash, entryCount, entries: [] };
      }
      throw error;
    }

    const lines = content.trim().split("\n").filter(Boolean);
    let previousHash = "GENESIS";
    const hashes = [];
    const entries = [];
    for (let index = 0; index < lines.length; index += 1) {
      if (Buffer.byteLength(lines[index]) > MAX_AUDIT_ENTRY_BYTES) {
        throw createCorruptChainError("entry_too_large", index);
      }
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
      hashes.push(hash);
      if (collectEntries && index >= Math.max(0, lines.length - maxEntries)) {
        entries.push({
          ...rest,
          chainedAt,
          integrity: {
            sequence: seq,
            hash,
            previousHash: linkedHash,
          },
        });
      }
    }

    lastHash = previousHash;
    entryCount = lines.length;
    initialized = true;
    await checkpointStore.verify({ entryCount, lastHash, hashes });
    appendsSinceFullVerification = 0;
    lastFullVerificationAt = new Date().toISOString();
    lastFullVerificationSequence = entryCount;
    return { lastHash, entryCount, entries };
  }

  async function readVerifiedTailState() {
    let descriptor;
    try {
      descriptor = await open(chainPath, "r");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      if (entryCount > 0) throw createCorruptChainError("tail_rollback", 0);
      lastHash = "GENESIS";
      entryCount = 0;
      await checkpointStore.verifyTail({ entryCount, lastHash });
      return { lastHash, entryCount };
    }

    try {
      const { size } = await descriptor.stat();
      if (size === 0) {
        if (entryCount > 0) throw createCorruptChainError("tail_rollback", 0);
        lastHash = "GENESIS";
        entryCount = 0;
        await checkpointStore.verifyTail({ entryCount, lastHash });
        return { lastHash, entryCount };
      }
      const readLength = Math.min(size, MAX_AUDIT_ENTRY_BYTES + 1);
      const readStart = size - readLength;
      const buffer = Buffer.alloc(readLength);
      const { bytesRead } = await descriptor.read(buffer, 0, readLength, readStart);
      if (bytesRead !== readLength) throw createCorruptChainError("tail_short_read", entryCount);
      let text = buffer.toString("utf8");
      if (readStart > 0) {
        const firstNewline = text.indexOf("\n");
        if (firstNewline < 0) throw createCorruptChainError("tail_entry_too_large", entryCount);
        text = text.slice(firstNewline + 1);
      }
      const line = text.trim().split("\n").filter(Boolean).at(-1);
      if (!line || Buffer.byteLength(line) > MAX_AUDIT_ENTRY_BYTES) {
        throw createCorruptChainError("tail_entry_too_large", entryCount);
      }
      let entry;
      try {
        entry = JSON.parse(line);
      } catch (error) {
        throw createCorruptChainError("parse_error", entryCount, error);
      }
      const { hash, previousHash, seq, chainedAt, ...rest } = entry ?? {};
      if (!Number.isSafeInteger(seq) || seq < 1 || typeof previousHash !== "string") {
        throw createCorruptChainError("tail_format", entryCount);
      }
      const expectedHash = computeHash({ ...rest, seq, chainedAt }, previousHash);
      if (typeof hash !== "string" || hash !== expectedHash) {
        throw createCorruptChainError("hash_mismatch", seq - 1);
      }
      if (seq < entryCount || (seq === entryCount && lastHash !== "GENESIS" && hash !== lastHash)) {
        throw createCorruptChainError("tail_rollback", seq - 1);
      }
      lastHash = hash;
      entryCount = seq;
      await checkpointStore.verifyTail({ entryCount, lastHash });
      return { lastHash, entryCount };
    } finally {
      await descriptor.close();
    }
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
      // Derive the next sequence and hash from the locked tail. Full-chain
      // verification happens at startup and at a fixed interval, avoiding an
      // O(n²) request hot path while preserving bounded tamper detection.
      if (!initialized || appendsSinceFullVerification >= fullVerificationInterval) {
        await readVerifiedState();
      } else {
        await readVerifiedTailState();
      }
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

      const serializedEntry = `${JSON.stringify(chainEntry)}\n`;
      if (Buffer.byteLength(serializedEntry) > MAX_AUDIT_ENTRY_BYTES) {
        const error = new Error("Audit hash chain entry exceeds the bounded record size.");
        error.code = "AUDIT_CHAIN_ENTRY_TOO_LARGE";
        error.category = "audit";
        error.retryable = false;
        throw error;
      }
      const descriptor = await open(chainPath, "a", 0o600);
      try {
        await descriptor.writeFile(serializedEntry, "utf8");
        // A successful protected operation must not only reach Node's buffers.
        await descriptor.sync();
      } finally {
        await descriptor.close();
      }

      lastHash = hash;
      entryCount += 1;
      await checkpointStore.commit({ sequence: entryCount, hash: lastHash });
      appendsSinceFullVerification += 1;
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
      if (String(error?.code ?? "").startsWith("AUDIT_CHECKPOINT_")) {
        return {
          valid: false,
          totalEntries: entryCount,
          brokenAt: null,
          reason: String(error.code).toLowerCase(),
          error: String(error.message),
        };
      }
      throw error;
    }
  }

  async function readEntries({ limit = 1000 } = {}) {
    const boundedLimit = clampInteger(limit, 1000, 1, 10_000);
    return withChainLock(async () => {
      const state = await readVerifiedState({ collectEntries: true, maxEntries: boundedLimit });
      return state.entries;
    });
  }

  function getLastHash() { return lastHash; }
  function getEntryCount() { return entryCount; }

  function getHealth() {
    const checkpoint = checkpointStore.getHealth();
    return {
      initialized,
      entryCount,
      lastHashFingerprint: lastHash === "GENESIS" ? "GENESIS" : lastHash.slice(0, 12),
      crossProcessAppendSafe: true,
      lockTimeoutMs,
      staleLockMs,
      lockHeartbeatMs: Math.max(1_000, Math.floor(staleLockMs / 3)),
      fullVerificationInterval,
      appendsSinceFullVerification,
      lastFullVerificationAt,
      lastFullVerificationSequence,
      maxEntryBytes: MAX_AUDIT_ENTRY_BYTES,
      lockContentionCount,
      staleLockRecoveryCount,
      lockTimeoutCount,
      signedCheckpointConfigured: checkpointStore.configured === true,
      externalCheckpointConfigured: checkpoint.externalRetentionVerified === true,
      rollbackDetectionBoundary: checkpointStore.configured === true
        ? "signed-checkpoint-configured-external-retention-unverified"
        : "external-checkpoint-required",
      checkpoint,
      pathExposed: false,
    };
  }

  return { append, verify, readEntries, getLastHash, getEntryCount, getHealth, init };
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
          await descriptor.close();
          await removeOwnedLock(lockPath, nonce);
        },
      };
    } catch (error) {
      if (descriptor) {
        try { await descriptor.close(); } catch { /* best effort */ }
        await removeOwnedLock(lockPath, nonce);
      }
      // Windows can report EPERM for a short interval while another handle is
      // being created or removed, even when a follow-up stat no longer sees
      // the path. Treat it as bounded contention; permanent ACL failures still
      // end at the fail-closed acquisition timeout.
      const windowsContention = error?.code === "EPERM" && process.platform === "win32";
      if (error?.code !== "EEXIST" && !windowsContention) throw error;
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
  let owner = null;
  try {
    lockStat = await stat(lockPath);
  } catch (error) {
    if (error?.code === "ENOENT") return true;
    return false;
  }
  try {
    owner = JSON.parse(await readFile(lockPath, "utf8"));
  } catch {
    // Malformed stale locks are recoverable after the full stale interval.
  }
  if (Date.now() - lockStat.mtimeMs < staleMs) return false;
  try {
    // Do not infer ownership from process-local memory. Worker threads and VM
    // realms share a PID but not module state, so such a shortcut can delete a
    // live lock and let two writers extend the same audit tail. A lock owned by
    // a live process remains fail-closed until that process exits.
    if (owner?.hostname === hostname() && isProcessAlive(owner?.pid)) return false;
  } catch {
    // Malformed stale locks are recoverable after the full stale interval.
  }
  return unlinkWithRetry(lockPath);
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
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const current = JSON.parse(await readFile(lockPath, "utf8"));
      if (current?.nonce !== nonce) return;
      await unlink(lockPath);
      return;
    } catch (error) {
      if (error?.code === "ENOENT") return;
      if (error?.code !== "EPERM" && error?.code !== "EBUSY") return;
      await delay(5 * (attempt + 1));
    }
  }
}

async function unlinkWithRetry(lockPath) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await unlink(lockPath);
      return true;
    } catch (error) {
      if (error?.code === "ENOENT") return true;
      if (error?.code !== "EPERM" && error?.code !== "EBUSY") return false;
      await delay(5 * (attempt + 1));
    }
  }
  return false;
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
