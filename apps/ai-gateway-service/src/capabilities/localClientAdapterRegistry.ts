import { createHash } from "node:crypto";
import type {
  LocalClientDispatchIntent,
  LocalClientDurableExecutionReceipt,
  LocalClientReceiptReconciliationQuery,
  LocalClientReceiptReconciliationResponse,
} from "./localClientExecutionReceiptReconciliation.ts";

export const LOCAL_CLIENT_ADAPTER_DESCRIPTOR_VERSION = "local-client-adapter-descriptor-v1" as const;
export const LOCAL_CLIENT_ADAPTER_RECEIPT_VERSION = "local-client-adapter-receipt-v2" as const;
export const BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID = "builtin.fake.local-client" as const;
export const BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_TYPE = "fake" as const;
export const BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_VERSION = "1.0.0" as const;
export const BUILTIN_FAKE_LOCAL_CLIENT_ACTION_ID = "simulate" as const;
export const BUILTIN_FAKE_LOCAL_CLIENT_CAPABILITY_ID = "local_application" as const;
const ADAPTER_ABORT_DRAIN_MS = 250;

export type LocalClientAdapterInputValue = string | number | boolean;
export type LocalClientAdapterInput = Readonly<Record<string, LocalClientAdapterInputValue>>;
export type LocalClientAdapterInputValueType = "string" | "number" | "boolean";
export type LocalClientAdapterExecutionMode = "fake" | "governed";
export type LocalClientAdapterReceiptStatus = "simulated" | "accepted" | "completed";
export type LocalClientAdapterAuthorityPhase = "dispatch";

export interface LocalClientAdapterInputFieldSchema {
  readonly name: string;
  readonly valueType: LocalClientAdapterInputValueType;
  readonly required: boolean;
}

export interface LocalClientAdapterActionInputSchema {
  readonly schemaId: string;
  readonly schemaVersion: 1;
  readonly fields: readonly LocalClientAdapterInputFieldSchema[];
  readonly additionalProperties: false;
}

export interface LocalClientAdapterActionDescriptor {
  readonly actionId: string;
  readonly capabilityId: string;
  readonly inputSchema: LocalClientAdapterActionInputSchema;
}

export interface LocalClientAdapterDescriptor {
  readonly descriptorVersion: typeof LOCAL_CLIENT_ADAPTER_DESCRIPTOR_VERSION;
  readonly id: string;
  readonly type: string;
  readonly version: string;
  readonly actions: readonly LocalClientAdapterActionDescriptor[];
}

export interface VerifiedLocalClientAdapterTarget {
  readonly descriptorVersion: "verified-local-client-adapter-target-v1";
  readonly clientId: string;
  readonly state: "verified";
  readonly trustDecision: "verified";
  readonly adapter: {
    readonly id: string;
    readonly type: string;
    readonly version: string;
  };
  readonly capabilityIds: readonly string[];
}

export interface LocalClientAdapterExecutionRequest {
  readonly executionId: string;
  readonly tenantId: string;
  readonly subjectId: string;
  readonly client: VerifiedLocalClientAdapterTarget;
  readonly capabilityId: string;
  readonly actionId: string;
  readonly input: LocalClientAdapterInput;
  readonly receiptReconciliation: LocalClientAdapterReceiptReconciliationContext | null;
  readonly signal: AbortSignal;
  readonly assertAuthority: (phase: LocalClientAdapterAuthorityPhase) => unknown | Promise<unknown>;
}

export interface LocalClientAdapterReceiptReconciliationContext {
  readonly intent: LocalClientDispatchIntent;
  readonly confirmReceipt: (
    receipt: LocalClientDurableExecutionReceipt,
  ) => unknown | Promise<unknown>;
}

export interface LocalClientAdapterInvocation extends LocalClientAdapterExecutionRequest {
  readonly adapterDescriptor: LocalClientAdapterDescriptor;
  readonly actionDescriptor: LocalClientAdapterActionDescriptor;
}

export interface LocalClientAdapterReceiptReconciliationRequest {
  readonly tenantId: string;
  readonly subjectId: string;
  readonly client: VerifiedLocalClientAdapterTarget;
  readonly query: LocalClientReceiptReconciliationQuery;
  readonly signal: AbortSignal;
}

