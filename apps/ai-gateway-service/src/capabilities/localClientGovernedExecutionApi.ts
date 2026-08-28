import type { LocalClientExecutionPreviewRequest, LocalClientExecutionPreviewResult } from "./localClientExecutionPreview.ts";
import {
  buildLocalClientExecutionScopes,
  type LocalClientExecutionIdentity,
} from "./localClientExecutionOrchestrator.ts";
import type {
  LocalClientHttpExecutionRequest,
  LocalClientIdempotentExecutionOutcome,
} from "./localClientExecutionIdempotencyCoordinator.ts";
import type { LocalClientRoutePlan, LocalClientRoutePlanReference } from "./localClientRoutePlanStore.ts";

export const LOCAL_CLIENT_GOVERNED_EXECUTION_API_VERSION = "local-client-governed-execution-api-v2" as const;

export const LOCAL_CLIENT_GOVERNED_EXECUTION_API_BOUNDARIES = Object.freeze({
  serverResolvesTarget: true as const,
  serverDerivesApprovalScopes: true as const,
  serverDerivesPlanDigest: true as const,
  bodySuppliedAdapterDenied: true as const,
  bodySuppliedActionDeniedAfterPreview: true as const,
  bodySuppliedApprovalAuthorityDenied: true as const,
  idempotencyKeyFromRequestPort: true as const,
  statusAndCancelSubjectBound: true as const,
  fakeExecutionDenied: true as const,
  rawInputReturned: false as const,
  retryAfterUnknown: false as const,
});

export interface LocalClientGovernedExecutionApiDependencies {
  readonly executionPreview: {
    preview(request: LocalClientExecutionPreviewRequest): Promise<LocalClientExecutionPreviewResult>;
  };
  readonly routePlanStore: {
    get(reference: LocalClientRoutePlanReference): LocalClientRoutePlan | Promise<LocalClientRoutePlan>;
  };
  readonly approvalGate: {
    approve(input: Record<string, unknown>): unknown | Promise<unknown>;
  };
  readonly executionIdempotency: {
    execute(request: LocalClientHttpExecutionRequest): Promise<LocalClientIdempotentExecutionOutcome>;
  };
  readonly orchestrator: {
    getStatus(input: Readonly<LocalClientExecutionIdentity & { executionId: string }>): unknown | Promise<unknown>;
    cancel(input: Readonly<LocalClientExecutionIdentity & { executionId: string; reason?: string }>): unknown | Promise<unknown>;
  };
}

export interface LocalClientGovernedExecutionApiOptions {
  readonly now?: () => number;
}

export interface LocalClientGovernedPreviewRequest {
  readonly tenantId: unknown;
  readonly subjectId: unknown;
  readonly clientId: unknown;
  readonly capabilityId: unknown;
  readonly actionId: unknown;
  readonly input: unknown;
}

export interface LocalClientGovernedApproveRequest {
  readonly tenantId: unknown;
  readonly subjectId: unknown;
  readonly planId: unknown;
  readonly note?: unknown;
}

export interface LocalClientGovernedExecuteRequest {
  readonly tenantId: unknown;
  readonly subjectId: unknown;
  readonly planId: unknown;
  readonly input: unknown;
}

export interface LocalClientGovernedStatusRequest {
  readonly tenantId: unknown;
  readonly subjectId: unknown;
  readonly executionId: unknown;
}

export interface LocalClientGovernedCancelRequest extends LocalClientGovernedStatusRequest {
  readonly reason?: unknown;
}

/** A narrow adapter around the HTTP request. Authentication never crosses this port. */
export interface LocalClientExecutionRequestPort {
  readonly getHeader: (name: "idempotency-key") => unknown;
  readonly signal?: AbortSignal;
}

