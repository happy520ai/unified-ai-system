import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const phase = "phase-141a-workforce-review-approval-gate";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, `${phase}.json`);
const evidenceMdPath = resolve(evidenceDir, `${phase}.md`);
const storePath = resolve(tmpdir(), "unified-ai-system", `phase141a-${Date.now()}-workforce-plans.json`);
const testGoal = "Prepare an Agent Workforce review package and human approval gate preview without execution.";

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
  const clarificationAnswers = [
    {
      questionId: "clarify_goal",
      answer: "Create a review package and approval metadata preview only.",
      previewOnly: true,
    },
    {
      questionId: "clarify_scope",
      answer: "Include saved plan package review and human decision capture; exclude real execution.",
      previewOnly: true,
    },
    {
      questionId: "clarify_stack",
      answer: "Use the existing Agent Workforce planner, local store, UI, shared contracts, and SDK.",
      previewOnly: true,
    },
    {
      questionId: "clarify_acceptance",
      answer: "Verify API, UI markers, persistence, docs, SDK contracts, and safety boundaries.",
      previewOnly: true,
    },
    {
      questionId: "clarify_constraints",
      answer: "Do not run agents, create worktrees, call workflow run, or write user project files.",
      previewOnly: true,
    },
  ];

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
    contracts,
    sdkTs,
    sdkJs,
    phase140EvidenceText,
  ] = await Promise.all([
    fetchJson(`${serviceUrl}/workforce/health`),
    fetchJson(`${serviceUrl}/health/check`),
    postJson(`${serviceUrl}/workforce/plan`, {
      goal: testGoal,
      clarificationAnswers,
      context: { traceId: "verify-phase141a-plan" },
    }),
    fetchText(`${serviceUrl}/ui`),
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
    readRequired("packages/shared-contracts/src/contracts/workforce.ts"),
    readRequired("packages/shared-sdk/src/index.ts"),
    readRequired("packages/shared-sdk/src/index.js"),
    readRequired("apps/ai-gateway-service/evidence/phase-140a-workforce-clarification-lifecycle.json"),
  ]);

  const plan = planResponse.body?.data ?? {};
  const saveResponse = await postJson(`${serviceUrl}/workforce/plans/save`, {
    plan,
    context: { traceId: "verify-phase141a-save" },
  });
  const planId = saveResponse.body?.data?.planId;
  const reviewPackageResponse = planId
    ? await fetchJson(`${serviceUrl}/workforce/plans/${encodeURIComponent(planId)}/review-package`)
    : { httpStatus: 0, body: {} };
  const approvalGateResponse = planId
    ? await postJson(`${serviceUrl}/workforce/plans/${encodeURIComponent(planId)}/approval-gate`, {
      decision: "approved-preview",
      reviewer: "phase141a-human-reviewer",
      note: "Preview approval recorded for verification only; no workflow run is allowed.",
      context: { traceId: "verify-phase141a-approval-gate" },
    })
    : { httpStatus: 0, body: {} };
  const exportResponse = planId
    ? await fetchJson(`${serviceUrl}/workforce/plans/${encodeURIComponent(planId)}/export`)
    : { httpStatus: 0, body: {} };
  const listResponse = await fetchJson(`${serviceUrl}/workforce/plans`);

  const rootPackage = JSON.parse(rootPackageText);
  const servicePackage = JSON.parse(servicePackageText);
  const phase140Evidence = JSON.parse(phase140EvidenceText);
  const routes = serviceHealth.body?.data?.routes ?? [];
  const savedPackage = saveResponse.body?.data?.taskPackage ?? {};
  const reviewPackage = reviewPackageResponse.body?.data?.taskPackage ?? {};
  const approvalPackage = approvalGateResponse.body?.data?.taskPackage ?? {};
  const exportedPackage = exportResponse.body?.data?.taskPackage ?? {};
  const allText = [
    rootPackageText,
    servicePackageText,
    readme,
    agentsDoc,
    userManual,
    contracts,
    sdkTs,
    sdkJs,
    ui.text,
    JSON.stringify(plan),
    JSON.stringify(saveResponse.body),
    JSON.stringify(reviewPackageResponse.body),
    JSON.stringify(approvalGateResponse.body),
    JSON.stringify(exportResponse.body),
  ].join("\n\n");
  const secretFindings = findPlainSecretFindings(allText, phase);

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase141a-workforce-review-approval-gate"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase141a-workforce-review-approval-gate",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase141a-workforce-review-approval-gate"] ===
      "node ./src/entrypoints/verifyAgentWorkforceReviewApprovalGate.js",
    phase140Closed:
      phase140Evidence.status === "passed" &&
      phase140Evidence.safety?.workflowRun === false &&
      phase140Evidence.safety?.createsWorktrees === false,
    healthReady:
      health.httpStatus === 200 &&
      health.body?.data?.status === "ready" &&
      health.body?.data?.safety?.workflowRun === false,
    routesPresent:
      routes.includes("GET /workforce/plans/:id/review-package") &&
      routes.includes("POST /workforce/plans/:id/approval-gate") &&
      routes.includes("POST /workforce/plans/:id/clarifications") &&
      routes.includes("POST /workforce/plans/:id/lifecycle"),
    planIncludesReviewAndApprovalPreview:
      planResponse.httpStatus === 200 &&
      plan.reviewPackagePreview?.phase === phase &&
      plan.reviewPackagePreview?.workflowRunEnabled === false &&
      plan.reviewPackagePreview?.projectFileWrites === false &&
      plan.approvalGatePreview?.phase === phase &&
      plan.approvalGatePreview?.status === "waiting-human-review" &&
      plan.approvalGatePreview?.executionEnabled === false &&
      plan.approvalGatePreview?.workflowRunEnabled === false &&
      plan.unresolvedClarifications?.length === 0,
    savePersistsReviewAndApproval:
      saveResponse.httpStatus === 200 &&
      savedPackage.reviewPackagePreview?.phase === phase &&
      savedPackage.reviewPackagePreview?.persisted === true &&
      savedPackage.approvalGatePreview?.phase === phase &&
      savedPackage.approvalGatePreview?.persisted === true &&
      savedPackage.exportableJson?.reviewPackagePreview?.phase === phase &&
      savedPackage.exportableJson?.approvalGatePreview?.phase === phase,
    reviewPackageEndpointReady:
      reviewPackageResponse.httpStatus === 200 &&
      reviewPackageResponse.body?.data?.status === "review_package_ready" &&
      reviewPackage.reviewPackagePreview?.phase === phase &&
      reviewPackage.approvalGatePreview?.workflowRunEnabled === false,
    approvalGateRecorded:
      approvalGateResponse.httpStatus === 200 &&
      approvalGateResponse.body?.data?.status === "approval_gate_recorded" &&
      approvalGateResponse.body?.data?.decision === "approved-preview" &&
      approvalPackage.approvalGatePreview?.currentDecision === "approved-preview" &&
      approvalPackage.approvalGatePreview?.decisionHistory?.length === 1 &&
      approvalPackage.approvalGatePreview?.workflowRunEnabled === false &&
      approvalPackage.lifecyclePreview?.current === "handoff-disabled" &&
      approvalPackage.planState?.workflowRunHandoff?.enabled === false,
    exportPreservesReviewApproval:
      exportResponse.httpStatus === 200 &&
      exportedPackage.reviewPackagePreview?.phase === phase &&
      exportedPackage.approvalGatePreview?.currentDecision === "approved-preview" &&
      exportedPackage.approvalGatePreview?.workflowRunEnabled === false &&
      String(exportedPackage.markdown).includes("Review Package Preview") &&
      String(exportedPackage.markdown).includes("Human Approval Gate Preview"),
    listSummarizesReviewApproval:
      listResponse.httpStatus === 200 &&
      listResponse.body?.data?.plans?.some(
        (item) =>
          item.planId === planId &&
          item.reviewPackageStatus === "ready-for-human-review" &&
          item.approvalDecision === "approved-preview" &&
          item.approvalGateStatus === "approved-preview-recorded",
      ),
    uiMarkersPresent:
      ui.httpStatus === 200 &&
      ui.text.includes("phase141a-workforce-review-approval-gate") &&
      ui.text.includes("workforce-review-package") &&
      ui.text.includes("workforce-save-approval-gate") &&
      ui.text.includes("ui-phase141a-approval-gate-preview") &&
      ui.text.includes("/review-package") &&
      ui.text.includes("/approval-gate"),
    contractsAndSdkPresent:
      contracts.includes("WorkforceReviewPackagePreview") &&
      contracts.includes("WorkforceApprovalGatePreview") &&
      contracts.includes("WorkforcePlanApprovalGateRequest") &&
      sdkTs.includes("workforcePlanReviewPackage") &&
      sdkTs.includes("workforcePlanApprovalGate") &&
      sdkJs.includes("/review-package") &&
      sdkJs.includes("/approval-gate"),
    docsPhasePresent:
      readme.includes("Phase 141A") &&
      readme.includes("verify:phase141a-workforce-review-approval-gate") &&
      agentsDoc.includes("Phase 141A Agent Workforce Review Package") &&
      userManual.includes("verify:phase141a-workforce-review-approval-gate"),
    safetyBoundaryPresent:
      normalizeWhitespace(readme).includes("does not call workflow run") &&
      normalizeWhitespace(agentsDoc).includes("must not call workflow run") &&
      normalizeWhitespace(userManual).includes("does not execute agents"),
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
      reviewPackageStatus: approvalPackage.reviewPackagePreview?.status ?? null,
      approvalGateStatus: approvalPackage.approvalGatePreview?.status ?? null,
      approvalDecision: approvalPackage.approvalGatePreview?.currentDecision ?? null,
      approvalDecisionHistoryCount: approvalPackage.approvalGatePreview?.decisionHistory?.length ?? 0,
      lifecycleState: approvalPackage.lifecyclePreview?.current ?? null,
      lifecycleStatus: approvalPackage.planState?.lifecycleStatus ?? null,
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
      ? "workforce-review-approval-gate-preview-closed"
      : "workforce-review-approval-gate-preview-not-closed",
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
    conclusion: "workforce-review-approval-gate-preview-not-closed",
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
  return `# Phase 141A Workforce Review Approval Gate Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Plan ID: ${body.workforce?.planId ?? "n/a"}
- Workforce ID: ${body.workforce?.workforceId ?? "n/a"}
- Plan version: ${body.workforce?.planVersion ?? "n/a"}
- Review package status: ${body.workforce?.reviewPackageStatus ?? "n/a"}
- Approval gate status: ${body.workforce?.approvalGateStatus ?? "n/a"}
- Approval decision: ${body.workforce?.approvalDecision ?? "n/a"}
- Approval decision history count: ${body.workforce?.approvalDecisionHistoryCount ?? "n/a"}
- Lifecycle state: ${body.workforce?.lifecycleState ?? "n/a"}
- Lifecycle status: ${body.workforce?.lifecycleStatus ?? "n/a"}
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
