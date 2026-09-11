import { access, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it, vi, type TestContext } from "vitest";
import { createAgenticLoop } from "./agenticCodingLoop.js";
import { createAgenticCheckpoint, readAgenticCheckpoint } from "./agenticCheckpoint.ts";

const goal = "Deliver the owned verified change";
const usage = { inputTokens: 2, outputTokens: 3, totalTokens: 5 };
const answer = (text = "Verified result") => ({ text, usage });
const action = (id: string, value: string) => ({ text: "", usage, toolCalls: [{ id, name: "fixture_write", arguments: { value } }] });

async function fixture(context: TestContext) {
  const base = await realpath(tmpdir()), creating = mkdtemp(join(base, "agentic-hooks-"));
  const controller = new AbortController(), pending = new Set<Promise<unknown>>(), releases: Array<() => void> = [];
  context.onTestFinished(async () => {
    controller.abort(); for (const release of releases) release();
    const root = await creating; while (pending.size) await Promise.allSettled([...pending]);
    expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(base);
    expect(root.startsWith(join(base, "agentic-hooks-"))).toBe(true); await rm(root, { recursive: true, force: false });
  });
  const root = await creating, artifact = join(root, "result.txt"), snapshots: any[] = [], events: string[] = [];
  let retained: any = null, resume = false;
  const provider = vi.fn(async (_request: any): Promise<any> => answer());
  const executeTool = vi.fn(async (_name: string, args: any) => { await writeFile(artifact, args.value); return { status: "success", value: args.value }; });
  const tools = [{ name: "fixture_write", description: "Write the owned test artifact", inputSchema: { type: "object", properties: { value: { type: "string" } } } }];
  const registry = { listTools: () => tools, executeTool, getHealth: () => ({ governanceRequired: true, governanceToolProxyConfigured: true }) };
  const save = vi.fn(async (state: any, phase: string, inFlight: any, binding: any) => {
    events.push("save:" + phase + ":" + (state.pendingHook ?? "none"));
    retained = structuredClone({ kind: "agentic-loop-checkpoint", version: 1, binding, state, phase, inFlight: inFlight ?? null, savedAt: new Date().toISOString() });
    snapshots.push(retained);
  });
  const close = vi.fn(async () => { events.push("close"); });
  const factory = vi.fn(async (binding: any, _identity: any) => ({ restored: resume ? retained : null,
    save: (state: any, phase: string, intent: any) => save(state, phase, intent, binding), close }));
  const run = (options: any = {}, input: any = {}) => {
    const result = createAgenticLoop({ workingDirectory: root, memoryDir: join(root, "memory"), sessionStoreDir: join(root, "sessions"),
      providerAdapter: { generate: provider }, toolRegistry: registry, systemPrompt: "Exact server system", maxIterations: 4,
      promptOptimizeEnabled: false, partialPreviewEnabled: false, checkpointSessionFactory: factory, ...options }).execute({
      goal, providerId: "fixture", modelId: "fixture-model", toolAllowlist: ["fixture_write"], ...input,
      signal: AbortSignal.any([context.signal, controller.signal, ...(input.signal ? [input.signal] : [])]) });
    pending.add(result); void result.then(() => pending.delete(result), () => pending.delete(result)); return result;
  };
  return { root, artifact, provider, executeTool, save, close, factory, run, snapshots, events,
    resume: () => { resume = true; }, readRetained: () => structuredClone(retained),
    onCleanup: (release: () => void) => releases.push(release) };
}

