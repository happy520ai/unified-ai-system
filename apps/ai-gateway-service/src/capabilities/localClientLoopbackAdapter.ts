import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import {
  LOCAL_CLIENT_ADAPTER_DESCRIPTOR_VERSION,
  LOCAL_CLIENT_ADAPTER_RECEIPT_VERSION,
  type LocalClientAdapter,
  type LocalClientAdapterDescriptor,
  type LocalClientAdapterInput,
  type LocalClientAdapterInvocation,
  type LocalClientAdapterReceipt,
  type LocalClientAdapterReceiptReconciliationRequest,
} from "./localClientAdapterRegistry.ts";
import type {
  LocalClientDispatchIntent,
  LocalClientDurableExecutionReceipt,
  LocalClientReceiptReconciliationResponse,
} from "./localClientExecutionReceiptReconciliation.ts";
import {
  LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION,
  LOCAL_CLIENT_VERIFICATION_PROBE_DESCRIPTOR_VERSION,
  type LocalClientVerificationEvidence,
  type LocalClientVerificationProbe,
} from "./localClientVerificationService.ts";
import {
  OutboundUrlPolicyError,
  createPinnedLookup,
} from "../security/outboundUrlPolicy.ts";
import { safeOutboundFetch } from "../security/safeOutboundFetch.ts";

export const LOCAL_CLIENT_LOOPBACK_ADAPTER_ID = "builtin.loopback.local-client" as const;
export const LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE = "loopback-http" as const;
export const LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION = "2.0.0" as const;
export const LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID = "local_application" as const;
export const LOCAL_CLIENT_LOOPBACK_ACTION_ID = "invoke" as const;
export const LOCAL_CLIENT_LOOPBACK_CHALLENGE_VERSION = "local-client-loopback-challenge-v2" as const;
export const LOCAL_CLIENT_LOOPBACK_ACTION_VERSION = "local-client-loopback-action-v2" as const;
export const LOCAL_CLIENT_LOOPBACK_RECEIPT_VERSION = "local-client-loopback-receipt-v2" as const;
export const LOCAL_CLIENT_LOOPBACK_VERIFICATION_VERSION = "local-client-loopback-verification-v2" as const;
export const LOCAL_CLIENT_LOOPBACK_RECONCILIATION_PATH = "/v1/unified-ai/local-client/actions/reconcile" as const;

const CHALLENGE_PATH = "/.well-known/unified-ai/local-client/challenge";
const VERIFICATION_PATH = "/.well-known/unified-ai/local-client/verify";
const ACTION_PATH = "/v1/unified-ai/local-client/actions/invoke";
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 30_000;
const DEFAULT_CHALLENGE_TTL_MS = 2_000;
const MAX_CHALLENGE_TTL_MS = 10_000;
const DEFAULT_VERIFICATION_TTL_MS = 5 * 60_000;
const MAX_VERIFICATION_TTL_MS = 24 * 60 * 60_000;
const DEFAULT_MAX_RESPONSE_BYTES = 16 * 1_024;
const MAX_RESPONSE_BYTES = 64 * 1_024;
const MAX_ENDPOINT_LENGTH = 2_048;
const MAX_IDENTITY_LENGTH = 128;
const MAX_PAYLOAD_LENGTH = 4_096;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/u;
const EXECUTION_ID_PATTERN = /^lc-exec-[a-f0-9]{64}$/u;

const LOOPBACK_DESCRIPTOR: LocalClientAdapterDescriptor = Object.freeze({
  descriptorVersion: LOCAL_CLIENT_ADAPTER_DESCRIPTOR_VERSION,
  id: LOCAL_CLIENT_LOOPBACK_ADAPTER_ID,
  type: LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE,
  version: LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION,
  actions: Object.freeze([Object.freeze({
    actionId: LOCAL_CLIENT_LOOPBACK_ACTION_ID,
    capabilityId: LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID,
    inputSchema: Object.freeze({
      schemaId: "local-client.loopback.invoke.input",
      schemaVersion: 1 as const,
      fields: Object.freeze([
        Object.freeze({ name: "planFingerprint", valueType: "string" as const, required: true }),
        Object.freeze({ name: "payload", valueType: "string" as const, required: false }),
      ]),
      additionalProperties: false as const,
    }),
  })]),
});

function createLoopbackDescriptor(adapterId: string): LocalClientAdapterDescriptor {
  if (adapterId === LOCAL_CLIENT_LOOPBACK_ADAPTER_ID) return LOOPBACK_DESCRIPTOR;
  return Object.freeze({ ...LOOPBACK_DESCRIPTOR, id: adapterId });
}

export interface LocalClientLoopbackAdapterOptions {
  readonly adapterId?: string;
  readonly endpoint: string;
  readonly expectedClientId: string;
  readonly expectedManifestSha256: string;
  readonly sharedSecret: Uint8Array;
  readonly timeoutMs?: number;
  readonly challengeTtlMs?: number;
  readonly maxResponseBytes?: number;
  readonly now?: () => number;
}

export interface LocalClientLoopbackVerificationProbeOptions extends LocalClientLoopbackAdapterOptions {
  readonly verificationTtlMs?: number;
}

export type LocalClientLoopbackAdapterErrorCode =
  | "LOCAL_CLIENT_LOOPBACK_CONFIGURATION_INVALID"
  | "LOCAL_CLIENT_LOOPBACK_CLOSED"
  | "LOCAL_CLIENT_LOOPBACK_TARGET_MISMATCH"
  | "LOCAL_CLIENT_LOOPBACK_INPUT_INVALID"
  | "LOCAL_CLIENT_LOOPBACK_ABORTED"
  | "LOCAL_CLIENT_LOOPBACK_TIMEOUT"
  | "LOCAL_CLIENT_LOOPBACK_REDIRECT_FORBIDDEN"
  | "LOCAL_CLIENT_LOOPBACK_NETWORK_FAILED"
  | "LOCAL_CLIENT_LOOPBACK_RESPONSE_TOO_LARGE"
  | "LOCAL_CLIENT_LOOPBACK_ATTESTATION_INVALID"
  | "LOCAL_CLIENT_LOOPBACK_RECEIPT_INVALID"
  | "LOCAL_CLIENT_LOOPBACK_AUTHORITY_INACTIVE";

