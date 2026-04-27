import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_ROLES = {
  admin: ["*"],
  operator: ["session:read", "dashboard:read", "provider:read", "chat:use", "knowledge:read", "knowledge:write", "memory:write", "connector:write", "workflow:run", "evaluation:run"],
  viewer: ["session:read", "dashboard:read", "provider:read", "knowledge:read"],
  auditor: ["session:read", "dashboard:read", "audit:read"],
};

const DEFAULT_AUDIT_LIMIT = 200;

export function createEnterpriseGovernanceService({ env = {}, auditLogPath } = {}) {
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

    revokeUser(input = {}, actorIdentity) {
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

function parseUsers(env) {
  const users = new Map();

  if (env.PME_ENTERPRISE_USERS_JSON) {
    const parsed = JSON.parse(env.PME_ENTERPRISE_USERS_JSON);
    if (!Array.isArray(parsed)) {
      throw new Error("PME_ENTERPRISE_USERS_JSON must be an array.");
    }

    for (const user of parsed) {
      addUser(users, user);
    }
  }

  if (env.PME_AUTH_TOKEN) {
    addUser(users, {
      token: env.PME_AUTH_TOKEN,
      userId: env.PME_AUTH_USER_ID ?? "local-admin",
      tenantId: env.PME_AUTH_TENANT_ID ?? "default",
      role: env.PME_AUTH_ROLE ?? "admin",
      expiresAt: env.PME_AUTH_EXPIRES_AT,
    });
  }

  return users;
}

function addUser(users, user) {
  if (!user?.token) {
    return;
  }

  const role = user.role ?? "viewer";
  const permissions = Array.isArray(user.permissions) ? user.permissions : DEFAULT_ROLES[role] ?? [];

  users.set(user.token, {
    token: user.token,
    tokenHash: hashToken(user.token),
    tokenFingerprint: createTokenFingerprint(hashToken(user.token)),
    source: "env",
    userId: user.userId ?? role,
    tenantId: user.tenantId ?? "default",
    role,
    permissions,
    expiresAt: user.expiresAt ?? null,
    revoked: Boolean(user.revoked || user.disabled),
  });
}

function addStoredUser(users, user) {
  if (!user?.tokenHash) {
    return;
  }

  const role = user.role ?? "viewer";
  const permissions = Array.isArray(user.permissions) ? user.permissions : DEFAULT_ROLES[role] ?? [];

  users.set(user.tokenHash, {
    token: null,
    tokenHash: user.tokenHash,
    tokenFingerprint: user.tokenFingerprint ?? createTokenFingerprint(user.tokenHash),
    source: "file",
    userId: user.userId ?? role,
    tenantId: user.tenantId ?? "default",
    role,
    permissions,
    expiresAt: user.expiresAt ?? null,
    revoked: Boolean(user.revoked || user.disabled),
    createdAt: user.createdAt ?? null,
    updatedAt: user.updatedAt ?? null,
  });
}

function createIdentity({ userId, tenantId, role, permissions }) {
  return {
    userId,
    tenantId,
    role,
    permissions,
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

function createSanitizedUsers(users) {
  return [...users.values()]
    .map(sanitizeUser)
    .sort((left, right) => `${left.tenantId}:${left.userId}:${left.role}`.localeCompare(`${right.tenantId}:${right.userId}:${right.role}`));
}

function sanitizeUser(user) {
  return {
    userId: user.userId,
    tenantId: user.tenantId,
    role: user.role,
    permissions: user.permissions,
    source: user.source ?? "unknown",
    tokenFingerprint: user.tokenFingerprint ?? createTokenFingerprint(user.tokenHash ?? hashToken(user.token ?? "")),
    tokenHashExposed: false,
    tokenValueExposed: false,
    expiresAt: user.expiresAt ?? null,
    revoked: Boolean(user.revoked),
    createdAt: user.createdAt ?? null,
    updatedAt: user.updatedAt ?? null,
  };
}

function sanitizeIdentity(identity) {
  return {
    userId: identity.userId,
    tenantId: identity.tenantId,
    role: identity.role,
  };
}

function normalizeStoredUser(input = {}, existing) {
  const userId = readRequiredString(input.userId, "enterprise_user_id_required", "Enterprise userId is required.");
  const token = typeof input.token === "string" ? input.token.trim() : "";
  const tokenHash = token ? hashToken(token) : existing?.tokenHash;
  if (!tokenHash) {
    const error = new Error("Enterprise user token is required for a new managed user.");
    error.code = "enterprise_user_token_required";
    error.category = "validation";
    throw error;
  }

  const role = readRole(input.role ?? existing?.role ?? "viewer");
  const expiresAt = normalizeExpiresAt(input.expiresAt ?? existing?.expiresAt ?? null);
  const now = new Date().toISOString();

  return {
    userId,
    tenantId: readOptionalString(input.tenantId) ?? existing?.tenantId ?? "default",
    role,
    permissions: Array.isArray(input.permissions) ? input.permissions : existing?.permissions ?? DEFAULT_ROLES[role] ?? [],
    tokenHash,
    tokenFingerprint: createTokenFingerprint(tokenHash),
    expiresAt,
    revoked: Boolean(input.revoked ?? existing?.revoked ?? false),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

function findStoredUser(storedUsers, input = {}) {
  const userId = readOptionalString(input.userId);
  const tokenFingerprint = readOptionalString(input.tokenFingerprint);
  if (userId) {
    return storedUsers.find((user) => user.userId === userId) ?? null;
  }

  if (tokenFingerprint) {
    return storedUsers.find((user) => user.tokenFingerprint === tokenFingerprint) ?? null;
  }

  return null;
}

function loadStoredUsers(path) {
  if (!existsSync(path)) {
    return [];
  }

  const text = readFileSync(path, "utf8");
  const parsed = JSON.parse(text);
  const users = Array.isArray(parsed?.users) ? parsed.users : [];
  return users.map(normalizeStoredUserFromFile);
}

function normalizeStoredUserFromFile(user) {
  const userId = readRequiredString(user.userId, "enterprise_user_id_required", "Enterprise userId is required.");
  const tokenHash = readRequiredString(user.tokenHash, "enterprise_user_token_hash_required", "Enterprise token hash is required.");
  const role = readRole(user.role ?? "viewer");
  const expiresAt = normalizeExpiresAt(user.expiresAt ?? null);

  return {
    userId,
    tenantId: readOptionalString(user.tenantId) ?? "default",
    role,
    permissions: Array.isArray(user.permissions) ? user.permissions : DEFAULT_ROLES[role] ?? [],
    tokenHash,
    tokenFingerprint: readOptionalString(user.tokenFingerprint) ?? createTokenFingerprint(tokenHash),
    expiresAt,
    revoked: Boolean(user.revoked),
    createdAt: readOptionalString(user.createdAt),
    updatedAt: readOptionalString(user.updatedAt),
  };
}

function saveStoredUsers(path, users) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        version: 1,
        mode: "enterprise-managed-users",
        tokenStorage: "sha256-hash-only",
        users,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function readRequiredString(value, code, message) {
  const normalized = readOptionalString(value);
  if (!normalized) {
    const error = new Error(message);
    error.code = code;
    error.category = "validation";
    throw error;
  }

  return normalized;
}

function readOptionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readRole(value) {
  const role = readOptionalString(value) ?? "viewer";
  if (!DEFAULT_ROLES[role]) {
    const error = new Error(`Unsupported enterprise role: ${role}`);
    error.code = "enterprise_role_unsupported";
    error.category = "validation";
    throw error;
  }

  return role;
}

function normalizeExpiresAt(value) {
  const expiresAt = readOptionalString(value);
  if (!expiresAt) {
    return null;
  }

  if (!Number.isFinite(Date.parse(expiresAt))) {
    const error = new Error("Enterprise token expiresAt must be a valid date string.");
    error.code = "enterprise_expires_at_invalid";
    error.category = "validation";
    throw error;
  }

  return expiresAt;
}

function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

function createTokenFingerprint(tokenHash) {
  return String(tokenHash ?? "").slice(0, 12);
}

function parseRevokedTokens(value) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean),
  );
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

async function readAuditFile(path) {
  try {
    const text = await readFile(path, "utf8");
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function filterAuditEntries(entries, filters = {}) {
  const sanitized = sanitizeAuditFilters(filters);
  return entries.filter((entry) => {
    if (sanitized.outcome && entry.outcome !== sanitized.outcome) return false;
    if (sanitized.code && entry.code !== sanitized.code) return false;
    if (sanitized.path && entry.path !== sanitized.path) return false;
    if (sanitized.userId && entry.userId !== sanitized.userId) return false;
    if (sanitized.tenantId && entry.tenantId !== sanitized.tenantId) return false;
    if (sanitized.since && Date.parse(entry.timestamp) < Date.parse(sanitized.since)) return false;
    if (sanitized.until && Date.parse(entry.timestamp) > Date.parse(sanitized.until)) return false;
    return true;
  });
}

function sanitizeAuditFilters(filters = {}) {
  return {
    outcome: readOptionalString(filters.outcome),
    code: readOptionalString(filters.code),
    path: readOptionalString(filters.path),
    userId: readOptionalString(filters.userId),
    tenantId: readOptionalString(filters.tenantId),
    since: normalizeOptionalDate(filters.since),
    until: normalizeOptionalDate(filters.until),
  };
}

function normalizeOptionalDate(value) {
  const normalized = readOptionalString(value);
  if (!normalized) {
    return null;
  }

  if (!Number.isFinite(Date.parse(normalized))) {
    return null;
  }

  return normalized;
}

function readBoolean(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }

  return value === "1" || String(value).toLowerCase() === "true";
}