export type LocalClientGovernedPreviewResult = Readonly<{
  apiVersion: typeof LOCAL_CLIENT_GOVERNED_EXECUTION_API_VERSION;
  operation: "preview";
  status: "approval-required";
  executionPerformed: false;
  plan: Readonly<{
    planVersion: string;
    planId: string;
    clientId: string;
    clientRevision: number;
    clientState: "verified";
    clientTrustDecision: "verified";
    adapter: Readonly<{ id: string; type: string; version: string }>;
    capabilityId: string;
    actionId: string;
    inputSha256: string;
    policyVersion: string;
    createdAt: string;
    expiresAt: string;
  }>;
  approval: Readonly<{
    required: true;
    planDigest: string;
    scopes: readonly string[];
  }>;
  boundaries: typeof LOCAL_CLIENT_GOVERNED_EXECUTION_API_BOUNDARIES;
}>;

export type LocalClientGovernedApprovalResult = Readonly<{
  apiVersion: typeof LOCAL_CLIENT_GOVERNED_EXECUTION_API_VERSION;
  operation: "approve";
  status: "approved";
  executionPerformed: false;
  approval: Readonly<{
    approvalId: string;
    planId: string;
    planDigest: string;
    scopes: readonly string[];
    approvedAt: string;
    expiresAt: string;
  }>;
  boundaries: Readonly<{
    planReReadFromTrustedStore: true;
    identityBound: true;
    scopesServerDerived: true;
    digestServerDerived: true;
    noteReturned: false;
    executionPerformed: false;
  }>;
}>;

export type LocalClientGovernedStatusResult = Readonly<{
  apiVersion: typeof LOCAL_CLIENT_GOVERNED_EXECUTION_API_VERSION;
  operation: "status";
  executionId: string;
  status: "pending" | "running" | "paused" | "completed" | "failed" | "cancelled" | "force_stopped";
  cancelRequested: boolean;
  pauseRequested: boolean;
  reconciliationRequired: boolean;
  retryAllowed: false;
  completedAgents: number;
  startedAt: string | null;
  completedAt: string | null;
}>;

export type LocalClientGovernedCancelResult = Readonly<{
  apiVersion: typeof LOCAL_CLIENT_GOVERNED_EXECUTION_API_VERSION;
  operation: "cancel";
  executionId: string;
  status: "cancel-requested" | "cancelled";
  lifecycleStatus: "pending" | "running" | "paused" | "cancelled";
  cancelRequested: boolean;
  reasonReturned: false;
}>;

export type LocalClientGovernedExecutionApiErrorCode =
  | "LOCAL_CLIENT_GOVERNED_API_CONFIG_INVALID"
  | "LOCAL_CLIENT_GOVERNED_API_REQUEST_INVALID"
  | "LOCAL_CLIENT_GOVERNED_API_PREVIEW_FAILED"
  | "LOCAL_CLIENT_GOVERNED_API_PLAN_INVALID"
  | "LOCAL_CLIENT_GOVERNED_API_APPROVAL_FAILED"
  | "LOCAL_CLIENT_GOVERNED_API_STATUS_FAILED"
  | "LOCAL_CLIENT_GOVERNED_API_CANCEL_FAILED";

export class LocalClientGovernedExecutionApiError extends Error {
  readonly code: LocalClientGovernedExecutionApiErrorCode;
  readonly causeCode: string | null;
  readonly category: "configuration" | "validation" | "auth" | "integrity" | "dependency";
  readonly statusCode: number;
  readonly retryable = false;

  constructor(input: Readonly<{
    code: LocalClientGovernedExecutionApiErrorCode;
    message: string;
    causeCode?: string | null;
    category: LocalClientGovernedExecutionApiError["category"];
    statusCode: number;
  }>) {
    super(input.message);
    this.name = "LocalClientGovernedExecutionApiError";
    this.code = input.code;
    this.causeCode = input.causeCode ?? null;
    this.category = input.category;
    this.statusCode = input.statusCode;
  }
}

const APPROVAL_BOUNDARIES = Object.freeze({
  planReReadFromTrustedStore: true as const,
  identityBound: true as const,
  scopesServerDerived: true as const,
  digestServerDerived: true as const,
  noteReturned: false as const,
  executionPerformed: false as const,
});
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const APPROVAL_ID_PATTERN = /^appr_[a-f0-9]{16,64}$/u;
const IDENTITY_MAX_LENGTH = 128;
const EXECUTION_ID_MAX_LENGTH = 256;
const NOTE_MAX_LENGTH = 512;
const LIFECYCLE_STATUSES = new Set([
  "pending",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
  "force_stopped",
] as const);

