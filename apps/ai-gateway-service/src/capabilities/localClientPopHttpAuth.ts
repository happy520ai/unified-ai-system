import { TextDecoder } from "node:util";

import {
  MANAGED_LOCAL_CLIENT_POP_PROOF_VERSION,
  type ManagedLocalClientPopAuthorityPort,
  type ManagedLocalClientPopIdentity,
  type ManagedLocalClientPopProof,
  type ManagedLocalClientPopVerification,
} from "./localClientPopIdentityAuthority.ts";

export const LOCAL_CLIENT_POP_HTTP_TRANSPORT_VERSION = "popv1" as const;
export const LOCAL_CLIENT_POP_HTTP_MAX_HEADER_BYTES = 2 * 1_024;

export const LOCAL_CLIENT_POP_HTTP_AUTH_BOUNDARIES = Object.freeze({
  authenticatedScopeRequired: true as const,
  clientIdSource: "parsed-request-body" as const,
  rawBodySource: "exact-ingress-buffer-required" as const,
  targetRevisionSource: "trusted-verified-target-resolver" as const,
  transport: "popv1.canonical-base64url-json" as const,
  singleHeaderValueRequired: true as const,
  maximumHeaderBytes: LOCAL_CLIENT_POP_HTTP_MAX_HEADER_BYTES,
  targetResolvedBeforeProofVerification: true as const,
  existenceDisclosure: false as const,
});

export const LOCAL_CLIENT_POP_HTTP_ERROR_CODES = Object.freeze([
  "LOCAL_CLIENT_POP_HTTP_CONFIGURATION_INVALID",
  "LOCAL_CLIENT_POP_HTTP_TRANSPORT_INVALID",
  "LOCAL_CLIENT_POP_HTTP_UNAUTHORIZED",
] as const);

export type LocalClientPopHttpErrorCode =
  typeof LOCAL_CLIENT_POP_HTTP_ERROR_CODES[number];

export interface LocalClientPopHttpAuthenticatedScope {
  readonly tenantId: string;
  readonly subjectId: string;
}

export interface LocalClientPopHttpVerifiedTarget {
  readonly clientId: string;
  readonly revision: number;
  readonly state: "verified";
  readonly trustDecision: "verified";
}

export interface LocalClientPopHttpTargetResolver {
  (
    this: void,
    input: Readonly<{
      identity: LocalClientPopHttpAuthenticatedScope;
      clientId: string;
    }>,
  ):
    | LocalClientPopHttpVerifiedTarget
    | Promise<LocalClientPopHttpVerifiedTarget>;
}

export interface LocalClientPopHttpAuthDependencies {
  readonly authority: Pick<ManagedLocalClientPopAuthorityPort, "verify">;
  readonly resolveVerifiedTarget: LocalClientPopHttpTargetResolver;
}

export interface LocalClientPopHttpAuthRequest {
  /** Must be populated from the already-authenticated server request context. */
  readonly authenticatedScope: LocalClientPopHttpAuthenticatedScope;
  /** Must be the clientId parsed from the same raw request body. */
  readonly clientId: string;
  readonly method: string;
  /** Exact canonical origin-form path plus query string, if any. */
  readonly canonicalPathWithQuery: string;
  /** Exact bytes captured before JSON parsing. Uint8Array substitutes are denied. */
  readonly rawBody: Buffer;
  /** Exactly one HTTP header value. Arrays and comma-joined values are denied. */
  readonly proofHeader: string;
}

export interface LocalClientPopHttpAuthResult {
  readonly verified: true;
  readonly identity: ManagedLocalClientPopIdentity;
  readonly proofFingerprint: string;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
}

export interface LocalClientPopHttpAuthPort {
  readonly boundaries: typeof LOCAL_CLIENT_POP_HTTP_AUTH_BOUNDARIES;
  authenticate(
    this: void,
    request: LocalClientPopHttpAuthRequest,
  ): Promise<LocalClientPopHttpAuthResult>;
}

export class LocalClientPopHttpAuthError extends Error {
  readonly code: LocalClientPopHttpErrorCode;
  readonly category: "configuration" | "validation" | "auth";
  readonly statusCode: number;
  readonly retryable = false;

