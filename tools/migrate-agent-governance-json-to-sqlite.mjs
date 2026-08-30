#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  unlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { stableStringify } from "../packages/policy-engine/src/index.ts";
import { createAgentApprovalStore } from "../apps/ai-gateway-service/src/agent-governance/agentApprovalStore.ts";
import { createAgentRegistryStore } from "../apps/ai-gateway-service/src/agent-governance/agentRegistryStore.ts";
import { acquireGovernanceOwnerLease } from "../apps/ai-gateway-service/src/agent-governance/governanceOwnerLease.ts";
import { createGovernanceAuditLog } from "../apps/ai-gateway-service/src/agent-governance/governanceAuditLog.ts";
import { getGovernanceStateAuthority } from "../apps/ai-gateway-service/src/agent-governance/governanceStateAnchor.ts";
import { createPolicyCatalogStore } from "../apps/ai-gateway-service/src/agent-governance/policyCatalogStore.ts";
import {
  assertRegistryAuthorityMode,
  computeSignedJsonRegistryDigest,
  readRegistryAuthoritySwitchMarker,
  SQLITE_REGISTRY_AUTHORITY_PROTOCOL,
  writeRegistryAuthoritySwitchMarker,
} from "../apps/ai-gateway-service/src/agent-governance/registryAuthoritySwitch.ts";
import {
  createSqliteAgentRegistryStore,
  verifySqliteAgentRegistryAuthoritySnapshot,
} from "../apps/ai-gateway-service/src/agent-governance/sqliteAgentRegistryStore.ts";
import { SQLITE_AGENT_REGISTRY_SCHEMA_VERSION } from "../apps/ai-gateway-service/src/agent-governance/sqliteAgentRegistryMigrations.ts";
import { createUsageStore } from "../apps/ai-gateway-service/src/agent-governance/usageStore.ts";

const MAX_SOURCE_RECORDS = 100_000;
const MAX_SECRET_BYTES = 16 * 1024;
const PENDING_SOURCE_FILES = [
  "governance-state.journal.json",
  "agent-generation.journal.json",
  "policy-activation.journal.json",
];
const REQUIRED_SOURCE_FILES = [
  "agents.json",
  "governance-state.anchor.json",
  "governance-state.checkpoint.json",
  "governance-state.installation.json",
];

export class AgentRegistryMigrationError extends Error {
  constructor(code, message, cause) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "AgentRegistryMigrationError";
    this.code = code;
  }
}

