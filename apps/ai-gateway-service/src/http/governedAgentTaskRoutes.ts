import type { IncomingMessage, ServerResponse } from "node:http";
import { createErrorEnvelope, createOkEnvelope } from "@unified-ai-system/shared-utils";
import type { createGovernedAgentTaskRuntime } from "../agentic/governedAgentTaskRuntime.ts";
import { getVirtualKeyRequestAccounting, inheritVirtualKeyRequestAccounting } from "../enterprise/virtualKeyRequestAccounting.ts";
import type { GatewayExecutionContext } from "./httpRequestExecution.ts";
import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { readJson, writeJson } from "./utils/responseUtils.js";

type Runtime = ReturnType<typeof createGovernedAgentTaskRuntime> & {
  scheduleInPool?(taskId: string, identity: Identity, revision: number, request: IncomingMessage): Promise<unknown>;
};
type Identity = Parameters<Runtime["prepare"]>[0];
type Context = {
  request: IncomingMessage & { enterpriseIdentity?: Partial<Identity> };
  response: ServerResponse; url: URL; startedAt: number; requestId?: string;
  requestExecution?: GatewayExecutionContext;
  application?: { getAgentLongTaskRuntime?(selector?: { taskId?: string; projectId?: string; identity?: Identity }): Promise<Runtime> };
  writeServiceLog?(event: string, data: Record<string, unknown>): void;
};
const PATH = /^\/v1\/agents\/(agt_[A-Za-z0-9_-]{1,128})\/tasks(?:\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:\/(plan|confirm|run|schedule|pause|cancel|reconcile))?)?$/u;
function invalid(code = "REQUEST_INVALID", statusCode = 400) {
  return Object.assign(new Error("The governed Agent task request cannot be accepted."), { code: `AGENT_LONG_TASK_${code}`, statusCode });
}
function fields(value: unknown, required: string[], optional: string[] = []): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))
    || required.some(key => !Object.hasOwn(value, key))) throw invalid();
  return value as Record<string, unknown>;
}
function revision(body: Record<string, unknown>): number {
  if (!Number.isSafeInteger(body.revision) || Number(body.revision) < 0) throw invalid();
  return Number(body.revision);
}

