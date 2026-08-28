import { describe, expect, it, vi } from "vitest";

import {
  BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID,
  BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_TYPE,
} from "./localClientAdapterRegistry.ts";
import {
  LOCAL_CLIENT_VERIFICATION_DECLARATION_VERSION,
  LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION,
  LOCAL_CLIENT_VERIFICATION_PROBE_DESCRIPTOR_VERSION,
  LOCAL_CLIENT_VERIFICATION_PROMOTION_VERSION,
  createLocalClientVerificationService,
  type LocalClientVerificationDeclaration,
  type LocalClientVerificationEvidence,
  type LocalClientVerificationProbe,
  type LocalClientVerificationScope,
  type LocalClientVerificationStore,
  type VerifiedLocalClientPromotion,
  type VerifyLocalClientRequest,
} from "./localClientVerificationService.ts";

const NOW_MS = Date.parse("2026-08-28T10:00:00.000Z");
const MANIFEST_SHA256 = "a".repeat(64);
const EVIDENCE_FINGERPRINT = "b".repeat(64);
const SCOPE = Object.freeze({ tenantId: "tenant-a", subjectId: "subject-a" });
const ADAPTER = Object.freeze({
  id: "builtin.loopback.local-client",
  type: "loopback-http",
  version: "1.0.0",
});

