import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { connect as createNetConnection, createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

import { Task, TaskState } from "@a2a-js/sdk";
import { ServerCallContext } from "@a2a-js/sdk/server";
import { Pool } from "pg";

import { createPostgresAuditStore } from "../apps/ai-gateway-service/src/enterprise/postgresAuditStore.ts";
import { createExternalEffectGate } from "../apps/ai-gateway-service/src/external-effects/externalEffectGate.ts";
import { createA2ATaskStore } from "../apps/ai-gateway-service/src/http/a2aTaskStore.ts";
import { createIdempotencyCoordinator } from "../apps/ai-gateway-service/src/http/idempotencyCoordinator.ts";
import { createUsageLedger } from "../apps/ai-gateway-service/src/logging/usageLedgerFactory.ts";
import { createProviderDispatchGate } from "../apps/ai-gateway-service/src/providers/providerDispatchGate.ts";
import { createPostgresExecutionLifecycle } from "../apps/ai-gateway-service/src/workforce/postgresExecutionLifecycle.ts";
import { createPostgresTaskClaimLeaseManager } from "../apps/ai-gateway-service/src/workforce/postgresTaskClaimLease.ts";

const POSTGRES_IMAGE = "postgres:17-alpine";
const POSTGRES_USER = "gateway_drill";
const POSTGRES_DATABASE = "gateway_drill";
const MAX_PROCESS_OUTPUT_BYTES = 1024 * 1024;
const PROCESS_TIMEOUT_MS = 120_000;
const STARTUP_TIMEOUT_MS = 45_000;
const FIXTURE_TTL_MS = 30 * 60_000;

const rawArgs = process.argv.slice(2);
const options = Object.freeze({
  json: rawArgs.includes("--json"),
  dryRun: rawArgs.includes("--dry-run"),
  output: readArgumentValue(rawArgs, "--output"),
});

const result = await runRecoveryDrill(options).catch((error) => ({
  status: "failed",
  stage: error?.stage ?? "unknown",
  code: typeof error?.code === "string" ? error.code : "POSTGRES_RECOVERY_DRILL_FAILED",
  message: sanitizeFailureMessage(error?.message),
  failedChecks: Array.isArray(error?.failedChecks) ? error.failedChecks : [],
  diagnostics: error?.diagnostics && typeof error.diagnostics === "object" ? error.diagnostics : {},
  image: POSTGRES_IMAGE,
  realProviderCallsMade: false,
  cleanup: { attempted: true, complete: error?.cleanupComplete === true },
}));

if (options.output) {
  const outputPath = resolve(options.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

if (options.json) {
  process.stdout.write(`${JSON.stringify(result)}\n`);
} else {
  printHumanSummary(result);
}

if (result.status !== "recovered" && result.status !== "dry-run") {
  process.exitCode = 1;
}

async function runRecoveryDrill({ dryRun }) {
  const runId = randomUUID().replaceAll("-", "").slice(0, 20);
  if (dryRun) {
    return {
      status: "dry-run",
      image: POSTGRES_IMAGE,
      runId,
      plan: [
        "start disposable PostgreSQL 17 source on loopback",
        "seed eight gateway central-state contracts through application APIs",
        "create a custom-format logical backup",
        "destroy the source container",
        "restore into a clean PostgreSQL 17 container",
        "verify inventory and all eight application contracts",
        "build a real streaming standby from recovery with pg_basebackup -R and replay a post-basebackup WAL marker",
        "destroy the active recovery database, promote standby, switch a stable TCP endpoint, and verify through the same application clients",
        "restart standby and verify again through those same clients",
        "remove containers and the temporary backup artifact",
      ],
      boundaries: {
        credentialMode: "ephemeral-test-only",
        credentialTransport: "private-temporary-env-file",
        realProviderCallsMade: false,
        continuousWalRecoveryProved: false,
        automaticFailoverProved: false,
        productionRtoRpoProved: false,
      },
    };
  }

  const dockerExecutable = process.platform === "win32" ? "docker.exe" : "docker";
  const password = randomBytes(24).toString("base64url");
  const sourceName = `ai-gateway-pg-source-${runId}`;
  const recoveryName = `ai-gateway-pg-recovery-${runId}`;
  const standbyName = `ai-gateway-pg-standby-${runId}`;
  const basebackupName = `ai-gateway-pg-basebackup-${runId}`;
  const standbyChownName = `ai-gateway-pg-standby-chown-${runId}`;
  const replicationNetworkName = `ai-gateway-pg-replication-${runId}`;
  const sourceVolume = `ai-gateway-pg-source-data-${runId}`;
  const recoveryVolume = `ai-gateway-pg-recovery-data-${runId}`;
  const standbyVolume = `ai-gateway-pg-standby-data-${runId}`;
  const temporaryRoot = await mkdtemp(resolve(tmpdir(), "ai-gateway-pg-drill-"));
  const backupPath = resolve(temporaryRoot, "gateway-drill.dump");
  const postgresEnvPath = resolve(temporaryRoot, "postgres.env");
  await writeFile(postgresEnvPath, [
    `POSTGRES_USER=${POSTGRES_USER}`,
    `POSTGRES_PASSWORD=${password}`,
    `POSTGRES_DB=${POSTGRES_DATABASE}`,
    `PGPASSWORD=${password}`,
    "",
  ].join("\n"), { encoding: "utf8", mode: 0o600 });
  await chmod(postgresEnvPath, 0o600).catch(() => undefined);
  const cleanupTargets = new Set([
    sourceName,
    recoveryName,
    standbyName,
    basebackupName,
    standbyChownName,
  ]);
  const cleanupVolumes = new Set([sourceVolume, recoveryVolume, standbyVolume]);
  const cleanupNetworks = new Set([replicationNetworkName]);
  const startedAt = Date.now();
  let stage = "docker-preflight";
  let sourceRemoved = false;
  let recoveryStartedAt = null;
  let fixtureState;
  let sourceInventory;
  let restoredInventory;
  let standbyInventory;
  let firstVerification;
  let failoverVerification;
  let restartVerification;
  let backupDigest = null;
  let backupBytes = 0;
  let cleanupComplete = false;
  let pendingFailure = null;
  let applicationVerifier = null;
  let failoverProxy = null;
  let failoverStartedAt = null;
  let failoverVerifiedAt = null;
  let failoverSwitch = null;
  let proxyStats = null;
  let failoverSentinelPool = null;
  let failoverSentinelClient = null;
  let activeQueryInterrupted = false;
  let sentinelClientErrorEvents = 0;
  let sentinelPoolRecovered = false;
  let sentinelPoolRecoveredAfterRestart = false;
  let streamingReplication = null;
  let replicationHbaScope = null;

  try {
    await runDocker(dockerExecutable, ["version", "--format", "{{.Server.Version}}"], { stage });

    stage = "source-start";
    const sourcePublishedPort = await allocateLoopbackPort();
    await startPostgresContainer({
      dockerExecutable,
      containerName: sourceName,
      volumeName: sourceVolume,
      postgresEnvPath,
      publishedPort: sourcePublishedPort,
      runId,
    });
    await waitForPostgres({ dockerExecutable, containerName: sourceName });
    const sourcePort = await readPublishedPort(dockerExecutable, sourceName);
    assertCondition(sourcePort === sourcePublishedPort, "POSTGRES_RECOVERY_SOURCE_ENDPOINT_CHANGED");
    const sourceUrl = createConnectionString(sourcePort, password);
    await waitForClientPostgres(sourceUrl);

    stage = "fixture-seed";
    fixtureState = await seedApplicationState(sourceUrl, runId);
    sourceInventory = await readDatabaseInventory(sourceUrl);
    assertCondition(sourceInventory.tableCount >= 8, "POSTGRES_RECOVERY_SOURCE_SCHEMA_INCOMPLETE");
    assertCondition(sourceInventory.totalRows >= 8, "POSTGRES_RECOVERY_SOURCE_ROWS_INCOMPLETE");

    stage = "logical-backup";
    await runDocker(dockerExecutable, [
      "exec", sourceName,
      "pg_dump",
      "--username", POSTGRES_USER,
      "--dbname", POSTGRES_DATABASE,
      "--format=custom",
      "--compress=6",
      "--no-owner",
      "--no-acl",
      "--file=/tmp/gateway-drill.dump",
    ], { stage });
    await runDocker(dockerExecutable, [
      "cp", `${sourceName}:/tmp/gateway-drill.dump`, backupPath,
    ], { stage });
    const backupBuffer = await readFile(backupPath);
    const backupStats = await stat(backupPath);
    backupBytes = backupStats.size;
    backupDigest = sha256(backupBuffer);
    assertCondition(backupBytes > 0, "POSTGRES_RECOVERY_BACKUP_EMPTY");

    stage = "source-destruction";
    recoveryStartedAt = Date.now();
    await removeContainer(dockerExecutable, sourceName);
    cleanupTargets.delete(sourceName);
    await removeVolume(dockerExecutable, sourceVolume);
    cleanupVolumes.delete(sourceVolume);
    sourceRemoved = true;

    stage = "recovery-start";
    await createDockerNetwork(dockerExecutable, replicationNetworkName, runId);
    const recoveryPublishedPort = await allocateLoopbackPort();
    await startPostgresContainer({
      dockerExecutable,
      containerName: recoveryName,
      volumeName: recoveryVolume,
      postgresEnvPath,
      publishedPort: recoveryPublishedPort,
      networkName: replicationNetworkName,
      networkAlias: "primary",
      postgresArguments: [
        "-c", "wal_level=replica",
        "-c", "max_wal_senders=5",
        "-c", "max_replication_slots=5",
        "-c", "wal_keep_size=128MB",
        "-c", "hot_standby=on",
      ],
      runId,
    });
    await waitForPostgres({ dockerExecutable, containerName: recoveryName });
    const recoveryPort = await readPublishedPort(dockerExecutable, recoveryName);
    assertCondition(recoveryPort === recoveryPublishedPort, "POSTGRES_RECOVERY_ENDPOINT_CHANGED");
    const recoveryUrl = createConnectionString(recoveryPort, password);
    await waitForClientPostgres(recoveryUrl);

    stage = "logical-restore";
    await runDocker(dockerExecutable, [
      "cp", backupPath, `${recoveryName}:/tmp/gateway-drill.dump`,
    ], { stage });
    await runDocker(dockerExecutable, [
      "exec", recoveryName,
      "pg_restore",
      "--username", POSTGRES_USER,
      "--dbname", POSTGRES_DATABASE,
      "--exit-on-error",
      "--no-owner",
      "--no-acl",
      "/tmp/gateway-drill.dump",
    ], { stage });

    stage = "inventory-verify";
    restoredInventory = await readDatabaseInventory(recoveryUrl);
    assertCondition(
      sourceInventory.digest === restoredInventory.digest,
      "POSTGRES_RECOVERY_INVENTORY_MISMATCH",
    );

    stage = "application-verify";
    const proxyPublishedPort = await allocateLoopbackPort();
    failoverProxy = await createSwitchableTcpProxy({
      listenPort: proxyPublishedPort,
      targetPort: recoveryPort,
    });
    const proxyUrl = createConnectionString(proxyPublishedPort, password);
    await waitForClientPostgres(proxyUrl);
    applicationVerifier = createApplicationStateVerifier(proxyUrl, fixtureState);
    const firstVerificationWithDiagnostics = await applicationVerifier.verify();
    assertAllChecks(firstVerificationWithDiagnostics);
    firstVerification = publicApplicationChecks(firstVerificationWithDiagnostics);
    const firstRecoveryVerifiedAt = Date.now();

    stage = "standby-basebackup";
    replicationHbaScope = await configureReplicationHba({
      dockerExecutable,
      primaryContainerName: recoveryName,
      networkName: replicationNetworkName,
      temporaryRoot,
    });
    await runDocker(dockerExecutable, [
      "run", "--rm",
      "--name", standbyChownName,
      "--user", "root",
      "--mount", `type=volume,source=${standbyVolume},target=/var/lib/postgresql/data`,
      "--entrypoint", "chown",
      POSTGRES_IMAGE,
      "-R", "70:70", "/var/lib/postgresql/data",
    ], { stage });
    cleanupTargets.delete(standbyChownName);
    await runDocker(dockerExecutable, [
      "run", "--rm",
      "--name", basebackupName,
      "--user", "postgres",
      "--network", replicationNetworkName,
      "--env-file", postgresEnvPath,
      "--mount", `type=volume,source=${standbyVolume},target=/var/lib/postgresql/data`,
      "--entrypoint", "pg_basebackup",
      POSTGRES_IMAGE,
      "--dbname", `postgresql://${POSTGRES_USER}@primary:5432/postgres`,
      "--pgdata", "/var/lib/postgresql/data",
      "--format", "plain",
      "--wal-method", "stream",
      "--write-recovery-conf",
      "--checkpoint", "fast",
      "--progress",
    ], { stage });
    cleanupTargets.delete(basebackupName);

    stage = "standby-start";
    const standbyPublishedPort = await allocateLoopbackPort();
    await startPostgresContainer({
      dockerExecutable,
      containerName: standbyName,
      volumeName: standbyVolume,
      postgresEnvPath,
      publishedPort: standbyPublishedPort,
      networkName: replicationNetworkName,
      networkAlias: "standby",
      postgresArguments: ["-c", "hot_standby=on"],
      runId,
    });
    await waitForPostgres({ dockerExecutable, containerName: standbyName });
    const standbyPort = await readPublishedPort(dockerExecutable, standbyName);
    assertCondition(standbyPort === standbyPublishedPort, "POSTGRES_RECOVERY_STANDBY_ENDPOINT_CHANGED");
    const standbyUrl = createConnectionString(standbyPort, password);
    await waitForClientPostgres(standbyUrl);
    const standbyRoleBeforePromotion = await readPostgresRole(standbyUrl);
    assertCondition(
      standbyRoleBeforePromotion.inRecovery === true,
      "POSTGRES_RECOVERY_STANDBY_NOT_IN_RECOVERY",
    );
    const replicationEvidence = await writeAndWaitForReplication({
      primaryConnectionString: recoveryUrl,
      standbyConnectionString: standbyUrl,
      runId,
    });
    standbyInventory = await readDatabaseInventory(standbyUrl);
    assertCondition(
      sourceInventory.digest === standbyInventory.digest,
      "POSTGRES_RECOVERY_STANDBY_INVENTORY_MISMATCH",
    );
    streamingReplication = {
      baseBackupUsed: true,
      standbyInRecoveryBeforePromotion: standbyRoleBeforePromotion.inRecovery,
      markerReplayed: replicationEvidence.markerReplayed,
      replicationHbaScope,
      primaryWalLsn: replicationEvidence.primaryWalLsn,
      standbyReplayLsn: replicationEvidence.standbyReplayLsn,
      replayLagBytes: replicationEvidence.replayLagBytes,
      controlledPromotionProved: false,
      streamingReplicationProved: true,
    };

    stage = "endpoint-failover";
    failoverStartedAt = Date.now();
    failoverSentinelPool = new Pool({
      connectionString: proxyUrl,
      max: 1,
      allowExitOnIdle: false,
      connectionTimeoutMillis: 2_000,
    });
    failoverSentinelPool.on("error", () => undefined);
    failoverSentinelClient = await failoverSentinelPool.connect();
    failoverSentinelClient.on("error", () => {
      sentinelClientErrorEvents += 1;
    });
    await failoverSentinelClient.query("SELECT 1 AS ready");
    const interruptedQuery = failoverSentinelClient.query("SELECT pg_sleep(30)")
      .then(() => false, () => true);
    await delay(100);
    await removeContainer(dockerExecutable, recoveryName);
    cleanupTargets.delete(recoveryName);
    await removeVolume(dockerExecutable, recoveryVolume);
    cleanupVolumes.delete(recoveryVolume);
    activeQueryInterrupted = await Promise.race([
      interruptedQuery,
      delay(5_000).then(() => false),
    ]);
    failoverSentinelClient.release(true);
    failoverSentinelClient = null;
    assertCondition(activeQueryInterrupted, "POSTGRES_RECOVERY_ACTIVE_QUERY_NOT_INTERRUPTED");
    const promotionStartedAt = Date.now();
    await runDocker(dockerExecutable, [
      "exec", "--user", "postgres", standbyName,
      "pg_ctl", "promote",
      "--pgdata", "/var/lib/postgresql/data",
      "--wait",
      "--timeout", "15",
    ], { stage });
    await waitForWritablePrimary(standbyUrl);
    const standbyRoleAfterPromotion = await readPostgresRole(standbyUrl);
    assertCondition(
      standbyRoleAfterPromotion.inRecovery === false,
      "POSTGRES_RECOVERY_STANDBY_PROMOTION_FAILED",
    );
    streamingReplication.controlledPromotionProved = true;
    streamingReplication.promotionTimeMs = Date.now() - promotionStartedAt;
    streamingReplication.standbyInRecoveryAfterPromotion = standbyRoleAfterPromotion.inRecovery;
    failoverSwitch = failoverProxy.switchTarget(standbyPort);
    await waitForClientPostgres(proxyUrl);
    await failoverSentinelPool.query("SELECT 1 AS recovered");
    sentinelPoolRecovered = true;
    const failoverVerificationWithDiagnostics = await applicationVerifier.verify();
    assertAllChecks(failoverVerificationWithDiagnostics);
    failoverVerification = publicApplicationChecks(failoverVerificationWithDiagnostics);
    failoverVerifiedAt = Date.now();

    stage = "standby-restart";
    await runDocker(dockerExecutable, ["restart", standbyName], { stage });
    await waitForPostgres({ dockerExecutable, containerName: standbyName });
    const restartedStandbyPort = await readPublishedPort(dockerExecutable, standbyName);
    assertCondition(restartedStandbyPort === standbyPort, "POSTGRES_RECOVERY_STANDBY_ENDPOINT_CHANGED");
    await waitForClientPostgres(proxyUrl);
    await failoverSentinelPool.query("SELECT 1 AS recovered_after_restart");
    sentinelPoolRecoveredAfterRestart = true;
    const standbyRoleAfterRestart = await readPostgresRole(standbyUrl);
    assertCondition(
      standbyRoleAfterRestart.inRecovery === false,
      "POSTGRES_RECOVERY_PROMOTED_STANDBY_REVERTED",
    );
    streamingReplication.standbyInRecoveryAfterRestart = standbyRoleAfterRestart.inRecovery;
    const restartVerificationWithDiagnostics = await applicationVerifier.verify();
    assertAllChecks(restartVerificationWithDiagnostics);
    restartVerification = publicApplicationChecks(restartVerificationWithDiagnostics);

    stage = "cleanup";
    await applicationVerifier.close();
    applicationVerifier = null;
    await failoverSentinelPool.end();
    failoverSentinelPool = null;
    proxyStats = failoverProxy.getStats();
    await failoverProxy.close();
    failoverProxy = null;
    await removeContainer(dockerExecutable, standbyName);
    cleanupTargets.delete(standbyName);
    await removeDockerNetwork(dockerExecutable, replicationNetworkName);
    cleanupNetworks.delete(replicationNetworkName);
    await removeVolume(dockerExecutable, standbyVolume);
    cleanupVolumes.delete(standbyVolume);
    await rm(temporaryRoot, { recursive: true, force: true });
    cleanupComplete = true;

    return {
      status: "recovered",
      image: POSTGRES_IMAGE,
      runId,
      durationMs: Date.now() - startedAt,
      controlledRecoveryTimeMs: firstRecoveryVerifiedAt - recoveryStartedAt,
      controlledFailoverTimeMs: failoverVerifiedAt - failoverStartedAt,
      sourceDestroyedBeforeRestore: sourceRemoved,
      artifact: {
        format: "postgres-custom",
        bytes: backupBytes,
        sha256: backupDigest,
        retained: false,
      },
      databaseInventory: {
        tableCount: sourceInventory.tableCount,
        sequenceCount: sourceInventory.sequenceCount,
        totalRows: sourceInventory.totalRows,
        digest: sourceInventory.digest,
        exactRestoreMatch: sourceInventory.digest === restoredInventory.digest,
        standbyExactMatch: sourceInventory.digest === standbyInventory.digest,
      },
      applicationChecks: firstVerification,
      failoverChecks: failoverVerification,
      restartChecks: restartVerification,
      clientContinuity: {
        sameApplicationClientsAcrossRestart: true,
        sameApplicationClientsAcrossEndpointSwitch: true,
        stableLoopbackEndpoint: true,
      },
      endpointFailover: {
        mode: "operator-controlled-stable-tcp-endpoint",
        oldDatabaseDestroyedBeforeSwitch: true,
        standbyRestoredFromSameArtifact: false,
        standbyCreatedByPgBasebackup: true,
        activeQueryInterrupted,
        sentinelClientErrorEvents,
        sameSentinelPoolRecovered: sentinelPoolRecovered,
        sameSentinelPoolRecoveredAfterRestart: sentinelPoolRecoveredAfterRestart,
        activeConnectionsDropped: failoverSwitch.droppedConnections,
        proxySwitchCount: failoverSwitch.switchCount,
        acceptedConnections: proxyStats.acceptedConnections,
        rejectedConnections: proxyStats.rejectedConnections,
        automaticElectionProved: false,
        streamingReplicationProved: true,
      },
      streamingReplication,
      recoveryPoint: {
        mode: "controlled-logical-snapshot",
        fixtureRowsLost: 0,
        continuousWalRecoveryProved: false,
      },
      boundaries: {
        credentialMode: "ephemeral-test-only",
        credentialTransport: "private-temporary-env-file",
        loopbackOnly: true,
        realProviderCallsMade: false,
        streamingReplicationProved: true,
        controlledStandbyPromotionProved: true,
        operatorControlledEndpointSwitchProved: true,
        automaticFailoverProved: false,
        networkPartitionProved: false,
        splitBrainProved: false,
        productionRtoRpoProved: false,
      },
      realProviderCallsMade: false,
      cleanup: {
        attempted: true,
        complete: cleanupComplete,
        containersRemaining: 0,
        volumesRemaining: 0,
        networksRemaining: 0,
        proxyClosed: true,
        clientsClosed: true,
        artifactRetained: false,
      },
    };
  } catch (error) {
    error.stage = error.stage ?? stage;
    pendingFailure = error;
    throw error;
  } finally {
    let cleanupFailed = false;
    if (applicationVerifier) {
      await applicationVerifier.close().catch(() => {
        cleanupFailed = true;
      });
      applicationVerifier = null;
    }
    if (failoverSentinelClient) {
      failoverSentinelClient.release(true);
      failoverSentinelClient = null;
    }
    if (failoverSentinelPool) {
      await failoverSentinelPool.end().catch(() => {
        cleanupFailed = true;
      });
      failoverSentinelPool = null;
    }
    if (failoverProxy) {
      await failoverProxy.close().catch(() => {
        cleanupFailed = true;
      });
      failoverProxy = null;
    }
    for (const containerName of cleanupTargets) {
      await removeContainer(dockerExecutable, containerName).catch(() => {
        cleanupFailed = true;
      });
    }
    for (const networkName of cleanupNetworks) {
      await removeDockerNetwork(dockerExecutable, networkName).catch(() => {
        cleanupFailed = true;
      });
    }
    for (const volumeName of cleanupVolumes) {
      await removeVolume(dockerExecutable, volumeName).catch(() => {
        cleanupFailed = true;
      });
    }
    await rm(temporaryRoot, { recursive: true, force: true }).catch(() => {
      cleanupFailed = true;
    });
    if (pendingFailure) pendingFailure.cleanupComplete = !cleanupFailed;
  }
}

async function seedApplicationState(connectionString, runId) {
  const fixture = createFixture(runId);
  const closed = [];
  let lifecyclePool;
  try {
    const idempotency = createDrillIdempotency(connectionString, fixture);
    closed.push(() => idempotency.close());
    const created = await idempotency.execute({
      request: fixture.idempotency.request,
      route: fixture.idempotency.route,
      payload: fixture.idempotency.payload,
      operation: async () => fixture.idempotency.result,
    });
    assertCondition(created.accepted && created.status === "created", "POSTGRES_RECOVERY_IDEMPOTENCY_SEED_FAILED");

    const providerGate = createDrillProviderGate(connectionString, fixture);
    closed.push(() => providerGate.close());
    const providerReservation = await providerGate.reserve(fixture.providerDispatch.input);
    assertCondition(providerReservation.reserved === true, "POSTGRES_RECOVERY_PROVIDER_SEED_FAILED");

    const effectGate = createDrillExternalEffectGate(connectionString, fixture);
    closed.push(() => effectGate.close());
    const effectReservation = await effectGate.reserve(fixture.externalEffect.input);
    await effectReservation.commit();

    const usageLedger = createDrillUsageLedger(connectionString, fixture);
    closed.push(() => usageLedger.close());
    await usageLedger.log(fixture.usage.started);
    await usageLedger.log(fixture.usage.completed);

    const auditStore = createDrillAuditStore(connectionString, fixture);
    closed.push(() => auditStore.close());
    await auditStore.append(fixture.audit.event);
    const auditSeedVerify = await auditStore.verify();
    assertCondition(auditSeedVerify.valid === true, "POSTGRES_RECOVERY_AUDIT_SEED_FAILED");

    const a2a = createDrillA2AStore(connectionString, fixture);
    closed.push(() => a2a.close());
    await a2a.store.save(fixture.a2a.task, fixture.a2a.context);

    const claims = createDrillClaimManager(connectionString, fixture);
    closed.push(() => claims.close());
    const claim = await claims.issue(fixture.workforceClaim.identity);
    assertCondition(claim.success === true && typeof claim.token === "string", "POSTGRES_RECOVERY_CLAIM_SEED_FAILED");
    fixture.workforceClaim.token = claim.token;
    fixture.workforceClaim.fencingToken = claim.fencingToken;

    lifecyclePool = new Pool({ connectionString, max: 2, allowExitOnIdle: true });
    const lifecycle = createDrillLifecycle(lifecyclePool, fixture);
    await lifecycle.initialize(fixture.lifecycle.executionId, fixture.lifecycle.metadata);
    await lifecycle.start(fixture.lifecycle.executionId);
    await lifecycle.onAgentCompleted(
      fixture.lifecycle.executionId,
      fixture.lifecycle.completedAgentId,
      { success: true, evidenceDigest: fixture.lifecycle.evidenceDigest },
    );
    const lifecycleState = await lifecycle.getStatus(fixture.lifecycle.executionId);
    assertCondition(lifecycleState.status === "running", "POSTGRES_RECOVERY_LIFECYCLE_SEED_FAILED");
    return fixture;
  } finally {
    await Promise.allSettled(closed.reverse().map((close) => Promise.resolve().then(close)));
    await lifecyclePool?.end().catch(() => undefined);
  }
}

function createApplicationStateVerifier(connectionString, fixture) {
  const idempotency = createDrillIdempotency(connectionString, fixture);
  const providerGate = createDrillProviderGate(connectionString, fixture);
  const effectGate = createDrillExternalEffectGate(connectionString, fixture);
  const usageLedger = createDrillUsageLedger(connectionString, fixture);
  const auditStore = createDrillAuditStore(connectionString, fixture);
  const a2a = createDrillA2AStore(connectionString, fixture);
  const claims = createDrillClaimManager(connectionString, fixture);
  const lifecyclePool = new Pool({ connectionString, max: 2, allowExitOnIdle: true });
  let lifecyclePoolErrorEvents = 0;
  lifecyclePool.on("error", () => {
    lifecyclePoolErrorEvents += 1;
  });
  const lifecycle = createDrillLifecycle(lifecyclePool, fixture);
  let closed = false;
  return {
    async verify() {
      if (closed) throw drillError("POSTGRES_RECOVERY_VERIFIER_CLOSED", "The application recovery verifier is closed.");
      const checks = {};
    let replayOperationCalls = 0;
    const replay = await idempotency.execute({
      request: fixture.idempotency.request,
      route: fixture.idempotency.route,
      payload: fixture.idempotency.payload,
      operation: async () => {
        replayOperationCalls += 1;
        return { unexpected: true };
      },
    });
    checks.idempotencyReplay = replay.accepted === true
      && replay.status === "replayed"
      && replay.replayed === true
      && replayOperationCalls === 0
      && replay.value?.statusCode === fixture.idempotency.result.statusCode
      && replay.value?.payload?.provider === fixture.idempotency.result.payload.provider
      && replay.value?.payload?.marker === fixture.idempotency.result.payload.marker;

    checks.providerDispatchTombstone = await rejectsWithCode(
      () => providerGate.reserve(fixture.providerDispatch.input),
      "PROVIDER_DISPATCH_ALREADY_RESERVED",
    );

    checks.externalEffectTombstone = await rejectsWithCode(
      () => effectGate.reserve(fixture.externalEffect.input),
      "EXTERNAL_EFFECT_ALREADY_RESERVED",
    );

    const usageStats = await usageLedger.getStats({ tenantId: fixture.usage.tenantId });
    checks.usageLedger = usageStats.totalRequests === 1
      && usageStats.totalTokens === 15
      && usageStats.totalCostUsd === 0.0015
      && usageStats.unresolvedBillableAttempts === 0;

    const [auditVerify, auditEntries] = await Promise.all([
      auditStore.verify(),
      auditStore.readEntries({ limit: 10, tenantId: fixture.audit.tenantId }),
    ]);
    checks.auditHashChain = auditVerify.valid === true
      && auditVerify.sequence === 1
      && auditEntries.some((entry) => entry.id === fixture.audit.event.id);

    const recoveredTask = await a2a.store.load(fixture.a2a.taskId, fixture.a2a.context);
    checks.a2aTask = recoveredTask?.id === fixture.a2a.taskId
      && Number(recoveredTask?.status?.state) === Number(TaskState.TASK_STATE_COMPLETED);

    const recoveredClaim = await claims.validate(
      fixture.workforceClaim.token,
      fixture.workforceClaim.identity,
    );
    checks.workforceClaim = recoveredClaim.success === true
      && recoveredClaim.valid === true
      && recoveredClaim.record?.fencingToken === fixture.workforceClaim.fencingToken;

    const recoveredLifecycle = await lifecycle.getStatus(fixture.lifecycle.executionId);
    checks.workforceLifecycle = recoveredLifecycle.status === "running"
      && recoveredLifecycle.completedAgents === 1;

    checks.all = Object.values(checks).every(Boolean);
    checks.diagnostics = {
      idempotency: {
        accepted: replay.accepted === true,
        status: replay.status ?? null,
        replayed: replay.replayed === true,
        operationCalls: replayOperationCalls,
        semanticFieldsMatch: replay.value?.statusCode === fixture.idempotency.result.statusCode
          && replay.value?.payload?.provider === fixture.idempotency.result.payload.provider
          && replay.value?.payload?.marker === fixture.idempotency.result.payload.marker,
      },
      workforceLifecycle: {
        status: recoveredLifecycle.status ?? null,
        completedAgentCount: recoveredLifecycle.completedAgents ?? null,
        poolErrorEvents: lifecyclePoolErrorEvents,
      },
    };
    return checks;
    },
    async close() {
      if (closed) return;
      closed = true;
      const results = await Promise.allSettled([
        idempotency.close(),
        providerGate.close(),
        effectGate.close(),
        usageLedger.close(),
        auditStore.close(),
        a2a.close(),
        claims.close(),
        lifecyclePool.end(),
      ]);
      if (results.some((result) => result.status === "rejected")) {
        throw drillError(
          "POSTGRES_RECOVERY_CLIENT_CLEANUP_FAILED",
          "One or more application recovery clients could not be closed cleanly.",
        );
      }
    },
  };
}

function createFixture(runId) {
  const namespace = `dr-${runId}`;
  const tenantId = `tenant-${runId}`;
  const ownerId = `owner-${runId}`;
  const idempotencyKey = `drill-${runId}`;
  const requestFingerprint = sha256(`request:${runId}`);
  const effectKeyHash = sha256(`effect-key:${runId}`);
  const payloadFingerprint = sha256(`effect-payload:${runId}`);
  const dispatchKeyHash = sha256(`dispatch-key:${runId}`);
  const auditKey = createHash("sha256").update(`audit-key:${runId}`).digest();
  const secret = createHash("sha256").update(`coordinator-key:${runId}`).digest("hex");
  const timestamp = new Date().toISOString();
  const taskId = `task-${runId}`;
  const a2aContext = createA2AContext(tenantId, ownerId);
  const a2aTask = Task.fromJSON({
    id: taskId,
    contextId: `context-${runId}`,
    status: { state: TaskState.TASK_STATE_COMPLETED, timestamp },
    artifacts: [],
    history: [],
    metadata: { drill: true, runId },
  });
  return {
    runId,
    namespace,
    secret,
    idempotency: {
      route: "/v1/chat/completions",
      request: {
        headers: { "idempotency-key": idempotencyKey, authorization: `Bearer ${tenantId}` },
        socket: { remoteAddress: "127.0.0.1" },
      },
      payload: { messages: [{ role: "user", content: `recovery-${runId}` }] },
      result: { statusCode: 200, payload: { provider: "fake", marker: runId } },
    },
    providerDispatch: {
      input: {
        dispatchKeyHash,
        route: "/v1/chat/completions",
        invocation: 1,
        attempt: 1,
        shadow: false,
        tenantId,
        providerId: "local-fake-provider",
        modelId: "fake-model",
        requestFingerprint,
      },
    },
    externalEffect: {
      input: {
        effectKeyHash,
        route: "/drill/external-effect",
        tenantId,
        effectType: "drill:fake-effect",
        payloadFingerprint,
      },
    },
    usage: {
      tenantId,
      started: {
        usageAttemptId: `attempt-${runId}`,
        usageEventType: "attempt-started",
        tenantId,
        method: "POST",
        path: "/v1/chat/completions",
        statusCode: 102,
        provider: "local-fake-provider",
        model: "fake-model",
        providerCallAttempted: false,
        billable: true,
        costEstimateAvailable: false,
      },
      completed: {
        usageAttemptId: `attempt-${runId}`,
        usageEventType: "attempt-completed",
        tenantId,
        method: "POST",
        path: "/v1/chat/completions",
        statusCode: 200,
        latencyMs: 12,
        provider: "local-fake-provider",
        model: "fake-model",
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        estimatedCostUsd: 0.0015,
        costSource: "drill-fixture",
        costEstimateAvailable: true,
        providerCallAttempted: false,
        billable: true,
      },
    },
    audit: {
      key: auditKey,
      tenantId,
      event: {
        id: `audit-${runId}`,
        timestamp,
        outcome: "allowed",
        method: "POST",
        path: "/drill/recovery",
        permission: "audit:drill",
        statusCode: 200,
        userId: ownerId,
        tenantId,
        role: "admin",
        details: {
          promptContentRecorded: false,
          credentialRecorded: false,
          realProviderCalled: false,
        },
      },
    },
    a2a: { taskId, task: a2aTask, context: a2aContext },
    workforceClaim: {
      identity: {
        planId: `plan-${runId}`,
        taskId: `workforce-task-${runId}`,
        agentId: `agent-${runId}`,
        ttlMs: FIXTURE_TTL_MS,
      },
      token: null,
      fencingToken: null,
    },
    lifecycle: {
      executionId: `execution-${runId}`,
      metadata: { publicPlanId: `public-${runId}`, tenantFingerprint: sha256(tenantId).slice(0, 21) },
      completedAgentId: `backend-${runId}`,
      evidenceDigest: sha256(`evidence:${runId}`),
    },
  };
}

function createDrillIdempotency(connectionString, fixture) {
  return createIdempotencyCoordinator({
    storeMode: "postgres",
    postgresConnectionString: connectionString,
    secret: fixture.secret,
    ttlMs: FIXTURE_TTL_MS,
    leaseMs: 60_000,
    inFlightWaitMs: 5_000,
    pollIntervalMs: 25,
    maxEntries: 1_000,
    postgresPoolMax: 2,
    postgresStatementTimeoutMs: 5_000,
    postgresStorageNamespace: "idempotency",
  });
}

function createDrillProviderGate(connectionString, fixture) {
  return createProviderDispatchGate({
    env: {
      AI_GATEWAY_MULTI_INSTANCE: "true",
      AI_GATEWAY_PROVIDER_DISPATCH_STORE_MODE: "postgres",
      AI_GATEWAY_PROVIDER_DISPATCH_POSTGRES_URL: connectionString,
      AI_GATEWAY_PROVIDER_DISPATCH_HMAC_SECRET: fixture.secret,
      AI_GATEWAY_PROVIDER_DISPATCH_TTL_MS: String(FIXTURE_TTL_MS),
    },
    realProviderEnabled: true,
  });
}

function createDrillExternalEffectGate(connectionString, fixture) {
  return createExternalEffectGate({
    env: {
      AI_GATEWAY_MULTI_INSTANCE: "true",
      AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "postgres",
      AI_GATEWAY_EXTERNAL_EFFECT_POSTGRES_URL: connectionString,
      AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL: connectionString,
      AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: fixture.secret,
      AI_GATEWAY_EXTERNAL_EFFECT_TTL_MS: String(FIXTURE_TTL_MS),
    },
    enabled: true,
  });
}

function createDrillUsageLedger(connectionString, fixture) {
  return createUsageLedger({
    env: {
      AI_GATEWAY_USAGE_LEDGER_STORE_MODE: "postgres",
      AI_GATEWAY_USAGE_LEDGER_POSTGRES_URL: connectionString,
      AI_GATEWAY_USAGE_LEDGER_NAMESPACE: `dr-usage-${fixture.runId}`,
      AI_GATEWAY_USAGE_LEDGER_POSTGRES_MAX_ROWS: "1000",
      AI_GATEWAY_USAGE_LEDGER_POSTGRES_RETENTION_DAYS: "1",
      AI_GATEWAY_USAGE_LEDGER_POSTGRES_POOL_MAX: "2",
      AI_GATEWAY_USAGE_LEDGER_POSTGRES_STATEMENT_TIMEOUT_MS: "5000",
    },
    realProviderEnabled: true,
  });
}

function createDrillAuditStore(connectionString, fixture) {
  return createPostgresAuditStore({
    connectionString,
    namespace: `dr-audit-${fixture.runId}`,
    hmacKey: fixture.audit.key,
    maxRows: 1000,
    poolMax: 2,
    statementTimeoutMs: 5_000,
  });
}

function createDrillA2AStore(connectionString, fixture) {
  return createA2ATaskStore({
    env: {
      AI_GATEWAY_A2A_TASK_STORE_MODE: "postgres",
      AI_GATEWAY_A2A_TASK_STORE_REQUIRED: "true",
      AI_GATEWAY_A2A_TASK_STORE_CENTRAL_REQUIRED: "true",
      AI_GATEWAY_A2A_TASK_STORE_POSTGRES_URL: connectionString,
      AI_GATEWAY_A2A_TASK_STORE_NAMESPACE: `dr-a2a-${fixture.runId}`,
      AI_GATEWAY_A2A_TASK_TTL_MS: String(FIXTURE_TTL_MS),
      AI_GATEWAY_A2A_TASK_MAX_ENTRIES: "100",
      AI_GATEWAY_A2A_TASK_MAX_ENTRIES_PER_OWNER: "100",
      AI_GATEWAY_A2A_TASK_MAX_BYTES: "65536",
      AI_GATEWAY_A2A_TASK_STORE_POSTGRES_POOL_MAX: "2",
      AI_GATEWAY_A2A_TASK_STORE_POSTGRES_STATEMENT_TIMEOUT_MS: "5000",
    },
  });
}

function createDrillClaimManager(connectionString, fixture) {
  return createPostgresTaskClaimLeaseManager({
    connectionString,
    namespace: `dr-claim-${fixture.runId}`,
    ttlMs: FIXTURE_TTL_MS,
    maxClaims: 100,
    poolMax: 2,
    statementTimeoutMs: 5_000,
  });
}

function createDrillLifecycle(pool, fixture) {
  return createPostgresExecutionLifecycle({
    pool,
    namespace: `dr-lifecycle-${fixture.runId}`,
    retentionMs: FIXTURE_TTL_MS,
    maxExecutions: 100,
    maxStateBytes: 64 * 1024,
    maxTransitions: 50,
    maxCompletedAgents: 20,
  });
}

function createA2AContext(tenant, owner) {
  return new ServerCallContext({
    requestedVersion: "1.0",
    tenant,
    user: {
      get isAuthenticated() { return true; },
      get userName() { return owner; },
    },
  });
}

async function readDatabaseInventory(connectionString) {
  const pool = new Pool({ connectionString, max: 1, allowExitOnIdle: true });
  try {
    const tableResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name LIKE 'ai_gateway_%'
      ORDER BY table_name
    `);
    const tables = [];
    for (const row of tableResult.rows) {
      const tableName = String(row.table_name);
      assertCondition(/^ai_gateway_[a-z0-9_]+$/.test(tableName), "POSTGRES_RECOVERY_TABLE_NAME_INVALID");
      const count = await pool.query(`SELECT COUNT(*)::bigint AS count FROM public.${tableName}`);
      tables.push({ name: tableName, rows: Number(count.rows[0]?.count ?? 0) });
    }
    const sequenceResult = await pool.query(`
      SELECT sequencename AS name, last_value::text AS last_value
      FROM pg_sequences
      WHERE schemaname = 'public' AND sequencename LIKE 'ai_gateway_%'
      ORDER BY sequencename
    `);
    const sequences = sequenceResult.rows.map((row) => ({
      name: String(row.name),
      lastValue: String(row.last_value),
    }));
    const canonical = JSON.stringify({ tables, sequences });
    return {
      tableCount: tables.length,
      sequenceCount: sequences.length,
      totalRows: tables.reduce((sum, table) => sum + table.rows, 0),
      digest: sha256(canonical),
    };
  } finally {
    await pool.end();
  }
}

async function readPostgresRole(connectionString) {
  const pool = new Pool({ connectionString, max: 1, allowExitOnIdle: true });
  try {
    const result = await pool.query(`
      SELECT
        pg_is_in_recovery() AS in_recovery,
        CASE WHEN pg_is_in_recovery() THEN NULL ELSE pg_current_wal_lsn()::text END AS current_wal_lsn,
        pg_last_wal_replay_lsn()::text AS replay_wal_lsn
    `);
    return {
      inRecovery: result.rows[0]?.in_recovery === true,
      currentWalLsn: result.rows[0]?.current_wal_lsn ?? null,
      replayWalLsn: result.rows[0]?.replay_wal_lsn ?? null,
    };
  } finally {
    await pool.end();
  }
}

async function writeAndWaitForReplication({
  primaryConnectionString,
  standbyConnectionString,
  runId,
}) {
  const primary = new Pool({ connectionString: primaryConnectionString, max: 1, allowExitOnIdle: true });
  const standby = new Pool({ connectionString: standbyConnectionString, max: 1, allowExitOnIdle: true });
  try {
    await primary.query(`
      CREATE TABLE IF NOT EXISTS public.gateway_drill_replication_evidence (
        run_id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      )
    `);
    await primary.query(`
      INSERT INTO public.gateway_drill_replication_evidence (run_id)
      VALUES ($1)
      ON CONFLICT (run_id) DO UPDATE SET created_at = clock_timestamp()
    `, [runId]);
    const primaryLsnResult = await primary.query(`SELECT pg_current_wal_lsn()::text AS lsn`);
    const primaryWalLsn = String(primaryLsnResult.rows[0]?.lsn ?? "");
    assertCondition(primaryWalLsn.length > 0, "POSTGRES_RECOVERY_PRIMARY_WAL_LSN_MISSING");

    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const role = await standby.query(`
        SELECT
          pg_is_in_recovery() AS in_recovery,
          pg_last_wal_replay_lsn()::text AS replay_lsn,
          to_regclass('public.gateway_drill_replication_evidence')::text AS evidence_table
      `);
      const row = role.rows[0] ?? {};
      if (row.in_recovery === true && row.evidence_table) {
        const marker = await standby.query(`
          SELECT EXISTS (
            SELECT 1 FROM public.gateway_drill_replication_evidence WHERE run_id = $1
          ) AS present
        `, [runId]);
        if (marker.rows[0]?.present === true && row.replay_lsn) {
          const standbyReplayLsn = String(row.replay_lsn);
          const replayLag = parsePgLsn(primaryWalLsn) - parsePgLsn(standbyReplayLsn);
          return {
            markerReplayed: true,
            primaryWalLsn,
            standbyReplayLsn,
            replayLagBytes: safeBigIntToNumber(replayLag > 0n ? replayLag : 0n),
          };
        }
      }
      await delay(250);
    }
    throw drillError(
      "POSTGRES_RECOVERY_STREAMING_REPLICATION_TIMEOUT",
      "The streaming standby did not replay the bounded WAL marker in time.",
    );
  } finally {
    await Promise.allSettled([primary.end(), standby.end()]);
  }
}

async function waitForWritablePrimary(connectionString) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const pool = new Pool({
      connectionString,
      max: 1,
      allowExitOnIdle: true,
      connectionTimeoutMillis: 1_000,
    });
    try {
      const result = await pool.query(`SELECT NOT pg_is_in_recovery() AS writable`);
      if (result.rows[0]?.writable === true) return;
    } catch {
      // Promotion may briefly close or reset connections.
    } finally {
      await pool.end().catch(() => undefined);
    }
    await delay(250);
  }
  throw drillError(
    "POSTGRES_RECOVERY_PROMOTION_TIMEOUT",
    "The promoted standby did not become writable in time.",
  );
}

function parsePgLsn(value) {
  const match = String(value ?? "").match(/^([0-9A-F]+)\/([0-9A-F]+)$/i);
  if (!match) throw drillError("POSTGRES_RECOVERY_WAL_LSN_INVALID", "PostgreSQL returned an invalid WAL LSN.");
  return (BigInt(`0x${match[1]}`) << 32n) + BigInt(`0x${match[2]}`);
}

function safeBigIntToNumber(value) {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw drillError("POSTGRES_RECOVERY_WAL_LAG_INVALID", "The measured WAL lag is outside the safe evidence range.");
  }
  return Number(value);
}

async function allocateLoopbackPort() {
  const server = createServer();
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? Number(address.port) : 0;
  await new Promise((resolvePromise, rejectPromise) => {
    server.close((error) => error ? rejectPromise(error) : resolvePromise());
  });
  assertCondition(Number.isSafeInteger(port) && port > 0 && port <= 65_535, "POSTGRES_RECOVERY_PORT_INVALID");
  return port;
}

async function createSwitchableTcpProxy({ listenPort, targetPort }) {
  const MAX_ACTIVE_CONNECTIONS = 64;
  const CONNECT_TIMEOUT_MS = 5_000;
  let currentTargetPort = targetPort;
  let closed = false;
  let switchCount = 0;
  let acceptedConnections = 0;
  let rejectedConnections = 0;
  let droppedConnections = 0;
  let serverFailure = null;
  const activePairs = new Set();

  const destroyPair = (pair) => {
    if (!pair || pair.closed) return;
    pair.closed = true;
    clearTimeout(pair.connectTimer);
    activePairs.delete(pair);
    pair.client.destroy();
    pair.upstream.destroy();
  };
  const server = createServer((client) => {
    if (closed || serverFailure || activePairs.size >= MAX_ACTIVE_CONNECTIONS) {
      rejectedConnections += 1;
      client.destroy();
      return;
    }
    acceptedConnections += 1;
    client.pause();
    client.setNoDelay(true);
    const upstream = createNetConnection({
      host: "127.0.0.1",
      port: currentTargetPort,
    });
    upstream.setNoDelay(true);
    const pair = {
      client,
      upstream,
      closed: false,
      connectTimer: setTimeout(() => destroyPair(pair), CONNECT_TIMEOUT_MS),
    };
    pair.connectTimer.unref?.();
    activePairs.add(pair);
    upstream.once("connect", () => {
      if (pair.closed) return;
      clearTimeout(pair.connectTimer);
      client.pipe(upstream);
      upstream.pipe(client);
      client.resume();
    });
    client.once("error", () => destroyPair(pair));
    upstream.once("error", () => destroyPair(pair));
    client.once("close", () => destroyPair(pair));
    upstream.once("close", () => destroyPair(pair));
  });
  server.maxConnections = MAX_ACTIVE_CONNECTIONS;
  await new Promise((resolvePromise, rejectPromise) => {
    const onError = (error) => rejectPromise(error);
    server.once("error", onError);
    server.listen(listenPort, "127.0.0.1", () => {
      server.off("error", onError);
      resolvePromise();
    });
  });
  server.on("error", (error) => {
    serverFailure = error;
    for (const pair of [...activePairs]) destroyPair(pair);
  });

  return {
    switchTarget(nextTargetPort) {
      assertCondition(
        Number.isSafeInteger(nextTargetPort) && nextTargetPort > 0 && nextTargetPort <= 65_535,
        "POSTGRES_RECOVERY_PROXY_TARGET_INVALID",
      );
      if (closed || serverFailure) {
        throw drillError("POSTGRES_RECOVERY_PROXY_UNAVAILABLE", "The stable database proxy is unavailable.");
      }
      currentTargetPort = nextTargetPort;
      switchCount += 1;
      const droppedNow = activePairs.size;
      droppedConnections += droppedNow;
      for (const pair of [...activePairs]) destroyPair(pair);
      return { droppedConnections: droppedNow, switchCount };
    },
    getStats() {
      return {
        activeConnections: activePairs.size,
        acceptedConnections,
        rejectedConnections,
        droppedConnections,
        switchCount,
        available: !closed && !serverFailure,
      };
    },
    async close() {
      if (closed) return;
      closed = true;
      for (const pair of [...activePairs]) destroyPair(pair);
      await new Promise((resolvePromise) => server.close(() => resolvePromise()));
    },
  };
}

async function startPostgresContainer({
  dockerExecutable,
  containerName,
  volumeName,
  postgresEnvPath,
  publishedPort,
  networkName,
  networkAlias,
  postgresArguments = [],
  runId,
}) {
  const args = [
    "run",
    "--detach",
    "--name", containerName,
    "--label", `ai.gateway.recovery-drill=${runId}`,
    "--publish", `127.0.0.1:${publishedPort}:5432`,
    "--env-file", postgresEnvPath,
    "--mount", `type=volume,source=${volumeName},target=/var/lib/postgresql/data`,
  ];
  if (networkName) args.push("--network", networkName);
  if (networkAlias) args.push("--network-alias", networkAlias);
  args.push(POSTGRES_IMAGE, ...postgresArguments);
  await runDocker(dockerExecutable, args, { stage: "postgres-container-start" });
}

async function waitForPostgres({ dockerExecutable, containerName }) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const probe = await runProcess(dockerExecutable, [
      "exec", containerName,
      "pg_isready", "--username", POSTGRES_USER, "--dbname", POSTGRES_DATABASE,
    ], { timeoutMs: 5_000 });
    if (probe.exitCode === 0) return;
    await delay(500);
  }
  throw drillError("POSTGRES_RECOVERY_STARTUP_TIMEOUT", "Disposable PostgreSQL did not become ready in time.");
}

async function waitForClientPostgres(connectionString) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const pool = new Pool({
      connectionString,
      max: 1,
      allowExitOnIdle: true,
      connectionTimeoutMillis: 1_000,
    });
    try {
      await pool.query("SELECT 1 AS ready");
      return;
    } catch {
      await delay(250);
    } finally {
      await pool.end().catch(() => undefined);
    }
  }
  throw drillError(
    "POSTGRES_RECOVERY_CLIENT_STARTUP_TIMEOUT",
    "PostgreSQL was not reachable through the loopback client path in time.",
  );
}

async function readPublishedPort(dockerExecutable, containerName) {
  const result = await runDocker(dockerExecutable, ["port", containerName, "5432/tcp"], {
    stage: "postgres-port-discovery",
  });
  const match = result.stdout.trim().match(/127\.0\.0\.1:(\d+)$/m);
  if (!match) throw drillError("POSTGRES_RECOVERY_PORT_INVALID", "Docker did not publish PostgreSQL on loopback.");
  const port = Number(match[1]);
  assertCondition(Number.isSafeInteger(port) && port > 0 && port <= 65_535, "POSTGRES_RECOVERY_PORT_INVALID");
  return port;
}

function createConnectionString(port, password) {
  return `postgresql://${POSTGRES_USER}:${encodeURIComponent(password)}@127.0.0.1:${port}/${POSTGRES_DATABASE}`;
}

async function createDockerNetwork(dockerExecutable, networkName, runId) {
  await runDocker(dockerExecutable, [
    "network", "create",
    "--driver", "bridge",
    "--label", `ai.gateway.recovery-drill=${runId}`,
    networkName,
  ], { stage: "postgres-replication-network-create" });
}

async function configureReplicationHba({
  dockerExecutable,
  primaryContainerName,
  networkName,
  temporaryRoot,
}) {
  const subnetResult = await runDocker(dockerExecutable, [
    "network", "inspect",
    "--format", "{{(index .IPAM.Config 0).Subnet}}",
    networkName,
  ], { stage: "postgres-replication-network-inspect" });
  const subnet = subnetResult.stdout.trim();
  assertIpv4Cidr(subnet);
  const hbaPath = resolve(temporaryRoot, "pg_hba.conf");
  await runDocker(dockerExecutable, [
    "cp",
    `${primaryContainerName}:/var/lib/postgresql/data/pg_hba.conf`,
    hbaPath,
  ], { stage: "postgres-replication-hba-read" });
  const current = await readFile(hbaPath, "utf8");
  if (Buffer.byteLength(current, "utf8") <= 0 || Buffer.byteLength(current, "utf8") > 64 * 1024) {
    throw drillError("POSTGRES_RECOVERY_HBA_INVALID", "The disposable PostgreSQL HBA file has an invalid size.");
  }
  const marker = "# ai-gateway-postgres-recovery-drill replication";
  assertCondition(!current.includes(marker), "POSTGRES_RECOVERY_HBA_DUPLICATE");
  const updated = `${current.trimEnd()}\n${marker}\nhost replication ${POSTGRES_USER} ${subnet} scram-sha-256\n`;
  await writeFile(hbaPath, updated, { encoding: "utf8", mode: 0o600 });
  await chmod(hbaPath, 0o600).catch(() => undefined);
  await runDocker(dockerExecutable, [
    "cp", hbaPath,
    `${primaryContainerName}:/var/lib/postgresql/data/pg_hba.conf`,
  ], { stage: "postgres-replication-hba-write" });
  await runDocker(dockerExecutable, [
    "exec", primaryContainerName,
    "chown", "70:70", "/var/lib/postgresql/data/pg_hba.conf",
  ], { stage: "postgres-replication-hba-permissions" });
  await runDocker(dockerExecutable, [
    "exec", primaryContainerName,
    "chmod", "600", "/var/lib/postgresql/data/pg_hba.conf",
  ], { stage: "postgres-replication-hba-permissions" });
  await runDocker(dockerExecutable, [
    "exec", "--user", "postgres", primaryContainerName,
    "pg_ctl", "reload", "--pgdata", "/var/lib/postgresql/data",
  ], { stage: "postgres-replication-hba-reload" });
  return subnet;
}

function assertIpv4Cidr(value) {
  const match = String(value ?? "").match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d|[12]\d|3[0-2])$/);
  if (!match || match.slice(1, 5).some((part) => Number(part) > 255)) {
    throw drillError("POSTGRES_RECOVERY_NETWORK_CIDR_INVALID", "Docker returned an invalid replication network CIDR.");
  }
}

async function removeContainer(dockerExecutable, containerName) {
  const result = await runProcess(dockerExecutable, ["rm", "--force", containerName], { timeoutMs: 30_000 });
  if (result.exitCode !== 0 && !/No such container/i.test(result.stderr)) {
    throw drillError("POSTGRES_RECOVERY_CLEANUP_FAILED", "A disposable PostgreSQL container could not be removed.");
  }
}

async function removeVolume(dockerExecutable, volumeName) {
  const result = await runProcess(dockerExecutable, ["volume", "rm", "--force", volumeName], { timeoutMs: 30_000 });
  if (result.exitCode !== 0 && !/No such volume/i.test(result.stderr)) {
    throw drillError("POSTGRES_RECOVERY_CLEANUP_FAILED", "A disposable PostgreSQL data volume could not be removed.");
  }
}

async function removeDockerNetwork(dockerExecutable, networkName) {
  const result = await runProcess(
    dockerExecutable,
    ["network", "rm", networkName],
    { timeoutMs: 30_000 },
  );
  if (result.exitCode !== 0 && !/No such network/i.test(result.stderr)) {
    throw drillError("POSTGRES_RECOVERY_CLEANUP_FAILED", "A disposable PostgreSQL network could not be removed.");
  }
}

async function runDocker(dockerExecutable, args, { stage }) {
  const result = await runProcess(dockerExecutable, args, { timeoutMs: PROCESS_TIMEOUT_MS });
  if (result.exitCode !== 0) {
    const error = drillError("POSTGRES_RECOVERY_DOCKER_COMMAND_FAILED", sanitizeFailureMessage(result.stderr));
    error.stage = stage;
    throw error;
  }
  return result;
}

function runProcess(executable, args, { timeoutMs }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      if (!settled) {
        settled = true;
        rejectPromise(drillError("POSTGRES_RECOVERY_PROCESS_TIMEOUT", "A bounded recovery subprocess exceeded its deadline."));
      }
    }, timeoutMs);
    timer.unref?.();
    child.stdout.on("data", (chunk) => {
      if (stdoutBytes >= MAX_PROCESS_OUTPUT_BYTES) return;
      const remaining = MAX_PROCESS_OUTPUT_BYTES - stdoutBytes;
      const bounded = chunk.subarray(0, remaining);
      stdout.push(bounded);
      stdoutBytes += bounded.length;
    });
    child.stderr.on("data", (chunk) => {
      if (stderrBytes >= MAX_PROCESS_OUTPUT_BYTES) return;
      const remaining = MAX_PROCESS_OUTPUT_BYTES - stderrBytes;
      const bounded = chunk.subarray(0, remaining);
      stderr.push(bounded);
      stderrBytes += bounded.length;
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      rejectPromise(drillError("POSTGRES_RECOVERY_PROCESS_START_FAILED", sanitizeFailureMessage(error.message)));
    });
    child.once("close", (exitCode) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      resolvePromise({
        exitCode: Number(exitCode ?? -1),
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

async function rejectsWithCode(operation, code) {
  try {
    await operation();
    return false;
  } catch (error) {
    return error?.code === code;
  }
}

function assertAllChecks(checks) {
  const failedChecks = Object.entries(checks ?? {})
    .filter(([name, passed]) => name !== "all" && name !== "diagnostics" && passed !== true)
    .map(([name]) => name);
  if (checks?.all !== true || failedChecks.length > 0) {
    const error = drillError(
      "POSTGRES_RECOVERY_APPLICATION_VERIFY_FAILED",
      `Recovered application checks failed: ${failedChecks.join(", ") || "unknown"}.`,
    );
    error.failedChecks = failedChecks;
    error.diagnostics = checks?.diagnostics ?? {};
    throw error;
  }
}

function publicApplicationChecks(checks) {
  return Object.fromEntries(
    Object.entries(checks ?? {}).filter(([name]) => name !== "diagnostics"),
  );
}

function assertCondition(value, code) {
  if (!value) throw drillError(code, "The PostgreSQL recovery drill invariant was not satisfied.");
}

function drillError(code, message) {
  return Object.assign(new Error(message || "The PostgreSQL recovery drill failed."), { code });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readArgumentValue(args, name) {
  const exactIndex = args.indexOf(name);
  if (exactIndex >= 0) return args[exactIndex + 1] ?? null;
  const prefix = `${name}=`;
  const inline = args.find((value) => value.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

function sanitizeFailureMessage(value) {
  const normalized = String(value ?? "PostgreSQL recovery drill failed.")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-postgres-url]")
    .replace(/POSTGRES_PASSWORD=[^\s]+/gi, "POSTGRES_PASSWORD=[redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
  return normalized.slice(0, 500) || "PostgreSQL recovery drill failed.";
}

function printHumanSummary(value) {
  if (value.status === "recovered") {
    process.stdout.write([
      "PostgreSQL recovery drill: recovered",
      `Controlled recovery time: ${value.controlledRecoveryTimeMs} ms`,
      `Application contracts: ${Object.entries(value.applicationChecks).filter(([key, passed]) => key !== "all" && passed).length}/8`,
      `Same application clients survived database restart: ${String(value.clientContinuity.sameApplicationClientsAcrossRestart)}`,
      `Same application clients survived endpoint failover: ${String(value.clientContinuity.sameApplicationClientsAcrossEndpointSwitch)}`,
      `Streaming WAL marker replayed before promotion: ${String(value.streamingReplication.markerReplayed)}`,
      `Database inventory: ${value.databaseInventory.tableCount} tables, ${value.databaseInventory.totalRows} rows`,
      `Cleanup complete: ${String(value.cleanup.complete)}`,
      "Boundary: controlled logical recovery only; no automatic failover, continuous WAL RPO, or production RTO claim.",
    ].join("\n") + "\n");
    return;
  }
  process.stdout.write(`${value.status}: ${value.message ?? "dry run"}\n`);
}
