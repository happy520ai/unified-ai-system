/**
 * Per-agent file bundle store.
 *
 * Every governed agent gets an independent directory:
 *   {dataDir}/agents/{agentId}/
 *     agent.json            — identity, purpose, classification, lifecycle
 *     policy-delta.json     — instance rules + inheritance references
 *     effective-policy.json — compiled permission snapshot
 *     manifest.json         — hashes + HMAC signature
 *     audit.ndjson          — append-only audit trail
 *
 * Bundle bytes are fully written and fsynced in a sibling staging directory
 * before publication. Each canonical file is then replaced atomically and
 * the destination directory is synced. Existing Agent directories are never
 * swapped or deleted because they also contain the append-only audit trail.
 * Consequently, the portable atomicity boundary is one canonical file; an
 * in-process publication failure is rolled back to the complete previous
 * bundle, while process-crash recovery across several files remains the
 * responsibility of the higher-level governance activation journal.
 *
 * JSON is used instead of the specification's YAML to stay dependency-free —
 * the five-file semantics (immutable delta, compiled snapshot, signed
 * manifest, append-only audit) are preserved exactly.
 */

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { constants as fileConstants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  rmdir,
  unlink,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type {
  AgentGovernanceAuditEvent,
  AgentPolicyManifest,
  AgentRegistryRecord,
  EffectiveAgentPolicy,
  PolicyLayerContent,
} from "@unified-ai-system/shared-contracts";
import { stableStringify } from "@unified-ai-system/policy-engine";

export interface AgentPolicyDelta {
  agentId: string;
  inherits: Array<{ policyKey: string; version: number }>;
  instanceRules: PolicyLayerContent;
  taskPolicyKeys?: string[];
}

export interface AgentBundleSnapshot {
  record: AgentRegistryRecord;
  delta: AgentPolicyDelta;
  policy: EffectiveAgentPolicy;
  manifest: AgentPolicyManifest;
}

export interface AgentFileStore {
  writeAgentBundle(input: {
    record: AgentRegistryRecord;
    delta: AgentPolicyDelta;
    policy: EffectiveAgentPolicy;
    manifest: AgentPolicyManifest;
  }): Promise<void>;
  loadPolicy(agentId: string): Promise<EffectiveAgentPolicy | null>;
  loadManifest(agentId: string): Promise<AgentPolicyManifest | null>;
  loadDelta(agentId: string): Promise<AgentPolicyDelta | null>;
  /** Strict read-only load of all authority-bearing bundle files. Missing,
   * malformed, linked or path-escaped state throws instead of degrading to null. */
  loadBundle(agentId: string): Promise<AgentBundleSnapshot>;
  appendAudit(agentId: string, event: AgentGovernanceAuditEvent): Promise<void>;
  readAudit(agentId: string, limit?: number): Promise<AgentGovernanceAuditEvent[]>;
  agentDir(agentId: string): string;
}

export type AgentBundlePublishStage =
  | "after-staging-directory"
  | "after-staged-files"
  | "after-backup"
  | "after-publish-file"
  | "after-publish-directory-sync";

export interface AgentBundlePublishFaultDetail {
  agentId: string;
  operationId: string;
  fileName?: string;
}

const BUNDLE_FILE_NAMES = Object.freeze([
  "agent.json",
  "policy-delta.json",
  "effective-policy.json",
  "manifest.json",
] as const);
const MAX_BUNDLE_FILE_BYTES = 16 * 1024 * 1024;
const MAX_AUDIT_MIRROR_BYTES = 64 * 1024 * 1024;
const MAX_AUDIT_MIRROR_RECORDS = 100_000;
const MAX_AUDIT_MIRROR_RECORD_BYTES = 1024 * 1024;
const INITIAL_AUDIT_MIRROR_TAIL_BYTES = 64 * 1024;
const AUDIT_MIRROR_VERSION = "agent-governance-audit-mirror-v1" as const;
const AUDIT_MIRROR_DOMAIN = "unified-ai/agent-governance-audit-mirror/v1";
const AUDIT_MIRROR_GENESIS = "GENESIS";

interface SignedAgentAuditMirrorRecord {
  version: typeof AUDIT_MIRROR_VERSION;
  agentId: string;
  sequence: number;
  previousHash: string;
  event: AgentGovernanceAuditEvent;
  hmacSha256: string;
}

type BundleFileName = typeof BUNDLE_FILE_NAMES[number];

async function writeDurableExclusive(path: string, content: string | Buffer): Promise<void> {
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(content);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function publishStagedFile(
  stagedPath: string,
  destinationPath: string,
  operationId: string,
  onRenamed?: () => void,
): Promise<void> {
  const pendingPath = `${destinationPath}.${operationId}.publish.tmp`;
  try {
    await writeDurableExclusive(pendingPath, await readFile(stagedPath));
    await rename(pendingPath, destinationPath);
    onRenamed?.();
    await syncDirectory(dirname(destinationPath));
  } finally {
    await unlink(pendingPath).catch((error) => {
      if (!isMissing(error)) throw error;
    });
  }
}

async function readExistingRegularFile(path: string): Promise<Buffer | null> {
  try {
    const stats = await lstat(path);
    if (!stats.isFile() || stats.isSymbolicLink() || Number(stats.nlink) !== 1
      || stats.size < 0 || stats.size > MAX_BUNDLE_FILE_BYTES) {
      throw bundleStorageError(`Agent bundle path ${path} is not a regular file.`);
    }
    const flags = process.platform === "win32" || typeof fileConstants.O_NOFOLLOW !== "number"
      ? fileConstants.O_RDONLY
      : fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW;
    const handle = await open(path, flags);
    try {
      const current = await handle.stat();
      if (!current.isFile() || Number(current.nlink) !== 1
        || current.size < 0 || current.size > MAX_BUNDLE_FILE_BYTES
        || current.dev !== stats.dev || current.ino !== stats.ino) {
        throw bundleStorageError(`Agent bundle path ${path} changed during read.`);
      }
      return await handle.readFile();
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

async function ensureRealDirectory(path: string): Promise<boolean> {
  try {
    const stats = await lstat(path);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw bundleStorageError(`Agent bundle directory ${path} is not a real directory.`);
    }
    return false;
  } catch (error) {
    if (!isMissing(error)) throw error;
    try {
      await mkdir(path, { mode: 0o700 });
      return true;
    } catch (mkdirError) {
      if (errorCode(mkdirError) !== "EEXIST") throw mkdirError;
      const stats = await lstat(path);
      if (!stats.isDirectory() || stats.isSymbolicLink()) {
        throw bundleStorageError(`Agent bundle directory ${path} is not a real directory.`);
      }
      return false;
    }
  }
}

async function syncDirectory(path: string): Promise<void> {
  try {
    const handle = await open(path, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (error) {
    // Windows does not consistently permit opening directories for fsync.
    if (process.platform !== "win32") throw error;
  }
}

function assertStagingPath(stagingRoot: string, stagingDir: string): void {
  const relation = relative(resolve(stagingRoot), resolve(stagingDir));
  if (relation === "" || relation === ".." || relation.startsWith(`..${sep}`)
    || isAbsolute(relation)) {
    throw bundleStorageError("Agent bundle staging path escaped its dedicated root.");
  }
}

async function removeStagingDirectory(stagingRoot: string, stagingDir: string): Promise<void> {
  assertStagingPath(stagingRoot, stagingDir);
  await rm(stagingDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 25 });
  await syncDirectory(stagingRoot);
}

function bundleStorageError(message: string, cause?: unknown): Error {
  const error = new Error(message, cause === undefined ? undefined : { cause });
  error.name = "AgentBundleStorageError";
  return error;
}

function isMissing(error: unknown): boolean {
  return errorCode(error) === "ENOENT";
}

function errorCode(error: unknown): unknown {
  return error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
}

export function createAgentFileStore(options: {
  dataDir?: string;
  secret: string;
  /** Test-only crash/failure seam. Production callers must leave this unset. */
  bundlePublishFaultInjector?: (
    stage: AgentBundlePublishStage,
    detail: AgentBundlePublishFaultDetail,
  ) => void | Promise<void>;
  /** Test/observability seam proving steady-state append reads only one tail record. */
  auditMirrorReadProbe?: (detail: {
    agentId: string;
    mode: "full" | "tail";
    bytesRead: number;
  }) => void;
}): AgentFileStore {
  const dataDir = options.dataDir ?? ".data/agent-governance";
  if (typeof options.secret !== "string" || options.secret.length < 32) {
    throw bundleStorageError("Agent audit mirror HMAC secret must contain at least 32 characters.");
  }
  const secret = options.secret;
  const bundleWriteTails = new Map<string, Promise<void>>();
  const auditWriteTails = new Map<string, Promise<void>>();
  const auditMirrorHeads = new Map<string, {
    sequence: number;
    headHash: string;
    size: number;
    dev: number | bigint;
    ino: number | bigint;
    ctimeMs: number;
    mtimeMs: number;
    birthtimeMs: number;
  }>();

  function agentDir(agentId: string): string {
    // Agent ids are generated server-side (agt_<uuid>); reject anything
    // that could escape the directory.
    if (!/^agt_[A-Za-z0-9_-]{1,128}$/u.test(agentId)) {
      throw new Error("Invalid agent id for file storage.");
    }
    return join(dataDir, "agents", agentId);
  }

  async function assertReadableAgentDirectory(agentId: string): Promise<string> {
    const agentsRoot = join(dataDir, "agents");
    const dir = agentDir(agentId);
    const [rootStats, dirStats] = await Promise.all([lstat(agentsRoot), lstat(dir)]);
    if (!rootStats.isDirectory() || rootStats.isSymbolicLink()
      || !dirStats.isDirectory() || dirStats.isSymbolicLink()) {
      throw bundleStorageError("Agent bundle directory is not a real directory.");
    }
    const [canonicalRoot, canonicalDir] = await Promise.all([realpath(agentsRoot), realpath(dir)]);
    const relation = relative(canonicalRoot, canonicalDir);
    if (relation === "" || relation === ".." || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
      throw bundleStorageError("Agent bundle directory escaped its protected root.");
    }
    return canonicalDir;
  }

  function enqueueBundleWrite<T>(agentId: string, operation: () => Promise<T>): Promise<T> {
    const previous = bundleWriteTails.get(agentId) ?? Promise.resolve();
    const result = previous.then(operation, operation);
    const tail = result.then(() => undefined, () => undefined);
    bundleWriteTails.set(agentId, tail);
    void tail.finally(() => {
      if (bundleWriteTails.get(agentId) === tail) bundleWriteTails.delete(agentId);
    });
    return result;
  }

  function enqueueAuditWrite<T>(agentId: string, operation: () => Promise<T>): Promise<T> {
    const previous = auditWriteTails.get(agentId) ?? Promise.resolve();
    const result = previous.then(operation, operation);
    const tail = result.then(() => undefined, () => undefined);
    auditWriteTails.set(agentId, tail);
    void tail.finally(() => {
      if (auditWriteTails.get(agentId) === tail) auditWriteTails.delete(agentId);
    });
    return result;
  }

  async function writeAgentBundle(input: {
    record: AgentRegistryRecord;
    delta: AgentPolicyDelta;
    policy: EffectiveAgentPolicy;
    manifest: AgentPolicyManifest;
  }): Promise<void> {
    const { record, delta, policy, manifest } = input;
    const dir = agentDir(record.agentId);
    return enqueueBundleWrite(record.agentId, async () => {
      const operationId = randomUUID();
      const agentsRoot = join(dataDir, "agents");
      const stagingRoot = join(agentsRoot, ".bundle-staging");
      const stagingDir = join(stagingRoot, `${record.agentId}.${operationId}`);
      const nextDir = join(stagingDir, "next");
      const rollbackDir = join(stagingDir, "rollback");
      const detail = (fileName?: string): AgentBundlePublishFaultDetail => ({
        agentId: record.agentId,
        operationId,
        ...(fileName ? { fileName } : {}),
      });
      const bundleValues: Record<BundleFileName, unknown> = {
        "agent.json": record,
        "policy-delta.json": delta,
        "effective-policy.json": policy,
        "manifest.json": manifest,
      };
      const previousFiles = new Map<BundleFileName, string | null>();
      const publishedFiles: BundleFileName[] = [];
      let targetCreated = false;
      let preserveStaging = false;
      let operationError: unknown = null;

      await mkdir(agentsRoot, { recursive: true, mode: 0o700 });
      await ensureRealDirectory(agentsRoot);
      await mkdir(stagingRoot, { recursive: true, mode: 0o700 });
      await ensureRealDirectory(stagingRoot);
      assertStagingPath(stagingRoot, stagingDir);

      try {
        await mkdir(stagingDir, { mode: 0o700 });
        await mkdir(nextDir, { mode: 0o700 });
        await mkdir(rollbackDir, { mode: 0o700 });
        await options.bundlePublishFaultInjector?.("after-staging-directory", detail());

        for (const fileName of BUNDLE_FILE_NAMES) {
          await writeDurableExclusive(
            join(nextDir, fileName),
            JSON.stringify(bundleValues[fileName], null, 2),
          );
        }
        await syncDirectory(nextDir);
        await syncDirectory(stagingDir);
        await options.bundlePublishFaultInjector?.("after-staged-files", detail());

        targetCreated = await ensureRealDirectory(dir);
        if (targetCreated) await syncDirectory(agentsRoot);
        for (const fileName of BUNDLE_FILE_NAMES) {
          const previous = await readExistingRegularFile(join(dir, fileName));
          if (previous === null) {
            previousFiles.set(fileName, null);
          } else {
            const backupPath = join(rollbackDir, fileName);
            await writeDurableExclusive(backupPath, previous);
            previousFiles.set(fileName, backupPath);
          }
        }
        await syncDirectory(rollbackDir);
        await syncDirectory(stagingDir);
        await options.bundlePublishFaultInjector?.("after-backup", detail());

        for (const fileName of BUNDLE_FILE_NAMES) {
          await publishStagedFile(
            join(nextDir, fileName),
            join(dir, fileName),
            operationId,
            () => { publishedFiles.push(fileName); },
          );
          await options.bundlePublishFaultInjector?.("after-publish-file", detail(fileName));
        }
        await syncDirectory(dir);
        await options.bundlePublishFaultInjector?.("after-publish-directory-sync", detail());
      } catch (error) {
        const rollbackErrors: unknown[] = [];
        for (const fileName of [...publishedFiles].reverse()) {
          const previousPath = previousFiles.get(fileName);
          try {
            if (previousPath) {
              await publishStagedFile(
                previousPath,
                join(dir, fileName),
                `${operationId}.rollback`,
              );
            } else {
              await unlink(join(dir, fileName)).catch((unlinkError) => {
                if (!isMissing(unlinkError)) throw unlinkError;
              });
            }
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError);
          }
        }
        try {
          if (publishedFiles.length > 0) await syncDirectory(dir);
          if (targetCreated) {
            await rmdir(dir);
            await syncDirectory(agentsRoot);
          }
        } catch (rollbackError) {
          if (!isMissing(rollbackError) && errorCode(rollbackError) !== "ENOTEMPTY") {
            rollbackErrors.push(rollbackError);
          }
        }
        if (rollbackErrors.length > 0) {
          preserveStaging = true;
          operationError = new AggregateError(
            [error, ...rollbackErrors],
            "Agent bundle publication failed and could not be rolled back completely; staging was preserved.",
          );
        } else {
          operationError = error;
        }
      }

      if (!preserveStaging) {
        try {
          await removeStagingDirectory(stagingRoot, stagingDir);
        } catch (cleanupError) {
          operationError = operationError
            ? new AggregateError([operationError, cleanupError], "Agent bundle publication and staging cleanup failed.")
            : cleanupError;
        }
      }
      if (operationError) throw operationError;
    });
  }

  return {
    agentDir,
    writeAgentBundle,
    async loadPolicy(agentId) {
      try {
        const raw = await readFile(join(agentDir(agentId), "effective-policy.json"), "utf8");
        return JSON.parse(raw) as EffectiveAgentPolicy;
      } catch {
        return null;
      }
    },
    async loadManifest(agentId) {
      try {
        const raw = await readFile(join(agentDir(agentId), "manifest.json"), "utf8");
        return JSON.parse(raw) as AgentPolicyManifest;
      } catch {
        return null;
      }
    },
    async loadDelta(agentId) {
      try {
        const raw = await readFile(join(agentDir(agentId), "policy-delta.json"), "utf8");
        return JSON.parse(raw) as AgentPolicyDelta;
      } catch {
        return null;
      }
    },
    async loadBundle(agentId) {
      await (bundleWriteTails.get(agentId) ?? Promise.resolve());
      const dir = await assertReadableAgentDirectory(agentId);
      const values = await Promise.all(BUNDLE_FILE_NAMES.map(async (fileName) => {
        const bytes = await readExistingRegularFile(join(dir, fileName));
        if (!bytes) throw bundleStorageError(`Agent bundle is missing ${fileName}.`);
        return [fileName, parseBundleJson(bytes, fileName)] as const;
      }));
      const byName = Object.fromEntries(values) as Record<BundleFileName, unknown>;
      const record = byName["agent.json"] as AgentRegistryRecord;
      const delta = byName["policy-delta.json"] as AgentPolicyDelta;
      const policy = byName["effective-policy.json"] as EffectiveAgentPolicy;
      const manifest = byName["manifest.json"] as AgentPolicyManifest;
      if (!record || typeof record !== "object" || record.agentId !== agentId
        || !policy || typeof policy !== "object" || policy.agentId !== agentId
        || !manifest || typeof manifest !== "object" || manifest.agentId !== agentId) {
        throw bundleStorageError("Agent bundle identity is malformed or inconsistent.");
      }
      validatePolicyDelta(delta, agentId);
      return { record, delta, policy, manifest };
    },
    async appendAudit(agentId, event) {
      const dir = agentDir(agentId);
      await enqueueAuditWrite(agentId, async () => {
        if (!event || event.agentId !== agentId || typeof event.id !== "string" || event.id.trim() === "") {
          throw bundleStorageError("Agent audit mirror events require matching Agent and event identities.");
        }
        const agentsRoot = join(dataDir, "agents");
        await ensureRealDirectory(agentsRoot);
        await ensureRealDirectory(dir);
        const auditPath = join(dir, "audit.ndjson");
        const existed = await assertSafeAuditTarget(auditPath);
        const flags = process.platform === "win32" || typeof fileConstants.O_NOFOLLOW !== "number"
          ? fileConstants.O_APPEND | fileConstants.O_CREAT | fileConstants.O_RDWR
          : fileConstants.O_APPEND | fileConstants.O_CREAT | fileConstants.O_RDWR | fileConstants.O_NOFOLLOW;
        const handle = await open(auditPath, flags, 0o600);
        try {
          const stats = await handle.stat();
          if (!stats.isFile() || stats.nlink !== 1 || stats.size < 0 || stats.size > MAX_AUDIT_MIRROR_BYTES) {
            throw bundleStorageError("Agent audit path is not a single-link regular file.");
          }
          let base: { sequence: number; headHash: string };
          const cached = auditMirrorHeads.get(agentId);
          if (!existed || stats.size === 0) {
            if (existed) throw bundleStorageError("Existing Agent audit mirror is empty or unsigned.");
            base = { sequence: 0, headHash: AUDIT_MIRROR_GENESIS };
          } else if (cached && cached.size === stats.size
            && cached.dev === stats.dev && cached.ino === stats.ino
            && cached.ctimeMs === stats.ctimeMs && cached.mtimeMs === stats.mtimeMs
            && cached.birthtimeMs === stats.birthtimeMs) {
            const tail = await readAndVerifyAuditMirrorTail(handle, stats.size, agentId, secret);
            options.auditMirrorReadProbe?.({ agentId, mode: "tail", bytesRead: tail.bytesRead });
            if (tail.record.sequence !== cached.sequence || tail.record.hmacSha256 !== cached.headHash) {
              throw bundleStorageError("Agent audit mirror head changed outside the verified writer.");
            }
            base = { sequence: cached.sequence, headHash: cached.headHash };
          } else {
            const raw = await handle.readFile({ encoding: "utf8" });
            options.auditMirrorReadProbe?.({ agentId, mode: "full", bytesRead: Buffer.byteLength(raw) });
            const verified = parseAndVerifyAuditMirror(raw, agentId, secret, false);
            base = { sequence: verified.records.length, headHash: verified.headHash };
          }
          const content = {
            version: AUDIT_MIRROR_VERSION,
            agentId,
            sequence: base.sequence + 1,
            previousHash: base.headHash,
            event,
          };
          const record: SignedAgentAuditMirrorRecord = {
            ...content,
            hmacSha256: signAuditMirrorRecord(content, secret),
          };
          const serialized = `${JSON.stringify(record)}\n`;
          if (stats.size + Buffer.byteLength(serialized) > MAX_AUDIT_MIRROR_BYTES) {
            throw bundleStorageError("Agent audit mirror exceeds its bounded byte capacity.");
          }
          await handle.writeFile(serialized, "utf8");
          await handle.sync();
          const after = await handle.stat();
          auditMirrorHeads.set(agentId, {
            sequence: record.sequence,
            headHash: record.hmacSha256,
            size: after.size,
            dev: after.dev,
            ino: after.ino,
            ctimeMs: after.ctimeMs,
            mtimeMs: after.mtimeMs,
            birthtimeMs: after.birthtimeMs,
          });
        } finally {
          await handle.close();
        }
        await syncDirectory(dir);
      });
    },
    async readAudit(agentId, limit = 100) {
      try {
        const auditPath = join(agentDir(agentId), "audit.ndjson");
        if (!await assertSafeAuditTarget(auditPath)) return [];
        const flags = process.platform === "win32" || typeof fileConstants.O_NOFOLLOW !== "number"
          ? fileConstants.O_RDONLY
          : fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW;
        const handle = await open(auditPath, flags);
        try {
          const stats = await handle.stat();
          if (!stats.isFile() || stats.nlink !== 1 || stats.size <= 0 || stats.size > MAX_AUDIT_MIRROR_BYTES) {
            throw bundleStorageError("Agent audit mirror is empty, oversized, or not a single-link regular file.");
          }
          const raw = await handle.readFile({ encoding: "utf8" });
          options.auditMirrorReadProbe?.({ agentId, mode: "full", bytesRead: Buffer.byteLength(raw) });
          const verified = parseAndVerifyAuditMirror(
            raw,
            agentId,
            secret,
            false,
          );
          auditMirrorHeads.set(agentId, {
            sequence: verified.records.length,
            headHash: verified.headHash,
            size: stats.size,
            dev: stats.dev,
            ino: stats.ino,
            ctimeMs: stats.ctimeMs,
            mtimeMs: stats.mtimeMs,
            birthtimeMs: stats.birthtimeMs,
          });
          const boundedLimit = Number.isSafeInteger(limit)
            ? Math.min(MAX_AUDIT_MIRROR_RECORDS, Math.max(0, limit))
            : 100;
          return boundedLimit === 0 ? [] : verified.events.slice(-boundedLimit);
        } finally {
          await handle.close();
        }
      } catch (error) {
        if (isMissing(error)) return [];
        throw bundleStorageError("Agent audit mirror is malformed or unsafe.", error);
      }
    },
  };
}

function parseBundleJson(bytes: Buffer, fileName: string): unknown {
  try {
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new TypeError("not an object");
    }
    return parsed;
  } catch (cause) {
    throw bundleStorageError(`Agent bundle ${fileName} is malformed.`, cause);
  }
}

function validatePolicyDelta(delta: unknown, agentId: string): asserts delta is AgentPolicyDelta {
  if (!delta || typeof delta !== "object" || Array.isArray(delta)) {
    throw bundleStorageError("Agent policy delta is malformed.");
  }
  const record = delta as Record<string, unknown>;
  const allowedKeys = new Set(["agentId", "inherits", "instanceRules", "taskPolicyKeys"]);
  const inherits = record.inherits;
  const taskPolicyKeys = record.taskPolicyKeys;
  if (Object.keys(record).some((key) => !allowedKeys.has(key))
    || record.agentId !== agentId || !Array.isArray(inherits) || inherits.length > 256
    || !record.instanceRules || typeof record.instanceRules !== "object" || Array.isArray(record.instanceRules)
    || inherits.some((binding) => !binding || typeof binding !== "object" || Array.isArray(binding)
      || Object.keys(binding as Record<string, unknown>).some((key) => key !== "policyKey" && key !== "version")
      || typeof (binding as Record<string, unknown>).policyKey !== "string"
      || !Number.isSafeInteger((binding as Record<string, unknown>).version)
      || Number((binding as Record<string, unknown>).version) < 1)
    || (taskPolicyKeys !== undefined && (!Array.isArray(taskPolicyKeys) || taskPolicyKeys.length > 32
      || taskPolicyKeys.some((key) => typeof key !== "string" || !/^[a-z][a-z0-9._-]{0,63}$/u.test(key))
      || new Set(taskPolicyKeys).size !== taskPolicyKeys.length))) {
    throw bundleStorageError("Agent policy delta failed strict schema validation.");
  }
}

function parseAndVerifyAuditMirror(
  raw: string,
  agentId: string,
  secret: string,
  allowEmpty: boolean,
): { records: SignedAgentAuditMirrorRecord[]; events: AgentGovernanceAuditEvent[]; headHash: string } {
  const lines = raw.split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    if (!allowEmpty) throw bundleStorageError("Existing Agent audit mirror is empty or unsigned.");
    return { records: [], events: [], headHash: AUDIT_MIRROR_GENESIS };
  }
  if (lines.length > MAX_AUDIT_MIRROR_RECORDS) {
    throw bundleStorageError("Agent audit mirror exceeds its bounded record capacity.");
  }
  const records: SignedAgentAuditMirrorRecord[] = [];
  let previousHash = AUDIT_MIRROR_GENESIS;
  for (let index = 0; index < lines.length; index += 1) {
    const record = parseAndAuthenticateAuditMirrorRecord(lines[index], agentId, secret);
    if (record.sequence !== index + 1 || record.previousHash !== previousHash) {
      throw bundleStorageError("Agent audit mirror record identity or sequence is invalid.");
    }
    records.push(record);
    previousHash = record.hmacSha256;
  }
  return { records, events: records.map((record) => structuredClone(record.event)), headHash: previousHash };
}

async function readAndVerifyAuditMirrorTail(
  handle: Awaited<ReturnType<typeof open>>,
  size: number,
  agentId: string,
  secret: string,
): Promise<{ record: SignedAgentAuditMirrorRecord; bytesRead: number }> {
  let bytesToRead = Math.min(size, INITIAL_AUDIT_MIRROR_TAIL_BYTES);
  while (bytesToRead <= Math.min(size, MAX_AUDIT_MIRROR_RECORD_BYTES)) {
    const buffer = Buffer.allocUnsafe(bytesToRead);
    const { bytesRead } = await handle.read(buffer, 0, bytesToRead, size - bytesToRead);
    const text = buffer.subarray(0, bytesRead).toString("utf8");
    const end = text.endsWith("\n") ? text.length - 1 : text.length;
    const previousBreak = text.lastIndexOf("\n", Math.max(-1, end - 1));
    if (previousBreak >= 0 || size === bytesToRead) {
      const line = text.slice(previousBreak + 1, end);
      if (!line || Buffer.byteLength(line) > MAX_AUDIT_MIRROR_RECORD_BYTES) {
        throw bundleStorageError("Agent audit mirror tail record exceeds its bounded size.");
      }
      return { record: parseAndAuthenticateAuditMirrorRecord(line, agentId, secret), bytesRead };
    }
    if (bytesToRead === MAX_AUDIT_MIRROR_RECORD_BYTES || bytesToRead === size) break;
    bytesToRead = Math.min(size, MAX_AUDIT_MIRROR_RECORD_BYTES, bytesToRead * 2);
  }
  throw bundleStorageError("Agent audit mirror tail record exceeds its bounded size.");
}

function parseAndAuthenticateAuditMirrorRecord(
  line: string,
  agentId: string,
  secret: string,
): SignedAgentAuditMirrorRecord {
  let candidate: unknown;
  try { candidate = JSON.parse(line); }
  catch (cause) { throw bundleStorageError("Agent audit mirror contains malformed JSON.", cause); }
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw bundleStorageError("Agent audit mirror record is malformed.");
  }
  const record = candidate as Record<string, unknown>;
  const event = record.event as AgentGovernanceAuditEvent | undefined;
  if (Object.keys(record).some((key) => ![
    "version", "agentId", "sequence", "previousHash", "event", "hmacSha256",
  ].includes(key))
    || record.version !== AUDIT_MIRROR_VERSION || record.agentId !== agentId
    || !Number.isSafeInteger(record.sequence) || Number(record.sequence) < 1
    || typeof record.previousHash !== "string"
    || (record.previousHash !== AUDIT_MIRROR_GENESIS && !/^[a-f0-9]{64}$/u.test(record.previousHash))
    || typeof record.hmacSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(record.hmacSha256)
    || !event || typeof event !== "object" || event.agentId !== agentId
    || typeof event.id !== "string" || event.id.trim() === "") {
    throw bundleStorageError("Agent audit mirror record identity is invalid.");
  }
  const content = {
    version: AUDIT_MIRROR_VERSION,
    agentId,
    sequence: Number(record.sequence),
    previousHash: record.previousHash,
    event,
  };
  const expected = signAuditMirrorRecord(content, secret);
  if (!safeAuditHashEqual(record.hmacSha256, expected)) {
    throw bundleStorageError("Agent audit mirror authentication failed.");
  }
  return { ...content, hmacSha256: record.hmacSha256 };
}

function signAuditMirrorRecord(
  content: Omit<SignedAgentAuditMirrorRecord, "hmacSha256">,
  secret: string,
): string {
  return createHmac("sha256", secret)
    .update(`${AUDIT_MIRROR_DOMAIN}\n${stableStringify(content)}`, "utf8")
    .digest("hex");
}

function safeAuditHashEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  try { return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex")); }
  catch { return false; }
}

async function assertSafeAuditTarget(path: string): Promise<boolean> {
  try {
    const stats = await lstat(path);
    if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1) {
      throw bundleStorageError("Agent audit path is not a single-link regular file.");
    }
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}
