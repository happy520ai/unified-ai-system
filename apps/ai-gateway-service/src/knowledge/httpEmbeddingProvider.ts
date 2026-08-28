// HTTP embedding provider (OpenAI-compatible /embeddings endpoint).
//
// Activates only when explicitly configured via the reserved knowledge env
// contract (KNOWLEDGE_EMBEDDING_PROVIDER/­MODEL/­API_KEY/­BASE_URL); the
// credential-free deterministic provider stays the default. Real calls are
// batch-async (embedTexts); the sync embedText slot intentionally throws so
// callers must use the async path. Secrets and input texts never appear in
// errors or logs.

import { fetchWithAgent } from "../http/connectionPool.js";
import { resolveSafeOutboundUrl } from "../security/outboundUrlPolicy.ts";
import {
  createDeterministicEmbeddingProvider,
  type DeterministicEmbeddingProvider,
} from "./deterministicEmbeddingProvider.ts";

export const HTTP_EMBEDDING_PROVIDER_ID = "http-openai-embeddings";
export const HTTP_EMBEDDING_PROVIDER_ENV_VALUE = "http";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_BATCH_TEXTS = 64;
const MAX_TEXT_CHARS = 32_768;

export interface HttpEmbeddingProvider {
  id: typeof HTTP_EMBEDDING_PROVIDER_ID;
  dimensions: number | null;
  credentialFree: false;
  asyncCapable: true;
  model: string;
  /** Sync 接口刻意不可用：HTTP 嵌入必须走批量异步路径。 */
  embedText(text: string): number[];
  embedTexts(texts: string[]): Promise<number[][]>;
}

interface HttpEmbeddingOptions {
  baseUrl: string;
  model: string;
  apiKey: string;
  dimensions?: number | null;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** 测试注入点：默认走网关出站安全策略。 */
  resolveUrlFn?: (url: string) => Promise<{ url: string; lookup?: unknown }>;
}

export function createHttpEmbeddingProvider(options: HttpEmbeddingOptions): HttpEmbeddingProvider {
  const baseUrl = String(options.baseUrl ?? "").replace(/\/+$/, "");
  const model = String(options.model ?? "");
  const apiKey = String(options.apiKey ?? "");
  if (!baseUrl || !model || !apiKey) {
    throw new Error("httpEmbeddingProvider requires baseUrl, model, and apiKey.");
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetchWithAgent;
  const resolveUrl = options.resolveUrlFn ?? resolveSafeOutboundUrl;
  const dimensions = typeof options.dimensions === "number" && options.dimensions > 0
    ? Math.floor(options.dimensions)
    : null;

  return {
    id: HTTP_EMBEDDING_PROVIDER_ID,
    dimensions,
    credentialFree: false as const,
    asyncCapable: true as const,
    model,
    embedText() {
      const error = new Error(
        "HTTP embeddings are async-only; use embedTexts().",
      ) as Error & { code: string };
      error.code = "EMBEDDING_ASYNC_REQUIRED";
      throw error;
    },
    async embedTexts(texts: string[]): Promise<number[][]> {
      if (!Array.isArray(texts) || texts.length === 0) return [];
      if (texts.length > MAX_BATCH_TEXTS) {
        throw createEmbeddingError(`Batch size ${texts.length} exceeds ${MAX_BATCH_TEXTS}.`, "EMBEDDING_BATCH_TOO_LARGE");
      }
      for (const text of texts) {
        if (typeof text !== "string" || text.length > MAX_TEXT_CHARS) {
          throw createEmbeddingError("Embedding input texts must be strings within the size limit.", "EMBEDDING_INPUT_INVALID");
        }
      }

      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort(new Error(`Embedding request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      try {
        const destination = await resolveUrl(`${baseUrl}/embeddings`);
        const response = await fetchImpl(destination.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ model, input: texts }),
          signal: controller.signal,
          lookup: destination.lookup,
        } as Parameters<typeof fetchImpl>[1]);
        if (!response.ok) {
          throw createEmbeddingError(
            `Embedding endpoint returned ${response.status}.`,
            `EMBEDDING_HTTP_${response.status}`,
            response.status >= 500 || response.status === 429,
          );
        }
        const payload = await response.json() as { data?: Array<{ index?: number; embedding?: number[] }> };
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        const byIndex = new Map<number, number[]>();
        for (const row of rows) {
          if (Array.isArray(row?.embedding)) {
            byIndex.set(Number(row.index ?? byIndex.size), row.embedding);
          }
        }
        const vectors: number[][] = [];
        for (let index = 0; index < texts.length; index += 1) {
          const vector = byIndex.get(index);
          if (!vector || !vector.every((value) => Number.isFinite(value))) {
            throw createEmbeddingError(
              "Embedding endpoint returned an incomplete or non-finite batch.",
              "EMBEDDING_RESPONSE_INVALID",
            );
          }
          vectors.push(vector);
        }
        return vectors;
      } catch (error) {
        if (error instanceof Error && (error.name === "AbortError" || (error as Error & { code?: string }).code === "ABORT_ERR")) {
          throw createEmbeddingError(
            `Embedding request timed out after ${timeoutMs}ms`,
            "EMBEDDING_TIMEOUT",
            true,
          );
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function createEmbeddingError(message: string, code: string, retryable = false) {
  const error = new Error(message) as Error & { code: string; retryable: boolean };
  error.code = code;
  error.retryable = retryable;
  return error;
}

/**
 * 依据 env 契约选择 provider：
 * - KNOWLEDGE_EMBEDDING_PROVIDER=http 且 model/apiKey/baseUrl 齐备 → HTTP 真实嵌入
 * - 否则 → 无凭证确定性嵌入（默认，绝不因配置缺失而失败）
 */
export function resolveEmbeddingProviderFromEnv(
  env: Record<string, string | undefined> = process.env,
): DeterministicEmbeddingProvider | HttpEmbeddingProvider {
  const providerKind = String(env.KNOWLEDGE_EMBEDDING_PROVIDER ?? "").trim().toLowerCase();
  const model = String(env.KNOWLEDGE_EMBEDDING_MODEL ?? "").trim();
  const apiKey = String(env.KNOWLEDGE_EMBEDDING_API_KEY ?? "").trim();
  const baseUrl = String(env.KNOWLEDGE_EMBEDDING_BASE_URL ?? "").trim();
  const dimensionsRaw = Number(env.KNOWLEDGE_EMBEDDING_DIMENSIONS);

  if (providerKind === HTTP_EMBEDDING_PROVIDER_ENV_VALUE && model && apiKey && baseUrl) {
    return createHttpEmbeddingProvider({
      baseUrl,
      model,
      apiKey,
      dimensions: Number.isFinite(dimensionsRaw) && dimensionsRaw > 0 ? dimensionsRaw : null,
    });
  }
  return createDeterministicEmbeddingProvider();
}
