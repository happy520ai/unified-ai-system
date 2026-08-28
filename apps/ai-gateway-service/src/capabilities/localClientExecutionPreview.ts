import type {
  LocalClientAdapterDescriptor,
  LocalClientAdapterRegistry,
  VerifiedLocalClientAdapterTarget,
} from "./localClientAdapterRegistry.ts";
import {
  buildLocalClientExecutionScopes,
} from "./localClientExecutionOrchestrator.ts";
import type {
  CreateLocalClientRoutePlanRequest,
  LocalClientRoutePlan,
  VerifiedLocalClientRoutePlanTarget,
} from "./localClientRoutePlanStore.ts";

export const LOCAL_CLIENT_EXECUTION_PREVIEW_VERSION = "local-client-execution-preview-v1" as const;

export interface LocalClientExecutionPreviewIdentity {
  readonly tenantId: string;
  readonly subjectId: string;
}

/**
 * The caller may select a client, capability, action and action input. Adapter
 * identity, client revision, trust state and policy version are resolved from
 * server-owned state and are never accepted from the request body.
 */
export interface LocalClientExecutionPreviewRequest extends LocalClientExecutionPreviewIdentity {
  readonly clientId: string;
  readonly capabilityId: string;
  readonly actionId: string;
  readonly input: Readonly<Record<string, unknown>>;
}

export interface ResolvedVerifiedLocalClientPreviewTarget
  extends VerifiedLocalClientAdapterTarget {
  readonly revision: number;
}

export interface LocalClientExecutionPreviewDependencies {
  readonly routePlanStore: {
    create(
      request: CreateLocalClientRoutePlanRequest,
    ): LocalClientRoutePlan | Promise<LocalClientRoutePlan>;
  };
  readonly adapterRegistry: Pick<LocalClientAdapterRegistry, "lookup">;
  readonly resolveVerifiedTarget: (input: Readonly<{
    identity: LocalClientExecutionPreviewIdentity;
    clientId: string;
  }>) => ResolvedVerifiedLocalClientPreviewTarget | Promise<ResolvedVerifiedLocalClientPreviewTarget>;
}

export interface LocalClientExecutionPreviewOptions {
  readonly policyVersion: string;
}

export type LocalClientExecutionPreviewResult = Readonly<{
  previewVersion: typeof LOCAL_CLIENT_EXECUTION_PREVIEW_VERSION;
  status: "approval-required";
  executionPerformed: false;
  plan: LocalClientRoutePlan;
  approval: Readonly<{
    required: true;
    planDigest: string;
    scopes: readonly string[];
  }>;
  boundaries: Readonly<{
    targetResolvedFromTrustedState: true;
    adapterSelectionFromRequestDenied: true;
    oneTimePlan: true;
    planGrantsApproval: false;
    executionPerformed: false;
  }>;
}>;

export type LocalClientExecutionPreviewErrorCode =
  | "LOCAL_CLIENT_EXECUTION_PREVIEW_CONFIG_INVALID"
  | "LOCAL_CLIENT_EXECUTION_PREVIEW_REQUEST_INVALID"
  | "LOCAL_CLIENT_EXECUTION_PREVIEW_TARGET_INVALID"
  | "LOCAL_CLIENT_EXECUTION_PREVIEW_TARGET_MISMATCH"
  | "LOCAL_CLIENT_EXECUTION_PREVIEW_ADAPTER_UNAVAILABLE"
  | "LOCAL_CLIENT_EXECUTION_PREVIEW_FAKE_ADAPTER_DENIED"
  | "LOCAL_CLIENT_EXECUTION_PREVIEW_ACTION_UNAVAILABLE"
  | "LOCAL_CLIENT_EXECUTION_PREVIEW_INPUT_INVALID";

export class LocalClientExecutionPreviewError extends Error {
  readonly code: LocalClientExecutionPreviewErrorCode;
  readonly category: "configuration" | "validation" | "routing" | "integrity";
  readonly statusCode: number;
  readonly retryable = false;

  constructor(
    code: LocalClientExecutionPreviewErrorCode,
    message: string,
    category: LocalClientExecutionPreviewError["category"],
    statusCode: number,
  ) {
    super(message);
    this.name = "LocalClientExecutionPreviewError";
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
  }
}

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const POLICY_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const REQUEST_KEYS = Object.freeze([
  "tenantId",
  "subjectId",
  "clientId",
  "capabilityId",
  "actionId",
  "input",
] as const);
const BOUNDARIES = Object.freeze({
  targetResolvedFromTrustedState: true as const,
  adapterSelectionFromRequestDenied: true as const,
  oneTimePlan: true as const,
  planGrantsApproval: false as const,
  executionPerformed: false as const,
});

