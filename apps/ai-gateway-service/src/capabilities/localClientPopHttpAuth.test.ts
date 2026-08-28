import { afterEach, describe, expect, it, vi } from "vitest";

import { createManagedLocalClientPopProofHeader } from "@unified-ai-system/shared-sdk";

import {
  LOCAL_CLIENT_POP_HTTP_AUTH_BOUNDARIES,
  LOCAL_CLIENT_POP_HTTP_ERROR_CODES,
  LOCAL_CLIENT_POP_HTTP_MAX_HEADER_BYTES,
  LocalClientPopHttpAuthError,
  createLocalClientPopHttpAuth,
  encodeLocalClientPopHttpProof,
  type LocalClientPopHttpAuthPort,
  type LocalClientPopHttpAuthRequest,
  type LocalClientPopHttpErrorCode,
  type LocalClientPopHttpTargetResolver,
} from "./localClientPopHttpAuth.ts";
import {
  createManagedLocalClientPopIdentityAuthority,
  deriveManagedLocalClientPopKey,
  type ManagedLocalClientPopIdentity,
  type ManagedLocalClientPopProof,
  type ManagedLocalClientPopRequestBinding,
} from "./localClientPopIdentityAuthority.ts";

const NOW_MS = 1_900_000_000_000;
const authorities: Array<ReturnType<typeof createManagedLocalClientPopIdentityAuthority>> = [];

afterEach(async () => {
  await Promise.all(authorities.splice(0).map((authority) => authority.close()));
});

