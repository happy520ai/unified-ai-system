// Extracted verbatim from cli-core.js so the agent governance command family
// (agents task dispatch, review projection, and safe terminal rendering)
// lives beside the other command modules. Pure mechanical move; behaviour
// unchanged.
import { createHash } from "node:crypto";
import { AGENT_GOVERNANCE_MUTATIONS, AGENT_REVIEW_SENSITIVE_KEY } from "./cli-constants.js";
import { CliUsageError } from "./cli-errors.js";
import {
  isPlainRecord,
  hasExactKeys,
  validIsoDate,
} from "./cli-local-client.js";
import { unwrapEnvelope } from "./cli-shared-helpers.js";
import { createGatewayClient } from "@unified-ai-system/shared-sdk";
import { runAgentTaskCommand, projectGovernedAgentTaskApproval } from "./agentTaskCommands.ts";
import { projectWorkforceCodeDeliveryReview, formatWorkforceCodeDeliveryReview } from "./workforceCodeDeliveryReview.ts";
import { projectWorkforceWorkflowHandoffReview, formatWorkforceWorkflowHandoffReview, assertWorkforceWorkflowOptionsHash } from "./workforceWorkflowHandoffReview.ts";
import { projectWorkforceConsensusApproval, formatWorkforceConsensusReview, assertConsensusOptionsHash } from "./workforceConsensusReview.ts";
import { projectWorkforceExternalRunnerApproval, formatWorkforceExternalRunnerReview } from "./workforceExternalRunnerReview.ts";
import { projectForgeApprovalReview, projectTaijiApprovalReview } from "./operatorCommands.ts";

export class CliAgentGovernanceFailure extends Error {
  constructor(code, options = {}) {
    super(code);
    this.name = "CliAgentGovernanceFailure";
    this.code = code;
    this.operation = options.operation ?? null;
    this.status = options.status ?? "rejected";
    this.mutation = options.mutation === true;
    this.retryAllowed = false;
    this.exitCode = 1;
  }
}

export async function runAgents(options, output) {
  if (options.positionals[0] === "task") return runAgentTaskCommand(options, output);
  const operation = options.positionals[0];
  const mutation = AGENT_GOVERNANCE_MUTATIONS.has(operation);
  const runTimeoutMs = options.agentRunTimeoutMs ?? 60_000;
  const client = createGatewayClient({
    baseUrl: options.url,
    timeoutMs: operation === "run"
      ? Math.max(options.timeoutMs, runTimeoutMs + 5_000)
      : options.timeoutMs,
    headers: { authorization: `Bearer ${options.adminKey}` },
  });

  try {
    let data;
    if (operation === "status") {
      data = unwrapEnvelope(await client.agentGovernanceStats()).stats;
    } else if (operation === "list") {
      data = unwrapEnvelope(await client.governedAgents()).agents;
    } else if (operation === "show") {
      const [agentEnvelope, policyEnvelope] = await Promise.all([
        client.governedAgent(options.agentId),
        client.governedAgentPolicy(options.agentId),
      ]);
      data = {
        agent: unwrapEnvelope(agentEnvelope).agent,
        effectivePolicy: unwrapEnvelope(policyEnvelope).effectivePolicy,
      };
    } else if (operation === "generate") {
      data = unwrapEnvelope(await client.generateGovernedAgent({
        name: options.agentName,
        task: options.agentTask,
        requestedTools: options.agentTools,
        ttlSeconds: options.agentTtlSeconds ?? 3600,
        parentAgentId: options.agentParentId,
      }));
    } else if (operation === "run") {
      data = unwrapEnvelope(await client.runGovernedAgent(options.agentId, {
        goal: options.agentGoal,
        timeoutMs: runTimeoutMs,
        ...(options.agentMaxIterations === null ? {} : { maxIterations: options.agentMaxIterations }),
        toolMode: options.agentToolMode ?? (options.agentTools.length > 0 ? "readonly" : "none"),
        ...(options.agentTools.length > 0 ? { toolAllowlist: options.agentTools } : {}),
        ...(options.agentProviderId === null ? {} : { providerId: options.agentProviderId }),
        ...(options.agentModelId === null ? {} : { modelId: options.agentModelId }),
      }));
    } else if (operation === "revoke") {
      data = unwrapEnvelope(await client.revokeGovernedAgent(options.agentId, {
        reason: options.agentReason ?? "operator_requested",
        cascade: options.agentCascade,
      }));
    } else if (operation === "approvals") {
      const approvals = unwrapEnvelope(
        await client.governedApprovals(options.agentId ?? undefined),
      ).approvals;
      data = Array.isArray(approvals) ? approvals.map(projectAgentApproval) : [];
    } else {
      data = projectAgentApproval(
        unwrapEnvelope(await client.decideGovernedApproval(
          options.agentApprovalId,
          operation,
        )).approval,
      );
    }

    const operationSucceeded = operation !== "run" || data?.status === "completed";
    const result = {
      ok: operationSucceeded,
      command: "agents",
      operation,
      mode: mutation ? "governed-mutation" : "read-only",
      ...(mutation ? { retryAllowed: false } : { writesPerformed: false }),
      data,
    };
    if (options.json) output.write(`${JSON.stringify(result, null, 2)}\n`);
    else renderAgentGovernanceCommand(result, output);
    return operationSucceeded ? 0 : 1;
  } catch (error) {
    if (error instanceof CliUsageError) throw error;
    throw createSafeAgentGovernanceFailure(error, { operation, mutation });
  }
}

