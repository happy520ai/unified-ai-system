import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it, onTestFinished } from "vitest";
import { createLocalClientWorkcopyEditor, type LocalClientWorkcopyEditorApi } from "../../../agent-console/src/editor/localClientWorkcopyEditor.ts";
import { createLocalClientWorkcopyStore } from "./localClientWorkcopyStore.ts";
import { createLocalClientSqliteExecutionReceiptJournal } from "./localClientExecutionReceiptReconciliation.ts";
import { localClientLoopbackWire as wire } from "./localClientLoopbackAdapter.ts";
import { createLocalClientLoopbackReceiver } from "./localClientLoopbackReceiver.ts";

const probe = new DatabaseSync(":memory:");
const durable = typeof (probe as DatabaseSync & { enableDefensive?: unknown }).enableDefensive === "function";
probe.close();
const durableIt = durable ? it : it.skip;

durableIt("saves through the provider into actual atomic storage and confirms the same receipt", async () => {
  const h = await harness();
  const commit = await h.editor.prepare(h.payload, new AbortController().signal, h.intent);
  expect((await h.store.readDocument()).text).toBe("before");
  await expect(h.provider().writeFile(new Uri(h.operationUri()), Buffer.from("after"))).rejects.toThrow();
  expect(h.calls).toEqual({ open: 0, apply: 0, save: 0 });
  const receipt = await commit();
  expect((await h.store.readDocument()).text).toBe("after");
  expect((await h.store.getStatus(h.intent)).state).toBe("completed");
  expect(Buffer.from(h.provider().readFile(new Uri(h.operationUri()))).toString("utf8")).toBe("after");
  expect(receipt).toEqual(await h.store.getDurableReceipt(h.intent));
  await expect(h.gateway.confirmReceipt(receipt)).resolves.toMatchObject({ confirmed: true });
  expect(h.calls).toEqual({ open: 1, apply: 1, save: 1 });
  const calls = { ...h.calls };
  await expect(commit()).rejects.toThrow();
  expect(h.calls).toEqual(calls);
});

durableIt("recovers persisted commit after a lost editor reply without another editor call", async () => {
  const h = await harness({ loseSaveReply: true });
  const commit = await h.editor.prepare(h.payload, new AbortController().signal, h.intent);
  await expect(commit()).rejects.toThrow();
  expect((await h.store.readDocument()).text).toBe("after");
  const calls = { ...h.calls };
  const query = await h.gateway.createReconciliationQuery(h.identity.executionId);
  const receipt = await h.editor.recoverNativeReceipt(query);
  expect(receipt).not.toBeNull();
  expect(receipt).toEqual(await h.store.getDurableReceipt(h.intent));
  expect(h.calls).toEqual(calls);
});

durableIt("cancels a prepared workcopy without opening or saving a document", async () => {
  const h = await harness();
  const cancellation = new AbortController();
  const commit = await h.editor.prepare(h.payload, cancellation.signal, h.intent);
  cancellation.abort();
  await expect(commit()).rejects.toThrow();
  await h.editor.close();
  expect((await h.store.getStatus(h.intent)).state).toBe("abandoned");
  expect((await h.store.readDocument()).text).toBe("before");
  expect(h.calls).toEqual({ open: 0, apply: 0, save: 0 });
});

durableIt("rejects changed save bytes and arbitrary provider resources", async () => {
  const h = await harness({ alterSave: true });
  const commit = await h.editor.prepare(h.payload, new AbortController().signal, h.intent);
  await expect(commit()).rejects.toThrow();
  expect((await h.store.readDocument()).text).toBe("before");
  expect((await h.store.getStatus(h.intent)).state).not.toBe("completed");
  expect(() => h.provider().readFile(new Uri("file:///unapproved.txt"))).toThrow();
  expect(() => h.provider().delete(new Uri(h.operationUri()))).toThrow();
});

durableIt("reports failed abandonment instead of claiming clean provider shutdown", async () => {
  const h = await harness({ failAbandon: true });
  const cancellation = new AbortController();
  await h.editor.prepare(h.payload, cancellation.signal, h.intent);
  cancellation.abort();
  await expect(h.editor.close()).rejects.toThrow("Workcopy cancellation cleanup failed");
  h.allowCleanupFailure();
  expect((await h.store.readDocument()).text).toBe("before");
});

