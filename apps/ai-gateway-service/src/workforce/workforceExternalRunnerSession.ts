import { posix, win32 } from "node:path";
import type { CodexFileChangeDecision, CodexRpcNotification, CodexRpcObject, createCodexAppServerProtocol } from "./codexAppServerProtocol.ts";
import { CodexAppServerProtocolError } from "./codexAppServerProtocol.ts";
import { externalRunnerError, externalRunnerHash as hash } from "./workforceExternalRunnerProfile.ts";
import { advanceExternalRunnerState, readExternalRunnerMetadata, readExternalRunnerState, readExternalRunnerNativeUsage } from "./workforceExternalRunnerState.ts";
import type { ExternalRunnerMetadata, ExternalRunnerState } from "./workforceExternalRunnerState.ts";

type Peer = Pick<ReturnType<typeof createCodexAppServerProtocol>, "initialize" | "startThread" | "startTurn" | "readThread" | "interrupt" | "onNotification">;
type Patch = Parameters<typeof advanceExternalRunnerState>[2];
type Approval = { request: Readonly<CodexRpcObject>; item: Readonly<CodexRpcObject>; state: ExternalRunnerState };
const object = (value: unknown): value is CodexRpcObject => value !== null && typeof value === "object" && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value);
const terminal = (state: ExternalRunnerState) => ["native_completed", "failed", "cancelled", "unknown"].includes(state.status);
const nativeTerminal = (state: ExternalRunnerState) => ["completed", "failed", "interrupted"].includes(state.nativeStatus);
// These 0.153.4 item variants carry data. Observing them does not attest safe native startup.
const DATA_ITEM_TYPES = new Set(["userMessage", "agentMessage", "plan", "reasoning", "fileChange", "contextCompaction", "enteredReviewMode", "exitedReviewMode"]);
const supportedItem = (value: unknown) => object(value) && typeof value.type === "string" && DATA_ITEM_TYPES.has(value.type);
const OVERRIDES = new Set(["model", "modelid", "modelprovider", "modelproviders", "provider", "providerid", "effort", "reasoningeffort", "modelreasoningeffort",
  "servicetier", "servicetierforturn", "auth", "authmode", "authfile", "apikey", "baseurl", "openaiapikey", "openaiapibase", "preferredauthmethod", "bearertoken", "headers", "env", "profile", "profiles"]);
function snapshot<T>(value: T): T {
  hash(value);
  const copied = JSON.parse(JSON.stringify(value)) as T;
  const freeze = (item: unknown): void => { if (item !== null && typeof item === "object") { Object.values(item).forEach(freeze); Object.freeze(item); } };
  freeze(copied); return copied;
}

