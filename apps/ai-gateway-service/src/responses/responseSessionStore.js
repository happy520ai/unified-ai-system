import { randomUUID } from "node:crypto";

// Response sessions power previous_response_id chaining on the OpenAI
// Responses compatibility surface. Only normalized message text is stored —
// never credentials, raw provider payloads, or file contents.

export const DEFAULT_RESPONSE_SESSION_TTL_MS = 30 * 60 * 1000;
export const DEFAULT_RESPONSE_SESSION_MAX_ENTRIES = 256;
export const MAX_SESSION_CONTEXT_MESSAGES = 200;
export const MAX_SESSION_MESSAGE_CHARS = 200_000;

const RESPONSE_ID_PATTERN = /^resp_[A-Za-z0-9_-]{1,64}$/;

export function isResponseId(value) {
  return typeof value === "string" && RESPONSE_ID_PATTERN.test(value);
}

function readNonNegativeInteger(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(
      `AI_GATEWAY response session configuration must be a non-negative integer, received: ${value}`,
    );
  }
  return parsed;
}

function capContextMessages(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const systemMessages = list.filter((message) => message?.role === "system");
  const tail = list.filter((message) => message?.role !== "system").slice(-MAX_SESSION_CONTEXT_MESSAGES);
  const capped = [...systemMessages, ...tail];
  let totalChars = 0;
  for (const message of capped) {
    totalChars += typeof message?.content === "string" ? message.content.length : 0;
  }
  while (totalChars > MAX_SESSION_MESSAGE_CHARS && capped.length > systemMessages.length + 1) {
    // Drop the oldest non-system message first; system instructions stay pinned.
    let dropIndex = capped.findIndex((message) => message.role !== "system");
    if (dropIndex === -1) break;
    const [dropped] = capped.splice(dropIndex, 1);
    totalChars -= typeof dropped?.content === "string" ? dropped.content.length : 0;
  }
  return capped;
}

export function createResponseSessionStore({
  env = {},
  ttlMs,
  maxEntries,
  now = () => Date.now(),
} = {}) {
  const resolvedTtlMs = readNonNegativeInteger(
    ttlMs ?? env.AI_GATEWAY_RESPONSE_SESSION_TTL_MS,
    DEFAULT_RESPONSE_SESSION_TTL_MS,
  );
  const resolvedMaxEntries = readNonNegativeInteger(
    maxEntries ?? env.AI_GATEWAY_RESPONSE_SESSION_MAX_ENTRIES,
    DEFAULT_RESPONSE_SESSION_MAX_ENTRIES,
  );
  const sessions = new Map();
  // Monotonic counter for LRU ordering: wall-clock granularity cannot
  // distinguish consecutive accesses under a coarse clock.
  let accessCounter = 0;

  function isExpired(record) {
    return resolvedTtlMs > 0 && now() - record.lastAccessedAt > resolvedTtlMs;
  }

  function purgeExpired() {
    for (const [responseId, record] of sessions) {
      if (isExpired(record)) sessions.delete(responseId);
    }
  }

  function evictForEntry() {
    purgeExpired();
    while (sessions.size >= resolvedMaxEntries) {
      let oldestId = null;
      let oldestAccess = Infinity;
      for (const [responseId, record] of sessions) {
        if (record.accessOrder < oldestAccess) {
          oldestAccess = record.accessOrder;
          oldestId = responseId;
        }
      }
      if (oldestId === null) break;
      sessions.delete(oldestId);
    }
  }

  return {
    enabled: resolvedTtlMs > 0,
    ttlMs: resolvedTtlMs,
    maxEntries: resolvedMaxEntries,

    set(record) {
      if (!record || typeof record !== "object") {
        throw new Error("Response session record must be an object.");
      }
      const responseId = record.responseId ?? `resp_${randomUUID().replace(/-/g, "")}`;
      if (!isResponseId(responseId)) {
        throw new Error("Response session responseId must match the resp_* format.");
      }
      evictForEntry();
      const timestamp = now();
      accessCounter += 1;
      sessions.set(responseId, {
        responseId,
        instructions: typeof record.instructions === "string" ? record.instructions : null,
        contextMessages: capContextMessages(record.contextMessages),
        assistantOutput: typeof record.assistantOutput === "string" ? record.assistantOutput : "",
        model: typeof record.model === "string" ? record.model : null,
        providerId: typeof record.providerId === "string" ? record.providerId : null,
        reasoningEffort: typeof record.reasoningEffort === "string" ? record.reasoningEffort : null,
        reasoningSummary: typeof record.reasoningSummary === "string" ? record.reasoningSummary : null,
        responseBody: record.responseBody && typeof record.responseBody === "object"
          ? record.responseBody
          : null,
        createdAt: timestamp,
        lastAccessedAt: timestamp,
        accessOrder: accessCounter,
      });
      return { responseId, stored: true };
    },

    get(responseId) {
      if (!isResponseId(responseId)) return null;
      const record = sessions.get(responseId);
      if (!record) return null;
      if (isExpired(record)) {
        sessions.delete(responseId);
        return null;
      }
      record.lastAccessedAt = now();
      accessCounter += 1;
      record.accessOrder = accessCounter;
      return {
        responseId: record.responseId,
        instructions: record.instructions,
        contextMessages: record.contextMessages.map((message) => ({ ...message })),
        assistantOutput: record.assistantOutput,
        model: record.model,
        providerId: record.providerId,
        reasoningEffort: record.reasoningEffort,
        reasoningSummary: record.reasoningSummary,
        responseBody: record.responseBody,
        createdAt: record.createdAt,
        lastAccessedAt: record.lastAccessedAt,
      };
    },

    delete(responseId) {
      return sessions.delete(responseId);
    },

    size() {
      purgeExpired();
      return sessions.size;
    },

    describeHealth() {
      return {
        enabled: resolvedTtlMs > 0,
        ttlMs: resolvedTtlMs,
        maxEntries: resolvedMaxEntries,
        entryCount: sessions.size,
        storage: "memory-only",
      };
    },
  };
}
