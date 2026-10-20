// Extracted verbatim from localClientExecutionReceiptReconciliation.ts so the
// error class, internal journal row types/consts, and the trailing helper
// cluster live beside the two-role journal class. Pure mechanical move;
// behaviour unchanged.
import { createHmac, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  LOCAL_CLIENT_DISPATCH_INTENT_VERSION,
  LOCAL_CLIENT_DURABLE_RECEIPT_VERSION,
  LOCAL_CLIENT_RECONCILIATION_QUERY_VERSION,
  LOCAL_CLIENT_RECONCILIATION_RESPONSE_VERSION,
  LOCAL_CLIENT_RECEIPT_RECONCILIATION_HMAC_DOMAIN,
  type LocalClientDispatchIntent,
  type LocalClientDurableExecutionReceipt,
  type LocalClientReceiptReconciliationQuery,
  type LocalClientReceiptReconciliationResponse,
} from "@unified-ai-system/shared-contracts";
import type {
  LocalClientReceiptJournalRole,
  LocalClientReceiptReconciliationIdentity,
  LocalClientReceiptJournalState,
  LocalClientSqliteExecutionReceiptJournalOptions,
  LocalClientReceiptJournalRecord,
  LocalClientReceiptRecoveryCandidate,
  LocalClientExecutionReceiptReconciliationErrorCode,
} from "./localClientExecutionReceiptReconciliation.ts";