  constructor(
    code: LocalClientPopHttpErrorCode,
    message: string,
    category: LocalClientPopHttpAuthError["category"],
    statusCode: number,
  ) {
    super(message);
    this.name = "LocalClientPopHttpAuthError";
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
  }
}

const TRANSPORT_PREFIX = `${LOCAL_CLIENT_POP_HTTP_TRANSPORT_VERSION}.`;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const KEY_ID_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/u;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/u;
const OPAQUE_IDENTITY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const CLIENT_ID_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const METHOD_PATTERN = /^[A-Z]{3,16}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_PATH_BYTES = 2_048;
const MAX_BODY_BYTES = 4 * 1024 * 1024;

type NormalizedAuthRequest = Readonly<{
  scope: LocalClientPopHttpAuthenticatedScope;
  clientId: string;
  method: string;
  path: string;
  rawBody: Buffer;
  proof: ManagedLocalClientPopProof;
}>;

export function createLocalClientPopHttpAuth(
  dependencies: LocalClientPopHttpAuthDependencies,
): LocalClientPopHttpAuthPort {
  try {
    assertDependencies(dependencies);
  } catch {
    throw configurationInvalid();
  }
  const authority = dependencies.authority;
  const resolveVerifiedTarget = dependencies.resolveVerifiedTarget;

  const authenticate = async (
    rawRequest: LocalClientPopHttpAuthRequest,
  ): Promise<LocalClientPopHttpAuthResult> => {
    let request: NormalizedAuthRequest | null = null;
    try {
      request = normalizeAuthRequest(rawRequest);
      const target = normalizeVerifiedTarget(await Reflect.apply(
        resolveVerifiedTarget,
        undefined,
        [Object.freeze({
          identity: request.scope,
          clientId: request.clientId,
        })],
      ));
      if (target.clientId !== request.clientId) throw unauthorized();

      const expectedIdentity = Object.freeze({
        tenantId: request.scope.tenantId,
        subjectId: request.scope.subjectId,
        clientId: request.clientId,
        clientRevision: target.revision,
      });
      const verification = await authority.verify({
        expectedIdentity,
        request: Object.freeze({
          method: request.method,
          path: request.path,
          body: request.rawBody,
        }),
        proof: request.proof,
      });
      return projectVerification(verification, expectedIdentity);
    } catch {
      throw unauthorized();
    } finally {
      request?.rawBody.fill(0);
    }
  };

  return Object.freeze({
    boundaries: LOCAL_CLIENT_POP_HTTP_AUTH_BOUNDARIES,
    authenticate,
  });
}

/**
 * Encodes a PoP proof for a single HTTP header. The decoder accepts only this
 * exact canonical representation, so alternate JSON ordering, whitespace,
 * padding, or duplicate/extra fields fail closed.
 */
export function encodeLocalClientPopHttpProof(
  rawProof: ManagedLocalClientPopProof,
): string {
  try {
    const proof = normalizeTransportProof(rawProof, transportInvalid);
    const encoded = Buffer.from(canonicalJson(proof), "utf8").toString("base64url");
    const header = `${TRANSPORT_PREFIX}${encoded}`;
    if (Buffer.byteLength(header, "utf8") > LOCAL_CLIENT_POP_HTTP_MAX_HEADER_BYTES) {
      throw transportInvalid();
    }
    return header;
  } catch (error) {
    if (error instanceof LocalClientPopHttpAuthError) throw error;
    throw transportInvalid();
  }
}

function normalizeAuthRequest(raw: LocalClientPopHttpAuthRequest): NormalizedAuthRequest {
  assertExactRecord(raw, [
    "authenticatedScope",
    "clientId",
    "method",
    "canonicalPathWithQuery",
    "rawBody",
    "proofHeader",
  ], unauthorized);
  const scope = normalizeScope(raw.authenticatedScope);
  const clientId = strictIdentifier(raw.clientId, CLIENT_ID_PATTERN, unauthorized);
  if (typeof raw.method !== "string" || !METHOD_PATTERN.test(raw.method)) {
    throw unauthorized();
  }
  const path = canonicalPath(raw.canonicalPathWithQuery);
  if (!Buffer.isBuffer(raw.rawBody) || raw.rawBody.length > MAX_BODY_BYTES) {
    throw unauthorized();
  }
  const proof = decodeLocalClientPopHttpProof(raw.proofHeader);
  const rawBody = Buffer.from(raw.rawBody);
  try {
    return Object.freeze({
      scope,
      clientId,
      method: raw.method,
      path,
      rawBody,
      proof,
    });
  } catch {
    rawBody.fill(0);
    throw unauthorized();
  }
}

