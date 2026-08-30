import { describe, expect, it } from "vitest";
import {
  evaluatePlatformControlPlaneAccess,
  isPlatformControlPlaneAccess,
  isPlatformControlPlaneMutation,
  resolvePlatformTenantId,
} from "./platformControlPlanePolicy.ts";

describe("platform control-plane policy", () => {
  it.each([
    ["POST", "/providers/runtime-credential"],
    ["POST", "/providers/onboarding/start"],
    ["POST", "/provider-config/save"],
    ["POST", "/models/import/confirm"],
    ["POST", "/model-library/refresh"],
    ["POST", "/real-capabilities/activate-five"],
    ["POST", "/v1/policies/create"],
    ["POST", "/v1/policies/activate"],
    ["DELETE", "/providers/acme"],
  ])("classifies global mutation %s %s", (method, pathname) => {
    expect(isPlatformControlPlaneMutation(method, pathname)).toBe(true);
  });

  it.each([
    ["GET", "/providers"],
    ["GET", "/model-library"],
    ["POST", "/v1/chat/completions"],
    ["PUT", "/enterprise/guardrails"],
  ])("does not capture tenant-local or read request %s %s", (method, pathname) => {
    expect(isPlatformControlPlaneMutation(method, pathname)).toBe(false);
  });

  it.each([
    ["GET", "/v1/policies/list"],
    ["GET", "/v1/governance/stats"],
    ["POST", "/v1/policies/create"],
  ])("protects global governance access %s %s", (method, pathname) => {
    expect(isPlatformControlPlaneAccess(method, pathname)).toBe(true);
    expect(evaluatePlatformControlPlaneAccess({
      method,
      pathname,
      identity: { tenantId: "tenant-b" },
      env: { PME_ENTERPRISE_PLATFORM_TENANT_ID: "platform" },
    })).toMatchObject({ required: true, allowed: false, code: "platform_tenant_mismatch" });
  });

  it("uses the explicit platform tenant before the authentication tenant", () => {
    expect(resolvePlatformTenantId({
      PME_ENTERPRISE_PLATFORM_TENANT_ID: "platform",
      PME_AUTH_TENANT_ID: "fallback",
    })).toBe("platform");
  });

  it("fails closed for a different or missing tenant", () => {
    const env = { PME_ENTERPRISE_PLATFORM_TENANT_ID: "platform" };
    expect(evaluatePlatformControlPlaneAccess({
      method: "POST",
      pathname: "/providers/runtime-credential",
      identity: { tenantId: "tenant-b" },
      env,
    })).toEqual({ required: true, allowed: false, code: "platform_tenant_mismatch" });
    expect(evaluatePlatformControlPlaneAccess({
      method: "POST",
      pathname: "/providers/runtime-credential",
      identity: null,
      env,
    })).toEqual({ required: true, allowed: false, code: "platform_tenant_required" });
  });

  it("allows only the configured platform tenant after normal RBAC", () => {
    expect(evaluatePlatformControlPlaneAccess({
      method: "POST",
      pathname: "/model-library/task-default",
      identity: { tenantId: "platform" },
      env: { PME_ENTERPRISE_PLATFORM_TENANT_ID: "platform" },
    })).toEqual({ required: true, allowed: true, code: null });
  });
});