describe("local client verification service", () => {
  it("promotes only an exact declared revision after a trusted fresh probe", async () => {
    const fixture = createFixture();
    const service = createService(fixture);

    const result = await service.verifyAndPromote(verificationRequest(), SCOPE);

    expect(result).toEqual({
      promotionVersion: LOCAL_CLIENT_VERIFICATION_PROMOTION_VERSION,
      descriptorVersion: "verified-local-client-adapter-target-v1",
      clientId: "fixture.local-client",
      revision: 8,
      state: "verified",
      trustDecision: "verified",
      adapter: ADAPTER,
      manifestSha256: MANIFEST_SHA256,
      capabilityIds: ["local_application", "terminal"],
      verification: evidence(),
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.adapter)).toBe(true);
    expect(Object.isFrozen(result.verification)).toBe(true);
    expect(fixture.probe.probe).toHaveBeenCalledOnce();
    expect(fixture.promoteCalls).toHaveLength(1);
    expect(fixture.promoteCalls[0]).toMatchObject({
      scope: SCOPE,
      expected: {
        tenantId: "tenant-a",
        clientId: "fixture.local-client",
        revision: 7,
        state: "declared",
        adapter: ADAPTER,
        manifestSha256: MANIFEST_SHA256,
      },
      evidence: evidence(),
    });
    expect(fixture.promoteCalls[0]?.declarationFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    const serialized = JSON.stringify(result);
    for (const forbidden of ["endpoint", "sharedSecret", "nonce", "signature", "responseBody", "tenant-a", "subject-a"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it.each([
    ["revision", { expectedRevision: 6 }],
    ["adapter", { expectedAdapter: { ...ADAPTER, version: "2.0.0" } }],
    ["manifest", { expectedManifestSha256: "c".repeat(64) }],
  ] as const)("rejects a stale expected %s before probing", async (_label, override) => {
    const fixture = createFixture();
    const service = createService(fixture);

    await expect(service.verifyAndPromote(verificationRequest(override), SCOPE)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_VERIFICATION_DECLARATION_STALE",
      category: "conflict",
      statusCode: 409,
    });
    expect(fixture.probe.probe).not.toHaveBeenCalled();
    expect(fixture.promoteCalls).toHaveLength(0);
  });

  it("re-reads after the network boundary and rejects a TOCTOU declaration change", async () => {
    const fixture = createFixture();
    fixture.probe.probe = vi.fn(async () => {
      fixture.current = declaration({ revision: 8 });
      return evidence();
    });
    const service = createService(fixture);

    await expect(service.verifyAndPromote(verificationRequest(), SCOPE)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_VERIFICATION_DECLARATION_STALE",
    });
    expect(fixture.promoteCalls).toHaveLength(0);
  });

  it("requires the atomic store CAS to reject a final promotion race", async () => {
    const fixture = createFixture({ rejectPromotion: true });
    const service = createService(fixture);

    await expect(service.verifyAndPromote(verificationRequest(), SCOPE)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_VERIFICATION_DECLARATION_STALE",
    });
    expect(fixture.probe.probe).toHaveBeenCalledOnce();
    expect(fixture.promoteCalls).toHaveLength(1);
  });

  it("allows exactly one promotion when two verification attempts race", async () => {
    const fixture = createFixture();
    let arrivals = 0;
    let release = () => {};
    const bothProbing = new Promise<void>((resolve) => {
      release = resolve;
    });
    fixture.probe.probe = vi.fn(async () => {
      arrivals += 1;
      if (arrivals === 2) release();
      await bothProbing;
      return evidence();
    });
    const service = createService(fixture);

    const results = await Promise.allSettled([
      service.verifyAndPromote(verificationRequest(), SCOPE),
      service.verifyAndPromote(verificationRequest(), SCOPE),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: expect.objectContaining({ code: "LOCAL_CLIENT_VERIFICATION_DECLARATION_STALE" }),
    });
  });

  it("fails closed when a store returns a different tenant row", async () => {
    const fixture = createFixture();
    fixture.current = declaration({ tenantId: "tenant-b" });
    const service = createService(fixture);

    await expect(service.verifyAndPromote(verificationRequest(), SCOPE)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_VERIFICATION_DECLARATION_NOT_FOUND",
      statusCode: 404,
    });
    expect(fixture.probe.probe).not.toHaveBeenCalled();
  });

  it("rejects caller transport overrides and requires an authenticated exact scope", async () => {
    const fixture = createFixture();
    const service = createService(fixture);
    const unsafeRequest = {
      ...verificationRequest(),
      endpoint: "http://attacker.invalid",
    } as unknown as VerifyLocalClientRequest;

    await expect(service.verifyAndPromote(unsafeRequest, SCOPE)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_VERIFICATION_REQUEST_INVALID",
    });
    await expect(service.verifyAndPromote(
      verificationRequest(),
      { tenantId: "tenant-a", subjectId: "" },
    )).rejects.toMatchObject({
      code: "LOCAL_CLIENT_VERIFICATION_SCOPE_REQUIRED",
    });
    expect(fixture.probe.probe).not.toHaveBeenCalled();
  });

  it("never accepts the built-in fake adapter as a verification probe", () => {
    const fixture = createFixture();
    const fakeProbe = probe({
      adapter: {
        id: BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID,
        type: BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_TYPE,
        version: "1.0.0",
      },
    });

    expect(() => createLocalClientVerificationService({
      store: fixture.store,
      probes: [fakeProbe],
      now: () => NOW_MS,
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_VERIFICATION_CONFIGURATION_INVALID",
    }));
  });

  it("rejects expired or overlong evidence before the atomic promotion", async () => {
    const fixture = createFixture();
    fixture.probe.probe = vi.fn(async () => evidence({
      verifiedAtMs: NOW_MS - 1_000,
      expiresAtMs: NOW_MS,
    }));
    const service = createService(fixture);

    await expect(service.verifyAndPromote(verificationRequest(), SCOPE)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_VERIFICATION_EVIDENCE_INVALID",
    });
    expect(fixture.promoteCalls).toHaveLength(0);
  });

  it("sanitizes probe failures instead of propagating raw errors", async () => {
    const fixture = createFixture();
    fixture.probe.probe = vi.fn(async () => {
      throw new Error("secret endpoint body token-123");
    });
    const service = createService(fixture);

    const error = await service.verifyAndPromote(verificationRequest(), SCOPE).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: "LOCAL_CLIENT_VERIFICATION_PROBE_FAILED",
      message: "The trusted local-client verification probe failed.",
      retryable: true,
    });
    expect(JSON.stringify(error)).not.toContain("token-123");
  });

  it("rejects a store promotion result that changes the attested identity", async () => {
    const fixture = createFixture({ promotionManifest: "d".repeat(64) });
    const service = createService(fixture);

    await expect(service.verifyAndPromote(verificationRequest(), SCOPE)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_VERIFICATION_PROMOTION_FAILED",
      category: "integrity",
    });
  });
});

type Fixture = ReturnType<typeof createFixture>;

function createService(fixture: Fixture) {
  return createLocalClientVerificationService({
    store: fixture.store,
    probes: [fixture.probe],
    maxEvidenceTtlMs: 60_000,
    now: () => NOW_MS,
  });
}