function normalizeScope(
  raw: LocalClientPopHttpAuthenticatedScope,
): LocalClientPopHttpAuthenticatedScope {
  assertExactRecord(raw, ["tenantId", "subjectId"], unauthorized);
  return Object.freeze({
    tenantId: strictIdentifier(raw.tenantId, OPAQUE_IDENTITY_PATTERN, unauthorized),
    subjectId: strictIdentifier(raw.subjectId, OPAQUE_IDENTITY_PATTERN, unauthorized),
  });
}

function normalizeVerifiedTarget(raw: unknown): LocalClientPopHttpVerifiedTarget {
  if (!isPlainDataRecord(raw)) throw unauthorized();
  if (
    typeof raw.clientId !== "string"
    || !CLIENT_ID_PATTERN.test(raw.clientId)
    || !isPositiveSafeInteger(raw.revision)
    || raw.state !== "verified"
    || raw.trustDecision !== "verified"
  ) throw unauthorized();
  return Object.freeze({
    clientId: raw.clientId,
    revision: raw.revision,
    state: "verified" as const,
    trustDecision: "verified" as const,
  });
}

function projectVerification(
  raw: ManagedLocalClientPopVerification,
  expectedIdentity: ManagedLocalClientPopIdentity,
): LocalClientPopHttpAuthResult {
  if (!isPlainDataRecord(raw) || raw.verified !== true) throw unauthorized();
  const identity = raw.identity;
  if (
    !isPlainDataRecord(identity)
    || identity.tenantId !== expectedIdentity.tenantId
    || identity.subjectId !== expectedIdentity.subjectId
    || identity.clientId !== expectedIdentity.clientId
    || identity.clientRevision !== expectedIdentity.clientRevision
    || typeof raw.proofFingerprint !== "string"
    || !SHA256_PATTERN.test(raw.proofFingerprint)
    || !isPositiveSafeInteger(raw.issuedAtMs)
    || !isPositiveSafeInteger(raw.expiresAtMs)
    || raw.expiresAtMs <= raw.issuedAtMs
  ) throw unauthorized();
  return Object.freeze({
    verified: true as const,
    identity: Object.freeze({ ...expectedIdentity }),
    proofFingerprint: raw.proofFingerprint,
    issuedAtMs: raw.issuedAtMs,
    expiresAtMs: raw.expiresAtMs,
  });
}

function decodeLocalClientPopHttpProof(value: unknown): ManagedLocalClientPopProof {
  if (
    typeof value !== "string"
    || Buffer.byteLength(value, "utf8") > LOCAL_CLIENT_POP_HTTP_MAX_HEADER_BYTES
    || !value.startsWith(TRANSPORT_PREFIX)
  ) throw unauthorized();
  const encoded = value.slice(TRANSPORT_PREFIX.length);
  if (!BASE64URL_PATTERN.test(encoded)) throw unauthorized();
  let decoded: Buffer;
  let text: string;
  try {
    decoded = Buffer.from(encoded, "base64url");
    if (decoded.toString("base64url") !== encoded) throw unauthorized();
    text = new TextDecoder("utf-8", { fatal: true }).decode(decoded);
  } catch {
    throw unauthorized();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw unauthorized();
  }
  const proof = normalizeTransportProof(parsed, unauthorized);
  if (canonicalJson(proof) !== text) throw unauthorized();
  return proof;
}

