import type { ContractMetadata, ResultEnvelope } from "./common.js";

export type RoutingPreviewKind = "answer-path" | "quality-cost";
/** Preview inputs are local simulation assumptions, not runtime authorization. */
export type RoutingPreviewRequest = ContractMetadata & { query: string };
export interface RoutingPreviewResponse {
  success: boolean;
  mode: "local-routing-preview-only" | "local-quality-cost-routing-preview-only";
  answerPath: string;
  modelTier: string;
  providerRecommendation: string | null;
  modelRecommendation: string | null;
  requiresPaidApi: boolean;
  requiresApproval: boolean;
  shouldBlock: boolean;
  blockReason?: string | null;
  routingReason: string;
  paidApiCallCount: 0;
  externalApiCalled: false;
  audit?: ContractMetadata;
}
export type RoutingPreviewResult = ResultEnvelope<RoutingPreviewResponse>;
export type RouteModesResult = ResultEnvelope<{ modes: string[]; routeModes: string[] }>;

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
