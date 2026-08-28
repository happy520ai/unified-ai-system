import type {
  LocalClientExecutionFeedbackClaimReference,
  LocalClientSqliteExecutionFeedbackOutbox,
  LocalClientVerifiedReceiptFeedbackEnvelope,
} from "./localClientSqliteExecutionFeedbackOutbox.ts";
import type {
  LocalClientVerifiedExecutionFeedbackAcceptance,
  LocalClientVerifiedExecutionFeedbackInput,
} from "./localClientExecutionOrchestrator.ts";

export const LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCHER_BOUNDARIES = Object.freeze({
  source: "verified-governed-receipt" as const,
  durableStagingRequired: true as const,
  deliverySemantics: "at-least-once-outbox-to-exactly-once-aggregate" as const,
  deliveryFailureChangesCompletedExecutionOutcome: false as const,
  retryAuthorizesExecutionReplay: false as const,
  rawReceiptAccepted: false as const,
  rawRequestOrResponsePersisted: false as const,
  distributed: false as const,
});

export interface LocalClientExecutionFeedbackDispatcherOptions {
  readonly outbox: Pick<
    LocalClientSqliteExecutionFeedbackOutbox,
    "enqueue" | "claimBatch" | "acknowledgeDelivered" | "releaseClaim" | "checkHealth" | "status"
  >;
  readonly aggregateSink: {
    record(
      input: LocalClientVerifiedExecutionFeedbackInput,
      scope: Readonly<{ tenantId: string; userId: string }>,
    ): LocalClientVerifiedExecutionFeedbackAcceptance | Promise<LocalClientVerifiedExecutionFeedbackAcceptance>;
  };
  readonly intervalMs?: number;
  readonly deliveryTimeoutMs?: number;
  readonly batchSize?: number;
  readonly maxBatchesPerRun?: number;
  readonly setTimer?: typeof setTimeout;
  readonly clearTimer?: typeof clearTimeout;
}

export type LocalClientExecutionFeedbackStageAcceptance = Readonly<{
  persisted: true;
  queued: boolean;
  replayed: boolean;
  state: "pending" | "delivered";
}>;

export type LocalClientExecutionFeedbackRecordAcceptance = Readonly<{
  persisted: true;
  exactlyOnce: boolean;
  replayed: boolean;
  queued: boolean;
}>;

export class LocalClientExecutionFeedbackDispatcher {
  readonly #outbox: LocalClientExecutionFeedbackDispatcherOptions["outbox"];
  readonly #aggregateSink: LocalClientExecutionFeedbackDispatcherOptions["aggregateSink"];
  readonly #intervalMs: number;
  readonly #deliveryTimeoutMs: number;
  readonly #batchSize: number;
  readonly #maxBatchesPerRun: number;
  readonly #setTimer: typeof setTimeout;
  readonly #clearTimer: typeof clearTimeout;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #activeRun: Promise<LocalClientExecutionFeedbackFlushResult> | null = null;
  #closePromise: Promise<void> | null = null;
  #started = false;
  #closed = false;
  #lastErrorCode: string | null = null;
  #lastRunAt: string | null = null;
  #deliveredEvents = 0;
  #stageFailureCount = 0;
  #lastStageFailureCode: string | null = null;
  #lastStageFailureAt: string | null = null;
  #releaseFailureCount = 0;
  #lastReleaseFailureCode: string | null = null;
  readonly #unsettledDeliveries = new Set<Promise<unknown>>();