export async function migrateAgentGovernanceJsonToSqlite(options) {
  const sourceDir = resolveRequiredPath(options?.sourceDir, "SOURCE_DIRECTORY_INVALID");
  const targetPath = resolveRequiredPath(options?.targetPath, "TARGET_PATH_INVALID");
  const checkpointPath = options?.checkpointPath === undefined
    ? join(dirname(targetPath), "agent-registry.checkpoint.json")
    : resolveRequiredPath(options.checkpointPath, "TARGET_CHECKPOINT_PATH_INVALID");
  const hostId = normalizeHostId(options?.hostId);
  const now = typeof options?.now === "function" ? options.now : () => new Date().toISOString();
  const faultInjector = typeof options?.faultInjector === "function" ? options.faultInjector : null;
  assertDistinctMigrationPaths({ sourceDir, targetPath, checkpointPath });
  const secret = options?.secret ?? await readSourceSecret(sourceDir, options?.env ?? process.env);
  assertSecret(secret);

  let ownerLease;
  let sourceSnapshot;
  try {
    ownerLease = acquireGovernanceOwnerLease({
      dataDir: sourceDir,
      ownerId: randomUUID(),
      ...(typeof options?.getProcessFingerprint === "function"
        ? { getProcessFingerprint: options.getProcessFingerprint }
        : {}),
    });
  } catch (error) {
    throw migrationError(
      "SOURCE_OFFLINE_LEASE_REQUIRED",
      "The signed JSON Registry must be offline and exclusively leased before migration.",
      error,
    );
  }

  try {
    await assertSourcePreconditions(sourceDir);
    sourceSnapshot = await readAndVerifySignedSource({ sourceDir, secret, hostId, now });
    ownerLease.assertHeld();
    await faultInjector?.("after-source-verified", publicCounts(sourceSnapshot.records));

    const existingMarker = await readRegistryAuthoritySwitchMarker({ dataDir: sourceDir, secret });
    const staging = stagingPaths(targetPath, checkpointPath);
    const existingTarget = await recoverOrInspectTargetPair({
      targetPath,
      checkpointPath,
      staging,
      existingMarker,
      sourceSnapshot,
      hostId,
      secret,
    });

    if (existingTarget) {
      const target = await readAndVerifyTarget({
        targetPath,
        checkpointPath,
        stagingSourcePath: staging.database,
        hostId,
        secret,
        now,
        expectedRecords: sourceSnapshot.records,
      });
      await assertSourceUnchanged(sourceSnapshot, sourceDir, secret);
      if (existingMarker) {
        await assertCompletedAuthoritySwitch({
          sourceDir,
          secret,
          sourceDigest: sourceSnapshot.sourceDigest,
          target,
        });
        return migrationSummary("already-complete", sourceSnapshot, target);
      }
      await faultInjector?.("before-authority-switch", publicCounts(sourceSnapshot.records));
      await publishAuthoritySwitch({ sourceDir, secret, sourceSnapshot, target, now });
      return migrationSummary("recovered-complete", sourceSnapshot, target);
    }

    if (existingMarker) {
      throw migrationError(
        "TARGET_REQUIRED_BY_AUTHORITY_SWITCH",
        "The authority switch exists but its SQLite target is unavailable.",
      );
    }

    await assertFreshTargetPair(targetPath, checkpointPath, staging);
    let stagingStore = null;
    let published = false;
    let stagingClaim = null;
    try {
      stagingClaim = await claimStagingNamespace(staging);
      stagingStore = createSqliteAgentRegistryStore({
        sqlitePath: staging.database,
        checkpointPath: staging.checkpoint,
        hostId,
        hmacSecret: secret,
        now,
      });
      await stagingStore.load();
      assertFreshHealth(stagingStore.getHealth());
      await stagingStore.upsertMany(sourceSnapshot.records);
      const stagedRecords = sortRecords(await stagingStore.listAll());
      assertSemanticEquality(sourceSnapshot.records, stagedRecords);
      const stagedHealth = stagingStore.getHealth();
      assertReadyHealth(stagedHealth, sourceSnapshot.records.length);
      assertAuthorityProtocol(stagingStore);
      await faultInjector?.("after-target-populated", publicCounts(stagedRecords));
      await stagingStore.close();
      stagingStore = null;
      await assertNoSqliteSidecars(staging.database);

      await publishTargetPair({ targetPath, checkpointPath, staging });
      published = true;
      await releaseStagingClaim(staging, stagingClaim);
      stagingClaim = null;
      await faultInjector?.("after-target-published", publicCounts(sourceSnapshot.records));

      const target = await readAndVerifyTarget({
        targetPath,
        checkpointPath,
        stagingSourcePath: staging.database,
        hostId,
        secret,
        now,
        expectedRecords: sourceSnapshot.records,
      });
      await assertSourceUnchanged(sourceSnapshot, sourceDir, secret);
      ownerLease.assertHeld();
      await faultInjector?.("before-authority-switch", publicCounts(sourceSnapshot.records));
      await publishAuthoritySwitch({ sourceDir, secret, sourceSnapshot, target, now });
      return migrationSummary("migrated", sourceSnapshot, target);
    } catch (error) {
      try { await stagingStore?.close(); } catch { /* Preserve the migration error. */ }
      if (!published && stagingClaim && !await pathExists(targetPath)) {
        await cleanupOwnedStaging(staging, stagingClaim);
      }
      if (error instanceof AgentRegistryMigrationError) throw error;
      throw migrationError(
        published ? "TARGET_POST_PUBLISH_VERIFICATION_FAILED" : "TARGET_MIGRATION_FAILED",
        published
          ? "The published SQLite Registry is not authority-switch eligible and remains inactive."
          : "The SQLite Registry migration failed before authority publication.",
        error,
      );
    }
  } catch (error) {
    if (error instanceof AgentRegistryMigrationError) throw error;
    throw migrationError(
      "SOURCE_REGISTRY_VERIFICATION_FAILED",
      "The signed JSON Agent Registry failed complete offline verification.",
      error,
    );
  } finally {
    try { ownerLease.release(); }
    catch (error) {
      throw migrationError(
        "SOURCE_OFFLINE_LEASE_RELEASE_FAILED",
        "The offline source lease could not be released safely.",
        error,
      );
    }
  }
}

