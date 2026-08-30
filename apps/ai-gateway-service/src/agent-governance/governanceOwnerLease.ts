/**
 * Cross-process owner lease for the durable Agent Governance JSON backend.
 *
 * This is deliberately a single-process exclusion fence, not a distributed
 * lease. The file is never refreshed or stolen from a process that might still
 * be alive. A malformed/unverifiable lease therefore blocks startup.
 */

import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  closeSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export const GOVERNANCE_OWNER_LEASE_FILE = "owner.lease.json";

export interface GovernanceOwnerMetadata {
  schemaVersion: 2;
  pid: number;
  processFingerprint: string;
  acquiredAt: string;
  ownerId: string;
  runtime: "node";
}

export interface GovernanceOwnerLease {
  readonly leasePath: string;
  readonly owner: Readonly<GovernanceOwnerMetadata>;
  assertHeld(): void;
  release(): void;
}

type ProcessFingerprintResult = string | "absent" | "unknown";
let currentProcessFingerprint: string | null = null;

export interface GovernanceOwnerLeaseOptions {
  dataDir: string;
  now?: () => string;
  ownerId?: string;
  pid?: number;
  /** Test seam. Production reads an OS process creation-time fingerprint. */
  getProcessFingerprint?: (pid: number) => ProcessFingerprintResult;
}

export function acquireGovernanceOwnerLease(
  options: GovernanceOwnerLeaseOptions,
): GovernanceOwnerLease {
  const dataDir = String(options.dataDir ?? "").trim();
  if (!dataDir) {
    throw ownerLeaseError(
      "AGENT_GOVERNANCE_OWNER_LEASE_CONFIGURATION_INVALID",
      "Agent Governance owner lease requires a data directory.",
    );
  }

  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const leasePath = join(dataDir, GOVERNANCE_OWNER_LEASE_FILE);
  const pid = options.pid ?? process.pid;
  const getProcessFingerprint = options.getProcessFingerprint ?? probeProcessFingerprint;
  const processFingerprint = getProcessFingerprint(pid);
  if (processFingerprint === "absent" || processFingerprint === "unknown") {
    throw ownerLeaseError(
      "AGENT_GOVERNANCE_OWNER_PROCESS_UNVERIFIABLE",
      "Agent Governance could not verify the current process creation-time fingerprint.",
    );
  }
  const owner: GovernanceOwnerMetadata = {
    schemaVersion: 2,
    pid,
    processFingerprint,
    acquiredAt: (options.now ?? (() => new Date().toISOString()))(),
    ownerId: options.ownerId ?? randomUUID(),
    runtime: "node",
  };
  validateOwnerMetadata(owner);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      createLeaseFile(leasePath, owner);
      return createLeaseHandle(leasePath, owner);
    } catch (error) {
      if (!isAlreadyExists(error)) {
        throw ownerLeaseError(
          "AGENT_GOVERNANCE_OWNER_LEASE_ACQUIRE_FAILED",
          "Agent Governance could not acquire its single-process owner lease.",
          error,
        );
      }
    }

    let existing: GovernanceOwnerMetadata;
    try {
      existing = readExistingLease(leasePath);
    } catch (error) {
      // The current owner may have completed a normal release after our
      // exclusive create observed EEXIST. Retry the atomic create once.
      if (isMissing(error)) continue;
      throw error;
    }
    const observedFingerprint = getProcessFingerprint(existing.pid);
    if (observedFingerprint === existing.processFingerprint) {
      throw ownerLeaseError(
        "AGENT_GOVERNANCE_OWNER_LEASE_OCCUPIED",
        `Agent Governance data is already owned by the recorded live process instance (pid ${existing.pid}).`,
      );
    }
    if (observedFingerprint === "unknown") {
      throw ownerLeaseError(
        "AGENT_GOVERNANCE_OWNER_LEASE_UNVERIFIABLE",
        "Agent Governance owner process instance could not be verified; refusing to remove the lease.",
      );
    }

    // Either the PID is absent or it now names a process with a different
    // creation-time fingerprint. In both cases the recorded process instance
    // is definitely gone; a merely live PID is never enough to claim ownership.

    // Re-read and compare the complete owner record before removal. If another
    // actor changed the file after inspection, preserve it and fail closed.
    const confirmed = readExistingLease(leasePath);
    if (!sameOwner(existing, confirmed)) {
      throw ownerLeaseError(
        "AGENT_GOVERNANCE_OWNER_LEASE_CHANGED",
        "Agent Governance owner lease changed during stale-owner verification.",
      );
    }
    try {
      unlinkSync(leasePath);
    } catch (error) {
      throw ownerLeaseError(
        "AGENT_GOVERNANCE_OWNER_LEASE_STALE_REMOVE_FAILED",
        "Agent Governance stale owner lease could not be removed safely.",
        error,
      );
    }
  }

  throw ownerLeaseError(
    "AGENT_GOVERNANCE_OWNER_LEASE_ACQUIRE_FAILED",
    "Agent Governance could not acquire its single-process owner lease.",
  );
}