export class LocalClientLoopbackAdapterError extends Error {
  readonly code: LocalClientLoopbackAdapterErrorCode;
  readonly category: "configuration" | "validation" | "auth" | "cancellation" | "network" | "integrity";
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly outcomeUnknown: boolean;

  constructor(
    code: LocalClientLoopbackAdapterErrorCode,
    message: string,
    category: LocalClientLoopbackAdapterError["category"],
    statusCode: number,
    retryable = false,
    outcomeUnknown = false,
  ) {
    super(message);
    this.name = "LocalClientLoopbackAdapterError";
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.outcomeUnknown = outcomeUnknown;
  }
}

type ChallengeRequest = {
  readonly protocolVersion: typeof LOCAL_CLIENT_LOOPBACK_CHALLENGE_VERSION;
  readonly nonce: string;
  readonly clientId: string;
  readonly manifestSha256: string;
  readonly adapterVersion: typeof LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
  readonly signature: string;
};

type ChallengeResponse = ChallengeRequest;

type VerificationRequest = {
  readonly protocolVersion: typeof LOCAL_CLIENT_LOOPBACK_VERIFICATION_VERSION;
  readonly nonce: string;
  readonly clientId: string;
  readonly adapterId: string;
  readonly adapterType: typeof LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE;
  readonly adapterVersion: typeof LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION;
  readonly manifestSha256: string;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
  readonly signature: string;
};

type VerificationResponse = VerificationRequest;

type ActionPayload = Readonly<{ payload?: string }>;

type ActionRequest = {
  readonly protocolVersion: typeof LOCAL_CLIENT_LOOPBACK_ACTION_VERSION;
  readonly executionId: string;
  readonly clientId: string;
  readonly manifestSha256: string;
  readonly adapterVersion: typeof LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION;
  readonly nonce: string;
  readonly capabilityId: typeof LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID;
  readonly actionId: typeof LOCAL_CLIENT_LOOPBACK_ACTION_ID;
  readonly planFingerprint: string;
  readonly inputSha256: string;
  readonly dispatchIntentSha256: string;
  readonly dispatchIntent: LocalClientDispatchIntent;
  readonly input: ActionPayload;
  readonly signature: string;
};

type ProtocolReceipt = {
  readonly protocolVersion: typeof LOCAL_CLIENT_LOOPBACK_RECEIPT_VERSION;
  readonly receiptId: string;
  readonly executionId: string;
  readonly clientId: string;
  readonly manifestSha256: string;
  readonly adapterVersion: typeof LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION;
  readonly nonce: string;
  readonly capabilityId: typeof LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID;
  readonly actionId: typeof LOCAL_CLIENT_LOOPBACK_ACTION_ID;
  readonly planFingerprint: string;
  readonly inputSha256: string;
  readonly durableReceiptSha256: string;
  readonly durableReceipt: LocalClientDurableExecutionReceipt;
  readonly executionMode: "governed";
  readonly externalEffectPerformed: boolean;
  readonly status: "completed";
  readonly signature: string;
};

type ExactLoopbackEndpoint = Readonly<{
  origin: string;
  hostname: "127.0.0.1" | "::1";
  address: "127.0.0.1" | "::1";
  family: 4 | 6;
}>;

/**
 * Creates an authenticated transport adapter only. The caller must separately
 * consume an approved route plan and reserve the external-effect fence before
 * invoking this adapter; the loopback handshake grants neither authority.
 */
