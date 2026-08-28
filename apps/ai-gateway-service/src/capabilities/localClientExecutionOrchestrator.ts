import { createHash } from "node:crypto";

import {
  LOCAL_CLIENT_ADAPTER_RECEIPT_VERSION,
  type LocalClientAdapterDescriptor,
  type LocalClientAdapterInput,
  type LocalClientAdapterReceipt,
  type LocalClientAdapterRegistry,
  type VerifiedLocalClientAdapterTarget,
} from "./localClientAdapterRegistry.ts";
import {
  LOCAL_CLIENT_DISPATCH_INTENT_VERSION,
  LOCAL_CLIENT_DURABLE_RECEIPT_VERSION,
  type LocalClientDispatchIntent,
  type LocalClientDurableExecutionReceipt,
  type LocalClientReceiptReconciliationIdentity,
} from "./localClientExecutionReceiptReconciliation.ts";
import type {
  LocalClientRoutePlan,
  LocalClientRoutePlanReference,
} from "./localClientRoutePlanStore.ts";

export const LOCAL_CLIENT_EXECUTION_ORCHESTRATOR_BOUNDARIES = Object.freeze({
  providesHttpIdempotency: false as const,
  requiresOuterIdempotencyCoordinator: true as const,
  retriesAfterExternalEffectCommit: false as const,
  unknownOutcomeRequiresReconciliation: true as const,
  derivesFeedbackOnlyFromVerifiedCompletionReceipt: true as const,
  feedbackFailureChangesCompletedExecutionOutcome: false as const,
});

export interface LocalClientExecutionIdentity {
  readonly tenantId: string;
  readonly subjectId: string;
}

export interface LocalClientExecutionRequest extends LocalClientExecutionIdentity {
  readonly planId: string;
  readonly input: unknown;
  readonly effectKey: Readonly<{
    effectKeyHash?: unknown;
    effectKeyInvalid?: boolean;
  }>;
  readonly signal?: AbortSignal;
}

export interface ResolvedVerifiedLocalClientExecutionTarget
  extends VerifiedLocalClientAdapterTarget {
  readonly revision: number;
}

export interface LocalClientExecutionFence {
  readonly fingerprint: string;
  assertActive(phase: "reserve" | "commit" | "dispatch"): unknown | Promise<unknown>;
  release?(): unknown | Promise<unknown>;
}

type ApprovalRecord = Readonly<{
  approvalId?: unknown;
  planId?: unknown;
  tenantId?: unknown;
  userId?: unknown;
  planDigest?: unknown;
  approvedScopes?: unknown;
  status?: unknown;
  expiresAt?: unknown;
  revoked?: unknown;
}>;

type ApprovalDecision = Readonly<{
  approved?: unknown;
  consumed?: unknown;
  code?: unknown;
  reason?: unknown;
  approval?: ApprovalRecord;
}>;

type LifecycleSnapshot = Readonly<Record<string, unknown> & {
  success?: unknown;
  status?: unknown;
  cancelRequested?: unknown;
  pauseRequested?: unknown;
  tenantFingerprint?: unknown;
  subjectFingerprint?: unknown;
}>;

type ExternalEffectReservation = Readonly<{
  reservationFingerprint: string | null;
  commit(): Promise<void>;
}>;

export interface LocalClientVerifiedExecutionFeedbackInput {
  readonly eventId: string;
  readonly clientId: string;
  readonly taskId: string;
  readonly status: "success";
  readonly latencyMs: number;
  readonly requiredCapabilities: readonly string[];
  readonly observedAt: string;
}

export interface LocalClientVerifiedExecutionFeedbackAcceptance {
  readonly persisted: true;
  readonly exactlyOnce: boolean;
  readonly replayed: boolean;
  readonly queued?: boolean;
}

export interface LocalClientVerifiedExecutionFeedbackStageAcceptance {
  readonly persisted: true;
  readonly queued: boolean;
  readonly replayed: boolean;
  readonly state: "pending" | "delivered";
}

export interface LocalClientVerifiedExecutionFeedbackSink {
  stage?(
    input: LocalClientVerifiedExecutionFeedbackInput,
    scope: Readonly<{ tenantId: string; userId: string }>,
  ): LocalClientVerifiedExecutionFeedbackStageAcceptance
    | Promise<LocalClientVerifiedExecutionFeedbackStageAcceptance>;
  record(
    input: LocalClientVerifiedExecutionFeedbackInput,
    scope: Readonly<{ tenantId: string; userId: string }>,
  ): LocalClientVerifiedExecutionFeedbackAcceptance | Promise<LocalClientVerifiedExecutionFeedbackAcceptance>;
}

export interface LocalClientExecutionOrchestratorDependencies {
  readonly routePlanStore: {
    get(reference: LocalClientRoutePlanReference): LocalClientRoutePlan | Promise<LocalClientRoutePlan>;
    consume(reference: LocalClientRoutePlanReference): LocalClientRoutePlan | Promise<LocalClientRoutePlan>;
    verifyInput(
      reference: LocalClientRoutePlanReference,
      input: unknown,
    ): LocalClientAdapterInput | Promise<LocalClientAdapterInput>;
  };
  readonly approvalGate: {
    check(context: Record<string, unknown>): ApprovalDecision | Promise<ApprovalDecision>;
    consume(context: Record<string, unknown>): ApprovalDecision | Promise<ApprovalDecision>;
  };
  readonly lifecycle: {
    initialize(executionId: string, metadata: Record<string, unknown>): unknown | Promise<unknown>;
    start(executionId: string): unknown | Promise<unknown>;
    pause(executionId: string, reason?: string): unknown | Promise<unknown>;
    complete(
      executionId: string,
      finalStatus: "completed" | "failed" | "cancelled",
      summary?: Record<string, unknown>,
    ): unknown | Promise<unknown>;
    cancel(executionId: string, reason?: string): unknown | Promise<unknown>;
    getStatus(executionId: string): LifecycleSnapshot | Promise<LifecycleSnapshot>;
  };
  readonly externalEffectGate: {
    reserve(input: Record<string, unknown>): Promise<ExternalEffectReservation>;
  };
  readonly adapterRegistry: Pick<LocalClientAdapterRegistry, "lookup" | "execute">;
  readonly resolveVerifiedTarget: (input: Readonly<{
    plan: LocalClientRoutePlan;
    identity: LocalClientExecutionIdentity;
  }>) => ResolvedVerifiedLocalClientExecutionTarget | Promise<ResolvedVerifiedLocalClientExecutionTarget>;
  readonly acquireFence: (input: Readonly<{
    executionId: string;
    plan: LocalClientRoutePlan;
    identity: LocalClientExecutionIdentity;
    signal: AbortSignal;
  }>) => LocalClientExecutionFence | Promise<LocalClientExecutionFence>;
  readonly resolveReceiptJournal?: (input: Readonly<{
    plan: LocalClientRoutePlan;
    identity: LocalClientExecutionIdentity;
  }>) => LocalClientExecutionReceiptJournalPort | null;
  readonly feedbackSink?: LocalClientVerifiedExecutionFeedbackSink;
}

export interface LocalClientExecutionReceiptJournalPort {
  prepareDispatch(input: LocalClientReceiptReconciliationIdentity): unknown | Promise<unknown>;
  armDispatch(input: LocalClientReceiptReconciliationIdentity): unknown | Promise<unknown>;
  resolveArmedAsNotDispatched(executionId: string): unknown | Promise<unknown>;
  confirmReceipt(input: LocalClientDurableExecutionReceipt): unknown | Promise<unknown>;
  markFeedbackStaged(input: Readonly<{ executionId: string; receiptId: string }>): unknown | Promise<unknown>;
  markLifecycleFinalized(input: Readonly<{
    executionId: string;
    outcome: "completed" | "failed-before-effect";
  }>): unknown | Promise<unknown>;
}

