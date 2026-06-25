import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { createEnterpriseGovernanceService } from "./enterpriseGovernanceService.js";

describe("enterprise-governance-service", () => {
  let service;

  before(() => {
    service = createEnterpriseGovernanceService({ env: {} });
  });

  it("reports health as ready", () => {
    const h = service.getHealth();
    assert.equal(h.status, "ready");
    assert.equal(h.mode, "local-enterprise-governance");
    assert.ok(h.roles.includes("admin"));
    assert.ok(h.roles.includes("operator"));
    assert.ok(h.roles.includes("viewer"));
    assert.ok(h.roles.includes("auditor"));
  });

  it("lists roles with permissions", () => {
    const result = service.listRoles();
    assert.equal(Array.isArray(result.roles), true);
    const adminRole = result.roles.find((r) => r.role === "admin");
    assert.ok(adminRole !== undefined);
    assert.ok(adminRole.permissions.includes("*"));
    const operatorRole = result.roles.find((r) => r.role === "operator");
    assert.ok(operatorRole.permissions.includes("chat:use"));
  });

  it("authorizes public routes", () => {
    const decision = service.authorize(
      { method: "GET", headers: {} },
      { permission: "public" }
    );
    assert.equal(decision.allowed, true);
  });

  it("creates and lists users", () => {
    const result = service.upsertUser({
      userId: "test-user-1",
      tenantId: "default",
      role: "operator",
      token: "test-token-123",
    });
    assert.equal(result.user.userId, "test-user-1");
    assert.equal(result.user.role, "operator");

    const users = service.listUsers();
    assert.equal(users.users.some((u) => u.userId === "test-user-1"), true);

    service.revokeUser({ userId: "test-user-1" });
  });

  it("records audit entries", async () => {
    await service.recordAudit({
      outcome: "allowed",
      method: "GET",
      path: "/test",
      permission: "test:read",
      statusCode: 200,
      identity: { userId: "test" },
    });
    const audit = await service.listAudit({ limit: 10 });
    assert.ok(audit.entries.length > 0);
  });

  it("exports audit as JSONL", async () => {
    const exported = await service.exportAudit({ format: "jsonl", limit: 10 });
    assert.equal(exported.format, "jsonl");
    assert.equal(typeof exported.content, "string");
  });
});
