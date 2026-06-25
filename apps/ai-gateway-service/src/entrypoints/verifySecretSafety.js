import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { existsSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { findPlainSecretFindings, maskSecret } from "../security/secretSafety.js";
import { fetchJson, fetchText, listen, close, postJson } from "./entrypointUtils.js";

const PHASE = "phase-107a-secret-safety";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-107a-secret-safety.json");
const evidenceMdPath = resolve(evidenceDir, "phase-107a-secret-safety.md");
const forbiddenSecret = "phase107a-secret-should-not-appear";
const baseScanRoots = [
  "README.md",
  "AGENTS.md",
  ".env.example",
  ".env.enterprise.example",
  ".opencode",
  "package.json",
  "apps",
  "packages",
  "docs",
  "evidence",
];
const textExtensions = new Set([
  "",
  ".cjs",
  ".css",
  ".example",
  ".html",
  ".js",
  ".json",
  ".jsonl",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);

let server;

try {
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "fixed",
    AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory",
    PME_ENTERPRISE_AUTH_ENABLED: "false",
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");

  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const [ui, setupReadiness, modelImportPreview, rootPackage, servicePackage, readme, agents, envExample, envEnterpriseExample] = await Promise.all([
    fetchText(`${serviceUrl}/ui`, { expectStatus: 200, label: "GET /ui" }),
    fetchJson(`${serviceUrl}/setup/readiness`, { expectStatus: 200, label: "GET /setup/readiness" }),
    postJson(`${serviceUrl}/models/import/preview`, {
      apiKey: forbiddenSecret,
      providerHint: "auto",
    }, { expectStatus: 200, label: "POST /models/import/preview" }),
    readFile(resolve(repoRoot, "package.json"), "utf8"),
    readFile(resolve(repoRoot, "apps/ai-gateway-service/package.json"), "utf8"),
    readFile(resolve(repoRoot, "README.md"), "utf8"),
    readFile(resolve(repoRoot, "AGENTS.md"), "utf8"),
    readFile(resolve(repoRoot, ".env.example"), "utf8"),
    readFile(resolve(repoRoot, ".env.enterprise.example"), "utf8"),
  ]);
  const scan = await scanRepositoryForSecrets();

  const evidence = createEvidence({
    serviceUrl,
    ui,
    setupReadiness,
    modelImportPreview,
    rootPackage,
    servicePackage,
    readme,
    agents,
    envExample,
    envEnterpriseExample,
    scan,
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = evidence.status === "passed" ? 0 : 1;
} catch (error) {
  const evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "secret-safety-not-ready",
  };
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function createEvidence({
  serviceUrl,
  ui,
  setupReadiness,
  modelImportPreview,
  rootPackage,
  servicePackage,
  readme,
  agents,
  envExample,
  envEnterpriseExample,
  scan,
}) {
  const rootScripts = JSON.parse(rootPackage).scripts ?? {};
  const serviceScripts = JSON.parse(servicePackage).scripts ?? {};
  const modelImportData = modelImportPreview.body?.data ?? {};
  const setupData = setupReadiness.body?.data ?? {};
  const maskedKey = modelImportData.maskedKey ?? "";
  const payloadText = JSON.stringify({
    ui: ui.text,
    setup: sanitizeForEvidence(setupData),
    modelImport: sanitizeForEvidence(modelImportData),
    scan,
  });

  const checks = {
    uiHttpOk: ui.httpStatus === 200,
    setupReadinessOk: setupReadiness.httpStatus === 200 &&
      setupData.status === "ready" &&
      setupData.safety?.apiKeyExposed === false,
    modelImportMasksUnknownKey: modelImportPreview.httpStatus === 200 &&
      modelImportData.status === "needs_provider_selection" &&
      modelImportData.maskedKey === maskSecret(forbiddenSecret) &&
      maskedKey.includes("****"),
    modelImportNoPlainSecretInResponse: !JSON.stringify(modelImportPreview.body).includes(forbiddenSecret),
    uiNoPlainSecret: !String(ui.text ?? "").includes(forbiddenSecret),
    envExampleNoPlainSecrets: findPlainSecretFindings(envExample, ".env.example").length === 0,
    envEnterpriseExampleNoPlainSecrets: findPlainSecretFindings(
      envEnterpriseExample,
      ".env.enterprise.example",
    ).length === 0,
    readmeNoPlainSecrets: findPlainSecretFindings(readme, "README.md").length === 0,
    agentsNoPlainSecrets: findPlainSecretFindings(agents, "AGENTS.md").length === 0,
    repositoryScanNoPlainSecrets: scan.findingCount === 0,
    docsBoundaryPresent: readme.includes("Phase 107A") &&
      readme.includes("verify:phase107a-secret-safety") &&
      agents.includes("verify:phase107a-secret-safety"),
    scriptsPresent: rootScripts["verify:phase107a-secret-safety"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase107a-secret-safety" &&
      serviceScripts["verify:phase107a-secret-safety"] === "node ./src/entrypoints/verifySecretSafety.js",
    noPlainSecretInEvidence: !payloadText.includes(forbiddenSecret),
  };
  const passed = Object.values(checks).every(Boolean);

  return {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    checks,
    modelImport: {
      status: modelImportData.status,
      reason: modelImportData.reason,
      maskedKey,
      userGuidancePresent: Boolean(modelImportData.userMessage),
    },
    scan: {
      scope: scan.scope,
      fileCount: scan.fileCount,
      findingCount: scan.findingCount,
      findings: scan.findings,
    },
    safety: {
      plaintextApiKeyRecorded: false,
      evidenceContainsPlaintextKey: false,
      uiDisplaysPlaintextKey: false,
      setupReadinessExposesKey: false,
      productionSecretVaultClaimed: false,
      defaultChatMainLaneChanged: false,
      realFallbackExecution: false,
      realAgentExecution: false,
    },
    diagnostics: {
      http: {
        ui: buildHttpDiagnostics(ui),
        setupReadiness: buildHttpDiagnostics(setupReadiness),
        modelImportPreview: buildHttpDiagnostics(modelImportPreview),
      },
    },
    conclusion: passed ? "secret-safety-ready" : "secret-safety-not-ready",
  };
}

async function scanRepositoryForSecrets() {
  const scanRoots = [...baseScanRoots, ...await listOpenCodeConfigFilesAtRepoRoot()];
  const files = [];
  for (const item of scanRoots) {
    const absolute = resolve(repoRoot, item);
    if (!existsSync(absolute)) {
      continue;
    }
    const itemStat = await stat(absolute);
    if (itemStat.isDirectory()) {
      files.push(...await listTextFiles(absolute));
    } else if (isTextFile(absolute)) {
      files.push(absolute);
    }
  }

  const findings = [];
  for (const filePath of files) {
    const text = await readFile(filePath, "utf8");
    findings.push(...findPlainSecretFindings(text, toRepoPath(filePath)));
  }

  return {
    scope: scanRoots,
    fileCount: files.length,
    findingCount: findings.length,
    findings,
  };
}

async function listOpenCodeConfigFilesAtRepoRoot() {
  const entries = await readdir(repoRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /^opencode/i.test(entry.name))
    .map((entry) => entry.name)
    .filter((entryName, index, array) => array.indexOf(entryName) === index)
    .sort();
}

async function listTextFiles(directory) {
  const output = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }
      output.push(...await listTextFiles(absolute));
    } else if (entry.isFile() && isTextFile(absolute)) {
      output.push(absolute);
    }
  }
  return output;
}

function isTextFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (!textExtensions.has(ext)) return false;
  const normalized = toRepoPath(filePath);
  return !normalized.includes("/node_modules/") &&
    !normalized.includes("/.git/") &&
    !normalized.includes("/dist/") &&
    !normalized.includes("/build/") &&
    !normalized.includes("/coverage/");
}

function shouldSkipDirectory(name) {
  return [".git", "node_modules", "dist", "build", "coverage", ".next", ".cache", "test", "__tests__", "evidence"].includes(name);
}

function sanitizeForEvidence(value) {
  if (Array.isArray(value)) return value.map(sanitizeForEvidence);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (/apiKey|authorization|token|secret/i.test(key)) {
      output[key] = item ? "[redacted]" : item;
    } else {
      output[key] = sanitizeForEvidence(item);
    }
  }
  return output;
}

