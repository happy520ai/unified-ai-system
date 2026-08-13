import { describe, expect, it } from "vitest";
import { resolvePermission } from "./enterpriseUtils.js";

describe("resolvePermission route → permission mapping", () => {
  it("maps the usage ledger summary to provider:read (observability)", () => {
    expect(resolvePermission("GET", "/usage/summary")).toBe("provider:read");
    expect(resolvePermission("GET", "/usage/logs")).toBe("provider:read");
  });

  it("keeps the cost summary consistent at provider:read", () => {
    expect(resolvePermission("GET", "/cost/summary")).toBe("provider:read");
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
});
