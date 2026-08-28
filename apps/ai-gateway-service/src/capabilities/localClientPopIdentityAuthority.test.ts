import { describe, expect, it } from "vitest";

import {
  LOCAL_CLIENT_POP_ERROR_CODES,
  LocalClientPopAuthorityError,
  MANAGED_LOCAL_CLIENT_POP_BOUNDARIES,
  MANAGED_LOCAL_CLIENT_POP_PROOF_VERSION,
  createManagedLocalClientPopIdentityAuthority,
  deriveManagedLocalClientPopKey,
  type LocalClientPopErrorCode,
  type ManagedLocalClientPopIdentity,
  type ManagedLocalClientPopProof,
  type ManagedLocalClientPopReplayGuard,
  type ManagedLocalClientPopRequestBinding,
} from "./localClientPopIdentityAuthority.ts";

const BASE_NOW_MS = 1_900_000_000_000;
const PROOF_TTL_MS = 10_000;
const MAX_CLOCK_SKEW_MS = 1_000;

describe("managed local-client PoP identity authority", () => {
  it("domain-separates one authority key per tenant and client without consuming the adapter secret", () => {
    const sharedSecret = Buffer.alloc(32, 0x44);
    const first = deriveManagedLocalClientPopKey({
      sharedSecret,
      tenantId: "tenant-a",
      clientId: "desktop.alpha",
    });
    const same = deriveManagedLocalClientPopKey({
      sharedSecret,
      tenantId: "tenant-a",
      clientId: "desktop.alpha",
    });
    const otherClient = deriveManagedLocalClientPopKey({
      sharedSecret,
      tenantId: "tenant-a",
      clientId: "desktop.beta",
    });

    expect(first.key).toEqual(same.key);
    expect(first.keyId).toBe(same.keyId);
    expect(first.key).not.toEqual(otherClient.key);
    expect(first.keyId).not.toBe(otherClient.keyId);
    expect(first.keyId).toMatch(/^lcpop-[a-f0-9]{24}$/u);
    expect(sharedSecret.every((byte) => byte === 0x44)).toBe(true);
    first.key.fill(0);
    same.key.fill(0);
    otherClient.key.fill(0);
    sharedSecret.fill(0);
  });

  it("issues a redacted proof and verifies it only with trusted identity and request context", async () => {
    const harness = createHarness();
    expect(harness.sourceKey.every((byte) => byte === 0)).toBe(true);

    const proof = await harness.authority.issue({
      identity: identity(),
      request: requestBinding(),
    });

    expect(proof).toMatchObject({
      proofVersion: MANAGED_LOCAL_CLIENT_POP_PROOF_VERSION,
      keyId: "managed-client-pop-key-v1",
      issuedAtMs: BASE_NOW_MS,
      expiresAtMs: BASE_NOW_MS + PROOF_TTL_MS,
    });
    expect(proof.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(proof.signature).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(proof)).not.toContain("tenant-a");
    expect(JSON.stringify(proof)).not.toContain("operator-a");
    expect(JSON.stringify(proof)).not.toContain("desktop.alpha");
    expect(JSON.stringify(proof)).not.toContain("/local-clients/heartbeat");
    expect(JSON.stringify(proof)).not.toContain("healthStatus");

    await expect(harness.authority.verify({
      expectedIdentity: identity(),
      request: requestBinding(),
      proof,
    })).resolves.toMatchObject({
      verified: true,
      identity: identity(),
      issuedAtMs: BASE_NOW_MS,
      expiresAtMs: BASE_NOW_MS + PROOF_TTL_MS,
      proofFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });

    expect(harness.authority.status).toMatchObject({
      available: true,
      closed: false,
      keyId: "managed-client-pop-key-v1",
      replayGuard: {
        available: true,
        durable: false,
        distributed: false,
        mode: "single-process-memory",
      },
      boundaries: MANAGED_LOCAL_CLIENT_POP_BOUNDARIES,
    });
    await harness.authority.close();
  });

  it.each([
    ["tenant", { tenantId: "tenant-b" }],
    ["subject", { subjectId: "operator-b" }],
    ["client", { clientId: "desktop.beta" }],
    ["revision", { clientRevision: 8 }],
  ])("rejects a proof replayed across %s identity", async (_name, override) => {
    const harness = createHarness();
    const proof = await issue(harness.authority);

    await expectCode(harness.authority.verify({
      expectedIdentity: identity(override),
      request: requestBinding(),
      proof,
    }), "LOCAL_CLIENT_POP_PROOF_INVALID");
    await harness.authority.close();
  });

  it.each([
    ["body", requestBinding({ body: Buffer.from('{"healthStatus":"unhealthy"}', "utf8") })],
    ["method", requestBinding({ method: "PUT" })],
    ["path", requestBinding({ path: "/local-clients/feedback?source=tampered" })],
  ])("rejects %s tampering", async (_name, tamperedRequest) => {
    const harness = createHarness();
    const proof = await issue(harness.authority);

    await expectCode(harness.authority.verify({
      expectedIdentity: identity(),
      request: tamperedRequest,
      proof,
    }), "LOCAL_CLIENT_POP_PROOF_INVALID");
    await harness.authority.close();
  });

  it("rejects an expired otherwise-valid proof", async () => {
    const harness = createHarness();
    const proof = await issue(harness.authority);
    harness.setNow(proof.expiresAtMs);

    await expectCode(harness.authority.verify({
      expectedIdentity: identity(),
      request: requestBinding(),
      proof,
    }), "LOCAL_CLIENT_POP_PROOF_EXPIRED");
    await harness.authority.close();
  });

  it("rejects an otherwise-valid proof issued beyond the clock-skew window", async () => {
    const harness = createHarness();
    const proof = await issue(harness.authority);
    harness.setNow(proof.issuedAtMs - MAX_CLOCK_SKEW_MS - 1);

    await expectCode(harness.authority.verify({
      expectedIdentity: identity(),
      request: requestBinding(),
      proof,
    }), "LOCAL_CLIENT_POP_PROOF_NOT_YET_VALID");
    await harness.authority.close();
  });

  it("atomically consumes a nonce once and rejects replay", async () => {
    const harness = createHarness();
    const proof = await issue(harness.authority);
    const verifyRequest = {
      expectedIdentity: identity(),
      request: requestBinding(),
      proof,
    } as const;

    await expect(harness.authority.verify(verifyRequest)).resolves.toMatchObject({
      verified: true,
    });
    await expectCode(
      harness.authority.verify(verifyRequest),
      "LOCAL_CLIENT_POP_NONCE_REPLAYED",
    );
    await harness.authority.close();
  });

  it("allows only one concurrent verifier to consume the same nonce", async () => {
    const harness = createHarness();
    const proof = await issue(harness.authority);
    const verifyRequest = {
      expectedIdentity: identity(),
      request: requestBinding(),
      proof,
    } as const;

    const results = await Promise.allSettled([
      harness.authority.verify(verifyRequest),
      harness.authority.verify(verifyRequest),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: { code: "LOCAL_CLIENT_POP_NONCE_REPLAYED" },
    });
    await harness.authority.close();
  });

  it("fails closed across key material and key-id rotation", async () => {
    const oldHarness = createHarness({ keyByte: 0x11, keyId: "pop-key-old" });
    const proof = await issue(oldHarness.authority);
    const differentKey = createHarness({ keyByte: 0x22, keyId: "pop-key-old" });
    const differentKeyId = createHarness({ keyByte: 0x11, keyId: "pop-key-new" });
    const verifyRequest = {
      expectedIdentity: identity(),
      request: requestBinding(),
      proof,
    } as const;

    await expectCode(
      differentKey.authority.verify(verifyRequest),
      "LOCAL_CLIENT_POP_PROOF_INVALID",
    );
    await expectCode(
      differentKeyId.authority.verify(verifyRequest),
      "LOCAL_CLIENT_POP_PROOF_INVALID",
    );

    await oldHarness.authority.close();
    await expectCode(
      oldHarness.authority.verify(verifyRequest),
      "LOCAL_CLIENT_POP_CLOSED",
    );
    await differentKey.authority.close();
    await differentKeyId.authority.close();
  });

  it("uses constant-size comparison behavior for a malformed signature", async () => {
    const harness = createHarness();
    const proof = await issue(harness.authority);
    const malformed = { ...proof, signature: "not-hex" } as ManagedLocalClientPopProof;

    await expectCode(harness.authority.verify({
      expectedIdentity: identity(),
      request: requestBinding(),
      proof: malformed,
    }), "LOCAL_CLIENT_POP_PROOF_INVALID");
    await harness.authority.close();
  });

  it("fails closed when an injected atomic replay guard is unavailable", async () => {
    const replayGuard: ManagedLocalClientPopReplayGuard = {
      status: {
        available: true,
        durable: true,
        distributed: true,
        mode: "fixture-distributed",
      },
      consumeOnce: async () => {
        throw new Error("private backend detail");
      },
    };
    const harness = createHarness({ replayGuard });
    const proof = await issue(harness.authority);

    await expectCode(harness.authority.verify({
      expectedIdentity: identity(),
      request: requestBinding(),
      proof,
    }), "LOCAL_CLIENT_POP_REPLAY_GUARD_UNAVAILABLE");
    expect(harness.authority.status.replayGuard).toEqual(replayGuard.status);
    await harness.authority.close();
  });

  it("projects live replay availability and propagates owned close failures", async () => {
    let available = true;
    const replayGuard: ManagedLocalClientPopReplayGuard = {
      get status() {
        return {
          available,
          durable: true,
          distributed: false,
          mode: "fixture-live-replay",
          authenticatedReplaySet: true,
          snapshotRollbackProtected: false,
          defensiveEnabled: false,
        };
      },
      consumeOnce: () => "consumed",
      close: () => {
        throw new Error("private close detail");
      },
    };
    const harness = createHarness({ replayGuard });
    expect(harness.authority.status).toMatchObject({
      available: true,
      replayGuard: { available: true, authenticatedReplaySet: true },
    });

    available = false;
    expect(harness.authority.status).toMatchObject({
      available: false,
      replayGuard: { available: false },
    });
    await expect(harness.authority.close()).rejects.toMatchObject({
      code: "LOCAL_CLIENT_POP_REPLAY_CLOSE_FAILED",
    });
    expect(harness.authority.status.closed).toBe(true);
  });

  it("passes only opaque nonce and authority-scope hashes to an injected replay guard", async () => {
    const calls: unknown[] = [];
    const replayGuard: ManagedLocalClientPopReplayGuard = {
      status: {
        available: true,
        durable: true,
        distributed: false,
        mode: "fixture-sqlite",
      },
      consumeOnce: (input) => {
        calls.push(input);
        return "consumed";
      },
    };
    const harness = createHarness({ replayGuard });
    const proof = await issue(harness.authority);

    await harness.authority.verify({
      expectedIdentity: identity(),
      request: requestBinding(),
      proof,
    });
    expect(calls).toEqual([{
      replayKeySha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      replayScopeSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      expiresAtMs: proof.expiresAtMs,
      nowMs: BASE_NOW_MS,
    }]);
    expect(calls[0]).toMatchObject({
      replayScopeSha256: "f7408353eb517ccf2194070f13e001d0d08774d7226d24a326a757d776e1ff57",
    });
    expect(JSON.stringify(calls)).not.toContain("tenant-a");
    expect(JSON.stringify(calls)).not.toContain("desktop.alpha");
    expect(JSON.stringify(calls)).not.toContain("managed-client-pop-key-v1");
    await harness.authority.close();
  });

  it("rejects non-canonical request metadata before signing", async () => {
    const harness = createHarness();
    await expectCode(harness.authority.issue({
      identity: identity(),
      request: requestBinding({ method: "post" }),
    }), "LOCAL_CLIENT_POP_REQUEST_INVALID");
    await expectCode(harness.authority.issue({
      identity: identity(),
      request: requestBinding({ path: "/a/../local-clients/heartbeat" }),
    }), "LOCAL_CLIENT_POP_REQUEST_INVALID");
    await harness.authority.close();
  });

  it("rejects invalid nonce generation without leaking an arbitrary error", async () => {
    const harness = createHarness({ nonceFactory: () => Buffer.alloc(31, 0xaa) });
    await expectCode(
      issue(harness.authority),
      "LOCAL_CLIENT_POP_NONCE_GENERATION_FAILED",
    );
    await harness.authority.close();
  });

  it("accepts only a Buffer key and closes idempotently", async () => {
    expect(() => createManagedLocalClientPopIdentityAuthority({
      key: new Uint8Array(32) as unknown as Buffer,
      keyId: "invalid-key-container",
    })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_POP_CONFIGURATION_INVALID",
    }));

    const harness = createHarness();
    await harness.authority.close();
    await harness.authority.close();
    expect(harness.authority.status).toMatchObject({ available: false, closed: true });
    await expectCode(
      issue(harness.authority),
      "LOCAL_CLIENT_POP_CLOSED",
    );
  });
});

