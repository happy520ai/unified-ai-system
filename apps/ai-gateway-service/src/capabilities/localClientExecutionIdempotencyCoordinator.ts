import { createHash } from "node:crypto";

import {
  LOCAL_CLIENT_ADAPTER_RECEIPT_VERSION,
  type LocalClientAdapterInput,
  type LocalClientAdapterReceipt,
} from "./localClientAdapterRegistry.ts";
import {
  type LocalClientExecutionCompletedResult,
  type LocalClientAutomaticFeedbackResult,
  type LocalClientExecutionRequest,
  type LocalClientExecutionResult,
  type LocalClientExecutionUnknownResult,
} from "./localClientExecutionOrchestrator.ts";
import {
  hashLocalClientRoutePlanInput,
  type LocalClientRoutePlan,
  type LocalClientRoutePlanReference,
} from "./localClientRoutePlanStore.ts";
import type {
  IdempotencyCoordinator,
  IdempotencyOutcome,
  IdempotencyRejectedOutcome,
} from "../http/idempotencyCoordinator.ts";

export const LOCAL_CLIENT_EXECUTION_IDEMPOTENCY_ROUTE = "/local-clients/execute" as const;

export const LOCAL_CLIENT_EXECUTION_IDEMPOTENCY_BOUNDARIES = Object.freeze({
  requiresIdempotencyKey: true as const,
  persistsRawIdentity: false as const,
  persistsRawInput: false as const,
  actionBoundByContentAddressedPlan: true as const,
  retriesPostCommitUnknown: false as const,
  memoryExecutionAllowed: false as const,
});

type IdempotencyStats = ReturnType<IdempotencyCoordinator["getStats"]>;

export type LocalClientExecutionIdempotencyHealth = Readonly<{
  enabled: boolean;
  available: boolean;
  durable: boolean;
  distributed: boolean;
  storeMode: "memory" | "sqlite" | "postgres" | "unknown";
  storageMode: "memory" | "sqlite" | "postgres" | "unknown";
  checkedAt: number | null;
  boundaries: typeof LOCAL_CLIENT_EXECUTION_IDEMPOTENCY_BOUNDARIES;
}>;

export interface LocalClientHttpExecutionRequest {
  readonly idempotencyKey: unknown;
  readonly tenantId: unknown;
  readonly subjectId: unknown;
  readonly planId: unknown;
  readonly input: unknown;
  readonly signal?: AbortSignal;
}

export interface LocalClientExecutionIdempotencyDependencies {
  readonly idempotencyCoordinator: Pick<
    IdempotencyCoordinator,
    "execute" | "getStats" | "checkHealth"
  >;
  readonly routePlanStore: {
    get(reference: LocalClientRoutePlanReference): LocalClientRoutePlan | Promise<LocalClientRoutePlan>;
    verifyInput(
      reference: LocalClientRoutePlanReference,
      input: unknown,
    ): LocalClientAdapterInput | Promise<LocalClientAdapterInput>;
  };
  readonly orchestrator: {
    execute(request: LocalClientExecutionRequest): Promise<LocalClientExecutionResult>;
  };
}

export interface LocalClientExecutionIdempotencyOptions {
  readonly executionRequested?: boolean;
  readonly now?: () => number;
}

export type LocalClientIdempotentExecutionCompleted = Readonly<{
  accepted: true;
  status: "completed" | "replayed";
  statusCode: 200;
  idempotencyStatus: "created" | "replayed";
  replayed: boolean;
  replayable: boolean;
  operationInvoked: boolean;
  retryAllowed: false;
  result: LocalClientExecutionCompletedResult;
}>;

export type LocalClientIdempotentExecutionUnknown = Readonly<{
  accepted: false;
  status: "unknown-reconcile-required";
  statusCode: 409 | 503;
  code: string;
  message: string;
  idempotencyStatus: string;
  replayed: boolean;
  replayable: false;
  operationInvoked: boolean;
  retryAllowed: false;
  result: LocalClientExecutionResult | null;
}>;

export type LocalClientIdempotentExecutionRejected = Readonly<{
  accepted: false;
  status: "rejected";
  statusCode: number;
  code: string;
  message: string;
  replayed: false;
  replayable: false;
  retryable: boolean;
  retryAfterSeconds?: number;
}>;

export type LocalClientIdempotentExecutionOutcome =
  | LocalClientIdempotentExecutionCompleted
  | LocalClientIdempotentExecutionUnknown
  | LocalClientIdempotentExecutionRejected;

type NormalizedRequest = Readonly<{
  idempotencyKey: string;
  tenantId: string;
  subjectId: string;
  planId: string;
  input: unknown;
  inputSha256: string;
  signal?: AbortSignal;
}>;

