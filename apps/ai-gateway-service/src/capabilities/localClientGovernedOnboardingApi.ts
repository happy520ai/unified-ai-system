import { createHash, timingSafeEqual } from "node:crypto";

import {
  LOCAL_CLIENT_ONBOARDING_PROFILE_IDS,
  type LocalClientOnboardingAction,
  type LocalClientOnboardingInspection,
  type LocalClientOnboardingPlan,
  type LocalClientOnboardingProfileId,
  type LocalClientOnboardingProfileSummary,
  type LocalClientOnboardingReceipt,
  type LocalClientOnboardingRecoveryReceipt,
  type LocalClientOnboardingRegistry,
  type LocalClientOnboardingRollbackReceipt,
  type LocalClientOnboardingVerification,
} from "./localClientOnboardingRegistry.ts";
import type {
  IdempotencyCoordinator,
  IdempotencyOutcome,
} from "../http/idempotencyCoordinator.ts";
import type {
  LocalClientOnboardingAppliedReceiptInput,
  LocalClientOnboardingReceiptReference,
  LocalClientOnboardingRollbackAuthorization,
  LocalClientOnboardingRollbackClaimReference,
  LocalClientOnboardingRollbackClaimed,
  LocalClientOnboardingRolledBackResult,
  LocalClientOnboardingRollbackReleaseResult,
} from "./localClientSqliteOnboardingReceiptAuthorityStore.ts";

export const LOCAL_CLIENT_GOVERNED_ONBOARDING_API_VERSION = "local-client-governed-onboarding-api-v1" as const;
export const LOCAL_CLIENT_GOVERNED_ONBOARDING_PLAN_VERSION = "local-client-governed-onboarding-plan-v1" as const;
export const LOCAL_CLIENT_GOVERNED_ONBOARDING_ROUTE = "/local-clients/onboarding" as const;

export type LocalClientGovernedOnboardingAction = "enable" | "disable" | "rollback" | "recover";

export interface LocalClientOnboardingIdentity {
  readonly tenantId: string;
  readonly subjectId: string;
}

export interface LocalClientGovernedOnboardingRequestPort {
  getHeader(name: string): unknown;
  readonly signal?: AbortSignal;
}

export interface LocalClientGovernedOnboardingDependencies {
  readonly registry: Pick<LocalClientOnboardingRegistry,
    | "listProfiles"
    | "inspect"
    | "plan"
    | "apply"
    | "rollback"
    | "recover"
    | "verifyInstalled"
  >;
  readonly approvalGate: {
    approve(input: Record<string, unknown>): unknown | Promise<unknown>;
    consume(input: Record<string, unknown>): unknown | Promise<unknown>;
  };
  readonly idempotencyCoordinator: Pick<IdempotencyCoordinator, "execute" | "getStats" | "checkHealth">;
  readonly externalEffectGate: {
    readonly status: Readonly<{
      mode?: unknown;
      enabled?: unknown;
      durable?: unknown;
      distributed?: unknown;
    }>;
    reserve(input: Record<string, unknown>): Promise<{
      readonly reservationFingerprint?: unknown;
      commit(): Promise<void>;
    }>;
  };
  readonly receiptAuthorityStore: LocalClientOnboardingReceiptAuthorityStorePort;
}

export interface LocalClientOnboardingReceiptAuthorityStorePort {
  readonly status: Readonly<{
    mode?: unknown;
    available?: unknown;
    durable?: unknown;
    distributed?: unknown;
    oneTimeRollbackAuthorization?: unknown;
  }>;
  recordApplied(
    input: LocalClientOnboardingAppliedReceiptInput,
  ): Promise<unknown>;
  authorizeRollback(
    input: LocalClientOnboardingReceiptReference,
  ): Promise<LocalClientOnboardingRollbackAuthorization>;
  markRolledBack(
    input: LocalClientOnboardingRollbackClaimReference,
  ): Promise<LocalClientOnboardingRolledBackResult>;
  releaseRollbackClaim(
    input: LocalClientOnboardingRollbackClaimReference,
  ): Promise<LocalClientOnboardingRollbackReleaseResult>;
}

export interface LocalClientGovernedOnboardingOptions {
  readonly now?: () => number;
  readonly maxPlans?: number;
}

export interface LocalClientGovernedOnboardingPlan {
  readonly apiVersion: typeof LOCAL_CLIENT_GOVERNED_ONBOARDING_API_VERSION;
  readonly planVersion: typeof LOCAL_CLIENT_GOVERNED_ONBOARDING_PLAN_VERSION;
  readonly planId: string;
  readonly planDigest: string;
  readonly profileId: LocalClientOnboardingProfileId;
  readonly action: LocalClientGovernedOnboardingAction;
  readonly scopes: readonly string[];
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
  readonly writesPerformed: false;
  readonly redacted: true;
}

export interface LocalClientGovernedOnboardingApproval {
  readonly apiVersion: typeof LOCAL_CLIENT_GOVERNED_ONBOARDING_API_VERSION;
  readonly operation: "approve";
  readonly status: "approved";
  readonly approvalId: string;
  readonly planId: string;
  readonly planDigest: string;
  readonly scopes: readonly string[];
  readonly approvedAt: string;
  readonly expiresAt: string;
  readonly writesPerformed: false;
  readonly redacted: true;
}

export type LocalClientGovernedOnboardingMutationResult = Readonly<{
  apiVersion: typeof LOCAL_CLIENT_GOVERNED_ONBOARDING_API_VERSION;
  operation: "apply" | "rollback" | "recover";
  profileId: LocalClientOnboardingProfileId;
  action: LocalClientGovernedOnboardingAction;
  planId: string;
  status: "completed";
  receipt: LocalClientOnboardingReceipt | LocalClientOnboardingRollbackReceipt | LocalClientOnboardingRecoveryReceipt;
  redacted: true;
}>;

export type LocalClientGovernedOnboardingMutationOutcome =
  | Readonly<{
    accepted: true;
    status: "completed" | "replayed";
    statusCode: 200;
    idempotencyStatus: "created" | "replayed";
    replayed: boolean;
    replayable: true;
    operationInvoked: boolean;
    retryAllowed: false;
    result: LocalClientGovernedOnboardingMutationResult;
  }>
  | Readonly<{
    accepted: false;
    status: "rejected";
    statusCode: number;
    code: string;
    message: string;
    replayed: false;
    replayable: false;
    operationInvoked: boolean;
    retryAllowed: boolean;
    retryAfterSeconds?: number;
    result: null;
  }>
  | Readonly<{
    accepted: false;
    status: "unknown-reconcile-required";
    statusCode: 409 | 503;
    code: "LOCAL_CLIENT_ONBOARDING_OUTCOME_UNKNOWN";
    message: string;
    replayed: boolean;
    replayable: false;
    operationInvoked: boolean;
    retryAllowed: false;
    result: null;
  }>;

export type LocalClientGovernedOnboardingErrorCode =
  | "LOCAL_CLIENT_ONBOARDING_API_CONFIGURATION_INVALID"
  | "LOCAL_CLIENT_ONBOARDING_API_REQUEST_INVALID"
  | "LOCAL_CLIENT_ONBOARDING_API_PLAN_UNKNOWN"
  | "LOCAL_CLIENT_ONBOARDING_API_PLAN_MISMATCH"
  | "LOCAL_CLIENT_ONBOARDING_API_APPROVAL_INVALID"
  | "LOCAL_CLIENT_ONBOARDING_API_IDEMPOTENCY_REQUIRED"
  | "LOCAL_CLIENT_ONBOARDING_API_IDEMPOTENCY_NOT_DURABLE"
  | "LOCAL_CLIENT_ONBOARDING_API_EXTERNAL_EFFECT_NOT_DURABLE"
  | "LOCAL_CLIENT_ONBOARDING_APPROVAL_IDEMPOTENCY_CONFLICT"
  | "LOCAL_CLIENT_ONBOARDING_APPROVAL_OUTCOME_UNKNOWN"
  | "LOCAL_CLIENT_ONBOARDING_API_DEPENDENCY_FAILED";

