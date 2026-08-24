import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEnterpriseGovernanceService } from "./enterpriseGovernanceService.js";

const tenantA = { userId: "tenant-a-admin", tenantId: "tenant-a", role: "admin" };
const tenantB = { userId: "tenant-b-admin", tenantId: "tenant-b", role: "admin" };

describe("enterprise control-plane tenant isolation", () => {
  it("binds managed users, audit reads, exports, and backup material to the actor tenant", async () => {
    const root = await mkdtemp(join(tmpdir(), "enterprise-tenant-isolation-"));
    const service = createEnterpriseGovernanceService({
      env: {
        PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"),
        PME_API_KEY_STORE_PATH: join(root, "keys.json"),
      },
      auditLogPath: join(root, "audit.jsonl"),
    });

    try {
      service.upsertUser({
        userId: "tenant-a-user",
        tenantId: "tenant-a",
        role: "viewer",
        token: "tenant-a-user-token",
      }, tenantA);
      service.upsertUser({
        userId: "tenant-b-user",
        tenantId: "tenant-b",
        role: "viewer",
        token: "tenant-b-user-token",
      }, tenantB);

      expect(service.listUsers(tenantB).users.map((user) => user.userId)).toEqual(["tenant-b-user"]);
      expect(service.listUsers(tenantB)).not.toHaveProperty("path");
      expect(() => service.upsertUser({
        userId: "forged-user",
        tenantId: "tenant-a",
        role: "admin",
        token: "forged-user-token",
      }, tenantB)).toThrowError(expect.objectContaining({
        code: "enterprise_user_tenant_forbidden",
        statusCode: 403,
      }));
      expect(() => service.revokeUser({ userId: "tenant-a-user" }, tenantB)).toThrowError(
        expect.objectContaining({ code: "enterprise_user_not_found" }),
      );

      const backupUsers = service.exportUsersForBackup(tenantB);
      expect(backupUsers.tenantId).toBe("tenant-b");
      expect(backupUsers.storedUsers.map((user) => user.userId)).toEqual(["tenant-b-user"]);

      await service.recordAudit({
        outcome: "allowed",
        method: "GET",
        path: "/tenant-a-secret-marker",
        permission: "audit:read",
        statusCode: 200,
        identity: tenantA,
      });
      await service.recordAudit({
        outcome: "allowed",
        method: "GET",
        path: "/tenant-b-visible-marker",
        permission: "audit:read",
        statusCode: 200,
        identity: tenantB,
      });

      await expect(service.listAudit({
        actorIdentity: tenantB,
        filters: { tenantId: "tenant-a" },
      })).rejects.toMatchObject({ code: "enterprise_audit_tenant_forbidden", statusCode: 403 });

      const listed = await service.listAudit({ actorIdentity: tenantB });
      expect(listed.entries.map((entry: { path?: string }) => entry.path)).toEqual(["/tenant-b-visible-marker"]);
      expect(listed).not.toHaveProperty("auditLogPath");

      const exported = await service.exportAudit({ format: "json", actorIdentity: tenantB });
      expect(exported.content).toContain("tenant-b-visible-marker");
      expect(exported.content).not.toContain("tenant-a-secret-marker");
      expect(exported).not.toHaveProperty("auditLogPath");

      await expect(service.exportAudit({ format: "json" })).rejects.toMatchObject({
        code: "enterprise_tenant_context_required",
        statusCode: 403,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
