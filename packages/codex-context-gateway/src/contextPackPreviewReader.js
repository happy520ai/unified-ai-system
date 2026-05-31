import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRepoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const contextDir = ".codex-context";
const sensitiveValuePattern =
  /(sk-[A-Za-z0-9_-]{16,}|nvapi-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._~+/=-]{12,}|AIza[0-9A-Za-z_-]{16,}|https:\/\/hooks\.[^\s"']+|https:\/\/[^/\s"']*webhook[^\s"']*)/i;
const sensitivePathPattern = /(^|[/\\])(\.env|\.npmrc|\.netrc|id_rsa|id_ed25519)(\.|$|[/\\])/i;

export function readContextPackPreview(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const markdown = readTextFile(repoRoot, `${contextDir}/current-context-pack.md`);
  const jsonFile = readJsonFile(repoRoot, `${contextDir}/current-context-pack.json`);
  const contextPack = jsonFile.data || {};
  const preview = {
    completed: markdown.exists && jsonFile.exists && jsonFile.valid,
    contextPackMdReadable: markdown.exists,
    contextPackJsonReadable: jsonFile.exists && jsonFile.valid,
    contextHash: sanitizeText(contextPack.hash || ""),
    contextHashVisible: isHash(contextPack.hash),
    generatedAt: sanitizeText(contextPack.generatedAt || ""),
    taskSummary: sanitizeText(contextPack.task || ""),
    phaseSummary: buildPhaseSummary(contextPack),
    phaseSummaryVisible: Boolean(contextPack.projectState || contextPack.phaseEvidence),
    safetyBoundary: sanitizeValue(contextPack.safetyBoundary || {}),
    safetyBoundaryVisible: Boolean(contextPack.safetyBoundary),
    markdownPreview: sanitizeText(markdown.text || "").slice(0, 1800),
    gatewayType: sanitizeText(contextPack.gatewayType || "codex-context-gateway"),
    providerCalled: contextPack.providerCalled === true,
    codexBaseUrlConnected: contextPack.codexBaseUrlConnected === true,
    rawSecretExposed: false,
    webhookValueExposed: false,
    errors: [...markdown.errors, ...jsonFile.errors],
  };
  const serialized = JSON.stringify(preview);
  preview.rawSecretExposed = sensitiveValuePattern.test(serialized);
  preview.webhookValueExposed = /https:\/\/[^"\s]*webhook|https:\/\/hooks\./i.test(serialized);
  return preview;
}

export function readTextFile(repoRoot, relativePath) {
  const safePath = safeRelativePath(relativePath);
  const absolutePath = resolve(repoRoot, safePath);
  if (!existsSync(absolutePath)) {
    return { exists: false, text: "", errors: [`missing:${safePath}`] };
  }
  try {
    const text = readFileSync(absolutePath, "utf8");
    return { exists: true, text: sanitizeText(text), errors: [] };
  } catch (error) {
    return { exists: true, text: "", errors: [`read-error:${safePath}:${error.message}`] };
  }
}

export function readJsonFile(repoRoot, relativePath) {
  const textFile = readTextFile(repoRoot, relativePath);
  if (!textFile.exists) return { ...textFile, valid: false, data: null };
  try {
    return { ...textFile, valid: true, data: sanitizeValue(JSON.parse(textFile.text)) };
  } catch (error) {
    return { ...textFile, valid: false, data: null, errors: [...textFile.errors, `malformed-json:${relativePath}:${error.message}`] };
  }
}

export function resolveRepoRoot(repoRoot) {
  return resolve(repoRoot || defaultRepoRoot);
}

export function sanitizeValue(value) {
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [sanitizeText(key), sanitizeValue(item)]),
    );
  }
  if (typeof value === "string") return sanitizeText(value);
  return value;
}

export function sanitizeText(value) {
  return String(value ?? "")
    .replace(sensitiveValuePattern, "[REDACTED_SENSITIVE_VALUE]")
    .replace(/(api[_-]?key|token|secret|credential|webhook)(\s*[:=]\s*)[^\s"',}]+/gi, "$1$2[REDACTED]");
}

export function redactSensitivePath(path) {
  const text = sanitizeText(path);
  return sensitivePathPattern.test(text) ? "[redacted-sensitive-path]" : text;
}

export function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function hasSensitiveValue(value) {
  return sensitiveValuePattern.test(JSON.stringify(value || ""));
}

function buildPhaseSummary(contextPack) {
  return sanitizeValue({
    projectPackage: contextPack.projectState?.packageName || "unknown",
    recentPhaseDocs: safeArray(contextPack.projectState?.recentPhaseDocs).slice(0, 6),
    evidenceRefs: contextPack.phaseEvidence?.indexedCount || 0,
    phaseCount: contextPack.phaseEvidence?.phaseCount || 0,
  });
}

function isHash(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function safeRelativePath(relativePath) {
  const normalized = String(relativePath || "").replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.startsWith("/") || normalized.includes(":")) {
    throw new Error(`Unsafe relative path: ${relativePath}`);
  }
  return normalized;
}
