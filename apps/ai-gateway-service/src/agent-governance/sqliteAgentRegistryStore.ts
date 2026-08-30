import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  AgentClassification,
  AgentFamily,
  AgentRegistryRecord,
  AgentStatus,
  AgentTrait,
  RiskLevel,
} from "@unified-ai-system/shared-contracts";
import type { AgentRegistryStore } from "./agentRegistryStore.ts";
import { stableStringify } from "@unified-ai-system/policy-engine";
import {
  SQLITE_AGENT_REGISTRY_MIGRATIONS,
  SQLITE_AGENT_REGISTRY_SCHEMA_VERSION,
  type SqliteAgentRegistryMigration,
} from "./sqliteAgentRegistryMigrations.ts";

export const SQLITE_AGENT_REGISTRY_BOUNDARIES = Object.freeze({
  storageMode: "single-host-sqlite" as const,
  durable: true as const,
  transactional: true as const,
  distributed: false as const,
  singleHost: true as const,
  crossHostSupported: false as const,
  journalMode: "wal" as const,
  synchronous: "full" as const,
  foreignKeys: true as const,
  rollbackProtected: true as const,
  rollbackProtectionScope: "database-file-only-with-same-host-checkpoint" as const,
  cryptographicallyTamperEvident: true as const,
  databaseSnapshotRollbackProtected: true as const,
  wholeDirectoryRollbackProtected: false as const,
  authorityProtocol: "sqlite-checkpoint-v1" as const,
});

export interface SqliteAgentRegistryStoreOptions {
  sqlitePath: string;
  /** Stable identity for the one host allowed to reopen this SQLite file. */
  hostId: string;
  /** Stable HMAC material loaded from the protected governance secret store. */
  hmacSecret: string;
  /** Defaults to agent-registry.checkpoint.json beside the SQLite file. */
  checkpointPath?: string;
  /** Explicit one-shot move authorization for a complete DB+checkpoint directory. */
  allowDirectoryMigrationFromPath?: string;
  busyTimeoutMs?: number;
  maxRecordBytes?: number;
  now?: () => string;
  faultInjector?: (
    stage: "after-authority-bootstrap-db" | "after-db-commit" | "after-checkpoint",
    detail: { revision: number; installationId: string },
  ) => void;
}

export type SqliteAgentRegistryHealth = Readonly<{
  status: "ready" | "degraded" | "closed";
  available: boolean;
  loaded: boolean;
  schemaVersion: number;
  migrationCount: number;
  recordCount: number | null;
  busyTimeoutMs: number;
  pathExposed: false;
  checkpointVerified: boolean;
  authorityRevision: number | null;
  authorityInstallationExposed: false;
  recoveryStatus: "exact" | "initialized" | "rolled-forward" | "directory-migrated" | "failed";
  lastErrorCode: string | null;
} & typeof SQLITE_AGENT_REGISTRY_BOUNDARIES>;

export interface SqliteAgentRegistryStore extends AgentRegistryStore {
  getAuthorityBinding(): string;
  getAuthorityProtocol(): typeof SQLITE_AGENT_REGISTRY_BOUNDARIES.authorityProtocol;
  close(): Promise<void>;
  getHealth(): SqliteAgentRegistryHealth;
}

export type VerifiedSqliteAgentRegistryAuthoritySnapshot = Readonly<{
  authorityProtocol: typeof SQLITE_AGENT_REGISTRY_BOUNDARIES.authorityProtocol;
  authorityBinding: string;
  schemaVersion: number;
  revision: number;
  recordCount: number;
  projectionHash: string;
  recordsDigestSha256: string;
  checkpointVerified: true;
  pathExposed: false;
  authorityInstallationExposed: false;
}>;

type MigrationRow = {
  version: number;
  name: string;
  checksum: string;
};

type MetadataRow = {
  schema_version: number;
  host_binding_sha256: string;
  created_at: string;
  updated_at: string;
  metadata_checksum: string;
};

type AuthorityRow = {
  installation_id: string;
  backend_id: string;
  path_binding_sha256: string;
  revision: number;
  event_head: string;
  projection_xor: string;
  projection_hash: string;
  record_count: number;
  state_hmac: string;
  created_at: string;
  updated_at: string;
};

type AuthorityEventRow = {
  revision: number;
  previous_head: string;
  event_hash: string;
  event_hmac: string;
  batch_hash: string;
  path_binding_sha256: string;
  projection_hash: string;
  record_count: number;
  created_at: string;
};

type AuthorityCheckpoint = {
  version: "sqlite-agent-registry-checkpoint-v1";
  backendId: "sqlite-agent-registry-v1";
  pathBindingSha256: string;
  installationId: string;
  revision: number;
  eventHead: string;
  projectionHash: string;
  recordCount: number;
  updatedAt: string;
  hmacSha256: string;
};

type RegistryRow = {
  agent_id: string;
  tenant_id: string;
  owner_user_id: string;
  parent_agent_id: string | null;
  generation_depth: number;
  status: string;
  policy_hash: string;
  created_at: string;
  expires_at: string;
  record_json: string;
  record_hmac: string | null;
};

const DEFAULT_BUSY_TIMEOUT_MS = 5_000;
const MAX_BUSY_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RECORD_BYTES = 256 * 1_024;
const MAX_RECORD_BYTES = 1024 * 1_024;
const MAX_PATH_LENGTH = 4_096;
const MAX_HOST_ID_LENGTH = 256;
const BACKEND_ID = "sqlite-agent-registry-v1" as const;
const CHECKPOINT_VERSION = "sqlite-agent-registry-checkpoint-v1" as const;
const GENESIS_HEAD = "GENESIS";
const ZERO_PROJECTION = "0".repeat(64);
const AGENT_ID_PATTERN = /^agt_[A-Za-z0-9_-]{1,128}$/u;
const POLICY_HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/u;
const FREE_TEXT_CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const RESERVED_TOOL_NAMES = new Set<string>([
  "__proto__",
  "prototype",
  ...Object.getOwnPropertyNames(Object.prototype),
]);
const FAMILIES = new Set<AgentFamily>([
  "analysis", "execution", "communication", "monitoring", "development", "orchestration", "governance",
]);
const TRAITS = new Set<AgentTrait>([
  "read_only", "write_capable", "external_communication", "handles_sensitive_data",
  "financial_operation", "code_execution", "subagent_creator", "destructive_operation",
]);
const RISKS = new Set<RiskLevel>(["low", "medium", "high", "critical"]);
const STATUSES = new Set<AgentStatus>([
  "DRAFT", "VALIDATED", "ACTIVE", "COMPLETED", "EXPIRED", "REVOKED", "FAILED", "ARCHIVED",
]);
const REQUIRED_RECORD_KEYS = [
  "agentId", "name", "purpose", "tenantId", "ownerUserId", "createdBy", "parentAgentId",
  "generationDepth", "classification", "traits", "riskLevel", "requestedTools", "grantedTools",
  "policyHash", "status", "createdAt", "expiresAt",
] as const;
const OPTIONAL_RECORD_KEYS = ["revokedAt"] as const;
const CHECKPOINT_KEYS = [
  "version", "backendId", "pathBindingSha256", "installationId", "revision",
  "eventHead", "projectionHash", "recordCount", "updatedAt", "hmacSha256",
] as const;

