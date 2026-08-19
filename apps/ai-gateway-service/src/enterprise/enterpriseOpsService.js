import { existsSync } from "node:fs";
import { chmod, lstat, mkdir, open, realpath, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { createPinoLogger } from "../logging/pinoLogger.js";
import {
  createEnterpriseBackupProtector,
  createEnterpriseBackupTenantBinding,
  ENTERPRISE_BACKUP_PAYLOAD_TYPE,
  ENTERPRISE_BACKUP_PAYLOAD_VERSION,
  isEnterpriseBackupProtectionError,
} from "../security/enterpriseBackupProtection.ts";
import { requireEnterpriseTenantId } from "./enterpriseTenantPolicy.ts";

const DEFAULT_BACKUP_DIR = ".data/enterprise/backups";
const DEFAULT_CHECKPOINT_DIR = ".data/enterprise/backup-checkpoints";
const MAX_BACKUP_FILE_BYTES = 24 * 1024 * 1024;
const MAX_CHECKPOINT_FILE_BYTES = 64 * 1024;
const logger = createPinoLogger({ app: "enterpriseOpsService" });

export function createEnterpriseOpsService({ env = {}, config, enterpriseGovernanceService, knowledgeInfra, knowledgeService } = {}) {
  const backupDir = resolve(env.PME_ENTERPRISE_BACKUP_DIR ?? DEFAULT_BACKUP_DIR);
  const checkpointDir = resolve(env.PME_ENTERPRISE_BACKUP_CHECKPOINT_DIR ?? DEFAULT_CHECKPOINT_DIR);
  const backupSecurity = initializeBackupSecurity(env);
  const runBackupOperation = createSerialExecutor();

  const service = {
    getReadiness() {
      const enterpriseHealth = enterpriseGovernanceService.getHealth();
      const securityReadiness = enterpriseGovernanceService.getSecurityReadiness();
      const knowledgeHealth = knowledgeService.getHealth();
      const infraReadiness = knowledgeInfra.getReadiness();
      const checks = [
        createCheck({
          id: "enterprise_auth",
          status: securityReadiness.authEnabled ? "ready" : "warning",
          message: securityReadiness.authEnabled ? "Enterprise auth is enabled." : "Enterprise auth is disabled.",
        }),
        createCheck({
          id: "active_enterprise_users",
          status: securityReadiness.userStore.activeUserCount > 0 ? "ready" : "blocked",
          message:
            securityReadiness.userStore.activeUserCount > 0
              ? "At least one active enterprise user is configured."
              : "No active enterprise user is configured.",
        }),
        createCheck({
          id: "enterprise_user_store",
          status: enterpriseHealth.userStore?.path ? "ready" : "blocked",
          message: enterpriseHealth.userStore?.path ? "Enterprise user store path is configured." : "Enterprise user store path is missing.",
          details: {
            path: enterpriseHealth.userStore?.path ?? null,
            mode: enterpriseHealth.userStore?.mode ?? null,
          },
        }),
        createCheck({
          id: "enterprise_audit_log",
          status: enterpriseHealth.audit?.path ? "ready" : "blocked",
          message: enterpriseHealth.audit?.path ? "Enterprise audit log path is configured." : "Enterprise audit log path is missing.",
          details: {
            path: enterpriseHealth.audit?.path ?? null,
            mode: enterpriseHealth.audit?.mode ?? null,
          },
        }),
        createCheck({
          id: "enterprise_backup_dir",
          status: backupDir ? "ready" : "blocked",
          message: backupDir ? "Enterprise backup directory is configured." : "Enterprise backup directory is missing.",
          details: {
            path: backupDir,
          },
        }),
        createCheck({
          id: "enterprise_backup_protection",
          status: backupSecurity.status,
          message: backupSecurity.status === "ready"
            ? "Enterprise backups use authenticated encryption, signed manifests, and rollback checkpoints."
            : "Enterprise backup protection requires a valid dedicated master key and rollback policy.",
          details: backupSecurity.summary,
        }),
        createCheck({
          id: "knowledge_persistence",
          status: knowledgeHealth.persistence?.durable ? "ready" : "warning",
          message: knowledgeHealth.persistence?.durable
            ? "Knowledge persistence is durable for this runtime."
            : "Knowledge persistence is in-memory for this runtime.",
          details: {
            storage: knowledgeHealth.storage,
            persistence: knowledgeHealth.persistence,
          },
        }),
        createCheck({
          id: "vector_infra_optional",
          status: "ready",
          message: "Vector infrastructure remains explicit-config optional and does not block local-keyword deployment readiness.",
          details: {
            status: infraReadiness.status,
            mode: infraReadiness.mode,
          },
        }),
      ];
      const blockers = checks.filter((check) => check.status === "blocked").map((check) => check.id);
      const warnings = checks.filter((check) => check.status === "warning").map((check) => check.id);

      return {
        status: blockers.length ? "blocked" : warnings.length ? "warning" : "ready",
        mode: "enterprise-deployment-readiness",
        backup: {
          mode: backupSecurity.status === "ready" ? "encrypted-signed-envelope" : "unavailable",
          directory: backupDir,
          checkpointDirectory: checkpointDir,
          protection: backupSecurity.summary,
        },
        checks,
        blockers,
        warnings,
      };
    },

    getStartupReadiness() {
      const deploymentReadiness = this.getReadiness();
      const enterpriseHealth = enterpriseGovernanceService.getHealth();
      const securityReadiness = enterpriseGovernanceService.getSecurityReadiness();
      const knowledgeHealth = knowledgeService.getHealth();
      const infraReadiness = knowledgeInfra.getReadiness();
      const providerChecks = createProviderStartupChecks({ env, config });
      const checks = [
        createCheck({
          id: "deployment_readiness",
          status: deploymentReadiness.status,
          message: `Deployment readiness is ${deploymentReadiness.status}.`,
          details: {
            blockers: deploymentReadiness.blockers,
            warnings: deploymentReadiness.warnings,
          },
        }),
        createCheck({
          id: "enterprise_auth_enabled",
          status: securityReadiness.authEnabled ? "ready" : "blocked",
          message: securityReadiness.authEnabled ? "Enterprise auth is enabled for startup." : "Enterprise auth must be enabled for enterprise startup.",
        }),
        createCheck({
          id: "enterprise_token_policy",
          status: securityReadiness.userStore.usersWithoutExpiryCount === 0 ? "ready" : "warning",
          message:
            securityReadiness.userStore.usersWithoutExpiryCount === 0
              ? "All active enterprise tokens have expiry metadata."
              : "Some active enterprise tokens do not have expiry metadata.",
          details: {
            activeUserCount: securityReadiness.userStore.activeUserCount,
            usersWithoutExpiryCount: securityReadiness.userStore.usersWithoutExpiryCount,
          },
        }),
        createCheck({
          id: "enterprise_user_store_path",
          status: enterpriseHealth.userStore?.path ? "ready" : "blocked",
          message: enterpriseHealth.userStore?.path ? "Enterprise user store path is configured." : "Enterprise user store path is missing.",
          details: {
            path: enterpriseHealth.userStore?.path ?? null,
            mode: enterpriseHealth.userStore?.mode ?? null,
          },
        }),
        createCheck({
          id: "enterprise_audit_path",
          status: enterpriseHealth.audit?.path ? "ready" : "blocked",
          message: enterpriseHealth.audit?.path ? "Enterprise audit path is configured." : "Enterprise audit path is missing.",
          details: {
            path: enterpriseHealth.audit?.path ?? null,
            mode: enterpriseHealth.audit?.mode ?? null,
          },
        }),
        createCheck({
          id: "enterprise_backup_dir",
          status: backupDir ? "ready" : "blocked",
          message: backupDir ? "Enterprise backup directory is configured." : "Enterprise backup directory is missing.",
          details: {
            path: backupDir,
          },
        }),
        createCheck({
          id: "knowledge_durable_startup",
          status: knowledgeHealth.persistence?.durable ? "ready" : "warning",
          message: knowledgeHealth.persistence?.durable
            ? "Knowledge storage is durable for startup."
            : "Knowledge storage is in-memory; imported documents are not durable after restart.",
          details: {
            storage: knowledgeHealth.storage,
            persistence: knowledgeHealth.persistence,
          },
        }),
        ...providerChecks,
        createCheck({
          id: "vector_mode_boundary",
          status: infraReadiness.enabled && !infraReadiness.productionReady ? "warning" : "ready",
          message:
            infraReadiness.enabled && !infraReadiness.productionReady
              ? "Vector mode is enabled but production vector readiness is not complete."
              : "Vector mode boundary is clear for startup.",
          details: {
            mode: infraReadiness.mode,
            enabled: infraReadiness.enabled,
            productionReady: infraReadiness.productionReady,
            blockers: infraReadiness.blockers,
          },
        }),
      ];
      const blockers = checks.filter((check) => check.status === "blocked").map((check) => check.id);
      const warnings = checks.filter((check) => check.status === "warning").map((check) => check.id);

      return {
        status: blockers.length ? "blocked" : warnings.length ? "warning" : "ready",
        mode: "enterprise-production-startup-readiness",
        profile: "enterprise-startup",
        service: {
          host: config?.aiGatewayService?.endpoint?.host ?? null,
          port: config?.aiGatewayService?.endpoint?.port ?? null,
          providerMode: config?.aiGatewayService?.providerMode ?? null,
          realProviderEnabled: Boolean(config?.aiGatewayService?.realProviderEnabled),
          fallbackEnabled: Boolean(config?.aiGatewayService?.fallbackEnabled),
          defaultProviderId: config?.aiGatewayService?.providerSelection?.defaultProviderId ?? null,
          enabledProviders: config?.aiGatewayService?.providerSelection?.enabledProviders ?? [],
        },
        secrets: createSecretPresenceSummary(env),
        checks,
        blockers,
        warnings,
      };
    },

    async createBackup(input = {}, actorIdentity) {
      return runBackupOperation(async () => {
        const tenantId = requireEnterpriseTenantId(actorIdentity);
        const protector = requireBackupProtector(backupSecurity);
        await hardenPrivateDirectory(backupDir);
        await hardenPrivateDirectory(checkpointDir);
        const checkpoint = await readBackupCheckpoint({ checkpointDir, tenantId, protector });
        const anchor = resolveBackupAnchor(checkpoint, backupSecurity.rollbackPolicy);
        const sequence = anchor.sequence + 1;
        const now = new Date().toISOString();
        const backupId = `pme-enterprise-backup-${now.replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
        const backupPath = resolve(backupDir, `${backupId}.pmebackup.json`);
        const auditExport = await enterpriseGovernanceService.exportAudit({
          limit: input.auditLimit ?? 1000,
          format: "json",
          actorIdentity,
        });
        let auditEntries = [];
        let auditParseStatus = "ready";
        try {
          const parsedAuditEntries = JSON.parse(auditExport.content || "[]");
          if (!Array.isArray(parsedAuditEntries)) throw new TypeError("Enterprise audit export must be a JSON array.");
          auditEntries = parsedAuditEntries;
        } catch (error) {
          auditParseStatus = "warning";
          logger.warn({ err: error, event: "enterprise_backup_audit_parse_failed", tenantId },
            "Enterprise backup is continuing without parsed audit entries.");
        }
        const backupWarnings = auditParseStatus === "ready" ? [] : ["audit_export_json_invalid"];
        const body = {
          type: ENTERPRISE_BACKUP_PAYLOAD_TYPE,
          version: ENTERPRISE_BACKUP_PAYLOAD_VERSION,
          backupId,
          tenantId,
          sequence,
          generatedAt: now,
          previousBackupDigest: anchor.artifactDigest,
          generatedBy: actorIdentity ? sanitizeIdentity(actorIdentity) : null,
          reason: typeof input.reason === "string" && input.reason.trim() ? input.reason.trim() : "manual-enterprise-backup",
          tokenValuesExposed: false,
          readiness: service.getReadiness(),
          enterpriseUsers: enterpriseGovernanceService.exportUsersForBackup(actorIdentity),
          audit: {
            pathExposed: false,
            format: "json",
            parseStatus: auditParseStatus,
            entryCount: auditEntries.length,
            entries: auditEntries,
          },
          knowledge: {
            health: knowledgeService.getHealth(),
            infraReadiness: knowledgeInfra.getReadiness(),
          },
        };
        const sealed = protector.sealBackup({
          payload: body,
          backupId,
          tenantId,
          sequence,
          generatedAt: now,
          previousBackupDigest: anchor.artifactDigest,
        });
        const artifactText = `${JSON.stringify(sealed.envelope, null, 2)}\n`;
        await writePrivateFileAtomic(backupPath, artifactText);
        const checkpointValue = protector.sealCheckpoint({
          tenantId,
          sequence,
          artifactDigest: sealed.artifactDigest,
          updatedAt: now,
        });
        try {
          await writePrivateFileAtomic(resolveCheckpointPath(checkpointDir, tenantId), `${JSON.stringify(checkpointValue, null, 2)}\n`);
        } catch (error) {
          await rm(backupPath, { force: true }).catch(() => undefined);
          throw error;
        }

        return {
          status: auditParseStatus === "ready" ? "ready" : "warning",
          mode: "enterprise-backup-encrypted-signed-envelope",
          backupId,
          backupPath,
          backupFileName: basename(backupPath),
          byteSize: Buffer.byteLength(artifactText),
          generatedAt: now,
          sequence,
          artifactDigest: sealed.artifactDigest,
          keyId: protector.keyId,
          signingKeyId: protector.signingKeyId,
          tokenValuesExposed: false,
          auditParseStatus,
          warnings: backupWarnings,
          managedStoredUserCount: body.enterpriseUsers.storedUsers.length,
          auditEntryCount: auditEntries.length,
          knowledgeDocumentCount: body.knowledge.health.documentCount,
        };
      });
    },

    async validateRestore(input = {}, actorIdentity) {
      const tenantId = requireEnterpriseTenantId(actorIdentity);
      const backupPath = resolveBackupPath(input.backupPath, backupDir);
      const blockers = [];
      const warnings = [];

      if (!existsSync(backupPath)) {
        blockers.push("backup_file_not_found");
        return createRestoreValidation({ backupPath, blockers, warnings });
      }

      const protector = backupSecurity.protector;
      if (!protector) {
        blockers.push("backup_protection_unavailable");
        return createRestoreValidation({ backupPath, blockers, warnings });
      }

      let parsedEnvelope;
      try {
        parsedEnvelope = await readBoundedJsonInside(backupPath, backupDir, MAX_BACKUP_FILE_BYTES);
      } catch (error) {
        blockers.push(mapBackupErrorToBlocker(error, "backup_envelope_invalid"));
        return createRestoreValidation({ backupPath, blockers, warnings });
      }

      let opened;
      try {
        opened = protector.openBackup(parsedEnvelope, tenantId);
      } catch (error) {
        blockers.push(mapBackupErrorToBlocker(error, "backup_authentication_failed"));
        return createRestoreValidation({ backupPath, blockers, warnings });
      }
      const parsed = opened.payload;

      if (hasRawTokenKey(parsed)) {
        blockers.push("backup_contains_raw_token_key");
      }

      if (!Array.isArray(parsed.enterpriseUsers?.storedUsers)) {
        blockers.push("backup_enterprise_users_missing");
      }

      if (!Array.isArray(parsed.audit?.entries)) {
        warnings.push("backup_audit_entries_missing");
      }

      let checkpoint;
      try {
        checkpoint = await readBackupCheckpoint({ checkpointDir, tenantId, protector });
      } catch (error) {
        blockers.push(mapBackupErrorToBlocker(error, "backup_checkpoint_invalid"));
        return createRestoreValidation({ backupPath, blockers, warnings, backup: parsed, opened });
      }
      evaluateRollbackPolicy({
        opened,
        checkpoint,
        rollbackPolicy: backupSecurity.rollbackPolicy,
        blockers,
        warnings,
      });

      return createRestoreValidation({
        backupPath,
        blockers,
        warnings,
        backup: parsed,
        opened,
      });
    },
  };
  return service;
}

function createCheck({ id, status, message, details = {} }) {
  return {
    id,
    status,
    message,
    details,
  };
}

function createProviderStartupChecks({ env, config }) {
  const providerMode = config?.aiGatewayService?.providerMode ?? "unknown";
  const realProviderEnabled = Boolean(config?.aiGatewayService?.realProviderEnabled);
  const providerSelection = config?.aiGatewayService?.providerSelection ?? {};
  const nvidiaProvider = config?.aiGatewayService?.providerModels?.find((provider) => provider.providerId === "nvidia");
  const checks = [
    createCheck({
      id: "provider_mode_real",
      status: providerMode === "real" && realProviderEnabled ? "ready" : "warning",
      message:
        providerMode === "real" && realProviderEnabled
          ? "Gateway provider mode is configured for real provider startup."
          : "Gateway provider mode is not fully configured for real provider startup.",
      details: {
        providerMode,
        realProviderEnabled,
      },
    }),
    createCheck({
      id: "nvidia_single_provider_startup",
      status: providerSelection.defaultProviderId === "nvidia" && providerSelection.enabledProviders?.includes("nvidia") ? "ready" : "warning",
      message:
        providerSelection.defaultProviderId === "nvidia" && providerSelection.enabledProviders?.includes("nvidia")
          ? "Default startup provider is NVIDIA single-provider."
          : "Default startup provider is not NVIDIA single-provider.",
      details: {
        defaultProviderId: providerSelection.defaultProviderId ?? null,
        enabledProviders: providerSelection.enabledProviders ?? [],
      },
    }),
    createCheck({
      id: "nvidia_api_key_present",
      status: Boolean(nvidiaProvider?.apiKeyPresent || env.NVIDIA_API_KEY) ? "ready" : "blocked",
      message: Boolean(nvidiaProvider?.apiKeyPresent || env.NVIDIA_API_KEY)
        ? "NVIDIA API key is present for startup."
        : "NVIDIA API key is required for real NVIDIA startup.",
      details: {
        valueExposed: false,
      },
    }),
  ];

  return checks;
}

function createSecretPresenceSummary(env) {
  return {
    NVIDIA_API_KEY: createSecretPresence(env.NVIDIA_API_KEY),
    OPENAI_API_KEY: createSecretPresence(env.OPENAI_API_KEY),
    KNOWLEDGE_EMBEDDING_API_KEY: createSecretPresence(env.KNOWLEDGE_EMBEDDING_API_KEY),
    PGVECTOR_CONNECTION_STRING: createSecretPresence(env.PGVECTOR_CONNECTION_STRING),
    PME_AUTH_TOKEN: createSecretPresence(env.PME_AUTH_TOKEN),
    PME_ENTERPRISE_USERS_JSON: createSecretPresence(env.PME_ENTERPRISE_USERS_JSON),
  };
}

function createSecretPresence(value) {
  return {
    present: Boolean(typeof value === "string" && value.trim()),
    valueExposed: false,
  };
}

function createRestoreValidation({ backupPath, blockers, warnings, backup, opened }) {
  return {
    status: blockers.length ? "blocked" : warnings.length ? "warning" : "ready",
    mode: "restore-validate-only-encrypted",
    valid: blockers.length === 0,
    mutation: "none",
    backupPath,
    backupId: backup?.backupId ?? null,
    generatedAt: backup?.generatedAt ?? null,
    sequence: opened?.envelope?.sequence ?? null,
    artifactDigest: opened?.artifactDigest ?? null,
    protection: {
      encrypted: Boolean(opened),
      authenticated: Boolean(opened),
      manifestSigned: Boolean(opened),
      keyId: opened?.envelope?.keyId ?? null,
      signingKeyId: opened?.envelope?.signingKeyId ?? null,
    },
    storedUserCount: backup?.enterpriseUsers?.storedUsers?.length ?? 0,
    auditEntryCount: backup?.audit?.entries?.length ?? 0,
    knowledgeDocumentCount: backup?.knowledge?.health?.documentCount ?? 0,
    tokenValuesExposed: false,
    blockers,
    warnings,
  };
}

function initializeBackupSecurity(env) {
  let rollbackPolicy;
  try {
    rollbackPolicy = readRollbackPolicy(env);
    const protector = createEnterpriseBackupProtector({ env });
    return {
      status: "ready",
      protector,
      rollbackPolicy,
      summary: {
        configured: true,
        encryption: protector.algorithm,
        manifestSignature: protector.signingAlgorithm,
        keyId: protector.keyId,
        signingKeyId: protector.signingKeyId,
        minimumRestoreSequence: rollbackPolicy.minimumSequence,
        trustedCheckpointDigestConfigured: Boolean(rollbackPolicy.trustedDigest),
        keyValueExposed: false,
      },
    };
  } catch (error) {
    return {
      status: "blocked",
      protector: null,
      rollbackPolicy: rollbackPolicy ?? { minimumSequence: 0, trustedDigest: null },
      error,
      summary: {
        configured: false,
        encryption: "aes-256-gcm",
        manifestSignature: "ed25519",
        blocker: typeof error?.code === "string" ? error.code : "ENTERPRISE_BACKUP_CONFIGURATION_INVALID",
        keyValueExposed: false,
      },
    };
  }
}

function requireBackupProtector(backupSecurity) {
  if (backupSecurity.protector) return backupSecurity.protector;
  throw backupSecurity.error ?? enterpriseBackupError(
    "ENTERPRISE_BACKUP_PROTECTION_UNAVAILABLE",
    "Enterprise backup protection is unavailable.",
  );
}

function readRollbackPolicy(env) {
  const rawSequence = String(env.PME_ENTERPRISE_BACKUP_MIN_RESTORE_SEQUENCE ?? "0").trim();
  if (!/^\d+$/.test(rawSequence)) {
    throw enterpriseBackupError("ENTERPRISE_BACKUP_ROLLBACK_FLOOR_INVALID", "Backup minimum restore sequence must be a non-negative integer.");
  }
  const minimumSequence = Number(rawSequence);
  if (!Number.isSafeInteger(minimumSequence) || minimumSequence < 0) {
    throw enterpriseBackupError("ENTERPRISE_BACKUP_ROLLBACK_FLOOR_INVALID", "Backup minimum restore sequence is outside the supported range.");
  }
  const trustedDigest = String(env.PME_ENTERPRISE_BACKUP_TRUSTED_CHECKPOINT_DIGEST ?? "").trim().toLowerCase() || null;
  if (trustedDigest && (!/^[a-f0-9]{64}$/.test(trustedDigest) || minimumSequence < 1)) {
    throw enterpriseBackupError(
      "ENTERPRISE_BACKUP_TRUSTED_CHECKPOINT_INVALID",
      "A trusted checkpoint digest requires a positive restore sequence and a SHA-256 digest.",
    );
  }
  return { minimumSequence, trustedDigest };
}

function resolveBackupAnchor(checkpoint, rollbackPolicy) {
  if (rollbackPolicy.minimumSequence > checkpoint.sequence) {
    return { sequence: rollbackPolicy.minimumSequence, artifactDigest: rollbackPolicy.trustedDigest };
  }
  if (rollbackPolicy.minimumSequence === checkpoint.sequence && rollbackPolicy.trustedDigest &&
      checkpoint.artifactDigest && rollbackPolicy.trustedDigest !== checkpoint.artifactDigest) {
    throw enterpriseBackupError("ENTERPRISE_BACKUP_TRUSTED_CHECKPOINT_MISMATCH", "Configured backup checkpoint does not match local signed state.");
  }
  return checkpoint;
}

function evaluateRollbackPolicy({ opened, checkpoint, rollbackPolicy, blockers, warnings }) {
  const sequence = opened.envelope.sequence;
  const localFloor = checkpoint.sequence;
  const configuredFloor = rollbackPolicy.minimumSequence;
  const floor = Math.max(localFloor, configuredFloor);
  if (sequence < floor) {
    blockers.push("backup_rollback_detected");
    return;
  }
  const expectedFloorDigest = configuredFloor >= localFloor
    ? rollbackPolicy.trustedDigest
    : checkpoint.artifactDigest;
  if (sequence === floor && expectedFloorDigest && opened.artifactDigest !== expectedFloorDigest) {
    blockers.push("backup_checkpoint_digest_mismatch");
  }
  if (sequence === checkpoint.sequence && checkpoint.artifactDigest && opened.artifactDigest !== checkpoint.artifactDigest) {
    blockers.push("backup_checkpoint_digest_mismatch");
  }
  if (sequence === checkpoint.sequence + 1 && checkpoint.artifactDigest &&
      opened.envelope.previousBackupDigest !== checkpoint.artifactDigest) {
    blockers.push("backup_chain_mismatch");
  } else if (sequence > checkpoint.sequence + 1) {
    warnings.push("backup_chain_gap_requires_external_checkpoint");
  }
}

async function readBackupCheckpoint({ checkpointDir, tenantId, protector }) {
  const checkpointPath = resolveCheckpointPath(checkpointDir, tenantId);
  if (!existsSync(checkpointPath)) return { sequence: 0, artifactDigest: null };
  const parsed = await readBoundedJsonInside(checkpointPath, checkpointDir, MAX_CHECKPOINT_FILE_BYTES);
  const checkpoint = protector.openCheckpoint(parsed, tenantId);
  return { sequence: checkpoint.sequence, artifactDigest: checkpoint.artifactDigest };
}

function resolveCheckpointPath(checkpointDir, tenantId) {
  return resolve(checkpointDir, `${createEnterpriseBackupTenantBinding(tenantId)}.checkpoint.json`);
}

async function writePrivateFileAtomic(targetPath, content) {
  await hardenPrivateDirectory(dirname(targetPath));
  const temporaryPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(content, { encoding: "utf8" });
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporaryPath, targetPath);
    await chmod(targetPath, 0o600).catch(() => undefined);
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function hardenPrivateDirectory(directoryPath) {
  await mkdir(directoryPath, { recursive: true, mode: 0o700 });
  await chmod(directoryPath, 0o700).catch(() => undefined);
}

async function readBoundedJsonInside(filePath, rootPath, maximumBytes) {
  const linkStats = await lstat(filePath);
  if (!linkStats.isFile() || linkStats.isSymbolicLink()) {
    throw enterpriseBackupError("ENTERPRISE_BACKUP_FILE_TYPE_INVALID", "Enterprise backup files must be regular non-symbolic files.");
  }
  const [canonicalFile, canonicalRoot] = await Promise.all([realpath(filePath), realpath(rootPath)]);
  if (!isPathInside(canonicalFile, canonicalRoot)) {
    throw enterpriseBackupError("ENTERPRISE_BACKUP_PATH_ESCAPE", "Enterprise backup file resolves outside its configured directory.");
  }
  const handle = await open(canonicalFile, "r");
  try {
    const fileStats = await handle.stat();
    if (!fileStats.isFile() || fileStats.size <= 0 || fileStats.size > maximumBytes) {
      throw enterpriseBackupError("ENTERPRISE_BACKUP_FILE_SIZE_INVALID", "Enterprise backup file size is invalid.");
    }
    return JSON.parse(await handle.readFile({ encoding: "utf8" }));
  } catch (error) {
    if (isEnterpriseBackupProtectionError(error) || error?.code?.startsWith?.("ENTERPRISE_BACKUP_")) throw error;
    throw enterpriseBackupError("ENTERPRISE_BACKUP_JSON_INVALID", "Enterprise backup JSON is invalid.");
  } finally {
    await handle.close();
  }
}

function createSerialExecutor() {
  let tail = Promise.resolve();
  return (operation) => {
    const result = tail.then(operation, operation);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}

function mapBackupErrorToBlocker(error, fallback) {
  const code = typeof error?.code === "string" ? error.code : "";
  if (code.includes("TENANT_MISMATCH")) return "backup_tenant_mismatch";
  if (code.includes("KEY_MISMATCH")) return "backup_key_mismatch";
  if (code.includes("SIGNATURE_INVALID")) return code.includes("CHECKPOINT") ? "backup_checkpoint_invalid" : "backup_signature_invalid";
  if (code.includes("AUTHENTICATION_FAILED")) return "backup_authentication_failed";
  if (code.includes("CHECKPOINT")) return "backup_checkpoint_invalid";
  if (code.includes("ENVELOPE") || code.includes("JSON") || code.includes("ENCODING") || code.includes("FILE_")) return "backup_envelope_invalid";
  return fallback;
}

function enterpriseBackupError(code, message) {
  return Object.assign(new Error(message), { code, category: "security", retryable: false });
}

function resolveBackupPath(inputPath, backupDir) {
  if (typeof inputPath !== "string" || !inputPath.trim()) {
    const error = new Error("Enterprise restore validation requires backupPath.");
    error.code = "enterprise_backup_path_required";
    error.category = "validation";
    throw error;
  }

  const resolved = resolve(inputPath);
  if (!isPathInside(resolved, backupDir)) {
    const error = new Error("Enterprise restore validation only accepts backups inside the configured backup directory.");
    error.code = "enterprise_backup_path_outside_backup_dir";
    error.category = "validation";
    throw error;
  }

  return resolved;
}

function isPathInside(targetPath, rootPath) {
  const normalizedRoot = resolve(rootPath);
  const normalizedTarget = resolve(targetPath);
  const rel = relative(normalizedRoot, normalizedTarget);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function hasRawTokenKey(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.some(hasRawTokenKey);
  }

  for (const [key, nested] of Object.entries(value)) {
    if (key === "token" || key === "tokenValue") {
      return true;
    }

    if (hasRawTokenKey(nested)) {
      return true;
    }
  }

  return false;
}

function sanitizeIdentity(identity) {
  return {
    userId: identity.userId,
    tenantId: identity.tenantId,
    role: identity.role,
  };
}
