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

  return {
    mintSandboxAttestation,
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

      const configuredDecision = getEffectiveToolDecision(policy, toolName);
      const decision = configuredDecision === "allow" && policy.requirements.approvalRequired === true
        ? "require_approval"
        : configuredDecision;
      if (decision === "deny") {
        return observe(await denyAudited("TOOL_DENIED_BY_POLICY", `Tool ${toolName} is not granted by the effective policy.`));
      }

      const sandboxRequired = policy.requirements.sandboxRequired === true;
      const requiredSandboxIsolation = requiredSandboxIsolationForTool(toolName);

      const scopeCheck = evaluateResourceScope(
        policy.scope,
        buildScopeCheckRequest(context.tenantId, params, policy.scope, resourceContext),
      );
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
      return { ...verdict, result: redactGovernedResult(verdict.result, policy) };
    },
  };
}

function redactGovernedResult(result: unknown, policy: EffectiveAgentPolicy): unknown {
  const policyFields = Array.isArray(policy.scope?.deniedOutputFields)
    ? policy.scope.deniedOutputFields
    : [];
  const redactionRequired = policy.requirements?.outputRedactionRequired === true
    || policy.mandatory?.credentialsExposedToAgent !== true;
  const fields = new Set([
    ...(redactionRequired ? AGENT_GOVERNANCE_REDACTED_FIELDS : []),
    ...policyFields,
  ].map((field) => String(field).toLowerCase()));
  const seen = new WeakSet<object>();
  const maximumNodes = 10_000;
  let visitedNodes = 0;
  const visit = (value: unknown, depth: number): unknown => {
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
      for (const item of value) {
        if (visitedNodes >= maximumNodes) {
          output.push("[governed output node limit reached]");
          break;
        }
        output.push(visit(item, depth + 1));
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
      const redactedField = [...fields].some((field) => normalized.includes(field));
      const sanitized = redactedField
        ? "***REDACTED***"
        : visit(nested, depth + 1);
      if (redactedField) visitedNodes += 1;
      defineSanitizedProperty(output, key, sanitized);
    }
    return output;
  };
  return visit(result, 0);
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
