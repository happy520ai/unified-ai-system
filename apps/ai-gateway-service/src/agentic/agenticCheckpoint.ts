import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_BYTES_BIGINT = BigInt(MAX_BYTES);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const owners = new Map<string, symbol>(); // Process-local exclusion only; the governed caller owns cross-process claims.
type RecordValue = Record<string, any>;
export type CheckpointPhase = "ready" | "provider_in_flight" | "tools_in_flight" | "settled" | "terminal";
export type AgenticCheckpointBinding = {
  goal: string; providerId: string; modelId: string; canonicalWorkspace: string;
  tools: Array<{ name: string; definitionHash: string }>;
  limits: { maxIterations: number; maxTokensPerTurn: number; tokenBudget: number };
  configuration: RecordValue;
};
export type AgenticCheckpointState = {
  sessionId: string; startedAt: number; messages: RecordValue[]; initialMessageCount: number;
  allToolResults: RecordValue[]; trace: RecordValue[]; plan: RecordValue[] | null; planStepIndex: number;
  totalUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
  usageObservation: { planning: "not_used" | "unobserved"; provider: "observed" | "unobserved" };
  iteration: number; effectiveMaxIterations: number; status: string; finalAnswer: string;
  repairAttempts?: number; nextAction?: "iterate" | "final_answer"; pendingHook?: "settled" | "final_answer" | null;
  terminalResult: RecordValue | null;
};
export type AgenticCheckpointIntent = { kind: "planning" | "provider" | "tools"; iteration: number; toolCallIds: string[] } | null;
type Intent = AgenticCheckpointIntent;
export type AgenticCheckpoint = { kind: "agentic-loop-checkpoint"; version: 1; binding: AgenticCheckpointBinding;
  phase: CheckpointPhase; inFlight: Intent; state: AgenticCheckpointState; savedAt: string };
type Checkpoint = AgenticCheckpoint;
const failure = (code: string, cause?: unknown) => Object.assign(new Error("The original Agentic checkpoint cannot be used safely.", { cause }), { code: "CHECKPOINT_" + code });
const object = (value: unknown): value is RecordValue => value !== null && typeof value === "object" && !Array.isArray(value);
const integer = (value: unknown, min = 0) => Number.isSafeInteger(value) && Number(value) >= min;
const text = (value: unknown) => typeof value === "string" && value.length > 0;
const pathKey = (value: string) => process.platform === "win32" ? value.toLowerCase() : value;
const sameFile = (a: { dev: bigint; ino: bigint }, b: { dev: bigint; ino: bigint }) => a.dev === b.dev && a.ino === b.ino;
function stable(value: any): string {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (object(value)) return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stable(value[key])).join(",") + "}";
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw failure("FORMAT_REJECTED");
  return encoded;
}
const hash = (value: any) => createHash("sha256").update(stable(value)).digest("hex");
function within(root: string, path: string) {
  const offset = relative(root, path);
  if (offset === ".." || offset.startsWith(".." + sep) || isAbsolute(offset)) throw failure("PATH_REJECTED");
}

export async function buildAgenticCheckpointBinding(input: {
  workingDirectory: string; goal: string; providerId: string; modelId: string; tools: RecordValue[];
  maxIterations: number; maxTokensPerTurn: number; tokenBudget: number; configuration: RecordValue;
}): Promise<AgenticCheckpointBinding> {
  if (![input.goal, input.providerId, input.modelId].every(text)
    || ![input.maxIterations, input.maxTokensPerTurn, input.tokenBudget].every(value => integer(value, 1))
    || input.maxIterations > Number.MAX_SAFE_INTEGER / 2) throw failure("BINDING_MISMATCH");
  const tools = input.tools.map(tool => ({ name: tool.function?.name, definitionHash: hash(tool) })).sort((a, b) => a.name?.localeCompare(b.name));
  if (tools.some(tool => !text(tool.name)) || new Set(tools.map(tool => tool.name)).size !== tools.length) throw failure("BINDING_MISMATCH");
  const configuration = JSON.parse(JSON.stringify(input.configuration));
  configuration.systemPromptHash = hash(configuration.systemPrompt); configuration.initialMessagesHash = hash(configuration.initialMessages);
  delete configuration.systemPrompt; delete configuration.initialMessages;
  return { goal: input.goal, providerId: input.providerId, modelId: input.modelId, canonicalWorkspace: await realpath(resolve(input.workingDirectory)),
    tools, limits: { maxIterations: input.maxIterations, maxTokensPerTurn: input.maxTokensPerTurn, tokenBudget: input.tokenBudget },
    configuration };
}

