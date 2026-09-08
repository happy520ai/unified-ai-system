import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it, onTestFinished, vi } from "vitest";
import { createLocalClientLoopbackReceiver, type LocalClientLoopbackReceiverOptions } from "./localClientLoopbackReceiver.ts";
import { createLocalClientSqliteExecutionReceiptJournal } from "./localClientExecutionReceiptReconciliation.ts";
import { localClientLoopbackWire as wire, type LocalClientLoopbackActionRequest } from "./localClientLoopbackAdapter.ts";
import { createLocalClientDurableExecutionReceipt } from "../../../../packages/shared-sdk/src/index.js";

const sqlite = new DatabaseSync(":memory:");
const supported = typeof (sqlite as DatabaseSync & { enableDefensive?: unknown }).enableDefensive === "function";
sqlite.close();
const durableIt = supported ? it : it.skip;

durableIt("executes once, signs a real durable receipt, and replays it after client restart", async () => {
  const prepare = vi.fn(async () => async () => {});
  const h = await harness(prepare);
  const request = await h.request();
  const first = await h.post(request);
  expect(first.status).toBe(200);
  const receipt = await first.json();
  expect(wire.safeSignatureEqual(receipt.signature, wire.signReceipt(h.secret, receipt))).toBe(true);
  await h.gateway.confirmReceipt(receipt.durableReceipt);
  await h.restart();
  const second = await h.post(await h.request(request.dispatchIntent));
  expect(second.status).toBe(200);
  expect((await second.json()).durableReceipt).toEqual(receipt.durableReceipt);
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(h.client.status.clientAtomicEffectReceiptVerified).toBe(false);
  expect(h.client.status.databaseSnapshotRollbackProtected).toBe(false);
});

durableIt("does not claim an effect when preparation is cancelled by HTTP disconnect", async () => {
  let entered = false;
  const h = await harness(async (_payload, signal) => {
    entered = true;
    await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
    return async () => { throw new Error("must not commit"); };
  });
  const request = await h.request();
  const cancellation = new AbortController();
  const pending = h.post(request, cancellation.signal).catch(() => null);
  await vi.waitFor(() => expect(entered).toBe(true));
  cancellation.abort();
  await pending;
  await vi.waitFor(async () => {
    const query = await h.gateway.createReconciliationQuery(h.identity.executionId);
    expect((await h.client.reconcile(query)).state).toBe("failed-before-effect");
  });
});

durableIt("revokes pending preparation and denies subsequent fresh requests", async () => {
  let entered = false;
  let release!: () => void;
  const commit = vi.fn(async () => {});
  const h = await harness(async () => {
    entered = true;
    await new Promise<void>((resolve) => { release = resolve; });
    return commit;
  });
  const pending = h.post(await h.request());
  await vi.waitFor(() => expect(entered).toBe(true));
  h.receiver.revoke(); release();
  expect((await pending).status).toBe(409);
  expect(commit).not.toHaveBeenCalled();
  expect((await h.challenge()).status).toBe(409);
});

durableIt("keeps a failed effect unknown and never reexecutes it", async () => {
  const commit = vi.fn(async () => { throw new Error("save failed after edit"); });
  const h = await harness(async () => commit);
  const request = await h.request();
  expect((await h.post(request)).status).toBe(409);
  await h.restart();
  expect((await h.post(await h.request(request.dispatchIntent))).status).toBe(409);
  expect(commit).toHaveBeenCalledTimes(1);
  const query = await h.gateway.createReconciliationQuery(h.identity.executionId);
  expect((await h.client.reconcile(query)).state).toBe("pending");
});

durableIt("rejects a concurrent duplicate before it can poison the accepted owner's preparation", async () => {
  let entered = false;
  let release!: () => void;
  const prepare = vi.fn(async () => {
    if (entered) throw new Error("duplicate preparation failed");
    entered = true;
    await new Promise<void>((resolve) => { release = resolve; });
    return async () => {};
  });
  const h = await harness(prepare);
  const request = await h.request();
  const owner = h.post(request);
  await vi.waitFor(() => expect(entered).toBe(true));
  let duplicate: Response;
  try { duplicate = await h.post(await h.request(request.dispatchIntent)); }
  finally { release(); }
  expect(duplicate.status).toBe(409);
  expect((await owner).status).toBe(200);
  expect(prepare).toHaveBeenCalledTimes(1);
});

