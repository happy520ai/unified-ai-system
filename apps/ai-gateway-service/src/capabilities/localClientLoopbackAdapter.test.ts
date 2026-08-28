import { createHash, createHmac, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LocalClientAdapterRegistry,
  type LocalClientAdapterDescriptor,
  type LocalClientAdapterExecutionRequest,
} from "./localClientAdapterRegistry.ts";
import {
  LOCAL_CLIENT_LOOPBACK_ACTION_ID,
  LOCAL_CLIENT_LOOPBACK_ACTION_VERSION,
  LOCAL_CLIENT_LOOPBACK_ADAPTER_ID,
  LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE,
  LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION,
  LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID,
  LOCAL_CLIENT_LOOPBACK_CHALLENGE_VERSION,
  LOCAL_CLIENT_LOOPBACK_RECEIPT_VERSION,
  LOCAL_CLIENT_LOOPBACK_RECONCILIATION_PATH,
  createLocalClientLoopbackAdapter,
  type LocalClientLoopbackAdapterOptions,
} from "./localClientLoopbackAdapter.ts";

const CLIENT_ID = "fixture.local-client";
const MANIFEST_SHA256 = "b".repeat(64);
const PLAN_FINGERPRINT = "a".repeat(64);
const EXECUTION_ID = `lc-exec-${"1".repeat(64)}`;

type FixtureMode =
  | "success"
  | "hang"
  | "hang-action"
  | "redirect"
  | "oversized"
  | "reflect-challenge"
  | "wrong-client"
  | "wrong-manifest"
  | "wrong-version"
  | "wrong-challenge-signature"
  | "wrong-receipt-execution"
  | "wrong-receipt-signature";

type FixtureState = {
  readonly server: Server;
  readonly endpoint: string;
  readonly requests: Array<{ path: string; headers: IncomingMessage["headers"] }>;
  readonly protocolErrors: string[];
  challengeRequests: number;
  actionRequests: number;
  lastAction: Record<string, unknown> | null;
};

const activeServers: Server[] = [];

afterEach(async () => {
  const servers = activeServers.splice(0);
  await Promise.all(servers.map(closeServer));
});

