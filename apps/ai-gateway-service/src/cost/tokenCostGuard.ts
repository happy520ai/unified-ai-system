/**
 * tokenCostGuard 的类型声明（成本守卫：估算 token/成本 + block/require_approval/allow 决策）。
 * 接口对照 cost/tokenCostGuard.js 实际导出。
 */

export interface TokenCostEstimate {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
  currency: string;
  modelTier: string;
  method: string;
  confidence: string;
}

export type TokenCostDecision = "allow" | "require_approval" | "block";

export interface TokenCostGuardResult {
  enabled: boolean;
  mode: string;
  decision: TokenCostDecision;
  reasons: string[];
  policy: Record<string, unknown>;
  estimate: TokenCostEstimate;
  calibrationPreview: unknown;
  savings: Record<string, unknown>;
  cache: Record<string, unknown>;
  recommendedActions: string[];
  safety: Record<string, unknown>;
}

export interface TokenCostGuardInput {
  messages?: Array<{ role?: string; content?: string }>;
  maxOutputTokens?: number;
  userApprovedHighCost?: boolean;
  provider?: string;
  model?: string;
  requestType?: string;
  [key: string]: unknown;
}

export interface EnforceTokenCostGuardResult {
  allowed: boolean;
  decision: TokenCostDecision;
  reasons: string[];
  estimate: TokenCostEstimate;
}

export declare function checkTokenCostGuard(input?: TokenCostGuardInput, options?: Record<string, unknown>): TokenCostGuardResult;
export declare function enforceTokenCostGuard(input?: TokenCostGuardInput, options?: Record<string, unknown>): EnforceTokenCostGuardResult;
