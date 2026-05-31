import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const phase = "phase-140a-workforce-clarification-lifecycle";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, `${phase}.json`);
const evidenceMdPath = resolve(evidenceDir, `${phase}.md`);
const storePath = resolve(tmpdir(), "unified-ai-system", `phase140a-${Date.now()}-workforce-plans.json`);
const testGoal = "Persist Agent Workforce clarification answers and lifecycle preview state without execution.";

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
    serviceHealth,
    planResponse,
    ui,
    rootPackageText,
    servicePackageText,
    readme,
    agentsDoc,
    userManual,
    phase139EvidenceText,
  ] = await Promise.all([
    fetchJson(`${serviceUrl}/workforce/health`),
    fetchJson(`${serviceUrl}/health/check`),
    postJson(`${serviceUrl}/workforce/plan`, {
      goal: testGoal,
      clarificationAnswers: [
        {
          questionId: "clarify_goal",
          answer: "Persist a human answer preview without running agents.",
          previewOnly: true,
        },
        {
          questionId: "clarify_acceptance",
          answer: "Verify API, UI markers, persistence, docs, and safety boundaries.",
          previewOnly: true,
        },
      ],
      context: { traceId: "verify-phase140a-plan" },
    }),
    fetchText(`${serviceUrl}/ui`),
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
    readRequired("apps/ai-gateway-service/evidence/phase-139a-agent-workforce-clarify-consensus.json"),
  ]);

  const plan = planResponse.body?.data ?? {};
  const saveResponse = await postJson(`${serviceUrl}/workforce/plans/save`, {
    plan,
    context: { traceId: "verify-phase140a-save" },
  });
  const planId = saveResponse.body?.data?.planId;
  const clarificationResponse = planId
    ? await postJson(`${serviceUrl}/workforce/plans/${encodeURIComponent(planId)}/clarifications`, {
      answers: [
        {
          questionId: "clarify_goal",
          answer: "Persist an updated human answer preview without running agents.",
          previewOnly: true,
        },
        {
          questionId: "clarify_acceptance",
          answer: "Verify API, UI markers, persistence, docs, and safety boundaries.",
          previewOnly: true,
        },
      ],
      context: { traceId: "verify-phase140a-clarifications" },
    })
    : { httpStatus: 0, body: {} };
  const lifecycleResponse = planId
    ? await postJson(`${serviceUrl}/workforce/plans/${encodeURIComponent(planId)}/lifecycle`, {
      state: "consensus_ready",
      note: "Verification moved the preview lifecycle state only.",
      context: { traceId: "verify-phase140a-lifecycle" },
    })
    : { httpStatus: 0, body: {} };
  const exportResponse = planId
    ? await fetchJson(`${serviceUrl}/workforce/plans/${encodeURIComponent(planId)}/export`)
    : { httpStatus: 0, body: {} };
  const listResponse = await fetchJson(`${serviceUrl}/workforce/plans`);

  const rootPackage = JSON.parse(rootPackageText);
  const servicePackage = JSON.parse(servicePackageText);
  const phase139Evidence = JSON.parse(phase139EvidenceText);
  const allText = [
    rootPackageText,
    servicePackageText,
    readme,
    agentsDoc,
    userManual,
    ui.text,
    JSON.stringify(plan),
    JSON.stringify(saveResponse.body),
    JSON.stringify(clarificationResponse.body),
    JSON.stringify(lifecycleResponse.body),
    JSON.stringify(exportResponse.body),
  ].join("\n\n");
  const secretFindings = findPlainSecretFindings(allText, "phase140a-workforce-clarification-lifecycle");
  const routes = serviceHealth.body?.data?.routes ?? [];
  const savedPackage = saveResponse.body?.data?.taskPackage ?? {};
  const clarifiedPackage = clarificationResponse.body?.data?.taskPackage ?? {};
  const lifecyclePackage = lifecycleResponse.body?.data?.taskPackage ?? {};
  const exportedPackage = exportResponse.body?.data?.taskPackage ?? {};

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase140a-workforce-clarification-lifecycle"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase140a-workforce-clarification-lifecycle",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase140a-workforce-clarification-lifecycle"] ===
      "node ./src/entrypoints/verifyAgentWorkforceClarificationLifecycle.js",
    phase139Closed:
      phase139Evidence.status === "passed" &&
      phase139Evidence.safety?.workflowRun === false &&
      phase139Evidence.safety?.createsWorktrees === false,
    healthReady:
      health.httpStatus === 200 &&
      health.body?.data?.status === "ready" &&
      health.body?.data?.safety?.workflowRun === false,
    routesPresent:
      routes.includes("POST /workforce/plans/:id/clarifications") &&
      routes.includes("POST /workforce/plans/:id/lifecycle"),
    planIncludesLifecyclePreview:
      planResponse.httpStatus === 200 &&
      plan.planVersion === "140A.1" &&
      plan.planState?.lifecycleStatus === "clarified" &&
      plan.answeredClarifications?.length === 2 &&
      plan.unresolvedClarifications?.length === 3 &&
      plan.lifecyclePreview?.workflowRunEnabled === false &&
      plan.lifecyclePreview?.executionEnabled === false,
    savePreservesLifecycle:
      saveResponse.httpStatus === 200 &&
      savedPackage.planState?.lifecycleStatus === "saved" &&
      savedPackage.answeredClarifications?.length === 2 &&
      savedPackage.unresolvedClarifications?.length === 3 &&
      savedPackage.lifecyclePreview?.workflowRunEnabled === false &&
      savedPackage.lifecyclePreview?.executionEnabled === false,
    clarificationAnswersPersisted:
      clarificationResponse.httpStatus === 200 &&
      clarificationResponse.body?.data?.status === "clarification_answers_saved" &&
      clarificationResponse.body?.data?.answeredCount === 2 &&
      clarifiedPackage.clarificationAnswers?.length === 2 &&
      clarifiedPackage.lifecyclePreview?.current === "clarified",
    lifecyclePersisted:
      lifecycleResponse.httpStatus === 200 &&
      lifecycleResponse.body?.data?.status === "lifecycle_saved" &&
      lifecyclePackage.lifecyclePreview?.current === "consensus_ready" &&
      lifecyclePackage.planState?.workflowRunHandoff?.lifecycleStatus === "handoff-disabled" &&
      lifecyclePackage.lifecyclePreview?.workflowRunEnabled === false,
    exportPreservesPreviewState:
      exportResponse.httpStatus === 200 &&
      exportedPackage.clarificationAnswers?.length === 2 &&
      exportedPackage.planState?.lifecycleStatus === "exported" &&
      exportedPackage.lifecyclePreview?.current === "exported" &&
      String(exportedPackage.markdown).includes("Clarification Answers"),
    listSummarizesLifecycle:
      listResponse.httpStatus === 200 &&
      listResponse.body?.data?.plans?.some(
        (item) =>
          item.planId === planId &&
          item.lifecycleState === "consensus_ready" &&
          item.lifecycleStatus === "clarified" &&
          item.answeredClarificationCount === 2 &&
          item.unresolvedClarificationCount === 3,
      ),
    uiMarkersPresent:
      ui.httpStatus === 200 &&
      ui.text.includes("phase140a-workforce-clarification-lifecycle") &&
      ui.text.includes("workforce-save-clarifications") &&
      ui.text.includes("workforce-save-lifecycle") &&
      ui.text.includes("ui-phase140a-workforce-preview-with-clarifications") &&
      ui.text.includes("/clarifications") &&
      ui.text.includes("/lifecycle"),
    docsPhasePresent:
      readme.includes("Phase 140A") &&
      readme.includes("verify:phase140a-workforce-clarification-lifecycle") &&
      agentsDoc.includes("Phase 140A Agent Workforce Clarification Answers") &&
      userManual.includes("verify:phase140a-workforce-clarification-lifecycle"),
    safetyBoundaryPresent:
      normalizeWhitespace(readme).includes("does not execute code") &&
      normalizeWhitespace(agentsDoc).includes("must not call workflow run") &&
      normalizeWhitespace(userManual).includes("does not create worktrees"),
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
      planId,
      workforceId: plan.workforceId ?? null,
      planVersion: plan.planVersion ?? null,
      answeredClarificationCount: clarifiedPackage.clarificationAnswers?.length ?? 0,
      lifecycleState: lifecyclePackage.lifecyclePreview?.current ?? null,
      lifecycleStatus: lifecyclePackage.planState?.lifecycleStatus ?? null,
      lifecycleHistoryCount: lifecyclePackage.lifecyclePreview?.history?.length ?? 0,
    },
    safety: {
      realLlmCalls: false,
      agentConcurrency: false,
      codeExecution: false,
      projectFileWrites: false,
      workflowRun: false,
      createsWorktrees: false,
      installsOhMyCodex: false,
      runsOhMyCodex: false,
      enables144Workers: false,
      defaultNvidiaChatLaneChanged: false,
      plaintextApiKeyRecorded: false,
    },
    secretFindingCount: secretFindings.length,
    conclusion: passed
      ? "workforce-clarification-lifecycle-preview-closed"
      : "workforce-clarification-lifecycle-preview-not-closed",
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
    conclusion: "workforce-clarification-lifecycle-preview-not-closed",
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
  return `# Phase 140A Workforce Clarification Lifecycle Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Plan ID: ${body.workforce?.planId ?? "n/a"}
- Workforce ID: ${body.workforce?.workforceId ?? "n/a"}
- Plan version: ${body.workforce?.planVersion ?? "n/a"}
- Answered clarification count: ${body.workforce?.answeredClarificationCount ?? "n/a"}
- Lifecycle state: ${body.workforce?.lifecycleState ?? "n/a"}
- Lifecycle status: ${body.workforce?.lifecycleStatus ?? "n/a"}
- Lifecycle history count: ${body.workforce?.lifecycleHistoryCount ?? "n/a"}
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