type PersistedExecutionEnvelope = Readonly<{
  schema: "local-client-idempotent-execution-v2";
  identityFingerprint: string;
  planId: string;
  inputSha256: string;
  actionFingerprint: string;
  intentFingerprint: string;
  result: LocalClientExecutionResult;
}>;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const EXECUTION_ID_PATTERN = /^lc-exec-[a-f0-9]{64}$/u;
const RECEIPT_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{7,127}$/u;
const RESERVATION_PATTERN = /^[a-f0-9]{16,64}$/u;
const FEEDBACK_EVENT_ID_PATTERN = /^lcfb-[a-f0-9]{64}$/u;
const SAFE_ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_:-]{0,127}$/u;
const MAX_IDEMPOTENCY_KEY_LENGTH = 255;
const MAX_IDENTITY_LENGTH = 128;

export function createLocalClientExecutionIdempotencyCoordinator(
  dependencies: LocalClientExecutionIdempotencyDependencies,
  options: LocalClientExecutionIdempotencyOptions = {},
) {
  assertDependencies(dependencies);
  assertOptions(options);
  const executionRequested = options.executionRequested ?? false;
  const now = options.now ?? Date.now;
  let health = readHealthSnapshot(dependencies.idempotencyCoordinator, executionRequested, now, null);

  return Object.freeze({
    boundaries: LOCAL_CLIENT_EXECUTION_IDEMPOTENCY_BOUNDARIES,

    getHealth(): LocalClientExecutionIdempotencyHealth {
      return health;
    },

    async checkHealth(): Promise<LocalClientExecutionIdempotencyHealth> {
      health = await refreshHealth(dependencies.idempotencyCoordinator, executionRequested, now, health);
      return health;
    },

    async execute(rawRequest: LocalClientHttpExecutionRequest): Promise<LocalClientIdempotentExecutionOutcome> {
      let request: NormalizedRequest;
      try {
        request = normalizeRequest(rawRequest);
      } catch (error) {
        return translateRequestError(error);
      }

      if (!executionRequested) {
        return rejected(
          503,
          "LOCAL_CLIENT_EXECUTION_DISABLED",
          "Governed local-client execution is not enabled.",
          false,
        );
      }

      health = await refreshHealth(dependencies.idempotencyCoordinator, executionRequested, now, health);
      if (!health.available) {
        return rejected(
          503,
          "LOCAL_CLIENT_IDEMPOTENCY_STORE_UNAVAILABLE",
          "The durable local-client idempotency store is unavailable.",
          true,
          1,
        );
      }
      if (!health.durable || health.storeMode === "memory") {
        return rejected(
          503,
          "LOCAL_CLIENT_IDEMPOTENCY_STORE_NOT_DURABLE",
          "Governed local-client execution requires a durable idempotency store.",
          false,
        );
      }

      const identityFingerprint = digestCanonical({
        schema: "local-client-http-identity-v1",
        tenantId: request.tenantId,
        subjectId: request.subjectId,
      });
      const planReferenceFingerprint = digestCanonical({
        schema: "local-client-plan-reference-v1",
        identityFingerprint,
        planId: request.planId,
      });
      const idempotencyPayload = Object.freeze({
        schema: "local-client-idempotency-fingerprint-v1",
        identityFingerprint,
        planReferenceFingerprint,
        planContentAddress: request.planId,
        canonicalInputSha256: request.inputSha256,
        actionBinding: digestText(`local-client-action-bound-by-plan-v1\0${request.planId}`),
      });
      const internalRequest = Object.freeze({
        headers: Object.freeze({
          "idempotency-key": request.idempotencyKey,
          authorization: `LocalClient-Identity ${identityFingerprint}`,
        }),
        socket: Object.freeze({ remoteAddress: "127.0.0.1" }),
      });

      let operationInvoked = false;
      let operationFailed = false;
      let operationError: unknown;
      let operationEnvelope: PersistedExecutionEnvelope | null = null;
      let outcome: IdempotencyOutcome<PersistedExecutionEnvelope>;

      try {
        // Exactly one call is made. This wrapper never retries the coordinator.
        outcome = await dependencies.idempotencyCoordinator.execute({
          request: internalRequest,
          route: LOCAL_CLIENT_EXECUTION_IDEMPOTENCY_ROUTE,
          payload: idempotencyPayload,
          operation: async () => {
            operationInvoked = true;
            try {
              const reference = Object.freeze({
                tenantId: request.tenantId,
                subjectId: request.subjectId,
                planId: request.planId,
              });
              const plan = validateTrustedPlan(
                await dependencies.routePlanStore.get(reference),
                request,
              );
              const verifiedInput = await dependencies.routePlanStore.verifyInput(reference, request.input);
              if (hashLocalClientRoutePlanInput(verifiedInput) !== request.inputSha256) {
                throw executionError(
                  "LOCAL_CLIENT_IDEMPOTENCY_INPUT_MISMATCH",
                  "The canonical execution input did not match the trusted route plan.",
                  409,
                );
              }
              const actionFingerprint = createActionFingerprint(plan);
              const result = projectExecutionResult(await dependencies.orchestrator.execute({
                tenantId: request.tenantId,
                subjectId: request.subjectId,
                planId: request.planId,
                input: verifiedInput,
                effectKey: Object.freeze({
                  effectKeyHash: digestCanonical({
                    schema: "local-client-subject-effect-key-v1",
                    identityFingerprint,
                    keyFingerprint: digestText(request.idempotencyKey),
                  }),
                }),
                ...(request.signal === undefined ? {} : { signal: request.signal }),
              }), request.planId);
              const intentFingerprint = digestCanonical({
                schema: "local-client-trusted-intent-v1",
                identityFingerprint,
                planId: request.planId,
                inputSha256: request.inputSha256,
                actionFingerprint,
              });
              operationEnvelope = Object.freeze({
                schema: "local-client-idempotent-execution-v2",
                identityFingerprint,
                planId: request.planId,
                inputSha256: request.inputSha256,
                actionFingerprint,
                intentFingerprint,
                result,
              });
              return operationEnvelope;
            } catch (error) {
              operationFailed = true;
              operationError = error;
              throw error;
            }
          },
        });
      } catch (error) {
        if (operationFailed && error === operationError) {
          if (isExplicitUnknownOutcomeError(error)) {
            return unknownOutcome({
              statusCode: 409,
              code: safeExecutionErrorCode(error),
              message: "Execution may have crossed the external-effect boundary. Reconcile before any retry.",
              idempotencyStatus: "operation-error",
              replayed: false,
              operationInvoked: true,
              result: null,
            });
          }
          return translateOperationError(error);
        }
        if (operationInvoked || operationEnvelope !== null) {
          health = unavailableHealth(health, now);
          return unknownOutcome({
            statusCode: 503,
            code: "LOCAL_CLIENT_IDEMPOTENCY_COMPLETION_UNKNOWN",
            message: "Execution may have progressed, but its durable idempotency outcome was not confirmed. Reconcile before any retry.",
            idempotencyStatus: "coordinator-error",
            replayed: false,
            operationInvoked,
            result: readEnvelopeResult(operationEnvelope),
          });
        }
        health = unavailableHealth(health, now);
        return rejected(
          503,
          "LOCAL_CLIENT_IDEMPOTENCY_STORE_UNAVAILABLE",
          "The durable local-client idempotency store is unavailable.",
          true,
          1,
        );
      }

      if (!outcome.accepted) {
        if (outcome.code === "IDEMPOTENCY_STORE_UNAVAILABLE") {
          health = unavailableHealth(health, now);
        }
        return translateCoordinatorRejection(outcome);
      }

      let envelope: PersistedExecutionEnvelope;
      try {
        envelope = validateEnvelope(
          outcome.value,
          identityFingerprint,
          request.planId,
          request.inputSha256,
        );
      } catch {
        health = unavailableHealth(health, now);
        return unknownOutcome({
          statusCode: 503,
          code: "LOCAL_CLIENT_IDEMPOTENCY_RESULT_INVALID",
          message: "The stored execution result failed integrity validation. Reconcile before any retry.",
          idempotencyStatus: outcome.status,
          replayed: outcome.replayed,
          operationInvoked,
          result: null,
        });
      }

      if (outcome.status === "created-unconfirmed") {
        health = unavailableHealth(health, now);
        return unknownOutcome({
          statusCode: 503,
          code: "LOCAL_CLIENT_IDEMPOTENCY_COMPLETION_UNCONFIRMED",
          message: "Execution completed, but its durable idempotency result was not confirmed. Reconcile before any retry.",
          idempotencyStatus: outcome.status,
          replayed: false,
          operationInvoked,
          result: envelope.result,
        });
      }
      if (outcome.status === "bypassed") {
        return unknownOutcome({
          statusCode: 503,
          code: "LOCAL_CLIENT_IDEMPOTENCY_BYPASS_FORBIDDEN",
          message: "The required durable idempotency boundary was bypassed. Reconcile before any retry.",
          idempotencyStatus: outcome.status,
          replayed: false,
          operationInvoked,
          result: envelope.result,
        });
      }
      if (!outcome.replayable) {
        return unknownOutcome({
          statusCode: 409,
          code: "IDEMPOTENCY_RESULT_NOT_REPLAYABLE",
          message: "Execution completed without a replayable durable result. Reconcile before any retry.",
          idempotencyStatus: outcome.status,
          replayed: outcome.replayed,
          operationInvoked,
          result: envelope.result,
        });
      }
      if (envelope.result.status === "unknown-reconcile-required") {
        return unknownOutcome({
          statusCode: 409,
          code: envelope.result.errorCode,
          message: "The external-effect outcome is unknown and requires reconciliation before any retry.",
          idempotencyStatus: outcome.status,
          replayed: outcome.replayed,
          operationInvoked,
          result: envelope.result,
        });
      }

      return Object.freeze({
        accepted: true,
        status: outcome.replayed ? "replayed" : "completed",
        statusCode: 200,
        idempotencyStatus: outcome.replayed ? "replayed" : "created",
        replayed: outcome.replayed,
        replayable: outcome.replayable,
        operationInvoked,
        retryAllowed: false,
        result: envelope.result,
      });
    },
  });
}