function validate(checkpoint: any, binding: AgenticCheckpointBinding): asserts checkpoint is Checkpoint {
  const invalid = () => { throw failure("FORMAT_REJECTED"); };
  if (!object(checkpoint) || checkpoint.kind !== "agentic-loop-checkpoint" || checkpoint.version !== 1
    || Object.keys(checkpoint).some(key => !["kind", "version", "binding", "phase", "inFlight", "state", "savedAt"].includes(key))) invalid();
  if (!object(checkpoint.binding) || stable(checkpoint.binding) !== stable(binding)) throw failure("BINDING_MISMATCH");
  if (!["ready", "provider_in_flight", "tools_in_flight", "settled", "terminal"].includes(checkpoint.phase)
    || !text(checkpoint.savedAt) || !Number.isFinite(Date.parse(checkpoint.savedAt))) invalid();
  const s = checkpoint.state as AgenticCheckpointState;
  if (!object(s) || !UUID.test(s.sessionId) || !integer(s.startedAt, 1)
    || !Array.isArray(s.messages) || !integer(s.initialMessageCount, 1) || s.initialMessageCount > s.messages.length
    || !Array.isArray(s.allToolResults) || !Array.isArray(s.trace) || !integer(s.iteration) || !integer(s.effectiveMaxIterations, 1)
    || s.iteration > s.effectiveMaxIterations || s.effectiveMaxIterations > Math.ceil(binding.limits.maxIterations * (binding.configuration.dynamicBudgetEnabled ? 1.5 : 1))
    || !object(s.totalUsage) || !["inputTokens", "outputTokens", "totalTokens"].every(key => integer(s.totalUsage[key as keyof typeof s.totalUsage]))
    || !object(s.usageObservation) || !["not_used", "unobserved"].includes(s.usageObservation.planning)
    || !["observed", "unobserved"].includes(s.usageObservation.provider) || typeof s.finalAnswer !== "string" || !text(s.status)) invalid();
  if (s.usageObservation.planning === "not_used" && binding.configuration.planningEnabled === true) {
    if (checkpoint.phase !== "provider_in_flight" || checkpoint.inFlight?.kind !== "planning") invalid();
  }
  if (s.plan !== null && (!Array.isArray(s.plan) || s.plan.length > binding.configuration.maxPlanSteps
    || s.plan.some((step, index) => !object(step) || step.step !== index + 1 || !text(step.action)
      || !Array.isArray(step.tools) || step.tools.some((name: unknown) => !text(name)) || typeof step.successCriteria !== "string"
      || !["pending", "in_progress", "completed"].includes(step.status)))) invalid();
  if (!integer(s.planStepIndex) || s.planStepIndex > (s.plan?.length ?? 0)
    || s.plan?.some((step, index) => index < s.planStepIndex && step.status !== "completed")) invalid();
  if (s.trace.some(event => !object(event) || !text(event.type) || (event.iteration !== undefined && (!integer(event.iteration, 1)
    || event.iteration > s.iteration + (["governance_denied", "cancelled"].includes(event.type) ? 1 : 0))))) invalid();
  const repairAttempts = s.repairAttempts === undefined ? 0 : s.repairAttempts;
  const nextAction = s.nextAction === undefined ? "iterate" : s.nextAction, pendingHook = s.pendingHook === undefined ? null : s.pendingHook;
  if ((binding.configuration.frozenContext === true || binding.configuration.hooks)
    && !["repairAttempts", "nextAction", "pendingHook"].every(key => Object.hasOwn(s, key))) invalid();
  if (!integer(repairAttempts) || repairAttempts > (binding.configuration.maxRepairAttempts ?? 0)
    || repairAttempts !== s.trace.filter(event => event.type === "repair_feedback").length
    || !["iterate", "final_answer"].includes(nextAction) || ![null, "settled", "final_answer"].includes(pendingHook)
    || (pendingHook !== null && checkpoint.phase !== "settled") || (pendingHook === "final_answer" && nextAction !== "final_answer")) invalid();
  if (nextAction === "final_answer") {
    const candidate = s.messages.at(-1);
    if (checkpoint.phase !== "settled" || !candidate || candidate.role !== "assistant" || candidate.tool_calls !== undefined
      || candidate.content !== s.finalAnswer) invalid();
  }
  const seen = new Set<string>(), pending = new Map<string, string>(), results: RecordValue[] = [];
  const allowed = new Set(binding.tools.map(tool => tool.name)); let assistantTurns = 0;
  for (const [index, message] of s.messages.entries()) {
    if (!object(message) || !["system", "user", "assistant", "tool"].includes(message.role)
      || !(typeof message.content === "string" || message.content === null || Array.isArray(message.content))) invalid();
    if (index === s.initialMessageCount && pending.size) invalid();
    if (message.role === "tool") {
      if (!text(message.tool_call_id) || !pending.has(message.tool_call_id) || typeof message.content !== "string") invalid();
      if (index >= s.initialMessageCount) results.push({ ...message, expectedName: pending.get(message.tool_call_id) });
      pending.delete(message.tool_call_id); continue;
    }
    if (pending.size || message.tool_call_id !== undefined) invalid();
    if (index >= s.initialMessageCount && message.role === "assistant") assistantTurns++;
    if (message.tool_calls !== undefined) {
      if (message.role !== "assistant" || !Array.isArray(message.tool_calls) || message.tool_calls.length === 0) invalid();
      for (const call of message.tool_calls) {
        if (!object(call) || !text(call.id) || call.id.length > 256 || seen.has(call.id) || call.type !== "function"
          || !object(call.function) || !text(call.function.name) || typeof call.function.arguments !== "string"
          || (index >= s.initialMessageCount && !allowed.has(call.function.name))) invalid();
        try { if (!object(JSON.parse(call.function.arguments))) invalid(); } catch { invalid(); }
        seen.add(call.id); pending.set(call.id, call.function.name);
      }
    }
  }
  if (assistantTurns > s.iteration || results.length !== s.allToolResults.length) invalid();
  for (const [index, result] of results.entries()) {
    const stored = s.allToolResults[index]!;
    if (!object(stored) || stored.role !== "tool" || stored.tool_call_id !== result.tool_call_id || stored.content !== result.content
      || !object(stored._meta) || stored._meta.toolName !== result.expectedName || typeof stored._meta.isError !== "boolean" || !integer(stored._meta.durationMs)) invalid();
  }
  if (checkpoint.phase.endsWith("_in_flight")) {
    const intent = checkpoint.inFlight;
    if (!object(intent) || !["planning", "provider", "tools"].includes(intent.kind) || intent.iteration !== s.iteration || !Array.isArray(intent.toolCallIds)
      || intent.toolCallIds.some((id: unknown) => !text(id)) || new Set(intent.toolCallIds).size !== intent.toolCallIds.length) invalid();
    if (checkpoint.phase === "tools_in_flight") {
      if (intent.kind !== "tools" || stable([...pending.keys()]) !== stable(intent.toolCallIds) || pending.size === 0) invalid();
    } else if (pending.size || intent.kind === "tools" || intent.toolCallIds.length || (intent.kind === "planning" && s.iteration !== 0)) invalid();
  } else if (pending.size || checkpoint.inFlight !== null) invalid();
  if (checkpoint.phase === "ready" && s.iteration !== 0) invalid();
  if (checkpoint.phase === "settled" && (s.iteration < 1 || assistantTurns !== s.iteration)) invalid();
  if (checkpoint.phase === "terminal") {
    const result = s.terminalResult;
    if (!object(result) || result.sessionId !== s.sessionId || result.goal !== binding.goal || result.status !== s.status
      || result.iterations !== s.iteration || result.finalAnswer !== s.finalAnswer || stable(result.usage) !== stable(s.totalUsage)
      || stable(result.messages) !== stable(s.messages) || stable(result.trace) !== stable(s.trace)) invalid();
  } else if (s.terminalResult !== null) invalid();
}

