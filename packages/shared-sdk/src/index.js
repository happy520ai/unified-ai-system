import {
  LOCAL_CLIENT_DISPATCH_INTENT_VERSION,
  LOCAL_CLIENT_DURABLE_RECEIPT_VERSION,
  LOCAL_CLIENT_RECONCILIATION_QUERY_VERSION,
  LOCAL_CLIENT_RECONCILIATION_RESPONSE_VERSION,
  LOCAL_CLIENT_RECEIPT_RECONCILIATION_HMAC_DOMAIN,
  LOCAL_CLIENT_RECEIPT_RECONCILIATION_KEY_DERIVATION_DOMAIN,
} from "@unified-ai-system/shared-contracts";

const DEFAULT_TIMEOUT_MS = 10_000;
const PROVIDER_KEY_HEADERS = new Set(["idempotency-key", "provider-dispatch-key"]);
const MANAGED_LOCAL_CLIENT_POP_HEADER = "x-ai-gateway-local-client-proof";
const MANAGED_LOCAL_CLIENT_CHAT_PATH = "/v1/chat/completions";
const MANAGED_LOCAL_CLIENT_POP_PROOF_VERSION = "managed-local-client-pop-proof-v1";
const MANAGED_LOCAL_CLIENT_POP_CANONICAL_VERSION = "managed-local-client-pop-canonical-v1";
const MANAGED_LOCAL_CLIENT_POP_TTL_MS = 30_000;
const MANAGED_LOCAL_CLIENT_POP_NONCE_BYTES = 32;
const MANAGED_LOCAL_CLIENT_POP_MAX_BODY_BYTES = 4 * 1024 * 1024;
const MANAGED_LOCAL_CLIENT_POP_MAX_PATH_BYTES = 2_048;
const MANAGED_LOCAL_CLIENT_POP_OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const MANAGED_LOCAL_CLIENT_POP_CLIENT_ID_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const MANAGED_LOCAL_CLIENT_POP_METHOD_PATTERN = /^[A-Z]{3,16}$/u;
const MANAGED_LOCAL_CLIENT_PROOF_OPTION_KEYS = Object.freeze([
  "secret",
  "tenantId",
  "subjectId",
  "clientId",
  "revision",
  "method",
  "path",
  "bodyBytes",
]);
const MANAGED_LOCAL_CLIENT_CHAT_PROOF_OPTION_KEYS = Object.freeze([
  "secret",
  "tenantId",
  "subjectId",
  "clientId",
  "revision",
]);
const MANAGED_LOCAL_CLIENT_SENSITIVE_BODY_KEYS = new Set([
  "secret",
  "proof",
  "popproof",
  "popoptions",
  "proofoptions",
]);
const LOCAL_CLIENT_RECEIPT_PROTOCOL_KEY_MIN_BYTES = 32;
const LOCAL_CLIENT_RECEIPT_PROTOCOL_KEY_MAX_BYTES = 64;
const LOCAL_CLIENT_RECEIPT_MAX_DATE_MS = 8_640_000_000_000_000;
const LOCAL_CLIENT_RECEIPT_DEFAULT_CLOCK_SKEW_MS = 5_000;
const LOCAL_CLIENT_RECEIPT_MAX_CLOCK_SKEW_MS = 60_000;
const LOCAL_CLIENT_RECEIPT_DEFAULT_INTENT_MAX_TTL_MS = 10 * 60_000;
const LOCAL_CLIENT_RECEIPT_DEFAULT_QUERY_MAX_TTL_MS = 60_000;
const LOCAL_CLIENT_RECEIPT_EXECUTION_ID_PATTERN = /^lc-exec-[a-f0-9]{64}$/u;
const LOCAL_CLIENT_RECEIPT_INTENT_ID_PATTERN = /^lcdi_[a-f0-9]{64}$/u;
const LOCAL_CLIENT_RECEIPT_DURABLE_ID_PATTERN = /^lcdr_[a-f0-9]{64}$/u;
const LOCAL_CLIENT_RECEIPT_QUERY_ID_PATTERN = /^lcq_[a-f0-9]{48}$/u;
const LOCAL_CLIENT_RECEIPT_DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const LOCAL_CLIENT_RECEIPT_FENCE_PATTERN = /^(?:0|[1-9][0-9]{0,18})$/u;
const LOCAL_CLIENT_RECEIPT_MAX_FENCE = 9_223_372_036_854_775_807n;
const LOCAL_CLIENT_DISPATCH_INTENT_KEYS = Object.freeze([
  "protocolVersion", "intentId", "executionId", "executionBindingHmac",
  "tenantBindingHmac", "subjectBindingHmac", "clientBindingHmac", "routeBindingHmac",
  "identityBindingHmac", "planFingerprint", "inputSha256", "dispatchFencingToken",
  "issuedAtMs", "expiresAtMs", "signature",
]);
const LOCAL_CLIENT_RECONCILIATION_QUERY_KEYS = Object.freeze([
  "protocolVersion", "queryId", "intentId", "executionId", "executionBindingHmac",
  "tenantBindingHmac", "subjectBindingHmac", "clientBindingHmac", "routeBindingHmac",
  "identityBindingHmac", "planFingerprint", "inputSha256", "dispatchFencingToken",
  "issuedAtMs", "expiresAtMs", "purpose", "authorizeExecution", "signature",
]);
const LOCAL_CLIENT_DURABLE_RECEIPT_KEYS = Object.freeze([
  "protocolVersion", "receiptId", "intentId", "executionId", "executionBindingHmac",
  "tenantBindingHmac", "subjectBindingHmac", "clientBindingHmac", "routeBindingHmac",
  "identityBindingHmac", "planFingerprint", "inputSha256", "dispatchFencingToken",
  "completedAtMs", "executionMode", "externalEffectPerformed", "status", "signature",
]);

export const GATEWAY_CLIENT_ERROR_CODES = Object.freeze({
  ABORTED: "GATEWAY_CLIENT_ABORTED",
  TIMEOUT: "GATEWAY_CLIENT_TIMEOUT",
  NETWORK: "GATEWAY_NETWORK_ERROR",
  HTTP: "GATEWAY_HTTP_ERROR",
  PROTOCOL: "GATEWAY_PROTOCOL_ERROR",
  STREAM: "GATEWAY_STREAM_ERROR",
});

export const LOCAL_CLIENT_RECEIPT_RECONCILIATION_SDK_BOUNDARIES = Object.freeze({
  stateless: true,
  protocolIntegrity: "hmac-sha256",
  durableStorageProvided: false,
  atomicEffectReceiptProvided: false,
  reconciliationAuthorizesExecution: false,
  clientOwnsDurableAtomicState: true,
});

export class GatewayClientError extends Error {
  constructor(message, options = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "GatewayClientError";
    this.code = options.code ?? GATEWAY_CLIENT_ERROR_CODES.NETWORK;
    this.kind = options.kind ?? "network";
    this.retryable = options.retryable ?? false;
    this.statusCode = options.statusCode;
    this.responseBody = options.responseBody;
  }
}

export class GatewayClientAbortError extends GatewayClientError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: GATEWAY_CLIENT_ERROR_CODES.ABORTED,
      kind: "cancelled",
      retryable: false,
    });
    this.name = "GatewayClientAbortError";
    this.reason = options.reason;
  }
}

export class GatewayClientTimeoutError extends GatewayClientError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: GATEWAY_CLIENT_ERROR_CODES.TIMEOUT,
      kind: "timeout",
      retryable: false,
    });
    this.name = "GatewayClientTimeoutError";
    this.timeoutMs = options.timeoutMs;
  }
}

/**
 * Create the exact PoP v1 transport header accepted by the managed-client
 * gateway ingress. This implementation uses only standards-based WebCrypto so
 * it works in modern browsers and Node without bundling a Node crypto shim.
 * Caller-owned bytes are never modified; all private internal byte copies are
 * wiped before this promise settles.
 */