export function createLocalClientLoopbackAdapter(
  options: LocalClientLoopbackAdapterOptions,
): LocalClientAdapter {
  assertOptions(options);
  const adapterId = assertIdentifier(
    options.adapterId ?? LOCAL_CLIENT_LOOPBACK_ADAPTER_ID,
    configurationError,
  );
  const endpoint = validateEndpoint(options.endpoint);
  const expectedClientId = assertIdentifier(options.expectedClientId, configurationError);
  const expectedManifestSha256 = assertSha256(options.expectedManifestSha256, configurationError);
  const secret = cloneSecret(options.sharedSecret);
  const secretLifecycle = createSecretLifecycle(secret);
  const timeoutMs = boundedInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, 50, MAX_TIMEOUT_MS);
  const challengeTtlMs = boundedInteger(
    options.challengeTtlMs,
    DEFAULT_CHALLENGE_TTL_MS,
    10,
    MAX_CHALLENGE_TTL_MS,
  );
  const maxResponseBytes = boundedInteger(
    options.maxResponseBytes,
    DEFAULT_MAX_RESPONSE_BYTES,
    256,
    MAX_RESPONSE_BYTES,
  );
  if (options.now !== undefined && typeof options.now !== "function") throw configurationError();
  const now = options.now ?? Date.now;
  const resolveOutboundUrl = createExactLoopbackResolver(endpoint);

  return Object.freeze({
    descriptor: createLoopbackDescriptor(adapterId),
    close: () => secretLifecycle.close(),
    async execute(invocation: LocalClientAdapterInvocation): Promise<LocalClientAdapterReceipt> {
      const { executionId, planFingerprint, actionInput, receiptReconciliation } = validateInvocation(
        invocation,
        expectedClientId,
        adapterId,
      );
      if (invocation.signal.aborted) throw abortedError(false);
      secretLifecycle.begin();
      const timeoutController = new AbortController();
      let timedOut = false;
      let actionDispatched = false;
      const timer = setTimeout(() => {
        timedOut = true;
        timeoutController.abort();
      }, timeoutMs);
      timer.unref?.();
      const signal = AbortSignal.any([invocation.signal, timeoutController.signal]);

      try {
        const issuedAtMs = readNow(now);
        const expiresAtMs = issuedAtMs + challengeTtlMs;
        if (!Number.isSafeInteger(expiresAtMs)) throw attestationError();
        const nonce = randomBytes(32).toString("base64url");
        const unsignedChallenge = {
          protocolVersion: LOCAL_CLIENT_LOOPBACK_CHALLENGE_VERSION,
          nonce,
          clientId: expectedClientId,
          manifestSha256: expectedManifestSha256,
          adapterVersion: LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION,
          issuedAtMs,
          expiresAtMs,
        } as const;
        const challengeRequest: ChallengeRequest = Object.freeze({
          ...unsignedChallenge,
          signature: signChallengeRequest(secret, unsignedChallenge),
        });
        const challengeResponse = await postJson(
          `${endpoint.origin}${CHALLENGE_PATH}`,
          challengeRequest,
          signal,
          timeoutMs,
          maxResponseBytes,
          resolveOutboundUrl,
        );
        validateChallengeResponse(
          challengeResponse,
          challengeRequest,
          expectedClientId,
          expectedManifestSha256,
          secret,
          readNow(now),
        );
        throwIfAborted(invocation.signal, false);

        const inputSha256 = sha256(canonicalJson(actionInput));
        const unsignedAction: Omit<ActionRequest, "signature"> = {
          protocolVersion: LOCAL_CLIENT_LOOPBACK_ACTION_VERSION,
          executionId,
          clientId: expectedClientId,
          manifestSha256: expectedManifestSha256,
          adapterVersion: LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION,
          nonce,
          capabilityId: LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID,
          actionId: LOCAL_CLIENT_LOOPBACK_ACTION_ID,
          planFingerprint,
          inputSha256,
          dispatchIntentSha256: sha256(canonicalJson(receiptReconciliation.intent)),
          dispatchIntent: receiptReconciliation.intent,
          input: actionInput,
        };
        const actionRequest: ActionRequest = Object.freeze({
          ...unsignedAction,
          signature: signAction(secret, unsignedAction),
        });
        try {
          await invocation.assertAuthority("dispatch");
        } catch {
          throw loopbackError(
            "LOCAL_CLIENT_LOOPBACK_AUTHORITY_INACTIVE",
            "The verified local-client execution authority is no longer active.",
            "auth",
            409,
          );
        }
        throwIfAborted(invocation.signal, false);
        actionDispatched = true;
        const rawReceipt = await postJson(
          `${endpoint.origin}${ACTION_PATH}`,
          actionRequest,
          signal,
          timeoutMs,
          maxResponseBytes,
          resolveOutboundUrl,
        );
        const receipt = validateReceipt(
          rawReceipt,
          actionRequest,
          expectedClientId,
          expectedManifestSha256,
          secret,
        );
        await receiptReconciliation.confirmReceipt(receipt.durableReceipt);
        throwIfAborted(invocation.signal, true);
        return Object.freeze({
          receiptVersion: LOCAL_CLIENT_ADAPTER_RECEIPT_VERSION,
          receiptId: receipt.receiptId,
          executionId: receipt.executionId,
          adapterId,
          adapterType: LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE,
          adapterVersion: LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION,
          clientId: expectedClientId,
          capabilityId: LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID,
          actionId: LOCAL_CLIENT_LOOPBACK_ACTION_ID,
          planFingerprint: receipt.planFingerprint,
          executionMode: "governed",
          externalEffectPerformed: receipt.externalEffectPerformed,
          status: "completed",
        });
      } catch (error) {
        if (invocation.signal.aborted) throw abortedError(actionDispatched);
        if (timedOut) throw timeoutError(actionDispatched);
        if (error instanceof LocalClientLoopbackAdapterError) {
          if (!actionDispatched || error.outcomeUnknown) throw error;
          throw new LocalClientLoopbackAdapterError(
            error.code,
            error.message,
            error.category,
            error.statusCode,
            false,
            true,
          );
        }
        if (error instanceof OutboundUrlPolicyError && error.reason === "redirect_forbidden") {
          throw loopbackError(
            "LOCAL_CLIENT_LOOPBACK_REDIRECT_FORBIDDEN",
            "The loopback client attempted a forbidden redirect.",
            "network",
            502,
            false,
            actionDispatched,
          );
        }
        if (isErrorCode(error, "RESPONSE_BODY_TOO_LARGE")) throw responseTooLargeError();
        throw loopbackError(
          "LOCAL_CLIENT_LOOPBACK_NETWORK_FAILED",
          "The exact loopback client request failed.",
          "network",
          502,
          true,
          actionDispatched,
        );
      } finally {
        clearTimeout(timer);
        secretLifecycle.end();
      }
    },
    async reconcileReceipt(
      request: LocalClientAdapterReceiptReconciliationRequest,
    ): Promise<LocalClientReceiptReconciliationResponse> {
      validateReconciliationTransportRequest(request, expectedClientId, adapterId);
      if (request.signal.aborted) throw abortedError(false);
      secretLifecycle.begin();
      const timeoutController = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        timeoutController.abort();
      }, timeoutMs);
      timer.unref?.();
      const signal = AbortSignal.any([request.signal, timeoutController.signal]);
      try {
        const response = await postJson(
          `${endpoint.origin}${LOCAL_CLIENT_LOOPBACK_RECONCILIATION_PATH}`,
          request.query,
          signal,
          timeoutMs,
          maxResponseBytes,
          resolveOutboundUrl,
        );
        if (!hasExactKeys(response, [
          "protocolVersion",
          "queryId",
          "intentId",
          "executionId",
          "dispatchFencingToken",
          "state",
          "receipt",
          "observedAtMs",
          "retryAllowed",
          "signature",
        ])) throw receiptError();
        return Object.freeze({ ...response }) as unknown as LocalClientReceiptReconciliationResponse;
      } catch (error) {
        if (request.signal.aborted) throw abortedError(false);
        if (timedOut) throw timeoutError(false);
        if (error instanceof LocalClientLoopbackAdapterError) throw error;
        if (error instanceof OutboundUrlPolicyError && error.reason === "redirect_forbidden") {
          throw loopbackError(
            "LOCAL_CLIENT_LOOPBACK_REDIRECT_FORBIDDEN",
            "The loopback client attempted a forbidden reconciliation redirect.",
            "network",
            502,
          );
        }
        if (isErrorCode(error, "RESPONSE_BODY_TOO_LARGE")) throw responseTooLargeError();
        throw loopbackError(
          "LOCAL_CLIENT_LOOPBACK_NETWORK_FAILED",
          "The receipt-only reconciliation request failed.",
          "network",
          502,
          true,
        );
      } finally {
        clearTimeout(timer);
        secretLifecycle.end();
      }
    },
  });
}