export interface LocalClientExecutionOrchestratorOptions {
  readonly now?: () => number;
  readonly lifecyclePollMs?: number;
}

export type LocalClientExecutionCompletedResult = Readonly<{
  status: "completed";
  executionId: string;
  planId: string;
  planFingerprint: string;
  reservationFingerprint: string;
  externalEffectCommitted: true;
  retryAllowed: false;
  receipt: LocalClientAdapterReceipt;
  feedback: LocalClientAutomaticFeedbackResult;
}>;

export type LocalClientAutomaticFeedbackResult = Readonly<{
  source: "verified-governed-receipt";
  eventId: string;
  attempted: boolean;
  persisted: boolean;
  exactlyOnce: boolean;
  replayed: boolean;
  deliveryStatus: "persisted" | "queued" | "not-configured" | "failed";
  errorCode: "LOCAL_CLIENT_AUTOMATIC_FEEDBACK_NOT_CONFIGURED" | "LOCAL_CLIENT_AUTOMATIC_FEEDBACK_FAILED" | null;
}>;

export type LocalClientExecutionUnknownResult = Readonly<{
  status: "unknown-reconcile-required";
  executionId: string;
  planId: string;
  planFingerprint: string;
  reservationFingerprint: string | null;
  externalEffectCommitted: true;
  retryAllowed: false;
  receipt: null;
  errorCode: string;
  lifecyclePersisted: boolean;
}>;

export type LocalClientExecutionResult =
  | LocalClientExecutionCompletedResult
  | LocalClientExecutionUnknownResult;

export type LocalClientExecutionOrchestratorErrorCode =
  | "LOCAL_CLIENT_EXECUTION_REQUEST_INVALID"
  | "LOCAL_CLIENT_EXECUTION_ABORTED"
  | "LOCAL_CLIENT_EXECUTION_PLAN_IDENTITY_MISMATCH"
  | "LOCAL_CLIENT_EXECUTION_PLAN_EXPIRED"
  | "LOCAL_CLIENT_EXECUTION_INPUT_INVALID"
  | "LOCAL_CLIENT_EXECUTION_TARGET_CHANGED"
  | "LOCAL_CLIENT_EXECUTION_ADAPTER_CHANGED"
  | "LOCAL_CLIENT_EXECUTION_APPROVAL_REQUIRED"
  | "LOCAL_CLIENT_EXECUTION_APPROVAL_MISMATCH"
  | "LOCAL_CLIENT_EXECUTION_APPROVAL_SCOPE_MISMATCH"
  | "LOCAL_CLIENT_EXECUTION_APPROVAL_EXPIRED"
  | "LOCAL_CLIENT_EXECUTION_APPROVAL_CONSUME_FAILED"
  | "LOCAL_CLIENT_EXECUTION_PLAN_CONSUME_FAILED"
  | "LOCAL_CLIENT_EXECUTION_LIFECYCLE_FAILED"
  | "LOCAL_CLIENT_EXECUTION_FENCE_INVALID"
  | "LOCAL_CLIENT_EXECUTION_RESERVATION_INVALID"
  | "LOCAL_CLIENT_EXECUTION_RECEIPT_INVALID"
  | "LOCAL_CLIENT_EXECUTION_RECEIPT_RECONCILIATION_REQUIRED"
  | "LOCAL_CLIENT_EXECUTION_DISPATCH_INTENT_INVALID"
  | "LOCAL_CLIENT_EXECUTION_DURABLE_RECEIPT_NOT_CONFIRMED"
  | "LOCAL_CLIENT_EXECUTION_NOT_FOUND"
  | "LOCAL_CLIENT_EXECUTION_FORBIDDEN";

