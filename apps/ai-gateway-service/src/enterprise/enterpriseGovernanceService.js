import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  DEFAULT_ROLES,
  addStoredUser,
  createSanitizedUsers,
  findStoredUser,
  hashToken,
  loadStoredUsers as jsonLoadStoredUsers,
  normalizeStoredUser,
  parseUsers,
  sanitizeIdentity,
  sanitizeUser,
  saveStoredUsers as jsonSaveStoredUsers,
} from "./enterpriseUserStore.js";
import { createSqliteUserStoreBackend } from "./enterpriseUserStore-sqlite.js";
import { createApiKeyManager } from "./apiKeyManager.js";
import {
  assertEnterpriseTenantAccess,
  requireEnterpriseTenantId,
} from "./enterpriseTenantPolicy.ts";
import {
  filterAuditEntries,
  readAuditFile,
  sanitizeAuditFilters,
} from "./enterpriseAuditHelpers.js";
import {
  assertAuthenticatedNetworkBinding,
  isLoopbackAddress,
} from "../security/networkBindingPolicy.ts";
import {
  LOCAL_UNAUTHENTICATED_PERMISSION,
  LOCAL_UNAUTHENTICATED_ROLE,
  authorizeLocalUnauthenticatedRequest,
  createLocalUnauthenticatedPreviewConfig,
} from "../security/localUnauthenticatedAccessPolicy.ts";

const DEFAULT_AUDIT_LIMIT = 200;

