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
        "create an independent physical base backup, continuously archive WAL, and recover to an LSN between an included and excluded marker",
        "arm a probe from an isolated Docker peer, disconnect primary from the replication bridge, prove primary remains writable while promotion is fenced, heal the bridge and replay a partition marker, then destroy primary, confirm fencing, promote standby, switch the stable endpoint, and verify through the same clients",
        "rewind the fenced old-primary volume against the promoted primary, start it only with recovery configuration, and prove it rejoins as a streaming standby",
        "restart standby and verify again through those same clients",
        "remove containers and the temporary backup artifact",
      ],
      boundaries: {
        credentialMode: "ephemeral-test-only",
        credentialTransport: "private-temporary-env-file",
        realProviderCallsMade: false,
        continuousWalRecoveryProved: false,
        singleStandbyFenceFailClosedProved: false,
        singleBridgePartitionFenceProved: false,
        safeOldPrimaryRejoinProved: false,
        boundedWalArchivePitrProved: false,
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
  const networkProbeName = `ai-gateway-pg-network-probe-${runId}`;
  const rewindName = `ai-gateway-pg-rewind-${runId}`;
  const rejoinedName = `ai-gateway-pg-rejoined-${runId}`;
  const archiveChownName = `ai-gateway-pg-archive-chown-${runId}`;
  const pitrChownName = `ai-gateway-pg-pitr-chown-${runId}`;
  const pitrBasebackupName = `ai-gateway-pg-pitr-basebackup-${runId}`;
  const pitrConfigName = `ai-gateway-pg-pitr-config-${runId}`;
  const pitrName = `ai-gateway-pg-pitr-${runId}`;
  const basebackupName = `ai-gateway-pg-basebackup-${runId}`;
  const standbyChownName = `ai-gateway-pg-standby-chown-${runId}`;
  const replicationNetworkName = `ai-gateway-pg-replication-${runId}`;
  const sourceVolume = `ai-gateway-pg-source-data-${runId}`;
  const recoveryVolume = `ai-gateway-pg-recovery-data-${runId}`;
  const standbyVolume = `ai-gateway-pg-standby-data-${runId}`;
  const archiveVolume = `ai-gateway-pg-wal-archive-${runId}`;
  const pitrVolume = `ai-gateway-pg-pitr-data-${runId}`;
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
    networkProbeName,
    rewindName,
    rejoinedName,
    archiveChownName,
    pitrChownName,
    pitrBasebackupName,
    pitrConfigName,
    pitrName,
    basebackupName,
    standbyChownName,
  ]);
  const cleanupVolumes = new Set([
    sourceVolume,
    recoveryVolume,
    standbyVolume,
    archiveVolume,
    pitrVolume,
  ]);
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
  let automaticFailoverController = null;
  let automaticFailoverAbortController = null;
  let automaticFailoverEvidence = null;
  let networkPartitionEvidence = null;
  let oldPrimaryRejoinEvidence = null;
  let rewindPrerequisites = null;
  let rejoinedUrl = null;
  let pointInTimeRecoveryEvidence = null;

  try {
    await runDocker(dockerExecutable, ["version", "--format", "{{.Server.Version}}"], { stage });
    await assertArchiveToolsAvailable(dockerExecutable);

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
    await preparePostgresOwnedVolume({
      dockerExecutable,
      containerName: archiveChownName,
      volumeName: archiveVolume,
      targetPath: "/var/lib/postgresql/wal-archive",
      stage: "postgres-wal-archive-volume-prepare",
    });
    cleanupTargets.delete(archiveChownName);
    const recoveryPublishedPort = await allocateLoopbackPort();
    await startPostgresContainer({
      dockerExecutable,
      containerName: recoveryName,
      volumeName: recoveryVolume,
      postgresEnvPath,
      publishedPort: recoveryPublishedPort,
      networkName: replicationNetworkName,
      networkAlias: "primary",
      additionalMounts: [
        `type=volume,source=${archiveVolume},target=/var/lib/postgresql/wal-archive`,
      ],
      postgresArguments: [
        "-c", "wal_level=replica",
        "-c", "max_wal_senders=5",
        "-c", "max_replication_slots=5",
        "-c", "wal_keep_size=128MB",
        "-c", "hot_standby=on",
        "-c", "wal_log_hints=on",
        "-c", "archive_mode=on",
        "-c", "archive_timeout=60s",
        "-c", "archive_command=if test -f /var/lib/postgresql/wal-archive/%f; then cmp -s %p /var/lib/postgresql/wal-archive/%f; else tmp=/var/lib/postgresql/wal-archive/.%f.$$; trap 'rm -f \"$tmp\"' EXIT; cp %p \"$tmp\" && mv \"$tmp\" /var/lib/postgresql/wal-archive/%f; fi",
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

    stage = "rewind-prerequisite";
    rewindPrerequisites = await configurePgRewindPrerequisites(recoveryUrl);

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
      postgresArguments: [
        "-c", "hot_standby=on",
        "-c", "wal_log_hints=on",
      ],
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

    stage = "point-in-time-recovery";
    pointInTimeRecoveryEvidence = await runPointInTimeRecoveryDrill({
      dockerExecutable,
      primaryContainerName: recoveryName,
      primaryConnectionString: recoveryUrl,
      networkName: replicationNetworkName,
      postgresEnvPath,
      archiveVolumeName: archiveVolume,
      pitrVolumeName: pitrVolume,
      pitrChownName,
      pitrBasebackupName,
      pitrConfigName,
      pitrContainerName: pitrName,
      password,
      runId,
      sourceInventory,
      fixtureState,
    });
    cleanupTargets.delete(pitrChownName);
    cleanupTargets.delete(pitrBasebackupName);
    cleanupTargets.delete(pitrConfigName);
    cleanupTargets.delete(pitrName);
    cleanupVolumes.delete(pitrVolume);

    stage = "network-probe-start";
    await startNetworkProbeContainer({
      dockerExecutable,
      containerName: networkProbeName,
      networkName: replicationNetworkName,
      postgresEnvPath,
      runId,
    });
    assertCondition(
      await probePostgresWritableFromContainer({
        dockerExecutable,
        probeContainerName: networkProbeName,
      }),
      "POSTGRES_RECOVERY_NETWORK_PROBE_NOT_READY",
    );

    stage = "endpoint-failover";
    automaticFailoverAbortController = new AbortController();
    automaticFailoverController = startAutomaticSingleStandbyFailover({
      signal: automaticFailoverAbortController.signal,
      probePrimary: () => probePostgresWritableFromContainer({
        dockerExecutable,
        probeContainerName: networkProbeName,
      }),
      inspectStandby: () => readPostgresRole(standbyUrl),
      promoteStandby: async () => {
        const promotionStartedAt = Date.now();
        await runDocker(dockerExecutable, [
          "exec", "--user", "postgres", standbyName,
          "pg_ctl", "promote",
          "--pgdata", "/var/lib/postgresql/data",
          "--wait",
          "--timeout", "15",
        ], { stage: "automatic-standby-promotion" });
        await waitForWritablePrimary(standbyUrl);
        const role = await readPostgresRole(standbyUrl);
        assertCondition(
          role.inRecovery === false,
          "POSTGRES_RECOVERY_STANDBY_PROMOTION_FAILED",
        );
        return {
          promotionTimeMs: Date.now() - promotionStartedAt,
          standbyInRecoveryAfterPromotion: role.inRecovery,
        };
      },
      verifyPrimaryFenced: () => inspectContainerFence(dockerExecutable, recoveryName),
      switchEndpoint: () => failoverProxy.switchTarget(standbyPort),
      pollIntervalMs: 150,
      confirmationDelayMs: 250,
      maxDurationMs: 60_000,
    });
    const armedEvidence = await automaticFailoverController.waitUntilArmed();
    assertCondition(
      armedEvidence.healthyProbes >= armedEvidence.requiredHealthyProbes,
      "POSTGRES_RECOVERY_FAILOVER_CONTROLLER_NOT_ARMED",
    );
    automaticFailoverController.injectSyntheticProbeFailures(1);
    const transientResetEvidence = await automaticFailoverController.waitForTransientFailureReset();
    assertCondition(
      transientResetEvidence.transientFailureResets >= 1,
      "POSTGRES_RECOVERY_FAILOVER_TRANSIENT_FAILURE_NOT_RESET",
    );
    stage = "replication-network-partition";
    const partitionStartedAt = Date.now();
    const partitionMarkerId = `${runId}-partition`;
    await disconnectDockerNetwork(
      dockerExecutable,
      replicationNetworkName,
      recoveryName,
    );
    const partitionWrite = await writeReplicationMarkerInsideContainer({
      dockerExecutable,
      containerName: recoveryName,
      markerId: partitionMarkerId,
    });
    await delay(500);
    const partitionedStandby = await readStandbyReplicationMarker({
      standbyConnectionString: standbyUrl,
      markerId: partitionMarkerId,
    });
    assertCondition(
      partitionWrite.primaryWritable === true
        && partitionedStandby.inRecovery === true
        && partitionedStandby.markerPresent === false,
      "POSTGRES_RECOVERY_NETWORK_PARTITION_NOT_PROVED",
    );
    const fencingRejectionEvidence = await automaticFailoverController.waitForFencingRejection();
    assertCondition(
      fencingRejectionEvidence.fencingRejections >= 1
        && fencingRejectionEvidence.primaryStillRunning === true,
      "POSTGRES_RECOVERY_FAILOVER_FENCING_NOT_ENFORCED",
    );
    stage = "replication-network-heal";
    await connectDockerNetwork(
      dockerExecutable,
      replicationNetworkName,
      recoveryName,
      "primary",
    );
    const fencingResetEvidence = await automaticFailoverController.waitForPostFencingHealthyReset();
    assertCondition(
      fencingResetEvidence.healthyAfterRejection === true,
      "POSTGRES_RECOVERY_FAILOVER_FENCING_RESET_FAILED",
    );
    await waitForClientPostgres(recoveryUrl);
    const healedPrimaryWritable = await probePostgresWritable(recoveryUrl, 1_000);
    const partitionConvergence = await waitForStandbyReplicationMarker({
      standbyConnectionString: standbyUrl,
      markerId: partitionMarkerId,
      primaryWalLsn: partitionWrite.primaryWalLsn,
    });
    assertCondition(
      healedPrimaryWritable
        && partitionConvergence.markerReplayed === true,
      "POSTGRES_RECOVERY_NETWORK_PARTITION_HEAL_FAILED",
    );
    networkPartitionEvidence = {
      mode: "docker-bridge-disconnect",
      primaryDisconnectedFromReplicationBridge: true,
      primaryContainerStillRunning: fencingRejectionEvidence.primaryStillRunning,
      primaryWritableWhilePartitioned: partitionWrite.primaryWritable,
      standbyStayedInRecovery: partitionedStandby.inRecovery,
      markerAbsentWhilePartitioned: partitionedStandby.markerPresent === false,
      promotionBlockedWhilePrimaryRunning: true,
      fencingRejections: fencingRejectionEvidence.fencingRejections,
      networkHealed: true,
      healthProbeRecovered: fencingResetEvidence.healthyAfterRejection,
      primaryWritableAfterHeal: healedPrimaryWritable,
      markerReplayedAfterHeal: partitionConvergence.markerReplayed,
      primaryWalLsn: partitionWrite.primaryWalLsn,
      standbyReplayLsn: partitionConvergence.standbyReplayLsn,
      replayLagBytes: partitionConvergence.replayLagBytes,
      partitionAndHealTimeMs: Date.now() - partitionStartedAt,
      singleBridgePartitionFenceProved: true,
    };
    stage = "endpoint-failover";
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
    failoverStartedAt = Date.now();
    await removeContainer(dockerExecutable, recoveryName);
    cleanupTargets.delete(recoveryName);
    activeQueryInterrupted = await Promise.race([
      interruptedQuery,
      delay(5_000).then(() => false),
    ]);
    failoverSentinelClient.release(true);
    failoverSentinelClient = null;
    assertCondition(activeQueryInterrupted, "POSTGRES_RECOVERY_ACTIVE_QUERY_NOT_INTERRUPTED");
    const automaticResult = await automaticFailoverController.completion;
    const { switchResult, promotion, ...automaticEvidence } = automaticResult;
    automaticFailoverEvidence = {
      ...automaticEvidence,
      promotionTimeMs: promotion.promotionTimeMs,
    };
    failoverSwitch = switchResult;
    automaticFailoverController = null;
    automaticFailoverAbortController = null;
    streamingReplication.controlledPromotionProved = true;
    streamingReplication.automaticSingleStandbyPromotionProved = true;
    streamingReplication.promotionTimeMs = promotion.promotionTimeMs;
    streamingReplication.standbyInRecoveryAfterPromotion = promotion.standbyInRecoveryAfterPromotion;
    await waitForClientPostgres(proxyUrl);
    await failoverSentinelPool.query("SELECT 1 AS recovered");
    sentinelPoolRecovered = true;
    const failoverVerificationWithDiagnostics = await applicationVerifier.verify();
    assertAllChecks(failoverVerificationWithDiagnostics);
    failoverVerification = publicApplicationChecks(failoverVerificationWithDiagnostics);
    failoverVerifiedAt = Date.now();

    stage = "old-primary-rewind";
    const promotedRoleBeforeRewind = await readPostgresRole(standbyUrl);
    assertCondition(
      promotedRoleBeforeRewind.inRecovery === false,
      "POSTGRES_RECOVERY_REWIND_SOURCE_NOT_PRIMARY",
    );
    const postPromotionMarkerId = `${runId}-post-promotion`;
    const postPromotionMarker = await writeReplicationMarkerInsideContainer({
      dockerExecutable,
      containerName: standbyName,
      markerId: postPromotionMarkerId,
    });
    const rewindStartedAt = Date.now();
    await runPgRewind({
      dockerExecutable,
      containerName: rewindName,
      targetVolumeName: recoveryVolume,
      sourceHost: "standby",
      postgresEnvPath,
      networkName: replicationNetworkName,
    });
    cleanupTargets.delete(rewindName);
    const rewindTimeMs = Date.now() - rewindStartedAt;

    stage = "old-primary-rejoin";
    const rejoinedPublishedPort = await allocateLoopbackPort();
    await startPostgresContainer({
      dockerExecutable,
      containerName: rejoinedName,
      volumeName: recoveryVolume,
      postgresEnvPath,
      publishedPort: rejoinedPublishedPort,
      networkName: replicationNetworkName,
      networkAlias: "rejoined",
      postgresArguments: [
        "-c", "hot_standby=on",
        "-c", "wal_log_hints=on",
      ],
      runId,
    });
    await waitForPostgres({ dockerExecutable, containerName: rejoinedName });
    const rejoinedPort = await readPublishedPort(dockerExecutable, rejoinedName);
    assertCondition(
      rejoinedPort === rejoinedPublishedPort,
      "POSTGRES_RECOVERY_REJOINED_ENDPOINT_CHANGED",
    );
    rejoinedUrl = createConnectionString(rejoinedPort, password);
    await waitForClientPostgres(rejoinedUrl);
    const rejoinedRole = await readPostgresRole(rejoinedUrl);
    assertCondition(
      rejoinedRole.inRecovery === true,
      "POSTGRES_RECOVERY_OLD_PRIMARY_REJOINED_WRITABLE",
    );
    const rewindCatchup = await waitForStandbyReplicationMarker({
      standbyConnectionString: rejoinedUrl,
      markerId: postPromotionMarkerId,
      primaryWalLsn: postPromotionMarker.primaryWalLsn,
    });
    const rejoinedInventory = await readDatabaseInventory(rejoinedUrl);
    assertCondition(
      sourceInventory.digest === rejoinedInventory.digest,
      "POSTGRES_RECOVERY_REJOINED_INVENTORY_MISMATCH",
    );
    const rejoinVerificationWithDiagnostics = await applicationVerifier.verify();
    assertAllChecks(rejoinVerificationWithDiagnostics);
    oldPrimaryRejoinEvidence = {
      mode: "pg_rewind-write-recovery-conf",
      oldPrimaryContainerDestroyedBeforePromotion: true,
      oldPrimaryVolumeRetainedForRewind: true,
      walLogHintsEnabledBeforeDivergence: rewindPrerequisites.walLogHintsEnabled,
      walLogHintsPersistedWithAlterSystem:
        rewindPrerequisites.walLogHintsPersistedWithAlterSystem,
      fullPageWritesEnabled: rewindPrerequisites.fullPageWritesEnabled,
      walKeepSizeBytes: rewindPrerequisites.walKeepSizeBytes,
      walKeepSizePersistedWithAlterSystem:
        rewindPrerequisites.walKeepSizePersistedWithAlterSystem,
      rewindSourceWasPromotedPrimary: true,
      rewindCompleted: true,
      rewindTimeMs,
      writeRecoveryConfUsed: true,
      oldPrimaryTargetWasForceRemoved: true,
      oldPrimaryRestartedBeforeRewind: false,
      rejoinedInRecovery: rejoinedRole.inRecovery,
      postPromotionMarkerReplayed: rewindCatchup.markerReplayed,
      primaryWalLsn: postPromotionMarker.primaryWalLsn,
      rejoinedReplayLsn: rewindCatchup.standbyReplayLsn,
      replayLagBytes: rewindCatchup.replayLagBytes,
      inventoryExactMatch: sourceInventory.digest === rejoinedInventory.digest,
      sameApplicationClientsHealthyAfterRejoin:
        publicApplicationChecks(rejoinVerificationWithDiagnostics).all,
      markerReplayedAfterPromotedPrimaryRestart: false,
      safeOldPrimaryRejoinProved: true,
    };
    streamingReplication.oldPrimaryRejoinedAsStandbyProved = true;

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
    const rejoinAfterSourceRestart = await writeAndWaitForReplication({
      primaryConnectionString: standbyUrl,
      standbyConnectionString: rejoinedUrl,
      runId: `${runId}-source-restart`,
    });
    const rejoinedRoleAfterSourceRestart = await readPostgresRole(rejoinedUrl);
    assertCondition(
      rejoinedRoleAfterSourceRestart.inRecovery === true
        && rejoinAfterSourceRestart.markerReplayed === true,
      "POSTGRES_RECOVERY_REJOINED_STANDBY_DID_NOT_RECOVER",
    );
    oldPrimaryRejoinEvidence.markerReplayedAfterPromotedPrimaryRestart = true;
    oldPrimaryRejoinEvidence.postRestartPrimaryWalLsn = rejoinAfterSourceRestart.primaryWalLsn;
    oldPrimaryRejoinEvidence.postRestartRejoinedReplayLsn = rejoinAfterSourceRestart.standbyReplayLsn;
    oldPrimaryRejoinEvidence.postRestartReplayLagBytes = rejoinAfterSourceRestart.replayLagBytes;

    stage = "cleanup";
    await applicationVerifier.close();
    applicationVerifier = null;
    await failoverSentinelPool.end();
    failoverSentinelPool = null;
    proxyStats = failoverProxy.getStats();
    await failoverProxy.close();
    failoverProxy = null;
    await removeContainer(dockerExecutable, networkProbeName);
    cleanupTargets.delete(networkProbeName);
    await removeContainer(dockerExecutable, rejoinedName);
    cleanupTargets.delete(rejoinedName);
    await removeContainer(dockerExecutable, standbyName);
    cleanupTargets.delete(standbyName);
    await removeDockerNetwork(dockerExecutable, replicationNetworkName);
    cleanupNetworks.delete(replicationNetworkName);
    await removeVolume(dockerExecutable, standbyVolume);
    cleanupVolumes.delete(standbyVolume);
    await removeVolume(dockerExecutable, recoveryVolume);
    cleanupVolumes.delete(recoveryVolume);
    await removeVolume(dockerExecutable, archiveVolume);
    cleanupVolumes.delete(archiveVolume);
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
        mode: "automatic-single-standby-controller",
        oldPrimaryContainerDestroyedBeforeSwitch: true,
        oldPrimaryVolumeRetainedForRewind: true,
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
        automaticDetectionProved: true,
        automaticPromotionProved: true,
        automaticEndpointSwitchProved: true,
        independentPrimaryFenceChecked: automaticFailoverEvidence.primaryFenceConfirmed,
        promotionBlockedWhilePrimaryRunning:
          automaticFailoverEvidence.promotionBlockedWhilePrimaryRunning,
        singleBridgePartitionFenceProved:
          networkPartitionEvidence.singleBridgePartitionFenceProved,
        oldPrimaryRejoinedAsStandbyProved:
          oldPrimaryRejoinEvidence.safeOldPrimaryRejoinProved,
        automaticElectionProved: false,
        streamingReplicationProved: true,
      },
      automaticFailover: automaticFailoverEvidence,
      networkPartition: networkPartitionEvidence,
      oldPrimaryRejoin: oldPrimaryRejoinEvidence,
      pointInTimeRecovery: pointInTimeRecoveryEvidence,
      streamingReplication,
      recoveryPoint: {
        mode: "controlled-logical-snapshot-plus-bounded-lsn-pitr",
        fixtureRowsLost: 0,
        boundedContinuousWalArchiveProved:
          pointInTimeRecoveryEvidence.boundedContinuousWalArchiveProved,
        pointInTimeRecoveryProved:
          pointInTimeRecoveryEvidence.pointInTimeRecoveryProved,
        continuousWalRecoveryProved: false,
      },
      boundaries: {
        credentialMode: "ephemeral-test-only",
        credentialTransport: "private-temporary-env-file",
        loopbackOnly: true,
        realProviderCallsMade: false,
        streamingReplicationProved: true,
        controlledStandbyPromotionProved: true,
        automaticSingleStandbyFailoverProved: true,
        singleStandbyFenceFailClosedProved:
          automaticFailoverEvidence.promotionBlockedWhilePrimaryRunning
          && automaticFailoverEvidence.primaryFenceConfirmed,
        singleBridgePartitionFenceProved:
          networkPartitionEvidence.singleBridgePartitionFenceProved,
        safeOldPrimaryRejoinProved:
          oldPrimaryRejoinEvidence.safeOldPrimaryRejoinProved,
        boundedWalArchivePitrProved:
          pointInTimeRecoveryEvidence.pointInTimeRecoveryProved,
        operatorControlledEndpointSwitchProved: false,
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
        walArchiveRetained: false,
      },
    };
  } catch (error) {
    error.stage = error.stage ?? stage;
    pendingFailure = error;
    throw error;
  } finally {
    let cleanupFailed = false;
    if (automaticFailoverAbortController) {
      automaticFailoverAbortController.abort();
      automaticFailoverAbortController = null;
    }
    if (automaticFailoverController) {
      await automaticFailoverController.completion.catch(() => undefined);
      automaticFailoverController = null;
    }
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

async function configurePgRewindPrerequisites(connectionString) {
  const pool = new Pool({ connectionString, max: 1, allowExitOnIdle: true });
  try {
    await pool.query(`ALTER SYSTEM SET wal_log_hints = 'on'`);
    await pool.query(`ALTER SYSTEM SET wal_keep_size = '128MB'`);
    const result = await pool.query(`
      SELECT
        current_setting('wal_log_hints') AS wal_log_hints,
        current_setting('full_page_writes') AS full_page_writes,
        pg_size_bytes(current_setting('wal_keep_size'))::bigint AS wal_keep_size_bytes
    `);
    const walLogHintsEnabled = result.rows[0]?.wal_log_hints === "on";
    const fullPageWritesEnabled = result.rows[0]?.full_page_writes === "on";
    const walKeepSizeBytes = Number(result.rows[0]?.wal_keep_size_bytes ?? 0);
    assertCondition(
      walLogHintsEnabled
        && fullPageWritesEnabled
        && Number.isSafeInteger(walKeepSizeBytes)
        && walKeepSizeBytes >= 128 * 1024 * 1024,
      "POSTGRES_RECOVERY_REWIND_PREREQUISITE_MISSING",
    );
    return {
      walLogHintsEnabled,
      walLogHintsPersistedWithAlterSystem: true,
      fullPageWritesEnabled,
      walKeepSizeBytes,
      walKeepSizePersistedWithAlterSystem: true,
    };
  } finally {
    await pool.end();
  }
}

async function runPgRewind({
  dockerExecutable,
  containerName,
  targetVolumeName,
  sourceHost,
  postgresEnvPath,
  networkName,
}) {
  assertCondition(
    /^[a-z0-9-]{1,63}$/.test(sourceHost),
    "POSTGRES_RECOVERY_REWIND_SOURCE_HOST_INVALID",
  );
  const result = await runProcess(dockerExecutable, [
    "run", "--rm",
    "--name", containerName,
    "--user", "postgres",
    "--network", networkName,
    "--env-file", postgresEnvPath,
    "--read-only",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--pids-limit", "64",
    "--memory", "256m",
    "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m",
    "--mount", `type=volume,source=${targetVolumeName},target=/var/lib/postgresql/data`,
    "--entrypoint", "pg_rewind",
    POSTGRES_IMAGE,
    "--target-pgdata=/var/lib/postgresql/data",
    "--source-server", `postgresql://${POSTGRES_USER}@${sourceHost}:5432/${POSTGRES_DATABASE}`,
    "--write-recovery-conf",
    "--progress",
  ], { timeoutMs: PROCESS_TIMEOUT_MS });
  if (result.exitCode !== 0) {
    const error = drillError(
      "POSTGRES_RECOVERY_PG_REWIND_FAILED",
      "The fenced old primary could not be rewound safely.",
    );
    error.stage = "postgres-old-primary-rewind";
    error.diagnostics = {
      pgRewindStderrTail: sanitizeFailureMessage(result.stderr.slice(-4_000), 2_000),
    };
    throw error;
  }
}

async function runPointInTimeRecoveryDrill({
  dockerExecutable,
  primaryContainerName,
  primaryConnectionString,
  networkName,
  postgresEnvPath,
  archiveVolumeName,
  pitrVolumeName,
  pitrChownName,
  pitrBasebackupName,
  pitrConfigName,
  pitrContainerName,
  password,
  runId,
  sourceInventory,
  fixtureState,
}) {
  const startedAt = Date.now();
  let verifier = null;
  try {
  await preparePostgresOwnedVolume({
    dockerExecutable,
    containerName: pitrChownName,
    volumeName: pitrVolumeName,
    targetPath: "/var/lib/postgresql/data",
    stage: "postgres-pitr-volume-prepare",
  });
  await runDocker(dockerExecutable, [
    "run", "--rm",
    "--name", pitrBasebackupName,
    "--user", "postgres",
    "--network", networkName,
    "--env-file", postgresEnvPath,
    "--mount", `type=volume,source=${pitrVolumeName},target=/var/lib/postgresql/data`,
    "--entrypoint", "pg_basebackup",
    POSTGRES_IMAGE,
    "--dbname", `postgresql://${POSTGRES_USER}@primary:5432/postgres`,
    "--pgdata", "/var/lib/postgresql/data",
    "--format", "plain",
    "--wal-method", "stream",
    "--manifest-checksums", "SHA256",
    "--checkpoint", "fast",
    "--progress",
  ], { stage: "postgres-pitr-basebackup" });

  const includedMarkerId = `${runId}-pitr-included`;
  const excludedMarkerId = `${runId}-pitr-excluded`;
  const restorePointName = `${runId}-pitr-target`;
  const includedMarker = await writeReplicationMarkerInsideContainer({
    dockerExecutable,
    containerName: primaryContainerName,
    markerId: includedMarkerId,
  });
  const restorePoint = await createPitrRestorePointInsideContainer({
    dockerExecutable,
    containerName: primaryContainerName,
    restorePointName,
  });
  const excludedMarker = await writeReplicationMarkerInsideContainer({
    dockerExecutable,
    containerName: primaryContainerName,
    markerId: excludedMarkerId,
  });
  assertCondition(
    parsePgLsn(includedMarker.primaryWalLsn) <= parsePgLsn(restorePoint.lsn)
      && parsePgLsn(restorePoint.lsn) < parsePgLsn(excludedMarker.primaryWalLsn),
    "POSTGRES_RECOVERY_PITR_TARGET_ORDER_INVALID",
  );

  const archiveEvidence = await forceWalArchiveAndWait({
    dockerExecutable,
    primaryConnectionString,
    archiveVolumeName,
  });
  await verifyPitrBaseBackup({
    dockerExecutable,
    pitrVolumeName,
    archiveVolumeName,
  });
  await preparePitrRecoveryTarget({
    dockerExecutable,
    containerName: pitrConfigName,
    pitrVolumeName,
  });

  const publishedPort = await allocateLoopbackPort();
  await startPostgresContainer({
    dockerExecutable,
    containerName: pitrContainerName,
    volumeName: pitrVolumeName,
    postgresEnvPath,
    publishedPort,
    additionalMounts: [
      `type=volume,source=${archiveVolumeName},target=/var/lib/postgresql/wal-archive,readonly`,
    ],
    postgresArguments: [
      "-c", "hot_standby=on",
      "-c", "restore_command=cp /var/lib/postgresql/wal-archive/%f %p",
      "-c", `recovery_target_lsn=${restorePoint.lsn}`,
      "-c", "recovery_target_inclusive=on",
      "-c", "recovery_target_timeline=current",
      "-c", "recovery_target_action=promote",
    ],
    runId,
  });
  await waitForPostgres({ dockerExecutable, containerName: pitrContainerName });
  const discoveredPort = await readPublishedPort(dockerExecutable, pitrContainerName);
  assertCondition(discoveredPort === publishedPort, "POSTGRES_RECOVERY_PITR_ENDPOINT_CHANGED");
  const pitrUrl = createConnectionString(discoveredPort, password);
  await waitForWritablePrimary(pitrUrl);
  const role = await readPostgresRole(pitrUrl);
  const markerState = await readPitrMarkerState({
    connectionString: pitrUrl,
    includedMarkerId,
    excludedMarkerId,
  });
  const replayLsn = String(role.replayWalLsn ?? "");
  assertCondition(
    role.inRecovery === false
      && markerState.includedPresent === true
      && markerState.excludedPresent === false
      && markerState.primaryConninfoConfigured === false
      && replayLsn.length > 0
      && parsePgLsn(replayLsn) >= parsePgLsn(restorePoint.lsn)
      && parsePgLsn(replayLsn) < parsePgLsn(excludedMarker.primaryWalLsn),
    "POSTGRES_RECOVERY_PITR_TARGET_MISMATCH",
  );
  const inventory = await readDatabaseInventory(pitrUrl);
  assertCondition(
    inventory.digest === sourceInventory.digest,
    "POSTGRES_RECOVERY_PITR_INVENTORY_MISMATCH",
  );
  verifier = createApplicationStateVerifier(pitrUrl, fixtureState);
  const checksWithDiagnostics = await verifier.verify();
  assertAllChecks(checksWithDiagnostics);
  const applicationChecks = publicApplicationChecks(checksWithDiagnostics);
  await verifier.close();
  verifier = null;
  await removeContainer(dockerExecutable, pitrContainerName);
  await removeVolume(dockerExecutable, pitrVolumeName);

    return {
      mode: "physical-basebackup-continuous-archive-lsn-target",
      baseBackupWalMethod: "stream",
      backupManifestVerified: true,
      baseBackupWalRemovedBeforeRecovery: true,
      recoverySignalUsed: true,
      restoreCommandArchiveOnly: true,
      streamingRecoveryConfigured: false,
      recoveryTargetType: "lsn",
      recoveryTargetInclusive: true,
      recoveryTargetTimeline: "current",
      recoveryTargetAction: "promote",
      restorePointFingerprint: sha256(restorePointName).slice(0, 16),
      restorePointLsn: restorePoint.lsn,
      replayLsn,
      includedMarkerPresent: markerState.includedPresent,
      excludedMarkerPresent: markerState.excludedPresent,
      includedMarkerWalLsn: includedMarker.primaryWalLsn,
      excludedMarkerWalLsn: excludedMarker.primaryWalLsn,
      inventoryExactMatch: inventory.digest === sourceInventory.digest,
      applicationChecks,
      archiveWalFile: archiveEvidence.requiredWalFile,
      archiveFailuresObserved: archiveEvidence.failedCountDelta,
      archiveFileNonEmpty: archiveEvidence.archiveFileNonEmpty,
      boundedContinuousWalArchiveProved: true,
      pointInTimeRecoveryProved: true,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    if (verifier) await verifier.close().catch(() => undefined);
  }
}

async function createPitrRestorePointInsideContainer({
  dockerExecutable,
  containerName,
  restorePointName,
}) {
  assertCondition(
    /^[a-z0-9-]{1,63}$/.test(restorePointName),
    "POSTGRES_RECOVERY_PITR_RESTORE_POINT_INVALID",
  );
  const result = await runDocker(dockerExecutable, [
    "exec", containerName,
    "psql",
    "--username", POSTGRES_USER,
    "--dbname", POSTGRES_DATABASE,
    "--set", "ON_ERROR_STOP=1",
    "--tuples-only",
    "--no-align",
    "--command", `SELECT pg_create_restore_point('${restorePointName}')::text;`,
  ], { stage: "postgres-pitr-restore-point" });
  const lsn = result.stdout.split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /^[0-9A-F]+\/[0-9A-F]+$/i.test(line)) ?? "";
  parsePgLsn(lsn);
  return { lsn };
}

async function forceWalArchiveAndWait({
  dockerExecutable,
  primaryConnectionString,
  archiveVolumeName,
}) {
  const pool = new Pool({ connectionString: primaryConnectionString, max: 1, allowExitOnIdle: true });
  try {
    const before = await pool.query(`
      SELECT archived_count::bigint, failed_count::bigint FROM pg_stat_archiver
    `);
    const failedCountBefore = Number(before.rows[0]?.failed_count ?? 0);
    const archivedCountBefore = Number(before.rows[0]?.archived_count ?? 0);
    const target = await pool.query(`
      SELECT pg_walfile_name(pg_current_wal_insert_lsn()) AS wal_file
    `);
    const requiredWalFile = String(target.rows[0]?.wal_file ?? "");
    assertWalFileName(requiredWalFile);
    await pool.query(`SELECT pg_switch_wal()`);
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const state = await pool.query(`
        SELECT archived_count::bigint, failed_count::bigint, last_archived_wal
        FROM pg_stat_archiver
      `);
      const failedCount = Number(state.rows[0]?.failed_count ?? 0);
      const archivedCount = Number(state.rows[0]?.archived_count ?? 0);
      const lastArchivedWal = String(state.rows[0]?.last_archived_wal ?? "");
      if (failedCount > failedCountBefore) {
        throw drillError(
          "POSTGRES_RECOVERY_PITR_ARCHIVE_FAILED",
          "The PostgreSQL archiver reported a failure while preparing PITR evidence.",
        );
      }
      if (lastArchivedWal === requiredWalFile) {
        await assertArchiveWalFileNonEmpty({
          dockerExecutable,
          archiveVolumeName,
          walFileName: requiredWalFile,
        });
        return {
          requiredWalFile,
          archivedCountDelta: archivedCount - archivedCountBefore,
          failedCountDelta: failedCount - failedCountBefore,
          archiveFileNonEmpty: true,
        };
      }
      await delay(250);
    }
    throw drillError(
      "POSTGRES_RECOVERY_PITR_ARCHIVE_TIMEOUT",
      "The WAL segment containing the excluded PITR marker was not archived in time.",
    );
  } finally {
    await pool.end();
  }
}

async function assertArchiveWalFileNonEmpty({
  dockerExecutable,
  archiveVolumeName,
  walFileName,
}) {
  assertWalFileName(walFileName);
  await runDocker(dockerExecutable, [
    "run", "--rm",
    "--user", "postgres",
    "--network", "none",
    "--read-only",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--mount", `type=volume,source=${archiveVolumeName},target=/archive,readonly`,
    "--entrypoint", "test",
    POSTGRES_IMAGE,
    "-s", `/archive/${walFileName}`,
  ], { stage: "postgres-pitr-archive-file-verify" });
}

async function verifyPitrBaseBackup({
  dockerExecutable,
  pitrVolumeName,
  archiveVolumeName,
}) {
  await runDocker(dockerExecutable, [
    "run", "--rm",
    "--user", "postgres",
    "--network", "none",
    "--read-only",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--mount", `type=volume,source=${pitrVolumeName},target=/base,readonly`,
    "--mount", `type=volume,source=${archiveVolumeName},target=/archive,readonly`,
    "--entrypoint", "pg_verifybackup",
    POSTGRES_IMAGE,
    "--exit-on-error",
    "--wal-directory=/archive",
    "/base",
  ], { stage: "postgres-pitr-basebackup-verify" });
}

async function preparePitrRecoveryTarget({
  dockerExecutable,
  containerName,
  pitrVolumeName,
}) {
  await runDocker(dockerExecutable, [
    "run", "--rm",
    "--name", containerName,
    "--user", "postgres",
    "--network", "none",
    "--read-only",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--mount", `type=volume,source=${pitrVolumeName},target=/var/lib/postgresql/data`,
    "--entrypoint", "sh",
    POSTGRES_IMAGE,
    "-c", [
      "find /var/lib/postgresql/data/pg_wal -mindepth 1 -delete",
      "rm -f /var/lib/postgresql/data/standby.signal /var/lib/postgresql/data/recovery.signal",
      "touch /var/lib/postgresql/data/recovery.signal",
    ].join(" && "),
  ], { stage: "postgres-pitr-recovery-target-prepare" });
}

async function readPitrMarkerState({
  connectionString,
  includedMarkerId,
  excludedMarkerId,
}) {
  assertReplicationMarkerId(includedMarkerId);
  assertReplicationMarkerId(excludedMarkerId);
  const pool = new Pool({ connectionString, max: 1, allowExitOnIdle: true });
  try {
    const result = await pool.query(`
      SELECT
        EXISTS (
          SELECT 1 FROM public.gateway_drill_replication_evidence WHERE run_id = $1
        ) AS included_present,
        EXISTS (
          SELECT 1 FROM public.gateway_drill_replication_evidence WHERE run_id = $2
        ) AS excluded_present,
        current_setting('primary_conninfo', true) AS primary_conninfo
    `, [includedMarkerId, excludedMarkerId]);
    const primaryConninfo = String(result.rows[0]?.primary_conninfo ?? "").trim();
    return {
      includedPresent: result.rows[0]?.included_present === true,
      excludedPresent: result.rows[0]?.excluded_present === true,
      primaryConninfoConfigured: primaryConninfo.length > 0,
    };
  } finally {
    await pool.end();
  }
}

function assertWalFileName(value) {
  if (!/^[0-9A-F]{24}$/i.test(String(value ?? ""))) {
    throw drillError(
      "POSTGRES_RECOVERY_PITR_WAL_FILE_INVALID",
      "PostgreSQL returned an invalid WAL archive file name.",
    );
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

async function writeReplicationMarkerInsideContainer({
  dockerExecutable,
  containerName,
  markerId,
}) {
  assertReplicationMarkerId(markerId);
  const result = await runDocker(dockerExecutable, [
    "exec", containerName,
    "psql",
    "--username", POSTGRES_USER,
    "--dbname", POSTGRES_DATABASE,
    "--set", "ON_ERROR_STOP=1",
    "--tuples-only",
    "--no-align",
    "--command", [
      "BEGIN;",
      "SELECT NOT pg_is_in_recovery();",
      "INSERT INTO public.gateway_drill_replication_evidence (run_id)",
      `VALUES ('${markerId}')`,
      "ON CONFLICT (run_id) DO UPDATE SET created_at = clock_timestamp();",
      "COMMIT;",
      "SELECT pg_current_wal_lsn()::text;",
    ].join(" "),
  ], { stage: "postgres-partition-marker-write" });
  const lines = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const primaryWritable = lines.includes("t");
  const primaryWalLsn = lines.findLast((line) => /^[0-9A-F]+\/[0-9A-F]+$/i.test(line)) ?? "";
  assertCondition(primaryWritable, "POSTGRES_RECOVERY_PARTITIONED_PRIMARY_NOT_WRITABLE");
  assertCondition(primaryWalLsn.length > 0, "POSTGRES_RECOVERY_PRIMARY_WAL_LSN_MISSING");
  return { primaryWritable, primaryWalLsn };
}

async function readStandbyReplicationMarker({ standbyConnectionString, markerId }) {
  assertReplicationMarkerId(markerId);
  const pool = new Pool({
    connectionString: standbyConnectionString,
    max: 1,
    allowExitOnIdle: true,
    connectionTimeoutMillis: 1_000,
  });
  try {
    const result = await pool.query(`
      SELECT
        pg_is_in_recovery() AS in_recovery,
        pg_last_wal_replay_lsn()::text AS replay_lsn,
        EXISTS (
          SELECT 1 FROM public.gateway_drill_replication_evidence WHERE run_id = $1
        ) AS marker_present
    `, [markerId]);
    return {
      inRecovery: result.rows[0]?.in_recovery === true,
      replayLsn: result.rows[0]?.replay_lsn ?? null,
      markerPresent: result.rows[0]?.marker_present === true,
    };
  } finally {
    await pool.end();
  }
}

async function waitForStandbyReplicationMarker({
  standbyConnectionString,
  markerId,
  primaryWalLsn,
  timeoutMs = 30_000,
}) {
  assertReplicationMarkerId(markerId);
  parsePgLsn(primaryWalLsn);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await readStandbyReplicationMarker({
      standbyConnectionString,
      markerId,
    });
    if (state.inRecovery && state.markerPresent && state.replayLsn) {
      const replayLag = parsePgLsn(primaryWalLsn) - parsePgLsn(state.replayLsn);
      return {
        markerReplayed: true,
        standbyReplayLsn: String(state.replayLsn),
        replayLagBytes: safeBigIntToNumber(replayLag > 0n ? replayLag : 0n),
      };
    }
    await delay(250);
  }
  throw drillError(
    "POSTGRES_RECOVERY_PARTITION_HEAL_TIMEOUT",
    "The standby did not replay the partition marker after the Docker bridge healed.",
  );
}

function assertReplicationMarkerId(markerId) {
  if (!/^[a-z0-9-]{1,64}$/.test(String(markerId ?? ""))) {
    throw drillError(
      "POSTGRES_RECOVERY_REPLICATION_MARKER_INVALID",
      "The replication marker identifier is invalid.",
    );
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

function startAutomaticSingleStandbyFailover({
  signal,
  probePrimary,
  inspectStandby,
  promoteStandby,
  verifyPrimaryFenced,
  switchEndpoint,
  requiredHealthyProbes = 3,
  failureThreshold = 3,
  pollIntervalMs = 100,
  confirmationDelayMs = 200,
  maxDurationMs = 30_000,
}) {
  let resolveArmed;
  let rejectArmed;
  let resolveTransientReset;
  let rejectTransientReset;
  let resolveFencingRejection;
  let rejectFencingRejection;
  let resolvePostFencingHealthyReset;
  let rejectPostFencingHealthyReset;
  let armed = false;
  let transientResetObserved = false;
  let fencingRejectionObserved = false;
  let postFencingHealthyResetObserved = false;
  let forcedProbeFailures = 0;
  let syntheticProbeFailuresObserved = 0;
  let rejectedFenceEvidence = null;
  const armedPromise = new Promise((resolvePromise, rejectPromise) => {
    resolveArmed = resolvePromise;
    rejectArmed = rejectPromise;
  });
  const transientResetPromise = new Promise((resolvePromise, rejectPromise) => {
    resolveTransientReset = resolvePromise;
    rejectTransientReset = rejectPromise;
  });
  const fencingRejectionPromise = new Promise((resolvePromise, rejectPromise) => {
    resolveFencingRejection = resolvePromise;
    rejectFencingRejection = rejectPromise;
  });
  const postFencingHealthyResetPromise = new Promise((resolvePromise, rejectPromise) => {
    resolvePostFencingHealthyReset = resolvePromise;
    rejectPostFencingHealthyReset = rejectPromise;
  });
  const samplePrimary = async () => {
    if (forcedProbeFailures > 0) {
      forcedProbeFailures -= 1;
      syntheticProbeFailuresObserved += 1;
      return false;
    }
    return Promise.resolve().then(probePrimary).catch(() => false);
  };
  const completion = (async () => {
    const startedAt = Date.now();
    let totalProbes = 0;
    let healthyProbes = 0;
    let consecutiveHealthy = 0;
    let consecutiveFailures = 0;
    let maximumConsecutiveFailures = 0;
    let transientFailureResets = 0;
    let confirmationProbes = 0;
    let fencingRejections = 0;
    let awaitingPostFenceHealthy = false;
    let firstFailureAt = null;
    while (Date.now() - startedAt <= maxDurationMs) {
      if (signal?.aborted) {
        throw drillError("POSTGRES_RECOVERY_FAILOVER_CONTROLLER_ABORTED", "The automatic failover controller was aborted.");
      }
      const healthy = await samplePrimary();
      totalProbes += 1;
      if (!armed) {
        if (healthy) {
          healthyProbes += 1;
          consecutiveHealthy += 1;
          if (consecutiveHealthy >= requiredHealthyProbes) {
            armed = true;
            resolveArmed({
              armed: true,
              healthyProbes,
              requiredHealthyProbes,
              totalProbes,
            });
          }
        } else {
          consecutiveHealthy = 0;
        }
      } else if (healthy) {
        healthyProbes += 1;
        if (awaitingPostFenceHealthy) {
          awaitingPostFenceHealthy = false;
          if (!postFencingHealthyResetObserved) {
            postFencingHealthyResetObserved = true;
            resolvePostFencingHealthyReset({
              healthyAfterRejection: true,
              syntheticProbeFailuresObserved,
              fencingRejections,
            });
          }
        }
        if (consecutiveFailures > 0) {
          transientFailureResets += 1;
          if (!transientResetObserved) {
            transientResetObserved = true;
            resolveTransientReset({
              transientFailureResets,
              syntheticProbeFailuresObserved,
            });
          }
        }
        consecutiveFailures = 0;
        firstFailureAt = null;
      } else {
        if (consecutiveFailures === 0) firstFailureAt = Date.now();
        consecutiveFailures += 1;
        maximumConsecutiveFailures = Math.max(maximumConsecutiveFailures, consecutiveFailures);
        if (consecutiveFailures >= failureThreshold) {
          await delay(confirmationDelayMs);
          if (signal?.aborted) {
            throw drillError("POSTGRES_RECOVERY_FAILOVER_CONTROLLER_ABORTED", "The automatic failover controller was aborted.");
          }
          confirmationProbes += 1;
          const recovered = await samplePrimary();
          if (recovered) {
            healthyProbes += 1;
            transientFailureResets += 1;
            consecutiveFailures = 0;
            firstFailureAt = null;
          } else {
            const standbyRole = await inspectStandby();
            if (standbyRole?.inRecovery !== true) {
              throw drillError(
                "POSTGRES_RECOVERY_FAILOVER_STANDBY_NOT_READY",
                "Automatic failover requires exactly one healthy standby still in recovery.",
              );
            }
            const fence = await verifyPrimaryFenced();
            if (fence?.fenced !== true) {
              fencingRejections += 1;
              rejectedFenceEvidence = {
                primaryStillRunning: fence?.primaryStillRunning === true,
              };
              if (!fencingRejectionObserved) {
                fencingRejectionObserved = true;
                resolveFencingRejection({
                  fencingRejections,
                  primaryStillRunning: rejectedFenceEvidence.primaryStillRunning,
                  syntheticProbeFailuresObserved,
                });
              }
              transientFailureResets += 1;
              awaitingPostFenceHealthy = true;
              consecutiveFailures = 0;
              firstFailureAt = null;
              await delay(pollIntervalMs);
              continue;
            }
            const detectedAt = Date.now();
            const promotion = await promoteStandby();
            const switchStartedAt = Date.now();
            const switchResult = switchEndpoint();
            return {
              mode: "automatic-single-standby",
              armed: true,
              requiredHealthyProbes,
              healthyProbes,
              totalProbes,
              failureThreshold,
              maximumConsecutiveFailures,
              confirmationProbes,
              primaryFailureConfirmed: true,
              primaryFenceConfirmed: true,
              promotionBlockedWhilePrimaryRunning:
                fencingRejectionObserved
                && postFencingHealthyResetObserved
                && rejectedFenceEvidence?.primaryStillRunning === true,
              standbyWasInRecoveryBeforePromotion: true,
              transientFailureResets,
              syntheticProbeFailuresObserved,
              fencingRejections,
              detectionTimeMs: detectedAt - firstFailureAt,
              endpointSwitchTimeMs: Date.now() - switchStartedAt,
              controllerDurationMs: Date.now() - startedAt,
              promotion,
              switchResult,
            };
          }
        }
      }
      await delay(pollIntervalMs);
    }
    throw drillError(
      "POSTGRES_RECOVERY_FAILOVER_CONTROLLER_TIMEOUT",
      "The automatic failover controller did not reach a safe terminal decision in time.",
    );
  })();
  completion.catch((error) => {
    if (!armed) rejectArmed(error);
    if (!transientResetObserved) rejectTransientReset(error);
    if (!fencingRejectionObserved) rejectFencingRejection(error);
    if (!postFencingHealthyResetObserved) rejectPostFencingHealthyReset(error);
  });
  void completion.catch(() => undefined);
  return {
    waitUntilArmed: () => armedPromise,
    injectSyntheticProbeFailures(count = 1) {
      if (!armed) {
        throw drillError(
          "POSTGRES_RECOVERY_FAILOVER_CONTROLLER_NOT_ARMED",
          "Synthetic probe failure injection requires an armed failover controller.",
        );
      }
      if (!Number.isSafeInteger(count) || count < 1 || count > 10) {
        throw drillError(
          "POSTGRES_RECOVERY_FAILOVER_SYNTHETIC_COUNT_INVALID",
          "Synthetic probe failure count must be an integer between 1 and 10.",
        );
      }
      forcedProbeFailures += count;
    },
    waitForTransientFailureReset: () => transientResetPromise,
    waitForFencingRejection: () => fencingRejectionPromise,
    waitForPostFencingHealthyReset: () => postFencingHealthyResetPromise,
    completion,
  };
}

async function probePostgresWritable(connectionString, timeoutMs = 500) {
  const pool = new Pool({
    connectionString,
    max: 1,
    allowExitOnIdle: true,
    connectionTimeoutMillis: timeoutMs,
    statement_timeout: timeoutMs,
    query_timeout: timeoutMs,
  });
  try {
    const result = await pool.query(`SELECT NOT pg_is_in_recovery() AS writable`);
    return result.rows[0]?.writable === true;
  } catch {
    return false;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function probePostgresWritableFromContainer({
  dockerExecutable,
  probeContainerName,
}) {
  const result = await runProcess(dockerExecutable, [
    "exec", probeContainerName,
    "psql",
    "--no-password",
    "--host", "primary",
    "--username", POSTGRES_USER,
    "--dbname", POSTGRES_DATABASE,
    "--set", "ON_ERROR_STOP=1",
    "--tuples-only",
    "--no-align",
    "--command", "SELECT NOT pg_is_in_recovery();",
  ], { timeoutMs: 1_500 });
  return result.exitCode === 0 && result.stdout.trim() === "t";
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
  additionalMounts = [],
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
  for (const mount of additionalMounts) {
    assertCondition(
      typeof mount === "string" && mount.length > 0 && mount.length <= 512,
      "POSTGRES_RECOVERY_MOUNT_INVALID",
    );
    args.push("--mount", mount);
  }
  args.push(POSTGRES_IMAGE, ...postgresArguments);
  await runDocker(dockerExecutable, args, { stage: "postgres-container-start" });
}

async function startNetworkProbeContainer({
  dockerExecutable,
  containerName,
  networkName,
  postgresEnvPath,
  runId,
}) {
  await runDocker(dockerExecutable, [
    "run",
    "--detach",
    "--name", containerName,
    "--label", `ai.gateway.recovery-drill=${runId}`,
    "--network", networkName,
    "--env-file", postgresEnvPath,
    "--env", "PGCONNECT_TIMEOUT=1",
    "--env", "PGOPTIONS=-c statement_timeout=750",
    "--read-only",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--pids-limit", "64",
    "--memory", "128m",
    "--entrypoint", "sleep",
    POSTGRES_IMAGE,
    "300",
  ], { stage: "postgres-network-probe-start" });
}

async function preparePostgresOwnedVolume({
  dockerExecutable,
  containerName,
  volumeName,
  targetPath,
  stage,
}) {
  assertCondition(
    /^\/[a-z0-9/._-]{1,200}$/.test(targetPath),
    "POSTGRES_RECOVERY_VOLUME_TARGET_INVALID",
  );
  await runDocker(dockerExecutable, [
    "run", "--rm",
    "--name", containerName,
    "--user", "root",
    "--mount", `type=volume,source=${volumeName},target=${targetPath}`,
    "--entrypoint", "chown",
    POSTGRES_IMAGE,
    "-R", "70:70", targetPath,
  ], { stage });
}

async function assertArchiveToolsAvailable(dockerExecutable) {
  await runDocker(dockerExecutable, [
    "run", "--rm",
    "--network", "none",
    "--read-only",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--entrypoint", "sh",
    POSTGRES_IMAGE,
    "-c", "command -v cp >/dev/null && command -v cmp >/dev/null && command -v mv >/dev/null",
  ], { stage: "postgres-archive-tools-preflight" });
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

async function disconnectDockerNetwork(dockerExecutable, networkName, containerName) {
  await runDocker(dockerExecutable, [
    "network", "disconnect", networkName, containerName,
  ], { stage: "postgres-replication-network-disconnect" });
}

async function connectDockerNetwork(
  dockerExecutable,
  networkName,
  containerName,
  networkAlias,
) {
  const args = ["network", "connect"];
  if (networkAlias) args.push("--alias", networkAlias);
  args.push(networkName, containerName);
  await runDocker(dockerExecutable, args, { stage: "postgres-replication-network-connect" });
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

async function inspectContainerFence(dockerExecutable, containerName) {
  const result = await runProcess(
    dockerExecutable,
    ["inspect", "--format", "{{.State.Running}}", containerName],
    { timeoutMs: 5_000 },
  );
  if (result.exitCode === 0) {
    const runningState = result.stdout.trim().toLowerCase();
    if (runningState !== "true" && runningState !== "false") {
      throw drillError(
        "POSTGRES_RECOVERY_PRIMARY_FENCE_STATE_INVALID",
        "Docker returned an invalid primary fencing state.",
      );
    }
    return {
      fenced: runningState === "false",
      primaryStillRunning: runningState === "true",
    };
  }
  if (/No such (?:object|container)/i.test(`${result.stdout} ${result.stderr}`)) {
    return {
      fenced: true,
      primaryStillRunning: false,
    };
  }
  throw drillError(
    "POSTGRES_RECOVERY_PRIMARY_FENCE_INSPECT_FAILED",
    "Docker could not determine whether the old primary was fenced.",
  );
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

function sanitizeFailureMessage(value, maxLength = 500) {
  const normalized = String(value ?? "PostgreSQL recovery drill failed.")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-postgres-url]")
    .replace(/POSTGRES_PASSWORD=[^\s]+/gi, "POSTGRES_PASSWORD=[redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .trim();
  const boundedLength = Number.isSafeInteger(maxLength)
    ? Math.min(4_000, Math.max(100, maxLength))
    : 500;
  return normalized.slice(0, boundedLength) || "PostgreSQL recovery drill failed.";
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
      `Automatic single-standby failover proved: ${String(value.boundaries.automaticSingleStandbyFailoverProved)}`,
      `Promotion blocked while old primary remained running: ${String(value.automaticFailover.promotionBlockedWhilePrimaryRunning)}`,
      `Single Docker-bridge partition fenced and healed: ${String(value.boundaries.singleBridgePartitionFenceProved)}`,
      `Old primary safely rejoined as standby: ${String(value.boundaries.safeOldPrimaryRejoinProved)}`,
      `Bounded WAL-archive LSN PITR proved: ${String(value.boundaries.boundedWalArchivePitrProved)}`,
      `Database inventory: ${value.databaseInventory.tableCount} tables, ${value.databaseInventory.totalRows} rows`,
      `Cleanup complete: ${String(value.cleanup.complete)}`,
      "Boundary: one Docker bridge, bounded failover/rejoin, and one LSN PITR target; no quorum election, complete split-brain, archive custody, or production RTO/RPO claim.",
    ].join("\n") + "\n");
    return;
  }
  process.stdout.write(`${value.status}: ${value.message ?? "dry run"}\n`);
}
