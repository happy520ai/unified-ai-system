export interface ApiKeyManagerOptions {
  storePath?: string | null;
  now?: () => number;
}

export interface ApiKeyBudgetInput {
  limitTokens: number;
  window?: "daily" | "monthly" | number | string;
  windowMs?: number;
  softThreshold?: number;
}

export interface ApiKeyRateLimitInput {
  requestsPerMinute: number;
}

export interface ApiKeyCreateInput {
  role?: string;
  tenantId?: string;
  description?: string;
  expiresAt?: string | null;
  budget?: ApiKeyBudgetInput | null;
  rateLimit?: ApiKeyRateLimitInput | null;
}

export interface ApiKeyBudgetDescription {
  budgetEnabled: boolean;
  rateLimitEnabled: boolean;
  requestCount: number;
  limitTokens?: number;
  windowMs?: number;
  softThreshold?: number;
  tokensUsed?: number;
  tokensRemaining?: number;
  windowResetAt?: string;
  softBudgetExceeded?: boolean;
}

export interface ApiKeyPublicRecord {
  keyId: string;
  keyFingerprint: string;
  keyHashExposed: false;
  keyHash?: undefined;
  role: string;
  tenantId: string;
  description: string;
  createdAt: string;
  expiresAt: string | null;
  revoked: boolean;
  lastUsedAt: string | null;
  budget: { limitTokens: number; windowMs: number; softThreshold: number } | null;
  rateLimit: ApiKeyRateLimitInput | null;
  usage: ApiKeyBudgetDescription;
}

export interface ApiKeyAuthorizationResult {
  allowed: boolean;
  code: string;
  budget: ApiKeyBudgetDescription | null;
  rate: ({ requestsPerMinute: number; requestCount: number; requestsRemaining: number } & Record<string, unknown>) | null;
}

export interface ApiKeyManager {
  create(input?: ApiKeyCreateInput): { key: string; record: ApiKeyPublicRecord };
  list(filter?: { tenantId?: string }): { keys: ApiKeyPublicRecord[]; totalCount: number };
  revoke(input?: { keyId?: string; key?: string; keyHash?: string }): { revoked: boolean; record: ApiKeyPublicRecord | null };
  validate(key: unknown): { valid: boolean; record: ApiKeyPublicRecord | null; error?: string };
  authorizeUsage(input?: { keyId?: string; key?: string; keyHash?: string; estimatedTokens?: number }): ApiKeyAuthorizationResult;
  recordUsage(input?: { keyId?: string; key?: string; keyHash?: string; tokens?: number }): {
    recorded: boolean;
    budget: ApiKeyBudgetDescription | null;
    softBudgetExceeded: boolean;
  };
  describeUsage(input?: { keyId?: string; key?: string; keyHash?: string }): (ApiKeyPublicRecord & { usage: ApiKeyBudgetDescription }) | null;
  getHealth(): Record<string, unknown>;
}

export declare function createApiKeyManager(options?: ApiKeyManagerOptions): ApiKeyManager;
