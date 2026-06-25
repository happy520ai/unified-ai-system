// =============================================================================
// sqliteRepository.js — SQLite 数据持久化层
// 使用 Node 22 内置 node:sqlite 模块
// =============================================================================

import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

/**
 * 创建 SQLite 持久化 Repository
 * @param {Object} [options]
 * @param {string} [options.dataDir] - 数据目录，默认 .data
 * @returns {Object} { plans, executions, evidence, appendAudit, readAuditLog, getHealth, close }
 */
export function createSqliteRepository(options = {}) {
  const dataDir = options.dataDir ?? resolve(process.cwd(), ".data");
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const dbPath = resolve(dataDir, "repository.db");
  const db = new DatabaseSync(dbPath);

  // 启用 WAL 模式以提升并发读性能
  db.exec("PRAGMA journal_mode = WAL");

  // ── 建表 ────────────────────────────────────────────────────────────────────

  db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      action TEXT,
      actor TEXT,
      detail TEXT,
      timestamp INTEGER NOT NULL
    )
  `);

  // ── 预编译语句 ──────────────────────────────────────────────────────────────

  const stmts = {
    insertPlan: db.prepare(
      "INSERT OR REPLACE INTO plans (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)"
    ),
    getPlan: db.prepare(
      "SELECT id, data, created_at, updated_at FROM plans WHERE id = ?"
    ),
    listPlans: db.prepare(
      "SELECT id, data, created_at, updated_at FROM plans ORDER BY created_at DESC"
    ),
    deletePlan: db.prepare("DELETE FROM plans WHERE id = ?"),

    insertExecution: db.prepare(
      "INSERT OR REPLACE INTO executions (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)"
    ),
    getExecution: db.prepare(
      "SELECT id, data, created_at, updated_at FROM executions WHERE id = ?"
    ),
    listExecutions: db.prepare(
      "SELECT id, data, created_at, updated_at FROM executions ORDER BY created_at DESC"
    ),
    deleteExecution: db.prepare("DELETE FROM executions WHERE id = ?"),

    insertEvidence: db.prepare(
      "INSERT OR REPLACE INTO evidence (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)"
    ),
    getEvidence: db.prepare(
      "SELECT id, data, created_at, updated_at FROM evidence WHERE id = ?"
    ),
    listEvidence: db.prepare(
      "SELECT id, data, created_at, updated_at FROM evidence ORDER BY created_at DESC"
    ),
    deleteEvidence: db.prepare("DELETE FROM evidence WHERE id = ?"),

    insertAudit: db.prepare(
      "INSERT INTO audit_log (id, action, actor, detail, timestamp) VALUES (?, ?, ?, ?, ?)"
    ),
    listAudit: db.prepare(
      "SELECT id, action, actor, detail, timestamp FROM audit_log ORDER BY timestamp DESC"
    ),
  };

  // ── 辅助函数 ──────────────────────────────────────────────────────────────

  /**
   * 将数据库行还原为业务记录
   * @param {object} row - SQLite 行 { id, data, created_at, updated_at }
   * @returns {object} 展开后的记录
   */
  function rowToRecord(row) {
    if (!row) return null;
    try {
      return { ...JSON.parse(row.data), id: row.id, createdAt: row.created_at, updatedAt: row.updated_at };
    } catch {
      return { id: row.id, createdAt: row.created_at, updatedAt: row.updated_at };
    }
  }

  // ── 通用 CRUD 操作工厂 ────────────────────────────────────────────────────

  /**
   * 创建基于 SQLite 预编译语句的 CRUD 存储
   * @param {string} tableName - 表名（用于日志和 ID 生成）
   * @param {object} prepared - 预编译语句 { insert, get, list, delete }
   * @returns {object} CRUD 接口
   */
  function createCrudStore(tableName, prepared) {
    return {
      async findById(id) {
        const row = prepared.get.get(id);
        return row ? rowToRecord(row) : null;
      },

      async findAll(filter = {}) {
        const rows = prepared.list.all();
        let results = rows.map(rowToRecord);

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
        const id = data.id ?? `${tableName}_${randomUUID()}`;
        const now = Date.now();
        const record = { ...data, id, createdAt: now, updatedAt: now };
        const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = record;
        prepared.insert.run(id, JSON.stringify(rest), now, now);
        return record;
      },

      async update(id, data) {
        const existing = prepared.get.get(id);
        if (!existing) return null;
        const base = rowToRecord(existing);
        const now = Date.now();
        const updated = { ...base, ...data, id, updatedAt: now };
        const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = updated;
        prepared.insert.run(id, JSON.stringify(rest), existing.created_at, now);
        return updated;
      },

      async delete(id) {
        const result = prepared.delete.run(id);
        return result.changes > 0;
      },

      async count(filter = {}) {
        const results = await this.findAll(filter);
        return results.length;
      },

      async exists(id) {
        const row = prepared.get.get(id);
        return !!row;
      },
    };
  }

  // ── 审计日志 ──────────────────────────────────────────────────────────────

  /**
   * 追加审计日志条目
   * @param {object} entry - { action, actor, detail, ... }
   */
  async function appendAudit(entry) {
    const id = randomUUID();
    const now = Date.now();
    stmts.insertAudit.run(
      id,
      entry.action ?? null,
      entry.actor ?? null,
      JSON.stringify(entry.detail ?? entry),
      now
    );
  }

  /**
   * 读取审计日志
   * @param {object} [filter]
   * @param {number} [filter.since] - 起始时间戳
   * @param {string} [filter.action] - 按动作过滤
   * @param {number} [filter.limit] - 返回条数上限，默认 100
   * @returns {object[]}
   */
  function readAuditLog(filter = {}) {
    const rows = stmts.listAudit.all();
    let logs = rows.map((row) => {
      let detail;
      try {
        detail = JSON.parse(row.detail);
      } catch {
        detail = row.detail;
      }
      return {
        id: row.id,
        action: row.action,
        actor: row.actor,
        detail,
        timestamp: row.timestamp,
      };
    });

    if (filter.since) logs = logs.filter((l) => l.timestamp >= filter.since);
    if (filter.action) logs = logs.filter((l) => l.action === filter.action);
    return logs.slice(0, filter.limit ?? 100);
  }

  // ── 健康检查 ──────────────────────────────────────────────────────────────

  /**
   * 获取 Repository 健康状态
   * @returns {object}
   */
  function getHealth() {
    const planCount = db.prepare("SELECT COUNT(*) AS count FROM plans").get().count;
    const executionCount = db.prepare("SELECT COUNT(*) AS count FROM executions").get().count;
    const evidenceCount = db.prepare("SELECT COUNT(*) AS count FROM evidence").get().count;
    const auditCount = db.prepare("SELECT COUNT(*) AS count FROM audit_log").get().count;

    return {
      type: "sqlite",
      dbPath,
      stores: {
        plans: planCount,
        executions: executionCount,
        evidence: evidenceCount,
        audit: auditCount,
      },
      status: "ready",
    };
  }

  // ── 关闭 ──────────────────────────────────────────────────────────────────

  /**
   * 关闭 SQLite 数据库连接
   */
  function close() {
    db.close();
  }

  // ── 返回 ──────────────────────────────────────────────────────────────────

  return {
    plans: createCrudStore("plans", {
      insert: stmts.insertPlan,
      get: stmts.getPlan,
      list: stmts.listPlans,
      delete: stmts.deletePlan,
    }),
    executions: createCrudStore("executions", {
      insert: stmts.insertExecution,
      get: stmts.getExecution,
      list: stmts.listExecutions,
      delete: stmts.deleteExecution,
    }),
    evidence: createCrudStore("evidence", {
      insert: stmts.insertEvidence,
      get: stmts.getEvidence,
      list: stmts.listEvidence,
      delete: stmts.deleteEvidence,
    }),
    appendAudit,
    readAuditLog,
    getHealth,
    close,
  };
}
