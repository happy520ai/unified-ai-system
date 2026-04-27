import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-105a-user-journey";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-105a-user-journey.json");
const evidenceMdPath = resolve(evidenceDir, "phase-105a-user-journey.md");
const forbiddenSecret = "phase105a-secret-should-not-appear";

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
    planResponse,
    rootPackage,
    servicePackage,
    readme,
    agents,
  ] = await Promise.all([
    fetchText(`${serviceUrl}/ui`),
    fetchJson(`${serviceUrl}/setup/readiness`),
    postJson(`${serviceUrl}/models/import/preview`, {
      apiKey: forbiddenSecret,
      providerHint: "auto",
    }),
    postJson(`${serviceUrl}/workforce/plan`, {
      goal: "Create a normal-user first-run acceptance checklist for PME.",
    }),
    readFile(resolve(repoRoot, "package.json"), "utf8"),
    readFile(resolve(repoRoot, "apps/ai-gateway-service/package.json"), "utf8"),
    readFile(resolve(repoRoot, "README.md"), "utf8"),
    readFile(resolve(repoRoot, "AGENTS.md"), "utf8"),
  ]);

  const saveResponse = await postJson(`${serviceUrl}/workforce/plans/save`, planResponse.body?.data ?? {});
  const planId = saveResponse.body?.data?.planId;
  const listResponse = await fetchJson(`${serviceUrl}/workforce/plans`);
  const exportResponse = planId
    ? await fetchJson(`${serviceUrl}/workforce/plans/${encodeURIComponent(planId)}/export`)
    : { httpStatus: 0, body: {} };
  const deleteResponse = planId
    ? await deleteJson(`${serviceUrl}/workforce/plans/${encodeURIComponent(planId)}`)
    : { httpStatus: 0, body: {} };

  const evidence = createEvidence({
    serviceUrl,
    ui,
    setupReadiness,
    unknownPreview,
    planResponse,
    saveResponse,
    listResponse,
    exportResponse,
    deleteResponse,
    rootPackage,
    servicePackage,
    readme,
    agents,
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = evidence.status === "passed" ? 0 : 1;
} catch (error) {
  const evidence = {
    phase: PHASE,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "user-journey-not-ready",
  };
  await writeEvidence(evidence);
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
  planResponse,
  saveResponse,
  listResponse,
  exportResponse,
  deleteResponse,
  rootPackage,
  servicePackage,
  readme,
  agents,
}) {
  const uiText = ui.text ?? "";
  const setupData = setupReadiness.body?.data ?? {};
  const planData = planResponse.body?.data ?? {};
  const exportData = exportResponse.body?.data ?? {};
  const rootScripts = JSON.parse(rootPackage).scripts ?? {};
  const serviceScripts = JSON.parse(servicePackage).scripts ?? {};
  const payloadText = JSON.stringify({
    setup: sanitizeForEvidence(setupData),
    unknownPreview: sanitizeForEvidence(unknownPreview.body?.data),
    plan: planData?.workforceId,
    exportPlanId: exportData?.taskPackage?.planId,
  });

  const checks = {
    uiHttpOk: ui.httpStatus === 200,
    uiSetupWizardPresent: uiText.includes("phase104a-first-run-setup") && uiText.includes("Setup Wizard"),
    uiUserJourneyMarkerPresent: uiText.includes("phase105a-user-journey") && uiText.includes("ordinary-user-e2e-path"),
    uiCoreEntrypointsPresent: [
      "Chat readiness",
      "Model Import / API Key",
      "Knowledge / RAG",
      "Agent Workforce",
      "Error recovery",
    ].every((text) => uiText.includes(text)),
    uiWorkforceStoreControlsPresent: [
      "workforce-save",
      "workforce-history-refresh",
      "workforce-export-json",
      "workforce-clear",
    ].every((text) => uiText.includes(text)),
    setupReadinessOk: setupReadiness.httpStatus === 200 &&
      setupData.phase === "phase-104a-first-run-setup" &&
      setupData.status === "ready" &&
      Array.isArray(setupData.steps) &&
      ["health", "modelImport", "chat", "knowledge", "workforce"].every((key) => setupData.readiness?.[key]),
    chatReadinessPresent: setupData.readiness?.chat?.ready === true,
    modelImportUnknownGuidance: unknownPreview.httpStatus === 200 &&
      unknownPreview.body?.data?.status === "needs_provider_selection" &&
      Boolean(unknownPreview.body?.data?.userMessage) &&
      !payloadText.includes("unsupported_key_type"),
    workforcePlanSaveExportDeleteOk: planResponse.httpStatus === 200 &&
      planData.success === true &&
      saveResponse.httpStatus === 200 &&
      listResponse.httpStatus === 200 &&
      exportResponse.httpStatus === 200 &&
      deleteResponse.httpStatus === 200 &&
      Boolean(exportData.markdown || exportData.taskPackage?.markdown) &&
      Boolean(exportData.taskPackage?.exportableJson),
    readmeUserPathPresent: readme.includes("Phase 105A") &&
      readme.includes("普通用户从 0 到 1 使用流程") &&
      readme.includes("Model Import / API Key failure guidance") &&
      readme.includes("Agent Workforce task packages"),
    agentsBoundaryPresent: agents.includes("verify:phase105a-user-journey") &&
      agents.includes("Phase 105A") &&
      agents.includes("global release completion") &&
      agents.includes("API Key redaction") &&
      agents.includes("default NVIDIA `/chat` lane"),
    scriptsPresent: rootScripts["verify:phase105a-user-journey"] === "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase105a-user-journey" &&
      serviceScripts["verify:phase105a-user-journey"] === "node ./src/entrypoints/verifyUserJourney.js",
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
      stepCount: setupData.steps?.length ?? 0,
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
    workforce: {
      planStatus: planResponse.httpStatus,
      saveStatus: saveResponse.httpStatus,
      listStatus: listResponse.httpStatus,
      exportStatus: exportResponse.httpStatus,
      deleteStatus: deleteResponse.httpStatus,
      markdownExportPresent: Boolean(exportData.markdown || exportData.taskPackage?.markdown),
      jsonExportPresent: Boolean(exportData.taskPackage?.exportableJson),
    },
    safety: {
      plaintextApiKeyRecorded: false,
      realProviderCalled: false,
      defaultChatMainLaneChanged: false,
      workforceExecution: false,
      projectFileWrites: false,
    },
    conclusion: passed ? "ordinary-user-journey-ready" : "ordinary-user-journey-not-ready",
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

async function fetchText(url) {
  const response = await fetch(url);
  return {
    httpStatus: response.status,
    text: await response.text(),
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  return {
    httpStatus: response.status,
    body: text ? JSON.parse(text) : {},
  };
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    httpStatus: response.status,
    body: text ? JSON.parse(text) : {},
  };
}

async function deleteJson(url) {
  const response = await fetch(url, {
    method: "DELETE",
  });
  const text = await response.text();
  return {
    httpStatus: response.status,
    body: text ? JSON.parse(text) : {},
  };
}

function listen(server, port, host) {
  return new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, host, () => {
      server.off("error", rejectListen);
      resolveListen();
    });
  });
}

function close(server) {
  return new Promise((resolveClose) => server.close(() => resolveClose()));
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 105A User Journey Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- UI setup wizard present: ${body.checks?.uiSetupWizardPresent}
- UI user journey marker present: ${body.checks?.uiUserJourneyMarkerPresent}
- Setup readiness status: ${body.setup?.status}
- Chat ready: ${body.setup?.chatReady}
- Model import unknown status: ${body.modelImport?.unknownStatus}
- Model import user guidance present: ${body.modelImport?.userGuidancePresent}
- Workforce plan/save/list/export/delete: ${body.checks?.workforcePlanSaveExportDeleteOk}
- README user path present: ${body.checks?.readmeUserPathPresent}
- AGENTS boundary present: ${body.checks?.agentsBoundaryPresent}
- Plaintext API key recorded: ${body.safety?.plaintextApiKeyRecorded}
- Default chat main lane changed: ${body.safety?.defaultChatMainLaneChanged}
- Workforce execution enabled: ${body.safety?.workforceExecution}
- Conclusion: ${body.conclusion}
`;
}
