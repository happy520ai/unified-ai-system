export const SECRET_REDACTION = "[REDACTED_SECRET]";

const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{8,}\b/g,
  /\b(api[_-]?key|token|secret|webhook)\s*[:=]\s*["']?[^"'\s,;}]+/gi,
  /\b(base[_-]?url)\s*[:=]\s*["']?https?:\/\/[^"'\s,;}]+/gi,
];

export function maskSecretLikeText(value) {
  const text = String(value ?? "");
  return SECRET_PATTERNS.reduce((current, pattern) => {
    pattern.lastIndex = 0;
    return current.replace(pattern, (match) => {
      const label = match.split(/[:=]/)[0]?.trim();
      return label && /api|token|secret|webhook|base/i.test(label)
        ? `${label}=${SECRET_REDACTION}`
        : SECRET_REDACTION;
    });
  }, text);
}

export function containsSecretLikeValue(value) {
  const text = String(value ?? "");
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

export function guardSecretLikeValues(value) {
  let secretLikeRejected = false;

  function walk(item) {
    if (Array.isArray(item)) {
      return item.map((entry) => walk(entry));
    }
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, walk(entry)]));
    }
    if (typeof item === "string") {
      if (containsSecretLikeValue(item)) {
        secretLikeRejected = true;
      }
      return maskSecretLikeText(item);
    }
    return item;
  }

  return {
    value: walk(value),
    secretLikeRejected,
  };
}

export function hasExposedSecretLikeValue(value) {
  const text = String(value ?? "")
    .replace(
      /\b(api[_-]?key|token|secret|webhook|base[_-]?url)\s*=\[REDACTED_SECRET\]/gi,
      "$1_redacted",
    )
    .replace(/\bsecret:\s*no-read\b/gi, "secret_boundary_no_read")
    .replace(/\bprovider:\s*no-call\b/gi, "provider_boundary_no_call");
  return containsSecretLikeValue(text);
}