function renderAgentGovernanceCommand(result, output) {
  const lines = [
    "",
    output.bold("Agent Governance"),
    `Operation: ${result.operation}`,
    `Mode: ${result.mode}`,
  ];
  const data = result.data;
  if (result.operation === "status") {
    lines.push(
      `Agents: ${safeCount(data?.agents)}`,
      `Policies: ${safeCount(data?.policies)}`,
      `By status: ${formatSafeRecord(data?.byStatus)}`,
    );
  } else if (result.operation === "list") {
    const agents = Array.isArray(data) ? data : [];
    lines.push(`Agents: ${agents.length}`);
    for (const agent of agents) {
      lines.push(
        `  ${safeTerminalText(agent?.agentId, 160)}  ${safeTerminalText(agent?.status, 32)}  `
        + `${safeTerminalText(agent?.name, 128)}  ${safeTerminalText(agent?.classification?.family, 64)}`,
      );
    }
  } else if (result.operation === "show") {
    const agent = data?.agent ?? {};
    const policy = data?.effectivePolicy ?? {};
    lines.push(
      `Agent: ${safeTerminalText(agent.agentId, 160)}`,
      `Name: ${safeTerminalText(agent.name, 128)}`,
      `Status: ${safeTerminalText(agent.status, 32)}`,
      `Owner: ${safeTerminalText(agent.ownerUserId, 160)}`,
      `Family: ${safeTerminalText(agent.classification?.family, 64)}`,
      `Risk: ${safeTerminalText(agent.riskLevel, 32)}`,
      `Granted tools: ${formatSafeList(policy.grantedTools ?? agent.grantedTools)}`,
      `Expires: ${safeTerminalText(agent.expiresAt ?? policy.expiresAt, 64)}`,
      `Policy hash: ${safeTerminalText(agent.policyHash ?? policy.policyHash, 160)}`,
    );
  } else if (result.operation === "generate") {
    lines.push(
      `Agent: ${safeTerminalText(data?.agentId, 160)}`,
      `Status: ${safeTerminalText(data?.status, 32)}`,
      `Granted tools: ${formatSafeList(data?.grantedTools)}`,
      `Expires: ${safeTerminalText(data?.expiresAt, 64)}`,
      output.yellow("Automatic retry: forbidden; inspect the Agent list before another generate request."),
    );
  } else if (result.operation === "run") {
    lines.push(
      `Status: ${safeTerminalText(data?.status, 64)}`,
      `Agent: ${safeTerminalText(data?.governance?.agentId, 160)}`,
      `Provider: ${safeTerminalText(data?.provider?.id, 160)}`,
      `Iterations: ${safeCount(data?.iterations?.used)}/${safeCount(data?.iterations?.max)}`,
      "",
      safeTerminalBlock(data?.finalAnswer, 8_000),
      "",
      output.yellow("Automatic retry: forbidden; inspect agents show and approvals before another run."),
    );
  } else if (result.operation === "revoke") {
    lines.push(
      `Revoked: ${formatSafeList(data?.revoked)}`,
      output.yellow("Automatic retry: forbidden; reconcile with agents list before another revoke."),
    );
  } else if (result.operation === "approvals") {
    const approvals = Array.isArray(data) ? data : [];
    lines.push(`Pending approvals: ${approvals.length}`);
    for (const approval of approvals) {
      lines.push(
        `  ${safeTerminalText(approval?.id, 160)}  ${safeTerminalText(approval?.agentId, 160)}  `
        + `${safeTerminalText(approval?.toolName, 160)}  ${safeTerminalText(approval?.status, 32)}`,
        `    Review: ${formatSafeReview(approval?.review)}`,
      );
    }
  } else {
    lines.push(
      `Approval: ${safeTerminalText(data?.id, 160)}`,
      `Status: ${safeTerminalText(data?.status, 32)}`,
      `Agent: ${safeTerminalText(data?.agentId, 160)}`,
      `Tool: ${safeTerminalText(data?.toolName, 160)}`,
      output.yellow("Automatic retry: forbidden; reconcile with agents approvals."),
    );
  }
  output.write(`${lines.join("\n")}\n\n`);
}

