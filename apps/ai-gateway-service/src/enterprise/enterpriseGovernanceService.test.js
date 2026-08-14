import { describe, it, expect, beforeAll } from "vitest";
import { createEnterpriseGovernanceService } from "./enterpriseGovernanceService.js";

function localRequest(method, url, headers = {}) {
  return {
    method,
    url,
    headers,
    socket: { remoteAddress: "127.0.0.1" },
  };
}

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
