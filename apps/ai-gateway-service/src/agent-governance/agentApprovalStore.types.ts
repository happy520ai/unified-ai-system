// T-094 leaf: type-only declarations extracted from agentApprovalStore.ts
// (mechanical move certified by .pm/t094-leaf-closures.json; no runtime declarations dragged).
import type {
  AgentToolApprovalRecord,
  AgentToolApprovalReview,
} from "@unified-ai-system/shared-contracts";

export interface CreateApprovalInput {
  agentId: string;
  toolName: string;
  arguments: unknown;
  tenantId: string;
  ttlSeconds?: number;
  reason?: string;
  review: AgentToolApprovalReview;
}

export interface AgentApprovalStore {
  create(
    input: CreateApprovalInput,
    beforeCommit?: (record: AgentToolApprovalRecord) => Promise<void>,
  ): Promise<AgentToolApprovalRecord>;
  decide(
    id: string,
    decision: "approve" | "reject",
    decidedBy: string,
    beforeCommit?: (record: AgentToolApprovalRecord) => Promise<void>,
  ): Promise<AgentToolApprovalRecord>;
  get(id: string): Promise<AgentToolApprovalRecord | null>;
  listPending(agentId?: string): Promise<AgentToolApprovalRecord[]>;
  recoverArguments(id: string): Promise<{ argumentsHash: string; args: unknown } | null>;
  findApproved(input: {
    agentId: string;
    tenantId: string;
    toolName: string;
    argumentsHash: string;
    policyHash: string;
  }): Promise<{ id: string } | null>;
  verifyConsumed(input: { approvalId: string; agentId: string; tenantId: string; toolName: string;
    argumentsHash: string; policyHash: string; executionId: string }): Promise<{ args: unknown; review: AgentToolApprovalReview } | null>;
  consumeApproved(input: {
    approvalId?: string;
    agentId: string;
    tenantId: string;
    toolName: string;
    argumentsHash: string;
    policyHash: string;
    executionId: string;
  }, beforeCommit?: (record: AgentToolApprovalRecord, args: unknown) => Promise<void>): Promise<{
    id: string;
    args: unknown;
    review: AgentToolApprovalReview;
  } | null>;
  expireStale(now: string): Promise<number>;
}