export interface LocalClientAdapterReceipt {
  readonly receiptVersion: typeof LOCAL_CLIENT_ADAPTER_RECEIPT_VERSION;
  readonly receiptId: string;
  readonly executionId: string;
  readonly adapterId: string;
  readonly adapterType: string;
  readonly adapterVersion: string;
  readonly clientId: string;
  readonly capabilityId: string;
  readonly actionId: string;
  readonly planFingerprint: string | null;
  readonly executionMode: LocalClientAdapterExecutionMode;
  readonly externalEffectPerformed: boolean;
  readonly status: LocalClientAdapterReceiptStatus;
}

export interface LocalClientAdapter {
  readonly descriptor: LocalClientAdapterDescriptor;
  execute(this: void, invocation: LocalClientAdapterInvocation): Promise<LocalClientAdapterReceipt>;
  reconcileReceipt?(
    this: void,
    request: LocalClientAdapterReceiptReconciliationRequest,
  ): Promise<LocalClientReceiptReconciliationResponse>;
  close?(this: void): void | Promise<void>;
}

export type LocalClientAdapterRegistryErrorCode =
  | "LOCAL_CLIENT_ADAPTER_DEFINITION_INVALID"
  | "LOCAL_CLIENT_ADAPTER_REGISTRY_CLOSED"
  | "LOCAL_CLIENT_ADAPTER_DUPLICATE"
  | "LOCAL_CLIENT_ADAPTER_UNKNOWN"
  | "LOCAL_CLIENT_ADAPTER_ACTION_UNKNOWN"
  | "LOCAL_CLIENT_ADAPTER_CAPABILITY_MISMATCH"
  | "LOCAL_CLIENT_ADAPTER_TARGET_INVALID"
  | "LOCAL_CLIENT_ADAPTER_TARGET_UNVERIFIED"
  | "LOCAL_CLIENT_ADAPTER_TARGET_MISMATCH"
  | "LOCAL_CLIENT_ADAPTER_IDENTITY_REQUIRED"
  | "LOCAL_CLIENT_ADAPTER_SIGNAL_REQUIRED"
  | "LOCAL_CLIENT_ADAPTER_EXECUTION_ABORTED"
  | "LOCAL_CLIENT_ADAPTER_INPUT_INVALID"
  | "LOCAL_CLIENT_ADAPTER_RECEIPT_INVALID"
  | "LOCAL_CLIENT_ADAPTER_RECONCILIATION_UNSUPPORTED"
  | "LOCAL_CLIENT_ADAPTER_RECONCILIATION_INVALID";

export class LocalClientAdapterRegistryError extends Error {
  readonly code: LocalClientAdapterRegistryErrorCode;
  readonly category: "configuration" | "routing" | "validation" | "auth" | "cancellation" | "integrity";
  readonly statusCode: number;
  readonly retryable = false;
  readonly outcomeUnknown: boolean;

  constructor(
    code: LocalClientAdapterRegistryErrorCode,
    message: string,
    category: LocalClientAdapterRegistryError["category"],
    statusCode: number,
    outcomeUnknown = false,
  ) {
    super(message);
    this.name = "LocalClientAdapterRegistryError";
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
    this.outcomeUnknown = outcomeUnknown;
  }
}

type RegisteredAdapter = {
  readonly descriptor: LocalClientAdapterDescriptor;
  readonly execute: LocalClientAdapter["execute"];
  readonly reconcileReceipt?: NonNullable<LocalClientAdapter["reconcileReceipt"]>;
  readonly close?: NonNullable<LocalClientAdapter["close"]>;
};

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const INPUT_FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/u;
const SEMVER_PATTERN = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u;
const RECEIPT_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{7,127}$/u;
const EXECUTION_ID_PATTERN = /^lc-exec-[a-f0-9]{64}$/u;
const RECEIPT_PLAN_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;
const FORBIDDEN_TRANSPORT_FIELDS = new Set([
  "authorization",
  "command",
  "endpoint",
  "executionid",
  "executable",
  "headers",
  "httpmethod",
  "method",
  "url",
]);