export function createLocalClientExecutionPreview(
  dependencies: LocalClientExecutionPreviewDependencies,
  options: LocalClientExecutionPreviewOptions,
) {
  assertDependencies(dependencies);
  const policyVersion = normalizePolicyVersion(options);

  return Object.freeze({
    boundaries: BOUNDARIES,

    async preview(rawRequest: LocalClientExecutionPreviewRequest): Promise<LocalClientExecutionPreviewResult> {
      const request = normalizeRequest(rawRequest);
      const identity = Object.freeze({
        tenantId: request.tenantId,
        subjectId: request.subjectId,
      });
      const resolvedTarget = validateResolvedTarget(
        await dependencies.resolveVerifiedTarget({
          identity,
          clientId: request.clientId,
        }),
        request.clientId,
      );
      const adapterDescriptor = resolveAdapterDescriptor(
        dependencies.adapterRegistry.lookup(resolvedTarget.adapter.id),
        resolvedTarget,
      );
      const action = validateAction(adapterDescriptor, request.capabilityId, request.actionId);
      const verifiedInput = validateActionInput(action, request.input);

      const target: VerifiedLocalClientRoutePlanTarget = Object.freeze({
        descriptorVersion: resolvedTarget.descriptorVersion,
        clientId: resolvedTarget.clientId,
        revision: resolvedTarget.revision,
        state: resolvedTarget.state,
        trustDecision: resolvedTarget.trustDecision,
        adapter: Object.freeze({ ...resolvedTarget.adapter }),
        capabilityIds: Object.freeze([...resolvedTarget.capabilityIds]),
      });
      const plan = await dependencies.routePlanStore.create({
        tenantId: identity.tenantId,
        subjectId: identity.subjectId,
        target,
        capabilityId: request.capabilityId,
        actionId: request.actionId,
        input: verifiedInput,
        policyVersion,
      });
      const scopes = buildLocalClientExecutionScopes(plan);

      return Object.freeze({
        previewVersion: LOCAL_CLIENT_EXECUTION_PREVIEW_VERSION,
        status: "approval-required" as const,
        executionPerformed: false as const,
        plan,
        approval: Object.freeze({
          required: true as const,
          planDigest: plan.planId,
          scopes,
        }),
        boundaries: BOUNDARIES,
      });
    },
  });
}

function normalizeRequest(raw: LocalClientExecutionPreviewRequest) {
  if (!isPlainRecord(raw) || !hasExactKeys(raw, REQUEST_KEYS)) throw requestError();
  const tenantId = normalizeIdentity(raw.tenantId);
  const subjectId = normalizeIdentity(raw.subjectId);
  const clientId = normalizeIdentifier(raw.clientId);
  const capabilityId = normalizeIdentifier(raw.capabilityId);
  const actionId = normalizeIdentifier(raw.actionId);
  if (!tenantId || !subjectId || !clientId || !capabilityId || !actionId || !isPlainRecord(raw.input)) {
    throw requestError();
  }
  return Object.freeze({
    tenantId,
    subjectId,
    clientId,
    capabilityId,
    actionId,
    input: raw.input,
  });
}

function validateResolvedTarget(
  raw: ResolvedVerifiedLocalClientPreviewTarget,
  requestedClientId: string,
): ResolvedVerifiedLocalClientPreviewTarget {
  if (!isPlainRecord(raw) || !hasExactKeys(raw, [
    "descriptorVersion",
    "clientId",
    "revision",
    "state",
    "trustDecision",
    "adapter",
    "capabilityIds",
  ])) throw targetError();
  if (
    raw.descriptorVersion !== "verified-local-client-adapter-target-v1"
    || raw.state !== "verified"
    || raw.trustDecision !== "verified"
    || raw.clientId !== requestedClientId
    || !Number.isSafeInteger(raw.revision)
    || raw.revision < 1
    || !isPlainRecord(raw.adapter)
    || !hasExactKeys(raw.adapter, ["id", "type", "version"])
    || !Array.isArray(raw.capabilityIds)
    || raw.capabilityIds.length === 0
    || raw.capabilityIds.some((value) => !normalizeIdentifier(value))
  ) {
    throw raw.clientId !== requestedClientId
      ? previewError(
        "LOCAL_CLIENT_EXECUTION_PREVIEW_TARGET_MISMATCH",
        "The trusted target does not match the requested client.",
        "integrity",
        409,
      )
      : targetError();
  }
  const adapterId = normalizeIdentifier(raw.adapter.id);
  const adapterType = normalizeIdentifier(raw.adapter.type);
  const adapterVersion = typeof raw.adapter.version === "string" ? raw.adapter.version.trim() : "";
  if (!adapterId || !adapterType || !/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u.test(adapterVersion)) {
    throw targetError();
  }
  return Object.freeze({
    descriptorVersion: "verified-local-client-adapter-target-v1" as const,
    clientId: requestedClientId,
    revision: raw.revision,
    state: "verified" as const,
    trustDecision: "verified" as const,
    adapter: Object.freeze({ id: adapterId, type: adapterType, version: adapterVersion }),
    capabilityIds: Object.freeze([...new Set(raw.capabilityIds.map((value) => String(value).trim()))]),
  });
}

