import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const phase = "phase-145a-external-omx-runner-design";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, `${phase}.json`);
const evidenceMdPath = resolve(evidenceDir, `${phase}.md`);
const storePath = resolve(tmpdir(), "unified-ai-system", `phase145a-${Date.now()}-workforce-plans.json`);
const testGoal = "Design an external OMX runner protocol without enabling execution.";
const requiredPreflightChecks = [
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
  const phase144 = JSON.parse(await readRequired("apps/ai-gateway-service/evidence/phase-144a-execution-readiness-preflight.json"));
  if (
    phase144.status !== "passed" ||
    phase144.workforce?.executionEnabled !== false ||
    !["blocked", "preview-blocked"].includes(phase144.workforce?.overallStatus)
  ) {
    throw new Error("Phase 144A prerequisite evidence must be passed with executionEnabled=false and overallStatus blocked.");
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
    { questionId: "clarify_goal", answer: "Design an external OMX runner request model only.", previewOnly: true },
    { questionId: "clarify_scope", answer: "No real runner endpoint execution, no OMX CLI, no workflow run.", previewOnly: true },
    { questionId: "clarify_stack", answer: "Use Agent Workforce plan, save, export, UI, and contracts.", previewOnly: true },
    { questionId: "clarify_acceptance", answer: "Verify runnerEnabled false, executionEnabled false, designOnly true.", previewOnly: true },
    { questionId: "clarify_constraints", answer: "Do not inspect git or create worktrees.", previewOnly: true },
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
      context: { traceId: "verify-phase145a-plan" },
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
    context: { traceId: "verify-phase145a-save" },
  });
  const planId = saveResponse.body?.data?.planId;
  const exportResponse = planId
    ? await fetchJson(`${serviceUrl}/workforce/plans/${encodeURIComponent(planId)}/export`)
    : { httpStatus: 0, body: {} };

  const rootPackage = JSON.parse(rootPackageText);
  const servicePackage = JSON.parse(servicePackageText);
  const savedPackage = saveResponse.body?.data?.taskPackage ?? {};
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
    JSON.stringify(exportResponse.body),
  ].join("\n\n");
  const secretFindings = findPlainSecretFindings(allText, phase);

  const design = plan.externalOmxRunnerDesign ?? {};
  const savedDesign = savedPackage.externalOmxRunnerDesign ?? {};
  const exportedDesign = exportedPackage.externalOmxRunnerDesign ?? {};
  const requiredChecks = new Set(design.requiredPreflightChecks || []);
  const proposedEndpoints = Array.isArray(design.proposedEndpoints) ? design.proposedEndpoints : [];
  const checks = {
    prerequisitePassed:
      phase144.status === "passed" &&
      phase144.workforce?.executionEnabled === false &&
      ["blocked", "preview-blocked"].includes(phase144.workforce?.overallStatus),
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase145a-external-omx-runner-design"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase145a-external-omx-runner-design",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase145a-external-omx-runner-design"] ===
      "node ./src/entrypoints/verifyAgentWorkforceExternalOmxRunnerDesign.js",
    existingRoutesUnchanged:
      routes.includes("POST /workforce/plan") &&
      routes.includes("POST /workforce/plans/save") &&
      routes.includes("GET /workforce/plans/:id/export") &&
      !routes.includes("POST /workforce/omx/run-request"),
    planIncludesRunnerDesign:
      planResponse.httpStatus === 200 &&
      design.phase === phase &&
      design.mode === "external-runner-design" &&
      design.runnerEnabled === false &&
      design.executionEnabled === false &&
      design.designOnly === true &&
      design.blockedReasons?.length >= 5,
    designOnlyEndpointModel:
      proposedEndpoints.length === 2 &&
      proposedEndpoints.every((item) => item.execution === "disabled") &&
      proposedEndpoints.some((item) => item.path === "/workforce/omx/handoff") &&
      proposedEndpoints.some((item) => item.path === "/workforce/omx/run-request"),
    requiredPreflightChecksPresent:
      requiredPreflightChecks.every((name) => requiredChecks.has(name)) &&
      design.runnerContract?.requiresHumanApproval === true &&
      design.runnerContract?.requiresCleanGitWorkspace === true &&
      design.runnerContract?.requiresWorktreeIsolation === true &&
      design.runnerContract?.requiresTaskClaimToken === true &&
      design.runnerContract?.requiresLogRedaction === true &&
      design.runnerContract?.requiresCancellableState === true &&
      design.runnerContract?.requiresEvidence === true,
    savePersistsRunnerDesign:
      saveResponse.httpStatus === 200 &&
      savedDesign.phase === phase &&
      savedDesign.runnerEnabled === false &&
      savedDesign.executionEnabled === false &&
      savedDesign.designOnly === true &&
      savedPackage.exportableJson?.externalOmxRunnerDesign?.phase === phase,
    exportPreservesRunnerDesign:
      exportResponse.httpStatus === 200 &&
      exportedDesign.phase === phase &&
      exportedDesign.runnerEnabled === false &&
      exportedDesign.executionEnabled === false &&
      exportedDesign.designOnly === true &&
      exportedDesign.blockedReasons?.includes("External OMX runner is design-only") &&
      String(exportedPackage.markdown).includes("External OMX Runner Design"),
    executionReadinessStillBlocked:
      plan.executionReadinessPreflight?.executionEnabled === false &&
      ["blocked", "preview-blocked"].includes(plan.executionReadinessPreflight?.overallStatus) &&
      exportedPackage.executionReadinessPreflight?.executionEnabled === false &&
      ["blocked", "preview-blocked"].includes(exportedPackage.executionReadinessPreflight?.overallStatus),
    contractsPresent:
      contracts.includes("WorkforceExternalOmxRunnerDesign") &&
      contracts.includes("phase-145a-external-omx-runner-design") &&
      contracts.includes("runnerEnabled: false") &&
      contracts.includes("/workforce/omx/run-request"),
    uiMarkersPresent:
      ui.httpStatus === 200 &&
      ui.text.includes("phase145a-external-omx-runner-design") &&
      ui.text.includes("Phase145A External OMX Runner Design") &&
      ui.text.includes("runnerEnabled=false"),
    docsBoundaryPresent:
      readme.includes("Phase 145A") &&
      agentsDoc.includes("Phase 145A Agent Workforce External OMX Runner Design Boundary") &&
      userManual.includes("verify:phase145a-external-omx-runner-design"),
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
      runnerEnabled: exportedDesign.runnerEnabled ?? null,
      executionEnabled: exportedDesign.executionEnabled ?? null,
      designOnly: exportedDesign.designOnly ?? null,
      proposedEndpointCount: exportedDesign.proposedEndpoints?.length ?? 0,
      requiredPreflightCheckCount: exportedDesign.requiredPreflightChecks?.length ?? 0,
      blockedReasonCount: exportedDesign.blockedReasons?.length ?? 0,
      executionReadinessOverallStatus: exportedPackage.executionReadinessPreflight?.overallStatus ?? null,
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
      runnerEndpointExecution: false,
      installsOhMyCodex: false,
      runsOhMyCodex: false,
      dependencyAdded: false,
      defaultNvidiaChatLaneChanged: false,
      plaintextApiKeyRecorded: false,
    },
    secretFindingCount: secretFindings.length,
    conclusion: passed ? "external-omx-runner-design-preview-closed" : "external-omx-runner-design-preview-not-closed",
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
    conclusion: "external-omx-runner-design-preview-not-closed",
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
  return `# Phase 145A External OMX Runner Design Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Plan ID: ${body.workforce?.planId ?? "n/a"}
- Workforce ID: ${body.workforce?.workforceId ?? "n/a"}
- Runner enabled: ${body.workforce?.runnerEnabled ?? false}
- Execution enabled: ${body.workforce?.executionEnabled ?? false}
- Design only: ${body.workforce?.designOnly ?? true}
- Proposed endpoint count: ${body.workforce?.proposedEndpointCount ?? "n/a"}
- Required preflight check count: ${body.workforce?.requiredPreflightCheckCount ?? "n/a"}
- Blocked reason count: ${body.workforce?.blockedReasonCount ?? "n/a"}
- Execution readiness status: ${body.workforce?.executionReadinessOverallStatus ?? "n/a"}
- Runner endpoint execution: ${body.safety?.runnerEndpointExecution ?? false}
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