function boundedCopy(value: unknown) {
  let encoded: string;
  try {
    encoded = JSON.stringify(value, (_key, item) => {
      if (["function", "symbol", "bigint"].includes(typeof item) || (typeof item === "number" && !Number.isFinite(item))) throw failure("FORMAT_REJECTED");
      return item;
    });
  } catch (error) { throw failure("FORMAT_REJECTED", error); }
  if (typeof encoded !== "string") throw failure("FORMAT_REJECTED");
  if (Buffer.byteLength(encoded, "utf8") > MAX_BYTES) throw failure("SIZE_REJECTED");
  return JSON.parse(encoded);
}

/** Pure data constructor: the caller supplies the timestamp; this grants no execution authority. */
export function createAgenticCheckpoint(binding: AgenticCheckpointBinding, input: {
  state: AgenticCheckpointState; phase: CheckpointPhase; inFlight?: AgenticCheckpointIntent; savedAt: string;
}): AgenticCheckpoint {
  const checkpoint = boundedCopy({ kind: "agentic-loop-checkpoint", version: 1, binding, ...input, inFlight: input.inFlight ?? null });
  validate(checkpoint, binding); return checkpoint;
}

/** Pure strict reader for retained JSON. A trusted caller must separately establish ownership and policy. */
export function readAgenticCheckpoint(value: unknown, binding: AgenticCheckpointBinding, options: { forResume?: boolean } = {}): AgenticCheckpoint {
  const checkpoint = boundedCopy(value); validate(checkpoint, binding);
  if (options.forResume !== false) {
    if (checkpoint.phase.endsWith("_in_flight")) throw failure("IN_FLIGHT");
    if (checkpoint.state.pendingHook != null) throw failure("HOOK_IN_FLIGHT");
    if (checkpoint.phase !== "terminal" && (checkpoint.state.usageObservation.planning === "unobserved"
      || checkpoint.state.usageObservation.provider === "unobserved")) throw failure("USAGE_UNOBSERVED");
  }
  return checkpoint;
}