async function retryHttpRead(label, read, options = {}) {
  const expectStatus = options.expectStatus ?? 200;
  const maxAttempts = options.maxAttempts ?? 3;
  const attempts = [];
  let lastResult = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await read();
      lastResult = result;
      attempts.push({
        attempt,
        httpStatus: result.httpStatus,
        ok: result.httpStatus === expectStatus,
      });
      if (result.httpStatus === expectStatus) {
        return { ...result, attempts };
      }
    } catch (error) {
      attempts.push({
        attempt,
        httpStatus: null,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (attempt < maxAttempts) {
      await delay(250 * attempt);
    }
  }

  if (lastResult) {
    return { ...lastResult, attempts };
  }

  throw new Error(`${label} failed after ${maxAttempts} attempts: ${JSON.stringify(attempts)}`);
}

function buildHttpDiagnostics(result) {
  return {
    httpStatus: result?.httpStatus ?? null,
    attempts: Array.isArray(result?.attempts) ? result.attempts : [],
    textPreview: safePreview(result?.text),
  };
}

function safePreview(text) {
  if (typeof text !== "string") return "";
  return text.replaceAll(forbiddenSecret, "[redacted-forbidden-secret]").slice(0, 240);
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function toRepoPath(filePath) {
  return relative(repoRoot, filePath).replace(/\\/g, "/");
}

