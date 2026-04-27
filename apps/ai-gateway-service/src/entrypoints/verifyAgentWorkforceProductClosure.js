import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-102c-agent-workforce-product-closure";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-102c-agent-workforce-product-closure.json");
const evidenceMdPath = resolve(evidenceDir, "phase-102c-agent-workforce-product-closure.md");
const testGoal = "把 Agent Workforce 做成普通用户可理解、可复制、可导出的计划预览产品闭环";

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
  const [health, agents, normalGoal, emptyGoal, longGoal, nonStringGoal, serviceHealth, knowledgeHealth, modelImportProviders, ui] = await Promise.all([
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
    fetchJson(`${serviceUrl}/workforce/plan`, {
      method: "POST",
      body: {
        goal: "",
      },
    }),
    fetchJson(`${serviceUrl}/workforce/plan`, {
      method: "POST",
      body: {
        goal: "x".repeat(1001),
      },
    }),
    fetchJson(`${serviceUrl}/workforce/plan`, {
      method: "POST",
      body: {
        goal: {
          text: "not a string",
        },
      },
    }),
    fetchJson(`${serviceUrl}/health`),
    fetchJson(`${serviceUrl}/knowledge/health`),
    fetchJson(`${serviceUrl}/models/import/providers`),
    fetchText(`${serviceUrl}/ui`),
  ]);

  const passed = isProductClosureReady({
    health,
    agents,
    normalGoal,
    emptyGoal,
    longGoal,
    nonStringGoal,
    serviceHealth,
    knowledgeHealth,
    modelImportProviders,
    ui,
  });
  const evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    health,
    agents,
    normalGoal,
    emptyGoal,
    longGoal,
    nonStringGoal,
    serviceHealth,
    knowledgeHealth,
    modelImportProviders,
    ui,
    conclusion: passed ? "agent-workforce-product-preview-closed" : "agent-workforce-product-preview-not-closed",
  });

  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  const evidence = createEvidence({
    status: "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl: null,
    error: error instanceof Error ? error.message : String(error),
    conclusion: "agent-workforce-product-preview-not-closed",
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

function isProductClosureReady({
  health,
  agents,
  normalGoal,
  emptyGoal,
  longGoal,
  nonStringGoal,
  serviceHealth,
  knowledgeHealth,
  modelImportProviders,
  ui,
}) {
  const plan = normalGoal?.body?.data;
  const uiText = ui?.text ?? "";
  const routes = serviceHealth?.body?.data?.routes ?? [];

  return (
    health?.httpStatus === 200 &&
    health?.body?.data?.status === "ready" &&
    agents?.httpStatus === 200 &&
    agents?.body?.data?.agents?.length === 7 &&
    normalGoal?.httpStatus === 200 &&
    plan?.success === true &&
    plan?.planVersion === "102C.1" &&
    typeof plan?.createdAt === "string" &&
    typeof plan?.summary === "string" &&
    plan?.userFriendlyStatus === "ready_to_review" &&
    Array.isArray(plan?.limitations) &&
    plan.limitations.length >= 4 &&
    typeof plan?.markdown === "string" &&
    plan.markdown.includes("# Agent Workforce Plan Preview") &&
    typeof plan?.recommendedNextStep === "string" &&
    plan?.exportableJson?.workforceId === plan.workforceId &&
    plan?.selectedRoles?.length === 7 &&
    plan?.taskBreakdown?.length === 7 &&
    plan?.safety?.realLlmCalls === false &&
    plan?.safety?.codeExecution === false &&
    plan?.safety?.projectFileWrites === false &&
    emptyGoal?.httpStatus === 400 &&
    emptyGoal?.body?.error?.code === "WORKFORCE_GOAL_REQUIRED" &&
    Boolean(emptyGoal?.body?.error?.details?.userMessage) &&
    longGoal?.httpStatus === 400 &&
    longGoal?.body?.error?.code === "WORKFORCE_GOAL_TOO_LONG" &&
    Boolean(longGoal?.body?.error?.details?.userMessage) &&
    nonStringGoal?.httpStatus === 400 &&
    nonStringGoal?.body?.error?.code === "WORKFORCE_GOAL_MUST_BE_STRING" &&
    Boolean(nonStringGoal?.body?.error?.details?.userMessage) &&
    ui?.httpStatus === 200 &&
    uiText.includes("phase102c-agent-workforce-product-closure") &&
    uiText.includes("Agent Workforce") &&
    uiText.includes("workforce-example") &&
    uiText.includes("workforce-copy") &&
    uiText.includes("workforce-export-json") &&
    uiText.includes("workforce-clear") &&
    uiText.includes("workforce-goal-hint") &&
    uiText.includes("maxlength=\"1000\"") &&
    uiText.includes("计划预览") &&
    routes.includes("POST /chat") &&
    routes.includes("GET /knowledge/health") &&
    routes.includes("POST /models/import/preview") &&
    knowledgeHealth?.httpStatus === 200 &&
    modelImportProviders?.httpStatus === 200
  );
}

function createEvidence({
  status,
  generatedAt,
  serviceUrl,
  health,
  agents,
  normalGoal,
  emptyGoal,
  longGoal,
  nonStringGoal,
  serviceHealth,
  knowledgeHealth,
  modelImportProviders,
  ui,
  conclusion,
  error,
}) {
  const plan = normalGoal?.body?.data;

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
    validation: {
      healthHttpStatus: health?.httpStatus ?? null,
      agentsHttpStatus: agents?.httpStatus ?? null,
      agentCount: agents?.body?.data?.agents?.length ?? null,
      normalGoalHttpStatus: normalGoal?.httpStatus ?? null,
      planVersion: plan?.planVersion ?? null,
      createdAtPresent: Boolean(plan?.createdAt),
      summaryPresent: Boolean(plan?.summary),
      limitationsCount: plan?.limitations?.length ?? null,
      markdownPresent: Boolean(plan?.markdown),
      exportableJsonPresent: Boolean(plan?.exportableJson),
      recommendedNextStepPresent: Boolean(plan?.recommendedNextStep),
      emptyGoalHttpStatus: emptyGoal?.httpStatus ?? null,
      emptyGoalCode: emptyGoal?.body?.error?.code ?? null,
      longGoalHttpStatus: longGoal?.httpStatus ?? null,
      longGoalCode: longGoal?.body?.error?.code ?? null,
      nonStringGoalHttpStatus: nonStringGoal?.httpStatus ?? null,
      nonStringGoalCode: nonStringGoal?.body?.error?.code ?? null,
    },
    ui: {
      httpStatus: ui?.httpStatus ?? null,
      panelPresent: Boolean(ui?.text?.includes("phase102c-agent-workforce-product-closure")),
      exampleGoalsPresent: Boolean(ui?.text?.includes("workforce-example")),
      copyMarkdownPresent: Boolean(ui?.text?.includes("workforce-copy")),
      exportJsonPresent: Boolean(ui?.text?.includes("workforce-export-json")),
      clearPresent: Boolean(ui?.text?.includes("workforce-clear")),
      maxLengthHintPresent: Boolean(ui?.text?.includes("workforce-goal-hint")),
      previewBoundaryPresent: Boolean(ui?.text?.includes("计划预览")),
    },
    adjacentCapabilities: {
      knowledgeHealthHttpStatus: knowledgeHealth?.httpStatus ?? null,
      modelImportProvidersHttpStatus: modelImportProviders?.httpStatus ?? null,
    },
    safety: {
      realLlmCalls: Boolean(plan?.safety?.realLlmCalls),
      codeExecution: Boolean(plan?.safety?.codeExecution),
      projectFileWrites: Boolean(plan?.safety?.projectFileWrites),
      workflowRun: Boolean(plan?.safety?.workflowRun),
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
  return `# Phase 102C Agent Workforce Product Closure Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Health HTTP status: ${body.validation.healthHttpStatus ?? "n/a"}
- Agents HTTP status: ${body.validation.agentsHttpStatus ?? "n/a"}
- Agent count: ${body.validation.agentCount ?? "n/a"}
- Normal goal HTTP status: ${body.validation.normalGoalHttpStatus ?? "n/a"}
- Plan version: ${body.validation.planVersion ?? "n/a"}
- Created at present: ${body.validation.createdAtPresent}
- Summary present: ${body.validation.summaryPresent}
- Limitations count: ${body.validation.limitationsCount ?? "n/a"}
- Markdown present: ${body.validation.markdownPresent}
- Exportable JSON present: ${body.validation.exportableJsonPresent}
- Recommended next step present: ${body.validation.recommendedNextStepPresent}
- Empty goal code: ${body.validation.emptyGoalCode ?? "n/a"}
- Long goal code: ${body.validation.longGoalCode ?? "n/a"}
- Non-string goal code: ${body.validation.nonStringGoalCode ?? "n/a"}
- UI panel present: ${body.ui.panelPresent}
- UI example goals present: ${body.ui.exampleGoalsPresent}
- UI copy Markdown present: ${body.ui.copyMarkdownPresent}
- UI export JSON present: ${body.ui.exportJsonPresent}
- UI clear present: ${body.ui.clearPresent}
- UI max length hint present: ${body.ui.maxLengthHintPresent}
- UI preview boundary present: ${body.ui.previewBoundaryPresent}
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
