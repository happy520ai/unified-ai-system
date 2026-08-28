export const LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_BOUNDARIES = Object.freeze({
  defaultMode: "dry-run" as const,
  applyRequiresExplicitEnable: true as const,
  singleProcess: true as const,
  distributedLeaderElection: false as const,
  singleFlight: true as const,
  overlappingRounds: false as const,
  boundedConcurrency: true as const,
  perTenantIsolation: true as const,
  exponentialFailureBackoff: true as const,
  jitteredScheduling: true as const,
  deadlineMode: "cooperative-abort" as const,
  managementApiMustHonorAbortSignal: true as const,
  rawTenantIdentifiersInTelemetry: false as const,
  managementResultsInTelemetry: false as const,
});

export interface LocalClientSmartManagementInput {
  readonly tenantId: string;
  readonly subjectId: string;
  readonly dryRun?: boolean;
  /** Required for scheduler deadlines and close quiescence. */
  readonly signal?: AbortSignal;
}

export interface LocalClientSmartManagementApiPort {
  smartManage(input: LocalClientSmartManagementInput): Promise<unknown>;
}

export interface LocalClientSmartManagementTenant {
  readonly tenantId: string;
  readonly subjectId: string;
}

export interface LocalClientSmartManagementTenantProvider {
  listTenants(signal?: AbortSignal): Promise<readonly LocalClientSmartManagementTenant[]>;
}

export interface LocalClientSmartManagementClock {
  now(): number;
}

export interface LocalClientSmartManagementTimerPort {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export type LocalClientSmartManagementEvent = Readonly<{
  eventVersion: "local-client-smart-management-scheduler-event-v1";
  type:
    | "scheduler.started"
    | "scheduler.scheduled"
    | "scheduler.timer-failed"
    | "round.started"
    | "round.tenant-completed"
    | "round.completed"
    | "scheduler.closed";
  atMs: number;
  roundId?: number;
  tenantOrdinal?: number;
  outcome?: "succeeded" | "failed" | "deadline" | "cancelled";
  executionMode?: "dry-run" | "apply";
  delayMs?: number;
  tenantCount?: number;
  attempted?: number;
  succeeded?: number;
  failed?: number;
  timedOut?: number;
  cancelled?: number;
  skipped?: number;
  providerFailed?: boolean;
  deadlineExceeded?: boolean;
  durationMs?: number;
  failureStreak?: number;
}>;

export interface LocalClientSmartManagementRoundSummary {
  readonly roundId: number;
  readonly startedAtMs: number;
  readonly finishedAtMs: number;
  readonly durationMs: number;
  readonly executionMode: "dry-run" | "apply";
  readonly dryRun: boolean;
  readonly tenantCount: number;
  readonly attempted: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly timedOut: number;
  readonly cancelled: number;
  readonly skipped: number;
  readonly providerFailed: boolean;
  readonly deadlineExceeded: boolean;
  readonly successful: boolean;
}

export interface LocalClientSmartManagementSchedulerStatus {
  readonly statusVersion: "local-client-smart-management-scheduler-status-v1";
  readonly lifecycle: "idle" | "started" | "closing" | "closed";
  readonly executionMode: "dry-run" | "apply";
  readonly dryRun: boolean;
  readonly applyEnabled: boolean;
  readonly running: boolean;
  readonly timerScheduled: boolean;
  readonly activeTenantCount: number;
  readonly completedRounds: number;
  readonly failureStreak: number;
  readonly nextRunAtMs: number | null;
  readonly nextDelayMs: number | null;
  readonly lastRound: LocalClientSmartManagementRoundSummary | null;
  readonly configuration: Readonly<{
    intervalMs: number;
    initialDelayMs: number;
    failureBackoffBaseMs: number;
    failureBackoffMaxMs: number;
    roundDeadlineMs: number;
    maxConcurrency: number;
    maxTenants: number;
    jitterRatio: number;
  }>;
  readonly boundaries: typeof LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_BOUNDARIES;
}

export interface LocalClientSmartManagementSchedulerOptions {
  readonly managementApi: LocalClientSmartManagementApiPort;
  readonly tenantProvider: LocalClientSmartManagementTenantProvider;
  readonly clock?: LocalClientSmartManagementClock;
  readonly timers?: LocalClientSmartManagementTimerPort;
  readonly random?: () => number;
  readonly eventSink?: (event: LocalClientSmartManagementEvent) => void;
  /** The only switch that allows scheduled calls to use dryRun=false. */
  readonly enableApply?: boolean;
  readonly intervalMs?: number;
  readonly initialDelayMs?: number;
  readonly failureBackoffBaseMs?: number;
  readonly failureBackoffMaxMs?: number;
  readonly roundDeadlineMs?: number;
  readonly maxConcurrency?: number;
  readonly maxTenants?: number;
  readonly jitterRatio?: number;
}

export type LocalClientSmartManagementSchedulerErrorCode =
  | "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIGURATION_INVALID"
  | "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CLOSED";

export class LocalClientSmartManagementSchedulerError extends Error {
  readonly code: LocalClientSmartManagementSchedulerErrorCode;
  readonly category: "configuration" | "lifecycle";