  constructor(options: LocalClientExecutionFeedbackDispatcherOptions) {
    assertOptions(options);
    this.#outbox = options.outbox;
    this.#aggregateSink = options.aggregateSink;
    this.#intervalMs = boundedInteger(options.intervalMs, 1_000, 10, 60 * 60_000);
    this.#deliveryTimeoutMs = boundedInteger(options.deliveryTimeoutMs, 5_000, 10, 60_000);
    this.#batchSize = boundedInteger(options.batchSize, 4, 1, 1_000);
    this.#maxBatchesPerRun = boundedInteger(options.maxBatchesPerRun, 4, 1, 100);
    this.#setTimer = options.setTimer ?? setTimeout;
    this.#clearTimer = options.clearTimer ?? clearTimeout;
    const leaseTtlMs = Number(options.outbox.status.leaseTtlMs);
    const outboxMaxBatchSize = Number(options.outbox.status.maxBatchSize);
    const outboxBusyTimeoutMs = Number(options.outbox.status.busyTimeoutMs);
    if (
      !Number.isSafeInteger(leaseTtlMs)
      || !Number.isSafeInteger(outboxMaxBatchSize)
      || !Number.isSafeInteger(outboxBusyTimeoutMs)
      || this.#batchSize > outboxMaxBatchSize
      || leaseTtlMs < (
        (this.#batchSize * this.#deliveryTimeoutMs)
        + outboxBusyTimeoutMs
        + 1_000
      )
    ) {
      throw Object.assign(new Error(
        "The feedback outbox lease is shorter than the bounded sequential delivery budget.",
      ), {
        code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCHER_DELIVERY_BUDGET_INVALID",
      });
    }
  }

  get status() {
    return Object.freeze({
      ...LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCHER_BOUNDARIES,
      enabled: true,
      available: !this.#closed && this.#outbox.status.available === true,
      lifecycle: this.#closed ? "closed" : this.#started ? "started" : "idle",
      intervalMs: this.#intervalMs,
      deliveryTimeoutMs: this.#deliveryTimeoutMs,
      batchSize: this.#batchSize,
      maxBatchesPerRun: this.#maxBatchesPerRun,
      deliveryInFlight: this.#activeRun !== null,
      unsettledDeliveryCount: this.#unsettledDeliveries.size,
      deliveredEvents: this.#deliveredEvents,
      lastRunAt: this.#lastRunAt,
      lastErrorCode: this.#lastErrorCode,
      stageFailureCount: this.#stageFailureCount,
      lastStageFailureCode: this.#lastStageFailureCode,
      lastStageFailureAt: this.#lastStageFailureAt,
      releaseFailureCount: this.#releaseFailureCount,
      lastReleaseFailureCode: this.#lastReleaseFailureCode,
    });
  }

  start(): void {
    this.#assertOpen();
    if (this.#started) return;
    this.#started = true;
    this.#schedule();
  }

  async stage(
    input: LocalClientVerifiedExecutionFeedbackInput,
    scope: Readonly<{ tenantId: string; userId: string }>,
  ): Promise<LocalClientExecutionFeedbackStageAcceptance> {
    this.#assertOpen();
    try {
      const result = await this.#outbox.enqueue(toEnvelope(input, scope));
      return Object.freeze({
        persisted: true,
        queued: result.queued,
        replayed: result.replayed,
        state: result.state,
      });
    } catch (error) {
      this.#stageFailureCount += 1;
      this.#lastStageFailureCode = safeErrorCode(error);
      this.#lastStageFailureAt = new Date().toISOString();
      throw error;
    }
  }

  async record(
    input: LocalClientVerifiedExecutionFeedbackInput,
    scope: Readonly<{ tenantId: string; userId: string }>,
  ): Promise<LocalClientExecutionFeedbackRecordAcceptance> {
    this.#assertOpen();
    const envelope = toEnvelope(input, scope);
    const staged = await this.#outbox.enqueue(envelope);
    if (staged.state === "delivered") {
      return Object.freeze({
        persisted: true,
        exactlyOnce: true,
        replayed: true,
        queued: false,
      });
    }
    const flushed = await this.flushNow();
    const observed = await this.#outbox.enqueue(envelope);
    return Object.freeze({
      persisted: true,
      exactlyOnce: observed.state === "delivered",
      replayed: flushed.replayedEventFingerprints.includes(staged.eventFingerprint),
      queued: observed.state === "pending",
    });
  }

  flushNow(): Promise<LocalClientExecutionFeedbackFlushResult> {
    this.#assertOpen();
    if (this.#activeRun) return this.#activeRun;
    const run = this.#runFlush().finally(() => {
      if (this.#activeRun === run) this.#activeRun = null;
    });
    this.#activeRun = run;
    return run;
  }

  async checkHealth() {
    this.#assertOpen();
    const outbox = await this.#outbox.checkHealth();
    return Object.freeze({ ...this.status, outbox });
  }

  close(): Promise<void> {
    if (this.#closePromise) return this.#closePromise;
    this.#closed = true;
    this.#started = false;
    if (this.#timer) {
      this.#clearTimer(this.#timer);
      this.#timer = null;
    }
    const activeRun = this.#activeRun;
    this.#closePromise = (async () => {
      await activeRun?.catch(() => undefined);
      await Promise.allSettled([...this.#unsettledDeliveries]);
    })();
    return this.#closePromise;
  }

  async #runFlush(): Promise<LocalClientExecutionFeedbackFlushResult> {
    let batches = 0;
    let delivered = 0;
    let remaining = false;
    const deliveredEventFingerprints: string[] = [];
    const replayedEventFingerprints: string[] = [];
    this.#lastErrorCode = null;
    try {
      while (batches < this.#maxBatchesPerRun && !this.#closed) {
        const claimed = await this.#outbox.claimBatch({ limit: this.#batchSize });
        if (!claimed.claimed || !claimed.lease) {
          remaining = false;
          break;
        }
        batches += 1;
        const reference = Object.freeze({
          leaseToken: claimed.lease.leaseToken,
          fencingToken: claimed.lease.fencingToken,
          eventFingerprints: claimed.lease.eventFingerprints,
        }) satisfies LocalClientExecutionFeedbackClaimReference;
        if (this.#closed) {
          await this.#releaseClaim(reference);
          remaining = true;
          break;
        }
        try {
          const batchReplayedEventFingerprints: string[] = [];
          for (const delivery of claimed.deliveries) {
            const deliveryOperation = Promise.resolve().then(() => this.#aggregateSink.record(
                Object.freeze({
                  eventId: delivery.envelope.eventId,
                  clientId: delivery.envelope.clientId,
                  taskId: delivery.envelope.taskId,
                  status: "success",
                  latencyMs: delivery.envelope.latencyMs,
                  requiredCapabilities: delivery.envelope.capabilities,
                  observedAt: delivery.envelope.observedAt,
                }),
                Object.freeze({
                  tenantId: delivery.envelope.tenantId,
                  userId: delivery.envelope.subjectId,
                }),
              ));
            this.#trackDelivery(deliveryOperation);
            const acceptance = await withDeadline(
              deliveryOperation,
              this.#deliveryTimeoutMs,
            );
            assertAggregateAcceptance(acceptance);
            if (acceptance.replayed) {
              batchReplayedEventFingerprints.push(delivery.eventFingerprint);
            }
          }
          await this.#outbox.acknowledgeDelivered(reference);
          delivered += claimed.deliveries.length;
          this.#deliveredEvents += claimed.deliveries.length;
          deliveredEventFingerprints.push(
            ...claimed.deliveries.map((delivery) => delivery.eventFingerprint),
          );
          replayedEventFingerprints.push(...batchReplayedEventFingerprints);
        } catch (error) {
          this.#lastErrorCode = safeErrorCode(error);
          await this.#releaseClaim(reference);
          remaining = true;
          break;
        }
        remaining = batches >= this.#maxBatchesPerRun;
      }
      this.#lastRunAt = new Date().toISOString();
      return Object.freeze({
        success: true,
        batches,
        delivered,
        remaining,
        deliveredEventFingerprints: Object.freeze(deliveredEventFingerprints),
        replayedEventFingerprints: Object.freeze(replayedEventFingerprints),
      });
    } catch (error) {
      this.#lastErrorCode = safeErrorCode(error);
      this.#lastRunAt = new Date().toISOString();
      return Object.freeze({
        success: false,
        batches,
        delivered,
        remaining: true,
        deliveredEventFingerprints: Object.freeze(deliveredEventFingerprints),
        replayedEventFingerprints: Object.freeze(replayedEventFingerprints),
      });
    }
  }

  #schedule(): void {
    if (this.#closed || !this.#started || this.#timer) return;
    this.#timer = this.#setTimer(() => {
      this.#timer = null;
      if (this.#closed || !this.#started) return;
      void this.flushNow()
        .catch(() => undefined)
        .finally(() => this.#schedule());
    }, this.#intervalMs);
    this.#timer.unref?.();
  }

  #trackDelivery(operation: Promise<unknown>): void {
    this.#unsettledDeliveries.add(operation);
    void operation.then(
      () => this.#unsettledDeliveries.delete(operation),
      () => this.#unsettledDeliveries.delete(operation),
    );
  }

  async #releaseClaim(reference: LocalClientExecutionFeedbackClaimReference): Promise<void> {
    try {
      await this.#outbox.releaseClaim(reference);
    } catch (error) {
      this.#releaseFailureCount += 1;
      this.#lastReleaseFailureCode = safeErrorCode(error);
    }
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw Object.assign(new Error("The local-client execution feedback dispatcher is closed."), {
        code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCHER_CLOSED",
      });
    }
  }
}