export class LocalClientGovernedOnboardingError extends Error {
  readonly code: LocalClientGovernedOnboardingErrorCode;
  readonly category: "configuration" | "validation" | "auth" | "conflict" | "integrity" | "dependency";
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: LocalClientGovernedOnboardingErrorCode,
    message: string,
    category: LocalClientGovernedOnboardingError["category"],
    statusCode: number,
    retryable = false,
  ) {
    super(message);
    this.name = "LocalClientGovernedOnboardingError";
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

type StoredPlan = Readonly<{
  planId: string;
  identityFingerprint: string;
  tenantId: string;
  subjectId: string;
  profileId: LocalClientOnboardingProfileId;
  action: LocalClientGovernedOnboardingAction;
  createdAtMs: number;
  expiresAtMs: number;
  registryPlan: LocalClientOnboardingPlan | null;
  applyReceipt: LocalClientOnboardingReceipt | null;
  rollbackClaim: LocalClientOnboardingRollbackClaimReference | null;
  recoveryFingerprint: string | null;
}>;

type PersistedMutationEnvelope = Readonly<{
  schema: "local-client-governed-onboarding-result-v1";
  identityFingerprint: string;
  planId: string;
  planDigest: string;
  action: LocalClientGovernedOnboardingAction;
  rollbackReceiptReference: LocalClientOnboardingReceiptReference | null;
  result: LocalClientGovernedOnboardingMutationResult;
}>;

type PersistedApprovalEnvelope = Readonly<{
  schema: "local-client-governed-onboarding-approval-v1";
  identityFingerprint: string;
  planId: string;
  planDigest: string;
  noteFingerprint: string;
  profileId: LocalClientOnboardingProfileId;
  action: LocalClientGovernedOnboardingAction;
  approval: LocalClientGovernedOnboardingApproval;
}>;

type NormalizedPort = Readonly<{
  idempotencyKey: string;
  signal?: AbortSignal;
}>;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const PUBLIC_PLAN_ID_PATTERN = /^onboarding_[a-f0-9]{64}$/u;
const APPROVAL_ID_PATTERN = /^(?:appr_|approval[-_:])[A-Za-z0-9._:-]{4,128}$/u;
const IDEMPOTENCY_KEY_PATTERN = /^[\u0021-\u007e]{1,255}$/u;
const MAX_IDENTITY_LENGTH = 128;
const MAX_PLANS_DEFAULT = 1_024;
const MAX_PLANS_HARD = 10_000;
const SYNTHETIC_PLAN_TTL_MS = 10 * 60_000;

export function createLocalClientGovernedOnboardingApi(
  dependencies: LocalClientGovernedOnboardingDependencies,
  options: LocalClientGovernedOnboardingOptions = {},
) {
  assertDependencies(dependencies);
  assertOptions(options);
  const now = options.now ?? Date.now;
  const maxPlans = boundedInteger(options.maxPlans, MAX_PLANS_DEFAULT, 1, MAX_PLANS_HARD);
  const plans = new Map<string, StoredPlan>();
  const receiptAuthorityStore = dependencies.receiptAuthorityStore;

  return Object.freeze({
    async list(rawIdentity: LocalClientOnboardingIdentity): Promise<readonly LocalClientOnboardingProfileSummary[]> {
      normalizeIdentity(rawIdentity);
      return projectProfileList(await callDependency(() => dependencies.registry.listProfiles()));
    },

    async inspect(rawRequest: LocalClientOnboardingIdentity & { profileId: LocalClientOnboardingProfileId }): Promise<LocalClientOnboardingInspection> {
      const request = normalizeProfileRequest(rawRequest);
      return projectInspection(
        await callDependency(() => dependencies.registry.inspect(request.profileId)),
        request.profileId,
      );
    },

    async verify(rawRequest: LocalClientOnboardingIdentity & { profileId: LocalClientOnboardingProfileId }): Promise<LocalClientOnboardingVerification> {
      const request = normalizeProfileRequest(rawRequest);
      return projectVerification(
        await callDependency(() => dependencies.registry.verifyInstalled(request.profileId)),
        request.profileId,
      );
    },

    async plan(rawRequest: LocalClientOnboardingIdentity & {
      profileId: LocalClientOnboardingProfileId;
      action: LocalClientGovernedOnboardingAction;
      receipt?: LocalClientOnboardingReceipt;
    }): Promise<LocalClientGovernedOnboardingPlan> {
      const request = normalizePlanRequest(rawRequest);
      purgeExpiredPlans(plans, readNow(now));
      if (plans.size >= maxPlans) throw planCapacityError();
      const identityFingerprint = identityDigest(request);
      let registryPlan: LocalClientOnboardingPlan | null = null;
      let applyReceipt: LocalClientOnboardingReceipt | null = null;
      let rollbackClaim: LocalClientOnboardingRollbackClaimReference | null = null;
      let recoveryFingerprint: string | null = null;
      let createdAtMs: number;
      let expiresAtMs: number;

      if (request.action === "enable" || request.action === "disable") {
        registryPlan = projectRegistryPlan(
          await callDependency(() => dependencies.registry.plan(request.profileId, request.action as LocalClientOnboardingAction)),
          request.profileId,
          request.action,
        );
        createdAtMs = registryPlan.createdAtMs;
        expiresAtMs = registryPlan.expiresAtMs;
      } else if (request.action === "rollback") {
        if (!request.receipt) throw requestError();
        const candidate = projectApplyReceipt(request.receipt, request.profileId);
        const reference = receiptReference(identityFingerprint, candidate);
        rollbackClaim = await authorizeRollbackReceipt(receiptAuthorityStore, reference);
        applyReceipt = candidate;
        createdAtMs = readNow(now);
        expiresAtMs = createdAtMs + SYNTHETIC_PLAN_TTL_MS;
      } else {
        if (request.receipt !== undefined) throw requestError();
        const inspection = projectInspection(
          await callDependency(() => dependencies.registry.inspect(request.profileId)),
          request.profileId,
        );
        if (
          inspection.recoveryRequired !== true
          || inspection.journalCorrupt === true
          || inspection.pendingTransactionCount !== 1
        ) {
          throw planUnknownError();
        }
        recoveryFingerprint = inspectionDigest(inspection);
        createdAtMs = readNow(now);
        expiresAtMs = createdAtMs + SYNTHETIC_PLAN_TTL_MS;
      }
      if (!Number.isSafeInteger(expiresAtMs)) throw configError();
      const provisional = Object.freeze({
        planId: "",
        identityFingerprint,
        tenantId: request.tenantId,
        subjectId: request.subjectId,
        profileId: request.profileId,
        action: request.action,
        createdAtMs,
        expiresAtMs,
        registryPlan,
        applyReceipt,
        rollbackClaim,
        recoveryFingerprint,
      });
      const planDigest = derivePlanDigest(provisional);
      const planId = `onboarding_${planDigest}`;
      const stored = Object.freeze({ ...provisional, planId });
      plans.set(planId, stored);
      return projectGovernedPlan(stored);
    },

    async approve(rawRequest: LocalClientOnboardingIdentity & {
      planId: string;
      note?: string;
    }, rawPort: LocalClientGovernedOnboardingRequestPort): Promise<LocalClientGovernedOnboardingApproval> {
      const request = normalizeApproveRequest(rawRequest);
      const port = normalizeRequestPort(rawPort);
      await assertDurableIdempotency(dependencies.idempotencyCoordinator);
      const planDigest = planDigestFromPlanId(request.planId);
      const noteFingerprint = sha256Text(request.note ?? "");
      const identityFingerprint = identityDigest(request);
      const route = `${LOCAL_CLIENT_GOVERNED_ONBOARDING_ROUTE}/approve`;
      let outcome: IdempotencyOutcome<PersistedApprovalEnvelope>;
      let approvalInvoked = false;
      try {
        outcome = await dependencies.idempotencyCoordinator.execute({
          request: Object.freeze({
            headers: Object.freeze({
              "idempotency-key": port.idempotencyKey,
              authorization: `LocalClient-Onboarding ${identityFingerprint}`,
            }),
            socket: Object.freeze({ remoteAddress: "127.0.0.1" }),
          }),
          route,
          payload: Object.freeze({
            schema: "local-client-governed-onboarding-approval-idempotency-v1",
            identityFingerprint,
            planId: request.planId,
            planDigest,
            noteFingerprint,
          }),
          operation: async () => {
            const stored = requirePlan(plans, request, readNow(now));
            if (!safeSha256Equal(derivePlanDigest(stored), planDigest)) throw planMismatchError();
            const scopes = buildScopes(stored);
            approvalInvoked = true;
            const rawApproval = await dependencies.approvalGate.approve({
              planId: stored.planId,
              tenantId: stored.tenantId,
              userId: stored.subjectId,
              planDigest,
              approvedScopes: scopes,
              ...(request.note === undefined ? {} : { note: request.note }),
            });
            return Object.freeze({
              schema: "local-client-governed-onboarding-approval-v1" as const,
              identityFingerprint,
              planId: stored.planId,
              planDigest,
              noteFingerprint,
              profileId: stored.profileId,
              action: stored.action,
              approval: projectApproval(rawApproval, stored, planDigest, scopes, readNow(now)),
            });
          },
        });
      } catch (error) {
        if (approvalInvoked) throw approvalOutcomeUnknownError(503);
        if (error instanceof LocalClientGovernedOnboardingError) throw error;
        throw dependencyError();
      }
      if (!outcome.accepted) {
        if (new Set([
          "IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED",
          "IDEMPOTENCY_PREVIOUS_ATTEMPT_UNKNOWN",
          "IDEMPOTENCY_RESULT_NOT_REPLAYABLE",
        ]).has(outcome.code)) {
          throw approvalOutcomeUnknownError(outcome.statusCode === 503 ? 503 : 409);
        }
        throw approvalIdempotencyConflictError(outcome.statusCode);
      }
      if (
        outcome.status === "bypassed"
        || outcome.status === "created-unconfirmed"
        || outcome.replayable !== true
      ) {
        throw approvalOutcomeUnknownError(503);
      }
      try {
        return validatePersistedApprovalEnvelope(
          outcome.value,
          request,
          identityFingerprint,
          planDigest,
          noteFingerprint,
          readNow(now),
        ).approval;
      } catch {
        throw approvalOutcomeUnknownError(503);
      }
    },

    async apply(
      rawRequest: LocalClientOnboardingIdentity & { planId: string },
      rawPort: LocalClientGovernedOnboardingRequestPort,
    ): Promise<LocalClientGovernedOnboardingMutationOutcome> {
      const request = normalizeMutationRequest(rawRequest);
      return executeMutation({
        dependencies,
        request,
        plans,
        port: normalizeRequestPort(rawPort),
        operation: "apply",
        now,
        receiptAuthorityStore,
        validateStored(stored) {
          if (stored.action !== "enable" && stored.action !== "disable") throw planMismatchError();
        },
        invoke: async (stored) => dependencies.registry.apply(stored.registryPlan!.planId),
      });
    },

    async rollback(
      rawRequest: LocalClientOnboardingIdentity & { planId: string },
      rawPort: LocalClientGovernedOnboardingRequestPort,
    ): Promise<LocalClientGovernedOnboardingMutationOutcome> {
      const request = normalizeMutationRequest(rawRequest);
      return executeMutation({
        dependencies,
        request,
        plans,
        port: normalizeRequestPort(rawPort),
        operation: "rollback",
        now,
        receiptAuthorityStore,
        validateStored(stored) {
          if (stored.action !== "rollback" || !stored.applyReceipt || !stored.rollbackClaim) {
            throw planMismatchError();
          }
        },
        invoke: async (stored) => dependencies.registry.rollback(stored.applyReceipt!),
      });
    },

    async recover(
      rawRequest: LocalClientOnboardingIdentity & { planId: string },
      rawPort: LocalClientGovernedOnboardingRequestPort,
    ): Promise<LocalClientGovernedOnboardingMutationOutcome> {
      const request = normalizeMutationRequest(rawRequest);
      return executeMutation({
        dependencies,
        request,
        plans,
        port: normalizeRequestPort(rawPort),
        operation: "recover",
        now,
        receiptAuthorityStore,
        async validateStored(stored) {
          if (stored.action !== "recover" || !stored.recoveryFingerprint) throw planMismatchError();
          const currentInspection = projectInspection(
            await callDependency(() => dependencies.registry.inspect(stored.profileId)),
            stored.profileId,
          );
          if (!safeSha256Equal(inspectionDigest(currentInspection), stored.recoveryFingerprint)) {
            throw planMismatchError();
          }
        },
        invoke: async (stored) => dependencies.registry.recover(stored.profileId),
      });
    },
  });
}

async function executeMutation(input: Readonly<{
  dependencies: LocalClientGovernedOnboardingDependencies;
  request: Readonly<LocalClientOnboardingIdentity & { planId: string }>;
  plans: Map<string, StoredPlan>;
  port: NormalizedPort;
  operation: "apply" | "rollback" | "recover";
  now: () => number;
  receiptAuthorityStore: LocalClientOnboardingReceiptAuthorityStorePort;
  validateStored: (stored: StoredPlan) => void | Promise<void>;
  invoke: (stored: StoredPlan) => Promise<LocalClientOnboardingReceipt | LocalClientOnboardingRollbackReceipt | LocalClientOnboardingRecoveryReceipt>;
}>): Promise<LocalClientGovernedOnboardingMutationOutcome> {
  if (input.port.signal?.aborted) {
    return rejectedOutcome(
      409,
      "LOCAL_CLIENT_ONBOARDING_CANCELLED",
      "The governed onboarding operation was cancelled before external-effect commit.",
      false,
      false,
    );
  }
  await assertDurableIdempotency(input.dependencies.idempotencyCoordinator);
  assertDurableReceiptAuthority(input.receiptAuthorityStore.status);
  assertDurableExternalEffect(input.dependencies.externalEffectGate.status);
  const planDigest = planDigestFromPlanId(input.request.planId);
  const identityFingerprint = identityDigest(input.request);
  const route = `${LOCAL_CLIENT_GOVERNED_ONBOARDING_ROUTE}/${input.operation}`;
  const payload = Object.freeze({
    schema: "local-client-governed-onboarding-idempotency-v1",
    identityFingerprint,
    planId: input.request.planId,
    planDigest,
    operation: input.operation,
  });
  const internalRequest = Object.freeze({
    headers: Object.freeze({
      "idempotency-key": input.port.idempotencyKey,
      authorization: `LocalClient-Onboarding ${identityFingerprint}`,
    }),
    socket: Object.freeze({ remoteAddress: "127.0.0.1" }),
  });
  let operationInvoked = false;
  let commitAttempted = false;
  let activeRollbackClaim: LocalClientOnboardingRollbackClaimReference | null = null;
  let outcome: IdempotencyOutcome<PersistedMutationEnvelope>;

  try {
    outcome = await input.dependencies.idempotencyCoordinator.execute({
      request: internalRequest,
      route,
      payload,
      operation: async () => {
        operationInvoked = true;
        throwIfAborted(input.port.signal);
        const stored = requirePlan(input.plans, input.request, readNow(input.now));
        if (!safeSha256Equal(derivePlanDigest(stored), planDigest)) throw planMismatchError();
        await input.validateStored(stored);
        activeRollbackClaim = stored.rollbackClaim;
        const scopes = buildScopes(stored);
        await consumeExactApproval(
          input.dependencies.approvalGate,
          stored,
          planDigest,
          scopes,
          readNow(input.now),
        );
        const reservation = await input.dependencies.externalEffectGate.reserve({
          effectKeyHash: planDigest,
          effectKeyInvalid: false,
          route,
          tenantId: stored.tenantId,
          effectType: `local-client-onboarding-${stored.action}`,
          payloadFingerprint: planDigest,
          fenceRequired: false,
        });
        if (!reservation || typeof reservation.commit !== "function") throw dependencyError();
        throwIfAborted(input.port.signal);
        commitAttempted = true;
        await reservation.commit();
        const rawResult = await input.invoke(stored);
        const result = projectMutationResult(rawResult, stored, input.operation);
        return Object.freeze({
          schema: "local-client-governed-onboarding-result-v1" as const,
          identityFingerprint,
          planId: stored.planId,
          planDigest,
          action: stored.action,
          rollbackReceiptReference: stored.applyReceipt === null
            ? null
            : receiptReference(stored.identityFingerprint, stored.applyReceipt),
          result,
        });
      },
    });
  } catch {
    if (commitAttempted) return unknownOutcome(operationInvoked, false);
    const rollbackClaim = activeRollbackClaim
      ?? lookupBoundRollbackClaim(input.plans, input.request);
    if (
      input.operation === "rollback"
      && rollbackClaim
      && !await releaseRollbackClaim(input.receiptAuthorityStore, rollbackClaim)
    ) {
      return unknownOutcome(operationInvoked, false, 503);
    }
    return rejectedOutcome(
      409,
      "LOCAL_CLIENT_ONBOARDING_PRECOMMIT_REJECTED",
      "The governed onboarding operation was rejected before the external effect commit.",
      operationInvoked,
      false,
    );
  }

  if (!outcome.accepted) {
    if (new Set([
      "IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED",
      "IDEMPOTENCY_PREVIOUS_ATTEMPT_UNKNOWN",
      "IDEMPOTENCY_RESULT_NOT_REPLAYABLE",
      "IDEMPOTENCY_REQUEST_IN_PROGRESS",
    ]).has(outcome.code)) {
      return unknownOutcome(operationInvoked, false, outcome.statusCode === 503 ? 503 : 409);
    }
    if (input.operation === "rollback") {
      const stored = lookupBoundPlan(input.plans, input.request);
      if (
        stored?.rollbackClaim
        && !await releaseRollbackClaim(input.receiptAuthorityStore, stored.rollbackClaim)
      ) {
        return unknownOutcome(operationInvoked, false, 503);
      }
    }
    return rejectedOutcome(
      outcome.statusCode,
      safeErrorCode(outcome.code),
      "The durable onboarding idempotency boundary rejected this request.",
      operationInvoked,
      outcome.retryable,
      outcome.retryAfterSeconds,
    );
  }
  if (
    outcome.status === "bypassed"
    || outcome.status === "created-unconfirmed"
    || outcome.replayable !== true
  ) {
    return unknownOutcome(operationInvoked, outcome.replayed, 503);
  }
  let envelope: PersistedMutationEnvelope;
  try {
    envelope = validatePersistedEnvelope(
      outcome.value,
      input.request,
      identityFingerprint,
      input.operation,
      planDigest,
    );
  } catch {
    return unknownOutcome(operationInvoked, outcome.replayed, 503);
  }
  if (envelope.result.operation === "apply") {
    if (!await recordAppliedReceipt(
      input.receiptAuthorityStore,
      identityFingerprint,
      envelope.result.receipt as LocalClientOnboardingReceipt,
    )) {
      return unknownOutcome(operationInvoked, outcome.replayed, 503);
    }
  } else if (envelope.result.operation === "rollback") {
    const stored = lookupBoundPlan(input.plans, input.request);
    const finalized = await finalizeRollbackAuthority(
      input.receiptAuthorityStore,
      envelope.rollbackReceiptReference,
      stored?.rollbackClaim ?? null,
    );
    if (!finalized) return unknownOutcome(operationInvoked, outcome.replayed, 503);
  }
  return Object.freeze({
    accepted: true,
    status: outcome.replayed ? "replayed" : "completed",
    statusCode: 200,
    idempotencyStatus: outcome.replayed ? "replayed" : "created",
    replayed: outcome.replayed,
    replayable: true,
    operationInvoked,
    retryAllowed: false,
    result: envelope.result,
  });
}

async function callDependency<T>(operation: () => T | Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    throw dependencyError();
  }
}