function normalizeRequest(raw: LocalClientHttpExecutionRequest): NormalizedRequest {
  assertExactRequest(raw);
  const idempotencyKey = normalizeIdempotencyKey(raw.idempotencyKey);
  const tenantId = normalizeIdentity(raw.tenantId);
  const subjectId = normalizeIdentity(raw.subjectId);
  const planId = requiredSha256(raw.planId);
  if (raw.signal !== undefined && !isAbortSignal(raw.signal)) throw requestError();
  return Object.freeze({
    idempotencyKey,
    tenantId,
    subjectId,
    planId,
    input: raw.input,
    inputSha256: hashLocalClientRoutePlanInput(raw.input),
    ...(raw.signal === undefined ? {} : { signal: raw.signal }),
  });
}

function assertExactRequest(value: unknown): asserts value is Record<string, unknown> {
  const allowedKeys = ["idempotencyKey", "tenantId", "subjectId", "planId", "input", "signal"];
  const requiredKeys = ["idempotencyKey", "tenantId", "subjectId", "planId", "input"];
  if (!isPlainRecord(value)) throw requestError();
  const actual = Reflect.ownKeys(value);
  if (
    actual.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
    || requiredKeys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw requestError();
  }
}

function readEnvelopeResult(
  envelope: PersistedExecutionEnvelope | null,
): LocalClientExecutionResult | null {
  return envelope === null ? null : envelope.result;
}

