import { appendFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it, vi, type TestContext } from "vitest";
import { createAgenticLoop } from "./agenticCodingLoop.js";

const identityModel = vi.hoisted(() => ({ path: null as string | null, opened: 0, closed: 0,
  before: 9007199254740992n, openedIdentity: 9007199254740993n }));
vi.mock("node:fs/promises", async original => {
  const actual = await original<typeof import("node:fs/promises")>();
  const withIdentity = (stats: any, identity: bigint) => {
    Object.defineProperty(stats, "ino", { value: typeof stats.ino === "bigint" ? identity : Number(identity) }); return stats;
  };
  return { ...actual,
    lstat: async (path: any, options: any) => {
      const stats = await actual.lstat(path, options);
      return path === identityModel.path ? withIdentity(stats, identityModel.before) : stats;
    },
    open: async (path: any, flags: any, mode: any) => {
      const handle = await actual.open(path, flags, mode);
      if (path === identityModel.path) {
        identityModel.opened++;
        const stat = handle.stat.bind(handle), close = handle.close.bind(handle), identity = identityModel.openedIdentity;
        handle.stat = (async (options: any) => withIdentity(await stat(options), identity)) as typeof handle.stat;
        handle.close = async () => { try { await close(); } finally { identityModel.closed++; } };
      }
      return handle;
    },
  };
});

const goal = "Write the owned fixture result";
const toolResponse = (id = "call-1") => ({ text: "", toolCalls: [{ id, name: "fixture_write", arguments: { value: id } }],
  usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 } });
const finalResponse = () => ({ text: "Owned fixture complete", usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 } });

async function fixture(context: TestContext) {
  const base = await realpath(tmpdir()), creating = mkdtemp(join(base, "agentic-checkpoint-"));
  const controller = new AbortController(), pending = new Set<Promise<unknown>>();
  const cleanupActions: Array<() => void> = [];
  context.onTestFinished(async () => {
    controller.abort();
    for (const release of cleanupActions) release();
    const root = await creating;
    while (pending.size) await Promise.allSettled([...pending]);
    expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(base);
    expect(root.startsWith(join(base, "agentic-checkpoint-"))).toBe(true);
    await rm(root, { recursive: true, force: false });
  });
  const root = await creating, checkpointDir = join(root, "checkpoints");
  const executeTool = vi.fn(async (_name: string, args: any, _context?: any) => {
    await appendFile(join(root, "effects.txt"), String(args.value) + "\n"); return { status: "success", value: args.value };
  });
  const provider = vi.fn(async (_request: any): Promise<any> => finalResponse());
  const tools = [{ name: "fixture_write", description: "Write only the owned fixture", inputSchema: { type: "object", properties: { value: { type: "string" } } } }];
  const registry = { listTools: ({ allowlist }: any = {}) => allowlist ? tools.filter(tool => allowlist.includes(tool.name)) : tools,
    executeTool, getHealth: () => ({ governanceToolProxyConfigured: true, governanceRequired: true }) };
  const loop = (options: any = {}) => createAgenticLoop({ workingDirectory: root, checkpointDir,
    memoryDir: join(root, "memory"), sessionStoreDir: join(root, "sessions"), providerAdapter: { generate: provider },
    toolRegistry: registry, promptOptimizeEnabled: false, partialPreviewEnabled: false, maxIterations: 3, ...options });
  const request = (input: any) => ({ goal, providerId: "fixture", modelId: "fixture-model", toolAllowlist: ["fixture_write"], ...input,
    signal: AbortSignal.any([context.signal, controller.signal, ...(input.signal ? [input.signal] : [])]) });
  const track = <T>(result: Promise<T>) => {
    pending.add(result); void result.then(() => pending.delete(result), () => pending.delete(result)); return result;
  };
  const run = (input: any = {}, options: any = {}) => track(loop(options).execute(request(input)));
  const stream = (input: any = {}, options: any = {}) => track((async () => {
    const events = []; for await (const event of loop(options).executeStream(request(input))) events.push(event); return events;
  })());
  const checkpointPath = async () => {
    const files = (await readdir(checkpointDir)).filter(name => /^checkpoint-.*\.json$/u.test(name));
    expect(files).toHaveLength(1); return join(checkpointDir, files[0]!);
  };
  return { root, checkpointDir, provider, executeTool, run, stream, loop, checkpointPath,
    onCleanup: (release: () => void) => cleanupActions.push(release) };
}

