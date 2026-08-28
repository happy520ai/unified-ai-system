import type { LocalClientAdapterRegistry, VerifiedLocalClientAdapterTarget } from "./localClientAdapterRegistry.ts";
import type {
  LocalClientReceiptRecoveryWorkItem,
} from "./localClientExecutionReceiptReconciliation.ts";
import type {
  LocalClientExecutionReceiptJournalBinding,
  LocalClientReceiptJournalRecoveryListResult,
} from "./localClientExecutionReceiptJournalRegistry.ts";
import {
  createLocalClientVerifiedReceiptFeedbackDelivery,
  validateLocalClientVerifiedExecutionFeedbackStageAcceptance,
  type LocalClientVerifiedExecutionFeedbackSink,
} from "./localClientExecutionOrchestrator.ts";

export const LOCAL_CLIENT_EXECUTION_RECEIPT_RECOVERY_BOUNDARIES = Object.freeze({
  executionRedispatchAllowed: false as const,
  reconciliationQueryAuthorizesExecution: false as const,
  absenceProvesNotExecuted: false as const,
  pendingProvesNotExecuted: false as const,
  completedReceiptCanRecoverFeedback: true as const,
  lifecycleFinalizationIdempotentRequired: true as const,
  automaticApply: "reconciliation-only" as const,
  distributed: false as const,
});

type RecoveryBinding = Readonly<{
  tenantId: string;
  clientId: string;
  journal: LocalClientExecutionReceiptJournalBinding["journal"];
  item: LocalClientReceiptRecoveryWorkItem;
}>;

export interface LocalClientExecutionReceiptRecoveryServiceOptions {
  readonly receiptRegistry: {
    readonly status: Readonly<{ available?: boolean }>;
    listRecoveryWorkItems(globalLimit?: number): Promise<LocalClientReceiptJournalRecoveryListResult>;
  };
  readonly adapterRegistry: Pick<LocalClientAdapterRegistry, "reconcileReceipt">;
  readonly resolveVerifiedTarget: (input: Readonly<{
    tenantId: string;
    subjectId: string;
    clientId: string;
  }>) => VerifiedLocalClientAdapterTarget | Promise<VerifiedLocalClientAdapterTarget>;
  readonly feedbackSink: LocalClientVerifiedExecutionFeedbackSink;
  readonly lifecycle: {
    getStatus(executionId: string): unknown | Promise<unknown>;
    complete(
      executionId: string,
      status: "completed" | "failed",
      summary: Record<string, unknown>,
    ): unknown | Promise<unknown>;
  };
  readonly intervalMs?: number;
  readonly batchSize?: number;
  readonly recoveryGraceMs?: number;
  readonly now?: () => number;
}

export class LocalClientExecutionReceiptRecoveryService {
  readonly #options: LocalClientExecutionReceiptRecoveryServiceOptions;
  readonly #intervalMs: number;
  readonly #batchSize: number;
  readonly #recoveryGraceMs: number;
  readonly #now: () => number;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #activeRun: Promise<LocalClientExecutionReceiptRecoveryRunResult> | null = null;
  #controller: AbortController | null = null;
  #started = false;
  #closed = false;
  #runCount = 0;
  #resolvedCount = 0;
  #unresolvedCount = 0;
  #failureCount = 0;
  #consecutiveFailureCount = 0;
  #lastErrorCode: string | null = null;
  #lastRunSucceeded: boolean | null = null;
  #lastSuccessAt: string | null = null;
  #lastRunAt: string | null = null;