async function directory(root: string, input: string, create: boolean) {
  const target = resolve(input); within(root, target);
  let current = root;
  for (const component of relative(root, target).split(sep).filter(Boolean)) {
    current = join(current, component);
    try { await lstat(current, { bigint: true }); } catch (error: any) {
      if (!create || error.code !== "ENOENT") throw failure("PATH_REJECTED", error);
      try { await mkdir(current, { mode: 0o700 }); } catch (mkdirError: any) { if (mkdirError.code !== "EEXIST") throw failure("SAVE_FAILED", mkdirError); }
    }
    const metadata = await lstat(current, { bigint: true });
    if (!metadata.isDirectory() || metadata.isSymbolicLink() || pathKey(await realpath(current)) !== pathKey(current)) throw failure("PATH_REJECTED");
  }
  return target;
}

async function readBounded(path: string) {
  const before = await lstat(path, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n || pathKey(await realpath(path)) !== pathKey(path)) throw failure("FILE_REJECTED");
  if (before.size > MAX_BYTES_BIGINT) throw failure("SIZE_REJECTED");
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat({ bigint: true });
    if (!sameFile(before, opened) || !opened.isFile() || opened.nlink !== 1n || opened.size < 0n || opened.size > MAX_BYTES_BIGINT) throw failure("FILE_REJECTED");
    const buffer = Buffer.alloc(Number(opened.size) + 1); let count = 0;
    while (count < buffer.length) {
      const { bytesRead } = await handle.read(buffer, count, buffer.length - count, count);
      if (bytesRead === 0) break; count += bytesRead;
    }
    const after = await handle.stat({ bigint: true }), current = await lstat(path, { bigint: true });
    if (count > MAX_BYTES) throw failure("SIZE_REJECTED");
    if (!sameFile(opened, after) || !sameFile(opened, current) || current.isSymbolicLink()
      || after.size !== BigInt(count) || after.size !== opened.size || current.size !== opened.size
      || after.mtimeNs !== opened.mtimeNs || current.mtimeNs !== opened.mtimeNs
      || after.ctimeNs !== opened.ctimeNs || current.ctimeNs !== opened.ctimeNs) throw failure("FILE_CHANGED");
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, count)));
  } finally { await handle.close(); }
}