export async function createManagedLocalClientPopProofHeader(options) {
  let secretCopy;
  let bodyCopy;
  let derivedKeyBytes;
  let keyIdDigest;
  let bodyDigest;
  let nonceBytes;
  let signatureBytes;
  let canonicalPayloadBytes;
  let transportBytes;

  try {
    const normalized = normalizeManagedLocalClientPopOptions(options);
    secretCopy = normalized.secret;
    bodyCopy = normalized.bodyBytes;
    const webCrypto = requireManagedLocalClientWebCrypto();
    const context = `${normalized.tenantId}\0${normalized.clientId}`;

    derivedKeyBytes = await managedLocalClientHmacSha256(
      webCrypto,
      secretCopy,
      encodeManagedLocalClientUtf8(`managed-local-client-pop-derived-key-v1\0${context}`),
    );
    keyIdDigest = await managedLocalClientHmacSha256(
      webCrypto,
      secretCopy,
      encodeManagedLocalClientUtf8(`managed-local-client-pop-key-id-v1\0${context}`),
    );
    const keyId = `lcpop-${managedLocalClientHex(keyIdDigest).slice(0, 24)}`;

    bodyDigest = new Uint8Array(await webCrypto.subtle.digest("SHA-256", bodyCopy));
    nonceBytes = new Uint8Array(MANAGED_LOCAL_CLIENT_POP_NONCE_BYTES);
    webCrypto.getRandomValues(nonceBytes);
    const nonce = managedLocalClientBase64Url(nonceBytes);
    const issuedAtMs = Date.now();
    if (!Number.isSafeInteger(issuedAtMs) || issuedAtMs <= 0) {
      throw createManagedLocalClientPopProtocolError();
    }
    const expiresAtMs = issuedAtMs + MANAGED_LOCAL_CLIENT_POP_TTL_MS;
    if (!Number.isSafeInteger(expiresAtMs)) {
      throw createManagedLocalClientPopProtocolError();
    }

    const unsignedProof = {
      proofVersion: MANAGED_LOCAL_CLIENT_POP_PROOF_VERSION,
      keyId,
      nonce,
      issuedAtMs,
      expiresAtMs,
    };
    const canonicalPayload = {
      canonicalVersion: MANAGED_LOCAL_CLIENT_POP_CANONICAL_VERSION,
      proofVersion: unsignedProof.proofVersion,
      keyId,
      tenantId: normalized.tenantId,
      subjectId: normalized.subjectId,
      clientId: normalized.clientId,
      clientRevision: normalized.revision,
      method: normalized.method,
      path: normalized.path,
      bodySha256: managedLocalClientHex(bodyDigest),
      nonce,
      issuedAtMs,
      expiresAtMs,
    };
    canonicalPayloadBytes = encodeManagedLocalClientUtf8(
      canonicalizeManagedLocalClientJson(canonicalPayload),
    );
    signatureBytes = await managedLocalClientHmacSha256(
      webCrypto,
      derivedKeyBytes,
      canonicalPayloadBytes,
    );
    const proof = {
      ...unsignedProof,
      signature: managedLocalClientHex(signatureBytes),
    };
    transportBytes = encodeManagedLocalClientUtf8(
      canonicalizeManagedLocalClientJson(proof),
    );
    const header = `popv1.${managedLocalClientBase64Url(transportBytes)}`;

    return Object.freeze({ header, keyId, issuedAtMs, expiresAtMs });
  } catch (error) {
    if (error instanceof GatewayClientError) throw error;
    throw createManagedLocalClientPopProtocolError();
  } finally {
    secretCopy?.fill(0);
    bodyCopy?.fill(0);
    derivedKeyBytes?.fill(0);
    keyIdDigest?.fill(0);
    bodyDigest?.fill(0);
    nonceBytes?.fill(0);
    signatureBytes?.fill(0);
    canonicalPayloadBytes?.fill(0);
    transportBytes?.fill(0);
  }
}

/**
 * Derives the gateway-compatible per-tenant/per-client receipt protocol key.
 * The returned bytes are sensitive caller-owned key material. The SDK never
 * serializes them and wipes all internal copies before settling.
 */
export async function deriveLocalClientReceiptReconciliationProtocolKey(options) {
  let secretCopy;
  let contextBytes;
  let derivedBytes;
  try {
    assertExactLocalClientReceiptRecord(
      options,
      ["sharedSecret", "tenantId", "clientId"],
      ["sharedSecret", "tenantId", "clientId"],
    );
    secretCopy = cloneLocalClientReceiptKey(options.sharedSecret);
    const tenantId = normalizeLocalClientReceiptOpaqueIdentity(options.tenantId);
    const clientId = normalizeLocalClientReceiptOpaqueIdentity(options.clientId);
    contextBytes = encodeManagedLocalClientUtf8(
      `${LOCAL_CLIENT_RECEIPT_RECONCILIATION_KEY_DERIVATION_DOMAIN}\0${tenantId}\0${clientId}`,
    );
    derivedBytes = await localClientReceiptHmacSha256(
      requireLocalClientReceiptWebCrypto(),
      secretCopy,
      contextBytes,
    );
    return new Uint8Array(derivedBytes);
  } catch (error) {
    throw normalizeLocalClientReceiptProtocolError(error);
  } finally {
    secretCopy?.fill(0);
    contextBytes?.fill(0);
    derivedBytes?.fill(0);
  }
}

/** Verifies one exact, fresh gateway dispatch intent without persisting it. */
export async function verifyLocalClientDispatchIntent(options) {
  let protocolKey;
  try {
    assertExactLocalClientReceiptRecord(
      options,
      ["protocolKey", "intent", "nowMs", "allowedClockSkewMs", "maxTtlMs"],
      ["protocolKey", "intent"],
    );
    protocolKey = cloneLocalClientReceiptKey(options.protocolKey);
    return await verifyLocalClientDispatchIntentWithKey(protocolKey, options.intent, {
      nowMs: normalizeLocalClientReceiptNow(options.nowMs),
      allowedClockSkewMs: normalizeLocalClientReceiptClockSkew(options.allowedClockSkewMs),
      maxTtlMs: normalizeLocalClientReceiptTtl(
        options.maxTtlMs,
        LOCAL_CLIENT_RECEIPT_DEFAULT_INTENT_MAX_TTL_MS,
        LOCAL_CLIENT_RECEIPT_DEFAULT_INTENT_MAX_TTL_MS,
      ),
      enforceFreshness: true,
    });
  } catch (error) {
    throw normalizeLocalClientReceiptProtocolError(error);
  } finally {
    protocolKey?.fill(0);
  }
}

/** Verifies one exact, fresh, read-only reconciliation query. */
export async function verifyLocalClientReceiptReconciliationQuery(options) {
  let protocolKey;
  try {
    assertExactLocalClientReceiptRecord(
      options,
      ["protocolKey", "query", "nowMs", "allowedClockSkewMs", "maxTtlMs"],
      ["protocolKey", "query"],
    );
    protocolKey = cloneLocalClientReceiptKey(options.protocolKey);
    return await verifyLocalClientReceiptReconciliationQueryWithKey(protocolKey, options.query, {
      nowMs: normalizeLocalClientReceiptNow(options.nowMs),
      allowedClockSkewMs: normalizeLocalClientReceiptClockSkew(options.allowedClockSkewMs),
      maxTtlMs: normalizeLocalClientReceiptTtl(
        options.maxTtlMs,
        LOCAL_CLIENT_RECEIPT_DEFAULT_QUERY_MAX_TTL_MS,
        LOCAL_CLIENT_RECEIPT_DEFAULT_QUERY_MAX_TTL_MS,
      ),
    });
  } catch (error) {
    throw normalizeLocalClientReceiptProtocolError(error);
  } finally {
    protocolKey?.fill(0);
  }
}

/** Verifies a client durable completion receipt without making a durability claim. */
export async function verifyLocalClientDurableExecutionReceipt(options) {
  let protocolKey;
  try {
    assertExactLocalClientReceiptRecord(
      options,
      ["protocolKey", "receipt", "nowMs", "allowedClockSkewMs"],
      ["protocolKey", "receipt"],
    );
    protocolKey = cloneLocalClientReceiptKey(options.protocolKey);
    return await verifyLocalClientDurableExecutionReceiptWithKey(protocolKey, options.receipt, {
      nowMs: normalizeLocalClientReceiptNow(options.nowMs),
      allowedClockSkewMs: normalizeLocalClientReceiptClockSkew(options.allowedClockSkewMs),
    });
  } catch (error) {
    throw normalizeLocalClientReceiptProtocolError(error);
  } finally {
    protocolKey?.fill(0);
  }
}

/**
 * Creates signed completion evidence. The caller must first commit its own
 * atomic effect/receipt journal; this stateless helper performs no persistence.
 */
export async function createLocalClientDurableExecutionReceipt(options) {
  let protocolKey;
  try {
    assertExactLocalClientReceiptRecord(
      options,
      ["protocolKey", "intent", "completedAtMs", "nowMs", "allowedClockSkewMs", "maxTtlMs"],
      ["protocolKey", "intent", "completedAtMs"],
    );
    protocolKey = cloneLocalClientReceiptKey(options.protocolKey);
    const nowMs = normalizeLocalClientReceiptNow(options.nowMs);
    const allowedClockSkewMs = normalizeLocalClientReceiptClockSkew(options.allowedClockSkewMs);
    const intent = await verifyLocalClientDispatchIntentWithKey(protocolKey, options.intent, {
      nowMs,
      allowedClockSkewMs,
      maxTtlMs: normalizeLocalClientReceiptTtl(
        options.maxTtlMs,
        LOCAL_CLIENT_RECEIPT_DEFAULT_INTENT_MAX_TTL_MS,
        LOCAL_CLIENT_RECEIPT_DEFAULT_INTENT_MAX_TTL_MS,
      ),
      enforceFreshness: false,
    });
    const completedAtMs = normalizeLocalClientReceiptTimestamp(options.completedAtMs);
    if (completedAtMs > safeLocalClientReceiptAdd(nowMs, allowedClockSkewMs)) {
      throw createLocalClientReceiptProtocolError();
    }
    const receiptIdDigest = await localClientReceiptKeyedDigest(
      protocolKey,
      "durable-receipt-id",
      canonicalizeLocalClientReceiptJson({
        clientBindingHmac: intent.clientBindingHmac,
        completedAtMs,
        dispatchFencingToken: intent.dispatchFencingToken,
        executionBindingHmac: intent.executionBindingHmac,
        identityBindingHmac: intent.identityBindingHmac,
        inputSha256: intent.inputSha256,
        intentId: intent.intentId,
        planFingerprint: intent.planFingerprint,
        routeBindingHmac: intent.routeBindingHmac,
        subjectBindingHmac: intent.subjectBindingHmac,
        tenantBindingHmac: intent.tenantBindingHmac,
      }),
    );
    const unsigned = Object.freeze({
      protocolVersion: LOCAL_CLIENT_DURABLE_RECEIPT_VERSION,
      receiptId: `lcdr_${receiptIdDigest}`,
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
      completedAtMs,
      executionMode: "governed",
      externalEffectPerformed: true,
      status: "completed",
    });
    return Object.freeze({
      ...unsigned,
      signature: await signLocalClientReceiptProtocol(protocolKey, "durable-receipt", unsigned),
    });
  } catch (error) {
    throw normalizeLocalClientReceiptProtocolError(error);
  } finally {
    protocolKey?.fill(0);
  }
}

