// =============================================================================
// advancedRBAC-sqlite.js — 高级 RBAC 状态（角色/用户角色/租户）的 SQLite 后端
// 替代纯内存态，支持跨进程共享权限状态。
// =============================================================================

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * 创建 RBAC 状态的 SQLite 后端。
 * 只持久化"非内置"状态：自定义角色、用户-角色映射、租户。
 * 内置角色（super_admin/admin/...）每次启动由代码初始化，不落库。
 * @param {string} dbPath - SQLite 数据库文件路径
 * @returns {{ load, save, close }}
 */
export function createSqliteRbacBackend(dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  try { db.exec("PRAGMA busy_timeout = 5000"); } catch { /* ignore */ }
  try { db.exec("PRAGMA journal_mode = WAL"); } catch { /* ignore: WAL 是优化，多进程竞争可回退默认 */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_roles (
      role_id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT,
      role_id TEXT,
      PRIMARY KEY (user_id, role_id)
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      tenant_id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    )
  `);

  const selectRoles = db.prepare("SELECT data FROM custom_roles");
  const selectUserRoles = db.prepare("SELECT user_id, role_id FROM user_roles");
  const selectTenants = db.prepare("SELECT data FROM tenants");
  const upsertRoleStmt = db.prepare("INSERT OR REPLACE INTO custom_roles (role_id, data) VALUES (?, ?)");
  const deleteRoleStmt = db.prepare("DELETE FROM custom_roles WHERE role_id = ?");
  const upsertUserRoleStmt = db.prepare("INSERT OR REPLACE INTO user_roles (user_id, role_id) VALUES (?, ?)");
  const deleteUserRoleStmt = db.prepare("DELETE FROM user_roles WHERE user_id = ? AND role_id = ?");
  const upsertTenantStmt = db.prepare("INSERT OR REPLACE INTO tenants (tenant_id, data) VALUES (?, ?)");

  function load() {
    return {
      customRoles: selectRoles.all().map((row) => JSON.parse(row.data)),
      userRoles: selectUserRoles.all().map((row) => [row.user_id, row.role_id]),
      tenants: selectTenants.all().map((row) => JSON.parse(row.data)),
    };
  }

  function save({ customRoles, userRoles, tenants }) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("DELETE FROM custom_roles").run();
      db.prepare("DELETE FROM user_roles").run();
      db.prepare("DELETE FROM tenants").run();

      const insertRole = db.prepare("INSERT INTO custom_roles (role_id, data) VALUES (?, ?)");
      for (const role of customRoles) {
        insertRole.run(role.id, JSON.stringify(role));
      }
      const insertUserRole = db.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)");
      for (const [userId, roleId] of userRoles) {
        insertUserRole.run(userId, roleId);
      }
      const insertTenant = db.prepare("INSERT INTO tenants (tenant_id, data) VALUES (?, ?)");
      for (const tenant of tenants) {
        insertTenant.run(tenant.id, JSON.stringify(tenant));
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  // ── 原子操作（跨进程安全，避免全量覆盖的 lost update）──────────────────
  function upsertRole(role) { upsertRoleStmt.run(role.id, JSON.stringify(role)); }
  function removeRole(roleId) { deleteRoleStmt.run(roleId); }
  function addUserRole(userId, roleId) { upsertUserRoleStmt.run(userId, roleId); }
  function removeUserRole(userId, roleId) { deleteUserRoleStmt.run(userId, roleId); }
  function upsertTenant(tenant) { upsertTenantStmt.run(tenant.id, JSON.stringify(tenant)); }

  return {
    load,
    save,
    upsertRole,
    removeRole,
    addUserRole,
    removeUserRole,
    upsertTenant,
    close: () => db.close(),
  };
}