  constructor(input: Readonly<{
    code: LocalClientSmartManagementSchedulerErrorCode;
    message: string;
    category: LocalClientSmartManagementSchedulerError["category"];
  }>) {
    super(input.message);
    this.name = "LocalClientSmartManagementSchedulerError";
    this.code = input.code;
    this.category = input.category;
  }
}

type NormalizedSchedulerOptions = Readonly<{
  managementApi: LocalClientSmartManagementApiPort;
  tenantProvider: LocalClientSmartManagementTenantProvider;
  clock: LocalClientSmartManagementClock;
  timers: LocalClientSmartManagementTimerPort;
  random: () => number;
  eventSink: ((event: LocalClientSmartManagementEvent) => void) | null;
  applyEnabled: boolean;
  intervalMs: number;
  initialDelayMs: number;
  failureBackoffBaseMs: number;
  failureBackoffMaxMs: number;
  roundDeadlineMs: number;
  maxConcurrency: number;
  maxTenants: number;
  jitterRatio: number;
}>;

type TenantOutcome = "succeeded" | "failed" | "deadline" | "cancelled";

const DEFAULT_INTERVAL_MS = 5 * 60_000;
const DEFAULT_INITIAL_DELAY_MS = 0;
const DEFAULT_BACKOFF_BASE_MS = 30_000;
const DEFAULT_BACKOFF_MAX_MS = 30 * 60_000;
const DEFAULT_ROUND_DEADLINE_MS = 2 * 60_000;
const DEFAULT_MAX_CONCURRENCY = 4;
const DEFAULT_MAX_TENANTS = 256;
const DEFAULT_JITTER_RATIO = 0.1;
const MAX_DELAY_MS = 24 * 60 * 60_000;
const MAX_CONCURRENCY = 32;
const HARD_MAX_TENANTS = 4_096;
const EVENT_VERSION = "local-client-smart-management-scheduler-event-v1" as const;

const defaultClock: LocalClientSmartManagementClock = Object.freeze({
  now: () => Date.now(),
});

const defaultTimers: LocalClientSmartManagementTimerPort = Object.freeze({
  setTimeout(callback: () => void, delayMs: number) {
    const handle = setTimeout(callback, delayMs);
    handle.unref?.();
    return handle;
  },
  clearTimeout(handle: unknown) {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  },
});

export class LocalClientSmartManagementScheduler {
  readonly #options: NormalizedSchedulerOptions;
  readonly #timerHandles = new Set<unknown>();
  #lifecycle: LocalClientSmartManagementSchedulerStatus["lifecycle"] = "idle";
  #scheduleTimer: unknown | undefined;
  #deadlineTimer: unknown | undefined;
  #activeRound: Promise<LocalClientSmartManagementRoundSummary> | null = null;
  #activeController: AbortController | null = null;
  #closePromise: Promise<void> | null = null;
  #lastRound: LocalClientSmartManagementRoundSummary | null = null;
  #roundSequence = 0;
  #completedRounds = 0;
  #failureStreak = 0;
  #activeTenantCount = 0;
  #nextRunAtMs: number | null = null;
  #nextDelayMs: number | null = null;

  constructor(options: LocalClientSmartManagementSchedulerOptions) {
    this.#options = normalizeOptions(options);
  }