function createHarness(options: Readonly<{
  keyByte?: number;
  keyId?: string;
  replayGuard?: ManagedLocalClientPopReplayGuard;
  nonceFactory?: () => Buffer;
}> = {}) {
  let nowMs = BASE_NOW_MS;
  const sourceKey = Buffer.alloc(32, options.keyByte ?? 0x5a);
  const authority = createManagedLocalClientPopIdentityAuthority({
    key: sourceKey,
    keyId: options.keyId ?? "managed-client-pop-key-v1",
    proofTtlMs: PROOF_TTL_MS,
    maxClockSkewMs: MAX_CLOCK_SKEW_MS,
    maxReplayEntries: 64,
    replayGuard: options.replayGuard,
    nonceFactory: options.nonceFactory,
    now: () => nowMs,
  });
  return {
    authority,
    sourceKey,
    setNow(value: number) {
      nowMs = value;
    },
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
    body: Buffer.from('{"healthStatus":"healthy"}', "utf8"),
    ...override,
  });
}

function issue(
  authority: ReturnType<typeof createManagedLocalClientPopIdentityAuthority>,
) {
  return authority.issue({
    identity: identity(),
    request: requestBinding(),
  });
}

async function expectCode(
  operation: Promise<unknown>,
  code: LocalClientPopErrorCode,
): Promise<void> {
  let caught: unknown;
  try {
    await operation;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(LocalClientPopAuthorityError);
  expect(caught).toMatchObject({ code });
  expect(LOCAL_CLIENT_POP_ERROR_CODES).toContain(code);
}
