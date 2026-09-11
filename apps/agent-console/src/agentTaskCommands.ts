import { createHash } from "node:crypto";
import { createGatewayClient } from "@unified-ai-system/shared-sdk";
import { parseContextJson } from "@unified-ai-system/context-codec-core";
import { readOperatorPayload, sanitizeOperatorData } from "./operatorCommands.ts";

type Data = Record<string, any>;
type Options = { command: string; positionals: string[]; json: boolean; url: string; timeoutMs: number; timeoutProvided: boolean;
  adminKey: string | null; confirmed: boolean; allowRealProvider: boolean; operatorInput: string | null; prompt: string | null;
  agentId: string | null; agentApprovalId: string | null; agentGoal: string | null; agentName: string | null; agentTask: string | null;
  agentTtlSeconds: number | null; agentParentId: string | null; agentMaxIterations: number | null; agentRunTimeoutMs: number | null;
  agentToolMode: string | null; agentProviderId: string | null; agentModelId: string | null; agentReason: string | null;
  agentTools: string[]; agentCascade: boolean; operatorMode: string | null; operatorSources: string[];
  operatorPasses: number | null; operatorMaxOutputTokens: number | null };
type Output = { write(value: string): unknown; writeError(value: string): unknown };
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const AGENT = /^agt_[A-Za-z0-9_-]{1,128}$/u, HASH = /^sha256:[a-f0-9]{64}$/u, HEX = /^[a-f0-9]{64}$/u;
const operations = new Set(["prepare", "plan", "confirm", "run", "schedule", "status", "pause", "cancel"]);
function invalid(): never { throw Object.assign(new Error("Agent task data is incomplete, unsafe or does not match the original review."), { code: "AGENT_TASK_INPUT_INVALID" }); }
function record(value: unknown): asserts value is Data {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
}
function keys(value: unknown, required: string[], optional: string[] = []): asserts value is Data {
  record(value);
  if (required.some(key => !Object.hasOwn(value, key)) || Reflect.ownKeys(value).some(key => typeof key !== "string"
    || ![...required, ...optional].includes(key) || !("value" in (Object.getOwnPropertyDescriptor(value, key) ?? {})))) invalid();
}
function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
const digest = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const hash = (value: unknown) => "sha256:" + digest(canonical(value));
const integer = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
function printable(value: unknown): Data {
  const data = sanitizeOperatorData(value, true);
  if (/[\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(JSON.stringify(data))) invalid();
  return data;
}
function hashed(value: Data, key: string) {
  const { [key]: actual, ...body } = value;
  if (!HASH.test(actual) || hash(body) !== actual) invalid();
}
function pathList(value: unknown, maximum: number): string[] {
  const protectedNames = new Set([".git", ".gitattributes", ".gitmodules", ".gitconfig", ".forge", ".mcp.json", ".ssh", ".aws", ".azure", ".gcp", ".npmrc",
    ".netrc", ".git-credentials", "credentials", "credentials.json", "auth.json", "evidence"]);
  if (!Array.isArray(value) || !value.length || value.length > maximum || value.some(path => typeof path !== "string"
    || !path.trim() || path.length > 256 || path.startsWith("/") || /[\\:*?\[\]{}\u0000-\u001f\u007f]/u.test(path)
    || path.split("/").some(part => !part || part === "." || part === ".." || /[. ]$/u.test(part)
      || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part) || protectedNames.has(part.toLowerCase())
      || /^\.env(?:\.|$)/iu.test(part) || /\.(?:pem|key|pfx|p12|sqlite|db)$/iu.test(part)))) invalid();
  if (new Set(value.map(path => path.toLowerCase())).size !== value.length) invalid(); return value;
}
function reviewed(value: unknown): Data {
  keys(value, ["version", "profile", "configuredRepositoryHash", "goal", "prompt", "sourceFilesHash", "reviewHash"]);
  if (value.version !== 1 || !HASH.test(value.configuredRepositoryHash) || !HEX.test(value.sourceFilesHash)
    || typeof value.goal !== "string" || !value.goal.trim() || typeof value.prompt !== "string" || !value.prompt.trim()) invalid();
  const profile = value.profile;
  keys(profile, ["version", "mode", "profileId", "projectId", "baselineRevision", "model", "limits", "verificationResult", "artifact", "profileHash"]);
  if (profile.version !== 1 || profile.mode !== "governed-agent-long-task" || !/^[a-f0-9]{40}$/u.test(profile.baselineRevision)) invalid();
  keys(profile.model, ["providerId", "modelId", "maxInputTokens", "maxOutputTokens"]);
  if ([profile.model.providerId, profile.model.modelId].some(value => typeof value !== "string" || !value)
    || ![profile.model.maxInputTokens, profile.model.maxOutputTokens].every(value => integer(value) && value > 0)) invalid();
  keys(profile.limits, ["maxPlanSteps", "maxIterations", "maxModelCalls", "maxTotalTokens", "maxRepairAttempts", "chunkTimeoutMs", "maxInputBytes"]);
  if (!Object.values(profile.limits).every(integer)) invalid();
  const artifact = profile.artifact;
  keys(artifact, ["readPaths", "writePaths", "verification", "artifactLimits"]);
  const reads = pathList(artifact.readPaths, 32), writes = pathList(artifact.writePaths, 8);
  if (writes.some(path => !reads.includes(path))) invalid();
  keys(artifact.artifactLimits, ["maxChangedFiles", "maxFileBytes", "maxDiffBytes"]);
  if (!Object.values(artifact.artifactLimits).every(value => integer(value) && Number(value) > 0)) invalid();
  const verification = artifact.verification;
  keys(verification, ["verificationId", "command", "immutableTests", "image", "workspaceMode", "networkAccess", "timeoutMs", "maxMemoryMB", "maxOutputBytes", "pidsLimit", "cpus"]);
  if (verification.workspaceMode !== "ro" || verification.networkAccess !== false || typeof verification.command !== "string" || !verification.command
    || !/^[A-Za-z0-9][A-Za-z0-9._/:-]*@sha256:[a-f0-9]{64}$/u.test(verification.image)
    || !Array.isArray(verification.immutableTests) || !verification.immutableTests.length) invalid();
  for (const test of verification.immutableTests) {
    keys(test, ["path", "sha256"]);
    if (!reads.includes(test.path) || writes.includes(test.path) || !HEX.test(test.sha256)) invalid();
  }
  const contract = profile.verificationResult;
  keys(contract, ["version", "adapter", "minimumPassed", "requiredChecks"]);
  if (contract.version !== 1 || contract.adapter !== "node-test" || !integer(contract.minimumPassed) || contract.minimumPassed < 1 || contract.minimumPassed > 10000
    || !Array.isArray(contract.requiredChecks) || !contract.requiredChecks.length || contract.requiredChecks.length > 64) invalid();
  const immutablePaths: string[] = verification.immutableTests.map((test: Data) => test.path), unique = new Set<string>(), covered = new Set<string>();
  for (const check of contract.requiredChecks) {
    keys(check, ["file", "name"]);
    if (!immutablePaths.includes(check.file) || typeof check.name !== "string" || !check.name.trim() || check.name.length > 256
      || /[\t\r\n]/u.test(check.name) || Buffer.from(check.name, "utf8").toString("utf8") !== check.name) invalid();
    const id = canonical([check.file, check.name]); if (unique.has(id)) invalid(); unique.add(id); covered.add(check.file);
  }
  if (immutablePaths.some(path => !covered.has(path)) || verification.command !== "node --test " + [...immutablePaths].sort().map(path => "'" + path.replaceAll("'", "'\\''") + "'").join(" ")
    || canonical(contract.requiredChecks) !== canonical([...contract.requiredChecks].sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) invalid();
  hashed(profile, "profileHash"); hashed(value, "reviewHash"); return value;
}

function checkResult(value: unknown, contract: Data, snapshotHash: string, exitCode: number): Data {
  keys(value, ["version", "adapter", "contractHash", "runnerHash", "snapshotHash", "verdict", "reason", "counts", "executedPassed", "requiredChecks"]);
  if (value.version !== 1 || value.adapter !== "node-test" || value.contractHash !== hash(contract) || !HASH.test(value.runnerHash)
    || value.snapshotHash !== snapshotHash || !HEX.test(value.snapshotHash) || !["passed", "failed"].includes(value.verdict)
    || !["checks-passed", "checks-failed", "no-executed-checks", "required-check-not-passed", "incomplete-report"].includes(value.reason)
    || !integer(value.executedPassed) || !Array.isArray(value.requiredChecks) || value.requiredChecks.length !== contract.requiredChecks.length) invalid();
  keys(value.counts, ["tests", "passed", "failed", "cancelled", "skipped", "todo", "suites", "topLevel"]);
  if (!Object.values(value.counts).every(integer) || value.executedPassed > value.counts.passed) invalid();
  value.requiredChecks.forEach((check: unknown, index: number) => {
    keys(check, ["file", "name", "status"]);
    if (check.file !== contract.requiredChecks[index].file || check.name !== contract.requiredChecks[index].name
      || !["passed", "failed", "skipped", "todo", "missing", "ambiguous"].includes(check.status)) invalid();
  });
  if (value.verdict === "passed" ? value.reason !== "checks-passed" || exitCode !== 0 || value.executedPassed < contract.minimumPassed
    || value.counts.failed !== 0 || value.counts.cancelled !== 0 || value.requiredChecks.some((check: Data) => check.status !== "passed")
    : value.reason === "checks-passed") invalid();
  return value;
}
function planned(value: unknown, review: Data): Data {
  keys(value, ["version", "reviewHash", "steps", "planHash"]);
  if (value.version !== 1 || value.reviewHash !== review.reviewHash || !Array.isArray(value.steps)
    || value.steps.length < 3 || value.steps.length > review.profile.limits.maxPlanSteps) invalid();
  const ranks = ["inspect", "implement", "verify"], ids = new Set<string>(), kinds = new Set<string>(), writes = new Set<string>(), tests = new Set<string>();
  let rank = 0;
  for (const step of value.steps) {
    keys(step, ["id", "kind", "title", "paths"]);
    if (typeof step.id !== "string" || !step.id || ids.has(step.id) || typeof step.title !== "string" || !step.title
      || !ranks.includes(step.kind) || ranks.indexOf(step.kind) < rank) invalid();
    rank = ranks.indexOf(step.kind); ids.add(step.id); kinds.add(step.kind);
    const allowed = step.kind === "inspect" ? review.profile.artifact.readPaths : step.kind === "implement" ? review.profile.artifact.writePaths
      : review.profile.artifact.verification.immutableTests.map((test: Data) => test.path);
    for (const path of pathList(step.paths, allowed.length)) {
      if (!allowed.includes(path)) invalid();
      if (step.kind === "implement") writes.add(path); if (step.kind === "verify") tests.add(path);
    }
  }
  if (kinds.size !== 3 || review.profile.artifact.writePaths.some((path: string) => !writes.has(path))
    || review.profile.artifact.verification.immutableTests.some((test: Data) => !tests.has(test.path))) invalid();
  hashed(value, "planHash"); return value;
}

/** Complete local review projection; hashes detect missing/replaced fields but do not grant execution authority. */
export function projectGovernedAgentTaskApproval(value: unknown): Data {
  const data = printable(value);
  keys(data, ["schemaVersion", "reviewable", "effectType", "policyHash", "agentTask"]);
  if (data.schemaVersion !== 1 || data.reviewable !== true || data.effectType !== "agent:long-task" || !HASH.test(data.policyHash)) invalid();
  keys(data.agentTask, ["taskId", "agentRunId", "review", "plan"]);
  if (!UUID.test(data.agentTask.taskId) || !/^agr_[A-Za-z0-9_-]{1,128}$/u.test(data.agentTask.agentRunId)) invalid();
  planned(data.agentTask.plan, reviewed(data.agentTask.review)); return data;
}
export function projectGovernedAgentTaskSnapshot(value: unknown, agentId: string, taskId?: string): Data {
  const data = printable(value);
  keys(data, ["version", "taskId", "agentId", "agentRunId", "revision", "phase", "counters", "pendingOperation", "review", "sourceFiles", "plan",
    "approvalId", "confirmedApprovalId", "stepIndex", "stepReceipts", "modelReceipts", "verificationAttempts", "workspaceReceipt", "sourceFilesHash", "finalAnswer", "errorCode", "controlRequested", "resumable", "recovery"], ["resident", "recoveryAttempts", "loopDecisions"]);
  if (data.version !== 1 || data.agentId !== agentId || !UUID.test(data.taskId) || taskId !== undefined && data.taskId !== taskId
    || !/^agr_[A-Za-z0-9_-]{1,128}$/u.test(data.agentRunId) || !integer(data.revision) || !integer(data.stepIndex)
    || !["prepared", "planning", "awaiting_confirmation", "running", "paused", "verifying", "completed", "failed", "cancelled", "unknown"].includes(data.phase)
    || typeof data.resumable !== "boolean" || typeof data.finalAnswer !== "string" || !HEX.test(data.sourceFilesHash)) invalid();
  keys(data.counters, ["iterations", "modelCalls", "reservedTokens", "repairAttempts"]);
  if (!Object.values(data.counters).every(integer)) invalid();
  keys(data.recovery, ["automaticReplay", "workspaceReconciliationRequired", "wholeDirectoryRollbackProtection"]);
  if (data.recovery.automaticReplay !== false || data.recovery.wholeDirectoryRollbackProtection !== false || typeof data.recovery.workspaceReconciliationRequired !== "boolean") invalid();
  if (data.resident != null) {
    keys(data.resident, ["enabled", "chunks", "maxChunks", "expiresAt", "chunkIterations", "stopReason"]);
    if (typeof data.resident.enabled !== "boolean" || ![data.resident.chunks, data.resident.maxChunks, data.resident.expiresAt, data.resident.chunkIterations].every(integer)
      || data.resident.chunks > data.resident.maxChunks || data.resident.chunkIterations < 1 || data.resident.chunkIterations > 10
      || !(data.resident.stopReason === null || typeof data.resident.stopReason === "string")) invalid();
  }
  for (const name of ["recoveryAttempts", "loopDecisions"]) if (data[name] !== undefined && !Array.isArray(data[name])) invalid();
  for (const attempt of data.recoveryAttempts ?? []) {
    keys(attempt, ["attempt", "status", "sourceFilesHash", "code", "errorCode"]);
    if (!integer(attempt.attempt) || attempt.attempt < 1 || !HEX.test(attempt.sourceFilesHash)
      || attempt.code !== "WORKSPACE_NOT_ATTACHED" || !["pending", "recovered", "failed", "unknown"].includes(attempt.status)
      || !(attempt.errorCode === null || typeof attempt.errorCode === "string")) invalid();
  }
  for (const decision of data.loopDecisions ?? []) {
    keys(decision, ["attemptId", "action", "reason", "repairAttempts"]);
    if (!/^verify_[1-9][0-9]*$/u.test(decision.attemptId) || !["ACCEPT", "ADJUST_RETRY", "EXHAUSTED", "ESCALATE"].includes(decision.action)
      || typeof decision.reason !== "string" || !integer(decision.repairAttempts)) invalid();
  }
  reviewed(data.review); if (data.plan !== null) planned(data.plan, data.review);
  for (const field of ["sourceFiles", "stepReceipts", "modelReceipts", "verificationAttempts"]) if (!Array.isArray(data[field])) invalid();
  const profile = data.review.profile, artifact = profile.artifact;
  if (canonical(data.sourceFiles.map((file: Data) => file.path)) !== canonical(artifact.readPaths)) invalid();
  for (const file of data.sourceFiles) {
    keys(file, ["path", "sha256", "content"]);
    if (file.content === null ? file.sha256 !== null || !artifact.writePaths.includes(file.path)
      : typeof file.content !== "string" || digest(file.content) !== file.sha256) invalid();
  }
  if (artifact.verification.immutableTests.some((test: Data) => data.sourceFiles.find((file: Data) => file.path === test.path)?.sha256 !== test.sha256)) invalid();
  const artifactProfileHash = hash({ version: 1, mode: "forge-owned-worktree-artifact", profileId: profile.profileId,
    projectId: profile.projectId, baselineRevision: profile.baselineRevision, roleId: "backend-engineer", ...artifact });
  if (data.review.sourceFilesHash !== digest(canonical({ profileHash: artifactProfileHash, files: data.sourceFiles.map((file: Data) => [file.path, file.sha256]) }))) invalid();
  for (const attempt of data.verificationAttempts) {
    record(attempt); record(attempt.verification);
    const verification = attempt.verification;
    if (!["passed", "failed"].includes(attempt.status) || verification.status !== attempt.status || !integer(verification.exitCode)
      || verification.command !== artifact.verification.command || verification.image !== artifact.verification.image || verification.cleanupConfirmed !== true) invalid();
    const observed = checkResult(verification.checkResult, profile.verificationResult, verification.snapshotHash, verification.exitCode);
    if (observed.verdict !== attempt.status) invalid();
  }
  if (data.phase === "completed" && (!data.plan || data.stepIndex !== data.plan.steps.length
    || data.verificationAttempts.at(-1)?.status !== "passed" || data.verificationAttempts.at(-1)?.verification?.exitCode !== 0
    || data.verificationAttempts.at(-1)?.verification?.cleanupConfirmed !== true)) invalid();
  return data;
}

export function validateAgentTaskOptions(options: Options): void {
  const operation = options.positionals[1];
  if (!operations.has(operation) || options.positionals.length !== (operation === "prepare" ? 2 : 3)
    || operation !== "prepare" && !UUID.test(options.positionals[2]) || !AGENT.test(options.agentId ?? "") || !options.adminKey) invalid();
  if (operation === "status" ? options.operatorInput !== null || options.confirmed : !options.operatorInput || !options.confirmed) invalid();
  if (options.allowRealProvider && !["plan", "run", "schedule"].includes(operation)) invalid();
  if ([options.prompt, options.agentApprovalId, options.agentGoal, options.agentName, options.agentTask, options.agentTtlSeconds,
    options.agentParentId, options.agentMaxIterations, options.agentRunTimeoutMs, options.agentToolMode, options.agentProviderId,
    options.agentModelId, options.agentReason, options.operatorMode, options.operatorPasses, options.operatorMaxOutputTokens].some(value => value !== null)
    || options.agentTools.length || options.agentCascade || options.operatorSources.length) invalid();
  try { const url = new URL(options.url); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) invalid(); }
  catch { invalid(); }
}
function requestFor(operation: string, path: string | null): Data {
  const data = path ? readOperatorPayload(path, parseContextJson) : {};
  keys(data, operation === "prepare" ? ["goal", "prompt"] : operation === "confirm" ? ["revision", "reviewHash", "planHash", "approvalId"]
    : operation === "status" ? [] : ["revision"], operation === "run" ? ["maxIterations"] : operation === "prepare" ? ["projectId"] : []);
  if (operation === "prepare") {
    if (typeof data.goal !== "string" || !data.goal.trim() || data.goal.length > 4000 || typeof data.prompt !== "string" || !data.prompt.trim()) invalid();
  } else if (operation !== "status" && !integer(data.revision)) invalid();
  if (operation === "confirm" && (!HASH.test(data.reviewHash) || !HASH.test(data.planHash) || typeof data.approvalId !== "string" || !/^[A-Za-z0-9_-]{1,160}$/u.test(data.approvalId))) invalid();
  if (data.maxIterations !== undefined && (!integer(data.maxIterations) || data.maxIterations < 1 || data.maxIterations > 10)) invalid();
  if (data.projectId !== undefined && (typeof data.projectId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(data.projectId))) invalid();
  return data;
}
function unwrap(value: any): unknown {
  if (!value || value.status !== "ok" || !value.data) invalid(); return value.data;
}
function nextAction(data: Data): string {
  if (data.resident?.enabled) return "The shared pool advances this original task within its approved budget and deadline. Check status, or pause/cancel this task. A restart requires fresh authorization and verifies the original checkpoint before continuing.";
  if (data.phase === "awaiting_confirmation") return `Review the complete plan, then explicitly decide approval with agents approve --approval-id ${data.approvalId} --yes. Confirm afterward using this task ID, revision, reviewHash and planHash.`;
  if (data.phase === "prepared") return "Review the complete prepared input, then explicitly request plan for this task ID and revision.";
  if (data.phase === "paused" && data.recovery.workspaceReconciliationRequired === true) return "Explicitly run this original task ID at its current revision to request verified restoration of the original worktree. The server first checks the current signed task, claim, Agent, consumed approval, checkpoint, budgets and original files. It creates no new worktree, replans nothing and resets no counters. Nothing runs automatically on startup.";
  if (data.resumable) return "Run one explicit chunk using this original task ID and its current revision. No automatic continuation occurs.";
  if (data.phase === "completed") return "Inspect the retained diff and independent verification receipts. Deployment and publication are separate operations.";
  return "Inspect this original task status and recovery fields before any further request. Do not create a replacement task to retry unknown effects.";
}
export async function runAgentTaskCommand(options: Options, output: Output): Promise<number> {
  const operation = options.positionals[1], taskId = options.positionals[2], mutation = operation !== "status";
  let submitted = false;
  try {
    const body = requestFor(operation, options.operatorInput), agentId = options.agentId!;
    const client = createGatewayClient({ baseUrl: options.url, headers: { authorization: `Bearer ${options.adminKey}` },
      timeoutMs: options.timeoutProvided || !["plan", "run"].includes(operation) ? options.timeoutMs : 130000 });
    if (["plan", "run", "schedule"].includes(operation)) {
      const status = projectGovernedAgentTaskSnapshot(unwrap(await client.governedAgentTask(agentId, taskId)), agentId, taskId);
      if (status.revision !== body.revision) invalid();
      if (status.review.profile.model.providerId !== "local-fake-provider" && !options.allowRealProvider) {
        throw Object.assign(new Error("Explicit real-provider authorization is required."), { code: "AGENT_TASK_REAL_PROVIDER_CONFIRMATION_REQUIRED" });
      }
    }
    submitted = mutation;
    const result = operation === "prepare" ? await client.prepareGovernedAgentTask(agentId, body as any)
      : operation === "plan" ? await client.planGovernedAgentTask(agentId, taskId, body as any)
        : operation === "confirm" ? await client.confirmGovernedAgentTask(agentId, taskId, body as any)
          : operation === "run" ? await client.runGovernedAgentTask(agentId, taskId, body as any)
            : operation === "schedule" ? await client.scheduleGovernedAgentTask(agentId, taskId, body as any)
            : operation === "pause" ? await client.pauseGovernedAgentTask(agentId, taskId, body as any)
              : operation === "cancel" ? await client.cancelGovernedAgentTask(agentId, taskId, body as any)
                : await client.governedAgentTask(agentId, taskId);
    const data = projectGovernedAgentTaskSnapshot(unwrap(result), agentId, taskId);
    const accepted = !["failed", "unknown"].includes(data.phase), rendered = { ok: accepted, command: "agents task", operation,
      retryAllowed: false, automaticContinuation: data.resident?.enabled === true, data, nextAction: nextAction(data) };
    output.write(options.json ? JSON.stringify(rendered, null, 2) + "\n"
      : `Agent task ${data.taskId}\nPhase: ${data.phase}; revision: ${data.revision}\n${JSON.stringify(data, null, 2)}\n${rendered.nextAction}\n`);
    return accepted ? 0 : 1;
  } catch (error) {
    const source = error as { code?: unknown; statusCode?: unknown; responseBody?: { error?: { details?: Data } } };
    const code = typeof source.code === "string" && /^[A-Z][A-Z0-9_]{0,127}$/u.test(source.code) ? source.code : "AGENT_TASK_REQUEST_FAILED";
    const details = source.responseBody?.error?.details;
    const explicitUnknown = typeof details?.outcomeUnknown === "boolean" && details.taskId === (taskId ?? null)
      ? details.outcomeUnknown : undefined;
    const unknown = submitted && (explicitUnknown !== false || details?.persistenceOutcomeUnknown === true);
    const result = { ok: false, command: "agents task", operation, ...(taskId ? { taskId } : {}), code,
      outcomeUnknown: unknown, retryAllowed: false, automaticContinuation: false,
      nextAction: code === "AGENT_TASK_REAL_PROVIDER_CONFIRMATION_REQUIRED" ? "Review the fixed server provider and repeat with --allow-real-provider only if this request is authorized."
        : "Inspect the original task status and current revision; do not retry automatically or create a replacement task." };
    output.writeError(options.json ? JSON.stringify(result, null, 2) + "\n" : `${code}\n${result.nextAction}\n`); return 1;
  }
}
