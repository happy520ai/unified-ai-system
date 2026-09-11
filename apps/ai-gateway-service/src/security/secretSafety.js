const SECRET_PATTERNS = [
  {
    type: "slack-token",
    regex: /\b(?:xox(?:a|b|p|r|s)-[A-Za-z0-9-]{10,}|xapp-[A-Za-z0-9-]{20,})\b/gi,
    valueFromMatch: (match) => match[0],
  },
  {
    type: "stripe-secret",
    regex: /\b(?:sk_live_|rk_live_|whsec_)[A-Za-z0-9]{16,}\b/gi,
    valueFromMatch: (match) => match[0],
  },
  {
    type: "npm-token",
    regex: /\bnpm_[A-Za-z0-9]{20,}\b/gi,
    valueFromMatch: (match) => match[0],
  },
  {
    type: "mimo-api-key",
    regex: /\btp-[A-Za-z0-9_-]{20,}\b/g,
    valueFromMatch: (match) => match[0],
  },
  {
    type: "nvidia-api-key",
    regex: /\bnvapi-[A-Za-z0-9_-]{12,}\b/g,
    valueFromMatch: (match) => match[0],
  },
  {
    type: "openai-style-api-key",
    regex: /\bsk-[A-Za-z0-9_-]{16,}\b/g,
    valueFromMatch: (match) => match[0],
  },
  {
    type: "gemini-api-key",
    regex: /\bAIza[0-9A-Za-z_-]{20,}\b/g,
    valueFromMatch: (match) => match[0],
  },
  {
    type: "huggingface-token",
    regex: /\bhf_[A-Za-z0-9_-]{16,}\b/g,
    valueFromMatch: (match) => match[0],
  },
  {
    type: "authorization-bearer",
    regex: /\bAuthorization\s*:\s*Bearer\s+([A-Za-z0-9._~+/-]{12,})/gi,
    valueFromMatch: (match) => match[1],
  },
  {
    type: "api-key-env-value",
    regex: /\b([A-Z0-9_]*(?:API_KEY|TOKEN|SECRET)[A-Z0-9_]*)[ \t]*=[ \t]*([^\r\n#"'<>]{8,})/g,
    valueFromMatch: (match) => match[2],
  },
  {
    type: "postgres-credential-url",
    regex: /\bpostgres(?:ql)?:\/\/[^:\s"'<>]+:([^@\s"'<>]+)@[^)\s"'<>]+/gi,
    valueFromMatch: (match) => match[1],
  },
];

const SAFE_PLACEHOLDER_MARKERS = [
  "****",
  "<",
  ">",
  "your-",
  "your_",
  "example",
  "placeholder",
  "dummy",
  "fake",
  "mock",
  "test",
  "phase",
  "provider-confirmation",
  "secret-must-not-persist",
  "should-not-appear",
  "local-fake",
  "not-a-real",
  "redacted",
  "[redacted]",
];

// External publication is stricter than diagnostic redaction. These patterns
// intentionally do not use the substring-based SAFE_PLACEHOLDER_MARKERS above:
// a real credential may randomly contain words such as "test" or "example".
const PUBLICATION_SECRET_PATTERNS = [
  { regex: /\b(?:xox(?:a|b|p|r|s)-[A-Za-z0-9-]{10,}|xapp-[A-Za-z0-9-]{20,})\b/gi, secretGroup: 0 },
  { regex: /\b(?:sk_live_|rk_live_|whsec_)[A-Za-z0-9]{16,}\b/gi, secretGroup: 0 },
  { regex: /\bnpm_[A-Za-z0-9]{20,}\b/gi, secretGroup: 0 },
  { regex: /\btp-[A-Za-z0-9_-]{20,}\b/g, secretGroup: 0 },
  { regex: /\bnvapi-[A-Za-z0-9_-]{12,}\b/g, secretGroup: 0 },
  { regex: /\bsk-[A-Za-z0-9_-]{16,}\b/g, secretGroup: 0 },
  { regex: /\bAIza[0-9A-Za-z_-]{20,}\b/g, secretGroup: 0 },
  { regex: /\bhf_[A-Za-z0-9_-]{16,}\b/g, secretGroup: 0 },
  { regex: /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}\b/gi, secretGroup: 0 },
  { regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/gi, secretGroup: 0 },
  { regex: /\bglpat-[A-Za-z0-9_-]{20,}\b/gi, secretGroup: 0 },
  { regex: /\b(?:AKIA|ASIA|AIDA|AROA|AIPA|ANPA|ANVA|ASCA)[A-Z0-9]{16}\b/g, secretGroup: 0 },
  { regex: /\bAuthorization\s*:\s*(?:Bearer|Basic)\s+([A-Za-z0-9._~+/=-]{8,})/gi, secretGroup: 1 },
  {
    regex: /\b(?:[A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PRIVATE[_-]?KEY|ACCESS[_-]?KEY)[A-Z0-9_]*)\s*[:=]\s*["']?([^\s"'<>#,;]{4,})/gi,
    secretGroup: 1,
  },
  { regex: /\bAWS_SECRET_ACCESS_KEY\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})/gi, secretGroup: 1 },
  { regex: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:([^\s/@]+)@[^\s/]+/gi, secretGroup: 1 },
  {
    regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/gi,
    secretGroup: 0,
  },
];

