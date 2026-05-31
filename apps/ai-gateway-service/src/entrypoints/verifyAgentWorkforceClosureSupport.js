import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "../../../..");
export const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
export const templateIds = [
  "feature-development",
  "bug-fix",
  "documentation",
  "code-review",
  "release-checklist",
  "research-design-study",
];
export const evidencePhases142To156 = [
  "phase-142a-workforce-omx-handoff-preview",
  "phase-143a-role-tier-event-ledger",
  "phase-144a-execution-readiness-preflight",
  "phase-145a-external-omx-runner-design",
  "phase-146a-runner-request-review-queue",
  "phase-147a-execution-approval-record",
  "phase-148a-external-runner-protocol-freeze",
  "phase-149a-agent-workforce-preview-final-ux-seal",
  "phase-150a-agent-workforce-preview-acceptance-pack",
  "phase-151a-agent-workforce-stage-closure",
  "phase-152a-agent-workforce-demo-manual",
  "phase-153a-agent-workforce-product-template-pack",
  "phase-154a-template-acceptance-sample-plans",
  "phase-155a-template-export-copy-ux",
  "phase-156a-guided-onboarding-demo-dataset",
];
export const evidencePhases157To160 = [
  "phase-157a-agent-workforce-evidence-index",
  "phase-158a-product-readiness-known-limits",
  "phase-159a-agent-workforce-preview-rc-seal",
  "phase-160a-agent-workforce-final-closure",
];
export const evidencePhases161To180 = [
  "phase-161a-ui-information-architecture",
  "phase-162a-workforce-dashboard-summary-cards",
  "phase-163a-template-gallery-ux",
  "phase-164a-plan-output-readability",
  "phase-165a-review-approval-handoff-clarity",
  "phase-166a-saved-plans-history-ux",
  "phase-167a-export-handoff-package-manifest",
  "phase-168a-guided-demo-mode-polish",
  "phase-169a-user-manual-navigation",
  "phase-170a-readme-agents-boundary-sync",
  "phase-171a-verification-matrix",
  "phase-172a-local-operator-runbook",
  "phase-173a-manual-qa-checklist",
  "phase-174a-evidence-manifest-final",
  "phase-175a-agent-workforce-preview-rc2-seal",
  "phase-176a-install-start-use-path",
  "phase-177a-documentation-crosslink-index",
  "phase-178a-user-handoff-package",
  "phase-179a-full-preview-regression-sweep",
  "phase-180a-final-product-decision-gate",
];
export const evidencePhases142To180 = [
  ...evidencePhases142To156,
  ...evidencePhases157To160,
  ...evidencePhases161To180,
];

export async function readRequired(relativePath) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
}

export async function readEvidence(phase) {
  return JSON.parse(await readRequired(`apps/ai-gateway-service/evidence/${phase}.json`));
}

export async function assertEvidencePassed(phase) {
  const evidence = await readEvidence(phase);
  if (evidence.status !== "passed") {
    throw new Error(`${phase} evidence must be passed.`);
  }
  return evidence;
}

