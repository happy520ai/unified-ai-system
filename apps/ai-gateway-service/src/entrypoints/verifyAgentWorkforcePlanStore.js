import { mkdir, readFile, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createGatewayClient } from "@unified-ai-system/shared-sdk";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { fetchJson, fetchText, listen, close } from "./entrypointUtils.js";

const PHASE = "phase-102d-agent-workforce-plan-store";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-102d-agent-workforce-plan-store.json");
const evidenceMdPath = resolve(evidenceDir, "phase-102d-agent-workforce-plan-store.md");
const storePath = resolve(tmpdir(), "unified-ai-system", `phase102d-${Date.now()}-workforce-plans.json`);
const testGoal = "把 Agent Workforce 历史计划做成可保存、可读取、可导出的产品闭环";
const forbiddenSecret = "sk-phase102dsecret1234567890";

let server;

try {
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "fixed",
    AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider",
    WORKFORCE_PLAN_STORE_PATH: storePath,
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");

  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const client = createGatewayClient({ baseUrl: serviceUrl });

  const plan = await client.workforcePlan({
    context: {
      traceId: PHASE,
    },
    goal: testGoal,
  });
  const planWithSecret = {
    ...plan.data,
    goal: `${plan.data.goal} ${forbiddenSecret}`,
  };

  const [health, agents, serviceHealth, knowledgeHealth, modelImportProviders, uiBeforeSave] = await Promise.all([
    fetchJson(`${serviceUrl}/workforce/health`),
    fetchJson(`${serviceUrl}/workforce/agents`),
    fetchJson(`${serviceUrl}/health`),
    fetchJson(`${serviceUrl}/knowledge/health`),
    fetchJson(`${serviceUrl}/models/import/providers`),
    fetchText(`${serviceUrl}/ui`),
  ]);
  const save = await client.workforcePlanSave({
    context: {
      traceId: `${PHASE}-save`,
    },
    plan: planWithSecret,
  });
  const listAfterSave = await client.workforcePlans();
  const planId = save.data?.planId;
  const get = await client.workforcePlanGet(planId);
  const exportResult = await client.workforcePlanExport(planId);
  const deleteResult = await client.workforcePlanDelete(planId);
  const listAfterDelete = await client.workforcePlans();
  const storeText = await readFile(storePath, "utf8");

  const passed = isPlanStoreReady({
    health,
    agents,
    plan,
    save,
    listAfterSave,
    get,
    exportResult,
    deleteResult,
    listAfterDelete,
    serviceHealth,
    knowledgeHealth,
    modelImportProviders,
    ui: uiBeforeSave,
    storeText,
  });
  const evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    health,
    agents,
    plan,
    save,
    listAfterSave,
    get,
    exportResult,
    deleteResult,
    listAfterDelete,
    serviceHealth,
    knowledgeHealth,
    modelImportProviders,
    ui: uiBeforeSave,
    storeText,
    conclusion: passed ? "agent-workforce-plan-store-closed" : "agent-workforce-plan-store-not-closed",
  });

  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  const evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl: null,
    error: error instanceof Error ? error.message : String(error),
    conclusion: "agent-workforce-plan-store-not-closed",
  });
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function isPlanStoreReady({
  health,
  agents,
  plan,
  save,
  listAfterSave,
  get,
  exportResult,
  deleteResult,
  listAfterDelete,
  serviceHealth,
  knowledgeHealth,
  modelImportProviders,
  ui,
  storeText,
}) {
  const routes = serviceHealth?.body?.data?.routes ?? [];
  const uiText = ui?.text ?? "";
  const savedPackage = save?.data?.taskPackage;
  const exportedPackage = exportResult?.data?.taskPackage;
  const secretAbsent = !JSON.stringify({
    save,
    listAfterSave,
    get,
    exportResult,
    storeText,
  }).includes(forbiddenSecret);

  return (
    health?.httpStatus === 200 &&
    health?.body?.data?.status === "ready" &&
    agents?.httpStatus === 200 &&
    agents?.body?.data?.agents?.length === 7 &&
    plan?.data?.success === true &&
    save?.data?.status === "saved" &&
    typeof save?.data?.planId === "string" &&
    savedPackage?.planId === save.data.planId &&
    savedPackage?.workforceId === plan.data.workforceId &&
    savedPackage?.goal?.includes("****redacted") &&
    savedPackage?.roles?.length === 7 &&
    savedPackage?.taskBreakdown?.length === 7 &&
    typeof savedPackage?.markdown === "string" &&
    savedPackage.markdown.includes("Agent Workforce") &&
    listAfterSave?.data?.count === 1 &&
    listAfterSave.data.plans?.[0]?.planId === save.data.planId &&
    get?.data?.status === "found" &&
    get.data.taskPackage?.planId === save.data.planId &&
    exportResult?.data?.status === "export_ready" &&
    exportResult.data.formats?.includes("json") &&
    exportResult.data.formats?.includes("markdown") &&
    exportedPackage?.planId === save.data.planId &&
    deleteResult?.data?.status === "deleted" &&
    deleteResult.data.deleted === true &&
    listAfterDelete?.data?.count === 0 &&
    routes.includes("GET /workforce/plans") &&
    routes.includes("GET /workforce/plans/:id") &&
    routes.includes("GET /workforce/plans/:id/export") &&
    routes.includes("POST /workforce/plans/save") &&
    routes.includes("DELETE /workforce/plans/:id") &&
    ui?.httpStatus === 200 &&
    uiText.includes("phase102d-agent-workforce-plan-store") &&
    uiText.includes("workforce-save") &&
    uiText.includes("workforce-history") &&
    uiText.includes("workforce-history-refresh") &&
    uiText.includes("/workforce/plans/save") &&
    uiText.includes("/workforce/plans/") &&
    knowledgeHealth?.httpStatus === 200 &&
    modelImportProviders?.httpStatus === 200 &&
    secretAbsent &&
    save?.data?.safety?.projectFileWrites === false &&
    save?.data?.safety?.secretValuesStored === false
  );
}