export function createLocalClientGovernedExecutionApi(
  dependencies: LocalClientGovernedExecutionApiDependencies,
  options: LocalClientGovernedExecutionApiOptions = {},
) {
  assertDependencies(dependencies);
  assertOptions(options);
  const now = options.now ?? Date.now;

  return Object.freeze({
    apiVersion: LOCAL_CLIENT_GOVERNED_EXECUTION_API_VERSION,
    boundaries: LOCAL_CLIENT_GOVERNED_EXECUTION_API_BOUNDARIES,

    async preview(rawRequest: LocalClientGovernedPreviewRequest): Promise<LocalClientGovernedPreviewResult> {
      const request = normalizePreviewRequest(rawRequest);
      try {
        const result = await dependencies.executionPreview.preview(request);
        const plan = validatePlan(result?.plan, request, readNow(now));
        if (result.status !== "approval-required" || result.executionPerformed !== false) {
          throw planError();
        }
        const scopes = buildLocalClientExecutionScopes(plan);
        if (
          !isPlainRecord(result.approval)
          || result.approval.required !== true
          || result.approval.planDigest !== plan.planId
          || !sameStringSet(result.approval.scopes, scopes)
        ) {
          throw planError();
        }
        return Object.freeze({
          apiVersion: LOCAL_CLIENT_GOVERNED_EXECUTION_API_VERSION,
          operation: "preview",
          status: "approval-required",
          executionPerformed: false,
          plan: projectPlan(plan),
          approval: Object.freeze({
            required: true,
            planDigest: plan.planId,
            scopes,
          }),
          boundaries: LOCAL_CLIENT_GOVERNED_EXECUTION_API_BOUNDARIES,
        });
      } catch (error) {
        throw mapDependencyError(error, "preview");
      }
    },

    async approve(rawRequest: LocalClientGovernedApproveRequest): Promise<LocalClientGovernedApprovalResult> {
      const request = normalizeApproveRequest(rawRequest);
      try {
        const reference = Object.freeze({
          tenantId: request.tenantId,
          subjectId: request.subjectId,
          planId: request.planId,
        });
        const plan = validatePlan(
          await dependencies.routePlanStore.get(reference),
          request,
          readNow(now),
        );
        const scopes = buildLocalClientExecutionScopes(plan);
        const rawApproval = await dependencies.approvalGate.approve({
          planId: plan.planId,
          tenantId: request.tenantId,
          userId: request.subjectId,
          planDigest: plan.planId,
          approvedScopes: scopes,
          ...(request.note === undefined ? {} : { note: request.note }),
        });
        const approval = validateApproval(rawApproval, request, scopes, readNow(now));
        return Object.freeze({
          apiVersion: LOCAL_CLIENT_GOVERNED_EXECUTION_API_VERSION,
          operation: "approve",
          status: "approved",
          executionPerformed: false,
          approval,
          boundaries: APPROVAL_BOUNDARIES,
        });
      } catch (error) {
        throw mapDependencyError(error, "approve");
      }
    },

    async execute(
      rawRequest: LocalClientGovernedExecuteRequest,
      rawPort: LocalClientExecutionRequestPort,
    ): Promise<LocalClientIdempotentExecutionOutcome> {
      const request = normalizeExecuteRequest(rawRequest);
      const port = normalizeRequestPort(rawPort);
      let idempotencyKey: unknown;
      try {
        idempotencyKey = port.getHeader("idempotency-key");
      } catch {
        throw facadeError(
          "LOCAL_CLIENT_GOVERNED_API_REQUEST_INVALID",
          "The local-client HTTP request port could not provide Idempotency-Key.",
          "dependency",
          503,
        );
      }
      try {
        return await dependencies.executionIdempotency.execute({
          tenantId: request.tenantId,
          subjectId: request.subjectId,
          planId: request.planId,
          input: request.input,
          idempotencyKey,
          ...(port.signal === undefined ? {} : { signal: port.signal }),
        });
      } catch {
        return Object.freeze({
          accepted: false,
          status: "unknown-reconcile-required",
          statusCode: 503,
          code: "LOCAL_CLIENT_GOVERNED_EXECUTION_OUTCOME_UNKNOWN",
          message: "The governed execution boundary did not return a confirmed outcome. Reconcile before any retry.",
          idempotencyStatus: "facade-error",
          replayed: false,
          replayable: false,
          operationInvoked: true,
          retryAllowed: false,
          result: null,
        });
      }
    },

    async status(rawRequest: LocalClientGovernedStatusRequest): Promise<LocalClientGovernedStatusResult> {
      const request = normalizeStatusRequest(rawRequest);
      try {
        const rawStatus = await dependencies.orchestrator.getStatus(request);
        return projectStatus(rawStatus, request.executionId);
      } catch (error) {
        throw mapDependencyError(error, "status");
      }
    },

    async cancel(rawRequest: LocalClientGovernedCancelRequest): Promise<LocalClientGovernedCancelResult> {
      const request = normalizeCancelRequest(rawRequest);
      try {
        const rawResult = await dependencies.orchestrator.cancel(request);
        return projectCancel(rawResult, request.executionId);
      } catch (error) {
        throw mapDependencyError(error, "cancel");
      }
    },
  });
}