durableIt.each([false, true])("joins signed HTTP, real workcopy storage and native receipt projection (reply loss: %s)", async (loseSaveReply) => {
  const h = await harness({ loseSaveReply });
  const response = await h.invokeThroughReceiver();
  expect(response.status).toBe(loseSaveReply ? 409 : 200);
  expect((await h.store.readDocument()).text).toBe("after");
  const calls = { ...h.calls };
  const query = await h.gateway.createReconciliationQuery(h.identity.executionId);
  const reconciled = await h.queryReceiver(query);
  expect(reconciled.status).toBe(200);
  const result = await reconciled.json();
  expect(result.state).toBe("completed");
  expect(result.receipt).toEqual(await h.store.getDurableReceipt(h.intent));
  await expect(h.gateway.applyReconciliation(query, result)).resolves.toMatchObject({ resolved: true, retryAllowed: false });
  expect(h.calls).toEqual(calls);
});

type Provider = {
  readFile(uri: Uri): Uint8Array;
  writeFile(uri: Uri, bytes: Uint8Array): Promise<void>;
  delete(uri: Uri): never;
};
class Uri {
  readonly scheme: string;
  readonly fsPath = "";
  constructor(readonly value: string) { this.scheme = value.split(":")[0]!; }
  toString() { return this.value; }
}
class Edit {
  text = "";
  replace(_uri: unknown, _range: unknown, text: string) { this.text = text; }
}
async function harness(options: { loseSaveReply?: boolean; alterSave?: boolean; failAbandon?: boolean } = {}) {
  const root = await mkdtemp(join(tmpdir(), "workcopy-editor-module-"));
  const protocolKey = randomBytes(32);
  const store = createLocalClientWorkcopyStore({
    mode: "create", sqlitePath: join(root, "workcopy.sqlite"), storeId: "editor-module-test",
    resourceId: "workcopy", initialText: "before", storageKey: randomBytes(32), protocolKey,
  });
  const gateway = createLocalClientSqliteExecutionReceiptJournal({
    role: "gateway", hostId: "editor-module-host", sqlitePath: join(root, "gateway.sqlite"),
    integrityKey: randomBytes(32), protocolKey, recoveryEncryptionKey: randomBytes(32),
  });
  const clientJournal = createLocalClientSqliteExecutionReceiptJournal({
    role: "client", hostId: "editor-module-host", sqlitePath: join(root, "client.sqlite"),
    integrityKey: randomBytes(32), protocolKey,
  });
  const payload = JSON.stringify({ version: 1, resourceId: "workcopy", expectedRevision: 0, text: "after" });
  const identity = { executionId: `lc-exec-${randomBytes(32).toString("hex")}`,
    tenantId: "module-tenant", subjectId: "module-operator", clientId: "module-editor",
    capabilityId: "local_application", actionId: "invoke", planFingerprint: "a".repeat(64),
    inputSha256: wire.sha256(wire.canonicalJson({ payload })) };
  await gateway.prepareDispatch(identity);
  const { intent } = await gateway.armDispatch(identity);
  let registered: Provider | null = null;
  let cached: { uri: Uri; isDirty: boolean; version: number; text: string; getText(): string; positionAt(value: number): unknown; save(): Promise<boolean> } | null = null;
  const calls = { open: 0, apply: 0, save: 0 };
  const api = {
    Uri: { parse: (value: string) => new Uri(value) }, Range: class { constructor(_a: unknown, _b: unknown) {} }, WorkspaceEdit: Edit,
    EventEmitter: class { event = () => ({ dispose() {} }); fire(_event: unknown) {} dispose() {} },
    workspace: {
      isTrusted: true, fs: { readFile: async (uri: unknown) => registered!.readFile(uri as Uri) },
      registerFileSystemProvider(_scheme: string, provider: unknown) { registered = provider as Provider; return { dispose() {} }; },
      async openTextDocument(uri: unknown) {
        calls.open++;
        if (cached) return cached;
        cached = { uri: uri as Uri, isDirty: false, version: 1, text: Buffer.from(registered!.readFile(uri as Uri)).toString("utf8"),
          getText() { return this.text; }, positionAt(value: number) { return value; },
          async save() {
            calls.save++;
            await registered!.writeFile(this.uri, Buffer.from(options.alterSave ? "unapproved formatter output" : this.text));
            this.isDirty = false;
            if (options.loseSaveReply) throw new Error("synthetic editor reply loss after provider commit");
            return true;
          } };
        return cached;
      },
      async applyEdit(edit: unknown) { calls.apply++; cached!.text = (edit as Edit).text; cached!.isDirty = true; cached!.version++; return true; },
    },
  };
  let lastUri = "";
  const editor = createLocalClientWorkcopyEditor(api as LocalClientWorkcopyEditorApi, {
    readDocument: () => store.readDocument(),
    prepare: async (intent, payload) => { const operation = await store.prepare(intent, payload); lastUri = operation.uri; return operation; },
    arm: (intent, uri) => store.arm(intent, uri), commit: (intent, uri, bytes) => store.commit(intent, uri, bytes),
    abandon: (intent) => { if (options.failAbandon) throw new Error("synthetic store unavailable"); return store.abandon(intent); },
    getDurableReceipt: (intent) => store.getDurableReceipt(intent),
    getDurableReceiptForQuery: (query) => store.getDurableReceiptForQuery(query),
  });
  let expectedCleanupFailure = false;
  const secret = randomBytes(32);
  const manifestSha256 = "b".repeat(64);
  let receiver: Awaited<ReturnType<typeof createLocalClientLoopbackReceiver>> | null = null;
  async function ensureReceiver() {
    receiver ??= await createLocalClientLoopbackReceiver({
      clientId: identity.clientId, manifestSha256, sharedSecret: secret, journal: clientJournal,
      prepare: editor.prepare, recoverNativeReceipt: editor.recoverNativeReceipt,
    });
    return receiver;
  }
  onTestFinished(async () => {
    await receiver?.close();
    try { await editor.close(); } catch (error) { if (!expectedCleanupFailure) throw error; }
    finally { await store.close(); await clientJournal.close(); await gateway.close(); protocolKey.fill(0); secret.fill(0); await rm(root, { recursive: true, force: true }); }
  });
  return { store, gateway, payload, identity, intent, editor, calls, provider: () => registered!, operationUri: () => lastUri,
    allowCleanupFailure: () => { expectedCleanupFailure = true; },
    async invokeThroughReceiver() {
      const target = await ensureReceiver();
      const challenge = { protocolVersion: "local-client-loopback-challenge-v2" as const,
        nonce: randomBytes(32).toString("base64url"), clientId: identity.clientId, manifestSha256,
        adapterVersion: "2.0.0" as const, issuedAtMs: Date.now(), expiresAtMs: Date.now() + 5_000 };
      const attestation = await fetch(target.endpoint + "/.well-known/unified-ai/local-client/challenge", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...challenge, signature: wire.signChallengeRequest(secret, challenge) }),
      });
      expect(attestation.status).toBe(200);
      const action = { protocolVersion: "local-client-loopback-action-v2" as const, executionId: identity.executionId,
        clientId: identity.clientId, manifestSha256, adapterVersion: "2.0.0" as const, nonce: challenge.nonce,
        capabilityId: "local_application" as const, actionId: "invoke" as const,
        planFingerprint: identity.planFingerprint, inputSha256: identity.inputSha256,
        dispatchIntentSha256: wire.sha256(wire.canonicalJson(intent)), dispatchIntent: intent, input: { payload } };
      return fetch(target.endpoint + "/v1/unified-ai/local-client/actions/invoke", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...action, signature: wire.signAction(secret, action) }),
      });
    },
    async queryReceiver(query: unknown) {
      const target = await ensureReceiver();
      return fetch(target.endpoint + "/v1/unified-ai/local-client/actions/reconcile", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(query),
      });
    } };
}