const BUILTIN_FAKE_DESCRIPTOR: LocalClientAdapterDescriptor = deepFreezeDescriptor({
  descriptorVersion: LOCAL_CLIENT_ADAPTER_DESCRIPTOR_VERSION,
  id: BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_ID,
  type: BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_TYPE,
  version: BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_VERSION,
  actions: [{
    actionId: BUILTIN_FAKE_LOCAL_CLIENT_ACTION_ID,
    capabilityId: BUILTIN_FAKE_LOCAL_CLIENT_CAPABILITY_ID,
    inputSchema: {
      schemaId: "local-client.fake.simulate.input",
      schemaVersion: 1,
      fields: [
        { name: "requestTag", valueType: "string", required: false },
        { name: "sequence", valueType: "number", required: false },
      ],
      additionalProperties: false,
    },
  }],
});

export class LocalClientAdapterRegistry {
  readonly #adapters = new Map<string, RegisteredAdapter>();
  #closed = false;

  constructor() {
    this.register(createBuiltinFakeAdapter());
  }

  register(adapter: LocalClientAdapter): LocalClientAdapterDescriptor {
    if (this.#closed) throw registryClosedError();
    assertAdapterDefinition(adapter);
    const descriptor = deepFreezeDescriptor(adapter.descriptor);
    if (this.#adapters.has(descriptor.id)) {
      throw registryError(
        "LOCAL_CLIENT_ADAPTER_DUPLICATE",
        "An adapter with this id is already registered.",
        "configuration",
        409,
      );
    }
    this.#adapters.set(descriptor.id, Object.freeze({
      descriptor,
      execute: adapter.execute,
      ...(adapter.reconcileReceipt === undefined
        ? {}
        : { reconcileReceipt: adapter.reconcileReceipt }),
      ...(adapter.close === undefined ? {} : { close: adapter.close }),
    }));
    return descriptor;
  }

  has(adapterId: string): boolean {
    return typeof adapterId === "string" && this.#adapters.has(adapterId);
  }

  lookup(adapterId: string): LocalClientAdapterDescriptor | null {
    return this.#adapters.get(adapterId)?.descriptor ?? null;
  }

  list(): readonly LocalClientAdapterDescriptor[] {
    return Object.freeze(Array.from(this.#adapters.values(), (entry) => entry.descriptor));
  }

  async execute(request: LocalClientAdapterExecutionRequest): Promise<LocalClientAdapterReceipt> {
    if (this.#closed) throw registryClosedError();
    assertExactObjectShape(request, [
      "executionId",
      "tenantId",
      "subjectId",
      "client",
      "capabilityId",
      "actionId",
      "input",
      "receiptReconciliation",
      "signal",
      "assertAuthority",
    ], "LOCAL_CLIENT_ADAPTER_INPUT_INVALID", "Adapter execution request has an invalid shape.");
    const executionId = assertExecutionId(request.executionId);
    const tenantId = assertIdentity(request.tenantId);
    const subjectId = assertIdentity(request.subjectId);
    const client = cloneVerifiedTarget(request.client);
    const signal = assertAbortSignal(request.signal);
    if (typeof request.assertAuthority !== "function") {
      throw registryError(
        "LOCAL_CLIENT_ADAPTER_INPUT_INVALID",
        "Adapter execution requires a server-owned dispatch authority assertion.",
        "auth",
        409,
      );
    }
    const capabilityId = assertIdentifier(request.capabilityId, "capability id");
    const actionId = assertIdentifier(request.actionId, "action id");
    const entry = this.#adapters.get(client.adapter.id);
    if (!entry) {
      throw registryError(
        "LOCAL_CLIENT_ADAPTER_UNKNOWN",
        "The requested adapter is not registered.",
        "routing",
        404,
      );
    }
    if (
      entry.descriptor.type !== client.adapter.type
      || entry.descriptor.version !== client.adapter.version
    ) {
      throw registryError(
        "LOCAL_CLIENT_ADAPTER_TARGET_MISMATCH",
        "The verified target does not match the registered adapter descriptor.",
        "integrity",
        409,
      );
    }
    if (!client.capabilityIds.includes(capabilityId)) {
      throw registryError(
        "LOCAL_CLIENT_ADAPTER_CAPABILITY_MISMATCH",
        "The verified target does not declare the requested capability.",
        "routing",
        409,
      );
    }
    const actionDescriptor = entry.descriptor.actions.find((action) => action.actionId === actionId);
    if (!actionDescriptor) {
      throw registryError(
        "LOCAL_CLIENT_ADAPTER_ACTION_UNKNOWN",
        "The requested action is not registered for this adapter.",
        "routing",
        404,
      );
    }
    if (actionDescriptor.capabilityId !== capabilityId) {
      throw registryError(
        "LOCAL_CLIENT_ADAPTER_CAPABILITY_MISMATCH",
        "The requested action does not exactly match the requested capability.",
        "routing",
        409,
      );
    }
    const input = validateAndFreezeInput(request.input, actionDescriptor.inputSchema);
    const receiptReconciliation = validateReceiptReconciliationContext(
      request.receiptReconciliation,
      entry.descriptor.type === BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_TYPE,
    );
    throwIfAborted(signal);

    const invocation: LocalClientAdapterInvocation = Object.freeze({
      executionId,
      tenantId,
      subjectId,
      client,
      capabilityId,
      actionId,
      input,
      receiptReconciliation,
      signal,
      assertAuthority: request.assertAuthority,
      adapterDescriptor: entry.descriptor,
      actionDescriptor,
    });
    const rawReceipt = await executeAbortably(entry.execute, invocation, signal);
    return validateAndFreezeReceipt(
      rawReceipt,
      executionId,
      entry.descriptor,
      client,
      actionDescriptor,
    );
  }

  async reconcileReceipt(
    request: LocalClientAdapterReceiptReconciliationRequest,
  ): Promise<LocalClientReceiptReconciliationResponse> {
    if (this.#closed) throw registryClosedError();
    assertExactObjectShape(request, [
      "tenantId",
      "subjectId",
      "client",
      "query",
      "signal",
    ], "LOCAL_CLIENT_ADAPTER_RECONCILIATION_INVALID", "Receipt reconciliation request is invalid.");
    assertIdentity(request.tenantId);
    assertIdentity(request.subjectId);
    const client = cloneVerifiedTarget(request.client);
    const signal = assertAbortSignal(request.signal);
    if (!isPlainRecord(request.query) || request.query.executionId === undefined) {
      throw reconciliationInvalidError();
    }
    assertExecutionId(request.query.executionId);
    const entry = this.#adapters.get(client.adapter.id);
    if (!entry) throw registryError(
      "LOCAL_CLIENT_ADAPTER_UNKNOWN",
      "The reconciliation adapter is not registered.",
      "routing",
      404,
    );
    if (
      entry.descriptor.type !== client.adapter.type
      || entry.descriptor.version !== client.adapter.version
    ) throw registryError(
      "LOCAL_CLIENT_ADAPTER_TARGET_MISMATCH",
      "The reconciliation target no longer matches the registered adapter.",
      "integrity",
      409,
    );
    if (!entry.reconcileReceipt) throw registryError(
      "LOCAL_CLIENT_ADAPTER_RECONCILIATION_UNSUPPORTED",
      "The registered adapter does not support receipt-only reconciliation.",
      "routing",
      409,
    );
    throwIfAborted(signal);
    const response = await entry.reconcileReceipt(Object.freeze({
      tenantId: request.tenantId,
      subjectId: request.subjectId,
      client,
      query: request.query,
      signal,
    }));
    throwIfAborted(signal);
    if (!hasExactDataShape(response, [
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
    ])) throw reconciliationInvalidError();
    if (
      response.executionId !== request.query.executionId
      || response.queryId !== request.query.queryId
      || response.retryAllowed !== false
    ) throw reconciliationInvalidError();
    return Object.freeze({ ...response });
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    const adapters = [...this.#adapters.values()];
    this.#adapters.clear();
    await Promise.allSettled(adapters.map((adapter) => adapter.close?.()));
  }
}

export function createLocalClientAdapterRegistry(): LocalClientAdapterRegistry {
  return new LocalClientAdapterRegistry();
}

function createBuiltinFakeAdapter(): LocalClientAdapter {
  return Object.freeze({
    descriptor: BUILTIN_FAKE_DESCRIPTOR,
    async execute(invocation: LocalClientAdapterInvocation): Promise<LocalClientAdapterReceipt> {
      throwIfAborted(invocation.signal);
      await invocation.assertAuthority("dispatch");
      throwIfAborted(invocation.signal);
      const fingerprint = createHash("sha256")
        .update(JSON.stringify({
          executionId: invocation.executionId,
          tenantId: invocation.tenantId,
          subjectId: invocation.subjectId,
          clientId: invocation.client.clientId,
          adapterId: invocation.adapterDescriptor.id,
          capabilityId: invocation.capabilityId,
          actionId: invocation.actionId,
          input: sortRecord(invocation.input),
        }))
        .digest("hex");
      return Object.freeze({
        receiptVersion: LOCAL_CLIENT_ADAPTER_RECEIPT_VERSION,
        receiptId: `fake:${fingerprint}`,
        executionId: invocation.executionId,
        adapterId: invocation.adapterDescriptor.id,
        adapterType: invocation.adapterDescriptor.type,
        adapterVersion: invocation.adapterDescriptor.version,
        clientId: invocation.client.clientId,
        capabilityId: invocation.capabilityId,
        actionId: invocation.actionId,
        planFingerprint: null,
        executionMode: "fake",
        externalEffectPerformed: false,
        status: "simulated",
      });
    },
  });
}

function assertAdapterDefinition(adapter: LocalClientAdapter): void {
  if (
    !adapter
    || typeof adapter !== "object"
    || Reflect.ownKeys(adapter).some((key) => (
      typeof key !== "string"
      || !["descriptor", "execute", "reconcileReceipt", "close"].includes(key)
    ))
    || !Object.hasOwn(adapter, "descriptor")
    || !Object.hasOwn(adapter, "execute")
    || typeof adapter.execute !== "function"
    || (adapter.reconcileReceipt !== undefined && typeof adapter.reconcileReceipt !== "function")
    || (adapter.close !== undefined && typeof adapter.close !== "function")
  ) {
    throw registryError(
      "LOCAL_CLIENT_ADAPTER_DEFINITION_INVALID",
      "An adapter must provide a code implementation and a fixed descriptor.",
      "configuration",
      400,
    );
  }
  validateDescriptor(adapter.descriptor);
}

function registryClosedError() {
  return registryError(
    "LOCAL_CLIENT_ADAPTER_REGISTRY_CLOSED",
    "The local-client adapter registry is closed.",
    "configuration",
    503,
  );
}

function validateDescriptor(descriptor: LocalClientAdapterDescriptor): void {
  assertExactObjectShape(descriptor, [
    "descriptorVersion",
    "id",
    "type",
    "version",
    "actions",
  ], "LOCAL_CLIENT_ADAPTER_DEFINITION_INVALID", "Adapter descriptor has an invalid shape.");
  if (descriptor.descriptorVersion !== LOCAL_CLIENT_ADAPTER_DESCRIPTOR_VERSION) {
    throw definitionError();
  }
  assertIdentifier(descriptor.id, "adapter id", "LOCAL_CLIENT_ADAPTER_DEFINITION_INVALID");
  assertIdentifier(descriptor.type, "adapter type", "LOCAL_CLIENT_ADAPTER_DEFINITION_INVALID");
  if (typeof descriptor.version !== "string" || !SEMVER_PATTERN.test(descriptor.version)) {
    throw definitionError();
  }
  if (!Array.isArray(descriptor.actions) || descriptor.actions.length === 0) {
    throw definitionError();
  }
  const actionIds = new Set<string>();
  for (const action of descriptor.actions) {
    validateActionDescriptor(action);
    if (actionIds.has(action.actionId)) throw definitionError();
    actionIds.add(action.actionId);
  }
}

function validateActionDescriptor(action: LocalClientAdapterActionDescriptor): void {
  assertExactObjectShape(action, [
    "actionId",
    "capabilityId",
    "inputSchema",
  ], "LOCAL_CLIENT_ADAPTER_DEFINITION_INVALID", "Adapter action descriptor has an invalid shape.");
  assertIdentifier(action.actionId, "action id", "LOCAL_CLIENT_ADAPTER_DEFINITION_INVALID");
  assertIdentifier(action.capabilityId, "capability id", "LOCAL_CLIENT_ADAPTER_DEFINITION_INVALID");
  const schema = action.inputSchema;
  assertExactObjectShape(schema, [
    "schemaId",
    "schemaVersion",
    "fields",
    "additionalProperties",
  ], "LOCAL_CLIENT_ADAPTER_DEFINITION_INVALID", "Adapter action input schema has an invalid shape.");
  assertIdentifier(schema.schemaId, "schema id", "LOCAL_CLIENT_ADAPTER_DEFINITION_INVALID");
  if (schema.schemaVersion !== 1 || schema.additionalProperties !== false || !Array.isArray(schema.fields)) {
    throw definitionError();
  }
  const fieldNames = new Set<string>();
  for (const field of schema.fields) {
    assertExactObjectShape(field, [
      "name",
      "valueType",
      "required",
    ], "LOCAL_CLIENT_ADAPTER_DEFINITION_INVALID", "Adapter input field schema has an invalid shape.");
    if (
      typeof field.name !== "string"
      || !INPUT_FIELD_PATTERN.test(field.name)
      || FORBIDDEN_TRANSPORT_FIELDS.has(field.name.toLowerCase())
      || typeof field.valueType !== "string"
      || !["string", "number", "boolean"].includes(field.valueType)
      || typeof field.required !== "boolean"
      || fieldNames.has(field.name)
    ) {
      throw definitionError();
    }
    fieldNames.add(field.name);
  }
}

function deepFreezeDescriptor(descriptor: LocalClientAdapterDescriptor): LocalClientAdapterDescriptor {
  validateDescriptor(descriptor);
  return Object.freeze({
    descriptorVersion: descriptor.descriptorVersion,
    id: descriptor.id,
    type: descriptor.type,
    version: descriptor.version,
    actions: Object.freeze(descriptor.actions.map((action) => Object.freeze({
      actionId: action.actionId,
      capabilityId: action.capabilityId,
      inputSchema: Object.freeze({
        schemaId: action.inputSchema.schemaId,
        schemaVersion: action.inputSchema.schemaVersion,
        fields: Object.freeze(action.inputSchema.fields.map((field) => Object.freeze({
          name: field.name,
          valueType: field.valueType,
          required: field.required,
        }))),
        additionalProperties: false as const,
      }),
    }))),
  });
}

function cloneVerifiedTarget(target: VerifiedLocalClientAdapterTarget): VerifiedLocalClientAdapterTarget {
  assertExactObjectShape(target, [
    "descriptorVersion",
    "clientId",
    "state",
    "trustDecision",
    "adapter",
    "capabilityIds",
  ], "LOCAL_CLIENT_ADAPTER_TARGET_INVALID", "Verified local-client target has an invalid shape.");
  assertExactObjectShape(target.adapter, [
    "id",
    "type",
    "version",
  ], "LOCAL_CLIENT_ADAPTER_TARGET_INVALID", "Verified local-client adapter reference has an invalid shape.");
  if (
    target.descriptorVersion !== "verified-local-client-adapter-target-v1"
    || target.state !== "verified"
    || target.trustDecision !== "verified"
  ) {
    throw registryError(
      "LOCAL_CLIENT_ADAPTER_TARGET_UNVERIFIED",
      "Adapter execution requires a verified local-client descriptor.",
      "auth",
      403,
    );
  }
  const clientId = assertIdentifier(target.clientId, "client id", "LOCAL_CLIENT_ADAPTER_TARGET_INVALID");
  const adapterId = assertIdentifier(target.adapter.id, "adapter id", "LOCAL_CLIENT_ADAPTER_TARGET_INVALID");
  const adapterType = assertIdentifier(target.adapter.type, "adapter type", "LOCAL_CLIENT_ADAPTER_TARGET_INVALID");
  if (typeof target.adapter.version !== "string" || !SEMVER_PATTERN.test(target.adapter.version)) {
    throw targetError();
  }
  if (!Array.isArray(target.capabilityIds) || target.capabilityIds.length === 0) {
    throw targetError();
  }
  const capabilityIds = target.capabilityIds.map((capability) => (
    assertIdentifier(capability, "capability id", "LOCAL_CLIENT_ADAPTER_TARGET_INVALID")
  ));
  if (new Set(capabilityIds).size !== capabilityIds.length) throw targetError();
  return Object.freeze({
    descriptorVersion: "verified-local-client-adapter-target-v1",
    clientId,
    state: "verified",
    trustDecision: "verified",
    adapter: Object.freeze({
      id: adapterId,
      type: adapterType,
      version: target.adapter.version,
    }),
    capabilityIds: Object.freeze(capabilityIds),
  });
}

function validateAndFreezeInput(
  input: LocalClientAdapterInput,
  schema: LocalClientAdapterActionInputSchema,
): LocalClientAdapterInput {
  if (!isPlainRecord(input)) {
    throw inputError();
  }
  const fields = new Map(schema.fields.map((field) => [field.name, field]));
  const output: Record<string, LocalClientAdapterInputValue> = {};
  for (const key of Object.keys(input).sort()) {
    const field = fields.get(key);
    if (!field || FORBIDDEN_TRANSPORT_FIELDS.has(key.toLowerCase())) throw inputError();
    const value = input[key];
    if (
      typeof value !== field.valueType
      || (typeof value === "number" && !Number.isFinite(value))
      || (typeof value === "string" && value.length > 4_096)
    ) {
      throw inputError();
    }
    output[key] = value;
  }
  for (const field of schema.fields) {
    if (field.required && !Object.hasOwn(input, field.name)) throw inputError();
  }
  return Object.freeze(output);
}

function validateReceiptReconciliationContext(
  value: LocalClientAdapterReceiptReconciliationContext | null,
  fakeAdapter: boolean,
): LocalClientAdapterReceiptReconciliationContext | null {
  if (fakeAdapter) {
    if (value !== null) throw inputError();
    return null;
  }
  if (!isPlainRecord(value)) throw inputError();
  assertExactObjectShape(value, [
    "intent",
    "confirmReceipt",
  ], "LOCAL_CLIENT_ADAPTER_INPUT_INVALID", "Receipt reconciliation context is invalid.");
  if (!isPlainRecord(value.intent) || typeof value.confirmReceipt !== "function") {
    throw inputError();
  }
  return Object.freeze({
    intent: value.intent as unknown as LocalClientDispatchIntent,
    confirmReceipt: value.confirmReceipt as LocalClientAdapterReceiptReconciliationContext["confirmReceipt"],
  });
}

function validateAndFreezeReceipt(
  receipt: LocalClientAdapterReceipt,
  executionId: string,
  descriptor: LocalClientAdapterDescriptor,
  client: VerifiedLocalClientAdapterTarget,
  action: LocalClientAdapterActionDescriptor,
): LocalClientAdapterReceipt {
  const receiptKeys = [
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
  ] as const;
  if (!hasExactDataShape(receipt, receiptKeys)) throw receiptIntegrityError();
  if (
    receipt.receiptVersion !== LOCAL_CLIENT_ADAPTER_RECEIPT_VERSION
    || typeof receipt.receiptId !== "string"
    || !RECEIPT_ID_PATTERN.test(receipt.receiptId)
    || receipt.executionId !== executionId
    || receipt.adapterId !== descriptor.id
    || receipt.adapterType !== descriptor.type
    || receipt.adapterVersion !== descriptor.version
    || receipt.clientId !== client.clientId
    || receipt.capabilityId !== action.capabilityId
    || receipt.actionId !== action.actionId
    || (receipt.executionMode === "governed"
      && !RECEIPT_PLAN_FINGERPRINT_PATTERN.test(String(receipt.planFingerprint ?? "")))
    || (receipt.executionMode === "fake" && receipt.planFingerprint !== null)
    || !["fake", "governed"].includes(receipt.executionMode)
    || typeof receipt.externalEffectPerformed !== "boolean"
    || !["simulated", "accepted", "completed"].includes(receipt.status)
    || (
      descriptor.type === BUILTIN_FAKE_LOCAL_CLIENT_ADAPTER_TYPE
      && (receipt.executionMode !== "fake" || receipt.externalEffectPerformed !== false)
    )
  ) {
    throw receiptIntegrityError();
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

function hasExactDataShape(value: unknown, expectedKeys: readonly string[]): value is Record<string, unknown> {
  if (!isPlainRecord(value)) return false;
  const actualKeys = Reflect.ownKeys(value);
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key) => typeof key === "string" && expectedKeys.includes(key));
}

function receiptIntegrityError(): LocalClientAdapterRegistryError {
  return registryError(
    "LOCAL_CLIENT_ADAPTER_RECEIPT_INVALID",
    "The adapter returned a receipt that failed post-execution integrity validation.",
    "integrity",
    502,
    true,
  );
}

function reconciliationInvalidError(): LocalClientAdapterRegistryError {
  return registryError(
    "LOCAL_CLIENT_ADAPTER_RECONCILIATION_INVALID",
    "The adapter returned invalid receipt reconciliation evidence.",
    "integrity",
    502,
  );
}

function assertExactObjectShape(
  value: unknown,
  allowedKeys: readonly string[],
  code: LocalClientAdapterRegistryErrorCode,
  message: string,
): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value)) {
    throw registryError(code, message, "validation", 400);
  }
  const actualKeys = Reflect.ownKeys(value);
  if (
    actualKeys.length !== allowedKeys.length
    || actualKeys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
    || allowedKeys.some((key) => !Object.hasOwn(value, key))
    || actualKeys.some((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return !descriptor || !("value" in descriptor);
    })
  ) {
    throw registryError(code, message, "validation", 400);
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

function assertExecutionId(value: unknown): string {
  if (typeof value !== "string" || !EXECUTION_ID_PATTERN.test(value)) {
    throw registryError(
      "LOCAL_CLIENT_ADAPTER_INPUT_INVALID",
      "Adapter execution requires one canonical server-generated execution id.",
      "validation",
      400,
    );
  }
  return value;
}

function assertIdentifier(
  value: unknown,
  _label: string,
  code: LocalClientAdapterRegistryErrorCode = "LOCAL_CLIENT_ADAPTER_INPUT_INVALID",
): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    throw registryError(code, "A required identifier is invalid.", "validation", 400);
  }
  return value;
}

function assertIdentity(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 128
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw registryError(
      "LOCAL_CLIENT_ADAPTER_IDENTITY_REQUIRED",
      "Adapter execution requires a tenant and subject identity.",
      "auth",
      401,
    );
  }
  return value;
}