async function readAndVerifySignedSource({ sourceDir, secret, hostId, now }) {
  // Register every canonical signed-state owner before the Registry asks the
  // shared anchor coordinator to authenticate the complete source head.
  createPolicyCatalogStore({ storePath: join(sourceDir, "policies.json"), secret, now });
  createAgentApprovalStore({ storePath: join(sourceDir, "approvals.json"), secret, now });
  createUsageStore({ dataDir: sourceDir, secret, now });
  createGovernanceAuditLog({ logPath: join(sourceDir, "audit-events.jsonl"), secret, now });
  const registry = createAgentRegistryStore({ storePath: join(sourceDir, "agents.json"), secret, now });

  const authorityBefore = await getGovernanceStateAuthority({ dataDir: sourceDir, secret });
  await registry.load();
  const records = sortRecords(await registry.listAll());
  if (records.length > MAX_SOURCE_RECORDS) {
    throw migrationError(
      "SOURCE_REGISTRY_CAPACITY_EXCEEDED",
      "The signed JSON Registry exceeds the bounded offline migration capacity.",
    );
  }
  const sourceDigest = await computeSignedJsonRegistryDigest(sourceDir);
  if (!sourceDigest) {
    throw migrationError(
      "SOURCE_REGISTRY_MISSING",
      "The signed JSON Registry is missing.",
    );
  }
  await validateRecordsWithEphemeralSqlite({ records, hostId, secret, now });
  const authorityAfter = await getGovernanceStateAuthority({ dataDir: sourceDir, secret });
  if (stableStringify(authorityBefore) !== stableStringify(authorityAfter)) {
    throw migrationError(
      "SOURCE_AUTHORITY_CHANGED",
      "The signed JSON Registry authority changed during verification.",
    );
  }
  return {
    records,
    sourceDigest,
    semanticDigest: recordsDigest(records),
    authority: authorityBefore,
  };
}