  start(): LocalClientSmartManagementSchedulerStatus {
    this.#assertUsable();
    if (this.#lifecycle === "started") return this.getStatus();
    this.#lifecycle = "started";
    this.#emit({
      type: "scheduler.started",
      executionMode: this.#executionMode(),
    });
    this.#schedule(this.#jitter(this.#options.initialDelayMs));
    return this.getStatus();
  }

  runNow(): Promise<LocalClientSmartManagementRoundSummary> {
    try { this.#assertUsable(); } catch (error) { return Promise.reject(error); }
    if (this.#activeRound) return this.#activeRound;
    this.#clearScheduleTimer();
    const roundId = ++this.#roundSequence;
    let tracked!: Promise<LocalClientSmartManagementRoundSummary>;
    tracked = this.#executeRound(roundId).then(
      (summary) => {
        this.#settleRound(tracked, summary);
        return summary;
      },
      () => {
        const summary = this.#unexpectedFailureSummary(roundId);
        this.#settleRound(tracked, summary);
        return summary;
      },
    );
    this.#activeRound = tracked;
    return tracked;
  }

  getStatus(): LocalClientSmartManagementSchedulerStatus {
    return Object.freeze({
      statusVersion: "local-client-smart-management-scheduler-status-v1" as const,
      lifecycle: this.#lifecycle,
      executionMode: this.#executionMode(),
      dryRun: !this.#options.applyEnabled,
      applyEnabled: this.#options.applyEnabled,
      running: this.#activeRound !== null,
      timerScheduled: this.#scheduleTimer !== undefined,
      activeTenantCount: this.#activeTenantCount,
      completedRounds: this.#completedRounds,
      failureStreak: this.#failureStreak,
      nextRunAtMs: this.#nextRunAtMs,
      nextDelayMs: this.#nextDelayMs,
      lastRound: this.#lastRound,
      configuration: Object.freeze({
        intervalMs: this.#options.intervalMs,
        initialDelayMs: this.#options.initialDelayMs,
        failureBackoffBaseMs: this.#options.failureBackoffBaseMs,
        failureBackoffMaxMs: this.#options.failureBackoffMaxMs,
        roundDeadlineMs: this.#options.roundDeadlineMs,
        maxConcurrency: this.#options.maxConcurrency,
        maxTenants: this.#options.maxTenants,
        jitterRatio: this.#options.jitterRatio,
      }),
      boundaries: LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_BOUNDARIES,
    });
  }

  close(): Promise<void> {
    if (this.#closePromise) return this.#closePromise;
    if (this.#lifecycle === "closed") return Promise.resolve();
    this.#lifecycle = "closing";
    this.#clearScheduleTimer();
    this.#abortActiveRound("closed");
    const active = this.#activeRound;
    this.#closePromise = (async () => {
      if (active) await active.catch(() => undefined);
      this.#clearAllTimers();
      this.#activeController = null;
      this.#activeRound = null;
      this.#activeTenantCount = 0;
      this.#nextRunAtMs = null;
      this.#nextDelayMs = null;
      this.#lifecycle = "closed";
      this.#emit({ type: "scheduler.closed" });
    })();
    return this.#closePromise;
  }

  async #executeRound(roundId: number): Promise<LocalClientSmartManagementRoundSummary> {
    const startedAtMs = this.#now();
    const controller = new AbortController();
    this.#activeController = controller;
    this.#armDeadline(controller);
    this.#emit({
      type: "round.started",
      roundId,
      executionMode: this.#executionMode(),
    });

    let tenants: readonly LocalClientSmartManagementTenant[] = [];
    let providerFailed = false;
    let deadlineExceeded = false;
    let cancelledByClose = false;
    const outcomes: TenantOutcome[] = [];
    try {
      let rawTenants: unknown;
      try {
        rawTenants = await this.#options.tenantProvider.listTenants(controller.signal);
      } catch {
        providerFailed = !controller.signal.aborted;
      }
      if (controller.signal.aborted) {
        deadlineExceeded = schedulerAbortKind(controller.signal) === "deadline";
        cancelledByClose = schedulerAbortKind(controller.signal) === "closed";
      }
      if (!providerFailed && !controller.signal.aborted) {
        try {
          tenants = normalizeTenants(rawTenants, this.#options.maxTenants);
        } catch {
          providerFailed = true;
        }
      }
      if (!providerFailed && !controller.signal.aborted && tenants.length > 0) {
        await this.#runTenants(roundId, tenants, controller.signal, outcomes);
      }
      if (controller.signal.aborted) {
        deadlineExceeded = schedulerAbortKind(controller.signal) === "deadline";
        cancelledByClose = schedulerAbortKind(controller.signal) === "closed";
      }
    } finally {
      this.#clearDeadlineTimer();
      if (this.#activeController === controller) this.#activeController = null;
    }

    const succeeded = countOutcome(outcomes, "succeeded");
    const failed = countOutcome(outcomes, "failed");
    const timedOut = countOutcome(outcomes, "deadline");
    const cancelled = countOutcome(outcomes, "cancelled");
    const attempted = outcomes.length;
    const skipped = Math.max(0, tenants.length - attempted);
    const finishedAtMs = this.#now();
    return Object.freeze({
      roundId,
      startedAtMs,
      finishedAtMs,
      durationMs: elapsedMs(startedAtMs, finishedAtMs),
      executionMode: this.#executionMode(),
      dryRun: !this.#options.applyEnabled,
      tenantCount: tenants.length,
      attempted,
      succeeded,
      failed,
      timedOut,
      cancelled,
      skipped,
      providerFailed,
      deadlineExceeded,
      successful: !providerFailed
        && !deadlineExceeded
        && !cancelledByClose
        && failed === 0
        && timedOut === 0
        && cancelled === 0,
    });
  }

  async #runTenants(
    roundId: number,
    tenants: readonly LocalClientSmartManagementTenant[],
    signal: AbortSignal,
    outcomes: TenantOutcome[],
  ): Promise<void> {
    let cursor = 0;
    const workerCount = Math.min(this.#options.maxConcurrency, tenants.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (!signal.aborted) {
        const index = cursor;
        cursor += 1;
        if (index >= tenants.length) return;
        const tenant = tenants[index];
        const tenantStartedAt = this.#now();
        this.#activeTenantCount += 1;
        let outcome: TenantOutcome = "failed";
        try {
          await this.#options.managementApi.smartManage({
            tenantId: tenant.tenantId,
            subjectId: tenant.subjectId,
            dryRun: !this.#options.applyEnabled,
            signal,
          });
          outcome = signal.aborted ? abortOutcome(signal) : "succeeded";
        } catch {
          outcome = signal.aborted ? abortOutcome(signal) : "failed";
        } finally {
          this.#activeTenantCount -= 1;
        }
        outcomes.push(outcome);
        this.#emit({
          type: "round.tenant-completed",
          roundId,
          tenantOrdinal: index + 1,
          outcome,
          durationMs: elapsedMs(tenantStartedAt, this.#now()),
        });
      }
    });
    await Promise.all(workers);
  }

  #settleRound(
    tracked: Promise<LocalClientSmartManagementRoundSummary>,
    summary: LocalClientSmartManagementRoundSummary,
  ): void {
    if (this.#activeRound === tracked) this.#activeRound = null;
    this.#completedRounds += 1;
    this.#lastRound = summary;
    if (summary.successful) this.#failureStreak = 0;
    else this.#failureStreak = Math.min(31, this.#failureStreak + 1);
    let nextDelayMs: number | null = null;
    if (this.#lifecycle === "started") {
      nextDelayMs = this.#jitter(summary.successful
        ? this.#options.intervalMs
        : exponentialBackoff(
          this.#options.failureBackoffBaseMs,
          this.#options.failureBackoffMaxMs,
          this.#failureStreak,
        ));
    }
    this.#emit({
      type: "round.completed",
      roundId: summary.roundId,
      executionMode: summary.executionMode,
      tenantCount: summary.tenantCount,
      attempted: summary.attempted,
      succeeded: summary.succeeded,
      failed: summary.failed,
      timedOut: summary.timedOut,
      cancelled: summary.cancelled,
      skipped: summary.skipped,
      providerFailed: summary.providerFailed,
      deadlineExceeded: summary.deadlineExceeded,
      durationMs: summary.durationMs,
      failureStreak: this.#failureStreak,
      delayMs: nextDelayMs ?? undefined,
    });
    if (nextDelayMs !== null) this.#schedule(nextDelayMs);
  }

  #unexpectedFailureSummary(roundId: number): LocalClientSmartManagementRoundSummary {
    const now = this.#now();
    this.#clearDeadlineTimer();
    this.#activeController = null;
    this.#activeTenantCount = 0;
    return Object.freeze({
      roundId,
      startedAtMs: now,
      finishedAtMs: now,
      durationMs: 0,
      executionMode: this.#executionMode(),
      dryRun: !this.#options.applyEnabled,
      tenantCount: 0,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      timedOut: 0,
      cancelled: 0,
      skipped: 0,
      providerFailed: true,
      deadlineExceeded: false,
      successful: false,
    });
  }

  #schedule(delayMs: number): void {
    if (this.#lifecycle !== "started") return;
    this.#clearScheduleTimer();
    const normalizedDelay = clampDelay(delayMs);
    this.#nextDelayMs = normalizedDelay;
    this.#nextRunAtMs = this.#now() + normalizedDelay;
    let handle: unknown;
    try {
      handle = this.#options.timers.setTimeout(() => {
        this.#timerHandles.delete(handle);
        if (this.#scheduleTimer === handle) this.#scheduleTimer = undefined;
        this.#nextDelayMs = null;
        this.#nextRunAtMs = null;
        if (this.#lifecycle !== "started") return;
        void this.runNow().catch(() => undefined);
      }, normalizedDelay);
    } catch {
      this.#nextDelayMs = null;
      this.#nextRunAtMs = null;
      this.#emit({ type: "scheduler.timer-failed" });
      return;
    }
    this.#scheduleTimer = handle;
    this.#timerHandles.add(handle);
    this.#emit({ type: "scheduler.scheduled", delayMs: normalizedDelay });
  }

  #armDeadline(controller: AbortController): void {
    this.#clearDeadlineTimer();
    let handle: unknown;
    try {
      handle = this.#options.timers.setTimeout(() => {
        this.#timerHandles.delete(handle);
        if (this.#deadlineTimer === handle) this.#deadlineTimer = undefined;
        if (!controller.signal.aborted) controller.abort(abortMarker("deadline"));
      }, this.#options.roundDeadlineMs);
    } catch {
      controller.abort(abortMarker("deadline"));
      return;
    }
    this.#deadlineTimer = handle;
    this.#timerHandles.add(handle);
  }

  #clearScheduleTimer(): void {
    if (this.#scheduleTimer !== undefined) {
      this.#clearTimer(this.#scheduleTimer);
      this.#scheduleTimer = undefined;
    }
    this.#nextRunAtMs = null;
    this.#nextDelayMs = null;
  }

  #clearDeadlineTimer(): void {
    if (this.#deadlineTimer === undefined) return;
    this.#clearTimer(this.#deadlineTimer);
    this.#deadlineTimer = undefined;
  }

  #clearAllTimers(): void {
    for (const handle of this.#timerHandles) {
      try { this.#options.timers.clearTimeout(handle); } catch { /* Best effort cleanup. */ }
    }
    this.#timerHandles.clear();
    this.#scheduleTimer = undefined;
    this.#deadlineTimer = undefined;
  }

  #clearTimer(handle: unknown): void {
    this.#timerHandles.delete(handle);
    try { this.#options.timers.clearTimeout(handle); } catch { /* Best effort cleanup. */ }
  }

  #abortActiveRound(kind: "closed"): void {
    if (this.#activeController && !this.#activeController.signal.aborted) {
      this.#activeController.abort(abortMarker(kind));
    }
  }

  #executionMode(): "dry-run" | "apply" {
    return this.#options.applyEnabled ? "apply" : "dry-run";
  }

  #jitter(baseMs: number): number {
    if (baseMs === 0 || this.#options.jitterRatio === 0) return clampDelay(baseMs);
    let sample = 0.5;
    try {
      const candidate = this.#options.random();
      if (Number.isFinite(candidate) && candidate >= 0 && candidate <= 1) sample = candidate;
    } catch { /* Deterministic neutral jitter on random-source failure. */ }
    const multiplier = 1 + ((sample * 2) - 1) * this.#options.jitterRatio;
    return clampDelay(Math.round(baseMs * multiplier));
  }

  #now(): number {
    let value: number;
    try { value = this.#options.clock.now(); } catch { value = 0; }
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.floor(value);
  }

  #emit(input: Omit<LocalClientSmartManagementEvent, "eventVersion" | "atMs">): void {
    if (!this.#options.eventSink) return;
    const event = Object.freeze({
      eventVersion: EVENT_VERSION,
      atMs: this.#now(),
      ...input,
    }) as LocalClientSmartManagementEvent;
    try { this.#options.eventSink(event); } catch { /* Telemetry cannot stop scheduling. */ }
  }

  #assertUsable(): void {
    if (this.#lifecycle === "closing" || this.#lifecycle === "closed") {
      throw schedulerError({
        code: "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CLOSED",
        message: "The local-client smart-management scheduler is closed.",
        category: "lifecycle",
      });
    }
  }
}