function assertAbortSignal(value: unknown): AbortSignal {
  if (!(value instanceof AbortSignal)) {
    throw registryError(
      "LOCAL_CLIENT_ADAPTER_SIGNAL_REQUIRED",
      "Adapter execution requires an AbortSignal.",
      "validation",
      400,
    );
  }
  return value;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw registryError(
      "LOCAL_CLIENT_ADAPTER_EXECUTION_ABORTED",
      "Adapter execution was cancelled.",
      "cancellation",
      499,
    );
  }
}

function executeAbortably(
  execute: LocalClientAdapter["execute"],
  invocation: LocalClientAdapterInvocation,
  signal: AbortSignal,
): Promise<LocalClientAdapterReceipt> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let abortDrainTimer: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      if (abortDrainTimer) clearTimeout(abortDrainTimer);
    };
    const resolveOnce = (receipt: LocalClientAdapterReceipt) => {
      if (settled) return;
      finish();
      resolve(receipt);
    };
    const rejectOnce = (error: unknown) => {
      if (settled) return;
      finish();
      reject(error);
    };
    const onAbort = () => {
      if (settled || abortDrainTimer) return;
      // Give a cancellation-aware adapter a bounded window to report whether
      // the external action was already dispatched. If it never settles, fail
      // conservatively as an unknown outcome instead of claiming clean cancel.
      abortDrainTimer = setTimeout(() => rejectOnce(registryError(
        "LOCAL_CLIENT_ADAPTER_EXECUTION_ABORTED",
        "Adapter cancellation did not settle within the bounded drain window.",
        "cancellation",
        499,
        true,
      )), ADAPTER_ABORT_DRAIN_MS);
      abortDrainTimer.unref?.();
    };
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve()
      .then(() => {
        throwIfAborted(signal);
        return execute(invocation);
      })
      .then(
        resolveOnce,
        rejectOnce,
      );
  });
}

function sortRecord(input: LocalClientAdapterInput): LocalClientAdapterInput {
  return Object.fromEntries(Object.entries(input).sort(([left], [right]) => left.localeCompare(right)));
}

function registryError(
  code: LocalClientAdapterRegistryErrorCode,
  message: string,
  category: LocalClientAdapterRegistryError["category"],
  statusCode: number,
  outcomeUnknown = false,
): LocalClientAdapterRegistryError {
  return new LocalClientAdapterRegistryError(code, message, category, statusCode, outcomeUnknown);
}

function definitionError(): LocalClientAdapterRegistryError {
  return registryError(
    "LOCAL_CLIENT_ADAPTER_DEFINITION_INVALID",
    "Adapter descriptor or action schema is invalid.",
    "configuration",
    400,
  );
}

function targetError(): LocalClientAdapterRegistryError {
  return registryError(
    "LOCAL_CLIENT_ADAPTER_TARGET_INVALID",
    "Verified local-client target is invalid.",
    "validation",
    400,
  );
}

function inputError(): LocalClientAdapterRegistryError {
  return registryError(
    "LOCAL_CLIENT_ADAPTER_INPUT_INVALID",
    "Adapter input does not match the registered action schema.",
    "validation",
    400,
  );
}