describe("local-client PoP HTTP authentication", () => {
  it("accepts the exact WebCrypto proof header emitted by the public shared SDK", async () => {
    const sharedSecret = Buffer.alloc(32, 0x73);
    const sdkSecret = new Uint8Array(sharedSecret);
    const originalSdkSecret = new Uint8Array(sdkSecret);
    const exactBody = Buffer.from(
      '{"model":"managed","messages":[],"unified_ai":{"local_client_id":"sdk.desktop"}}',
      "utf8",
    );
    const originalBody = Buffer.from(exactBody);
    const tenantId = "tenant-sdk";
    const subjectId = "subject-sdk";
    const clientId = "sdk.desktop";
    const revision = 11;
    const path = "/v1/chat/completions?trace=sdk-compatibility";
    const derived = deriveManagedLocalClientPopKey({
      sharedSecret,
      tenantId,
      clientId,
    });
    const authority = createManagedLocalClientPopIdentityAuthority({
      key: derived.key,
      keyId: derived.keyId,
      maxReplayEntries: 64,
    });
    authorities.push(authority);
    try {
      const sdkProof = await createManagedLocalClientPopProofHeader({
        secret: sdkSecret,
        tenantId,
        subjectId,
        clientId,
        revision,
        method: "POST",
        path,
        bodyBytes: exactBody,
      });
      const auth = createLocalClientPopHttpAuth({
        authority,
        resolveVerifiedTarget: async () => verifiedTarget(clientId, revision),
      });

      await expect(auth.authenticate({
        authenticatedScope: { tenantId, subjectId },
        clientId,
        method: "POST",
        canonicalPathWithQuery: path,
        rawBody: exactBody,
        proofHeader: sdkProof.header,
      })).resolves.toMatchObject({
        verified: true,
        identity: { tenantId, subjectId, clientId, clientRevision: revision },
        issuedAtMs: sdkProof.issuedAtMs,
        expiresAtMs: sdkProof.expiresAtMs,
      });
      expect(sdkProof.keyId).toBe(derived.keyId);
      expect(sdkSecret).toEqual(originalSdkSecret);
      expect(exactBody).toEqual(originalBody);
    } finally {
      sharedSecret.fill(0);
      sdkSecret.fill(0);
      exactBody.fill(0);
      originalBody.fill(0);
      originalSdkSecret.fill(0);
    }
  });

  it("resolves the current verified revision before proof verification and returns bounded proof facts", async () => {
    const fixture = createFixture();
    const events: string[] = [];
    const resolver = vi.fn(async (input) => {
      events.push("resolve");
      return verifiedTarget(input.clientId, 7);
    });
    const verify = vi.fn(async (input) => {
      events.push("verify");
      return fixture.authority.verify(input);
    });
    const auth = createLocalClientPopHttpAuth({
      authority: { verify },
      resolveVerifiedTarget: resolver,
    });
    const proofHeader = await issueHeader(fixture.authority);
    const request = authRequest({ proofHeader });
    const originalBody = Buffer.from(request.rawBody);

    const result = await auth.authenticate(request);

    expect(events).toEqual(["resolve", "verify"]);
    expect(resolver).toHaveBeenCalledWith({
      identity: { tenantId: "tenant-a", subjectId: "operator-a" },
      clientId: "desktop.alpha",
    });
    expect(verify).toHaveBeenCalledWith(expect.objectContaining({
      expectedIdentity: identity(),
      request: {
        method: "POST",
        path: "/local-clients/heartbeat?source=managed-client",
        body: expect.any(Buffer),
      },
    }));
    expect(result).toEqual({
      verified: true,
      identity: identity(),
      proofFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      issuedAtMs: NOW_MS,
      expiresAtMs: NOW_MS + 10_000,
    });
    expect(Object.keys(result).sort()).toEqual([
      "expiresAtMs",
      "identity",
      "issuedAtMs",
      "proofFingerprint",
      "verified",
    ]);
    expect(request.rawBody).toEqual(originalBody);
    expect(auth.boundaries).toBe(LOCAL_CLIENT_POP_HTTP_AUTH_BOUNDARIES);
  });

  it.each([
    ["client", { clientId: "desktop.beta", rawBody: body("desktop.beta") }],
    ["revision", { targetRevision: 8 }],
    ["tenant", { authenticatedScope: { tenantId: "tenant-b", subjectId: "operator-a" } }],
    ["subject", { authenticatedScope: { tenantId: "tenant-a", subjectId: "operator-b" } }],
    ["path", { canonicalPathWithQuery: "/local-clients/feedback?source=tampered" }],
    ["body", { rawBody: body("desktop.alpha", "unhealthy") }],
    ["method", { method: "PUT" }],
  ])("rejects a proof replayed across %s binding", async (_name, rawOverride) => {
    const override = rawOverride as Partial<LocalClientPopHttpAuthRequest> & {
      targetRevision?: number;
    };
    const fixture = createFixture({ targetRevision: override.targetRevision ?? 7 });
    const proofHeader = await issueHeader(fixture.authority);
    const { targetRevision: _ignored, ...requestOverride } = override;

    await expectAuthCode(fixture.auth.authenticate(authRequest({
      proofHeader,
      ...requestOverride,
    })), "LOCAL_CLIENT_POP_HTTP_UNAUTHORIZED");
  });

  it("maps a consumed nonce replay to the same non-disclosing authorization error", async () => {
    const fixture = createFixture();
    const proofHeader = await issueHeader(fixture.authority);
    const request = authRequest({ proofHeader });

    await expect(fixture.auth.authenticate(request)).resolves.toMatchObject({ verified: true });
    await expectAuthCode(
      fixture.auth.authenticate(request),
      "LOCAL_CLIENT_POP_HTTP_UNAUTHORIZED",
    );
  });

  it("uses one identical error for missing, malformed, raw-body-unavailable, and unverified-target cases", async () => {
    const fixture = createFixture();
    const proofHeader = await issueHeader(fixture.authority);
    const unverifiedAuth = createLocalClientPopHttpAuth({
      authority: fixture.authority,
      resolveVerifiedTarget: async () => {
        throw Object.assign(new Error("target does not exist"), { code: "NOT_FOUND" });
      },
    });
    const declaredAuth = createLocalClientPopHttpAuth({
      authority: fixture.authority,
      resolveVerifiedTarget: async () => ({
        clientId: "desktop.alpha",
        revision: 7,
        state: "declared",
        trustDecision: "declared",
      } as never),
    });
    const attempts = [
      fixture.auth.authenticate(authRequest({ proofHeader: undefined as unknown as string })),
      fixture.auth.authenticate(authRequest({ proofHeader: "popv1.not*base64url" })),
      fixture.auth.authenticate(authRequest({ rawBody: undefined as unknown as Buffer, proofHeader })),
      fixture.auth.authenticate(authRequest({
        rawBody: new Uint8Array(body().buffer) as unknown as Buffer,
        proofHeader,
      })),
      unverifiedAuth.authenticate(authRequest({ proofHeader })),
      declaredAuth.authenticate(authRequest({ proofHeader })),
    ];

    const errors = await Promise.all(attempts.map(captureError));
    expect(errors).toHaveLength(6);
    for (const error of errors) {
      expect(error).toBeInstanceOf(LocalClientPopHttpAuthError);
      expect(error).toMatchObject({
        code: "LOCAL_CLIENT_POP_HTTP_UNAUTHORIZED",
        category: "auth",
        statusCode: 401,
        retryable: false,
        message: "Managed local-client proof authorization failed.",
      });
    }
  });

  it("encodes one bounded canonical popv1 header and rejects alternate JSON encodings", async () => {
    const fixture = createFixture();
    const proof = await issueProof(fixture.authority);
    const canonicalHeader = encodeLocalClientPopHttpProof(proof);
    expect(canonicalHeader).toMatch(/^popv1\.[A-Za-z0-9_-]+$/u);
    expect(Buffer.byteLength(canonicalHeader, "utf8")).toBeLessThanOrEqual(
      LOCAL_CLIENT_POP_HTTP_MAX_HEADER_BYTES,
    );
    await expect(fixture.auth.authenticate(authRequest({
      proofHeader: canonicalHeader,
    }))).resolves.toMatchObject({ verified: true });

    const nonCanonicalJson = JSON.stringify(proof, null, 1);
    const nonCanonicalHeader = `popv1.${Buffer.from(nonCanonicalJson).toString("base64url")}`;
    const freshFixture = createFixture();
    await expectAuthCode(freshFixture.auth.authenticate(authRequest({
      proofHeader: nonCanonicalHeader,
    })), "LOCAL_CLIENT_POP_HTTP_UNAUTHORIZED");
  });

  it("rejects duplicate-style, padded, oversized, and extra-field transports", async () => {
    const fixture = createFixture();
    const proof = await issueProof(fixture.authority);
    const canonical = encodeLocalClientPopHttpProof(proof);
    const extraFieldJson = canonicalJsonForTest({ ...proof, extra: true });
    const attempts = [
      fixture.auth.authenticate(authRequest({
        proofHeader: [canonical, canonical] as unknown as string,
      })),
      fixture.auth.authenticate(authRequest({ proofHeader: `${canonical}=` })),
      fixture.auth.authenticate(authRequest({
        proofHeader: `popv1.${"A".repeat(LOCAL_CLIENT_POP_HTTP_MAX_HEADER_BYTES)}`,
      })),
      fixture.auth.authenticate(authRequest({
        proofHeader: `popv1.${Buffer.from(extraFieldJson).toString("base64url")}`,
      })),
    ];
    for (const attempt of attempts) {
      await expectAuthCode(attempt, "LOCAL_CLIENT_POP_HTTP_UNAUTHORIZED");
    }
  });

  it("makes the encode helper reject a non-exact proof with an allowlisted transport error", async () => {
    const fixture = createFixture();
    const proof = await issueProof(fixture.authority);
    expect(() => encodeLocalClientPopHttpProof({
      ...proof,
      signature: "invalid",
    })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_POP_HTTP_TRANSPORT_INVALID",
      statusCode: 400,
    }));
    expect(() => encodeLocalClientPopHttpProof({
      ...proof,
      extra: true,
    } as ManagedLocalClientPopProof)).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_POP_HTTP_TRANSPORT_INVALID",
    }));
  });

  it("does not call target resolution when exact raw body bytes are unavailable", async () => {
    const fixture = createFixture();
    const resolver = vi.fn(async () => verifiedTarget("desktop.alpha", 7));
    const auth = createLocalClientPopHttpAuth({
      authority: fixture.authority,
      resolveVerifiedTarget: resolver,
    });
    const proofHeader = await issueHeader(fixture.authority);

    await expectAuthCode(auth.authenticate(authRequest({
      rawBody: null as unknown as Buffer,
      proofHeader,
    })), "LOCAL_CLIENT_POP_HTTP_UNAUTHORIZED");
    expect(resolver).not.toHaveBeenCalled();
  });

  it("rejects malformed integration dependencies with an allowlisted configuration error", () => {
    expect(() => createLocalClientPopHttpAuth({
      authority: {} as never,
      resolveVerifiedTarget: async () => verifiedTarget("desktop.alpha", 7),
    })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_POP_HTTP_CONFIGURATION_INVALID",
      statusCode: 503,
    }));
    expect(LOCAL_CLIENT_POP_HTTP_ERROR_CODES).toEqual([
      "LOCAL_CLIENT_POP_HTTP_CONFIGURATION_INVALID",
      "LOCAL_CLIENT_POP_HTTP_TRANSPORT_INVALID",
      "LOCAL_CLIENT_POP_HTTP_UNAUTHORIZED",
    ]);
  });
});

