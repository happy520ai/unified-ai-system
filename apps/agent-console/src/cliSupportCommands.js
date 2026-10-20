// Extracted verbatim from cli-core.js so the workflow/credential and spend
// command clusters live beside the other command modules. Pure mechanical
// move; behaviour unchanged.
import { WORKFLOW_ERROR_CODES, WORKFLOW_ID_PATTERN, WORKFLOW_STATUSES } from "./cli-constants.js";
import { CliUsageError } from "./cli-errors.js";
import { isPlainRecord } from "./cli-local-client.js";
import { unwrapEnvelope } from "./cli-shared-helpers.js";
import { createGatewayClient } from "@unified-ai-system/shared-sdk";

export async function runWorkflowOrCredentialCommand(options, output) {
  const operation = options.positionals[0];
  const credential = options.command === "providers";
  const mutation = credential || operation === "run" || operation === "recover";
  const target = credential ? { providerId: options.agentProviderId } : { workflowId: options.workflowId };
  const client = createGatewayClient({ baseUrl: options.url, timeoutMs: options.timeoutMs, headers: { authorization: `Bearer ${options.adminKey}` } });
  try {
    let data;
    if (credential) {
      data = projectCredentialClear(unwrapEnvelope(await client.clearRuntimeProviderCredential(target)), target.providerId);
    } else if (operation === "run") {
      data = projectWorkflowCompletion(unwrapEnvelope(await client.workflowRun({
        workflowId: options.workflowId, goal: options.agentGoal, agentId: options.agentId,
        ...(options.workflowArtifactName === null ? {} : { artifactName: options.workflowArtifactName }),
      })), options.workflowId);
    } else if (operation === "list") {
      const result = unwrapEnvelope(await client.workflowRuns({ limit: options.lifecycleLimit ?? 50 }));
      if (!isPlainRecord(result) || !Array.isArray(result.runs) || result.runs.length > (options.lifecycleLimit ?? 50)) throw new Error("invalid workflow list");
      data = { runs: result.runs.map(row => projectWorkflowInspection(row)) };
    } else {
      const result = operation === "status" ? await client.workflowRunStatus(options.workflowId) : await client.recoverWorkflowRun(options.workflowId);
      data = projectWorkflowInspection(unwrapEnvelope(result), options.workflowId);
    }
    const ok = credential || !mutation || data.status === "completed";
    const nextAction = credential
      ? "Scope: this runtime credential store. Environment/configuration credentials may still apply; upstream keys, in-flight requests and other processes are unchanged."
      : workflowNextAction(operation, data, options.workflowId);
    const result = { ok, command: options.command, operation, ...target, retryAllowed: false, data, nextAction };
    if (options.json) output.write(`${JSON.stringify(result, null, 2)}\n`);
    else {
      const rows = credential
        ? [`Provider ${data.providerId}: ${data.removed ? "runtime credential removed" : "no runtime override was present"}`]
        : operation === "list" ? [`Workflows: ${data.runs.length}`, ...data.runs.map(row => `${row.workflowId}: ${row.status} / ${row.stage}`)]
          : [`Workflow ${data.workflowId}: ${data.status}`, ...(data.stage ? [`Stage: ${data.stage}`] : []), ...(data.artifact ? [`Artifact: ${data.artifact.fileName} (sha256 ${data.artifact.sha256})`] : [])];
      output.write(`${rows.join("\n")}\n${nextAction}\n`);
    }
    return ok ? 0 : 1;
  } catch (error) {
    const payload = isPlainRecord(error?.responseBody?.error) ? error.responseBody.error : {};
    const details = isPlainRecord(payload.details) ? payload.details : {};
    const code = payload.code;
    const notStarted = credential && code === "provider_runtime_credential_clear_audit_unavailable" && details.operationStarted === false;
    const uncertain = mutation && !notStarted && (code === "WORKFLOW_OUTCOME_UNKNOWN" || code === "WORKFLOW_ARTIFACT_OUTCOME_UNCERTAIN"
      || !Number.isInteger(error?.statusCode) || error.statusCode >= 500);
    let receipt;
    if (credential && code === "provider_runtime_credential_clear_result_audit_unconfirmed" && details.operationCommitted === true) {
      try { receipt = projectCredentialClear(details, target.providerId); } catch { /* An invalid receipt cannot prove completion. */ }
    }
    const failure = { ok: false, command: options.command, operation, ...target, retryAllowed: false,
      status: uncertain ? "unknown-reconcile-required" : "rejected",
      code: !credential && WORKFLOW_ERROR_CODES.has(code) ? code : credential ? notStarted ? "CREDENTIAL_CLEAR_NOT_STARTED" : uncertain ? "CREDENTIAL_CLEAR_OUTCOME_UNKNOWN" : "CREDENTIAL_CLEAR_REJECTED"
        : uncertain ? "WORKFLOW_OUTCOME_UNKNOWN" : "WORKFLOW_REQUEST_REJECTED",
      ...(receipt ? { receipt } : {}),
      ...(!credential && code === "TOOL_APPROVAL_REQUIRED" && /^appr_[A-Za-z0-9_-]{1,128}$/u.test(details.approvalId ?? "") ? { approvalId: details.approvalId } : {}),
      nextAction: !credential && operation === "run" && code === "APPROVAL_REVIEW_UNAVAILABLE"
        ? "The gateway has no safe approval review for this workflow policy. Keep the approval requirement; do not fabricate approval or retry automatically."
        : !credential && operation === "run" && code === "TOOL_APPROVAL_REQUIRED"
        ? "Use agents approvals --agent-id " + options.agentId + "; review the exact file_write request, then repeat the original workflow request and ID."
        : !credential && operation === "run" && (code === "AGENT_NOT_FOUND" || code === "AGENT_EXPIRED" || code === "AGENT_EXECUTION_FENCED")
          ? "Inspect agents show --agent-id " + options.agentId + " and obtain valid current authorization before repeating this workflow ID."
          : credential ? "Inspect /providers and the audit trail before another clear; do not clear a replacement credential automatically."
        : options.workflowId ? `Inspect workflow status --workflow-id ${options.workflowId}; preserve this ID and the original input.` : "Check gateway authentication and workflow history availability.",
    };
    output.writeError(options.json ? `${JSON.stringify(failure, null, 2)}\n`
      : `${failure.code}: ${failure.status}\n${credential ? `Provider: ${target.providerId}` : `Workflow: ${target.workflowId ?? "history"}`}\n${failure.nextAction}\n`);
    return 1;
  }
}

