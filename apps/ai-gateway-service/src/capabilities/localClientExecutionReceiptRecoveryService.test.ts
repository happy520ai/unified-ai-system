import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createLocalClientSqliteExecutionReceiptJournal } from "./localClientExecutionReceiptReconciliation.ts";
import {
  createLocalClientExecutionReceiptJournalRegistry,
  LOCAL_CLIENT_RECEIPT_JOURNAL_ENUMERATION_FAILURE_CODE,
} from "./localClientExecutionReceiptJournalRegistry.ts";
import {
  createLocalClientVerifiedReceiptFeedbackDelivery,
  type LocalClientVerifiedExecutionFeedbackInput,
} from "./localClientExecutionOrchestrator.ts";
import {
  createLocalClientExecutionReceiptRecoveryService,
  LOCAL_CLIENT_EXECUTION_RECEIPT_RECOVERY_BOUNDARIES,
} from "./localClientExecutionReceiptRecoveryService.ts";

const roots: string[] = [];
const PROTOCOL_KEY = Buffer.alloc(32, 0x31);
const GATEWAY_KEY = Buffer.alloc(32, 0x32);
const CLIENT_KEY = Buffer.alloc(32, 0x33);
const RECOVERY_KEY = Buffer.alloc(32, 0x34);
const EXECUTION_ID = `lc-exec-${"a".repeat(64)}`;
const IDENTITY = Object.freeze({
  executionId: EXECUTION_ID,
  tenantId: "tenant-recovery",
  subjectId: "subject-recovery",
  clientId: "desktop.recovery",
  capabilityId: "local_application",
  actionId: "invoke",
  planFingerprint: "b".repeat(64),
  inputSha256: "c".repeat(64),
});

afterEach(async () => {
  while (roots.length > 0) await rm(roots.pop()!, { recursive: true, force: true });
});