export class SqliteAgentRegistryError extends Error {
  readonly code: string;
  readonly category: "configuration" | "persistence" | "integrity" | "lifecycle";
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: string,
    message: string,
    category: SqliteAgentRegistryError["category"],
    statusCode: number,
    retryable = false,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "SqliteAgentRegistryError";
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

/**
 * Verifies a closed SQLite authority pair without initializing, migrating,
 * reconciling, or publishing either file. This is intentionally distinct from
 * createSqliteAgentRegistryStore so recovery tooling can inspect unknown
 * staging files without changing them first.
 */
export function verifySqliteAgentRegistryAuthoritySnapshot(options: {
  sqlitePath: string;
  checkpointPath?: string;
  hostId: string;
  hmacSecret: string;
  busyTimeoutMs?: number;
  maxRecordBytes?: number;
}): VerifiedSqliteAgentRegistryAuthoritySnapshot {
  const sqlitePath = resolveSqlitePath(options?.sqlitePath);
  const checkpointPath = resolveCheckpointPath(options?.checkpointPath, sqlitePath);
  const hostBindingSha256 = sha256(normalizeHostId(options?.hostId));
  const hmacSecret = normalizeHmacSecret(options?.hmacSecret);
  const busyTimeoutMs = boundedInteger(options?.busyTimeoutMs, DEFAULT_BUSY_TIMEOUT_MS, 100, MAX_BUSY_TIMEOUT_MS);
  const maxRecordBytes = boundedInteger(options?.maxRecordBytes, DEFAULT_MAX_RECORD_BYTES, 1_024, MAX_RECORD_BYTES);
  assertNoLinkedParentComponents(dirname(sqlitePath));
  assertSafeDatabaseFile(sqlitePath, false);
  assertSafeCheckpointFile(checkpointPath, false);
  assertClosedSnapshot(sqlitePath);

  let db: DatabaseSync | null = null;
  try {
    db = new DatabaseSync(sqlitePath, { readOnly: true });
    db.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
    assertSchema(db);
    validateMigrationRows(readMigrations(db), true);
    verifyHostMetadataReadOnly(db, hostBindingSha256);
    const authority = readAndVerifyAuthority(db, hmacSecret);
    verifyFullAuthority(db, authority, hmacSecret, maxRecordBytes);
    const checkpoint = readCheckpoint(checkpointPath, hmacSecret, false)!;
    assertCheckpointMatchesAuthority(checkpoint, authority, pathBinding(sqlitePath));
    const records = (db.prepare(`
      SELECT agent_id, tenant_id, owner_user_id, parent_agent_id, generation_depth,
             status, policy_hash, created_at, expires_at, record_json, record_hmac
      FROM agent_registry_records ORDER BY agent_id
    `).all() as RegistryRow[]).map((row) => decodeRow(row, maxRecordBytes, hmacSecret));
    return Object.freeze({
      authorityProtocol: SQLITE_AGENT_REGISTRY_BOUNDARIES.authorityProtocol,
      authorityBinding: `sqlite-v2:${sha256(`${authority.installation_id}\0${authority.path_binding_sha256}`)}`,
      schemaVersion: SQLITE_AGENT_REGISTRY_SCHEMA_VERSION,
      revision: Number(authority.revision),
      recordCount: records.length,
      projectionHash: authority.projection_hash,
      recordsDigestSha256: `sha256:${sha256(stableStringify(records))}`,
      checkpointVerified: true,
      pathExposed: false,
      authorityInstallationExposed: false,
    });
  } catch (error) {
    if (isKnownError(error)) throw error;
    throw unavailableError(error);
  } finally {
    try { db?.close(); } catch { /* Preserve the verification result. */ }
  }
}

function initializeOrVerifyAuthority(options: {
  db: DatabaseSync;
  sqlitePath: string;
  checkpointPath: string;
  pathBindingSha256: string;
  migrationSourcePath: string | null;
  hmacSecret: string;
  maxRecordBytes: number;
  now: () => string;
  faultInjector?: SqliteAgentRegistryStoreOptions["faultInjector"];
}): { authority: AuthorityRow; recoveryStatus: SqliteAgentRegistryHealth["recoveryStatus"] } {
  let authority = readAuthority(options.db);
  if (!authority) {
    const legacyRow = options.db.prepare("SELECT 1 AS present FROM agent_registry_records LIMIT 1").get();
    // The former backend was not a promoted authority. Never mint a new trust
    // root over its rows in-place; the offline verified migration tool must
    // import them into a fresh authority after validating its signed source.
    if (legacyRow) throw legacyMigrationRequiredError();
    if (readCheckpoint(options.checkpointPath, options.hmacSecret, true)) {
      throw checkpointError("A checkpoint exists without its DB authority.");
    }
    authority = transaction(options.db, () => {
      const timestamp = normalizedTimestamp(options.now());
      const initial = signAuthority({
        installation_id: randomUUID(),
        backend_id: BACKEND_ID,
        path_binding_sha256: options.pathBindingSha256,
        revision: 0,
        event_head: GENESIS_HEAD,
        projection_xor: ZERO_PROJECTION,
        projection_hash: projectionHash(ZERO_PROJECTION, 0, options.hmacSecret),
        record_count: 0,
        state_hmac: "",
        created_at: timestamp,
        updated_at: timestamp,
      }, options.hmacSecret);
      options.db.prepare(`
        INSERT INTO agent_registry_authority (
          singleton, installation_id, backend_id, path_binding_sha256, revision,
          event_head, projection_xor, projection_hash, record_count, state_hmac,
          created_at, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(...authorityValues(initial));
      return initial;
    });
    options.faultInjector?.("after-authority-bootstrap-db", {
      revision: authority.revision,
      installationId: authority.installation_id,
    });
    writeCheckpointAtomic(options.checkpointPath, checkpointFromAuthority(authority, options.hmacSecret));
    return { authority, recoveryStatus: "initialized" };
  }

  verifyFullAuthority(options.db, authority, options.hmacSecret, options.maxRecordBytes);
  if (authority.path_binding_sha256 !== options.pathBindingSha256) {
    const expectedOldBinding = options.migrationSourcePath ? pathBinding(options.migrationSourcePath) : null;
    if (!expectedOldBinding || expectedOldBinding !== authority.path_binding_sha256) {
      throw directoryMigrationRequiredError();
    }
    if (existsSync(options.migrationSourcePath!)) {
      throw directoryMigrationRequiredError(
        "The previous SQLite Agent registry database still exists; cloning an authority is not a directory migration.",
      );
    }
    const oldCheckpoint = readCheckpoint(options.checkpointPath, options.hmacSecret, false)!;
    assertCheckpointMatchesAuthority(oldCheckpoint, authority, authority.path_binding_sha256);
    authority = commitDirectoryMigration({
      db: options.db,
      authority,
      nextPathBinding: options.pathBindingSha256,
      hmacSecret: options.hmacSecret,
      now: options.now,
    });
    options.faultInjector?.("after-db-commit", {
      revision: authority.revision,
      installationId: authority.installation_id,
    });
    writeCheckpointAtomic(options.checkpointPath, checkpointFromAuthority(authority, options.hmacSecret));
    options.faultInjector?.("after-checkpoint", {
      revision: authority.revision,
      installationId: authority.installation_id,
    });
    return { authority, recoveryStatus: "directory-migrated" };
  }
  const recovered = verifyAndRecoverRuntimeAuthority({
    db: options.db,
    checkpointPath: options.checkpointPath,
    expectedPathBinding: options.pathBindingSha256,
    acceptedPreviousPathBinding: options.migrationSourcePath ? pathBinding(options.migrationSourcePath) : null,
    hmacSecret: options.hmacSecret,
    maxRecordBytes: options.maxRecordBytes,
  });
  return {
    authority: recovered.authority,
    recoveryStatus: recovered.rolledForward ? "rolled-forward" : "exact",
  };
}

function verifyAndRecoverRuntimeAuthority(options: {
  db: DatabaseSync;
  checkpointPath: string;
  expectedPathBinding: string;
  acceptedPreviousPathBinding?: string | null;
  hmacSecret: string;
  maxRecordBytes: number;
}): { authority: AuthorityRow; rolledForward: boolean } {
  const authority = readAndVerifyAuthority(options.db, options.hmacSecret);
  if (authority.path_binding_sha256 !== options.expectedPathBinding) throw directoryMigrationRequiredError();
  const checkpoint = readCheckpoint(options.checkpointPath, options.hmacSecret, true);
  if (!checkpoint) {
    if (authority.revision === 0 && authority.record_count === 0 && authority.event_head === GENESIS_HEAD) {
      writeCheckpointAtomic(options.checkpointPath, checkpointFromAuthority(authority, options.hmacSecret));
      return { authority, rolledForward: true };
    }
    throw checkpointError("The authority checkpoint is missing.");
  }
  const checkpointPathAccepted = checkpoint.pathBindingSha256 === options.expectedPathBinding
    || (options.acceptedPreviousPathBinding !== null
      && options.acceptedPreviousPathBinding !== undefined
      && checkpoint.pathBindingSha256 === options.acceptedPreviousPathBinding
      && checkpoint.revision < authority.revision);
  if (!checkpointPathAccepted || checkpoint.installationId !== authority.installation_id
    || checkpoint.backendId !== authority.backend_id) throw checkpointError();
  if (checkpoint.revision > authority.revision) throw rollbackDetectedError();
  if (checkpoint.revision === authority.revision) {
    assertCheckpointMatchesAuthority(checkpoint, authority, options.expectedPathBinding);
    return { authority, rolledForward: false };
  }
  verifyEventSuffix(options.db, checkpoint, authority, options.hmacSecret);
  writeCheckpointAtomic(options.checkpointPath, checkpointFromAuthority(authority, options.hmacSecret));
  return { authority, rolledForward: true };
}

function commitDirectoryMigration(options: {
  db: DatabaseSync;
  authority: AuthorityRow;
  nextPathBinding: string;
  hmacSecret: string;
  now: () => string;
}): AuthorityRow {
  return transaction(options.db, () => {
    const current = readAndVerifyAuthority(options.db, options.hmacSecret);
    assertAuthorityEqual(current, options.authority);
    const revision = current.revision + 1;
    const createdAt = normalizedTimestamp(options.now());
    const batchHash = hmacHex(
      "directory-migration",
      `${current.path_binding_sha256}\0${options.nextPathBinding}`,
      options.hmacSecret,
    );
    const content = {
      installationId: current.installation_id,
      revision,
      previousHead: current.event_head,
      batchHash,
      pathBindingSha256: options.nextPathBinding,
      projectionHash: current.projection_hash,
      recordCount: current.record_count,
      createdAt,
    };
    const eventHash = sha256(stableStringify(content));
    const eventHmac = hmacHex("event", stableStringify({ ...content, eventHash }), options.hmacSecret);
    options.db.prepare(`
      INSERT INTO agent_registry_authority_events (
        revision, previous_head, event_hash, event_hmac, batch_hash,
        path_binding_sha256, projection_hash, record_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      revision,
      current.event_head,
      eventHash,
      eventHmac,
      batchHash,
      options.nextPathBinding,
      current.projection_hash,
      current.record_count,
      createdAt,
    );
    const next = signAuthority({
      ...current,
      path_binding_sha256: options.nextPathBinding,
      revision,
      event_head: eventHash,
      updated_at: createdAt,
    }, options.hmacSecret);
    writeAuthority(options.db, next);
    return next;
  });
}

function verifyFullAuthority(
  db: DatabaseSync,
  authority: AuthorityRow,
  hmacSecret: string,
  maxRecordBytes: number,
): void {
  verifyAuthorityHmac(authority, hmacSecret);
  const rows = db.prepare(`
    SELECT agent_id, tenant_id, owner_user_id, parent_agent_id, generation_depth,
           status, policy_hash, created_at, expires_at, record_json, record_hmac
    FROM agent_registry_records ORDER BY agent_id
  `).all() as RegistryRow[];
  let projectionXor = ZERO_PROJECTION;
  for (const row of rows) {
    const record = decodeRow(row, maxRecordBytes, hmacSecret);
    projectionXor = xorHex(projectionXor, projectionLeaf(record, hmacSecret));
  }
  if (rows.length !== authority.record_count
    || projectionXor !== authority.projection_xor
    || projectionHash(projectionXor, rows.length, hmacSecret) !== authority.projection_hash) {
    throw corrupt("Agent registry authority projection does not match its records.");
  }
  const events = readEvents(db);
  if (events.length !== authority.revision) throw corrupt("Agent registry authority event count diverged.");
  let previousHead = GENESIS_HEAD;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    verifyEvent(event, index + 1, previousHead, authority.installation_id, hmacSecret);
    previousHead = event.event_hash;
  }
  if (previousHead !== authority.event_head) throw corrupt("Agent registry authority event head diverged.");
}

function verifyEventSuffix(
  db: DatabaseSync,
  checkpoint: AuthorityCheckpoint,
  authority: AuthorityRow,
  hmacSecret: string,
): void {
  const events = db.prepare(`
    SELECT revision, previous_head, event_hash, event_hmac, batch_hash,
           path_binding_sha256, projection_hash, record_count, created_at
    FROM agent_registry_authority_events
    WHERE revision > ? ORDER BY revision
  `).all(checkpoint.revision) as AuthorityEventRow[];
  let previousHead = checkpoint.eventHead;
  let revision = checkpoint.revision;
  for (const event of events) {
    revision += 1;
    verifyEvent(event, revision, previousHead, authority.installation_id, hmacSecret);
    previousHead = event.event_hash;
  }
  if (revision !== authority.revision || previousHead !== authority.event_head) throw rollbackDetectedError();
}

function verifyEvent(
  event: AuthorityEventRow,
  revision: number,
  previousHead: string,
  installationId: string,
  hmacSecret: string,
): void {
  const content = {
    installationId,
    revision: Number(event.revision),
    previousHead: event.previous_head,
    batchHash: event.batch_hash,
    pathBindingSha256: event.path_binding_sha256,
    projectionHash: event.projection_hash,
    recordCount: Number(event.record_count),
    createdAt: event.created_at,
  };
  const expectedHash = sha256(stableStringify(content));
  const expectedHmac = hmacHex("event", stableStringify({ ...content, eventHash: expectedHash }), hmacSecret);
  if (content.revision !== revision || content.previousHead !== previousHead
    || event.event_hash !== expectedHash || !safeHexEqual(event.event_hmac, expectedHmac)) {
    throw corrupt("Agent registry authority event chain verification failed.");
  }
}

function readEvents(db: DatabaseSync): AuthorityEventRow[] {
  return db.prepare(`
    SELECT revision, previous_head, event_hash, event_hmac, batch_hash,
           path_binding_sha256, projection_hash, record_count, created_at
    FROM agent_registry_authority_events ORDER BY revision
  `).all() as AuthorityEventRow[];
}

function readAuthority(db: DatabaseSync): AuthorityRow | null {
  return (db.prepare(`
    SELECT installation_id, backend_id, path_binding_sha256, revision, event_head,
           projection_xor, projection_hash, record_count, state_hmac, created_at, updated_at
    FROM agent_registry_authority WHERE singleton = 1
  `).get() as AuthorityRow | undefined) ?? null;
}

function readAndVerifyAuthority(db: DatabaseSync, hmacSecret: string): AuthorityRow {
  const authority = readAuthority(db);
  if (!authority) throw corrupt("Agent registry authority is missing.");
  verifyAuthorityHmac(authority, hmacSecret);
  return authority;
}

function verifyAuthorityHmac(authority: AuthorityRow, hmacSecret: string): void {
  const expected = signAuthority({ ...authority, state_hmac: "" }, hmacSecret);
  if (authority.backend_id !== BACKEND_ID || !isUuid(authority.installation_id)
    || !SHA256_PATTERN.test(authority.path_binding_sha256)
    || !Number.isSafeInteger(Number(authority.revision)) || Number(authority.revision) < 0
    || (authority.event_head !== GENESIS_HEAD && !SHA256_PATTERN.test(authority.event_head))
    || !SHA256_PATTERN.test(authority.projection_xor)
    || !SHA256_PATTERN.test(authority.projection_hash)
    || !Number.isSafeInteger(Number(authority.record_count)) || Number(authority.record_count) < 0
    || !safeHexEqual(authority.state_hmac, expected.state_hmac)) {
    throw corrupt("Agent registry authority HMAC verification failed.");
  }
}

function signAuthority(input: AuthorityRow, hmacSecret: string): AuthorityRow {
  const { state_hmac: _ignored, ...content } = input;
  return { ...content, state_hmac: hmacHex("authority", stableStringify(content), hmacSecret) };
}

function writeAuthority(db: DatabaseSync, authority: AuthorityRow): void {
  const result = db.prepare(`
    UPDATE agent_registry_authority
    SET installation_id = ?, backend_id = ?, path_binding_sha256 = ?, revision = ?,
        event_head = ?, projection_xor = ?, projection_hash = ?, record_count = ?,
        state_hmac = ?, created_at = ?, updated_at = ?
    WHERE singleton = 1
  `).run(...authorityValues(authority));
  if (Number(result.changes) !== 1) throw corrupt("Agent registry authority update failed.");
}

function authorityValues(authority: AuthorityRow): Array<string | number> {
  return [
    authority.installation_id,
    authority.backend_id,
    authority.path_binding_sha256,
    authority.revision,
    authority.event_head,
    authority.projection_xor,
    authority.projection_hash,
    authority.record_count,
    authority.state_hmac,
    authority.created_at,
    authority.updated_at,
  ];
}

function checkpointFromAuthority(authority: AuthorityRow, hmacSecret: string): AuthorityCheckpoint {
  const content = {
    version: CHECKPOINT_VERSION,
    backendId: BACKEND_ID,
    pathBindingSha256: authority.path_binding_sha256,
    installationId: authority.installation_id,
    revision: Number(authority.revision),
    eventHead: authority.event_head,
    projectionHash: authority.projection_hash,
    recordCount: Number(authority.record_count),
    updatedAt: authority.updated_at,
  } as const;
  return { ...content, hmacSha256: hmacHex("checkpoint", stableStringify(content), hmacSecret) };
}

function readCheckpoint(path: string, hmacSecret: string, allowMissing: boolean): AuthorityCheckpoint | null {
  if (!existsSync(path)) {
    if (allowMissing) return null;
    throw checkpointError("Agent registry checkpoint is missing.");
  }
  assertSafeCheckpointFile(path, false);
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(path, "utf8")); }
  catch (cause) { throw checkpointError("Agent registry checkpoint is malformed.", cause); }
  if (!isPlainRecord(parsed)
    || Object.keys(parsed).length !== CHECKPOINT_KEYS.length
    || CHECKPOINT_KEYS.some((key) => !Object.hasOwn(parsed, key))) throw checkpointError();
  const checkpoint = parsed as AuthorityCheckpoint;
  const { hmacSha256, ...content } = checkpoint;
  if (checkpoint.version !== CHECKPOINT_VERSION || checkpoint.backendId !== BACKEND_ID
    || !SHA256_PATTERN.test(checkpoint.pathBindingSha256) || !isUuid(checkpoint.installationId)
    || !Number.isSafeInteger(checkpoint.revision) || checkpoint.revision < 0
    || (checkpoint.eventHead !== GENESIS_HEAD && !SHA256_PATTERN.test(checkpoint.eventHead))
    || !SHA256_PATTERN.test(checkpoint.projectionHash)
    || !Number.isSafeInteger(checkpoint.recordCount) || checkpoint.recordCount < 0
    || !validTimestamp(checkpoint.updatedAt)
    || !safeHexEqual(hmacSha256, hmacHex("checkpoint", stableStringify(content), hmacSecret))) {
    throw checkpointError("Agent registry checkpoint HMAC verification failed.");
  }
  return checkpoint;
}

