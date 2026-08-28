import { describe, expect, it } from "vitest";

import {
  LOCAL_CLIENT_PROTOCOL_PRINCIPAL_ENV,
  resolveLocalClientProtocolPrincipalConfiguration,
} from "./localClientProtocolPrincipalConfig.ts";

describe("local-client protocol principal configuration", () => {
  it("is disabled and non-authoritative by default", () => {
    const resolved = resolveLocalClientProtocolPrincipalConfiguration({});
    expect(resolved.status).toEqual({
      enabled: false,
      version: 1,
      bindingCount: 0,
      tenantCount: 0,
      identitiesRedacted: true,
      requestBodySelectsPrincipal: false,
    });
    expect(resolved.resolve({ tenantId: "tenant-a", userId: "subject-a" })).toBeNull();
  });

  it("binds one authenticated tenant and subject to one client without exposing identities", () => {
    const resolved = resolveLocalClientProtocolPrincipalConfiguration({
      [LOCAL_CLIENT_PROTOCOL_PRINCIPAL_ENV]: JSON.stringify({
        version: 1,
        bindings: [
          { tenantId: "tenant-a", subjectId: "subject-a", clientId: "desktop.alpha" },
          { tenantId: "tenant-b", subjectId: "subject-b", clientId: "desktop.beta" },
        ],
      }),
    });
    expect(resolved.resolve({ tenantId: "tenant-a", userId: "subject-a" }))
      .toEqual({ tenantId: "tenant-a", subjectId: "subject-a", clientId: "desktop.alpha" });
    expect(resolved.resolve({ tenantId: "tenant-a", userId: "subject-b" })).toBeNull();
    expect(resolved.status).toMatchObject({ enabled: true, bindingCount: 2, tenantCount: 2 });
    expect(JSON.stringify(resolved.status)).not.toContain("tenant-a");
    expect(JSON.stringify(resolved.status)).not.toContain("subject-a");
  });

  it.each([
    { version: 2, bindings: [] },
    { version: 1, bindings: [] },
    { version: 1, bindings: [{ tenantId: "tenant", subjectId: "subject", clientId: "Bad:Client" }] },
    { version: 1, bindings: [{ tenantId: "tenant", subjectId: "subject", clientId: "client-a", extra: true }] },
    {
      version: 1,
      bindings: [
        { tenantId: "tenant", subjectId: "subject", clientId: "client-a" },
        { tenantId: "tenant", subjectId: "subject", clientId: "client-b" },
      ],
    },
  ])("rejects ambiguous or non-canonical configuration %#", (document) => {
    expect(() => resolveLocalClientProtocolPrincipalConfiguration({
      [LOCAL_CLIENT_PROTOCOL_PRINCIPAL_ENV]: JSON.stringify(document),
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_PROTOCOL_PRINCIPAL_CONFIG_INVALID",
    }));
  });
});
