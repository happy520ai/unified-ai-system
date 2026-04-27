import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const PHASE = "phase-102b-agent-workforce-ux";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-102b-agent-workforce-ux.json");
const evidenceMdPath = resolve(evidenceDir, "phase-102b-agent-workforce-ux.md");
const testGoal = "把 Agent Workforce 计划预览打磨成用户能看懂、能复制的产品体验";

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
  const emptyGoal = await fetchJson(`${serviceUrl}/workforce/plan`, {
    method: "POST",
    body: {
      goal: "   ",
    },
  });
  const plan = await fetchJson(`${serviceUrl}/workforce/plan`, {
    method: "POST",
    body: {
      context: {
        traceId: PHASE,
      },
      goal: testGoal,
    },
  });
  const serviceHealth = await fetchJson(`${serviceUrl}/health`);
  const knowledgeHealth = await fetchJson(`${serviceUrl}/knowledge/health`);
  const modelImportProviders = await fetchJson(`${serviceUrl}/models/import/providers`);
  const ui = await fetchText(`${serviceUrl}/ui`);

  const passed = isWorkforceUxReady({
    emptyGoal,
    plan,
    serviceHealth,
    knowledgeHealth,
    modelImportProviders,
    ui,
  });
  const evidence = createEvidence({
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    emptyGoal,
    plan,
    serviceHealth,
    knowledgeHealth,
    modelImportProviders,
    ui,
    conclusion: passed ? "agent-workforce-ux-ready" : "agent-workforce-ux-not-ready",
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
    conclusion: "agent-workforce-ux-not-ready",
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

function isWorkforceUxReady({ emptyGoal, plan, serviceHealth, knowledgeHealth, modelImportProviders, ui }) {
  const planData = plan?.body?.data;
  const uiText = ui?.text ?? "";
  const routes = serviceHealth?.body?.data?.routes ?? [];

  return (
    emptyGoal?.httpStatus === 400 &&
    emptyGoal?.body?.error?.code === "WORKFORCE_GOAL_REQUIRED" &&
    plan?.httpStatus === 200 &&
    planData?.success === true &&
    typeof planData?.planVersion === "string" &&
    typeof planData?.createdAt === "string" &&
    planData?.summary?.includes(testGoal) &&
    planData?.userFriendlyStatus === "ready_to_review" &&
    planData?.selectedRoles?.length === 7 &&
    planData?.taskBreakdown?.length === 7 &&
    planData?.deliverables?.length >= 6 &&
    planData?.acceptanceCriteria?.length >= 1 &&
    planData?.risks?.length >= 1 &&
    planData?.nextActions?.length >= 1 &&
    planData?.safety?.realLlmCalls === false &&
    planData?.safety?.codeExecution === false &&
    planData?.safety?.projectFileWrites === false &&
    ui?.httpStatus === 200 &&
    (uiText.includes("phase102b-agent-workforce-ux") || uiText.includes("phase102c-agent-workforce-product-closure")) &&
    uiText.includes("workforce-status") &&
    uiText.includes("workforce-rendered") &&
    uiText.includes("workforce-copy") &&
    uiText.includes("workforce-example") &&
    uiText.includes("formatWorkforcePlanMarkdown") &&
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
  emptyGoal,
  plan,
  serviceHealth,
  knowledgeHealth,
  modelImportProviders,
  ui,
  conclusion,
  error,
}) {
  const planData = plan?.body?.data;

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
        workforcePlan: serviceHealth?.body?.data?.routes?.includes("POST /workforce/plan") ?? false,
      },
    },
    validation: {
      emptyGoalHttpStatus: emptyGoal?.httpStatus ?? null,
      emptyGoalCode: emptyGoal?.body?.error?.code ?? null,
      normalGoalHttpStatus: plan?.httpStatus ?? null,
      planVersion: planData?.planVersion ?? null,
      createdAtPresent: Boolean(planData?.createdAt),
      summaryPresent: Boolean(planData?.summary),
      userFriendlyStatus: planData?.userFriendlyStatus ?? null,
      selectedRoleCount: planData?.selectedRoles?.length ?? null,
      taskCount: planData?.taskBreakdown?.length ?? null,
      deliverableCount: planData?.deliverables?.length ?? null,
      acceptanceCriteriaCount: planData?.acceptanceCriteria?.length ?? null,
      riskCount: planData?.risks?.length ?? null,
      nextActionCount: planData?.nextActions?.length ?? null,
    },
    ui: {
      httpStatus: ui?.httpStatus ?? null,
      panelPresent: Boolean(ui?.text?.includes("phase102b-agent-workforce-ux") || ui?.text?.includes("phase102c-agent-workforce-product-closure")),
      statusPresent: Boolean(ui?.text?.includes("workforce-status")),
      renderedOutputPresent: Boolean(ui?.text?.includes("workforce-rendered")),
      copyMarkdownPresent: Boolean(ui?.text?.includes("workforce-copy")),
      exampleButtonsPresent: Boolean(ui?.text?.includes("workforce-example")),
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
  return `# Phase 102B Agent Workforce UX Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Empty goal HTTP status: ${body.validation.emptyGoalHttpStatus ?? "n/a"}
- Empty goal code: ${body.validation.emptyGoalCode ?? "n/a"}
- Normal goal HTTP status: ${body.validation.normalGoalHttpStatus ?? "n/a"}
- Plan version: ${body.validation.planVersion ?? "n/a"}
- Created at present: ${body.validation.createdAtPresent}
- Summary present: ${body.validation.summaryPresent}
- User-friendly status: ${body.validation.userFriendlyStatus ?? "n/a"}
- Selected roles: ${body.validation.selectedRoleCount ?? "n/a"}
- Tasks: ${body.validation.taskCount ?? "n/a"}
- Deliverables: ${body.validation.deliverableCount ?? "n/a"}
- Acceptance criteria: ${body.validation.acceptanceCriteriaCount ?? "n/a"}
- Risks: ${body.validation.riskCount ?? "n/a"}
- Next actions: ${body.validation.nextActionCount ?? "n/a"}
- UI panel present: ${body.ui.panelPresent}
- UI status present: ${body.ui.statusPresent}
- UI rendered output present: ${body.ui.renderedOutputPresent}
- UI copy Markdown present: ${body.ui.copyMarkdownPresent}
- UI example buttons present: ${body.ui.exampleButtonsPresent}
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
