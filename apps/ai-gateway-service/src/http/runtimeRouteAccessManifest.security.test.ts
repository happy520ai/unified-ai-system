import { describe, expect, it, vi } from "vitest";
import { createAuthRoutes } from "./routes/authRoutes.js";
import { isPublicRoute } from "./routeAccessPolicy.js";
import { shouldRejectUnmappedRoute } from "./runtimeRouteAccessManifest.ts";
import { resolvePermission } from "./utils/enterpriseUtils.js";

const EXPECTED_RUNTIME_PERMISSIONS = [
  ["GET", "/workbench/feature-status", "dashboard:read"],
  ["GET", "/approvals", "workflow:run"],
  ["POST", "/approvals/create", "workflow:run"],
  ["POST", "/approvals/audit-1/approve", "workflow:approve"],
  ["POST", "/approvals/audit-1/reject", "workflow:approve"],
  ["POST", "/local-operation/apply-approved", "workflow:approve"],
  ["POST", "/file-context/select", "workflow:run"],
  ["GET", "/plugin-registry", "provider:read"],
  ["GET", "/real-capabilities/status", "dashboard:read"],
  ["GET", "/chat-gateway/task-matrix", "dashboard:read"],
  ["GET", "/chat-gateway/evidence/audit-1", "audit:read"],
  ["GET", "/chat-gateway/latency-policy", "dashboard:read"],
  ["GET", "/workbench/diagnostics/status", "dashboard:read"],
  ["POST", "/chat-gateway/execute", "chat:use"],
  ["POST", "/chat/gateway", "chat:use"],
  ["POST", "/three-mode/execute", "workflow:run"],
  ["POST", "/chat-gateway/dry-run-task", "chat:use"],
  ["POST", "/chat-gateway/latency-dry-run", "chat:use"],
  ["POST", "/connectors/feishu/send", "connector:write"],
  ["POST", "/connectors/wecom/send", "connector:write"],
  ["POST", "/runtime-candidate/codex-exec-crs/dry-run-smoke", "workflow:run"],
  ["POST", "/runtime-candidate/codex-exec-crs/guarded-one-shot", "workflow:run"],
  ["POST", "/runtime-candidate/codex-exec-crs/reliability", "workflow:run"],
] as const;

describe("runtime route authorization boundary", () => {
  it.each(EXPECTED_RUNTIME_PERMISSIONS)("maps %s %s to %s", (method, pathname, permission) => {
    expect(resolvePermission(method, pathname)).toBe(permission);
  });

  it("keeps the liveness probe public without exposing mutation routes", () => {
    expect(isPublicRoute("/livez")).toBe(true);
    expect(resolvePermission("GET", "/livez")).toBe("public:read");
    expect(isPublicRoute("/workbench/diagnostics/status")).toBe(false);
  });

  it("rejects unknown routes even when enterprise authorization allowed a wildcard identity", () => {
    expect(shouldRejectUnmappedRoute({
      isPublic: false,
      permission: resolvePermission("POST", "/future/unmapped/admin-action"),
      authorizationAllowed: true,
    })).toBe(true);
  });

  it("does not retain admin/changeme as implicit development credentials", async () => {
    const signToken = vi.fn(() => "must-not-be-issued");
    const response = { statusCode: 0, payload: null as unknown };
    const helpers = {
      readJson: vi.fn(),
      writeJson: (_res: unknown, statusCode: number, payload: unknown) => {
        response.statusCode = statusCode;
        response.payload = payload;
      },
      writeServiceLog: vi.fn(),
      createOkEnvelope: (data: unknown) => ({ ok: true, data }),
      createErrorEnvelope: (code: string, message: string) => ({ ok: false, error: { code, message } }),
    };
    const { handlers } = createAuthRoutes({
      authTokenService: {
        authenticateUser: () => ({ success: false }),
        signToken,
      },
    }, helpers, {});

    const route = handlers.get("POST /auth/login");
    expect(route).toBeDefined();
    await route!.handler({}, {}, {
      startedAt: Date.now(),
      body: { username: "admin", password: "changeme" },
    });

    expect(response.statusCode).toBe(401);
    expect(signToken).not.toHaveBeenCalled();
    expect(JSON.stringify(response.payload)).not.toContain("must-not-be-issued");
  });
});