describe("local-client execution receipt recovery service", () => {
  it("recovers a client-completed receipt through query-only reconciliation and finalizes feedback", async () => {
    const fixture = await createFixture();
    await fixture.gateway.prepareDispatch(IDENTITY);
    const armed = await fixture.gateway.armDispatch(IDENTITY);
    await fixture.client.acceptDispatchIntent(armed.intent);
    const claimed = await fixture.client.claimEffect(armed.intent);
    expect(claimed.execute).toBe(true);
    await fixture.client.recordCompleted(armed.intent);

    const result = await fixture.service.runOnce();

    expect(result).toEqual({ success: true, scanned: 1, resolved: 1, unresolved: 0, failed: 0 });
    expect(fixture.adapterRegistry.reconcileReceipt).toHaveBeenCalledOnce();
    expect(fixture.feedbackSink.stage).toHaveBeenCalledOnce();
    expect(fixture.feedbackSink.record).toHaveBeenCalledOnce();
    expect(fixture.lifecycle.complete).toHaveBeenCalledWith(
      EXECUTION_ID,
      "completed",
      expect.objectContaining({ outcome: "completed-reconciled", retryAllowed: false }),
    );
    expect(await fixture.gateway.listRecoveryCandidates()).toEqual([]);
    expect(fixture.service.status).toMatchObject({
      ...LOCAL_CLIENT_EXECUTION_RECEIPT_RECOVERY_BOUNDARIES,
      resolvedCount: 1,
      failureCount: 0,
      consecutiveFailureCount: 0,
      lastRunSucceeded: true,
    });
    await fixture.close();
  });

  it("completes a pause-marked unknown lifecycle after a durable client receipt appears", async () => {
    const fixture = await createFixture();
    await fixture.gateway.prepareDispatch(IDENTITY);
    const armed = await fixture.gateway.armDispatch(IDENTITY);
    await fixture.client.acceptDispatchIntent(armed.intent);
    await fixture.client.claimEffect(armed.intent);
    await fixture.client.recordCompleted(armed.intent);
    fixture.lifecycle.getStatus.mockResolvedValue({ status: "running", pauseRequested: true });

    await expect(fixture.service.runOnce()).resolves.toMatchObject({
      success: true,
      resolved: 1,
      failed: 0,
    });
    expect(fixture.lifecycle.complete).toHaveBeenCalledWith(
      EXECUTION_ID,
      "completed",
      expect.objectContaining({ outcome: "completed-reconciled", retryAllowed: false }),
    );
    expect(await fixture.gateway.listRecoveryCandidates()).toEqual([]);
    await fixture.close();
  });

  it("resolves a prepared-but-never-armed intent without contacting or authorizing the client", async () => {
    const fixture = await createFixture();
    await fixture.gateway.prepareDispatch(IDENTITY);

    const result = await fixture.service.runOnce();

    expect(result).toMatchObject({ success: true, resolved: 1 });
    expect(fixture.adapterRegistry.reconcileReceipt).not.toHaveBeenCalled();
    expect(fixture.feedbackSink.stage).not.toHaveBeenCalled();
    expect(fixture.lifecycle.complete).toHaveBeenCalledWith(
      EXECUTION_ID,
      "failed",
      expect.objectContaining({
        outcome: "failed-before-effect-reconciled",
        externalEffectCommitted: false,
      }),
    );
    expect(await fixture.gateway.listRecoveryCandidates()).toEqual([]);
    await fixture.close();
  });

  it("replays the identical canonical outbox event after the post-stage crash window", async () => {
    const fixture = await createFixture();
    await fixture.gateway.prepareDispatch(IDENTITY);
    const armed = await fixture.gateway.armDispatch(IDENTITY);
    await fixture.client.acceptDispatchIntent(armed.intent);
    await fixture.client.claimEffect(armed.intent);
    const completed = await fixture.client.recordCompleted(armed.intent);
    await fixture.gateway.confirmReceipt(completed.receipt);

    const stagedByEventId = new Map<string, string>();
    fixture.feedbackSink.stage.mockImplementation(async (input, scope) => {
      const serialized = JSON.stringify({ input, scope });
      const previous = stagedByEventId.get(input.eventId);
      if (previous !== undefined && previous !== serialized) {
        throw new Error("IDEMPOTENCY_CONTENT_CONFLICT");
      }
      stagedByEventId.set(input.eventId, serialized);
      return {
        persisted: true as const,
        queued: true,
        replayed: previous !== undefined,
        state: "pending" as const,
      };
    });
    const liveDelivery = createLocalClientVerifiedReceiptFeedbackDelivery({
      tenantId: IDENTITY.tenantId,
      subjectId: IDENTITY.subjectId,
      clientId: IDENTITY.clientId,
      capabilityId: IDENTITY.capabilityId,
      executionId: IDENTITY.executionId,
      durableReceiptId: completed.receipt.receiptId,
      intentIssuedAtMs: armed.intent.issuedAtMs,
      completedAtMs: completed.receipt.completedAtMs,
    });

    // Simulate a crash after the online outbox persisted the event but before
    // the gateway journal advanced from receipt-confirmed to feedback-staged.
    await fixture.feedbackSink.stage(liveDelivery.input, liveDelivery.scope);
    expect((await fixture.gateway.listRecoveryCandidates())[0]).toMatchObject({
      state: "receipt-confirmed",
      recoveryAction: "stage-feedback",
    });

    const result = await fixture.service.runOnce();

    expect(result).toEqual({ success: true, scanned: 1, resolved: 1, unresolved: 0, failed: 0 });
    expect(fixture.feedbackSink.stage).toHaveBeenCalledTimes(2);
    expect(fixture.feedbackSink.stage.mock.calls[1]).toEqual(
      fixture.feedbackSink.stage.mock.calls[0],
    );
    expect(stagedByEventId).toHaveLength(1);
    expect(fixture.adapterRegistry.reconcileReceipt).not.toHaveBeenCalled();
    expect(await fixture.gateway.listRecoveryCandidates()).toEqual([]);
    await fixture.close();
  });

  it("keeps an effect-started client outcome pending and never redispatches", async () => {
    const fixture = await createFixture();
    await fixture.gateway.prepareDispatch(IDENTITY);
    const armed = await fixture.gateway.armDispatch(IDENTITY);
    await fixture.client.acceptDispatchIntent(armed.intent);
    await fixture.client.claimEffect(armed.intent);

    const result = await fixture.service.runOnce();

    expect(result).toMatchObject({ success: true, resolved: 0, unresolved: 1 });
    expect(fixture.lifecycle.complete).not.toHaveBeenCalled();
    expect(fixture.feedbackSink.stage).not.toHaveBeenCalled();
    expect((await fixture.gateway.listRecoveryCandidates())[0]).toMatchObject({
      recoveryAction: "query-client-only",
      redispatchAllowed: false,
    });
    await fixture.close();
  });

  it.each([
    ["contradictory", { persisted: true, queued: false, replayed: false, state: "pending" }],
    ["extra-field", { persisted: true, queued: true, replayed: false, state: "pending", extra: true }],
    ["symbol-field", Object.assign(
      { persisted: true, queued: true, replayed: false, state: "pending" },
      { [Symbol("hidden")]: true },
    )],
    ["accessor", Object.defineProperty(
      { persisted: true, queued: true, replayed: false },
      "state",
      { enumerable: true, get: () => "pending" },
    )],
  ])("rejects %s feedback stage evidence without advancing the journal", async (_label, raw) => {
    const fixture = await createFixture();
    await fixture.gateway.prepareDispatch(IDENTITY);
    const armed = await fixture.gateway.armDispatch(IDENTITY);
    await fixture.client.acceptDispatchIntent(armed.intent);
    await fixture.client.claimEffect(armed.intent);
    const completed = await fixture.client.recordCompleted(armed.intent);
    await fixture.gateway.confirmReceipt(completed.receipt);
    fixture.feedbackSink.stage.mockResolvedValueOnce(raw as never);

    await expect(fixture.service.runOnce()).resolves.toMatchObject({
      success: false,
      failed: 1,
      resolved: 0,
    });
    await expect(fixture.gateway.listRecoveryCandidates()).resolves.toMatchObject([{
      state: "receipt-confirmed",
      recoveryAction: "stage-feedback",
    }]);
    await fixture.close();
  });

  it("reports only the current consecutive recovery failure and clears it after a healthy run", async () => {
    const fixture = await createFixture();
    try {
      await fixture.gateway.prepareDispatch(IDENTITY);
      const armed = await fixture.gateway.armDispatch(IDENTITY);
      await fixture.client.acceptDispatchIntent(armed.intent);
      await fixture.client.claimEffect(armed.intent);
      fixture.adapterRegistry.reconcileReceipt.mockRejectedValueOnce(Object.assign(
        new Error("injected reconciliation failure"),
        { code: "LOCAL_CLIENT_TEST_RECONCILIATION_FAILED" },
      ));

      await expect(fixture.service.runOnce()).resolves.toMatchObject({
        success: false,
        failed: 1,
      });
      expect(fixture.service.status).toMatchObject({
        failureCount: 1,
        consecutiveFailureCount: 1,
        lastRunSucceeded: false,
        lastSuccessAt: null,
        lastErrorCode: "LOCAL_CLIENT_TEST_RECONCILIATION_FAILED",
      });

      await expect(fixture.service.runOnce()).resolves.toMatchObject({
        success: true,
        unresolved: 1,
        failed: 0,
      });
      const recoveredStatus = fixture.service.status;
      expect(recoveredStatus).toMatchObject({
        failureCount: 1,
        consecutiveFailureCount: 0,
        lastRunSucceeded: true,
        lastErrorCode: null,
      });
      expect(recoveredStatus.lastSuccessAt).toBe(recoveredStatus.lastRunAt);
      expect(recoveredStatus.lastSuccessAt).toEqual(expect.any(String));
    } finally {
      await fixture.close();
    }
  });

  it("finalizes a healthy completed binding while reporting one unavailable journal", async () => {
    const fixture = await createFixture({ withUnavailableBinding: true });
    try {
      await fixture.gateway.prepareDispatch(IDENTITY);
      const armed = await fixture.gateway.armDispatch(IDENTITY);
      await fixture.client.acceptDispatchIntent(armed.intent);
      await fixture.client.claimEffect(armed.intent);
      await fixture.client.recordCompleted(armed.intent);

      const result = await fixture.service.runOnce();

      expect(result).toEqual({
        success: false,
        scanned: 1,
        resolved: 1,
        unresolved: 0,
        failed: 1,
      });
      expect(fixture.lifecycle.complete).toHaveBeenCalledWith(
        EXECUTION_ID,
        "completed",
        expect.objectContaining({ outcome: "completed-reconciled", retryAllowed: false }),
      );
      expect(await fixture.gateway.listRecoveryCandidates()).toEqual([]);
      expect(fixture.service.status).toMatchObject({
        available: false,
        failureCount: 1,
        consecutiveFailureCount: 1,
        lastRunSucceeded: false,
        lastErrorCode: LOCAL_CLIENT_RECEIPT_JOURNAL_ENUMERATION_FAILURE_CODE,
      });
      expect(JSON.stringify({ result, status: fixture.service.status })).not.toContain("tenant-unavailable");
      expect(JSON.stringify({ result, status: fixture.service.status })).not.toContain("desktop.unavailable");
    } finally {
      await fixture.close();
    }
  });
});

