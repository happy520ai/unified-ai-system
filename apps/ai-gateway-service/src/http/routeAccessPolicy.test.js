import { describe, expect, it } from "vitest";
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
});