function createFixture(options: {
  rejectPromotion?: boolean;
  promotionManifest?: string;
} = {}) {
  const fixture = {
    current: declaration() as LocalClientVerificationDeclaration | null,
    promoteCalls: [] as Array<Parameters<LocalClientVerificationStore["promoteExact"]>[0]>,
    probe: probe(),
    store: null as unknown as LocalClientVerificationStore,
  };
  fixture.store = Object.freeze({
    async readCurrent(scope: LocalClientVerificationScope, clientId: string) {
      if (scope.tenantId !== "tenant-a" || clientId !== "fixture.local-client") return null;
      return fixture.current;
    },
    async promoteExact(request: Parameters<LocalClientVerificationStore["promoteExact"]>[0]) {
      fixture.promoteCalls.push(request);
      if (
        options.rejectPromotion
        || !fixture.current
        || fixture.current.tenantId !== request.expected.tenantId
        || fixture.current.clientId !== request.expected.clientId
        || fixture.current.revision !== request.expected.revision
        || fixture.current.adapter.id !== request.expected.adapter.id
        || fixture.current.adapter.type !== request.expected.adapter.type
        || fixture.current.adapter.version !== request.expected.adapter.version
        || fixture.current.manifestSha256 !== request.expected.manifestSha256
      ) {
        return null;
      }
      fixture.current = null;
      return promotion(
        request.expected,
        request.evidence,
        options.promotionManifest === undefined
          ? {}
          : { manifestSha256: options.promotionManifest },
      );
    },
  });
  return fixture;
}

function declaration(
  overrides: Partial<LocalClientVerificationDeclaration> = {},
): LocalClientVerificationDeclaration {
  return {
    declarationVersion: LOCAL_CLIENT_VERIFICATION_DECLARATION_VERSION,
    tenantId: "tenant-a",
    clientId: "fixture.local-client",
    revision: 7,
    state: "declared",
    enabled: true,
    adapter: ADAPTER,
    manifestSha256: MANIFEST_SHA256,
    capabilityIds: ["terminal", "local_application"],
    ...overrides,
  };
}

function evidence(
  overrides: Partial<LocalClientVerificationEvidence> = {},
): LocalClientVerificationEvidence {
  return {
    evidenceVersion: LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION,
    fingerprint: EVIDENCE_FINGERPRINT,
    verifiedAtMs: NOW_MS,
    expiresAtMs: NOW_MS + 30_000,
    ...overrides,
  };
}

function probe(
  overrides: Partial<LocalClientVerificationProbe["descriptor"]> = {},
): LocalClientVerificationProbe & { probe: ReturnType<typeof vi.fn> } {
  const descriptor = {
    descriptorVersion: LOCAL_CLIENT_VERIFICATION_PROBE_DESCRIPTOR_VERSION,
    assurance: "governed-hmac-sha256-loopback" as const,
    clientId: "fixture.local-client",
    adapter: ADAPTER,
    manifestSha256: MANIFEST_SHA256,
    ...overrides,
  };
  return {
    descriptor,
    probe: vi.fn(async () => evidence()),
  };
}

function promotion(
  declared: LocalClientVerificationDeclaration,
  verifiedEvidence: LocalClientVerificationEvidence,
  overrides: Partial<VerifiedLocalClientPromotion> = {},
): VerifiedLocalClientPromotion {
  return {
    promotionVersion: LOCAL_CLIENT_VERIFICATION_PROMOTION_VERSION,
    descriptorVersion: "verified-local-client-adapter-target-v1",
    clientId: declared.clientId,
    revision: declared.revision + 1,
    state: "verified",
    trustDecision: "verified",
    adapter: declared.adapter,
    manifestSha256: declared.manifestSha256,
    capabilityIds: declared.capabilityIds,
    verification: verifiedEvidence,
    ...overrides,
  };
}

function verificationRequest(
  overrides: Partial<VerifyLocalClientRequest> = {},
): VerifyLocalClientRequest {
  return {
    clientId: "fixture.local-client",
    expectedRevision: 7,
    expectedAdapter: ADAPTER,
    expectedManifestSha256: MANIFEST_SHA256,
    signal: new AbortController().signal,
    ...overrides,
  };
}
