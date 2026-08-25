import { describe, expect, it } from "vitest";
import { createEnterpriseGovernanceService } from "../enterprise/enterpriseGovernanceService.js";
import { assertAuthenticatedNetworkBinding, isLoopbackAddress } from "./networkBindingPolicy.ts";

describe("network binding authentication policy", () => {
  it("blocks non-loopback binding without authentication", () => {
    expect(() => createEnterpriseGovernanceService({
      env: {
        AI_GATEWAY_SERVICE_HOST: "0.0.0.0",
      },
    })).toThrowError(expect.objectContaining({ code: "enterprise_auth_required_for_non_loopback" }));
    expect(() => assertAuthenticatedNetworkBinding({ host: "::", authEnabled: false })).toThrow();
  });

  it("allows loopback-only development and authenticated external binding", () => {
    expect(isLoopbackAddress("127.23.4.5")).toBe(true);
    expect(isLoopbackAddress("::1")).toBe(true);
    expect(isLoopbackAddress("::ffff:127.0.0.1")).toBe(true);
    expect(() => assertAuthenticatedNetworkBinding({ host: "127.0.0.1", authEnabled: false })).not.toThrow();
    expect(() => assertAuthenticatedNetworkBinding({ host: "0.0.0.0", authEnabled: true })).not.toThrow();
  });

  it("denies a non-loopback peer when local authentication is disabled", () => {
    const service = createEnterpriseGovernanceService({ env: {} });
    expect(service.authenticate({
      headers: {},
      socket: { remoteAddress: "10.0.0.25" },
    })).toMatchObject({
      authenticated: false,
      code: "enterprise_auth_required_for_remote_peer",
    });
  });
});