function createFixture(options: Readonly<{
  targetRevision?: number;
  resolver?: LocalClientPopHttpTargetResolver;
}> = {}) {
  const sourceKey = Buffer.alloc(32, 0x6b);
  const authority = createManagedLocalClientPopIdentityAuthority({
    key: sourceKey,
    keyId: "managed-client-pop-key-v1",
    proofTtlMs: 10_000,
    maxClockSkewMs: 1_000,
    maxReplayEntries: 64,
    now: () => NOW_MS,
  });
  authorities.push(authority);
  const resolver = options.resolver ?? (async (input) => (
    verifiedTarget(input.clientId, options.targetRevision ?? 7)
  ));
  return {
    authority,
    auth: createLocalClientPopHttpAuth({
      authority,
      resolveVerifiedTarget: resolver,
    }),
  };
}

function identity(
  override: Partial<ManagedLocalClientPopIdentity> = {},
): ManagedLocalClientPopIdentity {
  return Object.freeze({
    tenantId: "tenant-a",
    subjectId: "operator-a",
    clientId: "desktop.alpha",
    clientRevision: 7,
    ...override,
  });
}

function requestBinding(
  override: Partial<ManagedLocalClientPopRequestBinding> = {},
): ManagedLocalClientPopRequestBinding {
  return Object.freeze({
    method: "POST",
    path: "/local-clients/heartbeat?source=managed-client",
    body: body(),
    ...override,
  });
}