function normalizePreviewRequest(raw: LocalClientGovernedPreviewRequest): LocalClientExecutionPreviewRequest {
  assertExactObject(raw, ["tenantId", "subjectId", "clientId", "capabilityId", "actionId", "input"]);
  if (!isPlainRecord(raw.input)) throw requestError();
  return Object.freeze({
    tenantId: normalizeIdentity(raw.tenantId),
    subjectId: normalizeIdentity(raw.subjectId),
    clientId: normalizeIdentifier(raw.clientId),
    capabilityId: normalizeIdentifier(raw.capabilityId),
    actionId: normalizeIdentifier(raw.actionId),
    input: raw.input,
  });
}

function normalizeApproveRequest(raw: LocalClientGovernedApproveRequest) {
  assertExactObject(raw, ["tenantId", "subjectId", "planId", "note"], ["note"]);
  const note = raw.note === undefined ? undefined : normalizeBoundedText(raw.note, NOTE_MAX_LENGTH, true);
  return Object.freeze({
    tenantId: normalizeIdentity(raw.tenantId),
    subjectId: normalizeIdentity(raw.subjectId),
    planId: normalizeSha256(raw.planId),
    ...(note === undefined ? {} : { note }),
  });
}

function normalizeExecuteRequest(raw: LocalClientGovernedExecuteRequest) {
  assertExactObject(raw, ["tenantId", "subjectId", "planId", "input"]);
  return Object.freeze({
    tenantId: normalizeIdentity(raw.tenantId),
    subjectId: normalizeIdentity(raw.subjectId),
    planId: normalizeSha256(raw.planId),
    input: raw.input,
  });
}

function normalizeStatusRequest(raw: LocalClientGovernedStatusRequest) {
  assertExactObject(raw, ["tenantId", "subjectId", "executionId"]);
  return Object.freeze({
    tenantId: normalizeIdentity(raw.tenantId),
    subjectId: normalizeIdentity(raw.subjectId),
    executionId: normalizeBoundedText(raw.executionId, EXECUTION_ID_MAX_LENGTH),
  });
}

function normalizeCancelRequest(raw: LocalClientGovernedCancelRequest) {
  assertExactObject(raw, ["tenantId", "subjectId", "executionId", "reason"], ["reason"]);
  const reason = raw.reason === undefined
    ? undefined
    : normalizeBoundedText(raw.reason, NOTE_MAX_LENGTH, true);
  return Object.freeze({
    tenantId: normalizeIdentity(raw.tenantId),
    subjectId: normalizeIdentity(raw.subjectId),
    executionId: normalizeBoundedText(raw.executionId, EXECUTION_ID_MAX_LENGTH),
    ...(reason === undefined ? {} : { reason }),
  });
}