export class LocalClientExecutionReceiptReconciliationError extends Error {
  readonly code: LocalClientExecutionReceiptReconciliationErrorCode;
  readonly category:
    | "configuration"
    | "validation"
    | "auth"
    | "concurrency"
    | "capacity"
    | "not_found"
    | "persistence"
    | "integrity";
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: LocalClientExecutionReceiptReconciliationErrorCode,
    message: string,
    category: LocalClientExecutionReceiptReconciliationError["category"],
    statusCode: number,
    retryable = false,
  ) {
    super(message);
    this.name = "LocalClientExecutionReceiptReconciliationError";
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export type MetadataRow = {
  schema_version: number;
  role: LocalClientReceiptJournalRole;
  host_binding_hmac: string;
  namespace_binding_hmac: string;
  integrity_key_binding_hmac: string;
  protocol_key_binding_hmac: string;
  recovery_key_binding_hmac: string;
  max_entries: number;
  retention_ms: number;
  intent_ttl_ms: number;
  query_ttl_ms: number;
  allowed_clock_skew_ms: number;
  busy_timeout_ms: number;
  last_clock_ms: number;
  last_fencing_token: string;
  active_row_count: number;
  active_row_xor_hmac: string;
  metadata_hmac: string;
};

export type JournalRow = {
  record_version: number;
  execution_id: string;
  execution_binding_hmac: string;
  tenant_binding_hmac: string;
  subject_binding_hmac: string;
  client_binding_hmac: string;
  route_binding_hmac: string;
  identity_binding_hmac: string;
  plan_sha256: string;
  input_sha256: string;
  state: LocalClientReceiptJournalState;
  dispatch_fencing_token: string;
  intent_id: string;
  intent_issued_at_ms: number;
  intent_expires_at_ms: number;
  effect_started_at_ms: number;
  terminal_at_ms: number;
  terminal_outcome: "" | "completed" | "failed-before-effect";
  receipt_id: string;
  feedback_staged_at_ms: number;
  lifecycle_finalized_at_ms: number;
  retire_at_ms: number;
  created_at_ms: number;
  updated_at_ms: number;
  recovery_nonce: string;
  recovery_ciphertext: string;
  recovery_auth_tag: string;
  recovery_aad_hmac: string;
  row_hmac: string;
};

export type ProtocolBindings = Readonly<{
  executionId: string;
  executionBindingHmac: string;
  tenantBindingHmac: string;
  subjectBindingHmac: string;
  clientBindingHmac: string;
  routeBindingHmac: string;
  identityBindingHmac: string;
  planFingerprint: string;
  inputSha256: string;
}>;

export const METADATA_SINGLETON = 1;
export const RECORD_VERSION = 1;
export const DEFAULT_NAMESPACE = "local-client-execution-receipts";
export const DEFAULT_MAX_ENTRIES = 2_000;
export const DEFAULT_RETENTION_MS = 7 * 24 * 60 * 60_000;
export const DEFAULT_INTENT_TTL_MS = 60_000;
export const DEFAULT_QUERY_TTL_MS = 30_000;
export const DEFAULT_CLOCK_SKEW_MS = 5_000;
export const DEFAULT_BUSY_TIMEOUT_MS = 5_000;
export const MAX_ENTRIES = 100_000;
export const MAX_RETENTION_MS = 365 * 24 * 60 * 60_000;
export const MAX_INTENT_TTL_MS = 10 * 60_000;
export const MAX_QUERY_TTL_MS = 60_000;
export const MAX_CLOCK_SKEW_MS = 60_000;
export const MAX_BUSY_TIMEOUT_MS = 30_000;
export const MAX_DATE_MS = 8_640_000_000_000_000;
export const MAX_FENCING_TOKEN = 9_223_372_036_854_775_807n;
export const MAX_PATH_LENGTH = 4_096;
export const MAX_HOST_ID_LENGTH = 256;
export const MAX_NAMESPACE_LENGTH = 128;
export const MIN_KEY_BYTES = 32;
export const MAX_KEY_BYTES = 64;
export const RECOVERY_KEY_BYTES = 32;
export const RECOVERY_NONCE_BYTES = 12;
export const RECOVERY_TAG_BYTES = 16;
export const MAX_RECOVERY_CIPHERTEXT_LENGTH = 4_096;
export const EXECUTION_ID_PATTERN = /^lc-exec-[a-f0-9]{64}$/u;
export const IDENTIFIER_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
export const NAMESPACE_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
export const DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
export const INTENT_ID_PATTERN = /^lcdi_[a-f0-9]{64}$/u;
export const RECEIPT_ID_PATTERN = /^lcdr_[a-f0-9]{64}$/u;
export const QUERY_ID_PATTERN = /^lcq_[a-f0-9]{48}$/u;
export const DECIMAL_PATTERN = /^(?:0|[1-9][0-9]{0,18})$/u;
export const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
export const EMPTY_ROW_SET_XOR = "0".repeat(64);
export const ROW_SCAN_BATCH_SIZE = 128;
export const TARGET_TABLES = Object.freeze([
  "local_client_execution_receipt_metadata",
  "local_client_execution_receipt_journal",
]);

export const GATEWAY_STATES = new Set<LocalClientReceiptJournalState>([
  "prepared",
  "not-dispatched-confirmed",
  "armed",
  "armed-not-dispatched-confirmed",
  "receipt-confirmed",
  "feedback-staged",
  "failed-before-effect-confirmed",
  "lifecycle-finalized",
]);
export const CLIENT_STATES = new Set<LocalClientReceiptJournalState>([
  "accepted",
  "effect-started",
  "completed",
  "failed-before-effect",
]);
export function normalizeIdentity(
  protocolKey: Uint8Array,
  input: LocalClientReceiptReconciliationIdentity,
): ProtocolBindings {
  assertPlainRecord(input, inputError);
  assertExactKeys(input, [
    "executionId",
    "tenantId",
    "subjectId",
    "clientId",
    "capabilityId",
    "actionId",
    "planFingerprint",
    "inputSha256",
  ], false, inputError);
  const executionId = normalizeExecutionId(input.executionId);
  const tenantId = boundedOpaqueIdentity(input.tenantId);
  const subjectId = boundedOpaqueIdentity(input.subjectId);
  const clientId = boundedOpaqueIdentity(input.clientId);
  const capabilityId = assertIdentifier(input.capabilityId);
  const actionId = assertIdentifier(input.actionId);
  const planFingerprint = assertDigest(input.planFingerprint);
  const inputSha256 = assertDigest(input.inputSha256);
  const executionBindingHmac = keyedDigest(protocolKey, "execution-binding", executionId);
  const tenantBindingHmac = keyedDigest(protocolKey, "tenant-binding", tenantId);
  const subjectBindingHmac = keyedDigest(protocolKey, "subject-binding", subjectId);
  const clientBindingHmac = keyedDigest(protocolKey, "client-binding", clientId);
  const routeBindingHmac = keyedDigest(
    protocolKey,
    "route-binding",
    canonicalJson({ actionId, capabilityId }),
  );
  const identityBindingHmac = deriveIdentityBindingHmac(protocolKey, {
    clientBindingHmac,
    executionBindingHmac,
    inputSha256,
    planFingerprint,
    routeBindingHmac,
    subjectBindingHmac,
    tenantBindingHmac,
  });
  return Object.freeze({
    executionId,
    executionBindingHmac,
    tenantBindingHmac,
    subjectBindingHmac,
    clientBindingHmac,
    routeBindingHmac,
    identityBindingHmac,
    planFingerprint,
    inputSha256,
  });
}

export function intentBaseFromBindings(
  bindings: ProtocolBindings,
  dispatchFencingToken: string,
  issuedAtMs: number,
  expiresAtMs: number,
) {
  return Object.freeze({
    protocolVersion: LOCAL_CLIENT_DISPATCH_INTENT_VERSION,
    executionId: bindings.executionId,
    executionBindingHmac: bindings.executionBindingHmac,
    tenantBindingHmac: bindings.tenantBindingHmac,
    subjectBindingHmac: bindings.subjectBindingHmac,
    clientBindingHmac: bindings.clientBindingHmac,
    routeBindingHmac: bindings.routeBindingHmac,
    identityBindingHmac: bindings.identityBindingHmac,
    planFingerprint: bindings.planFingerprint,
    inputSha256: bindings.inputSha256,
    dispatchFencingToken,
    issuedAtMs,
    expiresAtMs,
  });
}

export function deriveIntentId(protocolKey: Uint8Array, base: ReturnType<typeof intentBaseFromBindings>): string {
  return `lcdi_${keyedDigest(protocolKey, "dispatch-intent-id", canonicalJson(base))}`;
}

/** Application-private verifier for native effect stores. Expired intents may
 * authenticate a read-only recovery lookup, never a fresh effect authorization. */
export function authenticateLocalClientDispatchIntent(
  protocolKey: Uint8Array,
  intent: LocalClientDispatchIntent,
  options: Readonly<{ nowMs?: number; allowExpired?: boolean }> = {},
): LocalClientDispatchIntent {
  const nowMs = options.nowMs ?? Date.now();
  if (!isSafeNonNegativeInteger(nowMs)
    || (options.allowExpired !== undefined && typeof options.allowExpired !== "boolean")) {
    throw configurationError();
  }
  const key = cloneKey(protocolKey);
  try {
    const authenticated = validateDispatchIntent(
      key, intent, nowMs, DEFAULT_CLOCK_SKEW_MS, MAX_INTENT_TTL_MS, options.allowExpired !== true,
    );
    if (authenticated.issuedAtMs > safeAdd(nowMs, DEFAULT_CLOCK_SKEW_MS)) throw intentExpiredError();
    return authenticated;
  } finally { key.fill(0); }
}

export function validateDispatchIntent(
  protocolKey: Uint8Array,
  raw: LocalClientDispatchIntent,
  nowMs: number,
  allowedClockSkewMs: number,
  maxTtlMs: number,
  enforceFreshness: boolean,
): LocalClientDispatchIntent {
  assertPlainRecord(raw, inputError);
  assertExactKeys(raw, [
    "protocolVersion", "intentId", "executionId", "executionBindingHmac",
    "tenantBindingHmac", "subjectBindingHmac", "clientBindingHmac", "routeBindingHmac",
    "identityBindingHmac", "planFingerprint", "inputSha256", "dispatchFencingToken",
    "issuedAtMs", "expiresAtMs", "signature",
  ], false, inputError);
  if (
    raw.protocolVersion !== LOCAL_CLIENT_DISPATCH_INTENT_VERSION
    || !INTENT_ID_PATTERN.test(String(raw.intentId ?? ""))
    || !isProtocolBindings(raw)
    || !isFencingToken(raw.dispatchFencingToken, false)
    || !validProtocolWindow(raw.issuedAtMs, raw.expiresAtMs, maxTtlMs)
    || !isDigest(raw.signature)
  ) throw inputError();
  const unsigned = withoutSignature(raw);
  const base = intentBaseFromBindings(
    raw,
    raw.dispatchFencingToken,
    raw.issuedAtMs,
    raw.expiresAtMs,
  );
  if (
    raw.executionBindingHmac !== keyedDigest(protocolKey, "execution-binding", raw.executionId)
    || raw.identityBindingHmac !== deriveIdentityBindingHmac(protocolKey, raw)
    || raw.intentId !== deriveIntentId(protocolKey, base)
    || !safeDigestEqual(raw.signature, signProtocol(protocolKey, "dispatch-intent", unsigned))
  ) throw signatureError();
  if (enforceFreshness && (
    raw.issuedAtMs > safeAdd(nowMs, allowedClockSkewMs)
    || safeAdd(raw.expiresAtMs, allowedClockSkewMs) < nowMs
  )) throw intentExpiredError();
  return Object.freeze({ ...raw });
}

export function validateDurableReceipt(
  protocolKey: Uint8Array,
  raw: LocalClientDurableExecutionReceipt,
  nowMs: number,
  allowedClockSkewMs: number,
): LocalClientDurableExecutionReceipt {
  assertPlainRecord(raw, inputError);
  assertExactKeys(raw, [
    "protocolVersion", "receiptId", "intentId", "executionId", "executionBindingHmac",
    "tenantBindingHmac", "subjectBindingHmac", "clientBindingHmac", "routeBindingHmac",
    "identityBindingHmac", "planFingerprint", "inputSha256", "dispatchFencingToken",
    "completedAtMs", "executionMode", "externalEffectPerformed", "status", "signature",
  ], false, inputError);
  if (
    raw.protocolVersion !== LOCAL_CLIENT_DURABLE_RECEIPT_VERSION
    || !RECEIPT_ID_PATTERN.test(String(raw.receiptId ?? ""))
    || !INTENT_ID_PATTERN.test(String(raw.intentId ?? ""))
    || !isProtocolBindings(raw)
    || !isFencingToken(raw.dispatchFencingToken, false)
    || !isSafeNonNegativeInteger(raw.completedAtMs)
    || raw.completedAtMs > MAX_DATE_MS
    || raw.executionMode !== "governed"
    || raw.externalEffectPerformed !== true
    || raw.status !== "completed"
    || !isDigest(raw.signature)
  ) throw inputError();
  if (raw.completedAtMs > safeAdd(nowMs, allowedClockSkewMs)) throw signatureError();
  if (
    raw.executionBindingHmac !== keyedDigest(protocolKey, "execution-binding", raw.executionId)
    || raw.identityBindingHmac !== deriveIdentityBindingHmac(protocolKey, raw)
    || raw.receiptId !== deriveReceiptIdFromBindings(protocolKey, raw, raw.completedAtMs)
    || !safeDigestEqual(
      raw.signature,
      signProtocol(protocolKey, "durable-receipt", withoutSignature(raw)),
    )
  ) throw signatureError();
  return Object.freeze({ ...raw });
}

export function validateReconciliationQuery(
  protocolKey: Uint8Array,
  raw: LocalClientReceiptReconciliationQuery,
  nowMs: number,
  allowedClockSkewMs: number,
  maxTtlMs: number,
): LocalClientReceiptReconciliationQuery {
  assertPlainRecord(raw, inputError);
  assertExactKeys(raw, [
    "protocolVersion", "queryId", "intentId", "executionId", "executionBindingHmac",
    "tenantBindingHmac", "subjectBindingHmac", "clientBindingHmac", "routeBindingHmac",
    "identityBindingHmac", "planFingerprint", "inputSha256", "dispatchFencingToken",
    "issuedAtMs", "expiresAtMs", "purpose", "authorizeExecution", "signature",
  ], false, inputError);
  if (
    raw.protocolVersion !== LOCAL_CLIENT_RECONCILIATION_QUERY_VERSION
    || !QUERY_ID_PATTERN.test(String(raw.queryId ?? ""))
    || !INTENT_ID_PATTERN.test(String(raw.intentId ?? ""))
    || !isProtocolBindings(raw)
    || !isFencingToken(raw.dispatchFencingToken, false)
    || !validProtocolWindow(raw.issuedAtMs, raw.expiresAtMs, maxTtlMs)
    || raw.purpose !== "receipt-reconciliation-only"
    || raw.authorizeExecution !== false
    || !isDigest(raw.signature)
  ) throw inputError();
  if (
    raw.executionBindingHmac !== keyedDigest(protocolKey, "execution-binding", raw.executionId)
    || raw.identityBindingHmac !== deriveIdentityBindingHmac(protocolKey, raw)
    || !safeDigestEqual(
      raw.signature,
      signProtocol(protocolKey, "reconciliation-query", withoutSignature(raw)),
    )
  ) throw signatureError();
  if (
    raw.issuedAtMs > safeAdd(nowMs, allowedClockSkewMs)
    || safeAdd(raw.expiresAtMs, allowedClockSkewMs) < nowMs
  ) throw queryExpiredError();
  return Object.freeze({ ...raw });
}

export function validateReconciliationResponse(
  protocolKey: Uint8Array,
  raw: LocalClientReceiptReconciliationResponse,
  nowMs: number,
  allowedClockSkewMs: number,
): LocalClientReceiptReconciliationResponse {
  assertPlainRecord(raw, inputError);
  assertExactKeys(raw, [
    "protocolVersion", "queryId", "intentId", "executionId", "dispatchFencingToken",
    "state", "receipt", "observedAtMs", "retryAllowed", "signature",
  ], false, inputError);
  if (
    raw.protocolVersion !== LOCAL_CLIENT_RECONCILIATION_RESPONSE_VERSION
    || !QUERY_ID_PATTERN.test(String(raw.queryId ?? ""))
    || !INTENT_ID_PATTERN.test(String(raw.intentId ?? ""))
    || !EXECUTION_ID_PATTERN.test(String(raw.executionId ?? ""))
    || !isFencingToken(raw.dispatchFencingToken, false)
    || !["completed", "failed-before-effect", "pending", "not-found"].includes(raw.state)
    || !isSafeNonNegativeInteger(raw.observedAtMs)
    || raw.observedAtMs > safeAdd(nowMs, allowedClockSkewMs)
    || raw.retryAllowed !== false
    || !isDigest(raw.signature)
  ) throw inputError();
  if (!safeDigestEqual(
    raw.signature,
    signProtocol(protocolKey, "reconciliation-response", withoutSignature(raw)),
  )) throw signatureError();
  const receipt = raw.receipt === null
    ? null
    : validateDurableReceipt(protocolKey, raw.receipt, nowMs, allowedClockSkewMs);
  if ((raw.state === "completed") !== (receipt !== null)) throw signatureError();
  return Object.freeze({ ...raw, receipt });
}

export type RecoveryCiphertext = Pick<
  JournalRow,
  "recovery_nonce" | "recovery_ciphertext" | "recovery_auth_tag" | "recovery_aad_hmac"
>;

export function createPreparedRow(
  identity: ProtocolBindings,
  nowMs: number,
  recovery: RecoveryCiphertext,
): JournalRow {
  return {
    record_version: RECORD_VERSION,
    execution_id: identity.executionId,
    execution_binding_hmac: identity.executionBindingHmac,
    tenant_binding_hmac: identity.tenantBindingHmac,
    subject_binding_hmac: identity.subjectBindingHmac,
    client_binding_hmac: identity.clientBindingHmac,
    route_binding_hmac: identity.routeBindingHmac,
    identity_binding_hmac: identity.identityBindingHmac,
    plan_sha256: identity.planFingerprint,
    input_sha256: identity.inputSha256,
    state: "prepared",
    dispatch_fencing_token: "0",
    intent_id: "",
    intent_issued_at_ms: 0,
    intent_expires_at_ms: 0,
    effect_started_at_ms: 0,
    terminal_at_ms: 0,
    terminal_outcome: "",
    receipt_id: "",
    feedback_staged_at_ms: 0,
    lifecycle_finalized_at_ms: 0,
    retire_at_ms: 0,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
    ...recovery,
    row_hmac: "",
  };
}

export function createAcceptedRow(intent: LocalClientDispatchIntent, nowMs: number): JournalRow {
  return {
    record_version: RECORD_VERSION,
    execution_id: intent.executionId,
    execution_binding_hmac: intent.executionBindingHmac,
    tenant_binding_hmac: intent.tenantBindingHmac,
    subject_binding_hmac: intent.subjectBindingHmac,
    client_binding_hmac: intent.clientBindingHmac,
    route_binding_hmac: intent.routeBindingHmac,
    identity_binding_hmac: intent.identityBindingHmac,
    plan_sha256: intent.planFingerprint,
    input_sha256: intent.inputSha256,
    state: "accepted",
    dispatch_fencing_token: intent.dispatchFencingToken,
    intent_id: intent.intentId,
    intent_issued_at_ms: intent.issuedAtMs,
    intent_expires_at_ms: intent.expiresAtMs,
    effect_started_at_ms: 0,
    terminal_at_ms: 0,
    terminal_outcome: "",
    receipt_id: "",
    feedback_staged_at_ms: 0,
    lifecycle_finalized_at_ms: 0,
    retire_at_ms: 0,
    created_at_ms: nowMs,
    updated_at_ms: nowMs,
    recovery_nonce: "",
    recovery_ciphertext: "",
    recovery_auth_tag: "",
    recovery_aad_hmac: "",
    row_hmac: "",
  };
}

export function signJournalRow(key: Uint8Array, row: JournalRow): JournalRow {
  const unsigned = { ...row, row_hmac: "" };
  const signed = { ...unsigned, row_hmac: digestJournalRow(key, unsigned) };
  validateJournalRow(signed);
  return signed;
}

export function digestJournalRow(key: Uint8Array, row: JournalRow): string {
  return keyedDigest(key, "journal-row", canonicalJson({
    recordVersion: row.record_version,
    executionId: row.execution_id,
    executionBindingHmac: row.execution_binding_hmac,
    tenantBindingHmac: row.tenant_binding_hmac,
    subjectBindingHmac: row.subject_binding_hmac,
    clientBindingHmac: row.client_binding_hmac,
    routeBindingHmac: row.route_binding_hmac,
    identityBindingHmac: row.identity_binding_hmac,
    planSha256: row.plan_sha256,
    inputSha256: row.input_sha256,
    state: row.state,
    dispatchFencingToken: row.dispatch_fencing_token,
    intentId: row.intent_id,
    intentIssuedAtMs: row.intent_issued_at_ms,
    intentExpiresAtMs: row.intent_expires_at_ms,
    effectStartedAtMs: row.effect_started_at_ms,
    terminalAtMs: row.terminal_at_ms,
    terminalOutcome: row.terminal_outcome,
    receiptId: row.receipt_id,
    feedbackStagedAtMs: row.feedback_staged_at_ms,
    lifecycleFinalizedAtMs: row.lifecycle_finalized_at_ms,
    retireAtMs: row.retire_at_ms,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
    recoveryNonce: row.recovery_nonce,
    recoveryCiphertext: row.recovery_ciphertext,
    recoveryAuthTag: row.recovery_auth_tag,
    recoveryAadHmac: row.recovery_aad_hmac,
  }));
}

export function validateJournalRow(row: JournalRow): void {
  if (
    row.record_version !== RECORD_VERSION
    || !EXECUTION_ID_PATTERN.test(String(row.execution_id ?? ""))
    || !isDigest(row.execution_binding_hmac)
    || !isDigest(row.tenant_binding_hmac)
    || !isDigest(row.subject_binding_hmac)
    || !isDigest(row.client_binding_hmac)
    || !isDigest(row.route_binding_hmac)
    || !isDigest(row.identity_binding_hmac)
    || !isDigest(row.plan_sha256)
    || !isDigest(row.input_sha256)
    || ![...GATEWAY_STATES, ...CLIENT_STATES].includes(row.state)
    || !isFencingToken(row.dispatch_fencing_token, true)
    || !(row.intent_id === "" || INTENT_ID_PATTERN.test(row.intent_id))
    || !isSafeDate(row.intent_issued_at_ms)
    || !isSafeDate(row.intent_expires_at_ms)
    || !isSafeDate(row.effect_started_at_ms)
    || !isSafeDate(row.terminal_at_ms)
    || !["", "completed", "failed-before-effect"].includes(row.terminal_outcome)
    || !(row.receipt_id === "" || RECEIPT_ID_PATTERN.test(row.receipt_id))
    || !isSafeDate(row.feedback_staged_at_ms)
    || !isSafeDate(row.lifecycle_finalized_at_ms)
    || !isSafeDate(row.retire_at_ms)
    || !isSafeDate(row.created_at_ms)
    || !isSafeDate(row.updated_at_ms)
    || row.updated_at_ms < row.created_at_ms
    || typeof row.recovery_nonce !== "string"
    || typeof row.recovery_ciphertext !== "string"
    || typeof row.recovery_auth_tag !== "string"
    || typeof row.recovery_aad_hmac !== "string"
    || !isDigest(row.row_hmac)
  ) throw integrityError();
  const hasRecovery = row.recovery_nonce !== ""
    || row.recovery_ciphertext !== ""
    || row.recovery_auth_tag !== ""
    || row.recovery_aad_hmac !== "";
  if (GATEWAY_STATES.has(row.state)) {
    if (
      !hasRecovery
      || !isBase64UrlBytes(row.recovery_nonce, RECOVERY_NONCE_BYTES, RECOVERY_NONCE_BYTES)
      || !isBase64UrlBytes(row.recovery_ciphertext, 1, MAX_RECOVERY_CIPHERTEXT_LENGTH)
      || !isBase64UrlBytes(row.recovery_auth_tag, RECOVERY_TAG_BYTES, RECOVERY_TAG_BYTES)
      || !isDigest(row.recovery_aad_hmac)
    ) throw integrityError();
  } else if (hasRecovery) {
    throw integrityError();
  }
  const hasIntent = row.intent_id !== "";
  if (hasIntent !== (row.dispatch_fencing_token !== "0")) throw integrityError();
  const permitsNoIntent = row.state === "prepared"
    || row.state === "not-dispatched-confirmed"
    || (
      row.state === "lifecycle-finalized"
      && row.terminal_outcome === "failed-before-effect"
    );
  if (!hasIntent && !permitsNoIntent) throw integrityError();
  if (hasIntent && (row.state === "prepared" || row.state === "not-dispatched-confirmed")) {
    throw integrityError();
  }
  if (hasIntent && (
    row.intent_issued_at_ms === 0
    || row.intent_expires_at_ms <= row.intent_issued_at_ms
  )) throw integrityError();
  if (!hasIntent && (row.intent_issued_at_ms !== 0 || row.intent_expires_at_ms !== 0)) {
    throw integrityError();
  }
  if (row.state === "prepared") {
    assertEmptyOutcome(row, true);
  } else if (row.state === "not-dispatched-confirmed") {
    if (
      row.effect_started_at_ms !== 0
      || row.terminal_at_ms === 0
      || row.terminal_outcome !== "failed-before-effect"
      || row.receipt_id !== ""
      || row.feedback_staged_at_ms !== 0
      || row.lifecycle_finalized_at_ms !== 0
      || row.retire_at_ms !== 0
      || row.intent_id !== ""
      || row.dispatch_fencing_token !== "0"
    ) throw integrityError();
  } else if (row.state === "armed" || row.state === "accepted") {
    assertEmptyOutcome(row, false);
  } else if (row.state === "armed-not-dispatched-confirmed") {
    if (
      row.effect_started_at_ms !== 0
      || row.terminal_at_ms === 0
      || row.terminal_outcome !== "failed-before-effect"
      || row.receipt_id !== ""
      || row.feedback_staged_at_ms !== 0
      || row.lifecycle_finalized_at_ms !== 0
      || row.retire_at_ms !== 0
      || row.intent_id === ""
      || row.dispatch_fencing_token === "0"
    ) throw integrityError();
  } else if (row.state === "effect-started") {
    if (row.effect_started_at_ms === 0) throw integrityError();
    assertNoTerminal(row);
  } else if (row.state === "completed") {
    if (
      row.effect_started_at_ms === 0
      || row.terminal_at_ms === 0
      || row.terminal_outcome !== "completed"
      || row.receipt_id === ""
      || (row.retire_at_ms !== 0 && row.retire_at_ms <= row.terminal_at_ms)
      || row.feedback_staged_at_ms !== 0
      || row.lifecycle_finalized_at_ms !== 0
    ) throw integrityError();
  } else if (row.state === "failed-before-effect") {
    if (
      row.effect_started_at_ms !== 0
      || row.terminal_at_ms === 0
      || row.terminal_outcome !== "failed-before-effect"
      || row.receipt_id !== ""
      || (row.retire_at_ms !== 0 && row.retire_at_ms <= row.terminal_at_ms)
      || row.feedback_staged_at_ms !== 0
      || row.lifecycle_finalized_at_ms !== 0
    ) throw integrityError();
  } else if (row.state === "receipt-confirmed") {
    assertGatewayCompleted(row, false, false);
  } else if (row.state === "feedback-staged") {
    assertGatewayCompleted(row, true, false);
  } else if (row.state === "failed-before-effect-confirmed") {
    if (
      row.effect_started_at_ms !== 0
      || row.terminal_at_ms === 0
      || row.terminal_outcome !== "failed-before-effect"
      || row.receipt_id !== ""
      || row.feedback_staged_at_ms !== 0
      || row.lifecycle_finalized_at_ms !== 0
      || row.retire_at_ms !== 0
    ) throw integrityError();
  } else if (row.state === "lifecycle-finalized") {
    if (row.lifecycle_finalized_at_ms === 0 || row.retire_at_ms <= row.lifecycle_finalized_at_ms) {
      throw integrityError();
    }
    if (row.terminal_outcome === "completed") assertGatewayCompleted(row, true, true);
    else if (row.terminal_outcome === "failed-before-effect") {
      if (
        row.effect_started_at_ms !== 0
        || row.terminal_at_ms === 0
        || row.receipt_id !== ""
        || row.feedback_staged_at_ms !== 0
      ) throw integrityError();
    } else throw integrityError();
  }
}

export function assertEmptyOutcome(row: JournalRow, prepared: boolean): void {
  if (
    row.effect_started_at_ms !== 0
    || row.terminal_at_ms !== 0
    || row.terminal_outcome !== ""
    || row.receipt_id !== ""
    || row.feedback_staged_at_ms !== 0
    || row.lifecycle_finalized_at_ms !== 0
    || row.retire_at_ms !== 0
    || (prepared && (row.intent_id !== "" || row.dispatch_fencing_token !== "0"))
  ) throw integrityError();
}

export function assertNoTerminal(row: JournalRow): void {
  if (
    row.terminal_at_ms !== 0
    || row.terminal_outcome !== ""
    || row.receipt_id !== ""
    || row.feedback_staged_at_ms !== 0
    || row.lifecycle_finalized_at_ms !== 0
    || row.retire_at_ms !== 0
  ) throw integrityError();
}

export function assertGatewayCompleted(row: JournalRow, feedback: boolean, finalized: boolean): void {
  if (
    row.effect_started_at_ms !== 0
    || row.terminal_at_ms === 0
    || row.terminal_outcome !== "completed"
    || row.receipt_id === ""
    || (feedback ? row.feedback_staged_at_ms === 0 : row.feedback_staged_at_ms !== 0)
    || (finalized ? row.lifecycle_finalized_at_ms === 0 : row.lifecycle_finalized_at_ms !== 0)
    || (finalized ? row.retire_at_ms <= row.lifecycle_finalized_at_ms : row.retire_at_ms !== 0)
  ) throw integrityError();
}

export function assertRowBindings(row: JournalRow, bindings: ProtocolBindings): void {
  if (
    row.execution_id !== bindings.executionId
    || !safeDigestEqual(row.execution_binding_hmac, bindings.executionBindingHmac)
    || !safeDigestEqual(row.tenant_binding_hmac, bindings.tenantBindingHmac)
    || !safeDigestEqual(row.subject_binding_hmac, bindings.subjectBindingHmac)
    || !safeDigestEqual(row.client_binding_hmac, bindings.clientBindingHmac)
    || !safeDigestEqual(row.route_binding_hmac, bindings.routeBindingHmac)
    || !safeDigestEqual(row.identity_binding_hmac, bindings.identityBindingHmac)
    || !safeDigestEqual(row.plan_sha256, bindings.planFingerprint)
    || !safeDigestEqual(row.input_sha256, bindings.inputSha256)
  ) throw identityMismatchError();
}

export function assertRowMatchesIntent(row: JournalRow, intent: LocalClientDispatchIntent): void {
  assertRowBindings(row, intent);
  if (
    row.intent_id !== intent.intentId
    || row.dispatch_fencing_token !== intent.dispatchFencingToken
    || row.intent_issued_at_ms !== intent.issuedAtMs
    || row.intent_expires_at_ms !== intent.expiresAtMs
  ) throw identityMismatchError();
}

export function assertRowMatchesQuery(row: JournalRow, query: LocalClientReceiptReconciliationQuery): void {
  assertRowBindings(row, query);
  if (
    row.intent_id !== query.intentId
    || row.dispatch_fencing_token !== query.dispatchFencingToken
  ) throw identityMismatchError();
}

export function assertRowMatchesReceipt(row: JournalRow, receipt: LocalClientDurableExecutionReceipt): void {
  assertRowBindings(row, receipt);
  if (
    row.intent_id !== receipt.intentId
    || row.dispatch_fencing_token !== receipt.dispatchFencingToken
  ) throw identityMismatchError();
}

export function deriveReceiptId(protocolKey: Uint8Array, row: JournalRow, completedAtMs: number): string {
  return deriveReceiptIdFromBindings(protocolKey, {
    clientBindingHmac: row.client_binding_hmac,
    dispatchFencingToken: row.dispatch_fencing_token,
    executionBindingHmac: row.execution_binding_hmac,
    identityBindingHmac: row.identity_binding_hmac,
    inputSha256: row.input_sha256,
    intentId: row.intent_id,
    planFingerprint: row.plan_sha256,
    routeBindingHmac: row.route_binding_hmac,
    subjectBindingHmac: row.subject_binding_hmac,
    tenantBindingHmac: row.tenant_binding_hmac,
  }, completedAtMs);
}

export function deriveIdentityBindingHmac(
  protocolKey: Uint8Array,
  value: Pick<
    ProtocolBindings,
    | "clientBindingHmac"
    | "executionBindingHmac"
    | "inputSha256"
    | "planFingerprint"
    | "routeBindingHmac"
    | "subjectBindingHmac"
    | "tenantBindingHmac"
  >,
): string {
  return keyedDigest(protocolKey, "identity-binding", canonicalJson({
    clientBindingHmac: value.clientBindingHmac,
    executionBindingHmac: value.executionBindingHmac,
    inputSha256: value.inputSha256,
    planFingerprint: value.planFingerprint,
    routeBindingHmac: value.routeBindingHmac,
    subjectBindingHmac: value.subjectBindingHmac,
    tenantBindingHmac: value.tenantBindingHmac,
  }));
}

export function deriveReceiptIdFromBindings(
  protocolKey: Uint8Array,
  value: Pick<
    LocalClientDurableExecutionReceipt,
    | "clientBindingHmac"
    | "dispatchFencingToken"
    | "executionBindingHmac"
    | "identityBindingHmac"
    | "inputSha256"
    | "intentId"
    | "planFingerprint"
    | "routeBindingHmac"
    | "subjectBindingHmac"
    | "tenantBindingHmac"
  >,
  completedAtMs: number,
): string {
  return `lcdr_${keyedDigest(protocolKey, "durable-receipt-id", canonicalJson({
    clientBindingHmac: value.clientBindingHmac,
    completedAtMs,
    dispatchFencingToken: value.dispatchFencingToken,
    executionBindingHmac: value.executionBindingHmac,
    identityBindingHmac: value.identityBindingHmac,
    inputSha256: value.inputSha256,
    intentId: value.intentId,
    planFingerprint: value.planFingerprint,
    routeBindingHmac: value.routeBindingHmac,
    subjectBindingHmac: value.subjectBindingHmac,
    tenantBindingHmac: value.tenantBindingHmac,
  }))}`;
}

export function bindingsFromRow(row: JournalRow): ProtocolBindings {
  return Object.freeze({
    executionId: row.execution_id,
    executionBindingHmac: row.execution_binding_hmac,
    tenantBindingHmac: row.tenant_binding_hmac,
    subjectBindingHmac: row.subject_binding_hmac,
    clientBindingHmac: row.client_binding_hmac,
    routeBindingHmac: row.route_binding_hmac,
    identityBindingHmac: row.identity_binding_hmac,
    planFingerprint: row.plan_sha256,
    inputSha256: row.input_sha256,
  });
}

export function recoveryAad(bindings: ProtocolBindings, dispatchFencingToken: string): string {
  if (!isFencingToken(dispatchFencingToken, true)) throw integrityError();
  return canonicalJson({
    schema: "local-client-recovery-context-aad-v1",
    executionId: bindings.executionId,
    planFingerprint: bindings.planFingerprint,
    inputSha256: bindings.inputSha256,
    dispatchFencingToken,
  });
}

export function toPublicRecord(row: JournalRow): LocalClientReceiptJournalRecord {
  return Object.freeze({
    executionId: row.execution_id,
    executionFingerprint: fingerprint(row.execution_binding_hmac),
    identityFingerprint: fingerprint(row.identity_binding_hmac),
    state: row.state,
    dispatchFencingToken: row.dispatch_fencing_token === "0" ? null : row.dispatch_fencing_token,
    intentId: row.intent_id === "" ? null : row.intent_id,
    receiptFingerprint: row.receipt_id === "" ? null : fingerprintText(row.receipt_id),
    terminalOutcome: row.terminal_outcome === "" ? null : row.terminal_outcome,
    createdAt: toIso(row.created_at_ms),
    updatedAt: toIso(row.updated_at_ms),
  });
}

export function recoveryAction(row: JournalRow): LocalClientReceiptRecoveryCandidate["recoveryAction"] {
  if (row.state === "prepared") return "resolve-not-dispatched";
  if (row.state === "not-dispatched-confirmed") return "finalize-failed-lifecycle";
  if (row.state === "armed") return "query-client-only";
  if (row.state === "armed-not-dispatched-confirmed") return "finalize-failed-lifecycle";
  if (row.state === "receipt-confirmed") return "stage-feedback";
  if (row.state === "feedback-staged") return "finalize-completed-lifecycle";
  if (row.state === "failed-before-effect-confirmed") return "finalize-failed-lifecycle";
  throw stateError();
}

export function nextRecoverySchedulingTimestamp(previous: number, observed: number): number {
  if (!isSafeDate(previous) || !isSafeDate(observed)) throw integrityError();
  if (observed > previous) return observed;
  return safeAdd(previous, 1);
}

export function journalRowValues(row: JournalRow): readonly (string | number)[] {
  return [
    row.record_version,
    row.execution_id,
    row.execution_binding_hmac,
    row.tenant_binding_hmac,
    row.subject_binding_hmac,
    row.client_binding_hmac,
    row.route_binding_hmac,
    row.identity_binding_hmac,
    row.plan_sha256,
    row.input_sha256,
    row.state,
    row.dispatch_fencing_token,
    row.intent_id,
    row.intent_issued_at_ms,
    row.intent_expires_at_ms,
    row.effect_started_at_ms,
    row.terminal_at_ms,
    row.terminal_outcome,
    row.receipt_id,
    row.feedback_staged_at_ms,
    row.lifecycle_finalized_at_ms,
    row.retire_at_ms,
    row.created_at_ms,
    row.updated_at_ms,
    row.recovery_nonce,
    row.recovery_ciphertext,
    row.recovery_auth_tag,
    row.recovery_aad_hmac,
    row.row_hmac,
  ];
}

export function selectJournalFields(): string {
  return `SELECT
    record_version, execution_id, execution_binding_hmac, tenant_binding_hmac,
    subject_binding_hmac, client_binding_hmac, route_binding_hmac,
    identity_binding_hmac, plan_sha256, input_sha256, state,
    dispatch_fencing_token, intent_id, intent_issued_at_ms,
    intent_expires_at_ms, effect_started_at_ms, terminal_at_ms,
    terminal_outcome, receipt_id, feedback_staged_at_ms,
    lifecycle_finalized_at_ms, retire_at_ms, created_at_ms, updated_at_ms,
    recovery_nonce, recovery_ciphertext, recovery_auth_tag, recovery_aad_hmac,
    row_hmac
    FROM local_client_execution_receipt_journal`;
}

export function signProtocol(key: Uint8Array, domain: string, value: unknown): string {
  return keyedDigest(key, `protocol/${domain}`, canonicalJson(value));
}

export function keyedDigest(key: Uint8Array, domain: string, value: string): string {
  return createHmac("sha256", key)
    .update(LOCAL_CLIENT_RECEIPT_RECONCILIATION_HMAC_DOMAIN, "utf8")
    .update("\u0000", "utf8")
    .update(domain, "utf8")
    .update("\u0000", "utf8")
    .update(value, "utf8")
    .digest("hex");
}

export function rowSetMemberDigest(key: Uint8Array, row: JournalRow): string {
  if (!isDigest(row.row_hmac)) throw integrityError();
  return keyedDigest(key, "active-row-set-member", canonicalJson({
    executionId: row.execution_id,
    rowHmac: row.row_hmac,
  }));
}

export function xorDigests(left: string, right: string): string {
  if (!isDigest(left) || !isDigest(right)) throw integrityError();
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  for (let index = 0; index < leftBytes.length; index += 1) {
    leftBytes[index] = leftBytes[index]! ^ rightBytes[index]!;
  }
  rightBytes.fill(0);
  const result = leftBytes.toString("hex");
  leftBytes.fill(0);
  return result;
}

export function decodeBase64Url(value: string, exactBytes: number | null): Buffer {
  if (!isBase64UrlBytes(value, exactBytes ?? 1, exactBytes ?? MAX_RECOVERY_CIPHERTEXT_LENGTH)) {
    throw integrityError();
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) {
    decoded.fill(0);
    throw integrityError();
  }
  return decoded;
}

export function isBase64UrlBytes(value: unknown, minBytes: number, maxBytes: number): value is string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > Math.ceil(maxBytes * 4 / 3) + 2
    || !BASE64URL_PATTERN.test(value)
  ) return false;
  try {
    const decoded = Buffer.from(value, "base64url");
    const valid = decoded.byteLength >= minBytes
      && decoded.byteLength <= maxBytes
      && decoded.toString("base64url") === value;
    decoded.fill(0);
    return valid;
  } catch {
    return false;
  }
}

