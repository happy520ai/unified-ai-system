import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createIdempotencyCoordinator, type IdempotencyCoordinator } from "../http/idempotencyCoordinator.ts";
import {
  createLocalClientExecutionIdempotencyCoordinator,
  type LocalClientExecutionIdempotencyDependencies,
} from "./localClientExecutionIdempotencyCoordinator.ts";
import type {
  LocalClientExecutionCompletedResult,
  LocalClientExecutionRequest,
  LocalClientExecutionResult,
} from "./localClientExecutionOrchestrator.ts";
import { createLocalClientRoutePlanStore } from "./localClientRoutePlanStore.ts";

const SECRET = "idempotency-test-secret-".repeat(3);
const INPUT = Object.freeze({ task: "open-settings" });
const TENANT_ID = "tenant-sensitive-value";
const SUBJECT_ID = "subject-sensitive-value";

const temporaryDirectories: string[] = [];
const coordinators: IdempotencyCoordinator[] = [];

afterEach(async () => {
  for (const coordinator of coordinators.splice(0)) await coordinator.close();
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe("local-client execution HTTP idempotency coordinator", () => {
  it("fails closed when execution is requested with a memory store", async () => {
    const fixture = await createFixture({ storeMode: "memory" });

    const outcome = await fixture.wrapper.execute(fixture.request);

    expect(outcome).toMatchObject({
      accepted: false,
      status: "rejected",
      statusCode: 503,
      code: "LOCAL_CLIENT_IDEMPOTENCY_STORE_NOT_DURABLE",
      retryable: false,
    });
    expect(fixture.executeCount()).toBe(0);
    expect(fixture.wrapper.getHealth()).toMatchObject({
      enabled: true,
      available: true,
      durable: false,
      distributed: false,
      storeMode: "memory",
    });
  });

  it("fails closed before execution when the durable store reports unavailable", async () => {
    const execute = vi.fn();
    const fixture = await createFixture({
      idempotencyCoordinator: fakeCoordinator({
        execute,
        stats: stats("sqlite", false, false),
      }),
    });

    const outcome = await fixture.wrapper.execute(fixture.request);

    expect(outcome).toMatchObject({
      accepted: false,
      code: "LOCAL_CLIENT_IDEMPOTENCY_STORE_UNAVAILABLE",
      retryable: true,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(fixture.executeCount()).toBe(0);
  });

  it.each([
    [undefined, "LOCAL_CLIENT_IDEMPOTENCY_KEY_REQUIRED"],
    ["", "LOCAL_CLIENT_IDEMPOTENCY_KEY_REQUIRED"],
    ["has space", "LOCAL_CLIENT_IDEMPOTENCY_KEY_INVALID"],
    [["duplicate", "keys"], "LOCAL_CLIENT_IDEMPOTENCY_KEY_INVALID"],
  ])("requires one validated Idempotency-Key (%j)", async (idempotencyKey, code) => {
    const execute = vi.fn();
    const fixture = await createFixture({
      idempotencyCoordinator: fakeCoordinator({
        execute,
        stats: stats("sqlite", true, false),
      }),
    });

    const outcome = await fixture.wrapper.execute({ ...fixture.request, idempotencyKey });

    expect(outcome).toMatchObject({ accepted: false, statusCode: 400, code });
    expect(execute).not.toHaveBeenCalled();
  });

  it("coalesces concurrent identical keys and invokes the governed orchestrator once", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const fixture = await createFixture({
      storeMode: "sqlite",
      executeImpl: async (planId) => {
        await gate;
        return completedResult(planId);
      },
    });

    const firstPromise = fixture.wrapper.execute(fixture.request);
    await vi.waitFor(() => expect(fixture.executeCount()).toBe(1));
    const secondPromise = fixture.wrapper.execute(fixture.request);
    release();
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(first).toMatchObject({ accepted: true, status: "completed", operationInvoked: true });
    expect(second).toMatchObject({ accepted: true, status: "replayed", operationInvoked: false });
    expect(fixture.executeCount()).toBe(1);
  });

  it("replays a completed result without resolving an already-consumed route plan", async () => {
    const fixture = await createFixture({ storeMode: "sqlite" });

    const first = await fixture.wrapper.execute(fixture.request);
    fixture.failPlanReads();
    const replay = await fixture.wrapper.execute(fixture.request);

    expect(first).toMatchObject({ accepted: true, status: "completed" });
    expect(replay).toMatchObject({ accepted: true, status: "replayed", operationInvoked: false });
    expect(fixture.executeCount()).toBe(1);
  });

  it("persists and replays a completed execution whose durable feedback remains queued", async () => {
    const fixture = await createFixture({
      storeMode: "sqlite",
      executeImpl: async (planId) => {
        const completed = completedResult(planId);
        return Object.freeze({
          ...completed,
          feedback: Object.freeze({
            ...completed.feedback,
            persisted: true,
            exactlyOnce: false,
            replayed: false,
            deliveryStatus: "queued" as const,
            errorCode: null,
          }),
        });
      },
    });

    const first = await fixture.wrapper.execute(fixture.request);
    const replay = await fixture.wrapper.execute(fixture.request);

    expect(first).toMatchObject({
      accepted: true,
      status: "completed",
      result: {
        executionId: `lc-exec-${"b".repeat(64)}`,
        receipt: { executionId: `lc-exec-${"b".repeat(64)}` },
        feedback: { deliveryStatus: "queued", exactlyOnce: false },
      },
    });
    expect(replay).toMatchObject({
      accepted: true,
      status: "replayed",
      operationInvoked: false,
      result: {
        executionId: `lc-exec-${"b".repeat(64)}`,
        receipt: { executionId: `lc-exec-${"b".repeat(64)}` },
        feedback: { deliveryStatus: "queued", exactlyOnce: false },
      },
    });
    expect(fixture.executeCount()).toBe(1);
  });

  it("rejects one key reused with a different canonical input without re-execution", async () => {
    const fixture = await createFixture({ storeMode: "sqlite" });
    await fixture.wrapper.execute(fixture.request);

    const conflict = await fixture.wrapper.execute({
      ...fixture.request,
      input: { task: "different-task" },
    });

    expect(conflict).toMatchObject({
      accepted: false,
      status: "rejected",
      statusCode: 409,
      code: "IDEMPOTENCY_KEY_REUSED",
      retryable: false,
    });
    expect(fixture.executeCount()).toBe(1);
  });

  it("passes only hashed identity, plan, action binding, and input facts to persistence", async () => {
    let captured: unknown;
    const execute = vi.fn(async (execution) => {
      captured = { request: execution.request, route: execution.route, payload: execution.payload };
      return {
        accepted: true as const,
        status: "created" as const,
        replayed: false as const,
        replayable: true,
        value: await execution.operation(),
      };
    });
    const coordinator = fakeCoordinator({
      stats: stats("sqlite", true, false),
      execute,
    });
    const fixture = await createFixture({ idempotencyCoordinator: coordinator });

    const outcome = await fixture.wrapper.execute(fixture.request);
    const serialized = JSON.stringify(captured);

    expect(outcome).toMatchObject({ accepted: true, status: "completed" });
    expect(serialized).not.toContain(TENANT_ID);
    expect(serialized).not.toContain(SUBJECT_ID);
    expect(serialized).not.toContain(INPUT.task);
    expect(serialized).not.toContain("local_application");
    expect(serialized).not.toContain("perform");
    expect(serialized).toMatch(/canonicalInputSha256/u);
    expect(serialized).toMatch(/planContentAddress/u);
    expect(execute).toHaveBeenCalledOnce();
  });

  it("derives external-effect keys from both the key and subject identity", async () => {
    const first = await createFixture({ storeMode: "sqlite", subjectId: "subject-a" });
    const second = await createFixture({ storeMode: "sqlite", subjectId: "subject-b" });

    await first.wrapper.execute(first.request);
    await second.wrapper.execute(second.request);

    const firstHash = first.executionRequest()?.effectKey.effectKeyHash;
    const secondHash = second.executionRequest()?.effectKey.effectKeyHash;
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(secondHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(firstHash).not.toBe(secondHash);
  });

  it("persists and replays an explicit post-commit unknown result without retry", async () => {
    const fixture = await createFixture({
      storeMode: "sqlite",
      executeImpl: async (planId) => unknownResult(planId),
    });

    const first = await fixture.wrapper.execute(fixture.request);
    const replay = await fixture.wrapper.execute(fixture.request);

    expect(first).toMatchObject({
      accepted: false,
      status: "unknown-reconcile-required",
      retryAllowed: false,
      operationInvoked: true,
      result: { status: "unknown-reconcile-required", externalEffectCommitted: true },
    });
    expect(replay).toMatchObject({
      accepted: false,
      status: "unknown-reconcile-required",
      retryAllowed: false,
      replayed: true,
      operationInvoked: false,
    });
    expect(fixture.executeCount()).toBe(1);
  });

  it("converts an unconfirmed durable completion into reconcile-required", async () => {
    const coordinator = fakeCoordinator({
      stats: stats("sqlite", true, false),
      execute: vi.fn(async (execution) => ({
        accepted: true,
        status: "created-unconfirmed",
        replayed: false,
        replayable: false,
        value: await execution.operation(),
      })),
    });
    const fixture = await createFixture({ idempotencyCoordinator: coordinator });

    const outcome = await fixture.wrapper.execute(fixture.request);

    expect(outcome).toMatchObject({
      accepted: false,
      status: "unknown-reconcile-required",
      statusCode: 503,
      code: "LOCAL_CLIENT_IDEMPOTENCY_COMPLETION_UNCONFIRMED",
      retryAllowed: false,
      result: { status: "completed" },
    });
    expect(fixture.wrapper.getHealth()).toMatchObject({ available: false, durable: true });
  });

  it("converts a non-replayable completed result into reconcile-required", async () => {
    const coordinator = fakeCoordinator({
      stats: stats("sqlite", true, false),
      execute: vi.fn(async (execution) => ({
        accepted: true,
        status: "created",
        replayed: false,
        replayable: false,
        value: await execution.operation(),
      })),
    });
    const fixture = await createFixture({ idempotencyCoordinator: coordinator });

    const outcome = await fixture.wrapper.execute(fixture.request);

    expect(outcome).toMatchObject({
      accepted: false,
      status: "unknown-reconcile-required",
      statusCode: 409,
      code: "IDEMPOTENCY_RESULT_NOT_REPLAYABLE",
      retryAllowed: false,
      result: { status: "completed" },
    });
  });

  it("treats store loss after the coordinator was entered as outcome-unknown", async () => {
    const coordinator = fakeCoordinator({
      stats: stats("sqlite", true, false),
      execute: vi.fn(async () => ({
        accepted: false,
        status: "rejected",
        replayed: false,
        replayable: false,
        statusCode: 503,
        code: "IDEMPOTENCY_STORE_UNAVAILABLE",
        message: "backend details must not escape",
        retryable: true,
        retryAfterSeconds: 1,
      })),
    });
    const fixture = await createFixture({ idempotencyCoordinator: coordinator });

    const outcome = await fixture.wrapper.execute(fixture.request);

    expect(outcome).toMatchObject({
      accepted: false,
      status: "unknown-reconcile-required",
      statusCode: 503,
      code: "IDEMPOTENCY_STORE_UNAVAILABLE",
      retryAllowed: false,
      result: null,
    });
    expect(JSON.stringify(outcome)).not.toContain("backend details");
    expect(fixture.executeCount()).toBe(0);
  });

  it("translates a prior unknown tombstone into reconcile-required, never retryable", async () => {
    const coordinator = fakeCoordinator({
      stats: stats("sqlite", true, false),
      execute: vi.fn(async () => ({
        accepted: false,
        status: "rejected",
        replayed: false,
        replayable: false,
        statusCode: 409,
        code: "IDEMPOTENCY_PREVIOUS_ATTEMPT_UNKNOWN",
        message: "untrusted backend message",
        retryable: false,
      })),
    });
    const fixture = await createFixture({ idempotencyCoordinator: coordinator });

    const outcome = await fixture.wrapper.execute(fixture.request);

    expect(outcome).toMatchObject({
      accepted: false,
      status: "unknown-reconcile-required",
      code: "IDEMPOTENCY_PREVIOUS_ATTEMPT_UNKNOWN",
      retryAllowed: false,
      result: null,
    });
    expect(JSON.stringify(outcome)).not.toContain("untrusted backend message");
  });

  it("tombstones a pre-commit operation failure and does not invoke it again", async () => {
    const fixture = await createFixture({
      storeMode: "sqlite",
      executeImpl: async () => {
        throw Object.assign(new Error("secret task error"), {
          code: "LOCAL_CLIENT_EXECUTION_APPROVAL_REQUIRED",
          statusCode: 403,
        });
      },
    });

    const first = await fixture.wrapper.execute(fixture.request);
    const replay = await fixture.wrapper.execute(fixture.request);

    expect(first).toMatchObject({
      accepted: false,
      status: "rejected",
      statusCode: 403,
      code: "LOCAL_CLIENT_EXECUTION_APPROVAL_REQUIRED",
      retryable: false,
    });
    expect(JSON.stringify(first)).not.toContain("secret task error");
    expect(replay).toMatchObject({
      accepted: false,
      status: "unknown-reconcile-required",
      code: "IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED",
      retryAllowed: false,
    });
    expect(fixture.executeCount()).toBe(1);
  });

  it("never translates an explicitly unknown operation error into a retryable failure", async () => {
    const fixture = await createFixture({
      storeMode: "sqlite",
      executeImpl: async () => {
        throw Object.assign(new Error("adapter transport details"), {
          code: "LOCAL_CLIENT_ADAPTER_OUTCOME_UNKNOWN",
          statusCode: 502,
          outcomeUnknown: true,
        });
      },
    });

    const first = await fixture.wrapper.execute(fixture.request);
    const replay = await fixture.wrapper.execute(fixture.request);

    expect(first).toMatchObject({
      accepted: false,
      status: "unknown-reconcile-required",
      code: "LOCAL_CLIENT_ADAPTER_OUTCOME_UNKNOWN",
      retryAllowed: false,
      operationInvoked: true,
    });
    expect(replay).toMatchObject({
      accepted: false,
      status: "unknown-reconcile-required",
      code: "IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED",
      retryAllowed: false,
      operationInvoked: false,
    });
    expect(JSON.stringify(first)).not.toContain("adapter transport details");
    expect(fixture.executeCount()).toBe(1);
  });

  it("exposes a readiness-compatible durable/distributed health boundary", async () => {
    const checkHealth = vi.fn(async () => stats("postgres", true, true));
    const coordinator = fakeCoordinator({
      stats: stats("postgres", false, true),
      checkHealth,
    });
    const fixture = await createFixture({ idempotencyCoordinator: coordinator });

    expect(fixture.wrapper.getHealth()).toMatchObject({
      enabled: true,
      available: false,
      durable: true,
      distributed: true,
      storeMode: "postgres",
      storageMode: "postgres",
    });
    await expect(fixture.wrapper.checkHealth()).resolves.toMatchObject({
      available: true,
      durable: true,
      distributed: true,
      storeMode: "postgres",
    });
    expect(checkHealth).toHaveBeenCalledOnce();
  });

  it("does not invoke execution while the feature switch is disabled", async () => {
    const execute = vi.fn();
    const fixture = await createFixture({
      executionRequested: false,
      idempotencyCoordinator: fakeCoordinator({
        execute,
        stats: stats("sqlite", true, false),
      }),
    });

    const outcome = await fixture.wrapper.execute(fixture.request);

    expect(outcome).toMatchObject({ code: "LOCAL_CLIENT_EXECUTION_DISABLED", retryable: false });
    expect(execute).not.toHaveBeenCalled();
    expect(fixture.executeCount()).toBe(0);
  });
});

async function createFixture(options: {
  storeMode?: "memory" | "sqlite";
  executionRequested?: boolean;
  idempotencyCoordinator?: LocalClientExecutionIdempotencyDependencies["idempotencyCoordinator"];
  executeImpl?: (planId: string) => Promise<LocalClientExecutionResult>;
  tenantId?: string;
  subjectId?: string;
} = {}) {
  const tenantId = options.tenantId ?? TENANT_ID;
  const subjectId = options.subjectId ?? SUBJECT_ID;
  const routePlanStore = createLocalClientRoutePlanStore({ ttlMs: 60_000 });
  const plan = routePlanStore.create({
    tenantId,
    subjectId,
    target: {
      descriptorVersion: "verified-local-client-adapter-target-v1",
      clientId: "desktop.client",
      revision: 1,
      state: "verified",
      trustDecision: "verified",
      adapter: {
        id: "loopback.adapter",
        type: "loopback_http",
        version: "1.0.0",
      },
      capabilityIds: ["local_application"],
    },
    capabilityId: "local_application",
    actionId: "perform",
    input: INPUT,
    policyVersion: "policy-v1",
  });
  let failPlanReads = false;
  const guardedRoutePlanStore = {
    get(reference: Parameters<typeof routePlanStore.get>[0]) {
      if (failPlanReads) throw new Error("route plan was already consumed");
      return routePlanStore.get(reference);
    },
    verifyInput(reference: Parameters<typeof routePlanStore.verifyInput>[0], input: unknown) {
      if (failPlanReads) throw new Error("route plan was already consumed");
      return routePlanStore.verifyInput(reference, input);
    },
  };
  let executions = 0;
  let lastExecutionRequest: LocalClientExecutionRequest | null = null;
  const orchestrator = {
    async execute(request: LocalClientExecutionRequest) {
      executions += 1;
      lastExecutionRequest = request;
      return options.executeImpl
        ? options.executeImpl(plan.planId)
        : completedResult(plan.planId);
    },
  };
  const idempotencyCoordinator = options.idempotencyCoordinator
    ?? await createRealCoordinator(options.storeMode ?? "sqlite");
  const wrapper = createLocalClientExecutionIdempotencyCoordinator({
    idempotencyCoordinator,
    routePlanStore: guardedRoutePlanStore,
    orchestrator,
  }, {
    executionRequested: options.executionRequested ?? true,
  });
  return {
    wrapper,
    request: {
      idempotencyKey: "execute-key-0001",
      tenantId,
      subjectId,
      planId: plan.planId,
      input: INPUT,
    },
    executeCount: () => executions,
    executionRequest: () => lastExecutionRequest,
    failPlanReads() { failPlanReads = true; },
  };
}

async function createRealCoordinator(storeMode: "memory" | "sqlite") {
  if (storeMode === "memory") {
    const coordinator = createIdempotencyCoordinator({ storeMode: "memory", secret: SECRET });
    coordinators.push(coordinator);
    return coordinator;
  }
  const directory = await mkdtemp(join(tmpdir(), "local-client-idempotency-"));
  temporaryDirectories.push(directory);
  const coordinator = createIdempotencyCoordinator({
    storeMode: "sqlite",
    sqlitePath: join(directory, "idempotency.sqlite"),
    secret: SECRET,
    inFlightWaitMs: 5_000,
    pollIntervalMs: 10,
  });
  coordinators.push(coordinator);
  return coordinator;
}

function fakeCoordinator(options: {
  stats: ReturnType<IdempotencyCoordinator["getStats"]>;
  execute?: ReturnType<typeof vi.fn>;
  checkHealth?: ReturnType<typeof vi.fn>;
}): LocalClientExecutionIdempotencyDependencies["idempotencyCoordinator"] {
  return {
    execute: (options.execute ?? vi.fn()) as IdempotencyCoordinator["execute"],
    getStats: () => options.stats,
    ...(options.checkHealth
      ? { checkHealth: options.checkHealth as NonNullable<IdempotencyCoordinator["checkHealth"]> }
      : {}),
  };
}

function stats(
  storeMode: "memory" | "sqlite" | "postgres",
  available: boolean,
  distributed: boolean,
): ReturnType<IdempotencyCoordinator["getStats"]> {
  return {
    entries: 0,
    inFlight: 0,
    replayable: 0,
    tombstones: 0,
    ttlMs: 60_000,
    maxEntries: 100,
    maxResultBytes: 1_048_576,
    storeMode,
    available,
    distributed,
  };
}

function completedResult(planId: string): LocalClientExecutionCompletedResult {
  const executionId = `lc-exec-${"b".repeat(64)}`;
  return Object.freeze({
    status: "completed",
    executionId,
    planId,
    planFingerprint: planId,
    reservationFingerprint: "c".repeat(64),
    externalEffectCommitted: true,
    retryAllowed: false,
    receipt: Object.freeze({
      receiptVersion: "local-client-adapter-receipt-v2",
      receiptId: "receipt:completed:0001",
      executionId,
      adapterId: "loopback.adapter",
      adapterType: "loopback_http",
      adapterVersion: "1.0.0",
      clientId: "desktop.client",
      capabilityId: "local_application",
      actionId: "perform",
      planFingerprint: planId,
      executionMode: "governed",
      externalEffectPerformed: true,
      status: "completed",
    }),
    feedback: Object.freeze({
      source: "verified-governed-receipt",
      eventId: `lcfb-${"f".repeat(64)}`,
      attempted: true,
      persisted: true,
      exactlyOnce: true,
      replayed: false,
      deliveryStatus: "persisted",
      errorCode: null,
    }),
  });
}

function unknownResult(planId: string): LocalClientExecutionResult {
  return Object.freeze({
    status: "unknown-reconcile-required",
    executionId: `lc-exec-${"d".repeat(64)}`,
    planId,
    planFingerprint: planId,
    reservationFingerprint: "e".repeat(64),
    externalEffectCommitted: true,
    retryAllowed: false,
    receipt: null,
    errorCode: "LOCAL_CLIENT_EXECUTION_OUTCOME_UNKNOWN",
    lifecyclePersisted: true,
  });
}