async function validateRecordsWithEphemeralSqlite({ records, hostId, secret, now }) {
  const root = await mkdtemp(join(tmpdir(), "agent-registry-migration-verify-"));
  const sqlitePath = join(root, "registry.sqlite");
  const checkpointPath = join(root, "registry.checkpoint.json");
  let store = null;
  try {
    store = createSqliteAgentRegistryStore({
      sqlitePath,
      checkpointPath,
      hostId,
      hmacSecret: secret,
      now,
    });
    await store.load();
    assertFreshHealth(store.getHealth());
    await store.upsertMany(records);
    const verified = sortRecords(await store.listAll());
    assertSemanticEquality(records, verified);
    assertReadyHealth(store.getHealth(), records.length);
    assertAuthorityProtocol(store);
  } catch (error) {
    throw migrationError(
      "SOURCE_REGISTRY_SEMANTICS_INVALID",
      "The signed JSON Registry cannot be represented by the SQLite Registry contract.",
      error,
    );
  } finally {
    try { await store?.close(); } catch { /* Preserve validation result. */ }
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
}

async function readAndVerifyTarget({
  targetPath,
  checkpointPath,
  stagingSourcePath,
  hostId,
  secret,
  now,
  expectedRecords,
}) {
  let store = null;
  try {
    store = createSqliteAgentRegistryStore({
      sqlitePath: targetPath,
      checkpointPath,
      hostId,
      hmacSecret: secret,
      allowDirectoryMigrationFromPath: stagingSourcePath,
      now,
    });
    await store.load();
    assertAuthorityProtocol(store);
    const records = sortRecords(await store.listAll());
    assertSemanticEquality(expectedRecords, records);
    const health = store.getHealth();
    assertReadyHealth(health, expectedRecords.length);
    const target = {
      authorityProtocol: store.getAuthorityProtocol(),
      authorityBinding: store.getAuthorityBinding(),
      recordCount: records.length,
      sqliteSchemaVersion: Number(health.schemaVersion),
      semanticDigest: recordsDigest(records),
    };
    await store.close();
    store = null;
    return target;
  } catch (error) {
    throw migrationError(
      "TARGET_REGISTRY_VERIFICATION_FAILED",
      "The SQLite Registry failed complete authority and semantic verification.",
      error,
    );
  } finally {
    try { await store?.close(); } catch { /* Preserve verification result. */ }
  }
}

async function publishAuthoritySwitch({ sourceDir, secret, sourceSnapshot, target, now }) {
  await writeRegistryAuthoritySwitchMarker({
    dataDir: sourceDir,
    secret,
    sourceAgentsSha256: sourceSnapshot.sourceDigest,
    targetAuthorityBinding: target.authorityBinding,
    recordCount: target.recordCount,
    sqliteSchemaVersion: target.sqliteSchemaVersion,
    completedAt: now(),
  });
  await assertCompletedAuthoritySwitch({
    sourceDir,
    secret,
    sourceDigest: sourceSnapshot.sourceDigest,
    target,
  });
}

async function assertCompletedAuthoritySwitch({ sourceDir, secret, sourceDigest, target }) {
  if (target.authorityProtocol !== SQLITE_REGISTRY_AUTHORITY_PROTOCOL) {
    throw migrationError(
      "TARGET_AUTHORITY_PROTOCOL_INVALID",
      "The SQLite Registry authority protocol is not eligible for migration.",
    );
  }
  const marker = await assertRegistryAuthorityMode({
    dataDir: sourceDir,
    secret,
    mode: "sqlite",
    target: {
      authorityProtocol: target.authorityProtocol,
      authorityBinding: target.authorityBinding,
      recordCount: target.recordCount,
      sqliteSchemaVersion: target.sqliteSchemaVersion,
    },
  });
  if (!marker || marker.source.agentsSha256 !== sourceDigest) {
    throw migrationError(
      "AUTHORITY_SWITCH_VERIFICATION_FAILED",
      "The Registry authority switch failed verification.",
    );
  }
}

async function assertSourceUnchanged(snapshot, sourceDir, secret) {
  const [sourceDigest, authority] = await Promise.all([
    computeSignedJsonRegistryDigest(sourceDir),
    getGovernanceStateAuthority({ dataDir: sourceDir, secret }),
  ]);
  if (sourceDigest !== snapshot.sourceDigest
    || stableStringify(authority) !== stableStringify(snapshot.authority)) {
    throw migrationError(
      "SOURCE_AUTHORITY_CHANGED",
      "The signed JSON Registry authority changed during migration.",
    );
  }
}

async function assertSourcePreconditions(sourceDir) {
  const sourceStats = await safeLstat(sourceDir);
  if (!sourceStats?.isDirectory() || sourceStats.isSymbolicLink()) {
    throw migrationError(
      "SOURCE_DIRECTORY_UNSAFE",
      "The signed JSON Registry directory is missing, linked, or unsafe.",
    );
  }
  for (const name of REQUIRED_SOURCE_FILES) {
    await assertRegularUnlinkedFile(join(sourceDir, name), "SOURCE_AUTHORITY_FILE_UNSAFE");
  }
  for (const name of PENDING_SOURCE_FILES) {
    if (await pathExists(join(sourceDir, name))) {
      throw migrationError(
        "SOURCE_RECOVERY_REQUIRED",
        "Pending signed-state recovery must complete before Registry migration.",
      );
    }
  }
}

async function assertFreshTargetPair(targetPath, checkpointPath, staging) {
  for (const path of [targetPath, checkpointPath, staging.database, staging.checkpoint, staging.claim]) {
    if (await pathExists(path)) {
      throw migrationError(
        path === targetPath || path === checkpointPath ? "TARGET_NOT_FRESH" : "TARGET_STAGING_CONFLICT",
        path === targetPath || path === checkpointPath
          ? "The SQLite target and checkpoint must be absent before first migration."
          : "A reserved migration staging path already exists and was preserved.",
      );
    }
  }
  await mkdir(dirname(targetPath), { recursive: true, mode: 0o700 });
  await mkdir(dirname(checkpointPath), { recursive: true, mode: 0o700 });
}

async function recoverOrInspectTargetPair({
  targetPath,
  checkpointPath,
  staging,
  existingMarker,
  sourceSnapshot,
  hostId,
  secret,
}) {
  let targetExists = await pathExists(targetPath);
  let checkpointExists = await pathExists(checkpointPath);
  const stagingDatabaseExists = await pathExists(staging.database);
  const stagingCheckpointExists = await pathExists(staging.checkpoint);
  let authenticatedStaging = null;
  if (stagingDatabaseExists || stagingCheckpointExists) {
    if (existingMarker || !stagingDatabaseExists || !stagingCheckpointExists) {
      throw migrationError(
        "TARGET_STAGING_CONFLICT",
        "A preexisting migration staging authority could not be authenticated and was preserved.",
      );
    }
    authenticatedStaging = verifyStagingAuthority({
      staging,
      sourceSnapshot,
      hostId,
      secret,
    });
    if (!authenticatedStaging) {
      throw migrationError(
        "TARGET_STAGING_CONFLICT",
        "A preexisting migration staging authority could not be authenticated and was preserved.",
      );
    }
  }

  if (!targetExists && !checkpointExists) {
    if (!stagingDatabaseExists && !stagingCheckpointExists && !await pathExists(staging.claim)) {
      return false;
    }
    if (!authenticatedStaging) throw migrationError(
      "TARGET_STAGING_CONFLICT",
      "A preexisting migration staging authority could not be authenticated and was preserved.",
    );
    await publishTargetPair({ targetPath, checkpointPath, staging });
    return true;
  }
  if (!targetExists && checkpointExists) {
    throw migrationError(
      "TARGET_NOT_FRESH",
      "A SQLite authority checkpoint exists without its target Registry.",
    );
  }

  if (!checkpointExists && stagingCheckpointExists) {
    await link(staging.checkpoint, checkpointPath);
    checkpointExists = true;
  }
  if (!checkpointExists) {
    throw migrationError(
      "TARGET_AUTHORITY_INCOMPLETE",
      "The SQLite target has no authority checkpoint and remains inactive.",
    );
  }

  if (stagingDatabaseExists) {
    await assertSameHardLink(targetPath, staging.database);
    await unlink(staging.database);
  }
  if (stagingCheckpointExists) {
    await assertSameHardLink(checkpointPath, staging.checkpoint);
    await unlink(staging.checkpoint);
  }
  await syncDirectory(dirname(targetPath));
  if (dirname(checkpointPath) !== dirname(targetPath)) await syncDirectory(dirname(checkpointPath));
  targetExists = true;
  return targetExists;
}

function verifyStagingAuthority({ staging, sourceSnapshot, hostId, secret }) {
  try {
    const snapshot = verifySqliteAgentRegistryAuthoritySnapshot({
      sqlitePath: staging.database,
      checkpointPath: staging.checkpoint,
      hostId,
      hmacSecret: secret,
    });
    if (snapshot.authorityProtocol !== SQLITE_REGISTRY_AUTHORITY_PROTOCOL
      || snapshot.checkpointVerified !== true
      || snapshot.schemaVersion !== SQLITE_AGENT_REGISTRY_SCHEMA_VERSION
      || snapshot.recordCount !== sourceSnapshot.records.length
      || snapshot.recordsDigestSha256 !== sourceSnapshot.semanticDigest) {
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
}

async function publishTargetPair({ targetPath, checkpointPath, staging }) {
  try {
    await link(staging.database, targetPath);
    await link(staging.checkpoint, checkpointPath);
    await unlink(staging.database);
    await unlink(staging.checkpoint);
    await syncDirectory(dirname(targetPath));
    if (dirname(checkpointPath) !== dirname(targetPath)) await syncDirectory(dirname(checkpointPath));
  } catch (error) {
    throw migrationError(
      "TARGET_ATOMIC_PUBLICATION_FAILED",
      "The SQLite Registry and checkpoint could not be published exclusively.",
      error,
    );
  }
}

function assertAuthorityProtocol(store) {
  if (typeof store.getAuthorityProtocol !== "function"
    || store.getAuthorityProtocol() !== SQLITE_REGISTRY_AUTHORITY_PROTOCOL
    || !/^sqlite-v2:[a-f0-9]{64}$/u.test(store.getAuthorityBinding())) {
    throw migrationError(
      "TARGET_AUTHORITY_PROTOCOL_INVALID",
      "The SQLite Registry authority protocol is not eligible for migration.",
    );
  }
}

function assertFreshHealth(health) {
  assertReadyHealth(health, 0);
}

function assertReadyHealth(health, expectedCount) {
  if (health?.status !== "ready" || health.available !== true
    || health.checkpointVerified !== true
    || health.authorityProtocol !== SQLITE_REGISTRY_AUTHORITY_PROTOCOL
    || health.recordCount !== expectedCount
    || !Number.isSafeInteger(health.schemaVersion) || health.schemaVersion < 1) {
    throw migrationError(
      "TARGET_AUTHORITY_NOT_READY",
      "The SQLite Registry authority is not ready or checkpoint-verified.",
    );
  }
}

function assertSemanticEquality(source, target) {
  if (source.length !== target.length) {
    throw migrationError(
      "TARGET_SEMANTIC_MISMATCH",
      "The SQLite Registry record count differs from the signed JSON source.",
    );
  }
  for (let index = 0; index < source.length; index += 1) {
    if (stableStringify(source[index]) !== stableStringify(target[index])) {
      throw migrationError(
        "TARGET_SEMANTIC_MISMATCH",
        "A SQLite Registry record differs from the signed JSON source.",
      );
    }
  }
}

function migrationSummary(status, source, target) {
  const roots = source.records.filter((record) => record.parentAgentId === null).length;
  const relationships = source.records.length - roots;
  return Object.freeze({
    status,
    sourceFormat: "signed-json-v1",
    targetFormat: SQLITE_REGISTRY_AUTHORITY_PROTOCOL,
    sourceVerified: true,
    targetVerified: true,
    authoritySwitchVerified: true,
    targetReady: true,
    recordCount: source.records.length,
    rootCount: roots,
    relationshipCount: relationships,
    semanticDigest: source.semanticDigest,
    sqliteSchemaVersion: target.sqliteSchemaVersion,
  });
}

function publicCounts(records) {
  const roots = records.filter((record) => record.parentAgentId === null).length;
  return Object.freeze({
    recordCount: records.length,
    rootCount: roots,
    relationshipCount: records.length - roots,
  });
}

function sortRecords(records) {
  return records.map((record) => structuredClone(record))
    .sort((left, right) => left.agentId.localeCompare(right.agentId));
}

function recordsDigest(records) {
  return `sha256:${createHash("sha256").update(stableStringify(records), "utf8").digest("hex")}`;
}

function stagingPaths(targetPath, checkpointPath) {
  return Object.freeze({
    database: `${targetPath}.migration-staging`,
    checkpoint: `${checkpointPath}.migration-staging`,
    claim: `${targetPath}.migration-staging.claim`,
  });
}

async function claimStagingNamespace(staging) {
  const token = randomUUID();
  let handle;
  try {
    handle = await open(staging.claim, "wx", 0o600);
    await handle.writeFile(`${token}\n`, "utf8");
    await handle.sync();
  } catch (error) {
    throw migrationError(
      "TARGET_STAGING_CONFLICT",
      "The reserved migration staging namespace is already occupied.",
      error,
    );
  } finally {
    await handle?.close();
  }
  for (const path of [staging.database, staging.checkpoint]) {
    if (await pathExists(path)) {
      await releaseStagingClaim(staging, token);
      throw migrationError(
        "TARGET_STAGING_CONFLICT",
        "A reserved migration staging path appeared concurrently and was preserved.",
      );
    }
  }
  return token;
}

async function cleanupOwnedStaging(staging, token) {
  await assertStagingClaim(staging, token);
  for (const path of [
    staging.database,
    `${staging.database}-wal`,
    `${staging.database}-shm`,
    staging.checkpoint,
  ]) {
    const stats = await safeLstat(path);
    if (!stats) continue;
    if (!stats.isFile() || stats.isSymbolicLink() || stats.nlink !== 1) {
      throw migrationError(
        "TARGET_STAGING_UNSAFE",
        "A reserved migration staging path is linked or unsafe.",
      );
    }
    await rm(path, { force: true });
  }
  await releaseStagingClaim(staging, token);
}

async function releaseStagingClaim(staging, token) {
  await assertStagingClaim(staging, token);
  await unlink(staging.claim);
  await syncDirectory(dirname(staging.claim));
}

async function assertStagingClaim(staging, token) {
  const stats = await safeLstat(staging.claim);
  if (!stats?.isFile() || stats.isSymbolicLink() || stats.nlink !== 1 || stats.size > 128) {
    throw migrationError(
      "TARGET_STAGING_CONFLICT",
      "The reserved migration staging claim is missing, linked, or unsafe.",
    );
  }
  const value = (await readFile(staging.claim, "utf8")).trim();
  if (value !== token) {
    throw migrationError(
      "TARGET_STAGING_CONFLICT",
      "The reserved migration staging claim belongs to another operation.",
    );
  }
}

async function assertNoSqliteSidecars(sqlitePath) {
  for (const path of [`${sqlitePath}-wal`, `${sqlitePath}-shm`]) {
    if (await pathExists(path)) {
      throw migrationError(
        "TARGET_SQLITE_SIDECAR_REMAINS",
        "SQLite WAL sidecars remain after close; atomic publication was refused.",
      );
    }
  }
}

async function assertSameHardLink(left, right) {
  const [leftStats, rightStats] = await Promise.all([
    assertRegularUnlinkedOrPublishedFile(left),
    assertRegularUnlinkedOrPublishedFile(right),
  ]);
  if (leftStats.dev !== rightStats.dev || leftStats.ino !== rightStats.ino
    || leftStats.nlink < 2 || rightStats.nlink < 2) {
    throw migrationError(
      "TARGET_PARTIAL_PUBLICATION_CONFLICT",
      "A reserved migration staging file does not belong to the published target.",
    );
  }
}

async function assertRegularUnlinkedOrPublishedFile(path) {
  const stats = await safeLstat(path);
  if (!stats?.isFile() || stats.isSymbolicLink()) {
    throw migrationError(
      "TARGET_FILE_UNSAFE",
      "A SQLite migration file is linked or not a regular file.",
    );
  }
  return stats;
}

async function assertRegularUnlinkedFile(path, code) {
  const stats = await safeLstat(path);
  if (!stats?.isFile() || stats.isSymbolicLink() || stats.nlink !== 1) {
    throw migrationError(code, "A signed Registry authority file is missing, linked, or unsafe.");
  }
  return stats;
}

async function readSourceSecret(sourceDir, env) {
  const fromEnv = typeof env?.AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY === "string"
    ? env.AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY.trim()
    : "";
  if (fromEnv) return fromEnv;
  const secretPath = join(sourceDir, "secret.key");
  const stats = await assertRegularUnlinkedFile(secretPath, "SOURCE_SECRET_UNSAFE");
  if (stats.size < 32 || stats.size > MAX_SECRET_BYTES) {
    throw migrationError("SOURCE_SECRET_UNSAFE", "The protected governance secret is unavailable.");
  }
  const bytes = await readFile(secretPath);
  const secret = bytes.toString("utf8").trim();
  bytes.fill(0);
  return secret;
}

function assertDistinctMigrationPaths({ sourceDir, targetPath, checkpointPath }) {
  const sourceFiles = new Set([
    ...REQUIRED_SOURCE_FILES,
    ...PENDING_SOURCE_FILES,
    "secret.key",
    "owner.lease.json",
    "registry-authority-switch.json",
  ].map((name) => resolve(sourceDir, name)));
  if (sourceFiles.has(targetPath) || sourceFiles.has(checkpointPath) || targetPath === checkpointPath) {
    throw migrationError(
      "MIGRATION_PATH_CONFLICT",
      "The SQLite target, checkpoint, and signed JSON source paths must be distinct.",
    );
  }
}

function resolveRequiredPath(value, code) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.includes("\0")) {
    throw migrationError(code, "A required migration path is invalid.");
  }
  return resolve(normalized);
}

function normalizeHostId(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 256 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw migrationError("TARGET_HOST_ID_INVALID", "A stable SQLite host binding is required.");
  }
  return normalized;
}

