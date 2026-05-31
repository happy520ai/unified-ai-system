import { describe, it, expect, beforeAll } from "vitest";
import { createEnterpriseGovernanceService } from "./enterpriseGovernanceService.js";

describe("enterprise-governance-service", () => {
  let service;

  beforeAll(() => {
    service = createEnterpriseGovernanceService({ env: {} });
  });

  it("reports health as ready", () => {
    const h = service.getHealth();
    expect(h.status).toBe("ready");
    expect(h.mode).toBe("local-enterprise-governance");
    expect(h.roles).toContain("admin");
    expect(h.roles).toContain("operator");
    expect(h.roles).toContain("viewer");
    expect(h.roles).toContain("auditor");
  });

  it("lists roles with permissions", () => {
    const result = service.listRoles();
    expect(Array.isArray(result.roles)).toBe(true);
    const adminRole = result.roles.find((r) => r.role === "admin");
    expect(adminRole).toBeDefined();
    expect(adminRole.permissions).toContain("*");
    const operatorRole = result.roles.find((r) => r.role === "operator");
    expect(operatorRole.permissions).toContain("chat:use");
  });

  it("authorizes public routes", () => {
    const decision = service.authorize(
      { method: "GET", headers: {} },
      { permission: "public" }
    );
    expect(decision.allowed).toBe(true);
  });

  it("creates and lists users", () => {
    const result = service.upsertUser({
      userId: "test-user-1",
      tenantId: "default",
      role: "operator",
      token: "test-token-123",
    });
    expect(result.user.userId).toBe("test-user-1");
    expect(result.user.role).toBe("operator");

    const users = service.listUsers();
    expect(users.users.some((u) => u.userId === "test-user-1")).toBe(true);

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
    expect(audit.entries.length).toBeGreaterThan(0);
  });

  it("exports audit as JSONL", async () => {
    const exported = await service.exportAudit({ format: "jsonl", limit: 10 });
    expect(exported.format).toBe("jsonl");
    expect(typeof exported.content).toBe("string");
  });
});
