import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { createLocalWorkflowService } from "../workflow/localWorkflowService.js";
import { createWorkforceWorkflowHandoff } from "./workforceWorkflowHandoffRuntime.ts";
import { createWorkforceWorkflowHandoffReview } from "./workforceWorkflowHandoffProfile.ts";
import { workflowHandoffRequest } from "./workforceWorkflowHandoffBinding.ts";
import { executeWorkforceDag } from "./workforceDagExecutor.ts";
import { TaskQueueManager } from "./taskQueueManager.js";
import { createTaskClaimLeaseManager } from "./taskClaimLease.ts";

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); vi.restoreAllMocks(); });
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
async function fixture() {
  const root = await mkdtemp(join(await realpath(tmpdir()), "workflow-handoff-runtime-"));
  cleanups.push(async () => { expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(await realpath(tmpdir())); await rm(root, { recursive: true, force: true }); });
  let now = Date.now();
  const queue = new TaskQueueManager({ queueFile: join(root, "queue.json"), claimManager: createTaskClaimLeaseManager({ clock: () => now, ttlMs: 10000 }) });
  await queue.init(); cleanups.push(() => queue.close());
  const identity = { tenantId: "handoff-tenant", userId: "handoff-owner", permissions: ["workflow:run"] };
  const controller = new AbortController();
  const active = vi.fn(async () => { if (controller.signal.aborted) throw controller.signal.reason; });
  const agentFence = { fingerprint: "fixture-agent-run", assertActive: active };
  const policy = { policyHash: "sha256:" + "a".repeat(64), grantedTools: ["file_write"], toolDecisions: { file_write: "allow" },
    permissions: { canWrite: true }, limits: { maxToolCalls: 20 }, scope: {}, requirements: {}, mandatory: {} };
  // Concrete DAG, queue, journal and filesystem. Governance decisions are a local model in this module test.
  const governance = { service: {
    authorizeAgentExecution: vi.fn(async () => ({ record: { agentId: "agt_handoff" }, policy,
      executionLease: { signal: controller.signal, assertActive: active, release: vi.fn() } })),
    reserveUsage: vi.fn(async () => ({ allowed: true })), emitAudit: vi.fn(async () => {}) },
    toolProxy: { enforce: vi.fn(async (_input: any): Promise<any> => ({ outcome: "allow", policy,
      executionLease: { signal: controller.signal, release: vi.fn() } })),
      enforceResult: vi.fn(async ({ result }: any) => ({ verdict: "allow", result })) } };
  const retrieve = vi.fn(async (_request: any, _context: any) => ({ mode: "keyword", chunks: [], metadata: {} }));
  const createService = () => createLocalWorkflowService({ outputDir: join(root, "artifacts"), knowledgeService: { retrieve } });
  const workflow = createService(), runtime = createWorkforceWorkflowHandoff(workflow);
  const review = createWorkforceWorkflowHandoffReview({ input: { workflowHandoff: { roleId: "ceo", query: "Release evidence", sourceIds: ["docs"], topK: 2 } },
    plan: { goal: "Prepare release report", selectedRoles: ["ceo"], taskBreakdown: [{ roleId: "ceo" }] }, outputRootHash: runtime.getInfo().outputRootHash })!;
  const metadata = { version: 1 as const, agentId: "agt_handoff", planId: "handoff-plan", planDigest: "b".repeat(64), review };
  const executionId = "handoff-execution", task = await queue.enqueue({ planId: metadata.planId, title: "Prepare report" });
  const base = { executionId, metadata, identity, taskId: task.taskId, agentRunId: "agr_handoff", agentFence, governance, signal: controller.signal };
  let failure: any;
  const run = async (operation = (input: any) => runtime.run(input)) => executeWorkforceDag({
    tasks: [{ queueTaskId: task.taskId, roleId: "ceo", dependsOnRoleIds: [] }], taskQueue: queue, agentExecutionFence: agentFence, claimTtlMs: 10000,
    context: { executionId, agentRunId: base.agentRunId, governedAgentId: metadata.agentId }, signal: controller.signal,
    executeRole: async (_role, context) => { try { return await operation({ ...base, taskFence: context.externalEffectFence }); }
      catch (error) { failure = error; throw error; } } });
  const inspect = () => runtime.inspect(base);
  const recovery = () => ({ ...base, workflowId: workflowHandoffRequest(executionId, metadata).workflowId });
  return { root, base, workflow, runtime, queue, governance, retrieve, createService, run, inspect, recovery, controller,
    failure: () => failure, expireClaim: () => { now += 60000; } };
}

