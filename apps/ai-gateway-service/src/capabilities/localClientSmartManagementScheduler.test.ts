import { describe, expect, it } from "vitest";

import {
  LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_BOUNDARIES,
  LocalClientSmartManagementScheduler,
  type LocalClientSmartManagementApiPort,
  type LocalClientSmartManagementClock,
  type LocalClientSmartManagementEvent,
  type LocalClientSmartManagementInput,
  type LocalClientSmartManagementSchedulerOptions,
  type LocalClientSmartManagementTenant,
  type LocalClientSmartManagementTimerPort,
} from "./localClientSmartManagementScheduler.ts";

const SECRET_TENANT = "secret-tenant@example.invalid";
const SECRET_SUBJECT = "subject-token-secret-001";

describe("LocalClientSmartManagementScheduler", () => {
  it("defaults every round to dry-run and requires explicit enableApply for apply", async () => {
    const dryRunInputs: LocalClientSmartManagementInput[] = [];
    const dryRunHarness = createHarness({
      tenants: [{ tenantId: "tenant-a", subjectId: "subject-a" }],
      onManage: async (input) => { dryRunInputs.push(input); },
    });

    expect(dryRunHarness.scheduler.getStatus()).toMatchObject({
      lifecycle: "idle",
      executionMode: "dry-run",
      dryRun: true,
      applyEnabled: false,
      boundaries: {
        ...LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_BOUNDARIES,
        defaultMode: "dry-run",
        applyRequiresExplicitEnable: true,
        managementApiMustHonorAbortSignal: true,
      },
    });
    await expect(dryRunHarness.scheduler.runNow()).resolves.toMatchObject({
      successful: true,
      dryRun: true,
      executionMode: "dry-run",
    });
    expect(dryRunInputs).toHaveLength(1);
    expect(dryRunInputs[0]).toMatchObject({ dryRun: true });
    expect(dryRunInputs[0].signal).toBeInstanceOf(AbortSignal);
    await dryRunHarness.scheduler.close();

    const applyInputs: LocalClientSmartManagementInput[] = [];
    const applyHarness = createHarness({
      enableApply: true,
      tenants: [{ tenantId: "tenant-a", subjectId: "subject-a" }],
      onManage: async (input) => { applyInputs.push(input); },
    });
    await applyHarness.scheduler.runNow();
    expect(applyHarness.scheduler.getStatus()).toMatchObject({
      executionMode: "apply",
      dryRun: false,
      applyEnabled: true,
    });
    expect(applyInputs[0]).toMatchObject({ dryRun: false });
    await applyHarness.scheduler.close();
  });

  it("joins concurrent triggers into one single-flight round", async () => {
    let release!: () => void;
    let callCount = 0;
    const harness = createHarness({
      tenants: [{ tenantId: "tenant-a", subjectId: "subject-a" }],
      onManage: async () => {
        callCount += 1;
        await new Promise<void>((resolve) => { release = resolve; });
      },
    });

    const first = harness.scheduler.runNow();
    await flushMicrotasks();
    const second = harness.scheduler.runNow();
    expect(second).toBe(first);
    expect(callCount).toBe(1);
    expect(harness.scheduler.getStatus()).toMatchObject({
      running: true,
      activeTenantCount: 1,
    });

    release();
    await expect(first).resolves.toMatchObject({ attempted: 1, succeeded: 1 });
    await expect(second).resolves.toMatchObject({ roundId: 1 });
    expect(callCount).toBe(1);
    expect(harness.scheduler.getStatus()).toMatchObject({ running: false });
    await harness.scheduler.close();
  });

  it("bounds concurrency, isolates tenant failures, and redacts telemetry/status", async () => {
    let active = 0;
    let peak = 0;
    const inputs: LocalClientSmartManagementInput[] = [];
    const events: LocalClientSmartManagementEvent[] = [];
    const tenants = [
      { tenantId: SECRET_TENANT, subjectId: SECRET_SUBJECT },
      { tenantId: "tenant-2", subjectId: "subject-2" },
      { tenantId: "tenant-failing", subjectId: "subject-3" },
      { tenantId: "tenant-4", subjectId: "subject-4" },
      { tenantId: "tenant-5", subjectId: "subject-5" },
    ];
    const harness = createHarness({
      tenants,
      maxConcurrency: 2,
      eventSink: (event) => events.push(event),
      onManage: async (input) => {
        inputs.push(input);
        active += 1;
        peak = Math.max(peak, active);
        try {
          await Promise.resolve();
          if (input.tenantId === "tenant-failing") {
            throw new Error(`failure contains ${SECRET_TENANT} ${SECRET_SUBJECT}`);
          }
        } finally {
          active -= 1;
        }
      },
    });

    const summary = await harness.scheduler.runNow();
    expect(summary).toMatchObject({
      tenantCount: 5,
      attempted: 5,
      succeeded: 4,
      failed: 1,
      successful: false,
    });
    expect(peak).toBe(2);
    expect(inputs).toHaveLength(5);
    expect(inputs.every((input) => input.dryRun === true)).toBe(true);
    const publicJson = JSON.stringify({
      summary,
      status: harness.scheduler.getStatus(),
      events,
    });
    expect(publicJson).not.toContain(SECRET_TENANT);
    expect(publicJson).not.toContain(SECRET_SUBJECT);
    expect(publicJson).not.toContain("tenant-failing");
    expect(events.filter((event) => event.type === "round.tenant-completed"))
      .toHaveLength(5);
    expect(events.every((event) => !("tenantId" in event) && !("subjectId" in event)))
      .toBe(true);
    await harness.scheduler.close();
  });

  it("applies positive jitter and exponential backoff, then resets after success", async () => {
    let providerCalls = 0;
    const clock = new ManualClock();
    const events: LocalClientSmartManagementEvent[] = [];
    const scheduler = new LocalClientSmartManagementScheduler({
      managementApi: { smartManage: async () => undefined },
      tenantProvider: {
        async listTenants() {
          providerCalls += 1;
          if (providerCalls <= 2) throw new Error("fixture provider failure");
          return [];
        },
      },
      clock,
      timers: clock,
      random: () => 1,
      eventSink: (event) => events.push(event),
      intervalMs: 1_000,
      initialDelayMs: 0,
      failureBackoffBaseMs: 100,
      failureBackoffMaxMs: 800,
      roundDeadlineMs: 5_000,
      jitterRatio: 0.2,
    });

    expect(scheduler.start()).toMatchObject({
      lifecycle: "started",
      timerScheduled: true,
      nextDelayMs: 0,
    });
    await clock.advanceBy(0);
    expect(providerCalls).toBe(1);
    expect(scheduler.getStatus()).toMatchObject({
      completedRounds: 1,
      failureStreak: 1,
      nextDelayMs: 120,
      nextRunAtMs: 120,
    });

    await clock.advanceBy(119);
    expect(providerCalls).toBe(1);
    await clock.advanceBy(1);
    expect(providerCalls).toBe(2);
    expect(scheduler.getStatus()).toMatchObject({
      completedRounds: 2,
      failureStreak: 2,
      nextDelayMs: 240,
    });

    await clock.advanceBy(240);
    expect(providerCalls).toBe(3);
    expect(scheduler.getStatus()).toMatchObject({
      completedRounds: 3,
      failureStreak: 0,
      nextDelayMs: 1_200,
    });
    expect(events.filter((event) => event.type === "scheduler.scheduled")
      .map((event) => event.delayMs)).toEqual([0, 120, 240, 1_200]);
    await scheduler.close();
    expect(clock.activeTimerCount).toBe(0);
  });

  it("aborts a tenant at the round deadline and resolves a sanitized failure", async () => {
    const clock = new ManualClock();
    let active = 0;
    const scheduler = new LocalClientSmartManagementScheduler({
      managementApi: {
        async smartManage(input) {
          active += 1;
          try {
            await waitForAbort(input.signal!);
          } finally {
            active -= 1;
          }
        },
      },
      tenantProvider: {
        async listTenants() {
          return [{ tenantId: SECRET_TENANT, subjectId: SECRET_SUBJECT }];
        },
      },
      clock,
      timers: clock,
      roundDeadlineMs: 50,
      jitterRatio: 0,
    });

    const round = scheduler.runNow();
    await flushMicrotasks();
    expect(active).toBe(1);
    await clock.advanceBy(49);
    expect(active).toBe(1);
    await clock.advanceBy(1);
    await expect(round).resolves.toMatchObject({
      attempted: 1,
      succeeded: 0,
      timedOut: 1,
      deadlineExceeded: true,
      successful: false,
    });
    expect(active).toBe(0);
    expect(clock.activeTimerCount).toBe(0);
    expect(JSON.stringify(scheduler.getStatus())).not.toContain(SECRET_TENANT);
    await scheduler.close();
  });

  it("close cancels active work, clears all timers, and is idempotent", async () => {
    const clock = new ManualClock();
    let active = 0;
    const events: LocalClientSmartManagementEvent[] = [];
    const scheduler = new LocalClientSmartManagementScheduler({
      managementApi: {
        async smartManage(input) {
          active += 1;
          try { await waitForAbort(input.signal!); } finally { active -= 1; }
        },
      },
      tenantProvider: {
        async listTenants() {
          return [
            { tenantId: "tenant-1", subjectId: "subject-1" },
            { tenantId: "tenant-2", subjectId: "subject-2" },
          ];
        },
      },
      clock,
      timers: clock,
      eventSink: (event) => events.push(event),
      initialDelayMs: 0,
      intervalMs: 1_000,
      roundDeadlineMs: 5_000,
      maxConcurrency: 1,
      jitterRatio: 0,
    });

    scheduler.start();
    await clock.advanceBy(0);
    expect(active).toBe(1);
    expect(scheduler.getStatus()).toMatchObject({ lifecycle: "started", running: true });
    const firstClose = scheduler.close();
    const secondClose = scheduler.close();
    expect(secondClose).toBe(firstClose);
    await firstClose;

    expect(active).toBe(0);
    expect(clock.activeTimerCount).toBe(0);
    expect(scheduler.getStatus()).toMatchObject({
      lifecycle: "closed",
      running: false,
      timerScheduled: false,
      activeTenantCount: 0,
      nextRunAtMs: null,
      nextDelayMs: null,
      lastRound: {
        attempted: 1,
        cancelled: 1,
        skipped: 1,
        successful: false,
      },
    });
    expect(events.at(-1)).toMatchObject({ type: "scheduler.closed" });
    await expect(scheduler.runNow()).rejects.toMatchObject({
      code: "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CLOSED",
    });
    expect(() => scheduler.start()).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CLOSED",
    }));
  });

  it("contains provider and telemetry failures without rejecting the service round", async () => {
    const harness = createHarness({
      tenantProvider: {
        async listTenants() {
          throw new Error(`provider secret ${SECRET_TENANT}`);
        },
      },
      eventSink: () => { throw new Error("telemetry unavailable"); },
    });

    await expect(harness.scheduler.runNow()).resolves.toMatchObject({
      providerFailed: true,
      tenantCount: 0,
      successful: false,
    });
    expect(JSON.stringify(harness.scheduler.getStatus())).not.toContain(SECRET_TENANT);
    await harness.scheduler.close();
  });

  it("rejects unsafe or unbounded configuration and tenant lists", async () => {
    const api: LocalClientSmartManagementApiPort = { smartManage: async () => undefined };
    const provider = { listTenants: async () => [] };
    for (const overrides of [
      { maxConcurrency: 0 },
      { maxConcurrency: 33 },
      { maxTenants: 0 },
      { roundDeadlineMs: 0 },
      { jitterRatio: 0.6 },
      { enableApply: "true" as never },
      { unknownOption: true } as never,
    ]) {
      expect(() => new LocalClientSmartManagementScheduler({
        managementApi: api,
        tenantProvider: provider,
        ...overrides,
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIGURATION_INVALID",
      }));
    }

    const tooMany = createHarness({
      maxTenants: 1,
      tenants: [
        { tenantId: "tenant-1", subjectId: "subject-1" },
        { tenantId: "tenant-2", subjectId: "subject-2" },
      ],
    });
    await expect(tooMany.scheduler.runNow()).resolves.toMatchObject({
      providerFailed: true,
      attempted: 0,
    });
    await tooMany.scheduler.close();
  });
});