describe("server-owned Agentic Loop continuation hooks", () => {
  it("preserves a frozen tool result larger than 50KB as complete paired JSON", async context => {
    const f = await fixture(context), large = { blob: "x".repeat(60_000), tail: "complete" };
    f.provider.mockResolvedValueOnce(action("large-result", "unused")); f.executeTool.mockResolvedValueOnce(large as any);
    const result = await f.run({ frozenContext: true });
    const tool = result.messages.find((message: any) => message.role === "tool");
    expect(JSON.parse(tool.content)).toEqual(large);
    expect(f.readRetained().state.messages.find((message: any) => message.role === "tool")).toEqual(tool);
  });

  it("uses exact frozen system and input messages without automatic memory writes", async context => {
    const f = await fixture(context);
    await writeFile(join(f.root, "AGENTS.md"), "An ambient instruction that must not enter frozen context.");
    const messages = [{ role: "system", content: "Explicit supplemental system" }, { role: "user", content: "Exact supplied task input" }];
    await f.run({ frozenContext: true }, { messages });
    expect(f.provider.mock.calls[0]![0].request.messages).toEqual([{ role: "system", content: "Exact server system" }, ...messages]);
    await expect(access(join(f.root, "memory"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(join(f.root, "sessions"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(f.factory).toHaveBeenCalledOnce();
  });

  it("repairs an independently rejected final answer and accepts only the verified artifact", async context => {
    const f = await fixture(context);
    f.provider.mockResolvedValueOnce(action("write-bad", "bad")).mockResolvedValueOnce(answer("Looks complete"))
      .mockResolvedValueOnce(action("write-good", "good")).mockResolvedValueOnce(answer());
    const verify = vi.fn(async (_state: any, review: any) => (await readFile(f.artifact, "utf8")) === "good"
      ? { action: "complete" } : { action: "continue", feedback: "Independent verification failed: change the artifact to good." });
    const result = await f.run({ frozenContext: true, onFinalAnswer: verify, maxRepairAttempts: 1 });
    expect(result).toMatchObject({ status: "completed", finalAnswer: "Verified result", iterations: 4 });
    expect(verify).toHaveBeenCalledTimes(2); expect(f.executeTool).toHaveBeenCalledTimes(2);
    expect(f.provider.mock.calls[2]![0].request.messages.at(-1)).toEqual({ role: "user", content: "Independent verification failed: change the artifact to good." });
    expect(f.readRetained().state.repairAttempts).toBe(1); expect(f.readRetained().phase).toBe("terminal");
  });

  it("pauses at an awaited settled boundary and resumes the same session without replaying its tool", async context => {
    const f = await fixture(context); f.provider.mockResolvedValueOnce(action("write-once", "once"));
    let pause = true;
    const settled = vi.fn(async () => { if (pause) { pause = false; return { action: "pause" }; } return { action: "continue" }; });
    const options = { frozenContext: true, onSettled: settled };
    const paused = await f.run(options);
    expect(paused.status).toBe("paused"); expect(f.provider).toHaveBeenCalledOnce();
    expect(f.readRetained()).toMatchObject({ phase: "settled", state: { pendingHook: null, nextAction: "iterate", iteration: 1 } });
    f.resume(); const completed = await f.run(options);
    expect(completed).toMatchObject({ sessionId: paused.sessionId, status: "completed", iterations: 2 });
    expect(f.executeTool).toHaveBeenCalledOnce(); expect(f.provider).toHaveBeenCalledTimes(2);
  });

  it("awaits the persisted settled hook and clears its marker before another Provider call", async context => {
    const f = await fixture(context); let count = 0, enter!: () => void, release!: () => void;
    const entered = new Promise<void>(resolve => { enter = resolve; }), released = new Promise<void>(resolve => { release = resolve; });
    f.onCleanup(release);
    f.provider.mockImplementation(async () => { f.events.push("provider"); return ++count === 1 ? action("one", "one") : answer(); });
    const settled = async (_state: any, boundary: any) => {
      if (boundary.kind === "tool_results") {
        expect(f.readRetained()).toMatchObject({ phase: "settled", state: { pendingHook: "settled", iteration: 1 } });
        f.events.push("hook"); enter(); await released;
      }
      return { action: "continue" };
    };
    const running = f.run({ frozenContext: true, onSettled: settled });
    try {
      await Promise.race([entered, running.then(() => { throw new Error("Loop returned before the awaited hook."); })]);
      expect(f.provider).toHaveBeenCalledOnce(); expect(f.readRetained().state.pendingHook).toBe("settled");
    } finally { release(); }
    expect((await running).status).toBe("completed");
    const cleared = f.events.indexOf("save:settled:none", f.events.indexOf("hook"));
    expect(cleared).toBeGreaterThan(f.events.indexOf("hook")); expect(cleared).toBeLessThan(f.events.lastIndexOf("provider"));
  });

  for (const kind of ["settled", "final_answer"]) it("propagates " + kind + " hook failure and rejects hidden hook replay", async context => {
    const f = await fixture(context), failure = new Error("Owned hook failure");
    if (kind === "settled") f.provider.mockResolvedValueOnce(action("one", "one"));
    const hook = vi.fn(async () => { throw failure; });
    const options = { frozenContext: true, ...(kind === "settled" ? { onSettled: hook } : { onFinalAnswer: hook }) };
    await expect(f.run(options)).rejects.toBe(failure);
    expect(f.readRetained()).toMatchObject({ phase: "settled", state: { pendingHook: kind } });
    expect(f.snapshots.some(snapshot => snapshot.phase === "terminal")).toBe(false);
    f.resume(); await expect(f.run(options)).rejects.toMatchObject({ code: "CHECKPOINT_HOOK_IN_FLIGHT" });
    expect(f.provider).toHaveBeenCalledOnce(); expect(hook).toHaveBeenCalledOnce(); expect(f.close).toHaveBeenCalledTimes(2);
  });

  it("resumes a known final-review pause without another Provider request or duplicate assistant turn", async context => {
    const f = await fixture(context), final = vi.fn().mockResolvedValueOnce({ action: "pause" }).mockResolvedValue({ action: "complete" });
    const options = { frozenContext: true, onFinalAnswer: final };
    const paused = await f.run(options);
    expect(paused.status).toBe("paused");
    expect(f.readRetained()).toMatchObject({ phase: "settled", state: { nextAction: "final_answer", pendingHook: null, iteration: 1 } });
    f.resume(); const completed = await f.run(options);
    expect(completed).toMatchObject({ sessionId: paused.sessionId, iterations: 1, status: "completed" });
    expect(f.provider).toHaveBeenCalledOnce(); expect(final).toHaveBeenCalledTimes(2);
    expect(completed.messages.filter((message: any) => message.role === "assistant")).toHaveLength(1);
  });

  for (const limit of [0, 1]) it("enforces the original repair-attempt limit of " + limit, async context => {
    const f = await fixture(context), final = vi.fn(async () => ({ action: "continue", feedback: "Independent check still fails." }));
    const options = { frozenContext: true, onFinalAnswer: final, maxRepairAttempts: limit };
    const stopped = await f.run(options);
    expect(stopped.status).toBe("repair_limit_reached");
    expect(f.provider).toHaveBeenCalledTimes(limit + 1); expect(final).toHaveBeenCalledTimes(limit + 1);
    expect(f.readRetained()).toMatchObject({ phase: "terminal", state: { repairAttempts: limit, iteration: limit + 1 } });
    f.resume(); expect(await f.run(options)).toEqual(stopped);
    expect(f.provider).toHaveBeenCalledTimes(limit + 1); expect(final).toHaveBeenCalledTimes(limit + 1);
    await expect(f.run({ ...options, maxRepairAttempts: limit + 1 })).rejects.toMatchObject({ code: "CHECKPOINT_BINDING_MISMATCH" });
  });

  it("round-trips retained data through pure strict construction and rejects unknown or pending continuation", async context => {
    const f = await fixture(context), options = { frozenContext: true, onSettled: async () => ({ action: "pause" }) };
    f.provider.mockResolvedValueOnce(action("one", "one")); await f.run(options);
    const saved = f.readRetained(), reconstructed = createAgenticCheckpoint(saved.binding, {
      state: saved.state, phase: saved.phase, inFlight: saved.inFlight, savedAt: saved.savedAt,
    });
    expect(readAgenticCheckpoint(reconstructed, saved.binding)).toEqual(saved);
    reconstructed.state.messages[0]!.content = "Modified caller copy";
    expect(f.readRetained().state.messages[0].content).toBe("Exact server system");
    const pending = structuredClone(saved); pending.state.pendingHook = "settled";
    expect(() => readAgenticCheckpoint(pending, saved.binding)).toThrow(expect.objectContaining({ code: "CHECKPOINT_HOOK_IN_FLIGHT" }));
    expect(readAgenticCheckpoint(pending, saved.binding, { forResume: false }).state.pendingHook).toBe("settled");
    const unknown = structuredClone(saved); unknown.state.usageObservation.provider = "unobserved";
    expect(() => readAgenticCheckpoint(unknown, saved.binding)).toThrow(expect.objectContaining({ code: "CHECKPOINT_USAGE_UNOBSERVED" }));
    const incomplete = structuredClone(saved); delete incomplete.state.pendingHook;
    expect(() => readAgenticCheckpoint(incomplete, saved.binding)).toThrow(expect.objectContaining({ code: "CHECKPOINT_FORMAT_REJECTED" }));
  });

  it("propagates factory, save and asynchronous close failures without skipping the required boundary", async context => {
    const f = await fixture(context), factoryFailure = new Error("Owned factory failed"), saveFailure = new Error("Owned storage failed"), closeFailure = new Error("Owned close failed");
    f.factory.mockRejectedValueOnce(factoryFailure);
    await expect(f.run({ frozenContext: true })).rejects.toBe(factoryFailure); expect(f.provider).not.toHaveBeenCalled();
    const save = f.save.getMockImplementation()!;
    f.save.mockImplementationOnce(async (...args) => save(...args)).mockRejectedValueOnce(saveFailure);
    await expect(f.run({ frozenContext: true })).rejects.toBe(saveFailure); expect(f.provider).not.toHaveBeenCalled();
    expect(f.readRetained().phase).toBe("ready");
    f.close.mockRejectedValueOnce(closeFailure);
    await expect(f.run({ frozenContext: true })).rejects.toBe(closeFailure);
    expect(f.provider).toHaveBeenCalledOnce(); expect(f.readRetained().phase).toBe("terminal");
  });

  it("rejects malformed retained data from a server session before any Provider or tool call", async context => {
    const f = await fixture(context);
    for (const restored of [{}, undefined]) {
      f.factory.mockResolvedValueOnce({ restored, save: async () => {}, close: f.close } as any);
      await expect(f.run({ frozenContext: true })).rejects.toMatchObject({ code: restored === undefined ? "CHECKPOINT_CAPABILITY_INVALID" : "CHECKPOINT_FORMAT_REJECTED" });
    }
    expect(f.provider).not.toHaveBeenCalled(); expect(f.executeTool).not.toHaveBeenCalled(); expect(f.close).toHaveBeenCalledTimes(2);
  });

  it("ignores continuation capabilities and frozen-context flags supplied as input JSON", async context => {
    const f = await fixture(context);
    const result = await f.run({}, { checkpointSessionFactory: "client-selected-store", onSettled: { action: "pause" },
      onFinalAnswer: { action: "complete" }, frozenContext: true });
    expect(result.status).toBe("completed"); expect(f.factory).toHaveBeenCalledOnce();
    expect(f.provider.mock.calls[0]![0].request.messages[0].content).toContain("Working Directory");
    expect(f.readRetained().binding.configuration.hooks).toBeUndefined();
  });

  it("rejects an oversized UTF-8 tool result without truncation or a replayable settled checkpoint", async context => {
    const f = await fixture(context); f.provider.mockResolvedValueOnce(action("oversized", "unused"));
    f.executeTool.mockResolvedValueOnce({ blob: "界".repeat(Math.ceil(10 * 1024 * 1024 / 3) + 1) } as any);
    await expect(f.run({ frozenContext: true })).rejects.toMatchObject({ code: "TOOL_RESULT_SIZE_REJECTED" });
    expect(f.readRetained().phase).toBe("tools_in_flight"); expect(f.provider).toHaveBeenCalledOnce(); expect(f.executeTool).toHaveBeenCalledOnce();
    f.resume(); await expect(f.run({ frozenContext: true })).rejects.toMatchObject({ code: "CHECKPOINT_IN_FLIGHT" });
    expect(f.provider).toHaveBeenCalledOnce(); expect(f.executeTool).toHaveBeenCalledOnce();
  });

  it("keeps the ordinary non-frozen tool-result formatting unchanged", async context => {
    const f = await fixture(context); f.provider.mockResolvedValueOnce(action("legacy", "unused"));
    f.executeTool.mockResolvedValueOnce({ blob: "x".repeat(60_000), tail: "complete" } as any);
    const result = await f.run({ checkpointSessionFactory: null });
    expect(result.messages.find((message: any) => message.role === "tool").content.endsWith("\n... [truncated]")).toBe(true);
  });
});