function validateTrustedPlan(plan: LocalClientRoutePlan, request: NormalizedRequest): LocalClientRoutePlan {
  if (
    !isPlainRecord(plan)
    || plan.planId !== request.planId
    || plan.tenantId !== request.tenantId
    || plan.subjectId !== request.subjectId
    || plan.inputSha256 !== request.inputSha256
    || !IDENTIFIER_PATTERN.test(String(plan.clientId ?? ""))
    || !IDENTIFIER_PATTERN.test(String(plan.adapterId ?? ""))
    || !IDENTIFIER_PATTERN.test(String(plan.adapterType ?? ""))
    || !IDENTIFIER_PATTERN.test(String(plan.capabilityId ?? ""))
    || !IDENTIFIER_PATTERN.test(String(plan.actionId ?? ""))
  ) {
    throw executionError(
      "LOCAL_CLIENT_IDEMPOTENCY_PLAN_MISMATCH",
      "The trusted route plan did not match the authenticated execution intent.",
      409,
    );
  }
  return plan;
}

function createActionFingerprint(plan: LocalClientRoutePlan): string {
  return digestCanonical({
    schema: "local-client-trusted-action-v1",
    planId: plan.planId,
    clientId: plan.clientId,
    clientRevision: plan.clientRevision,
    adapterId: plan.adapterId,
    adapterType: plan.adapterType,
    adapterVersion: plan.adapterVersion,
    capabilityId: plan.capabilityId,
    actionId: plan.actionId,
    policyVersion: plan.policyVersion,
  });
}

function validateEnvelope(
  raw: unknown,
  identityFingerprint: string,
  planId: string,
  inputSha256: string,
): PersistedExecutionEnvelope {
  assertExactObject(raw, [
    "schema",
    "identityFingerprint",
    "planId",
    "inputSha256",
    "actionFingerprint",
    "intentFingerprint",
    "result",
  ]);
  if (
    raw.schema !== "local-client-idempotent-execution-v2"
    || raw.identityFingerprint !== identityFingerprint
    || raw.planId !== planId
    || raw.inputSha256 !== inputSha256
    || !SHA256_PATTERN.test(String(raw.actionFingerprint ?? ""))
  ) {
    throw integrityError();
  }
  const expectedIntent = digestCanonical({
    schema: "local-client-trusted-intent-v1",
    identityFingerprint,
    planId,
    inputSha256,
    actionFingerprint: raw.actionFingerprint,
  });
  if (raw.intentFingerprint !== expectedIntent) throw integrityError();
  return Object.freeze({
    schema: "local-client-idempotent-execution-v2",
    identityFingerprint,
    planId,
    inputSha256,
    actionFingerprint: raw.actionFingerprint as string,
    intentFingerprint: expectedIntent,
    result: projectExecutionResult(raw.result, planId),
  });
}

