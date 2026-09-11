import type { ContractMetadata, ResultEnvelope } from "./common.js";
import type { ProviderTarget } from "./routing.js";
import type { AgentToolApprovalReview } from "./agentGovernance.js";

export interface ForgePolishRequest {
  content: string;
  task?: ContractMetadata;
  passes?: number;
  maxOutputTokens?: number;
  modelSelection?: Readonly<ProviderTarget>;
}
export interface ForgeOrchestrateRequest {
  goal: string;
  agentId: string;
  options?: Omit<NonNullable<AgentToolApprovalReview["forge"]>["options"], "enableCodeIntel" | "webTask"> & {
    enableCodeIntel?: false;
    webTask?: { profileId: string; itemId: string; expectedText: string };
  };
}
export interface ForgeRunSummary {
  runId: string;
  status: "running" | "completed" | "failed";
  startedAt: string;
  goalPreview?: string;
  goalDigest?: string;
  result?: ContractMetadata;
  error?: { code: string; message: string };
}
export type ForgeRunsResult = ResultEnvelope<{ ok: boolean; runs: ForgeRunSummary[]; total: number }>;
/** Detailed engine-specific evidence remains structured metadata; `ok` must be checked. */
export type ForgeOperationResult = ResultEnvelope<ContractMetadata & { ok: boolean }>;
export type ForgeStatusResult = ResultEnvelope<ContractMetadata & { enabled: boolean }>;
export type ForgeOrchestrateResult = ForgeOperationResult | ResultEnvelope<{
  outcome: "approval_required";
  approvalId: string;
  agentId: string;
  toolName: "forge_orchestrate";
  code: string;
}>;
export type TaijiCompileResult = ResultEnvelope<{ spec: ContractMetadata; risk: ContractMetadata; manifest: ContractMetadata }>;
export type WorkforcePreviewResult = ResultEnvelope<{ route: "/workforce/preview"; preview: ContractMetadata }>;
