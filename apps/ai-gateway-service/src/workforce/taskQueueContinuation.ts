import { createHash } from "node:crypto";

export type TaskContinuationPhase = "prepared" | "planning" | "awaiting_confirmation" | "running" | "paused" | "verifying" | "completed" | "failed" | "cancelled" | "unknown";
export type TaskContinuation = Readonly<{
  version: 1; revision: number; bindingHash: string; inputHash: string; phase: TaskContinuationPhase;
  pendingOperation: null | Readonly<{ id: string; kind: "provider" | "tools" | "verification" | "iteration"; inputHash: string }>;
  counters: Readonly<{ iterations: number; modelCalls: number; reservedTokens: number; repairAttempts: number }>;
  state: Readonly<Record<string, unknown>>; hash: string;
}>;
export type TaskContinuationInput = Omit<TaskContinuation, "hash">;
const phases = new Set(["prepared", "planning", "awaiting_confirmation", "running", "paused", "verifying", "completed", "failed", "cancelled", "unknown"]);
const hashPattern = /^sha256:[0-9a-f]{64}$/u;
const tokens = /^[A-Za-z0-9_-]{1,128}$/u;
const terminal = new Set(["completed", "failed", "cancelled", "unknown"]);
const safe = new Set(["prepared", "awaiting_confirmation", "paused"]);
export const MAX_CONTINUATION_BYTES = 10 * 1024 * 1024;
export const MAX_RETAINED_QUEUE_BYTES = 80 * 1024 * 1024;
export const MAX_RETAINED_TASKS = 64;

export function continuationError(code = "INVALID", statusCode = 409): Error & { code: string; statusCode: number } {
  return Object.assign(new Error("Retained task checkpoint could not be safely accepted."), { code: "TASK_CONTINUATION_" + code, statusCode });
}

/** Data only: an imported checkpoint cannot mint a claim or an Agent execution lease. */
export function createTaskContinuation(value: TaskContinuationInput): TaskContinuation {
  const copy = jsonCopy(value) as Record<string, unknown>;
  exact(copy, ["version", "revision", "bindingHash", "inputHash", "phase", "pendingOperation", "counters", "state"]);
  if (copy.version !== 1 || !integer(copy.revision) || typeof copy.bindingHash !== "string" || !hashPattern.test(copy.bindingHash)
    || typeof copy.inputHash !== "string" || !hashPattern.test(copy.inputHash) || typeof copy.phase !== "string" || !phases.has(copy.phase)) throw continuationError();
  exact(copy.counters, ["iterations", "modelCalls", "reservedTokens", "repairAttempts"]);
  if (!Object.values(copy.counters as object).every(integer)) throw continuationError();
  if (copy.pendingOperation !== null) {
    exact(copy.pendingOperation, ["id", "kind", "inputHash"]);
    const pending = copy.pendingOperation as Record<string, unknown>;
    if (typeof pending.id !== "string" || !tokens.test(pending.id) || typeof pending.kind !== "string"
      || !["provider", "tools", "verification", "iteration"].includes(pending.kind)
      || typeof pending.inputHash !== "string" || !hashPattern.test(pending.inputHash) || safe.has(copy.phase) || copy.phase === "completed") throw continuationError();
  }
  if (!isRecord(copy.state)) throw continuationError();
  const serialized = JSON.stringify(copy);
  if (Buffer.byteLength(serialized) > MAX_CONTINUATION_BYTES) throw continuationError("TOO_LARGE", 413);
  const result = { ...copy, hash: "sha256:" + createHash("sha256").update(serialized).digest("hex") };
  if (Buffer.byteLength(JSON.stringify(result)) > MAX_CONTINUATION_BYTES) throw continuationError("TOO_LARGE", 413);
  return freeze(result) as TaskContinuation;
}

export function readTaskContinuation(value: unknown): TaskContinuation {
  const copy = jsonCopy(value);
  if (!isRecord(copy) || typeof copy.hash !== "string") throw continuationError();
  const { hash, ...body } = copy;
  const parsed = createTaskContinuation(body as TaskContinuationInput);
  if (hash !== parsed.hash) throw continuationError("INTEGRITY");
  return parsed;
}

export function advanceTaskContinuation(previous: unknown, next: unknown): TaskContinuation {
  const before = readTaskContinuation(previous), after = readTaskContinuation(next);
  if (terminal.has(before.phase) || after.revision !== before.revision + 1 || after.bindingHash !== before.bindingHash
    || after.inputHash !== before.inputHash || Object.keys(before.counters).some(key =>
      after.counters[key as keyof typeof after.counters] < before.counters[key as keyof typeof before.counters])) throw continuationError("CONFLICT");
  if (before.pendingOperation && after.pendingOperation && JSON.stringify(before.pendingOperation) !== JSON.stringify(after.pendingOperation)) throw continuationError("PENDING_EFFECT");
  return after;
}

export function continuationMayClaim(value: unknown): boolean {
  const checkpoint = readTaskContinuation(value);
  return safe.has(checkpoint.phase) && checkpoint.pendingOperation === null;
}

export function interruptedContinuation(value: unknown): TaskContinuation {
  const before = readTaskContinuation(value);
  if (terminal.has(before.phase)) return before;
  return createTaskContinuation({ ...withoutHash(before), revision: before.revision + 1,
    phase: before.pendingOperation ? "unknown" : "paused" });
}

export function continuationJsonCopy<T>(value: T): T { return jsonCopy(value) as T; }
function withoutHash({ hash: _hash, ...body }: TaskContinuation): TaskContinuationInput { return body; }
function integer(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 0; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function exact(value: unknown, keys: string[]): void {
  if (!isRecord(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) throw continuationError();
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function jsonCopy(value: unknown): unknown {
  let nodes = 0;
  const seen = new Set<object>();
  const visit = (item: unknown, depth: number): unknown => {
    if (++nodes > 50_000 || depth > 32) throw continuationError("TOO_LARGE", 413);
    if (item === null || typeof item === "boolean" || typeof item === "string") return item;
    if (typeof item === "number" && Number.isFinite(item)) return item;
    if (!item || typeof item !== "object" || seen.has(item) || Reflect.ownKeys(item).some(key => typeof key !== "string")) throw continuationError();
    if (!Array.isArray(item) && ![Object.prototype, null].includes(Object.getPrototypeOf(item))) throw continuationError();
    seen.add(item);
    const keys = Object.keys(item).sort();
    for (const key of keys) if (!Object.hasOwn(Object.getOwnPropertyDescriptor(item, key) ?? {}, "value")) throw continuationError();
    let result: unknown;
    if (Array.isArray(item)) {
      if (keys.length !== item.length || keys.some(key => !/^(0|[1-9][0-9]*)$/u.test(key))) throw continuationError();
      result = item.map(child => visit(child, depth + 1));
    } else {
      result = Object.fromEntries(keys.map(key => [key, visit((item as Record<string, unknown>)[key], depth + 1)]));
    }
    seen.delete(item);
    return result;
  };
  const result = visit(value, 0);
  if (Buffer.byteLength(JSON.stringify(result)) > MAX_CONTINUATION_BYTES) throw continuationError("TOO_LARGE", 413);
  return result;
}
