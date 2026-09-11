import { createHash, randomUUID } from "node:crypto";
import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { createAgentToolRegistry } from "../claude-code-patterns/agentToolRegistry.js";
import { readWorkforceCodeDeliveryToolProxy } from "../agent-governance/toolProxy.ts";
import { containsSensitivePublicationText } from "../security/secretSafety.js";
import { performSearchReplace } from "../tools/fileEditTool.js";
import { captureApprovedCodeFiles, createCodeDeliveryArtifact } from "../workforce/workforceCodeDeliveryArtifacts.ts";
import type { ApprovedCodeFiles, CodeDeliveryArtifact } from "../workforce/workforceCodeDeliveryArtifacts.ts";
import { verifyWorkforceCodeSnapshot } from "../workforce/workforceCodeDeliveryRuntime.ts";
import type { WorkforceCodeSnapshotFailureReceipt } from "../workforce/workforceCodeDeliveryRuntime.ts";
import { createWorkforceGit } from "../workforce/workforceGit.ts";
import { assertOwnedWorkforceWorktree, createWorktreeIsolation, restoreOwnedWorkforceWorktree } from "../workforce/worktreeIsolation.js";
import { continuationJsonCopy } from "../workforce/taskQueueContinuation.ts";
import type { TaskContinuation } from "../workforce/taskQueueContinuation.ts";
import { readAgenticCheckpoint } from "./agenticCheckpoint.ts";
import { convertRegistryToOpenAITools } from "../providers/toolCallingAdapter.js";
import { createGovernedAgentTaskReview, governedAgentTaskArtifactPolicy, readGovernedAgentTaskPlan,
  readGovernedAgentTaskProfile, readGovernedAgentTaskReview } from "./governedAgentTaskProfile.ts";
import type { GovernedAgentTaskPlan, GovernedAgentTaskPlanStep, GovernedAgentTaskProfile, GovernedAgentTaskReview } from "./governedAgentTaskProfile.ts";

type Context = Readonly<{ agentId: string; tenantId: string; userId: string; requestId?: string }>;
export type GovernedAgentTaskDirectoryIdentity = Readonly<{ dev: string; ino: string }>;
export type GovernedAgentTaskWorkspaceReceipt = Readonly<{ version: 2; taskId: string; worktreeId: string;
  branch: string; reviewHash: string; planHash: string; baselineRevision: string; createdAt: string;
  identities: Readonly<Record<"repositoryRoot" | "worktreeRoot" | "worktreeDirectory" | "gitFile", GovernedAgentTaskDirectoryIdentity>> }>;
export type GovernedAgentTaskStepReceipt = Readonly<{ stepId: string; kind: "inspect" | "implement";
  toolName: string; path: string; beforeSha256: string | null; afterSha256: string | null;
  sourceFilesHash: string; fullRead: boolean; changed: boolean; repairAttempt: number; status: "succeeded" }>;
export type GovernedAgentTaskVerificationAttempt = Readonly<{ status: "passed" | "failed"; artifact: CodeDeliveryArtifact;
  verification: WorkforceCodeSnapshotFailureReceipt | Awaited<ReturnType<typeof verifyWorkforceCodeSnapshot>>;
  failures: readonly WorkforceCodeSnapshotFailureReceipt[] }>;
export type GovernedAgentTaskOriginalWorkspace = Readonly<{
  taskId: string; agentRunId: string; review: GovernedAgentTaskReview; plan: GovernedAgentTaskPlan;
  workspaceReceipt: GovernedAgentTaskWorkspaceReceipt; sourceFilesHash: string; stepIndex: number; counters: TaskContinuation["counters"];
  stepReceipts: readonly GovernedAgentTaskStepReceipt[]; verificationAttempts: readonly GovernedAgentTaskVerificationAttempt[];
  identity: Readonly<Pick<Context, "agentId" | "tenantId" | "userId">>; policyHash: string;
  loopCheckpoint: unknown; checkpointHash: string;
}>;
export type GovernedAgentTaskWorkspaceRecovery = { recoverOriginal?: () => Promise<GovernedAgentTaskOriginalWorkspace> };
type Owned = { receipt: GovernedAgentTaskWorkspaceReceipt; baseline: ApprovedCodeFiles; current: ApprovedCodeFiles;
  contextKey: string; policyHash: string; active: boolean; poisoned: Error | null;
  receipts: GovernedAgentTaskStepReceipt[]; failures: WorkforceCodeSnapshotFailureReceipt[] };
