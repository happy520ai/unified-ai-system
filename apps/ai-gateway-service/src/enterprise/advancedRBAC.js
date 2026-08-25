// =============================================================================
// advancedRBAC.js — 高级 RBAC 权限系统
// 模型级、端点级、租户级细粒度权限
// =============================================================================

export function createAdvancedRBAC(options = {}) {
  const roles = new Map();
  const userRoles = new Map();   // userId -> Set<roleId>
  const tenants = new Map();     // tenantId -> { name, quotas, settings }
  const persistence = options.persistence ?? null;  // optional SQLite backend

  // 内置角色
  const BUILTIN_ROLES = {
    super_admin: { name: "超级管理员", permissions: ["*"], priority: 100 },
    admin: { name: "管理员", permissions: ["user:*", "model:*", "endpoint:*", "audit:read", "config:*"], priority: 90 },
    developer: { name: "开发者", permissions: ["model:read", "model:use", "endpoint:chat", "endpoint:knowledge", "prompt:*"], priority: 50 },
    viewer: { name: "观察者", permissions: ["model:read", "endpoint:read", "audit:read"], priority: 10 },
    api_user: { name: "API 用户", permissions: ["endpoint:chat", "endpoint:knowledge", "model:use"], priority: 20 },
  };

  // 初始化内置角色
  for (const [id, role] of Object.entries(BUILTIN_ROLES)) {
    roles.set(id, { id, ...role, builtin: true });
  }

  // 从持久化后端恢复自定义角色、用户-角色映射、租户（fail-open：读取失败不影响启动）
  if (persistence) {
    try {
      const snapshot = persistence.load();
      for (const role of snapshot.customRoles ?? []) {
        if (role?.id) roles.set(role.id, role);
      }
      for (const [userId, roleId] of snapshot.userRoles ?? []) {
        if (!userRoles.has(userId)) userRoles.set(userId, new Set());
        userRoles.get(userId).add(roleId);
      }
      for (const tenant of snapshot.tenants ?? []) {
        if (tenant?.id) tenants.set(tenant.id, tenant);
      }
    } catch {
      // fail-open: persistence read failure must not block startup.
    }
  }

  function persistAtomically(action) {
    if (!persistence) return;
    try {
      action();
    } catch {
      // fail-open: persistence write failure must not break in-memory RBAC.
    }
  }

  function createRole(id, name, permissions, priority = 30) {
    const role = { id, name, permissions, priority, builtin: false };
    roles.set(id, role);
    persistAtomically(() => persistence.upsertRole(role));
    return roles.get(id);
  }

  function assignRole(userId, roleId) {
    if (!userRoles.has(userId)) userRoles.set(userId, new Set());
    userRoles.get(userId).add(roleId);
    persistAtomically(() => persistence.addUserRole(userId, roleId));
  }

  function revokeRole(userId, roleId) {
    userRoles.get(userId)?.delete(roleId);
    persistAtomically(() => persistence.removeUserRole(userId, roleId));
  }

  function getUserPermissions(userId) {
    const roleIds = userRoles.get(userId) ?? new Set();
    const permissions = new Set();
    for (const roleId of roleIds) {
      const role = roles.get(roleId);
      if (role) role.permissions.forEach((p) => permissions.add(p));
    }
    return [...permissions];
  }

  function checkPermission(userId, requiredPermission) {
    const perms = getUserPermissions(userId);
    if (perms.includes("*")) return true;
    if (perms.includes(requiredPermission)) return true;

    // 通配符匹配 (e.g., "model:*" matches "model:read")
    const [resource, action] = requiredPermission.split(":");
    if (perms.includes(`${resource}:*`)) return true;

    return false;
  }

  function checkModelAccess(userId, modelId) {
    return checkPermission(userId, "model:use") || checkPermission(userId, `model:${modelId}`);
  }

  function checkEndpointAccess(userId, endpoint) {
    return checkPermission(userId, "endpoint:*") || checkPermission(userId, `endpoint:${endpoint}`);
  }

  // 租户管理
  function createTenant(id, name, settings = {}) {
    const tenant = {
      id, name,
      quotas: {
        dailyRequests: settings.dailyRequests ?? 10000,
        dailyTokens: settings.dailyTokens ?? 1000000,
        maxConcurrent: settings.maxConcurrent ?? 50,
        allowedModels: settings.allowedModels ?? ["*"],
      },
      settings,
      createdAt: Date.now(),
    };
    tenants.set(id, tenant);
    persistAtomically(() => persistence.upsertTenant(tenant));
  }

  function checkTenantQuota(tenantId, usage) {
    const tenant = tenants.get(tenantId);
    if (!tenant) return { allowed: true };
    if (usage.dailyRequests > tenant.quotas.dailyRequests) return { allowed: false, reason: "daily_request_limit" };
    if (usage.dailyTokens > tenant.quotas.dailyTokens) return { allowed: false, reason: "daily_token_limit" };
    return { allowed: true };
  }

  function listRoles() { return Array.from(roles.values()); }
  function listTenants() { return Array.from(tenants.values()); }
  function getUserRoles(userId) { return [...(userRoles.get(userId) ?? [])].map((id) => roles.get(id)).filter(Boolean); }

  function getStats() {
    return {
      roles: roles.size,
      builtinRoles: Object.keys(BUILTIN_ROLES).length,
      users: userRoles.size,
      tenants: tenants.size,
    };
  }

  return {
    createRole, assignRole, revokeRole, getUserPermissions,
    checkPermission, checkModelAccess, checkEndpointAccess,
    createTenant, checkTenantQuota,
    listRoles, listTenants, getUserRoles, getStats,
  };
}
