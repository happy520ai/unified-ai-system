import { describe, it, expect } from "vitest";
import { createEnterpriseGovernanceService } from "./enterpriseGovernanceService.js";

describe("enterprise-governance-extended", () => {
  it("creates user and retrieves by token", () => {
    const service = createEnterpriseGovernanceService({ env: {} });
    service.upsertUser({ userId: "test-1", tenantId: "t1", role: "operator", token: "tok-123" });
    const users = service.listUsers();
    expect(users.users.some((u) => u.userId === "test-1")).toBe(true);
    service.revokeUser({ userId: "test-1" });
  });

  it("exports users for backup without exposing tokens", () => {
    const service = createEnterpriseGovernanceService({ env: {} });
    service.upsertUser({ userId: "test-2", tenantId: "t1", role: "viewer", token: "tok-456" });
    const backup = service.exportUsersForBackup();
    expect(backup.tokenValuesExposed).toBe(false);
    expect(backup.configuredUsers.some((u) => u.userId === "test-2")).toBe(true);
    service.revokeUser({ userId: "test-2" });
  });

  it("records and exports audit as JSONL", async () => {
    const service = createEnterpriseGovernanceService({ env: {} });
    await service.recordAudit({ outcome: "allowed", method: "GET", path: "/test", permission: "test:read", statusCode: 200 });
    const exported = await service.exportAudit({ format: "jsonl", limit: 10 });
    expect(exported.format).toBe("jsonl");
    expect(typeof exported.content).toBe("string");
    expect(exported.content.length).toBeGreaterThan(0);
  });

  it("security readiness reports correctly", () => {
    const service = createEnterpriseGovernanceService({ env: {} });
    const readiness = service.getSecurityReadiness();
    expect(readiness.status).toBeDefined();
    expect(readiness.authEnabled).toBeDefined();
  });
});