export type GovernedAgentTaskWorkspaceChunkInput = {
  taskId: string; review: GovernedAgentTaskReview; plan: GovernedAgentTaskPlan;
  workspaceReceipt?: GovernedAgentTaskWorkspaceReceipt; expectedSourceFilesHash?: string;
  context: Context; policyHash: string; toolProxy: unknown; signal: AbortSignal; deadlineAt: number;
  assertActive(phase?: "reserve" | "commit"): Promise<unknown>;
  getStep(): GovernedAgentTaskPlanStep;
  getRepairAttempt(): number;
};
const factories = new WeakSet<object>();
const names = Object.freeze(["file_read", "file_write", "file_edit"]);
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const valueHash = (value: unknown) => "sha256:" + digest(stableStringify(value));
const WORKTREE_ID = /^wf-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const IDENTITY_KEYS = ["repositoryRoot", "worktreeRoot", "worktreeDirectory", "gitFile"] as const;
const hex = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const integer = (value: unknown, maximum: number) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= maximum;
const equal = (left: unknown, right: unknown) => stableStringify(left) === stableStringify(right);
const comparable = (path: string) => process.platform === "win32" ? resolve(path).toLowerCase() : resolve(path);
function failure(code: string, unknown = false) {
  return Object.assign(new Error(`The governed Agent workspace cannot continue: ${code}.`), {
    code: `AGENT_LONG_TASK_${code}`, statusCode: unknown ? 503 : 409, outcomeUnknown: unknown, retrySafe: false,
  });
}
function active(input: Pick<GovernedAgentTaskWorkspaceChunkInput, "signal" | "deadlineAt">) {
  if (!(input.signal instanceof AbortSignal) || input.signal.aborted || !Number.isFinite(input.deadlineAt)
    || Date.now() >= input.deadlineAt) throw failure("CANCELLED");
}
async function assertRepository(root: string, baseline: string) {
  if (comparable(await realpath(root)) !== comparable(root)) throw failure("REPOSITORY_CHANGED");
  const git = createWorkforceGit(root); await git.assertSafe();
  if (comparable((await git.run(["rev-parse", "--show-toplevel"])).stdout.trim()) !== comparable(root)
    || (await git.run(["rev-parse", "--verify", "HEAD"])).stdout.trim() !== baseline) throw failure("BASELINE_CHANGED");
  if ((await git.run(["--no-optional-locks", "status", "--porcelain=v1", "-z", "--untracked-files=all"])).stdout) throw failure("REPOSITORY_DIRTY");
}
async function assertChangedPaths(root: string, paths: readonly string[]) {
  const git = createWorkforceGit(root); await git.assertSafe();
  const entries = (await git.run(["--no-optional-locks", "status", "--porcelain=v1", "-z", "--untracked-files=all"])).stdout.split("\0").filter(Boolean);
  if (entries.some(entry => ![" M", " D", "??"].includes(entry.slice(0, 2)) || !paths.includes(entry.slice(3)))) throw failure("UNAPPROVED_CHANGE", true);
}
function parameters(value: unknown): Record<string, string | boolean | number> {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw failure("TOOL_SCOPE_DENIED");
  const result: Record<string, string | boolean | number> = {};
  for (const key of Reflect.ownKeys(value)) {
    const field = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || !field?.enumerable || !("value" in field) || !["string", "number", "boolean"].includes(typeof field.value)
      || ["__proto__", "constructor", "prototype"].includes(key)) throw failure("TOOL_SCOPE_DENIED");
    result[key] = field.value;
  }
  return result;
}
function readReceipt(value: unknown): GovernedAgentTaskWorkspaceReceipt {
  const receipt = continuationJsonCopy(value) as GovernedAgentTaskWorkspaceReceipt;
  if (!receipt || Object.keys(receipt).sort().join("|") !== "baselineRevision|branch|createdAt|identities|planHash|reviewHash|taskId|version|worktreeId"
    || receipt.version !== 2 || !WORKTREE_ID.test(receipt.worktreeId) || !/^codex\/agent-task-[0-9a-f-]{36}$/u.test(receipt.branch)
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(receipt.taskId) || !/^[a-f0-9]{40}$/u.test(receipt.baselineRevision)
    || !/^sha256:[a-f0-9]{64}$/u.test(receipt.reviewHash) || !/^sha256:[a-f0-9]{64}$/u.test(receipt.planHash)
    || typeof receipt.createdAt !== "string" || !Number.isFinite(Date.parse(receipt.createdAt))
    || !receipt.identities || Object.keys(receipt.identities).sort().join("|") !== [...IDENTITY_KEYS].sort().join("|")
    || IDENTITY_KEYS.some(key => {
      const id = receipt.identities[key];
      return !id || Object.keys(id).sort().join("|") !== "dev|ino" || typeof id.dev !== "string" || !/^(0|[1-9][0-9]{0,39})$/u.test(id.dev)
        || typeof id.ino !== "string" || !/^[1-9][0-9]{0,39}$/u.test(id.ino);
    })) throw failure("WORKSPACE_RECOVERY_REJECTED", true);
  return Object.freeze({ ...receipt, identities: Object.freeze(Object.fromEntries(IDENTITY_KEYS.map(key => [key, Object.freeze({ ...receipt.identities[key] })]))) }) as GovernedAgentTaskWorkspaceReceipt;
}