function safeTerminalText(value, maxLength) {
  return String(value ?? "n/a")
    .replace(/[\u0000-\u001f\u007f\u001b]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

function safeTerminalBlock(value, maxLength) {
  return String(value ?? "n/a")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u001b]/gu, "")
    .slice(0, maxLength);
}

function safeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function formatSafeList(value) {
  return Array.isArray(value) && value.length > 0
    ? value.slice(0, 100).map((item) => safeTerminalText(item, 160)).join(", ")
    : "none";
}

function formatSafeRecord(value) {
  if (!isPlainRecord(value)) return "none";
  return Object.entries(value)
    .slice(0, 32)
    .map(([key, count]) => `${safeTerminalText(key, 64)}=${safeCount(count)}`)
    .join(", ") || "none";
}

function formatSafeReview(value) {
  if (!isPlainRecord(value)) return "unavailable";
  if (value.effectType === "agent:long-task" && value.reviewable === true) {
    return `Complete Agent task approval:\n${JSON.stringify(value, null, 2)}`;
  }
  if (value.effectType === "taiji:capability" && value.reviewable === true) {
    return `Taiji: ${value.taiji.effect}\nPolicy: ${value.policyHash}\nRequest hash: ${value.taiji.paramsHash}\n${JSON.stringify(value.taiji.params, null, 2)}`;
  }
  if (value.effectType === "forge:orchestrate" && value.reviewable === true) {
    return `Forge goal: ${safeTerminalBlock(value.forge.goal, 65536)}\nGoal digest: ${value.forge.goalDigest}\nPolicy: ${safeTerminalText(value.policyHash, 160)}\nOptions hash: ${value.forge.optionsHash}\n${JSON.stringify(value.forge.options, null, 2)}`;
  }
  if (value.effectType === "workforce:execute" && value.reviewable === true
    && value.workforce?.options?.externalRunner) {
    const workforce = value.workforce;
    return [`Workforce goal: ${workforce.goal}`, `Plan: ${workforce.planId}; digest: ${workforce.planDigest}; policy: ${value.policyHash}`,
      `Options hash: ${workforce.optionsHash}`, ...formatWorkforceExternalRunnerReview(workforce.options.externalRunner)].join("\n");
  }
  if (value.effectType === "workforce:execute" && value.reviewable === true
    && value.workforce?.options?.workflowHandoff && !value.workforce.options.roleExecution) {
    const workforce = value.workforce;
    return [`Workforce goal: ${safeTerminalBlock(workforce.goal, 4_000)}`,
      `Plan: ${safeTerminalText(workforce.planId, 160)}; digest: ${safeTerminalText(workforce.planDigest, 160)}; policy: ${safeTerminalText(value.policyHash, 160)}`,
      `Options hash: ${workforce.optionsHash}`,
      ...formatWorkforceWorkflowHandoffReview(workforce.options.workflowHandoff)].join("\n");
  }
  if (value.effectType === "workforce:execute" && value.reviewable === true && value.workforce?.options?.roleExecution) {
    const workforce = value.workforce;
    const profile = workforce.options.roleExecution;
    const selection = workforce.options.selectionReview;
    const codeDelivery = workforce.options.codeDelivery;
    const workflowHandoff = workforce.options.workflowHandoff;
    const consensusReview = workforce.options.consensusReview;
    const text = (item) => safeTerminalText(item, 256);
    return [
      `Workforce goal: ${safeTerminalBlock(workforce.goal, 4_000)}`,
      `Plan: ${text(workforce.planId)}; digest: ${text(workforce.planDigest)}; policy: ${text(value.policyHash)}`,
      `Employee model execution: required; profile: ${text(profile.profileId)}; hash: ${text(profile.profileHash)}`,
      `Request dispatch hard limit: ${profile.maxTotalRequests}; Concurrent roles: ${profile.maxConcurrentRoles}`,
      ...(codeDelivery === undefined ? [] : formatWorkforceCodeDeliveryReview(codeDelivery)),
      ...(workflowHandoff === undefined ? [] : [`Options hash: ${workforce.optionsHash}`, ...formatWorkforceWorkflowHandoffReview(workflowHandoff)]),
      ...(consensusReview === undefined ? [] : [`Options hash: ${workforce.optionsHash}`, ...formatWorkforceConsensusReview(consensusReview)]),
      ...(selection === undefined ? [] : [
        `Deterministic selection rules: v${selection.version}; catalog/configuration hash: ${text(selection.catalogHash)}`,
        `Selection hash: ${text(selection.selectionHash)}; task type: ${text(selection.taskType)}; execution mode: ${text(selection.executionMode)}`,
        `Selected role scope: ${selection.roleIds.map(text).join(", ")}`,
      ]),
      "Input tokens use an estimate before dispatch and upstream usage validation after completion.",
      "Output tokens use an upstream parameter limit and upstream usage validation after completion.",
      "Token limits do not guarantee a prepaid cap. Unknown usage and USD cost remain null; consumed tokens cannot be undone.",
      ...profile.bindings.map((binding) => `  ${text(binding.roleId)} / ${text(binding.employeeId)} -> ${text(binding.providerId)} / ${text(binding.modelId)}; `
        + `requests<=${binding.maxRequests}; input estimate=${binding.maxInputTokens}; output parameter=${binding.maxOutputTokens}; timeout=${binding.timeoutMs}ms`),
      ...(selection === undefined ? [] : [
        ...selection.assignments.map(({ binding, qualification }) =>
          `  Qualification ${text(binding.roleId)} / ${text(binding.employeeId)}: ${text(qualification.qualificationId)}; `
          + `status=${text(qualification.status)}; origin=${text(qualification.origin)}; execution mode=${text(qualification.executionMode)}\n`
          + `    Qualified roles: ${qualification.roleIds.map(text).join(", ")}; task types: ${qualification.taskTypes.map(text).join(", ")}\n`
          + `    Evidence: ${text(qualification.evidenceHash)}; valid until: ${text(qualification.validUntil)}`),
        `Rejected candidates: ${selection.rejected.length}`,
        ...selection.rejected.map(({ employeeId, reason }) => `  ${text(employeeId)}: ${text(reason)}`),
      ]),
    ].join("\n");
  }
  if (value.effectType === "workflow:artifact-write" && value.reviewable === true && isPlainRecord(value.workflow)) {
    const { content, ...binding } = value.workflow;
    return `${safeTerminalText(JSON.stringify({ ...binding, policyHash: value.policyHash }), 4_000)}\nComplete Markdown content:\n${safeTerminalBlock(content, 16_000)}\nEnd of complete Markdown content.`;
  }
  try {
    return safeTerminalText(JSON.stringify(value), 4_000);
  } catch {
    return "unavailable";
  }
}