/** Creates a signed completed reconciliation response for an already durable receipt. */
export async function createLocalClientCompletedReceiptReconciliationResponse(options) {
  let protocolKey;
  try {
    assertExactLocalClientReceiptRecord(
      options,
      ["protocolKey", "query", "receipt", "observedAtMs", "nowMs", "allowedClockSkewMs", "maxTtlMs"],
      ["protocolKey", "query", "receipt", "observedAtMs"],
    );
    protocolKey = cloneLocalClientReceiptKey(options.protocolKey);
    const clock = normalizeLocalClientReceiptResponseClock(options);
    const query = await verifyLocalClientReceiptReconciliationQueryWithKey(
      protocolKey,
      options.query,
      clock,
    );
    const receipt = await verifyLocalClientDurableExecutionReceiptWithKey(
      protocolKey,
      options.receipt,
      clock,
    );
    assertLocalClientReceiptMatchesQuery(receipt, query);
    return await createLocalClientReceiptReconciliationResponseWithKey(
      protocolKey,
      query,
      "completed",
      receipt,
      normalizeLocalClientReceiptObservedAt(options.observedAtMs, clock),
    );
  } catch (error) {
    throw normalizeLocalClientReceiptProtocolError(error);
  } finally {
    protocolKey?.fill(0);
  }
}

/**
 * Creates a signed no-effect response. The caller must durably prove locally
 * that no effect claim occurred before using this helper.
 */
export async function createLocalClientFailedBeforeEffectReconciliationResponse(options) {
  return createLocalClientReceiptlessReconciliationResponse(options, "failed-before-effect");
}

/** Creates a signed receipt-less response for a still unresolved client execution. */
export async function createLocalClientPendingReconciliationResponse(options) {
  return createLocalClientReceiptlessReconciliationResponse(options, "pending");
}

/**
 * Creates a signed receipt-less absence response. Absence never proves that an
 * effect did not execute and never authorizes retry or redispatch.
 */
export async function createLocalClientNotFoundReconciliationResponse(options) {
  return createLocalClientReceiptlessReconciliationResponse(options, "not-found");
}

async function createLocalClientReceiptlessReconciliationResponse(options, state) {
  let protocolKey;
  try {
    assertExactLocalClientReceiptRecord(
      options,
      ["protocolKey", "query", "observedAtMs", "nowMs", "allowedClockSkewMs", "maxTtlMs"],
      ["protocolKey", "query", "observedAtMs"],
    );
    protocolKey = cloneLocalClientReceiptKey(options.protocolKey);
    const clock = normalizeLocalClientReceiptResponseClock(options);
    const query = await verifyLocalClientReceiptReconciliationQueryWithKey(
      protocolKey,
      options.query,
      clock,
    );
    return await createLocalClientReceiptReconciliationResponseWithKey(
      protocolKey,
      query,
      state,
      null,
      normalizeLocalClientReceiptObservedAt(options.observedAtMs, clock),
    );
  } catch (error) {
    throw normalizeLocalClientReceiptProtocolError(error);
  } finally {
    protocolKey?.fill(0);
  }
}