function normalizeRequestPort(raw: LocalClientExecutionRequestPort): LocalClientExecutionRequestPort {
  assertExactObject(raw, ["getHeader", "signal"], ["signal"]);
  if (typeof raw.getHeader !== "function" || (raw.signal !== undefined && !isAbortSignal(raw.signal))) {
    throw requestError();
  }
  return raw;
}

function validatePlan(
  raw: LocalClientRoutePlan,
  identity: Readonly<{ tenantId: string; subjectId: string; planId?: string }>,
  nowMs: number,
): LocalClientRoutePlan {
  if (
    !isPlainRecord(raw)
    || raw.planVersion !== "local-client-route-plan-v1"
    || !SHA256_PATTERN.test(String(raw.planId ?? ""))
    || (identity.planId !== undefined && raw.planId !== identity.planId)
    || raw.tenantId !== identity.tenantId
    || raw.subjectId !== identity.subjectId
    || raw.clientState !== "verified"
    || raw.clientTrustDecision !== "verified"
    || !IDENTIFIER_PATTERN.test(String(raw.clientId ?? ""))
    || !Number.isSafeInteger(raw.clientRevision)
    || raw.clientRevision < 1
    || !IDENTIFIER_PATTERN.test(String(raw.adapterId ?? ""))
    || !IDENTIFIER_PATTERN.test(String(raw.adapterType ?? ""))
    || raw.adapterType === "fake"
    || typeof raw.adapterVersion !== "string"
    || !/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u.test(raw.adapterVersion)
    || !IDENTIFIER_PATTERN.test(String(raw.capabilityId ?? ""))
    || !IDENTIFIER_PATTERN.test(String(raw.actionId ?? ""))
    || !SHA256_PATTERN.test(String(raw.inputSha256 ?? ""))
    || typeof raw.policyVersion !== "string"
    || raw.policyVersion.length < 1
    || raw.policyVersion.length > 128
    || !validIsoDate(raw.createdAt)
    || !validIsoDate(raw.expiresAt)
    || Date.parse(raw.createdAt) >= Date.parse(raw.expiresAt)
    || Date.parse(raw.createdAt) > nowMs
    || Date.parse(raw.expiresAt) <= nowMs
  ) {
    throw planError();
  }
  return raw;
}

function projectPlan(plan: LocalClientRoutePlan): LocalClientGovernedPreviewResult["plan"] {
  return Object.freeze({
    planVersion: plan.planVersion,
    planId: plan.planId,
    clientId: plan.clientId,
    clientRevision: plan.clientRevision,
    clientState: "verified",
    clientTrustDecision: "verified",
    adapter: Object.freeze({
      id: plan.adapterId,
      type: plan.adapterType,
      version: plan.adapterVersion,
    }),
    capabilityId: plan.capabilityId,
    actionId: plan.actionId,
    inputSha256: plan.inputSha256,
    policyVersion: plan.policyVersion,
    createdAt: plan.createdAt,
    expiresAt: plan.expiresAt,
  });
}

function validateApproval(
  raw: unknown,
  request: Readonly<{ tenantId: string; subjectId: string; planId: string }>,
  scopes: readonly string[],
  nowMs: number,
): LocalClientGovernedApprovalResult["approval"] {
  if (!isPlainRecord(raw) || raw.success !== true || raw.status !== "approved" || !isPlainRecord(raw.approval)) {
    throw approvalResponseError();
  }
  const approval = raw.approval;
  if (
    !APPROVAL_ID_PATTERN.test(String(approval.approvalId ?? ""))
    || approval.planId !== request.planId
    || approval.tenantId !== request.tenantId
    || approval.userId !== request.subjectId
    || approval.planDigest !== request.planId
    || approval.status !== "approved"
    || approval.revoked !== false
    || !sameStringSet(approval.approvedScopes, scopes)
    || !validIsoDate(approval.approvedAt)
    || !validIsoDate(approval.expiresAt)
    || Date.parse(String(approval.approvedAt)) >= Date.parse(String(approval.expiresAt))
    || Date.parse(String(approval.expiresAt)) <= nowMs
  ) {
    throw approvalResponseError();
  }
  return Object.freeze({
    approvalId: approval.approvalId as string,
    planId: request.planId,
    planDigest: request.planId,
    scopes: Object.freeze([...scopes]),
    approvedAt: approval.approvedAt as string,
    expiresAt: approval.expiresAt as string,
  });
}

