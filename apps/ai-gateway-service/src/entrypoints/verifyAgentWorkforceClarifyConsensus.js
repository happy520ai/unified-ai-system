import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const phase = "phase-139a-agent-workforce-clarify-consensus";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, `${phase}.json`);
const evidenceMdPath = resolve(evidenceDir, `${phase}.md`);
const storePath = resolve(tmpdir(), "unified-ai-system", `phase139a-${Date.now()}-workforce-plans.json`);
const testGoal = "把 Agent Workforce 从单次计划生成增强为澄清、共识和状态预览体验";

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
  const [
    health,
    agents,
    planResponse,
    ui,
    rootPackageText,
    servicePackageText,
    readme,
    agentsDoc,
    userManual,
    phase138EvidenceText,
  ] = await Promise.all([
    fetchJson(`${serviceUrl}/workforce/health`),
    fetchJson(`${serviceUrl}/workforce/agents`),
    postJson(`${serviceUrl}/workforce/plan`, {
      goal: testGoal,
      context: { traceId: "verify-phase139a-agent-workforce-clarify-consensus" },
    }),
    fetchText(`${serviceUrl}/ui`),
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
    readRequired("apps/ai-gateway-service/evidence/phase-138a-agent-workforce-omx-benchmark.json"),
  ]);

  const plan = planResponse.body?.data ?? {};
  const saveResponse = await postJson(`${serviceUrl}/workforce/plans/save`, {
    plan,
    context: { traceId: "verify-phase139a-save" },
  });
  const planId = saveResponse.body?.data?.planId;
  const exportResponse = planId
    ? await fetchJson(`${serviceUrl}/workforce/plans/${encodeURIComponent(planId)}/export`)
    : { httpStatus: 0, body: {} };

  const rootPackage = JSON.parse(rootPackageText);
  const servicePackage = JSON.parse(servicePackageText);
  const phase138Evidence = JSON.parse(phase138EvidenceText);
  const readmeFlat = normalizeWhitespace(readme);
  const agentsFlat = normalizeWhitespace(agentsDoc);
  const userManualFlat = normalizeWhitespace(userManual);
  const allText = [
    rootPackageText,
    servicePackageText,
    readme,
    agentsDoc,
    userManual,
    ui.text,
    JSON.stringify(plan),
    JSON.stringify(saveResponse.body),
    JSON.stringify(exportResponse.body),
  ].join("\n\n");
  const secretFindings = findPlainSecretFindings(allText, "phase139a-agent-workforce-clarify-consensus");

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase139a-agent-workforce-clarify-consensus"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase139a-agent-workforce-clarify-consensus",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase139a-agent-workforce-clarify-consensus"] ===
      "node ./src/entrypoints/verifyAgentWorkforceClarifyConsensus.js",
    phase138Closed:
      phase138Evidence.status === "passed" &&
      phase138Evidence.safety?.runsOhMyCodex === false &&
      phase138Evidence.safety?.startsRealWorkers === false,
    healthReady:
      health.httpStatus === 200 &&
      health.body?.data?.status === "ready" &&
      health.body?.data?.safety?.workflowRun === false,
    agentCatalogUnchanged: agents.httpStatus === 200 && agents.body?.data?.agents?.length === 7,
    planRouteOk: planResponse.httpStatus === 200 && plan.success === true,
    clarifyQuestionsPresent:
      Array.isArray(plan.clarifyQuestions) &&
      plan.clarifyQuestions.length >= 5 &&
      ["goal", "scope", "technology_stack", "acceptance", "constraints"].every((topic) =>
        plan.clarifyQuestions.some((item) => item.topic === topic && item.required === true),
      ),
    consensusPreviewPresent:
      Array.isArray(plan.consensusPreview) &&
      ["Planner", "Architect", "Critic"].every((role) =>
        plan.consensusPreview.some(
          (item) =>
            item.role === role &&
            typeof item.viewpoint === "string" &&
            Array.isArray(item.concerns) &&
            typeof item.recommendation === "string",
        ),
      ),
    hookEventsPreviewDisabled:
      Array.isArray(plan.hookEventsPreview) &&
      ["beforePlan", "afterPlan", "beforeExport", "beforeWorkflowRun"].every((event) =>
        plan.hookEventsPreview.some((item) => item.event === event && item.enabled === false),
      ),
    planStatePreviewPresent:
      plan.planState?.current === "export_ready" &&
      Array.isArray(plan.planState?.states) &&
      plan.planState.states.includes("draft") &&
      plan.planState.states.includes("clarified") &&
      plan.planState.states.includes("consensus_ready") &&
      plan.planState.states.includes("export_ready") &&
      plan.planState.previewOnly === true &&
      plan.planState.drivesExecution === false,
    hudPresent:
      typeof plan.planState?.hud?.summary === "string" &&
      Array.isArray(plan.planState?.hud?.blockers) &&
      plan.planState.hud.blockers.length >= 3,
    workflowRunHandoffDisabled:
      plan.planState?.workflowRunHandoff?.status === "disabled" &&
      plan.planState?.workflowRunHandoff?.implemented === false &&
      plan.planState?.workflowRunHandoff?.enabled === false &&
      plan.safety?.workflowRun === false,
    markdownAndExportIncludeNewSections:
      String(plan.markdown).includes("Clarify Questions") &&
      String(plan.markdown).includes("Consensus Preview") &&
      String(plan.markdown).includes("Hook Events Preview") &&
      plan.exportableJson?.planState?.workflowRunHandoff?.status === "disabled",
    saveExportPreservesNewFields:
      saveResponse.httpStatus === 200 &&
      exportResponse.httpStatus === 200 &&
      Array.isArray(exportResponse.body?.data?.taskPackage?.clarifyQuestions) &&
      Array.isArray(exportResponse.body?.data?.taskPackage?.consensusPreview) &&
      Array.isArray(exportResponse.body?.data?.taskPackage?.hookEventsPreview) &&
      exportResponse.body?.data?.taskPackage?.planState?.workflowRunHandoff?.enabled === false,
    uiClarifyConsensusHudPresent:
      ui.httpStatus === 200 &&
      ui.text.includes("phase139a-agent-workforce-clarify-consensus") &&
      ui.text.includes("澄清问题") &&
      ui.text.includes("Planner / Architect / Critic 共识预览") &&
      ui.text.includes("Hook 事件预览") &&
      ui.text.includes("Plan state / HUD 状态区") &&
      ui.text.includes("Workflow run handoff（disabled / not implemented）"),
    docsPhasePresent:
      readme.includes("Phase 139A") &&
      readme.includes("verify:phase139a-agent-workforce-clarify-consensus") &&
      agentsDoc.includes("Phase 139A Agent Workforce Clarify And Consensus Preview Boundary") &&
      userManual.includes("verify:phase139a-agent-workforce-clarify-consensus"),
    safetyBoundaryPresent:
      readmeFlat.includes("does not install or run oh-my-codex") &&
      agentsFlat.includes("must not create worktrees") &&
      agentsFlat.includes("must not call workflow run") &&
      userManualFlat.includes("does not execute code") &&
      userManualFlat.includes("does not create worktrees"),
    noPlainSecrets: secretFindings.length === 0,
    projectContextNotCreated: !existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md")),
  };
  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    phase,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    serviceUrl,
    checks,
    workforce: {
      goal: testGoal,
      workforceId: plan.workforceId ?? null,
      planVersion: plan.planVersion ?? null,
      clarifyQuestionCount: plan.clarifyQuestions?.length ?? 0,
      consensusRoles: (plan.consensusPreview ?? []).map((item) => item.role),
      hookEvents: (plan.hookEventsPreview ?? []).map((item) => ({
        event: item.event,
        enabled: item.enabled,
      })),
      planState: plan.planState ?? null,
    },
    ui: {
      httpStatus: ui.httpStatus,
      phaseMarkerPresent: ui.text?.includes("phase139a-agent-workforce-clarify-consensus") ?? false,
    },
    safety: {
      realLlmCalls: Boolean(plan.safety?.realLlmCalls),
      agentConcurrency: Boolean(plan.safety?.agentConcurrency),
      codeExecution: Boolean(plan.safety?.codeExecution),
      projectFileWrites: Boolean(plan.safety?.projectFileWrites),
      workflowRun: Boolean(plan.safety?.workflowRun),
      createsWorktrees: false,
      installsOhMyCodex: false,
      runsOhMyCodex: false,
      enables144Workers: false,
      defaultNvidiaChatLaneChanged: false,
      plaintextApiKeyRecorded: false,
    },
    secretFindingCount: secretFindings.length,
    conclusion: passed
      ? "agent-workforce-clarify-consensus-preview-closed"
      : "agent-workforce-clarify-consensus-preview-not-closed",
  };

  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  const evidence = {
    phase,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "agent-workforce-clarify-consensus-preview-not-closed",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function listen(targetServer, port, host) {
  return new Promise((resolveListen, rejectListen) => {
    targetServer.once("error", rejectListen);
    targetServer.listen(port, host, () => {
      targetServer.off("error", rejectListen);
      resolveListen();
    });
  });
}

function close(targetServer) {
  return new Promise((resolveClose) => {
    targetServer.close(() => resolveClose());
  });
}

async function readRequired(relativePath) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
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

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 139A Agent Workforce Clarify And Consensus Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Workforce ID: ${body.workforce?.workforceId ?? "n/a"}
- Plan version: ${body.workforce?.planVersion ?? "n/a"}
- Clarify question count: ${body.workforce?.clarifyQuestionCount ?? "n/a"}
- Consensus roles: ${(body.workforce?.consensusRoles ?? []).join(", ")}
- Plan state: ${body.workforce?.planState?.current ?? "n/a"}
- Workflow handoff: ${body.workforce?.planState?.workflowRunHandoff?.status ?? "n/a"}
- UI marker present: ${body.ui?.phaseMarkerPresent ?? false}
- Code execution: ${body.safety?.codeExecution ?? false}
- Project file writes: ${body.safety?.projectFileWrites ?? false}
- Workflow run: ${body.safety?.workflowRun ?? false}
- Creates worktrees: ${body.safety?.createsWorktrees ?? false}
- Runs oh-my-codex: ${body.safety?.runsOhMyCodex ?? false}
- Enables 144 workers: ${body.safety?.enables144Workers ?? false}
- Plain secret findings: ${body.secretFindingCount ?? "n/a"}
- Conclusion: ${body.conclusion}

## Checks

${Object.entries(body.checks ?? {})
  .map(([name, value]) => `- ${name}: ${value ? "passed" : "failed"}`)
  .join("\n")}
`;
}
