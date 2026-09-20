import { CliUsageError } from "./cli-errors.js";
import { validateAgentTaskOptions } from "./agentTaskCommands.ts";
import {
  WORKFLOW_OPERATIONS,
  WORKFLOW_ID_PATTERN,
  AGENT_GOVERNANCE_SUBCOMMANDS,
  AGENT_GOVERNANCE_MUTATIONS,
  AGENT_ID_PATTERN,
  AGENT_APPROVAL_ID_PATTERN,
  AGENT_TOOL_NAME_PATTERN,
  LOCAL_CLIENT_ONBOARDING_SUBCOMMANDS,
  LOCAL_CLIENT_ONBOARDING_MUTATIONS,
  LOCAL_CLIENT_ONBOARDING_ACTIONS,
  LOCAL_CLIENT_ONBOARDING_PROFILE_IDS,
  LOCAL_CLIENT_ONBOARDING_PLAN_ID_PATTERN,
  IDEMPOTENCY_KEY_PATTERN,
  CONTROL_CENTER_IDEMPOTENCY_PREFIX_PATTERN,
} from "./cli-constants.js";

export function validateWorkflowOrCredentialOptions(options) {
  if (!options.adminKey) throw new CliUsageError("A scoped gateway key is required; use AGENT_CONSOLE_ADMIN_KEY or --admin-key.");
  if (options.prompt !== null || options.positionals.length !== 1) throw new CliUsageError("Provide exactly one workflow/provider operation.");
  if (options.command === "providers") {
    if (options.positionals[0] !== "clear-credential" || !/^[a-z][a-z0-9._-]{0,127}$/u.test(options.agentProviderId ?? "")) {
      throw new CliUsageError("providers clear-credential requires one canonical --provider-id.");
    }
    return;
  }
  const operation = options.positionals[0];
  if (!WORKFLOW_OPERATIONS.has(operation)) throw new CliUsageError("workflow supports run, list, status, and recover.");
  if (operation === "list") {
    if (options.workflowId !== null) throw new CliUsageError("workflow list does not accept --workflow-id.");
  } else if (!WORKFLOW_ID_PATTERN.test(options.workflowId ?? "")) {
    throw new CliUsageError("A stable --workflow-id (1–160 portable characters) is required; retries must retain it.");
  }
  if (operation !== "list" && options.lifecycleLimit !== null) throw new CliUsageError("--limit is only valid with workflow list.");
  if (operation === "run") {
    if (!AGENT_ID_PATTERN.test(options.agentId ?? "") || typeof options.agentGoal !== "string" || !options.agentGoal.trim()) {
      throw new CliUsageError("workflow run requires --goal and a server-issued --agent-id with file_write authorization.");
    }
    if (options.workflowArtifactName !== null && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(options.workflowArtifactName)) {
      throw new CliUsageError("--artifact-name must be a bounded filename, not a path.");
    }
  } else if (options.agentId !== null || options.agentGoal !== null || options.workflowArtifactName !== null) {
    throw new CliUsageError("--goal, --agent-id and --artifact-name are only valid with workflow run.");
  }
}
export function validateAgentGovernanceOptions(options) {
  if (options.positionals[0] === "task") {
    try { validateAgentTaskOptions(options); } catch (error) { throw new CliUsageError(error.message); }
    return;
  }
  if (options.prompt !== null || options.positionals.length !== 1) {
    throw new CliUsageError(
      "agents requires exactly one operation: status, list, show, generate, run, revoke, approvals, approve, or reject.",
    );
  }
  const operation = options.positionals[0];
  if (!AGENT_GOVERNANCE_SUBCOMMANDS.has(operation)) {
    throw new CliUsageError(`Unsupported agents operation: ${operation}`);
  }
  if (!options.adminKey) {
    throw new CliUsageError(
      `${operation} requires a scoped Agent Governance key.`,
      { hint: "Set AGENT_CONSOLE_ADMIN_KEY or pass --admin-key." },
    );
  }

  const mutation = AGENT_GOVERNANCE_MUTATIONS.has(operation);
  if (mutation && !options.confirmed) {
    throw new CliUsageError(`${operation} requires explicit --yes confirmation.`);
  }
  if (!mutation && options.confirmed) {
    throw new CliUsageError("--yes is only valid with generate, run, revoke, approve, or reject.");
  }

  const needsAgentId = new Set(["show", "run", "revoke"]).has(operation);
  const allowsAgentId = needsAgentId || operation === "approvals";
  if (needsAgentId && !AGENT_ID_PATTERN.test(options.agentId ?? "")) {
    throw new CliUsageError(`${operation} requires a valid server-issued --agent-id.`);
  }
  if (allowsAgentId && options.agentId !== null && !AGENT_ID_PATTERN.test(options.agentId)) {
    throw new CliUsageError("--agent-id must be a valid server-issued Agent identifier.");
  }
  if (!allowsAgentId && options.agentId !== null) {
    throw new CliUsageError("--agent-id is only valid with show, run, revoke, or approvals.");
  }

  const needsApprovalId = operation === "approve" || operation === "reject";
  if (needsApprovalId && !AGENT_APPROVAL_ID_PATTERN.test(options.agentApprovalId ?? "")) {
    throw new CliUsageError(`${operation} requires a valid server-issued --approval-id.`);
  }
  if (!needsApprovalId && options.agentApprovalId !== null) {
    throw new CliUsageError("--approval-id is only valid with approve or reject.");
  }

  if (operation === "generate") {
    options.agentName = normalizeAgentText(options.agentName, "--name", 128);
    options.agentTask = normalizeAgentText(options.agentTask, "--task", 4_000);
    if (options.agentParentId !== null && !AGENT_ID_PATTERN.test(options.agentParentId)) {
      throw new CliUsageError("--parent-agent-id must be a valid server-issued Agent identifier.");
    }
  } else if (options.agentName !== null || options.agentTask !== null
    || options.agentTtlSeconds !== null || options.agentParentId !== null) {
    throw new CliUsageError("--name, --task, --ttl-seconds, and --parent-agent-id are only valid with generate.");
  }

  if (operation === "run") {
    options.agentGoal = normalizeAgentText(options.agentGoal, "--goal", 4_000);
    if (options.agentToolMode !== null && !new Set(["none", "readonly"]).has(options.agentToolMode)) {
      throw new CliUsageError("--tool-mode must be none or readonly.");
    }
    if (options.agentToolMode === "none" && options.agentTools.length > 0) {
      throw new CliUsageError("--tool cannot be combined with --tool-mode none.");
    }
    for (const [flag, value] of [["--provider-id", options.agentProviderId], ["--model-id", options.agentModelId]]) {
      if (value !== null && (value.length > 256 || !/^[A-Za-z0-9._:/-]+$/u.test(value))) {
        throw new CliUsageError(`${flag} must be a bounded provider/model identifier.`);
      }
    }
    if (options.agentProviderId !== null
      && options.agentProviderId !== "local-fake-provider"
      && !options.allowRealProvider) {
      throw new CliUsageError(
        "An explicitly selected non-fake Agent provider requires --allow-real-provider.",
      );
    }
  } else if (options.agentGoal !== null || options.agentMaxIterations !== null
    || options.agentRunTimeoutMs !== null
    || options.agentToolMode !== null || options.agentProviderId !== null
    || options.agentModelId !== null || options.allowRealProvider) {
    throw new CliUsageError(
      "--goal, --max-iterations, --run-timeout-ms, --tool-mode, --provider-id, and --model-id are only valid with agents run.",
    );
  }

  if (!new Set(["generate", "run"]).has(operation) && options.agentTools.length > 0) {
    throw new CliUsageError("--tool is only valid with generate or run.");
  }
  const tools = options.agentTools.map((value) => String(value).trim());
  if (tools.some((value) => !AGENT_TOOL_NAME_PATTERN.test(value))) {
    throw new CliUsageError("--tool values must be bounded registered-tool identifiers.");
  }
  options.agentTools = [...new Set(tools)];

  if (operation === "revoke") {
    if (options.agentReason !== null) {
      options.agentReason = normalizeAgentText(options.agentReason, "--reason", 500);
    }
  } else if (options.agentReason !== null || options.agentCascade) {
    throw new CliUsageError("--reason and --cascade are only valid with revoke.");
  }
}
export function normalizeAgentText(value, flag, maxLength) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new CliUsageError(`${flag} must be non-empty, bounded, and free of control characters.`);
  }
  return normalized;
}
export function validateControlCenterOptions(options) {
  if (options.prompt !== null || options.positionals.length > 1) {
    throw new CliUsageError("control-center accepts only the optional configure operation.");
  }
  const operation = options.positionals[0] ?? "status";
  if (!new Set(["status", "configure"]).has(operation)) {
    throw new CliUsageError("control-center operation must be status or configure.");
  }
  if (!options.adminKey) {
    throw new CliUsageError(
      "The local AI control center requires an admin key.",
      { hint: "Set AGENT_CONSOLE_ADMIN_KEY or pass --admin-key." },
    );
  }
  if (operation === "status") {
    if (
      options.controlCenterManifestFile !== null
      || options.lifecycleApply
      || options.confirmed
      || options.idempotencyKey !== null
    ) {
      throw new CliUsageError(
        "--manifest, --apply, --yes, and --idempotency-key require control-center configure.",
      );
    }
    return;
  }
  if (options.controlCenterManifestFile === null) {
    throw new CliUsageError("control-center configure requires --manifest <json>.");
  }
  if (options.lifecycleApply) {
    if (!options.confirmed) {
      throw new CliUsageError("control-center configure --apply requires explicit --yes confirmation.");
    }
    if (!CONTROL_CENTER_IDEMPOTENCY_PREFIX_PATTERN.test(options.idempotencyKey ?? "")) {
      throw new CliUsageError(
        "control-center configure --apply requires an explicit 1-180 character visible ASCII --idempotency-key prefix.",
      );
    }
  } else if (options.confirmed || options.idempotencyKey !== null) {
    throw new CliUsageError("--yes and --idempotency-key require control-center configure --apply.");
  }
}
export function validateLocalClientOnboardingOptions(options) {
  if (options.prompt !== null || options.positionals.length !== 1) {
    throw new CliUsageError(
      "clients-onboarding requires exactly one operation: profiles, inspect, verify, plan, approve, apply, rollback, or recover.",
    );
  }
  const operation = options.positionals[0];
  if (!LOCAL_CLIENT_ONBOARDING_SUBCOMMANDS.has(operation)) {
    throw new CliUsageError(`Unsupported clients-onboarding operation: ${operation}`);
  }
  const needsProfile = new Set(["inspect", "verify", "plan"]).has(operation);
  if (needsProfile) {
    if (!LOCAL_CLIENT_ONBOARDING_PROFILE_IDS.has(options.onboardingProfileId)) {
      throw new CliUsageError(
        "--profile-id must be claude-compatible-mcp-json, cursor-mcp-json, vscode-mcp-json, vscode-mcp-jsonc-v1, codex-mcp-toml-v1, or continue-mcp-yaml-v1.",
      );
    }
  } else if (options.onboardingProfileId !== null) {
    throw new CliUsageError("--profile-id is only valid with inspect, verify, or plan.");
  }

  if (operation === "plan") {
    if (!LOCAL_CLIENT_ONBOARDING_ACTIONS.has(options.onboardingAction)) {
      throw new CliUsageError(
        "plan requires --action enable, disable, rollback, or recover.",
      );
    }
    if (options.onboardingAction === "rollback") {
      if (options.onboardingReceiptFile === null) {
        throw new CliUsageError("A rollback plan requires --receipt-file <redacted-json>.");
      }
    } else if (options.onboardingReceiptFile !== null) {
      throw new CliUsageError("--receipt-file is only valid for a rollback plan.");
    }
  } else {
    if (options.onboardingAction !== null) {
      throw new CliUsageError("--action is only valid with plan.");
    }
    if (options.onboardingReceiptFile !== null) {
      throw new CliUsageError("--receipt-file is only valid for a rollback plan.");
    }
  }

  const mutation = LOCAL_CLIENT_ONBOARDING_MUTATIONS.has(operation);
  if (mutation) {
    if (!options.adminKey) {
      throw new CliUsageError(
        `${operation} requires an admin key.`,
        { hint: "Pass --admin-key or set AGENT_CONSOLE_ADMIN_KEY." },
      );
    }
    if (!options.confirmed) {
      throw new CliUsageError(`${operation} requires explicit --yes confirmation.`);
    }
    if (!IDEMPOTENCY_KEY_PATTERN.test(options.idempotencyKey ?? "")) {
      throw new CliUsageError(
        `${operation} requires a valid explicit --idempotency-key (1-255 visible ASCII characters).`,
      );
    }
    if (!LOCAL_CLIENT_ONBOARDING_PLAN_ID_PATTERN.test(options.onboardingPlanId ?? "")) {
      throw new CliUsageError(
        `${operation} requires a valid server-issued --plan-id.`,
      );
    }
  } else {
    if (options.confirmed || options.idempotencyKey !== null) {
      throw new CliUsageError("--yes and --idempotency-key are only valid with onboarding mutations.");
    }
    if (options.onboardingPlanId !== null) {
      throw new CliUsageError("--plan-id is only valid with onboarding mutations.");
    }
  }
}
