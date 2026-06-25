/**
 * API Key 管理模块
 * 
 * 功能：
 * - 生成 API Key（前缀 uai-，后跟 32 字节 hex）
 * - Key 以 SHA-256 hash 存储在内存 Map 中（不保存明文）
 * - 支持 Key 创建、列表、吊销
 * - 每个 Key 绑定一个 role 和 tenantId
 * - 验证时：计算请求 Key 的 hash，查 Map 比对
 */

import { createHash, randomBytes } from "node:crypto";

// API Key 前缀标识
const API_KEY_PREFIX = "uai-";

// 默认角色权限映射（与 enterpriseGovernanceService 保持一致）
const ROLE_HIERARCHY = {
  admin: 4,
  operator: 3,
  viewer: 2,
  auditor: 1,
};

/**
 * 创建 API Key 管理器实例
 * 
 * @returns {object} API Key 管理器对象，提供 create / list / revoke / validate 等方法
 */
export function createApiKeyManager() {
  /**
   * 内存存储：keyHash -> keyRecord
   * keyRecord 结构：
   * {
   *   keyId: string,        // 唯一标识（hash 前 12 位）
   *   keyHash: string,      // SHA-256 哈希值
   *   keyFingerprint: string, // 指纹（hash 前 12 位，用于日志显示）
   *   role: string,         // 绑定角色
   *   tenantId: string,     // 绑定租户
   *   description: string,  // 描述信息
   *   createdAt: string,    // 创建时间 ISO
   *   expiresAt: string|null, // 过期时间 ISO，null 表示永不过期
   *   revoked: boolean,     // 是否已吊销
   *   lastUsedAt: string|null, // 最后使用时间
   * }
   */
  const keyStore = new Map();

  return {
    /**
     * 创建新的 API Key
     * 
     * @param {object} options - 创建选项
     * @param {string} options.role - 绑定的角色（admin / operator / viewer / auditor）
     * @param {string} [options.tenantId="default"] - 绑定的租户 ID
     * @param {string} [options.description=""] - Key 描述
     * @param {string} [options.expiresAt=null] - 过期时间（ISO 日期字符串）
     * @returns {{ key: string, record: object }} 返回明文 Key（仅此一次）和记录
     */
    create({ role = "viewer", tenantId = "default", description = "", expiresAt = null } = {}) {
      // 验证角色合法性
      if (!ROLE_HIERARCHY[role]) {
        const error = new Error(`Unsupported API key role: ${role}`);
        error.code = "api_key_invalid_role";
        error.category = "validation";
        throw error;
      }

      // 验证过期时间格式
      if (expiresAt && !Number.isFinite(Date.parse(expiresAt))) {
        const error = new Error("API key expiresAt must be a valid ISO date string.");
        error.code = "api_key_invalid_expires_at";
        error.category = "validation";
        throw error;
      }

      // 生成原始 Key：前缀 uai- + 32 字节随机 hex（64 个字符）
      const rawKey = `${API_KEY_PREFIX}${randomBytes(32).toString("hex")}`;

      // 计算 hash 用于存储（不保存明文）
      const keyHash = hashKey(rawKey);
      const keyFingerprint = createFingerprint(keyHash);
      const now = new Date().toISOString();

      const record = {
        keyId: keyFingerprint,
        keyHash,
        keyFingerprint,
        role,
        tenantId,
        description: description || `API Key for ${role}@${tenantId}`,
        createdAt: now,
        expiresAt: expiresAt || null,
        revoked: false,
        lastUsedAt: null,
      };

      keyStore.set(keyHash, record);

      return {
        key: rawKey,
        record: sanitizeRecord(record),
      };
    },

    /**
     * 列出所有 API Key（不包含明文和 hash 值）
     * 
     * @returns {{ keys: Array<object>, totalCount: number, activeCount: number }}
     */
    list() {
      const records = [...keyStore.values()].map(sanitizeRecord);
      const activeCount = records.filter((r) => !r.revoked && !isExpired(r.expiresAt)).length;

      return {
        keys: records.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        totalCount: records.length,
        activeCount,
      };
    },

    /**
     * 吊销指定的 API Key
     * 支持通过 keyId（指纹）、keyHash 或明文 Key 来定位
     * 
     * @param {object} options
     * @param {string} [options.keyId] - Key 指纹 / keyId
     * @param {string} [options.key] - 明文 Key（会自动 hash）
     * @param {string} [options.keyHash] - Key 的 hash 值
     * @returns {{ revoked: boolean, record: object|null }}
     */
    revoke({ keyId, key, keyHash } = {}) {
      const record = findRecord({ keyId, key, keyHash });

      if (!record) {
        const error = new Error("API key not found.");
        error.code = "api_key_not_found";
        error.category = "validation";
        throw error;
      }

      record.revoked = true;

      return {
        revoked: true,
        record: sanitizeRecord(record),
      };
    },

    /**
     * 验证 API Key 是否有效
     * 
     * @param {string} rawKey - 请求中提供的明文 API Key
     * @returns {{ valid: boolean, record: object|null, error: string|null }}
     */
    validate(rawKey) {
      if (!rawKey || typeof rawKey !== "string") {
        return { valid: false, record: null, error: "api_key_missing" };
      }

      // 检查前缀格式
      if (!rawKey.startsWith(API_KEY_PREFIX)) {
        return { valid: false, record: null, error: "api_key_invalid_format" };
      }

      const hash = hashKey(rawKey);
      const record = keyStore.get(hash);

      if (!record) {
        return { valid: false, record: null, error: "api_key_not_found" };
      }

      // 检查是否已吊销
      if (record.revoked) {
        return { valid: false, record: sanitizeRecord(record), error: "api_key_revoked" };
      }

      // 检查是否已过期
      if (isExpired(record.expiresAt)) {
        return { valid: false, record: sanitizeRecord(record), error: "api_key_expired" };
      }

      // 更新最后使用时间
      record.lastUsedAt = new Date().toISOString();

      return {
        valid: true,
        record: sanitizeRecord(record),
        error: null,
      };
    },

    /**
     * 获取管理器健康状态
     * 
     * @returns {object} 健康状态摘要
     */
    getHealth() {
      const records = [...keyStore.values()];
      const activeCount = records.filter((r) => !r.revoked && !isExpired(r.expiresAt)).length;

      return {
        status: "ready",
        totalKeyCount: records.length,
        activeKeyCount: activeCount,
        revokedKeyCount: records.filter((r) => r.revoked).length,
        expiredKeyCount: records.filter((r) => isExpired(r.expiresAt)).length,
        storageMode: "in-memory-sha256-hash",
        prefix: API_KEY_PREFIX,
      };
    },
  };

  // ---- 内部辅助函数 ----

  /**
   * 根据多种标识方式查找 Key 记录
   */
  function findRecord({ keyId, key, keyHash } = {}) {
    if (keyHash) {
      return keyStore.get(keyHash) ?? null;
    }

    if (key) {
      return keyStore.get(hashKey(key)) ?? null;
    }

    if (keyId) {
      return [...keyStore.values()].find((r) => r.keyId === keyId || r.keyFingerprint === keyId) ?? null;
    }

    return null;
  }
}