function projectAgentApproval(value) {
  if (!isPlainRecord(value)) throw new Error("invalid Agent approval response");
  const output = {};
  for (const key of [
    "id",
    "agentId",
    "toolName",
    "argumentsHash",
    "status",
    "requestedAt",
    "expiresAt",
    "decidedAt",
    "decidedBy",
  ]) {
    if (typeof value[key] === "string") output[key] = value[key].slice(0, 4_000);
  }
  if (value.review !== undefined) {
    if (value.review?.effectType === "workflow:artifact-write" && value.review.reviewable === true) {
      const content = value.review.workflow?.content;
      if (typeof content !== "string" || content.length > 16_000 || Buffer.byteLength(content, "utf8") > 65_536
        || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(content)
        || value.review.workflow.contentBytes !== Buffer.byteLength(content, "utf8")
        || value.review.workflow.contentHash !== `sha256:${createHash("sha256").update(content, "utf8").digest("hex")}`) {
        throw new Error("invalid or incomplete workflow approval review");
      }
    }
    const profile = value.review?.workforce?.options?.roleExecution;
    const selectionSource = value.review?.workforce?.options?.selectionReview;
    const codeSource = value.review?.workforce?.options?.codeDelivery;
    const handoffSource = value.review?.workforce?.options?.workflowHandoff;
    const consensusSource = value.review?.workforce?.options?.consensusReview;
    const externalSource = value.review?.workforce?.options?.externalRunner;
    let externalRunner;
    if (externalSource !== undefined) {
      if (value.review.effectType !== "workforce:execute" || value.review.reviewable !== true
        || typeof value.review.policyHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(value.review.policyHash)) throw new Error("Invalid Workforce external runner approval review.");
      externalRunner = projectWorkforceExternalRunnerApproval(value.review.workforce);
    }
    let consensusReview;
    if (consensusSource !== undefined) {
      if (value.review.effectType !== "workforce:execute" || value.review.reviewable !== true) throw new Error("Invalid Workforce consensus approval review.");
      consensusReview = projectWorkforceConsensusApproval(value.review.workforce);
    }
    let workflowHandoff;
    if (handoffSource !== undefined) {
      if (value.review.effectType !== "workforce:execute" || value.review.reviewable !== true) {
        throw new Error("invalid or incomplete Workforce workflow handoff review");
      }
      workflowHandoff = projectWorkforceWorkflowHandoffReview(handoffSource);
      if (workflowHandoff.goal !== value.review.workforce.goal) throw new Error("invalid Workforce workflow handoff goal");
      assertWorkforceWorkflowOptionsHash(value.review.workforce.options, value.review.workforce.optionsHash);
    }
    let codeDelivery;
    if (codeSource !== undefined) {
      if (value.review.effectType !== "workforce:execute" || value.review.reviewable !== true || profile === undefined) {
        throw new Error("invalid or incomplete Workforce code delivery review");
      }
      codeDelivery = projectWorkforceCodeDeliveryReview(codeSource, profile);
    }
    let selection;
    if (selectionSource !== undefined) {
      if (value.review.effectType !== "workforce:execute" || value.review.reviewable !== true || profile === undefined) {
        throw new Error("invalid or incomplete Workforce selection review");
      }
      selection = projectWorkforceSelectionReview(selectionSource, profile);
    }
    output.review = sanitizeAgentReview(value.review);
    if (value.review?.effectType === "agent:long-task") {
      output.review = projectGovernedAgentTaskApproval(value.review);
    }
    if (value.review?.effectType === "forge:orchestrate" && value.review.reviewable === true) {
      output.review = projectForgeApprovalReview(value.review);
    }
    if (value.review?.effectType === "taiji:capability" && value.review.reviewable === true) {
      output.review = projectTaijiApprovalReview(value.review);
    }
    if (value.review?.effectType === "workforce:execute" && value.review.reviewable === true && profile !== undefined) {
      const bounded = (number, maximum) => Number.isSafeInteger(number) && number >= 1 && number <= maximum;
      if (!isPlainRecord(profile) || profile.version !== 1 || profile.mode !== "gateway-llm-required"
        || !Array.isArray(profile.bindings) || profile.bindings.length < 1 || profile.bindings.length > 128
        || !bounded(profile.maxConcurrentRoles, Math.min(8, profile.bindings.length))
        || !bounded(profile.maxTotalRequests, profile.bindings.length * 5)
        || profile.bindings.some((binding) => !isPlainRecord(binding)
          || !bounded(binding.maxRequests, 5) || !bounded(binding.maxInputTokens, 1_000_000)
          || !bounded(binding.maxOutputTokens, 1_000_000) || !bounded(binding.timeoutMs, 3_600_000))) {
        throw new Error("invalid or incomplete Workforce approval budget");
      }
      // Preserve only these validated numeric limits; the generic secret-key
      // redactor must still hide credential or token strings in every review.
      output.review.workforce.options.roleExecution.bindings = profile.bindings.map((binding) => ({
        ...sanitizeAgentReview(binding), maxInputTokens: binding.maxInputTokens, maxOutputTokens: binding.maxOutputTokens,
      }));
    }
    // Restore only the exact validated decision, including numeric token limits.
    if (selection !== undefined) output.review.workforce.options.selectionReview = selection;
    if (codeDelivery !== undefined) output.review.workforce.options.codeDelivery = codeDelivery;
    if (workflowHandoff !== undefined) {
      output.review.workforce.options.workflowHandoff = workflowHandoff;
      assertWorkforceWorkflowOptionsHash(output.review.workforce.options, output.review.workforce.optionsHash);
    }
    if (consensusReview !== undefined) {
      output.review.workforce.options.consensusReview = consensusReview;
      assertConsensusOptionsHash(output.review.workforce.options, output.review.workforce.optionsHash);
    }
    // This path has independently validated every native field; retain the entire prompt beyond generic display limits.
    if (externalRunner !== undefined) output.review.workforce = externalRunner;
  }
  return Object.freeze(output);
}

