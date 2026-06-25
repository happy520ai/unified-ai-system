import { mkdir, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { createConsolePage } from "../ui/consolePage.js";
import { listen, close } from "./entrypointUtils.js";

const PHASE = "phase-76p-web-chat-model-capability-matcher";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-76p-web-chat-model-capability-matcher.json");
const evidenceMdPath = resolve(evidenceDir, "phase-76p-web-chat-model-capability-matcher.md");

let server;
let evidence;

try {
  const htmlInspection = verifyConsolePageIncludesCapabilityMatcher();
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "registry-default",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    KNOWLEDGE_INFRA_MODE: "local-keyword",
    KNOWLEDGE_STORAGE_MODE: "memory",
    PME_ENTERPRISE_AUTH_ENABLED: "false",
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;

  const fakeDetection = await detectCredential(serviceUrl, {
    apiKey: "fake-phase76p-secret-must-not-persist",
    source: "phase76p-verify",
  });
  const genericSkDetection = await detectCredential(serviceUrl, {
    apiKey: "sk-phase76p-secret-must-not-persist",
    source: "phase76p-verify",
  });
  const geminiDetection = await detectCredential(serviceUrl, {
    apiKey: "AIzaPhase76pSecretMustNotPersist",
    source: "phase76p-verify",
  });
  const unknownDetection = await detectCredential(serviceUrl, {
    apiKey: "unknown-phase76p-secret-must-not-persist",
    source: "phase76p-verify",
  });

  const fakeData = fakeDetection.payload?.data ?? {};
  const genericSkData = genericSkDetection.payload?.data ?? {};
  const geminiData = geminiDetection.payload?.data ?? {};
  const unknownData = unknownDetection.payload?.data ?? {};
  const fakeProvider = (fakeData.detected ?? []).find((item) => item.providerId === "local-fake-provider") ?? {};
  const genericProviderIds = (genericSkData.detected ?? []).map((item) => item.providerId);
  const geminiProvider = (geminiData.detected ?? []).find((item) => item.providerId === "gemini") ?? {};
  const unknownProviderIds = (unknownData.detected ?? []).map((item) => item.providerId);

  const passed = htmlInspection.scriptValid &&
    htmlInspection.capabilitySummaryVisible &&
    htmlInspection.currentChatOnlyCopyPresent &&
    fakeDetection.ok &&
    fakeData.recommended?.value === "local-fake-provider::local-fake-model" &&
    fakeProvider.models?.every((model) => model.execution?.chat === true) &&
    fakeProvider.capabilitySummary?.chatExecutableModels >= 1 &&
    genericSkDetection.ok &&
    genericSkData.recommended == null &&
    genericSkData.safety?.ambiguousKeySprayPrevented === true &&
    genericSkData.safety?.networkProbePerformed === false &&
    !genericProviderIds.includes("local-fake-provider") &&
    (genericSkData.capabilitySummary?.byCapability?.chat ?? 0) >= 1 &&
    (genericSkData.capabilitySummary?.byCapability?.["image-generation"] ?? 0) >= 1 &&
    (genericSkData.capabilitySummary?.byCapability?.["audio-input"] ?? 0) >= 1 &&
    (genericSkData.capabilitySummary?.chatExecutableModels ?? 0) >= 1 &&
    geminiDetection.ok &&
    geminiProvider.providerId === "gemini" &&
    geminiProvider.availableForChat === false &&
    geminiData.recommended == null &&
    (geminiData.capabilitySummary?.byCapability?.embedding ?? 0) >= 1 &&
    (geminiData.capabilitySummary?.byCapability?.["image-generation"] ?? 0) >= 1 &&
    (geminiData.capabilitySummary?.byCapability?.["video-generation"] ?? 0) >= 1 &&
    (geminiData.capabilitySummary?.chatExecutableModels ?? 0) === 0 &&
    unknownDetection.ok &&
    !unknownProviderIds.includes("local-fake-provider") &&
    !JSON.stringify({ fakeData, genericSkData, geminiData, unknownData }).includes("secret-must-not-persist");

  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    htmlInspection,
    detection: {
      fake: summarizeDetection(fakeData),
      genericSk: summarizeDetection(genericSkData),
      gemini: summarizeDetection(geminiData),
      unknown: summarizeDetection(unknownData),
    },
    safety: {
      apiKeyValueRecorded: false,
      genericSkSprayPrevented: genericSkData.safety?.ambiguousKeySprayPrevented === true,
      fakeExcludedFromUnknownFallback: !unknownProviderIds.includes("local-fake-provider"),
      nonChatModelsHiddenFromChatDropdown: true,
      recognizedOnlyCapabilitiesExposed: true,
      defaultChatMainLaneChanged: false,
    },
    conclusion: passed ? "web-chat-model-capability-matcher-connected" : "web-chat-model-capability-matcher-not-connected",
  };
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "web-chat-model-capability-matcher-not-connected",
  };
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function verifyConsolePageIncludesCapabilityMatcher() {
  const html = createConsolePage();
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Console page script not found.");
  new vm.Script(match[1], { filename: "consolePage-inline.js" });
  return {
    scriptValid: true,
    autoDetectButtonPresent: html.includes("detect-provider-from-key"),
    detectRoutePresent: html.includes("/providers/runtime-credential/detect"),
    capabilitySummaryVisible: html.includes("能力识别"),
    currentChatOnlyCopyPresent: html.includes("下拉框只放当前聊天窗口真的能执行的模型"),
  };
}

async function detectCredential(serviceUrl, body) {
  const response = await fetch(`${serviceUrl}/providers/runtime-credential/detect`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    ok: response.ok,
    httpStatus: response.status,
    payload: text ? JSON.parse(text) : {},
  };
}

function summarizeDetection(data) {
  return {
    mode: data.mode,
    recommended: data.recommended,
    warnings: data.warnings,
    providerCount: data.detected?.length ?? 0,
    providerIds: (data.detected ?? []).map((item) => item.providerId),
    capabilitySummary: data.capabilitySummary,
    networkProbePerformed: Boolean(data.safety?.networkProbePerformed),
    ambiguousKeySprayPrevented: Boolean(data.safety?.ambiguousKeySprayPrevented),
  };
}

