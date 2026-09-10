import type { ContractMetadata, ResultEnvelope } from "./common.js";

export type TaijiProfileId = "risk-classification-v1" | "context-jsonl-v1" | "evidence-summary-v1";
export type TaijiFact = { key: string; value: null | boolean | number | string; reference?: string };
export type TaijiArguments = { text: string; expectedSignals?: string[] } | { facts: TaijiFact[] } | {
  records: Array<{ id: string; attempt: number; status: "passed" | "failed" | "unknown" | "skipped"; evidenceSha256: string }>;
};
export interface TaijiRequestBase { agentId: string; capabilityId: string; expectedLifecycleRevision: number }
export interface TaijiEvaluateRequest extends TaijiRequestBase { request: string; profileId: TaijiProfileId; parameters?: { additionalRiskKeywords?: Record<string, string[]> } }
export interface TaijiActivateRequest extends TaijiRequestBase { revision: number; limits?: { ttlSeconds?: number; maxRequests?: number; maxRuntimeMs?: number } }
export interface TaijiExecuteRequest extends TaijiRequestBase { revision: number; runId: string; arguments: TaijiArguments }
export interface TaijiSelectedExecuteRequest { agentId: string; selection: { profileId: TaijiProfileId }; runId: string; arguments: TaijiArguments }
export interface TaijiRevokeRequest extends TaijiRequestBase { revision: number; reason?: string }
export interface TaijiFeedbackRequest extends TaijiRequestBase { revision: number; sourceRunId: string }
export interface TaijiRepairRequest extends TaijiFeedbackRequest { sourceArguments: { text: string; expectedSignals: string[] }; addRiskKeywords: Record<string, string[]> }
export interface TaijiArtifact { mediaType: "application/json" | "application/x-ndjson"; content: string; sha256: string; bytes: number }
export interface TaijiRunResult extends ContractMetadata {
  id: string; capabilityId: string; revision: number; activationEpoch: number; argumentsHash: string;
  candidateHash: string; profileId: TaijiProfileId; implementationHash: string; parametersHash: string; policyHash: string; approvalId: string;
  status: "running" | "passed" | "failed" | "cancelled" | "unknown";
  result: (ContractMetadata & { actualExecution: boolean; workerClosed: boolean; artifact: TaijiArtifact | null;
    modelUsage: { unit: "tokens"; total: number | null; requests: number | null; source: string } }) | null;
}
export interface TaijiCapabilitySummary extends ContractMetadata {
  id: string; lifecycleRevision: number; versions: Array<ContractMetadata & { revision: number; candidateHash: string;
    profileId: TaijiProfileId; implementationHash: string; weight: number; parameters: { additionalRiskKeywords?: Record<string, string[]> };
    status: "evaluating" | "evaluated" | "failed" | "unknown" | "revoked" }>;
  activation: (ContractMetadata & { revision: number; epoch: number; expiresAt: number; maxRequests: number; requests: number }) | null;
  totalRequests: number; totalElapsedMs: number;
}
export type TaijiStatusResult = ResultEnvelope<{
  enabled: boolean; storageMode: "single-process-signed-json"; restartRequiresApproval: true;
  agentStatus: string; executionAuthorizationChecked: false;
  profiles: Array<{ id: TaijiProfileId; implementationHash: string; operation: string }>;
  capabilities: TaijiCapabilitySummary[];
  capabilityCount: number; runCount: number; limit: number; offset: number;
  /** Inspection lists metadata only; use taijiCapabilityRun to read full artifacts. */
  runs: Array<Omit<TaijiRunResult, "result"> & { result: ContractMetadata | null }>;
}>;
export type TaijiOperationResult = ResultEnvelope<ContractMetadata & {
  status: "approval_required" | "evaluated" | "active" | "revoked" | "pruned" | "reweighted" | "passed" | "failed" | "cancelled" | "unknown" | "replayed" | "running";
  approvalId?: string; capability?: TaijiCapabilitySummary; run?: TaijiRunResult;
  executionRepeated?: false; records?: ContractMetadata[];
  stateCommitted?: boolean;
}>;