export class LocalClientExecutionOrchestratorError extends Error {
  readonly code: LocalClientExecutionOrchestratorErrorCode;
  readonly category: "validation" | "auth" | "lifecycle" | "concurrency" | "integrity" | "cancellation";
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: LocalClientExecutionOrchestratorErrorCode,
    message: string,
    category: LocalClientExecutionOrchestratorError["category"],
    statusCode: number,
    retryable = false,
  ) {
    super(message);
    this.name = "LocalClientExecutionOrchestratorError";
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const DISPATCH_INTENT_ID_PATTERN = /^lcdi_[a-f0-9]{64}$/u;
const DURABLE_RECEIPT_ID_PATTERN = /^lcdr_[a-f0-9]{64}$/u;
const DISPATCH_FENCING_TOKEN_PATTERN = /^(?:0|[1-9][0-9]{0,18})$/u;
const IDENTITY_MAX_LENGTH = 128;
const PLAN_KEYS = Object.freeze([
  "planVersion",
  "planId",
  "tenantId",
  "subjectId",
  "clientId",
  "clientRevision",
  "clientState",
  "clientTrustDecision",
  "adapterId",
  "adapterType",
  "adapterVersion",
  "capabilityId",
  "actionId",
  "inputSha256",
  "policyVersion",
  "createdAt",
  "expiresAt",
  "boundaries",
] as const);
const RECEIPT_KEYS = Object.freeze([
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
] as const);

export function createLocalClientExecutionOrchestrator(
  dependencies: LocalClientExecutionOrchestratorDependencies,
  options: LocalClientExecutionOrchestratorOptions = {},
) {
  assertDependencies(dependencies);
  const now = options.now ?? Date.now;
  const lifecyclePollMs = boundedInteger(options.lifecyclePollMs, 250, 0, 5_000);

  return Object.freeze({
    boundaries: LOCAL_CLIENT_EXECUTION_ORCHESTRATOR_BOUNDARIES,

    async execute(rawRequest: LocalClientExecutionRequest): Promise<LocalClientExecutionResult> {
      const request = normalizeExecutionRequest(rawRequest);
      throwIfAborted(request.signal);
      const identity = Object.freeze({ tenantId: request.tenantId, subjectId: request.subjectId });
      const reference = Object.freeze({
        tenantId: identity.tenantId,
        subjectId: identity.subjectId,
        planId: request.planId,
      });

      const plan = await dependencies.routePlanStore.get(reference);
      validatePlan(plan, identity, readNow(now));
      throwIfAborted(request.signal);
      const verifiedInput = validateVerifiedInput(
        await dependencies.routePlanStore.verifyInput(reference, request.input),
      );
      const resolvedTarget = await dependencies.resolveVerifiedTarget({ plan, identity });
      const adapterTarget = validateAndProjectTarget(plan, resolvedTarget);
      const adapterDescriptor = validateAdapterDescriptor(plan, dependencies.adapterRegistry.lookup(plan.adapterId));
      const adapterInput = composeAdapterInput(plan, verifiedInput, adapterDescriptor);
      const receiptJournal = dependencies.resolveReceiptJournal?.({ plan, identity }) ?? null;
      if (!receiptJournal) {
        throw orchestratorError(
          "LOCAL_CLIENT_EXECUTION_RECEIPT_RECONCILIATION_REQUIRED",
          "Governed local-client execution requires a durable receipt reconciliation journal.",
          "lifecycle",
          503,
        );
      }
      throwIfAborted(request.signal);

      const requiredScopes = buildLocalClientExecutionScopes(plan);
      const approvalContext = Object.freeze({
        planId: plan.planId,
        tenantId: identity.tenantId,
        userId: identity.subjectId,
        planDigest: plan.planId,
        requiredScopes,
      });
      const checkedApproval = validateApprovalDecision(
        await dependencies.approvalGate.check(approvalContext),
        "check",
        plan,
        identity,
        requiredScopes,
        readNow(now),
      );
      throwIfAborted(request.signal);

      let executionId = "";
      let lifecycleInitialized = false;
      let lifecycleStarted = false;
      let effectCommitted = false;
      const durableReceiptConfirmation: {
        value: Readonly<{
          receiptId: string;
          completedAtMs: number;
          intentIssuedAtMs: number;
        }> | null;
      } = { value: null };
      let reservationFingerprint: string | null = null;
      let fence: LocalClientExecutionFence | null = null;
      let lifecycleMonitor: { stop(): void } | null = null;
      let unlinkRequestSignal: (() => void) | null = null;
      const executionController = new AbortController();

      try {
        const consumedApproval = validateApprovalDecision(
          await dependencies.approvalGate.consume(approvalContext),
          "consume",
          plan,
          identity,
          requiredScopes,
          readNow(now),
          checkedApproval.approvalId,
        );
        const consumedPlan = await dependencies.routePlanStore.consume(reference);
        if (consumedPlan.planId !== plan.planId) {
          throw orchestratorError(
            "LOCAL_CLIENT_EXECUTION_PLAN_CONSUME_FAILED",
            "The consumed route plan did not match the approved immutable plan.",
            "integrity",
            409,
          );
        }

        executionId = createExecutionId(identity, plan.planId, consumedApproval.approvalId);
        assertLifecycleSuccess(await dependencies.lifecycle.initialize(executionId, {
          planFingerprint: plan.planId,
          publicPlanId: plan.planId,
          tenantFingerprint: identityFingerprint(identity.tenantId),
          subjectFingerprint: identityFingerprint(identity.subjectId),
          clientFingerprint: digestText(plan.clientId).slice(0, 16),
          adapterFingerprint: digestText(`${plan.adapterId}\0${plan.adapterVersion}`).slice(0, 16),
          actionFingerprint: digestText(`${plan.capabilityId}\0${plan.actionId}`).slice(0, 16),
          approvalFingerprint: digestText(consumedApproval.approvalId).slice(0, 16),
          outcome: "pending",
        }), "initialize");
        lifecycleInitialized = true;
        assertLifecycleSuccess(await dependencies.lifecycle.start(executionId), "start");
        lifecycleStarted = true;

        unlinkRequestSignal = linkAbortSignal(request.signal, executionController);
        lifecycleMonitor = startLifecycleMonitor({
          lifecycle: dependencies.lifecycle,
          executionId,
          controller: executionController,
          pollMs: lifecyclePollMs,
        });
        throwIfAborted(executionController.signal);

        fence = validateFence(await dependencies.acquireFence({
          executionId,
          plan,
          identity,
          signal: executionController.signal,
        }));
        throwIfAborted(executionController.signal);

        const receiptIdentity = Object.freeze({
          executionId,
          tenantId: identity.tenantId,
          subjectId: identity.subjectId,
          clientId: plan.clientId,
          capabilityId: plan.capabilityId,
          actionId: plan.actionId,
          planFingerprint: plan.planId,
          inputSha256: plan.inputSha256,
        }) satisfies LocalClientReceiptReconciliationIdentity;
        await receiptJournal.prepareDispatch(receiptIdentity);

        const reservation = await dependencies.externalEffectGate.reserve({
          ...request.effectKey,
          route: "/local-clients/execute",
          tenantId: identity.tenantId,
          effectType: "local-client:adapter-execution",
          payloadFingerprint: createLocalClientEffectPayloadFingerprint({
            plan,
            executionId,
            approvalId: consumedApproval.approvalId,
          }),
          fenceFingerprint: fence.fingerprint,
          fenceRequired: true,
          assertFence: (phase: "reserve" | "commit") => fence!.assertActive(phase),
        });
        reservationFingerprint = validateReservationFingerprint(reservation.reservationFingerprint);
        throwIfAborted(executionController.signal);
        const dispatchIntent = validateDispatchIntentAdmission(
          await receiptJournal.armDispatch(receiptIdentity),
          receiptIdentity,
        );
        try {
          await reservation.commit();
        } catch (commitError) {
          validateArmedNotDispatchedResolution(
            await receiptJournal.resolveArmedAsNotDispatched(executionId),
          );
          throw commitError;
        }
        effectCommitted = true;
        try {
          throwIfAborted(executionController.signal);
        } catch (preAdapterAbort) {
          validateArmedNotDispatchedResolution(
            await receiptJournal.resolveArmedAsNotDispatched(executionId),
          );
          throw preAdapterAbort;
        }

        const receipt = validateCompletedReceipt(
          await dependencies.adapterRegistry.execute({
            executionId,
            tenantId: identity.tenantId,
            subjectId: identity.subjectId,
            client: adapterTarget,
            capabilityId: plan.capabilityId,
            actionId: plan.actionId,
            input: adapterInput,
            receiptReconciliation: Object.freeze({
              intent: dispatchIntent,
              async confirmReceipt(durableReceipt: LocalClientDurableExecutionReceipt) {
                const confirmation = validateDurableReceiptConfirmation(
                  await receiptJournal.confirmReceipt(durableReceipt),
                  executionId,
                  dispatchIntent.intentId,
                );
                if (
                  durableReceiptConfirmation.value !== null
                  && (
                    durableReceiptConfirmation.value.receiptId !== confirmation.receiptId
                    || durableReceiptConfirmation.value.completedAtMs !== confirmation.completedAtMs
                  )
                ) {
                  throw durableReceiptNotConfirmedError();
                }
                durableReceiptConfirmation.value = Object.freeze({
                  ...confirmation,
                  intentIssuedAtMs: dispatchIntent.issuedAtMs,
                });
                return confirmation;
              },
            }),
            signal: executionController.signal,
            assertAuthority: (phase: "dispatch") => fence!.assertActive(phase),
          }),
          plan,
          executionId,
        );
        const confirmedDurableReceipt = durableReceiptConfirmation.value;
        if (confirmedDurableReceipt === null) throw durableReceiptNotConfirmedError();
        const feedbackDelivery = createLocalClientVerifiedReceiptFeedbackDelivery({
          tenantId: identity.tenantId,
          subjectId: identity.subjectId,
          clientId: plan.clientId,
          capabilityId: plan.capabilityId,
          executionId,
          durableReceiptId: confirmedDurableReceipt.receiptId,
          intentIssuedAtMs: confirmedDurableReceipt.intentIssuedAtMs,
          completedAtMs: confirmedDurableReceipt.completedAtMs,
        });
        const stagedFeedback = await stageVerifiedExecutionFeedback({
          sink: dependencies.feedbackSink,
          delivery: feedbackDelivery,
        });
        const receiptJournalFeedbackStaged = stagedFeedback.persisted
          ? await safelyMarkReceiptFeedbackStaged(
            receiptJournal,
            executionId,
            confirmedDurableReceipt.receiptId,
          )
          : false;
        assertLifecycleSuccess(await dependencies.lifecycle.complete(executionId, "completed", {
          outcome: "completed",
          retryAllowed: false,
          planFingerprint: plan.planId,
          reservationFingerprint,
          receiptFingerprint: digestText(receipt.receiptId).slice(0, 16),
          receiptJournalFeedbackStaged,
        }), "complete");
        await safelyMarkReceiptLifecycleFinalized(receiptJournal, executionId);
        const feedback = await deliverVerifiedExecutionFeedback({
          sink: dependencies.feedbackSink,
          delivery: feedbackDelivery,
          staged: stagedFeedback,
        });

        return Object.freeze({
          status: "completed",
          executionId,
          planId: plan.planId,
          planFingerprint: plan.planId,
          reservationFingerprint,
          externalEffectCommitted: true,
          retryAllowed: false,
          receipt,
          feedback,
        });
      } catch (error) {
        if (effectCommitted) {
          const errorCode = safeErrorCode(error);
          const confirmedDurableReceipt = durableReceiptConfirmation.value;
          const lifecyclePersisted = confirmedDurableReceipt === null
            ? await persistUnknownOutcome(
              dependencies.lifecycle,
              executionId,
              plan.planId,
              reservationFingerprint,
              errorCode,
            )
            : await persistConfirmedReceiptOutcome(
              dependencies.lifecycle,
              executionId,
              plan.planId,
              reservationFingerprint,
              confirmedDurableReceipt.receiptId,
              errorCode,
            );
          return Object.freeze({
            status: "unknown-reconcile-required",
            executionId,
            planId: plan.planId,
            planFingerprint: plan.planId,
            reservationFingerprint,
            externalEffectCommitted: true,
            retryAllowed: false,
            receipt: null,
            errorCode,
            lifecyclePersisted,
          });
        }
        await persistPreCommitFailure({
          lifecycle: dependencies.lifecycle,
          executionId,
          lifecycleInitialized,
          lifecycleStarted,
          planFingerprint: plan.planId,
          error,
        });
        throw error;
      } finally {
        lifecycleMonitor?.stop();
        unlinkRequestSignal?.();
        try {
          await fence?.release?.();
        } catch {
          // A release failure cannot rewrite the already persisted outcome.
        }
      }
    },

    async getStatus(input: Readonly<LocalClientExecutionIdentity & { executionId: string }>) {
      const request = normalizeExecutionControlRequest(input);
      const snapshot = await dependencies.lifecycle.getStatus(request.executionId);
      assertExecutionAccess(snapshot, request);
      const { tenantFingerprint: _tenant, subjectFingerprint: _subject, ...safe } = snapshot;
      return safe;
    },

    async cancel(input: Readonly<LocalClientExecutionIdentity & { executionId: string; reason?: string }>) {
      const request = normalizeExecutionControlRequest(input, true);
      const snapshot = await dependencies.lifecycle.getStatus(request.executionId);
      assertExecutionAccess(snapshot, request);
      return dependencies.lifecycle.cancel(request.executionId, request.reason);
    },
  });
}

export function buildLocalClientExecutionScopes(plan: Pick<LocalClientRoutePlan, "planId">): readonly string[] {
  const planId = requiredDigest(plan.planId, "planId");
  return Object.freeze([
    "local-client:execute",
    "local-client:external-effect",
    `local-client:plan:${planId}`,
  ].sort());
}

export function createLocalClientEffectPayloadFingerprint({
  plan,
  executionId,
  approvalId,
}: {
  plan: LocalClientRoutePlan;
  executionId: string;
  approvalId: string;
}): string {
  const allPlanFields = Object.fromEntries(PLAN_KEYS.map((key) => [key, plan[key]]));
  return digestText(stableStringify({
    schema: "local-client-external-effect-v1",
    plan: allPlanFields,
    executionId,
    approvalId,
  }));
}

function normalizeExecutionRequest(input: LocalClientExecutionRequest) {
  assertPlainObject(input, "LOCAL_CLIENT_EXECUTION_REQUEST_INVALID");
  assertAllowedKeys(input, ["tenantId", "subjectId", "planId", "input", "effectKey", "signal"]);
  const tenantId = normalizeIdentity(input.tenantId);
  const subjectId = normalizeIdentity(input.subjectId);
  const planId = requiredDigest(input.planId, "planId");
  assertPlainObject(input.effectKey, "LOCAL_CLIENT_EXECUTION_REQUEST_INVALID");
  assertAllowedKeys(input.effectKey, ["effectKeyHash", "effectKeyInvalid"]);
  if (input.signal !== undefined && !(input.signal instanceof AbortSignal)) {
    throw requestError();
  }
  return {
    tenantId,
    subjectId,
    planId,
    input: input.input,
    effectKey: Object.freeze({
      ...(input.effectKey.effectKeyHash === undefined ? {} : { effectKeyHash: input.effectKey.effectKeyHash }),
      ...(input.effectKey.effectKeyInvalid === undefined ? {} : { effectKeyInvalid: input.effectKey.effectKeyInvalid }),
    }),
    signal: input.signal,
  };
}

function normalizeExecutionControlRequest(
  input: Readonly<LocalClientExecutionIdentity & { executionId: string; reason?: string }>,
  includeReason = false,
) {
  assertPlainObject(input, "LOCAL_CLIENT_EXECUTION_REQUEST_INVALID");
  assertAllowedKeys(input, includeReason
    ? ["tenantId", "subjectId", "executionId", "reason"]
    : ["tenantId", "subjectId", "executionId"]);
  const executionId = boundedText(input.executionId, 256);
  const reason = includeReason ? boundedText(input.reason ?? "cancelled_by_operator", 512) : undefined;
  return {
    tenantId: normalizeIdentity(input.tenantId),
    subjectId: normalizeIdentity(input.subjectId),
    executionId,
    ...(reason ? { reason } : {}),
  };
}

function validatePlan(plan: LocalClientRoutePlan, identity: LocalClientExecutionIdentity, nowMs: number) {
  assertPlainObject(plan, "LOCAL_CLIENT_EXECUTION_REQUEST_INVALID");
  assertExactKeys(plan, PLAN_KEYS);
  requiredDigest(plan.planId, "planId");
  requiredDigest(plan.inputSha256, "inputSha256");
  if (plan.tenantId !== identity.tenantId || plan.subjectId !== identity.subjectId) {
    throw orchestratorError(
      "LOCAL_CLIENT_EXECUTION_PLAN_IDENTITY_MISMATCH",
      "The route plan does not belong to the authenticated tenant and subject.",
      "auth",
      404,
    );
  }
  if (plan.clientState !== "verified" || plan.clientTrustDecision !== "verified") {
    throw targetChangedError();
  }
  const expiresAt = Date.parse(plan.expiresAt);
  if (!Number.isFinite(expiresAt) || nowMs >= expiresAt) {
    throw orchestratorError(
      "LOCAL_CLIENT_EXECUTION_PLAN_EXPIRED",
      "The immutable route plan has expired.",
      "lifecycle",
      410,
    );
  }
}

function validateVerifiedInput(input: LocalClientAdapterInput): LocalClientAdapterInput {
  assertPlainObject(input, "LOCAL_CLIENT_EXECUTION_INPUT_INVALID");
  if (Object.hasOwn(input, "planFingerprint")) {
    throw inputError();
  }
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!key || key.length > 64 || !/^[A-Za-z][A-Za-z0-9_]*$/u.test(key)) throw inputError();
    if (
      !new Set(["string", "number", "boolean"]).has(typeof value)
      || (typeof value === "number" && !Number.isFinite(value))
      || (typeof value === "string" && value.length > 4_096)
    ) {
      throw inputError();
    }
    output[key] = value;
  }
  return Object.freeze(output);
}