function projectStatus(raw: unknown, executionId: string): LocalClientGovernedStatusResult {
  if (
    !isPlainRecord(raw)
    || raw.success !== true
    || raw.planId !== executionId
    || !isLifecycleStatus(raw.status)
    || typeof raw.cancelRequested !== "boolean"
    || typeof raw.pauseRequested !== "boolean"
    || !Number.isSafeInteger(raw.completedAgents)
    || Number(raw.completedAgents) < 0
    || !validNullableIsoDate(raw.startedAt)
    || !validNullableIsoDate(raw.completedAt)
  ) {
    throw facadeError(
      "LOCAL_CLIENT_GOVERNED_API_STATUS_FAILED",
      "The governed execution status response was invalid.",
      "integrity",
      503,
    );
  }
  const reconciliationRequired = raw.status === "running" && raw.pauseRequested === true;
  return Object.freeze({
    apiVersion: LOCAL_CLIENT_GOVERNED_EXECUTION_API_VERSION,
    operation: "status",
    executionId,
    status: raw.status,
    cancelRequested: raw.cancelRequested,
    pauseRequested: raw.pauseRequested,
    reconciliationRequired,
    retryAllowed: false,
    completedAgents: raw.completedAgents as number,
    startedAt: raw.startedAt as string | null,
    completedAt: raw.completedAt as string | null,
  });
}

function projectCancel(raw: unknown, executionId: string): LocalClientGovernedCancelResult {
  if (
    !isPlainRecord(raw)
    || raw.success !== true
    || !new Set(["pending", "running", "paused", "cancelled"]).has(String(raw.status ?? ""))
    || (raw.cancelRequested !== undefined && typeof raw.cancelRequested !== "boolean")
  ) {
    throw facadeError(
      "LOCAL_CLIENT_GOVERNED_API_CANCEL_FAILED",
      "The governed cancellation response was invalid.",
      "integrity",
      503,
    );
  }
  const cancelRequested = raw.cancelRequested === true;
  if (!cancelRequested && raw.status !== "cancelled") {
    throw facadeError(
      "LOCAL_CLIENT_GOVERNED_API_CANCEL_FAILED",
      "The governed cancellation was not committed.",
      "integrity",
      503,
    );
  }
  return Object.freeze({
    apiVersion: LOCAL_CLIENT_GOVERNED_EXECUTION_API_VERSION,
    operation: "cancel",
    executionId,
    status: cancelRequested ? "cancel-requested" : "cancelled",
    lifecycleStatus: raw.status as LocalClientGovernedCancelResult["lifecycleStatus"],
    cancelRequested,
    reasonReturned: false,
  });
}

function mapDependencyError(
  error: unknown,
  operation: "preview" | "approve" | "status" | "cancel",
): LocalClientGovernedExecutionApiError {
  if (error instanceof LocalClientGovernedExecutionApiError) return error;
  const codeByOperation = {
    preview: "LOCAL_CLIENT_GOVERNED_API_PREVIEW_FAILED",
    approve: "LOCAL_CLIENT_GOVERNED_API_APPROVAL_FAILED",
    status: "LOCAL_CLIENT_GOVERNED_API_STATUS_FAILED",
    cancel: "LOCAL_CLIENT_GOVERNED_API_CANCEL_FAILED",
  } as const;
  const messageByOperation = {
    preview: "The governed local-client preview could not be created.",
    approve: "The subject-bound local-client approval could not be committed.",
    status: "The subject-bound local-client execution status could not be read.",
    cancel: "The subject-bound local-client cancellation could not be committed.",
  } as const;
  const causeCode = safeCauseCode(readOwnDataProperty(error, "code"));
  const statusCode = boundedStatusCode(readOwnDataProperty(error, "statusCode"), 503);
  return facadeError(
    codeByOperation[operation],
    messageByOperation[operation],
    statusCode === 401 || statusCode === 403 || statusCode === 404 ? "auth" : "dependency",
    statusCode,
    causeCode,
  );
}