function writeCheckpointAtomic(path: string, checkpoint: AuthorityCheckpoint): void {
  assertSafeCheckpointFile(path, true);
  const tmpPath = `${path}.${randomUUID()}.tmp`;
  let descriptor: number | null = null;
  try {
    descriptor = openSync(tmpPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY, 0o600);
    writeFileSync(descriptor, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    renameSync(tmpPath, path);
    syncDirectory(dirname(path));
    assertSafeCheckpointFile(path, false);
  } finally {
    if (descriptor !== null) closeSync(descriptor);
    try { unlinkSync(tmpPath); } catch (error) { if (!isMissingFs(error)) throw error; }
  }
}

function assertCheckpointIdentity(
  checkpoint: AuthorityCheckpoint,
  authority: AuthorityRow,
  expectedPathBinding: string,
): void {
  if (checkpoint.installationId !== authority.installation_id
    || checkpoint.backendId !== authority.backend_id
    || checkpoint.pathBindingSha256 !== expectedPathBinding) throw checkpointError();
}

function assertCheckpointMatchesAuthority(
  checkpoint: AuthorityCheckpoint,
  authority: AuthorityRow,
  expectedPathBinding: string,
): void {
  assertCheckpointIdentity(checkpoint, authority, expectedPathBinding);
  if (checkpoint.revision !== Number(authority.revision)
    || checkpoint.eventHead !== authority.event_head
    || checkpoint.projectionHash !== authority.projection_hash
    || checkpoint.recordCount !== Number(authority.record_count)) throw rollbackDetectedError();
}

function assertAuthorityEqual(left: AuthorityRow, right: AuthorityRow): void {
  if (stableStringify(left) !== stableStringify(right)) throw rollbackDetectedError();
}

function projectionLeaf(record: AgentRegistryRecord, hmacSecret: string): string {
  return hmacHex("projection-leaf", `${record.agentId}\0${recordHmac(record, hmacSecret)}`, hmacSecret);
}

function projectionHash(projectionXor: string, recordCount: number, hmacSecret: string): string {
  return hmacHex("projection", `${recordCount}\0${projectionXor}`, hmacSecret);
}

function recordHmac(record: AgentRegistryRecord, hmacSecret: string): string {
  return hmacHex("record", stableStringify(record), hmacSecret);
}

function xorHex(left: string, right: string): string {
  if (!SHA256_PATTERN.test(left) || !SHA256_PATTERN.test(right)) throw corrupt("Projection XOR is malformed.");
  const output = Buffer.alloc(32);
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  for (let index = 0; index < output.length; index += 1) output[index] = a[index]! ^ b[index]!;
  return output.toString("hex");
}

function hmacHex(domain: string, value: string, hmacSecret: string): string {
  return createHmac("sha256", hmacSecret).update(`unified-ai/sqlite-agent-registry/v1/${domain}\n${value}`, "utf8").digest("hex");
}

function pathBinding(path: string): string {
  const canonical = process.platform === "win32" ? resolve(path).toLowerCase() : resolve(path);
  return sha256(canonical);
}

function safeHexEqual(left: unknown, right: string): boolean {
  return typeof left === "string" && left.length === right.length
    && /^[a-f0-9]+$/u.test(left)
    && timingSafeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function normalizeHmacSecret(value: unknown): string {
  const secret = typeof value === "string" ? value : "";
  if (Buffer.byteLength(secret, "utf8") < 32) throw configurationError();
  return secret;
}

function resolveCheckpointPath(value: unknown, sqlitePath: string): string {
  const resolved = value === undefined
    ? join(dirname(sqlitePath), "agent-registry.checkpoint.json")
    : resolve(String(value));
  const rel = relative(dirname(sqlitePath), resolved);
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)
    || resolved === sqlitePath) throw configurationError();
  return resolved;
}