export function createLocalClientSmartManagementScheduler(
  options: LocalClientSmartManagementSchedulerOptions,
): LocalClientSmartManagementScheduler {
  return new LocalClientSmartManagementScheduler(options);
}

function normalizeOptions(
  options: LocalClientSmartManagementSchedulerOptions,
): NormalizedSchedulerOptions {
  assertExactRecord(options, [
    "managementApi",
    "tenantProvider",
    "clock",
    "timers",
    "random",
    "eventSink",
    "enableApply",
    "intervalMs",
    "initialDelayMs",
    "failureBackoffBaseMs",
    "failureBackoffMaxMs",
    "roundDeadlineMs",
    "maxConcurrency",
    "maxTenants",
    "jitterRatio",
  ], ["managementApi", "tenantProvider"]);
  if (!validManagementApi(options.managementApi) || !validTenantProvider(options.tenantProvider)) {
    throw configurationError();
  }
  if (options.clock !== undefined && !validClock(options.clock)) throw configurationError();
  if (options.timers !== undefined && !validTimers(options.timers)) throw configurationError();
  if (options.random !== undefined && typeof options.random !== "function") throw configurationError();
  if (options.eventSink !== undefined && typeof options.eventSink !== "function") {
    throw configurationError();
  }
  if (options.enableApply !== undefined && typeof options.enableApply !== "boolean") {
    throw configurationError();
  }
  const intervalMs = boundedInteger(options.intervalMs, DEFAULT_INTERVAL_MS, 1, MAX_DELAY_MS);
  const initialDelayMs = boundedInteger(
    options.initialDelayMs,
    DEFAULT_INITIAL_DELAY_MS,
    0,
    MAX_DELAY_MS,
  );
  const failureBackoffBaseMs = boundedInteger(
    options.failureBackoffBaseMs,
    DEFAULT_BACKOFF_BASE_MS,
    1,
    MAX_DELAY_MS,
  );
  const failureBackoffMaxMs = boundedInteger(
    options.failureBackoffMaxMs,
    DEFAULT_BACKOFF_MAX_MS,
    failureBackoffBaseMs,
    MAX_DELAY_MS,
  );
  return Object.freeze({
    managementApi: options.managementApi,
    tenantProvider: options.tenantProvider,
    clock: options.clock ?? defaultClock,
    timers: options.timers ?? defaultTimers,
    random: options.random ?? Math.random,
    eventSink: options.eventSink ?? null,
    applyEnabled: options.enableApply === true,
    intervalMs,
    initialDelayMs,
    failureBackoffBaseMs,
    failureBackoffMaxMs,
    roundDeadlineMs: boundedInteger(
      options.roundDeadlineMs,
      DEFAULT_ROUND_DEADLINE_MS,
      1,
      MAX_DELAY_MS,
    ),
    maxConcurrency: boundedInteger(
      options.maxConcurrency,
      DEFAULT_MAX_CONCURRENCY,
      1,
      MAX_CONCURRENCY,
    ),
    maxTenants: boundedInteger(
      options.maxTenants,
      DEFAULT_MAX_TENANTS,
      1,
      HARD_MAX_TENANTS,
    ),
    jitterRatio: boundedRatio(options.jitterRatio, DEFAULT_JITTER_RATIO),
  });
}

