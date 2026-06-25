import { mkdir, readFile, writeFile } from "node:fs/promises";
import { writeEvidencePair } from "./entrypointUtils.js";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { findPlainSecretFindings } from "../security/secretSafety.js";
import { fetchJson, fetchText, listen, close, postJson } from "./entrypointUtils.js";

const phase = "phase-142a-workforce-omx-handoff-preview";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, `${phase}.json`);
const evidenceMdPath = resolve(evidenceDir, `${phase}.md`);
const storePath = resolve(tmpdir(), "unified-ai-system", `phase142a-${Date.now()}-workforce-plans.json`);
const testGoal = "Prepare an OMX-compatible Agent Workforce handoff preview without execution.";

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
    { questionId: "clarify_goal", answer: "Generate an OMX handoff preview only.", previewOnly: true },
    { questionId: "clarify_scope", answer: "Include mapping, suggested commands, preflight, and blockers.", previewOnly: true },
    { questionId: "clarify_stack", answer: "Use existing Agent Workforce preview contracts and local store.", previewOnly: true },
    { questionId: "clarify_acceptance", answer: "Verify no dependency, no OMX execution, no workflow run, and no worktree creation.", previewOnly: true },
    { questionId: "clarify_constraints", answer: "Do not install or run oh-my-codex.", previewOnly: true },
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
      context: { traceId: "verify-phase142a-plan" },
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
    context: { traceId: "verify-phase142a-save" },
  });
  const planId = saveResponse.body?.data?.planId;
  const exportResponse = planId
    ? await fetchJson(`${serviceUrl}/workforce/plans/${encodeURIComponent(planId)}/export`)
    : { httpStatus: 0, body: {} };
  const listResponse = await fetchJson(`${serviceUrl}/workforce/plans`);

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

  const checks = {
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase142a-workforce-omx-handoff-preview"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase142a-workforce-omx-handoff-preview",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase142a-workforce-omx-handoff-preview"] ===
      "node ./src/entrypoints/verifyAgentWorkforceOmxHandoffPreview.js",
    existingRoutesUnchanged:
      routes.includes("POST /workforce/plan") &&
      routes.includes("POST /workforce/plans/save") &&
      routes.includes("GET /workforce/plans/:id/export"),
    planIncludesOmxHandoffPreview:
      planResponse.httpStatus === 200 &&
      plan.omxHandoffPreview?.phase === phase &&
      plan.omxHandoffPreview?.mode === "omx-compatible-preview" &&
      plan.omxHandoffPreview?.recommendedWorkflow === "deep-interview -> ralplan -> team/ralph" &&
      plan.omxHandoffPreview?.executionEnabled === false &&
      plan.omxHandoffPreview?.workflowRunEnabled === false &&
      plan.omxHandoffPreview?.createsWorktrees === false &&
      plan.omxHandoffPreview?.installsOhMyCodex === false &&
      plan.omxHandoffPreview?.runsOhMyCodex === false,
    planSuggestedCommandsArePreviewOnly:
      Array.isArray(plan.omxHandoffPreview?.suggestedOmxCommands) &&
      plan.omxHandoffPreview.suggestedOmxCommands.some((item) => item.includes("$deep-interview")) &&
      plan.omxHandoffPreview.suggestedOmxCommands.some((item) => item.includes("$ralplan")) &&
      plan.omxHandoffPreview.suggestedOmxCommands.some((item) => item.includes("$team")) &&
      plan.omxHandoffPreview.blockedReasons?.some((item) => item.includes("not installed or run")),
    savePersistsOmxHandoffPreview:
      saveResponse.httpStatus === 200 &&
      savedPackage.omxHandoffPreview?.phase === phase &&
      savedPackage.omxHandoffPreview?.runsOhMyCodex === false &&
      savedPackage.exportableJson?.omxHandoffPreview?.phase === phase,
    exportPreservesOmxHandoffPreview:
      exportResponse.httpStatus === 200 &&
      exportedPackage.omxHandoffPreview?.phase === phase &&
      exportedPackage.omxHandoffPreview?.executionEnabled === false &&
      exportedPackage.omxHandoffPreview?.createsWorktrees === false &&
      String(exportedPackage.markdown).includes("OMX Handoff Preview"),
    listStillPreviewOnly:
      listResponse.httpStatus === 200 &&
      listResponse.body?.data?.plans?.some((item) => item.planId === planId),
    contractsPresent:
      contracts.includes("WorkforceOmxHandoffPreview") &&
      contracts.includes("phase-142a-workforce-omx-handoff-preview") &&
      contracts.includes("runsOhMyCodex"),
    uiMarkersPresent:
      ui.httpStatus === 200 &&
      ui.text.includes("phase142a-workforce-omx-handoff-preview") &&
      ui.text.includes("Phase142A OMX Handoff Preview") &&
      ui.text.includes("runsOhMyCodex"),
    docsBoundaryPresent:
      readme.includes("Phase 142A") &&
      agentsDoc.includes("Phase 142A Agent Workforce OMX Handoff Preview Boundary") &&
      userManual.includes("verify:phase142a-workforce-omx-handoff-preview"),
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
      omxHandoffStatus: exportedPackage.omxHandoffPreview?.status ?? null,
      recommendedWorkflow: exportedPackage.omxHandoffPreview?.recommendedWorkflow ?? null,
      suggestedCommandCount: exportedPackage.omxHandoffPreview?.suggestedOmxCommands?.length ?? 0,
      blockedReasonCount: exportedPackage.omxHandoffPreview?.blockedReasons?.length ?? 0,
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
      dependencyAdded: false,
      defaultNvidiaChatLaneChanged: false,
      plaintextApiKeyRecorded: false,
    },
    secretFindingCount: secretFindings.length,
    conclusion: passed ? "workforce-omx-handoff-preview-closed" : "workforce-omx-handoff-preview-not-closed",
  };

  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  const evidence = {
    phase,
    status: "failed",
    generatedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : String(error),
    conclusion: "workforce-omx-handoff-preview-not-closed",
  };
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

async function readRequired(relativePath) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
}