  constructor(options: LocalClientExecutionReceiptRecoveryServiceOptions) {
    assertOptions(options);
    this.#options = options;
    this.#intervalMs = boundedInteger(options.intervalMs, 5_000, 100, 60 * 60_000);
    this.#batchSize = boundedInteger(options.batchSize, 32, 1, 1_000);
    this.#recoveryGraceMs = boundedInteger(
      options.recoveryGraceMs,
      120_000,
      0,
      24 * 60 * 60_000,
    );
    this.#now = options.now ?? Date.now;
  }

  get status() {
    return Object.freeze({
      ...LOCAL_CLIENT_EXECUTION_RECEIPT_RECOVERY_BOUNDARIES,
      enabled: true,
      available: !this.#closed && this.#options.receiptRegistry.status.available === true,
      lifecycle: this.#closed ? "closed" : this.#started ? "started" : "idle",
      intervalMs: this.#intervalMs,
      batchSize: this.#batchSize,
      recoveryGraceMs: this.#recoveryGraceMs,
      runInFlight: this.#activeRun !== null,
      runCount: this.#runCount,
      resolvedCount: this.#resolvedCount,
      unresolvedCount: this.#unresolvedCount,
      failureCount: this.#failureCount,
      consecutiveFailureCount: this.#consecutiveFailureCount,
      lastErrorCode: this.#lastErrorCode,
      lastRunSucceeded: this.#lastRunSucceeded,
      lastSuccessAt: this.#lastSuccessAt,
      lastRunAt: this.#lastRunAt,
    });
  }

  start(): void {
    this.#assertOpen();
    if (this.#started) return;
    this.#started = true;
    void this.runOnce().finally(() => this.#schedule());
  }

  runOnce(): Promise<LocalClientExecutionReceiptRecoveryRunResult> {
    this.#assertOpen();
    if (this.#activeRun) return this.#activeRun;
    this.#controller = new AbortController();
    const run = this.#run(this.#controller.signal).finally(() => {
      if (this.#activeRun === run) this.#activeRun = null;
      this.#controller = null;
    });
    this.#activeRun = run;
    return run;
  }

  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    this.#started = false;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    this.#controller?.abort();
    await this.#activeRun?.catch(() => undefined);
  }

  async #run(signal: AbortSignal): Promise<LocalClientExecutionReceiptRecoveryRunResult> {
    let scanned = 0;
    let resolved = 0;
    let unresolved = 0;
    let failed = 0;
    this.#lastErrorCode = null;
    try {
      const listing = await this.#options.receiptRegistry.listRecoveryWorkItems(this.#batchSize);
      failed += listing.failures.count;
      if (listing.failures.code !== null) this.#lastErrorCode = listing.failures.code;
      for (const binding of listing.workItems as readonly RecoveryBinding[]) {
        if (scanned >= this.#batchSize) break;
        if (signal.aborted || this.#closed) break;
        scanned += 1;
        try {
          const outcome = await this.#recoverBinding(binding, signal);
          if (outcome === "resolved") resolved += 1;
          else unresolved += 1;
        } catch (error) {
          failed += 1;
          this.#lastErrorCode = safeErrorCode(error);
        }
      }
    } catch (error) {
      failed += 1;
      this.#lastErrorCode = safeErrorCode(error);
    }
    this.#runCount += 1;
    this.#resolvedCount += resolved;
    this.#unresolvedCount += unresolved;
    this.#failureCount += failed;
    this.#lastRunAt = new Date().toISOString();
    this.#lastRunSucceeded = failed === 0;
    if (this.#lastRunSucceeded) {
      this.#consecutiveFailureCount = 0;
      this.#lastSuccessAt = this.#lastRunAt;
    } else if (this.#consecutiveFailureCount < Number.MAX_SAFE_INTEGER) {
      this.#consecutiveFailureCount += 1;
    }
    return Object.freeze({
      success: failed === 0,
      scanned,
      resolved,
      unresolved,
      failed,
    });
  }

  async #recoverBinding(
    binding: RecoveryBinding,
    signal: AbortSignal,
  ): Promise<"resolved" | "unresolved"> {
    assertBinding(binding);
    let item = binding.item;
    const updatedAtMs = Date.parse(item.updatedAt);
    if (
      !Number.isFinite(updatedAtMs)
      || this.#now() - updatedAtMs < this.#recoveryGraceMs
    ) return "unresolved";
    for (let transition = 0; transition < 5; transition += 1) {
      if (signal.aborted) return "unresolved";
      switch (item.recoveryAction) {
        case "resolve-not-dispatched":
          await binding.journal.resolvePreparedAsNotDispatched(item.executionId);
          item = await binding.journal.getRecoveryWorkItem(item.executionId);
          continue;
        case "query-client-only": {
          const query = await binding.journal.createReconciliationQuery(item.executionId);
          const target = await this.#options.resolveVerifiedTarget({
            tenantId: item.identity.tenantId,
            subjectId: item.identity.subjectId,
            clientId: item.identity.clientId,
          });
          const response = await this.#options.adapterRegistry.reconcileReceipt({
            tenantId: item.identity.tenantId,
            subjectId: item.identity.subjectId,
            client: target,
            query,
            signal,
          });
          const applied = await binding.journal.applyReconciliation(query, response);
          if (applied.resolved !== true) return "unresolved";
          item = await binding.journal.getRecoveryWorkItem(item.executionId);
          continue;
        }
        case "stage-feedback": {
          if (
            !item.receiptId
            || item.completedAtMs === null
            || item.intentIssuedAtMs === null
          ) throw recoveryError("RECEIPT_CONTEXT_INVALID");
          const feedbackDelivery = createLocalClientVerifiedReceiptFeedbackDelivery({
            tenantId: item.identity.tenantId,
            subjectId: item.identity.subjectId,
            clientId: item.identity.clientId,
            capabilityId: item.identity.capabilityId,
            executionId: item.executionId,
            durableReceiptId: item.receiptId,
            intentIssuedAtMs: item.intentIssuedAtMs,
            completedAtMs: item.completedAtMs,
          });
          if (!this.#options.feedbackSink.stage) throw recoveryError("FEEDBACK_STAGE_UNAVAILABLE");
          validateLocalClientVerifiedExecutionFeedbackStageAcceptance(
            await this.#options.feedbackSink.stage(
              feedbackDelivery.input,
              feedbackDelivery.scope,
            ),
          );
          await binding.journal.markFeedbackStaged({
            executionId: item.executionId,
            receiptId: item.receiptId,
          });
          await Promise.resolve(this.#options.feedbackSink.record(
            feedbackDelivery.input,
            feedbackDelivery.scope,
          ))
            .catch(() => undefined);
          item = await binding.journal.getRecoveryWorkItem(item.executionId);
          continue;
        }
        case "finalize-completed-lifecycle":
          await ensureLifecycleFinalized(this.#options.lifecycle, item, "completed");
          await binding.journal.markLifecycleFinalized({
            executionId: item.executionId,
            outcome: "completed",
          });
          return "resolved";
        case "finalize-failed-lifecycle":
          await ensureLifecycleFinalized(this.#options.lifecycle, item, "failed");
          await binding.journal.markLifecycleFinalized({
            executionId: item.executionId,
            outcome: "failed-before-effect",
          });
          return "resolved";
        default:
          return "unresolved";
      }
    }
    return "unresolved";
  }

  #schedule(): void {
    if (this.#closed || !this.#started || this.#timer) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      if (this.#closed || !this.#started) return;
      void this.runOnce().finally(() => this.#schedule());
    }, this.#intervalMs);
    this.#timer.unref?.();
  }

  #assertOpen(): void {
    if (this.#closed) throw recoveryError("CLOSED");
  }
}

