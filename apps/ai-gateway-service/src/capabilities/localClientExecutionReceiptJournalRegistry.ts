import type {
  LocalClientReceiptRecoveryWorkItem,
  LocalClientSqliteExecutionReceiptJournal,
} from "./localClientExecutionReceiptReconciliation.ts";
import type { LocalClientExecutionReceiptJournalPort } from "./localClientExecutionOrchestrator.ts";

export const LOCAL_CLIENT_EXECUTION_RECEIPT_JOURNAL_REGISTRY_BOUNDARIES = Object.freeze({
  tenantClientExactBinding: true as const,
  requestBodySelectsJournal: false as const,
  rawBindingStatusExposed: false as const,
  ownsJournalLifecycle: true as const,
  durable: true as const,
  distributed: false as const,
  singleHost: true as const,
  recoveryBatchFairness: "rotating-round-robin" as const,
  clientAtomicEffectReceiptVerified: false as const,
  snapshotRollbackProtected: false as const,
});

export const LOCAL_CLIENT_RECEIPT_JOURNAL_ENUMERATION_FAILURE_CODE =
  "LOCAL_CLIENT_RECEIPT_JOURNAL_ENUMERATION_FAILED" as const;

export interface LocalClientExecutionReceiptJournalBinding {
  readonly tenantId: string;
  readonly clientId: string;
  readonly journal: LocalClientExecutionReceiptJournalPort
    & Pick<
      LocalClientSqliteExecutionReceiptJournal,
      | "status"
      | "close"
      | "listRecoveryWorkItems"
      | "resolvePreparedAsNotDispatched"
      | "resolveArmedAsNotDispatched"
      | "getRecoveryWorkItem"
      | "createReconciliationQuery"
      | "applyReconciliation"
    >;
}

export type LocalClientReceiptJournalRecoveryListResult = Readonly<{
  workItems: readonly Readonly<{
    tenantId: string;
    clientId: string;
    journal: LocalClientExecutionReceiptJournalBinding["journal"];
    item: LocalClientReceiptRecoveryWorkItem;
  }>[];
  failures: Readonly<{
    count: number;
    code: typeof LOCAL_CLIENT_RECEIPT_JOURNAL_ENUMERATION_FAILURE_CODE | null;
  }>;
}>;

export class LocalClientExecutionReceiptJournalRegistry {
  readonly #bindings = new Map<string, LocalClientExecutionReceiptJournalBinding>();
  readonly #bindingCount: number;
  #closed = false;
  #closePromise: Promise<void> | null = null;
  #recoveryCursor = 0;

