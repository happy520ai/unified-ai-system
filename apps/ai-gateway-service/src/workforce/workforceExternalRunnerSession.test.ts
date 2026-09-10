import { describe, expect, it, vi } from "vitest";
import type { CodexRpcNotification, CodexRpcObject, CodexNativeThreadResult, CodexNativeTurnResult } from "./codexAppServerProtocol.ts";
import { createExternalRunnerSession } from "./workforceExternalRunnerSession.ts";
import { createWorkforceExternalRunnerReview, freezeWorkforceExternalRunnerProfile } from "./workforceExternalRunnerProfile.ts";
import { advanceExternalRunnerState, createExternalRunnerMetadata, createExternalRunnerState } from "./workforceExternalRunnerState.ts";
import type { ExternalRunnerState } from "./workforceExternalRunnerState.ts";
type ApprovalInput = Parameters<Parameters<typeof createExternalRunnerSession>[0]["approveFileChange"]>[0];

const cwd = "E:/Owned Worktree", threadId = "native-thread", turnId = "native-turn";
const running = { id: turnId, status: "inProgress", items: [] };
const patch = { id: "patch-one", type: "fileChange", status: "inProgress", changes: [{ path: "value.mjs", kind: { type: "update", move_path: null }, diff: "private-proposal-text" }] };
function data() {
  const profile = freezeWorkforceExternalRunnerProfile({ version: 1, mode: "codex-app-server-owned-worktree", profileId: "native", projectId: "owned", roleId: "backend-engineer", baselineRevision: "a".repeat(40),
    binary: { path: "E:/Native/codex.exe", sha256: "b".repeat(64), version: "0.153.4", platform: "win32" }, nativeModel: { modelId: "expected-model", providerId: "openai" }, disabledMcpServers: [],
    limits: { timeoutMs: 5000, maxInputBytes: 4096, maxMessageBytes: 8192, maxEvents: 64 }, artifact: { readPaths: ["value.mjs", "value.test.mjs"], writePaths: ["value.mjs"],
      verification: { verificationId: "test", command: "node --test value.test.mjs", immutableTests: [{ path: "value.test.mjs", sha256: "c".repeat(64) }], image: "node@sha256:" + "d".repeat(64),
        workspaceMode: "ro", networkAccess: false, timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 8192, pidsLimit: 32, cpus: 1 }, artifactLimits: { maxChangedFiles: 1, maxFileBytes: 4096, maxDiffBytes: 8192 } } });
  const review = createWorkforceExternalRunnerReview({ profile, configuredRepositoryHash: "sha256:" + "e".repeat(64), goal: "Implement one bounded edit", prompt: "Complete original prompt\nKeep this final line.\n", sourceFilesHash: "f".repeat(64) });
  const metadata = createExternalRunnerMetadata({ review, agentId: "agt_original", planId: "plan-one", planDigest: "1".repeat(64) });
  const initialState = createExternalRunnerState({ executionId: "execution-one", taskId: "task-one", metadata, identity: { tenantId: "tenant", userId: "owner" },
    worktree: { worktreeId: "wt_owned", path: cwd, directoryHash: "sha256:" + "2".repeat(64), baselineRevision: profile.baselineRevision, sourceFilesHash: review.sourceFilesHash } });
  return { metadata, initialState };
}
function fixture(original?: ExternalRunnerState, permissions?: string) {
  const base = data(), records: ExternalRunnerState[] = [], listeners = new Set<(event: CodexRpcNotification) => void>();
  const emit = (method: string, params: CodexRpcObject) => { for (const listener of listeners) listener({ method, params }); };
  const peer = {
    initialize: vi.fn(async () => ({ userAgent: "codex/0.153.4" })),
    startThread: vi.fn(async (_params: CodexRpcObject) => ({ model: "expected-model", modelProvider: "openai", cwd,
      thread: { id: threadId, cwd, modelProvider: "openai", turns: [] } }) as CodexNativeThreadResult),
    startTurn: vi.fn(async (_params: CodexRpcObject) => ({ turn: running }) as CodexNativeTurnResult),
    readThread: vi.fn(async (_id: string) => ({ thread: { id: threadId, cwd, modelProvider: "openai", status: { type: "notLoaded" }, turns: [] } }) as CodexNativeThreadResult),
    interrupt: vi.fn(async (_thread: string, _turn: string) => ({})),
    onNotification: vi.fn((listener: (event: CodexRpcNotification) => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; }),
  };
  const persist = vi.fn(async (state: ExternalRunnerState) => { records.push(state); }), assertActive = vi.fn(async () => {}), approveFileChange = vi.fn(async (_input: ApprovalInput) => true);
  const controller = new AbortController(), initialState = original ?? base.initialState;
  const options = { peer, ...base, initialState, persist, assertActive, approveFileChange, signal: controller.signal,
    threadParams: { cwd, approvalPolicy: "untrusted", approvalsReviewer: "user", config: { "features.shell_tool": false }, ...(permissions ? { permissions } : { sandbox: "workspace-write" }) },
    turnParams: { cwd, approvalPolicy: "untrusted", approvalsReviewer: "user" } };
  const session = createExternalRunnerSession(options);
  return { ...options, session, records, emit, controller };
}
function originalState(withTurn = true): ExternalRunnerState {
  const { metadata, initialState } = data(); let state = initialState;
  for (const patch of [{ status: "starting", processClosed: false }, { status: "thread_ready", threadId }, { status: "dispatching" },
    ...(withTurn ? [{ status: "running" as const, turnId, nativeStatus: "inProgress" as const }] : []),
    { status: "unknown", processClosed: true, error: { code: "NATIVE_LOST", outcomeUnknown: true } }] as const) state = advanceExternalRunnerState(state, metadata, patch);
  return state;
}
function history(state: ExternalRunnerState, prompt: string, status = "completed") {
  return { id: turnId, status, itemsView: "full", error: null, items: [{ id: "message-one", type: "userMessage", clientId: state.clientUserMessageId,
    content: [{ type: "text", text: prompt, text_elements: [] }] }] };
}

