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

const phase = "phase-149a-agent-workforce-preview-final-ux-seal";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, `${phase}.json`);
const evidenceMdPath = resolve(evidenceDir, `${phase}.md`);
const storePath = resolve(tmpdir(), "unified-ai-system", `phase149a-${Date.now()}-workforce-plans.json`);
const coveredPhaseEvidence = [
  "apps/ai-gateway-service/evidence/phase-142a-workforce-omx-handoff-preview.json",
  "apps/ai-gateway-service/evidence/phase-143a-role-tier-event-ledger.json",
  "apps/ai-gateway-service/evidence/phase-144a-execution-readiness-preflight.json",
  "apps/ai-gateway-service/evidence/phase-145a-external-omx-runner-design.json",
  "apps/ai-gateway-service/evidence/phase-146a-runner-request-review-queue.json",
  "apps/ai-gateway-service/evidence/phase-147a-execution-approval-record.json",
  "apps/ai-gateway-service/evidence/phase-148a-external-runner-protocol-freeze.json",
];
const requiredFields = [
  "omxHandoffPreview",
  "roleTiers",
  "eventLedgerPreview",
  "workforceHudPreview",
  "executionReadinessPreflight",
  "externalOmxRunnerDesign",
  "runnerRequestQueuePreview",
  "executionApprovalRecordPreview",
  "externalRunnerProtocolFreeze",
  "agentWorkforcePreviewFinalUxSeal",
];

let server;

