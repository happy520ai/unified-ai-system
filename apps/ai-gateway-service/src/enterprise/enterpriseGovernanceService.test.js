import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEnterpriseGovernanceService } from "./enterpriseGovernanceService.js";

function localRequest(method, url, headers = {}) {
  return {
    method,
    url,
    headers,
    socket: { remoteAddress: "127.0.0.1" },
  };
}

const defaultAdminIdentity = {
  userId: "test-admin",
  tenantId: "default",
  role: "admin",
};

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
    expect(h.unauthenticatedScope).toBe("loopback-fake-preview-only");
    expect(h.localPreview).toEqual(expect.objectContaining({
      enabled: true,
      role: "local_preview",
      permission: "local:preview",
      routePolicy: "explicit-protocol-allowlist",
    }));
  });

  it("exposes a minimal public health view without host storage paths", () => {
    const health = service.getPublicHealth();
    expect(health.status).toBe("ready");
    expect(health.userStore.pathExposed).toBe(false);
    expect(health.apiKeys.pathExposed).toBe(false);
    expect(health.audit.pathExposed).toBe(false);
    expect(JSON.stringify(health)).not.toContain("enterprise-audit.jsonl");
    expect(JSON.stringify(health)).not.toContain("users.json");
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
      localRequest("GET", "/health"),
      "public:read",
    );
    expect(decision.allowed).toBe(true);
  });

  it("uses a tenant-fixed, non-admin identity for unauthenticated local preview", () => {
    const authentication = service.authenticate(localRequest(
      "POST",
      "/v1/chat/completions",
      { "x-pme-tenant-id": "spoofed-tenant" },
    ));

    expect(authentication.authenticated).toBe(true);
    expect(authentication.disabled).toBe(true);
    expect(authentication.identity).toEqual({
      userId: "local-preview",
      tenantId: "local-preview",
      role: "local_preview",
      permissions: ["local:preview"],
    });
    expect(authentication.identity.permissions).not.toContain("*");
  });

  it("allows only explicit fake-provider protocol routes without authentication", () => {
    expect(service.authorize(
      localRequest("POST", "/v1/chat/completions"),
      "chat:use",
    ).allowed).toBe(true);
    expect(service.authorize(
      localRequest("GET", "/v1/models"),
      "provider:read",
    ).allowed).toBe(true);
  });

  it.each([
    ["POST", "/providers/runtime-credential", "provider:write"],
    ["POST", "/knowledge/load", "knowledge:write"],
    ["GET", "/enterprise/audit", "audit:read"],
    ["GET", "/metrics", "dashboard:read"],
    ["POST", "/workforce/run-local", "workflow:run"],
    ["POST", "/chat/rag", "chat:use"],
  ])("denies local unauthenticated privilege escalation through %s %s", (method, url, permission) => {
    const decision = service.authorize(localRequest(method, url), permission);
    expect(decision.allowed).toBe(false);
    expect(decision.statusCode).toBe(403);
    expect(decision.code).toBe("enterprise_local_preview_forbidden");
  });

  it("requires authentication for protocol calls outside fake-only mode", () => {
    const realModeService = createEnterpriseGovernanceService({
      env: { AI_GATEWAY_PROVIDER_MODE: "auto" },
    });
    const decision = realModeService.authorize(
      localRequest("POST", "/v1/chat/completions"),
      "chat:use",
    );

    expect(decision.allowed).toBe(false);
    expect(decision.statusCode).toBe(403);
    expect(decision.code).toBe("enterprise_auth_required_for_non_fake_mode");
    expect(realModeService.getHealth().unauthenticatedScope).toBe("public-routes-only");
  });

  it("rejects non-loopback peers before local preview authorization", () => {
    const decision = service.authorize({
      method: "POST",
      url: "/v1/chat/completions",
      headers: {},
      socket: { remoteAddress: "192.0.2.10" },
    }, "chat:use");

    expect(decision.allowed).toBe(false);
    expect(decision.statusCode).toBe(401);
    expect(decision.code).toBe("enterprise_auth_required_for_remote_peer");
  });

  it("binds admin identity to its credential tenant and rejects tenant-header forgery", () => {
    const adminService = createEnterpriseGovernanceService({
      env: {
        PME_ENTERPRISE_USERS_JSON: JSON.stringify([{
          token: "tenant-b-admin-token",
          userId: "tenant-b-admin",
          tenantId: "tenant-b",
          role: "admin",
        }]),
      },
    });

    const forged = adminService.authenticate(localRequest(
      "GET",
      "/enterprise/audit",
      {
        "x-pme-auth-token": "tenant-b-admin-token",
        "x-pme-tenant-id": "tenant-a",
      },
    ));

    expect(forged.authenticated).toBe(false);
    expect(forged.statusCode).toBe(403);
    expect(forged.code).toBe("enterprise_tenant_forbidden");
    expect(forged.identity.tenantId).toBe("tenant-b");

    const ownTenant = adminService.authenticate(localRequest(
      "GET",
      "/enterprise/audit",
      { "x-pme-auth-token": "tenant-b-admin-token" },
    ));
    expect(ownTenant.authenticated).toBe(true);
    expect(ownTenant.identity.tenantId).toBe("tenant-b");
  });

  it("creates and lists users", () => {
    const result = service.upsertUser({
      userId: "test-user-1",
      tenantId: "default",
      role: "operator",
      token: "test-token-123",
    }, defaultAdminIdentity);
    expect(result.user.userId).toBe("test-user-1");
    expect(result.user.role).toBe("operator");

    const users = service.listUsers(defaultAdminIdentity);
    expect(users.users.some((u) => u.userId === "test-user-1")).toBe(true);

    service.revokeUser({ userId: "test-user-1" }, defaultAdminIdentity);
  });

  it("records audit entries", async () => {
    await service.recordAudit({
      outcome: "allowed",
      method: "GET",
      path: "/test",
      permission: "test:read",
      statusCode: 200,
      identity: { userId: "test", tenantId: "default" },
    });
    const audit = await service.listAudit({ limit: 10, actorIdentity: defaultAdminIdentity });
    expect(audit.entries.length).toBeGreaterThan(0);
  });

  it("exports audit as JSONL", async () => {
    const exported = await service.exportAudit({
      format: "jsonl",
      limit: 10,
      actorIdentity: defaultAdminIdentity,
    });
    expect(exported.format).toBe("jsonl");
    expect(typeof exported.content).toBe("string");
  });
});

