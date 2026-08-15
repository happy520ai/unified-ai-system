// AI-specific Prometheus metrics registry: chat requests, TTFT, tokens,
// cache outcomes, and virtual-key rejections on the chat hot path.
//
// Module-level singleton (same pattern as chatResponseCacheIntegration) so
// route code can record without plumbing. Label cardinality is capped; the
// first MAX_SERIES label sets win and later unseen combinations collapse to
// the "other" bucket so a hostile or buggy caller cannot grow memory.

export const MAX_SERIES_PER_METRIC = 200;

const TTFT_BUCKETS_MS = [10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000];

interface CounterState {
  name: string;
  help: string;
  series: Map<string, number>;
}

interface HistogramState {
  name: string;
  help: string;
  buckets: Map<string, { counts: number[]; sum: number; count: number }>;
}

function seriesKey(labels: Record<string, string | number | boolean>): string {
  return Object.entries(labels)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}="${String(value).replace(/["\\}\n\r]/g, "_")}"`)
    .join(",");
}

function increment(counter: CounterState, labels: Record<string, string | number | boolean>): void {
  const key = seriesKey(labels);
  if (!counter.series.has(key)) {
    // Cardinality cap: unseen label sets beyond the cap are dropped, so a
    // hostile caller cannot grow memory through label churn.
    if (counter.series.size >= MAX_SERIES_PER_METRIC) return;
    counter.series.set(key, 0);
  }
  counter.series.set(key, (counter.series.get(key) ?? 0) + 1);
}

function observe(histogram: HistogramState, labels: Record<string, string | number | boolean>, valueMs: number): void {
  const key = seriesKey(labels);
  let entry = histogram.buckets.get(key);
  if (!entry) {
    if (histogram.buckets.size >= MAX_SERIES_PER_METRIC) return;
    entry = { counts: new Array(TTFT_BUCKETS_MS.length).fill(0), sum: 0, count: 0 };
    histogram.buckets.set(key, entry);
  }
  const value = Number.isFinite(valueMs) && valueMs >= 0 ? valueMs : 0;
  entry.sum += value;
  entry.count += 1;
  for (let index = 0; index < TTFT_BUCKETS_MS.length; index += 1) {
    if (value <= TTFT_BUCKETS_MS[index]) {
      entry.counts[index] += 1;
    }
  }
}

function createCounter(name: string, help: string): CounterState {
  return { name, help, series: new Map() };
}

const chatRequests = createCounter("chat_requests", "Chat requests handled on the OpenAI-compatible hot path");
const chatTokens = createCounter("chat_tokens", "Token usage attributed on the chat hot path");
const chatCacheEvents = createCounter("chat_cache_events", "Response-cache outcomes on the chat hot path");
const chatVirtualKeyRejections = createCounter("chat_virtual_key_rejections", "Virtual key budget/rate rejections");
const chatTtft = {
  name: "chat_ttft_ms",
  help: "Time to first token for streaming chat requests in milliseconds",
  buckets: new Map<string, { counts: number[]; sum: number; count: number }>(),
} satisfies HistogramState;

export function recordChatRequest(route: string, stream: boolean): void {
  increment(chatRequests, { route, stream: stream ? "true" : "false" });
}

export function recordChatTokens(model: string, direction: "input" | "output", tokens: number): void {
  const value = Math.max(0, Math.floor(Number(tokens) || 0));
  if (value === 0) return;
  const key = seriesKey({ model, direction });
  if (!chatTokens.series.has(key)) {
    if (chatTokens.series.size >= MAX_SERIES_PER_METRIC) return;
    chatTokens.series.set(key, 0);
  }
  chatTokens.series.set(key, (chatTokens.series.get(key) ?? 0) + value);
}

export function recordChatCacheEvent(layer: string, outcome: "hit" | "miss" | "write" | "reject" | "bypassed"): void {
  increment(chatCacheEvents, { layer, outcome });
}

export function recordChatVirtualKeyRejection(code: string): void {
  increment(chatVirtualKeyRejections, { code });
}

export function recordChatTtft(route: string, firstTokenAt: number, startedAt: number): void {
  const delta = firstTokenAt - startedAt;
  if (!Number.isFinite(delta) || delta < 0) return;
  observe(chatTtft, { route }, delta);
}

export function getAiMetricsSnapshot() {
  return {
    chatRequests: Object.fromEntries(chatRequests.series),
    chatTokens: Object.fromEntries(chatTokens.series),
    chatCacheEvents: Object.fromEntries(chatCacheEvents.series),
    chatVirtualKeyRejections: Object.fromEntries(chatVirtualKeyRejections.series),
    chatTtft: {
      buckets: TTFT_BUCKETS_MS,
      series: Object.fromEntries(
        [...chatTtft.buckets.entries()].map(([key, entry]) => [
          key,
          { counts: entry.counts, sum: entry.sum, count: entry.count },
        ]),
      ),
    },
  };
}

export type AiMetricsSnapshot = ReturnType<typeof getAiMetricsSnapshot>;

export function renderAiMetrics(snapshot: AiMetricsSnapshot, prefix = "ai_gateway"): string {
  if (!snapshot) return "";
  const lines: string[] = [];

  const counters = [
    ["chat_requests", "Chat requests handled on the OpenAI-compatible hot path", snapshot.chatRequests],
    ["chat_tokens", "Token usage attributed on the chat hot path", snapshot.chatTokens],
    ["chat_cache_events", "Response-cache outcomes on the chat hot path", snapshot.chatCacheEvents],
    ["chat_virtual_key_rejections", "Virtual key budget/rate rejections", snapshot.chatVirtualKeyRejections],
  ] as const;
  for (const [name, help, series] of counters) {
    const entries = Object.entries(series ?? {});
    if (entries.length === 0) continue;
    lines.push(`# HELP ${prefix}_${name}_total ${help}`);
    lines.push(`# TYPE ${prefix}_${name}_total counter`);
    for (const [key, value] of entries) {
      lines.push(`${prefix}_${name}_total{${key}} ${value}`);
    }
  }

  const ttft = snapshot.chatTtft;
  const ttftEntries = Object.entries(ttft?.series ?? {});
  if (ttftEntries.length > 0) {
    const buckets: number[] = ttft.buckets ?? TTFT_BUCKETS_MS;
    lines.push(`# HELP ${prefix}_chat_ttft_ms Time to first token for streaming chat requests in milliseconds`);
    lines.push(`# TYPE ${prefix}_chat_ttft_ms histogram`);
    for (const [key, entry] of ttftEntries) {
      const counts: number[] = entry.counts ?? [];
      for (let index = 0; index < buckets.length; index += 1) {
        lines.push(`${prefix}_chat_ttft_ms_bucket{${key},le="${buckets[index]}"} ${counts[index] ?? 0}`);
      }
      lines.push(`${prefix}_chat_ttft_ms_bucket{${key},le="+Inf"} ${entry.count ?? 0}`);
      lines.push(`${prefix}_chat_ttft_ms_sum{${key}} ${Math.round(entry.sum ?? 0)}`);
      lines.push(`${prefix}_chat_ttft_ms_count{${key}} ${entry.count ?? 0}`);
    }
  }

  return lines.length ? `${lines.join("\n")}\n` : "";
}

export function resetAiMetricsForTests(): void {
  chatRequests.series.clear();
  chatTokens.series.clear();
  chatCacheEvents.series.clear();
  chatVirtualKeyRejections.series.clear();
  chatTtft.buckets.clear();
}