describe("local client loopback adapter", () => {
  it("pins the action-v2 and receipt-v2 protocol to an immutable known-answer vector", () => {
    const secret = Buffer.alloc(32, 0x5a);
    const action = {
      protocolVersion: LOCAL_CLIENT_LOOPBACK_ACTION_VERSION,
      executionId: `lc-exec-${"a".repeat(64)}`,
      clientId: CLIENT_ID,
      manifestSha256: MANIFEST_SHA256,
      adapterVersion: LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION,
      nonce: "ERERERERERERERERERERERERERERERERERERERERERE",
      capabilityId: LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID,
      actionId: LOCAL_CLIENT_LOOPBACK_ACTION_ID,
      planFingerprint: "c".repeat(64),
      inputSha256: "d".repeat(64),
      dispatchIntentSha256: "e".repeat(64),
    };
    expect(actionSignature(secret, action)).toBe(
      "0c0724eb9df9cdb68b10fbc024682b5629188aabf1b4ac89acb1b82cbf943cc5",
    );

    const receiptCore = {
      protocolVersion: LOCAL_CLIENT_LOOPBACK_RECEIPT_VERSION,
      executionId: action.executionId,
      clientId: action.clientId,
      manifestSha256: action.manifestSha256,
      adapterVersion: action.adapterVersion,
      nonce: action.nonce,
      capabilityId: action.capabilityId,
      actionId: action.actionId,
      planFingerprint: action.planFingerprint,
      inputSha256: action.inputSha256,
      durableReceiptSha256: "f".repeat(64),
      executionMode: "governed",
      externalEffectPerformed: true,
      status: "completed",
    };
    const receiptId = deriveReceiptId(receiptCore);
    expect(receiptId).toBe(
      "loopback:2d96e696a9f7b50e64e4af58a9ca21f8799a0d32158799aaacaf02f684387542",
    );
    expect(receiptSignature(secret, { ...receiptCore, receiptId })).toBe(
      "7c35838805fcc16202fc3aa564d817ca6a1022a69d755cf3e6f0da0a11013cde",
    );
  });

  it("performs one real fixed action after mutual HMAC challenge attestation", async () => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, "success");
    const { registry, descriptor } = createHarness(fixture.endpoint, secret);

    const receipt = await registry.execute(executionRequest(descriptor));

    expect(receipt).toMatchObject({
      adapterId: LOCAL_CLIENT_LOOPBACK_ADAPTER_ID,
      adapterType: LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE,
      adapterVersion: LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION,
      clientId: CLIENT_ID,
      capabilityId: LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID,
      actionId: LOCAL_CLIENT_LOOPBACK_ACTION_ID,
      executionId: EXECUTION_ID,
      executionMode: "governed",
      externalEffectPerformed: true,
      status: "completed",
    });
    expect(receipt.receiptId).toMatch(/^loopback:[a-f0-9]{64}$/u);
    expect(fixture.challengeRequests).toBe(1);
    expect(fixture.actionRequests).toBe(1);
    expect(fixture.protocolErrors).toEqual([]);
    expect(fixture.lastAction).toMatchObject({
      executionId: EXECUTION_ID,
      planFingerprint: PLAN_FINGERPRINT,
      actionId: LOCAL_CLIENT_LOOPBACK_ACTION_ID,
      input: { payload: "perform-one-fixture-action" },
    });
    for (const request of fixture.requests) {
      expect(request.headers).not.toHaveProperty("authorization");
      expect(request.headers).not.toHaveProperty("cookie");
      expect(request.headers).not.toHaveProperty("proxy-authorization");
    }
  });

  it("rechecks server authority after challenge and immediately before action dispatch", async () => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, "success");
    const { registry, descriptor } = createHarness(fixture.endpoint, secret);
    const assertAuthority = vi.fn(async (phase: "dispatch") => {
      expect(phase).toBe("dispatch");
      throw new Error("client disabled during challenge");
    });

    await expect(registry.execute(executionRequest(descriptor, { assertAuthority }))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_LOOPBACK_AUTHORITY_INACTIVE",
      statusCode: 409,
      outcomeUnknown: false,
    });
    expect(fixture.challengeRequests).toBe(1);
    expect(assertAuthority).toHaveBeenCalledOnce();
    expect(fixture.actionRequests).toBe(0);
  });

  it("performs a fixed receipt-only reconciliation request without execution authority", async () => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, "success");
    const { registry, descriptor } = createHarness(fixture.endpoint, secret);
    const query = fixtureReconciliationQuery();

    let response;
    try {
      response = await registry.reconcileReceipt({
        tenantId: "tenant-a",
        subjectId: "subject-a",
        client: verifiedTarget(descriptor, CLIENT_ID),
        query,
        signal: new AbortController().signal,
      });
    } catch (error) {
      throw new Error(`reconcile diagnostic: ${JSON.stringify({
        code: (error as { code?: unknown })?.code,
        paths: fixture.requests.map((request) => request.path),
        protocolErrors: fixture.protocolErrors,
      })}`);
    }

    expect(response).toMatchObject({
      queryId: query.queryId,
      executionId: EXECUTION_ID,
      state: "not-found",
      receipt: null,
      retryAllowed: false,
    });
    expect(fixture.requests.map((request) => request.path)).toContain(
      LOCAL_CLIENT_LOOPBACK_RECONCILIATION_PATH,
    );
    expect(fixture.actionRequests).toBe(0);
  });

  it.each([
    "http://192.168.1.2:4321",
    "http://localhost:4321",
    "http://2130706433:4321",
    "https://127.0.0.1:4321",
    "http://user:password@127.0.0.1:4321",
    "http://127.0.0.1:4321/?query=forbidden",
    "http://127.0.0.1:4321/#fragment-forbidden",
    "http://127.0.0.1:4321/user-path-forbidden",
  ])("rejects non-exact loopback construction endpoint %s", (endpoint) => {
    expect(() => createLocalClientLoopbackAdapter({
      endpoint,
      expectedClientId: CLIENT_ID,
      expectedManifestSha256: MANIFEST_SHA256,
      sharedSecret: randomBytes(32),
    })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_LOOPBACK_CONFIGURATION_INVALID",
    }));
  });

  it("supports multiple code-configured loopback adapter identities in one registry", async () => {
    const firstSecret = randomBytes(32);
    const secondSecret = randomBytes(32);
    const firstFixture = await startFixture(firstSecret, "success");
    const secondFixture = await startFixture(secondSecret, "success");
    const registry = new LocalClientAdapterRegistry();
    const first = createLocalClientLoopbackAdapter({
      adapterId: "loopback.desktop.one",
      endpoint: firstFixture.endpoint,
      expectedClientId: "desktop.one",
      expectedManifestSha256: MANIFEST_SHA256,
      sharedSecret: firstSecret,
    });
    const second = createLocalClientLoopbackAdapter({
      adapterId: "loopback.desktop.two",
      endpoint: secondFixture.endpoint,
      expectedClientId: "desktop.two",
      expectedManifestSha256: "c".repeat(64),
      sharedSecret: secondSecret,
    });

    const firstDescriptor = registry.register(first);
    const secondDescriptor = registry.register(second);
    expect(firstDescriptor).toMatchObject({ id: "loopback.desktop.one" });
    expect(secondDescriptor).toMatchObject({ id: "loopback.desktop.two" });
    expect(registry.list().filter((descriptor) => descriptor.type === LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE))
      .toHaveLength(2);
    await expect(registry.execute(executionRequest(firstDescriptor, {
      client: verifiedTarget(firstDescriptor, "desktop.one"),
    }))).resolves.toMatchObject({ adapterId: "loopback.desktop.one", clientId: "desktop.one" });
    await expect(registry.execute(executionRequest(secondDescriptor, {
      client: verifiedTarget(secondDescriptor, "desktop.two"),
    }))).resolves.toMatchObject({ adapterId: "loopback.desktop.two", clientId: "desktop.two" });
    expect(firstFixture.actionRequests).toBe(1);
    expect(secondFixture.actionRequests).toBe(1);
  });

  it("closes the cloned adapter credential and refuses later execution", async () => {
    const adapter = createLocalClientLoopbackAdapter({
      endpoint: "http://127.0.0.1:43129",
      expectedClientId: CLIENT_ID,
      expectedManifestSha256: MANIFEST_SHA256,
      sharedSecret: randomBytes(32),
    });
    const registry = new LocalClientAdapterRegistry();
    const descriptor = registry.register(adapter);

    await adapter.close?.();
    await expect(registry.execute(executionRequest(descriptor))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_LOOPBACK_CLOSED",
      statusCode: 503,
    });
    await registry.close();
    await registry.close();
  });

  it.each(["endpoint", "headers", "command"])(
    "does not permit action input to override the code-configured %s boundary",
    async (field) => {
      const secret = randomBytes(32);
      const fixture = await startFixture(secret, "success");
      const { registry, descriptor } = createHarness(fixture.endpoint, secret);
      const request = executionRequest(descriptor, {
        input: { planFingerprint: PLAN_FINGERPRINT, [field]: "attacker-controlled" },
      });

      await expect(registry.execute(request)).rejects.toMatchObject({
        code: "LOCAL_CLIENT_ADAPTER_INPUT_INVALID",
      });
      expect(fixture.challengeRequests).toBe(0);
      expect(fixture.actionRequests).toBe(0);
    },
  );

  it("keeps endpoint, expected manifest, and shared secret out of the descriptor", async () => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, "success");
    const adapter = createLocalClientLoopbackAdapter(adapterOptions(fixture.endpoint, secret));
    const serialized = JSON.stringify(adapter.descriptor);

    expect(serialized).not.toContain(fixture.endpoint);
    expect(serialized).not.toContain(MANIFEST_SHA256);
    expect(adapter).not.toHaveProperty("endpoint");
    expect(adapter).not.toHaveProperty("sharedSecret");
    expect(adapter.descriptor.actions[0].inputSchema).toEqual({
      schemaId: "local-client.loopback.invoke.input",
      schemaVersion: 1,
      fields: [
        { name: "planFingerprint", valueType: "string", required: true },
        { name: "payload", valueType: "string", required: false },
      ],
      additionalProperties: false,
    });
  });

  it("rejects a verified registry target whose identity is not the code-configured client", async () => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, "success");
    const { registry, descriptor } = createHarness(fixture.endpoint, secret);

    await expect(registry.execute(executionRequest(descriptor, {
      client: verifiedTarget(descriptor, "different.local-client"),
    }))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_LOOPBACK_TARGET_MISMATCH",
    });
    expect(fixture.challengeRequests).toBe(0);
  });

  it.each([
    ["wrong-client", "identity"],
    ["wrong-manifest", "manifest"],
    ["wrong-version", "adapter version"],
    ["wrong-challenge-signature", "challenge signature"],
    ["reflect-challenge", "reflected request signature"],
  ] as const)("fails challenge attestation for a wrong %s response", async (mode, _label) => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, mode);
    const { registry, descriptor } = createHarness(fixture.endpoint, secret);

    await expect(registry.execute(executionRequest(descriptor))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_LOOPBACK_ATTESTATION_INVALID",
      outcomeUnknown: false,
    });
    expect(fixture.challengeRequests).toBe(1);
    expect(fixture.actionRequests).toBe(0);
  });

  it.each(["wrong-receipt-signature", "wrong-receipt-execution"] as const)(
    "rejects %s after exactly one action and marks the outcome unknown",
    async (mode) => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, mode);
    const { registry, descriptor } = createHarness(fixture.endpoint, secret);

    await expect(registry.execute(executionRequest(descriptor))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_LOOPBACK_RECEIPT_INVALID",
      outcomeUnknown: true,
    });
    expect(fixture.actionRequests).toBe(1);
    },
  );

  it("rejects redirects without following their Location", async () => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, "redirect");
    const { registry, descriptor } = createHarness(fixture.endpoint, secret);

    await expect(registry.execute(executionRequest(descriptor))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_LOOPBACK_REDIRECT_FORBIDDEN",
      outcomeUnknown: false,
    });
    expect(fixture.requests).toHaveLength(1);
    expect(fixture.actionRequests).toBe(0);
  });

  it("cancels an in-flight attestation through the caller AbortSignal", async () => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, "hang");
    const { registry, descriptor } = createHarness(fixture.endpoint, secret, { timeoutMs: 2_000 });
    const controller = new AbortController();
    const execution = registry.execute(executionRequest(descriptor, { signal: controller.signal }));
    await vi.waitFor(() => expect(fixture.challengeRequests).toBe(1));

    controller.abort();

    await expect(execution).rejects.toMatchObject({
      code: "LOCAL_CLIENT_LOOPBACK_ABORTED",
      category: "cancellation",
      outcomeUnknown: false,
    });
  });

  it("preserves unknown-outcome semantics when cancellation follows action dispatch", async () => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, "hang-action");
    const { registry, descriptor } = createHarness(fixture.endpoint, secret, { timeoutMs: 2_000 });
    const controller = new AbortController();
    const execution = registry.execute(executionRequest(descriptor, { signal: controller.signal }));
    await vi.waitFor(() => expect(fixture.actionRequests).toBe(1));

    controller.abort();

    await expect(execution).rejects.toMatchObject({
      code: "LOCAL_CLIENT_LOOPBACK_ABORTED",
      category: "cancellation",
      outcomeUnknown: true,
    });
  });

  it("applies one bounded overall timeout to attestation and action", async () => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, "hang");
    const { registry, descriptor } = createHarness(fixture.endpoint, secret, { timeoutMs: 50 });

    await expect(registry.execute(executionRequest(descriptor))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_LOOPBACK_TIMEOUT",
      statusCode: 504,
      outcomeUnknown: false,
    });
  });

  it("rejects a challenge at its exact TTL boundary", async () => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, "success");
    const base = Date.parse("2026-08-28T02:00:00.000Z");
    let reads = 0;
    const now = () => base + (reads++ === 0 ? 0 : 50);
    const { registry, descriptor } = createHarness(fixture.endpoint, secret, {
      timeoutMs: 1_000,
      challengeTtlMs: 50,
      now,
    });

    await expect(registry.execute(executionRequest(descriptor))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_LOOPBACK_ATTESTATION_INVALID",
    });
    expect(fixture.actionRequests).toBe(0);
  });

  it("stops reading and rejects an oversized loopback response", async () => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, "oversized");
    const { registry, descriptor } = createHarness(fixture.endpoint, secret, { maxResponseBytes: 256 });

    await expect(registry.execute(executionRequest(descriptor))).rejects.toMatchObject({
      code: "LOCAL_CLIENT_LOOPBACK_RESPONSE_TOO_LARGE",
      outcomeUnknown: false,
    });
    expect(fixture.actionRequests).toBe(0);
  });
});