async function createFixture(options: Readonly<{ withUnavailableBinding?: boolean }> = {}) {
  const root = await mkdtemp(join(tmpdir(), "local-client-receipt-recovery-service-"));
  roots.push(root);
  let nowMs = 1_800_000_000_000;
  const now = () => nowMs += 10;
  const gateway = createLocalClientSqliteExecutionReceiptJournal({
    sqlitePath: join(root, "gateway.sqlite"),
    role: "gateway",
    hostId: "gateway-recovery-host",
    integrityKey: GATEWAY_KEY,
    protocolKey: PROTOCOL_KEY,
    recoveryEncryptionKey: RECOVERY_KEY,
    now,
  });
  const client = createLocalClientSqliteExecutionReceiptJournal({
    sqlitePath: join(root, "client.sqlite"),
    role: "client",
    hostId: "client-recovery-host",
    integrityKey: CLIENT_KEY,
    protocolKey: PROTOCOL_KEY,
    now,
  });
  const unavailableJournal = options.withUnavailableBinding ? createUnavailableJournal() : null;
  const receiptRegistry = createLocalClientExecutionReceiptJournalRegistry([
    ...(unavailableJournal ? [{
      tenantId: "tenant-unavailable",
      clientId: "desktop.unavailable",
      journal: unavailableJournal,
    }] : []),
    { tenantId: IDENTITY.tenantId, clientId: IDENTITY.clientId, journal: gateway },
  ]);
  if (unavailableJournal) unavailableJournal.status.available = false;
  const adapterRegistry = {
    reconcileReceipt: vi.fn(async ({ query }: any) => client.reconcile(query)),
  };
  const feedbackSink = {
    stage: vi.fn(async (
      _input: LocalClientVerifiedExecutionFeedbackInput,
      _scope: Readonly<{ tenantId: string; userId: string }>,
    ) => ({
      persisted: true as const,
      queued: true,
      replayed: false,
      state: "pending" as const,
    })),
    record: vi.fn(async (
      _input: LocalClientVerifiedExecutionFeedbackInput,
      _scope: Readonly<{ tenantId: string; userId: string }>,
    ) => ({
      persisted: true as const,
      exactlyOnce: true,
      replayed: false,
    })),
  };
  let lifecycleStatus = "running";
  const lifecycle = {
    getStatus: vi.fn(async () => ({ status: lifecycleStatus, pauseRequested: false })),
    complete: vi.fn(async (_executionId: string, status: "completed" | "failed") => {
      lifecycleStatus = status;
      return { success: true };
    }),
  };
  const service = createLocalClientExecutionReceiptRecoveryService({
    receiptRegistry,
    adapterRegistry: adapterRegistry as any,
    resolveVerifiedTarget: vi.fn(async () => ({
      descriptorVersion: "verified-local-client-adapter-target-v1" as const,
      clientId: IDENTITY.clientId,
      state: "verified" as const,
      trustDecision: "verified" as const,
      adapter: { id: "loopback.recovery", type: "loopback-http", version: "2.0.0" },
      capabilityIds: [IDENTITY.capabilityId],
    })),
    feedbackSink,
    lifecycle,
    intervalMs: 60_000,
    recoveryGraceMs: 0,
    now: () => 2_000_000_000_000,
  });
  return {
    gateway,
    client,
    receiptRegistry,
    adapterRegistry,
    feedbackSink,
    lifecycle,
    service,
    async close() {
      await service.close();
      await receiptRegistry.close();
      await client.close();
    },
  };
}

function createUnavailableJournal() {
  return {
    status: {
      role: "gateway",
      durable: true,
      available: true,
      recoveryContextEncrypted: true,
      databaseSnapshotRollbackProtected: false,
    },
    prepareDispatch: vi.fn(),
    armDispatch: vi.fn(),
    confirmReceipt: vi.fn(),
    markFeedbackStaged: vi.fn(),
    markLifecycleFinalized: vi.fn(),
    resolvePreparedAsNotDispatched: vi.fn(),
    resolveArmedAsNotDispatched: vi.fn(),
    getRecoveryWorkItem: vi.fn(),
    createReconciliationQuery: vi.fn(),
    applyReconciliation: vi.fn(),
    listRecoveryWorkItems: vi.fn(async () => {
      throw Object.assign(new Error("tenant-unavailable desktop.unavailable"), {
        code: "TENANT_UNAVAILABLE_DESKTOP_UNAVAILABLE",
      });
    }),
    close: vi.fn(async () => undefined),
  } as any;
}