function createLeaseFile(leasePath: string, owner: GovernanceOwnerMetadata): void {
  // Do not publish the lease path until the complete, fsynced metadata exists.
  // An exclusive open on leasePath itself makes a zero-byte file visible before
  // the following write, so a simultaneous starter can otherwise mistake that
  // transient state for a permanently malformed lease. A same-directory hard
  // link gives us an atomic, no-overwrite publication step on supported local
  // filesystems (including NTFS and the POSIX filesystems supported here).
  const stagingPath = `${leasePath}.${process.pid}.${randomUUID()}.staged`;
  let descriptor: number | null = null;
  try {
    descriptor = openSync(stagingPath, "wx", 0o600);
    writeFileSync(descriptor, `${JSON.stringify(owner, null, 2)}\n`, { encoding: "utf8" });
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    linkSync(stagingPath, leasePath);
  } finally {
    if (descriptor !== null) closeSync(descriptor);
    try {
      unlinkSync(stagingPath);
    } catch {
      // Preserve the primary create/link outcome. The protected data directory
      // may retain a harmless staging link if the OS refuses this best-effort
      // cleanup, while leasePath remains the sole ownership authority.
    }
  }
}

function createLeaseHandle(
  leasePath: string,
  owner: GovernanceOwnerMetadata,
): GovernanceOwnerLease {
  let released = false;
  return Object.freeze({
    leasePath,
    owner: Object.freeze({ ...owner }),
    assertHeld(): void {
      if (released) {
        throw ownerLeaseError(
          "AGENT_GOVERNANCE_OWNER_LEASE_NOT_HELD",
          "Agent Governance owner lease has already been released.",
        );
      }
      let existing: GovernanceOwnerMetadata;
      try {
        existing = readExistingLease(leasePath);
      } catch (error) {
        throw ownerLeaseError(
          "AGENT_GOVERNANCE_OWNER_LEASE_NOT_HELD",
          "Agent Governance owner lease is missing or unverifiable.",
          error,
        );
      }
      if (!sameOwner(existing, owner)) {
        throw ownerLeaseError(
          "AGENT_GOVERNANCE_OWNER_LEASE_NOT_HELD",
          "Agent Governance owner lease no longer belongs to this runtime.",
        );
      }
    },
    release(): void {
      if (released) return;
      let existing: GovernanceOwnerMetadata;
      try {
        existing = readExistingLease(leasePath);
      } catch (error) {
        if (isMissing(error)) {
          released = true;
          return;
        }
        throw error;
      }
      if (!sameOwner(existing, owner)) {
        throw ownerLeaseError(
          "AGENT_GOVERNANCE_OWNER_LEASE_RELEASE_MISMATCH",
          "Agent Governance owner lease no longer belongs to this process; refusing to remove it.",
        );
      }
      try {
        unlinkSync(leasePath);
        released = true;
      } catch (error) {
        throw ownerLeaseError(
          "AGENT_GOVERNANCE_OWNER_LEASE_RELEASE_FAILED",
          "Agent Governance owner lease could not be released.",
          error,
        );
      }
    },
  });
}

function readExistingLease(leasePath: string): GovernanceOwnerMetadata {
  let stats;
  try {
    stats = lstatSync(leasePath);
  } catch (error) {
    if (isMissing(error)) throw error;
    throw ownerLeaseError(
      "AGENT_GOVERNANCE_OWNER_LEASE_UNVERIFIABLE",
      "Agent Governance owner lease metadata could not be inspected.",
      error,
    );
  }
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw ownerLeaseError(
      "AGENT_GOVERNANCE_OWNER_LEASE_UNVERIFIABLE",
      "Agent Governance owner lease is not a regular file.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(leasePath, "utf8"));
  } catch (error) {
    throw ownerLeaseError(
      "AGENT_GOVERNANCE_OWNER_LEASE_UNVERIFIABLE",
      "Agent Governance owner lease metadata is unreadable or malformed.",
      error,
    );
  }
  validateOwnerMetadata(parsed);
  return parsed;
}