/** Server-only adapter. Receipt JSON alone cannot restore ownership; reconciliation requires a fresh authoritative callback. */
export function createGovernedAgentTaskWorkspace(options: {
  repoRoot: string; worktreeRoot: string; scratchRoot: string; enginePath: string; profile: GovernedAgentTaskProfile;
}) {
  if (!options || Object.keys(options).sort().join("|") !== "enginePath|profile|repoRoot|scratchRoot|worktreeRoot"
    || [options.repoRoot, options.worktreeRoot, options.scratchRoot, options.enginePath].some(path => typeof path !== "string" || !isAbsolute(path))) throw failure("WORKSPACE_CONFIGURATION_INVALID");
  const config = Object.freeze({ ...options, profile: readGovernedAgentTaskProfile(options.profile) });
  const policy = governedAgentTaskArtifactPolicy(config.profile);
  const repositoryHash = "sha256:" + digest(JSON.stringify(["governed-agent-task-repository/v1", comparable(config.repoRoot).replaceAll("\\", "/")]));
  const manager = createWorktreeIsolation({ repoRoot: config.repoRoot, worktreeRoot: config.worktreeRoot });
  const owned = new Map<string, Owned>();
  const opening = new Set<string>();
  const creationUnknown = new Set<string>();
  const currentSource = async (signal?: AbortSignal) => {
    await assertRepository(config.repoRoot, policy.baselineRevision);
    return captureApprovedCodeFiles(config.repoRoot, policy, signal);
  };
  const assertReceiptIdentities = async (receipt: GovernedAgentTaskWorkspaceReceipt) => {
    const path = resolve(config.worktreeRoot, receipt.worktreeId);
    const paths = { repositoryRoot: config.repoRoot, worktreeRoot: config.worktreeRoot, worktreeDirectory: path, gitFile: resolve(path, ".git") };
    const canonical = {} as Record<typeof IDENTITY_KEYS[number], string>;
    for (const key of IDENTITY_KEYS) {
      const state = await lstat(paths[key], { bigint: true }), expected = receipt.identities[key];
      if (state.isSymbolicLink() || (key === "gitFile" ? !state.isFile() || state.nlink !== 1n : !state.isDirectory())
        || state.dev.toString() !== expected.dev || state.ino.toString() !== expected.ino) {
        throw failure("WORKSPACE_OWNERSHIP_UNKNOWN", true);
      }
      canonical[key] = await realpath(paths[key]);
    }
    if (comparable(canonical.repositoryRoot) !== comparable(config.repoRoot)
      || comparable(canonical.worktreeDirectory) !== comparable(resolve(canonical.worktreeRoot, receipt.worktreeId))
      || comparable(canonical.gitFile) !== comparable(resolve(canonical.worktreeDirectory, ".git"))) throw failure("WORKSPACE_OWNERSHIP_UNKNOWN", true);
    return canonical.worktreeDirectory;
  };
  const readOriginal = async (value: unknown, input: GovernedAgentTaskWorkspaceChunkInput, review: GovernedAgentTaskReview, plan: GovernedAgentTaskPlan) => {
    const original = continuationJsonCopy(value) as GovernedAgentTaskOriginalWorkspace;
    const rejected = () => { throw failure("WORKSPACE_RECOVERY_REJECTED", true); };
    if (!original || Object.keys(original).sort().join("|") !== "agentRunId|checkpointHash|counters|identity|loopCheckpoint|plan|policyHash|review|sourceFilesHash|stepIndex|stepReceipts|taskId|verificationAttempts|workspaceReceipt"
      || original.taskId !== input.taskId || !/^agr_[A-Za-z0-9_-]{1,128}$/u.test(original.agentRunId)
      || !equal(original.identity, { agentId: input.context.agentId, tenantId: input.context.tenantId, userId: input.context.userId })
      || original.policyHash !== input.policyHash || !equal(readGovernedAgentTaskReview(original.review), review)
      || !equal(readGovernedAgentTaskPlan(original.plan, review), plan) || !hex(original.sourceFilesHash)
      || original.sourceFilesHash !== input.expectedSourceFilesHash || !integer(original.stepIndex, plan.steps.length)
      || !Array.isArray(original.stepReceipts) || !Array.isArray(original.verificationAttempts)
      || original.verificationAttempts.length > config.profile.limits.maxRepairAttempts + 1
      || original.checkpointHash !== valueHash(original.loopCheckpoint)) rejected();
    const receipt = readReceipt(original.workspaceReceipt);
    if (!equal(receipt, readReceipt(input.workspaceReceipt)) || receipt.taskId !== input.taskId || receipt.reviewHash !== review.reviewHash
      || receipt.planHash !== plan.planHash || receipt.baselineRevision !== policy.baselineRevision) rejected();
    const counters = original.counters;
    if (!counters || Object.keys(counters).sort().join("|") !== "iterations|modelCalls|repairAttempts|reservedTokens"
      || !integer(counters.iterations, config.profile.limits.maxIterations) || !integer(counters.modelCalls, config.profile.limits.maxModelCalls)
      || !integer(counters.reservedTokens, config.profile.limits.maxTotalTokens) || !integer(counters.repairAttempts, config.profile.limits.maxRepairAttempts)) rejected();
    const path = await assertReceiptIdentities(receipt);
    if (original.loopCheckpoint === null) {
      if (counters.iterations !== 0 || counters.repairAttempts !== 0 || counters.modelCalls > 1 || original.stepIndex !== 0
        || original.stepReceipts.length || original.verificationAttempts.length || original.sourceFilesHash !== review.sourceFilesHash) rejected();
    } else {
      const data = original.loopCheckpoint as any, checkpoint = readAgenticCheckpoint(data, data?.binding), binding = checkpoint.binding;
      const definitions = convertRegistryToOpenAITools(createAgentToolRegistry({ workingDirectory: path, enableHighRiskTools: false }).listTools({ allowlist: [...names] }));
      const tools = definitions.map((tool: any) => ({ name: tool.function.name, definitionHash: digest(stableStringify(tool)) })).sort((a: any, b: any) => a.name.localeCompare(b.name));
      if (binding.goal !== review.goal || binding.providerId !== config.profile.model.providerId || binding.modelId !== config.profile.model.modelId
        || comparable(binding.canonicalWorkspace) !== comparable(path) || !equal(binding.tools, tools)
        || binding.limits.maxIterations !== config.profile.limits.maxIterations || binding.limits.maxTokensPerTurn !== config.profile.model.maxOutputTokens
        || binding.limits.tokenBudget !== config.profile.limits.maxTotalTokens || binding.configuration.maxContextTokens !== config.profile.model.maxInputTokens
        || binding.configuration.maxRepairAttempts !== config.profile.limits.maxRepairAttempts || binding.configuration.frozenContext !== true
        || binding.configuration.planningEnabled !== false || binding.configuration.dynamicBudgetEnabled !== false
        || binding.configuration.hooks?.settled !== true || binding.configuration.hooks?.finalAnswer !== true
        || checkpoint.state.iteration !== counters.iterations || (checkpoint.state.repairAttempts ?? 0) !== counters.repairAttempts
        || counters.modelCalls < counters.iterations || counters.modelCalls > counters.iterations + 1
        || checkpoint.state.totalUsage.totalTokens > counters.reservedTokens) rejected();
    }
    return { original: { ...original, workspaceReceipt: receipt }, path };
  };
  const history = (original: GovernedAgentTaskOriginalWorkspace, baseline: ApprovedCodeFiles, current: ApprovedCodeFiles, plan: GovernedAgentTaskPlan) => {
    const rejected = () => { throw failure("WORKSPACE_RECOVERY_REJECTED", true); };
    const hashes = new Map(baseline.files.map(file => [file.path, file.sha256]));
    let repair = 0;
    for (const receipt of original.stepReceipts) {
      const step = plan.steps.find(value => value.id === receipt.stepId), read = receipt.kind === "inspect";
      if (!step || step.kind === "verify" || receipt.status !== "succeeded" || !policy.readPaths.includes(receipt.path)
        || !integer(receipt.repairAttempt, original.counters.repairAttempts) || receipt.repairAttempt < repair
        || receipt.beforeSha256 !== hashes.get(receipt.path) || (receipt.afterSha256 !== null && !hex(receipt.afterSha256))
        || read && (receipt.toolName !== "file_read" || receipt.fullRead !== true || receipt.changed !== false || receipt.beforeSha256 !== receipt.afterSha256
          || step.kind === "inspect" && !step.paths.includes(receipt.path))
        || !read && (receipt.kind !== "implement" || step.kind !== "implement" || !["file_write", "file_edit"].includes(receipt.toolName)
          || receipt.fullRead !== false || !step.paths.includes(receipt.path) || !policy.writePaths.includes(receipt.path) || !hex(receipt.afterSha256)
          || receipt.changed !== (receipt.beforeSha256 !== receipt.afterSha256))) rejected();
      repair = receipt.repairAttempt; hashes.set(receipt.path, receipt.afterSha256);
      if (receipt.sourceFilesHash !== digest(stableStringify({ profileHash: policy.profileHash, files: policy.readPaths.map(path => [path, hashes.get(path)]) }))) rejected();
    }
    if (current.files.some(file => file.sha256 !== hashes.get(file.path))) rejected();
    const failures: WorkforceCodeSnapshotFailureReceipt[] = [];
    for (const attempt of original.verificationAttempts) {
      const result = attempt.verification;
      if (!result || !["passed", "failed"].includes(attempt.status) || result.status !== attempt.status || result.cleanupConfirmed !== true
        || result.command !== policy.verification.command || result.image !== policy.verification.image || !hex(result.snapshotHash)
        || !Number.isSafeInteger(result.exitCode) || result.exitCode < 0 || (attempt.status === "passed") !== (result.exitCode === 0)
        || typeof result.stdout !== "string" || typeof result.stderr !== "string"
        || Buffer.byteLength(result.stdout) > policy.verification.maxOutputBytes || Buffer.byteLength(result.stderr) > policy.verification.maxOutputBytes
        || attempt.artifact?.profileHash !== policy.profileHash || attempt.artifact.sourceFilesHash !== result.snapshotHash) rejected();
      if (attempt.status === "failed") failures.push(result as WorkforceCodeSnapshotFailureReceipt);
      if (!equal(attempt.failures, failures)) rejected();
    }
    if (original.stepIndex === plan.steps.length && original.verificationAttempts.at(-1)?.status !== "passed") rejected();
    for (const step of plan.steps.slice(0, original.stepIndex).filter(step => step.kind !== "verify")) {
      if (!step.paths.every(path => original.stepReceipts.some(receipt => receipt.stepId === step.id && receipt.path === path
        && receipt.kind === step.kind && (step.kind === "inspect" ? receipt.fullRead : receipt.repairAttempt === original.counters.repairAttempts)))) rejected();
    }
    return { receipts: original.stepReceipts.map(receipt => Object.freeze({ ...receipt })), failures };
  };
  const factory = Object.freeze({
    kind: "governed-agent-task-workspace" as const,
    profile: config.profile,
    hasOwnership(taskId: string, receipt: unknown) {
      const record = owned.get(taskId);
      try { return Boolean(record && !record.poisoned && stableStringify(record.receipt) === stableStringify(receipt)); }
      catch { return false; }
    },
    async prepareReview(input: { goal: string; prompt: string; signal?: AbortSignal }) {
      const source = await currentSource(input.signal);
      const review = createGovernedAgentTaskReview({ profile: config.profile, configuredRepositoryHash: repositoryHash,
        goal: input.goal, prompt: input.prompt, sourceFilesHash: source.filesHash });
      return Object.freeze({ review, sourceFiles: source.files });
    },
    async forChunk(input: GovernedAgentTaskWorkspaceChunkInput, serverOptions: GovernedAgentTaskWorkspaceRecovery = {}) {
      if (!serverOptions || Object.keys(serverOptions).some(key => key !== "recoverOriginal")
        || serverOptions.recoverOriginal !== undefined && typeof serverOptions.recoverOriginal !== "function") throw failure("WORKSPACE_RECOVERY_CAPABILITY_INVALID");
      const operations = readWorkforceCodeDeliveryToolProxy(input.toolProxy);
      if (!operations) throw failure("TOOL_PROXY_REQUIRED");
      const review = readGovernedAgentTaskReview(input.review), plan = readGovernedAgentTaskPlan(input.plan, review);
      input = Object.freeze({ ...input, review, plan, context: Object.freeze({ ...input.context }),
        ...(input.workspaceReceipt ? { workspaceReceipt: continuationJsonCopy(input.workspaceReceipt) } : {}) });
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(input.taskId) || !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(input.context?.agentId)
        || !input.context.tenantId || !input.context.userId || typeof input.assertActive !== "function" || typeof input.getStep !== "function" || typeof input.getRepairAttempt !== "function"
        || !/^sha256:[a-f0-9]{64}$/u.test(input.policyHash) || review.profile.profileHash !== config.profile.profileHash
        || review.configuredRepositoryHash !== repositoryHash) throw failure("WORKSPACE_BINDING_INVALID");
      active(input); await input.assertActive("reserve"); active(input);
      const contextKey = JSON.stringify([input.context.agentId, input.context.tenantId, input.context.userId]);
      if (creationUnknown.has(input.taskId)) throw failure("WORKSPACE_CREATE_UNKNOWN", true);
      if (opening.has(input.taskId) || owned.get(input.taskId)?.active) throw failure("WORKSPACE_BUSY");
      opening.add(input.taskId);
      let record: Owned;
      try {
        const existing = owned.get(input.taskId);
        let original: GovernedAgentTaskOriginalWorkspace | undefined, recoveredPath: string | undefined;
        if (input.workspaceReceipt) {
          if (!existing) {
            if (!serverOptions.recoverOriginal) throw failure("WORKSPACE_OWNERSHIP_UNKNOWN", true);
            const recovered = await readOriginal(await serverOptions.recoverOriginal(), input, review, plan);
            original = recovered.original; recoveredPath = recovered.path;
          } else await assertReceiptIdentities(readReceipt(input.workspaceReceipt));
        }
        const source = await currentSource(input.signal);
        if (source.filesHash !== review.sourceFilesHash) throw failure("REVIEW_SOURCE_CHANGED");
        if (existing) {
          if (!input.workspaceReceipt || stableStringify(input.workspaceReceipt) !== stableStringify(existing.receipt)
            || input.expectedSourceFilesHash !== existing.current.filesHash || existing.contextKey !== contextKey
            || existing.policyHash !== input.policyHash) throw failure("WORKSPACE_RESUME_MISMATCH", true);
          record = existing;
        } else {
          if (input.workspaceReceipt) {
            const recoverOriginal = serverOptions.recoverOriginal;
            if (!recoverOriginal || !original || !recoveredPath) throw failure("WORKSPACE_OWNERSHIP_UNKNOWN", true);
            const originalHash = valueHash(original);
            active(input); await input.assertActive("reserve"); active(input);
            const path = recoveredPath;
            await assertChangedPaths(path, policy.writePaths);
            const current = await captureApprovedCodeFiles(path, policy, input.signal);
            if (current.filesHash !== original.sourceFilesHash || current.files.some(file => !policy.writePaths.includes(file.path)
              && file.sha256 !== source.files.find(before => before.path === file.path)?.sha256)) throw failure("WORKSPACE_SOURCE_CHANGED", true);
            const baseline = Object.freeze({ ...source, root: path }), receipts = history(original, baseline, current, plan);
            const authorize = async () => {
              active(input); await input.assertActive("reserve"); active(input);
              const rechecked = await readOriginal(await recoverOriginal(), input, review, plan);
              if (valueHash(rechecked.original) !== originalHash || comparable(rechecked.path) !== comparable(path)) throw failure("WORKSPACE_RECOVERY_CHANGED", true);
              await input.assertActive("commit"); active(input);
            };
            const receipt = original.workspaceReceipt;
            await restoreOwnedWorkforceWorktree(manager, { worktreeId: receipt.worktreeId, planId: input.taskId, branch: receipt.branch,
              baselineRevision: receipt.baselineRevision, createdAt: receipt.createdAt, identities: receipt.identities }, authorize);
            record = { receipt, baseline, current, contextKey, policyHash: input.policyHash, active: false, poisoned: null, ...receipts };
            owned.set(input.taskId, record);
          } else {
          creationUnknown.add(input.taskId);
          const created = await manager.create({ planId: input.taskId, branch: policy.baselineRevision,
            newBranch: `codex/agent-task-${randomUUID()}` });
          if (!created.success || !created.worktree) throw failure("WORKSPACE_CREATE_UNKNOWN", true);
          const proof = await assertOwnedWorkforceWorktree(manager, created.worktree.worktreeId,
            { planId: input.taskId, baselineRevision: policy.baselineRevision });
          const receipt: GovernedAgentTaskWorkspaceReceipt = Object.freeze({ version: 2, taskId: input.taskId,
            worktreeId: created.worktree.worktreeId, branch: created.worktree.branch, reviewHash: review.reviewHash,
            planHash: plan.planHash, baselineRevision: policy.baselineRevision, createdAt: proof.createdAt, identities: proof.identities });
          const baseline = await captureApprovedCodeFiles(created.worktree.path, policy, input.signal);
          record = { receipt, baseline, current: baseline, contextKey, policyHash: input.policyHash,
            active: false, poisoned: null, receipts: [], failures: [] };
          owned.set(input.taskId, record);
          creationUnknown.delete(input.taskId);
          }
        }
        if (record.receipt.reviewHash !== review.reviewHash || record.receipt.planHash !== plan.planHash) throw failure("WORKSPACE_RESUME_MISMATCH", true);
        if (record.poisoned) throw record.poisoned;
        if (record.baseline.filesHash !== source.filesHash) throw failure("WORKSPACE_BASELINE_CHANGED", true);
        record.active = true;
      } finally { opening.delete(input.taskId); }
      let closed = false, closing = false, pending: Promise<unknown> | null = null;
      const releases = new Set<Promise<unknown>>();
      const context = Object.freeze({ ...input.context });
      const poison = (error: Error) => { record.poisoned ??= error; return record.poisoned; };
      const check = async (phase: "reserve" | "commit" = "commit") => {
        if (record.poisoned) throw record.poisoned;
        if (closed) throw failure("WORKSPACE_CHUNK_CLOSED");
        active(input); await input.assertActive(phase); active(input);
        const worktree = await assertOwnedWorkforceWorktree(manager, record.receipt.worktreeId,
          { planId: input.taskId, baselineRevision: policy.baselineRevision }).catch(() => { throw poison(failure("WORKSPACE_OWNERSHIP_UNKNOWN", true)); });
        if (comparable(worktree.repositoryRoot) !== comparable(config.repoRoot) || !equal(worktree.identities, record.receipt.identities)) throw poison(failure("WORKSPACE_OWNERSHIP_UNKNOWN", true));
        active(input); return worktree;
      };
      const step = () => {
        const requested = input.getStep(), approved = plan.steps.find(value => value.id === requested?.id);
        if (!approved || stableStringify(requested) !== stableStringify(approved)) throw failure("STEP_BINDING_INVALID");
        return approved;
      };
      const capture = async () => {
        const workspace = await check();
        await assertChangedPaths(workspace.path, policy.writePaths);
        const files = await captureApprovedCodeFiles(workspace.path, policy, input.signal);
        if (files.files.some(file => !policy.writePaths.includes(file.path)
          && file.sha256 !== record.baseline.files.find(before => before.path === file.path)?.sha256)) throw poison(failure("READ_ONLY_SOURCE_CHANGED", true));
        return files;
      };
      let invocation: { name: string; params: Record<string, any>; step: GovernedAgentTaskPlanStep; admitted: boolean } | null = null;
      const scopedProxy = {
        async enforce(request: any) {
          const ownedWorktree = await check("reserve");
          if (!invocation || invocation.name !== request.toolName || stableStringify(invocation.params) !== stableStringify(request.params)
            || step().id !== invocation.step.id) throw failure("TOOL_SCOPE_DENIED");
          const verdict = await operations.enforce({ ...request, context, resourceContext: { ...request.resourceContext,
            resourceKeys: { ...request.resourceContext?.resourceKeys, projectId: policy.projectId, taskId: input.taskId,
              stepId: invocation.step.id, projectRoot: ownedWorktree.path,
              canonicalPath: resolve(ownedWorktree.path, invocation.params.file_path), path: invocation.params.file_path },
          } });
          if (verdict.outcome !== "allow") return verdict;
          if (typeof verdict.executionLease?.release !== "function") throw poison(failure("TOOL_RELEASE_UNKNOWN", true));
          const release = verdict.executionLease.release.bind(verdict.executionLease);
          try {
            if (verdict.policy?.policyHash !== input.policyHash || verdict.approvedParams !== undefined) throw failure("TOOL_POLICY_CHANGED");
            const worktree = await check();
            if ((await captureApprovedCodeFiles(worktree.path, policy, input.signal)).filesHash !== record.current.filesHash) throw failure("WORKSPACE_SOURCE_CHANGED", true);
          } catch (error) {
            try { await release(); } catch { throw poison(failure("TOOL_RELEASE_UNKNOWN", true)); }
            throw poison(error instanceof Error ? error : failure("TOOL_POLICY_CHANGED"));
          }
          invocation.admitted = true;
          return { ...verdict, executionLease: { release() {
            const work = Promise.resolve().then(release).catch(() => { throw poison(failure("TOOL_RELEASE_UNKNOWN", true)); });
            releases.add(work); void work.then(() => releases.delete(work), () => releases.delete(work)); return work;
          } } };
        },
        async enforceResult(event: any) {
          await check();
          const audited = await operations.enforceResult({ ...event, context });
          if (!audited || !Object.hasOwn(audited, "result") || audited.verdict === "replace") throw failure("TOOL_RESULT_UNREVIEWABLE", invocation?.name !== "file_read");
          return audited;
        },
      };
      const workspace = await check().catch(error => { record.active = false; throw error; });
      const initial = await capture().catch(error => { record.active = false; throw error; });
      if (initial.filesHash !== record.current.filesHash) { record.active = false; throw poison(failure("WORKSPACE_SOURCE_CHANGED", true)); }
      const registry = createAgentToolRegistry({ workingDirectory: workspace.path, governanceRequired: true,
        governanceToolProxy: scopedProxy, enableHighRiskTools: false } as any);
      const serialized = async <T>(run: () => Promise<T>): Promise<T> => {
        if (closed || closing) throw failure("WORKSPACE_CHUNK_CLOSED");
        const work = (pending ?? Promise.resolve()).then(() => {
          if (record.poisoned) throw record.poisoned;
          active(input); return run();
        });
        pending = work;
        try { return await work; } finally { if (pending === work) pending = null; }
      };
      const tools = Object.freeze({
        listTools() { return registry.listTools({ allowlist: [...names] }); },
        getTool(name: string) { return this.listTools().find((tool: any) => tool.name === name) ?? null; },
        getHealth() { return Object.freeze({ governanceToolProxyConfigured: true, governanceRequired: true }); },
        getExecutionLog() { return registry.getExecutionLog(); },
        executeTool(name: string, raw: unknown = {}, _ignoredContext?: unknown) { return serialized(async () => {
          const currentStep = step(), repairAttempt = input.getRepairAttempt(), params = parameters(raw), path = params.file_path;
          if (!Number.isSafeInteger(repairAttempt) || repairAttempt < 0 || repairAttempt > config.profile.limits.maxRepairAttempts) throw failure("STEP_BINDING_INVALID");
          const allowedPaths = currentStep.kind === "implement" && name === "file_read" ? policy.readPaths : currentStep.paths;
          if (!names.includes(name) || typeof path !== "string" || !allowedPaths.includes(path) || currentStep.kind === "verify"
            || currentStep.kind === "inspect" && name !== "file_read" || params.create_backup === true) throw failure("TOOL_SCOPE_DENIED");
          if (name !== "file_read") params.create_backup = false;
          const before = await capture();
          if (before.filesHash !== record.current.filesHash) throw poison(failure("WORKSPACE_SOURCE_CHANGED", true));
          const source = before.files.find(file => file.path === path)!;
          let expectedContent: string | null = source.content;
          if (name === "file_write") {
            if (typeof params.content !== "string") throw failure("TOOL_SCOPE_DENIED");
            expectedContent = (params.mode === "append" ? source.content ?? "" : "") + params.content;
          } else if (name === "file_edit") {
            if (source.content === null || typeof params.old_string !== "string" || typeof params.new_string !== "string") throw failure("TOOL_SCOPE_DENIED");
            const replaced = performSearchReplace(source.content, params.old_string, params.new_string, { allowMultiple: params.allow_multiple === true });
            if (!replaced.success || typeof replaced.result !== "string") throw failure("EDIT_MATCH_FAILED");
            expectedContent = replaced.result;
          }
          if (expectedContent !== null && (Buffer.byteLength(expectedContent) > policy.artifactLimits.maxFileBytes
            || expectedContent.includes("\0") || containsSensitivePublicationText(expectedContent)
            || Buffer.from(expectedContent, "utf8").toString("utf8") !== expectedContent)) throw failure("TOOL_CONTENT_DENIED");
          invocation = { name, params, step: currentStep, admitted: false };
          try {
            const result: any = await registry.executeTool(name, params, { agentGovernance: context, runAllowedTools: names } as any);
            await Promise.all([...releases]); await check();
            const after = await capture();
            if (name !== "file_read" && invocation.admitted && result?.status !== "success") throw failure("TOOL_OUTCOME_UNKNOWN", true);
            if (result?.status !== "success") return result;
            const changed = after.files.find(file => file.path === path)!;
            if (after.files.some(file => file.path !== path && file.sha256 !== before.files.find(old => old.path === file.path)?.sha256)
              || name === "file_read" && after.filesHash !== before.filesHash
              || name !== "file_read" && changed.sha256 !== digest(expectedContent!)) throw failure("TOOL_OUTCOME_UNKNOWN", true);
            record.current = after;
            const fullRead = name === "file_read" && !Object.hasOwn(params, "offset") && !Object.hasOwn(params, "limit")
              && result.content === source.content && typeof source.content === "string";
            if (fullRead || name !== "file_read") record.receipts.push(Object.freeze({
              stepId: currentStep.id, kind: name === "file_read" ? "inspect" : "implement", toolName: name, path,
              beforeSha256: source.sha256, afterSha256: changed.sha256, sourceFilesHash: after.filesHash, fullRead,
              changed: source.sha256 !== changed.sha256, repairAttempt, status: "succeeded",
            }));
            return result;
          } catch (error) {
            if (invocation.admitted && name !== "file_read") throw poison(failure("TOOL_OUTCOME_UNKNOWN", true));
            throw error;
          } finally { invocation = null; }
        }); },
      });
      return Object.freeze({
        workspaceReceipt: record.receipt, workingDirectory: workspace.path, tools,
        stepReceipts: () => Object.freeze([...record.receipts]),
        async captureCurrent() { return serialized(async () => {
          const files = await capture();
          if (files.filesHash !== record.current.filesHash) throw poison(failure("WORKSPACE_SOURCE_CHANGED", true));
          return Object.freeze({ filesHash: files.filesHash, sourceFilesHash: files.filesHash, changedFiles: Object.freeze(files.files.filter(file =>
            file.sha256 !== record.baseline.files.find(old => old.path === file.path)?.sha256).map(file => file.path)) });
        }); },
        async verify() { return serialized(async () => {
          if (step().kind !== "verify") throw failure("STEP_BINDING_INVALID");
          if ((await currentSource(input.signal)).filesHash !== review.sourceFilesHash) throw failure("REVIEW_SOURCE_CHANGED");
          const source = await capture();
          if (source.filesHash !== record.current.filesHash) throw poison(failure("WORKSPACE_SOURCE_CHANGED", true));
          const artifact = createCodeDeliveryArtifact(record.baseline, source, policy);
          try {
            const verification = await verifyWorkforceCodeSnapshot({ source, profile: policy, scratchRoot: config.scratchRoot,
              enginePath: config.enginePath, context, policyHash: input.policyHash, planId: input.taskId,
              planDigest: plan.planHash.slice(7), executionId: input.taskId, taskId: step().id, toolProxy: input.toolProxy as any,
              signal: input.signal, deadlineAt: input.deadlineAt, assertActive: check });
            await check();
            return Object.freeze({ status: "passed" as const, artifact, verification, failures: Object.freeze([...record.failures]) });
          } catch (error) {
            const rejected = error as { verificationReceipt?: WorkforceCodeSnapshotFailureReceipt; outcomeUnknown?: boolean; cleanupUncertain?: boolean; backendErrorCode?: unknown };
            if (!rejected.verificationReceipt || rejected.outcomeUnknown || rejected.cleanupUncertain) {
              const unknown = failure("VERIFICATION_OUTCOME_UNKNOWN", true);
              if (typeof rejected.backendErrorCode === "string" && /^[A-Z][A-Z0-9_]{0,95}$/u.test(rejected.backendErrorCode)) Object.assign(unknown, { verificationCode: rejected.backendErrorCode });
              throw poison(unknown);
            }
            record.failures.push(rejected.verificationReceipt);
            return Object.freeze({ status: "failed" as const, artifact, verification: rejected.verificationReceipt,
              failures: Object.freeze([...record.failures]) });
          }
        }); },
        async close() {
          closing = true;
          try { if (pending) await pending; await Promise.all([...releases]); }
          finally { closed = true; record.active = false; }
          if (record.poisoned) throw record.poisoned;
        },
      });
    },
  });
  factories.add(factory); return factory;
}
export type GovernedAgentTaskWorkspace = ReturnType<typeof createGovernedAgentTaskWorkspace>;
export function isGovernedAgentTaskWorkspace(value: unknown): value is GovernedAgentTaskWorkspace {
  return Boolean(value && typeof value === "object" && factories.has(value));
}
