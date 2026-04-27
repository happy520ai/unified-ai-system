import type { AiTaskType, ContractMetadata } from "./common.js";

export type ProviderKind = "llm" | "embedding" | "reranker" | "tool" | "hybrid";

export type ProviderCapability =
  | AiTaskType
  | "streaming"
  | "json_output"
  | "function_calling"
  | "vision"
  | "embedding"
  | "rerank";

export type ProviderHealthStatus = "unknown" | "healthy" | "degraded" | "unavailable";
export type CostTier = "low" | "medium" | "high";
export type LatencyTier = "fast" | "medium" | "slow";

export interface ProviderModelDescriptor {
  id: string;
  displayName?: string;
  capabilities: ProviderCapability[];
  contextWindowTokens?: number;
  maxOutputTokens?: number;
  costTier?: CostTier;
  latencyTier?: LatencyTier;
  enabled: boolean;
  metadata?: ContractMetadata;
}

export interface ProviderHealthDescriptor {
  status: ProviderHealthStatus;
  checkedAt?: string;
  message?: string;
  metadata?: ContractMetadata;
}

export interface ProviderDescriptor {
  id: string;
  displayName: string;
  kind: ProviderKind;
  models: ProviderModelDescriptor[];
  health?: ProviderHealthDescriptor;
  priority?: number;
  metadata?: ContractMetadata;
}
