import { describe, expect, it } from "vitest";
import { createAdvancedRBAC } from "./advancedRBAC.js";

describe("advancedRBAC — roles and permissions", () => {
  it("checks exact permissions and wildcard expansion", () => {
    const rbac = createAdvancedRBAC();
    rbac.assignRole("u1", "developer");
    // developer has "model:use" and "prompt:*"
    expect(rbac.checkPermission("u1", "model:use")).toBe(true);
    expect(rbac.checkPermission("u1", "prompt:enhance")).toBe(true);
    expect(rbac.checkPermission("u1", "audit:read")).toBe(false);
  });

  it("grants super_admin the wildcard permission", () => {
    const rbac = createAdvancedRBAC();
    rbac.assignRole("u1", "super_admin");
    expect(rbac.checkPermission("u1", "anything:at:all")).toBe(true);
  });

  it("accumulates permissions across multiple roles and revokes cleanly", () => {
    const rbac = createAdvancedRBAC();
    rbac.assignRole("u1", "viewer");
    rbac.assignRole("u1", "api_user");
    expect(rbac.checkPermission("u1", "endpoint:chat")).toBe(true);
    expect(rbac.checkPermission("u1", "audit:read")).toBe(true);

    rbac.revokeRole("u1", "api_user");
    expect(rbac.checkPermission("u1", "endpoint:chat")).toBe(false);
  });
});

describe("advancedRBAC — model and endpoint access", () => {
  it("grants model access via model:use or a specific model permission", () => {
    const rbac = createAdvancedRBAC();
    rbac.assignRole("u1", "api_user"); // has model:use
    expect(rbac.checkModelAccess("u1", "gpt-4o")).toBe(true);

    const rbac2 = createAdvancedRBAC();
    rbac2.createRole("gpt_only", "GPT only", ["model:gpt-4o"]);
    rbac2.assignRole("u2", "gpt_only");
    expect(rbac2.checkModelAccess("u2", "gpt-4o")).toBe(true);
    expect(rbac2.checkModelAccess("u2", "claude-3")).toBe(false);
  });

  it("checks endpoint access with wildcard", () => {
    const rbac = createAdvancedRBAC();
    rbac.assignRole("u1", "admin"); // has endpoint:*
    expect(rbac.checkEndpointAccess("u1", "chat")).toBe(true);
  });
});

describe("advancedRBAC — tenant quotas", () => {
  it("enforces daily request and token limits", () => {
    const rbac = createAdvancedRBAC();
    rbac.createTenant("t1", "Tenant One", { dailyRequests: 100, dailyTokens: 1000 });

    expect(rbac.checkTenantQuota("t1", { dailyRequests: 50, dailyTokens: 500 }).allowed).toBe(true);
    expect(rbac.checkTenantQuota("t1", { dailyRequests: 101, dailyTokens: 500 }).allowed).toBe(false);
    expect(rbac.checkTenantQuota("t1", { dailyRequests: 50, dailyTokens: 1001 }).allowed).toBe(false);
  });

  it("allows unknown tenants by default", () => {
    const rbac = createAdvancedRBAC();
    expect(rbac.checkTenantQuota("missing", { dailyRequests: 999999 }).allowed).toBe(true);
  });

  it("tracks role and tenant counts", () => {
    const rbac = createAdvancedRBAC();
    rbac.assignRole("u1", "developer");
    rbac.createTenant("t1", "Tenant One");
    const stats = rbac.getStats();
    expect(stats.roles).toBe(5); // five built-in roles
    expect(stats.users).toBe(1);
    expect(stats.tenants).toBe(1);
  });
});