/** The path and authenticated transport supply identity; request JSON carries no execution authority. */
export async function dispatchGovernedAgentTaskRoutes(context: Context) {
  const { request, response, url, startedAt } = context;
  const match = PATH.exec(url.pathname);
  if (!match) return ROUTE_NOT_HANDLED;
  const [, agentId, taskId, action] = match;
  if (taskId && !action ? request.method !== "GET" : request.method !== "POST") return ROUTE_NOT_HANDLED;
  try {
    if (url.search) throw invalid();
    const caller = request.enterpriseIdentity, execution = context.requestExecution;
    if (!caller?.tenantId || !caller.userId || !caller.role || !Array.isArray(caller.permissions)) throw invalid("IDENTITY_REQUIRED", 401);
    if (!(execution?.signal instanceof AbortSignal) || !Number.isFinite(execution.deadlineAt)) throw invalid("EXECUTION_UNAVAILABLE", 503);
    inheritVirtualKeyRequestAccounting(request, execution);
    if (caller.apiKeyFingerprint && !getVirtualKeyRequestAccounting(execution)) throw invalid("ACCOUNTING_UNAVAILABLE", 503);
    const identity: Identity = { agentId, tenantId: caller.tenantId, userId: caller.userId, role: caller.role,
      permissions: [...caller.permissions], requestId: context.requestId, execution,
      ...(Object.hasOwn(caller, "actorAgentId") ? { actorAgentId: caller.actorAgentId } : {}),
      ...(caller.apiKeyFingerprint ? { apiKeyFingerprint: caller.apiKeyFingerprint } : {}) };
    // Validate the complete request before even opening the retained queue.
    let body: Record<string, unknown> = {};
    if (request.method === "GET") {
      if (request.headers["transfer-encoding"] || Number(request.headers["content-length"] ?? 0) !== 0) throw invalid();
    } else {
      let parsed: unknown;
      try { parsed = await readJson(request, action ? 4096 : 524288); }
      catch (error) { throw invalid("REQUEST_INVALID", (error as { statusCode?: number })?.statusCode === 413 ? 413 : 400); }
      body = !taskId ? fields(parsed, ["goal", "prompt"], ["projectId"])
        : action === "confirm" ? fields(parsed, ["revision", "reviewHash", "planHash", "approvalId"])
          : fields(parsed, ["revision"], action === "run" ? ["maxIterations"] : []);
      if (!taskId) {
        if (typeof body.goal !== "string" || !body.goal.trim() || typeof body.prompt !== "string" || !body.prompt.trim()) throw invalid();
        if (body.projectId !== undefined && (typeof body.projectId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(body.projectId))) throw invalid();
      } else {
        revision(body);
        if (action === "confirm" && (!/^sha256:[a-f0-9]{64}$/u.test(String(body.reviewHash))
          || !/^sha256:[a-f0-9]{64}$/u.test(String(body.planHash)) || typeof body.approvalId !== "string"
          || !/^[A-Za-z0-9_-]{1,160}$/u.test(body.approvalId))) throw invalid();
        if (Object.hasOwn(body, "maxIterations") && (!Number.isSafeInteger(body.maxIterations)
          || Number(body.maxIterations) < 1 || Number(body.maxIterations) > 10)) throw invalid();
      }
    }
    const runtime = await context.application?.getAgentLongTaskRuntime?.({ identity, ...(taskId ? { taskId } : {}),
      ...(body.projectId !== undefined ? { projectId: body.projectId as string } : {}) });
    if (!runtime) throw invalid("UNAVAILABLE", 503);
    const result = !taskId ? await runtime.prepare(identity, { goal: body.goal as string, prompt: body.prompt as string })
      : !action ? await runtime.read(taskId, identity)
        : action === "plan" ? await runtime.plan(taskId, identity, revision(body))
          : action === "confirm" ? await runtime.confirm(taskId, identity, { revision: revision(body), reviewHash: body.reviewHash as string,
            planHash: body.planHash as string, approvalId: body.approvalId as string })
            : action === "schedule" ? runtime.scheduleInPool
              ? await runtime.scheduleInPool(taskId, identity, revision(body), request) : (() => { throw invalid("POOL_NOT_CONFIGURED", 503); })()
            : action === "run" ? await runtime.run(taskId, identity, { revision: revision(body),
              ...(Object.hasOwn(body, "maxIterations") ? { maxIterations: Number(body.maxIterations) } : {}) })
              : action === "reconcile" ? await runtime.reconcile(taskId, identity, revision(body))
              : await runtime.control(taskId, identity, revision(body), action as "pause" | "cancel");
    context.writeServiceLog?.("agent_long_task_request_completed", { action: action ?? (taskId ? "read" : "prepare"), agentId, taskId: taskId ?? null });
    if (!response.writableEnded && !response.destroyed) writeJson(response, 200, createOkEnvelope(result, { startedAt }));
  } catch (error) {
    const candidate = error as { code?: unknown; statusCode?: unknown; outcomeUnknown?: unknown; persistenceOutcomeUnknown?: unknown };
    const status = Number.isInteger(candidate?.statusCode) && Number(candidate.statusCode) >= 400 && Number(candidate.statusCode) <= 599
      ? Number(candidate.statusCode) : 500;
    const code = typeof candidate?.code === "string" && /^[A-Z][A-Z0-9_]{1,100}$/u.test(candidate.code) ? candidate.code : "AGENT_LONG_TASK_FAILED";
    const details = { ...(taskId ? { taskId } : {}),
      ...(typeof candidate?.outcomeUnknown === "boolean" ? { outcomeUnknown: candidate.outcomeUnknown } : {}),
      ...(typeof candidate?.persistenceOutcomeUnknown === "boolean" ? { persistenceOutcomeUnknown: candidate.persistenceOutcomeUnknown } : {}) };
    context.writeServiceLog?.("agent_long_task_request_failed", { code, status, agentId, taskId: taskId ?? null });
    if (!response.writableEnded && !response.destroyed) writeJson(response, status, createErrorEnvelope(code,
      "The governed Agent task request could not complete.", { startedAt, category: status >= 500 ? "unavailable" : "validation", retryable: false, details }));
  }
}
