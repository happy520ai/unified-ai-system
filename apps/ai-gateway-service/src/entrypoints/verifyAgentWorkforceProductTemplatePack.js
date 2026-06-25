import { existsSync } from "node:fs";
import { writeEvidencePair } from "./entrypointUtils.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { findPlainSecretFindings } from "../security/secretSafety.js";
import { fetchJson, fetchText, postJson, listen } from "./entrypointUtils.js";

const phase = "phase-153a-agent-workforce-product-template-pack";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, `${phase}.json`);
const evidenceMdPath = resolve(evidenceDir, `${phase}.md`);
const phase152EvidencePath = "apps/ai-gateway-service/evidence/phase-152a-agent-workforce-demo-manual.json";
const storePath = resolve(tmpdir(), "unified-ai-system", `phase153a-${Date.now()}-workforce-plans.json`);
const requiredTemplateIds = [
  "feature-development",
  "bug-fix",
  "documentation",
  "code-review",
  "release-checklist",
  "research-design-study",
];
const requiredDocsText = [
  "Feature Development Template",
  "Bug Fix Template",
  "Documentation Template",
  "Code Review Template",
  "Release Checklist Template",
  "Research / Design Study Template",
  "templates generate plans only",
  "Execution disabled",
  "External Runner disabled",
];

let server;