export function cleanSecretValue(value) {
  let text = String(value ?? "").trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

export function maskSecret(value) {
  const clean = cleanSecretValue(value);
  if (!clean) return "";
  if (clean.length <= 8) {
    return `${clean.slice(0, 2)}****${clean.slice(-2)}`;
  }
  const prefixLength = Math.min(8, clean.length - 4);
  return `${clean.slice(0, prefixLength)}****${clean.slice(-4)}`;
}

export function isLikelyMaskedSecret(value) {
  return /\*{3,}/.test(cleanSecretValue(value));
}

export function isSafePlaceholderSecret(value) {
  const text = cleanSecretValue(value).toLowerCase();
  if (!text) return true;
  if (isRepeatedPlaceholder(text)) return true;
  return SAFE_PLACEHOLDER_MARKERS.some((marker) => text.includes(marker));
}

export function redactSecretsInText(text) {
  let redacted = String(text ?? "");
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern.regex, (...args) => {
      const match = args.slice(0, -2);
      const value = pattern.valueFromMatch(match);
      if (!value || isSafePlaceholderSecret(value)) {
        return match[0];
      }
      return match[0].replace(value, maskSecret(value));
    });
  }
  return redacted;
}

/**
 * Fail-closed check for text that will be sent to a public external system.
 * Placeholder exceptions are accepted only when the entire candidate is one
 * explicit fixture marker; substring collisions never suppress a finding.
 */
export function containsSensitivePublicationText(text) {
  const source = String(text ?? "");
  for (const pattern of PUBLICATION_SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(source)) !== null) {
      const candidate = String(match[pattern.secretGroup] ?? match[0]).trim();
      if (!isExplicitFixtureSecret(candidate)) return true;
      if (match[0].length === 0) pattern.regex.lastIndex += 1;
    }
  }
  return false;
}

export function isSafePublicObjectKey(value) {
  const key = String(value ?? "");
  return key.length > 0
    && key.length <= 256
    && !/[\u0000-\u001f\u007f]/u.test(key)
    && !new Set(["__proto__", "prototype", "constructor", "tojson"]).has(key.toLowerCase())
    && !containsSensitivePublicationText(key);
}

function isExplicitFixtureSecret(value) {
  const candidate = cleanSecretValue(value);
  return /^(?:\*{4,}|redacted|placeholder|none|null|<\s*(?:redacted|placeholder|secret|token|api[_-]?key)\s*>|\[\s*(?:redacted|placeholder|secret|token|api[_-]?key)\s*\]|(?:your|example|test|dummy|fake|mock|not[_-]?a[_-]?real)[_-](?:api[_-]?key|access[_-]?key|private[_-]?key|token|secret|password)(?:[_-](?:here|value))?)$/iu.test(candidate);
}

export function findPlainSecretFindings(text, filePath = "") {
  const findings = [];
  const source = String(text ?? "");
  for (const pattern of SECRET_PATTERNS) {
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(source)) !== null) {
      const value = pattern.valueFromMatch(match);
      if (!value || isSafePlaceholderSecret(value)) {
        continue;
      }
      if (isIntentionalSecurityTestFixture(source, match.index, filePath)) {
        continue;
      }
      if (
        pattern.type === "api-key-env-value" &&
        (isSourceCodePath(filePath) || isSafeCodeExpressionValue(value))
      ) {
        continue;
      }
      findings.push({
        filePath,
        line: countLinesBefore(source, match.index) + 1,
        type: pattern.type,
        maskedValue: maskSecret(value),
      });
    }
  }
  return findings;
}

export function containsPlainSecret(text) {
  return findPlainSecretFindings(text).length > 0;
}

function countLinesBefore(text, index) {
  let count = 0;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (text.charCodeAt(cursor) === 10) {
      count += 1;
    }
  }
  return count;
}

function isRepeatedPlaceholder(text) {
  const withoutPrefix = text.replace(/^(sk-|nvapi-|hf_|aiza)/, "");
  return withoutPrefix.length >= 16 && /^([a-z0-9])\1+$/i.test(withoutPrefix);
}

function isSafeCodeExpressionValue(value) {
  const text = cleanSecretValue(value);
  return /^(?:Object|Array|String|Number|Boolean|Math|Date|JSON|RegExp|Promise|Map|Set|WeakMap|WeakSet)\s*\./.test(text);
}

function isSourceCodePath(filePath) {
  return /\.[cm]?[jt]sx?$/i.test(String(filePath ?? ""));
}

function isIntentionalSecurityTestFixture(source, index, filePath) {
  if (!/\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(String(filePath ?? ""))) {
    return false;
  }
  const lineStart = source.lastIndexOf("\n", index - 1) + 1;
  const lineEnd = source.indexOf("\n", index);
  const line = source.slice(lineStart, lineEnd < 0 ? source.length : lineEnd);
  return /RAW_KEY_PATTERN\.test\s*\(|sanitizeValue\s*\(|\bexpected\s*:\s*true\b/.test(line);
}