export function withoutSignature<T extends { readonly signature: string }>(value: T): Omit<T, "signature"> {
  const { signature: _signature, ...unsigned } = value;
  return unsigned;
}

export function isProtocolBindings(value: Partial<ProtocolBindings>): value is ProtocolBindings {
  return EXECUTION_ID_PATTERN.test(String(value.executionId ?? ""))
    && isDigest(value.executionBindingHmac)
    && isDigest(value.tenantBindingHmac)
    && isDigest(value.subjectBindingHmac)
    && isDigest(value.clientBindingHmac)
    && isDigest(value.routeBindingHmac)
    && isDigest(value.identityBindingHmac)
    && isDigest(value.planFingerprint)
    && isDigest(value.inputSha256);
}

export function validProtocolWindow(issuedAtMs: unknown, expiresAtMs: unknown, maxTtlMs: number): boolean {
  return isSafeNonNegativeInteger(issuedAtMs)
    && isSafeNonNegativeInteger(expiresAtMs)
    && issuedAtMs <= MAX_DATE_MS
    && expiresAtMs <= MAX_DATE_MS
    && expiresAtMs > issuedAtMs
    && expiresAtMs - issuedAtMs <= maxTtlMs;
}

export function assertOptions(options: LocalClientSqliteExecutionReceiptJournalOptions): void {
  assertPlainRecord(options, configurationError);
  assertExactKeys(options, [
    "sqlitePath", "role", "hostId", "integrityKey", "protocolKey", "recoveryEncryptionKey", "namespace",
    "maxEntries", "retentionMs", "intentTtlMs", "queryTtlMs", "allowedClockSkewMs",
    "busyTimeoutMs", "now", "protectedAuthority",
  ], true, configurationError);
  for (const key of ["sqlitePath", "role", "hostId", "integrityKey", "protocolKey"] as const) {
    if (!Object.hasOwn(options, key)) throw configurationError();
  }
}

