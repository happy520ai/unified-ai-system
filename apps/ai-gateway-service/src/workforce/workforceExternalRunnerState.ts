import { readWorkforceExternalRunnerReview, externalRunnerHash as hash, externalRunnerError as failure } from "./workforceExternalRunnerProfile.ts";
import type { WorkforceExternalRunnerReview } from "@unified-ai-system/shared-contracts";
import { createHash } from "node:crypto";

type Data = Record<string, any>;
export type ExternalRunnerMetadata = { version: 1; agentId: string; planId: string; planDigest: string; review: WorkforceExternalRunnerReview };
export type ExternalRunnerStatus = "prepared" | "starting" | "thread_ready" | "dispatching" | "running" | "native_completed" | "verifying" | "verified" | "failed" | "cancelled" | "unknown";
type TokenBreakdown = { inputTokens: number; cachedInputTokens: number; cacheWriteInputTokens: number; outputTokens: number; reasoningOutputTokens: number; totalTokens: number };
export type ExternalRunnerNativeUsage = { source: "native-thread-notification"; final: false; turnId: string; total: TokenBreakdown; last: TokenBreakdown; modelContextWindow: number | null };
export type ExternalRunnerState = {
  version: 1; operationId: string; executionId: string; taskId: string; agentId: string; planId: string; reviewHash: string;
  tenantFingerprint: string; subjectFingerprint: string; clientUserMessageId: string;
  worktree: { worktreeId: string; path: string; directoryHash: string; baselineRevision: string; sourceFilesHash: string };
  sequence: number; previousHash: string | null; stateHash: string; status: ExternalRunnerStatus;
  threadId: string | null; turnId: string | null; nativeStatus: "none" | "inProgress" | "completed" | "failed" | "interrupted" | "unknown";
  processIdentity: { kind: "windows-job" | "posix-process-group"; hostPid: number; childPid: number; hostCreated: string | null; childCreated: string | null } | null;
  ownerProcess: { pid: number; created: string } | null;
  recoveryProcesses: Array<{ identity: ExternalRunnerState["processIdentity"]; closed: boolean }>;
  fileApprovals: Array<{ itemId: string; changesHash: string; beforeFilesHash: string; completedFilesHash: string | null }>;
  nativeUsage: ExternalRunnerNativeUsage | null;
  processClosed: boolean; eventsObserved: number; eventsHash: string; lastEvent: { method: string; itemId: string | null; itemType: string | null } | null;
  startedAt: string; updatedAt: string; artifact: Data | null; verification: Data | null;
  error: { code: string; outcomeUnknown: boolean } | null;
};
const branded = new WeakSet<object>();
const STATUS = new Set<ExternalRunnerStatus>(["prepared", "starting", "thread_ready", "dispatching", "running", "native_completed", "verifying", "verified", "failed", "cancelled", "unknown"]);
const NEXT: Record<ExternalRunnerStatus, readonly ExternalRunnerStatus[]> = {
  prepared: ["starting"], starting: ["thread_ready"], thread_ready: ["dispatching"], dispatching: ["running", "native_completed"],
  running: ["native_completed"], native_completed: ["verifying"], verifying: ["verified"], verified: [], failed: [], cancelled: [], unknown: [],
};
const BINDING_KEYS = ["version", "operationId", "executionId", "taskId", "agentId", "planId", "reviewHash", "tenantFingerprint", "subjectFingerprint", "clientUserMessageId", "worktree", "ownerProcess", "startedAt"];
const KEYS = [...BINDING_KEYS, "sequence", "previousHash", "stateHash", "status", "threadId", "turnId", "nativeStatus", "processIdentity", "recoveryProcesses", "fileApprovals", "nativeUsage", "processClosed", "eventsObserved", "eventsHash", "lastEvent", "updatedAt", "artifact", "verification", "error"];
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value);
const digest = (value: unknown): value is string => typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);
const rawHash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const date = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const bad = () => failure("WORKFORCE_EXTERNAL_RUNNER_STATE_INVALID", "The original native runner record is missing, changed or belongs to another task.");
const plain = (value: unknown): value is Data => Boolean(value && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
function record(value: unknown, keys: readonly string[]): Data {
  if (!plain(value) || Reflect.ownKeys(value).length !== keys.length) throw bad();
  return Object.fromEntries(Reflect.ownKeys(value).map(key => {
    const field = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || !keys.includes(key) || !field?.enumerable || !("value" in field)) throw bad();
    return [key, field.value];
  }));
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
  return value;
}
/** Native counters are observations, never Gateway billing or inferred request counts. */
export function readExternalRunnerNativeUsage(value: unknown, turnId: string): ExternalRunnerNativeUsage {
  const usage = record(value, ["last", "total", "modelContextWindow"]);
  const keys = ["inputTokens", "cachedInputTokens", "cacheWriteInputTokens", "outputTokens", "reasoningOutputTokens", "totalTokens"];
  const breakdown = (value: unknown): TokenBreakdown => {
    if (!plain(value)) throw bad();
    const checked = { cacheWriteInputTokens: 0, ...record(value, Object.hasOwn(value, "cacheWriteInputTokens") ? keys : keys.filter(key => key !== "cacheWriteInputTokens")) };
    if (Object.values(checked).some(count => !Number.isSafeInteger(count) || count < 0)) throw bad();
    return checked as TokenBreakdown;
  };
  if (!id(turnId) || usage.modelContextWindow !== null && (!Number.isSafeInteger(usage.modelContextWindow) || usage.modelContextWindow < 0)) throw bad();
  return freeze({ source: "native-thread-notification", final: false, turnId, total: breakdown(usage.total), last: breakdown(usage.last), modelContextWindow: usage.modelContextWindow });
}
export function externalRunnerOwner(kind: "tenant" | "subject", tenantId: string, userId?: string): string {
  return "sha256:" + createHash("sha256").update(kind === "tenant" ? tenantId : userId ?? "").digest("hex");
}
export function createExternalRunnerMetadata(input: Omit<ExternalRunnerMetadata, "version">): ExternalRunnerMetadata {
  return readExternalRunnerMetadata({ version: 1, ...input });
}
export function readExternalRunnerMetadata(value: unknown): ExternalRunnerMetadata {
  const source = record(value, ["version", "agentId", "planId", "planDigest", "review"]);
  if (source.version !== 1 || !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(source.agentId) || !id(source.planId) || !rawHash(source.planDigest)) throw bad();
  return freeze({ ...source, review: readWorkforceExternalRunnerReview(source.review) }) as ExternalRunnerMetadata;
}
export function readExternalRunnerState(value: unknown, expected: { executionId: string; metadata: ExternalRunnerMetadata }): ExternalRunnerState {
  const source = record(value, KEYS), metadata = readExternalRunnerMetadata(expected.metadata), worktree = record(source.worktree, ["worktreeId", "path", "directoryHash", "baselineRevision", "sourceFilesHash"]);
  if (source.version !== 1 || source.executionId !== expected.executionId || source.agentId !== metadata.agentId || source.planId !== metadata.planId
    || source.reviewHash !== metadata.review.reviewHash || !id(source.taskId) || !id(source.executionId)
    || source.operationId !== "wfr_" + hash([source.executionId, source.taskId, source.reviewHash]).slice(7)
    || ![source.tenantFingerprint, source.subjectFingerprint, source.eventsHash].every(digest)
    || !/^([a-f0-9]{8}-){1}[a-f0-9]{4}-5[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/u.test(source.clientUserMessageId)
    || !Number.isSafeInteger(source.sequence) || source.sequence < 0 || source.sequence > 10000
    || (source.sequence === 0 ? source.previousHash !== null : !digest(source.previousHash)) || !STATUS.has(source.status)
    || ![source.threadId, source.turnId].every(v => v === null || id(v)) || source.turnId !== null && source.threadId === null
    || !["none", "inProgress", "completed", "failed", "interrupted", "unknown"].includes(source.nativeStatus)
    || typeof source.processClosed !== "boolean" || !Number.isSafeInteger(source.eventsObserved) || source.eventsObserved < 0
    || source.eventsObserved > metadata.review.profile.limits.maxEvents || !date(source.startedAt) || !date(source.updatedAt)
    || Date.parse(source.updatedAt) < Date.parse(source.startedAt)
    || !id(worktree.worktreeId) || typeof worktree.path !== "string" || !worktree.path || worktree.path.length > 4096 || /[\u0000-\u001f\u007f]/u.test(worktree.path)
    || !digest(worktree.directoryHash) || worktree.baselineRevision !== metadata.review.profile.baselineRevision || worktree.sourceFilesHash !== metadata.review.sourceFilesHash) throw bad();
  if (source.lastEvent !== null) {
    const event = record(source.lastEvent, ["method", "itemId", "itemType"]);
    if (typeof event.method !== "string" || !/^[A-Za-z][A-Za-z0-9/_-]{0,127}$/u.test(event.method)
      || event.itemId !== null && !id(event.itemId) || event.itemType !== null && !/^[A-Za-z][A-Za-z0-9]{0,79}$/u.test(event.itemType)) throw bad();
  }
  const checkProcess = (value: unknown) => {
    const process = record(value, ["kind", "hostPid", "childPid", "hostCreated", "childCreated"]);
    if (!["windows-job", "posix-process-group"].includes(process.kind)
      || ![process.hostPid, process.childPid].every(id => Number.isSafeInteger(id) && id > 0 && id <= 0xffffffff)
      || ![process.hostCreated, process.childCreated].every(time => process.kind === "windows-job" ? typeof time === "string" && /^[1-9][0-9]{0,19}$/u.test(time) : time === null)) throw bad();
  };
  if (source.processIdentity !== null) checkProcess(source.processIdentity);
  if (source.ownerProcess !== null) {
    const owner = record(source.ownerProcess, ["pid", "created"]);
    if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0 || owner.pid > 0xffffffff || typeof owner.created !== "string" || !/^[1-9][0-9]{0,19}$/u.test(owner.created)) throw bad();
  }
  if (!Array.isArray(source.recoveryProcesses) || source.recoveryProcesses.length > 16) throw bad();
  for (let index = 0; index < source.recoveryProcesses.length; index++) {
    const observer = record(source.recoveryProcesses[index], ["identity", "closed"]);
    if (observer.identity !== null) checkProcess(observer.identity);
    if (typeof observer.closed !== "boolean" || observer.identity === null && observer.closed || !observer.closed && index !== source.recoveryProcesses.length - 1) throw bad();
  }
  if (source.error !== null) {
    const error = record(source.error, ["code", "outcomeUnknown"]);
    if (typeof error.code !== "string" || !/^[A-Z][A-Z0-9_]{0,127}$/u.test(error.code) || typeof error.outcomeUnknown !== "boolean") throw bad();
  }
  if (!Array.isArray(source.fileApprovals) || source.fileApprovals.length > 64) throw bad();
  if (source.nativeUsage !== null) {
    const usage = record(source.nativeUsage, ["source", "final", "turnId", "total", "last", "modelContextWindow"]);
    if (usage.source !== "native-thread-notification" || usage.final !== false || usage.turnId !== source.turnId
      || hash(source.nativeUsage) !== hash(readExternalRunnerNativeUsage({ total: usage.total, last: usage.last, modelContextWindow: usage.modelContextWindow }, usage.turnId))) throw bad();
  }
  const approvedIds = new Set();
  let previousFilesHash = metadata.review.sourceFilesHash;
  for (let index = 0; index < source.fileApprovals.length; index++) {
    const approval = record(source.fileApprovals[index], ["itemId", "changesHash", "beforeFilesHash", "completedFilesHash"]);
    if (!id(approval.itemId) || approvedIds.has(approval.itemId) || !digest(approval.changesHash)
      || approval.beforeFilesHash !== previousFilesHash || !rawHash(approval.beforeFilesHash)
      || approval.completedFilesHash !== null && !rawHash(approval.completedFilesHash)
      || approval.completedFilesHash === null && index !== source.fileApprovals.length - 1) throw bad();
    approvedIds.add(approval.itemId); previousFilesHash = approval.completedFilesHash;
  }
  if (source.artifact !== null && (!plain(source.artifact) || !rawHash(source.artifact.diffSha256) || !Array.isArray(source.artifact.filesChanged))
    || source.verification !== null && (!plain(source.verification) || typeof source.verification.passed !== "boolean")) throw bad();
  if (source.status === "verified" && (source.nativeStatus !== "completed" || !source.threadId || !source.turnId || !source.processClosed
    || source.processIdentity === null || source.ownerProcess === null || source.recoveryProcesses.some(observer => !observer.closed)
    || source.artifact === null || source.verification?.passed !== true || source.error !== null
    || !source.fileApprovals.length || previousFilesHash !== source.artifact.sourceFilesHash)) throw bad();
  const { stateHash, ...body } = source;
  if (stateHash !== hash(body)) throw bad();
  return freeze(JSON.parse(JSON.stringify(source))) as ExternalRunnerState;
}

