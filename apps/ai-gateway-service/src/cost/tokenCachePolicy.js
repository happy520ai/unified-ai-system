import { createHash } from "node:crypto";

export const TOKEN_GUARD_VERSION = "phase-268a-preview-v1";
export const DEFAULT_SYSTEM_PROMPT_VERSION = "system-prompt-preview-v1";

export function createTokenCachePolicy(input = {}) {
  const requestType = normalizeSegment(input.requestType ?? "chat-preview");
  const userQuery = normalizeQuery(input.userQuery ?? extractUserQuery(input.messages) ?? input.rawContextText ?? "");
  const selectedSourcesHash = hashStable(input.selectedSources ?? []);
  const model = normalizeSegment(input.model ?? "default-model");
  const systemPromptVersion = normalizeSegment(input.systemPromptVersion ?? DEFAULT_SYSTEM_PROMPT_VERSION);
  const guardVersion = normalizeSegment(input.guardVersion ?? TOKEN_GUARD_VERSION);
  const cacheEligible = userQuery.length >= 4 && !input.disableCache;

  const rawKey = JSON.stringify({
    requestType,
    userQuery,
    selectedSourcesHash,
    model,
    systemPromptVersion,
    guardVersion,
  });

  return {
    cacheKey: `token-guard:${guardVersion}:${sha256(rawKey).slice(0, 32)}`,
    cacheEligible,
    reason: cacheEligible ? "eligible-preview-key-only-no-response-cache" : "ineligible-empty-or-disabled-preview",
    keyParts: {
      requestType,
      normalizedUserQuery: userQuery,
      selectedSourcesHash,
      model,
      systemPromptVersion,
      guardVersion,
    },
  };
}

function extractUserQuery(messages) {
  if (!Array.isArray(messages)) return "";

  const lastUserMessage = [...messages].reverse().find((message) => {
    return message?.role !== "assistant" && typeof message?.content === "string";
  });

  return lastUserMessage?.content ?? "";
}

function normalizeQuery(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 2048);
}

function normalizeSegment(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "unknown";
}

function hashStable(value) {
  return sha256(stableStringify(value)).slice(0, 24);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}