function normalizeTransportProof(
  raw: unknown,
  onError: () => LocalClientPopHttpAuthError,
): ManagedLocalClientPopProof {
  assertExactRecord(raw, [
    "proofVersion",
    "keyId",
    "nonce",
    "issuedAtMs",
    "expiresAtMs",
    "signature",
  ], onError);
  if (
    raw.proofVersion !== MANAGED_LOCAL_CLIENT_POP_PROOF_VERSION
    || typeof raw.keyId !== "string"
    || !KEY_ID_PATTERN.test(raw.keyId)
    || typeof raw.nonce !== "string"
    || !NONCE_PATTERN.test(raw.nonce)
    || !isPositiveSafeInteger(raw.issuedAtMs)
    || !isPositiveSafeInteger(raw.expiresAtMs)
    || raw.expiresAtMs <= raw.issuedAtMs
    || typeof raw.signature !== "string"
    || !SIGNATURE_PATTERN.test(raw.signature)
  ) throw onError();
  return Object.freeze({
    proofVersion: raw.proofVersion,
    keyId: raw.keyId,
    nonce: raw.nonce,
    issuedAtMs: raw.issuedAtMs,
    expiresAtMs: raw.expiresAtMs,
    signature: raw.signature,
  });
}

function canonicalPath(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || Buffer.byteLength(value, "utf8") > MAX_PATH_BYTES
    || !value.startsWith("/")
    || value.startsWith("//")
    || value.includes("\\")
    || value.includes("#")
    || /[\s\u0000-\u001f\u007f]/u.test(value)
  ) throw unauthorized();
  try {
    const parsed = new URL(value, "http://local-client.invalid");
    if (
      parsed.origin !== "http://local-client.invalid"
      || `${parsed.pathname}${parsed.search}` !== value
    ) throw unauthorized();
  } catch {
    throw unauthorized();
  }
  return value;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw transportInvalid();
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (!isPlainDataRecord(value)) throw transportInvalid();
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`
  )).join(",")}}`;
}

function assertDependencies(dependencies: LocalClientPopHttpAuthDependencies): void {
  if (
    !isPlainDataRecord(dependencies)
    || Reflect.ownKeys(dependencies).some((key) => (
      typeof key !== "string"
      || !["authority", "resolveVerifiedTarget"].includes(key)
    ))
    || !Object.hasOwn(dependencies, "authority")
    || !Object.hasOwn(dependencies, "resolveVerifiedTarget")
    || dependencies.authority === null
    || typeof dependencies.authority !== "object"
    || typeof dependencies.authority.verify !== "function"
    || typeof dependencies.resolveVerifiedTarget !== "function"
  ) throw configurationInvalid();
}

function assertExactRecord(
  value: unknown,
  keys: readonly string[],
  onError: () => LocalClientPopHttpAuthError,
): asserts value is Record<string, unknown> {
  if (!isPlainDataRecord(value)) throw onError();
  const actualKeys = Reflect.ownKeys(value);
  if (
    actualKeys.length !== keys.length
    || actualKeys.some((key) => typeof key !== "string" || !keys.includes(key))
    || keys.some((key) => !Object.hasOwn(value, key))
  ) throw onError();
}

function isPlainDataRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(Object.getOwnPropertyDescriptors(value)).every(
    (descriptor) => Object.hasOwn(descriptor, "value")
      && descriptor.get === undefined
      && descriptor.set === undefined,
  );
}

function strictIdentifier(
  value: unknown,
  pattern: RegExp,
  onError: () => LocalClientPopHttpAuthError,
): string {
  if (typeof value !== "string" || !pattern.test(value)) throw onError();
  return value;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function configurationInvalid(): LocalClientPopHttpAuthError {
  return new LocalClientPopHttpAuthError(
    "LOCAL_CLIENT_POP_HTTP_CONFIGURATION_INVALID",
    "The local-client PoP HTTP authentication configuration is invalid.",
    "configuration",
    503,
  );
}

function transportInvalid(): LocalClientPopHttpAuthError {
  return new LocalClientPopHttpAuthError(
    "LOCAL_CLIENT_POP_HTTP_TRANSPORT_INVALID",
    "The local-client PoP HTTP proof transport is invalid.",
    "validation",
    400,
  );
}

function unauthorized(): LocalClientPopHttpAuthError {
  return new LocalClientPopHttpAuthError(
    "LOCAL_CLIENT_POP_HTTP_UNAUTHORIZED",
    "Managed local-client proof authorization failed.",
    "auth",
    401,
  );
}