function projectExecutionResult(raw: unknown, planId: string): LocalClientExecutionResult {
  if (!isPlainRecord(raw)) throw integrityError();
  if (raw.status === "completed") return projectCompletedResult(raw, planId);
  if (raw.status === "unknown-reconcile-required") return projectUnknownResult(raw, planId);
  throw integrityError();
}

function projectCompletedResult(
  raw: Record<string, unknown>,
  planId: string,
): LocalClientExecutionCompletedResult {
  assertExactObject(raw, [
    "status",
    "executionId",
    "planId",
    "planFingerprint",
    "reservationFingerprint",
    "externalEffectCommitted",
    "retryAllowed",
    "receipt",
    "feedback",
  ]);
  if (
    raw.status !== "completed"
    || !EXECUTION_ID_PATTERN.test(String(raw.executionId ?? ""))
    || raw.planId !== planId
    || raw.planFingerprint !== planId
    || !RESERVATION_PATTERN.test(String(raw.reservationFingerprint ?? ""))
    || raw.externalEffectCommitted !== true
    || raw.retryAllowed !== false
  ) {
    throw integrityError();
  }
  return Object.freeze({
    status: "completed",
    executionId: raw.executionId as string,
    planId,
    planFingerprint: planId,
    reservationFingerprint: raw.reservationFingerprint as string,
    externalEffectCommitted: true,
    retryAllowed: false,
    receipt: projectReceipt(raw.receipt, planId, raw.executionId as string),
    feedback: projectAutomaticFeedback(raw.feedback),
  });
}

function projectAutomaticFeedback(raw: unknown): LocalClientAutomaticFeedbackResult {
  assertExactObject(raw, [
    "source",
    "eventId",
    "attempted",
    "persisted",
    "exactlyOnce",
    "replayed",
    "deliveryStatus",
    "errorCode",
  ]);
  if (
    raw.source !== "verified-governed-receipt"
    || !FEEDBACK_EVENT_ID_PATTERN.test(String(raw.eventId ?? ""))
    || typeof raw.attempted !== "boolean"
    || typeof raw.persisted !== "boolean"
    || typeof raw.exactlyOnce !== "boolean"
    || typeof raw.replayed !== "boolean"
  ) {
    throw integrityError();
  }
  const persisted = raw.deliveryStatus === "persisted"
    && raw.attempted === true
    && raw.persisted === true
    && raw.exactlyOnce === true
    && raw.errorCode === null;
  const notConfigured = raw.deliveryStatus === "not-configured"
    && raw.attempted === false
    && raw.persisted === false
    && raw.exactlyOnce === false
    && raw.replayed === false
    && raw.errorCode === "LOCAL_CLIENT_AUTOMATIC_FEEDBACK_NOT_CONFIGURED";
  const failed = raw.deliveryStatus === "failed"
    && raw.attempted === true
    && raw.persisted === false
    && raw.exactlyOnce === false
    && raw.replayed === false
    && raw.errorCode === "LOCAL_CLIENT_AUTOMATIC_FEEDBACK_FAILED";
  const queued = raw.deliveryStatus === "queued"
    && raw.attempted === true
    && raw.persisted === true
    && raw.exactlyOnce === false
    && typeof raw.replayed === "boolean"
    && raw.errorCode === null;
  if (!persisted && !queued && !notConfigured && !failed) throw integrityError();
  return Object.freeze({
    source: "verified-governed-receipt",
    eventId: raw.eventId as string,
    attempted: raw.attempted,
    persisted: raw.persisted,
    exactlyOnce: raw.exactlyOnce,
    replayed: raw.replayed,
    deliveryStatus: raw.deliveryStatus,
    errorCode: raw.errorCode,
  }) as LocalClientAutomaticFeedbackResult;
}

