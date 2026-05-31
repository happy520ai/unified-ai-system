import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const phase = "phase-151a-agent-workforce-stage-closure";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, `${phase}.json`);
const evidenceMdPath = resolve(evidenceDir, `${phase}.md`);
const closureDecisionPath = "docs/AGENT_WORKFORCE_PREVIEW_STAGE_CLOSURE_DECISION.md";
const requiredEvidence = [
  "apps/ai-gateway-service/evidence/phase-142a-workforce-omx-handoff-preview.json",
  "apps/ai-gateway-service/evidence/phase-143a-role-tier-event-ledger.json",
  "apps/ai-gateway-service/evidence/phase-144a-execution-readiness-preflight.json",
  "apps/ai-gateway-service/evidence/phase-145a-external-omx-runner-design.json",
  "apps/ai-gateway-service/evidence/phase-146a-runner-request-review-queue.json",
  "apps/ai-gateway-service/evidence/phase-147a-execution-approval-record.json",
  "apps/ai-gateway-service/evidence/phase-148a-external-runner-protocol-freeze.json",
  "apps/ai-gateway-service/evidence/phase-149a-agent-workforce-preview-final-ux-seal.json",
  "apps/ai-gateway-service/evidence/phase-150a-agent-workforce-preview-acceptance-pack.json",
];
const completedCapabilities = [
  "omxHandoffPreview",
  "roleTiers",
  "eventLedgerPreview",
  "hudPreview",
  "executionReadinessPreflight",
  "externalOmxRunnerDesign",
  "runnerRequestQueuePreview",
  "executionApprovalRecordPreview",
  "externalRunnerProtocolFreeze",
  "agentWorkforcePreviewFinalUxSeal",
];
const followUpOptions = [
  "Option A: Continue documentation, demo, and user manual enhancement.",
  "Option B: Enter real External Runner Enablement Planning, still without execution.",
  "Option C: Return to ordinary product capability enhancement, such as plan templates, project templates, and export experience.",
  "Option D: Pause Agent Workforce and switch back to another mainline.",
];