/**
 * Creates a no-action, code-configured proof of possession probe. The probe is
 * bound to one canonical loopback origin, client id, adapter identity, manifest
 * digest, and secret. Its public result contains no endpoint, nonce, signature,
 * response body, or secret material.
 */
export function createLocalClientLoopbackVerificationProbe(
  options: LocalClientLoopbackVerificationProbeOptions,
): LocalClientVerificationProbe {
  assertVerificationProbeOptions(options);
  const adapterId = assertIdentifier(
    options.adapterId ?? LOCAL_CLIENT_LOOPBACK_ADAPTER_ID,
    configurationError,
  );
  const endpoint = validateEndpoint(options.endpoint);
  const expectedClientId = assertIdentifier(options.expectedClientId, configurationError);
  const expectedManifestSha256 = assertSha256(options.expectedManifestSha256, configurationError);
  const secret = cloneSecret(options.sharedSecret);
  const secretLifecycle = createSecretLifecycle(secret);
  const timeoutMs = boundedInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, 50, MAX_TIMEOUT_MS);
  const challengeTtlMs = boundedInteger(
    options.challengeTtlMs,
    DEFAULT_CHALLENGE_TTL_MS,
    10,
    MAX_CHALLENGE_TTL_MS,
  );
  const verificationTtlMs = boundedInteger(
    options.verificationTtlMs,
    DEFAULT_VERIFICATION_TTL_MS,
    1_000,
    MAX_VERIFICATION_TTL_MS,
  );
  const maxResponseBytes = boundedInteger(
    options.maxResponseBytes,
    DEFAULT_MAX_RESPONSE_BYTES,
    256,
    MAX_RESPONSE_BYTES,
  );
  if (options.now !== undefined && typeof options.now !== "function") throw configurationError();
  const now = options.now ?? Date.now;
  const resolveOutboundUrl = createExactLoopbackResolver(endpoint, [VERIFICATION_PATH]);
  const descriptor = Object.freeze({
    descriptorVersion: LOCAL_CLIENT_VERIFICATION_PROBE_DESCRIPTOR_VERSION,
    assurance: "governed-hmac-sha256-loopback" as const,
      clientId: expectedClientId,
      adapter: Object.freeze({
        id: adapterId,
      type: LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE,
      version: LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION,
    }),
    manifestSha256: expectedManifestSha256,
  });

  return Object.freeze({
    descriptor,
    close: () => secretLifecycle.close(),
    async probe(request: Readonly<{ signal: AbortSignal }>): Promise<LocalClientVerificationEvidence> {
      assertVerificationProbeRequest(request);
      if (request.signal.aborted) throw abortedError(false);
      secretLifecycle.begin();
      const timeoutController = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        timeoutController.abort();
      }, timeoutMs);
      timer.unref?.();
      const signal = AbortSignal.any([request.signal, timeoutController.signal]);

      try {
        const issuedAtMs = readNow(now);
        const expiresAtMs = issuedAtMs + challengeTtlMs;
        if (!Number.isSafeInteger(expiresAtMs)) throw attestationError();
        const nonce = randomBytes(32).toString("base64url");
        const unsignedRequest = {
          protocolVersion: LOCAL_CLIENT_LOOPBACK_VERIFICATION_VERSION,
          nonce,
          clientId: expectedClientId,
          adapterId,
          adapterType: LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE,
          adapterVersion: LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION,
          manifestSha256: expectedManifestSha256,
          issuedAtMs,
          expiresAtMs,
        } as const;
        const verificationRequest: VerificationRequest = Object.freeze({
          ...unsignedRequest,
          signature: signVerificationRequest(secret, unsignedRequest),
        });
        const rawResponse = await postJson(
          `${endpoint.origin}${VERIFICATION_PATH}`,
          verificationRequest,
          signal,
          timeoutMs,
          maxResponseBytes,
          resolveOutboundUrl,
        );
        const observedAtMs = readNow(now);
        const response = validateVerificationResponse(
          rawResponse,
          verificationRequest,
          secret,
          observedAtMs,
        );
        throwIfAborted(request.signal, false);
        const evidenceExpiresAtMs = observedAtMs + verificationTtlMs;
        if (!Number.isSafeInteger(evidenceExpiresAtMs)) throw attestationError();
        return Object.freeze({
          evidenceVersion: LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION,
          fingerprint: sha256(JSON.stringify([
            LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION,
            LOCAL_CLIENT_LOOPBACK_VERIFICATION_VERSION,
            response.clientId,
            response.adapterId,
            response.adapterType,
            response.adapterVersion,
            response.manifestSha256,
            response.nonce,
            response.issuedAtMs,
            response.expiresAtMs,
            observedAtMs,
            evidenceExpiresAtMs,
            response.signature,
          ])),
          verifiedAtMs: observedAtMs,
          expiresAtMs: evidenceExpiresAtMs,
        });
      } catch (error) {
        if (request.signal.aborted) throw abortedError(false);
        if (timedOut) throw timeoutError(false);
        if (error instanceof LocalClientLoopbackAdapterError) throw error;
        if (error instanceof OutboundUrlPolicyError && error.reason === "redirect_forbidden") {
          throw loopbackError(
            "LOCAL_CLIENT_LOOPBACK_REDIRECT_FORBIDDEN",
            "The loopback client attempted a forbidden redirect.",
            "network",
            502,
          );
        }
        if (isErrorCode(error, "RESPONSE_BODY_TOO_LARGE")) throw responseTooLargeError();
        throw loopbackError(
          "LOCAL_CLIENT_LOOPBACK_NETWORK_FAILED",
          "The exact loopback client verification request failed.",
          "network",
          502,
          true,
        );
      } finally {
        clearTimeout(timer);
        secretLifecycle.end();
      }
    },
  });
}