try {
  const priorEvidence = await Promise.all(coveredPhaseEvidence.map(async (path) => JSON.parse(await readRequired(path))));
  if (!priorEvidence.every((item) => item.status === "passed")) {
    throw new Error("Phase 142A-148A evidence must all be passed before Phase 149A final UX seal.");
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
      goal: "Seal the Agent Workforce preview UX without enabling execution.",
      clarificationAnswers: [
        { questionId: "clarify_goal", answer: "Final UX seal for Agent Workforce Preview.", previewOnly: true },
        { questionId: "clarify_scope", answer: "Preview/design/freeze only; no execution.", previewOnly: true },
        { questionId: "clarify_stack", answer: "Agent Workforce plan, save, export, UI, docs, contracts, evidence.", previewOnly: true },
        { questionId: "clarify_acceptance", answer: "Verify all 142A-148A fields and disabled states.", previewOnly: true },
        { questionId: "clarify_constraints", answer: "No OMX CLI, no Agent execution, no worktree, no workflow run.", previewOnly: true },
      ],
      context: { traceId: "verify-phase149a-plan" },
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
    context: { traceId: "verify-phase149a-save" },
  });
  const planId = saveResponse.body?.data?.planId;
  const exportResponse = planId
    ? await fetchJson(`${serviceUrl}/workforce/plans/${encodeURIComponent(planId)}/export`)
    : { httpStatus: 0, body: {} };

  const rootPackage = JSON.parse(rootPackageText);
  const servicePackage = JSON.parse(servicePackageText);
  const savedPackage = saveResponse.body?.data?.taskPackage ?? {};
  const exportedPackage = exportResponse.body?.data?.taskPackage ?? {};
  const exported = exportedPackage.exportableJson ?? {};
  const seal = exportedPackage.agentWorkforcePreviewFinalUxSeal ?? {};
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
    prerequisitesPassed: priorEvidence.every((item) => item.status === "passed"),
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase149a-agent-workforce-preview-final-ux-seal"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase149a-agent-workforce-preview-final-ux-seal",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase149a-agent-workforce-preview-final-ux-seal"] ===
      "node ./src/entrypoints/verifyAgentWorkforcePreviewFinalUxSeal.js",
    existingRoutesUnchanged:
      routes.includes("POST /workforce/plan") &&
      routes.includes("POST /workforce/plans/save") &&
      routes.includes("GET /workforce/plans/:id/export") &&
      !routes.includes("POST /workforce/omx/run-request"),
    planIncludesAllPreviewFields:
      planResponse.httpStatus === 200 &&
      requiredFields.every((field) => Boolean(plan[field])) &&
      Array.isArray(plan.roleTiers) &&
      Array.isArray(plan.eventLedgerPreview),
    saveExportPreservesAllPreviewFields:
      saveResponse.httpStatus === 200 &&
      exportResponse.httpStatus === 200 &&
      requiredFields.every((field) => Boolean(savedPackage[field] ?? savedPackage.exportableJson?.[field])) &&
      requiredFields.every((field) => Boolean(exportedPackage[field] ?? exported[field])),
    finalSealSafetyState:
      seal.phase === phase &&
      seal.sealed === true &&
      seal.previewOnly === true &&
      seal.executionEnabled === false &&
      seal.runnerEnabled === false &&
      seal.workflowRunEnabled === false &&
      seal.externalRunnerDispatchEnabled === false &&
      seal.omxExecutionEnabled === false &&
      seal.blockedReasons?.length >= 5,
    disabledExecutionState:
      exportedPackage.executionReadinessPreflight?.executionEnabled === false &&
      exportedPackage.externalOmxRunnerDesign?.runnerEnabled === false &&
      exportedPackage.runnerRequestQueuePreview?.queueEnabled === false &&
      exportedPackage.executionApprovalRecordPreview?.approvalRecordEnabled === false &&
      exportedPackage.externalRunnerProtocolFreeze?.runnerEnabled === false &&
      exportedPackage.workforceHudPreview?.workflowHandoff?.enabled === false &&
      exportedPackage.workforceHudPreview?.execution?.status === "disabled",
    uiFinalUxWordingPresent:
      ui.httpStatus === 200 &&
      ui.text.includes("phase149a-agent-workforce-preview-final-ux-seal") &&
      ui.text.includes("Agent Workforce is preview-only") &&
      ui.text.includes("OMX Handoff is a task package / handoff preview") &&
      ui.text.includes("Execution disabled") &&
      ui.text.includes("External Runner disabled"),
    docsBoundaryPresent:
      readme.includes("Phase 149A") &&
      agentsDoc.includes("Phase 149A Agent Workforce Preview Final UX Seal Boundary") &&
      userManual.includes("verify:phase149a-agent-workforce-preview-final-ux-seal"),
    contractsPresent:
      contracts.includes("WorkforcePreviewFinalUxSeal") &&
      contracts.includes("phase-149a-agent-workforce-preview-final-ux-seal") &&
      contracts.includes("externalRunnerDispatchEnabled: false"),
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
    coveredCapabilities: [
      "omxHandoffPreview",
      "roleTiers",
      "eventLedgerPreview",
      "hudPreview",
      "executionReadinessPreflight",
      "externalOmxRunnerDesign",
      "runnerRequestQueuePreview",
      "executionApprovalRecordPreview",
      "externalRunnerProtocolFreeze",
    ],
    userPath: seal.userPath ?? [],
    workforce: {
      planId,
      workforceId: plan.workforceId ?? null,
      sealed: seal.sealed ?? null,
      previewOnly: seal.previewOnly ?? null,
      executionEnabled: seal.executionEnabled ?? null,
      runnerEnabled: seal.runnerEnabled ?? null,
      workflowRunEnabled: seal.workflowRunEnabled ?? null,
      externalRunnerDispatchEnabled: seal.externalRunnerDispatchEnabled ?? null,
      omxExecutionEnabled: seal.omxExecutionEnabled ?? null,
      blockedReasonCount: seal.blockedReasons?.length ?? 0,
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
      externalRunnerDispatch: false,
      installsOhMyCodex: false,
      runsOhMyCodex: false,
      dependencyAdded: false,
      defaultNvidiaChatLaneChanged: false,
      plaintextApiKeyRecorded: false,
    },
    secretFindingCount: secretFindings.length,
    conclusion: passed ? "agent-workforce-preview-final-ux-seal-closed" : "agent-workforce-preview-final-ux-seal-not-closed",
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
    conclusion: "agent-workforce-preview-final-ux-seal-not-closed",
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

