const SECRET_PATTERNS = [
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
      if (pattern.type === "api-key-env-value" && isSafeCodeExpressionValue(value)) {
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
