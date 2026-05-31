import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const phase = "phase-144a-execution-readiness-preflight";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, `${phase}.json`);
const evidenceMdPath = resolve(evidenceDir, `${phase}.md`);
const storePath = resolve(tmpdir(), "unified-ai-system", `phase144a-${Date.now()}-workforce-plans.json`);
const testGoal = "Prepare execution readiness preflight preview without enabling execution.";
const expectedCheckNames = [
  "humanApproval",
  "cleanGitWorkspace",
  "secretsSafety",
  "worktreeIsolation",
  "taskClaimToken",
  "logRedaction",
  "cancellableExecution",
  "evidenceRequired",
];

let server;

try {
  const phase142 = JSON.parse(await readRequired("apps/ai-gateway-service/evidence/phase-142a-workforce-omx-handoff-preview.json"));
  const phase143 = JSON.parse(await readRequired("apps/ai-gateway-service/evidence/phase-143a-role-tier-event-ledger.json"));
  if (phase142.status !== "passed" || phase143.status !== "passed") {
    throw new Error("Phase 142A and Phase 143A prerequisite evidence must both be passed before Phase 144A.");
  }

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
    { questionId: "clarify_goal", answer: "Show future execution readiness as blocked preview.", previewOnly: true },
    { questionId: "clarify_scope", answer: "Do not inspect git or create worktrees.", previewOnly: true },
    { questionId: "clarify_stack", answer: "Use existing Agent Workforce preview plan and store surfaces.", previewOnly: true },
    { questionId: "clarify_acceptance", answer: "Verify executionEnabled false, blocked status, and blocked reasons.", previewOnly: true },
    { questionId: "clarify_constraints", answer: "No OMX CLI, no workflow run, no real Agent execution.", previewOnly: true },
  ];

  const [
    serviceHealth,
    planResponse,
    ui,
    rootPackageText,
    servicePackageText,
    contracts,
    planner,
    store,
    readme,
    agentsDoc,
    userManual,
  ] = await Promise.all([
    fetchJson(`${serviceUrl}/health/check`),
    postJson(`${serviceUrl}/workforce/plan`, {
      goal: testGoal,
      clarificationAnswers,
      context: { traceId: "verify-phase144a-plan" },
    }),
    fetchText(`${serviceUrl}/ui`),
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("packages/shared-contracts/src/contracts/workforce.ts"),
    readRequired("apps/ai-gateway-service/src/workforce/workforcePlanner.js"),
    readRequired("apps/ai-gateway-service/src/workforce/workforcePlanStore.js"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
  ]);

  const plan = planResponse.body?.data ?? {};
  const saveResponse = await postJson(`${serviceUrl}/workforce/plans/save`, {
    plan,
    context: { traceId: "verify-phase144a-save" },
  });
  const planId = saveResponse.body?.data?.planId;
  const approvalResponse = planId
    ? await postJson(`${serviceUrl}/workforce/plans/${encodeURIComponent(planId)}/approval-gate`, {
      decision: "approved-preview",
      reviewer: "phase144a-human-reviewer",
      note: "Preview approval is not real execution approval.",
      context: { traceId: "verify-phase144a-approval" },
    })
    : { httpStatus: 0, body: {} };
  const exportResponse = planId
    ? await fetchJson(`${serviceUrl}/workforce/plans/${encodeURIComponent(planId)}/export`)
    : { httpStatus: 0, body: {} };

  const rootPackage = JSON.parse(rootPackageText);
  const servicePackage = JSON.parse(servicePackageText);
  const savedPackage = saveResponse.body?.data?.taskPackage ?? {};
  const approvalPackage = approvalResponse.body?.data?.taskPackage ?? {};
  const exportedPackage = exportResponse.body?.data?.taskPackage ?? {};
  const routes = serviceHealth.body?.data?.routes ?? [];
  const allText = [
    rootPackageText,
    servicePackageText,
    contracts,
    planner,
    store,
    ui.text,
    readme,
    agentsDoc,
    userManual,
    JSON.stringify(plan),
    JSON.stringify(saveResponse.body),
    JSON.stringify(approvalResponse.body),
    JSON.stringify(exportResponse.body),
  ].join("\n\n");
  const secretFindings = findPlainSecretFindings(allText, phase);

  const preflight = plan.executionReadinessPreflight ?? {};
  const exportedPreflight = exportedPackage.executionReadinessPreflight ?? {};
  const preflightCheckNames = new Set((preflight.checks || []).map((item) => item.name));
  const checks = {
    prerequisitesPassed:
      phase142.status === "passed" &&
      phase143.status === "passed" &&
      phase142.safety?.runsOhMyCodex === false &&
      phase143.safety?.hookExecution === false,
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase144a-execution-readiness-preflight"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase144a-execution-readiness-preflight",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase144a-execution-readiness-preflight"] ===
      "node ./src/entrypoints/verifyAgentWorkforceExecutionReadinessPreflight.js",
    existingRoutesUnchanged:
      routes.includes("POST /workforce/plan") &&
      routes.includes("POST /workforce/plans/save") &&
      routes.includes("POST /workforce/plans/:id/approval-gate") &&
      routes.includes("GET /workforce/plans/:id/export"),
    planIncludesPreflight:
      planResponse.httpStatus === 200 &&
      preflight.phase === phase &&
      preflight.mode === "preview-only" &&
      preflight.executionEnabled === false &&
      ["blocked", "preview-blocked"].includes(preflight.overallStatus) &&
      expectedCheckNames.every((name) => preflightCheckNames.has(name)) &&
      preflight.blockedReasons?.length >= 4,
    checksHaveExpectedSafetyPosture:
      preflight.checks?.some((item) => item.name === "humanApproval" && item.status === "blocked" && item.reason.includes("not real execution approval")) &&
      preflight.checks?.some((item) => item.name === "cleanGitWorkspace" && item.status === "not_checked") &&
      preflight.checks?.some((item) => item.name === "secretsSafety" && item.status === "pass") &&
      preflight.checks?.some((item) => item.name === "worktreeIsolation" && item.status === "blocked"),
    savePersistsPreflight:
      saveResponse.httpStatus === 200 &&
      savedPackage.executionReadinessPreflight?.phase === phase &&
      savedPackage.executionReadinessPreflight?.executionEnabled === false &&
      savedPackage.exportableJson?.executionReadinessPreflight?.overallStatus === "blocked",
    approvalStillBlocked:
      approvalResponse.httpStatus === 200 &&
      approvalPackage.approvalGatePreview?.currentDecision === "approved-preview" &&
      approvalPackage.executionReadinessPreflight?.executionEnabled === false &&
      approvalPackage.workforceHudPreview?.approvalGate?.grantsExecution === false &&
      approvalPackage.workforceHudPreview?.execution?.status === "disabled",
    exportPreservesPreflight:
      exportResponse.httpStatus === 200 &&
      exportedPreflight.phase === phase &&
      exportedPreflight.executionEnabled === false &&
      ["blocked", "preview-blocked"].includes(exportedPreflight.overallStatus) &&
      exportedPreflight.blockedReasons?.includes("approval-preview is not execution approval") &&
      String(exportedPackage.markdown).includes("Execution Readiness Preflight"),
    contractsPresent:
      contracts.includes("WorkforceExecutionReadinessPreflight") &&
      contracts.includes("phase-144a-execution-readiness-preflight") &&
      contracts.includes("cleanGitWorkspace"),
    uiMarkersPresent:
      ui.httpStatus === 200 &&
      ui.text.includes("phase144a-execution-readiness-preflight") &&
      ui.text.includes("Phase144A Execution Readiness Preflight") &&
      ui.text.includes("approval preview is not real execution approval"),
    docsBoundaryPresent:
      readme.includes("Phase 144A") &&
      agentsDoc.includes("Phase 144A Agent Workforce Execution Readiness Preflight Boundary") &&
      userManual.includes("verify:phase144a-execution-readiness-preflight"),
    noDependencyAdded:
      !rootPackageText.includes("oh-my-codex") &&
      !servicePackageText.includes("oh-my-codex") &&
      !rootPackageText.includes("@openai/codex"),
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
      overallStatus: exportedPreflight.overallStatus ?? null,
      executionEnabled: exportedPreflight.executionEnabled ?? null,
      checkCount: exportedPreflight.checks?.length ?? 0,
      blockedReasonCount: exportedPreflight.blockedReasons?.length ?? 0,
      approvalDecision: approvalPackage.approvalGatePreview?.currentDecision ?? null,
      approvalGrantsExecution: approvalPackage.workforceHudPreview?.approvalGate?.grantsExecution ?? false,
    },
    safety: {
      realLlmCalls: false,
      agentConcurrency: false,
      codeExecution: false,
      projectFileWrites: false,
      workflowRun: false,
      gitWorkspaceInspection: false,
      hookExecution: false,
      createsWorktrees: false,
      installsOhMyCodex: false,
      runsOhMyCodex: false,
      dependencyAdded: false,
      defaultNvidiaChatLaneChanged: false,
      plaintextApiKeyRecorded: false,
    },
    secretFindingCount: secretFindings.length,
    conclusion: passed ? "execution-readiness-preflight-preview-closed" : "execution-readiness-preflight-preview-not-closed",
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
    conclusion: "execution-readiness-preflight-preview-not-closed",
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

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 144A Execution Readiness Preflight Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Plan ID: ${body.workforce?.planId ?? "n/a"}
- Workforce ID: ${body.workforce?.workforceId ?? "n/a"}
- Overall status: ${body.workforce?.overallStatus ?? "n/a"}
- Execution enabled: ${body.workforce?.executionEnabled ?? false}
- Check count: ${body.workforce?.checkCount ?? "n/a"}
- Blocked reason count: ${body.workforce?.blockedReasonCount ?? "n/a"}
- Approval decision: ${body.workforce?.approvalDecision ?? "n/a"}
- Approval grants execution: ${body.workforce?.approvalGrantsExecution ?? false}
- Git workspace inspection: ${body.safety?.gitWorkspaceInspection ?? false}
- Code execution: ${body.safety?.codeExecution ?? false}
- Project file writes: ${body.safety?.projectFileWrites ?? false}
- Workflow run: ${body.safety?.workflowRun ?? false}
- Creates worktrees: ${body.safety?.createsWorktrees ?? false}
- Runs oh-my-codex: ${body.safety?.runsOhMyCodex ?? false}
- Plain secret findings: ${body.secretFindingCount ?? "n/a"}
- Conclusion: ${body.conclusion}

## Checks

${Object.entries(body.checks ?? {})
  .map(([name, value]) => `- ${name}: ${value ? "passed" : "failed"}`)
  .join("\n")}
`;
}