function normalizeTenants(
  value: unknown,
  maxTenants: number,
): readonly LocalClientSmartManagementTenant[] {
  if (!Array.isArray(value) || value.length > maxTenants) throw configurationError();
  const seen = new Set<string>();
  const tenants: LocalClientSmartManagementTenant[] = [];
  for (const raw of value) {
    assertExactRecord(raw, ["tenantId", "subjectId"], ["tenantId", "subjectId"]);
    const tenantId = boundedIdentifier(raw.tenantId, 128);
    const subjectId = boundedIdentifier(raw.subjectId, 256);
    const key = `${tenantId}\u0000${subjectId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tenants.push(Object.freeze({ tenantId, subjectId }));
  }
  return Object.freeze(tenants);
}

function boundedIdentifier(value: unknown, maxLength: number): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > maxLength
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) throw configurationError();
  return value;
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const normalized = value ?? fallback;
  if (!Number.isSafeInteger(normalized) || normalized < min || normalized > max) {
    throw configurationError();
  }
  return normalized;
}

function boundedRatio(value: number | undefined, fallback: number): number {
  const normalized = value ?? fallback;
  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 0.5) {
    throw configurationError();
  }
  return normalized;
}

function exponentialBackoff(baseMs: number, maxMs: number, failureStreak: number): number {
  const exponent = Math.max(0, Math.min(30, failureStreak - 1));
  return Math.min(maxMs, baseMs * (2 ** exponent));
}

function clampDelay(value: number): number {
  if (!Number.isFinite(value)) return MAX_DELAY_MS;
  return Math.max(0, Math.min(MAX_DELAY_MS, Math.floor(value)));
}

function elapsedMs(startedAtMs: number, finishedAtMs: number): number {
  return Math.max(0, finishedAtMs - startedAtMs);
}

function countOutcome(outcomes: readonly TenantOutcome[], target: TenantOutcome): number {
  return outcomes.filter((outcome) => outcome === target).length;
}

function abortMarker(kind: "deadline" | "closed"): Readonly<{ schedulerAbort: true; kind: typeof kind }> {
  return Object.freeze({ schedulerAbort: true as const, kind });
}

function schedulerAbortKind(signal: AbortSignal): "deadline" | "closed" {
  const reason = signal.reason as { schedulerAbort?: unknown; kind?: unknown } | undefined;
  if (reason?.schedulerAbort === true && reason.kind === "deadline") return "deadline";
  return "closed";
}

function abortOutcome(signal: AbortSignal): "deadline" | "cancelled" {
  return schedulerAbortKind(signal) === "deadline" ? "deadline" : "cancelled";
}

function validManagementApi(value: unknown): value is LocalClientSmartManagementApiPort {
  return value !== null
    && typeof value === "object"
    && typeof (value as Partial<LocalClientSmartManagementApiPort>).smartManage === "function";
}

function validTenantProvider(value: unknown): value is LocalClientSmartManagementTenantProvider {
  return value !== null
    && typeof value === "object"
    && typeof (value as Partial<LocalClientSmartManagementTenantProvider>).listTenants === "function";
}

function validClock(value: unknown): value is LocalClientSmartManagementClock {
  return value !== null
    && typeof value === "object"
    && typeof (value as Partial<LocalClientSmartManagementClock>).now === "function";
}

function validTimers(value: unknown): value is LocalClientSmartManagementTimerPort {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<LocalClientSmartManagementTimerPort>;
  return typeof candidate.setTimeout === "function" && typeof candidate.clearTimeout === "function";
}

function assertExactRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value)) throw configurationError();
  const keys = Reflect.ownKeys(value);
  if (
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
    || requiredKeys.some((key) => !Object.hasOwn(value, key))
  ) throw configurationError();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (keys.some((key) => {
    if (typeof key !== "string") return true;
    const descriptor = descriptors[key];
    return !descriptor || !("value" in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined;
  })) throw configurationError();
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function schedulerError(
  input: ConstructorParameters<typeof LocalClientSmartManagementSchedulerError>[0],
): LocalClientSmartManagementSchedulerError {
  return new LocalClientSmartManagementSchedulerError(input);
}

function configurationError(): LocalClientSmartManagementSchedulerError {
  return schedulerError({
    code: "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIGURATION_INVALID",
    message: "The local-client smart-management scheduler configuration is invalid.",
    category: "configuration",
  });
}
