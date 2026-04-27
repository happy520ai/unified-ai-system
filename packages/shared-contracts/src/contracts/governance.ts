import type { ContractMetadata } from "./common.js";

export type GovernanceDecision = "allow" | "deny" | "fallback" | "observe" | "review";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface PolicySummary {
  id: string;
  version?: string;
  name?: string;
  decision: GovernanceDecision;
  reasons?: string[];
  metadata?: ContractMetadata;
}

export interface GovernanceMetric {
  name: string;
  value: number;
  unit?: string;
}

export interface GovernanceSummary {
  decision: GovernanceDecision;
  riskLevel?: RiskLevel;
  policies?: PolicySummary[];
  metrics?: GovernanceMetric[];
  auditId?: string;
  observedAt?: string;
  metadata?: ContractMetadata;
}

export interface GovernanceDashboardCounter {
  name: string;
  value: number;
}

export interface GovernanceDashboardSummary {
  generatedAt: string;
  windowStart?: string;
  windowEnd?: string;
  counters: GovernanceDashboardCounter[];
  recentDecisions?: GovernanceSummary[];
  topPolicies?: PolicySummary[];
  metadata?: ContractMetadata;
}