function projectWorkforceSelectionReview(value, profile) {
  const invalid = () => { throw new Error("invalid or incomplete Workforce selection review"); };
  const record = (value, keys) => {
    if (!hasExactKeys(value, keys) || Reflect.ownKeys(value).length !== keys.length
      || Object.values(Object.getOwnPropertyDescriptors(value)).some((property) => !("value" in property))) invalid();
    return value;
  };
  const array = (value, maximum) => {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum
      || Reflect.ownKeys(value).length !== value.length + 1) invalid();
    for (let index = 0; index < value.length; index++) if (!("value" in (Object.getOwnPropertyDescriptor(value, String(index)) ?? {}))) invalid();
    return value;
  };
  const identifier = (value) => {
    if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u.test(value)
      // Credential-like text is not printable selection evidence, even with a matching hash.
      || /\b(?:xox[abprs]-[A-Za-z0-9-]{10,}|xapp-[A-Za-z0-9-]{20,}|(?:sk_live_|rk_live_|whsec_)[A-Za-z0-9]{16,}|npm_[A-Za-z0-9]{20,}|tp-[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{12,}|sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|hf_[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,}|(?:AKIA|ASIA|AIDA|AROA|AIPA|ANPA|ANVA|ASCA)[A-Z0-9]{16})\b/iu.test(value)
      || /\b[A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PRIVATE[_-]?KEY|ACCESS[_-]?KEY)[A-Z0-9_]*:[A-Za-z0-9._:/-]{4,}/iu.test(value)) invalid();
    return value;
  };
  const tags = (value, maximum) => {
    const items = array(value, maximum).map(identifier);
    if (!items.length || new Set(items).size !== items.length || JSON.stringify([...items].sort()) !== JSON.stringify(items)) invalid();
    return items;
  };
  const sha = (value) => typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);
  const digest = (value) => `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
  const bindingKeys = ["roleId", "employeeId", "providerId", "modelId", "maxRequests", "maxInputTokens", "maxOutputTokens", "timeoutMs"];
  const profileKeys = ["version", "mode", "profileId", "maxTotalRequests", "maxConcurrentRoles", "bindings"];
  record(profile, [...profileKeys, "profileHash"]);
  const source = record(value, ["version", "catalogHash", "selectionHash", "taskType", "roleIds", "executionMode",
    "assignments", "rejected", "maxConcurrentRoles", "maxTotalRequests"]);
  if (source.version !== 1 || !sha(source.catalogHash) || !sha(source.selectionHash)
    || !["fake", "real"].includes(source.executionMode)) invalid();
  const taskType = identifier(source.taskType);
  const roleIds = tags(source.roleIds, 3);
  const bindings = array(profile.bindings, 3).map((value) => {
    const binding = record(value, bindingKeys);
    bindingKeys.slice(0, 4).forEach((key) => identifier(binding[key]));
    if ([binding.roleId, binding.employeeId].some((value) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value))
      || binding.timeoutMs < 1000) invalid();
    return Object.fromEntries(bindingKeys.map((key) => [key, binding[key]]));
  });
  if (JSON.stringify(roleIds) !== JSON.stringify(bindings.map(({ roleId }) => roleId))
    || source.maxConcurrentRoles !== profile.maxConcurrentRoles || source.maxTotalRequests !== profile.maxTotalRequests
    || profile.maxTotalRequests < bindings.length || profile.maxTotalRequests > bindings.reduce((sum, binding) => sum + binding.maxRequests, 0)) invalid();
  const assignments = array(source.assignments, 3).map((value, index) => {
    const item = record(value, ["binding", "qualification"]);
    const supplied = record(item.binding, bindingKeys); const binding = bindings[index];
    if (!binding || bindingKeys.some((key) => supplied[key] !== binding[key])) invalid();
    const q = record(item.qualification, ["qualificationId", "employeeId", "providerId", "modelId", "roleIds", "taskTypes",
      "status", "origin", "executionMode", "evidenceHash", "validUntil"]);
    const qualifiedRoles = tags(q.roleIds, 7); const taskTypes = tags(q.taskTypes, 16);
    if (q.employeeId !== binding.employeeId || q.providerId !== binding.providerId || q.modelId !== binding.modelId
      || !qualifiedRoles.includes(binding.roleId) || !taskTypes.includes(taskType) || q.status !== "accepted"
      || q.executionMode !== source.executionMode || !["synthetic", "reviewed"].includes(q.origin)
      || q.origin === "synthetic" && q.executionMode !== "fake" || !sha(q.evidenceHash)
      || !validIsoDate(q.validUntil) || new Date(q.validUntil).toISOString() !== q.validUntil) invalid();
    return { binding, qualification: { qualificationId: identifier(q.qualificationId), employeeId: binding.employeeId,
      providerId: binding.providerId, modelId: binding.modelId, roleIds: qualifiedRoles, taskTypes, status: "accepted",
      origin: q.origin, executionMode: q.executionMode, evidenceHash: q.evidenceHash, validUntil: q.validUntil } };
  });
  if (assignments.length !== bindings.length || new Set(bindings.map(({ employeeId }) => employeeId)).size !== bindings.length) invalid();
  const rejected = array(source.rejected, 5).map((value) => {
    const item = record(value, ["employeeId", "reason"]);
    if (!["not_enabled", "not_qualified", "not_selected"].includes(item.reason)) invalid();
    return { employeeId: identifier(item.employeeId), reason: item.reason };
  });
  if (assignments.length + rejected.length > 5 || new Set(rejected.map(({ employeeId }) => employeeId)).size !== rejected.length
    || rejected.some((item) => bindings.some((binding) => binding.employeeId === item.employeeId))) invalid();
  // S1 hashes this explicit order; the profile uses alphabetical canonical keys.
  const decision = { version: 1, catalogHash: source.catalogHash, taskType, roleIds, executionMode: source.executionMode,
    assignments, rejected, maxConcurrentRoles: profile.maxConcurrentRoles, maxTotalRequests: profile.maxTotalRequests };
  const profileInput = { ...Object.fromEntries(profileKeys.map((key) => [key, profile[key]])), bindings };
  if (source.selectionHash !== digest(JSON.stringify(decision)) || profile.profileId !== `selection-${source.selectionHash.slice(7)}`
    || profile.profileHash !== digest(JSON.stringify(profileInput, [...new Set([...profileKeys, ...bindingKeys])].sort()))) invalid();
  return Object.freeze({ ...decision, selectionHash: source.selectionHash });
}

function sanitizeAgentReview(value, depth = 0) {
  if (depth > 8) return "[truncated]";
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.slice(0, 16_000);
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeAgentReview(item, depth + 1));
  }
  if (!isPlainRecord(value)) return "[unsupported]";
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 100)
      .map(([key, item]) => [
        key.slice(0, 160),
        AGENT_REVIEW_SENSITIVE_KEY.test(key)
          ? "[redacted]"
          : sanitizeAgentReview(item, depth + 1),
      ]),
  );
}

function createSafeAgentGovernanceFailure(error, { operation, mutation }) {
  const rawCode = typeof error?.code === "string" && /^[A-Za-z0-9_:-]{1,128}$/u.test(error.code)
    ? error.code
    : null;
  const transportUncertain = new Set([
    "GATEWAY_CLIENT_ABORTED",
    "GATEWAY_CLIENT_TIMEOUT",
    "GATEWAY_HTTP_ERROR",
    "GATEWAY_NETWORK_ERROR",
    "GATEWAY_PROTOCOL_ERROR",
  ]).has(rawCode);
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : null;
  const unknown = mutation && (transportUncertain || statusCode === null || statusCode >= 500);
  return new CliAgentGovernanceFailure(
    unknown
      ? "AGENT_GOVERNANCE_OUTCOME_UNKNOWN"
      : rawCode ?? "AGENT_GOVERNANCE_REQUEST_REJECTED",
    {
      operation,
      mutation,
      status: unknown ? "unknown-reconcile-required" : "rejected",
    },
  );
}
