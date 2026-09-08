/**
 * Agent governance Tool Proxy.
 *
 * The single enforcement point for governed agent tool calls. Runs on
 * every call — never once at registration: agent status, expiry,
 * effective-policy signature, per-tool decision, tenant/resource scope
 * and usage ceilings are re-checked each time. Denials and approval
 * requests are audited; approved arguments are hash-locked so a
 * post-approval parameter swap forces a new approval.
 *
 * Legacy callers without a governance context are untouched: the proxy
 * only activates when a call carries `agentGovernance` identity.
 */

import { randomUUID } from "node:crypto";
import type {
  AgentToolApprovalReview,
  EffectiveAgentPolicy,
} from "@unified-ai-system/shared-contracts";
import { AGENT_GOVERNANCE_REDACTED_FIELDS } from "@unified-ai-system/shared-contracts";
import {
  computeArgumentsHash,
  evaluateResourceScope,
  getEffectiveToolDecision,
} from "@unified-ai-system/policy-engine";
import type { AgentGovernanceService } from "./agentGovernanceService.ts";
import {
  meterGovernedToolResult,
  type GovernedRecordDescriptor,
  type GovernedRecordMeterVerdict,
} from "./governedRecordMeter.ts";
import { isSafePublicObjectKey, redactSecretsInText } from "../security/secretSafety.js";
import { createToolRiskCatalog } from "./toolRiskCatalog.ts";
import { readFrozenWorkforceRoleExecutionProfile } from "../workforce/workforceRoleExecutionProfile.ts";

export interface AgentGovernanceCallContext {
  agentId: string;
  tenantId: string;
  userId?: string;
  requestId?: string;
}

/** Non-serializable, one-shot capability minted by one Tool Proxy instance. */
export interface AgentGovernanceSandboxAttestation {
  readonly kind: "agent-governance-sandbox-attestation";
}

export interface ToolProxyVerdict {
  outcome: "allow" | "approval_required" | "deny";
  code?: string;
  reason?: string;
  approvalId?: string;
  policy?: EffectiveAgentPolicy;
  executionLease?: { signal?: AbortSignal; release(): void };
  /** Authenticated decrypted parameters from the one-shot approval store. */
  approvedParams?: unknown;
  approvalReview?: AgentToolApprovalReview;
}

export interface AgentGovernanceToolProxy {
  enforce(input: {
    context: AgentGovernanceCallContext;
    toolName: string;
    params: unknown;
    resourceContext?: {
      resourceKeys?: Record<string, string>;
      rangeValues?: Record<string, string>;
      resources?: string[];
      outputFields?: string[];
      approvalReview?: Omit<AgentToolApprovalReview, "policyHash">;
      /** Server-produced proof that this invocation is already confined by
       * the Gateway's sandbox boundary. Agent parameters cannot populate it. */
      sandboxAttestation?: AgentGovernanceSandboxAttestation;
    };
  }): Promise<ToolProxyVerdict>;
  enforceResult(input: {
    context: AgentGovernanceCallContext;
    toolName: string;
    policy: EffectiveAgentPolicy;
    result: unknown;
    descriptor?: GovernedRecordDescriptor | null;
  }): Promise<GovernedRecordMeterVerdict>;
  recordOutcome(input: {
    context: AgentGovernanceCallContext;
    toolName: string;
    resultStatus: "success" | "error" | "denied";
    reason?: string;
  }): Promise<void>;
  mintSandboxAttestation(input: {
    context: AgentGovernanceCallContext;
    toolName: string;
    isolation: "read-only" | "full";
    ttlMs?: number;
  }): AgentGovernanceSandboxAttestation;
}

export type ToolProxyMode = "enforce" | "observe";

const SANDBOX_RISK_CATALOG = createToolRiskCatalog();

/** Unknown/custom tools conservatively require full isolation. */
export function requiredSandboxIsolationForTool(toolName: string): "read-only" | "full" {
  return SANDBOX_RISK_CATALOG.lookup(toolName)?.actionType === "read" ? "read-only" : "full";
}