function assertSafeCheckpointFile(path: string, allowMissing: boolean): void {
  assertNoLinkedParentComponents(dirname(path));
  if (!existsSync(path)) {
    if (allowMissing) return;
    throw checkpointError();
  }
  const stats = lstatSync(path);
  if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1 || stats.size < 2 || stats.size > 64 * 1024) {
    throw checkpointError();
  }
}

function assertClosedSnapshot(sqlitePath: string): void {
  if ([`${sqlitePath}-wal`, `${sqlitePath}-shm`].some((path) => existsSync(path))) {
    throw new SqliteAgentRegistryError(
      "AGENT_REGISTRY_SQLITE_SNAPSHOT_NOT_CLOSED",
      "The SQLite Agent registry snapshot still has WAL sidecars and cannot be verified as a closed authority pair.",
      "integrity",
      500,
    );
  }
}

function syncDirectory(path: string): void {
  if (process.platform === "win32") return;
  const descriptor = openSync(path, fsConstants.O_RDONLY);
  try { fsyncSync(descriptor); } finally { closeSync(descriptor); }
}

function isMissingFs(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "ENOENT");
}

export function createSqliteAgentRegistryStore(
  options: SqliteAgentRegistryStoreOptions,
): SqliteAgentRegistryStore {
  const sqlitePath = resolveSqlitePath(options?.sqlitePath);
  const hostBindingSha256 = sha256(normalizeHostId(options?.hostId));
  const hmacSecret = normalizeHmacSecret(options?.hmacSecret);
  const checkpointPath = resolveCheckpointPath(options?.checkpointPath, sqlitePath);
  const pathBindingSha256 = pathBinding(sqlitePath);
  const migrationSourcePath = options?.allowDirectoryMigrationFromPath === undefined
    ? null
    : resolveSqlitePath(options.allowDirectoryMigrationFromPath);
  const busyTimeoutMs = boundedInteger(options?.busyTimeoutMs, DEFAULT_BUSY_TIMEOUT_MS, 100, MAX_BUSY_TIMEOUT_MS);
  const maxRecordBytes = boundedInteger(options?.maxRecordBytes, DEFAULT_MAX_RECORD_BYTES, 1_024, MAX_RECORD_BYTES);
  if (options?.now !== undefined && typeof options.now !== "function") throw configurationError();
  const now = options?.now ?? (() => new Date().toISOString());

  assertNoLinkedParentComponents(dirname(sqlitePath));
  mkdirSync(dirname(sqlitePath), { recursive: true, mode: 0o700 });
  try { chmodSync(dirname(sqlitePath), 0o700); } catch { /* Windows ACLs are applied at the governance directory boundary. */ }
  assertSafeDatabaseFile(sqlitePath, true);
  assertSafeCheckpointFile(checkpointPath, true);

  let db: DatabaseSync | null = null;
  let closed = false;
  let loaded = false;
  let lastErrorCode: string | null = null;
  let authority: AuthorityRow | null = null;
  let checkpointVerified = false;
  let recoveryStatus: SqliteAgentRegistryHealth["recoveryStatus"] = "failed";
  let authorityBinding = "";
  try {
    db = new DatabaseSync(sqlitePath);
    db.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
    const journal = db.prepare("PRAGMA journal_mode = WAL").get() as { journal_mode?: unknown } | undefined;
    if (String(journal?.journal_mode ?? "").toLowerCase() !== "wal") throw schemaError();
    db.exec("PRAGMA synchronous = FULL");
    db.exec("PRAGMA trusted_schema = OFF");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("PRAGMA recursive_triggers = OFF");
    assertPragmas(db, busyTimeoutMs);
    initializeMigrations(db, now);
    initializeHostMetadata(db, hostBindingSha256, now);
    (db as DatabaseSync & { enableDefensive?: (enabled: boolean) => void }).enableDefensive?.(true);
    assertSchema(db);
    const initialized = initializeOrVerifyAuthority({
      db,
      sqlitePath,
      checkpointPath,
      pathBindingSha256,
      migrationSourcePath,
      hmacSecret,
      maxRecordBytes,
      now,
      faultInjector: options.faultInjector,
    });
    authority = initialized.authority;
    checkpointVerified = true;
    recoveryStatus = initialized.recoveryStatus;
    authorityBinding = `sqlite-v2:${sha256(`${authority.installation_id}\0${authority.path_binding_sha256}`)}`;
    assertSafeDatabaseFile(sqlitePath, false);
    try { chmodSync(sqlitePath, 0o600); } catch { /* Best effort on Windows. */ }
  } catch (error) {
    try { db?.close(); } catch { /* Preserve initialization failure. */ }
    if (isKnownError(error)) throw error;
    throw unavailableError(error);
  }

  if (!db) throw unavailableError();
  const database: DatabaseSync = db;
  const selectById = database.prepare(`
    SELECT agent_id, tenant_id, owner_user_id, parent_agent_id, generation_depth,
           status, policy_hash, created_at, expires_at, record_json, record_hmac
    FROM agent_registry_records
    WHERE agent_id = ?
  `);
  const selectScoped = database.prepare(`
    SELECT agent_id, tenant_id, owner_user_id, parent_agent_id, generation_depth,
           status, policy_hash, created_at, expires_at, record_json, record_hmac
    FROM agent_registry_records
    WHERE agent_id = ? AND tenant_id = ?
  `);
  const selectByTenant = database.prepare(`
    SELECT agent_id, tenant_id, owner_user_id, parent_agent_id, generation_depth,
           status, policy_hash, created_at, expires_at, record_json, record_hmac
    FROM agent_registry_records
    WHERE tenant_id = ?
    ORDER BY created_at DESC, agent_id ASC
  `);
  const selectByParent = database.prepare(`
    SELECT agent_id, tenant_id, owner_user_id, parent_agent_id, generation_depth,
           status, policy_hash, created_at, expires_at, record_json, record_hmac
    FROM agent_registry_records
    WHERE parent_agent_id = ?
    ORDER BY rowid ASC
  `);
  const selectAll = database.prepare(`
    SELECT agent_id, tenant_id, owner_user_id, parent_agent_id, generation_depth,
           status, policy_hash, created_at, expires_at, record_json, record_hmac
    FROM agent_registry_records
    ORDER BY rowid ASC
  `);
  const countChildren = database.prepare(`
    SELECT COUNT(*) AS count
    FROM agent_registry_records
    WHERE parent_agent_id = ? AND status NOT IN ('REVOKED', 'ARCHIVED')
  `);
  const upsertRecord = database.prepare(`
    INSERT INTO agent_registry_records (
      agent_id, tenant_id, owner_user_id, parent_agent_id, generation_depth,
      status, policy_hash, created_at, expires_at, record_json, record_hmac, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(agent_id) DO UPDATE SET
      tenant_id = excluded.tenant_id,
      owner_user_id = excluded.owner_user_id,
      parent_agent_id = excluded.parent_agent_id,
      generation_depth = excluded.generation_depth,
      status = excluded.status,
      policy_hash = excluded.policy_hash,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at,
      record_json = excluded.record_json,
      record_hmac = excluded.record_hmac,
      updated_at = excluded.updated_at
  `);

  async function load(): Promise<void> {
    assertOpen();
    if (loaded) return;
    try {
      assertDatabaseHealthy(database);
      for (const row of selectAll.all() as RegistryRow[]) decodeRow(row, maxRecordBytes, hmacSecret);
      loaded = true;
      lastErrorCode = null;
    } catch (error) {
      lastErrorCode = errorCode(error);
      if (isKnownError(error)) throw error;
      throw unavailableError(error);
    }
  }

  async function upsertMany(records: AgentRegistryRecord[]): Promise<void> {
    await load();
    if (!Array.isArray(records)) throw corrupt("Agent registry batch is malformed.");
    if (records.length === 0) return;
    const validated = records.map((record) => {
      if (!isPlainRecord(record)) throw corrupt("Agent registry record identity is malformed.");
      return validateRecord(String(record.agentId ?? ""), record, maxRecordBytes);
    });
    const byId = new Map(validated.map((record) => [record.agentId, record]));
    if (byId.size !== validated.length) throw corrupt("Agent registry batch contains duplicate identities.");

    try {
      const recovered = verifyAndRecoverRuntimeAuthority({
        db: database,
        checkpointPath,
        expectedPathBinding: pathBindingSha256,
        hmacSecret,
        maxRecordBytes,
      });
      authority = recovered.authority;
      checkpointVerified = true;
      if (recovered.rolledForward) recoveryStatus = "rolled-forward";
      const committed = transaction(database, () => {
        const currentAuthority = readAndVerifyAuthority(database, hmacSecret);
        assertAuthorityEqual(currentAuthority, authority!);
        let nextProjectionXor = currentAuthority.projection_xor;
        let nextRecordCount = Number(currentAuthority.record_count);
        const changes: Array<{ agentId: string; previousHmac: string | null; nextHmac: string }> = [];
        for (const record of validated) {
          const existingRow = selectById.get(record.agentId) as RegistryRow | undefined;
          if (existingRow) {
            const existing = decodeRow(existingRow, maxRecordBytes, hmacSecret);
            assertImmutableIdentity(existing, record);
            nextProjectionXor = xorHex(nextProjectionXor, projectionLeaf(existing, hmacSecret));
          } else {
            nextRecordCount += 1;
          }
          const nextHmac = recordHmac(record, hmacSecret);
          nextProjectionXor = xorHex(nextProjectionXor, projectionLeaf(record, hmacSecret));
          changes.push({ agentId: record.agentId, previousHmac: existingRow?.record_hmac ?? null, nextHmac });
        }
        for (const record of validated) assertParentBinding(record, byId, selectById, maxRecordBytes, hmacSecret);
        // A parent update must not leave an existing child outside the batch
        // with an expanded tool/TTL/tenant/owner relationship.
        for (const parent of validated) {
          for (const childRow of selectByParent.all(parent.agentId) as RegistryRow[]) {
            const child = byId.get(childRow.agent_id) ?? decodeRow(childRow, maxRecordBytes, hmacSecret);
            assertParentBinding(child, byId, selectById, maxRecordBytes, hmacSecret);
          }
        }
        const updatedAt = normalizedTimestamp(now());
        for (const [index, record] of validated.entries()) {
          const recordJson = JSON.stringify(record);
          const result = upsertRecord.run(
            record.agentId,
            record.tenantId,
            record.ownerUserId,
            record.parentAgentId,
            record.generationDepth,
            record.status,
            record.policyHash,
            record.createdAt,
            record.expiresAt,
            recordJson,
            changes[index]!.nextHmac,
            updatedAt,
          );
          if (Number(result.changes) !== 1) throw writeError();
        }
        const nextRevision = Number(currentAuthority.revision) + 1;
        const nextProjectionHash = projectionHash(nextProjectionXor, nextRecordCount, hmacSecret);
        const batchHash = hmacHex("batch", stableStringify([...changes]
          .sort((left, right) => left.agentId.localeCompare(right.agentId))), hmacSecret);
        const eventContent = {
          installationId: currentAuthority.installation_id,
          revision: nextRevision,
          previousHead: currentAuthority.event_head,
          batchHash,
          pathBindingSha256,
          projectionHash: nextProjectionHash,
          recordCount: nextRecordCount,
          createdAt: updatedAt,
        };
        const eventHash = sha256(stableStringify(eventContent));
        const eventHmac = hmacHex("event", stableStringify({ ...eventContent, eventHash }), hmacSecret);
        database.prepare(`
          INSERT INTO agent_registry_authority_events (
            revision, previous_head, event_hash, event_hmac, batch_hash,
            path_binding_sha256, projection_hash, record_count, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          nextRevision,
          currentAuthority.event_head,
          eventHash,
          eventHmac,
          batchHash,
          pathBindingSha256,
          nextProjectionHash,
          nextRecordCount,
          updatedAt,
        );
        const nextAuthority = signAuthority({
          ...currentAuthority,
          path_binding_sha256: pathBindingSha256,
          revision: nextRevision,
          event_head: eventHash,
          projection_xor: nextProjectionXor,
          projection_hash: nextProjectionHash,
          record_count: nextRecordCount,
          updated_at: updatedAt,
        }, hmacSecret);
        writeAuthority(database, nextAuthority);
        return nextAuthority;
      });
      authority = committed;
      options.faultInjector?.("after-db-commit", {
        revision: committed.revision,
        installationId: committed.installation_id,
      });
      writeCheckpointAtomic(checkpointPath, checkpointFromAuthority(committed, hmacSecret));
      checkpointVerified = true;
      recoveryStatus = "exact";
      options.faultInjector?.("after-checkpoint", {
        revision: committed.revision,
        installationId: committed.installation_id,
      });
      lastErrorCode = null;
    } catch (error) {
      lastErrorCode = errorCode(error);
      if (isKnownError(error)) throw error;
      throw writeError(error);
    }
  }

  function assertOpen(): void {
    if (closed) throw closedError();
  }

  function readQuery<T>(operation: () => T): T {
    assertOpen();
    try {
      const result = operation();
      lastErrorCode = null;
      return result;
    } catch (error) {
      lastErrorCode = errorCode(error);
      if (isKnownError(error)) throw error;
      throw unavailableError(error);
    }
  }

  return {
    getAuthorityBinding() {
      if (!authorityBinding) throw unavailableError();
      return authorityBinding;
    },
    getAuthorityProtocol() { return SQLITE_AGENT_REGISTRY_BOUNDARIES.authorityProtocol; },
    load,
    async upsert(record) { await upsertMany([record]); },
    upsertMany,
    async get(agentId, tenantId) {
      await load();
      if (!AGENT_ID_PATTERN.test(String(agentId ?? "")) || !validScope(tenantId)) return null;
      return readQuery(() => {
        const row = selectScoped.get(agentId, tenantId.trim()) as RegistryRow | undefined;
        return row ? decodeRow(row, maxRecordBytes, hmacSecret) : null;
      });
    },
    async getUnscoped(agentId) {
      await load();
      if (!AGENT_ID_PATTERN.test(String(agentId ?? ""))) return null;
      return readQuery(() => {
        const row = selectById.get(agentId) as RegistryRow | undefined;
        return row ? decodeRow(row, maxRecordBytes, hmacSecret) : null;
      });
    },
    async listByTenant(tenantId) {
      await load();
      if (!validScope(tenantId)) return [];
      return readQuery(() => (
        (selectByTenant.all(tenantId.trim()) as RegistryRow[]).map((row) => decodeRow(row, maxRecordBytes, hmacSecret))
      ));
    },
    async countChildren(parentAgentId) {
      await load();
      if (!AGENT_ID_PATTERN.test(String(parentAgentId ?? ""))) return 0;
      return readQuery(() => {
        const row = countChildren.get(parentAgentId) as { count?: unknown } | undefined;
        const count = Number(row?.count ?? 0);
        if (!Number.isSafeInteger(count) || count < 0) throw corrupt("Agent child count is malformed.");
        return count;
      });
    },
    async listByParent(parentAgentId) {
      await load();
      if (!AGENT_ID_PATTERN.test(String(parentAgentId ?? ""))) return [];
      return readQuery(() => (
        (selectByParent.all(parentAgentId) as RegistryRow[]).map((row) => decodeRow(row, maxRecordBytes, hmacSecret))
      ));
    },
    async listAll() {
      await load();
      return readQuery(() => (
        (selectAll.all() as RegistryRow[]).map((row) => decodeRow(row, maxRecordBytes, hmacSecret))
      ));
    },
    async close() {
      if (closed) return;
      closed = true;
      try { database.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } catch { /* Preserve close semantics. */ }
      database.close();
    },
    getHealth() {
      if (closed) return health("closed", false, null);
      try {
        assertDatabaseHealthy(database);
        const verified = verifyAndRecoverRuntimeAuthority({
          db: database,
          checkpointPath,
          expectedPathBinding: pathBindingSha256,
          hmacSecret,
          maxRecordBytes,
        });
        authority = verified.authority;
        checkpointVerified = true;
        if (verified.rolledForward) recoveryStatus = "rolled-forward";
        if (!loaded) {
          for (const persisted of selectAll.all() as RegistryRow[]) decodeRow(persisted, maxRecordBytes, hmacSecret);
          loaded = true;
        }
        const row = database.prepare("SELECT COUNT(*) AS count FROM agent_registry_records").get() as { count?: unknown };
        const count = Number(row.count ?? 0);
        if (!Number.isSafeInteger(count) || count < 0) throw corrupt("Agent registry count is malformed.");
        lastErrorCode = null;
        return health("ready", true, count);
      } catch (error) {
        lastErrorCode = errorCode(error);
        checkpointVerified = false;
        recoveryStatus = "failed";
        return health("degraded", false, null);
      }
    },
  };

  function health(
    status: SqliteAgentRegistryHealth["status"],
    available: boolean,
    recordCount: number | null,
  ): SqliteAgentRegistryHealth {
    return Object.freeze({
      ...SQLITE_AGENT_REGISTRY_BOUNDARIES,
      status,
      available,
      loaded,
      schemaVersion: SQLITE_AGENT_REGISTRY_SCHEMA_VERSION,
      migrationCount: SQLITE_AGENT_REGISTRY_MIGRATIONS.length,
      recordCount,
      busyTimeoutMs,
      pathExposed: false,
      checkpointVerified,
      authorityRevision: authority?.revision ?? null,
      authorityInstallationExposed: false,
      recoveryStatus,
      lastErrorCode,
    });
  }
}

function initializeMigrations(db: DatabaseSync, now: () => string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY CHECK (version > 0),
      name TEXT NOT NULL,
      checksum TEXT NOT NULL CHECK (length(checksum) = 64),
      applied_at TEXT NOT NULL
    ) STRICT;
  `);
  validateMigrationRows(readMigrations(db));
  for (const migration of SQLITE_AGENT_REGISTRY_MIGRATIONS) {
    transaction(db, () => {
      const applied = readMigrations(db);
      validateMigrationRows(applied);
      if (applied.some((row) => row.version === migration.version)) return;
      const expectedNext = applied.length + 1;
      if (migration.version !== expectedNext) throw migrationError();
      db.exec(migration.sql);
      db.prepare(`
        INSERT INTO schema_migrations (version, name, checksum, applied_at)
        VALUES (?, ?, ?, ?)
      `).run(migration.version, migration.name, migration.checksum, normalizedTimestamp(now()));
    });
  }
  validateMigrationRows(readMigrations(db), true);
  db.exec(`PRAGMA user_version = ${SQLITE_AGENT_REGISTRY_SCHEMA_VERSION}`);
}

function readMigrations(db: DatabaseSync): MigrationRow[] {
  return db.prepare(`
    SELECT version, name, checksum FROM schema_migrations ORDER BY version ASC
  `).all() as MigrationRow[];
}

function validateMigrationRows(rows: MigrationRow[], requireComplete = false): void {
  if (!Array.isArray(rows) || rows.length > SQLITE_AGENT_REGISTRY_MIGRATIONS.length) throw migrationError();
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const expected = SQLITE_AGENT_REGISTRY_MIGRATIONS[index];
    if (!expected || Number(row.version) !== expected.version
      || row.name !== expected.name || row.checksum !== expected.checksum) {
      throw migrationError();
    }
  }
  if (requireComplete && rows.length !== SQLITE_AGENT_REGISTRY_MIGRATIONS.length) throw migrationError();
}

function initializeHostMetadata(db: DatabaseSync, hostBindingSha256: string, now: () => string): void {
  transaction(db, () => {
    const row = db.prepare(`
      SELECT schema_version, host_binding_sha256, created_at, updated_at, metadata_checksum
      FROM agent_registry_metadata WHERE singleton = 1
    `).get() as MetadataRow | undefined;
    if (!row) {
      const timestamp = normalizedTimestamp(now());
      db.prepare(`
        INSERT INTO agent_registry_metadata (
          singleton, schema_version, host_binding_sha256, created_at, updated_at, metadata_checksum
        ) VALUES (1, ?, ?, ?, ?, ?)
      `).run(
        SQLITE_AGENT_REGISTRY_SCHEMA_VERSION,
        hostBindingSha256,
        timestamp,
        timestamp,
        metadataChecksum(SQLITE_AGENT_REGISTRY_SCHEMA_VERSION, hostBindingSha256, timestamp, timestamp),
      );
      return;
    }
    const storedSchemaVersion = Number(row.schema_version);
    if (!Number.isSafeInteger(storedSchemaVersion) || storedSchemaVersion < 1
      || storedSchemaVersion > SQLITE_AGENT_REGISTRY_SCHEMA_VERSION
      || !SHA256_PATTERN.test(row.host_binding_sha256)
      || row.host_binding_sha256 !== hostBindingSha256) {
      throw hostMismatchError();
    }
    const expected = metadataChecksum(
      storedSchemaVersion, row.host_binding_sha256, row.created_at, row.updated_at,
    );
    if (row.metadata_checksum !== expected) throw corrupt("Agent registry metadata integrity failed.");
    if (storedSchemaVersion < SQLITE_AGENT_REGISTRY_SCHEMA_VERSION) {
      const updatedAt = normalizedTimestamp(now());
      db.prepare(`
        UPDATE agent_registry_metadata
        SET schema_version = ?, updated_at = ?, metadata_checksum = ?
        WHERE singleton = 1
      `).run(
        SQLITE_AGENT_REGISTRY_SCHEMA_VERSION,
        updatedAt,
        metadataChecksum(
          SQLITE_AGENT_REGISTRY_SCHEMA_VERSION,
          row.host_binding_sha256,
          row.created_at,
          updatedAt,
        ),
      );
    }
  });
}

function verifyHostMetadataReadOnly(db: DatabaseSync, hostBindingSha256: string): void {
  const row = db.prepare(`
    SELECT schema_version, host_binding_sha256, created_at, updated_at, metadata_checksum
    FROM agent_registry_metadata WHERE singleton = 1
  `).get() as MetadataRow | undefined;
  if (!row || Number(row.schema_version) !== SQLITE_AGENT_REGISTRY_SCHEMA_VERSION
    || row.host_binding_sha256 !== hostBindingSha256
    || !SHA256_PATTERN.test(row.host_binding_sha256)) throw hostMismatchError();
  const expected = metadataChecksum(
    Number(row.schema_version), row.host_binding_sha256, row.created_at, row.updated_at,
  );
  if (row.metadata_checksum !== expected) throw corrupt("Agent registry metadata integrity failed.");
}

function assertSchema(db: DatabaseSync): void {
  const userVersion = readPragmaInteger(db, "user_version");
  if (userVersion !== SQLITE_AGENT_REGISTRY_SCHEMA_VERSION) throw schemaError();
  const tables = db.prepare("PRAGMA table_list").all() as Array<{ name?: unknown; strict?: unknown }>;
  for (const name of [
    "schema_migrations",
    "agent_registry_metadata",
    "agent_registry_records",
    "agent_registry_authority",
    "agent_registry_authority_events",
  ]) {
    const table = tables.find((entry) => entry.name === name);
    if (!table || Number(table.strict) !== 1) throw schemaError();
  }
  assertColumns(db, "schema_migrations", ["version", "name", "checksum", "applied_at"]);
  assertColumns(db, "agent_registry_metadata", [
    "singleton", "schema_version", "host_binding_sha256", "created_at", "updated_at", "metadata_checksum",
  ]);
  assertColumns(db, "agent_registry_records", [
    "agent_id", "tenant_id", "owner_user_id", "parent_agent_id", "generation_depth", "status",
    "policy_hash", "created_at", "expires_at", "record_json", "updated_at", "record_hmac",
  ]);
  assertColumns(db, "agent_registry_authority", [
    "singleton", "installation_id", "backend_id", "path_binding_sha256", "revision",
    "event_head", "projection_xor", "projection_hash", "record_count", "state_hmac",
    "created_at", "updated_at",
  ]);
  assertColumns(db, "agent_registry_authority_events", [
    "revision", "previous_head", "event_hash", "event_hmac", "batch_hash",
    "path_binding_sha256", "projection_hash", "record_count", "created_at",
  ]);
  const indexes = new Set(
    (db.prepare("PRAGMA index_list('agent_registry_records')").all() as Array<{ name?: unknown }>)
      .map((entry) => String(entry.name ?? "")),
  );
  for (const name of [
    "agent_registry_tenant_created_idx", "agent_registry_parent_status_idx", "agent_registry_status_expiry_idx",
  ]) {
    if (!indexes.has(name)) throw schemaError();
  }
  const triggers = db.prepare(`
    SELECT name FROM sqlite_schema WHERE type = 'trigger' AND tbl_name = 'agent_registry_records'
  `).all() as Array<{ name?: unknown }>;
  const triggerNames = new Set(triggers.map((row) => String(row.name ?? "")));
  if (triggerNames.size !== 2
    || !triggerNames.has("agent_registry_record_hmac_required_insert")
    || !triggerNames.has("agent_registry_record_hmac_required_update")) throw schemaError();
  assertDatabaseHealthy(db);
}

function assertColumns(db: DatabaseSync, table: string, expected: string[]): void {
  const rows = db.prepare(`PRAGMA table_info('${table}')`).all() as Array<{ name?: unknown }>;
  if (rows.length !== expected.length || rows.some((row, index) => row.name !== expected[index])) throw schemaError();
}

function assertPragmas(db: DatabaseSync, busyTimeoutMs: number): void {
  if (readPragmaInteger(db, "foreign_keys") !== 1
    || readPragmaInteger(db, "synchronous") !== 2
    || readPragmaInteger(db, "busy_timeout") !== busyTimeoutMs) {
    throw schemaError();
  }
}

function assertDatabaseHealthy(db: DatabaseSync): void {
  const quick = db.prepare("PRAGMA quick_check").get() as { quick_check?: unknown } | undefined;
  if (String(quick?.quick_check ?? "").toLowerCase() !== "ok") throw corrupt("Agent registry SQLite integrity check failed.");
  if (db.prepare("PRAGMA foreign_key_check").all().length !== 0) {
    throw corrupt("Agent registry foreign-key integrity check failed.");
  }
}

function transaction<T>(db: DatabaseSync, operation: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* Preserve the original failure. */ }
    throw error;
  }
}

function assertParentBinding(
  record: AgentRegistryRecord,
  batch: Map<string, AgentRegistryRecord>,
  selectById: ReturnType<DatabaseSync["prepare"]>,
  maxRecordBytes: number,
  hmacSecret: string,
): void {
  if (record.parentAgentId === null) return;
  const parent = batch.get(record.parentAgentId)
    ?? decodeOptionalRow(selectById.get(record.parentAgentId) as RegistryRow | undefined, maxRecordBytes, hmacSecret);
  if (!parent) throw corrupt(`Agent registry parent ${record.parentAgentId} is missing.`);
  if (parent.tenantId !== record.tenantId || parent.ownerUserId !== record.ownerUserId
    || parent.generationDepth + 1 !== record.generationDepth
    || Date.parse(record.expiresAt) > Date.parse(parent.expiresAt)) {
    throw corrupt(`Agent registry lineage for ${record.agentId} is malformed.`);
  }
  const ceiling = new Set(parent.grantedTools);
  if (record.requestedTools.some((tool) => !ceiling.has(tool))
    || record.grantedTools.some((tool) => !ceiling.has(tool))) {
    throw corrupt(`Agent registry lineage for ${record.agentId} expands parent tools.`);
  }
}

function assertImmutableIdentity(previous: AgentRegistryRecord, next: AgentRegistryRecord): void {
  for (const key of [
    "tenantId", "ownerUserId", "createdBy", "parentAgentId", "generationDepth", "createdAt",
  ] as const) {
    if (previous[key] !== next[key]) throw corrupt(`Agent registry identity field ${key} is immutable.`);
  }
  for (const key of ["name", "purpose", "classification", "traits", "riskLevel", "requestedTools"] as const) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(next[key])) {
      throw corrupt(`Agent registry definition field ${key} is immutable.`);
    }
  }
}

