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

import type { EffectiveAgentPolicy } from "@unified-ai-system/shared-contracts";
import { computeArgumentsHash, evaluateResourceScope, checkUsageLimits } from "@unified-ai-system/policy-engine";
import type { AgentGovernanceService } from "./agentGovernanceService.ts";

export interface AgentGovernanceCallContext {
  agentId: string;
  tenantId: string;
  userId?: string;
  requestId?: string;
}

export interface ToolProxyVerdict {
  outcome: "allow" | "approval_required" | "deny";
  code?: string;
  reason?: string;
  approvalId?: string;
  policy?: EffectiveAgentPolicy;
}

export interface AgentGovernanceToolProxy {
  enforce(input: {
    context: AgentGovernanceCallContext;
    toolName: string;
    params: unknown;
  }): Promise<ToolProxyVerdict>;
}

export type ToolProxyMode = "enforce" | "observe";

export function createAgentGovernanceToolProxy(options: {
  service: AgentGovernanceService;
  mode?: ToolProxyMode;
  now?: () => string;
}): AgentGovernanceToolProxy {
  const service = options.service;
  const mode = options.mode ?? "enforce";
  const now = options.now ?? (() => new Date().toISOString());

  return {
    async enforce({ context, toolName, params }) {
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
      ): Promise<void> => {
        try {
          await service.emitAudit({
            eventType,
            agentId: context.agentId,
            tenantId: context.tenantId,
            toolName,
            ...fields,
          });
        } catch {
          // Audit failures must not change the enforcement verdict; the
          // fail-closed deny paths below do not depend on this write.
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

      await emit("TOOL_REQUESTED");

      const loaded = await service.loadVerifiedPolicy(context.agentId);
      if (!loaded) {
        // loadVerifiedPolicy already audited POLICY_SIGNATURE_FAILED when
        // integrity failed; a missing bundle is also fail-closed here.
        return observe(await denyAudited("POLICY_INTEGRITY_FAILED", "Effective policy failed integrity verification."));
      }
      const { policy } = loaded;
      if (policy.expiresAt <= now()) {
        return observe(await denyAudited("AGENT_EXPIRED", "Agent policy has expired."));
      }

      const decision = policy.toolDecisions[toolName] ?? "deny";
      if (decision === "deny") {
        return observe(await denyAudited("TOOL_DENIED_BY_POLICY", `Tool ${toolName} is not granted by the effective policy.`));
      }

      const scopeCheck = evaluateResourceScope(policy.scope, {
        tenantId: context.tenantId,
        outputFields: Array.isArray(params) ? [] : Object.keys((params as Record<string, unknown>) ?? {}),
      });
      if (!scopeCheck.allowed) {
        return observe(await denyAudited("TOOL_SCOPE_DENIED", scopeCheck.reason ?? "Tool call is out of the policy scope."));
      }

      const usageCounters = await service.getUsage(context.agentId);
      const usageCheck = checkUsageLimits(policy.limits, usageCounters);
      if (!usageCheck.allowed) {
        return observe(await denyAudited(usageCheck.reason ?? "USAGE_LIMIT_REACHED", "Usage ceiling reached for this agent."));
      }

      if (decision === "require_approval") {
        const approved = await service.findApprovedArguments(
          context.agentId,
          toolName,
          params,
        );
        if (approved) {
          await service.incrementUsage(context.agentId, "toolCalls");
          await emit("TOOL_ALLOWED", { decision: "require_approval", reason: `approved execution ${approved.approvalId}` });
          return { outcome: "allow", policy, approvalId: approved.approvalId };
        }
        const approval = await service.createApproval(
          context.agentId,
          toolName,
          params,
          context.tenantId,
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

      await service.incrementUsage(context.agentId, "toolCalls");
      await emit("TOOL_ALLOWED", { decision: "allow" });
      return { outcome: "allow", policy };
    },
  };
}

export { computeArgumentsHash };