function projectWorkflowCompletion(value, expectedId) {
  if (!isPlainRecord(value) || value.workflowId !== expectedId || value.status !== "completed") throw new Error("invalid workflow result");
  const artifact = value.artifact;
  if (!isPlainRecord(artifact) || !/^[A-Za-z0-9._-]{1,100}\.md$/iu.test(artifact.fileName ?? "")
    || !/^[a-f0-9]{64}$/u.test(artifact.sha256 ?? "") || !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 0) throw new Error("invalid workflow artifact");
  return { workflowId: expectedId, status: "completed", artifact: { fileName: artifact.fileName, bytes: artifact.bytes, sha256: artifact.sha256 } };
}

function projectWorkflowInspection(value, expectedId = null) {
  if (!isPlainRecord(value) || !WORKFLOW_ID_PATTERN.test(value.workflowId ?? "") || expectedId !== null && value.workflowId !== expectedId
    || !WORKFLOW_STATUSES.has(value.status) || !new Set(["knowledge.retrieve", "report.compose", "artifact.write"]).has(value.stage)
    || !Number.isSafeInteger(value.attempt) || value.attempt < 1 || typeof value.canResume !== "boolean" || typeof value.outcomeUnknown !== "boolean"
    || !new Set([null, "run-safe-remaining-stages", "recheck-governance-only"]).has(value.resumeAction)
    || value.canResume !== (value.resumeAction !== null) || value.persistence?.automaticRedispatch !== false
    || value.persistence?.storageMode !== "single-host-sqlite"
    || value.status === "completed" && (value.canResume || value.outcomeUnknown)
    || value.status === "completed" && expectedId !== null && !value.result
    || value.outcomeUnknown && !new Set(["publishing", "unknown"]).has(value.status)
    || value.resumeAction === "recheck-governance-only" && !value.outcomeUnknown) throw new Error("invalid workflow inspection");
  return {
    workflowId: value.workflowId, status: value.status, stage: value.stage, attempt: value.attempt,
    canResume: value.canResume, resumeAction: value.resumeAction, outcomeUnknown: value.outcomeUnknown,
    errorCode: WORKFLOW_ERROR_CODES.has(value.error?.code) ? value.error.code : value.error ? "WORKFLOW_EXECUTION_FAILED" : null,
    ...(value.result && value.status === "completed" ? { artifact: projectWorkflowCompletion(value.result, value.workflowId).artifact } : {}),
  };
}

