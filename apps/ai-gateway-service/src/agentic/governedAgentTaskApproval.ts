import type { AgentToolApprovalReview } from "@unified-ai-system/shared-contracts";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { readGovernedAgentTaskPlan, readGovernedAgentTaskReview } from "./governedAgentTaskProfile.ts";
import type { GovernedAgentTaskPlan, GovernedAgentTaskReview } from "./governedAgentTaskProfile.ts";

export const GOVERNED_AGENT_TASK_TOOL = "agent_long_task";
export type GovernedAgentTaskApprovalArguments = Readonly<{
  taskId: string; agentRunId: string; review: GovernedAgentTaskReview; plan: GovernedAgentTaskPlan;
}>;
const fail = () => { throw Object.assign(new Error("The complete Agent task approval does not match its original task."),
  { code: "AGENT_LONG_TASK_APPROVAL_INVALID", statusCode: 409 }); };
function exact(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Reflect.ownKeys(value).length !== keys.length) return fail();
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) return fail();
  }
  return value as Record<string, unknown>;
}
export function readGovernedAgentTaskApprovalArguments(value: unknown): GovernedAgentTaskApprovalArguments {
  const source = exact(value, ["taskId", "agentRunId", "review", "plan"]);
  if (typeof source.taskId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(source.taskId)
    || typeof source.agentRunId !== "string" || !/^agr_[A-Za-z0-9_-]{1,128}$/u.test(source.agentRunId)) return fail();
  const review = readGovernedAgentTaskReview(source.review), plan = readGovernedAgentTaskPlan(source.plan, review);
  return Object.freeze({ taskId: source.taskId, agentRunId: source.agentRunId, review, plan });
}
export function createGovernedAgentTaskApprovalReview(value: GovernedAgentTaskApprovalArguments, policyHash: string): AgentToolApprovalReview {
  if (!/^sha256:[a-f0-9]{64}$/u.test(policyHash)) return fail();
  const args = readGovernedAgentTaskApprovalArguments(value);
  return Object.freeze({ schemaVersion: 1, reviewable: true, effectType: "agent:long-task", policyHash,
    agentTask: Object.freeze({ taskId: args.taskId, agentRunId: args.agentRunId, review: args.review, plan: args.plan }) });
}
export function readGovernedAgentTaskApprovalReview(value: unknown): AgentToolApprovalReview {
  const source = exact(value, ["schemaVersion", "reviewable", "effectType", "policyHash", "agentTask"]);
  if (source.schemaVersion !== 1 || source.reviewable !== true || source.effectType !== "agent:long-task"
    || typeof source.policyHash !== "string") return fail();
  return createGovernedAgentTaskApprovalReview(readGovernedAgentTaskApprovalArguments(source.agentTask), source.policyHash);
}
export function assertGovernedAgentTaskApprovalArguments(review: AgentToolApprovalReview, value: unknown, toolName: string): void {
  const checked = readGovernedAgentTaskApprovalReview(review);
  if (toolName !== GOVERNED_AGENT_TASK_TOOL || stableStringify(readGovernedAgentTaskApprovalArguments(value)) !== stableStringify(checked.agentTask)) fail();
}