export function createEnterpriseGovernanceService({ env = {}, auditLogPath } = {}) {
  const authEnabled = readBoolean(env.PME_ENTERPRISE_AUTH_ENABLED, Boolean(env.PME_AUTH_TOKEN || env.PME_ENTERPRISE_USERS_JSON || env.PME_ENTERPRISE_USER_STORE_PATH));
  assertAuthenticatedNetworkBinding({
    host: env.AI_GATEWAY_SERVICE_HOST ?? "127.0.0.1",
    authEnabled,
  });
  const localPreview = createLocalUnauthenticatedPreviewConfig(env);
  const userStorePath = env.PME_ENTERPRISE_USER_STORE_PATH ?? resolve(".data/enterprise/users.json");
  // Storage backend: "sqlite" uses node:sqlite (ACID + cross-process safe),
  // default "json" keeps the original file backend (backwards compatible).
  const userStoreBackend = env.PME_ENTERPRISE_USER_STORE_MODE === "sqlite"
    ? createSqliteUserStoreBackend(userStorePath)
    : null;
  const loadStoredUsers = userStoreBackend ? userStoreBackend.loadStoredUsers : jsonLoadStoredUsers;
  const saveStoredUsers = userStoreBackend ? userStoreBackend.saveStoredUsers : jsonSaveStoredUsers;
  const users = parseUsers(env);
  const storedUsers = loadStoredUsers(userStorePath);
  for (const user of storedUsers) {
    addStoredUser(users, user);
  }
  const revokedTokens = parseRevokedTokens(env.PME_ENTERPRISE_REVOKED_TOKENS);
  // 虚拟 key（uai- 前缀）：SHA-256 落盘于 .data/enterprise/api-keys.json
  const apiKeyStorePath = env.PME_API_KEY_STORE_PATH ?? resolve(".data/enterprise/api-keys.json");
  const apiKeyManager = createApiKeyManager({ storePath: apiKeyStorePath });
  const auditPath = auditLogPath ?? env.PME_AUDIT_LOG_PATH ?? resolve(".data/audit/enterprise-audit.jsonl");
  const auditEntries = [];

  return {
    getHealth() {
      return {
        status: "ready",
        mode: "local-enterprise-governance",
        authEnabled,
        unauthenticatedScope: authEnabled
          ? "none"
          : localPreview.enabled
            ? "loopback-fake-preview-only"
            : "public-routes-only",
        localPreview,
        tenantMode: "credential-bound-header-must-match",
        tokenHeaders: ["x-pme-auth-token", "authorization: Bearer"],
        tenantHeader: "x-pme-tenant-id",
        roles: Object.keys(DEFAULT_ROLES),
        security: createSecuritySummary({ authEnabled, users, revokedTokens }),
        userStore: {
          mode: "env-plus-json-file",
          path: userStorePath,
          storedUserCount: storedUsers.length,
        },
        apiKeys: apiKeyManager.getHealth(),
        audit: {
          mode: "jsonl-file",
          path: auditPath,
          inMemoryEntryCount: auditEntries.length,
        },
      };
    },

    getPublicHealth() {
      return {
        status: "ready",
        mode: "local-enterprise-governance",
        authEnabled,
        unauthenticatedScope: authEnabled
          ? "none"
          : localPreview.enabled
            ? "loopback-fake-preview-only"
            : "public-routes-only",
        localPreview: {
          enabled: localPreview.enabled,
          routePolicy: localPreview.routePolicy,
        },
        tenantMode: "credential-bound-header-must-match",
        userStore: {
          configured: Boolean(userStorePath),
          pathExposed: false,
        },
        apiKeys: {
          configured: Boolean(apiKeyStorePath),
          pathExposed: false,
        },
        audit: {
          configured: Boolean(auditPath),
          pathExposed: false,
        },
      };
    },

    getSecurityReadiness() {
      return createSecurityReadiness({
        authEnabled,
        users,
        revokedTokens,
        userStorePath,
        auditPath,
        localPreview,
      });
    },

    listUsers(actorIdentity) {
      const tenantId = requireEnterpriseTenantId(actorIdentity);
      return {
        status: "ready",
        mode: "env-plus-json-file",
        tenantId,
        pathExposed: false,
        users: createSanitizedUsers(users).filter((user) => user.tenantId === tenantId),
      };
    },

    getApiKeyManager() {
      return apiKeyManager;
    },

    exportUsersForBackup(actorIdentity) {
      const tenantId = requireEnterpriseTenantId(actorIdentity);
      return {
        status: "ready",
        mode: "env-plus-json-file",
        tenantId,
        pathExposed: false,
        tokenStorage: "sha256-hash-only",
        tokenValuesExposed: false,
        configuredUsers: createSanitizedUsers(users).filter((user) => user.tenantId === tenantId),
        storedUsers: storedUsers.filter((user) => user.tenantId === tenantId).map((user) => ({
          userId: user.userId,
          tenantId: user.tenantId,
          role: user.role,
          permissions: user.permissions,
          tokenHash: user.tokenHash,
          tokenFingerprint: user.tokenFingerprint,
          tokenHashExposed: true,
          tokenValueExposed: false,
          expiresAt: user.expiresAt ?? null,
          revoked: Boolean(user.revoked),
          createdAt: user.createdAt ?? null,
          updatedAt: user.updatedAt ?? null,
        })),
      };
    },

    upsertUser(input = {}, actorIdentity) {
      const tenantId = assertEnterpriseTenantAccess(
        actorIdentity,
        input.tenantId,
        "enterprise_user_tenant_forbidden",
      );
      const existing = findStoredUser(storedUsers, input);
      if (existing) {
        assertEnterpriseTenantAccess(
          actorIdentity,
          existing.tenantId,
          "enterprise_user_tenant_forbidden",
        );
      }
      const normalized = normalizeStoredUser({ ...input, tenantId }, existing);
      const index = storedUsers.findIndex((user) => user.userId === normalized.userId);
      if (index >= 0) {
        storedUsers[index] = normalized;
      } else {
        storedUsers.push(normalized);
      }

      if (userStoreBackend) {
        userStoreBackend.upsert(normalized);
      } else {
        saveStoredUsers(userStorePath, storedUsers);
      }
      addStoredUser(users, normalized);

      return {
        status: "ready",
        action: index >= 0 ? "updated" : "created",
        user: sanitizeUser(users.get(normalized.tokenHash)),
        actor: actorIdentity ? sanitizeIdentity(actorIdentity) : null,
      };
    },

    revokeUser(input = {}, actorIdentity) {
      const tenantId = requireEnterpriseTenantId(actorIdentity);
      const target = findStoredUser(storedUsers, input);
      if (!target || target.tenantId !== tenantId) {
        const error = new Error("Enterprise user was not found in the managed user store.");
        error.code = "enterprise_user_not_found";
        error.category = "validation";
        throw error;
      }

      target.revoked = true;
      target.updatedAt = new Date().toISOString();
      if (userStoreBackend) {
        userStoreBackend.upsert(target);
      } else {
        saveStoredUsers(userStorePath, storedUsers);
      }
      addStoredUser(users, target);

      return {
        status: "ready",
        action: "revoked",
        user: sanitizeUser(users.get(target.tokenHash)),
        actor: actorIdentity ? sanitizeIdentity(actorIdentity) : null,
      };
    },

    listRoles() {
      return {
        roles: Object.entries(DEFAULT_ROLES).map(([role, permissions]) => ({
          role,
          permissions,
        })),
      };
    },

    authenticate(request) {
      if (!authEnabled) {
        const remoteAddress = request?.socket?.remoteAddress;
        if (remoteAddress && !isLoopbackAddress(remoteAddress)) {
          return {
            authenticated: false,
            statusCode: 401,
            code: "enterprise_auth_required_for_remote_peer",
            message: "Enterprise authentication is required for non-loopback clients.",
          };
        }
        return {
          authenticated: true,
          disabled: true,
          identity: createIdentity({
            userId: "local-preview",
            tenantId: "local-preview",
            role: LOCAL_UNAUTHENTICATED_ROLE,
            permissions: [LOCAL_UNAUTHENTICATED_PERMISSION],
          }),
        };
      }

      const token = readToken(request);
      const tokenHash = token ? hashToken(token) : null;
      let configured = tokenHash ? users.get(tokenHash) : null;

      // 虚拟 key（uai- 前缀）不在静态用户表里：经 apiKeyManager 验证后
      // 拼装成同构身份，下游（角色权限/租户/审计）行为与普通用户一致。
      if (!configured && token && token.startsWith("uai-")) {
        const virtualKey = apiKeyManager.validate(token);
        if (!virtualKey.valid) {
          return {
            authenticated: false,
            statusCode: 401,
            code: `enterprise_${virtualKey.error ?? "auth_required"}`,
            message: "A valid enterprise auth token is required.",
          };
        }
        const role = virtualKey.record.role;
        configured = {
          tokenHash,
          tokenFingerprint: virtualKey.record.keyFingerprint,
          source: "api-key",
          userId: `api-key:${virtualKey.record.keyFingerprint}`,
          tenantId: virtualKey.record.tenantId,
          role,
          permissions: Array.isArray(DEFAULT_ROLES[role]) ? DEFAULT_ROLES[role] : [],
          expiresAt: virtualKey.record.expiresAt,
          revoked: false,
          apiKeyFingerprint: virtualKey.record.keyFingerprint,
        };
      }

      if (!configured) {
        return {
          authenticated: false,
          statusCode: 401,
          code: "enterprise_auth_required",
          message: "A valid enterprise auth token is required.",
        };
      }

      if (configured.revoked || revokedTokens.has(token) || revokedTokens.has(tokenHash)) {
        return {
          authenticated: false,
          statusCode: 401,
          code: "enterprise_token_revoked",
          message: "The enterprise auth token has been revoked.",
        };
      }

      if (configured.expiresAt && Date.parse(configured.expiresAt) <= Date.now()) {
        return {
          authenticated: false,
          statusCode: 401,
          code: "enterprise_token_expired",
          message: "The enterprise auth token has expired.",
        };
      }

      const requestedTenantId = readTenantHeader(request) ?? configured.tenantId;
      const identity = createIdentity({
        ...configured,
        tenantId: configured.tenantId,
      });

      if (requestedTenantId !== configured.tenantId) {
        return {
          authenticated: false,
          statusCode: 403,
          code: "enterprise_tenant_forbidden",
          message: "The token is not allowed to access the requested tenant.",
          identity,
        };
      }

      return {
        authenticated: true,
        identity,
      };
    },

    authorize(request, permission) {
      const auth = this.authenticate(request);

      if (!auth.authenticated) {
        return {
          allowed: false,
          statusCode: auth.statusCode ?? 401,
          code: auth.code ?? "enterprise_auth_required",
          message: auth.message ?? "Enterprise authorization failed.",
          identity: auth.identity,
          permission,
        };
      }

      if (auth.disabled) {
        const localDecision = authorizeLocalUnauthenticatedRequest({
          request,
          permission,
          previewEnabled: localPreview.enabled,
        });
        if (!localDecision.allowed) {
          return {
            allowed: false,
            statusCode: 403,
            code: localDecision.code,
            message: localDecision.code === "enterprise_auth_required_for_non_fake_mode"
              ? "Enterprise authentication is required when the gateway is not in fake-only preview mode."
              : "Unauthenticated local preview is not allowed to access this route.",
            identity: auth.identity,
            permission,
          };
        }

        return {
          allowed: true,
          identity: auth.identity,
          permission,
        };
      }

      const allowed = isPermissionAllowed(auth.identity.permissions, permission);

      if (!allowed) {
        return {
          allowed: false,
          statusCode: 403,
          code: "enterprise_permission_forbidden",
          message: `The current role is not allowed to perform ${permission}.`,
          identity: auth.identity,
          permission,
        };
      }

      return {
        allowed: true,
        identity: auth.identity,
        permission,
      };
    },

    async recordAudit(event = {}) {
      const entry = {
        id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        outcome: event.outcome ?? "unknown",
        method: event.method,
        path: event.path,
        permission: event.permission,
        statusCode: event.statusCode,
        code: event.code,
        userId: event.identity?.userId ?? null,
        tenantId: event.identity?.tenantId ?? null,
        role: event.identity?.role ?? null,
        details: event.details ?? {},
      };

      auditEntries.push(entry);
      if (auditEntries.length > DEFAULT_AUDIT_LIMIT) {
        auditEntries.splice(0, auditEntries.length - DEFAULT_AUDIT_LIMIT);
      }

      await mkdir(dirname(auditPath), { recursive: true });
      await appendFile(auditPath, `${JSON.stringify(entry)}\n`, "utf8");
      return entry;
    },

    async listAudit({ limit = 50, filters = {}, actorIdentity } = {}) {
      const scopedFilters = createTenantScopedAuditFilters(filters, actorIdentity);
      const boundedLimit = Math.min(200, Math.max(1, Number(limit) || 50));
      const fileEntries = await readAuditFile(auditPath);
      const entries = filterAuditEntries(fileEntries.length ? fileEntries : auditEntries, scopedFilters);
      return {
        status: "ready",
        tenantId: scopedFilters.tenantId,
        pathExposed: false,
        filters: sanitizeAuditFilters(scopedFilters),
        totalMatched: entries.length,
        entries: entries.slice(-boundedLimit).reverse(),
      };
    },

    async exportAudit({ limit = 200, format = "jsonl", filters = {}, actorIdentity } = {}) {
      const scopedFilters = createTenantScopedAuditFilters(filters, actorIdentity);
      const boundedLimit = Math.min(1000, Math.max(1, Number(limit) || 200));
      const fileEntries = await readAuditFile(auditPath);
      const entries = filterAuditEntries(fileEntries.length ? fileEntries : auditEntries, scopedFilters).slice(-boundedLimit);
      const normalizedFormat = format === "json" ? "json" : "jsonl";
      return {
        status: "ready",
        tenantId: scopedFilters.tenantId,
        pathExposed: false,
        format: normalizedFormat,
        contentType: normalizedFormat === "json" ? "application/json" : "application/x-ndjson",
        filters: sanitizeAuditFilters(scopedFilters),
        entryCount: entries.length,
        content: normalizedFormat === "json" ? JSON.stringify(entries, null, 2) : entries.map((entry) => JSON.stringify(entry)).join("\n"),
      };
    },
  };
}

