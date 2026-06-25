// =============================================================================
// httpSchemas.js — HTTP 边界校验 schemas (使用 zod)
// 在每个 HTTP 端点入口校验请求体，确保边界可信
//
// 类型合约: @unified-ai-system/shared-contracts
// - GatewayRequest, GatewayChatRequest (gateway.ts)
// - KnowledgeLoadRequest, KnowledgeRetrieveRequest (knowledge.ts)
// - ModelImportPreviewRequest, ModelImportConfirmRequest (modelImport.ts)
// =============================================================================

import { z } from "zod";

/**
 * @typedef {import("../../../../packages/shared-contracts/src/contracts/gateway.js").GatewayRequest} GatewayRequest
 * @typedef {import("../../../../packages/shared-contracts/src/contracts/knowledge.js").KnowledgeRetrieveRequest} KnowledgeRetrieveRequest
 */

// ── 通用 schemas ──

export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const IdSchema = z.string().min(1).max(128);

// ── Chat schemas ──

export const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string().min(1).max(100000),
  name: z.string().optional(),
  tool_calls: z.array(z.any()).optional(),
  tool_call_id: z.string().optional(),
});

export const ChatRequestSchema = z.object({
  prompt: z.string().min(1).max(100000).optional(),
  messages: z.array(ChatMessageSchema).min(1).max(100).optional(),
  model: z.string().max(200).optional(),
  providerId: z.string().max(100).optional(),
  taskType: z.string().max(50).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(128000).optional(),
  stream: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
}).refine(
  (data) => data.prompt || (data.messages && data.messages.length > 0),
  { message: "Either 'prompt' or 'messages' is required" }
);

// ── Knowledge schemas ──

export const KnowledgeLoadSchema = z.object({
  content: z.string().min(1).max(1000000),
  title: z.string().max(500).optional().default(""),
  source: z.string().max(200).optional().default("manual"),
  metadata: z.record(z.any()).optional(),
});

export const KnowledgeRetrieveSchema = z.object({
  query: z.string().min(1).max(10000),
  topK: z.number().int().min(1).max(100).optional().default(5),
  threshold: z.number().min(0).max(1).optional(),
});

// ── Model Import schemas ──

export const ModelImportPreviewSchema = z.object({
  apiKey: z.string().min(1).max(1000),
  providerHint: z.string().max(100).optional().default("auto"),
  baseUrl: z.string().url().optional(),
});

export const ModelImportConfirmSchema = z.object({
  apiKeyRef: z.string().min(1),
  providerId: z.string().min(1).max(100),
  modelId: z.string().min(1).max(200),
});

// ── Auth schemas ──

export const AuthTokenSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(200),
});

export const AuthRefreshSchema = z.object({
  token: z.string().min(1),
});

// ── Workforce schemas ──

export const WorkforcePlanSchema = z.object({
  goal: z.string().min(1).max(10000),
  constraints: z.array(z.string()).max(50).optional(),
  priority: z.enum(["low", "normal", "high", "critical"]).optional().default("normal"),
});

export const WorkforceExecuteSchema = z.object({
  planId: z.string().min(1).max(128),
  dryRun: z.boolean().optional().default(true),
});

// ── Cost schemas ──

export const CostEstimateSchema = z.object({
  model: z.string().min(1).max(200),
  inputTokens: z.number().int().min(0).max(1000000),
  outputTokens: z.number().int().min(0).max(1000000),
});

// ── 校验中间件工厂 ──

/**
 * 创建请求体校验中间件
 * @param {z.ZodSchema} schema
 * @returns {Function} 中间件函数
 */
export function createValidationMiddleware(schema) {
  return (body) => {
    const result = schema.safeParse(body);
    if (!result.success) {
      const issues = result.error.issues ?? result.error.errors ?? [];
      const errors = issues.map((e) => ({
        path: e.path.join("."),
        message: e.message,
        code: e.code,
      }));
      return { valid: false, errors, data: null };
    }
    return { valid: true, errors: null, data: result.data };
  };
}

// ── 预创建的校验器 ──

export const validators = {
  chat: createValidationMiddleware(ChatRequestSchema),
  knowledgeLoad: createValidationMiddleware(KnowledgeLoadSchema),
  knowledgeRetrieve: createValidationMiddleware(KnowledgeRetrieveSchema),
  modelImportPreview: createValidationMiddleware(ModelImportPreviewSchema),
  modelImportConfirm: createValidationMiddleware(ModelImportConfirmSchema),
  authToken: createValidationMiddleware(AuthTokenSchema),
  authRefresh: createValidationMiddleware(AuthRefreshSchema),
  workforcePlan: createValidationMiddleware(WorkforcePlanSchema),
  workforceExecute: createValidationMiddleware(WorkforceExecuteSchema),
  costEstimate: createValidationMiddleware(CostEstimateSchema),
};