function createHarness(
  endpoint: string,
  sharedSecret: Uint8Array,
  overrides: Partial<LocalClientLoopbackAdapterOptions> = {},
) {
  const registry = new LocalClientAdapterRegistry();
  const descriptor = registry.register(createLocalClientLoopbackAdapter({
    ...adapterOptions(endpoint, sharedSecret),
    ...overrides,
  }));
  return { registry, descriptor };
}

function adapterOptions(endpoint: string, sharedSecret: Uint8Array): LocalClientLoopbackAdapterOptions {
  return {
    endpoint,
    expectedClientId: CLIENT_ID,
    expectedManifestSha256: MANIFEST_SHA256,
    sharedSecret,
    timeoutMs: 1_000,
    challengeTtlMs: 500,
    maxResponseBytes: 4_096,
  };
}

function executionRequest(
  descriptor: LocalClientAdapterDescriptor,
  overrides: Partial<LocalClientAdapterExecutionRequest> = {},
): LocalClientAdapterExecutionRequest {
  return {
    executionId: EXECUTION_ID,
    tenantId: "tenant-a",
    subjectId: "subject-a",
    client: verifiedTarget(descriptor, CLIENT_ID),
    capabilityId: LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID,
    actionId: LOCAL_CLIENT_LOOPBACK_ACTION_ID,
    input: {
      planFingerprint: PLAN_FINGERPRINT,
      payload: "perform-one-fixture-action",
    },
    receiptReconciliation: {
      intent: fixtureDispatchIntent(),
      confirmReceipt: async () => true,
    },
    signal: new AbortController().signal,
    assertAuthority: async () => true,
    ...overrides,
  };
}

