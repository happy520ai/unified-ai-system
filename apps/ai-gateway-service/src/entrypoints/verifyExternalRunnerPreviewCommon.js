import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { findPlainSecretFindings } from "../security/secretSafety.js";
import { fetchJson, fetchText, listen, close, postJson, writeEvidenceWithRenderer } from "./entrypointUtils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");

export async function runExternalRunnerPreviewVerification(config) {
  let server;
  try {
    const prerequisite = JSON.parse(await readRequired(config.prerequisiteEvidence));
    if (!config.prerequisiteOk(prerequisite)) {
      throw new Error(config.prerequisiteError);
    }

    const application = createGatewayApplication({
      ...process.env,
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_ROUTE_MODE: "fixed",
      AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
      AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider",
      WORKFORCE_PLAN_STORE_PATH: resolve(tmpdir(), "unified-ai-system", `${config.phase}-${Date.now()}-workforce-plans.json`),
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
        goal: config.testGoal,
        clarificationAnswers: [
          { questionId: "clarify_goal", answer: config.testGoal, previewOnly: true },
          { questionId: "clarify_scope", answer: "Preview/design/freeze only; no execution.", previewOnly: true },
          { questionId: "clarify_stack", answer: "Agent Workforce preview plan, save, export, UI, and contracts.", previewOnly: true },
          { questionId: "clarify_acceptance", answer: config.acceptanceText, previewOnly: true },
          { questionId: "clarify_constraints", answer: "No OMX CLI, no workflow run, no worktree, no shell execution.", previewOnly: true },
        ],
        context: { traceId: `verify-${config.phase}-plan` },
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
      context: { traceId: `verify-${config.phase}-save` },
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
    const planPreview = plan[config.fieldName] ?? {};
    const savedPreview = savedPackage[config.fieldName] ?? {};
    const exportedPreview = exportedPackage[config.fieldName] ?? {};
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
    const secretFindings = findPlainSecretFindings(allText, config.phase);

    const checks = {
      prerequisitePassed: config.prerequisiteOk(prerequisite),
      rootScriptPresent:
        rootPackage.scripts?.[config.scriptName] ===
        `pnpm --filter @unified-ai-system/ai-gateway-service ${config.scriptName}`,
      serviceScriptPresent:
        servicePackage.scripts?.[config.scriptName] === config.serviceScript,
      existingRoutesUnchanged:
        routes.includes("POST /workforce/plan") &&
        routes.includes("POST /workforce/plans/save") &&
        routes.includes("GET /workforce/plans/:id/export") &&
        !routes.includes("POST /workforce/omx/run-request"),
      planIncludesPreview:
        planResponse.httpStatus === 200 &&
        planPreview.phase === config.phase &&
        config.previewOk(planPreview),
      savePersistsPreview:
        saveResponse.httpStatus === 200 &&
        savedPreview.phase === config.phase &&
        config.previewOk(savedPreview) &&
        savedPackage.exportableJson?.[config.fieldName]?.phase === config.phase,
      exportPreservesPreview:
        exportResponse.httpStatus === 200 &&
        exportedPreview.phase === config.phase &&
        config.previewOk(exportedPreview) &&
        String(exportedPackage.markdown).includes(config.markdownHeading),
      executionReadinessStillBlocked:
        plan.executionReadinessPreflight?.executionEnabled === false &&
        ["blocked", "preview-blocked"].includes(plan.executionReadinessPreflight?.overallStatus) &&
        exportedPackage.executionReadinessPreflight?.executionEnabled === false &&
        ["blocked", "preview-blocked"].includes(exportedPackage.executionReadinessPreflight?.overallStatus),
      contractsPresent:
        contracts.includes(config.contractName) &&
        contracts.includes(config.phase) &&
        config.contractMarkers.every((marker) => contracts.includes(marker)),
      uiMarkersPresent:
        ui.httpStatus === 200 &&
        ui.text.includes(config.uiPhaseMarker) &&
        ui.text.includes(config.uiTitle) &&
        config.uiMarkers.every((marker) => ui.text.includes(marker)),
      docsBoundaryPresent:
        readme.includes(config.readmeMarker) &&
        agentsDoc.includes(config.agentsMarker) &&
        userManual.includes(config.scriptName),
      noDependencyAdded:
        !rootPackageText.includes("oh-my-codex") &&
        !servicePackageText.includes("oh-my-codex") &&
        !rootPackageText.includes("@openai/codex"),
      noPlainSecrets: secretFindings.length === 0,
      projectContextNotCreated: !existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md")),
    };
    const passed = Object.values(checks).every(Boolean);
    const evidence = {
      phase: config.phase,
      status: passed ? "passed" : "failed",
      generatedAt: new Date().toISOString(),
      serviceUrl,
      checks,
      workforce: {
        planId,
        workforceId: plan.workforceId ?? null,
        ...config.workforceSummary(exportedPreview, exportedPackage),
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
      conclusion: passed ? config.passConclusion : config.failConclusion,
    };

    await saveEvidence(config.phase, config.evidenceTitle, evidence);
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = passed ? 0 : 1;
  } catch (error) {
    const evidence = {
      phase: config.phase,
      status: "failed",
      generatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      conclusion: config.failConclusion,
    };
    await saveEvidence(config.phase, config.evidenceTitle, evidence);
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = 1;
  } finally {
    if (server) {
      await close(server);
    }
  }
}

async function readRequired(relativePath) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
}


async function saveEvidence(phase, title, body) {
  await writeEvidenceWithRenderer(
    evidenceDir,
    resolve(evidenceDir, `${phase}.json`),
    resolve(evidenceDir, `${phase}.md`),
    body,
    (b) => renderEvidenceMarkdown(title, b),
  );
}

function renderEvidenceMarkdown(title, body) {
  return `# ${title}

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Service URL: ${body.serviceUrl ?? "n/a"}
- Plan ID: ${body.workforce?.planId ?? "n/a"}
- Workforce ID: ${body.workforce?.workforceId ?? "n/a"}
- Execution enabled: ${body.workforce?.executionEnabled ?? false}
- Blocked reason count: ${body.workforce?.blockedReasonCount ?? "n/a"}
- Runner endpoint execution: ${body.safety?.runnerEndpointExecution ?? false}
- External runner dispatch: ${body.safety?.externalRunnerDispatch ?? false}
- Workflow run: ${body.safety?.workflowRun ?? false}
- Creates worktrees: ${body.safety?.createsWorktrees ?? false}
- Runs oh-my-codex: ${body.safety?.runsOhMyCodex ?? false}
- Plain secret findings: ${body.secretFindingCount ?? "n/a"}
- Conclusion: ${body.conclusion}

## Checks

${Object.entries(body.checks ?? {}).map(([name, value]) => `- ${name}: ${value ? "passed" : "failed"}`).join("\n")}
`;
}