async function consumeExactApproval(
  approvalGate: LocalClientGovernedOnboardingDependencies["approvalGate"],
  stored: StoredPlan,
  planDigest: string,
  scopes: readonly string[],
  nowMs: number,
): Promise<void> {
  let decision: unknown;
  try {
    decision = await approvalGate.consume({
      planId: stored.planId,
      tenantId: stored.tenantId,
      userId: stored.subjectId,
      planDigest,
      requiredScopes: scopes,
    });
  } catch {
    throw approvalError();
  }
  if (!isPlainRecord(decision) || decision.approved !== true || decision.consumed !== true) {
    throw approvalError();
  }
  const approval = decision.approval;
  if (
    !isPlainRecord(approval)
    || approval.planId !== stored.planId
    || approval.tenantId !== stored.tenantId
    || approval.userId !== stored.subjectId
    || approval.planDigest !== planDigest
    || !sameStringSet(approval.approvedScopes, scopes)
    || (approval.status !== "consumed" && approval.status !== "approved")
    || !validIsoDate(approval.approvedAt)
    || !validIsoDate(approval.expiresAt)
    || Date.parse(approval.approvedAt) > nowMs
    || Date.parse(approval.expiresAt) <= nowMs
  ) {
    throw approvalError();
  }
}

async function assertDurableIdempotency(
  coordinator: LocalClientGovernedOnboardingDependencies["idempotencyCoordinator"],
): Promise<void> {
  let stats: ReturnType<IdempotencyCoordinator["getStats"]>;
  try {
    stats = typeof coordinator.checkHealth === "function"
      ? await coordinator.checkHealth()
      : coordinator.getStats();
  } catch {
    throw idempotencyDurabilityError();
  }
  if (
    (stats.storeMode !== "sqlite" && stats.storeMode !== "postgres")
    || stats.available === false
  ) {
    throw idempotencyDurabilityError();
  }
}

