import { describe, expect, it } from "vitest";

import { createConfiguredLocalClientProviderPolicyResolver } from "./localClientProviderPolicyConfig.ts";

const INPUT = Object.freeze({
  identity: Object.freeze({ tenantId: "tenant-a", subjectId: "operator-a" }),
  clientId: "desktop-agent",
});

describe("configured local-client provider policy resolver", () => {
  it("uses a secure server-owned default when no policy configuration exists", () => {
    const resolver = createConfiguredLocalClientProviderPolicyResolver({});
    const resolved = resolver.resolve(INPUT);
    expect(resolver.status).toMatchObject({
      version: 1,
      source: "secure-default",
      overrideCount: 0,
      requestBodyPolicyAccepted: false,
      defaultPolicyRevision: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(resolved).toEqual({
      policyRevision: resolver.status.defaultPolicyRevision,
      policy: {
        dataClass: "internal",
        maxFanout: 1,
        fusionAllowed: false,
      },
    });
    expect(Object.isFrozen(resolved.policy)).toBe(true);
  });

  it("resolves an exact tenant/client override without accepting subject or request policy authority", () => {
    const resolver = createConfiguredLocalClientProviderPolicyResolver({
      AI_GATEWAY_LOCAL_CLIENT_PROVIDER_POLICIES_JSON: JSON.stringify({
        version: 1,
        defaultPolicy: { dataClass: "internal", maxFanout: 1, fusionAllowed: false },
        overrides: [{
          tenantId: "tenant-a",
          clientId: "desktop-agent",
          policy: {
            dataClass: "confidential",
            allowedProviders: ["provider-alpha"],
            allowedRegions: ["cn-east"],
            maxFanout: 1,
            fusionAllowed: false,
            maxCostUsd: 0.2,
          },
        }],
      }),
    });
    const exact = resolver.resolve(INPUT);
    const otherTenant = resolver.resolve({
      identity: { tenantId: "tenant-b", subjectId: "operator-a" },
      clientId: "desktop-agent",
    });
    expect(resolver.status).toMatchObject({ source: "environment", overrideCount: 1 });
    expect(exact.policy).toMatchObject({
      dataClass: "confidential",
      allowedProviders: ["provider-alpha"],
      allowedRegions: ["cn-east"],
    });
    expect(otherTenant.policy).toMatchObject({ dataClass: "internal" });
    expect(exact.policyRevision).not.toBe(otherTenant.policyRevision);
    expect(Object.isFrozen(exact.policy.allowedProviders)).toBe(true);
  });

  it.each([
    "not-json",
    JSON.stringify({ version: 2, defaultPolicy: { dataClass: "internal" }, overrides: [] }),
    JSON.stringify({ version: 1, defaultPolicy: { dataClass: "secret" }, overrides: [] }),
    JSON.stringify({
      version: 1,
      defaultPolicy: { dataClass: "internal" },
      overrides: [
        { tenantId: "tenant-a", clientId: "desktop-agent", policy: { dataClass: "internal" } },
        { tenantId: "tenant-a", clientId: "desktop-agent", policy: { dataClass: "public" } },
      ],
    }),
    JSON.stringify({
      version: 1,
      defaultPolicy: { dataClass: "internal" },
      overrides: [],
      unknown: true,
    }),
  ])("fails closed for invalid policy configuration %#", (value) => {
    expect(() => createConfiguredLocalClientProviderPolicyResolver({
      AI_GATEWAY_LOCAL_CLIENT_PROVIDER_POLICIES_JSON: value,
    })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_PROVIDER_POLICY_CONFIG_INVALID",
      statusCode: 503,
    }));
  });

  it("rejects malformed resolver identity instead of falling back to another policy", () => {
    const resolver = createConfiguredLocalClientProviderPolicyResolver({});
    expect(() => resolver.resolve({
      identity: { tenantId: "tenant-a", subjectId: "operator-a" },
      clientId: "../../default",
    })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_PROVIDER_POLICY_CONFIG_INVALID",
    }));
    expect(() => resolver.resolve({
      identity: { tenantId: "tenant-a", subjectId: "operator-a" },
      clientId: "desktop-agent",
      policy: { dataClass: "public" },
    } as never)).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_PROVIDER_POLICY_CONFIG_INVALID",
    }));
  });
});