/**
 * 计算 API Key 的 SHA-256 哈希值
 * 
 * @param {string} rawKey - 明文 Key
 * @returns {string} hex 编码的哈希值
 */
function hashKey(rawKey) {
  return createHash("sha256").update(String(rawKey)).digest("hex");
}

/**
 * 从 hash 创建可安全显示的指纹
 * 
 * @param {string} keyHash - Key 的 hash 值
 * @returns {string} 12 字符的指纹
 */
function createFingerprint(keyHash) {
  return String(keyHash ?? "").slice(0, 12);
}

/**
 * 检查过期时间是否已过
 * 
 * @param {string|null} expiresAt - ISO 日期字符串
 * @returns {boolean}
 */
function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

/**
 * 清洗记录，移除 hash 等敏感字段后返回
 * 
 * @param {object} record - 内部记录
 * @returns {object} 安全的外部可见记录
 */
function sanitizeRecord(record) {
  return {
    keyId: record.keyId,
    keyFingerprint: record.keyFingerprint,
    role: record.role,
    tenantId: record.tenantId,
    description: record.description,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    revoked: record.revoked,
    lastUsedAt: record.lastUsedAt,
    // 不暴露 keyHash 和明文 key
    keyHashExposed: false,
    keyValueExposed: false,
  };
}
