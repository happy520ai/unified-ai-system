import { describe, expect, it, vi } from "vitest";

import {
  createLocalClientVerificationOwnershipGate,
} from "./localClientVerificationOwnership.ts";

const BINDINGS = Object.freeze([
  Object.freeze({ tenantId: "Tenant-A", clientId: "desktop.one", adapterId: "loopback.one" }),
  Object.freeze({ tenantId: "Tenant-B", clientId: "desktop.two", adapterId: "loopback.two" }),
]);

function declaration(tenantId = "Tenant-A", clientId = "desktop.one", adapterId = "loopback.one") {
  return {
    declarationVersion: "local-client-verification-declaration-v1",
    tenantId,
    clientId,
    revision: 1,
    state: "declared",
    enabled: true,
    adapter: { id: adapterId, type: "loopback-http", version: "1.0.0" },
    manifestSha256: "a".repeat(64),
    capabilityIds: ["local_application"],
  } as const;
}

function verified(clientId = "desktop.one", adapterId = "loopback.one") {
  return {
    descriptorVersion: "verified-local-client-adapter-target-v1",
    clientId,
    revision: 2,
    state: "verified",
    trustDecision: "verified",
    adapter: { id: adapterId, type: "loopback-http", version: "1.0.0" },
    capabilityIds: ["local_application"],
  } as const;
}

function fixture() {
  const readCurrent = vi.fn(async (scope, clientId) => declaration(scope.tenantId, clientId));
  const promoteExact = vi.fn(async () => ({ promoted: true }));
  const resolveVerifiedTarget = vi.fn(async (input) => verified(input.clientId));
  const gate = createLocalClientVerificationOwnershipGate({
    store: { readCurrent, promoteExact } as never,
    resolveVerifiedTarget,
    bindings: BINDINGS,
  });
  return { gate, readCurrent, promoteExact, resolveVerifiedTarget };
}

describe("local-client verification ownership gate", () => {
  it("allows each exact tenant/client/adapter binding without exposing ownership through request bodies", async () => {
    const setup = fixture();
    await expect(setup.gate.store.readCurrent(
      { tenantId: "Tenant-A", subjectId: "operator-a" },
      "desktop.one",
    )).resolves.toMatchObject({
      tenantId: "Tenant-A",
      clientId: "desktop.one",
      adapter: { id: "loopback.one" },
    });
    expect(setup.gate.status).toEqual({
      bindingCount: 2,
      tenantCount: 2,
      clientCount: 2,
      requestBodyOwnershipAccepted: false,
    });
  });

  it("hides cross-tenant, unknown-client and adapter-mismatched declarations", async () => {
    const setup = fixture();
    await expect(setup.gate.store.readCurrent(
      { tenantId: "Tenant-B", subjectId: "operator-b" },
      "desktop.one",
    )).resolves.toBeNull();
    await expect(setup.gate.store.readCurrent(
      { tenantId: "Tenant-A", subjectId: "operator-a" },
      "unknown.client",
    )).resolves.toBeNull();

    setup.readCurrent.mockResolvedValueOnce(declaration("Tenant-A", "desktop.one", "loopback.two"));
    await expect(setup.gate.store.readCurrent(
      { tenantId: "Tenant-A", subjectId: "operator-a" },
      "desktop.one",
    )).resolves.toBeNull();
  });

  it("permits promotion only for the exact configured owner and adapter", async () => {
    const setup = fixture();
    const validRequest = {
      scope: { tenantId: "Tenant-A", subjectId: "operator-a" },
      expected: declaration(),
      declarationFingerprint: "b".repeat(64),
      evidence: {
        evidenceVersion: "local-client-verification-evidence-v1",
        fingerprint: "c".repeat(64),
        verifiedAtMs: 1,
        expiresAtMs: 2,
      },
    } as const;
    await setup.gate.store.promoteExact(validRequest);
    expect(setup.promoteExact).toHaveBeenCalledOnce();

    await expect(setup.gate.store.promoteExact({
      ...validRequest,
      expected: declaration("Tenant-A", "desktop.one", "loopback.two"),
    })).resolves.toBeNull();
    expect(setup.promoteExact).toHaveBeenCalledOnce();
  });

  it("resolves verified targets only through the configured multi-client ownership map", async () => {
    const setup = fixture();
    await expect(setup.gate.resolveVerifiedTarget({
      identity: { tenantId: "Tenant-A", subjectId: "operator-a" },
      clientId: "desktop.one",
    })).resolves.toMatchObject({ clientId: "desktop.one", adapter: { id: "loopback.one" } });
    await expect(setup.gate.resolveVerifiedTarget({
      identity: { tenantId: "Tenant-B", subjectId: "operator-b" },
      clientId: "desktop.one",
    })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_VERIFIED_TARGET_NOT_FOUND",
      statusCode: 404,
    });
  });

  it("fails closed for duplicate owners and malformed configuration", () => {
    expect(() => createLocalClientVerificationOwnershipGate({
      store: { readCurrent: vi.fn(), promoteExact: vi.fn() } as never,
      resolveVerifiedTarget: vi.fn(),
      bindings: [BINDINGS[0]!, { ...BINDINGS[0]!, adapterId: "loopback.other" }],
    })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_VERIFICATION_OWNERSHIP_CONFIG_INVALID",
    }));
  });
});
