// =============================================================================
// workforcePlanStore-sqlite.js — SQLite 存储后端（node:sqlite）
// 替代 JSON 文件的计划存储，提供 ACID 事务 + WAL，支持跨进程并发安全。
// =============================================================================

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { STORE_VERSION } from "./workforcePlanStore-constants.js";

/**
 * 创建 SQLite 计划存储后端，接口与 JSON 后端的 readStore/writeStore 一致。
 * @param {string} dbPath - SQLite 数据库文件路径
 * @returns {{ readStore, writeStore, close }}
 */
export function createSqliteStoreBackend(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  // 多进程并发打开同一库时，PRAGMA journal_mode 需排他锁，可能竞争失败。
  // busy_timeout 让写操作遇到锁时等待而非立即报 "database is locked"；
  // WAL 只是并发读优化、非正确性必需，失败则回退默认 journal 模式。
  try { db.exec("PRAGMA busy_timeout = 5000"); } catch { /* ignore */ }
  try { db.exec("PRAGMA journal_mode = WAL"); } catch { /* ignore */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      plan_id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )
  `);

  const selectAll = db.prepare("SELECT data FROM plans ORDER BY rowid DESC");
  const deleteAll = db.prepare("DELETE FROM plans");
  const insert = db.prepare("INSERT INTO plans (plan_id, data) VALUES (?, ?)");
  const upsertStmt = db.prepare("INSERT OR REPLACE INTO plans (plan_id, data) VALUES (?, ?)");
  const deleteOne = db.prepare("DELETE FROM plans WHERE plan_id = ?");
  const getOne = db.prepare("SELECT data FROM plans WHERE plan_id = ?");

  function readStore(_storePath) {
    const rows = selectAll.all();
    return {
      version: STORE_VERSION,
      updatedAt: null,
      plans: rows.map((row) => JSON.parse(row.data)),
    };
  }

  function writeStore(_storePath, store) {
    // 单事务整体替换（保留给一次性批量场景）。
    db.exec("BEGIN IMMEDIATE");
    try {
      deleteAll.run();
      for (const plan of store.plans) {
        insert.run(plan.planId ?? plan.id ?? "unknown", JSON.stringify(plan));
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  // ── 原子操作（跨进程安全，避免 read-modify-write 的 lost update）────────
  function upsert(plan) {
    // INSERT OR REPLACE：同 plan_id 覆盖旧值，且获得新 rowid（配合 ORDER BY rowid DESC 实现"最新在前"）。
    upsertStmt.run(plan.planId ?? plan.id ?? "unknown", JSON.stringify(plan));
  }

  function remove(planId) {
    return deleteOne.run(planId).changes > 0;
  }

  function get(planId) {
    const row = getOne.get(planId);
    return row ? JSON.parse(row.data) : null;
  }

  function listPlans() {
    return selectAll.all().map((row) => JSON.parse(row.data));
  }

  return {
    readStore,
    writeStore,
    upsert,
    remove,
    get,
    listPlans,
    close: () => db.close(),
  };
}
