export const CODEX_CONTEXT_GATEWAY_BOUNDARY = Object.freeze({
  providerCallsMade: false,
  rawSecretAccessed: false,
  secretValueExposed: false,
  rawWebhookAccessed: false,
  webhookValueExposed: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  codexBaseUrlModified: false,
  codexConfigModified: false,
  mainGatewayRuntimeModified: false,
  codexRunnerExecuted: false,
  workspaceCleanClaimed: false,
});

const forbiddenPathPatterns = [
  /^legacy(?:\/|$)/i,
  /^PROJECT_CONTEXT\.md$/i,
  /^\.env(?:\.|$)/i,
  /^\.git(?:\/|$)/i,
  /^node_modules(?:\/|$)/i,
];

const secretValuePatterns = [
  /(api[_-]?key|secret|token|credential)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{12,}/i,
  /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
  /https:\/\/[^\s"'`]*webhook[^\s"'`]*/i,
];

export function isForbiddenPath(relativePath) {
  const normalized = String(relativePath || "").replaceAll("\\", "/");
  return forbiddenPathPatterns.some((pattern) => pattern.test(normalized));
}

export function isSensitivePath(relativePath) {
  const normalized = String(relativePath || "").replaceAll("\\", "/");
  return /^\.env(?:\.|$)/i.test(normalized) || /secret|credential|token|webhook/i.test(normalized);
}

export function sanitizeText(value) {
  return String(value || "")
    .replace(/(api[_-]?key|secret|token|credential)(\s*[:=]\s*)['"]?[^,\s"']+/gi, "$1$2[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/https:\/\/[^\s"'`]*webhook[^\s"'`]*/gi, "[WEBHOOK_REDACTED]");
}

export function sanitizePath(relativePath) {
  const normalized = String(relativePath || "").replaceAll("\\", "/");
  if (isSensitivePath(normalized)) return "[sensitive-path-redacted]";
  return normalized;
}

export function scanGeneratedOutputForSecrets(outputs) {
  const text = Array.isArray(outputs) ? outputs.join("\n") : String(outputs || "");
  const secretValueExposed = secretValuePatterns.some((pattern) => pattern.test(text));
  const webhookValueExposed = /https:\/\/[^\s"'`]*webhook[^\s"'`]*/i.test(text);
  return {
    completed: true,
    rawSecretAccessed: false,
    rawWebhookAccessed: false,
    secretValueExposed,
    webhookValueExposed,
    providerCallsMade: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    codexBaseUrlModified: false,
    codexConfigModified: false,
    mainGatewayRuntimeModified: false,
  };
}

export function buildSafetyBoundaryReport(extra = {}) {
  return {
    ...CODEX_CONTEXT_GATEWAY_BOUNDARY,
    ...extra,
  };
}