function projectUnknownResult(
  raw: Record<string, unknown>,
  planId: string,
): LocalClientExecutionUnknownResult {
  assertExactObject(raw, [
    "status",
    "executionId",
    "planId",
    "planFingerprint",
    "reservationFingerprint",
    "externalEffectCommitted",
    "retryAllowed",
    "receipt",
    "errorCode",
    "lifecyclePersisted",
  ]);
  if (
    raw.status !== "unknown-reconcile-required"
    || !EXECUTION_ID_PATTERN.test(String(raw.executionId ?? ""))
    || raw.planId !== planId
    || raw.planFingerprint !== planId
    || (raw.reservationFingerprint !== null && !RESERVATION_PATTERN.test(String(raw.reservationFingerprint ?? "")))
    || raw.externalEffectCommitted !== true
    || raw.retryAllowed !== false
    || raw.receipt !== null
    || !SAFE_ERROR_CODE_PATTERN.test(String(raw.errorCode ?? ""))
    || typeof raw.lifecyclePersisted !== "boolean"
  ) {
    throw integrityError();
  }
  return Object.freeze({
    status: "unknown-reconcile-required",
    executionId: raw.executionId as string,
    planId,
    planFingerprint: planId,
    reservationFingerprint: raw.reservationFingerprint as string | null,
    externalEffectCommitted: true,
    retryAllowed: false,
    receipt: null,
    errorCode: raw.errorCode as string,
    lifecyclePersisted: raw.lifecyclePersisted,
  });
}

function projectReceipt(
  raw: unknown,
  planId: string,
  executionId: string,
): LocalClientAdapterReceipt {
  assertExactObject(raw, [
    "receiptVersion",
    "receiptId",
    "executionId",
    "adapterId",
    "adapterType",
    "adapterVersion",
    "clientId",
    "capabilityId",
    "actionId",
    "planFingerprint",
    "executionMode",
    "externalEffectPerformed",
    "status",
  ]);
  if (
    raw.receiptVersion !== LOCAL_CLIENT_ADAPTER_RECEIPT_VERSION
    || !RECEIPT_ID_PATTERN.test(String(raw.receiptId ?? ""))
    || raw.executionId !== executionId
    || !IDENTIFIER_PATTERN.test(String(raw.adapterId ?? ""))
    || !IDENTIFIER_PATTERN.test(String(raw.adapterType ?? ""))
    || typeof raw.adapterVersion !== "string"
    || raw.adapterVersion.length < 1
    || raw.adapterVersion.length > 64
    || !IDENTIFIER_PATTERN.test(String(raw.clientId ?? ""))
    || !IDENTIFIER_PATTERN.test(String(raw.capabilityId ?? ""))
    || !IDENTIFIER_PATTERN.test(String(raw.actionId ?? ""))
    || raw.planFingerprint !== planId
    || raw.executionMode !== "governed"
    || raw.externalEffectPerformed !== true
    || raw.status !== "completed"
  ) {
    throw integrityError();
  }
  return Object.freeze({
    receiptVersion: LOCAL_CLIENT_ADAPTER_RECEIPT_VERSION,
    receiptId: raw.receiptId as string,
    executionId,
    adapterId: raw.adapterId as string,
    adapterType: raw.adapterType as string,
    adapterVersion: raw.adapterVersion,
    clientId: raw.clientId as string,
    capabilityId: raw.capabilityId as string,
    actionId: raw.actionId as string,
    planFingerprint: planId,
    executionMode: "governed",
    externalEffectPerformed: true,
    status: "completed",
  });
}

async function refreshHealth(
  coordinator: LocalClientExecutionIdempotencyDependencies["idempotencyCoordinator"],
  executionRequested: boolean,
  now: () => number,
  previous: LocalClientExecutionIdempotencyHealth,
): Promise<LocalClientExecutionIdempotencyHealth> {
  try {
    const stats = coordinator.checkHealth
      ? await coordinator.checkHealth()
      : coordinator.getStats();
    return healthFromStats(stats, executionRequested, readNow(now));
  } catch {
    return unavailableHealth(previous, now);
  }
}

function readHealthSnapshot(
  coordinator: LocalClientExecutionIdempotencyDependencies["idempotencyCoordinator"],
  executionRequested: boolean,
  now: () => number,
  previous: LocalClientExecutionIdempotencyHealth | null,
): LocalClientExecutionIdempotencyHealth {
  try {
    return healthFromStats(coordinator.getStats(), executionRequested, readNow(now));
  } catch {
    return previous
      ? unavailableHealth(previous, now)
      : Object.freeze({
        enabled: executionRequested,
        available: false,
        durable: false,
        distributed: false,
        storeMode: "unknown",
        storageMode: "unknown",
        checkedAt: safeNow(now),
        boundaries: LOCAL_CLIENT_EXECUTION_IDEMPOTENCY_BOUNDARIES,
      });
  }
}

function healthFromStats(
  stats: IdempotencyStats,
  executionRequested: boolean,
  checkedAt: number,
): LocalClientExecutionIdempotencyHealth {
  const storeMode = normalizeStoreMode(stats?.storeMode);
  return Object.freeze({
    enabled: executionRequested,
    available: stats?.available !== false && storeMode !== "unknown",
    durable: storeMode === "sqlite" || storeMode === "postgres",
    distributed: storeMode === "postgres" && stats?.distributed === true,
    storeMode,
    storageMode: storeMode,
    checkedAt,
    boundaries: LOCAL_CLIENT_EXECUTION_IDEMPOTENCY_BOUNDARIES,
  });
}