function authRequest(
  override: Partial<LocalClientPopHttpAuthRequest> = {},
): LocalClientPopHttpAuthRequest {
  return Object.freeze({
    authenticatedScope: Object.freeze({
      tenantId: "tenant-a",
      subjectId: "operator-a",
    }),
    clientId: "desktop.alpha",
    method: "POST",
    canonicalPathWithQuery: "/local-clients/heartbeat?source=managed-client",
    rawBody: body(),
    proofHeader: "missing-proof-fixture",
    ...override,
  });
}

function body(clientId = "desktop.alpha", healthStatus = "healthy"): Buffer {
  return Buffer.from(JSON.stringify({ clientId, healthStatus }), "utf8");
}

function verifiedTarget(clientId: string, revision: number) {
  return Object.freeze({
    descriptorVersion: "verified-local-client-adapter-target-v1",
    clientId,
    revision,
    state: "verified" as const,
    trustDecision: "verified" as const,
    adapter: Object.freeze({ id: "loopback.alpha", type: "loopback-http", version: "1.0.0" }),
    capabilityIds: Object.freeze(["local_application"]),
  });
}

async function issueProof(
  authority: ReturnType<typeof createManagedLocalClientPopIdentityAuthority>,
  identityOverride: Partial<ManagedLocalClientPopIdentity> = {},
  requestOverride: Partial<ManagedLocalClientPopRequestBinding> = {},
) {
  return authority.issue({
    identity: identity(identityOverride),
    request: requestBinding(requestOverride),
  });
}

async function issueHeader(
  authority: ReturnType<typeof createManagedLocalClientPopIdentityAuthority>,
  identityOverride: Partial<ManagedLocalClientPopIdentity> = {},
  requestOverride: Partial<ManagedLocalClientPopRequestBinding> = {},
) {
  return encodeLocalClientPopHttpProof(await issueProof(
    authority,
    identityOverride,
    requestOverride,
  ));
}

async function captureError(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
    return null;
  } catch (error) {
    return error;
  }
}

async function expectAuthCode(
  operation: Promise<unknown>,
  code: LocalClientPopHttpErrorCode,
): Promise<void> {
  const error = await captureError(operation);
  expect(error).toBeInstanceOf(LocalClientPopHttpAuthError);
  expect(error).toMatchObject({ code });
  expect(LOCAL_CLIENT_POP_HTTP_ERROR_CODES).toContain(code);
}

function canonicalJsonForTest(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJsonForTest).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJsonForTest(record[key])}`
  )).join(",")}}`;
}
