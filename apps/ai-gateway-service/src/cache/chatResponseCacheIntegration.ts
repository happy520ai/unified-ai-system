import { createHash } from "node:crypto";
import { inspectCacheSafety } from "./responseCacheSanitizer.js";
import { createDeterministicEmbeddingProvider } from "../knowledge/deterministicEmbeddingProvider.ts";
import {
  lookupCache as defaultLookupCache,
  writeCacheRecord as defaultWriteCacheRecord,
} from "./responseCacheStore.js";

/**
 * Hot-path response cache for POST /v1/chat/completions.
 *
 * The cache subsystem (policy, store, tenant scoping, audit trail) already
 * exists; this module is the bridge that turns a normalized chat request into
 * a tenant-scoped cache key and stores the exact OpenAI-compatible wire
 * payload so a hit can be replayed without a provider call.
 *
 * The feature is opt-in: AI_GATEWAY_RESPONSE_CACHE_ENABLED must be exactly
 * "true". Every lookup and persist path fails open — a cache error must never
 * change the chat response.
 */

export const CHAT_RESPONSE_CACHE_ENABLED_ENV = "AI_GATEWAY_RESPONSE_CACHE_ENABLED";
export const CHAT_RESPONSE_CACHE_TTL_MS_ENV = "AI_GATEWAY_RESPONSE_CACHE_TTL_MS";
export const CHAT_RESPONSE_CACHE_MAX_PAYLOAD_BYTES_ENV = "AI_GATEWAY_RESPONSE_CACHE_MAX_PAYLOAD_BYTES";
export const CHAT_RESPONSE_CACHE_SEMANTIC_ENABLED_ENV = "AI_GATEWAY_RESPONSE_CACHE_SEMANTIC_ENABLED";
export const CHAT_RESPONSE_CACHE_SEMANTIC_THRESHOLD_ENV = "AI_GATEWAY_RESPONSE_CACHE_SEMANTIC_THRESHOLD";

const DEFAULT_TTL_MS = 604_800_000;
const DEFAULT_MAX_PAYLOAD_BYTES = 262_144;
const CACHE_KEY_NAMESPACE = "openai-chat-v1";
const KEY_VERSION = 1;
// Strings longer than this (inline base64 images, long documents) are hashed
// into the key instead of embedded, so the serialized key payload stays small.
const INLINE_STRING_LIMIT = 256;
const PREVIEW_LIMIT = 500;

export interface ChatResponseCacheConfig {
  enabled: boolean;
  ttlMs: number;
  maxPayloadBytes: number;
  semanticEnabled: boolean;
  semanticThreshold: number;
}

export interface ChatCacheCandidate {
  cacheKey: string;
  stream: boolean;
  /** Compact serialization the cache key derives from; also the semantic embedding source. */
  semanticSource: string;
}

export interface ChatCacheJsonPayload {
  kind: "json";
  response: Record<string, unknown>;
}

export interface ChatCacheSsePayload {
  kind: "sse";
  chunks: unknown[];
  usageChunk?: unknown;
}

export type ChatCachePayload = ChatCacheJsonPayload | ChatCacheSsePayload;

export interface ChatCacheLookupResult {
  payload: ChatCachePayload;
  cacheKey: string;
  hitType: "exact" | "semantic";
  semanticScore?: number;
}

export interface ChatCacheTenantIdentity {
  tenantId?: unknown;
}

interface ResponseCacheStoreLike {
  lookupCache(input: Record<string, unknown>): Record<string, unknown>;
  writeCacheRecord(input: Record<string, unknown>): Record<string, unknown>;
}