durableIt("drains an already started effect and persists its receipt before close resolves", async () => {
  let entered = false;
  let release!: () => void;
  const h = await harness(async () => async () => {
    entered = true;
    await new Promise<void>((resolve) => { release = resolve; });
  });
  const request = await h.request();
  const response = h.post(request).catch(() => null);
  await vi.waitFor(() => expect(entered).toBe(true));
  let closed = false;
  const closing = h.receiver.close().then(() => { closed = true; });
  await response; // closeAllConnections has actually interrupted the response.
  await new Promise<void>((resolve) => setImmediate(resolve));
  const closedBeforeEffectFinished = closed;
  release();
  await closing;
  expect(closedBeforeEffectFinished).toBe(false);
  const query = await h.gateway.createReconciliationQuery(h.identity.executionId);
  expect((await h.client.reconcile(query)).state).toBe("completed");
  await expect(h.receiver.close()).resolves.toBeUndefined();
});

durableIt("projects the exact native receipt returned by a completed action", async () => {
  let nativeReceipt;
  const h = await harness(async (_payload, _signal, intent) => async () => {
    nativeReceipt = await h.nativeReceipt(intent);
    return nativeReceipt;
  });
  const response = await h.post(await h.request());
  expect(response.status).toBe(200);
  expect((await response.json()).durableReceipt).toEqual(nativeReceipt);
});

durableIt("aborts unconsumed preparation when the durable effect claim rejects", async () => {
  let abandoned = false;
  const commit = vi.fn(async () => {});
  const h = await harness(async (_payload, signal) => {
    signal.addEventListener("abort", () => { abandoned = true; }, { once: true });
    h.expireClientClock();
    return commit;
  });
  expect((await h.post(await h.request())).status).toBe(409);
  expect(abandoned).toBe(true);
  expect(commit).not.toHaveBeenCalled();
});

durableIt("recovers a native commit after response loss without preparing or executing it again", async () => {
  let nativeReceipt: Awaited<ReturnType<typeof createLocalClientDurableExecutionReceipt>> | null = null;
  const recoverNativeReceipt = vi.fn(async () => nativeReceipt);
  const prepare = vi.fn(async (_payload: string, _signal: AbortSignal, intent: LocalClientLoopbackActionRequest["dispatchIntent"]) => async () => {
    nativeReceipt = await h.nativeReceipt(intent);
    throw new Error("native committed response was lost");
  });
  const h = await harness(prepare, { recoverNativeReceipt });
  expect((await h.post(await h.request())).status).toBe(409);
  const query = await h.gateway.createReconciliationQuery(h.identity.executionId);
  const tampered = await h.reconcile({ ...query, signature: "0".repeat(64) });
  expect(tampered.status).toBe(409);
  expect(recoverNativeReceipt).not.toHaveBeenCalled();
  h.receiver.revoke(); // Revoke blocks new actions while allowing receipt-only recovery.
  const response = await h.reconcile(query);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ state: "completed", receipt: nativeReceipt, retryAllowed: false });
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(recoverNativeReceipt).toHaveBeenCalledTimes(1);
});

durableIt("rejects another execution's valid native receipt before changing either journal row", async () => {
  let otherReceipt: Awaited<ReturnType<typeof createLocalClientDurableExecutionReceipt>>;
  const h = await harness(async () => async () => otherReceipt);
  const other = { ...h.identity, executionId: `lc-exec-${randomBytes(32).toString("hex")}` };
  await h.gateway.prepareDispatch(other);
  const { intent } = await h.gateway.armDispatch(other);
  await h.client.acceptDispatchIntent(intent); await h.client.claimEffect(intent);
  otherReceipt = await h.nativeReceipt(intent);
  expect((await h.post(await h.request())).status).toBe(409);
  const query = await h.gateway.createReconciliationQuery(other.executionId);
  expect((await h.client.reconcile(query)).state).toBe("pending");
});

durableIt.each(["signature", "input", "intent-hash", "extra-field", "origin", "nonce-replay"])(
  "rejects %s without an unintended effect", async (caseName) => {
    const commit = vi.fn(async () => {});
    const h = await harness(async () => commit);
    const request = await h.request();
    if (caseName === "signature") request.signature = "0".repeat(64);
    if (caseName === "input") request.input = { payload: "tampered" };
    if (caseName === "intent-hash") request.dispatchIntentSha256 = "0".repeat(64);
    if (caseName === "extra-field") Object.assign(request, { command: "unexpected" });
    if (caseName === "nonce-replay") expect((await h.post(request)).status).toBe(200);
    expect((await h.post(request, undefined, caseName === "origin" ? { origin: "https://untrusted.example" } : {})).status).toBe(409);
    expect(commit).toHaveBeenCalledTimes(caseName === "nonce-replay" ? 1 : 0);
  },
);