function assertSecret(secret) {
  if (typeof secret !== "string" || secret.trim().length < 32) {
    throw migrationError("SOURCE_SECRET_INVALID", "The protected governance secret is invalid.");
  }
}

async function safeLstat(path) {
  try { return await lstat(path); }
  catch (error) { if (isMissing(error)) return null; throw error; }
}

async function pathExists(path) {
  return Boolean(await safeLstat(path));
}

async function syncDirectory(path) {
  try {
    const handle = await open(path, "r");
    try { await handle.sync(); } finally { await handle.close(); }
  } catch (error) {
    if (process.platform !== "win32") throw error;
  }
}

function isMissing(error) {
  return Boolean(error && typeof error === "object" && error.code === "ENOENT");
}

function migrationError(code, message, cause) {
  return new AgentRegistryMigrationError(code, message, cause);
}

function parseCliArgs(argv) {
  const result = {
    sourceDir: ".data/agent-governance",
    targetPath: null,
    checkpointPath: undefined,
    hostId: null,
    json: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--source-dir") result.sourceDir = argv[++index] ?? "";
    else if (arg === "--target") result.targetPath = argv[++index] ?? "";
    else if (arg === "--checkpoint") result.checkpointPath = argv[++index] ?? "";
    else if (arg === "--host-id") result.hostId = argv[++index] ?? "";
    else if (arg === "--json") result.json = true;
    else if (arg === "--help" || arg === "-h") result.help = true;
    else throw migrationError("CLI_ARGUMENT_INVALID", "An unsupported migration argument was supplied.");
  }
  return result;
}