export function createGatewayClient(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const headers = options.headers ?? {};
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const signal = options.signal;
  const providerDispatchKeyFactory = options.providerDispatchKeyFactory ?? createDefaultProviderDispatchKey;
  const requestJson = (requestOptions) =>
    requestJsonImpl({ baseUrl, headers, timeoutMs, signal, ...requestOptions });
  const requestSse = (requestOptions) =>
    requestSseImpl({ baseUrl, headers, timeoutMs, signal, ...requestOptions });

  return {
    baseUrl,
    health() {
      return requestJson({
        baseUrl,
        path: "/health/check",
        headers,
        timeoutMs,
      });
    },
    setupReadiness() {
      return requestJson({
        baseUrl,
        path: "/setup/readiness",
        headers,
        timeoutMs,
      });
    },
    localClientsStatus() {
      return requestJson({
        baseUrl,
        path: "/local-clients/status",
        headers,
        timeoutMs,
      });
    },
    localClients(options = {}) {
      const query = new URLSearchParams();
      if (options.includeDisabled === true) query.set("includeDisabled", "true");
      if (Number.isInteger(options.limit)) query.set("limit", String(options.limit));
      if (Number.isInteger(options.offset)) query.set("offset", String(options.offset));
      if (Array.isArray(options.capabilities) && options.capabilities.length > 0) {
        query.set("capabilities", options.capabilities.join(","));
      }
      const suffix = query.size > 0 ? `?${query.toString()}` : "";
      return requestJson({
        baseUrl,
        path: `/local-clients/registry${suffix}`,
        headers,
        timeoutMs,
      });
    },
    discoverLocalClients(request = {}) {
      return requestJson({
        baseUrl,
        path: "/local-clients/discover/system",
        method: "POST",
        body: withSafeDryRunDefault(request),
        headers,
        timeoutMs,
      });
    },
    inspectLocalClient(clientId) {
      return inspectLocalClientFromRegistry({
        clientId,
        requestJson,
      });
    },
    registerLocalClient(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/register",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    disableLocalClient(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/disable",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    revokeLocalClient(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/revoke",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    smartManageLocalClients(request = {}) {
      return requestJson({
        baseUrl,
        path: "/local-clients/smart-manage",
        method: "POST",
        body: withSafeDryRunDefault(request),
        headers,
        timeoutMs,
      });
    },
    routeLocalClient(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/route",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    routeLocalClientProvider(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/provider-route",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    verifyLocalClient(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/verify",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    previewGovernedLocalClientExecution(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/executions/preview",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    approveGovernedLocalClientExecution(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/executions/approve",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    executeGovernedLocalClientExecution(request, executionOptions) {
      return requestJson({
        baseUrl,
        path: "/local-clients/executions/execute",
        method: "POST",
        body: request,
        headers: prepareRequiredIdempotencyHeaders(headers, executionOptions),
        timeoutMs,
      });
    },
    governedLocalClientExecutionStatus(executionId) {
      return requestJson({
        baseUrl,
        path: `/local-clients/executions/${encodeURIComponent(String(executionId ?? ""))}`,
        headers,
        timeoutMs,
      });
    },
    cancelGovernedLocalClientExecution(executionId, request = {}) {
      return requestJson({
        baseUrl,
        path: `/local-clients/executions/${encodeURIComponent(String(executionId ?? ""))}/cancel`,
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    localClientOnboardingProfiles() {
      return requestJson({
        baseUrl,
        path: "/local-clients/onboarding/profiles",
        headers,
        timeoutMs,
      });
    },
    localClientOnboardingProfile(profileId) {
      return requestJson({
        baseUrl,
        path: `/local-clients/onboarding/profiles/${encodeURIComponent(String(profileId ?? ""))}`,
        headers,
        timeoutMs,
      });
    },
    verifyLocalClientOnboardingProfile(profileId) {
      return requestJson({
        baseUrl,
        path: `/local-clients/onboarding/profiles/${encodeURIComponent(String(profileId ?? ""))}/verify`,
        headers,
        timeoutMs,
      });
    },
    planGovernedLocalClientOnboarding(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/onboarding/plans",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    approveGovernedLocalClientOnboarding(request, mutationOptions) {
      return requestJson({
        baseUrl,
        path: "/local-clients/onboarding/approve",
        method: "POST",
        body: request,
        headers: prepareRequiredIdempotencyHeaders(
          headers,
          mutationOptions,
          "Governed local-client onboarding",
        ),
        timeoutMs,
      });
    },
    applyGovernedLocalClientOnboarding(request, mutationOptions) {
      return requestJson({
        baseUrl,
        path: "/local-clients/onboarding/apply",
        method: "POST",
        body: request,
        headers: prepareRequiredIdempotencyHeaders(
          headers,
          mutationOptions,
          "Governed local-client onboarding",
        ),
        timeoutMs,
      });
    },
    rollbackGovernedLocalClientOnboarding(request, mutationOptions) {
      return requestJson({
        baseUrl,
        path: "/local-clients/onboarding/rollback",
        method: "POST",
        body: request,
        headers: prepareRequiredIdempotencyHeaders(
          headers,
          mutationOptions,
          "Governed local-client onboarding",
        ),
        timeoutMs,
      });
    },
    recoverGovernedLocalClientOnboarding(request, mutationOptions) {
      return requestJson({
        baseUrl,
        path: "/local-clients/onboarding/recover",
        method: "POST",
        body: request,
        headers: prepareRequiredIdempotencyHeaders(
          headers,
          mutationOptions,
          "Governed local-client onboarding",
        ),
        timeoutMs,
      });
    },
    previewLocalClientExecution(request) {
      return requestJson({
        baseUrl,
        path: "/local-clients/execute",
        method: "POST",
        body: { ...request, dryRun: true },
        headers,
        timeoutMs,
      });
    },
    enhancePrompt(request) {
      return requestJson({
        baseUrl,
        path: "/prompts/enhance",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    enhancePromptLlm(request) {
      const prepared = prepareProviderRequest(request, headers, providerDispatchKeyFactory);
      return requestJson({
        baseUrl,
        path: "/prompts/enhance-llm",
        method: "POST",
        body: prepared.body,
        headers: prepared.headers,
        timeoutMs,
      });
    },
    chat(request) {
      const prepared = prepareProviderRequest(request, headers, providerDispatchKeyFactory);
      return requestJson({
        baseUrl,
        path: "/chat",
        method: "POST",
        body: prepared.body,
        headers: prepared.headers,
        timeoutMs,
      });
    },
    managedLocalClientChat(request, proofOptions) {
      return managedLocalClientChatImpl({
        baseUrl,
        request,
        proofOptions,
        headers,
        providerDispatchKeyFactory,
        signal,
        timeoutMs,
      });
    },
    ragChat(request) {
      const prepared = prepareProviderRequest(request, headers, providerDispatchKeyFactory);
      return requestJson({
        baseUrl,
        path: "/chat/rag",
        method: "POST",
        body: prepared.body,
        headers: prepared.headers,
        timeoutMs,
      });
    },
    chatStream(request) {
      const prepared = prepareProviderRequest(request, headers, providerDispatchKeyFactory);
      return requestSse({
        baseUrl,
        path: "/chat/stream",
        method: "POST",
        body: prepared.body,
        headers: prepared.headers,
        timeoutMs,
      });
    },
    knowledgeRetrieve(request) {
      return requestJson({
        baseUrl,
        path: "/knowledge/retrieve",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    knowledgeLoad(request) {
      return requestJson({
        baseUrl,
        path: "/knowledge/load",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    knowledgeInfraReadiness() {
      return requestJson({
        baseUrl,
        path: "/knowledge/infra/readiness",
        headers,
        timeoutMs,
      });
    },
    modelImportPreview(request) {
      return requestJson({
        baseUrl,
        path: "/models/import/preview",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    modelImportConfirm(request) {
      return requestJson({
        baseUrl,
        path: "/models/import/confirm",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    agentGovernanceStats() {
      return requestJson({
        baseUrl,
        path: "/v1/governance/stats",
        headers,
        timeoutMs,
      });
    },
    generateGovernedAgent(request) {
      return requestJson({
        baseUrl,
        path: "/v1/agents/generate",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    governedAgents() {
      return requestJson({ baseUrl, path: "/v1/agents", headers, timeoutMs });
    },
    governedAgent(agentId) {
      return requestJson({
        baseUrl,
        path: `/v1/agents/${encodeGovernancePathId(agentId, "Agent")}`,
        headers,
        timeoutMs,
      });
    },
    governedAgentPolicy(agentId) {
      return requestJson({
        baseUrl,
        path: `/v1/agents/${encodeGovernancePathId(agentId, "Agent")}/effective-policy`,
        headers,
        timeoutMs,
      });
    },
    governedAgentAudit(agentId) {
      return requestJson({
        baseUrl,
        path: `/v1/agents/${encodeGovernancePathId(agentId, "Agent")}/audit`,
        headers,
        timeoutMs,
      });
    },
    runGovernedAgent(agentId, request) {
      return requestJson({
        baseUrl,
        path: `/v1/agents/${encodeGovernancePathId(agentId, "Agent")}/run`,
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    revokeGovernedAgent(agentId, request = {}) {
      return requestJson({
        baseUrl,
        path: `/v1/agents/${encodeGovernancePathId(agentId, "Agent")}/revoke`,
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    governedApprovals(agentId) {
      const query = agentId === undefined
        ? ""
        : `?agentId=${encodeURIComponent(normalizeGovernanceId(agentId, "Agent"))}`;
      return requestJson({ baseUrl, path: `/v1/approvals${query}`, headers, timeoutMs });
    },
    decideGovernedApproval(approvalId, decision) {
      if (decision !== "approve" && decision !== "reject") {
        throw createGatewayProtocolError("Governed approval decision must be approve or reject.");
      }
      return requestJson({
        baseUrl,
        path: `/v1/approvals/${encodeGovernancePathId(approvalId, "Approval")}/${decision}`,
        method: "POST",
        body: {},
        headers,
        timeoutMs,
      });
    },
    governancePolicies() {
      return requestJson({ baseUrl, path: "/v1/policies", headers, timeoutMs });
    },
    createGovernancePolicy(request) {
      return requestJson({
        baseUrl,
        path: "/v1/policies",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    activateGovernancePolicy(policyKey, version) {
      if (!Number.isSafeInteger(version) || version < 1) {
        throw createGatewayProtocolError("Governance policy version must be a positive integer.");
      }
      return requestJson({
        baseUrl,
        path: `/v1/policies/${encodeGovernancePathId(policyKey, "Policy")}/${version}/activate`,
        method: "POST",
        body: {},
        headers,
        timeoutMs,
      });
    },
    workflowHealth() {
      return requestJson({
        baseUrl,
        path: "/workflow/health",
        headers,
        timeoutMs,
      });
    },
    workflowActions() {
      return requestJson({
        baseUrl,
        path: "/workflow/actions",
        headers,
        timeoutMs,
      });
    },
    workflowPlan(request) {
      return requestJson({
        baseUrl,
        path: "/workflow/plan",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    workflowRun(request) {
      return requestJson({
        baseUrl,
        path: "/workflow/run",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    workforceHealth() {
      return requestJson({
        baseUrl,
        path: "/workforce/health",
        headers,
        timeoutMs,
      });
    },
    workforceAgents() {
      return requestJson({
        baseUrl,
        path: "/workforce/agents",
        headers,
        timeoutMs,
      });
    },
    workforcePlan(request) {
      return requestJson({
        baseUrl,
        path: "/workforce/plan",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    workforcePlanSave(request) {
      return requestJson({
        baseUrl,
        path: "/workforce/plans/save",
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    workforcePlans() {
      return requestJson({
        baseUrl,
        path: "/workforce/plans",
        headers,
        timeoutMs,
      });
    },
    workforcePlanGet(planId) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}`,
        headers,
        timeoutMs,
      });
    },
    workforcePlanDelete(planId) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}`,
        method: "DELETE",
        headers,
        timeoutMs,
      });
    },
    workforcePlanExport(planId) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}/export`,
        headers,
        timeoutMs,
      });
    },
    workforcePlanClarifications(planId, request) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}/clarifications`,
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    workforcePlanLifecycle(planId, request) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}/lifecycle`,
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    workforcePlanReviewPackage(planId) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}/review-package`,
        headers,
        timeoutMs,
      });
    },
    workforcePlanApprovalGate(planId, request) {
      return requestJson({
        baseUrl,
        path: `/workforce/plans/${encodeURIComponent(planId)}/approval-gate`,
        method: "POST",
        body: request,
        headers,
        timeoutMs,
      });
    },
    generate(request) {
      const prepared = prepareProviderRequest(request, headers, providerDispatchKeyFactory);
      return requestJson({
        baseUrl,
        path: "/gateway/route",
        method: "POST",
        body: prepared.body,
        headers: prepared.headers,
        timeoutMs,
      });
    },
  };
}

function normalizeGovernanceId(value, label) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 160 || /[\/\\\u0000-\u001f\u007f]/u.test(normalized)) {
    throw createGatewayProtocolError(`${label} identifier is invalid.`);
  }
  return normalized;
}

function encodeGovernancePathId(value, label) {
  return encodeURIComponent(normalizeGovernanceId(value, label));
}

async function inspectLocalClientFromRegistry({
  clientId,
  requestJson,
}) {
  const normalizedClientId = normalizeInspectionClientId(clientId);
  const limit = 100;
  const maxPages = 100;
  let offset = 0;
  let pagesScanned = 0;

  while (pagesScanned < maxPages) {
    const envelope = await requestJson({
      path: `/local-clients/registry?includeDisabled=true&limit=${limit}&offset=${offset}`,
    });
    const registry = envelope?.data;
    if (
      !registry
      || typeof registry !== "object"
      || !Array.isArray(registry.clients)
      || !registry.pagination
      || typeof registry.pagination !== "object"
    ) {
      throw createGatewayProtocolError("Gateway returned an invalid local-client registry page.");
    }
    pagesScanned += 1;
    const client = registry.clients.find((candidate) => candidate?.clientId === normalizedClientId) ?? null;
    if (client) {
      return {
        ...envelope,
        data: {
          source: "registry-list",
          independentAuthority: false,
          clientId: normalizedClientId,
          found: true,
          pagesScanned,
          client,
        },
      };
    }

    const returned = Number.isSafeInteger(registry.pagination.returned)
      ? registry.pagination.returned
      : registry.clients.length;
    const total = Number.isSafeInteger(registry.total) ? registry.total : offset + returned;
    if (returned < 1 || offset + returned >= total) {
      return {
        ...envelope,
        data: {
          source: "registry-list",
          independentAuthority: false,
          clientId: normalizedClientId,
          found: false,
          pagesScanned,
          client: null,
        },
      };
    }
    offset += returned;
  }

  throw createGatewayProtocolError("Local-client inspection exceeded the bounded registry scan.");
}

function normalizeInspectionClientId(value) {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 256
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw createGatewayProtocolError("Local-client inspection requires one bounded clientId.");
  }
  return value;
}

function withSafeDryRunDefault(request) {
  const source = request && typeof request === "object" && !Array.isArray(request)
    ? request
    : {};
  return source.dryRun === undefined ? { ...source, dryRun: true } : source;
}

function createGatewayProtocolError(message) {
  return new GatewayClientError(message, {
    code: GATEWAY_CLIENT_ERROR_CODES.PROTOCOL,
    kind: "protocol",
    retryable: false,
  });
}

async function managedLocalClientChatImpl({
  baseUrl,
  request,
  proofOptions,
  headers,
  providerDispatchKeyFactory,
  signal,
  timeoutMs,
}) {
  let bodyBytes;
  try {
    assertManagedLocalClientOriginBaseUrl(baseUrl);
    assertManagedLocalClientDataRecord(request, "Managed local-client chat requires a plain request object.");
    if (Reflect.ownKeys(request).some((key) => (
      typeof key !== "string"
      || MANAGED_LOCAL_CLIENT_SENSITIVE_BODY_KEYS.has(key.toLowerCase())
    ))) {
      throw createGatewayProtocolError(
        "Managed local-client proof material must be supplied only through proofOptions.",
      );
    }
    assertExactManagedLocalClientRecord(
      proofOptions,
      MANAGED_LOCAL_CLIENT_CHAT_PROOF_OPTION_KEYS,
    );
    assertManagedLocalClientChatProofOptions(proofOptions);
    const prepared = prepareProviderRequest(request, headers, providerDispatchKeyFactory);
    if (Object.keys(prepared.headers).some(
      (name) => String(name).toLowerCase() === MANAGED_LOCAL_CLIENT_POP_HEADER,
    )) {
      throw createGatewayProtocolError(
        "Managed local-client PoP headers must be created by the SDK per request.",
      );
    }
    const existingExtension = prepared.body.unified_ai;
    if (existingExtension !== undefined) {
      assertManagedLocalClientDataRecord(
        existingExtension,
        "Managed local-client unified_ai options must be a plain object.",
      );
      if (
        existingExtension.local_client_id !== undefined
        && existingExtension.local_client_id !== proofOptions.clientId
      ) {
        throw createGatewayProtocolError(
          "Managed local-client request identity does not match proofOptions.",
        );
      }
    }
    const body = {
      ...prepared.body,
      unified_ai: {
        ...(existingExtension ?? {}),
        local_client_id: proofOptions.clientId,
      },
    };
    let serialized;
    try {
      serialized = JSON.stringify(body);
    } catch {
      throw createGatewayProtocolError("Managed local-client chat body is not serializable JSON.");
    }
    if (typeof serialized !== "string") {
      throw createGatewayProtocolError("Managed local-client chat body is not serializable JSON.");
    }
    bodyBytes = encodeManagedLocalClientUtf8(serialized);
    if (bodyBytes.byteLength > MANAGED_LOCAL_CLIENT_POP_MAX_BODY_BYTES) {
      throw createGatewayProtocolError("Managed local-client chat body exceeds the PoP request limit.");
    }
    const proof = await createManagedLocalClientPopProofHeader({
      secret: proofOptions.secret,
      tenantId: proofOptions.tenantId,
      subjectId: proofOptions.subjectId,
      clientId: proofOptions.clientId,
      revision: proofOptions.revision,
      method: "POST",
      path: MANAGED_LOCAL_CLIENT_CHAT_PATH,
      bodyBytes,
    });
    return await requestJsonBytesImpl({
      baseUrl,
      path: MANAGED_LOCAL_CLIENT_CHAT_PATH,
      method: "POST",
      bodyBytes,
      headers: {
        ...prepared.headers,
        [MANAGED_LOCAL_CLIENT_POP_HEADER]: proof.header,
      },
      signal,
      timeoutMs,
    });
  } finally {
    bodyBytes?.fill(0);
  }
}

function normalizeManagedLocalClientPopOptions(raw) {
  assertExactManagedLocalClientRecord(raw, MANAGED_LOCAL_CLIENT_PROOF_OPTION_KEYS);
  if (
    !(raw.secret instanceof Uint8Array)
    || raw.secret.byteLength < 32
    || raw.secret.byteLength > 64
    || !(raw.bodyBytes instanceof Uint8Array)
    || raw.bodyBytes.byteLength > MANAGED_LOCAL_CLIENT_POP_MAX_BODY_BYTES
    || typeof raw.tenantId !== "string"
    || !MANAGED_LOCAL_CLIENT_POP_OPAQUE_ID_PATTERN.test(raw.tenantId)
    || typeof raw.subjectId !== "string"
    || !MANAGED_LOCAL_CLIENT_POP_OPAQUE_ID_PATTERN.test(raw.subjectId)
    || typeof raw.clientId !== "string"
    || !MANAGED_LOCAL_CLIENT_POP_CLIENT_ID_PATTERN.test(raw.clientId)
    || !Number.isSafeInteger(raw.revision)
    || raw.revision <= 0
    || typeof raw.method !== "string"
    || !MANAGED_LOCAL_CLIENT_POP_METHOD_PATTERN.test(raw.method)
  ) {
    throw createManagedLocalClientPopProtocolError();
  }
  const path = normalizeManagedLocalClientPopPath(raw.path);
  return {
    secret: new Uint8Array(raw.secret),
    tenantId: raw.tenantId,
    subjectId: raw.subjectId,
    clientId: raw.clientId,
    revision: raw.revision,
    method: raw.method,
    path,
    bodyBytes: new Uint8Array(raw.bodyBytes),
  };
}

function assertManagedLocalClientChatProofOptions(raw) {
  if (
    !(raw.secret instanceof Uint8Array)
    || raw.secret.byteLength < 32
    || raw.secret.byteLength > 64
    || typeof raw.tenantId !== "string"
    || !MANAGED_LOCAL_CLIENT_POP_OPAQUE_ID_PATTERN.test(raw.tenantId)
    || typeof raw.subjectId !== "string"
    || !MANAGED_LOCAL_CLIENT_POP_OPAQUE_ID_PATTERN.test(raw.subjectId)
    || typeof raw.clientId !== "string"
    || !MANAGED_LOCAL_CLIENT_POP_CLIENT_ID_PATTERN.test(raw.clientId)
    || !Number.isSafeInteger(raw.revision)
    || raw.revision <= 0
  ) {
    throw createManagedLocalClientPopProtocolError();
  }
}

function normalizeManagedLocalClientPopPath(value) {
  if (
    typeof value !== "string"
    || value.length < 1
    || encodeManagedLocalClientUtf8(value).byteLength > MANAGED_LOCAL_CLIENT_POP_MAX_PATH_BYTES
    || !value.startsWith("/")
    || value.startsWith("//")
    || value.includes("\\")
    || value.includes("#")
    || /[\s\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw createManagedLocalClientPopProtocolError();
  }
  try {
    const parsed = new URL(value, "http://local-client.invalid");
    if (
      parsed.origin !== "http://local-client.invalid"
      || `${parsed.pathname}${parsed.search}` !== value
    ) {
      throw createManagedLocalClientPopProtocolError();
    }
  } catch (error) {
    if (error instanceof GatewayClientError) throw error;
    throw createManagedLocalClientPopProtocolError();
  }
  return value;
}

function assertExactManagedLocalClientRecord(value, expectedKeys) {
  assertManagedLocalClientDataRecord(
    value,
    "Managed local-client PoP proof options are invalid.",
  );
  const actualKeys = Reflect.ownKeys(value);
  if (
    actualKeys.length !== expectedKeys.length
    || actualKeys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
    || expectedKeys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw createManagedLocalClientPopProtocolError();
  }
}

function assertManagedLocalClientDataRecord(value, message) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw createGatewayProtocolError(message);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw createGatewayProtocolError(message);
  }
  if (!Object.values(Object.getOwnPropertyDescriptors(value)).every((descriptor) => (
    Object.hasOwn(descriptor, "value")
    && descriptor.get === undefined
    && descriptor.set === undefined
  ))) {
    throw createGatewayProtocolError(message);
  }
}

function requireManagedLocalClientWebCrypto() {
  const webCrypto = globalThis.crypto;
  if (
    !webCrypto
    || typeof webCrypto.getRandomValues !== "function"
    || !webCrypto.subtle
    || typeof webCrypto.subtle.importKey !== "function"
    || typeof webCrypto.subtle.sign !== "function"
    || typeof webCrypto.subtle.digest !== "function"
  ) {
    throw createGatewayProtocolError("Managed local-client PoP requires WebCrypto support.");
  }
  return webCrypto;
}

async function managedLocalClientHmacSha256(webCrypto, keyBytes, dataBytes) {
  const key = await webCrypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await webCrypto.subtle.sign("HMAC", key, dataBytes));
}

function encodeManagedLocalClientUtf8(value) {
  if (typeof TextEncoder !== "function") {
    throw createGatewayProtocolError("Managed local-client PoP requires UTF-8 encoding support.");
  }
  return new TextEncoder().encode(value);
}

function managedLocalClientHex(bytes) {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

function managedLocalClientBase64Url(bytes) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const hasSecond = index + 1 < bytes.length;
    const hasThird = index + 2 < bytes.length;
    const second = hasSecond ? bytes[index + 1] : 0;
    const third = hasThird ? bytes[index + 2] : 0;
    output += alphabet[first >> 2];
    output += alphabet[((first & 0x03) << 4) | (second >> 4)];
    if (hasSecond) output += alphabet[((second & 0x0f) << 2) | (third >> 6)];
    if (hasThird) output += alphabet[third & 0x3f];
  }
  return output;
}

function canonicalizeManagedLocalClientJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw createManagedLocalClientPopProtocolError();
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeManagedLocalClientJson).join(",")}]`;
  }
  if (value === null || typeof value !== "object") {
    throw createManagedLocalClientPopProtocolError();
  }
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalizeManagedLocalClientJson(value[key])}`
  )).join(",")}}`;
}

function createManagedLocalClientPopProtocolError() {
  return createGatewayProtocolError("Managed local-client PoP proof options are invalid.");
}

async function verifyLocalClientDispatchIntentWithKey(protocolKey, raw, options) {
  assertExactLocalClientReceiptRecord(
    raw,
    LOCAL_CLIENT_DISPATCH_INTENT_KEYS,
    LOCAL_CLIENT_DISPATCH_INTENT_KEYS,
  );
  if (
    raw.protocolVersion !== LOCAL_CLIENT_DISPATCH_INTENT_VERSION
    || !LOCAL_CLIENT_RECEIPT_INTENT_ID_PATTERN.test(raw.intentId)
    || !isLocalClientReceiptProtocolBindings(raw)
    || !isLocalClientReceiptFencingToken(raw.dispatchFencingToken)
    || !isLocalClientReceiptProtocolWindow(raw.issuedAtMs, raw.expiresAtMs, options.maxTtlMs)
    || !LOCAL_CLIENT_RECEIPT_DIGEST_PATTERN.test(raw.signature)
  ) throw createLocalClientReceiptProtocolError();
  const unsigned = withoutLocalClientReceiptSignature(raw);
  const base = {
    protocolVersion: LOCAL_CLIENT_DISPATCH_INTENT_VERSION,
    executionId: raw.executionId,
    executionBindingHmac: raw.executionBindingHmac,
    tenantBindingHmac: raw.tenantBindingHmac,
    subjectBindingHmac: raw.subjectBindingHmac,
    clientBindingHmac: raw.clientBindingHmac,
    routeBindingHmac: raw.routeBindingHmac,
    identityBindingHmac: raw.identityBindingHmac,
    planFingerprint: raw.planFingerprint,
    inputSha256: raw.inputSha256,
    dispatchFencingToken: raw.dispatchFencingToken,
    issuedAtMs: raw.issuedAtMs,
    expiresAtMs: raw.expiresAtMs,
  };
  const valid = await Promise.all([
    verifyLocalClientReceiptKeyedDigest(
      protocolKey,
      "execution-binding",
      raw.executionId,
      raw.executionBindingHmac,
    ),
    verifyLocalClientReceiptIdentityBinding(protocolKey, raw),
    verifyLocalClientReceiptKeyedDigest(
      protocolKey,
      "dispatch-intent-id",
      canonicalizeLocalClientReceiptJson(base),
      raw.intentId.slice("lcdi_".length),
    ),
    verifyLocalClientReceiptProtocolSignature(
      protocolKey,
      "dispatch-intent",
      unsigned,
      raw.signature,
    ),
  ]);
  if (valid.some((entry) => entry !== true)) throw createLocalClientReceiptProtocolError();
  if (options.enforceFreshness && (
    raw.issuedAtMs > safeLocalClientReceiptAdd(options.nowMs, options.allowedClockSkewMs)
    || safeLocalClientReceiptAdd(raw.expiresAtMs, options.allowedClockSkewMs) < options.nowMs
  )) throw createLocalClientReceiptProtocolError();
  return Object.freeze({ ...raw });
}

async function verifyLocalClientReceiptReconciliationQueryWithKey(protocolKey, raw, options) {
  assertExactLocalClientReceiptRecord(
    raw,
    LOCAL_CLIENT_RECONCILIATION_QUERY_KEYS,
    LOCAL_CLIENT_RECONCILIATION_QUERY_KEYS,
  );
  if (
    raw.protocolVersion !== LOCAL_CLIENT_RECONCILIATION_QUERY_VERSION
    || !LOCAL_CLIENT_RECEIPT_QUERY_ID_PATTERN.test(raw.queryId)
    || !LOCAL_CLIENT_RECEIPT_INTENT_ID_PATTERN.test(raw.intentId)
    || !isLocalClientReceiptProtocolBindings(raw)
    || !isLocalClientReceiptFencingToken(raw.dispatchFencingToken)
    || !isLocalClientReceiptProtocolWindow(raw.issuedAtMs, raw.expiresAtMs, options.maxTtlMs)
    || raw.purpose !== "receipt-reconciliation-only"
    || raw.authorizeExecution !== false
    || !LOCAL_CLIENT_RECEIPT_DIGEST_PATTERN.test(raw.signature)
  ) throw createLocalClientReceiptProtocolError();
  const valid = await Promise.all([
    verifyLocalClientReceiptKeyedDigest(
      protocolKey,
      "execution-binding",
      raw.executionId,
      raw.executionBindingHmac,
    ),
    verifyLocalClientReceiptIdentityBinding(protocolKey, raw),
    verifyLocalClientReceiptProtocolSignature(
      protocolKey,
      "reconciliation-query",
      withoutLocalClientReceiptSignature(raw),
      raw.signature,
    ),
  ]);
  if (
    valid.some((entry) => entry !== true)
    || raw.issuedAtMs > safeLocalClientReceiptAdd(options.nowMs, options.allowedClockSkewMs)
    || safeLocalClientReceiptAdd(raw.expiresAtMs, options.allowedClockSkewMs) < options.nowMs
  ) throw createLocalClientReceiptProtocolError();
  return Object.freeze({ ...raw });
}

async function verifyLocalClientDurableExecutionReceiptWithKey(protocolKey, raw, options) {
  assertExactLocalClientReceiptRecord(
    raw,
    LOCAL_CLIENT_DURABLE_RECEIPT_KEYS,
    LOCAL_CLIENT_DURABLE_RECEIPT_KEYS,
  );
  if (
    raw.protocolVersion !== LOCAL_CLIENT_DURABLE_RECEIPT_VERSION
    || !LOCAL_CLIENT_RECEIPT_DURABLE_ID_PATTERN.test(raw.receiptId)
    || !LOCAL_CLIENT_RECEIPT_INTENT_ID_PATTERN.test(raw.intentId)
    || !isLocalClientReceiptProtocolBindings(raw)
    || !isLocalClientReceiptFencingToken(raw.dispatchFencingToken)
    || !isLocalClientReceiptTimestamp(raw.completedAtMs)
    || raw.completedAtMs > safeLocalClientReceiptAdd(options.nowMs, options.allowedClockSkewMs)
    || raw.executionMode !== "governed"
    || raw.externalEffectPerformed !== true
    || raw.status !== "completed"
    || !LOCAL_CLIENT_RECEIPT_DIGEST_PATTERN.test(raw.signature)
  ) throw createLocalClientReceiptProtocolError();
  const receiptIdValue = canonicalizeLocalClientReceiptJson({
    clientBindingHmac: raw.clientBindingHmac,
    completedAtMs: raw.completedAtMs,
    dispatchFencingToken: raw.dispatchFencingToken,
    executionBindingHmac: raw.executionBindingHmac,
    identityBindingHmac: raw.identityBindingHmac,
    inputSha256: raw.inputSha256,
    intentId: raw.intentId,
    planFingerprint: raw.planFingerprint,
    routeBindingHmac: raw.routeBindingHmac,
    subjectBindingHmac: raw.subjectBindingHmac,
    tenantBindingHmac: raw.tenantBindingHmac,
  });
  const valid = await Promise.all([
    verifyLocalClientReceiptKeyedDigest(
      protocolKey,
      "execution-binding",
      raw.executionId,
      raw.executionBindingHmac,
    ),
    verifyLocalClientReceiptIdentityBinding(protocolKey, raw),
    verifyLocalClientReceiptKeyedDigest(
      protocolKey,
      "durable-receipt-id",
      receiptIdValue,
      raw.receiptId.slice("lcdr_".length),
    ),
    verifyLocalClientReceiptProtocolSignature(
      protocolKey,
      "durable-receipt",
      withoutLocalClientReceiptSignature(raw),
      raw.signature,
    ),
  ]);
  if (valid.some((entry) => entry !== true)) throw createLocalClientReceiptProtocolError();
  return Object.freeze({ ...raw });
}

async function createLocalClientReceiptReconciliationResponseWithKey(
  protocolKey,
  query,
  state,
  receipt,
  observedAtMs,
) {
  const unsigned = Object.freeze({
    protocolVersion: LOCAL_CLIENT_RECONCILIATION_RESPONSE_VERSION,
    queryId: query.queryId,
    intentId: query.intentId,
    executionId: query.executionId,
    dispatchFencingToken: query.dispatchFencingToken,
    state,
    receipt,
    observedAtMs,
    retryAllowed: false,
  });
  return Object.freeze({
    ...unsigned,
    signature: await signLocalClientReceiptProtocol(
      protocolKey,
      "reconciliation-response",
      unsigned,
    ),
  });
}

function assertLocalClientReceiptMatchesQuery(receipt, query) {
  for (const key of [
    "intentId",
    "executionId",
    "executionBindingHmac",
    "tenantBindingHmac",
    "subjectBindingHmac",
    "clientBindingHmac",
    "routeBindingHmac",
    "identityBindingHmac",
    "planFingerprint",
    "inputSha256",
    "dispatchFencingToken",
  ]) {
    if (receipt[key] !== query[key]) throw createLocalClientReceiptProtocolError();
  }
}

function normalizeLocalClientReceiptResponseClock(options) {
  return Object.freeze({
    nowMs: normalizeLocalClientReceiptNow(options.nowMs),
    allowedClockSkewMs: normalizeLocalClientReceiptClockSkew(options.allowedClockSkewMs),
    maxTtlMs: normalizeLocalClientReceiptTtl(
      options.maxTtlMs,
      LOCAL_CLIENT_RECEIPT_DEFAULT_QUERY_MAX_TTL_MS,
      LOCAL_CLIENT_RECEIPT_DEFAULT_QUERY_MAX_TTL_MS,
    ),
  });
}

function normalizeLocalClientReceiptObservedAt(value, clock) {
  const observedAtMs = normalizeLocalClientReceiptTimestamp(value);
  if (observedAtMs > safeLocalClientReceiptAdd(clock.nowMs, clock.allowedClockSkewMs)) {
    throw createLocalClientReceiptProtocolError();
  }
  return observedAtMs;
}

function assertExactLocalClientReceiptRecord(value, allowedKeys, requiredKeys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw createLocalClientReceiptProtocolError();
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw createLocalClientReceiptProtocolError();
  }
  const keys = Reflect.ownKeys(value);
  if (
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
    || requiredKeys.some((key) => !Object.hasOwn(value, key))
  ) throw createLocalClientReceiptProtocolError();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (!keys.every((key) => {
    const descriptor = descriptors[key];
    return descriptor
      && Object.hasOwn(descriptor, "value")
      && descriptor.get === undefined
      && descriptor.set === undefined
      && descriptor.enumerable === true;
  })) throw createLocalClientReceiptProtocolError();
}

function cloneLocalClientReceiptKey(value) {
  if (
    !(value instanceof Uint8Array)
    || value.byteLength < LOCAL_CLIENT_RECEIPT_PROTOCOL_KEY_MIN_BYTES
    || value.byteLength > LOCAL_CLIENT_RECEIPT_PROTOCOL_KEY_MAX_BYTES
  ) throw createLocalClientReceiptProtocolError();
  return new Uint8Array(value);
}

function normalizeLocalClientReceiptOpaqueIdentity(value) {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 256
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) throw createLocalClientReceiptProtocolError();
  return value;
}

function normalizeLocalClientReceiptNow(value) {
  return normalizeLocalClientReceiptTimestamp(value === undefined ? Date.now() : value);
}

function normalizeLocalClientReceiptClockSkew(value) {
  if (value === undefined) return LOCAL_CLIENT_RECEIPT_DEFAULT_CLOCK_SKEW_MS;
  if (
    !Number.isSafeInteger(value)
    || value < 0
    || value > LOCAL_CLIENT_RECEIPT_MAX_CLOCK_SKEW_MS
  ) throw createLocalClientReceiptProtocolError();
  return value;
}

function normalizeLocalClientReceiptTtl(value, fallback, maximum) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw createLocalClientReceiptProtocolError();
  }
  return value;
}

function normalizeLocalClientReceiptTimestamp(value) {
  if (!isLocalClientReceiptTimestamp(value)) throw createLocalClientReceiptProtocolError();
  return value;
}

function isLocalClientReceiptTimestamp(value) {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= LOCAL_CLIENT_RECEIPT_MAX_DATE_MS;
}

function isLocalClientReceiptProtocolWindow(issuedAtMs, expiresAtMs, maxTtlMs) {
  return isLocalClientReceiptTimestamp(issuedAtMs)
    && isLocalClientReceiptTimestamp(expiresAtMs)
    && expiresAtMs > issuedAtMs
    && expiresAtMs - issuedAtMs <= maxTtlMs;
}

function isLocalClientReceiptFencingToken(value) {
  if (typeof value !== "string" || !LOCAL_CLIENT_RECEIPT_FENCE_PATTERN.test(value)) return false;
  try {
    const parsed = BigInt(value);
    return parsed > 0n && parsed <= LOCAL_CLIENT_RECEIPT_MAX_FENCE;
  } catch {
    return false;
  }
}

function isLocalClientReceiptProtocolBindings(value) {
  return typeof value.executionId === "string"
    && LOCAL_CLIENT_RECEIPT_EXECUTION_ID_PATTERN.test(value.executionId)
    && [
      value.executionBindingHmac,
      value.tenantBindingHmac,
      value.subjectBindingHmac,
      value.clientBindingHmac,
      value.routeBindingHmac,
      value.identityBindingHmac,
      value.planFingerprint,
      value.inputSha256,
    ].every((entry) => typeof entry === "string" && LOCAL_CLIENT_RECEIPT_DIGEST_PATTERN.test(entry));
}

async function verifyLocalClientReceiptIdentityBinding(protocolKey, value) {
  return verifyLocalClientReceiptKeyedDigest(
    protocolKey,
    "identity-binding",
    canonicalizeLocalClientReceiptJson({
      clientBindingHmac: value.clientBindingHmac,
      executionBindingHmac: value.executionBindingHmac,
      inputSha256: value.inputSha256,
      planFingerprint: value.planFingerprint,
      routeBindingHmac: value.routeBindingHmac,
      subjectBindingHmac: value.subjectBindingHmac,
      tenantBindingHmac: value.tenantBindingHmac,
    }),
    value.identityBindingHmac,
  );
}

async function signLocalClientReceiptProtocol(protocolKey, domain, value) {
  return localClientReceiptKeyedDigest(
    protocolKey,
    `protocol/${domain}`,
    canonicalizeLocalClientReceiptJson(value),
  );
}

async function verifyLocalClientReceiptProtocolSignature(
  protocolKey,
  domain,
  value,
  signature,
) {
  return verifyLocalClientReceiptKeyedDigest(
    protocolKey,
    `protocol/${domain}`,
    canonicalizeLocalClientReceiptJson(value),
    signature,
  );
}

async function localClientReceiptKeyedDigest(protocolKey, domain, value) {
  let dataBytes;
  let digestBytes;
  try {
    dataBytes = encodeManagedLocalClientUtf8(
      `${LOCAL_CLIENT_RECEIPT_RECONCILIATION_HMAC_DOMAIN}\0${domain}\0${value}`,
    );
    digestBytes = await localClientReceiptHmacSha256(
      requireLocalClientReceiptWebCrypto(),
      protocolKey,
      dataBytes,
    );
    return managedLocalClientHex(digestBytes);
  } finally {
    dataBytes?.fill(0);
    digestBytes?.fill(0);
  }
}

async function verifyLocalClientReceiptKeyedDigest(protocolKey, domain, value, digest) {
  if (typeof digest !== "string" || !LOCAL_CLIENT_RECEIPT_DIGEST_PATTERN.test(digest)) return false;
  let dataBytes;
  let digestBytes;
  try {
    dataBytes = encodeManagedLocalClientUtf8(
      `${LOCAL_CLIENT_RECEIPT_RECONCILIATION_HMAC_DOMAIN}\0${domain}\0${value}`,
    );
    digestBytes = decodeLocalClientReceiptHex(digest);
    return await localClientReceiptHmacVerify(
      requireLocalClientReceiptWebCrypto(),
      protocolKey,
      dataBytes,
      digestBytes,
    );
  } finally {
    dataBytes?.fill(0);
    digestBytes?.fill(0);
  }
}

function requireLocalClientReceiptWebCrypto() {
  const webCrypto = requireManagedLocalClientWebCrypto();
  if (typeof webCrypto.subtle.verify !== "function") throw createLocalClientReceiptProtocolError();
  return webCrypto;
}

async function localClientReceiptHmacSha256(webCrypto, keyBytes, dataBytes) {
  const key = await webCrypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await webCrypto.subtle.sign("HMAC", key, dataBytes));
}

async function localClientReceiptHmacVerify(webCrypto, keyBytes, dataBytes, signatureBytes) {
  const key = await webCrypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return webCrypto.subtle.verify("HMAC", key, signatureBytes, dataBytes);
}

function decodeLocalClientReceiptHex(value) {
  if (!LOCAL_CLIENT_RECEIPT_DIGEST_PATTERN.test(value)) throw createLocalClientReceiptProtocolError();
  const output = new Uint8Array(32);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number.parseInt(value.slice(index * 2, (index * 2) + 2), 16);
  }
  return output;
}

function withoutLocalClientReceiptSignature(value) {
  const { signature: _signature, ...unsigned } = value;
  return unsigned;
}

function canonicalizeLocalClientReceiptJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw createLocalClientReceiptProtocolError();
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeLocalClientReceiptJson).join(",")}]`;
  }
  if (value === null || typeof value !== "object") throw createLocalClientReceiptProtocolError();
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalizeLocalClientReceiptJson(value[key])}`
  )).join(",")}}`;
}

function safeLocalClientReceiptAdd(left, right) {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right)) {
    throw createLocalClientReceiptProtocolError();
  }
  const result = left + right;
  if (
    !Number.isSafeInteger(result)
    || result < 0
    || result > LOCAL_CLIENT_RECEIPT_MAX_DATE_MS
  ) throw createLocalClientReceiptProtocolError();
  return result;
}

function normalizeLocalClientReceiptProtocolError(error) {
  if (error instanceof GatewayClientError && error.message === "Local-client receipt protocol operation failed.") {
    return error;
  }
  return createLocalClientReceiptProtocolError();
}

function createLocalClientReceiptProtocolError() {
  return createGatewayProtocolError("Local-client receipt protocol operation failed.");
}

function prepareProviderRequest(request, headers, providerDispatchKeyFactory) {
  const source = request && typeof request === "object" ? request : {};
  const { idempotencyKey, providerDispatchKey, ...body } = source;
  const providerHeaderEntries = Object.entries(headers).filter(
    ([name]) => PROVIDER_KEY_HEADERS.has(String(name).toLowerCase()),
  );
  if (idempotencyKey !== undefined && providerDispatchKey !== undefined) {
    throw createProviderKeyConfigurationError(
      "Provider requests cannot set both idempotencyKey and providerDispatchKey.",
    );
  }
  if (providerHeaderEntries.length > 1) {
    throw createProviderKeyConfigurationError(
      "Gateway client headers cannot contain both Idempotency-Key and Provider-Dispatch-Key.",
    );
  }

  if (idempotencyKey === undefined && providerDispatchKey === undefined && providerHeaderEntries.length === 1) {
    return { body, headers };
  }

  const keyHeaderName = idempotencyKey === undefined
    ? "provider-dispatch-key"
    : "idempotency-key";
  const key = idempotencyKey
    ?? providerDispatchKey
    ?? providerDispatchKeyFactory();
  const headersWithoutProviderKeys = Object.fromEntries(
    Object.entries(headers).filter(
      ([name]) => !PROVIDER_KEY_HEADERS.has(String(name).toLowerCase()),
    ),
  );
  return {
    body,
    headers: { ...headersWithoutProviderKeys, [keyHeaderName]: String(key) },
  };
}

function prepareRequiredIdempotencyHeaders(
  headers,
  options,
  operationName = "Governed local-client execution",
) {
  const key = options?.idempotencyKey;
  if (
    typeof key !== "string"
    || key.length < 1
    || key.length > 255
    || !/^[\x21-\x7e]+$/u.test(key)
  ) {
    throw createProviderKeyConfigurationError(
      `${operationName} requires one valid explicit Idempotency-Key.`,
    );
  }
  if (Object.keys(headers).some((name) => String(name).toLowerCase() === "idempotency-key")) {
    throw createProviderKeyConfigurationError(
      `Set ${operationName} Idempotency-Key through the operation options, not shared client headers.`,
    );
  }
  return { ...headers, "idempotency-key": key };
}

function createProviderKeyConfigurationError(message) {
  return new GatewayClientError(message, {
    code: GATEWAY_CLIENT_ERROR_CODES.PROTOCOL,
    kind: "protocol",
    retryable: false,
  });
}

function createDefaultProviderDispatchKey() {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) return `uai-sdk-${randomUuid}`;
  return `uai-sdk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export function createGatewayChatRequest(options) {
  const messages = options.messages ?? createPromptMessages(options.prompt);

  return {
    context: options.context,
    taskType: "chat",
    messages,
    options: options.options ?? {},
    ...(options.promptEnhancement
      ? { promptEnhancement: options.promptEnhancement }
      : {}),
    metadata: options.metadata ?? {},
    ...(options.idempotencyKey !== undefined
      ? { idempotencyKey: options.idempotencyKey }
      : {}),
    ...(options.providerDispatchKey !== undefined
      ? { providerDispatchKey: options.providerDispatchKey }
      : {}),
  };
}

function normalizeBaseUrl(baseUrl) {
  if (typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
    throw new GatewayClientError("Gateway baseUrl is required");
  }

  return baseUrl.trim().replace(/\/+$/, "");
}

function assertManagedLocalClientOriginBaseUrl(baseUrl) {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw createGatewayProtocolError(
      "Managed local-client chat requires an absolute origin-only gateway baseUrl.",
    );
  }
  const authorityText = baseUrl.slice(baseUrl.indexOf("://") + 3);
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    || parsed.origin === "null"
    || parsed.username !== ""
    || parsed.password !== ""
    || /[/?#]/u.test(authorityText)
    || parsed.pathname !== "/"
    || parsed.search !== ""
    || parsed.hash !== ""
  ) {
    throw createGatewayProtocolError(
      "Managed local-client chat requires an absolute origin-only gateway baseUrl.",
    );
  }
}

function createPromptMessages(prompt) {
  if (typeof prompt !== "string" || prompt.length === 0) {
    throw new GatewayClientError("Gateway chat prompt is required");
  }

  return [
    {
      role: "user",
      content: prompt,
    },
  ];
}

async function requestJsonImpl({
  baseUrl,
  path,
  method = "GET",
  body,
  headers,
  signal,
  timeoutMs,
}) {
  const requestController = createRequestController({ signal, timeoutMs });

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: requestController.signal,
    });
    const responseBody = await readResponseBody(response);

    if (!response.ok) {
      throw createHttpClientError(`Gateway request failed with ${response.status}`, response, responseBody);
    }

    return responseBody;
  } catch (error) {
    if (error instanceof GatewayClientError) {
      throw error;
    }

    throw createTransportClientError("Gateway request failed", error, requestController);
  } finally {
    requestController.cleanup();
  }
}

async function requestJsonBytesImpl({
  baseUrl,
  path,
  method,
  bodyBytes,
  headers,
  signal,
  timeoutMs,
}) {
  const requestController = createRequestController({ signal, timeoutMs });

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      redirect: "error",
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: bodyBytes,
      signal: requestController.signal,
    });
    const responseBody = await readResponseBody(response);
    if (!response.ok) {
      throw createHttpClientError(`Gateway request failed with ${response.status}`, response, responseBody);
    }
    return responseBody;
  } catch (error) {
    if (error instanceof GatewayClientError) throw error;
    throw createTransportClientError("Gateway request failed", error, requestController);
  } finally {
    requestController.cleanup();
  }
}

async function* requestSseImpl({
  baseUrl,
  path,
  method = "GET",
  body,
  headers,
  signal,
  timeoutMs,
}) {
  const requestController = createRequestController({ signal, timeoutMs });

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: requestController.signal,
    });

    if (!response.ok) {
      throw createHttpClientError(
        `Gateway stream request failed with ${response.status}`,
        response,
        await readResponseBody(response),
      );
    }

    if (!response.body) {
      throw new GatewayClientError("Gateway stream returned no response body", {
        statusCode: response.status,
      });
    }

    for await (const event of readSseEvents(response.body)) {
      if (event.event === "error") {
        throw new GatewayClientError("Gateway stream returned an error event", {
          code: readServerError(event.data).code ?? GATEWAY_CLIENT_ERROR_CODES.STREAM,
          kind: "stream",
          retryable: readServerError(event.data).retryable,
          statusCode: response.status,
          responseBody: event.data,
        });
      }

      yield event.data;
    }
  } catch (error) {
    if (error instanceof GatewayClientError) {
      throw error;
    }

    throw createTransportClientError("Gateway stream request failed", error, requestController);
  } finally {
    requestController.cleanup();
  }
}

function createRequestController({ signal, timeoutMs }) {
  const controller = new AbortController();
  let abortSource = null;
  const onCallerAbort = () => {
    if (controller.signal.aborted) return;
    abortSource = "caller";
    controller.abort(signal.reason);
  };

  if (signal?.aborted) {
    onCallerAbort();
  } else {
    signal?.addEventListener("abort", onCallerAbort, { once: true });
  }

  const timeout = controller.signal.aborted ? undefined : setTimeout(() => {
    if (controller.signal.aborted) return;
    abortSource = "timeout";
    const timeoutError = new Error(`Gateway request timed out after ${timeoutMs}ms`);
    timeoutError.name = "TimeoutError";
    controller.abort(timeoutError);
  }, timeoutMs);

  return {
    signal: controller.signal,
    timeoutMs,
    get abortSource() {
      return abortSource;
    },
    cleanup() {
      if (timeout !== undefined) clearTimeout(timeout);
      signal?.removeEventListener("abort", onCallerAbort);
    },
  };
}

function createHttpClientError(message, response, responseBody) {
  const serverError = readServerError(responseBody);
  return new GatewayClientError(message, {
    code: serverError.code ?? GATEWAY_CLIENT_ERROR_CODES.HTTP,
    kind: "http",
    retryable: serverError.retryable,
    statusCode: response.status,
    responseBody,
  });
}

function createTransportClientError(message, error, requestController) {
  if (requestController.abortSource === "caller") {
    return new GatewayClientAbortError(message, {
      cause: error,
      reason: requestController.signal.reason,
    });
  }
  if (requestController.abortSource === "timeout") {
    return new GatewayClientTimeoutError(message, {
      cause: error,
      timeoutMs: requestController.timeoutMs,
    });
  }
  return new GatewayClientError(message, {
    code: GATEWAY_CLIENT_ERROR_CODES.NETWORK,
    kind: "network",
    retryable: false,
    cause: error,
  });
}

function readServerError(responseBody) {
  if (!responseBody || typeof responseBody !== "object") return {};
  const nested = responseBody.error;
  if (nested && typeof nested === "object") {
    return {
      code: typeof nested.code === "string" ? nested.code : undefined,
      retryable: nested.retryable === true,
    };
  }
  return {
    code: typeof responseBody.code === "string" ? responseBody.code : undefined,
    retryable: responseBody.retryable === true,
  };
}

async function* readSseEvents(stream) {
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const event = parseSseFrame(frame);

      if (event) {
        yield event;
      }
    }
  }

  const event = parseSseFrame(buffer);

  if (event) {
    yield event;
  }
}

function parseSseFrame(frame) {
  const lines = frame.split(/\r?\n/);
  const event = lines
    .find((line) => line.startsWith("event:"))
    ?.slice("event:".length)
    .trim();
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .join("\n");

  if (!event || !data) {
    return null;
  }

  return {
    event,
    data: JSON.parse(data),
  };
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new GatewayClientError("Gateway returned invalid JSON", {
      statusCode: response.status,
      responseBody: text,
      cause: error,
    });
  }
}
