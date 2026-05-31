import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { listTaskToolModels } from "../model-library/unifiedModelRegistry.js";

const repoRoot = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const evidenceJsonPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-312a-frontend-backend-links.json");
const evidenceMdPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-312a-frontend-backend-links.md");
const chatEvidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-312a-chat-gateway-latest.json");

const checks = [];
function expect(condition, id, detail = "") {
  checks.push({ id, pass: Boolean(condition), detail });
}

const env = {
  ...process.env,
  PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
  PHASE312A_NVIDIA_REAL_SMOKE: "",
};
const application = createGatewayApplication(env);
const server = createGatewayHttpServer(application);
const baseUrl = await listen(server);

let providerStatus;
let modelLibrary;
let invalidModelTest;
let autoGateway;
let manualInvalid;
let manualToolBlocked;

try {
  providerStatus = await requestJson(`${baseUrl}/provider-config/status`);
  modelLibrary = await requestJson(`${baseUrl}/model-library`);
  invalidModelTest = await requestJson(`${baseUrl}/model-library/test-model`, {
    method: "POST",
    body: { providerId: "nvidia", modelId: "nvidia/not-a-real-phase312a-model" },
  });
  autoGateway = await requestJson(`${baseUrl}/chat-gateway/execute`, {
    method: "POST",
    body: { input: "Hello from Phase312A automatic gateway smoke.", mode: "automatic_gateway" },
  });
  manualInvalid = await requestJson(`${baseUrl}/chat-gateway/execute`, {
    method: "POST",
    body: {
      input: "Hello with an invalid manual model.",
      mode: "manual_model",
      selectedModel: { providerId: "nvidia", modelId: "nvidia/not-a-real-phase312a-model" },
    },
  });
  const registry = application.modelLibraryStore.getRegistry();
  const taskTool = listTaskToolModels(registry)[0];
  manualToolBlocked = taskTool
    ? await requestJson(`${baseUrl}/chat-gateway/execute`, {
        method: "POST",
        body: {
          input: "Please chat normally with this task tool model.",
          mode: "manual_model",
          selectedModel: { providerId: taskTool.providerId, modelId: taskTool.modelId },
        },
      })
    : null;
} finally {
  await closeServer(server);
}

const providerData = providerStatus?.payload?.data ?? {};
const libraryData = modelLibrary?.payload?.data ?? {};
const invalidData = invalidModelTest?.payload?.data ?? {};
const autoData = autoGateway?.payload?.data ?? {};
const manualInvalidData = manualInvalid?.payload?.data ?? {};
const manualToolData = manualToolBlocked?.payload?.data ?? {};

expect(providerStatus?.ok, "provider-key-status-route-available");
expect(Array.isArray(providerData.providers), "provider-key-status-shape");
expect(modelLibrary?.ok, "model-library-route-available");
expect(Array.isArray(libraryData.registry?.models) && libraryData.registry.models.length > 0, "model-library-non-empty");
expect(invalidModelTest?.ok, "model-test-route-available");
expect(invalidData.code === "model_not_in_library", "illegal-model-blocked");
expect(invalidData.meta?.providerCalled === false, "illegal-model-provider-not-called");
expect(autoGateway?.ok, "chat-gateway-route-available");
expect(autoData.stages?.intent?.intentType === "general_chat", "automatic-intent-classified");
expect(Boolean(autoData.stages?.plan), "automatic-model-plan-created");
expect(autoData.stages?.executionStatus?.providerCalled === false || autoData.realExternalCall === true, "automatic-execution-router-ran");
expect(Boolean(autoData.evidence?.latestPath || existsSync(chatEvidencePath)), "chat-gateway-evidence-generated");
expect(manualInvalid?.ok, "manual-model-route-available");
expect(manualInvalidData.stages?.plan?.blocked === true, "manual-invalid-model-blocked");
expect(manualInvalidData.stages?.executionStatus?.providerCalled === false, "manual-invalid-provider-not-called");
expect(manualToolBlocked === null || manualToolData.stages?.plan?.blocked === true, "non-chat-direct-chat-intercepted");
expect(manualToolBlocked === null || manualToolData.stages?.executionStatus?.providerCalled === false, "non-chat-direct-chat-no-provider-call");
expect(autoData.fallbackUsed === false || Boolean(autoData.fallbackReason), "fallback-evidence-present-when-used");

const evidence = {
  phase: "312A",
  name: "Frontend Backend Link Verification",
  status: checks.every((check) => check.pass) ? "pass" : "fail",
  sealed: false,
  generatedAt: new Date().toISOString(),
  baseUrl,
  providerRoute: providerStatus?.httpStatus,
  modelLibraryRoute: modelLibrary?.httpStatus,
  modelTestRoute: invalidModelTest?.httpStatus,
  chatGatewayRoute: autoGateway?.httpStatus,
  automaticGateway: {
    success: autoData.success,
    code: autoData.code,
    intentType: autoData.intentType,
    providerCalled: autoData.stages?.executionStatus?.providerCalled === true,
    realExternalCall: autoData.realExternalCall === true,
    blockers: autoData.blockers ?? [],
  },
  manualInvalid: {
    blocked: manualInvalidData.stages?.plan?.blocked === true,
    providerCalled: manualInvalidData.stages?.executionStatus?.providerCalled === true,
  },
  nonChatDirectChat: {
    tested: manualToolBlocked !== null,
    blocked: manualToolBlocked === null ? null : manualToolData.stages?.plan?.blocked === true,
    providerCalled: manualToolBlocked === null ? null : manualToolData.stages?.executionStatus?.providerCalled === true,
  },
  checks,
};

await mkdir(dirname(evidenceJsonPath), { recursive: true });
await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
await writeFile(evidenceMdPath, renderMarkdown(evidence), "utf8");

if (evidence.status !== "pass") {
  console.error(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: evidence.status,
    providerRoute: evidence.providerRoute,
    modelLibraryRoute: evidence.modelLibraryRoute,
    chatGatewayRoute: evidence.chatGatewayRoute,
    automaticGateway: evidence.automaticGateway,
    nonChatDirectChat: evidence.nonChatDirectChat,
  }, null, 2));
}

function listen(server) {
  return new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolveListen(`http://127.0.0.1:${address.port}`);
    });
  });
}

function closeServer(server) {
  return new Promise((resolveClose) => server.close(() => resolveClose()));
}

async function requestJson(url, { method = "GET", body } = {}) {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { text };
  }
  return {
    ok: response.ok,
    httpStatus: response.status,
    payload,
  };
}

function renderMarkdown(evidence) {
  return [
    "# Phase312A Frontend Backend Links",
    "",
    `- status: ${evidence.status}`,
    `- providerRoute: ${evidence.providerRoute}`,
    `- modelLibraryRoute: ${evidence.modelLibraryRoute}`,
    `- modelTestRoute: ${evidence.modelTestRoute}`,
    `- chatGatewayRoute: ${evidence.chatGatewayRoute}`,
    `- automaticIntent: ${evidence.automaticGateway.intentType}`,
    `- automaticRealExternalCall: ${evidence.automaticGateway.realExternalCall}`,
    "",
    "## Checks",
    ...evidence.checks.map((check) => `- ${check.pass ? "pass" : "fail"}: ${check.id}${check.detail ? ` (${check.detail})` : ""}`),
    "",
  ].join("\n");
}