export interface ChatResponseCacheIntegration {
  readConfig(): ChatResponseCacheConfig;
  describeCacheCandidate(
    requestBody: { stream?: unknown },
    gatewayInput: Record<string, unknown>,
  ): ChatCacheCandidate | null;
  lookup(params: {
    candidate: ChatCacheCandidate;
    tenantIdentity: ChatCacheTenantIdentity | null | undefined;
  }): ChatCacheLookupResult | null;
  persist(params: {
    candidate: ChatCacheCandidate;
    tenantIdentity: ChatCacheTenantIdentity | null | undefined;
    payload: ChatCachePayload;
  }): void;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(compactInlineStrings(value)) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

function compactInlineStrings(value: unknown): unknown {
  if (typeof value === "string" && value.length > INLINE_STRING_LIMIT) {
    return { hash: sha256(value), length: value.length };
  }
  return value;
}

function readPositiveIntEnv(
  env: Record<string, string | undefined>,
  name: string,
  fallback: number,
): number {
  const parsed = Math.floor(Number(env[name]));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readThresholdEnv(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed < 1 ? parsed : 0.92;
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

export function createChatResponseCacheIntegration(options: {
  env?: Record<string, string | undefined>;
  store?: ResponseCacheStoreLike;
} = {}): ChatResponseCacheIntegration {
  const env = options.env ?? {};
  const store: ResponseCacheStoreLike = options.store ?? {
    lookupCache: defaultLookupCache,
    writeCacheRecord: defaultWriteCacheRecord,
  };
  // 语义层：每租户有界的内存向量索引（确定性 embedding，零凭证）。
  const semanticEmbedding = createDeterministicEmbeddingProvider();
  const semanticIndex = new Map<string, Array<{ embedding: number[]; payload: ChatCachePayload; stream: boolean }>>();
  const SEMANTIC_MAX_ENTRIES_PER_TENANT = 200;

  function readConfig(): ChatResponseCacheConfig {
    return {
      enabled: env[CHAT_RESPONSE_CACHE_ENABLED_ENV] === "true",
      ttlMs: readPositiveIntEnv(env, CHAT_RESPONSE_CACHE_TTL_MS_ENV, DEFAULT_TTL_MS),
      maxPayloadBytes: readPositiveIntEnv(
        env,
        CHAT_RESPONSE_CACHE_MAX_PAYLOAD_BYTES_ENV,
        DEFAULT_MAX_PAYLOAD_BYTES,
      ),
      semanticEnabled: env[CHAT_RESPONSE_CACHE_SEMANTIC_ENABLED_ENV] === "true",
      semanticThreshold: readThresholdEnv(env[CHAT_RESPONSE_CACHE_SEMANTIC_THRESHOLD_ENV]),
    };
  }

  function describeCacheCandidate(
    requestBody: { stream?: unknown },
    gatewayInput: Record<string, unknown>,
  ): ChatCacheCandidate | null {
    if (!readConfig().enabled) return null;
    // Tool-call requests stay uncached for now: their outputs feed external
    // tool state and replaying them verbatim is not yet contract-safe.
    if (Array.isArray(gatewayInput.tools) && gatewayInput.tools.length > 0) return null;

    const stream = requestBody.stream === true;
    const keyPayload = {
      version: KEY_VERSION,
      kind: stream ? "sse" : "json",
      model: gatewayInput.model ?? null,
      providerId: gatewayInput.providerId ?? null,
      messages: gatewayInput.messages ?? null,
      options: gatewayInput.options ?? null,
      requiredCapabilities: gatewayInput.requiredCapabilities ?? null,
    };
    const serialized = stableStringify(keyPayload);
    // Secret-like request text must never reach the shared cache index.
    if (inspectCacheSafety({ query: serialized }).containsSecret) return null;

    return {
      cacheKey: `${CACHE_KEY_NAMESPACE}:${sha256(serialized)}`,
      stream,
      semanticSource: serialized,
    };
  }

  function readPayload(record: Record<string, unknown>): ChatCachePayload | null {
    const metadata = record.metadata as { chatHotPath?: ChatCachePayload } | undefined;
    const payload = metadata?.chatHotPath;
    if (!payload || (payload.kind !== "json" && payload.kind !== "sse")) return null;
    if (payload.kind === "json" && !payload.response) return null;
    if (payload.kind === "sse" && !Array.isArray(payload.chunks)) return null;
    return payload;
  }

  function lookup(params: {
    candidate: ChatCacheCandidate;
    tenantIdentity: ChatCacheTenantIdentity | null | undefined;
  }): ChatCacheLookupResult | null {
    // Without a server-authenticated tenant the cache is skipped entirely —
    // requests without an enterprise tenant context never share a cache lane.
    const tenantId = typeof params.tenantIdentity?.tenantId === "string" && params.tenantIdentity.tenantId
      ? params.tenantIdentity.tenantId
      : null;
    if (!tenantId) {
      return null;
    }
    try {
      const result = store.lookupCache({
        cacheKey: params.candidate.cacheKey,
        tenantScopeIdentity: params.tenantIdentity,
      });
      if (result.cacheDecision === "hit") {
        const payload = readPayload(result);
        if (payload && (payload.kind === "sse") === params.candidate.stream) {
          return { payload, cacheKey: params.candidate.cacheKey, hitType: "exact" };
        }
      }
      return semanticLookup(params.candidate, tenantId);
    } catch {
      // Fail open: a cache lookup error must not break the chat request.
      return null;
    }
  }

  function semanticLookup(candidate: ChatCacheCandidate, tenantId: string): ChatCacheLookupResult | null {
    const config = readConfig();
    if (!config.semanticEnabled) return null;
    const entries = semanticIndex.get(tenantId);
    if (!entries || entries.length === 0) return null;
    const queryVector = semanticEmbedding.embedText(candidate.semanticSource);
    let best: { score: number; entry: { embedding: number[]; payload: ChatCachePayload; stream: boolean } } | null = null;
    for (const entry of entries) {
      if (entry.stream !== candidate.stream) continue;
      const score = cosine(queryVector, entry.embedding);
      if (!best || score > best.score) {
        best = { score, entry };
      }
    }
    if (!best || best.score < config.semanticThreshold) return null;
    return {
      payload: best.entry.payload,
      cacheKey: candidate.cacheKey,
      hitType: "semantic",
      semanticScore: Number(best.score.toFixed(4)),
    };
  }

  function buildPreview(payload: ChatCachePayload): string {
    if (payload.kind === "json") {
      const choices = (payload.response as { choices?: Array<{ message?: { content?: unknown } }> })
        ?.choices;
      const content = choices?.[0]?.message?.content;
      return typeof content === "string" ? content.slice(0, PREVIEW_LIMIT) : "";
    }
    return payload.chunks
      .map((chunk) => {
        const delta = (chunk as { choices?: Array<{ delta?: { content?: unknown } }> })
          ?.choices?.[0]?.delta?.content;
        return typeof delta === "string" ? delta : "";
      })
      .join("")
      .slice(0, PREVIEW_LIMIT);
  }

  function persist(params: {
    candidate: ChatCacheCandidate;
    tenantIdentity: ChatCacheTenantIdentity | null | undefined;
    payload: ChatCachePayload;
  }): void {
    if (!readConfig().enabled) return;
    if (typeof params.tenantIdentity?.tenantId !== "string" || !params.tenantIdentity.tenantId) return;

    let serializedPayload: string;
    try {
      serializedPayload = stableStringify({ payload: params.payload });
    } catch {
      return;
    }
    if (serializedPayload.length > readConfig().maxPayloadBytes) return;
    if (inspectCacheSafety({ query: serializedPayload }).containsSecret) return;

    try {
      store.writeCacheRecord({
        cacheKey: params.candidate.cacheKey,
        tenantScopeIdentity: params.tenantIdentity,
        requestType: "openai-chat-completions",
        ttlMs: readConfig().ttlMs,
        responsePreviewSource: "chat-completions",
        response: buildPreview(params.payload),
        metadata: { chatHotPath: params.payload },
      });
    } catch {
      // Fail open: a cache write error must not break the chat response.
    }

    // 语义索引（每租户有界）：写回时同步入索引，供近义请求命中。
    if (readConfig().semanticEnabled) {
      try {
        const tenantId = String(params.tenantIdentity.tenantId);
        const entries = semanticIndex.get(tenantId) ?? [];
        entries.push({
          embedding: semanticEmbedding.embedText(params.candidate.semanticSource),
          payload: params.payload,
          stream: params.candidate.stream,
        });
        if (entries.length > SEMANTIC_MAX_ENTRIES_PER_TENANT) {
          entries.splice(0, entries.length - SEMANTIC_MAX_ENTRIES_PER_TENANT);
        }
        semanticIndex.set(tenantId, entries);
      } catch {
        // 语义索引失败不影响主缓存。
      }
    }
  }

  return { readConfig, describeCacheCandidate, lookup, persist };
}

// Module-level default keeps route call sites unchanged; tests replace it via
// setChatResponseCacheIntegrationForTests so they never touch the default
// evidence-backed store.
function createDefaultChatResponseCacheIntegration(): ChatResponseCacheIntegration {
  return createChatResponseCacheIntegration({
    env: process.env as Record<string, string | undefined>,
  });
}

let currentIntegration: ChatResponseCacheIntegration = createDefaultChatResponseCacheIntegration();

export function getChatResponseCacheIntegration(): ChatResponseCacheIntegration {
  return currentIntegration;
}

export function setChatResponseCacheIntegrationForTests(
  integration: ChatResponseCacheIntegration | null,
): void {
  currentIntegration = integration ?? createDefaultChatResponseCacheIntegration();
}