function validateAndProjectTarget(
  plan: LocalClientRoutePlan,
  target: ResolvedVerifiedLocalClientExecutionTarget,
): VerifiedLocalClientAdapterTarget {
  assertPlainObject(target, "LOCAL_CLIENT_EXECUTION_TARGET_CHANGED");
  if (
    target.descriptorVersion !== "verified-local-client-adapter-target-v1"
    || target.state !== "verified"
    || target.trustDecision !== "verified"
    || target.clientId !== plan.clientId
    || target.revision !== plan.clientRevision
    || target.adapter?.id !== plan.adapterId
    || target.adapter?.type !== plan.adapterType
    || target.adapter?.version !== plan.adapterVersion
    || !Array.isArray(target.capabilityIds)
    || !target.capabilityIds.includes(plan.capabilityId)
  ) {
    throw targetChangedError();
  }
  return Object.freeze({
    descriptorVersion: "verified-local-client-adapter-target-v1",
    clientId: target.clientId,
    state: "verified",
    trustDecision: "verified",
    adapter: Object.freeze({
      id: target.adapter.id,
      type: target.adapter.type,
      version: target.adapter.version,
    }),
    capabilityIds: Object.freeze([...target.capabilityIds]),
  });
}

function validateAdapterDescriptor(
  plan: LocalClientRoutePlan,
  descriptor: LocalClientAdapterDescriptor | null,
): LocalClientAdapterDescriptor {
  const action = descriptor?.actions.find((candidate) => candidate.actionId === plan.actionId);
  if (
    !descriptor
    || descriptor.id !== plan.adapterId
    || descriptor.type !== plan.adapterType
    || descriptor.version !== plan.adapterVersion
    || !action
    || action.capabilityId !== plan.capabilityId
  ) {
    throw orchestratorError(
      "LOCAL_CLIENT_EXECUTION_ADAPTER_CHANGED",
      "The registered adapter or action no longer matches the immutable route plan.",
      "integrity",
      409,
    );
  }
  return descriptor;
}

