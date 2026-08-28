import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LOCAL_CLIENT_EXECUTION_RECEIPT_RECONCILIATION_BOUNDARIES,
  LocalClientExecutionReceiptReconciliationError,
  createLocalClientSqliteExecutionReceiptJournal,
  type LocalClientDispatchIntent,
  type LocalClientReceiptReconciliationIdentity,
  type LocalClientSqliteExecutionReceiptJournal,
} from "./localClientExecutionReceiptReconciliation.ts";
import {
  createLocalClientCompletedReceiptReconciliationResponse,
  createLocalClientDurableExecutionReceipt,
  createLocalClientFailedBeforeEffectReconciliationResponse,
  createLocalClientNotFoundReconciliationResponse,
  createLocalClientPendingReconciliationResponse,
  deriveLocalClientReceiptReconciliationProtocolKey,
  verifyLocalClientDispatchIntent,
  verifyLocalClientReceiptReconciliationQuery,
} from "../../../../packages/shared-sdk/src/index.js";

const roots: string[] = [];
const PROTOCOL_KEY = Buffer.from("receipt-protocol-key-material-0001", "utf8");
const GATEWAY_KEY = Buffer.from("gateway-integrity-key-material-001", "utf8");
const CLIENT_KEY = Buffer.from("client-integrity-key-material-0002", "utf8");
const RECOVERY_KEY = Buffer.from("recovery-encryption-key-00000001", "utf8");
const START_MS = 1_800_000_000_000;

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function workspace() {
  const root = mkdtempSync(join(tmpdir(), "local-client-receipt-reconcile-"));
  roots.push(root);
  return root;
}

function executionId(hex: string) {
  return `lc-exec-${hex.repeat(64)}`;
}

function identity(hex = "a"): LocalClientReceiptReconciliationIdentity {
  return Object.freeze({
    executionId: executionId(hex),
    tenantId: `tenant-private-${hex}`,
    subjectId: `subject-private-${hex}`,
    clientId: `client-private-${hex}`,
    capabilityId: "local_application",
    actionId: "execute",
    planFingerprint: hex.repeat(64),
    inputSha256: hex === "f" ? "e".repeat(64) : "f".repeat(64),
  });
}

function openGateway(
  root: string,
  now: () => number,
  overrides: Partial<Parameters<typeof createLocalClientSqliteExecutionReceiptJournal>[0]> = {},
) {
  return createLocalClientSqliteExecutionReceiptJournal({
    sqlitePath: join(root, "gateway.sqlite"),
    role: "gateway",
    hostId: "gateway-host-01",
    integrityKey: GATEWAY_KEY,
    protocolKey: PROTOCOL_KEY,
    recoveryEncryptionKey: RECOVERY_KEY,
    now,
    ...overrides,
  });
}

function openClient(
  root: string,
  now: () => number,
  overrides: Partial<Parameters<typeof createLocalClientSqliteExecutionReceiptJournal>[0]> = {},
) {
  return createLocalClientSqliteExecutionReceiptJournal({
    sqlitePath: join(root, "client.sqlite"),
    role: "client",
    hostId: "client-host-0001",
    integrityKey: CLIENT_KEY,
    protocolKey: PROTOCOL_KEY,
    now,
    ...overrides,
  });
}

async function closeAll(...stores: LocalClientSqliteExecutionReceiptJournal[]) {
  await Promise.all(stores.map((store) => store.close()));
}