  constructor(bindings: readonly LocalClientExecutionReceiptJournalBinding[]) {
    if (!Array.isArray(bindings) || bindings.length < 1 || bindings.length > 64) {
      throw configurationError("BINDINGS_INVALID");
    }
    for (const raw of bindings) {
      const binding = normalizeBinding(raw);
      const key = bindingKey(binding.tenantId, binding.clientId);
      if (this.#bindings.has(key)) throw configurationError("BINDING_DUPLICATE");
      this.#bindings.set(key, binding);
    }
    this.#bindingCount = this.#bindings.size;
  }

  get status() {
    const journals = [...this.#bindings.values()].map((binding) => binding.journal.status);
    return Object.freeze({
      ...LOCAL_CLIENT_EXECUTION_RECEIPT_JOURNAL_REGISTRY_BOUNDARIES,
      enabled: this.#bindingCount > 0,
      available: !this.#closed
        && journals.length === this.#bindingCount
        && journals.every((status) => status.available === true),
      closed: this.#closed,
      bindingCount: this.#bindingCount,
      availableJournalCount: journals.filter((status) => status.available === true).length,
      recoveryContextEncrypted: journals.length === this.#bindingCount
        && journals.every((status) => status.recoveryContextEncrypted === true),
      snapshotRollbackProtected: journals.length === this.#bindingCount
        && journals.every((status) => Boolean(status.databaseSnapshotRollbackProtected)),
      clientAtomicEffectReceiptVerified: false,
      fullClosureRequiresClientAtomicEffectReceipt: true,
    });
  }

  resolve(input: Readonly<{ tenantId: string; clientId: string }>): LocalClientExecutionReceiptJournalBinding["journal"] | null {
    if (this.#closed) return null;
    if (!isIdentity(input?.tenantId) || !isClientId(input?.clientId)) return null;
    return this.#bindings.get(bindingKey(input.tenantId, input.clientId))?.journal ?? null;
  }

  async listRecoveryWorkItems(globalLimit = 100): Promise<LocalClientReceiptJournalRecoveryListResult> {
    if (this.#closed) throw unavailableError();
    if (!Number.isSafeInteger(globalLimit) || globalLimit < 1 || globalLimit > 1_000) {
      throw configurationError("LIMIT_INVALID");
    }
    const bindings = [...this.#bindings.values()];
    if (bindings.length === 0) return emptyRecoveryListResult();
    const start = this.#recoveryCursor % bindings.length;
    const rotated = bindings.map((_, index) => bindings[(start + index) % bindings.length]!);
    const buckets: Array<Readonly<{
      binding: LocalClientExecutionReceiptJournalBinding;
      rotatedIndex: number;
      items: readonly LocalClientReceiptRecoveryWorkItem[];
    }>> = [];
    let failureCount = 0;
    for (let rotatedIndex = 0; rotatedIndex < rotated.length; rotatedIndex += 1) {
      const binding = rotated[rotatedIndex]!;
      try {
        buckets.push(Object.freeze({
          binding,
          rotatedIndex,
          items: await binding.journal.listRecoveryWorkItems(globalLimit),
        }));
      } catch {
        // A failed binding must degrade recovery without disclosing its identity
        // or preventing healthy tenant/client journals from making progress.
        failureCount += 1;
      }
    }
    const workItems = [];
    let lastReturnedBindingIndex = -1;
    for (let depth = 0; workItems.length < globalLimit; depth += 1) {
      let found = false;
      for (let bucketIndex = 0; bucketIndex < buckets.length; bucketIndex += 1) {
        const bucket = buckets[bucketIndex]!;
        const item = bucket.items[depth];
        if (!item) continue;
        found = true;
        lastReturnedBindingIndex = bucket.rotatedIndex;
        workItems.push(Object.freeze({
          tenantId: bucket.binding.tenantId,
          clientId: bucket.binding.clientId,
          journal: bucket.binding.journal,
          item,
        }));
        if (workItems.length >= globalLimit) break;
      }
      if (!found) break;
    }
    this.#recoveryCursor = lastReturnedBindingIndex >= 0
      ? (start + lastReturnedBindingIndex + 1) % bindings.length
      : (start + 1) % bindings.length;
    return Object.freeze({
      workItems: Object.freeze(workItems),
      failures: Object.freeze({
        count: failureCount,
        code: failureCount > 0 ? LOCAL_CLIENT_RECEIPT_JOURNAL_ENUMERATION_FAILURE_CODE : null,
      }),
    });
  }

  close(): Promise<void> {
    if (this.#closePromise) return this.#closePromise;
    this.#closed = true;
    this.#recoveryCursor = 0;
    const journals = [...this.#bindings.values()].map((binding) => binding.journal);
    this.#bindings.clear();
    this.#closePromise = (async () => {
      const results = await Promise.allSettled(journals.map((journal) => journal.close()));
      const failures = results
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason);
      if (failures.length > 0) {
        throw new AggregateError(failures, "One or more receipt journals failed to close.");
      }
    })();
    return this.#closePromise;
  }
}

function emptyRecoveryListResult(): LocalClientReceiptJournalRecoveryListResult {
  return Object.freeze({
    workItems: Object.freeze([]),
    failures: Object.freeze({ count: 0, code: null }),
  });
}

export function createLocalClientExecutionReceiptJournalRegistry(
  bindings: readonly LocalClientExecutionReceiptJournalBinding[],
): LocalClientExecutionReceiptJournalRegistry {
  return new LocalClientExecutionReceiptJournalRegistry(bindings);
}

function normalizeBinding(
  raw: LocalClientExecutionReceiptJournalBinding,
): LocalClientExecutionReceiptJournalBinding {
  if (!isDataRecord(raw, ["tenantId", "clientId", "journal"])) {
    throw configurationError("BINDING_INVALID");
  }
  if (!isIdentity(raw.tenantId) || !isClientId(raw.clientId)) {
    throw configurationError("BINDING_INVALID");
  }
  const journal = raw.journal;
  if (
    !journal
    || typeof journal !== "object"
    || typeof journal.prepareDispatch !== "function"
    || typeof journal.armDispatch !== "function"
    || typeof journal.confirmReceipt !== "function"
    || typeof journal.markFeedbackStaged !== "function"
    || typeof journal.markLifecycleFinalized !== "function"
    || typeof journal.listRecoveryWorkItems !== "function"
    || typeof journal.resolvePreparedAsNotDispatched !== "function"
    || typeof journal.resolveArmedAsNotDispatched !== "function"
    || typeof journal.getRecoveryWorkItem !== "function"
    || typeof journal.createReconciliationQuery !== "function"
    || typeof journal.applyReconciliation !== "function"
    || typeof journal.close !== "function"
    || journal.status?.role !== "gateway"
    || journal.status?.durable !== true
    || journal.status?.available !== true
  ) throw configurationError("JOURNAL_INVALID");
  return Object.freeze({ tenantId: raw.tenantId, clientId: raw.clientId, journal });
}

function bindingKey(tenantId: string, clientId: string): string {
  return `${tenantId}\0${clientId}`;
}

function isIdentity(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= 256
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function isClientId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9._-]{0,127}$/u.test(value);
}

function isDataRecord(value: unknown, expectedKeys: readonly string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === expectedKeys.length && keys.every((key) => {
    if (typeof key !== "string" || !expectedKeys.includes(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return Boolean(descriptor && "value" in descriptor);
  });
}

function configurationError(reason: string) {
  return Object.assign(new Error("The local-client receipt journal registry configuration is invalid."), {
    code: `LOCAL_CLIENT_RECEIPT_JOURNAL_REGISTRY_${reason}`,
    category: "configuration",
    statusCode: 503,
  });
}

function unavailableError() {
  return Object.assign(new Error("The local-client receipt journal registry is unavailable."), {
    code: "LOCAL_CLIENT_RECEIPT_JOURNAL_REGISTRY_UNAVAILABLE",
    category: "availability",
    statusCode: 503,
  });
}
