import { createHmac, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LOCAL_CLIENT_LOOPBACK_ADAPTER_ID,
  LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE,
  LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION,
  LOCAL_CLIENT_LOOPBACK_VERIFICATION_VERSION,
  createLocalClientLoopbackVerificationProbe,
  type LocalClientLoopbackVerificationProbeOptions,
} from "./localClientLoopbackAdapter.ts";
import {
  LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION,
  LOCAL_CLIENT_VERIFICATION_PROBE_DESCRIPTOR_VERSION,
} from "./localClientVerificationService.ts";

const CLIENT_ID = "fixture.local-client";
const MANIFEST_SHA256 = "a".repeat(64);
const VERIFY_PATH = "/.well-known/unified-ai/local-client/verify";

type FixtureMode = "success" | "wrong-signature" | "wrong-adapter" | "extra-field" | "redirect" | "oversized" | "hang";

type Fixture = {
  readonly server: Server;
  readonly endpoint: string;
  readonly requests: Array<{
    path: string;
    headers: IncomingMessage["headers"];
    body: Record<string, unknown>;
  }>;
};

const activeServers: Server[] = [];

afterEach(async () => {
  const servers = activeServers.splice(0);
  await Promise.all(servers.map(closeServer));
});

describe("local client loopback verification probe", () => {
  it("cryptographically binds the pinned client, adapter, manifest, nonce, and timestamps", async () => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, "success");
    const probe = createLocalClientLoopbackVerificationProbe(options(fixture.endpoint, secret));

    const result = await probe.probe({ signal: new AbortController().signal });

    expect(result).toEqual({
      evidenceVersion: LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION,
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      verifiedAtMs: expect.any(Number),
      expiresAtMs: expect.any(Number),
    });
    expect(result.expiresAtMs - result.verifiedAtMs).toBe(60_000);
    expect(Object.isFrozen(result)).toBe(true);
    expect(probe.descriptor).toEqual({
      descriptorVersion: LOCAL_CLIENT_VERIFICATION_PROBE_DESCRIPTOR_VERSION,
      assurance: "governed-hmac-sha256-loopback",
      clientId: CLIENT_ID,
      adapter: {
        id: LOCAL_CLIENT_LOOPBACK_ADAPTER_ID,
        type: LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE,
        version: LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION,
      },
      manifestSha256: MANIFEST_SHA256,
    });
    expect(fixture.requests).toHaveLength(1);
    const request = fixture.requests[0]!;
    expect(request.path).toBe(VERIFY_PATH);
    expect(request.body).toMatchObject({
      protocolVersion: LOCAL_CLIENT_LOOPBACK_VERIFICATION_VERSION,
      clientId: CLIENT_ID,
      adapterId: LOCAL_CLIENT_LOOPBACK_ADAPTER_ID,
      adapterType: LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE,
      adapterVersion: LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION,
      manifestSha256: MANIFEST_SHA256,
      nonce: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/u),
      issuedAtMs: expect.any(Number),
      expiresAtMs: expect.any(Number),
      signature: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(request.body.signature).toBe(signRequest(secret, request.body));
    expect(request.headers).not.toHaveProperty("authorization");
    expect(request.headers).not.toHaveProperty("cookie");
    expect(request.headers).not.toHaveProperty("proxy-authorization");

    const serializedEvidence = JSON.stringify(result);
    for (const forbidden of [fixture.endpoint, secret.toString("hex"), "nonce", "signature", "body", CLIENT_ID, MANIFEST_SHA256]) {
      expect(serializedEvidence).not.toContain(forbidden);
    }
  });

  it("binds a configurable adapter identity for multi-client registration", async () => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, "success");
    const probe = createLocalClientLoopbackVerificationProbe(options(fixture.endpoint, secret, {
      adapterId: "loopback.desktop.custom",
    }));

    await expect(probe.probe({ signal: new AbortController().signal })).resolves.toMatchObject({
      evidenceVersion: LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION,
    });
    expect(probe.descriptor.adapter.id).toBe("loopback.desktop.custom");
    expect(fixture.requests[0]?.body.adapterId).toBe("loopback.desktop.custom");
  });

  it("closes the cloned probe credential and refuses later verification", async () => {
    const probe = createLocalClientLoopbackVerificationProbe(options(
      "http://127.0.0.1:43129",
      randomBytes(32),
    ));
    await probe.close?.();
    await probe.close?.();
    await expect(probe.probe({ signal: new AbortController().signal }))
      .rejects.toMatchObject({
        code: "LOCAL_CLIENT_LOOPBACK_CLOSED",
        statusCode: 503,
      });
  });

  it.each([
    "http://192.168.1.10:4321",
    "http://localhost:4321",
    "https://127.0.0.1:4321",
    "http://user:pass@127.0.0.1:4321",
    "http://127.0.0.1:4321/path",
    "http://127.0.0.1:4321/?query=1",
  ])("rejects a non-canonical or non-loopback endpoint %s", (endpoint) => {
    expect(() => createLocalClientLoopbackVerificationProbe(options(endpoint, randomBytes(32)))).toThrow(
      expect.objectContaining({ code: "LOCAL_CLIENT_LOOPBACK_CONFIGURATION_INVALID" }),
    );
  });

  it.each([
    ["wrong-signature", "response signature"],
    ["wrong-adapter", "adapter identity"],
    ["extra-field", "unexpected response field"],
  ] as const)("rejects a signed challenge with an invalid %s", async (mode, _label) => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, mode);
    const probe = createLocalClientLoopbackVerificationProbe(options(fixture.endpoint, secret));

    await expect(probe.probe({ signal: new AbortController().signal })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_LOOPBACK_ATTESTATION_INVALID",
      outcomeUnknown: false,
    });
  });

  it("forbids redirects and does not follow the Location target", async () => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, "redirect");
    const probe = createLocalClientLoopbackVerificationProbe(options(fixture.endpoint, secret));

    await expect(probe.probe({ signal: new AbortController().signal })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_LOOPBACK_REDIRECT_FORBIDDEN",
      outcomeUnknown: false,
    });
    expect(fixture.requests).toHaveLength(1);
  });

  it("enforces a bounded response size", async () => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, "oversized");
    const probe = createLocalClientLoopbackVerificationProbe(options(fixture.endpoint, secret, {
      maxResponseBytes: 256,
    }));

    await expect(probe.probe({ signal: new AbortController().signal })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_LOOPBACK_RESPONSE_TOO_LARGE",
      outcomeUnknown: false,
    });
  });

  it("propagates caller cancellation without claiming an external outcome", async () => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, "hang");
    const probe = createLocalClientLoopbackVerificationProbe(options(fixture.endpoint, secret, {
      timeoutMs: 2_000,
    }));
    const controller = new AbortController();
    const pending = probe.probe({ signal: controller.signal });
    await vi.waitFor(() => expect(fixture.requests).toHaveLength(1));

    controller.abort();

    await expect(pending).rejects.toMatchObject({
      code: "LOCAL_CLIENT_LOOPBACK_ABORTED",
      category: "cancellation",
      outcomeUnknown: false,
    });
  });

  it("applies one bounded timeout to the complete probe", async () => {
    const secret = randomBytes(32);
    const fixture = await startFixture(secret, "hang");
    const probe = createLocalClientLoopbackVerificationProbe(options(fixture.endpoint, secret, {
      timeoutMs: 50,
    }));

    await expect(probe.probe({ signal: new AbortController().signal })).rejects.toMatchObject({
      code: "LOCAL_CLIENT_LOOPBACK_TIMEOUT",
      statusCode: 504,
      outcomeUnknown: false,
    });
  });
});