async function pausedCheckpoint(context: TestContext, iterations = 1, options: any = {}) {
  const f = await fixture(context), paused = new AbortController();
  for (let index = 1; index <= iterations; index++) f.provider.mockResolvedValueOnce(toolResponse(`call-${index}`));
  const result = await f.run({ signal: paused.signal, onIteration: (iteration: number) => { if (iteration === iterations) paused.abort(); } }, options);
  const path = await f.checkpointPath(), checkpoint = JSON.parse(await readFile(path, "utf8"));
  return { f, path, checkpoint, result };
}
function clearCalls(f: Awaited<ReturnType<typeof fixture>>) { f.provider.mockClear(); f.executeTool.mockClear(); }
function noCalls(f: Awaited<ReturnType<typeof fixture>>) { expect(f.provider).not.toHaveBeenCalled(); expect(f.executeTool).not.toHaveBeenCalled(); }
const checkpointError = { code: expect.stringMatching(/^CHECKPOINT_/u) };

describe("complete original Agentic Loop checkpoints", () => {
  it("rejects colliding Number inode identities after opening a checkpoint", async context => {
    const { f, path } = await pausedCheckpoint(context); clearCalls(f);
    expect(identityModel.before).not.toBe(identityModel.openedIdentity);
    expect(Number(identityModel.before)).toBe(Number(identityModel.openedIdentity));
    identityModel.path = path; identityModel.opened = 0; identityModel.closed = 0;
    try {
      await expect(f.run({ resumeFromCheckpoint: path })).rejects.toMatchObject({ code: "CHECKPOINT_FILE_REJECTED" });
      noCalls(f); expect(identityModel.opened).toBe(1); expect(identityModel.closed).toBe(1);
    } finally { identityModel.path = null; }
  });

  for (const kind of ["missing", "invalid-json"]) it("rejects " + kind + " resume before any new Provider or tool call", async context => {
    const f = await fixture(context), path = join(f.checkpointDir, "checkpoint-00000000-0000-4000-8000-000000000000.json");
    await mkdir(f.checkpointDir);
    if (kind === "invalid-json") await writeFile(path, "{broken");
    await expect(f.run({ resumeFromCheckpoint: path })).rejects.toMatchObject({ code: expect.stringMatching(/^CHECKPOINT_/u) });
    expect(f.provider).not.toHaveBeenCalled(); expect(f.executeTool).not.toHaveBeenCalled();
  });

  it("persists the complete assistant call and its exact result before a paused run returns", async context => {
    const f = await fixture(context), paused = new AbortController();
    f.provider.mockResolvedValueOnce(toolResponse() as any);
    await f.run({ signal: paused.signal, onIteration: () => paused.abort() });
    const checkpoint = JSON.parse(await readFile(await f.checkpointPath(), "utf8"));
    const messages = checkpoint.state?.messages ?? checkpoint.messages;
    expect(messages.filter((message: any) => message.role === "tool")).toEqual([
      { role: "tool", tool_call_id: "call-1", content: JSON.stringify({ status: "success", value: "call-1" }) },
    ]);
    expect(messages.some((message: any) => message.role === "assistant" && message.tool_calls?.[0]?.id === "call-1")).toBe(true);
    expect(f.executeTool).toHaveBeenCalledOnce();
  });

  it("keeps a multi-call batch paired when a reflection follows its results", async context => {
    const f = await fixture(context), paused = new AbortController(), response = toolResponse("call-a");
    response.toolCalls.push(...toolResponse("call-b").toolCalls); f.provider.mockResolvedValueOnce(response);
    await f.run({ signal: paused.signal, onIteration: () => paused.abort() }, { selfReflectionEnabled: true, selfReflectionInterval: 1 });
    const checkpoint = JSON.parse(await readFile(await f.checkpointPath(), "utf8")), messages = checkpoint.state.messages;
    expect(messages.find((message: any) => message.tool_calls?.length).tool_calls.map((call: any) => call.id)).toEqual(["call-a", "call-b"]);
    expect(messages.filter((message: any) => message.role === "tool").map((message: any) => message.tool_call_id)).toEqual(["call-a", "call-b"]);
    clearCalls(f); await f.run({ resumeFromCheckpoint: await f.checkpointPath() }, { selfReflectionEnabled: true, selfReflectionInterval: 1 });
    expect(f.provider).toHaveBeenCalledOnce(); expect(f.executeTool).not.toHaveBeenCalled();
  });

  it("resumes the original session and full history with cumulative usage and prior tool outcomes", async context => {
    const { f, path, checkpoint, result: original } = await pausedCheckpoint(context);
    expect(checkpoint).toMatchObject({ kind: "agentic-loop-checkpoint", version: 1, phase: "settled", inFlight: null });
    let suppliedHistory: unknown;
    clearCalls(f); f.provider.mockImplementationOnce(async request => { suppliedHistory = structuredClone(request.request.messages); return finalResponse(); });
    const resumed = await f.run({ resumeFromCheckpoint: path });
    expect(suppliedHistory).toEqual(checkpoint.state.messages);
    expect(resumed).toMatchObject({ sessionId: original.sessionId, iterations: 2, status: "completed",
      usage: { inputTokens: 5, outputTokens: 7, totalTokens: 12 }, toolUsage: { totalCalls: 1 } });
    expect(resumed.messages.slice(0, checkpoint.state.messages.length)).toEqual(checkpoint.state.messages);
    expect(f.provider).toHaveBeenCalledOnce(); expect(f.executeTool).not.toHaveBeenCalled();
    expect(await readFile(join(f.root, "effects.txt"), "utf8")).toBe("call-1\n");
  });

  it("uses only the remaining cumulative iteration and never resets the original budget", async context => {
    const { f, path } = await pausedCheckpoint(context, 2);
    clearCalls(f); f.provider.mockResolvedValue(toolResponse("call-3"));
    const resumed = await f.run({ resumeFromCheckpoint: path });
    expect(resumed).toMatchObject({ iterations: 3, status: "max_iterations_reached",
      usage: { inputTokens: 6, outputTokens: 9, totalTokens: 15 }, toolUsage: { totalCalls: 3 } });
    expect(f.provider).toHaveBeenCalledOnce(); expect(f.executeTool).toHaveBeenCalledOnce();
    expect(await readFile(join(f.root, "effects.txt"), "utf8")).toBe("call-1\ncall-2\ncall-3\n");
  });

  for (const ending of ["final-answer", "iteration-limit"]) it(`replays a ${ending} terminal checkpoint without new calls and rejects changed limits`, async context => {
    const f = await fixture(context);
    if (ending === "iteration-limit") { let count = 0; f.provider.mockImplementation(async () => toolResponse(`call-${++count}`)); }
    const original = await f.run(), path = await f.checkpointPath();
    expect(JSON.parse(await readFile(path, "utf8")).phase).toBe("terminal");
    clearCalls(f);
    expect(await f.run({ resumeFromCheckpoint: path })).toEqual(original);
    noCalls(f);
    await expect(f.run({ resumeFromCheckpoint: path }, { maxIterations: 4 })).rejects.toMatchObject({ code: "CHECKPOINT_BINDING_MISMATCH" });
    noCalls(f);
  });

  it("rejects changed goal, Provider, model, allowed tools and permission configuration", async context => {
    const { f, path, checkpoint } = await pausedCheckpoint(context); clearCalls(f);
    for (const [input, options] of [
      [{ goal: "Different owned goal" }, {}], [{ providerId: "another-provider" }, {}], [{ modelId: "another-model" }, {}],
      [{ toolAllowlist: [] }, {}], [{}, { permissionMode: "bypassPermissions" }],
    ]) {
      await expect(f.run({ resumeFromCheckpoint: path, ...input }, options)).rejects.toMatchObject({ code: "CHECKPOINT_BINDING_MISMATCH" }); noCalls(f);
    }
    checkpoint.binding.canonicalWorkspace = join(f.root, "different-workspace"); await writeFile(path, JSON.stringify(checkpoint));
    await expect(f.run({ resumeFromCheckpoint: path })).rejects.toMatchObject({ code: "CHECKPOINT_BINDING_MISMATCH" }); noCalls(f);
  });

  it("rejects legacy incomplete checkpoints and invalid counters before any new call", async context => {
    const { f, path, checkpoint } = await pausedCheckpoint(context); clearCalls(f);
    const legacy = { ...checkpoint.state, messages: checkpoint.state.messages.filter((message: any) => message.role !== "tool") };
    const invalidIteration = structuredClone(checkpoint); invalidIteration.state.iteration = 0.5;
    const invalidUsage = structuredClone(checkpoint); invalidUsage.state.totalUsage.totalTokens = -1;
    const invalidSession = structuredClone(checkpoint); invalidSession.state.sessionId = "../outside";
    for (const broken of [legacy, {}, invalidIteration, invalidUsage, invalidSession]) {
      await writeFile(path, JSON.stringify(broken));
      await expect(f.run({ resumeFromCheckpoint: path })).rejects.toMatchObject(checkpointError); noCalls(f);
    }
  });

  it("rejects orphan, duplicate, missing and duplicated-call result pairings", async context => {
    const { f, path, checkpoint } = await pausedCheckpoint(context); clearCalls(f);
    const orphan = structuredClone(checkpoint); orphan.state.messages.push({ role: "tool", tool_call_id: "unknown", content: "{}" });
    const duplicate = structuredClone(checkpoint); duplicate.state.messages.push(structuredClone(duplicate.state.messages.find((message: any) => message.role === "tool")));
    const missing = structuredClone(checkpoint); missing.state.messages = missing.state.messages.filter((message: any) => message.role !== "tool");
    const duplicateCall = structuredClone(checkpoint), assistant = duplicateCall.state.messages.find((message: any) => message.tool_calls?.length);
    assistant.tool_calls.push(structuredClone(assistant.tool_calls[0]));
    for (const broken of [orphan, duplicate, missing, duplicateCall]) {
      await writeFile(path, JSON.stringify(broken));
      await expect(f.run({ resumeFromCheckpoint: path })).rejects.toMatchObject(checkpointError); noCalls(f);
    }
  });

  it("persists an in-flight action before its effect and refuses concurrent or unresolved recovery without replay", async context => {
    const f = await fixture(context); f.provider.mockResolvedValueOnce(toolResponse("call-held"));
    let enter!: () => void, release!: () => void, intent: any;
    const entered = new Promise<void>(resolve => { enter = resolve; }), released = new Promise<void>(resolve => { release = resolve; });
    f.onCleanup(release);
    f.executeTool.mockImplementationOnce(async (_name, args) => {
      intent = JSON.parse(await readFile(await f.checkpointPath(), "utf8"));
      await appendFile(join(f.root, "effects.txt"), String(args.value) + "\n"); enter(); await released;
      return { status: "success", value: args.value };
    });
    const running = f.run();
    try {
      await Promise.race([entered, running.then(() => { throw new Error("Loop ended before the held tool effect."); })]);
      expect(intent).toMatchObject({ phase: "tools_in_flight", inFlight: { kind: "tools", iteration: 1, toolCallIds: ["call-held"] } });
      const path = await f.checkpointPath();
      await expect(f.run({ resumeFromCheckpoint: path })).rejects.toMatchObject({ code: "CHECKPOINT_BUSY" });
      expect(f.provider).toHaveBeenCalledOnce(); expect(f.executeTool).toHaveBeenCalledOnce();
    } finally { release(); await running; }
    const path = await f.checkpointPath(); await writeFile(path, JSON.stringify(intent)); clearCalls(f);
    await expect(f.run({ resumeFromCheckpoint: path })).rejects.toMatchObject({ code: "CHECKPOINT_IN_FLIGHT" }); noCalls(f);
    expect(await readFile(join(f.root, "effects.txt"), "utf8")).toBe("call-held\n");
  });

  it("rejects a checkpoint write exceeding the size limit before dispatching the proposed tool", async context => {
    const f = await fixture(context);
    f.provider.mockResolvedValueOnce({ ...toolResponse(), text: "x".repeat(10 * 1024 * 1024 + 1) });
    await expect(f.run()).rejects.toMatchObject(checkpointError);
    expect(f.provider).toHaveBeenCalledOnce(); expect(f.executeTool).not.toHaveBeenCalled();
  });

  for (const unobserved of ["planning", "provider"]) it(`refuses nonterminal recovery with unobserved ${unobserved} usage without replanning`, async context => {
    const f = await fixture(context), paused = new AbortController(), options = { planningEnabled: unobserved === "planning" };
    if (unobserved === "planning") f.provider.mockResolvedValueOnce({ text: JSON.stringify([{ step: 1, action: "Write the fixture", tools: ["fixture_write"], success_criteria: "The result exists" }]),
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } });
    const response: any = toolResponse(); if (unobserved === "provider") delete response.usage;
    f.provider.mockResolvedValueOnce(response);
    await f.run({ signal: paused.signal, onIteration: () => paused.abort() }, options);
    const path = await f.checkpointPath(), checkpoint = JSON.parse(await readFile(path, "utf8"));
    expect(checkpoint.state.usageObservation[unobserved]).toBe("unobserved"); clearCalls(f);
    await expect(f.run({ resumeFromCheckpoint: path }, options)).rejects.toMatchObject({ code: "CHECKPOINT_USAGE_UNOBSERVED" }); noCalls(f);
  });

  it("refuses governed direct resume even with a claimed Agent identity", async context => {
    const { f, path } = await pausedCheckpoint(context); clearCalls(f);
    await expect(f.run({ resumeFromCheckpoint: path, agentGovernance: { agentId: "agt_claimed", tenantId: "tenant-claimed" } },
      { agentGovernanceRequired: true })).rejects.toMatchObject({ code: "CHECKPOINT_GOVERNED_RESUME_REJECTED" }); noCalls(f);
  });

  it("refuses stream resume before starting any Provider or tool operation", async context => {
    const { f, path } = await pausedCheckpoint(context); clearCalls(f);
    expect(await f.stream({ resumeFromCheckpoint: path })).toEqual([
      expect.objectContaining({ type: "error", code: "CHECKPOINT_STREAM_RESUME_UNSUPPORTED" }),
    ]); noCalls(f);
  });
});
