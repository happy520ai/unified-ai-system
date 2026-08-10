import { describe, expect, it } from "vitest";
import { resolvePermission } from "./utils/enterpriseUtils.js";
import { isPublicRoute } from "./routeAccessPolicy.js";

describe("route access policy", () => {
  it.each([
    "/health/check",
    "/setup/readiness",
    "/auth/status",
  ])("keeps bootstrap read route public: %s", (pathname) => {
    expect(isPublicRoute(pathname)).toBe(true);
  });

  it.each([
    "/ui",
    "/console",
    "/approvals/create",
    "/local-operation/apply-approved",
    "/agent-runner/local-operation",
    "/provider-config/save",
    "/provider-config/test",
    "/model-library/test-model",
    "/real-capabilities/activate-five",
    "/chat-gateway/execute",
    "/three-mode/execute",
  ])("requires authorization for mutation route: %s", (pathname) => {
    expect(isPublicRoute(pathname)).toBe(false);
  });

  it("governs prompt enhancement with the existing chat permission", () => {
    expect(isPublicRoute("/prompts/enhance")).toBe(false);
    expect(resolvePermission("POST", "/prompts/enhance")).toBe("chat:use");
  });

  it("keeps A2A discovery public while governing task execution", () => {
    expect(isPublicRoute("/.well-known/agent-card.json")).toBe(true);
    expect(isPublicRoute("/a2a/jsonrpc")).toBe(false);
    expect(resolvePermission("POST", "/a2a/jsonrpc")).toBe("chat:use");
  });

  it("governs both OpenAI-compatible generation routes", () => {
    expect(resolvePermission("POST", "/v1/chat/completions")).toBe("chat:use");
    expect(resolvePermission("POST", "/v1/responses")).toBe("chat:use");
  });
});