function assertDurableExternalEffect(
  status: LocalClientGovernedOnboardingDependencies["externalEffectGate"]["status"],
): void {
  if (
    status.enabled !== true
    || status.durable !== true
    || (status.mode !== "sqlite" && status.mode !== "postgres")
  ) {
    throw externalEffectDurabilityError();
  }
}

function derivePlanDigest(stored: Omit<StoredPlan, "planId"> | StoredPlan): string {
  return digestCanonical({
    schema: "local-client-governed-onboarding-plan-digest-v1",
    identityFingerprint: stored.identityFingerprint,
    profileId: stored.profileId,
    action: stored.action,
    createdAtMs: stored.createdAtMs,
    expiresAtMs: stored.expiresAtMs,
    registryPlan: stored.registryPlan === null ? null : {
      planId: stored.registryPlan.planId,
      beforeSha256: stored.registryPlan.beforeSha256,
      afterSha256: stored.registryPlan.afterSha256,
      action: stored.registryPlan.action,
    },
    applyReceiptDigest: stored.applyReceipt?.receiptDigest ?? null,
    recoveryFingerprint: stored.recoveryFingerprint,
  });
}

function buildScopes(stored: StoredPlan): readonly string[] {
  return buildScopesFor(stored.profileId, stored.action);
}

function buildScopesFor(
  profileId: LocalClientOnboardingProfileId,
  action: LocalClientGovernedOnboardingAction,
): readonly string[] {
  return Object.freeze([
    "local-client:onboarding",
    `local-client:onboarding:${action}`,
    `local-client:onboarding:profile:${profileId}`,
  ].sort());
}

function projectGovernedPlan(stored: StoredPlan): LocalClientGovernedOnboardingPlan {
  return Object.freeze({
    apiVersion: LOCAL_CLIENT_GOVERNED_ONBOARDING_API_VERSION,
    planVersion: LOCAL_CLIENT_GOVERNED_ONBOARDING_PLAN_VERSION,
    planId: stored.planId,
    planDigest: derivePlanDigest(stored),
    profileId: stored.profileId,
    action: stored.action,
    scopes: buildScopes(stored),
    createdAtMs: stored.createdAtMs,
    expiresAtMs: stored.expiresAtMs,
    writesPerformed: false,
    redacted: true,
  });
}

function requirePlan(
  plans: ReadonlyMap<string, StoredPlan>,
  request: Readonly<LocalClientOnboardingIdentity & { planId: string }>,
  nowMs: number,
): StoredPlan {
  const stored = plans.get(request.planId);
  if (!stored) throw planUnknownError();
  if (
    stored.tenantId !== request.tenantId
    || stored.subjectId !== request.subjectId
    || stored.identityFingerprint !== identityDigest(request)
    || stored.planId !== request.planId
    || nowMs < stored.createdAtMs
    || nowMs >= stored.expiresAtMs
    || !safeSha256Equal(stored.planId.slice("onboarding_".length), derivePlanDigest(stored))
  ) {
    throw planMismatchError();
  }
  return stored;
}

function purgeExpiredPlans(plans: Map<string, StoredPlan>, nowMs: number): void {
  for (const [planId, plan] of plans) {
    if (nowMs >= plan.expiresAtMs) plans.delete(planId);
  }
}

function lookupBoundPlan(
  plans: ReadonlyMap<string, StoredPlan>,
  request: Readonly<LocalClientOnboardingIdentity & { planId: string }>,
): StoredPlan | null {
  const stored = plans.get(request.planId);
  if (
    !stored
    || stored.tenantId !== request.tenantId
    || stored.subjectId !== request.subjectId
    || stored.identityFingerprint !== identityDigest(request)
    || stored.planId !== request.planId
    || !safeSha256Equal(stored.planId.slice("onboarding_".length), derivePlanDigest(stored))
  ) return null;
  return stored;
}

function lookupBoundRollbackClaim(
  plans: ReadonlyMap<string, StoredPlan>,
  request: Readonly<LocalClientOnboardingIdentity & { planId: string }>,
): LocalClientOnboardingRollbackClaimReference | null {
  return lookupBoundPlan(plans, request)?.rollbackClaim ?? null;
}

function planDigestFromPlanId(planId: string): string {
  if (!PUBLIC_PLAN_ID_PATTERN.test(planId)) throw requestError();
  const digest = planId.slice("onboarding_".length);
  if (!SHA256_PATTERN.test(digest)) throw requestError();
  return digest;
}

function receiptReference(
  identityFingerprint: string,
  receipt: LocalClientOnboardingReceipt,
): LocalClientOnboardingReceiptReference {
  return Object.freeze({
    identityFingerprint,
    profileId: receipt.profileId,
    action: receipt.action,
    receiptDigest: receipt.receiptDigest,
    receiptContentFingerprint: digestCanonical(receipt),
  });
}

async function authorizeRollbackReceipt(
  store: LocalClientOnboardingReceiptAuthorityStorePort,
  reference: LocalClientOnboardingReceiptReference,
): Promise<LocalClientOnboardingRollbackClaimReference> {
  assertDurableReceiptAuthority(store.status);
  let authorization: LocalClientOnboardingRollbackAuthorization;
  try {
    authorization = await store.authorizeRollback(reference);
  } catch {
    throw planUnknownError();
  }
  if (!isRollbackClaimed(authorization)) throw planUnknownError();
  validateRollbackAuthorization(authorization, reference);
  return Object.freeze({
    ...reference,
    leaseToken: authorization.lease.token,
    fencingToken: authorization.lease.fencingToken,
  });
}

function isRollbackClaimed(
  authorization: LocalClientOnboardingRollbackAuthorization,
): authorization is LocalClientOnboardingRollbackClaimed {
  return authorization.claimed === true;
}

function validateRollbackAuthorization(
  authorization: LocalClientOnboardingRollbackClaimed,
  reference: LocalClientOnboardingReceiptReference,
): void {
  if (
    authorization.success !== true
    || authorization.claimed !== true
    || authorization.inProgress !== false
    || authorization.replayed !== false
    || authorization.status !== "rollback-pending"
    || authorization.receiptDigest !== reference.receiptDigest
    || authorization.receiptContentFingerprint !== reference.receiptContentFingerprint
    || typeof authorization.lease?.token !== "string"
    || authorization.lease.token.length < 16
    || typeof authorization.lease.fencingToken !== "string"
    || !/^(?:0|[1-9][0-9]{0,18})$/u.test(authorization.lease.fencingToken)
    || !isPlainRecord(authorization.mutationDelta)
    || authorization.mutationDelta.operation !== "rollback"
    || authorization.mutationDelta.profileId !== reference.profileId
    || authorization.mutationDelta.action !== reference.action
    || authorization.mutationDelta.receiptDigest !== reference.receiptDigest
    || authorization.mutationDelta.receiptContentFingerprint !== reference.receiptContentFingerprint
  ) {
    throw planUnknownError();
  }
}

async function recordAppliedReceipt(
  store: LocalClientOnboardingReceiptAuthorityStorePort,
  identityFingerprint: string,
  receipt: LocalClientOnboardingReceipt,
): Promise<boolean> {
  const input = Object.freeze({
    ...receiptReference(identityFingerprint, receipt),
    appliedAt: new Date(receipt.transaction.committedAtMs).toISOString(),
  });
  try {
    const result = await store.recordApplied(input);
    assertDependencyShape(result, [
      "success",
      "recorded",
      "replayed",
      "code",
      "status",
      "profileId",
      "action",
      "receiptDigest",
      "receiptContentFingerprint",
      "appliedAt",
      "retireAt",
      "mutationDelta",
    ]);
    return result.success === true
      && typeof result.recorded === "boolean"
      && typeof result.replayed === "boolean"
      && result.recorded !== result.replayed
      && new Set(["applied", "rollback-pending", "rolled-back"]).has(String(result.status))
      && result.profileId === input.profileId
      && result.action === input.action
      && result.receiptDigest === input.receiptDigest
      && result.receiptContentFingerprint === input.receiptContentFingerprint
      && result.appliedAt === input.appliedAt
      && validIsoDate(result.retireAt)
      && result.mutationDelta === null;
  } catch {
    return false;
  }
}

async function finalizeRollbackAuthority(
  store: LocalClientOnboardingReceiptAuthorityStorePort,
  reference: LocalClientOnboardingReceiptReference | null,
  storedClaim: LocalClientOnboardingRollbackClaimReference | null,
): Promise<boolean> {
  if (!reference) return false;
  let claim = storedClaim;
  if (!claim) {
    let authorization: LocalClientOnboardingRollbackAuthorization;
    try {
      authorization = await store.authorizeRollback(reference);
    } catch {
      return false;
    }
    if (authorization.replayed === true && authorization.status === "rolled-back") {
      return authorization.receiptDigest === reference.receiptDigest
        && authorization.receiptContentFingerprint === reference.receiptContentFingerprint;
    }
    if (!isRollbackClaimed(authorization)) return false;
    try {
      validateRollbackAuthorization(authorization, reference);
    } catch {
      return false;
    }
    claim = Object.freeze({
      ...reference,
      leaseToken: authorization.lease.token,
      fencingToken: authorization.lease.fencingToken,
    });
  }
  try {
    const marked = await store.markRolledBack(claim);
    return marked.success === true
      && marked.marked === true
      && marked.status === "rolled-back"
      && marked.receiptDigest === reference.receiptDigest
      && marked.receiptContentFingerprint === reference.receiptContentFingerprint
      && marked.fencingToken === claim.fencingToken;
  } catch {
    return false;
  }
}

