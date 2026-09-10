import type { IncomingMessage, ServerResponse } from "node:http";
import { createErrorEnvelope, createOkEnvelope } from "@unified-ai-system/shared-utils";
import type { AgentToolApprovalReview } from "@unified-ai-system/shared-contracts";
import type { AgentGovernanceService, GovernanceContext } from "../agent-governance/agentGovernanceService.ts";
import type { AgentGovernanceToolProxy, ToolProxyVerdict } from "../agent-governance/toolProxy.ts";
import { createTaijiCapabilityService, taijiDigest, normalizeTaijiOwner } from "../real-capabilities/taijiCapabilityService.ts";
import type { TaijiOperation } from "../real-capabilities/taijiCapabilityService.ts";
import { readJson, writeJson } from "./utils/responseUtils.js";
import { containsSensitivePublicationText } from "../security/secretSafety.js";

type Data = Record<string, unknown>;
type RouteContext = {
  application: { taijiCapabilityService?: ReturnType<typeof createTaijiCapabilityService> | null;
    agentGovernance?: { service: AgentGovernanceService; toolProxy: AgentGovernanceToolProxy } | null };
  request: IncomingMessage & { enterpriseIdentity?: { tenantId?: string; userId?: string; role?: string; permissions?: string[] } };
  response: ServerResponse; startedAt: number; requestId?: string; url: URL; requestExecution?: { signal?: AbortSignal };
};

