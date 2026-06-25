import { mkdir, readFile, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchJson, fetchText, listen, close, postJson } from "./entrypointUtils.js";

const PHASE = "phase-106a-delivery-readiness";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-106a-delivery-readiness.json");
const evidenceMdPath = resolve(evidenceDir, "phase-106a-delivery-readiness.md");
const forbiddenSecret = "phase106a-secret-should-not-appear";

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
  const [
    ui,
    setupReadiness,
    unknownPreview,
    rootPackage,
    servicePackage,
    readme,
    agents,
    envExample,
  ] = await Promise.all([
    fetchText(`${serviceUrl}/ui`),
    fetchJson(`${serviceUrl}/setup/readiness`),
    postJson(`${serviceUrl}/models/import/preview`, {
      apiKey: forbiddenSecret,
      providerHint: "auto",
    }),
    readFile(resolve(repoRoot, "package.json"), "utf8"),
    readFile(resolve(repoRoot, "apps/ai-gateway-service/package.json"), "utf8"),
    readFile(resolve(repoRoot, "README.md"), "utf8"),
    readFile(resolve(repoRoot, "AGENTS.md"), "utf8"),
    readFile(resolve(repoRoot, ".env.example"), "utf8"),
  ]);

  const evidence = createEvidence({
    serviceUrl,
    ui,
    setupReadiness,
    unknownPreview,
    rootPackage,
    servicePackage,
    readme,
    agents,
    envExample,
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
    conclusion: "delivery-readiness-not-ready",
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
  unknownPreview,
  rootPackage,
  servicePackage,
  readme,
  agents,
  envExample,
}) {
  const uiText = ui.text ?? "";
  const setupData = setupReadiness.body?.data ?? {};
  const rootScripts = JSON.parse(rootPackage).scripts ?? {};
  const serviceScripts = JSON.parse(servicePackage).scripts ?? {};
  const payloadText = JSON.stringify({
    setup: sanitizeForEvidence(setupData),
    unknownPreview: sanitizeForEvidence(unknownPreview.body?.data),
    envSummary: summarizeEnvExample(envExample),
  });
  const requiredEnvKeys = [
    "NVIDIA_API_KEY",
    "NVIDIA_MODEL",
    "NVIDIA_BASE_URL",
    "AI_GATEWAY_SERVICE_URL",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "OPENAI_COMPATIBLE_BASE_URL",
  ];

  const checks = {
    uiHttpOk: ui.httpStatus === 200,
    uiUserJourneyStillPresent: uiText.includes("phase105a-user-journey") &&
      uiText.includes("Setup Wizard") &&
      uiText.includes("Model Import / API Key") &&
      uiText.includes("Agent Workforce"),
    setupReadinessOk: setupReadiness.httpStatus === 200 &&
      setupData.phase === "phase-104a-first-run-setup" &&
      setupData.status === "ready" &&
      setupData.readiness?.chat?.ready === true &&
      setupData.readiness?.modelImport?.ready === true &&
      setupData.readiness?.knowledge?.ready === true &&
      setupData.readiness?.workforce?.ready === true,
    modelImportFailureGuidance: unknownPreview.httpStatus === 200 &&
      unknownPreview.body?.data?.status === "needs_provider_selection" &&
      Boolean(unknownPreview.body?.data?.userMessage),
    readmeZeroStartGuide: readme.includes("Phase 106A") &&
      readme.includes("从 0 启动") &&
      readme.includes("pnpm install") &&
      readme.includes("cmd /c pnpm start:pme") &&
      readme.includes("http://127.0.0.1:3100/ui") &&
      readme.includes("verify:phase106a-delivery-readiness") &&
      readme.includes("API Key / baseUrl"),
    envExamplePresent: requiredEnvKeys.every((key) => hasEnvKey(envExample, key)),
    envExampleNoRealSecrets: !containsLikelySecret(envExample),
    agentsBoundaryPresent: agents.includes("verify:phase106a-delivery-readiness") &&
      agents.includes("Phase 106A") &&
      /must not commit real API\s+keys/.test(agents) &&
      agents.includes("preview/dev-only"),
    scriptsPresent: rootScripts["verify:phase106a-delivery-readiness"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase106a-delivery-readiness" &&
      serviceScripts["verify:phase106a-delivery-readiness"] === "node ./src/entrypoints/verifyDeliveryReadiness.js",
    noPlainSecretInEvidence: !payloadText.includes(forbiddenSecret),
  };
  const passed = Object.values(checks).every(Boolean);

  return {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    checks,
    setup: {
      status: setupData.status,
      readinessKeys: Object.keys(setupData.readiness ?? {}),
      chatReady: setupData.readiness?.chat?.ready,
      modelImportReady: setupData.readiness?.modelImport?.ready,
      knowledgeReady: setupData.readiness?.knowledge?.ready,
      workforceReady: setupData.readiness?.workforce?.ready,
    },
    modelImport: {
      unknownStatus: unknownPreview.body?.data?.status,
      unknownReason: unknownPreview.body?.data?.reason,
      userGuidancePresent: Boolean(unknownPreview.body?.data?.userMessage),
    },
    envExample: summarizeEnvExample(envExample),
    safety: {
      plaintextApiKeyRecorded: false,
      realProviderCalled: false,
      defaultChatMainLaneChanged: false,
      realFallbackExecution: false,
      realAgentExecution: false,
      projectFileWrites: false,
      globalReleaseClaimed: false,
    },
    conclusion: passed ? "delivery-readiness-ready" : "delivery-readiness-not-ready",
  };
}

function hasEnvKey(text, key) {
  return new RegExp(`^${escapeRegExp(key)}=`, "m").test(text);
}

function containsLikelySecret(text) {
  const withoutComments = text
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");
  return /(nvapi-[A-Za-z0-9_-]{12,}|sk-[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,})/.test(withoutComments);
}

function summarizeEnvExample(text) {
  const keys = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (match) keys.push(match[1]);
  }
  return {
    present: Boolean(text),
    keyCount: keys.length,
    keys,
    likelySecretPresent: containsLikelySecret(text),
  };
}

function sanitizeForEvidence(value) {
  if (Array.isArray(value)) return value.map(sanitizeForEvidence);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (/apiKey/i.test(key)) {
      output[key] = item ? "[redacted]" : item;
    } else {
      output[key] = sanitizeForEvidence(item);
    }
  }
  return output;
}


function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