export function assertExactKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  allowMissing: boolean,
  errorFactory: () => Error,
): void {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))) throw errorFactory();
  if (!allowMissing && allowedKeys.some((key) => !Object.hasOwn(value, key))) throw errorFactory();
}

export function assertPlainRecord(
  value: unknown,
  errorFactory: () => Error,
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw errorFactory();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw errorFactory();
}

export function resolveSqlitePath(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > MAX_PATH_LENGTH
    || value !== value.trim()
    || value === ":memory:"
    || value.includes("\u0000")
    || value.startsWith("\\\\")
    || value.startsWith("//")
  ) throw configurationError();
  const absolute = resolve(value);
  if (absolute.startsWith("\\\\") || absolute.startsWith("//")) throw configurationError();
  return absolute;
}

export function assertRole(value: unknown): LocalClientReceiptJournalRole {
  if (value !== "gateway" && value !== "client") throw configurationError();
  return value;
}

export function assertHostId(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length < 8
    || value.length > MAX_HOST_ID_LENGTH
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) throw configurationError();
  return value;
}

export function assertNamespace(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length > MAX_NAMESPACE_LENGTH
    || !NAMESPACE_PATTERN.test(value)
  ) throw configurationError();
  return value;
}

export function cloneKey(value: unknown): Buffer {
  if (!(value instanceof Uint8Array) || value.byteLength < MIN_KEY_BYTES || value.byteLength > MAX_KEY_BYTES) {
    throw configurationError();
  }
  return Buffer.from(value);
}