export function createAgentGovernanceToolProxy(options: {
  service: AgentGovernanceService;
  mode?: ToolProxyMode;
  now?: () => string;
}): AgentGovernanceToolProxy {
  const service = options.service;
  const mode = options.mode ?? "enforce";
  const now = options.now ?? (() => new Date().toISOString());
  const sandboxCapabilities = new WeakMap<object, {
    agentId: string;
    tenantId: string;
    requestId: string;
    toolName: string;
    isolation: "read-only" | "full";
    issuedAtMs: number;
    expiresAtMs: number;
  }>();

  function mintSandboxAttestation(input: {
    context: AgentGovernanceCallContext;
    toolName: string;
    isolation: "read-only" | "full";
    ttlMs?: number;
  }): AgentGovernanceSandboxAttestation {
    const requestId = typeof input.context?.requestId === "string" ? input.context.requestId.trim() : "";
    if (!input.context?.agentId || !input.context?.tenantId || !requestId
      || !/^[A-Za-z0-9_.:-]{1,128}$/u.test(input.toolName)
      || (input.isolation !== "read-only" && input.isolation !== "full")) {
      throw new Error("Sandbox attestation requires bound Agent, tenant, request, tool, and isolation identity.");
    }
    const issuedAtMs = Date.parse(now());
    if (!Number.isFinite(issuedAtMs)) throw new Error("Sandbox attestation clock is invalid.");
    const ttlMs = Math.min(60_000, Math.max(1, Math.floor(Number(input.ttlMs) || 10_000)));
    const capability = Object.freeze(Object.create(null, {
      kind: { value: "agent-governance-sandbox-attestation", enumerable: true },
    })) as AgentGovernanceSandboxAttestation;
    sandboxCapabilities.set(capability, {
      agentId: input.context.agentId,
      tenantId: input.context.tenantId,
      requestId,
      toolName: input.toolName,
      isolation: input.isolation,
      issuedAtMs,
      expiresAtMs: issuedAtMs + ttlMs,
    });
    return capability;
  }

  function consumeSandboxAttestation(
    attestation: AgentGovernanceSandboxAttestation | undefined,
    context: AgentGovernanceCallContext,
    toolName: string,
    requiredIsolation: "read-only" | "full",
  ): boolean {
    if (!attestation || (typeof attestation !== "object" && typeof attestation !== "function")) return false;
    const metadata = sandboxCapabilities.get(attestation as object);
    if (!metadata) return false;
    sandboxCapabilities.delete(attestation as object);
    const currentMs = Date.parse(now());
    return Number.isFinite(currentMs) && currentMs >= metadata.issuedAtMs && currentMs <= metadata.expiresAtMs
      && metadata.agentId === context.agentId
      && metadata.tenantId === context.tenantId
      && metadata.requestId === context.requestId
      && metadata.toolName === toolName
      && (metadata.isolation === "full" || requiredIsolation === "read-only");
  }

  async function recordOutcome(input: {
    context: AgentGovernanceCallContext;
    toolName: string;
    resultStatus: "success" | "error" | "denied";
    reason?: string;
  }): Promise<void> {
    await service.emitAudit({
      eventType: input.resultStatus === "success" ? "TOOL_COMPLETED" : "TOOL_FAILED",
      agentId: input.context.agentId,
      tenantId: input.context.tenantId,
      requestId: input.context.requestId,
      toolName: input.toolName,
      argumentsRedacted: true,
      resultStatus: input.resultStatus,
      ...(input.reason ? { reason: input.reason.slice(0, 256) } : {}),
    });
  }

  return {
    mintSandboxAttestation,
    recordOutcome,
    async enforce({ context, toolName, params, resourceContext }) {
      const deny = (code: string, reason: string): ToolProxyVerdict => ({ outcome: "deny", code, reason });
      const observe = (verdict: ToolProxyVerdict): ToolProxyVerdict =>
        mode === "observe" && verdict.outcome === "deny"
          ? { ...verdict, outcome: "allow", code: `OBSERVED_${verdict.code ?? "DENY"}`, reason: verdict.reason }
          : verdict;

      // Governance audit events land in the central stream and the
      // agent's append-only trail. They record the policy verdict — the
      // observe mode's allow-conversion happens after the event is
      // written, so shadow-mode denials stay visible in the audit.
      const emit = async (
        eventType: "TOOL_REQUESTED" | "TOOL_ALLOWED" | "TOOL_DENIED",
        fields?: { decision?: "allow" | "require_approval" | "deny"; reason?: string },
      ): Promise<boolean> => {
        try {
          await service.emitAudit({
            eventType,
            agentId: context.agentId,
            tenantId: context.tenantId,
            toolName,
            ...fields,
          });
          return true;
        } catch {
          return false;
        }
      };
      const denyAudited = async (code: string, reason: string): Promise<ToolProxyVerdict> => {
        await emit("TOOL_DENIED", { decision: "deny", reason: code });
        return deny(code, reason);
      };

      if (!context || typeof context.agentId !== "string" || typeof context.tenantId !== "string") {
        return deny("GOVERNANCE_CONTEXT_REQUIRED", "Governed calls require agent and tenant identity.");
      }

      // Expiry sweep is cheap and keeps status honest on every call.
      await service.expireAgents();

      const record = await service.getAgent(context.agentId, context.tenantId);
      if (!record) {
        // Unverified identity claims are not governed-agent tool calls;
        // they surface through the registry execution log only.
        return deny("AGENT_NOT_FOUND", "Agent not found for this tenant.");
      }
      if (record.status !== "ACTIVE") {
        await emit("TOOL_REQUESTED");
        return observe(await denyAudited(`AGENT_${record.status}`, `Agent status is ${record.status}; tool calls require ACTIVE.`));
      }

      const loaded = await service.loadVerifiedPolicy(context.agentId);
      if (!loaded) {
        // loadVerifiedPolicy already audited POLICY_SIGNATURE_FAILED when
        // integrity failed; a missing bundle is also fail-closed here.
        return observe(await denyAudited("POLICY_INTEGRITY_FAILED", "Effective policy failed integrity verification."));
      }
      const { policy } = loaded;
      const auditRequired = policy.requirements.auditRequired === true
        || policy.mandatory?.auditRequired === true;
      if (!(await emit("TOOL_REQUESTED")) && auditRequired) {
        return deny("GOVERNANCE_AUDIT_REQUIRED", "Required governance audit persistence failed closed.");
      }
      if (policy.expiresAt <= now()) {
        return observe(await denyAudited("AGENT_EXPIRED", "Agent policy has expired."));
      }

      const decision = effectiveGovernedToolDecision(policy, toolName);
      if (decision === "deny") {
        return observe(await denyAudited("TOOL_DENIED_BY_POLICY", `Tool ${toolName} is not granted by the effective policy.`));
      }

      const sandboxRequired = policy.requirements.sandboxRequired === true;
      const requiredSandboxIsolation = requiredSandboxIsolationForTool(toolName);

      const scopeCheck = evaluateGovernedToolScope(policy, context.tenantId, params, resourceContext);
      if (!scopeCheck.allowed) {
        return observe(await denyAudited("TOOL_SCOPE_DENIED", scopeCheck.reason ?? "Tool call is out of the policy scope."));
      }

      if (decision === "require_approval") {
        const approved = await service.findApprovedArguments({
          agentId: context.agentId,
          tenantId: context.tenantId,
          toolName,
          args: params,
          policyHash: policy.policyHash,
        });
        if (approved) {
          if (sandboxRequired && !consumeSandboxAttestation(
            resourceContext?.sandboxAttestation,
            context,
            toolName,
            requiredSandboxIsolation,
          )) {
            return observe(await denyAudited(
              "GOVERNANCE_SANDBOX_REQUIRED",
              "The effective policy requires a server-attested sandbox for this tool call.",
            ));
          }
          const reservation = await service.reserveUsage(context.agentId, policy.limits, { toolCalls: 1 });
          if (!reservation.allowed) {
            return observe(await denyAudited(
              reservation.reason ?? "USAGE_LIMIT_REACHED",
              "Usage ceiling reached for this agent.",
            ));
          }
          const executionLease = await service.acquireToolExecutionLease({
            agentId: context.agentId,
            tenantId: context.tenantId,
            policyHash: policy.policyHash,
          });
          if (!executionLease) {
            await service.releaseUsage(context.agentId, { toolCalls: 1 });
            return observe(await denyAudited("AGENT_EXECUTION_FENCED", "Agent execution was revoked or reconfigured."));
          }
          let consumed;
          try {
            consumed = await service.consumeApprovedArguments({
              approvalId: approved.approvalId,
              agentId: context.agentId,
              tenantId: context.tenantId,
              toolName,
              args: params,
              policyHash: policy.policyHash,
              executionId: context.requestId ?? `tool_${randomUUID()}`,
            });
          } catch {
            executionLease.release();
            await service.releaseUsage(context.agentId, { toolCalls: 1 });
            return deny("GOVERNANCE_AUDIT_REQUIRED", "Approval consumption or its mandatory audit failed closed.");
          }
          if (!consumed) {
            executionLease.release();
            await service.releaseUsage(context.agentId, { toolCalls: 1 });
            return observe(await denyAudited(
              "APPROVAL_ALREADY_CONSUMED",
              "The matching approval was already consumed by another execution.",
            ));
          }
          return {
            outcome: "allow",
            policy,
            approvalId: consumed.approvalId,
            executionLease,
            approvedParams: consumed.args,
            approvalReview: consumed.review,
          };
        }
        const review = resourceContext?.approvalReview
          ? { ...resourceContext.approvalReview, policyHash: policy.policyHash }
          : null;
        if (!review || review.reviewable !== true) {
          return observe(await denyAudited(
            "APPROVAL_REVIEW_UNAVAILABLE",
            "This external effect cannot be approved without a safe server-produced operator review.",
          ));
        }
        const approval = await service.createApproval(
          context.agentId,
          toolName,
          params,
          context.tenantId,
          review,
          `require_approval decision for ${toolName}`,
        );
        // createApproval emits APPROVAL_REQUESTED; the call is neither
        // allowed nor denied yet, so no outcome event fires here.
        return {
          outcome: "approval_required",
          approvalId: approval.id,
          code: "TOOL_APPROVAL_REQUIRED",
          reason: `Tool ${toolName} requires approval (${approval.id}). Arguments are locked to this request.`,
          policy,
        };
      }

      if (sandboxRequired && !consumeSandboxAttestation(
        resourceContext?.sandboxAttestation,
        context,
        toolName,
        requiredSandboxIsolation,
      )) {
        return observe(await denyAudited(
          "GOVERNANCE_SANDBOX_REQUIRED",
          "The effective policy requires a server-attested sandbox for this tool call.",
        ));
      }
      const reservation = await service.reserveUsage(context.agentId, policy.limits, { toolCalls: 1 });
      if (!reservation.allowed) {
        return observe(await denyAudited(
          reservation.reason ?? "USAGE_LIMIT_REACHED",
          "Usage ceiling reached for this agent.",
        ));
      }
      const executionLease = await service.acquireToolExecutionLease({
        agentId: context.agentId,
        tenantId: context.tenantId,
        policyHash: policy.policyHash,
      });
      if (!executionLease) {
        await service.releaseUsage(context.agentId, { toolCalls: 1 });
        return observe(await denyAudited("AGENT_EXECUTION_FENCED", "Agent execution was revoked or reconfigured."));
      }
      if (!(await emit("TOOL_ALLOWED", { decision: "allow" })) && auditRequired) {
        executionLease.release();
        await service.releaseUsage(context.agentId, { toolCalls: 1 });
        return deny("GOVERNANCE_AUDIT_REQUIRED", "Required governance audit persistence failed closed.");
      }
      return { outcome: "allow", policy, executionLease };
    },
    async enforceResult({ context, toolName, policy, result, descriptor }) {
      const configuredLimit = policy.limits?.maxRecords;
      let remaining = typeof configuredLimit === "number"
        ? Math.max(0, configuredLimit - (await service.getUsage(context.agentId)).records)
        : undefined;
      let verdict = meterGovernedToolResult({ result, descriptor, maxRecords: remaining });
      for (let attempt = 0; verdict.deliveredRecordCount > 0 && attempt < 2; attempt += 1) {
        const reservation = await service.reserveUsage(
          context.agentId,
          policy.limits,
          { records: verdict.deliveredRecordCount },
        );
        if (reservation.allowed) break;
        if (attempt === 1 || typeof configuredLimit !== "number") {
          verdict = meterGovernedToolResult({ result, descriptor: null, maxRecords: 0 });
          break;
        }
        remaining = Math.max(0, configuredLimit - (await service.getUsage(context.agentId)).records);
        verdict = meterGovernedToolResult({ result, descriptor, maxRecords: remaining });
      }
      if (verdict.verdict === "replace") {
        try {
          await service.emitAudit({
            eventType: "TOOL_DENIED",
            agentId: context.agentId,
            tenantId: context.tenantId,
            toolName,
            decision: "deny",
            reason: verdict.code,
          });
        } catch {
          // The result remains closed even if the supplemental audit fails.
        }
      }
      const governedResult = redactGovernedResult(verdict.result, policy, toolName);
      const resultStatus = classifyToolResultStatus(governedResult);
      try {
        await recordOutcome({
          context,
          toolName,
          resultStatus,
          ...(resultStatus === "success" ? {} : { reason: toolResultReason(governedResult) }),
        });
      } catch {
        const auditRequired = policy.requirements.auditRequired === true
          || policy.mandatory?.auditRequired === true;
        if (auditRequired) {
          throw Object.assign(new Error("Required tool outcome audit persistence failed."), {
            code: "GOVERNANCE_AUDIT_REQUIRED",
          });
        }
      }
      return { ...verdict, result: governedResult };
    },
  };
}