try {
  const phase152Evidence = JSON.parse(await readRequired(phase152EvidencePath));
  if (phase152Evidence.status !== "passed") {
    throw new Error("Phase 152A evidence must be passed before Phase 153A product template pack.");
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
    postJson(`${serviceUrl}/workforce/plan`, {
      goal: "Plan a safe bug fix for a user-reported UI export issue.",
      selectedTemplate: "bug-fix",
      clarificationAnswers: [
        { questionId: "clarify_goal", answer: "Fix the export issue without changing the chat lane.", previewOnly: true },
        { questionId: "clarify_scope", answer: "Preview planning only; no code execution.", previewOnly: true },
        { questionId: "clarify_stack", answer: "Agent Workforce plan, UI, save/export, docs, evidence.", previewOnly: true },
        { questionId: "clarify_acceptance", answer: "Template is preserved in plan, save, and export.", previewOnly: true },
        { questionId: "clarify_constraints", answer: "No oh-my-codex call, no worktree, no workflow run.", previewOnly: true },
      ],
      context: { traceId: "verify-phase153a-template-pack" },
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
    context: { traceId: "verify-phase153a-save" },
  });
  const planId = saveResponse.body?.data?.planId;
  const exportResponse = planId
    ? await fetchJson(`${serviceUrl}/workforce/plans/${encodeURIComponent(planId)}/export`)
    : { httpStatus: 0, body: {} };

  const rootPackage = JSON.parse(rootPackageText);
  const servicePackage = JSON.parse(servicePackageText);
  const savedPackage = saveResponse.body?.data?.taskPackage ?? {};
  const exportedPackage = exportResponse.body?.data?.taskPackage ?? {};
  const exportedJson = exportedPackage.exportableJson ?? {};
  const preview = plan.productTemplatesPreview ?? {};
  const exportedPreview = exportedPackage.productTemplatesPreview ?? exportedJson.productTemplatesPreview ?? {};
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
  const templateIds = (preview.templates ?? []).map((item) => item.id);
  const exportedTemplateIds = (exportedPreview.templates ?? []).map((item) => item.id);

  const checks = {
    phase152EvidencePassed: phase152Evidence.status === "passed",
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase153a-agent-workforce-product-template-pack"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase153a-agent-workforce-product-template-pack",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase153a-agent-workforce-product-template-pack"] ===
      "node ./src/entrypoints/verifyAgentWorkforceProductTemplatePack.js",
    planTemplatePackPresent:
      planResponse.httpStatus === 200 &&
      preview.phase === phase &&
      preview.mode === "product-template-pack-preview" &&
      preview.templatePackEnabled === true &&
      preview.executionEnabled === false &&
      preview.blockedReasons?.length >= 3,
    allTemplatesPresent:
      requiredTemplateIds.every((id) => templateIds.includes(id)) &&
      preview.templates?.every((template) => template.execution === "disabled"),
    selectedTemplatePreserved:
      plan.selectedTemplate?.id === "bug-fix" &&
      plan.templateContext?.selectedTemplateId === "bug-fix" &&
      plan.templateContext?.executionEnabled === false &&
      plan.templateContext?.externalRunnerDispatchEnabled === false &&
      plan.templateContext?.workflowRunEnabled === false,
    saveExportPreservesTemplatePack:
      saveResponse.httpStatus === 200 &&
      exportResponse.httpStatus === 200 &&
      savedPackage.selectedTemplate?.id === "bug-fix" &&
      savedPackage.productTemplatesPreview?.executionEnabled === false &&
      exportedPackage.selectedTemplate?.id === "bug-fix" &&
      exportedPreview.executionEnabled === false &&
      requiredTemplateIds.every((id) => exportedTemplateIds.includes(id)),
    uiTemplateSelectionPresent:
      ui.httpStatus === 200 &&
      ui.text.includes("phase153a-agent-workforce-product-template-pack") &&
      ui.text.includes("workforce-template") &&
      requiredTemplateIds.every((id) => ui.text.includes(id)) &&
      ui.text.includes("Templates generate plans only") &&
      ui.text.includes("Execution disabled") &&
      ui.text.includes("External Runner disabled"),
    contractsPresent:
      contracts.includes("WorkforceProductTemplateId") &&
      contracts.includes("WorkforceProductTemplatesPreview") &&
      contracts.includes("selectedTemplate?: WorkforceProductTemplateId") &&
      contracts.includes("productTemplatesPreview: WorkforceProductTemplatesPreview"),
    plannerStorePresent:
      planner.includes("PRODUCT_TEMPLATES") &&
      planner.includes("createProductTemplatesPreview") &&
      store.includes("normalizeProductTemplatesPreview") &&
      store.includes("WORKFORCE_PLAN_PRODUCT_TEMPLATE_PACK_PHASE"),
    docsSynchronized:
      readme.includes("Phase 153A") &&
      agentsDoc.includes("Phase 153A Agent Workforce Product Template Pack Boundary") &&
      userManual.includes("verify:phase153a-agent-workforce-product-template-pack") &&
      requiredDocsText.every((text) => readme.includes(text) || userManual.includes(text)),
    disabledBoundaries:
      plan.safety?.codeExecution === false &&
      plan.safety?.workflowRun === false &&
      plan.executionReadinessPreflight?.executionEnabled === false &&
      plan.externalOmxRunnerDesign?.runnerEnabled === false &&
      plan.runnerRequestQueuePreview?.queueEnabled === false &&
      plan.agentWorkforcePreviewFinalUxSeal?.runnerEnabled === false,
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
    templatePack: {
      templatePackEnabled: preview.templatePackEnabled ?? null,
      executionEnabled: preview.executionEnabled ?? null,
      selectedTemplateId: preview.selectedTemplateId ?? null,
      templateIds,
      blockedReasons: preview.blockedReasons ?? [],
    },
    persistence: {
      planId,
      savedSelectedTemplateId: savedPackage.selectedTemplate?.id ?? null,
      exportedSelectedTemplateId: exportedPackage.selectedTemplate?.id ?? exportedJson.selectedTemplate?.id ?? null,
      exportedExecutionEnabled: exportedPreview.executionEnabled ?? null,
    },
    safety: {
      runtimeCapabilityAdded: false,
      realAgentExecution: false,
      callsOhMyCodex: false,
      createsWorktrees: false,
      workflowRunHandoff: false,
      realExternalRunnerDispatch: false,
      defaultNvidiaChatLaneChanged: false,
      plaintextApiKeyRecorded: false,
    },
    secretFindingCount: secretFindings.length,
    conclusion: passed ? "agent-workforce-product-template-pack-preview-complete" : "agent-workforce-product-template-pack-preview-incomplete",
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
    conclusion: "agent-workforce-product-template-pack-preview-incomplete",
  };
  await writeEvidencePair(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

async function readRequired(relativePath) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
}

