// =============================================================================
// runtimeCredentialStore-sqlite.js — 运行时凭据存储的 SQLite 后端
// 替代 JSON 文件，提供 ACID + WAL，支持跨进程共享凭据。
// 注意：凭据为明文，创建后立即 chmod 0o600 限制为仅 owner 可读写。
// =============================================================================

import { DatabaseSync } from "node:sqlite";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * 创建运行时凭据存储的 SQLite 后端。
 * @param {string} dbPath - SQLite 数据库文件路径
 * @returns {{ loadRecords, saveRecords, close }}
 */
export function createSqliteCredentialBackend(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
  try { chmodSync(dirname(dbPath), 0o700); } catch { /* best effort on Windows */ }
  const db = new DatabaseSync(dbPath);
  // 明文凭据：收紧权限为仅 owner 可读写。
  try {
    chmodSync(dbPath, 0o600);
  } catch {
    // 非关键路径：权限收紧失败不阻塞存储。
  }
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA secure_delete = ON");
  try { db.exec("PRAGMA journal_mode = WAL"); } catch { /* ignore: WAL 是优化，多进程竞争可回退默认 */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      provider_id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )
  `);

  const selectAll = db.prepare("SELECT data FROM credentials");
  const deleteAll = db.prepare("DELETE FROM credentials");
  const insert = db.prepare("INSERT INTO credentials (provider_id, data) VALUES (?, ?)");
  const upsertStmt = db.prepare("INSERT OR REPLACE INTO credentials (provider_id, data) VALUES (?, ?)");
  const deleteOne = db.prepare("DELETE FROM credentials WHERE provider_id = ?");
  const countStmt = db.prepare("SELECT COUNT(*) AS c FROM credentials");

  function loadRecords() {
    return selectAll.all().map((row) => JSON.parse(row.data));
  }

  function saveRecords(records) {
    db.exec("BEGIN IMMEDIATE");
    try {
      deleteAll.run();
      for (const record of records) {
        insert.run(record.providerId, JSON.stringify(record));
      }
      db.exec("COMMIT");
      tightenDatabaseFiles();
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  // ── 原子操作（跨进程安全，避免全量覆盖的 lost update）──────────────────
  function upsert(record) {
    upsertStmt.run(record.providerId, JSON.stringify(record));
    tightenDatabaseFiles();
  }

  function remove(providerId) {
    const removed = deleteOne.run(providerId).changes > 0;
    tightenDatabaseFiles();
    return removed;
  }

  function count() {
    return countStmt.get().c;
  }

  function compact() {
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    db.exec("VACUUM");
    tightenDatabaseFiles();
  }

  function tightenDatabaseFiles() {
    for (const filePath of [dbPath, dbPath + "-wal", dbPath + "-shm"]) {
      if (!existsSync(filePath)) continue;
      try { chmodSync(filePath, 0o600); } catch { /* best effort on Windows */ }
    }
  }

  return {
    loadRecords,
    saveRecords,
    upsert,
    remove,
    count,
    compact,
    close: () => db.close(),
  };
}