function decodeOptionalRow(row: RegistryRow | undefined, maxRecordBytes: number, hmacSecret: string): AgentRegistryRecord | null {
  return row ? decodeRow(row, maxRecordBytes, hmacSecret) : null;
}

function decodeRow(row: RegistryRow, maxRecordBytes: number, hmacSecret: string): AgentRegistryRecord {
  if (!row || typeof row.record_json !== "string" || Buffer.byteLength(row.record_json) > maxRecordBytes) {
    throw corrupt("Agent registry SQLite row is malformed.");
  }
  let parsed: unknown;
  try { parsed = JSON.parse(row.record_json); }
  catch (error) { throw corrupt("Agent registry record JSON could not be parsed.", error); }
  const record = validateRecord(row.agent_id, parsed, maxRecordBytes);
  if (row.tenant_id !== record.tenantId || row.owner_user_id !== record.ownerUserId
    || row.parent_agent_id !== record.parentAgentId || Number(row.generation_depth) !== record.generationDepth
    || row.status !== record.status || row.policy_hash !== record.policyHash
    || row.created_at !== record.createdAt || row.expires_at !== record.expiresAt
    || !safeHexEqual(row.record_hmac, recordHmac(record, hmacSecret))) {
    throw corrupt(`Agent registry columns diverge from record JSON for ${record.agentId}.`);
  }
  return record;
}

