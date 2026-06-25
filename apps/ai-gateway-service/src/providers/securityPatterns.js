/**
 * Shared Security Patterns — Single source of truth for credential detection.
 *
 * The RAW_KEY_PATTERN regex detects raw API keys, bearer tokens, and other
 * credential shapes that must NEVER appear in logs, evidence, or API responses.
 *
 * All provider security modules MUST import from here to avoid regex drift.
 *
 * @module securityPatterns
 */

/**
 * Detects raw credential / API-key shapes in a string.
 *
 * Matched shapes:
 * - `sk-*` (OpenAI, Anthropic, generic) — 20+ chars after prefix
 * - `nvapi-*` (NVIDIA) — 16+ chars after prefix
 * - `AKIA*` (AWS access key) — exactly 16 uppercase alphanum after prefix
 * - `xox[baprs]-*` (Slack tokens)
 * - `ghp_*` (GitHub PAT) — 20+ chars after prefix
 * - `api_key` / `api-key` (generic config leak)
 * - `bearer <token>` — 16+ char token
 * - `-----BEGIN` (PEM private key header)
 */
const RAW_KEY_PATTERN =
  /(sk-[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|xox[baprs]-|ghp_[A-Za-z0-9_]{20,}|api[_-]?key|bearer\s+[a-z0-9._-]{16,}|-----BEGIN)/i;

/** Global-flag variant for replace-all redaction in redactSensitive() */
const RAW_KEY_PATTERN_GLOBAL =
  /(sk-[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|xox[baprs]-|ghp_[A-Za-z0-9_]{20,}|api[_-]?key|bearer\s+[a-z0-9._-]{16,}|-----BEGIN)/gi;

/**
 * Redact any credential-shaped substring with "[redacted]".
 *
 * @param {string|undefined|null} value - The value to redact.
 * @param {number} [maxLength=300] - Truncate output to this length.
 * @returns {string}
 */
export function redactSensitive(value, maxLength = 300) {
  return String(value ?? "").replace(RAW_KEY_PATTERN_GLOBAL, "[redacted]").slice(0, maxLength);
}

/**
 * Test whether a string contains a raw credential shape.
 *
 * @param {string|undefined|null} value
 * @returns {boolean}
 */
export function containsRawKey(value) {
  if (!value) return false;
  return RAW_KEY_PATTERN.test(String(value));
}

export { RAW_KEY_PATTERN };