/** One original native turn. Process lifetime, native policy and artifact verification belong to the owner. */
export function createExternalRunnerSession(options: {
  peer: Peer; metadata: ExternalRunnerMetadata; initialState: ExternalRunnerState;
  persist(state: ExternalRunnerState): Promise<void>; signal?: AbortSignal; assertActive(): Promise<void>;
  threadParams: CodexRpcObject; turnParams: CodexRpcObject;
  approveFileChange(input: Approval): Promise<boolean | { approved: true; beforeFilesHash: string }>;
  onFileChangeCompleted?(input: { item: Readonly<CodexRpcObject>; state: ExternalRunnerState }): Promise<void | { sourceFilesHash: string }>;
  validateOriginalItems?(items: readonly Readonly<CodexRpcObject>[]): Promise<void>;
  deadlineAt?: number; clock?: () => number;
}) {
  const metadata = readExternalRunnerMetadata(options.metadata), profile = metadata.review.profile;
  let state = readExternalRunnerState(options.initialState, { executionId: options.initialState.executionId, metadata });
  const threadParams = snapshot(options.threadParams), turnParams = snapshot(options.turnParams), clock = options.clock ?? Date.now;
  const pathApi = profile.binary.platform === "win32" ? win32 : posix;
  const pathKey = (value: string) => profile.binary.platform === "win32" ? pathApi.normalize(value).toLowerCase() : pathApi.normalize(value);
  const samePath = (value: unknown) => typeof value === "string" && pathApi.isAbsolute(value) && pathKey(value) === pathKey(state.worktree.path);
  const bad = (code: string, unknown = false) => {
    const error = Object.assign(externalRunnerError(`WORKFORCE_EXTERNAL_RUNNER_${code}`, "The original native runner session did not complete safely."), {
      outcomeUnknown: unknown, details: { operationId: state.operationId, executionId: state.executionId, taskId: state.taskId,
        threadId: state.threadId, turnId: state.turnId },
    });
    Object.defineProperties(error, { state: { value: state }, metadata: { value: metadata } }); return error;
  };
  function validateParams(params: CodexRpcObject) {
    if (!object(params) || !samePath(state.worktree.path)) throw bad("PARAMS_INVALID");
    for (const key of Object.keys(params)) if (OVERRIDES.has(key.replace(/[_-]/gu, "").toLowerCase())) throw bad("OVERRIDE_FORBIDDEN");
    if (Object.hasOwn(params, "cwd") && !samePath(params.cwd)) throw bad("CWD_MISMATCH");
    if (object(params.config)) {
      const check = (value: CodexRpcObject) => {
        for (const [key, item] of Object.entries(value)) {
          if (key.split(".").some(part => OVERRIDES.has(part.replace(/[_-]/gu, "").toLowerCase()))) throw bad("OVERRIDE_FORBIDDEN");
          if (object(item)) check(item);
        }
      };
      check(params.config);
    }
  }
  validateParams(threadParams); validateParams(turnParams);
  if (typeof options.persist !== "function" || typeof options.assertActive !== "function" || typeof options.approveFileChange !== "function"
    || options.signal !== undefined && !(options.signal instanceof AbortSignal)
    || options.deadlineAt !== undefined && !Number.isSafeInteger(options.deadlineAt)) throw bad("OPTIONS_INVALID");
  let used = false, disposed = false, finished = false, stopped = false, stopQueued = false, reading = false, closed = false, dispatched = false, interruptSent = false;
  const mayHaveRun = () => dispatched || state.turnId !== null || ["dispatching", "running", "unknown"].includes(state.status);
  let deadline = Infinity, timer: ReturnType<typeof setTimeout> | undefined, fallback: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<void> = Promise.resolve(), queueFailure: unknown, pendingBytes = 0, reservations = state.eventsObserved;
  let resolveTerminal!: () => void, rejectEmergency!: (error: unknown) => void;
  const completion = new Promise<void>(resolve => { resolveTerminal = resolve; });
  const emergency = new Promise<never>((_resolve, reject) => { rejectEmergency = reject; });
  void emergency.catch(() => {});
  const proposals = new Map<string, { item: Readonly<CodexRpcObject>; hash: string; bytes: number }>(), approvals = new Set<string>();
  let proposalBytes = 0;
  const now = () => { const value = clock(); if (!Number.isSafeInteger(value) || value < 0) throw bad("CLOCK_INVALID", dispatched); return value; };
  const callOptions = () => ({ timeoutMs: Math.max(1, Math.min(120000, deadline - now())), ...(options.signal ? { signal: options.signal } : {}) });
  function check() {
    if (disposed || finished || stopped || closed || options.signal?.aborted || now() >= deadline) throw bad("SESSION_STOPPED", dispatched);
  }
  async function active() { check(); await options.assertActive(); check(); }
  async function change(patch: Patch, reconcileOriginal = false) {
    if (disposed) throw bad("SESSION_DISPOSED", dispatched);
    const next = advanceExternalRunnerState(state, metadata, patch, { reconcileOriginal });
    await options.persist(next); state = next;
  }
  function enqueue(action: () => Promise<void>): Promise<void> {
    const next = queue.then(async () => { if (queueFailure) throw queueFailure; if (!disposed) await action(); });
    queue = next.catch(() => {
      queueFailure = bad("PERSISTENCE_OR_STATE_UNKNOWN", mayHaveRun()); stopped = true;
      interruptOnce(); rejectEmergency(queueFailure);
    });
    return next;
  }
  function interruptOnce() {
    if (!dispatched || !state.threadId || !state.turnId || interruptSent || closed || disposed) return;
    interruptSent = true;
    try { void options.peer.interrupt(state.threadId, state.turnId, { timeoutMs: 1000 }).catch(() => {}); } catch { /* Never repeat interrupt. */ }
  }
  async function stopState(code: string, force = false) {
    if (!force && nativeTerminal(state)) { resolveTerminal(); return; }
    const unknown = dispatched || state.turnId !== null || ["dispatching", "running", "unknown"].includes(state.status);
    await change({ status: unknown ? "unknown" : options.signal?.aborted ? "cancelled" : "failed",
      nativeStatus: unknown ? "unknown" : state.nativeStatus, error: { code: `WORKFORCE_EXTERNAL_RUNNER_${code}`, outcomeUnknown: unknown } });
    resolveTerminal();
  }
  function stop(code: string, force = false) {
    if (disposed || finished || stopQueued) return;
    stopQueued = true;
    stopped = true; interruptOnce();
    void enqueue(() => stopState(code, force || reading)).catch(() => {});
    if (fallback === undefined) fallback = setTimeout(() => rejectEmergency(bad(code, mayHaveRun())), 0);
  }
  async function recordEvent(event: CodexRpcNotification, item: CodexRpcObject | null) {
    if (state.eventsObserved >= profile.limits.maxEvents || !/^[A-Za-z][A-Za-z0-9/_-]{0,127}$/u.test(event.method)) throw bad("EVENT_LIMIT", dispatched);
    const itemId = item?.id ?? null, itemType = item?.type ?? null;
    if (itemId !== null && !id(itemId) || itemType !== null && (typeof itemType !== "string" || !/^[A-Za-z][A-Za-z0-9]{0,79}$/u.test(itemType))) throw bad("EVENT_INVALID", dispatched);
    await change({ eventsObserved: state.eventsObserved + 1, eventsHash: hash([state.eventsHash, hash(event)]),
      lastEvent: { method: event.method, itemId: itemId as string | null, itemType: itemType as string | null } });
  }
  async function bindTurn(turnId: unknown) {
    if (!id(turnId) || state.turnId !== null && state.turnId !== turnId) throw bad("TURN_BINDING_CONFLICT", true);
    if (state.turnId === null) await change({ turnId });
    if (stopped) interruptOnce();
  }
  async function acceptTurn(turn: CodexRpcObject, originalRead = false) {
    await bindTurn(turn.id);
    if (!Array.isArray(turn.items) || !turn.items.every(supportedItem)) throw bad("UNSUPPORTED_NATIVE_ITEM", true);
    const status = turn.status;
    if (!["inProgress", "completed", "failed", "interrupted"].includes(String(status))) throw bad("TURN_STATUS_INVALID", true);
    if (status === "completed") {
      if (turn.error !== undefined && turn.error !== null) throw bad("TURN_STATUS_INVALID", true);
      await change({ status: "native_completed", nativeStatus: "completed", error: null }, originalRead);
      resolveTerminal();
    } else if (status === "failed" || status === "interrupted") {
      await change({ status: status === "failed" ? "failed" : "cancelled", nativeStatus: status,
        error: { code: status === "failed" ? "WORKFORCE_EXTERNAL_RUNNER_NATIVE_FAILED" : "WORKFORCE_EXTERNAL_RUNNER_NATIVE_INTERRUPTED", outcomeUnknown: false } });
      resolveTerminal();
    } else if (originalRead) {
      await change({ status: "unknown", nativeStatus: "inProgress", error: { code: "WORKFORCE_EXTERNAL_RUNNER_ORIGINAL_STILL_RUNNING", outcomeUnknown: true } });
      resolveTerminal();
    } else if (!nativeTerminal(state)) {
      if (stopped || state.status === "unknown") {
        if (state.status !== "unknown") await stopState("SESSION_STOPPED", true);
        resolveTerminal();
      } else await change({ status: "running", nativeStatus: "inProgress" });
    }
  }
  async function event(event: CodexRpcNotification) {
    const params = event.params;
    if (!object(params) || params.threadId !== state.threadId) return;
    const turn = object(params.turn) ? params.turn : null, item = object(params.item) ? params.item : null;
    const eventTurn = turn?.id ?? params.turnId;
    if (eventTurn !== undefined && state.turnId !== null && eventTurn !== state.turnId) throw bad("TURN_BINDING_CONFLICT", true);
    if (event.method === "turn/started" || event.method === "turn/completed") {
      if (!turn || !dispatched) throw bad("TURN_BINDING_CONFLICT", true);
      await recordEvent(event, null); await acceptTurn(turn); return;
    }
    if (stopped || nativeTerminal(state)) return;
    if (eventTurn !== undefined && eventTurn !== state.turnId) return;
    await recordEvent(event, item);
    if (event.method === "thread/tokenUsage/updated" && state.turnId && params.turnId === state.turnId && object(params.tokenUsage)) {
      let usage;
      try { usage = readExternalRunnerNativeUsage({ ...params.tokenUsage, modelContextWindow: params.tokenUsage.modelContextWindow ?? null }, state.turnId); }
      catch { /* Missing or invalid counters never become zero usage or interrupt an independently verifiable task. */ }
      if (usage) await change({ nativeUsage: usage });
    }
    if (["item/started", "item/completed"].includes(event.method) && !supportedItem(item)) throw bad("UNSUPPORTED_NATIVE_ITEM", true);
    if (event.method === "item/started" && item?.type === "fileChange") {
      if (!id(item.id) || !state.turnId || params.turnId !== state.turnId || item.status !== "inProgress" || !Array.isArray(item.changes)
        || item.changes.length < 1 || item.changes.some(change => !object(change) || typeof change.path !== "string" || typeof change.diff !== "string" || !object(change.kind))) throw bad("PATCH_PROPOSAL_INVALID", true);
      const digest = hash(item), previous = proposals.get(item.id), bytes = Buffer.byteLength(JSON.stringify(item));
      if (previous && previous.hash !== digest) throw bad("PATCH_PROPOSAL_CONFLICT", true);
      if (!previous) {
        if (proposals.size >= 16 || proposalBytes + bytes > profile.limits.maxMessageBytes) throw bad("PATCH_PROPOSAL_LIMIT", true);
        proposals.set(item.id, { item: snapshot(item), hash: digest, bytes }); proposalBytes += bytes;
      }
    }
    if (event.method === "item/completed" && item?.type === "fileChange" && id(item.id)) {
      const previous = proposals.get(item.id);
      if (previous && hash(previous.item.changes) !== hash(item.changes)) throw bad("PATCH_PROPOSAL_CONFLICT", true);
      if (approvals.has(item.id)) {
        if (!previous) throw bad("PATCH_PROPOSAL_CONFLICT", true);
        const receipt = await options.onFileChangeCompleted?.({ item: snapshot(item), state });
        if (state.fileApprovals.some(entry => entry.itemId === item.id)) {
          if (!receipt || !/^[a-f0-9]{64}$/u.test(receipt.sourceFilesHash)) throw bad("PATCH_COMPLETION_RECEIPT_REQUIRED", true);
          await change({ fileApprovals: state.fileApprovals.map(entry => entry.itemId === item.id
            ? { ...entry, completedFilesHash: receipt.sourceFilesHash } : entry) });
        }
        approvals.delete(item.id);
      }
      if (previous) { proposalBytes -= previous.bytes; proposals.delete(item.id); }
    }
  }
  const unsubscribe = options.peer.onNotification(notification => {
    if (disposed || finished || reading || !object(notification.params) || !state.threadId || notification.params.threadId !== state.threadId) return;
    if (stopped && notification.method !== "turn/completed" && !(notification.method === "turn/started" && state.turnId === null)) return;
    try {
      const copied = snapshot(notification), bytes = Buffer.byteLength(JSON.stringify(copied));
      if (++reservations > profile.limits.maxEvents || pendingBytes + bytes > profile.limits.maxMessageBytes * 2) { stop("EVENT_LIMIT", true); return; }
      pendingBytes += bytes;
      void enqueue(async () => {
        try { await event(copied); } catch { stopped = true; interruptOnce(); await stopState("EVENT_CONFLICT", true); }
        finally { pendingBytes -= bytes; }
      }).catch(() => {});
    } catch { stop("EVENT_INVALID", true); }
  });
  const onAbort = () => stop("CANCELLED");
  function begin() {
    if (used || disposed) throw bad("SESSION_REUSED", dispatched);
    used = true; deadline = Math.min(options.deadlineAt ?? Infinity, now() + profile.limits.timeoutMs);
    timer = setTimeout(() => stop("TIMEOUT"), Math.max(0, deadline - now()));
    options.signal?.addEventListener("abort", onAbort, { once: true });
    if (options.signal?.aborted) onAbort();
  }
  function finish() { finished = true; unsubscribe(); if (timer !== undefined) clearTimeout(timer); if (fallback !== undefined) clearTimeout(fallback); options.signal?.removeEventListener("abort", onAbort); }
  async function bounded(action: () => Promise<void>): Promise<ExternalRunnerState> {
    try {
      const work = action().catch(async error => { if (!disposed && !queueFailure) {
        stopped = true; interruptOnce();
        const code = error instanceof CodexAppServerProtocolError && error.code === "CODEX_APP_SERVER_FILESYSTEM_POLICY_UNSUPPORTED"
          ? "NATIVE_FILESYSTEM_SUPPORT_REQUIRED" : "NATIVE_OPERATION_FAILED";
        await enqueue(() => stopState(code, reading));
      } });
      await Promise.race([work.then(() => completion), emergency]); await queue;
      if (queueFailure) throw queueFailure; return state;
    } finally { finish(); }
  }
  return Object.freeze({
    async run(): Promise<ExternalRunnerState> {
      if (state.status !== "prepared") throw bad("REDISPATCH_FORBIDDEN", state.turnId !== null);
      begin();
      return bounded(async () => {
        await active(); await enqueue(() => change({ status: "starting", processClosed: false })); await active();
        await options.peer.initialize(callOptions()); await active();
        const result = await options.peer.startThread({ ...threadParams, cwd: state.worktree.path }, callOptions());
        if (!object(result.thread) || !id(result.thread.id) || !samePath(result.cwd) || !samePath(result.thread.cwd)
          || result.model !== profile.nativeModel.modelId || result.modelProvider !== profile.nativeModel.providerId
          || result.thread.modelProvider !== profile.nativeModel.providerId) throw bad("NATIVE_METADATA_MISMATCH");
        if (Object.hasOwn(threadParams, "permissions") && (!id(threadParams.permissions)
          || !object(result.activePermissionProfile) || result.activePermissionProfile.id !== threadParams.permissions)) throw bad("NATIVE_PERMISSIONS_MISMATCH");
        await enqueue(() => change({ status: "thread_ready", threadId: result.thread.id })); await active();
        const input = [{ type: "text", text: metadata.review.prompt }];
        if (turnParams.input !== undefined && hash(turnParams.input) !== hash(input)
          || turnParams.threadId !== undefined && turnParams.threadId !== state.threadId
          || turnParams.clientUserMessageId !== undefined && turnParams.clientUserMessageId !== state.clientUserMessageId) throw bad("TURN_INPUT_MISMATCH");
        await enqueue(() => change({ status: "dispatching" })); await active();
        dispatched = true;
        const resultTurn = await options.peer.startTurn({ ...turnParams, threadId: state.threadId!, input,
          cwd: state.worktree.path, clientUserMessageId: state.clientUserMessageId }, callOptions());
        await enqueue(async () => { try { await acceptTurn(resultTurn.turn); } catch { stopped = true; interruptOnce(); await stopState("TURN_BINDING_CONFLICT", true); } });
      });
    },
    async readOriginal(): Promise<ExternalRunnerState> {
      if (!state.threadId || ["prepared", "starting", "thread_ready", "verified"].includes(state.status)) throw bad("ORIGINAL_THREAD_REQUIRED", true);
      reading = true;
      begin();
      return bounded(async () => {
        await active(); await options.peer.initialize(callOptions()); await active();
        const result = await options.peer.readThread(state.threadId!, callOptions()); await active();
        const thread = result.thread;
        if (!object(thread) || thread.id !== state.threadId || !samePath(thread.cwd) || thread.modelProvider !== profile.nativeModel.providerId || !Array.isArray(thread.turns)) throw bad("ORIGINAL_HISTORY_MISMATCH", true);
        const matchesInput = (turn: CodexRpcObject) => {
          if (turn.itemsView !== undefined && turn.itemsView !== "full" || !Array.isArray(turn.items)) return false;
          const users = turn.items.filter(item => object(item) && item.type === "userMessage");
          if (users.length !== 1 || !object(users[0])) return false;
          const user = users[0];
          return (user.clientId === undefined || user.clientId === null || user.clientId === state.clientUserMessageId)
            && Array.isArray(user.content) && user.content.length === 1 && object(user.content[0])
            && Object.keys(user.content[0]).every(key => ["type", "text", "text_elements"].includes(key))
            && (user.content[0].text_elements === undefined || Array.isArray(user.content[0].text_elements) && user.content[0].text_elements.length === 0)
            && user.content[0].type === "text" && user.content[0].text === metadata.review.prompt;
        };
        if (!thread.turns.every(value => object(value) && id(value.id)) || new Set(thread.turns.map(value => (value as CodexRpcObject).id)).size !== thread.turns.length) throw bad("ORIGINAL_HISTORY_AMBIGUOUS", true);
        const turns = thread.turns.filter(object), matching = turns.filter(matchesInput);
        const original = state.turnId ? turns.filter(turn => turn.id === state.turnId) : matching;
        if (original.length !== 1 || matching.length !== 1 || original[0] !== matching[0] || !id(original[0]!.id)) throw bad("ORIGINAL_HISTORY_AMBIGUOUS", true);
        if (!Array.isArray(original[0]!.items) || !original[0]!.items.every(supportedItem)) throw bad("UNSUPPORTED_NATIVE_ITEM", true);
        await enqueue(async () => {
          await bindTurn(original[0]!.id);
          await options.validateOriginalItems?.(snapshot((original[0]!.items as CodexRpcObject[])));
          await recordEvent({ method: "thread/read", params: { threadId: state.threadId, turnId: state.turnId, status: original[0]!.status } }, null);
          if (!object(thread.status) || !["idle", "notLoaded"].includes(String(thread.status.type))) {
            await change({ status: "unknown", nativeStatus: "unknown", error: { code: "WORKFORCE_EXTERNAL_RUNNER_ORIGINAL_NOT_TERMINAL", outcomeUnknown: true } }); resolveTerminal();
          } else await acceptTurn(original[0]!, true);
        });
      });
    },
    async onFileChangeApproval(request: Readonly<CodexRpcObject>, _rpcId: string | number): Promise<CodexFileChangeDecision> {
      try {
        const copied = snapshot(request); await queue;
        const entry = id(copied.itemId) ? proposals.get(copied.itemId) : undefined;
        if (!entry || stopped || closed || !dispatched || state.status !== "running" || copied.threadId !== state.threadId
          || copied.turnId !== state.turnId || copied.grantRoot !== undefined && copied.grantRoot !== null || approvals.has(copied.itemId as string)) throw bad("PATCH_APPROVAL_INVALID", true);
        if (state.fileApprovals.some(item => item.itemId === copied.itemId || item.completedFilesHash === null)) throw bad("PATCH_APPROVAL_INVALID", true);
        approvals.add(copied.itemId as string); await active();
        const approved = await options.approveFileChange({ request: copied, item: entry.item, state });
        await queue; await active();
        if (approved !== true && (!approved || approved.approved !== true) || state.status !== "running"
          || proposals.get(copied.itemId as string)?.hash !== entry.hash) throw bad("PATCH_APPROVAL_DENIED", true);
        if (approved !== true) {
          if (!/^[a-f0-9]{64}$/u.test(approved.beforeFilesHash)) throw bad("PATCH_APPROVAL_RECEIPT_REQUIRED", true);
          await enqueue(() => change({ fileApprovals: [...state.fileApprovals, { itemId: copied.itemId as string,
            changesHash: hash(entry.item.changes), beforeFilesHash: approved.beforeFilesHash, completedFilesHash: null }] }));
          await active();
        }
        return "accept";
      } catch { stop("PATCH_APPROVAL_DENIED"); return "decline"; }
    },
    onClose(_error: unknown) { if (!disposed) { closed = true; stop("NATIVE_CONNECTION_CLOSED"); } },
    dispose() { disposed = true; finish(); unsubscribe(); proposals.clear(); approvals.clear(); rejectEmergency(bad("SESSION_DISPOSED", dispatched)); },
  });
}
