// T-094 leaf: type-only declarations extracted from toolProxy.ts
// (mechanical move certified by .pm/t094-leaf-closures.json; no runtime declarations dragged).
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
      /** Private one-shot exact-file verification capability; JSON is never sufficient. */
      workforceSnapshotCapability?: unknown;
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
