import type {
  verifyLocalClientDispatchIntent, createLocalClientDurableExecutionReceipt,
  verifyLocalClientReceiptReconciliationQuery,
} from "@unified-ai-system/shared-sdk";
import type { LocalClientEditorApi } from "./localClientEditorAction.ts";

type LocalClientDispatchIntent = Awaited<ReturnType<typeof verifyLocalClientDispatchIntent>>;
type LocalClientDurableExecutionReceipt = Awaited<ReturnType<typeof createLocalClientDurableExecutionReceipt>>;
type LocalClientReceiptReconciliationQuery = Awaited<ReturnType<typeof verifyLocalClientReceiptReconciliationQuery>>;

type Awaitable<T> = T | PromiseLike<T>;
type WorkcopyUri = { scheme: string; fsPath: string; toString(): string };
type FileEvent = { type: number; uri: WorkcopyUri };
type Disposable = { dispose(): void };

export interface LocalClientWorkcopyStorePort {
  readDocument(): Awaitable<{ resourceId: string; revision: number; text: string }>;
  prepare(intent: LocalClientDispatchIntent, payload: string): Awaitable<{ uri: string; executionId: string; sessionEpoch: number }>;
  arm(intent: LocalClientDispatchIntent, uri: string): Awaitable<unknown>;
  commit(intent: LocalClientDispatchIntent, uri: string, bytes: Uint8Array): Awaitable<{
    state: "completed"; revision: number; completedAtMs: number;
  }>;
  abandon(intent: LocalClientDispatchIntent): Awaitable<unknown>;
  getDurableReceipt(intent: LocalClientDispatchIntent): Promise<LocalClientDurableExecutionReceipt>;
  getDurableReceiptForQuery(query: LocalClientReceiptReconciliationQuery): Promise<LocalClientDurableExecutionReceipt | null>;
}

export interface LocalClientWorkcopyEditorApi extends Omit<LocalClientEditorApi, "Uri" | "workspace"> {
  readonly Uri: { parse(value: string): WorkcopyUri };
  readonly EventEmitter: new <T>() => { event: unknown; fire(event: T): void; dispose(): void };
  readonly workspace: LocalClientEditorApi["workspace"] & {
    registerFileSystemProvider(scheme: string, provider: unknown, options: { isCaseSensitive: true }): Disposable;
  };
}

type Binding = {
  intent: LocalClientDispatchIntent;
  uri: WorkcopyUri;
  bytes: Uint8Array;
  armed: boolean;
  used: boolean;
  committed: boolean;
  signal: AbortSignal;
  detach: () => void;
};

/** Actual editor FileSystemProvider for one store-owned workcopy. Only persistent
 * workcopy content/receipt commit is atomic; editor buffers and extension events
 * are outside that transaction. Ordinary file:// saving remains a separate API. */
