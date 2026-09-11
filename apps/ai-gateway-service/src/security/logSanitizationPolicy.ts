import { isSafePublicObjectKey } from "./secretSafety.js";

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 6;
const MAX_COLLECTION_ITEMS = 100;
const MAX_STRING_LENGTH = 8192;

const SENSITIVE_KEY = /(?:^|[_-])(?:authorization|proxy[_-]?authorization|cookie|set[_-]?cookie|api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|token|password|passwd|secret|secret[_-]?value|client[_-]?secret|private[_-]?key|credential|master[_-]?key)(?:$|[_-])/i;

const SECRET_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer " + REDACTED],
  [/\b(?:sk|rk|pk|xoxb|xoxp|xoxa|xoxr)-[A-Za-z0-9_-]{8,}\b/g, REDACTED],
  [/\bAKIA[A-Z0-9]{16}\b/g, REDACTED],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, REDACTED],
  [
    /([?&](?:api[_-]?key|access[_-]?token|token|password|secret|credential)=)[^&\s#]+/gi,
    "$1" + REDACTED,
  ],
];

export function sanitizeLogText(value: unknown, maxLength = MAX_STRING_LENGTH): string {
  let text = String(value ?? "");
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  if (text.length > maxLength) {
    return text.slice(0, maxLength) + "...[truncated]";
  }
  return text;
}

export function sanitizeLogValue(value: unknown): unknown {
  return sanitizeValue(value, 0, new WeakSet<object>());
}

export function summarizeErrorForLog(error: unknown): {
  name: string;
  code?: string;
  category?: string;
} {
  if (!error || typeof error !== "object") {
    return { name: "Error" };
  }
  const candidate = error as Record<string, unknown>;
  const name = readOwnDataProperty(candidate, "name");
  const code = readOwnDataProperty(candidate, "code");
  const category = readOwnDataProperty(candidate, "category");
  return {
    name: sanitizeLogText(typeof name === "string" && name ? name : "Error", 128),
    ...(typeof code === "string"
      ? { code: sanitizeLogText(code, 128) }
      : {}),
    ...(typeof category === "string"
      ? { category: sanitizeLogText(category, 128) }
      : {}),
  };
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string" || typeof value === "bigint" || typeof value === "symbol") {
    return sanitizeLogText(value);
  }
  if (typeof value === "function") {
    return "[function]";
  }
  if (Buffer.isBuffer(value)) {
    return "[buffer:" + value.length + " bytes]";
  }
  if (value instanceof Date) {
    try {
      return Date.prototype.toISOString.call(value);
    } catch {
      return "[invalid-date]";
    }
  }
  if (value instanceof Error) {
    const message = readOwnDataProperty(value as unknown as Record<string, unknown>, "message");
    return {
      ...summarizeErrorForLog(value),
      message: sanitizeLogText(typeof message === "string" ? message : ""),
    };
  }
  if (depth >= MAX_DEPTH) {
    return "[max-depth]";
  }
  if (typeof value !== "object") {
    return sanitizeLogText(value);
  }
  if (seen.has(value)) {
    return "[circular]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_COLLECTION_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1, seen));
    if (value.length > MAX_COLLECTION_ITEMS) {
      items.push("[truncated-items]");
    }
    return items;
  }

  const output = Object.create(null) as Record<string, unknown>;
  const keys = Object.keys(value);
  let redactedKeyIndex = 0;
  for (const key of keys.slice(0, MAX_COLLECTION_ITEMS)) {
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (!property || !("value" in property) || !isSafePublicObjectKey(key)) {
      defineSafeProperty(output, `[redacted-key-${redactedKeyIndex}]`, REDACTED);
      redactedKeyIndex += 1;
      continue;
    }
    defineSafeProperty(
      output,
      key,
      SENSITIVE_KEY.test(key) ? REDACTED : sanitizeValue(property.value, depth + 1, seen),
    );
  }
  if (keys.length > MAX_COLLECTION_ITEMS) {
    defineSafeProperty(output, "__truncated__", true);
  }
  return output;
}

function readOwnDataProperty(value: Record<string, unknown>, key: string): unknown {
  const property = Object.getOwnPropertyDescriptor(value, key);
  return property && "value" in property ? property.value : undefined;
}

function defineSafeProperty(output: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(output, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}