function resolveAdapterDescriptor(
  descriptor: LocalClientAdapterDescriptor | null,
  target: ResolvedVerifiedLocalClientPreviewTarget,
): LocalClientAdapterDescriptor {
  if (!descriptor) {
    throw previewError(
      "LOCAL_CLIENT_EXECUTION_PREVIEW_ADAPTER_UNAVAILABLE",
      "The trusted target adapter is not registered.",
      "routing",
      409,
    );
  }
  if (descriptor.type === "fake") {
    throw previewError(
      "LOCAL_CLIENT_EXECUTION_PREVIEW_FAKE_ADAPTER_DENIED",
      "A fake adapter cannot produce a governed execution plan.",
      "routing",
      409,
    );
  }
  if (
    descriptor.id !== target.adapter.id
    || descriptor.type !== target.adapter.type
    || descriptor.version !== target.adapter.version
  ) {
    throw previewError(
      "LOCAL_CLIENT_EXECUTION_PREVIEW_TARGET_MISMATCH",
      "The registered adapter changed after target verification.",
      "integrity",
      409,
    );
  }
  return descriptor;
}

function validateAction(
  descriptor: LocalClientAdapterDescriptor,
  capabilityId: string,
  actionId: string,
): LocalClientAdapterDescriptor["actions"][number] {
  const action = descriptor.actions.find((candidate) => candidate.actionId === actionId);
  if (!action || action.capabilityId !== capabilityId) {
    throw previewError(
      "LOCAL_CLIENT_EXECUTION_PREVIEW_ACTION_UNAVAILABLE",
      "The verified adapter does not expose the requested capability and action pair.",
      "routing",
      409,
    );
  }
  return action;
}

function validateActionInput(
  action: LocalClientAdapterDescriptor["actions"][number],
  input: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string | number | boolean>> {
  const fields = new Map(action.inputSchema.fields.map((field) => [field.name, field]));
  const projected: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    const field = fields.get(key);
    if (!field || key === "planFingerprint" || typeof value !== field.valueType) {
      throw previewError(
        "LOCAL_CLIENT_EXECUTION_PREVIEW_INPUT_INVALID",
        "The execution input does not match the server-registered action schema.",
        "validation",
        400,
      );
    }
    projected[key] = value as string | number | boolean;
  }
  for (const field of action.inputSchema.fields) {
    if (field.name !== "planFingerprint" && field.required && !Object.hasOwn(projected, field.name)) {
      throw previewError(
        "LOCAL_CLIENT_EXECUTION_PREVIEW_INPUT_INVALID",
        "The execution input does not match the server-registered action schema.",
        "validation",
        400,
      );
    }
  }
  return Object.freeze(projected);
}

function assertDependencies(dependencies: LocalClientExecutionPreviewDependencies): void {
  if (
    !isPlainRecord(dependencies)
    || !hasExactKeys(dependencies, ["routePlanStore", "adapterRegistry", "resolveVerifiedTarget"])
    || typeof dependencies.routePlanStore?.create !== "function"
    || typeof dependencies.adapterRegistry?.lookup !== "function"
    || typeof dependencies.resolveVerifiedTarget !== "function"
  ) {
    throw configError();
  }
}

function normalizePolicyVersion(options: LocalClientExecutionPreviewOptions): string {
  if (!isPlainRecord(options) || !hasExactKeys(options, ["policyVersion"])) throw configError();
  const value = typeof options.policyVersion === "string" ? options.policyVersion.trim() : "";
  if (!POLICY_VERSION_PATTERN.test(value)) throw configError();
  return value;
}

function normalizeIdentifier(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return IDENTIFIER_PATTERN.test(normalized) ? normalized : "";
}

function normalizeIdentity(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  if (
    normalized.length < 1
    || normalized.length > 128
    || /[\u0000-\u001f\u007f]/u.test(normalized)
  ) return "";
  return normalized;
}

function isPlainRecord(value: unknown): value is Record<string, any> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: object, allowedKeys: readonly string[]): boolean {
  const allowed = new Set(allowedKeys);
  return Reflect.ownKeys(value).every((key) => typeof key === "string" && allowed.has(key));
}

function previewError(
  code: LocalClientExecutionPreviewErrorCode,
  message: string,
  category: LocalClientExecutionPreviewError["category"],
  statusCode: number,
): LocalClientExecutionPreviewError {
  return new LocalClientExecutionPreviewError(code, message, category, statusCode);
}

function configError(): LocalClientExecutionPreviewError {
  return previewError(
    "LOCAL_CLIENT_EXECUTION_PREVIEW_CONFIG_INVALID",
    "The local-client execution preview configuration is invalid.",
    "configuration",
    503,
  );
}

function requestError(): LocalClientExecutionPreviewError {
  return previewError(
    "LOCAL_CLIENT_EXECUTION_PREVIEW_REQUEST_INVALID",
    "The local-client execution preview request is invalid.",
    "validation",
    400,
  );
}

function targetError(): LocalClientExecutionPreviewError {
  return previewError(
    "LOCAL_CLIENT_EXECUTION_PREVIEW_TARGET_INVALID",
    "The server-resolved local-client target is not verified.",
    "integrity",
    409,
  );
}
