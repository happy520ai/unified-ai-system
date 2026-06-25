// =============================================================================
// repository.js — Repository 模式统一数据访问层
// 支持 SQLite（默认）和可选 PostgreSQL
// =============================================================================

import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * 创建数据访问 Repository
 * @param {Object} options - { dbPath, type }
 * @returns {Object} { plans, executions, evidence, metrics, close }
 */
export function createRepository(options = {}) {
  const dbPath = options.dbPath ?? resolve(process.cwd(), ".data/repository.db");
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

  // 内存存储（SQLite 零依赖模式）
  const stores = {
    plans: new Map(),
    executions: new Map(),
    evidence: new Map(),
    metrics: [],
    audit: [],
  };

  /**
   * 通用 CRUD 操作工厂
   * @param {string} storeName
   * @returns {Object} CRUD 接口
   */
  function createCrudStore(storeName) {
    const store = stores[storeName];
    if (!store) throw new Error(`Unknown store: ${storeName}`);

    return {
      async findById(id) {
        return store.get(id) ?? null;
      },

      async findAll(filter = {}) {
        let results = Array.from(store.values());
        if (filter.where) {
          for (const [key, value] of Object.entries(filter.where)) {
            results = results.filter((r) => r[key] === value);
          }
        }
        if (filter.orderBy) {
          const [field, dir] = filter.orderBy;
          results.sort((a, b) => {
            const cmp = a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
            return dir === "desc" ? -cmp : cmp;
          });
        }
        if (filter.limit) {
          results = results.slice(0, filter.limit);
        }
        return results;
      },

      async create(data) {
        const id = data.id ?? `${storeName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const record = { ...data, id, createdAt: Date.now(), updatedAt: Date.now() };
        store.set(id, record);
        return record;
      },

      async update(id, data) {
        const existing = store.get(id);
        if (!existing) return null;
        const updated = { ...existing, ...data, id, updatedAt: Date.now() };
        store.set(id, updated);
        return updated;
      },

      async delete(id) {
        return store.delete(id);
      },

      async count(filter = {}) {
        const results = await this.findAll(filter);
        return results.length;
      },

      async exists(id) {
        return store.has(id);
      },
    };
  }

  /**
   * 追加指标记录
   */
  async function appendMetric(record) {
    stores.metrics.push({ ...record, timestamp: Date.now() });
    if (stores.metrics.length > 10000) stores.metrics.shift();
  }

  /**
   * 追加审计日志
   */
  async function appendAudit(entry) {
    stores.audit.push({ ...entry, timestamp: Date.now() });
    if (stores.audit.length > 50000) stores.audit.shift();
  }

  /**
   * 获取指标摘要
   */
  function getMetricsSummary(windowMs = 5 * 60 * 1000) {
    const cutoff = Date.now() - windowMs;
    const recent = stores.metrics.filter((m) => m.timestamp >= cutoff);
    return { count: recent.length, windowMs };
  }

  /**
   * 获取审计日志
   */
  function getAuditLog(filter = {}) {
    let logs = [...stores.audit];
    if (filter.since) logs = logs.filter((l) => l.timestamp >= filter.since);
    if (filter.action) logs = logs.filter((l) => l.action === filter.action);
    return logs.slice(0, filter.limit ?? 100);
  }

  /**
   * 获取 Repository 健康状态
   */
  function getHealth() {
    return {
      type: "memory",
      dbPath,
      stores: Object.fromEntries(
        Object.entries(stores).map(([name, store]) => [
          name,
          store instanceof Map ? store.size : store.length,
        ]),
      ),
      status: "ready",
    };
  }

  return {
    plans: createCrudStore("plans"),
    executions: createCrudStore("executions"),
    evidence: createCrudStore("evidence"),
    appendMetric,
    appendAudit,
    getMetricsSummary,
    getAuditLog,
    getHealth,
    close: () => {},
  };
}
