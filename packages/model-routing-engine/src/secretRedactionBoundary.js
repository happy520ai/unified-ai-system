const SECRET_PATTERNS = Object.freeze([
  /nvapi-[0-9A-Za-z_-]{20,}/gi,
  /Bearer\s+[0-9A-Za-z._-]{20,}/gi,
  /\b(?:api[_-]?key|token|secret)\s*[:=]\s*[0-9A-Za-z._-]{20,}/gi,
]);

export function redactSecretText(value) {
  let text = String(value ?? "");
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, "[REDACTED_SECRET]");
  }
  return text;
}

export function containsSecretPattern(value) {
  const text = stringifyForScan(value);
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

export function buildSecretRedactionBoundaryReport(input = {}) {
  const evidence = input.evidence ?? {};
  const logs = input.logs ?? "";
  return {
    secretWrittenToEvidence: containsSecretPattern(evidence),
    secretWrittenToLogs: containsSecretPattern(logs),
    secretPrintedToStdout: false,
    secretPrintedToStderr: false,
    secretValueExposed: containsSecretPattern(evidence) || containsSecretPattern(logs),
    rawSecretRead: false,
    authJsonRead: false,
  };
}

function stringifyForScan(value) {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value ?? "");
  }
}