function sameStringSet(raw: unknown, expected: readonly string[]): boolean {
  if (!Array.isArray(raw) || raw.some((value) => typeof value !== "string")) return false;
  if (new Set(raw).size !== raw.length) return false;
  const left = [...raw].sort();
  const right = [...new Set(expected)].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalizeIdentity(value: unknown): string {
  return normalizeBoundedText(value, IDENTITY_MAX_LENGTH);
}

function normalizeIdentifier(value: unknown): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) throw requestError();
  return value;
}

function normalizeSha256(value: unknown): string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) throw requestError();
  return value;
}

function normalizeBoundedText(value: unknown, maxLength: number, allowEmpty = false): string {
  if (typeof value !== "string") throw requestError();
  const normalized = value.trim();
  if (
    normalized.length > maxLength
    || (!allowEmpty && normalized.length === 0)
    || /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw requestError();
  }
  return normalized;
}

function isLifecycleStatus(value: unknown): value is LocalClientGovernedStatusResult["status"] {
  return typeof value === "string"
    && LIFECYCLE_STATUSES.has(value as LocalClientGovernedStatusResult["status"]);
}

function validIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function validNullableIsoDate(value: unknown): value is string | null {
  return value === null || validIsoDate(value);
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

function assertDependencies(dependencies: LocalClientGovernedExecutionApiDependencies): void {
  if (
    !isPlainRecord(dependencies)
    || typeof dependencies.executionPreview?.preview !== "function"
    || typeof dependencies.routePlanStore?.get !== "function"
    || typeof dependencies.approvalGate?.approve !== "function"
    || typeof dependencies.executionIdempotency?.execute !== "function"
    || typeof dependencies.orchestrator?.getStatus !== "function"
    || typeof dependencies.orchestrator?.cancel !== "function"
  ) {
    throw configError();
  }
}

function assertOptions(options: LocalClientGovernedExecutionApiOptions): void {
  if (
    !isPlainRecord(options)
    || Reflect.ownKeys(options).some((key) => key !== "now")
    || (options.now !== undefined && typeof options.now !== "function")
  ) {
    throw configError();
  }
}

function assertExactObject(
  value: unknown,
  allowedKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value)) throw requestError();
  const actual = Reflect.ownKeys(value);
  if (
    actual.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
    || allowedKeys.some((key) => !optionalKeys.includes(key) && !Object.hasOwn(value, key))
  ) {
    throw requestError();
  }
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

function readOwnDataProperty(value: unknown, key: string): unknown {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function safeCauseCode(value: unknown): string | null {
  return typeof value === "string" && /^[A-Z][A-Z0-9_:-]{0,127}$/u.test(value) ? value : null;
}

function boundedStatusCode(value: unknown, fallback: number): number {
  return Number.isSafeInteger(value) && Number(value) >= 400 && Number(value) <= 599
    ? Number(value)
    : fallback;
}

function requestError() {
  return facadeError(
    "LOCAL_CLIENT_GOVERNED_API_REQUEST_INVALID",
    "The governed local-client API request has an invalid bounded shape.",
    "validation",
    400,
  );
}

function configError() {
  return facadeError(
    "LOCAL_CLIENT_GOVERNED_API_CONFIG_INVALID",
    "The governed local-client API dependencies or options are invalid.",
    "configuration",
    503,
  );
}

function planError() {
  return facadeError(
    "LOCAL_CLIENT_GOVERNED_API_PLAN_INVALID",
    "The trusted local-client route plan is invalid, expired, fake, or identity-mismatched.",
    "integrity",
    409,
  );
}

function approvalResponseError() {
  return facadeError(
    "LOCAL_CLIENT_GOVERNED_API_APPROVAL_FAILED",
    "The subject-bound approval response failed integrity validation.",
    "integrity",
    503,
  );
}

function facadeError(
  code: LocalClientGovernedExecutionApiErrorCode,
  message: string,
  category: LocalClientGovernedExecutionApiError["category"],
  statusCode: number,
  causeCode: string | null = null,
) {
  return new LocalClientGovernedExecutionApiError({ code, message, category, statusCode, causeCode });
}