function composeAdapterInput(
  plan: LocalClientRoutePlan,
  verifiedInput: LocalClientAdapterInput,
  descriptor: LocalClientAdapterDescriptor,
): LocalClientAdapterInput {
  const input = Object.freeze({
    ...verifiedInput,
    planFingerprint: plan.planId,
  });
  const action = descriptor.actions.find((candidate) => candidate.actionId === plan.actionId)!;
  const fields = new Map(action.inputSchema.fields.map((field) => [field.name, field]));
  for (const [key, value] of Object.entries(input)) {
    const field = fields.get(key);
    if (!field || typeof value !== field.valueType) throw inputError();
  }
  for (const field of action.inputSchema.fields) {
    if (field.required && !Object.hasOwn(input, field.name)) throw inputError();
  }
  return input;
}

function validateApprovalDecision(
  decision: ApprovalDecision,
  phase: "check" | "consume",
  plan: LocalClientRoutePlan,
  identity: LocalClientExecutionIdentity,
  requiredScopes: readonly string[],
  nowMs: number,
  expectedApprovalId?: string,
) {
  if (!decision || decision.approved !== true || (phase === "consume" && decision.consumed !== true)) {
    throw orchestratorError(
      phase === "check"
        ? "LOCAL_CLIENT_EXECUTION_APPROVAL_REQUIRED"
        : "LOCAL_CLIENT_EXECUTION_APPROVAL_CONSUME_FAILED",
      "A current one-time approval for the exact immutable plan is required.",
      "auth",
      409,
    );
  }
  const approval = decision.approval;
  const approvalId = boundedText(approval?.approvalId, 256);
  if (
    (expectedApprovalId !== undefined && approvalId !== expectedApprovalId)
    || approval?.planId !== plan.planId
    || approval?.tenantId !== identity.tenantId
    || approval?.userId !== identity.subjectId
    || approval?.planDigest !== plan.planId
    || approval?.revoked === true
    || (phase === "check" && approval?.status !== "approved")
    || (phase === "consume" && approval?.status !== "consumed")
  ) {
    throw orchestratorError(
      "LOCAL_CLIENT_EXECUTION_APPROVAL_MISMATCH",
      "The approval is not bound to the exact plan, tenant, and subject.",
      "integrity",
      409,
    );
  }
  const approvedScopes = normalizeScopes(approval?.approvedScopes);
  if (!sameStringSet(approvedScopes, requiredScopes)) {
    throw orchestratorError(
      "LOCAL_CLIENT_EXECUTION_APPROVAL_SCOPE_MISMATCH",
      "Approved scopes must exactly equal the server-derived execution scopes.",
      "auth",
      409,
    );
  }
  const expiresAt = Date.parse(String(approval?.expiresAt ?? ""));
  if (!Number.isFinite(expiresAt) || nowMs >= expiresAt) {
    throw orchestratorError(
      "LOCAL_CLIENT_EXECUTION_APPROVAL_EXPIRED",
      "The execution approval has expired.",
      "auth",
      409,
    );
  }
  return { approvalId, approvedScopes, expiresAt };
}

function validateFence(fence: LocalClientExecutionFence): LocalClientExecutionFence {
  if (
    !fence
    || typeof fence !== "object"
    || !SHA256_PATTERN.test(String(fence.fingerprint ?? ""))
    || typeof fence.assertActive !== "function"
    || (fence.release !== undefined && typeof fence.release !== "function")
  ) {
    throw orchestratorError(
      "LOCAL_CLIENT_EXECUTION_FENCE_INVALID",
      "A bounded active execution fence is required.",
      "concurrency",
      409,
    );
  }
  return fence;
}

function validateReservationFingerprint(value: unknown): string {
  const normalized = String(value ?? "").trim();
  if (!/^[a-f0-9]{16,64}$/u.test(normalized)) {
    throw orchestratorError(
      "LOCAL_CLIENT_EXECUTION_RESERVATION_INVALID",
      "The durable external-effect reservation was not confirmed.",
      "integrity",
      503,
    );
  }
  return normalized;
}

function validateDispatchIntentAdmission(
  raw: unknown,
  identity: LocalClientReceiptReconciliationIdentity,
): LocalClientDispatchIntent {
  if (!hasExactPlainKeys(raw, ["dispatchAllowed", "replayed", "intent", "record"])) {
    throw dispatchIntentInvalidError();
  }
  if (raw.dispatchAllowed !== true || raw.replayed !== false) throw dispatchIntentInvalidError();
  const intent = raw.intent;
  if (!hasExactPlainKeys(intent, [
    "protocolVersion",
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
    "issuedAtMs",
    "expiresAtMs",
    "signature",
  ])) throw dispatchIntentInvalidError();
  if (
    intent.protocolVersion !== LOCAL_CLIENT_DISPATCH_INTENT_VERSION
    || !DISPATCH_INTENT_ID_PATTERN.test(String(intent.intentId ?? ""))
    || intent.executionId !== identity.executionId
    || intent.planFingerprint !== identity.planFingerprint
    || intent.inputSha256 !== identity.inputSha256
    || !DISPATCH_FENCING_TOKEN_PATTERN.test(String(intent.dispatchFencingToken ?? ""))
    || String(intent.dispatchFencingToken) === "0"
    || !Number.isSafeInteger(intent.issuedAtMs)
    || !Number.isSafeInteger(intent.expiresAtMs)
    || Number(intent.expiresAtMs) <= Number(intent.issuedAtMs)
    || ![
      intent.executionBindingHmac,
      intent.tenantBindingHmac,
      intent.subjectBindingHmac,
      intent.clientBindingHmac,
      intent.routeBindingHmac,
      intent.identityBindingHmac,
      intent.signature,
    ].every((value) => SHA256_PATTERN.test(String(value ?? "")))
  ) throw dispatchIntentInvalidError();
  return Object.freeze({ ...(intent as unknown as LocalClientDispatchIntent) });
}

function validateDurableReceiptConfirmation(
  raw: unknown,
  executionId: string,
  intentId: string,
): Readonly<{ receiptId: string; completedAtMs: number }> {
  if (!hasExactPlainKeys(raw, ["confirmed", "replayed", "receipt", "record"])) {
    throw durableReceiptNotConfirmedError();
  }
  if (
    typeof raw.confirmed !== "boolean"
    || typeof raw.replayed !== "boolean"
    || (raw.confirmed === raw.replayed)
    || !hasExactPlainKeys(raw.receipt, [
      "protocolVersion",
      "receiptId",
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
      "completedAtMs",
      "executionMode",
      "externalEffectPerformed",
      "status",
      "signature",
    ])
    || raw.receipt.executionId !== executionId
    || raw.receipt.protocolVersion !== LOCAL_CLIENT_DURABLE_RECEIPT_VERSION
    || raw.receipt.intentId !== intentId
    || !DURABLE_RECEIPT_ID_PATTERN.test(String(raw.receipt.receiptId ?? ""))
    || raw.receipt.executionMode !== "governed"
    || raw.receipt.externalEffectPerformed !== true
    || raw.receipt.status !== "completed"
    || !Number.isSafeInteger(raw.receipt.completedAtMs)
    || Number(raw.receipt.completedAtMs) < 0
  ) throw durableReceiptNotConfirmedError();
  return Object.freeze({
    receiptId: String(raw.receipt.receiptId),
    completedAtMs: Number(raw.receipt.completedAtMs),
  });
}