async function releaseRollbackClaim(
  store: LocalClientOnboardingReceiptAuthorityStorePort,
  claim: LocalClientOnboardingRollbackClaimReference,
): Promise<boolean> {
  try {
    const released = await store.releaseRollbackClaim(claim);
    return released.success === true
      && released.released === true
      && released.status === "applied"
      && released.receiptDigest === claim.receiptDigest
      && released.receiptContentFingerprint === claim.receiptContentFingerprint
      && released.fencingToken === claim.fencingToken;
  } catch {
    return false;
  }
}

function assertDurableReceiptAuthority(
  status: LocalClientOnboardingReceiptAuthorityStorePort["status"],
): void {
  if (
    status.mode !== "sqlite-onboarding-receipt-authority"
    || status.available !== true
    || status.durable !== true
    || status.oneTimeRollbackAuthorization !== true
  ) {
    throw configError();
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw requestError();
}

function identityDigest(identity: LocalClientOnboardingIdentity): string {
  return digestCanonical({
    schema: "local-client-onboarding-identity-v1",
    tenantId: identity.tenantId,
    subjectId: identity.subjectId,
  });
}

function inspectionDigest(inspection: LocalClientOnboardingInspection): string {
  return digestCanonical({
    schema: "local-client-onboarding-recovery-inspection-v1",
    profileId: inspection.profile.profileId,
    installationState: inspection.installation.state,
    recoveryRequired: inspection.recoveryRequired,
    journalCorrupt: inspection.journalCorrupt,
    pendingTransactionCount: inspection.pendingTransactionCount,
    storedPlanCount: inspection.storedPlanCount,
  });
}

function projectProfileList(raw: readonly LocalClientOnboardingProfileSummary[]): readonly LocalClientOnboardingProfileSummary[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 32) throw dependencyError();
  const profiles = raw.map(projectProfile);
  if (new Set(profiles.map((profile) => profile.profileId)).size !== profiles.length) throw dependencyError();
  return Object.freeze(profiles);
}

function projectProfile(raw: LocalClientOnboardingProfileSummary): LocalClientOnboardingProfileSummary {
  assertDependencyShape(raw, [
    "profileId",
    "client",
    "format",
    "containerKey",
    "serverName",
    "transport",
    "backupProtection",
    "supportedActions",
    "certificationStatus",
    "redacted",
  ]);
  const profileId = normalizeProfileId(raw.profileId);
  if (
    !new Set(["claude-compatible", "cursor", "vscode"]).has(raw.client)
    || raw.format !== "json-only"
    || (raw.containerKey !== "mcpServers" && raw.containerKey !== "servers")
    || raw.serverName !== "unified-ai-system"
    || raw.transport !== "stdio"
    || (raw.backupProtection !== "aes-256-gcm" && raw.backupProtection !== "0600-plaintext")
    || !sameStringSet(raw.supportedActions, ["enable", "disable"])
    || raw.certificationStatus !== "fixture-tested-not-real-client-certified"
    || raw.redacted !== true
  ) {
    throw dependencyError();
  }
  return Object.freeze({
    profileId,
    client: raw.client,
    format: "json-only",
    containerKey: raw.containerKey,
    serverName: "unified-ai-system",
    transport: "stdio",
    backupProtection: raw.backupProtection,
    supportedActions: Object.freeze(["enable", "disable"] as const),
    certificationStatus: "fixture-tested-not-real-client-certified",
    redacted: true,
  });
}

function projectInspection(
  raw: LocalClientOnboardingInspection,
  expectedProfileId: LocalClientOnboardingProfileId,
): LocalClientOnboardingInspection {
  assertDependencyShape(raw, [
    "profile",
    "installation",
    "recoveryRequired",
    "journalCorrupt",
    "pendingTransactionCount",
    "storedPlanCount",
    "available",
  ]);
  const profile = projectProfile(raw.profile);
  const installation = projectVerification(raw.installation, expectedProfileId);
  if (
    profile.profileId !== expectedProfileId
    || typeof raw.recoveryRequired !== "boolean"
    || typeof raw.journalCorrupt !== "boolean"
    || !Number.isSafeInteger(raw.pendingTransactionCount)
    || raw.pendingTransactionCount < 0
    || !Number.isSafeInteger(raw.storedPlanCount)
    || raw.storedPlanCount < 0
    || raw.available !== true
  ) {
    throw dependencyError();
  }
  return Object.freeze({
    profile,
    installation,
    recoveryRequired: raw.recoveryRequired,
    journalCorrupt: raw.journalCorrupt,
    pendingTransactionCount: raw.pendingTransactionCount,
    storedPlanCount: raw.storedPlanCount,
    available: true,
  });
}

function projectVerification(
  raw: LocalClientOnboardingVerification,
  expectedProfileId: LocalClientOnboardingProfileId,
): LocalClientOnboardingVerification {
  assertDependencyShape(raw, [
    "profileId",
    "installed",
    "state",
    "format",
    "certificationStatus",
    "redacted",
  ]);
  if (
    raw.profileId !== expectedProfileId
    || typeof raw.installed !== "boolean"
    || !new Set(["exact", "absent", "different"]).has(raw.state)
    || raw.installed !== (raw.state === "exact")
    || raw.format !== "json-only"
    || raw.certificationStatus !== "fixture-tested-not-real-client-certified"
    || raw.redacted !== true
  ) {
    throw dependencyError();
  }
  return Object.freeze({
    profileId: expectedProfileId,
    installed: raw.installed,
    state: raw.state,
    format: "json-only",
    certificationStatus: "fixture-tested-not-real-client-certified",
    redacted: true,
  });
}

function projectRegistryPlan(
  raw: LocalClientOnboardingPlan,
  expectedProfileId: LocalClientOnboardingProfileId,
  expectedAction: LocalClientOnboardingAction,
): LocalClientOnboardingPlan {
  assertDependencyShape(raw, [
    "planVersion",
    "planId",
    "profileId",
    "action",
    "beforeSha256",
    "afterSha256",
    "createdAtMs",
    "expiresAtMs",
    "writesPerformed",
    "format",
    "certificationStatus",
    "redacted",
  ]);
  if (
    raw.planVersion !== "local-client-onboarding-plan-v1"
    || typeof raw.planId !== "string"
    || !/^onboard:[a-z0-9-]+:[a-f0-9]{64}$/u.test(raw.planId)
    || raw.profileId !== expectedProfileId
    || raw.action !== expectedAction
    || !SHA256_PATTERN.test(raw.beforeSha256)
    || !SHA256_PATTERN.test(raw.afterSha256)
    || raw.beforeSha256 === raw.afterSha256
    || !Number.isSafeInteger(raw.createdAtMs)
    || !Number.isSafeInteger(raw.expiresAtMs)
    || raw.createdAtMs < 0
    || raw.createdAtMs >= raw.expiresAtMs
    || raw.writesPerformed !== false
    || raw.format !== "json-only"
    || raw.certificationStatus !== "fixture-tested-not-real-client-certified"
    || raw.redacted !== true
  ) {
    throw dependencyError();
  }
  return Object.freeze({ ...raw });
}

function projectApplyReceipt(
  raw: LocalClientOnboardingReceipt,
  expectedProfileId: LocalClientOnboardingProfileId,
): LocalClientOnboardingReceipt {
  assertDependencyShape(raw, [
    "receiptVersion",
    "profileId",
    "action",
    "planId",
    "transaction",
    "receiptDigest",
    "format",
    "certificationStatus",
    "redacted",
  ]);
  if (
    raw.receiptVersion !== "local-client-onboarding-receipt-v1"
    || raw.profileId !== expectedProfileId
    || (raw.action !== "enable" && raw.action !== "disable")
    || typeof raw.planId !== "string"
    || !/^onboard:[a-z0-9-]+:[a-f0-9]{64}$/u.test(raw.planId)
    || !SHA256_PATTERN.test(raw.receiptDigest)
    || raw.format !== "json-only"
    || raw.certificationStatus !== "fixture-tested-not-real-client-certified"
    || raw.redacted !== true
  ) {
    throw dependencyError();
  }
  const transaction = projectConfigApplyReceipt(raw.transaction);
  if (!raw.planId.endsWith(`:${transaction.planId}`)) throw dependencyError();
  const expectedDigest = onboardingReceiptDigest({
    profileId: raw.profileId,
    action: raw.action,
    planId: raw.planId,
    transactionReceiptDigest: transaction.receiptDigest,
  });
  if (!safeSha256Equal(expectedDigest, raw.receiptDigest)) throw dependencyError();
  return Object.freeze({ ...raw, transaction });
}

function projectConfigApplyReceipt(raw: unknown) {
  const keys = [
    "receiptVersion",
    "transactionId",
    "planId",
    "targetFingerprint",
    "beforeSha256",
    "afterSha256",
    "backupSha256",
    "afterIdentityFingerprint",
    "committedAtMs",
    "receiptDigest",
  ];
  assertDependencyShape(raw, keys);
  if (
    raw.receiptVersion !== "local-client-config-receipt-v1"
    || typeof raw.transactionId !== "string"
    || !/^tx_[a-f0-9]{64}$/u.test(raw.transactionId)
    || !allSha256(raw, [
      "planId",
      "targetFingerprint",
      "beforeSha256",
      "afterSha256",
      "backupSha256",
      "afterIdentityFingerprint",
      "receiptDigest",
    ])
    || !Number.isSafeInteger(raw.committedAtMs)
    || Number(raw.committedAtMs) < 0
  ) {
    throw dependencyError();
  }
  const projected = Object.freeze({ ...raw }) as unknown as LocalClientOnboardingReceipt["transaction"];
  const expectedDigest = configReceiptDigest({
    receiptVersion: projected.receiptVersion,
    transactionId: projected.transactionId,
    planId: projected.planId,
    targetFingerprint: projected.targetFingerprint,
    beforeSha256: projected.beforeSha256,
    afterSha256: projected.afterSha256,
    backupSha256: projected.backupSha256,
    afterIdentityFingerprint: projected.afterIdentityFingerprint,
    committedAtMs: projected.committedAtMs,
  });
  if (!safeSha256Equal(expectedDigest, projected.receiptDigest)) throw dependencyError();
  return projected;
}