export function cloneRecoveryKey(value: unknown): Buffer {
  if (!(value instanceof Uint8Array) || value.byteLength !== RECOVERY_KEY_BYTES) {
    throw configurationError();
  }
  return Buffer.from(value);
}

export function safeKeyEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}

export function normalizeExecutionId(value: unknown): string {
  if (typeof value !== "string" || !EXECUTION_ID_PATTERN.test(value)) throw inputError();
  return value;
}

export function boundedOpaqueIdentity(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 256
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) throw inputError();
  return value;
}

export function boundedOpaqueIdentityForIntegrity(value: unknown): string {
  try { return boundedOpaqueIdentity(value); } catch { throw integrityError(); }
}

export function assertIdentifier(value: unknown): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) throw inputError();
  return value;
}

export function assertIdentifierForIntegrity(value: unknown): string {
  try { return assertIdentifier(value); } catch { throw integrityError(); }
}

export function assertDigest(value: unknown): string {
  if (!isDigest(value)) throw inputError();
  return value;
}

export function assertReceiptId(value: unknown): string {
  if (typeof value !== "string" || !RECEIPT_ID_PATTERN.test(value)) throw inputError();
  return value;
}

export function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < min || resolved > max) throw configurationError();
  return resolved;
}

export function readClock(now: () => number): number {
  let value: unknown;
  try { value = now(); } catch { throw clockError(); }
  if (!isSafeNonNegativeInteger(value) || value > MAX_DATE_MS) throw clockError();
  return value;
}

