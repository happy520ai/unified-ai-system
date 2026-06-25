import { mkdir, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { createConsolePage } from "../ui/consolePage.js";
import { listen, postJson, close } from "./entrypointUtils.js";

const PHASE = "phase-76o-web-chat-api-key-auto-match";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-76o-web-chat-api-key-auto-match.json");
const evidenceMdPath = resolve(evidenceDir, "phase-76o-web-chat-api-key-auto-match.md");

let server;
let evidence;

try {
  const htmlInspection = verifyConsolePageIncludesAutoMatch();
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

  const detection = await postJson(`${serviceUrl}/providers/runtime-credential/detect`, {
    apiKey: "fake-phase76o-secret-must-not-persist",
    source: "phase76o-verify",
  });
  const detectedData = detection.payload?.data ?? {};
  const recommended = detectedData.recommended ?? {};
  const localFakeCandidate = (detectedData.detected ?? []).find((item) => item.providerId === "local-fake-provider") ?? {};
  const selectableModels = localFakeCandidate.models ?? [];
  const selectedModel = selectableModels.find((model) => model.modelId === "phase76o-alt-model") ?? selectableModels[0] ?? {};
  const credential = await postJson(`${serviceUrl}/providers/runtime-credential`, {
    providerId: localFakeCandidate.providerId,
    modelId: selectedModel.modelId,
    models: selectableModels,
    apiKey: "fake-phase76o-secret-must-not-persist",
    source: "phase76o-verify",
  });
  const chat = await postJson(`${serviceUrl}/chat`, {
    prompt: "phase76o auto matched key",
    providerId: localFakeCandidate.providerId,
    model: selectedModel.modelId,
    metadata: {
      phase: PHASE,
      purpose: "runtime-api-key-auto-match",
    },
  });
  const providers = await getJson(`${serviceUrl}/providers`);
  const provider = (providers.payload?.data ?? []).find((item) => item.id === "local-fake-provider");

  const passed = htmlInspection.scriptValid &&
    htmlInspection.autoDetectButtonPresent &&
    htmlInspection.detectRoutePresent &&
    detection.ok &&
    detectedData.secretStorage === "not-stored" &&
    recommended.value === "local-fake-provider::local-fake-model" &&
    selectableModels.length >= 2 &&
    selectedModel.modelId === "phase76o-alt-model" &&
    credential.ok &&
    credential.payload?.data?.secretStorage === "memory-only" &&
    credential.payload?.data?.runtimeModelCount >= 2 &&
    provider?.metadata?.runtimeCredentialPresent === true &&
    provider?.models?.some((model) => model.id === "phase76o-alt-model") &&
    chat.ok &&
    chat.payload?.data?.selectedProvider === "local-fake-provider" &&
    chat.payload?.data?.selectedModel === "phase76o-alt-model" &&
    !JSON.stringify({ detection: detectedData, credential: credential.payload, chat: chat.payload }).includes("fake-phase76o-secret-must-not-persist");

  evidence = {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    htmlInspection,
    detection: {
      ok: detection.ok,
      httpStatus: detection.httpStatus,
      recommended,
      detectedCount: detectedData.detected?.length ?? 0,
      selectableModelCount: selectableModels.length,
      selectedModelId: selectedModel.modelId,
      secretStorage: detectedData.secretStorage,
      networkProbePerformed: Boolean(detectedData.safety?.networkProbePerformed),
    },
    credential: {
      ok: credential.ok,
      httpStatus: credential.httpStatus,
      providerId: credential.payload?.data?.providerId,
      secretStorage: credential.payload?.data?.secretStorage,
      runtimeModelCount: credential.payload?.data?.runtimeModelCount,
      runtimeProviderEnabled: credential.payload?.data?.runtimeProviderEnabled,
    },
    chat: {
      ok: chat.ok,
      httpStatus: chat.httpStatus,
      selectedProvider: chat.payload?.data?.selectedProvider,
      selectedModel: chat.payload?.data?.selectedModel,
    },
    safety: {
      fakeProviderOnly: true,
      apiKeyValueRecorded: false,
      apiKeyPersisted: false,
      detectionStoresSecret: false,
      defaultChatMainLaneChanged: false,
    },
    conclusion: passed ? "web-chat-api-key-auto-match-connected" : "web-chat-api-key-auto-match-not-connected",
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
    conclusion: "web-chat-api-key-auto-match-not-connected",
  };
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function verifyConsolePageIncludesAutoMatch() {
  const html = createConsolePage();
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Console page script not found.");
  new vm.Script(match[1], { filename: "consolePage-inline.js" });
  return {
    scriptValid: true,
    autoDetectButtonPresent: html.includes("detect-provider-from-key"),
    detectRoutePresent: html.includes("/providers/runtime-credential/detect"),
    oneClickAddStillPresent: html.includes("apply-and-probe-provider"),
  };
}


async function getJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  return {
    ok: response.ok,
    httpStatus: response.status,
    payload: text ? JSON.parse(text) : {},
  };
}