function usage() {
  return [
    "Offline signed JSON -> SQLite Agent Registry migration",
    "",
    "Usage:",
    "  node tools/migrate-agent-governance-json-to-sqlite.mjs --source-dir <dir> --target <db> --host-id <stable-id> [--checkpoint <file>] [--json]",
    "",
    "The HMAC secret is read from AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY or <source-dir>/secret.key.",
    "The command never accepts a secret argument and never changes runtime configuration.",
  ].join("\n");
}

async function main() {
  let args;
  try { args = parseCliArgs(process.argv.slice(2)); }
  catch (error) { return failCli(error, false); }
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  try {
    const summary = await migrateAgentGovernanceJsonToSqlite(args);
    if (args.json) process.stdout.write(`${JSON.stringify(summary)}\n`);
    else {
      process.stdout.write(
        `Agent Registry migration ${summary.status}: records=${summary.recordCount}, relationships=${summary.relationshipCount}, targetReady=true\n`,
      );
    }
  } catch (error) {
    failCli(error, args.json);
  }
}

function failCli(error, json) {
  const code = error instanceof AgentRegistryMigrationError
    ? error.code
    : "AGENT_REGISTRY_MIGRATION_FAILED";
  const result = { status: "failed", code, targetReady: false, retrySafe: true };
  if (json) process.stderr.write(`${JSON.stringify(result)}\n`);
  else process.stderr.write(`Agent Registry migration failed closed (${code}); targetReady=false, retrySafe=true.\n`);
  process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
