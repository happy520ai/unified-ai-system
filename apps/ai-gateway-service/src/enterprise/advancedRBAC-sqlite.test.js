import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAdvancedRBAC } from "./advancedRBAC.js";
import { createSqliteRbacBackend } from "./advancedRBAC-sqlite.js";

function rbacWithSqlite(dbPath) {
  const persistence = createSqliteRbacBackend(dbPath);
  return createAdvancedRBAC({ persistence });
}

describe("advancedRBAC — sqlite persistence", () => {
  it("persists custom roles, user roles and tenants across instances", () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "rbac-sqlite-")), "rbac.db");

    const rbac = rbacWithSqlite(dbPath);
    rbac.createRole("gpt_only", "GPT only", ["model:gpt-4o"]);
    rbac.assignRole("alice", "gpt_only");
    rbac.createTenant("t1", "Tenant One", { dailyRequests: 50 });

    // A second instance over the same SQLite file (simulates restart / another process).
    const rbac2 = rbacWithSqlite(dbPath);
    expect(rbac2.checkModelAccess("alice", "gpt-4o")).toBe(true);
    expect(rbac2.checkModelAccess("alice", "claude-3")).toBe(false);
    expect(rbac2.checkTenantQuota("t1", { dailyRequests: 51, dailyTokens: 0 }).allowed).toBe(false);
    expect(rbac2.listRoles().some((r) => r.id === "gpt_only")).toBe(true);
  });

  it("revoke is persisted", () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "rbac-sqlite-")), "rbac.db");

    const rbac = rbacWithSqlite(dbPath);
    rbac.assignRole("bob", "api_user");
    rbac.revokeRole("bob", "api_user");

    const rbac2 = rbacWithSqlite(dbPath);
    expect(rbac2.checkModelAccess("bob", "any-model")).toBe(false);
  });
});