type HarnessOptions = Readonly<{
  tenants?: readonly LocalClientSmartManagementTenant[];
  tenantProvider?: LocalClientSmartManagementSchedulerOptions["tenantProvider"];
  onManage?: (input: LocalClientSmartManagementInput) => Promise<void>;
  enableApply?: boolean;
  maxConcurrency?: number;
  maxTenants?: number;
  eventSink?: (event: LocalClientSmartManagementEvent) => void;
}>;

function createHarness(options: HarnessOptions = {}) {
  const clock = new ManualClock();
  const managementApi: LocalClientSmartManagementApiPort = {
    smartManage: options.onManage ?? (async () => undefined),
  };
  const tenantProvider = options.tenantProvider ?? {
    listTenants: async () => options.tenants ?? [],
  };
  const scheduler = new LocalClientSmartManagementScheduler({
    managementApi,
    tenantProvider,
    clock,
    timers: clock,
    enableApply: options.enableApply,
    maxConcurrency: options.maxConcurrency,
    maxTenants: options.maxTenants,
    eventSink: options.eventSink,
    intervalMs: 1_000,
    roundDeadlineMs: 1_000,
    jitterRatio: 0,
  });
  return { scheduler, clock, managementApi, tenantProvider };
}

class ManualClock implements LocalClientSmartManagementClock, LocalClientSmartManagementTimerPort {
  #nowMs = 0;
  #nextId = 1;
  readonly #timers = new Map<number, Readonly<{ dueAtMs: number; callback: () => void }>>();