function createEvidence({
  status,
  generatedAt,
  serviceUrl,
  health,
  agents,
  plan,
  save,
  listAfterSave,
  get,
  exportResult,
  deleteResult,
  listAfterDelete,
  serviceHealth,
  knowledgeHealth,
  modelImportProviders,
  ui,
  storeText,
  conclusion,
  error,
}) {
  return {
    phase: PHASE,
    status,
    generatedAt,
    service: {
      url: serviceUrl,
      healthHttpStatus: serviceHealth?.httpStatus ?? null,
      routePresence: {
        workforcePlans: serviceHealth?.body?.data?.routes?.includes("GET /workforce/plans") ?? false,
        workforcePlanGet: serviceHealth?.body?.data?.routes?.includes("GET /workforce/plans/:id") ?? false,
        workforcePlanExport: serviceHealth?.body?.data?.routes?.includes("GET /workforce/plans/:id/export") ?? false,
        workforcePlanSave: serviceHealth?.body?.data?.routes?.includes("POST /workforce/plans/save") ?? false,
        workforcePlanDelete: serviceHealth?.body?.data?.routes?.includes("DELETE /workforce/plans/:id") ?? false,
      },
    },
    validation: {
      healthHttpStatus: health?.httpStatus ?? null,
      agentsHttpStatus: agents?.httpStatus ?? null,
      agentCount: agents?.body?.data?.agents?.length ?? null,
      generatedPlanSuccess: Boolean(plan?.data?.success),
      saveStatus: save?.data?.status ?? null,
      savedPlanId: save?.data?.planId ?? null,
      savedRoleCount: save?.data?.taskPackage?.roles?.length ?? null,
      savedTaskCount: save?.data?.taskPackage?.taskBreakdown?.length ?? null,
      listAfterSaveCount: listAfterSave?.data?.count ?? null,
      getStatus: get?.data?.status ?? null,
      exportStatus: exportResult?.data?.status ?? null,
      exportFormats: exportResult?.data?.formats ?? [],
      deleteStatus: deleteResult?.data?.status ?? null,
      listAfterDeleteCount: listAfterDelete?.data?.count ?? null,
      secretAbsent: !JSON.stringify({
        save,
        listAfterSave,
        get,
        exportResult,
        storeText,
      }).includes(forbiddenSecret),
    },
    ui: {
      httpStatus: ui?.httpStatus ?? null,
      panelPresent: Boolean(ui?.text?.includes("phase102d-agent-workforce-plan-store")),
      saveButtonPresent: Boolean(ui?.text?.includes("workforce-save")),
      historyPresent: Boolean(ui?.text?.includes("workforce-history")),
      historyRefreshPresent: Boolean(ui?.text?.includes("workforce-history-refresh")),
    },
    adjacentCapabilities: {
      knowledgeHealthHttpStatus: knowledgeHealth?.httpStatus ?? null,
      modelImportProvidersHttpStatus: modelImportProviders?.httpStatus ?? null,
    },
    safety: {
      realLlmCalls: Boolean(save?.data?.safety?.realLlmCalls),
      codeExecution: Boolean(save?.data?.safety?.codeExecution),
      projectFileWrites: Boolean(save?.data?.safety?.projectFileWrites),
      workflowRun: Boolean(save?.data?.safety?.workflowRun),
      secretValuesStored: Boolean(save?.data?.safety?.secretValuesStored),
      defaultChatLaneMutated: false,
      providerRegistryMutated: false,
    },
    error: error ?? null,
    conclusion,
  };
}