function createTenantScopedAuditFilters(filters, actorIdentity) {
  const candidate = filters && typeof filters === "object" ? filters : {};
  const tenantId = assertEnterpriseTenantAccess(
    actorIdentity,
    candidate.tenantId,
    "enterprise_audit_tenant_forbidden",
  );
  return { ...candidate, tenantId };
}

function createIdentity({ userId, tenantId, role, permissions, apiKeyFingerprint }) {
  return {
    userId,
    tenantId,
    role,
    permissions,
    ...(apiKeyFingerprint ? { apiKeyFingerprint } : {}),
  };
}

function readToken(request) {
  const headerToken = request.headers["x-pme-auth-token"];
  if (typeof headerToken === "string" && headerToken.trim()) {
    return headerToken.trim();
  }

  const bearer = String(request.headers.authorization ?? "").replace(/^Bearer\s+/i, "").trim();
  return bearer || null;
}

function readTenantHeader(request) {
  const tenantId = request.headers["x-pme-tenant-id"];
  return typeof tenantId === "string" && tenantId.trim() ? tenantId.trim() : null;
}

function isPermissionAllowed(permissions = [], permission) {
  return permissions.includes("*") || permissions.includes(permission);
}

function createSecuritySummary({ authEnabled, users, revokedTokens }) {
  return {
    tokenExpirySupported: true,
    tokenRevocationSupported: true,
    configuredUserCount: users.size,
    revokedTokenCount: revokedTokens.size + [...users.values()].filter((user) => user.revoked).length,
    activeConfiguredUserCount: [...users.values()].filter((user) => !isUserRevoked(user, revokedTokens) && !isExpired(user.expiresAt)).length,
  };
}