function projectMutationResult(
  raw: LocalClientOnboardingReceipt | LocalClientOnboardingRollbackReceipt | LocalClientOnboardingRecoveryReceipt,
  stored: StoredPlan,
  operation: "apply" | "rollback" | "recover",
): LocalClientGovernedOnboardingMutationResult {
  let receipt: LocalClientGovernedOnboardingMutationResult["receipt"];
  if (operation === "apply") {
    receipt = projectApplyReceipt(raw as LocalClientOnboardingReceipt, stored.profileId);
    if (receipt.planId !== stored.registryPlan?.planId || receipt.action !== stored.action) throw dependencyError();
  } else if (operation === "rollback") {
    receipt = projectRollbackReceipt(raw as LocalClientOnboardingRollbackReceipt, stored);
  } else {
    receipt = projectRecoveryReceipt(raw as LocalClientOnboardingRecoveryReceipt, stored.profileId);
  }
  return Object.freeze({
    apiVersion: LOCAL_CLIENT_GOVERNED_ONBOARDING_API_VERSION,
    operation,
    profileId: stored.profileId,
    action: stored.action,
    planId: stored.planId,
    status: "completed",
    receipt,
    redacted: true,
  });
}

function projectRollbackReceipt(
  raw: LocalClientOnboardingRollbackReceipt,
  stored: StoredPlan,
): LocalClientOnboardingRollbackReceipt {
  assertDependencyShape(raw, [
    "rollbackVersion",
    "profileId",
    "action",
    "planId",
    "transaction",
    "format",
    "certificationStatus",
    "redacted",
  ]);
  if (
    raw.rollbackVersion !== "local-client-onboarding-rollback-v1"
    || raw.profileId !== stored.profileId
    || raw.action !== stored.applyReceipt?.action
    || raw.planId !== stored.applyReceipt?.planId
    || raw.format !== "json-only"
    || raw.certificationStatus !== "fixture-tested-not-real-client-certified"
    || raw.redacted !== true
  ) {
    throw dependencyError();
  }
  const transaction = projectConfigRollbackReceipt(raw.transaction);
  if (transaction.planId !== stored.applyReceipt.transaction.planId) throw dependencyError();
  return Object.freeze({ ...raw, transaction });
}

function projectRollbackReceiptForReplay(
  raw: LocalClientOnboardingRollbackReceipt,
  profileId: LocalClientOnboardingProfileId,
  appliedAction: "enable" | "disable",
): LocalClientOnboardingRollbackReceipt {
  assertDependencyShape(raw, [
    "rollbackVersion",
    "profileId",
    "action",
    "planId",
    "transaction",
    "format",
    "certificationStatus",
    "redacted",
  ]);
  if (
    raw.rollbackVersion !== "local-client-onboarding-rollback-v1"
    || raw.profileId !== profileId
    || raw.action !== appliedAction
    || typeof raw.planId !== "string"
    || !/^onboard:[a-z0-9-]+:[a-f0-9]{64}$/u.test(raw.planId)
    || raw.format !== "json-only"
    || raw.certificationStatus !== "fixture-tested-not-real-client-certified"
    || raw.redacted !== true
  ) {
    throw dependencyError();
  }
  const transaction = projectConfigRollbackReceipt(raw.transaction);
  if (!raw.planId.endsWith(`:${transaction.planId}`)) throw dependencyError();
  return Object.freeze({ ...raw, transaction });
}

function projectReceiptReference(
  raw: unknown,
  identityFingerprint: string,
  profileId: LocalClientOnboardingProfileId,
): LocalClientOnboardingReceiptReference {
  assertDependencyShape(raw, [
    "identityFingerprint",
    "profileId",
    "action",
    "receiptDigest",
    "receiptContentFingerprint",
  ]);
  if (
    raw.identityFingerprint !== identityFingerprint
    || raw.profileId !== profileId
    || (raw.action !== "enable" && raw.action !== "disable")
    || typeof raw.receiptDigest !== "string"
    || !SHA256_PATTERN.test(raw.receiptDigest)
    || typeof raw.receiptContentFingerprint !== "string"
    || !SHA256_PATTERN.test(raw.receiptContentFingerprint)
  ) {
    throw dependencyError();
  }
  return Object.freeze({
    identityFingerprint,
    profileId,
    action: raw.action,
    receiptDigest: raw.receiptDigest,
    receiptContentFingerprint: raw.receiptContentFingerprint,
  });
}

function projectConfigRollbackReceipt(raw: unknown) {
  assertDependencyShape(raw, [
    "rollbackReceiptVersion",
    "transactionId",
    "planId",
    "restoredSha256",
    "replacedSha256",
    "backupSha256",
    "rolledBackAtMs",
    "receiptDigest",
  ]);
  if (
    raw.rollbackReceiptVersion !== "local-client-config-rollback-receipt-v1"
    || typeof raw.transactionId !== "string"
    || !/^tx_[a-f0-9]{64}$/u.test(raw.transactionId)
    || !allSha256(raw, ["planId", "restoredSha256", "replacedSha256", "backupSha256", "receiptDigest"])
    || !Number.isSafeInteger(raw.rolledBackAtMs)
    || Number(raw.rolledBackAtMs) < 0
  ) {
    throw dependencyError();
  }
  const projected = Object.freeze({ ...raw }) as unknown as LocalClientOnboardingRollbackReceipt["transaction"];
  const expectedDigest = configReceiptDigest({
    rollbackReceiptVersion: projected.rollbackReceiptVersion,
    transactionId: projected.transactionId,
    planId: projected.planId,
    restoredSha256: projected.restoredSha256,
    replacedSha256: projected.replacedSha256,
    backupSha256: projected.backupSha256,
    rolledBackAtMs: projected.rolledBackAtMs,
  });
  if (!safeSha256Equal(expectedDigest, projected.receiptDigest)) throw dependencyError();
  return projected;
}

function projectRecoveryReceipt(
  raw: LocalClientOnboardingRecoveryReceipt,
  expectedProfileId: LocalClientOnboardingProfileId,
): LocalClientOnboardingRecoveryReceipt {
  assertDependencyShape(raw, [
    "recoveryVersion",
    "profileId",
    "transaction",
    "format",
    "certificationStatus",
    "redacted",
  ]);
  if (
    raw.recoveryVersion !== "local-client-onboarding-recovery-v1"
    || raw.profileId !== expectedProfileId
    || raw.format !== "json-only"
    || raw.certificationStatus !== "fixture-tested-not-real-client-certified"
    || raw.redacted !== true
  ) {
    throw dependencyError();
  }
  assertDependencyShape(raw.transaction, [
    "recoveryReceiptVersion",
    "transactionId",
    "resolution",
    "currentSha256",
    "recoveredAtMs",
    "applyReceipt",
    "rollbackReceipt",
  ]);
  if (
    raw.transaction.recoveryReceiptVersion !== "local-client-config-recovery-receipt-v1"
    || typeof raw.transaction.transactionId !== "string"
    || !/^tx_[a-f0-9]{64}$/u.test(raw.transaction.transactionId)
    || !new Set([
      "apply-aborted",
      "apply-committed",
      "rollback-aborted",
      "rollback-completed",
    ]).has(String(raw.transaction.resolution ?? ""))
    || !SHA256_PATTERN.test(String(raw.transaction.currentSha256 ?? ""))
    || !Number.isSafeInteger(raw.transaction.recoveredAtMs)
  ) {
    throw dependencyError();
  }
  const transaction = Object.freeze({
    recoveryReceiptVersion: "local-client-config-recovery-receipt-v1" as const,
    transactionId: raw.transaction.transactionId,
    resolution: raw.transaction.resolution as "apply-aborted" | "apply-committed" | "rollback-aborted" | "rollback-completed",
    currentSha256: raw.transaction.currentSha256 as string,
    recoveredAtMs: raw.transaction.recoveredAtMs as number,
    applyReceipt: raw.transaction.applyReceipt === null
      ? null
      : projectConfigApplyReceipt(raw.transaction.applyReceipt),
    rollbackReceipt: raw.transaction.rollbackReceipt === null
      ? null
      : projectConfigRollbackReceipt(raw.transaction.rollbackReceipt),
  });
  return Object.freeze({
    recoveryVersion: "local-client-onboarding-recovery-v1",
    profileId: expectedProfileId,
    transaction,
    format: "json-only",
    certificationStatus: "fixture-tested-not-real-client-certified",
    redacted: true,
  });
}