it("publishes through the actual DAG and journal, verifies bytes, and replays after restart without writing or retrieving", async () => {
  const f = await fixture();
  await f.run();
  const observed = await f.inspect();
  expect(observed).toMatchObject({ status: "completed", originVerified: true, artifactVerified: true, taskId: f.base.taskId });
  expect(hash(await readFile(observed.result.artifact.absolutePath))).toBe(observed.result.artifact.sha256);
  expect(f.retrieve).toHaveBeenCalledWith(expect.objectContaining({ query: "Release evidence", sourceIds: ["docs"], topK: 2 }),
    expect.objectContaining({ tenantId: f.base.identity.tenantId, userId: f.base.identity.userId, governedAgentId: f.base.metadata.agentId }));
  expect(f.governance.toolProxy.enforce).toHaveBeenCalledWith(expect.objectContaining({ toolName: "file_write",
    resourceContext: expect.objectContaining({ approvalReview: expect.objectContaining({ workflow: expect.objectContaining({ content: expect.stringContaining("Prepare release report") }) }) }) }));
  const restarted = createWorkforceWorkflowHandoff(f.createService());
  const replay = await restarted.recover(f.recovery());
  expect(replay).toMatchObject({ status: "completed", artifactVerified: true, parentExecutionResumed: false, employeeRolesRerun: false });
  expect(replay.result).toEqual(observed.result); expect(f.retrieve).toHaveBeenCalledOnce(); expect(f.governance.toolProxy.enforce).toHaveBeenCalledOnce();
  await expect(restarted.recover({ ...f.recovery(), taskId: "other-task" })).rejects.toMatchObject({ code: "WORKFORCE_WORKFLOW_RECOVERY_BINDING_INVALID" });
  expect(await restarted.inspect({ ...f.base, identity: { ...f.base.identity, userId: "other-owner" } })).toMatchObject({ status: "not_observed", result: null, originVerified: false });
  await expect(restarted.recover({ ...f.recovery(), identity: { ...f.base.identity, userId: "other-owner" } })).rejects.toMatchObject({ code: "WORKFORCE_WORKFLOW_RECOVERY_BINDING_INVALID" });
});

it("rejects copied fences, another Agent or role, and one-claim reuse before any second publication", async () => {
  const f = await fixture();
  await f.run(async input => {
    for (const changed of [{ taskFence: { ...input.taskFence } }, { taskId: "different-task" }, { agentRunId: "different-run" },
      { metadata: { ...input.metadata, agentId: "agt_different" } }]) {
      await expect(f.workflow.createWorkforceHandoffContext({ ...input, ...changed })).rejects.toMatchObject({ code: "WORKFORCE_CODE_TASK_FENCE_INVALID" });
    }
    const result = await f.runtime.run(input);
    await expect(f.runtime.run(input)).rejects.toMatchObject({ code: "WORKFORCE_WORKFLOW_CLAIM_REUSED" });
    return result;
  });
  expect(f.retrieve).toHaveBeenCalledOnce(); expect(f.governance.toolProxy.enforce).toHaveBeenCalledOnce();
});