function unavailableHealth(
  previous: LocalClientExecutionIdempotencyHealth,
  now: () => number,
): LocalClientExecutionIdempotencyHealth {
  return Object.freeze({
    ...previous,
    available: false,
    checkedAt: safeNow(now),
  });
}

function translateCoordinatorRejection(
  outcome: IdempotencyRejectedOutcome,
): LocalClientIdempotentExecutionRejected | LocalClientIdempotentExecutionUnknown {
  if (new Set([
    "IDEMPOTENCY_PREVIOUS_ATTEMPT_UNKNOWN",
    "IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED",
    "IDEMPOTENCY_RESULT_NOT_REPLAYABLE",
    "IDEMPOTENCY_STORE_CORRUPT",
    "IDEMPOTENCY_STORE_UNAVAILABLE",
  ]).has(outcome.code)) {
    return unknownOutcome({
      statusCode: new Set(["IDEMPOTENCY_STORE_CORRUPT", "IDEMPOTENCY_STORE_UNAVAILABLE"]).has(outcome.code)
        ? 503
        : 409,
      code: outcome.code,
      message: "A prior execution outcome cannot be safely replayed. Reconcile before any retry.",
      idempotencyStatus: "rejected",
      replayed: false,
      operationInvoked: false,
      result: null,
    });
  }
  const safeMessages: Record<string, string> = {
    IDEMPOTENCY_KEY_INVALID: "Idempotency-Key is invalid.",
    IDEMPOTENCY_KEY_REUSED: "Idempotency-Key was already bound to a different execution intent.",
    IDEMPOTENCY_CAPACITY_REACHED: "The durable idempotency store is at capacity.",
    IDEMPOTENCY_REQUEST_IN_PROGRESS: "The execution associated with this Idempotency-Key is still in progress.",
    IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED: "The prior execution attempt failed and this Idempotency-Key cannot be reused.",
    IDEMPOTENCY_STORE_UNAVAILABLE: "The durable local-client idempotency store is unavailable.",
  };
  return rejected(
    boundedStatusCode(outcome.statusCode, 503),
    safeCoordinatorCode(outcome.code),
    safeMessages[outcome.code] ?? "The durable idempotency boundary rejected the request.",
    outcome.retryable === true,
    outcome.retryAfterSeconds,
  );
}

function translateOperationError(error: unknown): LocalClientIdempotentExecutionRejected {
  const rawStatusCode = readOwnDataProperty(error, "statusCode");
  return rejected(
    boundedStatusCode(rawStatusCode, 500),
    safeExecutionErrorCode(error),
    "The governed local-client execution was rejected before a confirmed external effect.",
    false,
  );
}

function isExplicitUnknownOutcomeError(error: unknown): boolean {
  return readOwnDataProperty(error, "outcomeUnknown") === true
    || readOwnDataProperty(error, "externalEffectCommitted") === true
    || safeExecutionErrorCode(error).includes("OUTCOME_UNKNOWN");
}

function safeExecutionErrorCode(error: unknown): string {
  const rawCode = readOwnDataProperty(error, "code");
  return typeof rawCode === "string" && SAFE_ERROR_CODE_PATTERN.test(rawCode)
    ? rawCode
    : "LOCAL_CLIENT_EXECUTION_REJECTED";
}

function translateRequestError(error: unknown): LocalClientIdempotentExecutionRejected {
  const rawCode = readOwnDataProperty(error, "code");
  const rawStatusCode = readOwnDataProperty(error, "statusCode");
  const code = typeof rawCode === "string" && SAFE_ERROR_CODE_PATTERN.test(rawCode)
    ? rawCode
    : "LOCAL_CLIENT_EXECUTION_REQUEST_INVALID";
  const statusCode = boundedStatusCode(rawStatusCode, 400);
  const message = code === "LOCAL_CLIENT_IDEMPOTENCY_KEY_REQUIRED"
    ? "Idempotency-Key is required for local-client execution."
    : code === "LOCAL_CLIENT_IDEMPOTENCY_KEY_INVALID"
      ? "Idempotency-Key must contain 1 to 255 visible ASCII characters without spaces."
      : "The local-client execution request is invalid.";
  return rejected(statusCode, code, message, false);
}

function unknownOutcome(input: Omit<LocalClientIdempotentExecutionUnknown, "accepted" | "status" | "replayable" | "retryAllowed">): LocalClientIdempotentExecutionUnknown {
  return Object.freeze({
    accepted: false,
    status: "unknown-reconcile-required",
    replayable: false,
    retryAllowed: false,
    ...input,
  });
}