function createSecurityReadiness({ authEnabled, users, revokedTokens, userStorePath, auditPath, localPreview }) {
  const configuredUsers = [...users.values()];
  const blockers = [];
  const warnings = [];

  if (authEnabled && users.size === 0) {
    blockers.push("auth_enabled_without_users");
  }

  if (!authEnabled) {
    warnings.push("enterprise_auth_disabled");
    warnings.push(localPreview.enabled ? "local_fake_preview_only" : "unauthenticated_protocol_preview_disabled");
  }

  const activeUsers = configuredUsers.filter((user) => !isUserRevoked(user, revokedTokens) && !isExpired(user.expiresAt));
  const usersWithoutExpiry = activeUsers.filter((user) => !user.expiresAt);
  const expiredUsers = configuredUsers.filter((user) => isExpired(user.expiresAt));
  const revokedUsers = configuredUsers.filter((user) => isUserRevoked(user, revokedTokens));

  if (authEnabled && usersWithoutExpiry.length > 0) {
    warnings.push("active_tokens_without_expiry");
  }

  if (authEnabled && activeUsers.length === 0) {
    blockers.push("no_active_enterprise_tokens");
  }

  return {
    status: blockers.length ? "blocked" : warnings.length ? "warning" : "ready",
    authEnabled,
    localPreview,
    userStore: {
      mode: "env-plus-json-file",
      pathConfigured: Boolean(userStorePath),
      pathExposed: false,
      configuredUserCount: configuredUsers.length,
      activeUserCount: activeUsers.length,
      expiredUserCount: expiredUsers.length,
      revokedUserCount: revokedUsers.length + revokedTokens.size,
      usersWithoutExpiryCount: usersWithoutExpiry.length,
    },
    tokenPolicy: {
      expirySupported: true,
      revocationSupported: true,
      tokenValuesExposed: false,
      acceptedHeaders: ["x-pme-auth-token", "authorization: Bearer"],
      tenantHeader: "x-pme-tenant-id",
      tenantHeaderPolicy: "optional-must-match-credential",
    },
    audit: {
      mode: "jsonl-file",
      pathConfigured: Boolean(auditPath),
      pathExposed: false,
    },
    blockers,
    warnings,
  };
}

function parseRevokedTokens(value) {
  const revoked = new Set();
  for (const raw of String(value ?? "").split(",")) {
    const token = raw.trim();
    if (!token) continue;
    // Register both the literal and its hash so revocation lists written
    // with raw tokens keep working now that users are keyed by hash.
    revoked.add(token);
    revoked.add(hashToken(token));
  }
  return revoked;
}

function isUserRevoked(user, revokedTokens) {
  return Boolean(user.revoked || revokedTokens.has(user.token) || revokedTokens.has(user.tokenHash));
}

function isExpired(expiresAt) {
  if (!expiresAt) {
    return false;
  }

  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

function readBoolean(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }

  return value === "1" || String(value).toLowerCase() === "true";
}