function createExactLoopbackResolver(
  endpoint: ExactLoopbackEndpoint,
  paths: readonly string[] = [
    CHALLENGE_PATH,
    ACTION_PATH,
    LOCAL_CLIENT_LOOPBACK_RECONCILIATION_PATH,
  ],
) {
  const allowedPaths = new Set(paths);
  const lookup = createPinnedLookup([{ address: endpoint.address, family: endpoint.family }]);
  return async (rawUrl: unknown) => {
    let url: URL;
    try {
      url = new URL(String(rawUrl ?? ""));
    } catch {
      throw new OutboundUrlPolicyError("invalid_loopback_url");
    }
    const hostname = normalizeHostname(url.hostname);
    if (
      url.protocol !== "http:"
      || url.origin !== endpoint.origin
      || hostname !== endpoint.hostname
      || url.username !== ""
      || url.password !== ""
      || url.search !== ""
      || url.hash !== ""
      || !allowedPaths.has(url.pathname)
    ) {
      throw new OutboundUrlPolicyError("loopback_target_mismatch");
    }
    return Object.freeze({
      url: url.toString(),
      hostname,
      addresses: Object.freeze([{ address: endpoint.address, family: endpoint.family }]),
      lookup,
    });
  };
}

async function postJson(
  url: string,
  payload: object,
  signal: AbortSignal,
  timeoutMs: number,
  maxResponseBytes: number,
  resolveOutboundUrl: ReturnType<typeof createExactLoopbackResolver>,
): Promise<Record<string, unknown>> {
  const response = await safeOutboundFetch(url, {
    method: "POST",
    headers: Object.freeze({
      accept: "application/json",
      "cache-control": "no-store",
      "content-type": "application/json",
    }),
    body: JSON.stringify(payload),
    credentials: "omit",
    redirect: "error",
    signal,
    timeout: timeoutMs,
    maxResponseBytes,
  }, { resolveOutboundUrl });
  if (!response.ok) {
    await cancelBody(response);
    throw loopbackError(
      "LOCAL_CLIENT_LOOPBACK_NETWORK_FAILED",
      "The exact loopback client returned a non-success status.",
      "network",
      502,
      true,
    );
  }
  return readBoundedJson(response, maxResponseBytes);
}

async function readBoundedJson(response: Response, maxBytes: number): Promise<Record<string, unknown>> {
  const contentType = String(response.headers.get("content-type") ?? "").toLowerCase();
  const contentEncoding = String(response.headers.get("content-encoding") ?? "identity").toLowerCase();
  if (!/^application\/json(?:\s*;|$)/u.test(contentType) || contentEncoding !== "identity") {
    await cancelBody(response);
    throw responseInvalidError();
  }
  const rawContentLength = response.headers.get("content-length");
  if (rawContentLength !== null) {
    if (!/^(?:0|[1-9][0-9]*)$/u.test(rawContentLength)) {
      await cancelBody(response);
      throw responseInvalidError();
    }
    if (Number(rawContentLength) > maxBytes) {
      await cancelBody(response);
      throw responseTooLargeError();
    }
  }
  const reader = response.body?.getReader();
  if (!reader) throw responseInvalidError();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      received += item.value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => {});
        throw responseTooLargeError();
      }
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let parsed: unknown;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    parsed = JSON.parse(text);
  } catch {
    throw responseInvalidError();
  }
  if (!isPlainRecord(parsed)) throw responseInvalidError();
  return parsed;
}

function validateChallengeResponse(
  raw: Record<string, unknown>,
  request: ChallengeRequest,
  expectedClientId: string,
  expectedManifestSha256: string,
  secret: Buffer,
  observedAtMs: number,
): ChallengeResponse {
  assertExactKeys(raw, [
    "protocolVersion",
    "nonce",
    "clientId",
    "manifestSha256",
    "adapterVersion",
    "issuedAtMs",
    "expiresAtMs",
    "signature",
  ], attestationError);
  if (
    raw.protocolVersion !== LOCAL_CLIENT_LOOPBACK_CHALLENGE_VERSION
    || raw.nonce !== request.nonce
    || raw.clientId !== expectedClientId
    || raw.manifestSha256 !== expectedManifestSha256
    || raw.adapterVersion !== LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION
    || raw.issuedAtMs !== request.issuedAtMs
    || raw.expiresAtMs !== request.expiresAtMs
    || !NONCE_PATTERN.test(request.nonce)
    || observedAtMs < request.issuedAtMs
    || observedAtMs >= request.expiresAtMs
  ) {
    throw attestationError();
  }
  const response = raw as unknown as ChallengeResponse;
  const expectedSignature = signChallengeResponse(secret, response);
  if (!safeSignatureEqual(response.signature, expectedSignature)) throw attestationError();
  return response;
}

function validateVerificationResponse(
  raw: Record<string, unknown>,
  request: VerificationRequest,
  secret: Buffer,
  observedAtMs: number,
): VerificationResponse {
  assertExactKeys(raw, [
    "protocolVersion",
    "nonce",
    "clientId",
    "adapterId",
    "adapterType",
    "adapterVersion",
    "manifestSha256",
    "issuedAtMs",
    "expiresAtMs",
    "signature",
  ], attestationError);
  if (
    raw.protocolVersion !== LOCAL_CLIENT_LOOPBACK_VERIFICATION_VERSION
    || raw.nonce !== request.nonce
    || raw.clientId !== request.clientId
    || raw.adapterId !== request.adapterId
    || raw.adapterType !== request.adapterType
    || raw.adapterVersion !== request.adapterVersion
    || raw.manifestSha256 !== request.manifestSha256
    || raw.issuedAtMs !== request.issuedAtMs
    || raw.expiresAtMs !== request.expiresAtMs
    || !NONCE_PATTERN.test(request.nonce)
    || observedAtMs < request.issuedAtMs
    || observedAtMs >= request.expiresAtMs
  ) {
    throw attestationError();
  }
  const response = raw as unknown as VerificationResponse;
  if (!safeSignatureEqual(response.signature, signVerificationResponse(secret, response))) {
    throw attestationError();
  }
  return response;
}

