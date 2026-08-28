import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createLocalClientExecutionFeedbackDispatcher,
  LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCHER_BOUNDARIES,
  type LocalClientExecutionFeedbackDispatcher,
  type LocalClientExecutionFeedbackDispatcherOptions,
} from "./localClientExecutionFeedbackDispatcher.ts";
import { LocalClientSqliteExecutionFeedbackOutbox } from "./localClientSqliteExecutionFeedbackOutbox.ts";

describe("LocalClientExecutionFeedbackDispatcher", () => {
  let root = "";
  let outbox: LocalClientSqliteExecutionFeedbackOutbox | null = null;
  let dispatcher: LocalClientExecutionFeedbackDispatcher | null = null;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "local-client-feedback-dispatcher-"));
  });

  afterEach(async () => {
    await dispatcher?.close();
    await outbox?.close();
    await rm(root, { recursive: true, force: true });
  });

  function createHarness(
    record: LocalClientExecutionFeedbackDispatcherOptions["aggregateSink"]["record"],
    tuning: Partial<Pick<
      LocalClientExecutionFeedbackDispatcherOptions,
      "intervalMs" | "deliveryTimeoutMs" | "batchSize" | "maxBatchesPerRun"
    >> = {},
  ) {
    outbox = new LocalClientSqliteExecutionFeedbackOutbox({
      sqlitePath: join(root, "feedback-outbox.sqlite"),
      hostId: "feedback-dispatcher-test-host",
      namespace: "feedback-dispatcher-test",
      integrityKey: Buffer.alloc(32, 0x61),
      deliveredTtlMs: 60_000,
      leaseTtlMs: 6_000,
      maxEvents: 16,
      maxBatchSize: 4,
      busyTimeoutMs: 1_000,
    });
    dispatcher = createLocalClientExecutionFeedbackDispatcher({
      outbox,
      aggregateSink: { record },
      intervalMs: 60_000,
      deliveryTimeoutMs: 1_000,
      batchSize: 4,
      maxBatchesPerRun: 2,
      ...tuning,
    });
    return { outbox, dispatcher };
  }

  it("stages a minimal event and acknowledges it only after exactly-once aggregate persistence", async () => {
    const record = vi.fn(async () => ({
      persisted: true as const,
      exactlyOnce: true as const,
      replayed: false,
    }));
    const harness = createHarness(record);

    await expect(harness.dispatcher.stage(feedbackInput(), scope())).resolves.toEqual({
      persisted: true,
      queued: true,
      replayed: false,
      state: "pending",
    });
    await expect(harness.dispatcher.record(feedbackInput(), scope())).resolves.toMatchObject({
      persisted: true,
      exactlyOnce: true,
      queued: false,
    });

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(feedbackInput(), scope());
    await expect(harness.outbox.checkHealth()).resolves.toMatchObject({
      pendingEvents: 0,
      deliveredEvents: 1,
    });
    expect(harness.dispatcher.status).toMatchObject({
      ...LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCHER_BOUNDARIES,
      available: true,
      deliveredEvents: 1,
      lastErrorCode: null,
    });
  });

  it("retains a failed delivery as pending and recovers it without replaying the execution", async () => {
    const record = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("aggregate offline"), { code: "AGGREGATE_OFFLINE" }))
      .mockResolvedValue({ persisted: true, exactlyOnce: true, replayed: false });
    const harness = createHarness(record);

    await harness.dispatcher.stage(feedbackInput(), scope());
    await expect(harness.dispatcher.record(feedbackInput(), scope())).resolves.toEqual({
      persisted: true,
      exactlyOnce: false,
      replayed: false,
      queued: true,
    });
    await expect(harness.outbox.checkHealth()).resolves.toMatchObject({
      pendingEvents: 1,
      deliveredEvents: 0,
      leasedEvents: 0,
    });
    expect(harness.dispatcher.status.lastErrorCode).toBe("AGGREGATE_OFFLINE");

    await expect(harness.dispatcher.flushNow()).resolves.toMatchObject({
      success: true,
      delivered: 1,
    });
    await expect(harness.outbox.checkHealth()).resolves.toMatchObject({
      pendingEvents: 0,
      deliveredEvents: 1,
    });
    expect(record).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent flushes into one leased delivery run", async () => {
    let resolveDelivery!: (value: { persisted: true; exactlyOnce: true; replayed: false }) => void;
    const record = vi.fn((): Promise<{
      persisted: true;
      exactlyOnce: true;
      replayed: false;
    }> => new Promise((resolve) => {
      resolveDelivery = resolve;
    }));
    const harness = createHarness(record);
    await harness.dispatcher.stage(feedbackInput(), scope());

    const first = harness.dispatcher.flushNow();
    const second = harness.dispatcher.flushNow();
    expect(second).toBe(first);
    await vi.waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    resolveDelivery({ persisted: true, exactlyOnce: true, replayed: false });
    await expect(first).resolves.toMatchObject({ delivered: 1 });
    await expect(harness.outbox.checkHealth()).resolves.toMatchObject({ deliveredEvents: 1 });
  });

  it("uses a bounded delivery deadline and closes without discarding the pending event", async () => {
    const record = vi.fn(() => new Promise<{
      persisted: true;
      exactlyOnce: true;
      replayed: false;
    }>((resolve) => {
      setTimeout(() => resolve({ persisted: true, exactlyOnce: true, replayed: false }), 250);
    }));
    const harness = createHarness(record, { deliveryTimeoutMs: 50 });
    await harness.dispatcher.stage(feedbackInput(), scope());

    await expect(harness.dispatcher.record(feedbackInput(), scope())).resolves.toMatchObject({
      persisted: true,
      exactlyOnce: false,
      queued: true,
    });
    expect(harness.dispatcher.status.lastErrorCode)
      .toBe("LOCAL_CLIENT_EXECUTION_FEEDBACK_DELIVERY_TIMEOUT");
    expect(harness.dispatcher.status.unsettledDeliveryCount).toBe(1);
    const firstClose = harness.dispatcher.close();
    const secondClose = harness.dispatcher.close();
    expect(secondClose).toBe(firstClose);
    await firstClose;
    expect(harness.dispatcher.status).toMatchObject({
      available: false,
      lifecycle: "closed",
      unsettledDeliveryCount: 0,
    });
    await expect(harness.outbox.checkHealth()).resolves.toMatchObject({ pendingEvents: 1 });
  });

  it("records a redacted operational signal when durable staging fails", async () => {
    const record = vi.fn(async () => ({
      persisted: true as const,
      exactlyOnce: true as const,
      replayed: false,
    }));
    const harness = createHarness(record);
    await harness.outbox.close();

    await expect(harness.dispatcher.stage(feedbackInput(), scope())).rejects.toMatchObject({
      code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_CLOSED",
    });
    expect(harness.dispatcher.status).toMatchObject({
      stageFailureCount: 1,
      lastStageFailureCode: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_CLOSED",
      lastStageFailureAt: expect.any(String),
    });
    expect(record).not.toHaveBeenCalled();
  });
});

function feedbackInput() {
  return Object.freeze({
    eventId: `lcfb-${"a".repeat(64)}`,
    clientId: "managed.feedback-client",
    taskId: "lc-exec-feedback-001",
    status: "success" as const,
    latencyMs: 42,
    requiredCapabilities: Object.freeze(["local_inspection"]),
    observedAt: "2026-01-15T08:00:00.000Z",
  });
}

function scope() {
  return Object.freeze({ tenantId: "tenant-feedback", userId: "subject-feedback" });
}