export function createLocalClientWorkcopyEditor(
  editor: LocalClientWorkcopyEditorApi,
  store: LocalClientWorkcopyStorePort,
) {
  const bindings = new Map<string, Binding>();
  const stopped = new AbortController();
  const events = new editor.EventEmitter<FileEvent[]>();
  const cleanups = new Set<Promise<void>>();
  const cleanupErrors: unknown[] = [];
  let closed = false;
  const registration = editor.workspace.registerFileSystemProvider("uai-workcopy", {
    onDidChangeFile: events.event,
    watch(uri: WorkcopyUri) { resolveBinding(uri); return { dispose() {} }; },
    stat(uri: WorkcopyUri) {
      const binding = resolveBinding(uri);
      return { type: 1, ctime: 0, mtime: 0, size: binding.bytes.byteLength,
        ...(binding.used ? { permissions: 1 } : {}) };
    },
    readFile(uri: WorkcopyUri) { return Uint8Array.from(resolveBinding(uri).bytes); },
    async writeFile(uri: WorkcopyUri, bytes: Uint8Array) {
      const binding = resolveBinding(uri);
      if (!binding.armed || binding.used || binding.signal.aborted) fail();
      binding.used = true; // A provider callback cannot be run a second time.
      const result = await store.commit(binding.intent, uri.toString(), Uint8Array.from(bytes));
      if (result.state !== "completed") fail();
      binding.committed = true;
      binding.bytes = Uint8Array.from(bytes);
      if (!closed) events.fire([{ type: 1, uri }]);
    },
    readDirectory: fail, createDirectory: fail, delete: fail, rename: fail,
  }, { isCaseSensitive: true });

  return Object.freeze({
    async prepare(payload: string, signal: AbortSignal, intent: LocalClientDispatchIntent) {
      if (closed || !editor.workspace.isTrusted || signal.aborted) fail();
      const document = await store.readDocument();
      const operation = await store.prepare(intent, payload);
      const uri = editor.Uri.parse(operation.uri);
      if (uri.scheme !== "uai-workcopy" || uri.toString() !== operation.uri
        || operation.executionId !== intent.executionId || bindings.has(operation.uri)) fail();
      const combined = AbortSignal.any([signal, stopped.signal]);
      const binding: Binding = { intent, uri, bytes: Buffer.from(document.text, "utf8"),
        armed: false, used: false, committed: false, signal: combined, detach: () => {} };
      const abort = () => {
        bindings.delete(operation.uri);
        // Retain persistence failures for close(); never reopen the URI or
        // claim that cancellation cleanup succeeded merely because it hid.
        const cleanup = Promise.resolve().then(() => store.abandon(intent)).then(
          () => undefined,
          error => { binding.used = true; cleanupErrors.push(error); },
        );
        cleanups.add(cleanup);
        void cleanup.then(() => cleanups.delete(cleanup));
      };
      combined.addEventListener("abort", abort, { once: true });
      binding.detach = () => combined.removeEventListener("abort", abort);
      bindings.set(operation.uri, binding);
      if (combined.aborted) { abort(); fail(); }
      let commitCalled = false;
      return async () => {
        if (commitCalled) fail();
        commitCalled = true;
        try {
          if (closed || combined.aborted || !editor.workspace.isTrusted) fail();
          await store.arm(intent, operation.uri);
          if (closed || combined.aborted) fail();
          binding.armed = true;
          const nativeDocument = await editor.workspace.openTextDocument(uri);
          const before = Buffer.from(binding.bytes).toString("utf8");
          const parsed = JSON.parse(payload);
          if (nativeDocument.uri.toString() !== operation.uri || nativeDocument.isDirty
            || nativeDocument.getText() !== before || closed || combined.aborted) fail();
          const edit = new editor.WorkspaceEdit();
          edit.replace(uri, new editor.Range(nativeDocument.positionAt(0), nativeDocument.positionAt(before.length)), parsed.text);
          if (!await editor.workspace.applyEdit(edit) || nativeDocument.getText() !== parsed.text
            || !await nativeDocument.save() || nativeDocument.isDirty) fail();
          return await store.getDurableReceipt(intent);
        } finally {
          binding.detach();
          // A successfully saved document stays readable. Only its one-shot
          // write authority is consumed; later stat/readback must still work.
          if (!binding.committed) bindings.delete(operation.uri);
        }
      };
    },
    // This path never opens a document, calls applyEdit, or invokes save.
    recoverNativeReceipt(query: LocalClientReceiptReconciliationQuery) {
      return store.getDurableReceiptForQuery(query);
    },
    dispose,
    /** Drain the receiver first, then close this provider before its store. */
    async close() {
      dispose();
      while (cleanups.size) await Promise.all(cleanups);
      if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "Workcopy cancellation cleanup failed.");
    },
  });

  function dispose() {
    if (closed) return;
    closed = true; stopped.abort();
    for (const binding of bindings.values()) binding.detach();
    bindings.clear(); registration.dispose(); events.dispose();
  }

  function resolveBinding(uri: WorkcopyUri): Binding {
    if (closed || uri.scheme !== "uai-workcopy") fail();
    const binding = bindings.get(uri.toString());
    if (!binding || (!binding.committed && binding.signal.aborted)) fail();
    return binding;
  }
}
function fail(): never { throw new Error("LOCAL_CLIENT_WORKCOPY_EDITOR_REJECTED"); }