function fixtureDispatchIntent() {
  const inputSha256 = sha256(canonicalJson({ payload: "perform-one-fixture-action" }));
  return Object.freeze({
    protocolVersion: "local-client-dispatch-intent-v1" as const,
    intentId: `lcdi_${"2".repeat(64)}`,
    executionId: EXECUTION_ID,
    executionBindingHmac: "3".repeat(64),
    tenantBindingHmac: "4".repeat(64),
    subjectBindingHmac: "5".repeat(64),
    clientBindingHmac: "6".repeat(64),
    routeBindingHmac: "7".repeat(64),
    identityBindingHmac: "8".repeat(64),
    planFingerprint: PLAN_FINGERPRINT,
    inputSha256,
    dispatchFencingToken: "1",
    issuedAtMs: 1_800_000_000_000,
    expiresAtMs: 1_800_000_060_000,
    signature: "9".repeat(64),
  });
}

function fixtureReconciliationQuery() {
  const intent = fixtureDispatchIntent();
  return Object.freeze({
    protocolVersion: "local-client-reconciliation-query-v1" as const,
    queryId: `lcq_${"a".repeat(48)}`,
    intentId: intent.intentId,
    executionId: intent.executionId,
    executionBindingHmac: intent.executionBindingHmac,
    tenantBindingHmac: intent.tenantBindingHmac,
    subjectBindingHmac: intent.subjectBindingHmac,
    clientBindingHmac: intent.clientBindingHmac,
    routeBindingHmac: intent.routeBindingHmac,
    identityBindingHmac: intent.identityBindingHmac,
    planFingerprint: intent.planFingerprint,
    inputSha256: intent.inputSha256,
    dispatchFencingToken: intent.dispatchFencingToken,
    issuedAtMs: 1_800_000_000_100,
    expiresAtMs: 1_800_000_030_100,
    purpose: "receipt-reconciliation-only" as const,
    authorizeExecution: false as const,
    signature: "b".repeat(64),
  });
}

