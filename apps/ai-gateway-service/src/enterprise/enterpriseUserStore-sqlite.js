// =============================================================================
// enterpriseUserStore-sqlite.js — 企业用户/令牌存储的 SQLite 后端
// 替代 JSON 文件，提供 ACID + WAL，支持跨进程共享认证状态。
// =============================================================================

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * 创建企业用户存储的 SQLite 后端，接口与 JSON 版 loadStoredUsers/saveStoredUsers 一致。
 * @param {string} dbPath - SQLite 数据库文件路径
 * @returns {{ loadStoredUsers, saveStoredUsers, close }}
 */
export function createSqliteUserStoreBackend(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try { db.exec("PRAGMA busy_timeout = 5000"); } catch { /* ignore */ }
  try { db.exec("PRAGMA journal_mode = WAL"); } catch { /* ignore: WAL 是优化，多进程竞争可回退默认 */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )
  `);

  const selectAll = db.prepare("SELECT data FROM users");
  const deleteAll = db.prepare("DELETE FROM users");
  const insert = db.prepare("INSERT INTO users (user_id, data) VALUES (?, ?)");
  const upsertStmt = db.prepare("INSERT OR REPLACE INTO users (user_id, data) VALUES (?, ?)");
  const deleteOne = db.prepare("DELETE FROM users WHERE user_id = ?");

  function loadStoredUsers() {
    const rows = selectAll.all();
    return rows.map((row) => JSON.parse(row.data));
  }

  function saveStoredUsers(_path, users) {
    db.exec("BEGIN IMMEDIATE");
    try {
      deleteAll.run();
      for (const user of users) {
        insert.run(user.userId ?? user.tokenHash ?? "unknown", JSON.stringify(user));
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  // ── 原子操作（跨进程安全，避免全量覆盖的 lost update）──────────────────
  function upsert(user) {
    upsertStmt.run(user.userId ?? user.tokenHash ?? "unknown", JSON.stringify(user));
  }

  function remove(userId) {
    return deleteOne.run(userId).changes > 0;
  }

  return {
    loadStoredUsers,
    saveStoredUsers,
    upsert,
    remove,
    close: () => db.close(),
  };
}