try {
  const [
    closureDecision,
    acceptancePack,
    readme,
    agentsDoc,
    userManual,
    rootPackageText,
    servicePackageText,
    ...evidenceTexts
  ] = await Promise.all([
    readRequired(closureDecisionPath),
    readRequired("docs/AGENT_WORKFORCE_PREVIEW_ACCEPTANCE_PACK.md"),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    ...requiredEvidence.map((path) => readRequired(path)),
  ]);
  const priorEvidence = evidenceTexts.map((text) => JSON.parse(text));
  const phase150 = priorEvidence.find((item) => item.phase === "phase-150a-agent-workforce-preview-acceptance-pack");
  const phase149 = priorEvidence.find((item) => item.phase === "phase-149a-agent-workforce-preview-final-ux-seal");
  const rootPackage = JSON.parse(rootPackageText);
  const servicePackage = JSON.parse(servicePackageText);
  const allText = [
    closureDecision,
    acceptancePack,
    readme,
    agentsDoc,
    userManual,
    rootPackageText,
    servicePackageText,
  ].join("\n\n");
  const secretFindings = findPlainSecretFindings(allText, phase);

  const checks = {
    phase150EvidencePassed: phase150?.status === "passed",
    phase149DisabledStateStillPresent:
      phase149?.workforce?.executionEnabled === false &&
      phase149?.workforce?.runnerEnabled === false &&
      phase149?.workforce?.workflowRunEnabled === false &&
      phase149?.workforce?.externalRunnerDispatchEnabled === false &&
      phase149?.workforce?.omxExecutionEnabled === false,
    priorEvidencePresentAndPassed: priorEvidence.every((item) => item.status === "passed"),
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase151a-agent-workforce-stage-closure"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase151a-agent-workforce-stage-closure",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase151a-agent-workforce-stage-closure"] ===
      "node ./src/entrypoints/verifyAgentWorkforceStageClosure.js",
    closureConclusionPresent:
      closureDecision.includes("Agent Workforce Preview + OMX-compatible handoff line can be stage-closed as a preview/design product baseline.") &&
      closureDecision.includes("It does not enable real Agent execution, does not call oh-my-codex, does not create worktrees, does not dispatch workflow runs, and does not change the default NVIDIA /chat lane."),
    capabilityScopePresent: completedCapabilities.every((item) => closureDecision.includes(item)),
    evidenceIndexPresent: requiredEvidence.every((path) => closureDecision.includes(path.split("/").at(-1))),
    userAcceptanceReferenced:
      closureDecision.includes("cmd /c pnpm verify:phase150a-agent-workforce-preview-acceptance-pack") &&
      closureDecision.includes("agent-workforce-preview-acceptance-pack-sealed") &&
      acceptancePack.includes("Agent Workforce Preview is an AI team planning"),
    boundariesPresent:
      closureDecision.includes("Execution disabled") &&
      closureDecision.includes("External Runner disabled") &&
      closureDecision.includes("Workflow run handoff disabled") &&
      closureDecision.includes("Approval-preview is not execution approval") &&
      closureDecision.includes("No oh-my-codex runtime call") &&
      closureDecision.includes("No worktree creation") &&
      closureDecision.includes("No default NVIDIA /chat lane change"),
    nonGoalsPresent:
      closureDecision.includes("No runtime Agent executor") &&
      closureDecision.includes("No external runner dispatch endpoint") &&
      closureDecision.includes("No security approval for real execution"),
    blockersPresent:
      closureDecision.includes("Real Agent execution remains disabled") &&
      closureDecision.includes("External runner dispatch remains disabled") &&
      closureDecision.includes("Workflow run handoff remains disabled") &&
      closureDecision.includes("Task claim tokens are not implemented"),
    followUpOptionsPresent: followUpOptions.every((option) => closureDecision.includes(option)),
    recommendedRoutePresent:
      closureDecision.includes("Pause real execution expansion and prioritize product demos and user manual enhancement") &&
      closureDecision.includes("explicit approval to enter real External Runner Enablement Planning"),
    docsSynchronized:
      readme.includes("Phase 151A") &&
      agentsDoc.includes("Phase 151A Agent Workforce Preview Stage Closure Decision Boundary") &&
      userManual.includes("verify:phase151a-agent-workforce-stage-closure"),
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
    closureDecisionPath,
    checks,
    stageClosureConclusion: "preview/design product baseline",
    completedCapabilities,
    evidenceIndex: requiredEvidence,
    userAcceptanceReference: {
      phase: "phase-150a-agent-workforce-preview-acceptance-pack",
      status: phase150?.status ?? "missing",
      conclusion: phase150?.conclusion ?? null,
    },
    boundaries: {
      executionEnabled: false,
      runnerEnabled: false,
      workflowRunEnabled: false,
      externalRunnerDispatchEnabled: false,
      omxExecutionEnabled: false,
      approvalPreviewIsExecutionPermission: false,
      defaultNvidiaChatLaneChanged: false,
    },
    followUpOptions,
    recommendedDefaultRoute:
      "Pause real execution expansion and prioritize product demos and user manual enhancement unless explicitly approved to enter real External Runner Enablement Planning.",
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
    conclusion: passed
      ? "agent-workforce-preview-stage-closed-as-preview-design-baseline"
      : "agent-workforce-preview-stage-closure-not-sealed",
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
    conclusion: "agent-workforce-preview-stage-closure-not-sealed",
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}

async function readRequired(relativePath) {
  return readFile(resolve(repoRoot, relativePath), "utf8");
}

async function writeEvidence(body) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, createEvidenceMarkdown(body), "utf8");
}

function createEvidenceMarkdown(body) {
  return `# Phase 151A Agent Workforce Preview Stage Closure Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Closure decision: ${body.closureDecisionPath ?? "n/a"}
- Stage closure conclusion: ${body.stageClosureConclusion ?? "n/a"}
- Phase 150A acceptance status: ${body.userAcceptanceReference?.status ?? "n/a"}
- Phase 150A acceptance conclusion: ${body.userAcceptanceReference?.conclusion ?? "n/a"}
- Execution enabled: ${body.boundaries?.executionEnabled ?? false}
- Runner enabled: ${body.boundaries?.runnerEnabled ?? false}
- Workflow run enabled: ${body.boundaries?.workflowRunEnabled ?? false}
- External runner dispatch enabled: ${body.boundaries?.externalRunnerDispatchEnabled ?? false}
- OMX execution enabled: ${body.boundaries?.omxExecutionEnabled ?? false}
- Calls oh-my-codex: ${body.safety?.callsOhMyCodex ?? false}
- Creates worktrees: ${body.safety?.createsWorktrees ?? false}
- Default NVIDIA chat lane changed: ${body.safety?.defaultNvidiaChatLaneChanged ?? false}
- Plain secret findings: ${body.secretFindingCount ?? "n/a"}
- Conclusion: ${body.conclusion}

## Completed Capabilities

${(body.completedCapabilities ?? []).map((item) => `- ${item}`).join("\n")}

## Evidence Index

${(body.evidenceIndex ?? []).map((item) => `- ${item}`).join("\n")}

## Follow-Up Options

${(body.followUpOptions ?? []).map((item) => `- ${item}`).join("\n")}

## Recommended Default Route

${body.recommendedDefaultRoute ?? "n/a"}

## Checks

${Object.entries(body.checks ?? {}).map(([name, value]) => `- ${name}: ${value ? "passed" : "failed"}`).join("\n")}
`;
}