function validateRecord(id: string, input: unknown, maxRecordBytes: number): AgentRegistryRecord {
  if (!AGENT_ID_PATTERN.test(String(id ?? "")) || !isPlainRecord(input)) {
    throw corrupt("Agent registry record identity is malformed.");
  }
  assertExactKeys(input, REQUIRED_RECORD_KEYS, OPTIONAL_RECORD_KEYS);
  if (input.agentId !== id
    || !boundedText(input.name, 200) || !boundedFreeText(input.purpose, 4_000)
    || !boundedText(input.tenantId, 256) || !boundedText(input.ownerUserId, 256)
    || !boundedText(input.createdBy, 256)
    || (input.parentAgentId !== null && !AGENT_ID_PATTERN.test(String(input.parentAgentId ?? "")))
    || !Number.isSafeInteger(input.generationDepth) || Number(input.generationDepth) < 0
    || Number(input.generationDepth) > 1_024
    || !validClassification(input.classification)
    || !validTraits(input.traits) || !RISKS.has(input.riskLevel as RiskLevel)
    || !validTools(input.requestedTools) || !validTools(input.grantedTools)
    || !POLICY_HASH_PATTERN.test(String(input.policyHash ?? ""))
    || !STATUSES.has(input.status as AgentStatus)
    || !validTimestamp(input.createdAt) || !validTimestamp(input.expiresAt)
    || Date.parse(String(input.expiresAt)) < Date.parse(String(input.createdAt))
    || (input.revokedAt !== undefined && !validTimestamp(input.revokedAt))) {
    throw corrupt(`Agent registry record ${id} is malformed.`);
  }
  if ((input.parentAgentId === null) !== (input.generationDepth === 0)) {
    throw corrupt(`Agent registry record ${id} has malformed lineage depth.`);
  }
  const cloned = structuredClone(input) as unknown as AgentRegistryRecord;
  if (Buffer.byteLength(JSON.stringify(cloned)) > maxRecordBytes) {
    throw corrupt(`Agent registry record ${id} exceeds the SQLite record limit.`);
  }
  return cloned;
}