export type LocalClientExecutionReceiptRecoveryRunResult = Readonly<{
  success: boolean;
  scanned: number;
  resolved: number;
  unresolved: number;
  failed: number;
}>;

export function createLocalClientExecutionReceiptRecoveryService(
  options: LocalClientExecutionReceiptRecoveryServiceOptions,
): LocalClientExecutionReceiptRecoveryService {
  return new LocalClientExecutionReceiptRecoveryService(options);
}

async function ensureLifecycleFinalized(
  lifecycle: LocalClientExecutionReceiptRecoveryServiceOptions["lifecycle"],
  item: LocalClientReceiptRecoveryWorkItem,
  outcome: "completed" | "failed",
): Promise<void> {
  const snapshot = await lifecycle.getStatus(item.executionId);
  const current = isRecord(snapshot) ? String(snapshot.status ?? "") : "";
  if (outcome === "completed" && current === "completed") return;
  if (outcome === "failed" && (current === "failed" || current === "cancelled")) return;
  const result = await lifecycle.complete(item.executionId, outcome, {
    outcome: outcome === "completed" ? "completed-reconciled" : "failed-before-effect-reconciled",
    retryAllowed: false,
    externalEffectCommitted: outcome === "completed",
    planFingerprint: item.identity.planFingerprint,
    durableReceiptFingerprint: item.receiptFingerprint,
  });
  if (isRecord(result) && Object.hasOwn(result, "success") && result.success !== true) {
    throw recoveryError("LIFECYCLE_FINALIZE_FAILED");
  }
}

function assertBinding(binding: RecoveryBinding): void {
  if (
    !binding
    || typeof binding !== "object"
    || binding.item.redispatchAllowed !== false
    || binding.tenantId !== binding.item.identity.tenantId
    || binding.clientId !== binding.item.identity.clientId
  ) throw recoveryError("BINDING_INVALID");
}

function assertOptions(options: LocalClientExecutionReceiptRecoveryServiceOptions): void {
  if (
    !options
    || typeof options !== "object"
    || typeof options.receiptRegistry?.listRecoveryWorkItems !== "function"
    || typeof options.adapterRegistry?.reconcileReceipt !== "function"
    || typeof options.resolveVerifiedTarget !== "function"
    || typeof options.feedbackSink?.record !== "function"
    || typeof options.lifecycle?.getStatus !== "function"
    || typeof options.lifecycle?.complete !== "function"
    || (options.now !== undefined && typeof options.now !== "function")
  ) throw recoveryError("CONFIGURATION_INVALID");
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw recoveryError("CONFIGURATION_INVALID");
  }
  return Number(value);
}

function safeErrorCode(error: unknown): string {
  const code = String((error as { code?: unknown })?.code ?? "LOCAL_CLIENT_RECEIPT_RECOVERY_FAILED");
  return /^[A-Z0-9_:-]{1,128}$/u.test(code) ? code : "LOCAL_CLIENT_RECEIPT_RECOVERY_FAILED";
}

function recoveryError(reason: string) {
  return Object.assign(new Error("Local-client receipt reconciliation recovery failed."), {
    code: `LOCAL_CLIENT_RECEIPT_RECOVERY_${reason}`,
    category: "reconciliation",
    statusCode: 503,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