async function safelyMarkReceiptFeedbackStaged(
  journal: LocalClientExecutionReceiptJournalPort,
  executionId: string,
  receiptId: string,
): Promise<boolean> {
  try {
    const result = await journal.markFeedbackStaged({ executionId, receiptId });
    return hasExactPlainKeys(result, ["staged", "replayed", "record"])
      && typeof result.staged === "boolean"
      && typeof result.replayed === "boolean"
      && result.staged !== result.replayed;
  } catch {
    return false;
  }
}

async function safelyMarkReceiptLifecycleFinalized(
  journal: LocalClientExecutionReceiptJournalPort,
  executionId: string,
): Promise<boolean> {
  try {
    const result = await journal.markLifecycleFinalized({ executionId, outcome: "completed" });
    return hasExactPlainKeys(result, ["finalized", "replayed", "record"])
      && typeof result.finalized === "boolean"
      && typeof result.replayed === "boolean"
      && result.finalized !== result.replayed;
  } catch {
    return false;
  }
}

function dispatchIntentInvalidError(): LocalClientExecutionOrchestratorError {
  return orchestratorError(
    "LOCAL_CLIENT_EXECUTION_DISPATCH_INTENT_INVALID",
    "The durable local-client dispatch intent was not admitted exactly once.",
    "integrity",
    503,
  );
}

function durableReceiptNotConfirmedError(): LocalClientExecutionOrchestratorError {
  return orchestratorError(
    "LOCAL_CLIENT_EXECUTION_DURABLE_RECEIPT_NOT_CONFIRMED",
    "The client did not commit a valid durable receipt for this execution.",
    "integrity",
    503,
  );
}

function validateCompletedReceipt(
  receipt: LocalClientAdapterReceipt,
  plan: LocalClientRoutePlan,
  executionId: string,
): LocalClientAdapterReceipt {
  if (
    !receipt
    || !hasExactPlainKeys(receipt, RECEIPT_KEYS)
    || receipt.receiptVersion !== LOCAL_CLIENT_ADAPTER_RECEIPT_VERSION
    || typeof receipt.receiptId !== "string"
    || !/^[a-z0-9][a-z0-9._:-]{7,127}$/u.test(receipt.receiptId)
    || receipt.executionId !== executionId
    || receipt.clientId !== plan.clientId
    || receipt.adapterId !== plan.adapterId
    || receipt.adapterType !== plan.adapterType
    || receipt.adapterVersion !== plan.adapterVersion
    || receipt.capabilityId !== plan.capabilityId
    || receipt.actionId !== plan.actionId
    || receipt.planFingerprint !== plan.planId
    || receipt.executionMode !== "governed"
    || receipt.externalEffectPerformed !== true
    || receipt.status !== "completed"
  ) {
    throw orchestratorError(
      "LOCAL_CLIENT_EXECUTION_RECEIPT_INVALID",
      "Only a verified governed completion receipt can complete the lifecycle.",
      "integrity",
      502,
    );
  }
  return Object.freeze({
    receiptVersion: receipt.receiptVersion,
    receiptId: receipt.receiptId,
    executionId: receipt.executionId,
    adapterId: receipt.adapterId,
    adapterType: receipt.adapterType,
    adapterVersion: receipt.adapterVersion,
    clientId: receipt.clientId,
    capabilityId: receipt.capabilityId,
    actionId: receipt.actionId,
    planFingerprint: receipt.planFingerprint,
    executionMode: receipt.executionMode,
    externalEffectPerformed: receipt.externalEffectPerformed,
    status: receipt.status,
  });
}

export type LocalClientVerifiedReceiptFeedbackDelivery = Readonly<{
  eventId: string;
  input: LocalClientVerifiedExecutionFeedbackInput;
  scope: Readonly<{ tenantId: string; userId: string }>;
}>;

type StagedVerifiedExecutionFeedback = Readonly<{
  configured: boolean;
  attempted: boolean;
  persisted: boolean;
  replayed: boolean;
  state: "pending" | "delivered" | null;
}>;

export function createLocalClientVerifiedReceiptFeedbackDelivery(input: Readonly<{
  tenantId: string;
  subjectId: string;
  clientId: string;
  capabilityId: string;
  executionId: string;
  durableReceiptId: string;
  intentIssuedAtMs: number;
  completedAtMs: number;
}>): LocalClientVerifiedReceiptFeedbackDelivery {
  const eventId = createLocalClientVerifiedReceiptFeedbackEventId(
    input.executionId,
    input.durableReceiptId,
  );
  const observedAt = canonicalFeedbackTimestamp(input.completedAtMs);
  const intentIssuedAtMs = canonicalFeedbackTimestampMs(input.intentIssuedAtMs);
  return Object.freeze({
    eventId,
    input: Object.freeze({
      eventId,
      clientId: input.clientId,
      taskId: input.executionId,
      status: "success",
      latencyMs: boundedFeedbackLatency(input.completedAtMs - intentIssuedAtMs),
      requiredCapabilities: Object.freeze([input.capabilityId]),
      observedAt,
    }),
    scope: Object.freeze({
      tenantId: input.tenantId,
      userId: input.subjectId,
    }),
  });
}

export function createLocalClientVerifiedReceiptFeedbackEventId(
  executionId: string,
  durableReceiptId: string,
): string {
  if (
    !/^lc-exec-[a-f0-9]{64}$/u.test(executionId)
    || !DURABLE_RECEIPT_ID_PATTERN.test(durableReceiptId)
  ) throw requestError();
  return `lcfb-${digestText(`durable-client-receipt\0${executionId}\0${durableReceiptId}`)}`;
}

async function stageVerifiedExecutionFeedback(input: Readonly<{
  sink: LocalClientVerifiedExecutionFeedbackSink | undefined;
  delivery: LocalClientVerifiedReceiptFeedbackDelivery;
}>): Promise<StagedVerifiedExecutionFeedback> {
  if (!input.sink?.stage) {
    return Object.freeze({
      configured: false,
      attempted: false,
      persisted: false,
      replayed: false,
      state: null,
    });
  }
  try {
    const acceptance = validateLocalClientVerifiedExecutionFeedbackStageAcceptance(
      await input.sink.stage(input.delivery.input, input.delivery.scope),
    );
    return Object.freeze({
      configured: true,
      attempted: true,
      persisted: true,
      replayed: acceptance.replayed,
      state: acceptance.state,
    });
  } catch {
    return Object.freeze({
      configured: true,
      attempted: true,
      persisted: false,
      replayed: false,
      state: null,
    });
  }
}

export function validateLocalClientVerifiedExecutionFeedbackStageAcceptance(
  value: unknown,
): LocalClientVerifiedExecutionFeedbackStageAcceptance {
  if (
    !hasExactPlainKeys(value, ["persisted", "queued", "replayed", "state"])
    || value.persisted !== true
    || typeof value.queued !== "boolean"
    || typeof value.replayed !== "boolean"
    || (value.state !== "pending" && value.state !== "delivered")
    || (value.state === "pending" && value.queued !== true)
    || (value.state === "delivered" && value.queued !== false)
  ) {
    throw orchestratorError(
      "LOCAL_CLIENT_EXECUTION_RECEIPT_INVALID",
      "Feedback outbox did not confirm an exact durable staging result.",
      "integrity",
      503,
    );
  }
  return Object.freeze({
    persisted: true,
    queued: value.queued,
    replayed: value.replayed,
    state: value.state,
  });
}