/** A JSON status is display data. Only this record producer can append to the original lifecycle. */
export function createExternalRunnerState(input: { executionId: string; taskId: string; metadata: ExternalRunnerMetadata;
  identity: { tenantId: string; userId: string }; worktree: ExternalRunnerState["worktree"]; ownerProcess?: ExternalRunnerState["ownerProcess"] }): ExternalRunnerState {
  const metadata = readExternalRunnerMetadata(input.metadata), now = new Date().toISOString();
  const operationHash = hash([input.executionId, input.taskId, metadata.review.reviewHash]).slice(7);
  const body = { version: 1, operationId: "wfr_" + operationHash, executionId: input.executionId, taskId: input.taskId,
    agentId: metadata.agentId, planId: metadata.planId, reviewHash: metadata.review.reviewHash,
    tenantFingerprint: externalRunnerOwner("tenant", input.identity.tenantId), subjectFingerprint: externalRunnerOwner("subject", input.identity.tenantId, input.identity.userId),
    clientUserMessageId: `${operationHash.slice(0,8)}-${operationHash.slice(8,12)}-5${operationHash.slice(13,16)}-a${operationHash.slice(17,20)}-${operationHash.slice(20,32)}`,
    worktree: input.worktree, sequence: 0, previousHash: null, status: "prepared", threadId: null, turnId: null, nativeStatus: "none", processIdentity: null,
    ownerProcess: input.ownerProcess ?? null, recoveryProcesses: [], fileApprovals: [], nativeUsage: null, processClosed: true,
    eventsObserved: 0, eventsHash: hash([]), lastEvent: null, startedAt: now, updatedAt: now, artifact: null, verification: null, error: null };
  const value = readExternalRunnerState({ ...body, stateHash: hash(body) }, { executionId: input.executionId, metadata }); branded.add(value); return value;
}
export function advanceExternalRunnerState(previous: ExternalRunnerState, metadata: ExternalRunnerMetadata,
  patch: Partial<Pick<ExternalRunnerState, "status" | "threadId" | "turnId" | "nativeStatus" | "processIdentity" | "recoveryProcesses" | "fileApprovals" | "nativeUsage" | "processClosed" | "eventsObserved" | "eventsHash" | "lastEvent" | "artifact" | "verification" | "error">>,
  options: { reconcileOriginal?: boolean } = {}): ExternalRunnerState {
  const checked = readExternalRunnerState(previous, { executionId: previous.executionId, metadata });
  const next = patch.status ?? checked.status;
  const reconcile = options.reconcileOriginal === true && ["failed", "cancelled", "unknown"].includes(checked.status)
    && next === "native_completed" && patch.nativeStatus === "completed" && checked.threadId && checked.turnId;
  if (next !== checked.status && !NEXT[checked.status].includes(next) && !["failed", "cancelled", "unknown"].includes(next) && !reconcile) throw bad();
  if (Object.keys(patch).some(key => !["status", "threadId", "turnId", "nativeStatus", "processIdentity", "recoveryProcesses", "fileApprovals", "nativeUsage", "processClosed", "eventsObserved", "eventsHash", "lastEvent", "artifact", "verification", "error"].includes(key))
    || patch.threadId !== undefined && checked.threadId !== null && patch.threadId !== checked.threadId
    || patch.turnId !== undefined && checked.turnId !== null && patch.turnId !== checked.turnId
    || patch.processIdentity !== undefined && checked.processIdentity !== null && hash(patch.processIdentity) !== hash(checked.processIdentity)
    || patch.eventsObserved !== undefined && patch.eventsObserved < checked.eventsObserved || checked.status === "verified") throw bad();
  if (patch.fileApprovals !== undefined && (patch.fileApprovals.length < checked.fileApprovals.length
    || checked.fileApprovals.some((entry, index) => {
      const nextEntry = patch.fileApprovals![index];
      return !nextEntry || entry.itemId !== nextEntry.itemId || entry.changesHash !== nextEntry.changesHash
        || entry.beforeFilesHash !== nextEntry.beforeFilesHash || entry.completedFilesHash !== null && nextEntry.completedFilesHash !== entry.completedFilesHash;
    }))) throw bad();
  if (patch.recoveryProcesses !== undefined && (patch.recoveryProcesses.length < checked.recoveryProcesses.length
    || checked.recoveryProcesses.some((entry, index) => {
      const nextEntry = patch.recoveryProcesses![index];
      return !nextEntry || entry.identity !== null && hash(entry.identity) !== hash(nextEntry.identity) || entry.closed && !nextEntry.closed;
    }))) throw bad();
  const { stateHash: previousHash, ...oldBody } = checked;
  const body = { ...oldBody, ...patch, sequence: checked.sequence + 1, previousHash, updatedAt: new Date().toISOString() };
  const value = readExternalRunnerState({ ...body, stateHash: hash(body) }, { executionId: checked.executionId, metadata }); branded.add(value); return value;
}
export function attachExternalRunnerState(lifecycle: Data, executionId: string, value: unknown): Data {
  if (!value || typeof value !== "object" || !branded.has(value) || !lifecycle?.metadata?.externalRunner) throw bad();
  const metadata = readExternalRunnerMetadata(lifecycle.metadata.externalRunner), next = readExternalRunnerState(value, { executionId, metadata });
  if (lifecycle.metadata.tenantFingerprint !== "idfp_" + next.tenantFingerprint.slice(7, 23) || lifecycle.metadata.subjectFingerprint !== "idfp_" + next.subjectFingerprint.slice(7, 23)) throw bad();
  const previous = lifecycle.summary?.externalRunnerState;
  if (previous) {
    const checked = readExternalRunnerState(previous, { executionId, metadata });
    if (next.sequence !== checked.sequence + 1 || next.previousHash !== checked.stateHash
      || BINDING_KEYS.some(key => hash(next[key as keyof ExternalRunnerState]) !== hash(checked[key as keyof ExternalRunnerState]))) throw bad();
  } else if (next.sequence !== 0 || next.previousHash !== null) throw bad();
  return { ...(lifecycle.summary ?? {}), externalRunnerState: next };
}
export function externalRunnerLifecycleProjection(lifecycle: Data, executionId: string): Data {
  if (!lifecycle.metadata?.externalRunner) return {};
  const metadata = readExternalRunnerMetadata(lifecycle.metadata.externalRunner);
  const state = lifecycle.summary?.externalRunnerState ? readExternalRunnerState(lifecycle.summary.externalRunnerState, { executionId, metadata }) : null;
  if (state && (lifecycle.metadata.tenantFingerprint !== "idfp_" + state.tenantFingerprint.slice(7, 23) || lifecycle.metadata.subjectFingerprint !== "idfp_" + state.subjectFingerprint.slice(7, 23))) throw bad();
  return { externalRunner: { metadata, state } };
}
export function preserveExternalRunnerSummary(lifecycle: Data, executionId: string, summary: unknown): any {
  if (!lifecycle.metadata?.externalRunner) return summary;
  if (!plain(summary)) throw bad();
  const { externalRunnerState: _untrusted, ...ordinary } = summary;
  const saved = externalRunnerLifecycleProjection(lifecycle, executionId).externalRunner.state;
  return { ...ordinary, ...(saved ? { externalRunnerState: saved } : {}) };
}