function classifyToolResultStatus(result: unknown): "success" | "error" | "denied" {
  if (!result || typeof result !== "object" || Array.isArray(result)) return "success";
  const record = result as Record<string, unknown>;
  const status = String(record.status ?? "").toLowerCase();
  if (status === "denied") return "denied";
  if (record.success === false || ["error", "failed", "failure", "cancelled", "timeout"].includes(status)) {
    return "error";
  }
  return "success";
}

function toolResultReason(result: unknown): string {
  if (!result || typeof result !== "object" || Array.isArray(result)) return "tool_result_failed";
  const record = result as Record<string, unknown>;
  return String(record.code ?? record.error ?? record.status ?? "tool_result_failed");
}

function redactGovernedResult(result: unknown, policy: EffectiveAgentPolicy, toolName: string): unknown {
  const policyFields = Array.isArray(policy.scope?.deniedOutputFields)
    ? policy.scope.deniedOutputFields
    : [];
  const redactionRequired = policy.requirements?.outputRedactionRequired === true
    || policy.mandatory?.credentialsExposedToAgent !== true;
  const fields = new Set([
    ...(redactionRequired ? AGENT_GOVERNANCE_REDACTED_FIELDS : []),
    ...policyFields,
  ].map((field) => String(field).toLowerCase()));
  const allowCounter = toolName === "workforce_execute" ? workforceCounterAllowance(result, policy.agentId) : () => false;
  const seen = new WeakSet<object>();
  const maximumNodes = 10_000;
  let visitedNodes = 0;
  const visit = (value: unknown, depth: number, path: Array<string | number>): unknown => {
    visitedNodes += 1;
    if (visitedNodes > maximumNodes) return "[governed output node limit reached]";
    if (typeof value === "string") {
      return redactionRequired ? redactSecretsInText(value)
        .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/-]{8,}/giu, "$1 ***REDACTED***")
        .replace(/\b(password|token|secret|authorization|api[_-]?key)\s*[:=]\s*([^\s,;]+)/giu, "$1=***REDACTED***")
        : value;
    }
    if (typeof value === "function") return "[callable output omitted]";
    if (value === null || typeof value !== "object") return value;
    if (depth > 12) return "[governed output depth limit reached]";
    if (Buffer.isBuffer(value)) return "[binary output omitted]";
    if (seen.has(value)) return "[circular output omitted]";
    seen.add(value);
    if (Array.isArray(value)) {
      const output: unknown[] = [];
      let index = 0;
      for (const item of value) {
        if (visitedNodes >= maximumNodes) {
          output.push("[governed output node limit reached]");
          break;
        }
        output.push(visit(item, depth + 1, [...path, index++]));
      }
      return output;
    }
    const output = Object.create(null) as Record<string, unknown>;
    let redactedKeyIndex = 0;
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (visitedNodes >= maximumNodes) {
        defineSanitizedProperty(output, "__governanceTruncated", "[governed output node limit reached]");
        break;
      }
      const property = Object.getOwnPropertyDescriptor(value, key);
      if (!property || !("value" in property) || !isSafePublicObjectKey(key)) {
        defineSanitizedProperty(output, `[redacted-key-${redactedKeyIndex}]`, "***REDACTED***");
        redactedKeyIndex += 1;
        visitedNodes += 1;
        continue;
      }
      const nested = property.value;
      const normalized = key.toLowerCase();
      const policyDenied = policyFields.some((field) => normalized.includes(String(field).toLowerCase()));
      const redactedField = policyDenied || ([...fields].some((field) => normalized.includes(field)) && !allowCounter(path, key, nested));
      const sanitized = redactedField
        ? "***REDACTED***"
        : visit(nested, depth + 1, [...path, key]);
      if (redactedField) visitedNodes += 1;
      defineSanitizedProperty(output, key, sanitized);
    }
    return output;
  };
  return visit(result, 0, []);
}

