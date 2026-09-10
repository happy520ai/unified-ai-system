import { createGatewayClient } from "@unified-ai-system/shared-sdk";
import { readOperatorPayload, sanitizeOperatorData, type OperatorOptions, type Output } from "./operatorCommands.ts";

type Data = Record<string, any>;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u;
const PARENT = new Set(["pending", "running", "paused", "completed", "failed", "cancelled", "force_stopped"]);
const WORKFLOW = new Set(["running", "prepared", "publishing", "completed", "failed", "cancelled", "interrupted", "unknown", "not_observed"]);
function record(value: any): value is Data { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function id(value: unknown): value is string { return typeof value === "string" && ID.test(value); }
function invalid(message: string, response = false): never {
  throw Object.assign(new Error(message), { code: response ? "WORKFORCE_RESPONSE_INVALID" : "WORKFORCE_INPUT_INVALID" });
}
export function validateWorkforceOptions(options: OperatorOptions): void {
  const recover = options.positionals[0] === "handoff-recover";
  if (!recover && options.positionals[0] !== "status" || options.positionals.length !== (recover ? 1 : 2)
    || recover !== Boolean(options.operatorInput) || !recover && !id(options.positionals[1])) invalid("Use workforce status <execution-id> or handoff-recover --input recovery.json.");
  if (options.prompt !== null || options.agentGoal !== null || options.agentId !== null || options.allowRealProvider
    || options.agentProviderId !== null || options.agentModelId !== null || options.operatorMode !== null || options.operatorSources.length
    || options.operatorPasses !== null || options.operatorMaxOutputTokens !== null || options.lifecycleLimit !== null || options.lifecycleOffset !== null
    || options.confirmed && !recover) invalid("Workforce inspection and recovery accept only their original record IDs, --input and recovery --yes.");
  try { const url = new URL(options.url); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) invalid("Invalid gateway URL."); }
  catch { invalid("Invalid gateway URL."); }
}
function recoveryInput(path: string): { executionId: string; taskId: string; workflowId: string } {
  const value = readOperatorPayload(path);
  if (Object.keys(value).sort().join() !== "executionId,taskId,workflowId" || ![value.executionId, value.taskId, value.workflowId].every(id)) invalid("Recovery JSON must contain only executionId, taskId and workflowId.");
  return { executionId: value.executionId, taskId: value.taskId, workflowId: value.workflowId };
}
function projectWorkflow(value: unknown, executionId: string, expected?: { taskId: string; workflowId: string }): Data {
  if (!record(value) || !id(value.workflowId) || !WORKFLOW.has(value.status) || typeof value.originVerified !== "boolean"
    || typeof value.canResume !== "boolean" || !id(value.originalPlanId) || !id(value.roleId)
    || value.originVerified && (!id(value.taskId) || value.parentExecutionId !== executionId)
    || !value.originVerified && (value.status !== "not_observed" || value.taskId !== null)
    || expected && (value.workflowId !== expected.workflowId || value.taskId !== expected.taskId || value.parentExecutionId !== executionId)) invalid("Workflow response does not match its original parent task.", true);
  const resumeAction = value.resumeAction ?? null;
  if (resumeAction !== null && resumeAction !== "run-safe-remaining-stages" && resumeAction !== "recheck-governance-only") invalid("Workflow returned an unsupported recovery action.", true);
  let error: { code: string; approvalId?: string } | null = null;
  if (value.error != null) {
    if (!record(value.error) || typeof value.error.code !== "string" || !/^[A-Z][A-Z0-9_]{0,127}$/u.test(value.error.code)
      || value.error.approvalId !== undefined && (typeof value.error.approvalId !== "string" || !/^appr_[A-Za-z0-9_-]{1,128}$/u.test(value.error.approvalId))) invalid("Workflow returned an invalid approval error reference.", true);
    error = { code: value.error.code, ...(value.error.approvalId === undefined ? {} : { approvalId: value.error.approvalId }) };
  }
  let artifact: Data | null = null;
  if (value.status === "completed" && value.artifactVerified === true && value.originVerified) {
    const result = value.result, candidate = result?.artifact;
    if (!record(result) || result.status !== "completed" || result.workflowId !== value.workflowId || !record(candidate)
      || typeof candidate.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(candidate.sha256)
      || !Number.isSafeInteger(candidate.bytes) || candidate.bytes < 1 || !id(candidate.fileName)
      || typeof candidate.absolutePath !== "string" || !candidate.absolutePath || candidate.absolutePath.length > 4096
      || typeof candidate.relativePath !== "string" || candidate.relativePath.length > 4096) invalid("Completed workflow has no verified artifact receipt.", true);
    artifact = { fileName: candidate.fileName, absolutePath: candidate.absolutePath, relativePath: candidate.relativePath, sha256: candidate.sha256, bytes: candidate.bytes };
  }
  return sanitizeOperatorData({ workflowId: value.workflowId, taskId: value.taskId, parentExecutionId: value.parentExecutionId ?? executionId,
    roleId: value.roleId, originalPlanId: value.originalPlanId, status: value.status === "completed" && !artifact ? "unknown" : value.status,
    originVerified: value.originVerified, artifactVerified: artifact !== null, artifactError: value.artifactError ?? null,
    canResume: value.canResume, resumeAction, error,
    outcomeUnknown: value.outcomeUnknown === true || value.status === "completed" && !artifact, artifact });
}
function render(result: Data): string {
  const lines = [`Workforce ${result.operation}: ${result.status}`, `Execution ID: ${result.executionId}`];
  if (result.taskId) lines.push(`Task ID: ${result.taskId}`);
  if (result.workflowId) lines.push(`Workflow ID: ${result.workflowId}`);
  if (result.data) lines.push(JSON.stringify(result.data, null, 2));
  if (result.message) lines.push(result.message);
  lines.push(result.nextAction, "Automatic retry: disabled.");
  return lines.join("\n") + "\n";
}
export async function runWorkforceCommands(options: OperatorOptions, output: Output): Promise<number> {
  const operation = options.positionals[0], recover = operation === "handoff-recover";
  let ids: Data = recover ? {} : { executionId: options.positionals[1] }, dispatched = false;
  try {
    if (recover) ids = recoveryInput(options.operatorInput!);
    if (recover && !options.confirmed) {
      const result = { ok: true, operation, status: "preview", ...ids, retryAllowed: false,
        nextAction: "Review these exact IDs, then add --yes. Recovery may publish the approved report; it cannot rerun employees or resume the parent." };
      output.write(options.json ? JSON.stringify(result, null, 2) + "\n" : render(result)); return 0;
    }
    if (!options.adminKey) invalid("Workforce status and recovery require a scoped admin key.");
    const client = createGatewayClient({ baseUrl: options.url, timeoutMs: options.timeoutMs, headers: { authorization: `Bearer ${options.adminKey}` } });
    dispatched = true;
    const envelope = recover ? await client.recoverWorkforceWorkflow(ids as any) : await client.workforceExecutionStatus(ids.executionId);
    if (!record(envelope) || envelope.status !== "ok" || !record(envelope.data)) invalid("Gateway did not return a verified response envelope.", true);
    const raw = envelope.data as Data;
    let data: Data;
    if (recover) {
      data = projectWorkflow(raw, ids.executionId, ids as any);
      if (data.status !== "completed" || !data.artifactVerified || raw.parentExecutionResumed !== false || raw.employeeRolesRerun !== false
        || !PARENT.has(raw.parentExecutionStatus) || ["pending", "running", "paused"].includes(raw.parentExecutionStatus)) invalid("Recovery did not prove a completed workflow without parent or employee execution.", true);
      data = { ...data, parentExecutionStatus: raw.parentExecutionStatus, parentExecutionResumed: false, employeeRolesRerun: false };
    } else {
      if (raw.planId !== ids.executionId || !PARENT.has(raw.status)) invalid("Status response does not match the requested execution.", true);
      // The existing lifecycle calls its execution identity planId; verify it before projecting a clearer label.
      data = { executionId: raw.planId, parentExecutionStatus: raw.status,
        workflowHandoff: raw.workflowHandoff == null ? null : projectWorkflow(raw.workflowHandoff, ids.executionId) };
    }
    const approvalId = data.workflowHandoff?.error?.approvalId;
    const result = { ok: true, operation, status: recover ? "completed" : "observed", ...ids, retryAllowed: false, data,
      nextAction: recover ? "The original parent state is retained. Inspect workforce status before any further action."
        : approvalId ? `Inspect agents approvals and review ${approvalId}. If correct, use agents approve --approval-id ${approvalId} --yes, then request handoff-recover with the original executionId, taskId and workflowId.`
          : "Inspect the recorded workflow and its original IDs before requesting recovery." };
    output.write(options.json ? JSON.stringify(result, null, 2) + "\n" : render(result)); return 0;
  } catch (error: any) {
    const remote = record(error.responseBody?.error) ? error.responseBody.error : {};
    const unknown = dispatched && recover && (remote.details?.outcomeUnknown === true || error.outcomeUnknown === true || !Number.isInteger(error.statusCode) || error.statusCode >= 500);
    const code = String(remote.code ?? error.code ?? "WORKFORCE_REQUEST_FAILED");
    const failure = { ok: false, operation, status: unknown ? "unknown" : "failed", ...ids, retryAllowed: false,
      code: /^[A-Za-z][A-Za-z0-9_:-]{0,127}$/u.test(code) ? code : "WORKFORCE_REQUEST_FAILED",
      message: !dispatched ? error.message : "Gateway did not return a verified result.",
      nextAction: ids.executionId ? `Inspect workforce status ${ids.executionId}; preserve all original IDs and do not automatically retry recovery.` : "Check the guarded recovery JSON input before continuing." };
    output.writeError(options.json ? JSON.stringify(sanitizeOperatorData(failure), null, 2) + "\n" : render(sanitizeOperatorData(failure)));
    return dispatched ? 1 : 2;
  }
}