describe("one native external runner session", () => {
  it("persists every dispatch boundary before send and handles notifications preceding acknowledgement", async () => {
    const f = fixture();
    f.peer.startTurn.mockImplementation(async params => {
      expect(f.records.at(-1)?.status).toBe("dispatching");
      expect(params.input).toEqual([{ type: "text", text: f.metadata.review.prompt }]); expect(params.clientUserMessageId).toBe(f.initialState.clientUserMessageId);
      f.emit("turn/started", { threadId, turn: running });
      f.emit("item/agentMessage/delta", { threadId, turnId, delta: "private-agent-text" });
      f.emit("turn/completed", { threadId, turn: { ...running, status: "completed", error: null } });
      return { turn: running };
    });
    try {
      const result = await f.session.run();
      expect(result).toMatchObject({ status: "native_completed", nativeStatus: "completed", threadId, turnId, processClosed: false, artifact: null, verification: null });
      expect(f.records.slice(0, 3).map(value => value.status)).toEqual(["starting", "thread_ready", "dispatching"]);
      expect(f.records.every((record, index) => record.sequence === index + 1 && record.previousHash === (index ? f.records[index - 1]!.stateHash : f.initialState.stateHash))).toBe(true);
      expect(JSON.stringify(f.records)).not.toContain("private-agent-text");
      expect(f.peer.startTurn).toHaveBeenCalledOnce(); expect(f.peer.onNotification).toHaveBeenCalledOnce();
      const count = f.records.length; f.session.onClose(new Error("late-close")); f.emit("turn/completed", { threadId, turn: { ...running, status: "completed" } });
      await Promise.resolve(); expect(f.records).toHaveLength(count);
    } finally { f.session.dispose(); }
  });

  it("retains early turn identity on lost acknowledgement and never redispatches", async () => {
    const f = fixture();
    f.peer.startTurn.mockImplementation(async () => { f.emit("turn/started", { threadId, turn: running }); f.session.onClose(new Error("private-native-loss")); throw new Error("private-native-loss"); });
    try {
      const result = await f.session.run(); expect(result).toMatchObject({ status: "unknown", threadId, turnId, error: { outcomeUnknown: true } });
      expect(JSON.stringify(result)).not.toContain("private-native-loss");
      await expect(f.session.run()).rejects.toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_REDISPATCH_FORBIDDEN" });
      expect(f.peer.startTurn).toHaveBeenCalledOnce();
    } finally { f.session.dispose(); }
  });

  it("rejects native metadata and request overrides before dispatch, and stops a conflicting acknowledgement", async () => {
    const f = fixture();
    try {
      for (const params of [{ ...f.threadParams, model: "different" }, { cwd: "E:/other" }, { config: { model_provider: "other" } }]) {
        expect(() => createExternalRunnerSession({ ...f, threadParams: params as CodexRpcObject })).toThrow();
      }
      f.peer.startThread.mockResolvedValue({ model: "different", modelProvider: "openai", cwd, thread: { id: threadId, cwd, modelProvider: "openai", turns: [] } });
      expect((await f.session.run()).status).toBe("failed"); expect(f.peer.startTurn).not.toHaveBeenCalled();
    } finally { f.session.dispose(); }
    const conflict = fixture();
    conflict.peer.startTurn.mockImplementation(async () => { conflict.emit("turn/started", { threadId, turn: running }); return { turn: { ...running, id: "other-turn" } }; });
    try { expect(await conflict.session.run()).toMatchObject({ status: "unknown", turnId }); expect(conflict.peer.interrupt).toHaveBeenCalledOnce(); }
    finally { conflict.session.dispose(); }
  });

  it("requires confirmation of the requested named permissions profile before sending a turn", async () => {
    for (const activePermissionProfile of [undefined, null, { id: "different-profile" }, { id: "uai_test_permission" }]) {
      const f = fixture(undefined, "uai_test_permission");
      f.peer.startThread.mockResolvedValue({ model: "expected-model", modelProvider: "openai", cwd,
        thread: { id: threadId, cwd, modelProvider: "openai", turns: [] }, ...(activePermissionProfile === undefined ? {} : { activePermissionProfile }) });
      f.peer.startTurn.mockImplementation(async () => {
        f.emit("turn/started", { threadId, turn: running }); f.emit("turn/completed", { threadId, turn: { ...running, status: "completed" } }); return { turn: running };
      });
      try {
        const result = await f.session.run();
        if (activePermissionProfile?.id === "uai_test_permission") { expect(result.status).toBe("native_completed"); expect(f.peer.startTurn).toHaveBeenCalledOnce(); }
        else { expect(result.status).toBe("failed"); expect(f.peer.startTurn).not.toHaveBeenCalled(); }
        expect(result.artifact).toBeNull(); expect(result.verification).toBeNull();
      } finally { f.session.dispose(); }
    }
  });

  it.each(["commandExecution", "mcpToolCall"])("marks an unexpected %s item unknown and interrupts the original turn", async type => {
    const f = fixture();
    f.peer.startTurn.mockImplementation(async () => {
      f.emit("turn/started", { threadId, turn: running });
      f.emit("item/started", { threadId, turnId, item: { id: "unsupported-item", type }, startedAtMs: 1000 });
      f.emit("turn/completed", { threadId, turn: { ...running, status: "completed" } }); return { turn: running };
    });
    try {
      expect(await f.session.run()).toMatchObject({ status: "unknown", nativeStatus: "unknown", threadId, turnId, error: { outcomeUnknown: true } });
      expect(f.peer.interrupt).toHaveBeenCalledExactlyOnceWith(threadId, turnId, { timeoutMs: 1000 });
      expect(f.approveFileChange).not.toHaveBeenCalled();
    } finally { f.session.dispose(); }
  });

  it("approves a cached complete original patch once and performs owner checks around the decision", async () => {
    const f = fixture();
    f.peer.startTurn.mockImplementation(async () => {
      f.emit("turn/started", { threadId, turn: running }); f.emit("item/started", { threadId, turnId, item: patch, startedAtMs: 1000 });
      expect(await f.session.onFileChangeApproval({ threadId, turnId, itemId: patch.id, startedAtMs: 1000, grantRoot: null }, 1)).toBe("accept");
      expect(f.approveFileChange).toHaveBeenCalledWith(expect.objectContaining({ item: patch, state: expect.objectContaining({ threadId, turnId, status: "running" }) }));
      expect(Object.isFrozen(f.approveFileChange.mock.calls[0]![0].item)).toBe(true);
      f.emit("item/completed", { threadId, turnId, item: { ...patch, status: "completed" } });
      f.emit("turn/completed", { threadId, turn: { ...running, status: "completed" } }); return { turn: running };
    });
    try { expect((await f.session.run()).status).toBe("native_completed"); expect(f.approveFileChange).toHaveBeenCalledOnce(); expect(JSON.stringify(f.records)).not.toContain("private-proposal-text"); }
    finally { f.session.dispose(); }
  });

  it.each(["missing", "changed", "denied", "duplicate"])("declines %s patch authority and interrupts only the owned turn", async mode => {
    const f = fixture();
    if (mode === "denied") f.approveFileChange.mockResolvedValue(false);
    f.peer.startTurn.mockImplementation(async () => {
      f.emit("turn/started", { threadId, turn: running });
      if (mode !== "missing") f.emit("item/started", { threadId, turnId, item: patch, startedAtMs: 1000 });
      if (mode === "changed") f.emit("item/started", { threadId, turnId, item: { ...patch, changes: [{ ...patch.changes[0]!, diff: "changed-proposal" }] }, startedAtMs: 1000 });
      const request = { threadId, turnId, itemId: patch.id, startedAtMs: 1000 };
      if (mode === "duplicate") expect(await f.session.onFileChangeApproval(request, 1)).toBe("accept");
      expect(await f.session.onFileChangeApproval(request, 2)).toBe("decline"); return { turn: running };
    });
    try { expect((await f.session.run()).status).toBe("unknown"); expect(f.peer.interrupt).toHaveBeenCalledOnce(); expect(f.approveFileChange).toHaveBeenCalledTimes(mode === "duplicate" || mode === "denied" ? 1 : 0); }
    finally { f.session.dispose(); }
  });

  it("responds to cancellation without claiming an unconfirmed interrupt completed", async () => {
    const f = fixture(); f.peer.startTurn.mockImplementation(async () => { f.emit("turn/started", { threadId, turn: running }); return { turn: running }; });
    try {
      const pending = f.session.run(); await vi.waitFor(() => expect(f.records.at(-1)?.status).toBe("running")); f.controller.abort();
      expect(await pending).toMatchObject({ status: "unknown", threadId, turnId });
      expect(f.peer.interrupt).toHaveBeenCalledExactlyOnceWith(threadId, turnId, { timeoutMs: 1000 });
    } finally { f.session.dispose(); }
  });

  it("bounds the original turn deadline and ignores unrelated native IDs", async () => {
    vi.useFakeTimers(); const f = fixture();
    f.peer.startTurn.mockImplementation(async () => {
      f.emit("turn/started", { threadId, turn: running });
      f.emit("turn/completed", { threadId: "unrelated-thread", turn: { ...running, status: "completed" } }); return { turn: running };
    });
    try {
      const pending = f.session.run(); await vi.advanceTimersByTimeAsync(0); await vi.advanceTimersByTimeAsync(5000);
      expect(await pending).toMatchObject({ status: "unknown", threadId, turnId, error: { outcomeUnknown: true } });
      expect(f.peer.interrupt).toHaveBeenCalledOnce(); expect(f.peer.startTurn).toHaveBeenCalledOnce();
    } finally { f.session.dispose(); vi.useRealTimers(); }
  });

  it("reads only the unique original history, including lost-ACK turn recovery, without another start", async () => {
    for (const known of [true, false]) {
      const original = originalState(known), f = fixture(original);
      f.peer.readThread.mockResolvedValue({ thread: { id: threadId, cwd, modelProvider: "openai", status: { type: "notLoaded" }, turns: [history(original, f.metadata.review.prompt)] } });
      try {
        expect(await f.session.readOriginal()).toMatchObject({ status: "native_completed", threadId, turnId, processClosed: true, artifact: null });
        expect(f.peer.readThread).toHaveBeenCalledOnce(); expect(f.peer.startThread).not.toHaveBeenCalled(); expect(f.peer.startTurn).not.toHaveBeenCalled(); expect(f.peer.interrupt).not.toHaveBeenCalled();
      } finally { f.session.dispose(); }
    }
  });

  it.each(["failed", "interrupted"])("reports original native %s without a new turn or raw error text", async status => {
    const original = originalState(), f = fixture(original), turn = { ...history(original, f.metadata.review.prompt, status), error: { message: "private-native-history-error" } };
    f.peer.readThread.mockImplementation(async () => {
      f.emit("turn/completed", { threadId, turn: { ...running, id: "unrelated-turn", status: "completed" } });
      return { thread: { id: threadId, cwd, modelProvider: "openai", status: { type: "notLoaded" }, turns: [turn] } };
    });
    try {
      const result = await f.session.readOriginal(); expect(result).toMatchObject({ status: status === "failed" ? "failed" : "cancelled", nativeStatus: status, threadId, turnId });
      expect(JSON.stringify(result)).not.toContain("private-native-history-error"); expect(f.peer.startTurn).not.toHaveBeenCalled(); expect(f.peer.interrupt).not.toHaveBeenCalled();
    } finally { f.session.dispose(); }
  });

  it("does not substitute an old completed snapshot for a failed original-history check", async () => {
    const initial = originalState(), { metadata } = data();
    const completed = advanceExternalRunnerState(initial, metadata, { status: "native_completed", nativeStatus: "completed", error: null }, { reconcileOriginal: true });
    const f = fixture(completed);
    try {
      expect(await f.session.readOriginal()).toMatchObject({ status: "unknown", nativeStatus: "unknown", threadId, turnId, error: { outcomeUnknown: true } });
      expect(f.peer.startTurn).not.toHaveBeenCalled();
    } finally { f.session.dispose(); }
  });

  it.each(["prompt", "cwd", "ambiguous", "inProgress", "partial", "inputExtras", "unexpectedTool"])("keeps %s history unverified and retains the original IDs", async mode => {
    const original = originalState(), f = fixture(original), turn = history(original, mode === "prompt" ? "wrong" : f.metadata.review.prompt, mode === "inProgress" ? "inProgress" : "completed");
    if (mode === "partial") turn.itemsView = "notLoaded";
    if (mode === "inputExtras") Object.assign(turn.items[0]!.content[0]!, { attachment: "unexpected" });
    if (mode === "unexpectedTool") Object.assign(turn, { items: [...turn.items, { id: "unsupported-item", type: "mcpToolCall" }] });
    f.peer.readThread.mockResolvedValue({ thread: { id: threadId, cwd: mode === "cwd" ? "E:/other" : cwd, modelProvider: "openai", status: { type: "notLoaded" }, turns: mode === "ambiguous" ? [turn, { ...turn, id: "another-turn" }] : [turn] } });
    try { expect(await f.session.readOriginal()).toMatchObject({ status: "unknown", threadId, turnId, artifact: null, verification: null }); expect(f.peer.startTurn).not.toHaveBeenCalled(); }
    finally { f.session.dispose(); }
  });

  it("returns boundedly when persistence stalls and never sends after cancellation", async () => {
    vi.useFakeTimers(); const f = fixture(); let release!: () => void;
    f.persist.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    try {
      const pending = f.session.run().catch(error => error); await vi.advanceTimersByTimeAsync(0); f.controller.abort(); await vi.advanceTimersByTimeAsync(0);
      expect(await pending).toMatchObject({ code: "WORKFORCE_EXTERNAL_RUNNER_CANCELLED", details: { executionId: f.initialState.executionId, threadId: null, turnId: null } });
      f.session.dispose(); release(); await vi.advanceTimersByTimeAsync(0);
      expect(f.peer.startThread).not.toHaveBeenCalled(); expect(f.peer.startTurn).not.toHaveBeenCalled();
    } finally { release?.(); f.session.dispose(); vi.useRealTimers(); }
  });
});