function options(
  endpoint: string,
  secret: Uint8Array,
  overrides: Partial<LocalClientLoopbackVerificationProbeOptions> = {},
): LocalClientLoopbackVerificationProbeOptions {
  return {
    endpoint,
    expectedClientId: CLIENT_ID,
    expectedManifestSha256: MANIFEST_SHA256,
    sharedSecret: secret,
    timeoutMs: 1_000,
    challengeTtlMs: 500,
    verificationTtlMs: 60_000,
    maxResponseBytes: 4_096,
    ...overrides,
  };
}

async function startFixture(secret: Buffer, mode: FixtureMode): Promise<Fixture> {
  const requests: Fixture["requests"] = [];
  const server = createServer((request, response) => {
    void handleRequest(request, response, requests, secret, mode);
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
  return {
    server,
    endpoint: `http://127.0.0.1:${address.port}`,
    requests,
  };
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  requests: Fixture["requests"],
  secret: Buffer,
  mode: FixtureMode,
): Promise<void> {
  const body = await readJson(request);
  requests.push({
    path: request.url ?? "",
    headers: request.headers,
    body,
  });
  if (mode === "hang") return;
  if (mode === "redirect") {
    response.writeHead(302, {
      location: "http://127.0.0.1:9/forbidden",
      "content-type": "application/json",
    });
    response.end("{}");
    return;
  }
  if (mode === "oversized") {
    response.writeHead(200, {
      "content-type": "application/json",
      "content-length": "2048",
    });
    response.end(JSON.stringify({ padding: "x".repeat(2_000) }));
    return;
  }
  const unsigned = {
    protocolVersion: body.protocolVersion,
    nonce: body.nonce,
    clientId: body.clientId,
    adapterId: mode === "wrong-adapter" ? "attacker.adapter" : body.adapterId,
    adapterType: body.adapterType,
    adapterVersion: body.adapterVersion,
    manifestSha256: body.manifestSha256,
    issuedAtMs: body.issuedAtMs,
    expiresAtMs: body.expiresAtMs,
  };
  const payload: Record<string, unknown> = {
    ...unsigned,
    signature: mode === "wrong-signature" ? "0".repeat(64) : signResponse(secret, unsigned),
  };
  if (mode === "extra-field") payload.rawBody = "must-be-rejected";
  const serial = JSON.stringify(payload);
  response.writeHead(200, {
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(serial)),
  });
  response.end(serial);
}

function signRequest(secret: Buffer, request: Record<string, unknown>): string {
  return hmac(secret, [
    LOCAL_CLIENT_LOOPBACK_VERIFICATION_VERSION,
    "request",
    request.nonce,
    request.clientId,
    request.adapterId,
    request.adapterType,
    request.adapterVersion,
    request.manifestSha256,
    request.issuedAtMs,
    request.expiresAtMs,
  ]);
}

function signResponse(secret: Buffer, response: Record<string, unknown>): string {
  return hmac(secret, [
    LOCAL_CLIENT_LOOPBACK_VERIFICATION_VERSION,
    "response",
    response.nonce,
    response.clientId,
    response.adapterId,
    response.adapterType,
    response.adapterVersion,
    response.manifestSha256,
    response.issuedAtMs,
    response.expiresAtMs,
  ]);
}

function hmac(secret: Buffer, fields: readonly unknown[]): string {
  return createHmac("sha256", secret).update(JSON.stringify(fields), "utf8").digest("hex");
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
