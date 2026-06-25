import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const DEFAULT_ROLES = {
  admin: ["*"],
  operator: ["session:read", "dashboard:read", "provider:read", "chat:use", "knowledge:read", "knowledge:write", "memory:write", "connector:write", "workflow:run", "evaluation:run"],
  viewer: ["session:read", "dashboard:read", "provider:read", "knowledge:read"],
  auditor: ["session:read", "dashboard:read", "audit:read"],
};

function readOptionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

export function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

function createTokenFingerprint(tokenHash) {
  return String(tokenHash ?? "").slice(0, 12);
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

export function addUser(users, user) {
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

export function addStoredUser(users, user) {
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

export function parseUsers(env) {
  const users = new Map();
  if (env.PME_ENTERPRISE_USERS_JSON) {
    let parsed;
    try {
      parsed = JSON.parse(env.PME_ENTERPRISE_USERS_JSON);
    } catch (parseErr) {
      console.error("[enterpriseGovernance] Failed to parse PME_ENTERPRISE_USERS_JSON:", parseErr.message);
      parsed = [];
    }
    if (!Array.isArray(parsed)) {
      console.error("[enterpriseGovernance] PME_ENTERPRISE_USERS_JSON must be an array, got:", typeof parsed);
      parsed = [];
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

export function normalizeStoredUser(input = {}, existing) {
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

export function findStoredUser(storedUsers, input = {}) {
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

export function loadStoredUsers(path) {
  if (!existsSync(path)) {
    return [];
  }
  const text = readFileSync(path, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (parseErr) {
    console.error("[enterpriseGovernance] Failed to parse user store file:", parseErr.message);
    return [];
  }
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

export function saveStoredUsers(path, users) {
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

export function sanitizeUser(user) {
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

export function createSanitizedUsers(users) {
  return [...users.values()]
    .map(sanitizeUser)
    .sort((left, right) => `${left.tenantId}:${left.userId}:${left.role}`.localeCompare(`${right.tenantId}:${right.userId}:${right.role}`));
}

export function sanitizeIdentity(identity) {
  return {
    userId: identity.userId,
    tenantId: identity.tenantId,
    role: identity.role,
  };
}

