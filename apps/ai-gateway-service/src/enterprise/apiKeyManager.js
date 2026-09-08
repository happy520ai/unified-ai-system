/**
 * API Key（虚拟 key）管理模块
 *
 * 功能：
 * - 生成 API Key（前缀 uai-，后跟 32 字节 hex）
 * - Key 以 SHA-256 hash 存储（不保存明文）；可选持久化到 JSON 文件（0600）
 * - 支持 Key 创建、列表、吊销、验证
 * - 每个 Key 绑定一个 role 和 tenantId
 * - 可选：按 key 的周期预算窗口（token 上限 + 滚动重置 + 软预算阈值）
 * - 可选：按 key 的每分钟请求上限（固定窗口计数）
 * - 验证时：计算请求 Key 的 hash，查 Map 比对
 */

import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  closeSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

// API Key 前缀标识
const API_KEY_PREFIX = "uai-";

// 命名预算窗口
const NAMED_WINDOWS = {
  daily: 86_400_000,
  monthly: 2_592_000_000,
};

const DEFAULT_SOFT_THRESHOLD = 0.8;

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
 * @param {object} [options]
 * @param {string|null} [options.storePath] - JSON 持久化路径；null 表示仅内存
 * @param {() => number} [options.now] - 可注入时钟（测试用）
 */
