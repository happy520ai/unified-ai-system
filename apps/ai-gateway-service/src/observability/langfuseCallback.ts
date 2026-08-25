// Langfuse ingestion callback for chat generations.
//
// Opt-in observability export: when LANGFUSE_PUBLIC_KEY and
// LANGFUSE_SECRET_KEY are configured, completed chat requests are exported to
// the Langfuse /api/public/ingestion endpoint as generation events. Every
// path is fail-open: export problems must never affect the chat response.
//
// Data boundary: input/output text is captured by default (truncated); the
// virtual key fingerprint is exported as metadata but never the key itself.
// Set LANGFUSE_CAPTURE_CONTENT=false to export usage/metadata only.

import { createHash, randomUUID } from "node:crypto";
import { fetchWithAgent } from "../http/connectionPool.js";
import { resolveSafeOutboundUrl } from "../security/outboundUrlPolicy.ts";

const DEFAULT_HOST = "https://cloud.langfuse.com";
const FLUSH_INTERVAL_MS = 5_000;
const MAX_QUEUED_EVENTS = 500;
const MAX_BATCH_SIZE = 50;
const MAX_CONTENT_CHARS = 4_000;
const MAX_FETCH_ATTEMPTS = 2;

export interface LangfuseCallbackConfig {
  enabled: boolean;
  host: string;
  captureContent: boolean;
}

interface QueuedEvent {
  id: string;
  timestamp: string;
  body: Record<string, unknown>;
}

export function readLangfuseCallbackConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): LangfuseCallbackConfig {
  const publicKey = typeof env.LANGFUSE_PUBLIC_KEY === "string" && env.LANGFUSE_PUBLIC_KEY.trim();
  const secretKey = typeof env.LANGFUSE_SECRET_KEY === "string" && env.LANGFUSE_SECRET_KEY.trim();
  const host = (env.LANGFUSE_HOST ?? DEFAULT_HOST).replace(/\/+$/, "");
  return {
    enabled: Boolean(publicKey && secretKey),
    host,
    captureContent: env.LANGFUSE_CAPTURE_CONTENT !== "false",
  };
}

export function createLangfuseCallback(options: {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  now?: () => number;
} = {}) {
  const env = options.env ?? {};
  const config = readLangfuseCallbackConfig(env);
  const doFetch = options.fetchImpl ?? null;
  const now = options.now ?? Date.now;

  let queue: QueuedEvent[] = [];
  let flushing = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const authHeader = `Basic ${Buffer.from(
    `${env.LANGFUSE_PUBLIC_KEY ?? ""}:${env.LANGFUSE_SECRET_KEY ?? ""}`,
  ).toString("base64")}`;

  function isEnabled(): boolean {
    return config.enabled;
  }

  function truncate(value: unknown): string | undefined {
    if (!config.captureContent) return undefined;
    if (typeof value !== "string" || !value) return undefined;
    return value.length > MAX_CONTENT_CHARS ? `${value.slice(0, MAX_CONTENT_CHARS)}…` : value;
  }

  function recordChatGeneration(input: {
    requestId?: string;
    route: string;
    model: string;
    provider?: string;
    stream: boolean;
    cacheHit?: boolean;
    virtualKeyFingerprint?: string;
    inputText?: string;
    outputText?: string;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
    latencyMs?: number;
  }): void {
    if (!config.enabled) return;
    try {
      const id = `lg_${createHash("sha256").update(`${input.requestId ?? ""}:${now()}`).digest("hex").slice(0, 24)}`;
      queue.push({
        id,
        timestamp: new Date(now()).toISOString(),
        body: {
          type: "generation-create",
          id,
          traceId: input.requestId ?? id,
          name: input.route,
          timestamp: new Date(now()).toISOString(),
          model: input.model,
          usage: {
            input: input.usage?.inputTokens ?? undefined,
            output: input.usage?.outputTokens ?? undefined,
            total: input.usage?.totalTokens ?? undefined,
            unit: "TOKENS",
          },
          metadata: {
            provider: input.provider ?? null,
            stream: input.stream,
            cacheHit: input.cacheHit === true,
            latencyMs: input.latencyMs ?? null,
            ...(input.virtualKeyFingerprint ? { virtualKeyFingerprint: input.virtualKeyFingerprint } : {}),
            source: "unified-ai-gateway",
          },
          input: truncate(input.inputText),
          output: truncate(input.outputText),
        },
      });
      if (queue.length > MAX_QUEUED_EVENTS) {
        queue.splice(0, queue.length - MAX_QUEUED_EVENTS);
      }
      scheduleFlush();
      if (queue.length >= MAX_BATCH_SIZE) void flush();
    } catch {
      // Export must never break the request path.
    }
  }

  function scheduleFlush(): void {
    if (timer || !config.enabled) return;
    timer = setInterval(() => {
      void flush();
    }, FLUSH_INTERVAL_MS);
    timer.unref?.();
  }

  async function flush(): Promise<void> {
    if (flushing || queue.length === 0) return;
    flushing = true;
    const batch = queue.splice(0, MAX_BATCH_SIZE);
    try {
      const destination = await resolveSafeOutboundUrl(`${config.host}/api/public/ingestion`);
      const payload = JSON.stringify({
        batch,
        metadata: { batchId: randomUUID(), source: "unified-ai-gateway" },
      });
      for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
        try {
          const fetchFn = doFetch
            ? doFetch
            : ((url: string | URL, init?: RequestInit) => fetchWithAgent(url, init)) as typeof fetch;
          const response = await fetchFn(destination.url, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: authHeader,
            },
            body: payload,
          });
          if (response.ok) return;
          // 4xx（除 429）不重试：配置错误不应反复轰炸。
          if (response.status < 500 && response.status !== 429) return;
        } catch {
          // 网络错误重试一次。
        }
      }
    } catch {
      // 目标解析失败等：直接丢弃本批，绝不抛出。
    } finally {
      flushing = false;
      if (queue.length > 0) scheduleFlush();
    }
  }

  async function close(): Promise<void> {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    await flush();
  }

  return {
    isEnabled,
    recordChatGeneration,
    flush,
    close,
    getQueuedEventCount: () => queue.length,
  };
}

// 模块级默认实例：路由代码零改动接线（与 aiMetrics 同模式）。
let defaultCallback: ReturnType<typeof createLangfuseCallback> | null = null;

export function getLangfuseCallback(): ReturnType<typeof createLangfuseCallback> {
  defaultCallback ??= createLangfuseCallback();
  return defaultCallback;
}

export function setLangfuseCallbackForTests(
  callback: ReturnType<typeof createLangfuseCallback> | null,
): void {
  defaultCallback?.close?.().catch(() => {});
  defaultCallback = callback;
}