/** This preserves validated counters; it never manufactures a contribution or overrides policy exclusions. */
function workforceCounterAllowance(result: unknown, agentId: string): (path: Array<string | number>, key: string, value: unknown) => boolean {
  const deny = () => false;
  if (ownData(result, "mode") !== "controlled-workforce-execution" || ownData(result, "phase") !== "PhaseC001"
    || !/^agr_[A-Za-z0-9_-]{1,128}$/.test(String(ownData(result, "agentRunId")))) return deny;
  const execution = ownData(result, "roleExecution");
  const rawProfile = ownData(execution, "profile");
  let profile;
  try {
    const source = ownSnapshot(rawProfile, ["version", "mode", "profileId", "maxTotalRequests", "maxConcurrentRoles", "bindings", "profileHash"]);
    if (!Array.isArray(source.bindings) || source.bindings.length < 1 || source.bindings.length > 128) return deny;
    const bindings = Array.from({ length: source.bindings.length }, (_, index) => ownSnapshot(ownData(source.bindings, String(index)),
      ["roleId", "employeeId", "providerId", "modelId", "maxRequests", "maxInputTokens", "maxOutputTokens", "timeoutMs"]));
    profile = readFrozenWorkforceRoleExecutionProfile({ ...source, bindings });
  } catch { return deny; }
  const bindings = new Map(profile.bindings.map((binding) => [binding.roleId, binding]));
  return (path, key, value) => {
    if (path.length !== 4) return false;
    if (path[0] === "roleExecution" && path[1] === "profile" && path[2] === "bindings" && typeof path[3] === "number") {
      const binding = profile.bindings[path[3]];
      return Boolean(binding && (key === "maxInputTokens" || key === "maxOutputTokens") && binding[key] === value);
    }
    if (!["inputTokens", "outputTokens", "totalTokens"].includes(key)) return false;
    let owner;
    let binding;
    if (path[0] === "roleExecution" && path[1] === "receipts" && typeof path[2] === "number" && path[3] === "receipt") {
      owner = ownData(ownData(execution, "receipts"), String(path[2]));
      binding = bindings.get(String(ownData(owner, "roleId")));
    } else if (path[0] === "roleResults" && typeof path[1] === "string" && path[2] === "workforceContribution" && path[3] === "receipt") {
      owner = ownData(ownData(ownData(result, "roleResults"), path[1]), "workforceContribution");
      binding = bindings.get(path[1]);
      if (ownData(owner, "version") !== 1 || ownData(owner, "roleId") !== path[1]
        || ownData(owner, "governedAgentId") !== agentId || ownData(owner, "agentRunId") !== ownData(result, "agentRunId")
        || ownData(owner, "executionId") !== ownData(result, "executionId") || ownData(owner, "planId") !== ownData(result, "planId")
        || ownData(owner, "profileHash") !== profile.profileHash) return false;
    } else return false;
    if (!binding || ownData(owner, "employeeId") !== binding.employeeId || !counterIdentifier(ownData(owner, "taskId"))) return false;
    const receipt = ownData(owner, "receipt");
    try {
      const data = ownSnapshot(receipt, ["version", "level", "status", "executionMode", "gatewayRequestId", "providerId", "modelId",
        "providerCallAttempted", "inputTokens", "outputTokens", "totalTokens", "estimatedCostUsd", "errorCode"]);
      return data.version === 1 && data.level === "gateway-provider-operation"
        && ["succeeded", "failed", "blocked", "cancelled", "outcome_unknown"].includes(String(data.status))
        && ["real", "fake", "unknown"].includes(String(data.executionMode))
        && (data.gatewayRequestId === null || counterIdentifier(data.gatewayRequestId))
        && (data.providerId === null || data.providerId === binding.providerId) && (data.modelId === null || data.modelId === binding.modelId)
        && (data.providerCallAttempted === null || typeof data.providerCallAttempted === "boolean")
        && (data.status !== "succeeded" || (data.executionMode !== "unknown" && counterIdentifier(data.gatewayRequestId)
          && data.providerId === binding.providerId && data.modelId === binding.modelId && data.providerCallAttempted === true && data.errorCode === null))
        && [data.inputTokens, data.outputTokens, data.totalTokens].every((item) => item === null || typeof item === "number" && Number.isSafeInteger(item) && item >= 0)
        && (data.estimatedCostUsd === null || typeof data.estimatedCostUsd === "number" && Number.isFinite(data.estimatedCostUsd) && data.estimatedCostUsd >= 0)
        && (data.errorCode === null || typeof data.errorCode === "string" && /^[A-Z][A-Z0-9_]{0,95}$/.test(data.errorCode))
        && data[key] === value;
    } catch { return false; }
  };
}