it("checks claim expiry again after retrieval and never publishes or completes an expired task", async () => {
  const f = await fixture();
  f.retrieve.mockImplementationOnce(async () => { f.expireClaim(); return { mode: "keyword", chunks: [], metadata: {} }; });
  await expect(f.run()).rejects.toMatchObject({ code: "WORKFORCE_DAG_EXECUTION_FAILED" });
  expect(f.failure()?.code).toBe("TASK_CLAIM_INVALID");
  const state = await f.inspect(); expect(state.status).not.toBe("completed"); expect(state.result).toBeNull();
  expect(f.governance.toolProxy.enforce).not.toHaveBeenCalled(); expect(f.queue.getQueueStatus().totalCompleted).toBe(0);
});

it("preserves an approval-waiting draft and resumes the exact original task after service restart", async () => {
  const f = await fixture();
  f.governance.toolProxy.enforce.mockResolvedValueOnce({ outcome: "approval_required", code: "TOOL_APPROVAL_REQUIRED", approvalId: "appr_handoff_fixture" });
  await expect(f.run()).rejects.toMatchObject({ code: "WORKFORCE_DAG_EXECUTION_FAILED" });
  expect(f.failure()).toMatchObject({ code: "TOOL_APPROVAL_REQUIRED", details: { approvalId: "appr_handoff_fixture" } });
  const original = await f.inspect(); expect(original).toMatchObject({ canResume: true, result: null, error: { approvalId: "appr_handoff_fixture" } });
  const firstReview = f.governance.toolProxy.enforce.mock.calls[0][0].resourceContext.approvalReview;
  const restarted = createWorkforceWorkflowHandoff(f.createService());
  expect(await restarted.recover(f.recovery())).toMatchObject({ status: "completed", artifactVerified: true, employeeRolesRerun: false });
  expect(f.governance.toolProxy.enforce.mock.calls[1][0].resourceContext.approvalReview).toEqual(firstReview);
  expect(f.retrieve).toHaveBeenCalledOnce(); expect(f.queue.getQueueStatus().totalCompleted).toBe(0);
});

it("cancels during retrieval without publishing or recording a completed task", async () => {
  const f = await fixture();
  const error = Object.assign(new Error("operator cancelled"), { code: "CLIENT_DISCONNECTED", statusCode: 499 });
  f.retrieve.mockImplementationOnce(async () => { f.controller.abort(error); return { mode: "keyword", chunks: [], metadata: {} }; });
  await expect(f.run()).rejects.toThrow();
  expect(f.failure()).toBe(error); expect((await f.inspect()).result).toBeNull();
  expect(f.governance.toolProxy.enforce).not.toHaveBeenCalled(); expect(f.queue.getQueueStatus().totalCompleted).toBe(0);
});

it("keeps post-publication uncertainty and recovers only its receipt, refusing a changed artifact", async () => {
  const f = await fixture();
  f.governance.toolProxy.enforceResult.mockRejectedValueOnce(new Error("receipt audit unavailable"));
  await expect(f.run()).rejects.toMatchObject({ code: "WORKFORCE_DAG_EXECUTION_FAILED" });
  expect(f.failure()).toMatchObject({ code: "WORKFLOW_ARTIFACT_OUTCOME_UNCERTAIN", outcomeUnknown: true });
  expect(await f.inspect()).toMatchObject({ outcomeUnknown: true, result: null });
  const result = await createWorkforceWorkflowHandoff(f.createService()).recover(f.recovery());
  expect(result).toMatchObject({ status: "completed", artifactVerified: true });
  expect(f.retrieve).toHaveBeenCalledOnce(); expect(f.governance.toolProxy.enforce).toHaveBeenCalledOnce();
  await writeFile(result.result.artifact.absolutePath, "changed fixture artifact");
  expect(await f.inspect()).toMatchObject({ artifactVerified: false, result: null });
  await expect(f.runtime.recover(f.recovery())).rejects.toMatchObject({ code: "WORKFORCE_WORKFLOW_ARTIFACT_UNAVAILABLE" });
  expect(await readFile(result.result.artifact.absolutePath, "utf8")).toBe("changed fixture artifact");
});