describe("enterprise audit durability", () => {
  it("persists every entry to a verifiable hash chain before returning", async () => {
    const root = mkdtempSync(join(tmpdir(), "enterprise-audit-durable-"));
    try {
      const service = createEnterpriseGovernanceService({
        env: { PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl") },
        auditLogPath: join(root, "enterprise-audit.jsonl"),
      });
      const entry = await service.recordAudit({
        outcome: "allowed",
        method: "GET",
        path: "/durable-test",
        permission: "audit:test",
        statusCode: 200,
        identity: { userId: "test", tenantId: "default" },
      });

      expect(entry.integrity).toEqual(expect.objectContaining({
        sequence: 1,
        hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        previousHash: "GENESIS",
      }));
      await expect(service.verifyAuditIntegrity()).resolves.toEqual(expect.objectContaining({
        valid: true,
        totalEntries: 1,
      }));
      expect(service.getHealth().audit).toEqual(expect.objectContaining({
        status: "ready",
        durable: true,
        totalFailures: 0,
      }));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed and exposes degraded health when durable audit cannot be written", async () => {
    const root = mkdtempSync(join(tmpdir(), "enterprise-audit-failure-"));
    const blockedParent = join(root, "not-a-directory");
    writeFileSync(blockedParent, "blocked", "utf8");
    try {
      const service = createEnterpriseGovernanceService({
        env: { PME_AUDIT_CHAIN_PATH: join(blockedParent, "audit-chain.jsonl") },
        auditLogPath: join(blockedParent, "enterprise-audit.jsonl"),
      });

      await expect(service.recordAudit({
        outcome: "allowed",
        method: "POST",
        path: "/must-not-proceed",
        permission: "workflow:run",
        statusCode: 200,
        identity: { userId: "test", tenantId: "default" },
      })).rejects.toMatchObject({
        code: "enterprise_audit_persistence_failed",
        category: "audit",
      });
      expect(service.getHealth().audit).toEqual(expect.objectContaining({
        status: "degraded",
        durable: false,
        totalFailures: 1,
        pendingWrites: 0,
      }));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