async function deliverVerifiedExecutionFeedback(input: Readonly<{
  sink: LocalClientVerifiedExecutionFeedbackSink | undefined;
  delivery: LocalClientVerifiedReceiptFeedbackDelivery;
  staged: StagedVerifiedExecutionFeedback;
}>): Promise<LocalClientAutomaticFeedbackResult> {
  const eventId = input.delivery.eventId;
  if (!input.sink) {
    return Object.freeze({
      source: "verified-governed-receipt",
      eventId,
      attempted: false,
      persisted: false,
      exactlyOnce: false,
      replayed: false,
      deliveryStatus: "not-configured",
      errorCode: "LOCAL_CLIENT_AUTOMATIC_FEEDBACK_NOT_CONFIGURED",
    });
  }
  if (input.staged.configured && !input.staged.persisted) {
    return Object.freeze({
      source: "verified-governed-receipt",
      eventId,
      attempted: true,
      persisted: false,
      exactlyOnce: false,
      replayed: false,
      deliveryStatus: "failed",
      errorCode: "LOCAL_CLIENT_AUTOMATIC_FEEDBACK_FAILED",
    });
  }
  try {
    const acceptance = await input.sink.record(input.delivery.input, input.delivery.scope);
    if (
      !acceptance
      || acceptance.persisted !== true
      || typeof acceptance.exactlyOnce !== "boolean"
      || typeof acceptance.replayed !== "boolean"
    ) {
      throw new Error("Feedback sink did not confirm exactly-once persistence.");
    }
    if (acceptance.exactlyOnce !== true) {
      if (!input.staged.persisted || acceptance.queued !== true) {
        throw new Error("Feedback sink did not confirm durable queued delivery.");
      }
      return Object.freeze({
        source: "verified-governed-receipt",
        eventId,
        attempted: true,
        persisted: true,
        exactlyOnce: false,
        replayed: acceptance.replayed || input.staged.replayed,
        deliveryStatus: "queued",
        errorCode: null,
      });
    }
    return Object.freeze({
      source: "verified-governed-receipt",
      eventId,
      attempted: true,
      persisted: true,
      exactlyOnce: true,
      replayed: acceptance.replayed,
      deliveryStatus: "persisted",
      errorCode: null,
    });
  } catch {
    // The governed action and its lifecycle are already durably completed.
    // Feedback is observable but can never rewrite that outcome or authorize a retry.
    if (input.staged.persisted) {
      return Object.freeze({
        source: "verified-governed-receipt",
        eventId,
        attempted: true,
        persisted: true,
        exactlyOnce: input.staged.state === "delivered",
        replayed: input.staged.replayed,
        deliveryStatus: input.staged.state === "delivered" ? "persisted" : "queued",
        errorCode: null,
      });
    }
    return Object.freeze({
      source: "verified-governed-receipt",
      eventId,
      attempted: true,
      persisted: false,
      exactlyOnce: false,
      replayed: false,
      deliveryStatus: "failed",
      errorCode: "LOCAL_CLIENT_AUTOMATIC_FEEDBACK_FAILED",
    });
  }
}

function boundedFeedbackLatency(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(24 * 60 * 60_000, Math.round(value)));
}

function canonicalFeedbackTimestampMs(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw requestError();
  try {
    new Date(value).toISOString();
  } catch {
    throw requestError();
  }
  return value;
}

function canonicalFeedbackTimestamp(value: number): string {
  return new Date(canonicalFeedbackTimestampMs(value)).toISOString();
}

async function persistUnknownOutcome(
  lifecycle: LocalClientExecutionOrchestratorDependencies["lifecycle"],
  executionId: string,
  planFingerprint: string,
  reservationFingerprint: string | null,
  errorCode: string,
) {
  if (!executionId) return false;
  try {
    const reason = stableStringify({
      marker: "local-client-unknown-reconcile-required-v1",
      retryAllowed: false,
      externalEffectCommitted: true,
      planFingerprint,
      reservationFingerprint,
      errorCode,
    });
    const result = await lifecycle.pause(executionId, reason);
    if (
      !hasExactDataFields(result, ["success", "status", "pauseRequested"])
      || result.success !== true
      || result.status !== "running"
      || result.pauseRequested !== true
    ) throw new Error("Unknown outcome pause marker was not durably persisted.");
    return true;
  } catch {
    return false;
  }
}

function validateArmedNotDispatchedResolution(raw: unknown): void {
  if (
    !hasExactPlainKeys(raw, ["resolved", "replayed", "record"])
    || raw.resolved !== true
    || raw.replayed !== false
    || !raw.record
    || typeof raw.record !== "object"
    || (raw.record as { state?: unknown }).state !== "armed-not-dispatched-confirmed"
  ) throw dispatchIntentInvalidError();
}

function hasExactDataFields(value: unknown, required: readonly string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return required.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return Boolean(descriptor && "value" in descriptor);
  }) && Reflect.ownKeys(value).every((key) => {
    if (typeof key !== "string") return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return Boolean(descriptor && "value" in descriptor);
  });
}

async function persistConfirmedReceiptOutcome(
  lifecycle: LocalClientExecutionOrchestratorDependencies["lifecycle"],
  executionId: string,
  planFingerprint: string,
  reservationFingerprint: string | null,
  durableReceiptId: string,
  errorCode: string,
) {
  if (!executionId) return false;
  try {
    const result = await lifecycle.complete(executionId, "completed", {
      outcome: "completed-receipt-confirmed-recovery-pending",
      retryAllowed: false,
      externalEffectCommitted: true,
      planFingerprint,
      reservationFingerprint,
      durableReceiptFingerprint: digestText(durableReceiptId).slice(0, 16),
      errorCode,
    });
    assertLifecycleSuccess(result, "complete");
    return true;
  } catch {
    // The authenticated receipt journal remains the recovery authority. Never
    // regress a receipt-proven completion into a failed lifecycle state.
    return false;
  }
}

async function persistPreCommitFailure({
  lifecycle,
  executionId,
  lifecycleInitialized,
  lifecycleStarted,
  planFingerprint,
  error,
}: {
  lifecycle: LocalClientExecutionOrchestratorDependencies["lifecycle"];
  executionId: string;
  lifecycleInitialized: boolean;
  lifecycleStarted: boolean;
  planFingerprint: string;
  error: unknown;
}) {
  if (!executionId || !lifecycleInitialized) return;
  try {
    if (!lifecycleStarted) {
      assertLifecycleSuccess(
        await lifecycle.cancel(executionId, safeErrorCode(error)),
        "cancel",
      );
      return;
    }
    assertLifecycleSuccess(await lifecycle.complete(
      executionId,
      isAbortError(error) ? "cancelled" : "failed",
      {
        outcome: isAbortError(error) ? "cancelled-before-effect" : "failed-before-effect",
        retryAllowed: false,
        externalEffectCommitted: false,
        planFingerprint,
        errorCode: safeErrorCode(error),
      },
    ), "complete");
  } catch {
    // The original fail-closed error remains authoritative.
  }
}

