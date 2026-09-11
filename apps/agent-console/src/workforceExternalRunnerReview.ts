import { createHash } from "node:crypto";
import { posix, win32 } from "node:path";
import type { WorkforceExternalRunnerReview } from "@unified-ai-system/shared-contracts";
import { projectWorkforceCodeDeliveryProfile } from "./workforceCodeDeliveryReview.ts";

type Data = Record<string, any>;
const PROFILE = ["version", "mode", "profileId", "projectId", "roleId", "baselineRevision", "binary", "nativeModel", "disabledMcpServers", "limits", "artifact", "profileHash"];
const STATE = ["version", "operationId", "executionId", "taskId", "agentId", "planId", "reviewHash", "tenantFingerprint", "subjectFingerprint", "clientUserMessageId", "worktree",
  "sequence", "previousHash", "stateHash", "status", "threadId", "turnId", "nativeStatus", "processIdentity", "ownerProcess", "recoveryProcesses", "processClosed", "eventsObserved", "eventsHash", "lastEvent", "startedAt", "updatedAt", "artifact", "verification", "error", "fileApprovals", "nativeUsage"];
const STATUS = ["prepared", "starting", "thread_ready", "dispatching", "running", "native_completed", "verifying", "verified", "failed", "cancelled", "unknown"];
const SECRET = /\b(?:xox[abprs]-[A-Za-z0-9-]{10,}|xapp-[A-Za-z0-9-]{20,}|(?:sk_live_|rk_live_|whsec_)[A-Za-z0-9]{16,}|npm_[A-Za-z0-9]{20,}|tp-[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{12,}|sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|hf_[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b|\bAuthorization\s*:\s*(?:Bearer|Basic)\s+\S{8,}|\b[A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PRIVATE[_-]?KEY|ACCESS[_-]?KEY)[A-Z0-9_]*\s*[:=]\s*["']?[^\s"'<>#,;]{4,}|\b[a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:[^@\s/]+@|-----BEGIN [A-Z ]*PRIVATE KEY-----/iu;
const rawHash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const digest = (value: unknown): value is string => typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);
const sha = (value: string) => "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");
const hash = (value: unknown) => sha(stable(value));
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value);
function invalid(): never { throw new Error("Invalid or incomplete Workforce external runner review or original result."); }

/** Transport validation only; retains every approved prompt byte and confers no native execution authority. */
export function projectWorkforceExternalRunnerReview(value: unknown): WorkforceExternalRunnerReview {
  const source = record(value, ["version", "profile", "configuredRepositoryHash", "goal", "prompt", "sourceFilesHash", "reviewHash"]);
  const profile = record(source.profile, PROFILE), binary = record(profile.binary, ["path", "sha256", "version", "platform"]);
  const model = record(profile.nativeModel, ["modelId", "providerId"]), limits = record(profile.limits, ["timeoutMs", "maxInputBytes", "maxMessageBytes", "maxEvents"]);
  const artifact = record(profile.artifact, ["readPaths", "writePaths", "verification", "artifactLimits"]);
  if (source.version !== 1 || profile.version !== 1 || profile.mode !== "codex-app-server-owned-worktree" || profile.roleId !== "backend-engineer"
    || typeof profile.baselineRevision !== "string" || !/^[a-f0-9]{40}$/u.test(profile.baselineRevision)
    || binary.version !== "0.153.4" || !["win32", "linux", "darwin"].includes(binary.platform) || !rawHash(binary.sha256)) invalid();
  for (const field of [profile.profileId, profile.projectId]) identifier(field);
  for (const field of [model.modelId, model.providerId]) identifier(field, true);
  const path = text(binary.path, 4096), windows = binary.platform === "win32", api = windows ? win32 : posix;
  if (!api.isAbsolute(path) || api.normalize(path) !== path || (windows ? !/^[A-Za-z]:\\/u.test(path) : path.startsWith("//"))
    || (windows ? api.basename(path).toLowerCase() !== "codex.exe" : api.basename(path) !== "codex")
    || path.slice(windows ? 3 : 1).split(windows ? /[\\/]/u : /\//u).some(part => !part || part === "." || part === ".."
      || windows && (/[. ]$/u.test(part) || /[:*?<>|]/u.test(part)))) invalid();
  const disabled = array(profile.disabledMcpServers, 64).map(value => identifier(value));
  if (new Set(disabled).size !== disabled.length || stable(disabled) !== stable([...disabled].sort())) invalid();
  integer(limits.timeoutMs, 5000, 600000); integer(limits.maxInputBytes, 1024, 524288);
  integer(limits.maxMessageBytes, 1024, 1048576); integer(limits.maxEvents, 16, 2048);
  const filePolicy = { version: 1, mode: "forge-owned-worktree-artifact", profileId: profile.profileId,
    projectId: profile.projectId, roleId: profile.roleId, baselineRevision: profile.baselineRevision, ...artifact };
  const parsed = projectWorkforceCodeDeliveryProfile({ ...filePolicy, profileHash: hash(filePolicy) });
  if (stable(artifact) !== stable({ readPaths: parsed.readPaths, writePaths: parsed.writePaths, verification: parsed.verification, artifactLimits: parsed.artifactLimits })) invalid();
  const { profileHash, ...profileBody } = profile;
  if (profileHash !== hash(profileBody) || !digest(source.configuredRepositoryHash) || !rawHash(source.sourceFilesHash)) invalid();
  text(source.goal, 4000, true); text(source.prompt, limits.maxInputBytes, true);
  if (Buffer.byteLength(source.prompt, "utf8") > limits.maxInputBytes) invalid();
  const { reviewHash, ...body } = source;
  if (reviewHash !== hash(body)) invalid();
  return freeze(JSON.parse(JSON.stringify(source))) as WorkforceExternalRunnerReview;
}

export function projectWorkforceExternalRunnerApproval(value: unknown): Data {
  const body = record(value, ["goal", "goalDigest", "goalBytes", "planId", "planDigest", "autonomyMode", "requiredScopes", "optionsHash", "options"]);
  const options = record(body.options, ["selectedRoleCount", "templateSelected", "externalRunner"]);
  const review = projectWorkforceExternalRunnerReview(options.externalRunner);
  const scopes = array(body.requiredScopes, 8);
  if (body.goal !== review.goal || body.goalDigest !== sha(review.goal) || body.goalBytes !== Buffer.byteLength(review.goal, "utf8")
    || !digest(body.planDigest) || typeof body.planId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(body.planId)
    || !["dry-run", "controlled-execution"].includes(body.autonomyMode) || body.optionsHash !== hash(options)
    || typeof options.templateSelected !== "boolean" || new Set(scopes).size !== scopes.length
    || scopes.some(scope => typeof scope !== "string" || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/u.test(scope))) invalid();
  integer(options.selectedRoleCount, 1, 128);
  if (stable(scopes) !== stable(body.autonomyMode === "dry-run" ? [] : ["workforce:execute"])) invalid();
  return freeze({ ...body, options: { ...options, externalRunner: review } });
}

export function formatWorkforceExternalRunnerReview(review: WorkforceExternalRunnerReview): string[] {
  return ["Native code execution: one reviewed Codex turn in its original owned worktree.",
    "Complete native profile (expected model metadata is not a model override):", JSON.stringify(review.profile, null, 2),
    `Repository configuration hash: ${review.configuredRepositoryHash}; source files hash: ${review.sourceFilesHash}`,
    `Native review hash: ${review.reviewHash}`, `Complete native prompt (${Buffer.byteLength(review.prompt, "utf8")} UTF-8 bytes):`,
    review.prompt, "End of complete native prompt.", "Recovery reads the original task and can revalidate its artifact; it never dispatches another native turn or automatically resumes the parent."];
}

/** Verify the complete response before displaying its status; no hash is treated as standalone execution authority. */
export function projectWorkforceExternalRunnerState(value: unknown, executionId: string, expected?: { operationId: string; agentId: string }): Data {
  const state = record(value, STATE), worktree = record(state.worktree, ["worktreeId", "path", "directoryHash", "baselineRevision", "sourceFilesHash"]);
  const { stateHash, ...stateBody } = state;
  if (state.version !== 1 || state.executionId !== executionId || !STATUS.includes(state.status) || stateHash !== hash(stateBody)
    || ![state.operationId, state.executionId, state.taskId, state.planId].every(id) || !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(state.agentId)
    || ![state.reviewHash, state.tenantFingerprint, state.subjectFingerprint, state.eventsHash, worktree.directoryHash].every(digest)
    || state.operationId !== "wfr_" + hash([state.executionId, state.taskId, state.reviewHash]).slice(7)
    || expected && (state.operationId !== expected.operationId || state.agentId !== expected.agentId)
    || ![state.threadId, state.turnId].every(item => item === null || id(item)) || state.turnId !== null && state.threadId === null
    || !["none", "inProgress", "completed", "failed", "interrupted", "unknown"].includes(state.nativeStatus)
    || typeof state.processClosed !== "boolean" || !id(worktree.worktreeId) || !rawHash(worktree.sourceFilesHash)
    || typeof worktree.baselineRevision !== "string" || !/^[a-f0-9]{40}$/u.test(worktree.baselineRevision)) invalid();
  integer(state.sequence, 0, 10000); integer(state.eventsObserved, 0, 2048); text(worktree.path, 4096);
  if (state.sequence === 0 ? state.previousHash !== null : !digest(state.previousHash)) invalid();
  for (const stamp of [state.startedAt, state.updatedAt]) if (typeof stamp !== "string" || !Number.isFinite(Date.parse(stamp)) || new Date(stamp).toISOString() !== stamp) invalid();
  if (Date.parse(state.updatedAt) < Date.parse(state.startedAt)) invalid();
  if (state.error !== null) { const error = record(state.error, ["code", "outcomeUnknown"]);
    if (typeof error.code !== "string" || !/^[A-Z][A-Z0-9_]{0,127}$/u.test(error.code) || typeof error.outcomeUnknown !== "boolean") invalid(); }
  const checkProcess = (value: unknown): Data => {
    const process = record(value, ["kind", "hostPid", "childPid", "hostCreated", "childCreated"]);
    if (!["windows-job", "posix-process-group"].includes(process.kind)) invalid();
    integer(process.hostPid, 1, 0xffffffff); integer(process.childPid, 1, 0xffffffff);
    for (const created of [process.hostCreated, process.childCreated]) {
      if (process.kind === "windows-job" ? typeof created !== "string" || !/^[1-9][0-9]{0,19}$/u.test(created) : created !== null) invalid();
    }
    return process;
  };
  if (state.processIdentity !== null) checkProcess(state.processIdentity);
  const ownerProcess = state.ownerProcess === null ? null : record(state.ownerProcess, ["pid", "created"]);
  if (ownerProcess) { integer(ownerProcess.pid, 1, 0xffffffff);
    if (typeof ownerProcess.created !== "string" || !/^[1-9][0-9]{0,19}$/u.test(ownerProcess.created)) invalid(); }
  const recoveryProcesses = array(state.recoveryProcesses, 16).map(value => record(value, ["identity", "closed"]));
  recoveryProcesses.forEach((observer, index) => {
    if (observer.identity !== null) observer.identity = checkProcess(observer.identity);
    if (typeof observer.closed !== "boolean" || observer.identity === null && observer.closed
      || !observer.closed && index !== recoveryProcesses.length - 1) invalid();
  });
  let nativeUsage: Data | null = null;
  if (state.nativeUsage !== null) {
    nativeUsage = record(state.nativeUsage, ["source", "final", "turnId", "total", "last", "modelContextWindow"]);
    if (nativeUsage.source !== "native-thread-notification" || nativeUsage.final !== false || nativeUsage.turnId !== state.turnId || !id(nativeUsage.turnId)) invalid();
    for (const counts of [nativeUsage.total, nativeUsage.last]) {
      const fields = record(counts, ["inputTokens", "cachedInputTokens", "cacheWriteInputTokens", "outputTokens", "reasoningOutputTokens", "totalTokens"]);
      Object.values(fields).forEach(value => integer(value, 0, Number.MAX_SAFE_INTEGER));
    }
    if (nativeUsage.modelContextWindow !== null) integer(nativeUsage.modelContextWindow, 0, Number.MAX_SAFE_INTEGER);
  }
  const approvals = array(state.fileApprovals, 64).map(item => record(item, ["itemId", "changesHash", "beforeFilesHash", "completedFilesHash"]));
  if (new Set(approvals.map(item => item.itemId)).size !== approvals.length || approvals.some(item => !id(item.itemId) || !digest(item.changesHash)
    || !rawHash(item.beforeFilesHash) || item.completedFilesHash !== null && !rawHash(item.completedFilesHash))) invalid();
  if (state.status === "verified") {
    const artifact = record(state.artifact, ["version", "profileHash", "sourceFilesHash", "diffSha256", "diffBytes", "filesChanged"]);
    const verification = record(state.verification, ["status", "command", "image", "snapshotHash", "exitCode", "cleanupConfirmed", "stdout", "stderr", "passed"]);
    if (state.nativeStatus !== "completed" || !state.threadId || !state.turnId || !state.processClosed || state.processIdentity === null
      || ownerProcess === null || recoveryProcesses.some(observer => !observer.closed) || state.error !== null
      || verification.passed !== true || verification.status !== "passed" || verification.exitCode !== 0 || verification.cleanupConfirmed !== true
      || artifact.version !== 1 || !digest(artifact.profileHash) || !rawHash(artifact.sourceFilesHash) || !rawHash(artifact.diffSha256)
      || verification.snapshotHash !== artifact.sourceFilesHash || approvals.length < 1) invalid();
    let sourceHash = worktree.sourceFilesHash;
    for (const approved of approvals) { if (approved.beforeFilesHash !== sourceHash || !approved.completedFilesHash) invalid(); sourceHash = approved.completedFilesHash; }
    if (sourceHash !== artifact.sourceFilesHash) invalid();
    const files = array(artifact.filesChanged, 8); if (!files.length) invalid();
    const patch = files.map(value => { const file = record(value, ["path", "change", "beforeSha256", "afterSha256", "patch"]);
      text(file.path, 256); if (!["added", "modified", "deleted"].includes(file.change)
        || ![file.beforeSha256, file.afterSha256].every(value => value === null || rawHash(value))) invalid();
      return text(file.patch, 262144, true); }).join("");
    if (Buffer.byteLength(patch, "utf8") !== artifact.diffBytes || sha(patch).slice(7) !== artifact.diffSha256) invalid();
    integer(artifact.diffBytes, 0, 262144); text(verification.command, 512); text(verification.image, 256);
    if (!/^[A-Za-z0-9][A-Za-z0-9._/:-]*@sha256:[a-f0-9]{64}$/u.test(verification.image)) invalid();
    for (const output of [verification.stdout, verification.stderr]) {
      if (typeof output !== "string" || Buffer.byteLength(output, "utf8") > 65536 || SECRET.test(output)) invalid();
    }
  }
  // Display validated process ownership and recovery observations without original tenant/subject fingerprints.
  return freeze({ executionId, operationId: state.operationId, taskId: state.taskId, agentId: state.agentId, planId: state.planId,
    status: state.status, nativeStatus: state.nativeStatus, threadId: state.threadId, turnId: state.turnId, processClosed: state.processClosed,
    ownerProcess, recoveryProcesses,
    reviewHash: state.reviewHash, stateHash, sourceFilesHash: worktree.sourceFilesHash, fileApprovals: approvals, nativeUsage,
    nativeUsageObservation: nativeUsage ? "last-reported-native-counts-not-final-billing" : "not-reported",
    artifact: state.status === "verified" ? state.artifact : null, verification: state.status === "verified" ? state.verification : null,
    error: state.error, outcomeUnknown: state.status === "unknown" || state.error?.outcomeUnknown === true });
}

export function projectWorkforceExternalRunnerInspection(value: unknown, executionId: string): Data {
  const source = record(value, ["metadata", "state"]), metadata = record(source.metadata, ["version", "agentId", "planId", "planDigest", "review"]);
  const review = projectWorkforceExternalRunnerReview(metadata.review);
  if (metadata.version !== 1 || !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(metadata.agentId) || !id(metadata.planId) || !rawHash(metadata.planDigest)) invalid();
  const state = source.state === null ? null : projectWorkforceExternalRunnerState(source.state, executionId);
  if (state && (state.agentId !== metadata.agentId || state.planId !== metadata.planId || state.reviewHash !== review.reviewHash
    || state.sourceFilesHash !== review.sourceFilesHash)) invalid();
  if (state?.artifact && state.artifact.filesChanged.some((file: Data) => !review.profile.artifact.writePaths.includes(file.path))) invalid();
  return { profileId: review.profile.profileId, profileHash: review.profile.profileHash, reviewHash: review.reviewHash,
    agentId: metadata.agentId, planId: metadata.planId, state };
}

function record(value: unknown, keys?: readonly string[]): Data {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
  const own = Reflect.ownKeys(value);
  if (own.length > 128 || keys && (own.length !== keys.length || keys.some(key => !Object.hasOwn(value, key)))) invalid();
  return Object.fromEntries(own.map(key => {
    const field = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || ["__proto__", "prototype", "constructor"].includes(key) || !field?.enumerable || !("value" in field)) invalid();
    return [key, field.value];
  }));
}
function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum || Reflect.ownKeys(value).length !== value.length + 1) invalid();
  return Array.from({ length: value.length }, (_, i) => { const field = Object.getOwnPropertyDescriptor(value, String(i));
    if (!field?.enumerable || !("value" in field)) invalid(); return field.value; });
}
function text(value: unknown, maximum: number, multiline = false): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum || SECRET.test(value)
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(value)
    || (multiline ? /\r(?!\n)/u : /[\t\r\n]/u).test(value) || Buffer.from(value, "utf8").toString("utf8") !== value) invalid();
  return value;
}
function identifier(value: unknown, model = false): string { const result = text(value, model ? 256 : 128);
  if (!(model ? /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u : /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u).test(result)) invalid(); return result; }
function integer(value: unknown, minimum: number, maximum: number): number { if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) invalid(); return Number(value); }
function stable(value: unknown, depth = 0): string {
  if (depth > 20) invalid();
  if (value === null || typeof value === "boolean" || typeof value === "string" && value.length <= 1048576 || typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${array(value, 2048).map(item => stable(item, depth + 1)).join(",")}]`;
  const source = record(value); return `{${Object.keys(source).sort().map(key => `${JSON.stringify(key)}:${stable(source[key], depth + 1)}`).join(",")}}`;
}
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
