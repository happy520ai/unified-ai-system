// Extracted verbatim from index.js so the gateway client error primitives and
// the managed local client POP cluster live beside the SDK entrypoint. Pure
// mechanical move; behaviour unchanged.

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

export const MANAGED_LOCAL_CLIENT_POP_HEADER = "x-ai-gateway-local-client-proof";
export const MANAGED_LOCAL_CLIENT_CHAT_PATH = "/v1/chat/completions";
export const MANAGED_LOCAL_CLIENT_POP_PROOF_VERSION = "managed-local-client-pop-proof-v1";
export const MANAGED_LOCAL_CLIENT_POP_CANONICAL_VERSION = "managed-local-client-pop-canonical-v1";
export const MANAGED_LOCAL_CLIENT_POP_TTL_MS = 30_000;
export const MANAGED_LOCAL_CLIENT_POP_NONCE_BYTES = 32;
export const MANAGED_LOCAL_CLIENT_POP_MAX_BODY_BYTES = 4 * 1024 * 1024;
export const MANAGED_LOCAL_CLIENT_POP_MAX_PATH_BYTES = 2_048;
export const MANAGED_LOCAL_CLIENT_POP_OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
export const MANAGED_LOCAL_CLIENT_POP_CLIENT_ID_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
export const MANAGED_LOCAL_CLIENT_POP_METHOD_PATTERN = /^[A-Z]{3,16}$/u;
export const MANAGED_LOCAL_CLIENT_PROOF_OPTION_KEYS = Object.freeze([
  "secret",
  "tenantId",
  "subjectId",
  "clientId",
  "revision",
  "method",
  "path",
  "bodyBytes",
]);
export const MANAGED_LOCAL_CLIENT_CHAT_PROOF_OPTION_KEYS = Object.freeze([
  "secret",
  "tenantId",
  "subjectId",
  "clientId",
  "revision",
]);
export const MANAGED_LOCAL_CLIENT_SENSITIVE_BODY_KEYS = new Set([
  "secret",
  "proof",
  "popproof",
  "popoptions",
  "proofoptions",
]);

export function normalizeManagedLocalClientPopOptions(raw) {
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

export function assertManagedLocalClientChatProofOptions(raw) {
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

export function normalizeManagedLocalClientPopPath(value) {
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

export function assertExactManagedLocalClientRecord(value, expectedKeys) {
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

export function assertManagedLocalClientDataRecord(value, message) {
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

export function requireManagedLocalClientWebCrypto() {
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

export async function managedLocalClientHmacSha256(webCrypto, keyBytes, dataBytes) {
  const key = await webCrypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await webCrypto.subtle.sign("HMAC", key, dataBytes));
}

export function encodeManagedLocalClientUtf8(value) {
  if (typeof TextEncoder !== "function") {
    throw createGatewayProtocolError("Managed local-client PoP requires UTF-8 encoding support.");
  }
  return new TextEncoder().encode(value);
}

export function managedLocalClientHex(bytes) {
  let output = "";
  for (const byte of bytes) output += byte.toString(16).padStart(2, "0");
  return output;
}

export function managedLocalClientBase64Url(bytes) {
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

export function canonicalizeManagedLocalClientJson(value) {
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

export function createManagedLocalClientPopProtocolError() {
  return createGatewayProtocolError("Managed local-client PoP proof options are invalid.");
}


export function createGatewayProtocolError(message) {
  return new GatewayClientError(message, {
    code: GATEWAY_CLIENT_ERROR_CODES.PROTOCOL,
    kind: "protocol",
    retryable: false,
  });
}