  now(): number {
    return this.#nowMs;
  }

  get activeTimerCount(): number {
    return this.#timers.size;
  }

  setTimeout(callback: () => void, delayMs: number): number {
    const id = this.#nextId;
    this.#nextId += 1;
    this.#timers.set(id, Object.freeze({ dueAtMs: this.#nowMs + delayMs, callback }));
    return id;
  }

  clearTimeout(handle: unknown): void {
    if (typeof handle === "number") this.#timers.delete(handle);
  }

  async advanceBy(deltaMs: number): Promise<void> {
    const target = this.#nowMs + deltaMs;
    while (true) {
      const next = [...this.#timers.entries()]
        .filter(([, timer]) => timer.dueAtMs <= target)
        .sort((left, right) => left[1].dueAtMs - right[1].dueAtMs || left[0] - right[0])[0];
      if (!next) break;
      const [id, timer] = next;
      this.#timers.delete(id);
      this.#nowMs = timer.dueAtMs;
      timer.callback();
      await flushMicrotasks();
    }
    this.#nowMs = target;
    await flushMicrotasks();
  }
}

async function flushMicrotasks(turns = 12): Promise<void> {
  for (let index = 0; index < turns; index += 1) await Promise.resolve();
}

async function waitForAbort(signal: AbortSignal): Promise<never> {
  if (signal.aborted) throw signal.reason;
  return new Promise<never>((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}
