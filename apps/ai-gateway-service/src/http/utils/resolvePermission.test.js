import { describe, expect, it } from "vitest";
import { resolvePermission } from "./enterpriseUtils.js";

describe("resolvePermission route → permission mapping", () => {
  it("maps the usage ledger summary to provider:read (observability)", () => {
    expect(resolvePermission("GET", "/usage/summary")).toBe("audit:read");
    expect(resolvePermission("GET", "/usage/logs")).toBe("audit:read");
  });

  it("keeps the cost summary consistent at provider:read", () => {
    expect(resolvePermission("GET", "/cost/summary")).toBe("audit:read");
  });

  it("maps dashboard/observability surfaces to dashboard:read", () => {
    expect(resolvePermission("GET", "/dashboard/status")).toBe("dashboard:read");
    expect(resolvePermission("GET", "/metrics")).toBe("dashboard:read");
    expect(resolvePermission("GET", "/observability/status")).toBe("dashboard:read");
  });

  it("falls back to route:unknown for unmapped paths", () => {
    expect(resolvePermission("GET", "/some/unmapped/route")).toBe("route:unknown");
  });

  it("keeps chat routes at chat:use", () => {
    expect(resolvePermission("POST", "/v1/chat/completions")).toBe("chat:use");
  });

  it("requires tenant administration for provider statement reconciliation", () => {
    expect(resolvePermission("POST", "/enterprise/provider-statement-reconciliation"))
      .toBe("user:admin");
  });

  it("maps credential and provider mutation routes to provider:write", () => {
    for (const path of [
      "/providers/runtime-credential/detect",
      "/providers/runtime-credential",
      "/provider-config/save",
      "/provider-config/test",
      "/models/import/preview",
      "/models/import/confirm",
      "/model-library/verify-dry-run",
      "/model-library/refresh",
      "/model-library/test-model",
      "/model-library/task-default",
      "/cache/write",
      "/cache/invalidate",
    ]) {
      expect(resolvePermission("POST", path), path).toBe("provider:write");
    }
  });

  it("keeps provider inventory and model-library reads at provider:read", () => {
    for (const path of [
      "/providers",
      "/provider-config/status",
      "/models/import/providers",
      "/model-library",
      "/model-library/usability-matrix",
      "/model-library/verification-plan",
    ]) {
      expect(resolvePermission("GET", path), path).toBe("provider:read");
    }
  });
});