export function createApiKeyManager(options = {}) {
  const storePath = typeof options.storePath === "string" && options.storePath
    ? resolve(options.storePath)
    : null;
  const now = typeof options.now === "function" ? options.now : Date.now;

  /**
   * 内存存储：keyHash -> keyRecord（持久化时序列化全部字段，hash 落盘）
   */
  const keyStore = new Map();
  let persistenceFailed = false;

  if (storePath) {
    for (const record of loadRecords(storePath)) {
      keyStore.set(record.keyHash, record);
    }
  }

  return {
    /**
     * 创建新的 API Key
     *
     * @param {object} options - 创建选项
     * @param {string} options.role - 绑定的角色（admin / operator / viewer / auditor）
     * @param {string} [options.tenantId="default"] - 绑定的租户 ID
     * @param {string} [options.description=""] - Key 描述信息
     * @param {string} [options.expiresAt=null] - 过期时间（ISO 日期字符串）
     * @param {object} [options.budget] - 预算窗口：{ limitTokens, window, softThreshold }
     * @param {object} [options.rateLimit] - 限流：{ requestsPerMinute }
     * @returns {{ key: string, record: object }} 返回明文 Key（仅此一次）和记录
     */
    create({
      role = "viewer",
      tenantId = "default",
      description = "",
      expiresAt = null,
      budget = null,
      rateLimit = null,
    } = {}) {
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

      const normalizedBudget = normalizeBudget(budget);
      const normalizedRateLimit = normalizeRateLimit(rateLimit);

      // 生成原始 Key：前缀 uai- + 32 字节随机 hex（64 个字符）
      const rawKey = `${API_KEY_PREFIX}${randomBytes(32).toString("hex")}`;

      // 计算 hash 用于存储（不保存明文）
      const keyHash = hashKey(rawKey);
      const keyFingerprint = createFingerprint(keyHash);
      const createdAt = new Date(now()).toISOString();

      const record = {
        keyId: keyFingerprint,
        keyHash,
        keyFingerprint,
        role,
        tenantId,
        description: description || `API Key for ${role}@${tenantId}`,
        createdAt,
        expiresAt: expiresAt || null,
        revoked: false,
        lastUsedAt: null,
        budget: normalizedBudget,
        rateLimit: normalizedRateLimit,
        usageState: {
          windowIndex: -1,
          rateWindowIndex: -1,
          rateRequestCount: 0,
          tokensUsed: 0,
          requestCount: 0,
          lastRecordedAt: null,
        },
      };

      keyStore.set(keyHash, record);
      persistUsage();

      return {
        key: rawKey,
        record: sanitizeRecord(record),
      };
    },

    /**
     * 列出 API Key（不包含明文和 hash 值），可按租户过滤并附带实时预算状态。
     *
     * @param {object} [options]
     * @param {string} [options.tenantId] - 仅返回该租户的 key
     * @returns {{ keys: Array<object>, totalCount: number, activeCount: number }}
     */
    list(options = {}) {
      let records = [...keyStore.values()];
      if (options.tenantId) {
        records = records.filter((record) => record.tenantId === options.tenantId);
      }
      const sanitized = records.map((record) => ({
        ...sanitizeRecord(record),
        usage: describeBudget(record),
      }));
      const activeCount = sanitized.filter((record) => !record.revoked && !isExpired(record.expiresAt)).length;

      return {
        keys: sanitized.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        totalCount: sanitized.length,
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
      persistUsage();

      return {
        revoked: true,
        record: sanitizeRecord(record),
      };
    },

    /**
     * 验证 API Key 是否有效（纯认证；预算/限流用 authorizeUsage）
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

      // 更新最后使用时间（仅内存；避免每次请求写盘）
      record.lastUsedAt = new Date(now()).toISOString();

      return {
        valid: true,
        record: sanitizeRecord(record),
        error: null,
      };
    },

    /**
     * 请求前的预算与限流检查（会计入本次请求的计数）。
     *
     * @param {object} params
     * @param {string} params.keyId - key 指纹
     * @param {number} [params.estimatedTokens=0] - 保守估算的本次 token 用量
     * @returns {{ allowed: boolean, code: string|null, budget: object|null, rate: object|null }}
     */
    authorizeUsage({ keyId, estimatedTokens = 0 } = {}) {
      const record = findRecord({ keyId });
      if (!record || record.revoked || isExpired(record.expiresAt)) {
        return { allowed: false, code: "api_key_invalid", budget: null, rate: null };
      }
      if (!Number.isFinite(estimatedTokens) || estimatedTokens < 0 || !Number.isSafeInteger(Math.ceil(estimatedTokens))) {
        throw validationError("api_key_invalid_usage_tokens", "Estimated token usage must be finite and non-negative.");
      }
      // A failed post-call write retains the charged counters in this process.
      // Flush that complete snapshot before admitting any more provider work.
      if (persistenceFailed) persistUsage();

      if (record.rateLimit) {
        rolloverIfNeeded(record, now());
        const { requestsPerMinute } = record.rateLimit;
        if (record.usageState.rateRequestCount + 1 > requestsPerMinute) {
          return {
            allowed: false,
            code: "VIRTUAL_KEY_RATE_LIMITED",
            budget: describeBudget(record),
            rate: {
              requestsPerMinute,
              requestCount: record.usageState.rateRequestCount,
              retryAfterMs: 60_000,
            },
          };
        }
      }

      if (record.budget) {
        rolloverIfNeeded(record, now());
        const { limitTokens } = record.budget;
        if (record.usageState.tokensUsed + Math.max(0, estimatedTokens) > limitTokens) {
          return {
            allowed: false,
            code: "VIRTUAL_KEY_BUDGET_EXHAUSTED",
            budget: describeBudget(record),
            rate: null,
          };
        }
      }

      if (record.rateLimit || record.budget) {
        if (!Number.isSafeInteger(record.usageState.requestCount + 1)
          || (record.rateLimit && !Number.isSafeInteger(record.usageState.rateRequestCount + 1))) {
          throw validationError("api_key_invalid_usage_tokens", "Request usage exceeds the supported integer range.");
        }
        record.usageState.requestCount += 1;
        if (record.rateLimit) record.usageState.rateRequestCount += 1;
        persistUsage();
      }

      return {
        allowed: true,
        code: null,
        budget: record.budget ? describeBudget(record) : null,
        rate: null,
      };
    },

    /**
     * 请求完成后记录实际 token 用量（自动滚动预算窗口）。
     *
     * @param {object} params
     * @param {string} params.keyId
     * @param {number} params.tokens - 实际总 token 数
     * @returns {{ recorded: boolean, budget: object|null, softBudgetExceeded: boolean }}
     */
    recordUsage({ keyId, tokens } = {}) {
      const record = findRecord({ keyId });
      if (!record) {
        return { recorded: false, budget: null, softBudgetExceeded: false };
      }
      if (!Number.isFinite(tokens) || tokens < 0 || !Number.isSafeInteger(Math.floor(tokens))) {
        throw validationError("api_key_invalid_usage_tokens", "Recorded token usage must be finite and non-negative.");
      }

      let softBudgetExceeded = false;
      if (record.budget) {
        rolloverIfNeeded(record, now());
        const before = record.usageState.tokensUsed;
        const total = before + Math.floor(tokens);
        if (!Number.isSafeInteger(total)) throw validationError("api_key_invalid_usage_tokens", "Recorded token total exceeds the supported integer range.");
        record.usageState.tokensUsed = total;
        const ratio = record.usageState.tokensUsed / record.budget.limitTokens;
        softBudgetExceeded = before / record.budget.limitTokens < record.budget.softThreshold
          && ratio >= record.budget.softThreshold;
      }
      record.usageState.lastRecordedAt = new Date(now()).toISOString();
      persistUsage();

      return {
        recorded: true,
        budget: record.budget ? describeBudget(record) : null,
        softBudgetExceeded,
      };
    },

    /**
     * 查询单个 key 的实时预算状态（不含敏感字段）。
     */
    describeUsage({ keyId } = {}) {
      const record = findRecord({ keyId });
      if (!record) return null;
      return {
        ...sanitizeRecord(record),
        usage: describeBudget(record),
      };
    },

    /**
     * 获取管理器健康状态
     */
    getHealth() {
      const records = [...keyStore.values()];
      const activeCount = records.filter((r) => !r.revoked && !isExpired(r.expiresAt)).length;

      return {
        status: persistenceFailed ? "degraded" : "ready",
        totalKeyCount: records.length,
        activeKeyCount: activeCount,
        revokedKeyCount: records.filter((r) => r.revoked).length,
        expiredKeyCount: records.filter((r) => isExpired(r.expiresAt)).length,
        storageMode: storePath ? "json-file-sha256-hash" : "in-memory-sha256-hash",
        storePath,
        prefix: API_KEY_PREFIX,
        budgetEnabledKeyCount: records.filter((r) => r.budget).length,
        rateLimitEnabledKeyCount: records.filter((r) => r.rateLimit).length,
        accountingErrorCode: persistenceFailed ? "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE" : null,
      };
    },
  };

  // ---- 内部辅助函数 ----

  function persistUsage() {
    try {
      persistRecords(storePath, keyStore);
      persistenceFailed = false;
    } catch (cause) {
      persistenceFailed = true;
      throw accountingError(cause);
    }
  }

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

  function rolloverIfNeeded(record, timestamp) {
    if (!record.budget && !record.rateLimit) return;
    const rateWindowIndex = Math.floor(timestamp / 60_000);
    if (record.usageState.rateWindowIndex === undefined) {
      // Carry old mixed-policy counts into this minute conservatively.
      record.usageState.rateWindowIndex = record.budget ? rateWindowIndex : record.usageState.windowIndex;
      record.usageState.rateRequestCount = record.usageState.requestCount;
    }
    const windowMs = record.budget?.windowMs ?? 60_000;
    const windowIndex = Math.floor(timestamp / windowMs);
    if (record.usageState.windowIndex !== windowIndex) {
      record.usageState = {
        ...record.usageState,
        windowIndex,
        tokensUsed: 0,
        requestCount: 0,
      };
    }
    if (record.usageState.rateWindowIndex !== rateWindowIndex) {
      record.usageState.rateWindowIndex = rateWindowIndex;
      record.usageState.rateRequestCount = 0;
    }
  }

  function describeBudget(record) {
    rolloverIfNeeded(record, now());
    if (!record.budget) {
      return {
        budgetEnabled: false,
        rateLimitEnabled: Boolean(record.rateLimit),
        requestCount: record.usageState.requestCount,
        rateRequestCount: record.rateLimit ? record.usageState.rateRequestCount : 0,
      };
    }
    const { limitTokens, windowMs, softThreshold } = record.budget;
    const windowIndex = record.usageState.windowIndex;
    return {
      budgetEnabled: true,
      limitTokens,
      windowMs,
      softThreshold,
      tokensUsed: record.usageState.tokensUsed,
      tokensRemaining: Math.max(0, limitTokens - record.usageState.tokensUsed),
      windowResetAt: new Date((windowIndex + 1) * windowMs).toISOString(),
      softBudgetExceeded: record.usageState.tokensUsed / limitTokens >= softThreshold,
      rateLimitEnabled: Boolean(record.rateLimit),
      requestCount: record.usageState.requestCount,
      rateRequestCount: record.rateLimit ? record.usageState.rateRequestCount : 0,
    };
  }
}

function normalizeBudget(budget) {
  if (budget == null) return null;
  if (typeof budget !== "object" || Array.isArray(budget)) {
    throw validationError("api_key_invalid_budget", "API key budget must be an object.");
  }
  const limitTokens = Math.floor(Number(budget.limitTokens));
  if (!Number.isSafeInteger(limitTokens) || limitTokens <= 0) {
    throw validationError("api_key_invalid_budget_limit", "API key budget.limitTokens must be a positive integer.");
  }
  const windowMs = NAMED_WINDOWS[budget.window] ?? Math.floor(Number(budget.windowMs ?? (typeof budget.window === "number" ? budget.window : NaN)));
  if (!Number.isSafeInteger(windowMs) || windowMs <= 0) {
    throw validationError("api_key_invalid_budget_window", 'API key budget.window must be "daily", "monthly", or a positive millisecond count.');
  }
  const softThresholdRaw = budget.softThreshold ?? DEFAULT_SOFT_THRESHOLD;
  const softThreshold = Number(softThresholdRaw);
  if (!Number.isFinite(softThreshold) || softThreshold <= 0 || softThreshold > 1) {
    throw validationError("api_key_invalid_budget_soft_threshold", "API key budget.softThreshold must be in (0, 1].");
  }
  return { limitTokens, windowMs, softThreshold };
}

function normalizeRateLimit(rateLimit) {
  if (rateLimit == null) return null;
  if (typeof rateLimit !== "object" || Array.isArray(rateLimit)) {
    throw validationError("api_key_invalid_rate_limit", "API key rateLimit must be an object.");
  }
  const requestsPerMinute = Math.floor(Number(rateLimit.requestsPerMinute));
  if (!Number.isSafeInteger(requestsPerMinute) || requestsPerMinute <= 0) {
    throw validationError("api_key_invalid_rate_limit_rpm", "API key rateLimit.requestsPerMinute must be a positive integer.");
  }
  return { requestsPerMinute };
}

function validationError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.category = "validation";
  return error;
}