function verifiedTarget(descriptor: LocalClientAdapterDescriptor, clientId: string) {
  return {
    descriptorVersion: "verified-local-client-adapter-target-v1" as const,
    clientId,
    state: "verified" as const,
    trustDecision: "verified" as const,
    adapter: {
      id: descriptor.id,
      type: descriptor.type,
      version: descriptor.version,
    },
    capabilityIds: [LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID],
  };
}

async function startFixture(secret: Buffer, mode: FixtureMode): Promise<FixtureState> {
  const state = {
    server: null as unknown as Server,
    endpoint: "",
    requests: [] as FixtureState["requests"],
    protocolErrors: [] as string[],
    challengeRequests: 0,
    actionRequests: 0,
    lastAction: null as Record<string, unknown> | null,
  };
  const server = createServer((request, response) => {
    void handleFixtureRequest(request, response, state, secret, mode).catch((error) => {
      state.protocolErrors.push(error instanceof Error ? error.message : "fixture-handler-error");
      if (!response.headersSent) response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "fixture-handler-error" }));
    });
  });
  activeServers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address() as AddressInfo;
  state.server = server;
  state.endpoint = `http://127.0.0.1:${address.port}`;
  return state;
}

async function handleFixtureRequest(
  request: IncomingMessage,
  response: ServerResponse,
  state: FixtureState,
  secret: Buffer,
  mode: FixtureMode,
): Promise<void> {
  const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  state.requests.push({ path, headers: request.headers });
  if (path.endsWith("/challenge")) {
    state.challengeRequests += 1;
    if (mode === "hang") return;
    if (mode === "redirect") {
      response.writeHead(302, { location: "http://127.0.0.1:1/must-not-follow" });
      response.end();
      return;
    }
    if (mode === "oversized") {
      sendJson(response, { oversized: "x".repeat(2_048) });
      return;
    }
    const body = await readRequestJson(request);
    if (body.signature !== challengeRequestSignature(secret, body)) {
      state.protocolErrors.push("invalid-challenge-request-signature");
      sendJson(response, { error: "invalid" }, 403);
      return;
    }
    if (mode === "reflect-challenge") {
      sendJson(response, body);
      return;
    }
    const challenge = {
      protocolVersion: body.protocolVersion,
      nonce: body.nonce,
      clientId: mode === "wrong-client" ? "other.local-client" : body.clientId,
      manifestSha256: mode === "wrong-manifest" ? "c".repeat(64) : body.manifestSha256,
      adapterVersion: mode === "wrong-version" ? "9.9.9" : body.adapterVersion,
      issuedAtMs: body.issuedAtMs,
      expiresAtMs: body.expiresAtMs,
    };
    sendJson(response, {
      ...challenge,
      signature: mode === "wrong-challenge-signature"
        ? "0".repeat(64)
        : challengeResponseSignature(secret, challenge),
    });
    return;
  }
  if (path.endsWith("/invoke")) {
    const body = await readRequestJson(request);
    if (
      !hasExactKeys(body, [
        "protocolVersion",
        "executionId",
        "clientId",
        "manifestSha256",
        "adapterVersion",
        "nonce",
        "capabilityId",
        "actionId",
        "planFingerprint",
        "inputSha256",
        "dispatchIntentSha256",
        "dispatchIntent",
        "input",
        "signature",
      ])
      || body.signature !== actionSignature(secret, body)
      || body.inputSha256 !== sha256(canonicalJson(body.input))
      || typeof body.dispatchIntentSha256 !== "string"
      || body.dispatchIntentSha256 !== sha256(canonicalJson(body.dispatchIntent))
    ) {
      state.protocolErrors.push("invalid-action-request-signature-or-hash");
      sendJson(response, { error: "invalid" }, 403);
      return;
    }
    state.actionRequests += 1;
    state.lastAction = body;
    if (mode === "hang-action") return;
    const intent = body.dispatchIntent as Record<string, unknown>;
    const durableReceipt = {
      protocolVersion: "local-client-durable-receipt-v1",
      receiptId: `lcdr_${"a".repeat(64)}`,
      intentId: intent.intentId,
      executionId: intent.executionId,
      executionBindingHmac: intent.executionBindingHmac,
      tenantBindingHmac: intent.tenantBindingHmac,
      subjectBindingHmac: intent.subjectBindingHmac,
      clientBindingHmac: intent.clientBindingHmac,
      routeBindingHmac: intent.routeBindingHmac,
      identityBindingHmac: intent.identityBindingHmac,
      planFingerprint: intent.planFingerprint,
      inputSha256: intent.inputSha256,
      dispatchFencingToken: intent.dispatchFencingToken,
      completedAtMs: 1_800_000_000_100,
      executionMode: "governed",
      externalEffectPerformed: true,
      status: "completed",
      signature: "b".repeat(64),
    };
    const receiptCore = {
      protocolVersion: LOCAL_CLIENT_LOOPBACK_RECEIPT_VERSION,
      executionId: mode === "wrong-receipt-execution"
        ? `lc-exec-${"f".repeat(64)}`
        : body.executionId,
      clientId: body.clientId,
      manifestSha256: body.manifestSha256,
      adapterVersion: body.adapterVersion,
      nonce: body.nonce,
      capabilityId: body.capabilityId,
      actionId: body.actionId,
      planFingerprint: body.planFingerprint,
      inputSha256: body.inputSha256,
      durableReceiptSha256: sha256(canonicalJson(durableReceipt)),
      durableReceipt,
      executionMode: "governed",
      externalEffectPerformed: true,
      status: "completed",
    };
    const receiptId = deriveReceiptId(receiptCore);
    const receipt = { ...receiptCore, receiptId };
    sendJson(response, {
      ...receipt,
      signature: mode === "wrong-receipt-signature"
        ? "0".repeat(64)
        : receiptSignature(secret, receipt),
    });
    return;
  }
  if (path === LOCAL_CLIENT_LOOPBACK_RECONCILIATION_PATH) {
    const body = await readRequestJson(request);
    sendJson(response, {
      protocolVersion: "local-client-reconciliation-response-v1",
      queryId: body.queryId,
      intentId: body.intentId,
      executionId: body.executionId,
      dispatchFencingToken: body.dispatchFencingToken,
      state: "not-found",
      receipt: null,
      observedAtMs: 1_800_000_000_100,
      retryAllowed: false,
      signature: "a".repeat(64),
    });
    return;
  }
  sendJson(response, { error: "not-found" }, 404);
}