export async function writeEvidence(phase, body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resolve(evidenceDir, `${phase}.json`), `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(resolve(evidenceDir, `${phase}.md`), createEvidenceMarkdown(body), "utf8");
}

export function createEvidenceMarkdown(body) {
  return `# ${body.phase} Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Conclusion: ${body.conclusion}
- Execution enabled: ${body.disabledState?.executionEnabled ?? false}
- Runner enabled: ${body.disabledState?.runnerEnabled ?? false}
- Workflow run enabled: ${body.disabledState?.workflowRunEnabled ?? false}
- External runner dispatch enabled: ${body.disabledState?.externalRunnerDispatchEnabled ?? false}
- Calls oh-my-codex: ${body.safety?.callsOhMyCodex ?? false}
- Creates worktrees: ${body.safety?.createsWorktrees ?? false}
- Plain secret findings: ${body.secretFindingCount ?? "n/a"}

## Checks

${Object.entries(body.checks ?? {}).map(([name, value]) => `- ${name}: ${value ? "passed" : "failed"}`).join("\n")}

## Notes

${(body.notes ?? []).map((item) => `- ${item}`).join("\n")}
`;
}

export async function readWorkspaceTexts() {
  const [
    rootPackageText,
    servicePackageText,
    contracts,
    planner,
    store,
    ui,
    readme,
    agentsDoc,
    userManual,
  ] = await Promise.all([
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired("packages/shared-contracts/src/contracts/workforce.ts"),
    readRequired("apps/ai-gateway-service/src/workforce/workforcePlanner.js"),
    readRequired("apps/ai-gateway-service/src/workforce/workforcePlanStore.js"),
    readRequired("apps/ai-gateway-service/src/ui/consolePage.js"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
  ]);
  return {
    rootPackageText,
    servicePackageText,
    rootPackage: JSON.parse(rootPackageText),
    servicePackage: JSON.parse(servicePackageText),
    contracts,
    planner,
    store,
    ui,
    readme,
    agentsDoc,
    userManual,
  };
}

export function createDisabledState() {
  return {
    executionEnabled: false,
    runnerEnabled: false,
    workflowRunEnabled: false,
    externalRunnerDispatchEnabled: false,
  };
}

export function createSafety() {
  return {
    runtimeCapabilityAdded: false,
    realAgentExecution: false,
    callsOhMyCodex: false,
    createsWorktrees: false,
    workflowRunHandoff: false,
    realExternalRunnerDispatch: false,
    defaultNvidiaChatLaneChanged: false,
    plaintextApiKeyRecorded: false,
  };
}

export function noProjectContext() {
  return !existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md"));
}

export function noOhMyCodexDependency(rootPackageText, servicePackageText) {
  return !rootPackageText.includes("oh-my-codex") &&
    !servicePackageText.includes("oh-my-codex") &&
    !rootPackageText.includes("@openai/codex");
}

export function countSecretFindings(text, phase) {
  return findPlainSecretFindings(text, phase).length;
}

export async function createPreviewPlan({ phase, selectedTemplate = "feature-development", goal }) {
  const storePath = resolve(tmpdir(), "unified-ai-system", `${phase}-${Date.now()}-workforce-plans.json`);
  const application = createGatewayApplication({
    ...process.env,
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "fixed",
    AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider",
    WORKFORCE_PLAN_STORE_PATH: storePath,
  });
  const server = createGatewayHttpServer(application);
  await listen(server, 0, "127.0.0.1");
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const planResponse = await postJson(`${serviceUrl}/workforce/plan`, {
      goal,
      selectedTemplate,
      clarificationAnswers: [
        { questionId: "clarify_goal", answer: "Preview product closure planning.", previewOnly: true },
        { questionId: "clarify_scope", answer: "Preview only; no execution.", previewOnly: true },
        { questionId: "clarify_stack", answer: "Agent Workforce plan, UI, docs, export, evidence.", previewOnly: true },
        { questionId: "clarify_acceptance", answer: "Disabled states remain false.", previewOnly: true },
        { questionId: "clarify_constraints", answer: "No oh-my-codex, no worktree, no workflow run.", previewOnly: true },
      ],
      context: { traceId: phase },
    });
    const plan = planResponse.body?.data ?? {};
    const saveResponse = await postJson(`${serviceUrl}/workforce/plans/save`, {
      plan,
      context: { traceId: `${phase}-save` },
    });
    const planId = saveResponse.body?.data?.planId;
    const exportResponse = planId
      ? await fetchJson(`${serviceUrl}/workforce/plans/${encodeURIComponent(planId)}/export`)
      : { httpStatus: 0, body: {} };
    const uiResponse = await fetchText(`${serviceUrl}/ui`);
    return { serviceUrl, planResponse, plan, saveResponse, exportResponse, uiResponse };
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
}

function listen(httpServer, port, host) {
  return new Promise((resolveListen, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, host, () => {
      httpServer.off("error", reject);
      resolveListen();
    });
  });
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
  return {
    httpStatus: response.status,
    body: await response.json(),
  };
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return {
    httpStatus: response.status,
    body: await response.json(),
  };
}