function loadRecords(storePath) {
  if (!storePath) return [];
  let identity;
  try {
    identity = lstatSync(storePath);
  } catch (cause) {
    if (cause?.code === "ENOENT") return [];
    throw accountingError(cause);
  }
  try {
    if (identity.isSymbolicLink() || !identity.isFile()) throw new Error("Invalid virtual key store entry.");
    const parsed = JSON.parse(readFileSync(storePath, "utf8"));
    const keys = parsed?.keys;
    if (parsed?.version !== 1 || !Array.isArray(keys) || !keys.every(isStoredRecord)) {
      throw new Error("Invalid virtual key store schema.");
    }
    if (new Set(keys.map((record) => record.keyFingerprint)).size !== keys.length) throw new Error("Ambiguous virtual key records.");
    return keys.filter((record) => !record.revoked);
  } catch (cause) {
    throw accountingError(cause);
  }
}

function isStoredRecord(record) {
  const usage = record?.usageState;
  return record && /^[a-f0-9]{64}$/.test(record.keyHash)
    && record.keyId === createFingerprint(record.keyHash) && record.keyFingerprint === record.keyId
    && Object.hasOwn(ROLE_HIERARCHY, record.role) && typeof record.tenantId === "string"
    && typeof record.createdAt === "string" && Number.isFinite(Date.parse(record.createdAt))
    && typeof record.revoked === "boolean" && usage
    && Number.isSafeInteger(usage.windowIndex) && usage.windowIndex >= -1
    && Number.isSafeInteger(usage.tokensUsed) && usage.tokensUsed >= 0
    && Number.isSafeInteger(usage.requestCount) && usage.requestCount >= 0
    && (usage.rateWindowIndex === undefined || (Number.isSafeInteger(usage.rateWindowIndex) && usage.rateWindowIndex >= -1))
    && (usage.rateWindowIndex === undefined || (Number.isSafeInteger(usage.rateRequestCount) && usage.rateRequestCount >= 0))
    && (!record.budget || (Number.isSafeInteger(record.budget.limitTokens) && record.budget.limitTokens > 0
      && Number.isSafeInteger(record.budget.windowMs) && record.budget.windowMs > 0
      && Number.isFinite(record.budget.softThreshold) && record.budget.softThreshold > 0 && record.budget.softThreshold <= 1))
    && (!record.rateLimit || (Number.isSafeInteger(record.rateLimit.requestsPerMinute) && record.rateLimit.requestsPerMinute > 0));
}