async function readRequestJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 64 * 1_024) throw new Error("fixture-request-too-large");
    chunks.push(buffer);
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("fixture-request-invalid");
  }
  return parsed as Record<string, unknown>;
}

function sendJson(response: ServerResponse, body: unknown, status = 200): void {
  const encoded = JSON.stringify(body);
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(encoded),
    "content-type": "application/json; charset=utf-8",
  });
  response.end(encoded);
}

function challengeRequestSignature(secret: Buffer, body: Record<string, unknown>): string {
  return hmac(secret, [
    LOCAL_CLIENT_LOOPBACK_CHALLENGE_VERSION,
    "request",
    body.nonce,
    body.clientId,
    body.manifestSha256,
    body.adapterVersion,
    body.issuedAtMs,
    body.expiresAtMs,
  ]);
}

function challengeResponseSignature(secret: Buffer, body: Record<string, unknown>): string {
  return hmac(secret, [
    LOCAL_CLIENT_LOOPBACK_CHALLENGE_VERSION,
    "response",
    body.nonce,
    body.clientId,
    body.manifestSha256,
    body.adapterVersion,
    body.issuedAtMs,
    body.expiresAtMs,
  ]);
}

function actionSignature(secret: Buffer, body: Record<string, unknown>): string {
  return hmac(secret, [
    LOCAL_CLIENT_LOOPBACK_ACTION_VERSION,
    body.executionId,
    body.clientId,
    body.manifestSha256,
    body.adapterVersion,
    body.nonce,
    body.capabilityId,
    body.actionId,
    body.planFingerprint,
    body.inputSha256,
    body.dispatchIntentSha256,
  ]);
}