export async function dispatchTaijiCapabilityRoutes(context: RouteContext): Promise<void> {
  const { application, request, response, startedAt, url } = context;
  const runtime = application.taijiCapabilityService, governance = application.agentGovernance;
  let runLease: Awaited<ReturnType<AgentGovernanceService["authorizeAgentExecution"]>>["executionLease"] | null = null;
  let verdict: ToolProxyVerdict | null = null;
  let actionSignal: AbortSignal | undefined;
  let effectStarted = false, operation = "inspect", target: Data = {};
  const fail = (status: number, code: string, message: string, details?: Data) => writeJson(response, status,
    createErrorEnvelope(code, message, { startedAt, retryable: false, ...(details ? { details } : {}) }));
  try {
    if (!runtime || !governance) throw routeError("TAIJI_GOVERNANCE_REQUIRED", "Taiji capabilities require Agent Governance.", 503);
    let input: Data = {};
    if (request.method === "POST") input = await readJson(request, 100_000);
    else if (request.method !== "GET") { fail(405, "METHOD_NOT_ALLOWED", "Use GET for inspection or POST for an explicit operation."); return; }
    if (!input || typeof input !== "object" || Array.isArray(input)) throw routeError("TAIJI_INPUT_INVALID", "The request must be a JSON object.", 400);
    const agentId = request.method === "GET" ? url.searchParams.get("agentId") : input.agentId;
    const enterprise = request.enterpriseIdentity;
    if (typeof agentId !== "string" || !/^agt_[A-Za-z0-9_-]{1,128}$/.test(agentId) || !enterprise?.tenantId || !enterprise.userId) {
      throw routeError("TAIJI_IDENTITY_REQUIRED", "Supply an owned root Agent and an authenticated operator identity.", 403);
    }
    const owner = normalizeTaijiOwner({ agentId, tenantId: enterprise.tenantId, userId: enterprise.userId });
    const identity: GovernanceContext & { agentId: string } = { ...owner, role: enterprise.role, permissions: enterprise.permissions, requestId: context.requestId };
    const readRecord = request.method === "GET" ? await governance.service.getAgent(agentId, owner.tenantId) : null;
    const authorization = request.method === "GET" ? { record: readRecord, policy: null, executionLease: null }
      : await governance.service.authorizeAgentExecution(agentId, identity);
    runLease = authorization.executionLease;
    if (!authorization.record || authorization.record.createdBy !== owner.userId
      || authorization.record.parentAgentId !== null || authorization.record.generationDepth !== 0
      || request.method !== "GET" && (!runLease?.signal || !authorization.policy)) {
      throw routeError("TAIJI_ROOT_AGENT_REQUIRED", "Capability operations require an authorized root Agent.", 403);
    }
    const signals = [context.requestExecution?.signal, runLease?.signal].filter((item): item is AbortSignal => Boolean(item));
    const signal = signals.length ? AbortSignal.any(signals) : new AbortController().signal;
    const assertActive = async () => {
      if (signal.aborted || actionSignal?.aborted) throw routeError("TAIJI_CANCELLED", "Capability operation was cancelled.", 409);
      if (runLease) await runLease.assertActive("commit");
      else if ((await governance.service.getAgent(agentId, owner.tenantId))?.createdBy !== owner.userId) {
        throw routeError("TAIJI_INSPECTION_DENIED", "The recorded Agent owner changed.", 403);
      }
    };
    await assertActive();
    const body = { ...input }; delete body.agentId;
    operation = url.pathname === "/taiji/capabilities" ? "inspect" : url.pathname.slice("/taiji/capabilities/".length);
    target = { operation, capabilityId: body.capabilityId, runId: body.runId };
    let result: Data;
    if (request.method === "GET") {
      if (operation !== "inspect" && !/^runs\/[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(operation)) throw routeError("NOT_FOUND", "Capability route not found.", 404);
      // Operator receipt inspection is authorized by enterprise workflow:run
      // plus exact creator/tenant ownership. It never resumes an expired or
      // revoked Agent and does not borrow that Agent's old execution policy.
      await governance.service.emitAudit({ eventType: "TOOL_ALLOWED", agentId, tenantId: owner.tenantId, toolName: "taiji_inspect", decision: "allow",
        argumentsRedacted: true, reason: "Operator reads owned recorded capability evidence without resuming the Agent.", metadata: { operation, inspectionOnly: true } });
      const snapshot = await runtime.status(owner);
      if (operation === "inspect") {
        const limit = queryInteger(url, "limit", 10, 1, 100), offset = queryInteger(url, "offset", 0, 0, 1000);
        result = { ...snapshot, agentStatus: authorization.record.status, executionAuthorizationChecked: false,
          capabilityCount: snapshot.capabilities.length, runCount: snapshot.runs.length, limit, offset,
          capabilities: snapshot.capabilities.slice(offset, offset + limit).map(capability => ({ ...capability,
            history: capability.history.slice(-20), historyTotal: capability.history.length })),
          runs: snapshot.runs.slice().reverse().slice(offset, offset + limit).map(run => ({ ...run, result: run.result ? withoutContent(run.result) : null })) };
      } else {
        const id = operation.slice("runs/".length), run = snapshot.runs.find(run => run.id === id);
        if (!run) throw routeError("TAIJI_RUN_NOT_FOUND", "Run was not found for this owner.", 404);
        result = { status: run.status, run };
      }
    } else if (operation === "revoke") {
      // Stopping an owned capability does not need a new execution approval.
      // The normal enterprise permission and current root-Agent owner checks
      // above still apply, with a mandatory pre-effect audit.
      await governance.service.emitAudit({ eventType: "TOOL_ALLOWED", agentId, tenantId: owner.tenantId, toolName: "taiji_capability",
        decision: "allow", policyHash: authorization.policy!.policyHash, argumentsRedacted: true, reason: "Operator revokes an owned capability version.", metadata: { operation: "revoke", targetHash: taijiDigest(body) } });
      effectStarted = true;
      result = await runtime.revoke(body, owner, assertActive);
    } else {
      if (!["evaluate", "activate", "execute", "repair", "reweight", "prune"].includes(operation)) throw routeError("NOT_FOUND", "Capability operation not found.", 404);
      const prepared = await runtime.prepare(operation as TaijiOperation, body, owner);
      target = { ...target, capabilityId: prepared.params.capabilityId };
      if (prepared.replay) {
        verdict = await governance.toolProxy.enforce({ context: identity, toolName: "taiji_inspect", params: { operation: "replay", runId: prepared.replay.id, ownerHash: taijiDigest(owner) } });
        if (verdict.outcome !== "allow" || !verdict.executionLease || !verdict.policy) throw routeError("TAIJI_INSPECTION_DENIED", "Read permission is required to reconcile the existing run.", 403);
        result = { status: "replayed", run: prepared.replay, executionRepeated: false };
      } else {
        const { policyHash: _unused, ...review } = prepared.review;
        verdict = await governance.toolProxy.enforce({ context: identity, toolName: "taiji_capability", params: prepared.params,
          resourceContext: { resourceKeys: { capabilityId: prepared.params.capabilityId as string, operation }, resources: [`taiji:${prepared.params.capabilityId}`],
            approvalReview: review as Omit<AgentToolApprovalReview, "policyHash"> } });
        if (verdict.outcome === "approval_required" && verdict.approvalId) {
          writeJson(response, 202, createOkEnvelope({ status: "approval_required", operation, approvalId: verdict.approvalId,
            agentId, toolName: "taiji_capability", executionRepeated: false }, { startedAt })); return;
        }
        if (verdict.outcome !== "allow" || !verdict.executionLease || !verdict.policy || !verdict.approvalId
          || taijiDigest(verdict.approvedParams) !== taijiDigest(prepared.params)) throw routeError(verdict.code ?? "TAIJI_APPROVAL_REQUIRED", "A complete consumed one-shot capability approval is required.", 403);
        effectStarted = true;
        actionSignal = verdict.executionLease.signal;
        result = await runtime.execute(prepared, { policyHash: verdict.policy.policyHash, approvalId: verdict.approvalId,
          signal: actionSignal ? AbortSignal.any([signal, actionSignal]) : signal, assertActive });
      }
    }
    await assertActive();
    const output = withRecords(result);
    if (request.method === "GET") {
      if (containsSensitivePublicationText(JSON.stringify(output))) throw routeError("TAIJI_RESULT_WITHHELD", "Recorded output cannot be safely returned.", 503);
      await governance.service.emitAudit({ eventType: "TOOL_COMPLETED", agentId, tenantId: owner.tenantId, toolName: "taiji_inspect",
        resultStatus: "success", argumentsRedacted: true, metadata: { operation, inspectionOnly: true, recordCount: (output.records as unknown[]).length } });
      await assertActive();
      writeJson(response, 200, createOkEnvelope(output, { startedAt })); return;
    }
    const metered = await governance.toolProxy.enforceResult({ context: identity,
      toolName: result.status === "replayed" ? "taiji_inspect" : "taiji_capability",
      policy: verdict?.policy ?? authorization.policy!, result: output,
      descriptor: { kind: "record-array", selector: ["records"], itemKind: "object", onLimitExceeded: "replace" } });
    if (!metered || metered.verdict === "replace" || !Object.hasOwn(metered, "result")) throw routeError("TAIJI_RESULT_WITHHELD", "The recorded result could not be returned under the current policy.", 503);
    if ((output.run as Data | undefined)?.result && taijiDigest((metered.result as Data).records) !== taijiDigest(output.records)) {
      throw routeError("TAIJI_RESULT_WITHHELD", "Policy projection changed the decoded artifact; the original encoded artifact cannot be returned.", 503);
    }
    const originalArtifact = ((output.run as Data | undefined)?.result as Data | undefined)?.artifact;
    const returnedArtifact = (((metered.result as Data).run as Data | undefined)?.result as Data | undefined)?.artifact;
    if (originalArtifact && taijiDigest(originalArtifact) !== taijiDigest(returnedArtifact)) {
      throw routeError("TAIJI_RESULT_WITHHELD", "Policy projection changed the verified artifact; inspect the withheld outcome.", 503);
    }
    await assertActive();
    const status = ["failed", "cancelled", "unknown"].includes(result.status as string) ? 422 : 200;
    writeJson(response, status, createOkEnvelope(metered.result, { startedAt }));
  } catch (error) {
    const code = typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : "TAIJI_OPERATION_FAILED";
    fail(effectStarted ? 503 : (error as { statusCode?: number })?.statusCode ?? 400,
      effectStarted ? "TAIJI_OUTCOME_UNKNOWN" : code,
      effectStarted ? "Capability state may have changed; inspect its recorded state before any retry." : (error as Error).message,
      effectStarted ? { outcomeUnknown: true, retrySafe: false, causeCode: code, reconciliation: { ...target, statusPath: "/taiji/capabilities" } } : undefined);
  } finally {
    verdict?.executionLease?.release(); runLease?.release();
  }
}

function withoutContent(result: Data): Data {
  result = publicExecutionResult(result);
  const artifact = result.artifact as Data | null | undefined;
  if (!artifact) return { ...result };
  const { content: _content, ...metadata } = artifact;
  return { ...result, artifact: metadata };
}
function withRecords(result: Data): Data {
  if (result.run && typeof result.run === "object") {
    const run = result.run as Data;
    result = { ...result, run: { ...run, ...(run.result && typeof run.result === "object" ? { result: publicExecutionResult(run.result as Data) } : {}) } };
  }
  const run = result.run as { result?: { artifact?: { mediaType: string; content: string } | null } } | undefined;
  const artifact = run?.result?.artifact;
  if (artifact) {
    const decoded = artifact.mediaType === "application/x-ndjson" ? artifact.content.split("\n").map(line => JSON.parse(line)) : JSON.parse(artifact.content);
    const records = Array.isArray(decoded) ? decoded : Array.isArray(decoded?.attempts) ? decoded.attempts : [decoded];
    return { ...result, records };
  }
  return { ...result, records: Array.isArray(result.capabilities) ? [...result.capabilities, ...((result.runs as unknown[]) ?? [])]
    : result.capability ? [result.capability] : [] };
}
function publicExecutionResult(result: Data): Data {
  const { tokensUsed, measuredUsage, ...output } = result;
  const measured = measuredUsage as Data | undefined;
  // A unit-labelled usage quantity avoids presenting numeric counts under a
  // credential-shaped field. The existing output redactor remains in force.
  return { ...output, modelUsage: { unit: "tokens", total: typeof tokensUsed === "number" ? tokensUsed : null,
    requests: result.providerCallsMade === false ? 0 : null, source: measured?.source ?? "owned-local-adapter" } };
}
function routeError(code: string, message: string, statusCode: number) { return Object.assign(new Error(message), { code, statusCode }); }
function queryInteger(url: URL, key: string, fallback: number, min: number, max: number) {
  const value = url.searchParams.get(key); if (value === null) return fallback;
  if (!/^(0|[1-9][0-9]*)$/.test(value) || Number(value) < min || Number(value) > max) throw routeError("TAIJI_QUERY_INVALID", `Invalid ${key} boundary.`, 400);
  return Number(value);
}