function validateReceipt(
  raw: Record<string, unknown>,
  request: ActionRequest,
  expectedClientId: string,
  expectedManifestSha256: string,
  secret: Buffer,
): ProtocolReceipt {
  assertExactKeys(raw, [
    "protocolVersion",
    "receiptId",
    "executionId",
    "clientId",
    "manifestSha256",
    "adapterVersion",
    "nonce",
    "capabilityId",
    "actionId",
    "planFingerprint",
    "inputSha256",
    "durableReceiptSha256",
    "durableReceipt",
    "executionMode",
    "externalEffectPerformed",
    "status",
    "signature",
  ], receiptError);
  if (
    raw.protocolVersion !== LOCAL_CLIENT_LOOPBACK_RECEIPT_VERSION
    || raw.executionId !== request.executionId
    || raw.clientId !== expectedClientId
    || raw.manifestSha256 !== expectedManifestSha256
    || raw.adapterVersion !== LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION
    || raw.nonce !== request.nonce
    || raw.capabilityId !== request.capabilityId
    || raw.actionId !== request.actionId
    || raw.planFingerprint !== request.planFingerprint
    || raw.inputSha256 !== request.inputSha256
    || !isPlainRecord(raw.durableReceipt)
    || raw.durableReceiptSha256 !== sha256(canonicalJson(raw.durableReceipt))
    || raw.executionMode !== "governed"
    || typeof raw.externalEffectPerformed !== "boolean"
    || raw.status !== "completed"
  ) {
    throw receiptError();
  }
  const receipt = raw as unknown as ProtocolReceipt;
  const expectedReceiptId = deriveReceiptId(receipt);
  if (
    receipt.receiptId !== expectedReceiptId
    || !safeSignatureEqual(receipt.signature, signReceipt(secret, receipt))
  ) {
    throw receiptError();
  }
  return receipt;
}

function validateInvocation(
  invocation: LocalClientAdapterInvocation,
  expectedClientId: string,
  adapterId: string,
): {
  executionId: string;
  planFingerprint: string;
  actionInput: ActionPayload;
  receiptReconciliation: NonNullable<LocalClientAdapterInvocation["receiptReconciliation"]>;
} {
  if (
    !isPlainRecord(invocation)
    || !isPlainRecord(invocation.client)
    || !isPlainRecord(invocation.client.adapter)
    || !isPlainRecord(invocation.adapterDescriptor)
    || !isPlainRecord(invocation.actionDescriptor)
    || !isPlainRecord(invocation.input)
    || !isPlainRecord(invocation.receiptReconciliation)
    || !isPlainRecord(invocation.receiptReconciliation.intent)
    || typeof invocation.receiptReconciliation.confirmReceipt !== "function"
    || !(invocation.signal instanceof AbortSignal)
    || typeof invocation.executionId !== "string"
    || !EXECUTION_ID_PATTERN.test(invocation.executionId)
    || !isBoundedIdentity(invocation.tenantId)
    || !isBoundedIdentity(invocation.subjectId)
  ) {
    throw inputError();
  }
  if (
    invocation.client.descriptorVersion !== "verified-local-client-adapter-target-v1"
    || invocation.client.clientId !== expectedClientId
    || invocation.client.state !== "verified"
    || invocation.client.trustDecision !== "verified"
    || !Array.isArray(invocation.client.capabilityIds)
    || !invocation.client.capabilityIds.includes(LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID)
    || invocation.client.adapter.id !== adapterId
    || invocation.client.adapter.type !== LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE
    || invocation.client.adapter.version !== LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION
    || invocation.adapterDescriptor.descriptorVersion !== LOCAL_CLIENT_ADAPTER_DESCRIPTOR_VERSION
    || invocation.adapterDescriptor.id !== adapterId
    || invocation.adapterDescriptor.type !== LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE
    || invocation.adapterDescriptor.version !== LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION
    || invocation.capabilityId !== LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID
    || invocation.actionId !== LOCAL_CLIENT_LOOPBACK_ACTION_ID
    || invocation.actionDescriptor.capabilityId !== LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID
    || invocation.actionDescriptor.actionId !== LOCAL_CLIENT_LOOPBACK_ACTION_ID
  ) {
    throw loopbackError(
      "LOCAL_CLIENT_LOOPBACK_TARGET_MISMATCH",
      "The invocation does not match the code-configured loopback client and action.",
      "auth",
      409,
    );
  }
  const input = invocation.input as LocalClientAdapterInput;
  const keys = Reflect.ownKeys(input);
  if (
    !keys.includes("planFingerprint")
    || keys.some((key) => key !== "planFingerprint" && key !== "payload")
    || keys.length > 2
  ) {
    throw inputError();
  }
  const planFingerprint = assertSha256(input.planFingerprint, inputError);
  const payload = input.payload;
  if (payload !== undefined && (typeof payload !== "string" || payload.length > MAX_PAYLOAD_LENGTH)) {
    throw inputError();
  }
  return {
    executionId: invocation.executionId,
    planFingerprint,
    actionInput: Object.freeze(payload === undefined ? {} : { payload }),
    receiptReconciliation: invocation.receiptReconciliation,
  };
}

function validateReconciliationTransportRequest(
  request: LocalClientAdapterReceiptReconciliationRequest,
  expectedClientId: string,
  adapterId: string,
): void {
  if (
    !hasExactKeys(request, ["tenantId", "subjectId", "client", "query", "signal"])
    || !isPlainRecord(request.client)
    || !isPlainRecord(request.client.adapter)
    || !isPlainRecord(request.query)
    || !(request.signal instanceof AbortSignal)
    || !isBoundedIdentity(request.tenantId)
    || !isBoundedIdentity(request.subjectId)
    || request.client.clientId !== expectedClientId
    || request.client.state !== "verified"
    || request.client.trustDecision !== "verified"
    || request.client.adapter.id !== adapterId
    || request.client.adapter.type !== LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE
    || request.client.adapter.version !== LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION
    || typeof request.query.executionId !== "string"
    || !EXECUTION_ID_PATTERN.test(request.query.executionId)
    || request.query.authorizeExecution !== false
    || request.query.purpose !== "receipt-reconciliation-only"
  ) throw inputError();
}

