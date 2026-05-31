import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SENSITIVE_PATTERNS = [
  { marker: "openai_or_compatible_key", regex: /\bsk-(?!test|example|placeholder|redacted|masked|xxxx)[A-Za-z0-9_-]{20,}\b/gi },
  { marker: "nvidia_key", regex: /\bnvapi-(?!test|example|placeholder|redacted|masked|xxxx)[A-Za-z0-9_-]{20,}\b/gi },
  { marker: "bearer_token", regex: /\bBearer\s+(?!test|example|placeholder|redacted|masked|xxxx)[A-Za-z0-9._-]{24,}\b/gi },
  { marker: "authorization_header", regex: /\bAuthorization\s*[:=]\s*Bearer\s+(?!test|example|placeholder|redacted|masked|xxxx)[A-Za-z0-9._-]{24,}\b/gi },
  { marker: "api_key_assignment", regex: /\b(api-key|API_KEY|OPENAI_API_KEY|NVIDIA_API_KEY|MIMO_API_KEY|XIAOMI_API_KEY)\s*[:=]\s*(?!process\.env\b)(?!test|example|placeholder|redacted|masked|xxxx)[A-Za-z0-9._-]{24,}\b/gi },
];

const KNOWN_PLACEHOLDER_FILES = new Set([
  "apps/ai-gateway-service/src/entrypoints/verifyAgentWorkforcePlanStore.js",
  "apps/ai-gateway-service/src/entrypoints/verifyModelImportFlow.js",
  "apps/ai-gateway-service/src/entrypoints/verifyWebChatGenericOpenAiCompatibleRuntime.js",
  "apps/ai-gateway-service/src/entrypoints/verifyWebChatModelCapabilityMatcher.js",
  "apps/ai-gateway-service/src/entrypoints/verifyWebChatModelListProbe.js",
  "apps/ai-gateway-service/src/entrypoints/verifyWebChatUserApiCatalogCoverage.js",
  "apps/ai-gateway-service/src/http/routes/smokeMimoRoute.js",
  "apps/ai-gateway-service/src/providers/providerCredentialDetector.js",
]);

export function scanSecurityPlaintextKeys({ repoRoot, files }) {
  const findings = [];
  for (const file of files) {
    if (!shouldScan(file)) continue;
    const text = safeRead(resolve(repoRoot, file));
    if (!text) continue;
    for (const pattern of SENSITIVE_PATTERNS) {
      const matches = [...text.matchAll(pattern.regex)]
        .filter((match) => !isKnownPlaceholder(file, text, match));
      if (matches.length === 0) continue;
      findings.push({
        id: `secret-${findings.length + 1}`,
        severity: "critical",
        dimension: "Secret Safety",
        file,
        marker: pattern.marker,
        message: `Potential plaintext credential marker ${pattern.marker} found.`,
        plaintextValueRecorded: false,
      });
    }
  }
  return {
    status: findings.length === 0 ? "pass" : "fail",
    findingCount: findings.length,
    findings,
    plaintextValuesRecorded: false,
    scope: "docs/evidence/ui/fixtures/cache/logs/source/package-scripts",
  };
}

function shouldScan(file) {
  return file.startsWith("docs/")
    || file.includes("/evidence/")
    || file.includes("/fixtures/")
    || file.includes("/cache/")
    || file.includes("/logs/")
    || file.includes("/src/")
    || file.endsWith("package.json")
    || file === "README.md"
    || file === "AGENTS.md";
}

function isKnownPlaceholder(file, text, match) {
  const matchedText = match[0] ?? "";
  const start = Math.max(0, (match.index ?? 0) - 180);
  const end = Math.min(text.length, (match.index ?? 0) + matchedText.length + 180);
  const context = text.slice(start, end);
  if (/process\.env\./i.test(matchedText)) return true;
  if (/\$\{secretSuffix\}/.test(context)) return true;
  if (!KNOWN_PLACEHOLDER_FILES.has(file)) return false;
  if (file.endsWith("providerCredentialDetector.js")) return /prefix|pattern|regex|detect|credential|providerId|displayName|generic|apiKey\.startsWith/i.test(context);
  return /test|fixture|synthetic|placeholder|forbiddenSecret|persistenceSecret|pastedCredential|ambiguousKey|authorizationShapeOk|extractRuntimeCredentialSecret|detect\(application|source:\s*"phase|fakeDetection|example|redacted|masked|secretSuffix/i.test(context);
}

function safeRead(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}