function rejected(
  statusCode: number,
  code: string,
  message: string,
  retryable: boolean,
  retryAfterSeconds?: number,
): LocalClientIdempotentExecutionRejected {
  return Object.freeze({
    accepted: false,
    status: "rejected",
    statusCode,
    code,
    message,
    replayed: false,
    replayable: false,
    retryable,
    ...(Number.isSafeInteger(retryAfterSeconds) && Number(retryAfterSeconds) > 0
      ? { retryAfterSeconds }
      : {}),
  });
}

function normalizeIdempotencyKey(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    throw executionError(
      "LOCAL_CLIENT_IDEMPOTENCY_KEY_REQUIRED",
      "Idempotency-Key is required.",
      400,
    );
  }
  if (
    typeof value !== "string"
    || value.length > MAX_IDEMPOTENCY_KEY_LENGTH
    || !/^[\x21-\x7e]+$/u.test(value)
  ) {
    throw executionError(
      "LOCAL_CLIENT_IDEMPOTENCY_KEY_INVALID",
      "Idempotency-Key is invalid.",
      400,
    );
  }
  return value;
}

function normalizeIdentity(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > MAX_IDENTITY_LENGTH
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw requestError();
  }
  return value;
}

function requiredSha256(value: unknown): string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) throw requestError();
  return value;
}

function normalizeStoreMode(value: unknown): LocalClientExecutionIdempotencyHealth["storeMode"] {
  return value === "memory" || value === "sqlite" || value === "postgres" ? value : "unknown";
}

function safeCoordinatorCode(value: unknown): string {
  return typeof value === "string" && /^IDEMPOTENCY_[A-Z0-9_]{1,96}$/u.test(value)
    ? value
    : "LOCAL_CLIENT_IDEMPOTENCY_REJECTED";
}

function boundedStatusCode(value: unknown, fallback: number): number {
  return Number.isSafeInteger(value) && Number(value) >= 400 && Number(value) <= 599
    ? Number(value)
    : fallback;
}

function digestCanonical(value: unknown): string {
  return digestText(stableStringify(value));
}

function digestText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function readNow(now: () => number): number {
  const value = now();
  if (!Number.isSafeInteger(value) || value < 0) throw requestError();
  return value;
}

function safeNow(now: () => number): number | null {
  try {
    return readNow(now);
  } catch {
    return null;
  }
}

function isAbortSignal(value: unknown): value is AbortSignal {
  return Boolean(
    value
    && typeof value === "object"
    && typeof (value as AbortSignal).aborted === "boolean"
    && typeof (value as AbortSignal).addEventListener === "function"
    && typeof (value as AbortSignal).removeEventListener === "function",
  );
}

function assertDependencies(dependencies: LocalClientExecutionIdempotencyDependencies): void {
  if (
    !isPlainRecord(dependencies)
    || typeof dependencies.idempotencyCoordinator?.execute !== "function"
    || typeof dependencies.idempotencyCoordinator?.getStats !== "function"
    || typeof dependencies.routePlanStore?.get !== "function"
    || typeof dependencies.routePlanStore?.verifyInput !== "function"
    || typeof dependencies.orchestrator?.execute !== "function"
  ) {
    throw requestError();
  }
}

function assertOptions(options: LocalClientExecutionIdempotencyOptions): void {
  if (!isPlainRecord(options)) throw requestError();
  const allowed = new Set(["executionRequested", "now"]);
  if (
    Reflect.ownKeys(options).some((key) => typeof key !== "string" || !allowed.has(key))
    || (options.executionRequested !== undefined && typeof options.executionRequested !== "boolean")
    || (options.now !== undefined && typeof options.now !== "function")
  ) {
    throw requestError();
  }
}

function assertExactObject(
  value: unknown,
  allowedKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value)) throw integrityError();
  const actual = Reflect.ownKeys(value);
  if (
    actual.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
    || allowedKeys.some((key) => !optionalKeys.includes(key) && !Object.hasOwn(value, key))
    || actual.some((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return !descriptor || !("value" in descriptor);
    })
  ) {
    throw integrityError();
  }
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

function readOwnDataProperty(value: unknown, key: string): unknown {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function requestError() {
  return executionError(
    "LOCAL_CLIENT_EXECUTION_REQUEST_INVALID",
    "The local-client execution request or coordinator configuration is invalid.",
    400,
  );
}

function integrityError() {
  return executionError(
    "LOCAL_CLIENT_IDEMPOTENCY_INTEGRITY_INVALID",
    "The local-client idempotency record failed integrity validation.",
    503,
  );
}

function executionError(code: string, message: string, statusCode: number) {
  return Object.assign(new Error(message), {
    code,
    statusCode,
    retryable: false,
  });
}