function projectCredentialClear(value, providerId) {
  if (!isPlainRecord(value) || value.providerId !== providerId || typeof value.removed !== "boolean"
    || value.scope !== "runtime-credential-store" || value.appliesTo !== "subsequent-credential-lookups"
    || ["inFlightRequestsCancelled", "providerKeyRevoked", "otherCredentialSourcesModified", "otherProcessesInvalidated"].some(key => value[key] !== false)) throw new Error("invalid clear receipt");
  return { providerId, removed: value.removed, scope: value.scope, appliesTo: value.appliesTo,
    inFlightRequestsCancelled: false, providerKeyRevoked: false, otherCredentialSourcesModified: false, otherProcessesInvalidated: false };
}

function workflowNextAction(operation, data, workflowId) {
  if (operation === "list") return "Use workflow status with the recorded ID. No workflow was resumed.";
  if (data.status === "completed") return "Recorded completion; repeat this ID only with the original input. Later user edits are preserved.";
  if (data.resumeAction === "recheck-governance-only") return "Artifact reconciled. Explicitly rerun the original request with current Agent authorization to finish result governance only.";
  if (data.resumeAction === "run-safe-remaining-stages") return "Review the failure, then explicitly rerun the original request and ID to continue safe stages.";
  return data.outcomeUnknown ? `Run workflow recover --workflow-id ${workflowId}; no automatic retry or new ID.`
    : `Use workflow status --workflow-id ${workflowId}; the current execution claim may still be active.`;
}

export async function runSpend(options, output) {
  if (!options.adminKey) {
    throw new CliUsageError(
      "The spend report needs an admin key: pass --admin-key <uai-…> or set AGENT_CONSOLE_ADMIN_KEY / PME_AUTH_TOKEN.",
      { hint: "Create one with POST /enterprise/virtual-keys and role admin." },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Spend report request timed out after ${options.timeoutMs}ms`));
  }, options.timeoutMs);

  let response;
  try {
    response = await fetch(`${options.url.replace(/\/+$/, "")}/enterprise/spend-report`, {
      headers: { authorization: `Bearer ${options.adminKey}` },
      signal: controller.signal,
    });
  } catch (error) {
    throw new Error(
      `Could not reach the gateway spend report at ${options.url}: ${error?.message ?? error}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Spend report failed with HTTP ${response.status}: ${body.slice(0, 300)}`,
    );
  }

  const envelope = await response.json();
  const data = envelope?.data ?? {};
  const result = {
    ok: true,
    gatewayUrl: options.url,
    window: data.window ?? "current-budget-window",
    totals: data.totals ?? {},
    rows: Array.isArray(data.rows) ? data.rows : [],
  };

  if (options.json) {
    output.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    renderSpend(result, output);
  }
  return 0;
}

function renderSpend(result, output) {
  const totals = result.totals ?? {};
  output.write(`Spend report — ${result.window}\n`);
  output.write(
    `keys: ${totals.keys ?? result.rows.length} (active ${totals.activeKeys ?? "?"})  ` +
    `tokens: ${totals.tokensUsed ?? 0}  requests: ${totals.requestCount ?? 0}  ` +
    `over soft budget: ${totals.keysOverSoftBudget ?? 0}\n\n`,
  );

  if (!result.rows.length) {
    output.write("No virtual keys yet. Create one with POST /enterprise/virtual-keys.\n");
    return;
  }

  const header = "  keyId       role        tokens      budget            status";
  output.write(`${header}\n`);
  for (const row of result.rows) {
    const budget = row.budget?.enabled
      ? `${row.tokensUsed ?? 0}/${row.budget.limitTokens ?? "?"}` +
        (row.budget.windowResetAt ? ` (resets ${row.budget.windowResetAt.slice(0, 10)})` : "")
      : "unlimited";
    const status = row.revoked
      ? "revoked"
      : row.budget?.softBudgetExceeded
        ? "over soft budget"
        : "ok";
    output.write(
      `  ${String(row.keyId ?? "?").padEnd(12)}${String(row.role ?? "?").padEnd(12)}` +
      `${String(row.tokensUsed ?? 0).padEnd(12)}${budget.padEnd(18)}${status}\n`,
    );
  }
}