function startLifecycleMonitor({
  lifecycle,
  executionId,
  controller,
  pollMs,
}: {
  lifecycle: LocalClientExecutionOrchestratorDependencies["lifecycle"];
  executionId: string;
  controller: AbortController;
  pollMs: number;
}) {
  if (pollMs === 0) return { stop() {} };
  let stopped = false;
  let polling = false;
  const timer = setInterval(async () => {
    if (stopped || polling || controller.signal.aborted) return;
    polling = true;
    try {
      const snapshot = await lifecycle.getStatus(executionId);
      if (
        snapshot?.success !== true
        || snapshot.cancelRequested === true
        || snapshot.pauseRequested === true
        || new Set(["cancelled", "force_stopped", "paused", "failed"]).has(String(snapshot.status ?? ""))
      ) {
        controller.abort(abortError("The durable execution lifecycle requested a stop."));
      }
    } catch {
      controller.abort(abortError("The durable execution lifecycle could not be monitored."));
    } finally {
      polling = false;
    }
  }, pollMs);
  timer.unref?.();
  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}

function linkAbortSignal(source: AbortSignal | undefined, target: AbortController) {
  if (!source) return () => undefined;
  const onAbort = () => target.abort(abortError("The local-client execution was cancelled."));
  if (source.aborted) onAbort();
  else source.addEventListener("abort", onAbort, { once: true });
  return () => source.removeEventListener("abort", onAbort);
}

function assertExecutionAccess(
  snapshot: LifecycleSnapshot,
  identity: LocalClientExecutionIdentity,
) {
  if (!snapshot || snapshot.success !== true) {
    throw orchestratorError(
      "LOCAL_CLIENT_EXECUTION_NOT_FOUND",
      "The local-client execution was not found.",
      "lifecycle",
      404,
    );
  }
  if (
    snapshot.tenantFingerprint !== identityFingerprint(identity.tenantId)
    || snapshot.subjectFingerprint !== identityFingerprint(identity.subjectId)
  ) {
    throw orchestratorError(
      "LOCAL_CLIENT_EXECUTION_FORBIDDEN",
      "The execution does not belong to the authenticated subject.",
      "auth",
      403,
    );
  }
}

function createExecutionId(identity: LocalClientExecutionIdentity, planId: string, approvalId: string) {
  return `lc-exec-${digestText(`${identity.tenantId}\0${identity.subjectId}\0${planId}\0${approvalId}`)}`;
}

function identityFingerprint(value: string) {
  return `idfp_${digestText(value).slice(0, 16)}`;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw abortError("The local-client execution was cancelled.");
}

function abortError(message: string) {
  return orchestratorError(
    "LOCAL_CLIENT_EXECUTION_ABORTED",
    message,
    "cancellation",
    499,
  );
}

function isAbortError(error: unknown) {
  return (error as { code?: unknown })?.code === "LOCAL_CLIENT_EXECUTION_ABORTED"
    || (error as { name?: unknown })?.name === "AbortError";
}

function safeErrorCode(error: unknown) {
  const code = String((error as { code?: unknown })?.code ?? "LOCAL_CLIENT_EXECUTION_OUTCOME_UNKNOWN").trim();
  return /^[A-Z0-9_:-]{1,128}$/u.test(code) ? code : "LOCAL_CLIENT_EXECUTION_OUTCOME_UNKNOWN";
}

function normalizeScopes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((scope) => String(scope).trim()).filter(Boolean))].sort();
}

function sameStringSet(left: readonly string[], right: readonly string[]) {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
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

function digestText(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function requiredDigest(value: unknown, _field: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!SHA256_PATTERN.test(normalized)) throw requestError();
  return normalized;
}

function normalizeIdentity(value: unknown) {
  const normalized = String(value ?? "").trim();
  if (
    !normalized
    || normalized.length > IDENTITY_MAX_LENGTH
    || /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw requestError();
  }
  return normalized;
}

function boundedText(value: unknown, maxLength: number) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw requestError();
  }
  return normalized;
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) throw requestError();
  return parsed;
}

function readNow(now: () => number) {
  let value: unknown;
  try {
    value = now();
  } catch {
    throw requestError();
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw requestError();
  }
  return value;
}

function assertLifecycleSuccess(value: unknown, phase: string) {
  if (
    value
    && typeof value === "object"
    && Object.hasOwn(value, "success")
    && (value as { success?: unknown }).success !== true
  ) {
    throw orchestratorError(
      "LOCAL_CLIENT_EXECUTION_LIFECYCLE_FAILED",
      `The durable lifecycle ${phase} operation was not committed.`,
      "lifecycle",
      503,
    );
  }
}

function assertDependencies(dependencies: LocalClientExecutionOrchestratorDependencies) {
  if (
    !dependencies
    || typeof dependencies !== "object"
    || typeof dependencies.routePlanStore?.get !== "function"
    || typeof dependencies.routePlanStore?.consume !== "function"
    || typeof dependencies.routePlanStore?.verifyInput !== "function"
    || typeof dependencies.approvalGate?.check !== "function"
    || typeof dependencies.approvalGate?.consume !== "function"
    || typeof dependencies.lifecycle?.initialize !== "function"
    || typeof dependencies.lifecycle?.start !== "function"
    || typeof dependencies.lifecycle?.pause !== "function"
    || typeof dependencies.lifecycle?.complete !== "function"
    || typeof dependencies.lifecycle?.cancel !== "function"
    || typeof dependencies.lifecycle?.getStatus !== "function"
    || typeof dependencies.externalEffectGate?.reserve !== "function"
    || typeof dependencies.adapterRegistry?.lookup !== "function"
    || typeof dependencies.adapterRegistry?.execute !== "function"
    || typeof dependencies.resolveVerifiedTarget !== "function"
    || typeof dependencies.acquireFence !== "function"
    || (
      dependencies.resolveReceiptJournal !== undefined
      && typeof dependencies.resolveReceiptJournal !== "function"
    )
    || (
      dependencies.feedbackSink !== undefined
      && typeof dependencies.feedbackSink?.record !== "function"
    )
  ) {
    throw requestError();
  }
}

function assertPlainObject(value: unknown, code: LocalClientExecutionOrchestratorErrorCode): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw orchestratorError(code, "A required object is invalid.", "validation", 400);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw orchestratorError(code, "A required object is invalid.", "validation", 400);
  }
  if (Reflect.ownKeys(value).some((key) => {
    if (typeof key !== "string") return true;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return !descriptor || !("value" in descriptor);
  })) {
    throw orchestratorError(code, "A required object is invalid.", "validation", 400);
  }
}

function assertAllowedKeys(value: object, allowed: readonly string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw requestError();
}

function assertExactKeys(value: object, expected: readonly string[]) {
  const actual = Object.keys(value);
  if (actual.length !== expected.length || actual.some((key) => !expected.includes(key))) throw requestError();
}

function hasExactPlainKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const actual = Reflect.ownKeys(value);
  return actual.length === expected.length
    && actual.every((key) => {
      if (typeof key !== "string" || !expected.includes(key)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return Boolean(descriptor && "value" in descriptor);
    });
}

function requestError() {
  return orchestratorError(
    "LOCAL_CLIENT_EXECUTION_REQUEST_INVALID",
    "The local-client execution request or dependency configuration is invalid.",
    "validation",
    400,
  );
}

function inputError() {
  return orchestratorError(
    "LOCAL_CLIENT_EXECUTION_INPUT_INVALID",
    "The verified adapter input does not match the immutable action schema.",
    "validation",
    409,
  );
}

function targetChangedError() {
  return orchestratorError(
    "LOCAL_CLIENT_EXECUTION_TARGET_CHANGED",
    "The verified client target changed after route planning.",
    "integrity",
    409,
  );
}

function orchestratorError(
  code: LocalClientExecutionOrchestratorErrorCode,
  message: string,
  category: LocalClientExecutionOrchestratorError["category"],
  statusCode: number,
  retryable = false,
) {
  return new LocalClientExecutionOrchestratorError(code, message, category, statusCode, retryable);
}
