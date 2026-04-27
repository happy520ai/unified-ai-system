import type { ContractMetadata } from "./common.js";

export type RoutingDecisionStatus = "selected" | "fallback_selected" | "no_route";
export type FallbackTrigger = "error" | "timeout" | "policy" | "health" | "capacity";

export interface ProviderTarget {
  providerId: string;
  modelId: string;
}

export interface CandidateScore {
  total: number;
  quality?: number;
  cost?: number;
  latency?: number;
  reliability?: number;
  policy?: number;
}

export interface RoutingCandidate {
  rank: number;
  target: ProviderTarget;
  score: CandidateScore;
  reasons?: string[];
  metadata?: ContractMetadata;
}

export interface FallbackStep {
  order: number;
  target: ProviderTarget;
  trigger?: FallbackTrigger;
  reason?: string;
  metadata?: ContractMetadata;
}

export interface FallbackChain {
  primary: ProviderTarget;
  fallbacks: FallbackStep[];
  maxAttempts?: number;
}

export interface RoutingDecision {
  id?: string;
  status: RoutingDecisionStatus;
  selected?: ProviderTarget;
  candidates: RoutingCandidate[];
  fallbackChain?: FallbackChain;
  policyVersion?: string;
  traceId?: string;
  reasons?: string[];
  metadata?: ContractMetadata;
}
