import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const phase = "phase-143a-role-tier-event-ledger";
const prerequisitePhase = "phase-142a-workforce-omx-handoff-preview";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, `${phase}.json`);
const evidenceMdPath = resolve(evidenceDir, `${phase}.md`);
const storePath = resolve(tmpdir(), "unified-ai-system", `phase143a-${Date.now()}-workforce-plans.json`);
const testGoal = "Prepare role tiers, event ledger preview, and Agent Workforce HUD status without execution.";
const expectedEvents = [
  "workforce.plan.beforeCreate",
  "workforce.plan.afterCreate",
  "workforce.plan.beforeSave",
  "workforce.plan.afterSave",
  "workforce.plan.beforeExport",
  "workforce.review.requested",
  "workforce.approval.recorded",
  "workforce.workflowRun.blocked",
  "workforce.omxHandoff.generated",
];

let server;

try {
  const prerequisiteText = await readRequired("apps/ai-gateway-service/evidence/phase-142a-workforce-omx-handoff-preview.json");
  const prerequisite = JSON.parse(prerequisiteText);
  if (prerequisite.status !== "passed") {
    throw new Error("Phase 142A prerequisite evidence is not passed; stop before Phase 143A.");
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
    { questionId: "clarify_goal", answer: "Show role tiers, event ledger, and HUD as preview only.", previewOnly: true },
    { questionId: "clarify_scope", answer: "No true hooks, no workers, no workflow run, no worktrees.", previewOnly: true },
    { questionId: "clarify_stack", answer: "Use Agent Workforce planner, store, contracts, UI, and docs.", previewOnly: true },
    { questionId: "clarify_acceptance", answer: "Verify plan/save/export/UI/docs/evidence fields and safety flags.", previewOnly: true },
    { questionId: "clarify_constraints", answer: "Do not invoke oh-my-codex or store plaintext secrets.", previewOnly: true },
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
    prerequisiteVerifier,
  ] = await Promise.all([
    fetchJson(`${serviceUrl}/health/check`),
    postJson(`${serviceUrl}/workforce/plan`, {
      goal: testGoal,
      clarificationAnswers,
      context: { traceId: "verify-phase143a-plan" },
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
    readRequired("apps/ai-gateway-service/src/entrypoints/verifyAgentWorkforceOmxHandoffPreview.js"),
  ]);

  const plan = planResponse.body?.data ?? {};
  const saveResponse = await postJson(`${serviceUrl}/workforce/plans/save`, {
    plan,
    context: { traceId: "verify-phase143a-save" },
  });
  const planId = saveResponse.body?.data?.planId;
  const approvalResponse = planId
    ? await postJson(`${serviceUrl}/workforce/plans/${encodeURIComponent(planId)}/approval-gate`, {
      decision: "approved-preview",
      reviewer: "phase143a-human-reviewer",
      note: "Preview approval recorded only; it does not grant execution.",
      context: { traceId: "verify-phase143a-approval" },
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
    prerequisiteVerifier,
    JSON.stringify(plan),
    JSON.stringify(saveResponse.body),
    JSON.stringify(approvalResponse.body),
    JSON.stringify(exportResponse.body),
  ].join("\n\n");
  const secretFindings = findPlainSecretFindings(allText, phase);

  const planEventNames = new Set((plan.eventLedgerPreview || []).map((item) => item.eventName));
  const exportedEventNames = new Set((exportedPackage.eventLedgerPreview || []).map((item) => item.eventName));
  const checks = {
    prerequisite142aPassed:
      prerequisite.phase === prerequisitePhase &&
      prerequisite.status === "passed" &&
      prerequisite.safety?.runsOhMyCodex === false,
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase143a-role-tier-event-ledger"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase143a-role-tier-event-ledger",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase143a-role-tier-event-ledger"] ===
      "node ./src/entrypoints/verifyAgentWorkforceRoleTierEventLedger.js",
    phase142AliasPresent:
      rootPackage.scripts?.["verify:phase142a-omx-handoff-preview"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase142a-omx-handoff-preview" &&
      servicePackage.scripts?.["verify:phase142a-omx-handoff-preview"] ===
      "node ./src/entrypoints/verifyAgentWorkforceOmxHandoffPreview.js",
    existingRoutesUnchanged:
      routes.includes("POST /workforce/plan") &&
      routes.includes("POST /workforce/plans/save") &&
      routes.includes("POST /workforce/plans/:id/approval-gate") &&
      routes.includes("GET /workforce/plans/:id/export"),
    planIncludesRoleTiers:
      planResponse.httpStatus === 200 &&
      plan.roleTiers?.length === 4 &&
      roleTierHas(plan.roleTiers, "Strategy", ["CEO", "PM"]) &&
      roleTierHas(plan.roleTiers, "Architecture", ["Architect"]) &&
      roleTierHas(plan.roleTiers, "Implementation Planning", ["Frontend Engineer", "Backend Engineer"]) &&
      roleTierHas(plan.roleTiers, "Quality", ["QA", "Reviewer"]) &&
      plan.roleTiers.every((tier) => tier.previewOnly === true && tier.workerExecution === false),
    planIncludesEventLedger:
      expectedEvents.every((eventName) => planEventNames.has(eventName)) &&
      plan.eventLedgerPreview?.every((item) => item.enabled === false && item.execution === "disabled" && item.reason.includes("no hook execution")),
    planIncludesHud:
      plan.workforceHudPreview?.phase === phase &&
      plan.workforceHudPreview?.status === "preview-only" &&
      plan.workforceHudPreview?.clarification?.answered === 5 &&
      plan.workforceHudPreview?.clarification?.total === 5 &&
      plan.workforceHudPreview?.consensus?.ready === true &&
      plan.workforceHudPreview?.workflowHandoff?.status === "disabled" &&
      plan.workforceHudPreview?.omxHandoff?.status === "preview-only" &&
      plan.workforceHudPreview?.execution?.status === "disabled",
    savePersistsRoleTierEventHud:
      saveResponse.httpStatus === 200 &&
      savedPackage.roleTiers?.length === 4 &&
      savedPackage.eventLedgerPreview?.some((item) => item.eventName === "workforce.plan.beforeSave") &&
      savedPackage.eventLedgerPreview?.some((item) => item.eventName === "workforce.plan.afterSave") &&
      savedPackage.workforceHudPreview?.execution?.status === "disabled" &&
      savedPackage.exportableJson?.roleTiers?.length === 4,
    approvalDoesNotGrantExecution:
      approvalResponse.httpStatus === 200 &&
      approvalPackage.approvalGatePreview?.currentDecision === "approved-preview" &&
      approvalPackage.workforceHudPreview?.approvalGate?.grantsExecution === false &&
      approvalPackage.workforceHudPreview?.execution?.status === "disabled" &&
      approvalPackage.eventLedgerPreview?.some((item) => item.eventName === "workforce.approval.recorded"),
    exportPreservesRoleTierEventHud:
      exportResponse.httpStatus === 200 &&
      exportedPackage.roleTiers?.length === 4 &&
      expectedEvents.every((eventName) => exportedEventNames.has(eventName)) &&
      exportedPackage.workforceHudPreview?.workflowHandoff?.status === "disabled" &&
      exportedPackage.workforceHudPreview?.execution?.status === "disabled" &&
      String(exportedPackage.markdown).includes("Role Tiers") &&
      String(exportedPackage.markdown).includes("Event Ledger Preview") &&
      String(exportedPackage.markdown).includes("Agent Workforce HUD Preview"),
    contractsPresent:
      contracts.includes("WorkforceRoleTier") &&
      contracts.includes("WorkforceEventLedgerPreview") &&
      contracts.includes("WorkforceHudPreview") &&
      contracts.includes("phase-143a-role-tier-event-ledger"),
    uiMarkersPresent:
      ui.httpStatus === 200 &&
      ui.text.includes("phase143a-role-tier-event-ledger") &&
      ui.text.includes("Phase143A Role Tiers Preview") &&
      ui.text.includes("Phase143A Event Ledger Preview") &&
      ui.text.includes("Phase143A Agent Workforce HUD Preview"),
    docsBoundaryPresent:
      readme.includes("Phase 143A") &&
      agentsDoc.includes("Phase 143A Agent Workforce Role Tier + Event Ledger Boundary") &&
      userManual.includes("verify:phase143a-role-tier-event-ledger"),
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
      roleTierCount: exportedPackage.roleTiers?.length ?? 0,
      eventLedgerCount: exportedPackage.eventLedgerPreview?.length ?? 0,
      hudPlanState: exportedPackage.workforceHudPreview?.planState ?? null,
      hudExecution: exportedPackage.workforceHudPreview?.execution?.status ?? null,
      approvalDecision: approvalPackage.approvalGatePreview?.currentDecision ?? null,
      approvalGrantsExecution: exportedPackage.workforceHudPreview?.approvalGate?.grantsExecution ?? false,
    },
    safety: {
      realLlmCalls: false,
      agentConcurrency: false,
      codeExecution: false,
      projectFileWrites: false,
      workflowRun: false,
      hookExecution: false,
      runtimeHookRegistration: false,
      createsWorktrees: false,
      installsOhMyCodex: false,
      runsOhMyCodex: false,
      dependencyAdded: false,
      defaultNvidiaChatLaneChanged: false,
      plaintextApiKeyRecorded: false,
    },
    secretFindingCount: secretFindings.length,
    conclusion: passed ? "workforce-role-tier-event-ledger-closed" : "workforce-role-tier-event-ledger-not-closed",
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
    conclusion: "workforce-role-tier-event-ledger-not-closed",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function roleTierHas(tiers, name, roles) {
  const tier = tiers?.find((item) => item.name === name);
  const tierRoles = new Set((tier?.roles || []).map((item) => item.role));
  return roles.every((role) => tierRoles.has(role));
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
  return `# Phase 143A Workforce Role Tier Event Ledger Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Plan ID: ${body.workforce?.planId ?? "n/a"}
- Workforce ID: ${body.workforce?.workforceId ?? "n/a"}
- Role tier count: ${body.workforce?.roleTierCount ?? "n/a"}
- Event ledger count: ${body.workforce?.eventLedgerCount ?? "n/a"}
- HUD plan state: ${body.workforce?.hudPlanState ?? "n/a"}
- HUD execution: ${body.workforce?.hudExecution ?? "n/a"}
- Approval decision: ${body.workforce?.approvalDecision ?? "n/a"}
- Approval grants execution: ${body.workforce?.approvalGrantsExecution ?? false}
- Hook execution: ${body.safety?.hookExecution ?? false}
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