describe("local-client durable receipt reconciliation", () => {
  it("persists a one-shot dispatch intent and advances the full completed state machine", async () => {
    const root = workspace();
    let nowMs = START_MS;
    const now = () => nowMs;
    const gateway = openGateway(root, now);
    const client = openClient(root, now);
    const bound = identity();

    try {
      const prepared = await gateway.prepareDispatch(bound);
      expect(prepared).toMatchObject({ prepared: true, replayed: false });
      expect(prepared.record).not.toHaveProperty("tenantId");
      expect(prepared.record).not.toHaveProperty("subjectId");
      expect(prepared.record).not.toHaveProperty("clientId");

      nowMs += 1;
      const armed = await gateway.armDispatch(bound);
      expect(armed).toMatchObject({ dispatchAllowed: true, replayed: false });
      expect(armed.intent).toMatchObject({
        executionId: bound.executionId,
        dispatchFencingToken: "1",
      });
      expect(armed.intent).not.toHaveProperty("tenantId");
      expect(armed.intent).not.toHaveProperty("subjectId");
      expect(armed.intent).not.toHaveProperty("clientId");

      const replayedArm = await gateway.armDispatch(bound);
      expect(replayedArm).toMatchObject({ dispatchAllowed: false, replayed: true });
      expect(replayedArm.intent).toEqual(armed.intent);

      nowMs += 1;
      await expect(client.acceptDispatchIntent(armed.intent)).resolves.toMatchObject({
        accepted: true,
        replayed: false,
      });
      await expect(client.claimEffect(armed.intent)).resolves.toMatchObject({
        execute: true,
        replayed: false,
        state: "effect-started",
      });
      await expect(client.claimEffect(armed.intent)).resolves.toMatchObject({
        execute: false,
        replayed: true,
        state: "effect-started",
      });

      nowMs += 1;
      const completed = await client.recordCompleted(armed.intent);
      expect(completed.receipt).toMatchObject({
        executionId: bound.executionId,
        externalEffectPerformed: true,
        status: "completed",
      });

      const confirmed = await gateway.confirmReceipt(completed.receipt);
      expect(confirmed).toMatchObject({ confirmed: true, replayed: false });
      await expect(gateway.markFeedbackStaged({
        executionId: bound.executionId,
        receiptId: completed.receipt.receiptId,
      })).resolves.toMatchObject({ staged: true, replayed: false });
      await expect(gateway.markLifecycleFinalized({
        executionId: bound.executionId,
        outcome: "completed",
      })).resolves.toMatchObject({ finalized: true, replayed: false });
      await expect(gateway.listRecoveryCandidates()).resolves.toEqual([]);

      expect(LOCAL_CLIENT_EXECUTION_RECEIPT_RECONCILIATION_BOUNDARIES).toMatchObject({
        reconciliationAuthorizesRedispatch: false,
        absenceProvesNotExecuted: false,
        effectStartedCanBecomeFailedBeforeEffect: false,
        fullClosureRequiresClientAtomicEffectReceipt: true,
        clientAtomicEffectReceiptVerified: false,
        databaseSnapshotRollbackProtected: false,
        clientTerminalEvidenceAutoExpires: false,
        clientTerminalEvidenceAckImplemented: false,
      });
    } finally {
      await closeAll(gateway, client);
    }
  });

  it("interoperates with the public stateless SDK for completed and no-effect reconciliation", async () => {
    const root = workspace();
    let nowMs = START_MS;
    const now = () => nowMs;
    const sharedSecret = new Uint8Array(32).fill(0x41);
    const originalSecret = new Uint8Array(sharedSecret);
    const protocolKey = await deriveLocalClientReceiptReconciliationProtocolKey({
      sharedSecret,
      tenantId: "tenant-wire",
      clientId: "client.wire",
    });
    expect(sharedSecret).toEqual(originalSecret);
    const gateway = openGateway(root, now, { protocolKey });
    const completedIdentity = Object.freeze({
      ...identity("a"),
      tenantId: "tenant-wire",
      subjectId: "subject-wire",
      clientId: "client.wire",
      planFingerprint: "b".repeat(64),
      inputSha256: "c".repeat(64),
    });
    const failedIdentity = Object.freeze({
      ...completedIdentity,
      executionId: executionId("b"),
      planFingerprint: "d".repeat(64),
      inputSha256: "e".repeat(64),
    });
    const pendingIdentity = Object.freeze({
      ...completedIdentity,
      executionId: executionId("c"),
      planFingerprint: "f".repeat(64),
      inputSha256: "1".repeat(64),
    });

    try {
      await gateway.prepareDispatch(completedIdentity);
      const armed = await gateway.armDispatch(completedIdentity);
      expect(armed.intent).toMatchObject({
        intentId: "lcdi_1cbc518bd1add36cdfa8dcac27b102b9621cf6ec14bd6deb40c018b4925e58b4",
        signature: "5fede9e681959883260adbffa70df0656d5511ef481fc31ea4c9c3011b63a58a",
      });
      const verifiedIntent = await verifyLocalClientDispatchIntent({
        protocolKey,
        intent: armed.intent,
        nowMs,
      });
      nowMs += 1_234;
      const receipt = await createLocalClientDurableExecutionReceipt({
        protocolKey,
        intent: verifiedIntent,
        completedAtMs: nowMs,
        nowMs,
      });
      expect(receipt).toMatchObject({
        receiptId: "lcdr_b6b5d49466a552495fe5cc4396a948744b8fb19f0c237364f5e726ae901014d1",
        signature: "e377928680a1ae68211a5913cbec4498a9f170ed3ccbaf255538234cc6789f4a",
      });
      await expect(gateway.confirmReceipt(receipt)).resolves.toMatchObject({ confirmed: true });
      const completedQuery = await gateway.createReconciliationQuery(completedIdentity.executionId);
      await expect(verifyLocalClientReceiptReconciliationQuery({
        protocolKey,
        query: completedQuery,
        nowMs,
      })).resolves.toEqual(completedQuery);
      const completedResponse = await createLocalClientCompletedReceiptReconciliationResponse({
        protocolKey,
        query: completedQuery,
        receipt,
        observedAtMs: nowMs,
        nowMs,
      });
      await expect(gateway.applyReconciliation(completedQuery, completedResponse)).resolves.toMatchObject({
        state: "completed",
        resolved: true,
        replayed: true,
      });

      await gateway.prepareDispatch(pendingIdentity);
      await gateway.armDispatch(pendingIdentity);
      const pendingQuery = await gateway.createReconciliationQuery(pendingIdentity.executionId);
      const pendingResponse = await createLocalClientPendingReconciliationResponse({
        protocolKey,
        query: pendingQuery,
        observedAtMs: nowMs,
        nowMs,
      });
      expect(pendingResponse).toMatchObject({
        state: "pending",
        receipt: null,
        retryAllowed: false,
      });
      await expect(gateway.applyReconciliation(pendingQuery, pendingResponse)).resolves.toEqual({
        state: "pending",
        resolved: false,
        retryAllowed: false,
        receipt: null,
        replayed: false,
      });
      const notFoundResponse = await createLocalClientNotFoundReconciliationResponse({
        protocolKey,
        query: pendingQuery,
        observedAtMs: nowMs,
        nowMs,
      });
      expect(notFoundResponse).toMatchObject({
        state: "not-found",
        receipt: null,
        retryAllowed: false,
      });
      await expect(gateway.applyReconciliation(pendingQuery, notFoundResponse)).resolves.toEqual({
        state: "not-found",
        resolved: false,
        retryAllowed: false,
        receipt: null,
        replayed: false,
      });
      await expect(gateway.applyReconciliation(pendingQuery, {
        ...pendingResponse,
        state: "not-found",
      })).rejects.toMatchObject({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_SIGNATURE_INVALID",
      });

      await gateway.prepareDispatch(failedIdentity);
      await gateway.armDispatch(failedIdentity);
      const failedQuery = await gateway.createReconciliationQuery(failedIdentity.executionId);
      const failedResponse = await createLocalClientFailedBeforeEffectReconciliationResponse({
        protocolKey,
        query: failedQuery,
        observedAtMs: nowMs,
        nowMs,
      });
      expect(failedResponse).toMatchObject({
        state: "failed-before-effect",
        receipt: null,
        retryAllowed: false,
      });
      await expect(gateway.applyReconciliation(failedQuery, failedResponse)).resolves.toMatchObject({
        state: "failed-before-effect",
        resolved: true,
        replayed: false,
      });

      await expect(verifyLocalClientReceiptReconciliationQuery({
        protocolKey: new Uint8Array(32).fill(0x7f),
        query: completedQuery,
        nowMs,
      })).rejects.toMatchObject({ code: "GATEWAY_PROTOCOL_ERROR" });
      await expect(gateway.applyReconciliation(completedQuery, {
        ...completedResponse,
        observedAtMs: completedResponse.observedAtMs + 1,
      })).rejects.toMatchObject({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_SIGNATURE_INVALID",
      });
    } finally {
      protocolKey.fill(0);
      sharedSecret.fill(0);
      await gateway.close();
    }
  });

  it("authenticates and finalizes a prepared dispatch that was provably never armed", async () => {
    const root = workspace();
    let nowMs = START_MS;
    const now = () => nowMs;
    const bound = identity("9");
    let gateway = openGateway(root, now);

    await gateway.prepareDispatch(bound);
    nowMs += 1;
    const resolved = await gateway.resolvePreparedAsNotDispatched(bound.executionId);
    expect(resolved).toMatchObject({
      resolved: true,
      replayed: false,
      record: {
        state: "not-dispatched-confirmed",
        dispatchFencingToken: null,
        intentId: null,
        terminalOutcome: "failed-before-effect",
      },
    });
    await expect(gateway.resolvePreparedAsNotDispatched(bound.executionId)).resolves.toMatchObject({
      resolved: false,
      replayed: true,
      record: { state: "not-dispatched-confirmed" },
    });
    await expect(gateway.armDispatch(bound)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_STATE_INVALID",
    });
    await gateway.close();

    gateway = openGateway(root, now);
    try {
      await expect(gateway.listRecoveryCandidates()).resolves.toMatchObject([{
        executionId: bound.executionId,
        state: "not-dispatched-confirmed",
        dispatchFencingToken: null,
        intentId: null,
        recoveryAction: "finalize-failed-lifecycle",
        redispatchAllowed: false,
      }]);
      await expect(gateway.checkHealth()).resolves.toMatchObject({
        entries: 1,
        unresolvedEntries: 1,
        terminalEntries: 0,
      });
      await expect(gateway.markLifecycleFinalized({
        executionId: bound.executionId,
        outcome: "failed-before-effect",
      })).resolves.toMatchObject({
        finalized: true,
        replayed: false,
        record: {
          state: "lifecycle-finalized",
          dispatchFencingToken: null,
          intentId: null,
          terminalOutcome: "failed-before-effect",
        },
      });
      await expect(gateway.resolvePreparedAsNotDispatched(bound.executionId)).resolves.toMatchObject({
        resolved: false,
        replayed: true,
        record: { state: "lifecycle-finalized" },
      });
      await expect(gateway.listRecoveryCandidates()).resolves.toEqual([]);
      await expect(gateway.checkHealth()).resolves.toMatchObject({
        entries: 1,
        unresolvedEntries: 0,
        terminalEntries: 1,
      });
    } finally {
      await gateway.close();
    }
  });

  it("terminalizes an armed intent only through the gateway-proven pre-adapter path", async () => {
    const root = workspace();
    let nowMs = START_MS;
    const now = () => nowMs;
    const bound = identity("7");
    const gateway = openGateway(root, now);

    try {
      await gateway.prepareDispatch(bound);
      const armed = await gateway.armDispatch(bound);
      nowMs += 1;
      await expect(gateway.resolveArmedAsNotDispatched(bound.executionId)).resolves.toMatchObject({
        resolved: true,
        replayed: false,
        record: {
          state: "armed-not-dispatched-confirmed",
          intentId: armed.intent.intentId,
          dispatchFencingToken: armed.intent.dispatchFencingToken,
          terminalOutcome: "failed-before-effect",
        },
      });
      await expect(gateway.resolveArmedAsNotDispatched(bound.executionId)).resolves.toMatchObject({
        resolved: false,
        replayed: true,
      });
      await expect(gateway.listRecoveryCandidates()).resolves.toMatchObject([{
        state: "armed-not-dispatched-confirmed",
        recoveryAction: "finalize-failed-lifecycle",
        redispatchAllowed: false,
      }]);
      await expect(gateway.markLifecycleFinalized({
        executionId: bound.executionId,
        outcome: "failed-before-effect",
      })).resolves.toMatchObject({ finalized: true });
    } finally {
      await gateway.close();
    }
  });

  it("recovers a completed client receipt after both roles restart without redispatch", async () => {
    const root = workspace();
    let nowMs = START_MS;
    const now = () => nowMs;
    const bound = identity("b");
    let gateway = openGateway(root, now);
    let client = openClient(root, now);
    const armed = await (async () => {
      await gateway.prepareDispatch(bound);
      const result = await gateway.armDispatch(bound);
      await client.acceptDispatchIntent(result.intent);
      await client.claimEffect(result.intent);
      nowMs += 2;
      await client.recordCompleted(result.intent);
      return result;
    })();
    await closeAll(gateway, client);

    gateway = openGateway(root, now);
    client = openClient(root, now);
    try {
      await expect(gateway.listRecoveryCandidates()).resolves.toMatchObject([{
        executionId: bound.executionId,
        state: "armed",
        recoveryAction: "query-client-only",
        redispatchAllowed: false,
      }]);
      const query = await gateway.createReconciliationQuery(bound.executionId);
      expect(query).toMatchObject({
        purpose: "receipt-reconciliation-only",
        authorizeExecution: false,
      });
      const response = await client.reconcile(query);
      expect(response).toMatchObject({
        state: "completed",
        retryAllowed: false,
        receipt: { executionId: bound.executionId },
      });

      // A reconciliation query is not an execution grant; the original claim stays consumed.
      await expect(client.claimEffect(armed.intent)).resolves.toMatchObject({
        execute: false,
        replayed: true,
        state: "completed",
      });
      const applied = await gateway.applyReconciliation(query, response);
      expect(applied).toMatchObject({
        state: "completed",
        resolved: true,
        retryAllowed: false,
        replayed: false,
      });
      expect((await gateway.listRecoveryCandidates())[0]).toMatchObject({
        state: "receipt-confirmed",
        recoveryAction: "stage-feedback",
      });
    } finally {
      await closeAll(gateway, client);
    }
  });

  it("never rewrites effect-started as failed-before-effect and leaves pending reconciliation unknown", async () => {
    const root = workspace();
    let nowMs = START_MS;
    const now = () => nowMs;
    const gateway = openGateway(root, now);
    const client = openClient(root, now);
    const bound = identity("c");

    try {
      await gateway.prepareDispatch(bound);
      const { intent } = await gateway.armDispatch(bound);
      await client.acceptDispatchIntent(intent);
      await client.claimEffect(intent);

      await expect(client.recordFailedBeforeEffect(intent)).rejects.toMatchObject({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_STATE_INVALID",
      });
      const query = await gateway.createReconciliationQuery(bound.executionId);
      const response = await client.reconcile(query);
      expect(response).toMatchObject({ state: "pending", receipt: null, retryAllowed: false });
      await expect(gateway.applyReconciliation(query, response)).resolves.toMatchObject({
        state: "pending",
        resolved: false,
        retryAllowed: false,
      });
      await expect(gateway.listRecoveryCandidates()).resolves.toMatchObject([{
        state: "armed",
        recoveryAction: "query-client-only",
      }]);
    } finally {
      await closeAll(gateway, client);
    }
  });

  it("durably defers unresolved recovery work so the next row in one journal can run", async () => {
    const root = workspace();
    let nowMs = START_MS;
    const now = () => nowMs;
    const gateway = openGateway(root, now);
    const client = openClient(root, now);
    const first = identity("3");
    const second = identity("4");

    try {
      await gateway.prepareDispatch(first);
      nowMs += 1;
      const firstArmed = await gateway.armDispatch(first);
      await client.acceptDispatchIntent(firstArmed.intent);
      await client.claimEffect(firstArmed.intent);
      nowMs += 1;
      await gateway.prepareDispatch(second);
      const secondArmed = await gateway.armDispatch(second);

      await expect(gateway.listRecoveryWorkItems(1)).resolves.toMatchObject([{
        executionId: first.executionId,
      }]);
      const query = await gateway.createReconciliationQuery(first.executionId);
      const pending = await client.reconcile(query);
      nowMs += 1;
      await expect(gateway.applyReconciliation(query, pending)).resolves.toMatchObject({
        state: "pending",
        resolved: false,
      });
      await expect(gateway.listRecoveryWorkItems(1)).resolves.toMatchObject([{
        executionId: second.executionId,
      }]);
      expect(secondArmed.intent.executionId).toBe(second.executionId);
    } finally {
      await closeAll(gateway, client);
    }
  });

  it("reconciles a client-proven failure only when no effect claim occurred", async () => {
    const root = workspace();
    let nowMs = START_MS;
    const now = () => nowMs;
    const gateway = openGateway(root, now);
    const client = openClient(root, now);
    const bound = identity("d");

    try {
      await gateway.prepareDispatch(bound);
      const { intent } = await gateway.armDispatch(bound);
      await client.acceptDispatchIntent(intent);
      await client.recordFailedBeforeEffect(intent);
      const query = await gateway.createReconciliationQuery(bound.executionId);
      const response = await client.reconcile(query);
      expect(response).toMatchObject({
        state: "failed-before-effect",
        receipt: null,
        retryAllowed: false,
      });
      await expect(gateway.applyReconciliation(query, response)).resolves.toMatchObject({
        state: "failed-before-effect",
        resolved: true,
        retryAllowed: false,
      });
      await expect(gateway.markLifecycleFinalized({
        executionId: bound.executionId,
        outcome: "failed-before-effect",
      })).resolves.toMatchObject({ finalized: true });
    } finally {
      await closeAll(gateway, client);
    }
  });

  it("rejects stale out-of-order dispatch fencing while allowing exact replay", async () => {
    const root = workspace();
    const now = () => START_MS;
    const gateway = openGateway(root, now);
    const client = openClient(root, now);
    const first = identity("e");
    const second = identity("f");

    try {
      await gateway.prepareDispatch(first);
      const firstArmed = await gateway.armDispatch(first);
      await gateway.prepareDispatch(second);
      const secondArmed = await gateway.armDispatch(second);
      expect(firstArmed.intent.dispatchFencingToken).toBe("1");
      expect(secondArmed.intent.dispatchFencingToken).toBe("2");

      await client.acceptDispatchIntent(secondArmed.intent);
      await expect(client.acceptDispatchIntent(secondArmed.intent)).resolves.toMatchObject({
        accepted: false,
        replayed: true,
      });
      await expect(client.acceptDispatchIntent(firstArmed.intent)).rejects.toMatchObject({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_FENCE_STALE",
      });
    } finally {
      await closeAll(gateway, client);
    }
  });

  it("retains terminal client evidence until an authenticated ACK exists and fails capacity closed", async () => {
    const root = workspace();
    let nowMs = START_MS;
    const now = () => nowMs;
    const gateway = openGateway(root, now);
    const client = openClient(root, now, { maxEntries: 1, retentionMs: 1_000 });
    const first = identity("1");
    const second = identity("2");

    try {
      await gateway.prepareDispatch(first);
      const firstArmed = await gateway.armDispatch(first);
      await client.acceptDispatchIntent(firstArmed.intent);

      await gateway.prepareDispatch(second);
      const secondArmed = await gateway.armDispatch(second);
      await expect(client.acceptDispatchIntent(secondArmed.intent)).rejects.toMatchObject({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_CAPACITY",
      });

      await client.recordFailedBeforeEffect(firstArmed.intent);
      nowMs += 1_001;
      await expect(client.acceptDispatchIntent(secondArmed.intent)).rejects.toMatchObject({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_CAPACITY",
      });

      const oldQuery = await gateway.createReconciliationQuery(first.executionId);
      const retained = await client.reconcile(oldQuery);
      expect(retained).toMatchObject({
        state: "failed-before-effect",
        retryAllowed: false,
        receipt: null,
      });
      await expect(gateway.applyReconciliation(oldQuery, retained)).resolves.toMatchObject({
        resolved: true,
        retryAllowed: false,
      });
    } finally {
      await closeAll(gateway, client);
    }
  });

  it("detects protocol tampering, persisted-row tampering, wrong keys, and raw-data leakage", async () => {
    const root = workspace();
    let nowMs = START_MS;
    const now = () => nowMs;
    const gatewayPath = join(root, "gateway.sqlite");
    const clientPath = join(root, "client.sqlite");
    const gateway = openGateway(root, now);
    const client = openClient(root, now);
    const bound = identity("9");
    const rawPayload = "never-persist-this-raw-action-payload";
    const protocolSecretText = PROTOCOL_KEY.toString("utf8");

    await gateway.prepareDispatch(bound);
    const armed = await gateway.armDispatch(bound);
    await client.acceptDispatchIntent(armed.intent);
    await client.claimEffect(armed.intent);
    nowMs += 1;
    const completed = await client.recordCompleted(armed.intent);

    const tamperedReceipt = {
      ...completed.receipt,
      receiptId: `lcdr_${"0".repeat(64)}`,
    };
    await expect(gateway.confirmReceipt(tamperedReceipt)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_SIGNATURE_INVALID",
    });
    await closeAll(gateway, client);

    for (const path of [gatewayPath, clientPath, `${gatewayPath}-wal`, `${clientPath}-wal`]) {
      if (!existsSync(path)) continue;
      const bytes = readFileSync(path).toString("latin1");
      expect(bytes).not.toContain(bound.tenantId);
      expect(bytes).not.toContain(bound.subjectId);
      expect(bytes).not.toContain(bound.clientId);
      expect(bytes).not.toContain(rawPayload);
      expect(bytes).not.toContain(protocolSecretText);
    }

    expect(() => openClient(root, now, {
      protocolKey: Buffer.from("different-protocol-key-material-000", "utf8"),
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_KEY_MISMATCH",
    }));

    const tamperDb = new DatabaseSync(clientPath);
    tamperDb.prepare(`
      UPDATE local_client_execution_receipt_journal
      SET state = 'failed-before-effect'
      WHERE execution_id = ?
    `).run(bound.executionId);
    tamperDb.close();
    expect(() => openClient(root, now)).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_INTEGRITY_INVALID",
    }));
  });

  it("fails closed on role misuse, identity conflicts, expiry, and clock rollback", async () => {
    const root = workspace();
    let nowMs = START_MS;
    const now = () => nowMs;
    const gateway = openGateway(root, now, { intentTtlMs: 1_000 });
    const client = openClient(root, now, { intentTtlMs: 1_000 });
    const bound = identity("8");

    try {
      await expect(client.prepareDispatch(bound)).rejects.toMatchObject({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_ROLE_INVALID",
      });
      await gateway.prepareDispatch(bound);
      await expect(gateway.prepareDispatch({
        ...bound,
        subjectId: "different-subject",
      })).rejects.toMatchObject({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_IDENTITY_MISMATCH",
      });
      const { intent } = await gateway.armDispatch(bound);
      nowMs += 1_001 + 5_000;
      await expect(client.acceptDispatchIntent(intent)).rejects.toMatchObject({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_INTENT_EXPIRED",
      });

      nowMs = START_MS - 1;
      await expect(gateway.checkHealth()).rejects.toMatchObject({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_CLOCK_INVALID",
      });
    } finally {
      await closeAll(gateway, client);
    }
  });
});

// Compile-time check that a plain transport mutation cannot widen the protocol shape.
function _assertIntentShape(intent: LocalClientDispatchIntent): LocalClientDispatchIntent {
  return intent;
}

void LocalClientExecutionReceiptReconciliationError;
void _assertIntentShape;