export function safeAdd(left: number, right: number): number {
  const value = left + right;
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_DATE_MS) throw clockError();
  return value;
}

export function readPragmaInteger(db: DatabaseSync, name: "user_version"): number {
  const row = db.prepare(`PRAGMA ${name}`).get() as Record<string, unknown> | undefined;
  const value = Number(row?.[name]);
  if (!Number.isSafeInteger(value) || value < 0) throw schemaError();
  return value;
}

export function readPragmaIntegerValue(
  db: DatabaseSync,
  name: "secure_delete" | "trusted_schema" | "foreign_keys",
): number {
  const row = db.prepare(`PRAGMA ${name}`).get() as Record<string, unknown> | undefined;
  const value = Number(row?.[name]);
  if (!Number.isSafeInteger(value)) throw integrityError();
  return value;
}

export function parseFencingToken(value: string, allowZero: boolean): bigint {
  if (!isFencingToken(value, allowZero)) throw integrityError();
  const parsed = BigInt(value);
  if (parsed > MAX_FENCING_TOKEN) throw integrityError();
  return parsed;
}

export function isFencingToken(value: unknown, allowZero: boolean): value is string {
  if (typeof value !== "string" || !DECIMAL_PATTERN.test(value)) return false;
  try {
    const parsed = BigInt(value);
    return parsed <= MAX_FENCING_TOKEN && (allowZero ? parsed >= 0n : parsed > 0n);
  } catch {
    return false;
  }
}