function validatePersistedEnvelope(
  raw: unknown,
  request: Readonly<LocalClientOnboardingIdentity & { planId: string }>,
  identityFingerprint: string,
  operation: "apply" | "rollback" | "recover",
  planDigest: string,
): PersistedMutationEnvelope {
  assertDependencyShape(raw, [
    "schema",
    "identityFingerprint",
    "planId",
    "planDigest",
    "action",
    "rollbackReceiptReference",
    "result",
  ]);
  const action = normalizeGovernedAction(raw.action);
  if (
    raw.schema !== "local-client-governed-onboarding-result-v1"
    || raw.identityFingerprint !== identityFingerprint
    || raw.planId !== request.planId
    || raw.planDigest !== planDigest
    || !isPlainRecord(raw.result)
    || raw.result.apiVersion !== LOCAL_CLIENT_GOVERNED_ONBOARDING_API_VERSION
    || raw.result.operation !== operation
    || raw.result.action !== action
    || raw.result.planId !== request.planId
    || raw.result.status !== "completed"
    || raw.result.redacted !== true
  ) {
    throw dependencyError();
  }
  const profileId = normalizeProfileId(raw.result.profileId);
  let rollbackReceiptReference: LocalClientOnboardingReceiptReference | null = null;
  let receipt: LocalClientGovernedOnboardingMutationResult["receipt"];
  if (operation === "apply") {
    if ((action !== "enable" && action !== "disable") || raw.rollbackReceiptReference !== null) {
      throw dependencyError();
    }
    receipt = projectApplyReceipt(
      raw.result.receipt as LocalClientOnboardingReceipt,
      profileId,
    );
    if (receipt.action !== action) throw dependencyError();
  } else if (operation === "rollback") {
    if (action !== "rollback") throw dependencyError();
    rollbackReceiptReference = projectReceiptReference(
      raw.rollbackReceiptReference,
      identityFingerprint,
      profileId,
    );
    receipt = projectRollbackReceiptForReplay(
      raw.result.receipt as LocalClientOnboardingRollbackReceipt,
      profileId,
      rollbackReceiptReference.action,
    );
  } else {
    if (action !== "recover" || raw.rollbackReceiptReference !== null) throw dependencyError();
    receipt = projectRecoveryReceipt(
      raw.result.receipt as LocalClientOnboardingRecoveryReceipt,
      profileId,
    );
  }
  const result = Object.freeze({
    apiVersion: LOCAL_CLIENT_GOVERNED_ONBOARDING_API_VERSION,
    operation,
    profileId,
    action,
    planId: request.planId,
    status: "completed" as const,
    receipt,
    redacted: true as const,
  });
  return Object.freeze({
    schema: "local-client-governed-onboarding-result-v1",
    identityFingerprint,
    planId: request.planId,
    planDigest,
    action,
    rollbackReceiptReference,
    result,
  });
}

function validatePersistedApprovalEnvelope(
  raw: unknown,
  request: Readonly<LocalClientOnboardingIdentity & { planId: string }>,
  identityFingerprint: string,
  planDigest: string,
  noteFingerprint: string,
  nowMs: number,
): PersistedApprovalEnvelope {
  assertDependencyShape(raw, [
    "schema",
    "identityFingerprint",
    "planId",
    "planDigest",
    "noteFingerprint",
    "profileId",
    "action",
    "approval",
  ]);
  const profileId = normalizeProfileId(raw.profileId);
  const action = normalizeGovernedAction(raw.action);
  const scopes = buildScopesFor(profileId, action);
  if (
    raw.schema !== "local-client-governed-onboarding-approval-v1"
    || raw.identityFingerprint !== identityFingerprint
    || raw.planId !== request.planId
    || raw.planDigest !== planDigest
    || raw.noteFingerprint !== noteFingerprint
  ) {
    throw dependencyError();
  }
  assertDependencyShape(raw.approval, [
    "apiVersion",
    "operation",
    "status",
    "approvalId",
    "planId",
    "planDigest",
    "scopes",
    "approvedAt",
    "expiresAt",
    "writesPerformed",
    "redacted",
  ]);
  const approval = raw.approval;
  if (
    approval.apiVersion !== LOCAL_CLIENT_GOVERNED_ONBOARDING_API_VERSION
    || approval.operation !== "approve"
    || approval.status !== "approved"
    || typeof approval.approvalId !== "string"
    || !APPROVAL_ID_PATTERN.test(approval.approvalId)
    || approval.planId !== request.planId
    || approval.planDigest !== planDigest
    || !sameStringSet(approval.scopes, scopes)
    || !validIsoDate(approval.approvedAt)
    || !validIsoDate(approval.expiresAt)
    || Date.parse(approval.approvedAt) > nowMs
    || Date.parse(approval.expiresAt) <= nowMs
    || approval.writesPerformed !== false
    || approval.redacted !== true
  ) {
    throw dependencyError();
  }
  const projected = Object.freeze({
    apiVersion: LOCAL_CLIENT_GOVERNED_ONBOARDING_API_VERSION,
    operation: "approve" as const,
    status: "approved" as const,
    approvalId: approval.approvalId,
    planId: request.planId,
    planDigest,
    scopes: Object.freeze([...scopes]),
    approvedAt: approval.approvedAt,
    expiresAt: approval.expiresAt,
    writesPerformed: false as const,
    redacted: true as const,
  });
  return Object.freeze({
    schema: "local-client-governed-onboarding-approval-v1",
    identityFingerprint,
    planId: request.planId,
    planDigest,
    noteFingerprint,
    profileId,
    action,
    approval: projected,
  });
}

function projectApproval(
  raw: unknown,
  stored: StoredPlan,
  planDigest: string,
  scopes: readonly string[],
  nowMs: number,
): LocalClientGovernedOnboardingApproval {
  if (!isPlainRecord(raw) || raw.success !== true || raw.status !== "approved" || !isPlainRecord(raw.approval)) {
    throw approvalError();
  }
  const approval = raw.approval;
  if (
    typeof approval.approvalId !== "string"
    || !APPROVAL_ID_PATTERN.test(approval.approvalId)
    || approval.planId !== stored.planId
    || approval.tenantId !== stored.tenantId
    || approval.userId !== stored.subjectId
    || approval.planDigest !== planDigest
    || !sameStringSet(approval.approvedScopes, scopes)
    || approval.status !== "approved"
    || approval.revoked !== false
    || !validIsoDate(approval.approvedAt)
    || !validIsoDate(approval.expiresAt)
    || Date.parse(approval.approvedAt) > nowMs
    || Date.parse(approval.expiresAt) <= nowMs
  ) {
    throw approvalError();
  }
  return Object.freeze({
    apiVersion: LOCAL_CLIENT_GOVERNED_ONBOARDING_API_VERSION,
    operation: "approve",
    status: "approved",
    approvalId: approval.approvalId,
    planId: stored.planId,
    planDigest,
    scopes: Object.freeze([...scopes]),
    approvedAt: approval.approvedAt,
    expiresAt: approval.expiresAt,
    writesPerformed: false,
    redacted: true,
  });
}

function normalizeIdentity(raw: LocalClientOnboardingIdentity): LocalClientOnboardingIdentity {
  assertRequestShape(raw, ["tenantId", "subjectId"]);
  return Object.freeze({
    tenantId: normalizeIdentityValue(raw.tenantId),
    subjectId: normalizeIdentityValue(raw.subjectId),
  });
}

function normalizeProfileRequest(
  raw: LocalClientOnboardingIdentity & { profileId: LocalClientOnboardingProfileId },
) {
  assertRequestShape(raw, ["tenantId", "subjectId", "profileId"]);
  const identity = normalizeIdentityValues(raw);
  return Object.freeze({ ...identity, profileId: normalizeProfileId(raw.profileId) });
}

function normalizePlanRequest(
  raw: LocalClientOnboardingIdentity & {
    profileId: LocalClientOnboardingProfileId;
    action: LocalClientGovernedOnboardingAction;
    receipt?: LocalClientOnboardingReceipt;
  },
) {
  assertRequestShape(raw, ["tenantId", "subjectId", "profileId", "action", "receipt"], new Set(["receipt"]));
  const identity = normalizeIdentityValues(raw);
  const profileId = normalizeProfileId(raw.profileId);
  if (!new Set(["enable", "disable", "rollback", "recover"]).has(raw.action)) throw requestError();
  if (raw.action === "rollback" && raw.receipt === undefined) throw requestError();
  if (raw.action !== "rollback" && raw.receipt !== undefined) throw requestError();
  return Object.freeze({
    ...identity,
    profileId,
    action: raw.action,
    ...(raw.receipt === undefined ? {} : { receipt: raw.receipt }),
  });
}

function normalizeApproveRequest(
  raw: LocalClientOnboardingIdentity & { planId: string; note?: string },
) {
  assertRequestShape(raw, ["tenantId", "subjectId", "planId", "note"], new Set(["note"]));
  const identity = normalizeIdentityValues(raw);
  const note = raw.note === undefined ? undefined : normalizeNote(raw.note);
  return Object.freeze({
    ...identity,
    planId: normalizePlanId(raw.planId),
    ...(note === undefined ? {} : { note }),
  });
}

function normalizeMutationRequest(
  raw: LocalClientOnboardingIdentity & { planId: string },
) {
  assertRequestShape(raw, ["tenantId", "subjectId", "planId"]);
  return Object.freeze({
    ...normalizeIdentityValues(raw),
    planId: normalizePlanId(raw.planId),
  });
}

function normalizeIdentityValues(raw: Readonly<{ tenantId: unknown; subjectId: unknown }>) {
  return Object.freeze({
    tenantId: normalizeIdentityValue(raw.tenantId),
    subjectId: normalizeIdentityValue(raw.subjectId),
  });
}

function normalizeIdentityValue(value: unknown): string {
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

function normalizeProfileId(value: unknown): LocalClientOnboardingProfileId {
  if (
    typeof value !== "string"
    || !(Object.values(LOCAL_CLIENT_ONBOARDING_PROFILE_IDS) as readonly string[]).includes(value)
  ) {
    throw requestError();
  }
  return value as LocalClientOnboardingProfileId;
}

function normalizeGovernedAction(value: unknown): LocalClientGovernedOnboardingAction {
  if (value !== "enable" && value !== "disable" && value !== "rollback" && value !== "recover") {
    throw dependencyError();
  }
  return value;
}

function normalizePlanId(value: unknown): string {
  if (typeof value !== "string" || !PUBLIC_PLAN_ID_PATTERN.test(value)) throw requestError();
  return value;
}

function normalizeNote(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length > 2_000
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw requestError();
  }
  return value;
}

