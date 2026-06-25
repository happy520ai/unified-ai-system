import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  DEFAULT_ROLES,
  parseUsers,
  addUser,
  addStoredUser,
  normalizeStoredUser,
  findStoredUser,
  loadStoredUsers,
  saveStoredUsers,
  createSanitizedUsers,
  sanitizeUser,
  sanitizeIdentity,
  hashToken,
} from "./enterpriseUserStore.js";
import { readAuditFile, filterAuditEntries, sanitizeAuditFilters } from "./enterpriseAuditHelpers.js";

const DEFAULT_AUDIT_LIMIT = 200;

export function createEnterpriseGovernanceService({ env = {}, auditLogPath, auditHashChain = null, revocationStore = null } = {}) {
  const authEnabled = readBoolean(env.PME_ENTERPRISE_AUTH_ENABLED, Boolean(env.PME_AUTH_TOKEN || env.PME_ENTERPRISE_USERS_JSON || env.PME_ENTERPRISE_USER_STORE_PATH));
  const userStorePath = env.PME_ENTERPRISE_USER_STORE_PATH ?? resolve(".data/enterprise/users.json");
  const users = parseUsers(env);
  const storedUsers = loadStoredUsers(userStorePath);
  for (const user of storedUsers) {
    addStoredUser(users, user);
  }
  const revokedTokens = parseRevokedTokens(env.PME_ENTERPRISE_REVOKED_TOKENS);
  const auditPath = auditLogPath ?? env.PME_AUDIT_LOG_PATH ?? resolve(".data/audit/enterprise-audit.jsonl");
  const auditEntries = [];

  return {
    getHealth() {
      return {
        status: "ready",
        mode: "local-enterprise-governance",
        authEnabled,
        tenantMode: "header-required-when-auth-enabled",
        tokenHeaders: ["x-pme-auth-token", "authorization: Bearer"],
        tenantHeader: "x-pme-tenant-id",
        roles: Object.keys(DEFAULT_ROLES),
        security: createSecuritySummary({ authEnabled, users, revokedTokens }),
        userStore: {
          mode: "env-plus-json-file",
          path: userStorePath,
          storedUserCount: storedUsers.length,
        },
        audit: {
          mode: "jsonl-file",
          path: auditPath,
          inMemoryEntryCount: auditEntries.length,
          hashChain: auditHashChain ? { enabled: true, entryCount: auditHashChain.getEntryCount(), lastHash: auditHashChain.getLastHash().slice(0, 12) } : { enabled: false },
        },
        revocationStore: revocationStore ? { enabled: true, ...revocationStore.getStats() } : { enabled: false },
      };
    },

    getSecurityReadiness() {
      return createSecurityReadiness({
        authEnabled,
        users,
        revokedTokens,
        userStorePath,
        auditPath,
      });
    },

    listUsers() {
      return {
        status: "ready",
        mode: "env-plus-json-file",
        path: userStorePath,
        users: createSanitizedUsers(users),
      };
    },

    exportUsersForBackup() {
      return {
        status: "ready",
        mode: "env-plus-json-file",
        path: userStorePath,
        tokenStorage: "sha256-hash-only",
        tokenValuesExposed: false,
        configuredUsers: createSanitizedUsers(users),
        storedUsers: storedUsers.map((user) => ({
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
      const normalized = normalizeStoredUser(input, findStoredUser(storedUsers, input));
      const index = storedUsers.findIndex((user) => user.userId === normalized.userId);
      if (index >= 0) {
        storedUsers[index] = normalized;
      } else {
        storedUsers.push(normalized);
      }

      saveStoredUsers(userStorePath, storedUsers);
      addStoredUser(users, normalized);

      return {
        status: "ready",
        action: index >= 0 ? "updated" : "created",
        user: sanitizeUser(users.get(normalized.tokenHash)),
        actor: actorIdentity ? sanitizeIdentity(actorIdentity) : null,
      };
    },

    async revokeUser(input = {}, actorIdentity) {
      const target = findStoredUser(storedUsers, input);
      if (!target) {
        const error = new Error("Enterprise user was not found in the managed user store.");
        error.code = "enterprise_user_not_found";
        error.category = "validation";
        throw error;
      }

      target.revoked = true;
      target.updatedAt = new Date().toISOString();
      saveStoredUsers(userStorePath, storedUsers);
      addStoredUser(users, target);

      if (revocationStore) {
        await revocationStore.revoke(target.tokenHash, {
          source: "enterprise_user",
          revokedBy: actorIdentity?.userId ?? "system",
          reason: "enterprise_user_revoked",
        });
      }

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
        return {
          authenticated: true,
          disabled: true,
          identity: createIdentity({
            userId: "local-system",
            tenantId: readTenantHeader(request) ?? "default",
            role: "admin",
            permissions: ["*"],
          }),
        };
      }

      const token = readToken(request);
      const tokenHash = token ? hashToken(token) : null;
      const configured = token ? users.get(token) ?? users.get(tokenHash) : null;

      if (!configured) {
        return {
          authenticated: false,
          statusCode: 401,
          code: "enterprise_auth_required",
          message: "A valid enterprise auth token is required.",
        };
      }

      if (configured.revoked || revokedTokens.has(token) || revokedTokens.has(tokenHash) || (revocationStore && revocationStore.isRevoked(token))) {
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
        tenantId: requestedTenantId,
      });

      if (configured.role !== "admin" && requestedTenantId !== configured.tenantId) {
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
      if (auditHashChain) {
        await auditHashChain.append(entry);
      }
      return entry;
    },

    async listAudit({ limit = 50, filters = {} } = {}) {
      const boundedLimit = Math.min(200, Math.max(1, Number(limit) || 50));
      const fileEntries = await readAuditFile(auditPath);
      const entries = filterAuditEntries(fileEntries.length ? fileEntries : auditEntries, filters);
      return {
        status: "ready",
        auditLogPath: auditPath,
        filters: sanitizeAuditFilters(filters),
        totalMatched: entries.length,
        entries: entries.slice(-boundedLimit).reverse(),
      };
    },

    async exportAudit({ limit = 200, format = "jsonl", filters = {} } = {}) {
      const boundedLimit = Math.min(1000, Math.max(1, Number(limit) || 200));
      const fileEntries = await readAuditFile(auditPath);
      const entries = filterAuditEntries(fileEntries.length ? fileEntries : auditEntries, filters).slice(-boundedLimit);
      const normalizedFormat = format === "json" ? "json" : "jsonl";
      return {
        status: "ready",
        auditLogPath: auditPath,
        format: normalizedFormat,
        contentType: normalizedFormat === "json" ? "application/json" : "application/x-ndjson",
        filters: sanitizeAuditFilters(filters),
        entryCount: entries.length,
        content: normalizedFormat === "json" ? JSON.stringify(entries, null, 2) : entries.map((entry) => JSON.stringify(entry)).join("\n"),
      };
    },
  };
}

function createIdentity({ userId, tenantId, role, permissions }) {
  return { userId, tenantId, role, permissions };
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

function createSecurityReadiness({ authEnabled, users, revokedTokens, userStorePath, auditPath }) {
  const configuredUsers = [...users.values()];
  const blockers = [];
  const warnings = [];

  if (authEnabled && users.size === 0) {
    blockers.push("auth_enabled_without_users");
  }

  if (!authEnabled) {
    warnings.push("enterprise_auth_disabled");
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
    userStore: {
      mode: "env-plus-json-file",
      path: userStorePath,
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
    },
    audit: {
      mode: "jsonl-file",
      path: auditPath,
    },
    blockers,
    warnings,
  };
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

function parseRevokedTokens(value) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean),
  );
}

function readBoolean(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }
  return value === "1" || String(value).toLowerCase() === "true";
}