function ownData(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  const property = Object.getOwnPropertyDescriptor(value, key);
  return property && "value" in property ? property.value : undefined;
}

function ownSnapshot(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== keys.length || Object.keys(value).some((key) => !keys.includes(key))) throw new Error("Invalid Workforce counter DTO.");
  const snapshot: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (!property || !("value" in property)) throw new Error("Invalid Workforce counter property.");
    snapshot[key] = property.value;
  }
  return snapshot;
}

function counterIdentifier(value: unknown): boolean {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(value);
}

function defineSanitizedProperty(output: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(output, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

export { computeArgumentsHash };

/** Shared by effect admission and workflow receipt checks. Callers must first
 * obtain this policy through the Governance service's verified run admission. */
export function effectiveGovernedToolDecision(policy: EffectiveAgentPolicy, toolName: string) {
  const configured = getEffectiveToolDecision(policy, toolName);
  return configured === "allow" && policy.requirements.approvalRequired === true
    ? "require_approval" : configured;
}

export function evaluateGovernedToolScope(
  policy: EffectiveAgentPolicy, tenantId: string, params: unknown,
  resourceContext?: Parameters<AgentGovernanceToolProxy["enforce"]>[0]["resourceContext"],
) {
  return evaluateResourceScope(policy.scope, buildScopeCheckRequest(tenantId, params, policy.scope, resourceContext));
}

function buildScopeCheckRequest(
  tenantId: string,
  params: unknown,
  scope: EffectiveAgentPolicy["scope"],
  trusted?: {
    resourceKeys?: Record<string, string>;
    rangeValues?: Record<string, string>;
    resources?: string[];
    outputFields?: string[];
    approvalReview?: Omit<AgentToolApprovalReview, "policyHash">;
    sandboxAttestation?: AgentGovernanceSandboxAttestation;
  },
) {
  const record = params && typeof params === "object" && !Array.isArray(params)
    ? params as Record<string, unknown>
    : {};
  const declaredResourceKeys = asStringRecord(record.resourceKeys);
  const declaredRangeValues = asStringRecord(record.rangeValues);
  const resourceKeys: Record<string, string> = { ...declaredResourceKeys, ...(trusted?.resourceKeys ?? {}) };
  const rangeValues: Record<string, string> = { ...declaredRangeValues, ...(trusted?.rangeValues ?? {}) };
  for (const dimension of Object.keys(scope?.allowedResourceSets ?? {})) {
    const value = readDimension(record, dimension);
    if (value !== null) resourceKeys[dimension] = value;
  }
  for (const dimension of Object.keys(scope?.resourceRanges ?? {})) {
    const value = readDimension(record, dimension);
    if (value !== null) rangeValues[dimension] = value;
  }
  const resources = new Set<string>();
  for (const key of ["resource", "resourceId", "path", "file_path", "uri", "url", "database", "table"]) {
    const value = record[key];
    if (typeof value === "string" && value !== "") resources.add(value);
  }
  for (const value of Array.isArray(record.resources) ? record.resources : []) {
    if (typeof value === "string" && value !== "") resources.add(value);
  }
  for (const value of trusted?.resources ?? []) {
    if (typeof value === "string" && value !== "") resources.add(value);
  }
  const requestedFields = [record.outputFields, record.fields, record.select]
    .flatMap((value) => Array.isArray(value) ? value : [])
    .filter((value): value is string => typeof value === "string" && value !== "");
  requestedFields.push(...(trusted?.outputFields ?? []).filter((value) => typeof value === "string" && value !== ""));
  return {
    tenantId,
    resourceKeys,
    rangeValues,
    resources: [...resources],
    outputFields: requestedFields,
  };
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== ""));
}

function readDimension(record: Record<string, unknown>, dimension: string): string | null {
  const direct = record[dimension];
  if (typeof direct === "string" && direct !== "") return direct;
  const nested = record.resource;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const value = (nested as Record<string, unknown>)[dimension];
    if (typeof value === "string" && value !== "") return value;
  }
  return null;
}