export type LocalClientExecutionFeedbackFlushResult = Readonly<{
  success: boolean;
  batches: number;
  delivered: number;
  remaining: boolean;
  deliveredEventFingerprints: readonly string[];
  replayedEventFingerprints: readonly string[];
}>;

export function createLocalClientExecutionFeedbackDispatcher(
  options: LocalClientExecutionFeedbackDispatcherOptions,
): LocalClientExecutionFeedbackDispatcher {
  return new LocalClientExecutionFeedbackDispatcher(options);
}

function toEnvelope(
  input: LocalClientVerifiedExecutionFeedbackInput,
  scope: Readonly<{ tenantId: string; userId: string }>,
): LocalClientVerifiedReceiptFeedbackEnvelope {
  return Object.freeze({
    eventId: input.eventId,
    tenantId: scope.tenantId,
    subjectId: scope.userId,
    clientId: input.clientId,
    taskId: input.taskId,
    capabilities: Object.freeze([...input.requiredCapabilities]),
    status: "success",
    latencyMs: input.latencyMs,
    observedAt: input.observedAt,
  });
}

function assertAggregateAcceptance(value: unknown): asserts value is LocalClientVerifiedExecutionFeedbackAcceptance {
  if (
    !value
    || typeof value !== "object"
    || (value as LocalClientVerifiedExecutionFeedbackAcceptance).persisted !== true
    || (value as LocalClientVerifiedExecutionFeedbackAcceptance).exactlyOnce !== true
    || typeof (value as LocalClientVerifiedExecutionFeedbackAcceptance).replayed !== "boolean"
  ) {
    throw Object.assign(new Error("Exactly-once local-client feedback was not confirmed."), {
      code: "LOCAL_CLIENT_AUTOMATIC_FEEDBACK_NOT_CONFIRMED",
    });
  }
}