function validClassification(value: unknown): value is AgentClassification {
  if (!isPlainRecord(value)) return false;
  assertExactKeys(value, ["family", "domain", "subclass"], []);
  return FAMILIES.has(value.family as AgentFamily)
    && boundedText(value.domain, 256)
    && boundedText(value.subclass, 256);
}

function validTraits(value: unknown): value is AgentTrait[] {
  return isPlainDataArray(value, TRAITS.size)
    && value.every((item) => typeof item === "string" && TRAITS.has(item as AgentTrait))
    && new Set(value).size === value.length;
}

function validTools(value: unknown): value is string[] {
  return isPlainDataArray(value, 256)
    && value.every((item) => typeof item === "string" && item === item.trim()
      && item.length > 0 && item.length <= 256 && !CONTROL_PATTERN.test(item)
      && !RESERVED_TOOL_NAMES.has(item))
    && new Set(value).size === value.length;
}

function isPlainDataArray(value: unknown, maximumLength: number): value is unknown[] {
  if (!Array.isArray(value) || value.length > maximumLength || Object.keys(value).length !== value.length) return false;
  return Object.entries(Object.getOwnPropertyDescriptors(value)).every(([key, descriptor]) => (
    key === "length"
    || (descriptor.enumerable === true && descriptor.get === undefined && descriptor.set === undefined)
  ));
}

function assertExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
): void {
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  if (required.some((key) => !Object.hasOwn(value, key)) || keys.some((key) => !allowed.has(key))) {
    throw corrupt("Agent registry record contains missing or unknown fields.");
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(Object.getOwnPropertyDescriptors(value)).every((descriptor) => (
    descriptor.enumerable === true
    && descriptor.get === undefined
    && descriptor.set === undefined
  ));
}

function boundedText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value === value.trim() && value.length > 0
    && value.length <= maxLength && !CONTROL_PATTERN.test(value);
}

function boundedFreeText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim() !== "" && value.length <= maxLength
    && !FREE_TEXT_CONTROL_PATTERN.test(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && !CONTROL_PATTERN.test(value)
    && Number.isFinite(Date.parse(value));
}

function normalizedTimestamp(value: unknown): string {
  if (!validTimestamp(value)) throw configurationError();
  return String(value);
}

function validScope(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "" && value === value.trim()
    && value.length <= 256 && !CONTROL_PATTERN.test(value);
}

function metadataChecksum(
  schemaVersion: number,
  hostBindingSha256: string,
  createdAt: string,
  updatedAt: string,
): string {
  return sha256(`${schemaVersion}\0${hostBindingSha256}\0${createdAt}\0${updatedAt}`);
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function resolveSqlitePath(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized === ":memory:" || normalized.length > MAX_PATH_LENGTH || CONTROL_PATTERN.test(normalized)) {
    throw configurationError();
  }
  return resolve(normalized);
}

function normalizeHostId(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > MAX_HOST_ID_LENGTH || CONTROL_PATTERN.test(normalized)) throw configurationError();
  return normalized;
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) throw configurationError();
  return Number(value);
}

function assertSafeDatabaseFile(path: string, allowMissing: boolean): void {
  if (!existsSync(path)) {
    if (allowMissing) return;
    throw configurationError();
  }
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw configurationError();
}

function assertNoLinkedParentComponents(path: string): void {
  const chain: string[] = [];
  let current = resolve(path);
  while (true) {
    chain.push(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  for (const candidate of chain.reverse()) {
    if (!existsSync(candidate)) continue;
    const stats = lstatSync(candidate);
    if (!stats.isDirectory() || stats.isSymbolicLink()) throw configurationError();
  }
}

function readPragmaInteger(db: DatabaseSync, name: string): number {
  const row = db.prepare(`PRAGMA ${name}`).get() as Record<string, unknown> | undefined;
  return Number(row?.[name] ?? (row ? Object.values(row)[0] : undefined));
}

function errorCode(error: unknown): string {
  return typeof (error as { code?: unknown })?.code === "string"
    ? String((error as { code: string }).code).slice(0, 128)
    : "AGENT_REGISTRY_SQLITE_UNAVAILABLE";
}

function isKnownError(error: unknown): boolean {
  return error instanceof SqliteAgentRegistryError
    || Boolean(error && typeof error === "object" && (error as { name?: unknown }).name === "GovernanceAgentRegistryCorrupt");
}

function configurationError(): SqliteAgentRegistryError {
  return new SqliteAgentRegistryError(
    "AGENT_REGISTRY_SQLITE_CONFIGURATION_INVALID",
    "The SQLite Agent registry configuration is invalid.",
    "configuration",
    500,
  );
}

function schemaError(): SqliteAgentRegistryError {
  return new SqliteAgentRegistryError(
    "AGENT_REGISTRY_SQLITE_SCHEMA_INCOMPATIBLE",
    "The SQLite Agent registry schema or required PRAGMAs are incompatible.",
    "integrity",
    500,
  );
}

function migrationError(): SqliteAgentRegistryError {
  return new SqliteAgentRegistryError(
    "AGENT_REGISTRY_SQLITE_MIGRATION_MISMATCH",
    "The SQLite Agent registry migration ledger does not match this build.",
    "integrity",
    500,
  );
}

function checkpointError(message = "The SQLite Agent registry authority checkpoint is invalid.", cause?: unknown): SqliteAgentRegistryError {
  return new SqliteAgentRegistryError(
    "AGENT_REGISTRY_SQLITE_CHECKPOINT_INVALID",
    message,
    "integrity",
    500,
    false,
    cause,
  );
}

function rollbackDetectedError(): SqliteAgentRegistryError {
  return new SqliteAgentRegistryError(
    "AGENT_REGISTRY_SQLITE_ROLLBACK_DETECTED",
    "The SQLite Agent registry database is older than, or diverges from, its verified authority checkpoint.",
    "integrity",
    500,
  );
}

function legacyMigrationRequiredError(): SqliteAgentRegistryError {
  return new SqliteAgentRegistryError(
    "AGENT_REGISTRY_SQLITE_LEGACY_AUTHORITY_MIGRATION_REQUIRED",
    "The legacy SQLite Agent registry contains records and requires an explicit verified authority migration.",
    "configuration",
    500,
  );
}

function directoryMigrationRequiredError(
  message = "The SQLite Agent registry authority is bound to another database path and requires an explicit directory migration.",
): SqliteAgentRegistryError {
  return new SqliteAgentRegistryError(
    "AGENT_REGISTRY_SQLITE_DIRECTORY_MIGRATION_REQUIRED",
    message,
    "configuration",
    500,
  );
}

function hostMismatchError(): SqliteAgentRegistryError {
  return new SqliteAgentRegistryError(
    "AGENT_REGISTRY_SQLITE_HOST_MISMATCH",
    "The SQLite Agent registry is bound to another host.",
    "configuration",
    503,
  );
}

function closedError(): SqliteAgentRegistryError {
  return new SqliteAgentRegistryError(
    "AGENT_REGISTRY_SQLITE_CLOSED",
    "The SQLite Agent registry is closed.",
    "lifecycle",
    503,
  );
}

function unavailableError(cause?: unknown): SqliteAgentRegistryError {
  return new SqliteAgentRegistryError(
    "AGENT_REGISTRY_SQLITE_UNAVAILABLE",
    "The SQLite Agent registry is unavailable.",
    "persistence",
    503,
    true,
    cause,
  );
}

function writeError(cause?: unknown): SqliteAgentRegistryError {
  return new SqliteAgentRegistryError(
    "AGENT_REGISTRY_SQLITE_WRITE_FAILED",
    "The SQLite Agent registry transaction did not commit.",
    "persistence",
    503,
    true,
    cause,
  );
}

function corrupt(message: string, cause?: unknown): Error & { code: string; category: string; statusCode: number } {
  return Object.assign(
    new Error(message, cause === undefined ? undefined : { cause }),
    {
      name: "GovernanceAgentRegistryCorrupt",
      code: "AGENT_REGISTRY_SQLITE_CORRUPT",
      category: "integrity",
      statusCode: 500,
    },
  );
}