export function isSafeDate(value: unknown): value is number {
  return isSafeNonNegativeInteger(value) && value <= MAX_DATE_MS;
}

export function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isSafePositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST_PATTERN.test(value);
}

export function safeDigestEqual(left: string, right: string): boolean {
  if (!isDigest(left) || !isDigest(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function fingerprint(value: string): string {
  if (!isDigest(value)) throw integrityError();
  return value.slice(0, 16);
}

export function fingerprintText(value: string): string {
  if (!RECEIPT_ID_PATTERN.test(value)) throw integrityError();
  return value.slice(-16);
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(",")}}`;
}

export function toIso(value: number): string {
  try { return new Date(value).toISOString(); } catch { throw integrityError(); }
}

export function isKnownError(error: unknown): error is LocalClientExecutionReceiptReconciliationError {
  return error instanceof LocalClientExecutionReceiptReconciliationError;
}

export function isDurabilityOrIntegrityFailure(
  error: LocalClientExecutionReceiptReconciliationError,
): boolean {
  return error.category === "persistence" || error.category === "integrity";
}

export function reconciliationError(
  code: LocalClientExecutionReceiptReconciliationErrorCode,
  message: string,
  category: LocalClientExecutionReceiptReconciliationError["category"],
  statusCode: number,
  retryable = false,
) {
  return new LocalClientExecutionReceiptReconciliationError(
    code,
    message,
    category,
    statusCode,
    retryable,
  );
}

export function configurationError() {
  return reconciliationError(
    "LOCAL_CLIENT_RECEIPT_RECONCILIATION_CONFIGURATION_INVALID",
    "The local-client receipt reconciliation configuration is invalid.",
    "configuration",
    500,
  );
}

export function inputError() {
  return reconciliationError(
    "LOCAL_CLIENT_RECEIPT_RECONCILIATION_INPUT_INVALID",
    "The local-client receipt reconciliation input is invalid.",
    "validation",
    400,
  );
}

export function roleError() {
  return reconciliationError(
    "LOCAL_CLIENT_RECEIPT_RECONCILIATION_ROLE_INVALID",
    "The requested receipt operation is not available for this journal role.",
    "configuration",
    409,
  );
}

export function stateError() {
  return reconciliationError(
    "LOCAL_CLIENT_RECEIPT_RECONCILIATION_STATE_INVALID",
    "The receipt journal transition is not allowed from its current durable state.",
    "concurrency",
    409,
  );
}

export function identityMismatchError() {
  return reconciliationError(
    "LOCAL_CLIENT_RECEIPT_RECONCILIATION_IDENTITY_MISMATCH",
    "The receipt evidence is bound to a different tenant, subject, client, route, or execution.",
    "auth",
    403,
  );
}

export function signatureError() {
  return reconciliationError(
    "LOCAL_CLIENT_RECEIPT_RECONCILIATION_SIGNATURE_INVALID",
    "The local-client receipt protocol HMAC failed validation.",
    "auth",
    403,
  );
}

export function intentExpiredError() {
  return reconciliationError(
    "LOCAL_CLIENT_RECEIPT_RECONCILIATION_INTENT_EXPIRED",
    "The dispatch intent is expired or not yet valid.",
    "auth",
    409,
  );
}

export function queryExpiredError() {
  return reconciliationError(
    "LOCAL_CLIENT_RECEIPT_RECONCILIATION_QUERY_EXPIRED",
    "The receipt reconciliation query is expired or not yet valid.",
    "auth",
    409,
  );
}

export function staleFenceError() {
  return reconciliationError(
    "LOCAL_CLIENT_RECEIPT_RECONCILIATION_FENCE_STALE",
    "The dispatch intent carries a stale monotonic fencing token.",
    "concurrency",
    409,
  );
}

export function capacityError() {
  return reconciliationError(
    "LOCAL_CLIENT_RECEIPT_RECONCILIATION_CAPACITY",
    "The bounded receipt journal is full; unresolved entries are retained fail-closed.",
    "capacity",
    503,
    true,
  );
}

export function notFoundError() {
  return reconciliationError(
    "LOCAL_CLIENT_RECEIPT_RECONCILIATION_NOT_FOUND",
    "The local-client receipt journal entry was not found.",
    "not_found",
    404,
  );
}

export function schemaError() {
  return reconciliationError(
    "LOCAL_CLIENT_RECEIPT_RECONCILIATION_SCHEMA_INCOMPATIBLE",
    "The local-client receipt reconciliation SQLite schema is incompatible.",
    "persistence",
    500,
  );
}

export function hostMismatchError() {
  return reconciliationError(
    "LOCAL_CLIENT_RECEIPT_RECONCILIATION_HOST_MISMATCH",
    "The local-client receipt journal belongs to another host.",
    "configuration",
    500,
  );
}

export function keyMismatchError() {
  return reconciliationError(
    "LOCAL_CLIENT_RECEIPT_RECONCILIATION_KEY_MISMATCH",
    "The local-client receipt journal HMAC key binding does not match.",
    "configuration",
    500,
  );
}

export function closedError() {
  return reconciliationError(
    "LOCAL_CLIENT_RECEIPT_RECONCILIATION_CLOSED",
    "The local-client receipt journal is closed.",
    "persistence",
    503,
  );
}

export function unavailableError() {
  return reconciliationError(
    "LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_UNAVAILABLE",
    "The local-client receipt reconciliation SQLite store is unavailable.",
    "persistence",
    503,
    true,
  );
}

export function clockError() {
  return reconciliationError(
    "LOCAL_CLIENT_RECEIPT_RECONCILIATION_CLOCK_INVALID",
    "The receipt journal clock moved backwards or returned an invalid value.",
    "integrity",
    503,
  );
}

export function integrityError() {
  return reconciliationError(
    "LOCAL_CLIENT_RECEIPT_RECONCILIATION_INTEGRITY_INVALID",
    "The local-client receipt journal failed an HMAC or state integrity check.",
    "integrity",
    500,
  );
}
