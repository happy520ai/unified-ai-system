// SCIM 2.0 provisioning service (minimal, honest subset).
//
// 供企业 IdP(Entra/Okta)把用户目录推送到网关:
//   POST   /scim/v2/Users            创建用户
//   GET    /scim/v2/Users/:id        查询
//   GET    /scim/v2/Users            列表(userName eq 过滤)
//   PATCH  /scim/v2/Users/:id        replace active/role/tenantId
//   DELETE /scim/v2/Users/:id        停用(SCIM 语义:deactivate)
//
// 鉴权:Bearer AI_GATEWAY_SCIM_BEARER_TOKEN(未配置 → 整个面禁用)。
// 存储:复用 enterpriseUserStore 的持久化文件(.data/enterprise/users.json)。
// 明确不支持(v1):组(Groups)、复杂 filter、企业 schema 扩展 —— 返回的
// meta 里如实标注 supportedOperations。

import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  findStoredUser,
  loadStoredUsers,
  normalizeStoredUser,
  saveStoredUsers,
} from "./enterpriseUserStore.js";

const BEARER_ENV = "AI_GATEWAY_SCIM_BEARER_TOKEN";
const USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
const LIST_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:ListResponse";
const ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error";

export function createScimProvisioningService({
  env = process.env,
  usersPath = null,
  tokenService = null,
  onUsersChanged = null,
} = {}) {
  const bearerToken = env[BEARER_ENV] ? String(env[BEARER_ENV]).trim() : null;
  const effectiveUsersPath = usersPath ?? null;

  function authorized(request) {
    if (!bearerToken) return false;
    const header = String(request?.headers?.authorization ?? "");
    const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!presented || presented.length !== bearerToken.length) return false;
    return timingSafeEqual(Buffer.from(presented), Buffer.from(bearerToken));
  }

  function loadUsers() {
    if (effectiveUsersPath === null) return [];
    try {
      return loadStoredUsers(effectiveUsersPath) ?? [];
    } catch {
      return [];
    }
  }

  function persist(users) {
    if (effectiveUsersPath === null) return;
    saveStoredUsers(effectiveUsersPath, users);
    onUsersChanged?.();
  }

  function toScimUser(user) {
    return {
      schemas: [USER_SCHEMA],
      id: user.userId,
      userName: user.userId,
      active: !user.revoked,
      ...(user.role ? { role: user.role } : {}),
      ...(user.tenantId ? { tenantId: user.tenantId } : {}),
      meta: {
        resourceType: "User",
        created: user.createdAt ?? null,
        lastModified: user.updatedAt ?? null,
      },
    };
  }

  return {
    enabled: Boolean(bearerToken),
    bearerEnv: BEARER_ENV,
    authorized,

    getStatus() {
      return {
        enabled: Boolean(bearerToken),
        bearerEnv: BEARER_ENV,
        supportedOperations: ["create", "get", "list", "patch", "deactivate"],
        unsupported: ["groups", "complexFilters", "enterpriseSchemaExtensions"],
      };
    },

    createUser(scimUser) {
      if (!scimUser || typeof scimUser !== "object" || !scimUser.userName) {
        return scimError(400, "userName is required.");
      }
      const users = loadUsers();
      if (findStoredUser(users, { userId: String(scimUser.userName) })) {
        return scimError(409, "A user with this userName already exists.");
      }
      // SCIM 供给用户的凭证语义:内部生成一次性登记 token(哈希入库、明文不返回)。
      // 用户通过 SSO 登录获取可用 API token;SCIM 面负责账户生命周期。
      const enrollmentToken = `scim_${randomBytes(24).toString("hex")}`;
      const normalized = normalizeStoredUser({
        userId: String(scimUser.userName),
        tenantId: typeof scimUser.tenantId === "string" ? scimUser.tenantId : "default",
        role: typeof scimUser.role === "string" ? scimUser.role : "viewer",
        token: enrollmentToken,
        revoked: scimUser.active === false,
        createdAt: new Date().toISOString(),
        source: "scim",
      });
      users.push(normalized);
      persist(users);
      return { status: 201, user: toScimUser(normalized) };
    },

    getUser(id) {
      const users = loadUsers();
      const user = findStoredUser(users, { userId: String(id) });
      if (!user) return scimError(404, `User ${id} not found.`);
      return { status: 200, user: toScimUser(user) };
    },

    listUsers({ filter } = {}) {
      const users = loadUsers();
      let matches = users;
      const filterMatch = typeof filter === "string"
        ? /userName\s+eq\s+"?([^"]+)"?/.exec(filter)
        : null;
      if (filterMatch) {
        const userName = filterMatch[1];
        matches = users.filter((user) => user.userId === userName);
      }
      return {
        status: 200,
        list: {
          schemas: [LIST_SCHEMA],
          totalResults: matches.length,
          startIndex: 1,
          itemsPerPage: matches.length,
          Resources: matches.map(toScimUser),
        },
      };
    },

    patchUser(id, operations) {
      const users = loadUsers();
      const user = findStoredUser(users, { userId: String(id) });
      if (!user) return scimError(404, `User ${id} not found.`);
      if (!Array.isArray(operations) || operations.length === 0) {
        return scimError(400, "Operations array is required.");
      }
      const patch = {};
      for (const operation of operations) {
        const op = String(operation?.op ?? "").toLowerCase();
        const path = String(operation?.path ?? "");
        if (op !== "replace") {
          return scimError(400, `SCIM op "${op}" is not supported; only replace.`);
        }
        if (path === "active") {
          patch.revoked = operation.value !== true;
        } else if (path === "role" || path === "tenantId") {
          patch[path] = String(operation.value ?? "");
        } else {
          return scimError(400, `SCIM path "${path}" is not supported.`);
        }
      }
      const updated = normalizeStoredUser({ ...user, ...patch, updatedAt: new Date().toISOString() }, user);
      const index = users.findIndex((candidate) => candidate.userId === user.userId);
      users[index] = updated;
      persist(users);
      return { status: 200, user: toScimUser(updated) };
    },

    deactivateUser(id) {
      return this.patchUser(id, [{ op: "replace", path: "active", value: false }]);
    },
  };
}

function scimError(status, detail) {
  return {
    status,
    error: {
      schemas: [ERROR_SCHEMA],
      status: String(status),
      detail,
    },
  };
}