function validateOwnerMetadata(value: unknown): asserts value is GovernanceOwnerMetadata {
  const candidate = value as Partial<GovernanceOwnerMetadata> | null;
  if (
    !candidate
    || candidate.schemaVersion !== 2
    || !Number.isSafeInteger(candidate.pid)
    || Number(candidate.pid) <= 0
    || typeof candidate.processFingerprint !== "string"
    || candidate.processFingerprint.length < 3
    || candidate.processFingerprint.length > 256
    || /[\r\n\0]/u.test(candidate.processFingerprint)
    || typeof candidate.acquiredAt !== "string"
    || !Number.isFinite(Date.parse(candidate.acquiredAt))
    || typeof candidate.ownerId !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(candidate.ownerId)
    || candidate.runtime !== "node"
  ) {
    throw ownerLeaseError(
      "AGENT_GOVERNANCE_OWNER_LEASE_UNVERIFIABLE",
      "Agent Governance owner lease metadata is invalid; refusing automatic removal.",
    );
  }
}

function sameOwner(left: GovernanceOwnerMetadata, right: GovernanceOwnerMetadata): boolean {
  return left.schemaVersion === right.schemaVersion
    && left.pid === right.pid
    && left.processFingerprint === right.processFingerprint
    && left.acquiredAt === right.acquiredAt
    && left.ownerId === right.ownerId
    && left.runtime === right.runtime;
}

function probeProcessFingerprint(pid: number): ProcessFingerprintResult {
  if (pid === process.pid && currentProcessFingerprint) return currentProcessFingerprint;
  const result = process.platform === "linux"
    ? probeLinuxProcessFingerprint(pid)
    : process.platform === "win32"
      ? probeWindowsProcessFingerprint(pid)
      : probePosixProcessFingerprint(pid);
  // This process cannot be replaced while this module is executing, so caching
  // only its own immutable creation-time fingerprint is safe. Foreign PIDs are
  // always re-probed to detect exit and reuse.
  if (pid === process.pid && result !== "absent" && result !== "unknown") {
    currentProcessFingerprint = result;
  }
  return result;
}

function probeLinuxProcessFingerprint(pid: number): ProcessFingerprintResult {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const commandEnd = stat.lastIndexOf(")");
    if (commandEnd < 0) return "unknown";
    const fieldsAfterCommand = stat.slice(commandEnd + 1).trim().split(/\s+/u);
    // /proc/<pid>/stat field 22 is the process start time in clock ticks.
    const startTicks = fieldsAfterCommand[19];
    if (!startTicks || !/^\d+$/u.test(startTicks)) return "unknown";
    return `linux-proc-start-ticks:${startTicks}`;
  } catch (error) {
    if (isMissing(error) || errorCode(error) === "ESRCH") return "absent";
    return "unknown";
  }
}

function probeWindowsProcessFingerprint(pid: number): ProcessFingerprintResult {
  const script = [
    "$ErrorActionPreference='Stop'",
    "$processId=[int]$env:AGENT_GOVERNANCE_OWNER_PID",
    "$process=Get-Process -Id $processId -ErrorAction SilentlyContinue",
    "if($null -eq $process){exit 3}",
    "[Console]::Out.Write($process.StartTime.ToUniversalTime().Ticks)",
  ].join(";");
  try {
    const ticks = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf8",
        env: { ...process.env, AGENT_GOVERNANCE_OWNER_PID: String(pid) },
      },
    ).trim();
    return /^\d+$/u.test(ticks) ? `windows-start-ticks:${ticks}` : "unknown";
  } catch (error) {
    if (error && typeof error === "object" && (error as { status?: unknown }).status === 3) {
      return "absent";
    }
    return "unknown";
  }
}

function probePosixProcessFingerprint(pid: number): ProcessFingerprintResult {
  try {
    const started = execFileSync(
      "ps",
      ["-o", "lstart=", "-p", String(pid)],
      {
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf8",
        env: { ...process.env, LANG: "C", LC_ALL: "C", TZ: "UTC" },
      },
    ).trim().replace(/\s+/gu, " ");
    return started ? `posix-ps-lstart:${started}` : "absent";
  } catch (error) {
    if (error && typeof error === "object" && (error as { status?: unknown }).status === 1) {
      return "absent";
    }
    return "unknown";
  }
}

function ownerLeaseError(code: string, message: string, cause?: unknown): Error {
  return Object.assign(
    new Error(message, cause === undefined ? undefined : { cause }),
    { name: "GovernanceOwnerLeaseError", code, category: "configuration" },
  );
}

function isAlreadyExists(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "EEXIST");
}

function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "ENOENT");
}

function errorCode(error: unknown): unknown {
  return error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
}