function validateEndpoint(raw: unknown): ExactLoopbackEndpoint {
  if (typeof raw !== "string" || raw.length < 1 || raw.length > MAX_ENDPOINT_LENGTH || raw !== raw.trim()) {
    throw configurationError();
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw configurationError();
  }
  const hostname = normalizeHostname(url.hostname);
  const canonicalInput = raw === url.origin || raw === `${url.origin}/`;
  if (
    url.protocol !== "http:"
    || (hostname !== "127.0.0.1" && hostname !== "::1")
    || url.port === ""
    || url.username !== ""
    || url.password !== ""
    || url.pathname !== "/"
    || url.search !== ""
    || url.hash !== ""
    || !canonicalInput
  ) {
    throw configurationError();
  }
  return Object.freeze({
    origin: url.origin,
    hostname,
    address: hostname,
    family: hostname === "127.0.0.1" ? 4 : 6,
  });
}

function assertOptions(options: LocalClientLoopbackAdapterOptions): void {
  if (!isPlainRecord(options)) throw configurationError();
  const keys = Reflect.ownKeys(options);
  const allowed = new Set([
    "adapterId",
    "endpoint",
    "expectedClientId",
    "expectedManifestSha256",
    "sharedSecret",
    "timeoutMs",
    "challengeTtlMs",
    "maxResponseBytes",
    "now",
  ]);
  if (
    keys.some((key) => typeof key !== "string" || !allowed.has(key))
    || !Object.hasOwn(options, "endpoint")
    || !Object.hasOwn(options, "expectedClientId")
    || !Object.hasOwn(options, "expectedManifestSha256")
    || !Object.hasOwn(options, "sharedSecret")
  ) {
    throw configurationError();
  }
}

function assertVerificationProbeOptions(options: LocalClientLoopbackVerificationProbeOptions): void {
  if (!isPlainRecord(options)) throw configurationError();
  const keys = Reflect.ownKeys(options);
  const allowed = new Set([
    "adapterId",
    "endpoint",
    "expectedClientId",
    "expectedManifestSha256",
    "sharedSecret",
    "timeoutMs",
    "challengeTtlMs",
    "verificationTtlMs",
    "maxResponseBytes",
    "now",
  ]);
  if (
    keys.some((key) => typeof key !== "string" || !allowed.has(key))
    || !Object.hasOwn(options, "endpoint")
    || !Object.hasOwn(options, "expectedClientId")
    || !Object.hasOwn(options, "expectedManifestSha256")
    || !Object.hasOwn(options, "sharedSecret")
  ) {
    throw configurationError();
  }
}

function assertVerificationProbeRequest(
  request: Readonly<{ signal: AbortSignal }>,
): void {
  if (!isPlainRecord(request)) throw inputError();
  assertExactKeys(request, ["signal"], inputError);
  if (!(request.signal instanceof AbortSignal)) throw inputError();
}

function cloneSecret(value: unknown): Buffer {
  if (!(value instanceof Uint8Array) || value.byteLength < 32 || value.byteLength > 64) {
    throw configurationError();
  }
  return Buffer.from(value);
}

function createSecretLifecycle(secret: Buffer) {
  let closed = false;
  let active = 0;
  let closePromise: Promise<void> | null = null;
  let resolveDrain: (() => void) | null = null;
  return Object.freeze({
    begin() {
      if (closed) throw closedError();
      active += 1;
    },
    end() {
      active = Math.max(0, active - 1);
      if (closed && active === 0) resolveDrain?.();
    },
    close() {
      if (closePromise) return closePromise;
      closed = true;
      closePromise = (async () => {
        if (active > 0) {
          await new Promise<void>((resolvePromise) => {
            resolveDrain = resolvePromise;
          });
        }
        secret.fill(0);
        resolveDrain = null;
      })();
      return closePromise;
    },
  });
}

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < min || resolved > max) throw configurationError();
  return resolved;
}