async function harness(
  prepare: LocalClientLoopbackReceiverOptions["prepare"],
  receiverOptions: Pick<LocalClientLoopbackReceiverOptions, "recoverNativeReceipt"> = {},
) {
  const root = await mkdtemp(join(tmpdir(), "local-client-receiver-test-"));
  const secret = randomBytes(32), protocolKey = randomBytes(32), integrityKey = randomBytes(32);
  const gateway = createLocalClientSqliteExecutionReceiptJournal({
    role: "gateway", hostId: "test-host", sqlitePath: join(root, "gateway.sqlite"),
    protocolKey, integrityKey: randomBytes(32), recoveryEncryptionKey: randomBytes(32),
  });
  let clientNow: number | null = null;
  const clientOptions = { role: "client" as const, hostId: "test-host", sqlitePath: join(root, "client.sqlite"), protocolKey, integrityKey,
    now: () => clientNow ?? Date.now() };
  let client = createLocalClientSqliteExecutionReceiptJournal(clientOptions);
  const clientId = "editor-test", manifestSha256 = "a".repeat(64), payload = "unit-test-action";
  const identity = { executionId: `lc-exec-${randomBytes(32).toString("hex")}`, tenantId: "test-tenant",
    subjectId: "test-subject", clientId, capabilityId: "local_application", actionId: "invoke",
    planFingerprint: "b".repeat(64), inputSha256: wire.sha256(wire.canonicalJson({ payload })) };
  let receiver = await createLocalClientLoopbackReceiver({ clientId, manifestSha256, sharedSecret: secret, journal: client, prepare, ...receiverOptions });
  onTestFinished(async () => {
    await receiver.close(); await client.close(); await gateway.close();
    secret.fill(0); protocolKey.fill(0); integrityKey.fill(0);
    await rm(root, { recursive: true, force: true });
  });
  return {
    get client() { return client; }, get receiver() { return receiver; }, gateway, secret, identity,
    expireClientClock() { clientNow = Date.now() + 600_000; },
    async restart() {
      await receiver.close(); await client.close();
      client = createLocalClientSqliteExecutionReceiptJournal(clientOptions);
      receiver = await createLocalClientLoopbackReceiver({ clientId, manifestSha256, sharedSecret: secret, journal: client, prepare, ...receiverOptions });
    },
    challenge,
    nativeReceipt(intent: LocalClientLoopbackActionRequest["dispatchIntent"]) {
      return createLocalClientDurableExecutionReceipt({ protocolKey, intent, completedAtMs: Date.now(), nowMs: Date.now() });
    },
    reconcile(query: unknown) {
      return fetch(`${receiver.endpoint}/v1/unified-ai/local-client/actions/reconcile`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(query),
      });
    },
    async request(existing?: LocalClientLoopbackActionRequest["dispatchIntent"]) {
      const response = await challenge();
      expect(response.status).toBe(200);
      const { nonce } = await response.json();
      await gateway.prepareDispatch(identity);
      const intent = existing ?? (await gateway.armDispatch(identity)).intent;
      const request = { protocolVersion: "local-client-loopback-action-v2" as const,
        executionId: identity.executionId, clientId, manifestSha256, adapterVersion: "2.0.0" as const,
        nonce, capabilityId: "local_application" as const, actionId: "invoke" as const,
        planFingerprint: identity.planFingerprint, inputSha256: identity.inputSha256,
        dispatchIntentSha256: wire.sha256(wire.canonicalJson(intent)), dispatchIntent: intent,
        input: { payload }, signature: "" };
      request.signature = wire.signAction(secret, request);
      return request;
    },
    post(body: unknown, signal?: AbortSignal, headers: Record<string, string> = {}) {
      return fetch(`${receiver.endpoint}/v1/unified-ai/local-client/actions/invoke`, {
        method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body), signal,
      });
    },
  };
  function challenge() {
    const body = { protocolVersion: "local-client-loopback-challenge-v2" as const,
      nonce: randomBytes(32).toString("base64url"), clientId, manifestSha256, adapterVersion: "2.0.0" as const,
      issuedAtMs: Date.now(), expiresAtMs: Date.now() + 5_000, signature: "" };
    body.signature = wire.signChallengeRequest(secret, body);
    return fetch(`${receiver.endpoint}/.well-known/unified-ai/local-client/challenge`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
  }
}