export async function openAgenticCheckpointSession(binding: AgenticCheckpointBinding, options: {
  checkpointDir: string; resumePath?: unknown; sessionId: string;
}) {
  const resume = options.resumePath !== undefined;
  if (!text(options.checkpointDir) || !UUID.test(options.sessionId) || (resume && !text(options.resumePath))) throw failure("PATH_REJECTED");
  let folder: string, path: string;
  try {
    folder = await directory(binding.canonicalWorkspace, options.checkpointDir, !resume);
    path = resume ? resolve(options.resumePath as string) : join(folder, "checkpoint-" + options.sessionId + ".json");
    if (pathKey(dirname(path)) !== pathKey(folder) || !/^checkpoint-[0-9a-f-]+\.json$/u.test(basename(path))) throw failure("PATH_REJECTED");
  } catch (error: any) { throw error.code?.startsWith("CHECKPOINT_") ? error : failure("PATH_REJECTED", error); }
  const key = pathKey(path), owner = Symbol(), folderIdentity = await lstat(folder, { bigint: true });
  if (owners.has(key)) throw failure("BUSY");
  owners.set(key, owner); let closed = false;
  const assertOwned = async () => {
    if (closed || owners.get(key) !== owner) throw failure("SESSION_CLOSED");
    const current = await lstat(folder, { bigint: true });
    if (!sameFile(folderIdentity, current) || !current.isDirectory() || current.isSymbolicLink()
      || pathKey(await realpath(folder)) !== pathKey(folder)) throw failure("PATH_REJECTED");
  };
  let restored: Checkpoint | null = null;
  try {
    if (resume) {
      restored = readAgenticCheckpoint(await readBounded(path), binding); await assertOwned();
      if (basename(path) !== "checkpoint-" + restored.state.sessionId + ".json") throw failure("BINDING_MISMATCH");
    } else {
      try { await lstat(path, { bigint: true }); throw failure("FILE_EXISTS"); } catch (error: any) { if (error.code !== "ENOENT") throw error; }
    }
  } catch (error: any) {
    owners.delete(key); throw error.code?.startsWith("CHECKPOINT_") ? error : failure("READ_FAILED", error);
  }
  return {
    path, restored,
    async save(state: AgenticCheckpointState, phase: CheckpointPhase, inFlight: Intent = null) {
      let temporary: string | undefined;
      try {
        await assertOwned();
        const checkpoint = createAgenticCheckpoint(binding, { phase, inFlight, state, savedAt: new Date().toISOString() });
        const encoded = Buffer.from(JSON.stringify(checkpoint), "utf8");
        try { const target = await lstat(path, { bigint: true }); if (!target.isFile() || target.isSymbolicLink() || target.nlink !== 1n) throw failure("FILE_REJECTED"); }
        catch (error: any) { if (error.code !== "ENOENT") throw error; }
        temporary = path + ".tmp-" + randomUUID();
        const handle = await open(temporary, "wx", 0o600);
        try { await handle.writeFile(encoded); await handle.sync(); } finally { await handle.close(); }
        await assertOwned(); await rename(temporary, path); temporary = undefined;
      } catch (error: any) { throw error.code?.startsWith("CHECKPOINT_") ? error : failure("SAVE_FAILED", error); }
      finally { if (temporary) await unlink(temporary).catch((error: any) => { if (error.code !== "ENOENT") throw failure("SAVE_FAILED", error); }); }
    },
    close() { if (!closed) { closed = true; if (owners.get(key) === owner) owners.delete(key); } },
  };
}