function readNow(now: () => number): number {
  let value: unknown;
  try {
    value = now();
  } catch {
    throw attestationError();
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw attestationError();
  return value;
}

function signChallengeRequest(
  secret: Buffer,
  challenge: Omit<ChallengeRequest, "signature">,
): string {
  return hmac(secret, [
    LOCAL_CLIENT_LOOPBACK_CHALLENGE_VERSION,
    "request",
    challenge.nonce,
    challenge.clientId,
    challenge.manifestSha256,
    challenge.adapterVersion,
    challenge.issuedAtMs,
    challenge.expiresAtMs,
  ]);
}

function signChallengeResponse(secret: Buffer, challenge: ChallengeResponse): string {
  return hmac(secret, [
    LOCAL_CLIENT_LOOPBACK_CHALLENGE_VERSION,
    "response",
    challenge.nonce,
    challenge.clientId,
    challenge.manifestSha256,
    challenge.adapterVersion,
    challenge.issuedAtMs,
    challenge.expiresAtMs,
  ]);
}

function signVerificationRequest(
  secret: Buffer,
  request: Omit<VerificationRequest, "signature">,
): string {
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

function signVerificationResponse(secret: Buffer, response: VerificationResponse): string {
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

function signAction(secret: Buffer, action: Omit<ActionRequest, "signature">): string {
  return hmac(secret, [
    LOCAL_CLIENT_LOOPBACK_ACTION_VERSION,
    action.executionId,
    action.clientId,
    action.manifestSha256,
    action.adapterVersion,
    action.nonce,
    action.capabilityId,
    action.actionId,
    action.planFingerprint,
    action.inputSha256,
    action.dispatchIntentSha256,
  ]);
}

function signReceipt(secret: Buffer, receipt: ProtocolReceipt): string {
  return hmac(secret, [
    LOCAL_CLIENT_LOOPBACK_RECEIPT_VERSION,
    receipt.receiptId,
    receipt.executionId,
    receipt.clientId,
    receipt.manifestSha256,
    receipt.adapterVersion,
    receipt.nonce,
    receipt.capabilityId,
    receipt.actionId,
    receipt.planFingerprint,
    receipt.inputSha256,
    receipt.durableReceiptSha256,
    receipt.executionMode,
    receipt.externalEffectPerformed,
    receipt.status,
  ]);
}

function deriveReceiptId(receipt: Omit<ProtocolReceipt, "signature" | "receiptId">): string {
  return `loopback:${sha256(JSON.stringify([
    LOCAL_CLIENT_LOOPBACK_RECEIPT_VERSION,
    receipt.executionId,
    receipt.clientId,
    receipt.manifestSha256,
    receipt.adapterVersion,
    receipt.nonce,
    receipt.capabilityId,
    receipt.actionId,
    receipt.planFingerprint,
    receipt.inputSha256,
    receipt.durableReceiptSha256,
    receipt.executionMode,
    receipt.externalEffectPerformed,
    receipt.status,
  ]))}`;
}

function hmac(secret: Buffer, fields: readonly unknown[]): string {
  return createHmac("sha256", secret).update(JSON.stringify(fields), "utf8").digest("hex");
}

function safeSignatureEqual(candidate: unknown, expected: string): boolean {
  if (typeof candidate !== "string" || !SIGNATURE_PATTERN.test(candidate)) return false;
  const left = Buffer.from(candidate, "hex");
  const right = Buffer.from(expected, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function assertSha256(value: unknown, errorFactory: () => LocalClientLoopbackAdapterError): string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) throw errorFactory();
  return value;
}

function assertIdentifier(value: unknown, errorFactory: () => LocalClientLoopbackAdapterError): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) throw errorFactory();
  return value;
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  errorFactory: () => LocalClientLoopbackAdapterError,
): void {
  if (!hasExactKeys(value, expected)) throw errorFactory();
}

function hasExactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (!isPlainRecord(value)) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === expected.length
    && keys.every((key) => {
      if (typeof key !== "string" || !expected.includes(key)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return Boolean(descriptor && "value" in descriptor);
    });
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Reflect.ownKeys(value).every((key) => {
    if (typeof key !== "string") return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return Boolean(descriptor && "value" in descriptor);
  });
}

function isBoundedIdentity(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= MAX_IDENTITY_LENGTH
    && value === value.trim()
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function normalizeHostname(value: string): "127.0.0.1" | "::1" | string {
  return value.replace(/^\[|\]$/gu, "").toLowerCase();
}

function isErrorCode(error: unknown, code: string): boolean {
  try {
    return error !== null
      && typeof error === "object"
      && (error as { code?: unknown }).code === code;
  } catch {
    return false;
  }
}

async function cancelBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => {});
}

function throwIfAborted(signal: AbortSignal, outcomeUnknown: boolean): void {
  if (signal.aborted) throw abortedError(outcomeUnknown);
}

function loopbackError(
  code: LocalClientLoopbackAdapterErrorCode,
  message: string,
  category: LocalClientLoopbackAdapterError["category"],
  statusCode: number,
  retryable = false,
  outcomeUnknown = false,
): LocalClientLoopbackAdapterError {
  return new LocalClientLoopbackAdapterError(
    code,
    message,
    category,
    statusCode,
    retryable,
    outcomeUnknown,
  );
}

function configurationError(): LocalClientLoopbackAdapterError {
  return loopbackError(
    "LOCAL_CLIENT_LOOPBACK_CONFIGURATION_INVALID",
    "The code-configured loopback adapter boundary is invalid.",
    "configuration",
    500,
  );
}

function closedError(): LocalClientLoopbackAdapterError {
  return loopbackError(
    "LOCAL_CLIENT_LOOPBACK_CLOSED",
    "The loopback client credential boundary is closed.",
    "configuration",
    503,
  );
}

function inputError(): LocalClientLoopbackAdapterError {
  return loopbackError(
    "LOCAL_CLIENT_LOOPBACK_INPUT_INVALID",
    "The fixed loopback action input is invalid.",
    "validation",
    400,
  );
}

function abortedError(outcomeUnknown: boolean): LocalClientLoopbackAdapterError {
  return loopbackError(
    "LOCAL_CLIENT_LOOPBACK_ABORTED",
    outcomeUnknown
      ? "The loopback action was cancelled after dispatch; its outcome is unknown."
      : "The loopback action was cancelled before dispatch.",
    "cancellation",
    499,
    false,
    outcomeUnknown,
  );
}

function timeoutError(outcomeUnknown: boolean): LocalClientLoopbackAdapterError {
  return loopbackError(
    "LOCAL_CLIENT_LOOPBACK_TIMEOUT",
    outcomeUnknown
      ? "The loopback action timed out after dispatch; its outcome is unknown."
      : "The loopback attestation timed out before action dispatch.",
    "network",
    504,
    !outcomeUnknown,
    outcomeUnknown,
  );
}

function responseTooLargeError(): LocalClientLoopbackAdapterError {
  return loopbackError(
    "LOCAL_CLIENT_LOOPBACK_RESPONSE_TOO_LARGE",
    "The loopback client response exceeded the configured byte limit.",
    "network",
    502,
  );
}

function responseInvalidError(): LocalClientLoopbackAdapterError {
  return loopbackError(
    "LOCAL_CLIENT_LOOPBACK_NETWORK_FAILED",
    "The exact loopback client returned an invalid bounded response.",
    "network",
    502,
  );
}

function attestationError(): LocalClientLoopbackAdapterError {
  return loopbackError(
    "LOCAL_CLIENT_LOOPBACK_ATTESTATION_INVALID",
    "The loopback client challenge attestation failed.",
    "auth",
    403,
  );
}

function receiptError(): LocalClientLoopbackAdapterError {
  return loopbackError(
    "LOCAL_CLIENT_LOOPBACK_RECEIPT_INVALID",
    "The loopback client receipt failed binding or signature validation.",
    "integrity",
    502,
  );
}