function withDeadline<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error("Local-client feedback delivery timed out."), {
        code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_DELIVERY_TIMEOUT",
      }));
    }, timeoutMs);
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function assertOptions(options: LocalClientExecutionFeedbackDispatcherOptions): void {
  if (
    !options
    || typeof options !== "object"
    || typeof options.outbox?.enqueue !== "function"
    || typeof options.outbox?.claimBatch !== "function"
    || typeof options.outbox?.acknowledgeDelivered !== "function"
    || typeof options.outbox?.releaseClaim !== "function"
    || typeof options.outbox?.checkHealth !== "function"
    || typeof options.aggregateSink?.record !== "function"
    || (options.setTimer !== undefined && typeof options.setTimer !== "function")
    || (options.clearTimer !== undefined && typeof options.clearTimer !== "function")
  ) {
    throw Object.assign(new Error("The local-client feedback dispatcher configuration is invalid."), {
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCHER_CONFIGURATION_INVALID",
    });
  }
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw Object.assign(new Error("The local-client feedback dispatcher limit is invalid."), {
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCHER_CONFIGURATION_INVALID",
    });
  }
  return Number(value);
}

function safeErrorCode(error: unknown): string {
  const code = String((error as { code?: unknown })?.code ?? "LOCAL_CLIENT_EXECUTION_FEEDBACK_DELIVERY_FAILED");
  return /^[A-Z0-9_:-]{1,128}$/u.test(code)
    ? code
    : "LOCAL_CLIENT_EXECUTION_FEEDBACK_DELIVERY_FAILED";
}