function receiptSignature(secret: Buffer, body: Record<string, unknown>): string {
  return hmac(secret, [
    LOCAL_CLIENT_LOOPBACK_RECEIPT_VERSION,
    body.receiptId,
    body.executionId,
    body.clientId,
    body.manifestSha256,
    body.adapterVersion,
    body.nonce,
    body.capabilityId,
    body.actionId,
    body.planFingerprint,
    body.inputSha256,
    body.durableReceiptSha256,
    body.executionMode,
    body.externalEffectPerformed,
    body.status,
  ]);
}

function deriveReceiptId(body: Record<string, unknown>): string {
  return `loopback:${sha256(JSON.stringify([
    LOCAL_CLIENT_LOOPBACK_RECEIPT_VERSION,
    body.executionId,
    body.clientId,
    body.manifestSha256,
    body.adapterVersion,
    body.nonce,
    body.capabilityId,
    body.actionId,
    body.planFingerprint,
    body.inputSha256,
    body.durableReceiptSha256,
    body.executionMode,
    body.externalEffectPerformed,
    body.status,
  ]))}`;
}

function hmac(secret: Buffer, fields: readonly unknown[]): string {
  return createHmac("sha256", secret).update(JSON.stringify(fields), "utf8").digest("hex");
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Reflect.ownKeys(value);
  return actual.length === expected.length
    && actual.every((key) => typeof key === "string" && expected.includes(key));
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(",")}}`;
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections?.();
    server.closeIdleConnections?.();
  });
}
