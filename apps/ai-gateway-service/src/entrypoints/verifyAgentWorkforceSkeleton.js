import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayClient } from "../../../../packages/shared-sdk/src/index.js";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-102a-agent-workforce-skeleton";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-102a-agent-workforce-skeleton.json");
const evidenceMdPath = resolve(evidenceDir, "phase-102a-agent-workforce-skeleton.md");
const testGoal = "构建一个全球发布级 AI 模型管理系统";

let server;

try {
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "fixed",
    AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider",
  });
  server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");

  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const client = createGatewayClient({ baseUrl: serviceUrl });
  const [health, agents, plan, sdkHealth, sdkAgents, sdkPlan, serviceHealth, knowledgeHealth, modelImportProviders, ui] = await Promise.all([
    fetchJson(`${serviceUrl}/workforce/health`),
    fetchJson(`${serviceUrl}/workforce/agents`),
    fetchJson(`${serviceUrl}/workforce/plan`, {
      method: "POST",
      body: {
        context: {
          traceId: PHASE,
        },
        goal: testGoal,
      },
    }),
    client.workforceHealth(),
    client.workforceAgents(),
    client.workforcePlan({
      context: {
        traceId: `${PHASE}-sdk`,
      },
      goal: testGoal,
    }),
    fetchJson(`${serviceUrl}/health`),
    fetchJson(`${serviceUrl}/knowledge/health`),
    fetchJson(`${serviceUrl}/models/import/providers`),
    fetchText(`${serviceUrl}/ui`),
  ]);

  const connected = isWorkforceSkeletonConnected({
    health,
    agents,
    plan,
    sdkHealth,
    sdkAgents,
    sdkPlan,
    serviceHealth,
    knowledgeHealth,
    modelImportProviders,
    ui,
  });
  const evidence = createEvidence({
    status: connected ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    health,
    agents,
    plan,
    sdkHealth,
    sdkAgents,
    sdkPlan,
    serviceHealth,
    knowledgeHealth,
    modelImportProviders,
    ui,
    conclusion: connected ? "agent-workforce-skeleton-connected" : "agent-workforce-skeleton-not-connected",
  });

  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = connected ? 0 : 1;
} catch (error) {
  const evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl: null,
    error: error instanceof Error ? error.message : String(error),
    conclusion: "agent-workforce-skeleton-not-connected",
  });
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
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
  return new Promise((resolveClose) => {
    server.close(() => resolveClose());
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();

  return {
    httpStatus: response.status,
    body: text ? JSON.parse(text) : {},
  };
}

async function fetchText(url) {
  const response = await fetch(url);
  return {
    httpStatus: response.status,
    text: await response.text(),
  };
}

function isWorkforceSkeletonConnected({
  health,
  agents,
  plan,
  sdkHealth,
  sdkAgents,
  sdkPlan,
  serviceHealth,
  knowledgeHealth,
  modelImportProviders,
  ui,
}) {
  const planData = plan?.body?.data;
  const sdkPlanData = sdkPlan?.data;
  const routeList = serviceHealth?.body?.data?.routes ?? [];
  const uiText = ui?.text ?? "";

  return (
    health?.httpStatus === 200 &&
    health?.body?.data?.status === "ready" &&
    health?.body?.data?.safety?.realLlmCalls === false &&
    agents?.httpStatus === 200 &&
    agents?.body?.data?.agents?.length === 7 &&
    plan?.httpStatus === 200 &&
    planData?.success === true &&
    typeof planData?.workforceId === "string" &&
    planData?.goal === testGoal &&
    planData?.selectedRoles?.length === 7 &&
    planData?.taskBreakdown?.length === 7 &&
    planData?.roleAssignments?.length === 7 &&
    planData?.deliverables?.length >= 6 &&
    planData?.acceptanceCriteria?.length >= 1 &&
    planData?.risks?.length >= 1 &&
    planData?.nextActions?.length >= 1 &&
    planData?.safety?.realLlmCalls === false &&
    planData?.safety?.codeExecution === false &&
    planData?.safety?.projectFileWrites === false &&
    sdkHealth?.data?.status === "ready" &&
    sdkAgents?.data?.agents?.length === 7 &&
    sdkPlanData?.workforceId === planData.workforceId &&
    serviceHealth?.httpStatus === 200 &&
    routeList.includes("POST /chat") &&
    routeList.includes("GET /knowledge/health") &&
    routeList.includes("POST /models/import/preview") &&
    routeList.includes("GET /workforce/health") &&
    routeList.includes("GET /workforce/agents") &&
    routeList.includes("POST /workforce/plan") &&
    knowledgeHealth?.httpStatus === 200 &&
    modelImportProviders?.httpStatus === 200 &&
    ui?.httpStatus === 200 &&
    (uiText.includes("phase102a-agent-workforce") || uiText.includes("phase102b-agent-workforce-ux") || uiText.includes("phase102c-agent-workforce-product-closure")) &&
    uiText.includes("workforce-plan") &&
    uiText.includes("/workforce/plan")
  );
}

function createEvidence({
  status,
  generatedAt,
  serviceUrl,
  health,
  agents,
  plan,
  sdkHealth,
  sdkAgents,
  sdkPlan,
  serviceHealth,
  knowledgeHealth,
  modelImportProviders,
  ui,
  conclusion,
  error,
}) {
  const planData = plan?.body?.data;
  const sdkPlanData = sdkPlan?.data;

  return {
    phase: PHASE,
    status,
    generatedAt,
    service: {
      url: serviceUrl,
      healthHttpStatus: serviceHealth?.httpStatus ?? null,
      routePresence: {
        chat: serviceHealth?.body?.data?.routes?.includes("POST /chat") ?? false,
        knowledgeHealth: serviceHealth?.body?.data?.routes?.includes("GET /knowledge/health") ?? false,
        modelImportPreview: serviceHealth?.body?.data?.routes?.includes("POST /models/import/preview") ?? false,
        workforceHealth: serviceHealth?.body?.data?.routes?.includes("GET /workforce/health") ?? false,
        workforceAgents: serviceHealth?.body?.data?.routes?.includes("GET /workforce/agents") ?? false,
        workforcePlan: serviceHealth?.body?.data?.routes?.includes("POST /workforce/plan") ?? false,
      },
    },
    workforce: {
      healthHttpStatus: health?.httpStatus ?? null,
      agentsHttpStatus: agents?.httpStatus ?? null,
      planHttpStatus: plan?.httpStatus ?? null,
      status: health?.body?.data?.status ?? null,
      roleCount: agents?.body?.data?.agents?.length ?? null,
      workforceId: planData?.workforceId ?? null,
      goal: planData?.goal ?? null,
      selectedRoleCount: planData?.selectedRoles?.length ?? null,
      taskCount: planData?.taskBreakdown?.length ?? null,
      assignmentCount: planData?.roleAssignments?.length ?? null,
      deliverableCount: planData?.deliverables?.length ?? null,
      acceptanceCriteriaCount: planData?.acceptanceCriteria?.length ?? null,
      riskCount: planData?.risks?.length ?? null,
      nextActionCount: planData?.nextActions?.length ?? null,
    },
    sdk: {
      healthStatus: sdkHealth?.data?.status ?? null,
      agentCount: sdkAgents?.data?.agents?.length ?? null,
      planWorkforceId: sdkPlanData?.workforceId ?? null,
      sdkPlanMatchesHttpPlan: Boolean(sdkPlanData?.workforceId && sdkPlanData.workforceId === planData?.workforceId),
    },
    ui: {
      httpStatus: ui?.httpStatus ?? null,
      panelPresent: Boolean(ui?.text?.includes("phase102a-agent-workforce") || ui?.text?.includes("phase102b-agent-workforce-ux") || ui?.text?.includes("phase102c-agent-workforce-product-closure")),
      buttonPresent: Boolean(ui?.text?.includes("workforce-plan")),
      routeWired: Boolean(ui?.text?.includes("/workforce/plan")),
    },
    adjacentCapabilities: {
      knowledgeHealthHttpStatus: knowledgeHealth?.httpStatus ?? null,
      modelImportProvidersHttpStatus: modelImportProviders?.httpStatus ?? null,
    },
    safety: {
      realLlmCalls: Boolean(planData?.safety?.realLlmCalls),
      codeExecution: Boolean(planData?.safety?.codeExecution),
      projectFileWrites: Boolean(planData?.safety?.projectFileWrites),
      workflowRun: Boolean(planData?.safety?.workflowRun),
      defaultChatLaneMutated: false,
      providerRegistryMutated: false,
      secretValuesRecorded: false,
    },
    error: error ?? null,
    conclusion,
  };
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 102A Agent Workforce Skeleton Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.service.url ?? "n/a"}
- Workforce health HTTP status: ${body.workforce.healthHttpStatus ?? "n/a"}
- Workforce agents HTTP status: ${body.workforce.agentsHttpStatus ?? "n/a"}
- Workforce plan HTTP status: ${body.workforce.planHttpStatus ?? "n/a"}
- Role count: ${body.workforce.roleCount ?? "n/a"}
- Selected roles: ${body.workforce.selectedRoleCount ?? "n/a"}
- Task count: ${body.workforce.taskCount ?? "n/a"}
- Assignment count: ${body.workforce.assignmentCount ?? "n/a"}
- Deliverable count: ${body.workforce.deliverableCount ?? "n/a"}
- Acceptance criteria count: ${body.workforce.acceptanceCriteriaCount ?? "n/a"}
- Risk count: ${body.workforce.riskCount ?? "n/a"}
- Next action count: ${body.workforce.nextActionCount ?? "n/a"}
- SDK plan matches HTTP plan: ${body.sdk.sdkPlanMatchesHttpPlan}
- UI panel present: ${body.ui.panelPresent}
- UI button present: ${body.ui.buttonPresent}
- UI route wired: ${body.ui.routeWired}
- Adjacent /knowledge health HTTP status: ${body.adjacentCapabilities.knowledgeHealthHttpStatus ?? "n/a"}
- Adjacent /models/import/providers HTTP status: ${body.adjacentCapabilities.modelImportProvidersHttpStatus ?? "n/a"}
- Real LLM calls: ${body.safety.realLlmCalls}
- Code execution: ${body.safety.codeExecution}
- Project file writes: ${body.safety.projectFileWrites}
- Workflow run: ${body.safety.workflowRun}
- Default chat lane mutated: ${body.safety.defaultChatLaneMutated}
- Provider registry mutated: ${body.safety.providerRegistryMutated}
- Secret values recorded: ${body.safety.secretValuesRecorded}
- Conclusion: ${body.conclusion}
`;
}