function normalizeRequestPort(raw: LocalClientGovernedOnboardingRequestPort): NormalizedPort {
  assertRequestShape(raw, ["getHeader", "signal"], new Set(["signal"]));
  if (
    typeof raw.getHeader !== "function"
    || (raw.signal !== undefined && !isAbortSignal(raw.signal))
  ) {
    throw requestError();
  }
  let rawKey: unknown;
  try {
    rawKey = raw.getHeader("idempotency-key");
  } catch {
    throw idempotencyRequiredError();
  }
  if (typeof rawKey !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(rawKey)) {
    throw idempotencyRequiredError();
  }
  return Object.freeze({
    idempotencyKey: rawKey,
    ...(raw.signal === undefined ? {} : { signal: raw.signal }),
  });
}

function assertRequestShape(
  value: unknown,
  allowedKeys: readonly string[],
  optionalKeys: ReadonlySet<string> = new Set(),
): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value)) throw requestError();
  const keys = Reflect.ownKeys(value);
  if (
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
    || allowedKeys.some((key) => !optionalKeys.has(key) && !Object.hasOwn(value, key))
  ) {
    throw requestError();
  }
  for (const key of keys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || descriptor.get || descriptor.set || descriptor.enumerable !== true) throw requestError();
  }
}

function assertDependencyShape(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value)) throw dependencyError();
  const actual = Reflect.ownKeys(value);
  if (
    actual.length !== keys.length
    || actual.some((key) => typeof key !== "string" || !keys.includes(key))
    || keys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw dependencyError();
  }
}

function assertDependencies(dependencies: LocalClientGovernedOnboardingDependencies): void {
  if (
    !isPlainRecord(dependencies)
    || Reflect.ownKeys(dependencies).some((key) => !new Set([
      "registry",
      "approvalGate",
      "idempotencyCoordinator",
      "externalEffectGate",
      "receiptAuthorityStore",
    ]).has(String(key)))
    || typeof dependencies.registry?.listProfiles !== "function"
    || typeof dependencies.registry?.inspect !== "function"
    || typeof dependencies.registry?.plan !== "function"
    || typeof dependencies.registry?.apply !== "function"
    || typeof dependencies.registry?.rollback !== "function"
    || typeof dependencies.registry?.recover !== "function"
    || typeof dependencies.registry?.verifyInstalled !== "function"
    || typeof dependencies.approvalGate?.approve !== "function"
    || typeof dependencies.approvalGate?.consume !== "function"
    || typeof dependencies.idempotencyCoordinator?.execute !== "function"
    || typeof dependencies.idempotencyCoordinator?.getStats !== "function"
    || typeof dependencies.externalEffectGate?.reserve !== "function"
    || !isPlainRecord(dependencies.externalEffectGate.status)
    || typeof dependencies.receiptAuthorityStore?.recordApplied !== "function"
    || typeof dependencies.receiptAuthorityStore?.authorizeRollback !== "function"
    || typeof dependencies.receiptAuthorityStore?.markRolledBack !== "function"
    || typeof dependencies.receiptAuthorityStore?.releaseRollbackClaim !== "function"
    || !isPlainRecord(dependencies.receiptAuthorityStore.status)
  ) {
    throw configError();
  }
}

function assertOptions(options: LocalClientGovernedOnboardingOptions): void {
  if (
    !isPlainRecord(options)
    || Reflect.ownKeys(options).some((key) => key !== "now" && key !== "maxPlans")
    || (options.now !== undefined && typeof options.now !== "function")
  ) {
    throw configError();
  }
}

function allSha256(record: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => typeof record[key] === "string" && SHA256_PATTERN.test(record[key] as string));
}

function sameStringSet(raw: unknown, expected: readonly string[]): boolean {
  if (!Array.isArray(raw) || raw.some((value) => typeof value !== "string")) return false;
  const left = [...new Set(raw)].sort();
  const right = [...new Set(expected)].sort();
  return left.length === raw.length
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function validIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function readNow(now: () => number): number {
  let value: unknown;
  try {
    value = now();
  } catch {
    throw configError();
  }
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw configError();
  return Number(value);
}

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < min || resolved > max) throw configError();
  return resolved;
}

function digestCanonical(value: unknown): string {
  return sha256Text(canonicalJson(value));
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw configError();
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (!isPlainRecord(value)) throw configError();
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`
  )).join(",")}}`;
}

function onboardingReceiptDigest(input: Readonly<{
  profileId: LocalClientOnboardingProfileId;
  action: LocalClientOnboardingAction;
  planId: string;
  transactionReceiptDigest: string;
}>): string {
  return createHash("sha256")
    .update("local-client-onboarding-receipt-v1\0", "utf8")
    .update(canonicalJson(input), "utf8")
    .digest("hex");
}

function configReceiptDigest(value: Readonly<Record<string, unknown>>): string {
  return sha256Text(JSON.stringify(Object.keys(value).sort().map((key) => [key, value[key]])));
}

function safeSha256Equal(left: unknown, right: unknown): boolean {
  if (
    typeof left !== "string"
    || typeof right !== "string"
    || !SHA256_PATTERN.test(left)
    || !SHA256_PATTERN.test(right)
  ) return false;
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
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

function safeErrorCode(value: unknown): string {
  return typeof value === "string" && /^[A-Z][A-Z0-9_:-]{0,127}$/u.test(value)
    ? value
    : "LOCAL_CLIENT_ONBOARDING_IDEMPOTENCY_REJECTED";
}

function rejectedOutcome(
  statusCode: number,
  code: string,
  message: string,
  operationInvoked: boolean,
  retryAllowed: boolean,
  retryAfterSeconds?: number,
): LocalClientGovernedOnboardingMutationOutcome {
  return Object.freeze({
    accepted: false,
    status: "rejected",
    statusCode: Number.isSafeInteger(statusCode) && statusCode >= 400 && statusCode <= 599 ? statusCode : 503,
    code: safeErrorCode(code),
    message,
    replayed: false,
    replayable: false,
    operationInvoked,
    retryAllowed,
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    result: null,
  });
}

function unknownOutcome(
  operationInvoked: boolean,
  replayed: boolean,
  statusCode: 409 | 503 = 409,
): LocalClientGovernedOnboardingMutationOutcome {
  return Object.freeze({
    accepted: false,
    status: "unknown-reconcile-required",
    statusCode,
    code: "LOCAL_CLIENT_ONBOARDING_OUTCOME_UNKNOWN",
    message: "The onboarding external-effect boundary did not return a confirmed durable outcome. Reconcile before any retry.",
    replayed,
    replayable: false,
    operationInvoked,
    retryAllowed: false,
    result: null,
  });
}

function onboardingError(
  code: LocalClientGovernedOnboardingErrorCode,
  message: string,
  category: LocalClientGovernedOnboardingError["category"],
  statusCode: number,
  retryable = false,
) {
  return new LocalClientGovernedOnboardingError(code, message, category, statusCode, retryable);
}

function configError() {
  return onboardingError(
    "LOCAL_CLIENT_ONBOARDING_API_CONFIGURATION_INVALID",
    "The governed onboarding API dependencies or options are invalid.",
    "configuration",
    503,
  );
}

function requestError() {
  return onboardingError(
    "LOCAL_CLIENT_ONBOARDING_API_REQUEST_INVALID",
    "The governed onboarding request has an invalid bounded shape.",
    "validation",
    400,
  );
}

function planUnknownError() {
  return onboardingError(
    "LOCAL_CLIENT_ONBOARDING_API_PLAN_UNKNOWN",
    "No subject-bound governed onboarding plan matches this request.",
    "conflict",
    409,
  );
}

function planMismatchError() {
  return onboardingError(
    "LOCAL_CLIENT_ONBOARDING_API_PLAN_MISMATCH",
    "The governed onboarding plan changed, expired, or belongs to another identity.",
    "conflict",
    409,
  );
}

function planCapacityError() {
  return onboardingError(
    "LOCAL_CLIENT_ONBOARDING_API_PLAN_UNKNOWN",
    "The bounded governed onboarding plan store is full.",
    "conflict",
    429,
  );
}

function approvalError() {
  return onboardingError(
    "LOCAL_CLIENT_ONBOARDING_API_APPROVAL_INVALID",
    "The exact one-time subject approval is missing, consumed, or invalid.",
    "auth",
    403,
  );
}

function idempotencyRequiredError() {
  return onboardingError(
    "LOCAL_CLIENT_ONBOARDING_API_IDEMPOTENCY_REQUIRED",
    "Governed onboarding mutations require one explicit Idempotency-Key.",
    "validation",
    400,
  );
}

function idempotencyDurabilityError() {
  return onboardingError(
    "LOCAL_CLIENT_ONBOARDING_API_IDEMPOTENCY_NOT_DURABLE",
    "Governed onboarding mutations require an available SQLite or PostgreSQL idempotency store.",
    "configuration",
    503,
  );
}

function externalEffectDurabilityError() {
  return onboardingError(
    "LOCAL_CLIENT_ONBOARDING_API_EXTERNAL_EFFECT_NOT_DURABLE",
    "Governed onboarding mutations require an enabled durable SQLite or PostgreSQL external-effect gate.",
    "configuration",
    503,
  );
}

function approvalIdempotencyConflictError(statusCode: number) {
  return onboardingError(
    "LOCAL_CLIENT_ONBOARDING_APPROVAL_IDEMPOTENCY_CONFLICT",
    "The approval Idempotency-Key is already bound to a different request or an active owner.",
    "conflict",
    Number.isSafeInteger(statusCode) && statusCode >= 400 && statusCode <= 599 ? statusCode : 409,
  );
}

function approvalOutcomeUnknownError(statusCode: 409 | 503) {
  return onboardingError(
    "LOCAL_CLIENT_ONBOARDING_APPROVAL_OUTCOME_UNKNOWN",
    "The durable approval outcome is unavailable or not replayable. Reconcile before any new approval attempt.",
    "integrity",
    statusCode,
  );
}

function dependencyError() {
  return onboardingError(
    "LOCAL_CLIENT_ONBOARDING_API_DEPENDENCY_FAILED",
    "A governed onboarding dependency returned an invalid or unavailable result.",
    "dependency",
    503,
  );
}