function accountingError(cause) {
  const error = new Error("Virtual key accounting storage is unavailable; repair storage before further requests.", { cause });
  error.code = "VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE";
  error.category = "internal";
  error.statusCode = 503;
  error.retryable = false;
  return error;
}

function persistRecords(storePath, keyStore) {
  if (!storePath) return;
  const payload = JSON.stringify(
    { version: 1, keys: [...keyStore.values()] },
    null,
    2,
  );
  const tempPath = `${storePath}.${randomBytes(12).toString("hex")}.tmp`;
  mkdirSync(dirname(storePath), { recursive: true });
  let created = false;
  let file;
  try {
    file = openSync(tempPath, "wx", 0o600);
    created = true;
    writeFileSync(file, `${payload}\n`, { encoding: "utf8" });
    fsyncSync(file);
    closeSync(file);
    file = undefined;
    renameSync(tempPath, storePath);
  } finally {
    if (file !== undefined) closeSync(file);
    if (created && existsSync(tempPath)) unlinkSync(tempPath);
  }
}

/**
 * 计算 API Key 的 SHA-256 哈希值
 */
function hashKey(rawKey) {
  return createHash("sha256").update(String(rawKey)).digest("hex");
}

/**
 * 从 hash 创建可安全显示的指纹
 */
function createFingerprint(keyHash) {
  return String(keyHash ?? "").slice(0, 12);
}

/**
 * 检查过期时间是否已过
 */
function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const timestamp = Date.parse(expiresAt);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

/**
 * 清洗记录，移除 hash 等敏感字段后返回
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
    budget: record.budget,
    rateLimit: record.rateLimit,
    // 不暴露 keyHash 和明文 key
    keyHashExposed: false,
    keyValueExposed: false,
  };
}
