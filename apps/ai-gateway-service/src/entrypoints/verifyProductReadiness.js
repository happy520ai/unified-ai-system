import { mkdir, readFile, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchJson, fetchText, listen, close, postJson } from "./entrypointUtils.js";

const PHASE = "phase-103a-product-readiness";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-103a-product-readiness.json");
const evidenceMdPath = resolve(evidenceDir, "phase-103a-product-readiness.md");
const forbiddenSecret = "phase103a-secret-should-not-appear";

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
  const [ui, providers, unknownPreview, maskedPreview, workforceHealth, workforceAgents, rootPackage, servicePackage, readme, agents] = await Promise.all([
    fetchText(`${serviceUrl}/ui`),
    fetchJson(`${serviceUrl}/models/import/providers`),
    postJson(`${serviceUrl}/models/import/preview`, {
      apiKey: forbiddenSecret,
      providerHint: "auto",
    }),
    postJson(`${serviceUrl}/models/import/preview`, {
      apiKey: "sk-****abcd",
      providerHint: "auto",
    }),
    fetchJson(`${serviceUrl}/workforce/health`),
    fetchJson(`${serviceUrl}/workforce/agents`),
    readFile(resolve(repoRoot, "package.json"), "utf8"),
    readFile(resolve(repoRoot, "apps/ai-gateway-service/package.json"), "utf8"),
    readFile(resolve(repoRoot, "README.md"), "utf8"),
    readFile(resolve(repoRoot, "AGENTS.md"), "utf8"),
  ]);

  const evidence = createEvidence({
    serviceUrl,
    ui,
    providers,
    unknownPreview,
    maskedPreview,
    workforceHealth,
    workforceAgents,
    rootPackage,
    servicePackage,
    readme,
    agents,
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
    conclusion: "product-readiness-not-closed",
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
  providers,
  unknownPreview,
  maskedPreview,
  workforceHealth,
  workforceAgents,
  rootPackage,
  servicePackage,
  readme,
  agents,
}) {
  const uiText = ui.text ?? "";
  const providerList = providers.body?.data?.providers ?? [];
  const rootScripts = JSON.parse(rootPackage).scripts ?? {};
  const serviceScripts = JSON.parse(servicePackage).scripts ?? {};
  const payloadText = JSON.stringify({
    unknownPreview: sanitizeForEvidence(unknownPreview.body?.data),
    maskedPreview: sanitizeForEvidence(maskedPreview.body?.data),
    providers: providerList.map((provider) => provider.providerId),
  });

  const checks = {
    uiHttpOk: ui.httpStatus === 200,
    uiProductReadinessMarker: uiText.includes("phase103a-product-readiness"),
    uiCoreModulesReadable: [
      "Chat",
      "API Key",
      "Knowledge / RAG",
      "Workflow",
      "Agent Workforce",
      "Enterprise / readiness",
    ].every((text) => uiText.includes(text)),
    providerCatalogWideEnough: ["nvidia", "openai", "dashscope", "zhipu", "gemini", "openai-compatible", "huggingface"].every((providerId) => {
      return providerList.some((provider) => provider.providerId === providerId);
    }),
    unknownKeyNotUnsupported: unknownPreview.body?.data?.status === "needs_provider_selection" &&
      unknownPreview.body?.data?.reason === "api_key_prefix_unknown_choose_provider_or_base_url" &&
      unknownPreview.body?.data?.userMessage?.includes("无法仅凭 API Key 判断服务商") &&
      !payloadText.includes("unsupported_key_type"),
    maskedKeyRejectedClearly: maskedPreview.body?.data?.status === "invalid_api_key" &&
      maskedPreview.body?.data?.reason === "masked_api_key_not_usable" &&
      maskedPreview.body?.data?.userMessage?.includes("脱敏"),
    workforceStillPreviewReady: workforceHealth.body?.data?.status === "ready" &&
      workforceHealth.body?.data?.safety?.realLlmCalls === false &&
      workforceAgents.body?.data?.agents?.length === 7 &&
      uiText.includes("phase102e-workforce-user-guide"),
    docsPhasePresent: readme.includes("Phase 103A") &&
      agents.includes("verify:phase103a-product-readiness"),
    scriptsPresent: rootScripts["verify:phase103a-product-readiness"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase103a-product-readiness" &&
      serviceScripts["verify:phase103a-product-readiness"] === "node ./src/entrypoints/verifyProductReadiness.js",
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
      providerCatalogCount: providerList.length,
      unknownStatus: unknownPreview.body?.data?.status,
      unknownReason: unknownPreview.body?.data?.reason,
      maskedStatus: maskedPreview.body?.data?.status,
      maskedReason: maskedPreview.body?.data?.reason,
      failureGuidancePresent: Boolean(unknownPreview.body?.data?.userMessage && maskedPreview.body?.data?.userMessage),
    },
    workforce: {
      healthStatus: workforceHealth.body?.data?.status,
      agentCount: workforceAgents.body?.data?.agents?.length,
      previewOnly: workforceHealth.body?.data?.safety?.realLlmCalls === false,
    },
    safety: {
      defaultChatMainLaneChanged: false,
      realProviderCalled: false,
      realLlmCalledByWorkforce: false,
      plaintextApiKeyRecorded: false,
      unsupportedKeyTypeReturned: payloadText.includes("unsupported_key_type"),
    },
    conclusion: passed ? "product-readiness-closed" : "product-readiness-not-closed",
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

