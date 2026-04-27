import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";

const BACKUP_TYPE = "pme-enterprise-backup";
const BACKUP_VERSION = 1;
const DEFAULT_BACKUP_DIR = ".data/enterprise/backups";

export function createEnterpriseOpsService({ env = {}, config, enterpriseGovernanceService, knowledgeInfra, knowledgeService } = {}) {
  const backupDir = resolve(env.PME_ENTERPRISE_BACKUP_DIR ?? DEFAULT_BACKUP_DIR);

  return {
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
          mode: "json-file",
          directory: backupDir,
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
      await mkdir(backupDir, { recursive: true });
      const now = new Date().toISOString();
      const backupId = `pme-enterprise-backup-${now.replace(/[:.]/g, "-")}`;
      const backupPath = resolve(backupDir, `${backupId}.json`);
      const auditExport = await enterpriseGovernanceService.exportAudit({
        limit: input.auditLimit ?? 1000,
        format: "json",
      });
      const auditEntries = JSON.parse(auditExport.content || "[]");
      const body = {
        type: BACKUP_TYPE,
        version: BACKUP_VERSION,
        backupId,
        generatedAt: now,
        generatedBy: actorIdentity ? sanitizeIdentity(actorIdentity) : null,
        reason: typeof input.reason === "string" && input.reason.trim() ? input.reason.trim() : "manual-enterprise-backup",
        tokenValuesExposed: false,
        readiness: this.getReadiness(),
        enterpriseUsers: enterpriseGovernanceService.exportUsersForBackup(),
        audit: {
          path: auditExport.auditLogPath,
          format: "json",
          entryCount: auditEntries.length,
          entries: auditEntries,
        },
        knowledge: {
          health: knowledgeService.getHealth(),
          infraReadiness: knowledgeInfra.getReadiness(),
        },
      };

      await writeFile(backupPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
      const stats = await stat(backupPath);

      return {
        status: "ready",
        mode: "enterprise-backup-json-file",
        backupId,
        backupPath,
        backupFileName: basename(backupPath),
        byteSize: stats.size,
        generatedAt: now,
        tokenValuesExposed: false,
        managedStoredUserCount: body.enterpriseUsers.storedUsers.length,
        auditEntryCount: auditEntries.length,
        knowledgeDocumentCount: body.knowledge.health.documentCount,
      };
    },

    async validateRestore(input = {}) {
      const backupPath = resolveBackupPath(input.backupPath, backupDir);
      const blockers = [];
      const warnings = [];

      if (!existsSync(backupPath)) {
        blockers.push("backup_file_not_found");
        return createRestoreValidation({ backupPath, blockers, warnings });
      }

      let parsed;
      try {
        parsed = JSON.parse(await readFile(backupPath, "utf8"));
      } catch {
        blockers.push("backup_json_invalid");
        return createRestoreValidation({ backupPath, blockers, warnings });
      }

      if (parsed.type !== BACKUP_TYPE) {
        blockers.push("backup_type_invalid");
      }

      if (parsed.version !== BACKUP_VERSION) {
        blockers.push("backup_version_invalid");
      }

      if (hasRawTokenKey(parsed)) {
        blockers.push("backup_contains_raw_token_key");
      }

      if (!Array.isArray(parsed.enterpriseUsers?.storedUsers)) {
        blockers.push("backup_enterprise_users_missing");
      }

      if (!Array.isArray(parsed.audit?.entries)) {
        warnings.push("backup_audit_entries_missing");
      }

      return createRestoreValidation({
        backupPath,
        blockers,
        warnings,
        backup: parsed,
      });
    },
  };
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

function createRestoreValidation({ backupPath, blockers, warnings, backup }) {
  return {
    status: blockers.length ? "blocked" : warnings.length ? "warning" : "ready",
    mode: "restore-validate-only",
    valid: blockers.length === 0,
    mutation: "none",
    backupPath,
    backupId: backup?.backupId ?? null,
    generatedAt: backup?.generatedAt ?? null,
    storedUserCount: backup?.enterpriseUsers?.storedUsers?.length ?? 0,
    auditEntryCount: backup?.audit?.entries?.length ?? 0,
    knowledgeDocumentCount: backup?.knowledge?.health?.documentCount ?? 0,
    tokenValuesExposed: false,
    blockers,
    warnings,
  };
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
