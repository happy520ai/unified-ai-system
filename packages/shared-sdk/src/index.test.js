import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";

import {
  createLocalClientDurableExecutionReceipt,
  createLocalClientNotFoundReconciliationResponse,
  createLocalClientPendingReconciliationResponse,
  createGatewayChatRequest,
  createGatewayClient,
  createManagedLocalClientPopProofHeader,
  deriveLocalClientReceiptReconciliationProtocolKey,
  GATEWAY_CLIENT_ERROR_CODES,
  GatewayClientAbortError,
  GatewayClientError,
  GatewayClientTimeoutError,
  LOCAL_CLIENT_RECEIPT_RECONCILIATION_SDK_BOUNDARIES,
  verifyLocalClientDispatchIntent,
  verifyLocalClientDurableExecutionReceipt,
} from "./index.js";

const POP_CANONICAL_VERSION = "managed-local-client-pop-canonical-v1";
const POP_PROOF_VERSION = "managed-local-client-pop-proof-v1";
const RECEIPT_PROTOCOL_HMAC_DOMAIN =
  "unified-ai/local-client-execution-receipt-reconciliation/v1";

function independentCanonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    assert.ok(Number.isSafeInteger(value));
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(independentCanonicalJson).join(",")}]`;
  assert.ok(value && typeof value === "object");
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${independentCanonicalJson(value[key])}`
  )).join(",")}}`;
}

function decodePopHeader(header) {
  assert.match(header, /^popv1\.[A-Za-z0-9_-]+$/u);
  const encoded = header.slice("popv1.".length);
  const decoded = Buffer.from(encoded, "base64url");
  assert.equal(decoded.toString("base64url"), encoded);
  const text = decoded.toString("utf8");
  const proof = JSON.parse(text);
  assert.equal(independentCanonicalJson(proof), text);
  return proof;
}

function independentlyDerivePopMaterial(secret, tenantId, clientId) {
  const context = `${tenantId}\0${clientId}`;
  return {
    key: createHmac("sha256", secret)
      .update("managed-local-client-pop-derived-key-v1\0", "utf8")
      .update(context, "utf8")
      .digest(),
    keyId: `lcpop-${createHmac("sha256", secret)
      .update("managed-local-client-pop-key-id-v1\0", "utf8")
      .update(context, "utf8")
      .digest("hex")
      .slice(0, 24)}`,
  };
}

function independentlySignPopProof({
  secret,
  tenantId,
  subjectId,
  clientId,
  revision,
  method,
  path,
  bodyBytes,
  proof,
}) {
  const material = independentlyDerivePopMaterial(secret, tenantId, clientId);
  const canonicalPayload = independentCanonicalJson({
    canonicalVersion: POP_CANONICAL_VERSION,
    proofVersion: proof.proofVersion,
    keyId: proof.keyId,
    tenantId,
    subjectId,
    clientId,
    clientRevision: revision,
    method,
    path,
    bodySha256: createHash("sha256").update(bodyBytes).digest("hex"),
    nonce: proof.nonce,
    issuedAtMs: proof.issuedAtMs,
    expiresAtMs: proof.expiresAtMs,
  });
  const signature = createHmac("sha256", material.key)
    .update(canonicalPayload, "utf8")
    .digest("hex");
  material.key.fill(0);
  return { signature, keyId: material.keyId };
}

function independentlySignReceiptProtocol(protocolKey, domain, value) {
  return createHmac("sha256", protocolKey)
    .update(RECEIPT_PROTOCOL_HMAC_DOMAIN, "utf8")
    .update("\0", "utf8")
    .update(`protocol/${domain}`, "utf8")
    .update("\0", "utf8")
    .update(independentCanonicalJson(value), "utf8")
    .digest("hex");
}

test("carries caller retry identity through the chat request helper", () => {
  const request = createGatewayChatRequest({
    prompt: "hello",
    idempotencyKey: "stable-chat-operation",
  });
  assert.equal(request.idempotencyKey, "stable-chat-operation");
  assert.equal(request.providerDispatchKey, undefined);
});

test("matches the gateway receipt-protocol golden intent and durable receipt vectors", async () => {
  const nowMs = 1_800_000_000_000;
  const sharedSecret = new Uint8Array(32).fill(0x41);
  const originalSecret = new Uint8Array(sharedSecret);
  const protocolKey = await deriveLocalClientReceiptReconciliationProtocolKey({
    sharedSecret,
    tenantId: "tenant-wire",
    clientId: "client.wire",
  });
  assert.deepEqual(sharedSecret, originalSecret);
  assert.equal(
    Buffer.from(protocolKey).toString("hex"),
    "e97255fadb524f2ded863f45b53821c1e98e2a8a946fd1ee74b4a887de99f1e2",
  );
  const originalProtocolKey = new Uint8Array(protocolKey);
  const gatewayIntent = Object.freeze({
    protocolVersion: "local-client-dispatch-intent-v1",
    intentId: "lcdi_1cbc518bd1add36cdfa8dcac27b102b9621cf6ec14bd6deb40c018b4925e58b4",
    executionId: `lc-exec-${"a".repeat(64)}`,
    executionBindingHmac: "c98d8ce3165dbba53060425608c6eddbee52240b46b1342e27def1e12d508cd0",
    tenantBindingHmac: "7b9959bf287285fef2c9e732784f8e011979231835ed0831f7bab4ba5efd6fa6",
    subjectBindingHmac: "120a64f3f38a44fca8895098e831285e994eb663b92ab5feb450ab304ea97f88",
    clientBindingHmac: "e2f8f9c05dbcb95dc4e27ddca76d2bc6b699184a7b024161a9e12a1b03646e72",
    routeBindingHmac: "e22a08b91cfbcc9f649ba7d5805ba86d841ec6460ed1bb0d282202dc9a5ecd76",
    identityBindingHmac: "e4239e9781ccad5189d01f76ae63aa435b71fe54d39a72435a37f164694b5bca",
    planFingerprint: "b".repeat(64),
    inputSha256: "c".repeat(64),
    dispatchFencingToken: "1",
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + 60_000,
    signature: "5fede9e681959883260adbffa70df0656d5511ef481fc31ea4c9c3011b63a58a",
  });
  const verifiedIntent = await verifyLocalClientDispatchIntent({
    protocolKey,
    intent: gatewayIntent,
    nowMs,
  });
  assert.deepEqual(verifiedIntent, gatewayIntent);

  const receipt = await createLocalClientDurableExecutionReceipt({
    protocolKey,
    intent: verifiedIntent,
    completedAtMs: nowMs + 1_234,
    nowMs: nowMs + 1_234,
  });
  assert.equal(
    receipt.receiptId,
    "lcdr_b6b5d49466a552495fe5cc4396a948744b8fb19f0c237364f5e726ae901014d1",
  );
  assert.equal(
    receipt.signature,
    "e377928680a1ae68211a5913cbec4498a9f170ed3ccbaf255538234cc6789f4a",
  );
  assert.deepEqual(await verifyLocalClientDurableExecutionReceipt({
    protocolKey,
    receipt,
    nowMs: nowMs + 1_234,
  }), receipt);
  const unsignedQuery = Object.freeze({
    protocolVersion: "local-client-reconciliation-query-v1",
    queryId: `lcq_${"1".repeat(48)}`,
    intentId: gatewayIntent.intentId,
    executionId: gatewayIntent.executionId,
    executionBindingHmac: gatewayIntent.executionBindingHmac,
    tenantBindingHmac: gatewayIntent.tenantBindingHmac,
    subjectBindingHmac: gatewayIntent.subjectBindingHmac,
    clientBindingHmac: gatewayIntent.clientBindingHmac,
    routeBindingHmac: gatewayIntent.routeBindingHmac,
    identityBindingHmac: gatewayIntent.identityBindingHmac,
    planFingerprint: gatewayIntent.planFingerprint,
    inputSha256: gatewayIntent.inputSha256,
    dispatchFencingToken: gatewayIntent.dispatchFencingToken,
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + 30_000,
    purpose: "receipt-reconciliation-only",
    authorizeExecution: false,
  });
  const query = Object.freeze({
    ...unsignedQuery,
    signature: independentlySignReceiptProtocol(
      protocolKey,
      "reconciliation-query",
      unsignedQuery,
    ),
  });
  for (const [state, createResponse] of [
    ["pending", createLocalClientPendingReconciliationResponse],
    ["not-found", createLocalClientNotFoundReconciliationResponse],
  ]) {
    const response = await createResponse({
      protocolKey,
      query,
      observedAtMs: nowMs,
      nowMs,
    });
    assert.deepEqual(response, {
      protocolVersion: "local-client-reconciliation-response-v1",
      queryId: query.queryId,
      intentId: query.intentId,
      executionId: query.executionId,
      dispatchFencingToken: query.dispatchFencingToken,
      state,
      receipt: null,
      observedAtMs: nowMs,
      retryAllowed: false,
      signature: independentlySignReceiptProtocol(protocolKey, "reconciliation-response", {
        protocolVersion: "local-client-reconciliation-response-v1",
        queryId: query.queryId,
        intentId: query.intentId,
        executionId: query.executionId,
        dispatchFencingToken: query.dispatchFencingToken,
        state,
        receipt: null,
        observedAtMs: nowMs,
        retryAllowed: false,
      }),
    });
  }
  await assert.rejects(
    createLocalClientPendingReconciliationResponse({
      protocolKey,
      query,
      observedAtMs: nowMs,
      nowMs: query.expiresAtMs + 5_001,
    }),
    (error) => error instanceof GatewayClientError
      && error.code === GATEWAY_CLIENT_ERROR_CODES.PROTOCOL,
  );
  await assert.rejects(
    createLocalClientNotFoundReconciliationResponse({
      protocolKey,
      query,
      observedAtMs: nowMs,
      nowMs,
      receipt: null,
    }),
    (error) => error instanceof GatewayClientError
      && error.code === GATEWAY_CLIENT_ERROR_CODES.PROTOCOL,
  );
  assert.deepEqual(LOCAL_CLIENT_RECEIPT_RECONCILIATION_SDK_BOUNDARIES, {
    stateless: true,
    protocolIntegrity: "hmac-sha256",
    durableStorageProvided: false,
    atomicEffectReceiptProvided: false,
    reconciliationAuthorizesExecution: false,
    clientOwnsDurableAtomicState: true,
  });

  const secretHex = Buffer.from(sharedSecret).toString("hex");
  for (const invalidIntent of [
    { ...gatewayIntent, planFingerprint: "d".repeat(64) },
    { ...gatewayIntent, unexpected: true },
  ]) {
    await assert.rejects(
      verifyLocalClientDispatchIntent({ protocolKey, intent: invalidIntent, nowMs }),
      (error) => error instanceof GatewayClientError
        && error.code === GATEWAY_CLIENT_ERROR_CODES.PROTOCOL
        && error.message === "Local-client receipt protocol operation failed."
        && !JSON.stringify(error).includes(secretHex),
    );
  }
  const accessorIntent = { ...gatewayIntent };
  Object.defineProperty(accessorIntent, "signature", {
    enumerable: true,
    get: () => gatewayIntent.signature,
  });
  await assert.rejects(
    verifyLocalClientDispatchIntent({ protocolKey, intent: accessorIntent, nowMs }),
    (error) => error instanceof GatewayClientError
      && error.code === GATEWAY_CLIENT_ERROR_CODES.PROTOCOL,
  );
  assert.deepEqual(protocolKey, originalProtocolKey);
  protocolKey.fill(0);
});

test("creates gateway-compatible managed local-client PoP v1 with independent HMAC verification", async () => {
  const secret = new Uint8Array(Buffer.from("sdk-pop-secret-material-32-bytes"));
  assert.equal(secret.byteLength, 32);
  const originalSecret = new Uint8Array(secret);
  const bodyBytes = new TextEncoder().encode(
    '{"model":"managed","messages":[{"role":"user","content":"hello"}]}',
  );
  const originalBody = new Uint8Array(bodyBytes);
  const identity = {
    tenantId: "tenant:test",
    subjectId: "subject:test",
    clientId: "managed.desktop",
    revision: 7,
  };
  const issuedAfterMs = Date.now();
  const result = await createManagedLocalClientPopProofHeader({
    secret,
    ...identity,
    method: "POST",
    path: "/v1/chat/completions?trace=exact",
    bodyBytes,
  });
  const issuedBeforeMs = Date.now();
  const proof = decodePopHeader(result.header);
  const independent = independentlySignPopProof({
    secret,
    ...identity,
    method: "POST",
    path: "/v1/chat/completions?trace=exact",
    bodyBytes,
    proof,
  });

  assert.deepEqual(secret, originalSecret);
  assert.deepEqual(bodyBytes, originalBody);
  assert.equal(proof.proofVersion, POP_PROOF_VERSION);
  assert.equal(proof.keyId, independent.keyId);
  assert.equal(result.keyId, independent.keyId);
  assert.equal(proof.signature, independent.signature);
  assert.match(proof.nonce, /^[A-Za-z0-9_-]{43}$/u);
  assert.equal(proof.expiresAtMs - proof.issuedAtMs, 30_000);
  assert.equal(result.issuedAtMs, proof.issuedAtMs);
  assert.equal(result.expiresAtMs, proof.expiresAtMs);
  assert.ok(proof.issuedAtMs >= issuedAfterMs && proof.issuedAtMs <= issuedBeforeMs);

  for (const tampered of [
    { method: "PUT" },
    { path: "/v1/chat/completions?trace=tampered" },
    { revision: 8 },
    { bodyBytes: new TextEncoder().encode('{"model":"tampered"}') },
  ]) {
    const tamperedSignature = independentlySignPopProof({
      secret,
      ...identity,
      method: "POST",
      path: "/v1/chat/completions?trace=exact",
      bodyBytes,
      proof,
      ...tampered,
    }).signature;
    assert.notEqual(tamperedSignature, proof.signature);
  }

  const maximumSecret = new Uint8Array(64).fill(0x6b);
  const maximumResult = await createManagedLocalClientPopProofHeader({
    secret: maximumSecret,
    ...identity,
    method: "POST",
    path: "/v1/chat/completions",
    bodyBytes: new Uint8Array(),
  });
  assert.match(maximumResult.header, /^popv1\./u);
  assert.ok(maximumSecret.every((byte) => byte === 0x6b));
});

test("rejects malformed or ambiguous managed local-client PoP inputs", async () => {
  const valid = () => ({
    secret: new Uint8Array(32).fill(0x31),
    tenantId: "tenant:test",
    subjectId: "subject:test",
    clientId: "managed.desktop",
    revision: 1,
    method: "POST",
    path: "/v1/chat/completions?mode=managed",
    bodyBytes: new Uint8Array(),
  });
  const invalidInputs = [
    { ...valid(), secret: new Uint8Array(31) },
    { ...valid(), secret: new Uint8Array(65) },
    { ...valid(), secret: Array(32).fill(1) },
    { ...valid(), revision: 0 },
    { ...valid(), method: "post" },
    { ...valid(), path: "//v1/chat/completions" },
    { ...valid(), path: "/v1/../chat/completions" },
    { ...valid(), path: "/v1/chat/completions#fragment" },
    { ...valid(), bodyBytes: new Uint8Array((4 * 1024 * 1024) + 1) },
    { ...valid(), unexpected: true },
  ];
  for (const input of invalidInputs) {
    await assert.rejects(
      createManagedLocalClientPopProofHeader(input),
      (error) => error instanceof GatewayClientError
        && error.code === GATEWAY_CLIENT_ERROR_CODES.PROTOCOL,
    );
  }

  const accessorInput = valid();
  Object.defineProperty(accessorInput, "tenantId", { get: () => "tenant:test" });
  await assert.rejects(
    createManagedLocalClientPopProofHeader(accessorInput),
    (error) => error instanceof GatewayClientError
      && error.code === GATEWAY_CLIENT_ERROR_CODES.PROTOCOL,
  );
});

test("signs and sends the exact managed chat bytes without exposing proof material", async () => {
  const observed = [];
  const { server, baseUrl } = await startServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    observed.push({
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: Buffer.concat(chunks),
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ id: `managed-${observed.length}` }));
  });
  const secretText = "SdkManagedPoPSecretMaterial-0001";
  const secret = new Uint8Array(Buffer.from(secretText, "utf8"));
  assert.equal(secret.byteLength, 32);
  const proofOptions = {
    secret,
    tenantId: "tenant:test",
    subjectId: "subject:test",
    clientId: "managed.desktop",
    revision: 3,
  };

  try {
    const client = createGatewayClient({ baseUrl });
    assert.deepEqual(await client.managedLocalClientChat({
      model: "managed-model",
      messages: [{ role: "user", content: "exact bytes" }],
      idempotencyKey: "managed-chat-operation-1",
    }, proofOptions), { id: "managed-1" });
    assert.deepEqual(await client.managedLocalClientChat({
      model: "managed-model",
      messages: [{ role: "user", content: "provider key" }],
      providerDispatchKey: "managed-provider-operation-2",
      unified_ai: { rag: false },
    }, proofOptions), { id: "managed-2" });

    assert.equal(observed.length, 2);
    assert.deepEqual(observed.map(({ method, url }) => ({ method, url })), [
      { method: "POST", url: "/v1/chat/completions" },
      { method: "POST", url: "/v1/chat/completions" },
    ]);
    assert.equal(observed[0].headers["idempotency-key"], "managed-chat-operation-1");
    assert.equal(observed[0].headers["provider-dispatch-key"], undefined);
    assert.equal(observed[1].headers["idempotency-key"], undefined);
    assert.equal(observed[1].headers["provider-dispatch-key"], "managed-provider-operation-2");
    assert.deepEqual(observed[0].body, Buffer.from(
      '{"model":"managed-model","messages":[{"role":"user","content":"exact bytes"}],"unified_ai":{"local_client_id":"managed.desktop"}}',
      "utf8",
    ));
    assert.deepEqual(observed[1].body, Buffer.from(
      '{"model":"managed-model","messages":[{"role":"user","content":"provider key"}],"unified_ai":{"rag":false,"local_client_id":"managed.desktop"}}',
      "utf8",
    ));

    for (const captured of observed) {
      const proofHeader = captured.headers["x-ai-gateway-local-client-proof"];
      const proof = decodePopHeader(proofHeader);
      const independent = independentlySignPopProof({
        secret,
        tenantId: proofOptions.tenantId,
        subjectId: proofOptions.subjectId,
        clientId: proofOptions.clientId,
        revision: proofOptions.revision,
        method: captured.method,
        path: captured.url,
        bodyBytes: captured.body,
        proof,
      });
      assert.equal(proof.keyId, independent.keyId);
      assert.equal(proof.signature, independent.signature);
      const completeRequest = `${JSON.stringify(captured.headers)}\n${captured.body.toString("utf8")}`;
      assert.doesNotMatch(completeRequest, new RegExp(secretText, "u"));
      assert.doesNotMatch(captured.body.toString("utf8"), /secret|proofOptions|popOptions/u);
    }
    assert.ok(secret.every((byte, index) => byte === Buffer.from(secretText)[index]));
  } finally {
    await closeServer(server);
  }
});

test("fails closed on conflicting managed chat identity and proof headers", async () => {
  const proofOptions = {
    secret: new Uint8Array(32).fill(0x77),
    tenantId: "tenant:test",
    subjectId: "subject:test",
    clientId: "managed.desktop",
    revision: 1,
  };
  const baseUrl = "http://127.0.0.1:3100";
  await assert.rejects(
    createGatewayClient({ baseUrl }).managedLocalClientChat({
      model: "managed",
      messages: [],
      unified_ai: { local_client_id: "different.client" },
    }, proofOptions),
    (error) => error instanceof GatewayClientError
      && error.code === GATEWAY_CLIENT_ERROR_CODES.PROTOCOL,
  );
  await assert.rejects(
    createGatewayClient({
      baseUrl,
      headers: { "X-AI-Gateway-Local-Client-Proof": "caller-proof" },
    }).managedLocalClientChat({ model: "managed", messages: [] }, proofOptions),
    (error) => error instanceof GatewayClientError
      && error.code === GATEWAY_CLIENT_ERROR_CODES.PROTOCOL,
  );
  await assert.rejects(
    createGatewayClient({ baseUrl }).managedLocalClientChat({
      model: "managed",
      messages: [],
      secret: "must-not-enter-body",
    }, proofOptions),
    (error) => error instanceof GatewayClientError
      && error.code === GATEWAY_CLIENT_ERROR_CODES.PROTOCOL,
  );
});

test("refuses signed managed-chat redirects without forwarding the proof or body", async () => {
  let redirectedRequests = 0;
  const { server, baseUrl } = await startServer(async (request, response) => {
    for await (const _chunk of request) {
      // Consume the initial request before returning the redirect.
    }
    if (request.url === "/redirect-target") {
      redirectedRequests += 1;
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
      return;
    }
    response.writeHead(307, { location: "/redirect-target" });
    response.end();
  });
  try {
    await assert.rejects(
      createGatewayClient({ baseUrl }).managedLocalClientChat(
        { model: "managed", messages: [{ role: "user", content: "redirect-sensitive" }] },
        {
          secret: new Uint8Array(32).fill(0x61),
          tenantId: "tenant:test",
          subjectId: "subject:test",
          clientId: "managed.desktop",
          revision: 1,
        },
      ),
      (error) => error instanceof GatewayClientError
        && error.code === GATEWAY_CLIENT_ERROR_CODES.NETWORK,
    );
    assert.equal(redirectedRequests, 0);
  } finally {
    await closeServer(server);
  }
});

test("requires an origin-only baseUrl for managed local-client chat", async () => {
  const proofOptions = {
    secret: new Uint8Array(32).fill(0x62),
    tenantId: "tenant:test",
    subjectId: "subject:test",
    clientId: "managed.desktop",
    revision: 1,
  };
  for (const baseUrl of [
    "http://127.0.0.1:3100/gateway",
    "http://127.0.0.1:3100/.",
    "http://127.0.0.1:3100?gateway=managed",
    "http://127.0.0.1:3100?",
    "http://127.0.0.1:3100#gateway",
    "http://127.0.0.1:3100#",
  ]) {
    await assert.rejects(
      createGatewayClient({ baseUrl }).managedLocalClientChat(
        { model: "managed", messages: [] },
        proofOptions,
      ),
      (error) => error instanceof GatewayClientError
        && error.code === GATEWAY_CLIENT_ERROR_CODES.PROTOCOL
        && /origin-only/u.test(error.message),
    );
  }
});

async function startServer(handler) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  assert.ok(address && typeof address === "object");

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function closeServer(server) {
  if (server.listening) {
    server.close();
    await once(server, "close");
  }
}

test("validates and normalizes the gateway base URL", () => {
  assert.throws(
    () => createGatewayClient(),
    (error) =>
      error instanceof GatewayClientError &&
      error.message === "Gateway baseUrl is required",
  );
  assert.throws(
    () => createGatewayClient({ baseUrl: "   " }),
    (error) => error instanceof GatewayClientError,
  );
  assert.equal(
    createGatewayClient({ baseUrl: " http://127.0.0.1:3100/// " }).baseUrl,
    "http://127.0.0.1:3100",
  );
});

test("preserves status and JSON body for non-2xx responses", async () => {
  const { server, baseUrl } = await startServer((_request, response) => {
    response.writeHead(429, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "rate limited", retryAfterMs: 250 }));
  });

  try {
    await assert.rejects(
      createGatewayClient({ baseUrl }).health(),
      (error) =>
        error instanceof GatewayClientError &&
        error.statusCode === 429 &&
        error.responseBody?.error === "rate limited" &&
        error.responseBody?.retryAfterMs === 250,
    );
  } finally {
    await closeServer(server);
  }
});

test("promotes a structured gateway deadline into the client error contract", async () => {
  const { server, baseUrl } = await startServer((_request, response) => {
    response.writeHead(504, { "content-type": "application/json" });
    response.end(JSON.stringify({
      status: "error",
      error: {
        code: "GATEWAY_DEADLINE_EXCEEDED",
        category: "timeout",
        retryable: false,
      },
    }));
  });

  try {
    await assert.rejects(
      createGatewayClient({ baseUrl }).health(),
      (error) =>
        error instanceof GatewayClientError &&
        error.code === "GATEWAY_DEADLINE_EXCEEDED" &&
        error.kind === "http" &&
        error.statusCode === 504 &&
        error.retryable === false,
    );
  } finally {
    await closeServer(server);
  }
});

test("reports invalid JSON with response context", async () => {
  const { server, baseUrl } = await startServer((_request, response) => {
    response.writeHead(502, { "content-type": "text/plain" });
    response.end("upstream unavailable");
  });

  try {
    await assert.rejects(
      createGatewayClient({ baseUrl }).health(),
      (error) =>
        error instanceof GatewayClientError &&
        error.message === "Gateway returned invalid JSON" &&
        error.statusCode === 502 &&
        error.responseBody === "upstream unavailable" &&
        error.cause instanceof Error,
    );
  } finally {
    await closeServer(server);
  }
});

test("wraps network failures as GatewayClientError", async () => {
  const { server, baseUrl } = await startServer((_request, response) => {
    response.end(JSON.stringify({ ok: true }));
  });
  await closeServer(server);

  await assert.rejects(
    createGatewayClient({ baseUrl }).health(),
    (error) =>
      error instanceof GatewayClientError &&
      error.message === "Gateway request failed" &&
      error.cause instanceof Error,
  );
});

test("sends the expected method, path, headers, and JSON body", async () => {
  let request;
  const { server, baseUrl } = await startServer(async (incoming, response) => {
    request = {
      method: incoming.method,
      url: incoming.url,
      headers: incoming.headers,
      body: "",
    };
    for await (const chunk of incoming) request.body += chunk;

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
  });

  try {
    const result = await createGatewayClient({
      baseUrl,
      headers: { "x-test-client": "shared-sdk" },
    }).enhancePrompt({ input: "Build an API", profile: "coding" });

    assert.deepEqual(result, { status: "ok" });
    assert.equal(request.method, "POST");
    assert.equal(request.url, "/prompts/enhance");
    assert.equal(request.headers["x-test-client"], "shared-sdk");
    assert.deepEqual(JSON.parse(request.body), {
      input: "Build an API",
      profile: "coding",
    });
  } finally {
    await closeServer(server);
  }
});

test("exposes the local-client control-plane and governed execution paths", async () => {
  const observed = [];
  const { server, baseUrl } = await startServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    observed.push({
      method: request.method,
      url: request.url,
      body: body ? JSON.parse(body) : null,
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
  });

  try {
    const client = createGatewayClient({ baseUrl });
    await client.localClientsStatus();
    await client.localClients({
      includeDisabled: true,
      limit: 20,
      offset: 5,
      capabilities: ["browser", "web_automation"],
    });
    await client.discoverLocalClients({ includeUnknown: true });
    await client.registerLocalClient({
      clientId: "desktop-browser",
      displayName: "Desktop Browser",
      capabilityIds: ["browser"],
    });
    await client.disableLocalClient({
      clientId: "desktop-browser",
      reason: "maintenance",
    });
    await client.revokeLocalClient({
      clientId: "retired-browser",
      expectedRevision: 7,
      reason: "security_incident",
    });
    await client.smartManageLocalClients();
    await client.routeLocalClient({ requiredCapabilities: ["browser"] });
    await client.routeLocalClientProvider({
      clientId: "desktop-browser",
      requiredCapabilities: ["reasoning"],
      requestedFanout: 1,
      fusionRequested: false,
    });
    await client.verifyLocalClient({
      clientId: "desktop-browser",
      expectedRevision: 1,
      expectedAdapter: { id: "loopback.adapter", type: "loopback-http", version: "1.0.0" },
      expectedManifestSha256: "a".repeat(64),
    });
    await client.previewGovernedLocalClientExecution({
      clientId: "desktop-browser",
      capabilityId: "local_application",
      actionId: "invoke",
      input: { payload: "open-browser" },
    });
    await client.approveGovernedLocalClientExecution({ planId: "b".repeat(64) });
    await client.executeGovernedLocalClientExecution({
      planId: "b".repeat(64),
      input: { payload: "open-browser" },
    }, { idempotencyKey: "local-execution-sdk-key-1" });
    await client.governedLocalClientExecutionStatus("lc-exec-sdk-test");
    await client.cancelGovernedLocalClientExecution("lc-exec-sdk-test", { reason: "operator request" });
    await client.previewLocalClientExecution({
      action: "open-page",
      clientId: "desktop-browser",
      requiredCapabilities: ["browser"],
      arguments: { title: "example" },
    });

    assert.deepEqual(observed, [
      { method: "GET", url: "/local-clients/status", body: null },
      {
        method: "GET",
        url: "/local-clients/registry?includeDisabled=true&limit=20&offset=5&capabilities=browser%2Cweb_automation",
        body: null,
      },
      {
        method: "POST",
        url: "/local-clients/discover/system",
        body: { includeUnknown: true, dryRun: true },
      },
      {
        method: "POST",
        url: "/local-clients/register",
        body: {
          clientId: "desktop-browser",
          displayName: "Desktop Browser",
          capabilityIds: ["browser"],
        },
      },
      {
        method: "POST",
        url: "/local-clients/disable",
        body: {
          clientId: "desktop-browser",
          reason: "maintenance",
        },
      },
      {
        method: "POST",
        url: "/local-clients/revoke",
        body: {
          clientId: "retired-browser",
          expectedRevision: 7,
          reason: "security_incident",
        },
      },
      {
        method: "POST",
        url: "/local-clients/smart-manage",
        body: { dryRun: true },
      },
      {
        method: "POST",
        url: "/local-clients/route",
        body: { requiredCapabilities: ["browser"] },
      },
      {
        method: "POST",
        url: "/local-clients/provider-route",
        body: {
          clientId: "desktop-browser",
          requiredCapabilities: ["reasoning"],
          requestedFanout: 1,
          fusionRequested: false,
        },
      },
      {
        method: "POST",
        url: "/local-clients/verify",
        body: {
          clientId: "desktop-browser",
          expectedRevision: 1,
          expectedAdapter: { id: "loopback.adapter", type: "loopback-http", version: "1.0.0" },
          expectedManifestSha256: "a".repeat(64),
        },
      },
      {
        method: "POST",
        url: "/local-clients/executions/preview",
        body: {
          clientId: "desktop-browser",
          capabilityId: "local_application",
          actionId: "invoke",
          input: { payload: "open-browser" },
        },
      },
      {
        method: "POST",
        url: "/local-clients/executions/approve",
        body: { planId: "b".repeat(64) },
      },
      {
        method: "POST",
        url: "/local-clients/executions/execute",
        body: { planId: "b".repeat(64), input: { payload: "open-browser" } },
      },
      { method: "GET", url: "/local-clients/executions/lc-exec-sdk-test", body: null },
      {
        method: "POST",
        url: "/local-clients/executions/lc-exec-sdk-test/cancel",
        body: { reason: "operator request" },
      },
      {
        method: "POST",
        url: "/local-clients/execute",
        body: {
          action: "open-page",
          clientId: "desktop-browser",
          requiredCapabilities: ["browser"],
          arguments: { title: "example" },
          dryRun: true,
        },
      },
    ]);
  } finally {
    await closeServer(server);
  }
});

test("exposes the Agent Governance lifecycle through canonical gateway paths", async () => {
  const observed = [];
  const { server, baseUrl } = await startServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    observed.push({ method: request.method, url: request.url, body: body ? JSON.parse(body) : null });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "success", data: {} }));
  });

  try {
    const client = createGatewayClient({ baseUrl });
    await client.agentGovernanceStats();
    await client.generateGovernedAgent({
      name: "sdk-agent",
      task: "read one report",
      requestedTools: ["file_read"],
      ttlSeconds: 3600,
    });
    await client.governedAgents();
    await client.governedAgent("agt_sdk");
    await client.governedAgentPolicy("agt_sdk");
    await client.governedAgentAudit("agt_sdk");
    await client.runGovernedAgent("agt_sdk", { goal: "read", toolMode: "none" });
    await client.revokeGovernedAgent("agt_sdk", { reason: "done", cascade: true });
    await client.governedApprovals("agt_sdk");
    await client.decideGovernedApproval("apr_sdk", "approve");
    await client.governancePolicies();
    await client.createGovernancePolicy({
      policyKey: "tenant:tenant-a",
      version: 2,
      policyType: "tenant",
      scopeKey: "tenant-a",
      content: {},
    });
    await client.activateGovernancePolicy("tenant:tenant-a", 2);

    assert.deepEqual(observed.map(({ method, url }) => ({ method, url })), [
      { method: "GET", url: "/v1/governance/stats" },
      { method: "POST", url: "/v1/agents/generate" },
      { method: "GET", url: "/v1/agents" },
      { method: "GET", url: "/v1/agents/agt_sdk" },
      { method: "GET", url: "/v1/agents/agt_sdk/effective-policy" },
      { method: "GET", url: "/v1/agents/agt_sdk/audit" },
      { method: "POST", url: "/v1/agents/agt_sdk/run" },
      { method: "POST", url: "/v1/agents/agt_sdk/revoke" },
      { method: "GET", url: "/v1/approvals?agentId=agt_sdk" },
      { method: "POST", url: "/v1/approvals/apr_sdk/approve" },
      { method: "GET", url: "/v1/policies" },
      { method: "POST", url: "/v1/policies" },
      { method: "POST", url: "/v1/policies/tenant%3Atenant-a/2/activate" },
    ]);
    assert.deepEqual(observed[6].body, { goal: "read", toolMode: "none" });
    assert.deepEqual(observed[9].body, {});
  } finally {
    await closeServer(server);
  }
});

test("inspects one local client through a bounded registry-list helper", async () => {
  const observed = [];
  const target = {
    clientId: "target-client",
    displayName: "Target Client",
    state: "declared",
    enabled: true,
    routable: true,
    capabilityIds: ["browser"],
    health: { status: "unknown" },
    trustDecision: "declared",
    revision: 2,
  };
  const { server, baseUrl } = await startServer(async (request, response) => {
    observed.push(request.url);
    const offset = new URL(request.url, "http://127.0.0.1").searchParams.get("offset");
    const clients = offset === "0"
      ? [{ ...target, clientId: "other-client", displayName: "Other Client" }]
      : [target];
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      status: "ok",
      data: {
        phase: "local-client-intelligence-gateway-v1",
        total: 2,
        clients,
        pagination: {
          offset: Number(offset),
          limit: 100,
          returned: 1,
          includeDisabled: true,
        },
      },
    }));
  });

  try {
    const client = createGatewayClient({ baseUrl });
    const result = await client.inspectLocalClient("target-client");
    assert.deepEqual(observed, [
      "/local-clients/registry?includeDisabled=true&limit=100&offset=0",
      "/local-clients/registry?includeDisabled=true&limit=100&offset=1",
    ]);
    assert.deepEqual(result.data, {
      source: "registry-list",
      independentAuthority: false,
      clientId: "target-client",
      found: true,
      pagesScanned: 2,
      client: target,
    });
    await assert.rejects(
      client.inspectLocalClient("  "),
      (error) => error?.code === "GATEWAY_PROTOCOL_ERROR",
    );
  } finally {
    await closeServer(server);
  }
});

test("sends governed local-client idempotency only in the required header", async () => {
  let observed;
  const { server, baseUrl } = await startServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    observed = {
      key: request.headers["idempotency-key"],
      body: JSON.parse(body),
    };
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
  });
  try {
    const client = createGatewayClient({ baseUrl });
    await client.executeGovernedLocalClientExecution({
      planId: "d".repeat(64),
      input: { payload: "bounded" },
    }, { idempotencyKey: "governed-sdk-key-1" });
    assert.deepEqual(observed, {
      key: "governed-sdk-key-1",
      body: { planId: "d".repeat(64), input: { payload: "bounded" } },
    });
    assert.throws(
      () => client.executeGovernedLocalClientExecution({
        planId: "d".repeat(64),
        input: {},
      }, { idempotencyKey: "has space" }),
      (error) => error?.code === "GATEWAY_PROTOCOL_ERROR",
    );
  } finally {
    await closeServer(server);
  }
});

test("exposes governed onboarding paths with encoded profiles and required idempotency", async () => {
  const observed = [];
  const { server, baseUrl } = await startServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    observed.push({
      method: request.method,
      url: request.url,
      idempotencyKey: request.headers["idempotency-key"] ?? null,
      body: body ? JSON.parse(body) : null,
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
  });

  try {
    const client = createGatewayClient({ baseUrl });
    const profileFixture = "cursor-mcp-json/fixture?";
    await client.localClientOnboardingProfiles();
    await client.localClientOnboardingProfile(profileFixture);
    await client.verifyLocalClientOnboardingProfile(profileFixture);
    await client.planGovernedLocalClientOnboarding({
      profileId: "cursor-mcp-json",
      action: "enable",
    });
    await client.approveGovernedLocalClientOnboarding(
      { planId: `onboarding_${"a".repeat(64)}`, note: "approved by operator" },
      { idempotencyKey: "onboarding-approve-key" },
    );
    await client.applyGovernedLocalClientOnboarding(
      { planId: `onboarding_${"a".repeat(64)}` },
      { idempotencyKey: "onboarding-apply-key" },
    );
    await client.rollbackGovernedLocalClientOnboarding(
      { planId: `onboarding_${"b".repeat(64)}` },
      { idempotencyKey: "onboarding-rollback-key" },
    );
    await client.recoverGovernedLocalClientOnboarding(
      { planId: `onboarding_${"c".repeat(64)}` },
      { idempotencyKey: "onboarding-recover-key" },
    );

    assert.deepEqual(observed, [
      { method: "GET", url: "/local-clients/onboarding/profiles", idempotencyKey: null, body: null },
      {
        method: "GET",
        url: "/local-clients/onboarding/profiles/cursor-mcp-json%2Ffixture%3F",
        idempotencyKey: null,
        body: null,
      },
      {
        method: "GET",
        url: "/local-clients/onboarding/profiles/cursor-mcp-json%2Ffixture%3F/verify",
        idempotencyKey: null,
        body: null,
      },
      {
        method: "POST",
        url: "/local-clients/onboarding/plans",
        idempotencyKey: null,
        body: { profileId: "cursor-mcp-json", action: "enable" },
      },
      {
        method: "POST",
        url: "/local-clients/onboarding/approve",
        idempotencyKey: "onboarding-approve-key",
        body: { planId: `onboarding_${"a".repeat(64)}`, note: "approved by operator" },
      },
      {
        method: "POST",
        url: "/local-clients/onboarding/apply",
        idempotencyKey: "onboarding-apply-key",
        body: { planId: `onboarding_${"a".repeat(64)}` },
      },
      {
        method: "POST",
        url: "/local-clients/onboarding/rollback",
        idempotencyKey: "onboarding-rollback-key",
        body: { planId: `onboarding_${"b".repeat(64)}` },
      },
      {
        method: "POST",
        url: "/local-clients/onboarding/recover",
        idempotencyKey: "onboarding-recover-key",
        body: { planId: `onboarding_${"c".repeat(64)}` },
      },
    ]);

    for (const invoke of [
      () => client.approveGovernedLocalClientOnboarding({ planId: "plan" }),
      () => client.applyGovernedLocalClientOnboarding({ planId: "plan" }, { idempotencyKey: "" }),
      () => client.rollbackGovernedLocalClientOnboarding({ planId: "plan" }, { idempotencyKey: "has space" }),
      () => client.recoverGovernedLocalClientOnboarding({ planId: "plan" }, { idempotencyKey: "x".repeat(256) }),
    ]) {
      assert.throws(invoke, (error) => error?.code === "GATEWAY_PROTOCOL_ERROR");
    }
  } finally {
    await closeServer(server);
  }
});

test("returns an empty object for an empty successful response", async () => {
  const { server, baseUrl } = await startServer((_request, response) => {
    response.writeHead(204);
    response.end();
  });

  try {
    assert.deepEqual(await createGatewayClient({ baseUrl }).health(), {});
  } finally {
    await closeServer(server);
  }
});

test("health consumers can inspect managed-protocol and receipt rollback blockers", async () => {
  const health = {
    app: "ai-gateway-service",
    status: "degraded",
    phase: "contract-runtime-test",
    routes: ["GET /health/check"],
    localClientExecutionFeedback: {
      required: true,
      ready: false,
      activeRecoveryFailure: false,
      outbox: { available: true, durable: true },
      dispatcher: { enabled: true, available: true, lifecycle: "started", lastErrorCode: null },
      receiptJournal: {
        enabled: true,
        available: true,
        durable: true,
        distributed: false,
        singleHost: true,
        bindingCount: 1,
        recoveryContextEncrypted: true,
        snapshotRollbackProtected: false,
        clientAtomicEffectReceiptVerified: false,
      },
      receiptRecovery: {
        enabled: true,
        available: true,
        lifecycle: "started",
        executionRedispatchAllowed: false,
        runInFlight: false,
        runCount: 1,
        resolvedCount: 0,
        unresolvedCount: 1,
        failureCount: 0,
        consecutiveFailureCount: 0,
        lastErrorCode: null,
        lastRunSucceeded: true,
        lastSuccessAt: "2026-08-28T00:00:00.000Z",
        lastRunAt: "2026-08-28T00:00:00.000Z",
      },
    },
    managedLocalClientProtocol: {
      enabled: true,
      ready: false,
      fakeProviderOnly: false,
      realProviderConfigured: true,
      multiInstance: false,
      replayProtection: "sqlite-authenticated-replay-set",
      durableReplayProtection: true,
      authenticatedReplaySet: true,
      snapshotRollbackProtected: false,
      defensiveEnabled: true,
      capacityIsolatedByScope: true,
      principalBindingCount: 1,
      blockers: ["rollback_resistant_pop_replay_guard_required_for_real_provider"],
    },
    localClientPopSnapshotRollbackProtection: {
      protocolCoreAvailable: true,
      configured: false,
      ready: false,
      snapshotRollbackProtected: false,
      nativeDeploymentVerified: false,
      blockers: ["native_anchor_deployment_unverified"],
      boundaries: {
        mutatesOperatingSystem: false,
        provisionsNativeAuthority: false,
        nativeWindowsAdapterImplemented: false,
        sqliteCheckpointCoordinatorImplemented: false,
        statusBooleanAloneIsEvidence: false,
        challengeBoundProtectedEvidenceRequired: true,
        checkpointReadBeforeAndAfterAttestation: true,
        everyReplayMutationMustAdvanceAnchor: true,
        crashRecoveryMustFailClosed: true,
        externalToReplaySnapshotRequired: true,
      },
    },
    providerMode: "real",
    realProviderEnabled: true,
    providers: [],
  };
  const envelope = { status: "ok", data: health };
  let observedPath = null;
  const { server, baseUrl } = await startServer((request, response) => {
    observedPath = request.url;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(envelope));
  });

  try {
    const result = await createGatewayClient({ baseUrl }).health();
    assert.equal(observedPath, "/health/check");
    assert.equal(result.data.managedLocalClientProtocol.ready, false);
    assert.deepEqual(result.data.managedLocalClientProtocol.blockers, [
      "rollback_resistant_pop_replay_guard_required_for_real_provider",
    ]);
    assert.equal(
      result.data.localClientExecutionFeedback.receiptJournal.snapshotRollbackProtected,
      false,
    );
    assert.equal(
      result.data.localClientExecutionFeedback.receiptJournal.clientAtomicEffectReceiptVerified,
      false,
    );
    assert.equal(
      result.data.localClientPopSnapshotRollbackProtection.snapshotRollbackProtected,
      false,
    );
    assert.equal(result.data.managedProtocolDispatch, undefined);
  } finally {
    await closeServer(server);
  }
});

test("forwards custom headers without mutating the caller's headers", async () => {
  let requestHeaders;
  const headers = { "x-test-client": "shared-sdk", authorization: "Bearer test" };
  const { server, baseUrl } = await startServer((request, response) => {
    requestHeaders = request.headers;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
  });

  try {
    assert.deepEqual(await createGatewayClient({ baseUrl, headers }).health(), { ok: true });
    assert.equal(requestHeaders["x-test-client"], "shared-sdk");
    assert.equal(requestHeaders.authorization, "Bearer test");
    assert.deepEqual(headers, {
      "x-test-client": "shared-sdk",
      authorization: "Bearer test",
    });
  } finally {
    await closeServer(server);
  }
});

test("adds a stable explicit idempotency key to provider requests without putting it in the body", async () => {
  let observed;
  const { server, baseUrl } = await startServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    observed = { headers: request.headers, body: JSON.parse(body) };
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ success: true }));
  });

  try {
    const client = createGatewayClient({
      baseUrl,
      headers: { "Provider-Dispatch-Key": "configured-default-key" },
      providerDispatchKeyFactory: () => "factory-key-must-not-win",
    });
    await client.chat({
      idempotencyKey: "operation-key-1",
      messages: [{ role: "user", content: "hello" }],
    });
    assert.equal(observed.headers["idempotency-key"], "operation-key-1");
    assert.equal(observed.headers["provider-dispatch-key"], undefined);
    assert.deepEqual(observed.body, {
      messages: [{ role: "user", content: "hello" }],
    });
  } finally {
    await closeServer(server);
  }
});

test("generates a provider-only dispatch key for first-party provider calls by default", async () => {
  let observedHeaders;
  const { server, baseUrl } = await startServer((request, response) => {
    observedHeaders = request.headers;
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ success: true }));
  });

  try {
    await createGatewayClient({ baseUrl }).chat({
      messages: [{ role: "user", content: "hello" }],
    });
    assert.match(observedHeaders["provider-dispatch-key"], /^uai-sdk-[A-Za-z0-9-]+$/);
    assert.equal(observedHeaders["idempotency-key"], undefined);
  } finally {
    await closeServer(server);
  }
});

test("supports a caller-stable provider-only key without putting it in the body", async () => {
  let observed;
  const { server, baseUrl } = await startServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    observed = { headers: request.headers, body: JSON.parse(body) };
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ success: true }));
  });

  try {
    await createGatewayClient({ baseUrl }).chat({
      providerDispatchKey: "provider-operation-key-1",
      messages: [{ role: "user", content: "hello" }],
    });
    assert.equal(observed.headers["provider-dispatch-key"], "provider-operation-key-1");
    assert.equal(observed.headers["idempotency-key"], undefined);
    assert.deepEqual(observed.body, {
      messages: [{ role: "user", content: "hello" }],
    });
  } finally {
    await closeServer(server);
  }
});

test("fails locally when provider key configuration is ambiguous", () => {
  const baseUrl = "http://127.0.0.1:3100";
  const client = createGatewayClient({ baseUrl });
  assert.throws(
    () => client.chat({
      idempotencyKey: "response-key",
      providerDispatchKey: "dispatch-key",
      messages: [{ role: "user", content: "hello" }],
    }),
    (error) => error instanceof GatewayClientError && error.code === GATEWAY_CLIENT_ERROR_CODES.PROTOCOL,
  );

  const ambiguousHeadersClient = createGatewayClient({
    baseUrl,
    headers: {
      "Idempotency-Key": "response-key",
      "Provider-Dispatch-Key": "dispatch-key",
    },
  });
  assert.throws(
    () => ambiguousHeadersClient.chat({ messages: [{ role: "user", content: "hello" }] }),
    (error) => error instanceof GatewayClientError && error.code === GATEWAY_CLIENT_ERROR_CODES.PROTOCOL,
  );
});

test("parses multiple server-sent events from chatStream", async () => {
  const { server, baseUrl } = await startServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      [
        "event: start",
        'data: {"id":"stream-1"}',
        "",
        "event: chunk",
        'data: {"text":"hello"}',
        "",
        "event: done",
        'data: {"text":"hello world"}',
        "",
      ].join("\n"),
    );
  });

  try {
    const events = [];
    for await (const event of createGatewayClient({ baseUrl }).chatStream({
      messages: [{ role: "user", content: "Hello" }],
    })) {
      events.push(event);
    }

    assert.deepEqual(events, [
      { id: "stream-1" },
      { text: "hello" },
      { text: "hello world" },
    ]);
  } finally {
    await closeServer(server);
  }
});

test("surfaces stream error events as GatewayClientError", async () => {
  const { server, baseUrl } = await startServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(["event: error", 'data: {"code":"provider_unavailable"}', ""].join("\n"));
  });

  try {
    const stream = createGatewayClient({ baseUrl }).chatStream({
      messages: [{ role: "user", content: "Hello" }],
    });

    await assert.rejects(
      (async () => {
        for await (const _event of stream) {
          // The stream should fail before yielding an event.
        }
      })(),
      (error) =>
        error instanceof GatewayClientError &&
        error.statusCode === 200 &&
        error.responseBody?.code === "provider_unavailable",
    );
  } finally {
    await closeServer(server);
  }
});

test("wraps timeout aborts while preserving the transport cause", async () => {
  const { server, baseUrl } = await startServer((_request, response) => {
    setTimeout(() => {
      if (!response.destroyed) response.end(JSON.stringify({ ok: true }));
    }, 100);
  });

  try {
    await assert.rejects(
      createGatewayClient({ baseUrl, timeoutMs: 10 }).health(),
      (error) =>
        error instanceof GatewayClientTimeoutError &&
        error instanceof GatewayClientError &&
        error.message === "Gateway request failed" &&
        error.code === "GATEWAY_CLIENT_TIMEOUT" &&
        error.kind === "timeout" &&
        error.timeoutMs === 10 &&
        error.retryable === false &&
        error.statusCode === undefined &&
        error.cause instanceof Error &&
        error.cause.name === "TimeoutError",
    );
  } finally {
    await closeServer(server);
  }
});

test("preserves caller cancellation for JSON requests", async () => {
  const { server, baseUrl } = await startServer((_request, response) => {
    setTimeout(() => {
      if (!response.destroyed) response.end(JSON.stringify({ ok: true }));
    }, 100);
  });
  const controller = new AbortController();
  const gateway = createGatewayClient({ baseUrl, signal: controller.signal, timeoutMs: 1_000 });

  try {
    const request = gateway.health();
    setTimeout(() => controller.abort(), 10);

    await assert.rejects(
      request,
      (error) =>
        error instanceof GatewayClientAbortError &&
        error instanceof GatewayClientError &&
        error.message === "Gateway request failed" &&
        error.code === "GATEWAY_CLIENT_ABORTED" &&
        error.kind === "cancelled" &&
        error.retryable === false &&
        error.cause?.name === "AbortError",
    );
  } finally {
    await closeServer(server);
  }
});

test("preserves caller cancellation for chat streams", async () => {
  const { server, baseUrl } = await startServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/event-stream" });
    setTimeout(() => {
      if (!response.destroyed) response.end(["event: done", 'data: {"ok":true}', ""].join("\n"));
    }, 100);
  });
  const controller = new AbortController();
  const gateway = createGatewayClient({ baseUrl, signal: controller.signal, timeoutMs: 1_000 });

  try {
    const stream = gateway.chatStream({
      messages: [{ role: "user", content: "Hello" }],
    });
    setTimeout(() => controller.abort(), 10);

    await assert.rejects(
      (async () => {
        for await (const _event of stream) {
          // The request should abort before the delayed event is written.
        }
      })(),
      (error) =>
        error instanceof GatewayClientAbortError &&
        error instanceof GatewayClientError &&
        error.message === "Gateway stream request failed" &&
        error.code === "GATEWAY_CLIENT_ABORTED" &&
        error.kind === "cancelled" &&
        error.cause?.name === "AbortError",
    );
  } finally {
    await closeServer(server);
  }
});
