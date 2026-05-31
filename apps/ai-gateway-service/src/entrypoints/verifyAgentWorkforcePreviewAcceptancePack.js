import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const phase = "phase-150a-agent-workforce-preview-acceptance-pack";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, `${phase}.json`);
const evidenceMdPath = resolve(evidenceDir, `${phase}.md`);
const acceptancePackPath = "docs/AGENT_WORKFORCE_PREVIEW_ACCEPTANCE_PACK.md";
const requiredEvidence = [
  "apps/ai-gateway-service/evidence/phase-142a-workforce-omx-handoff-preview.json",
  "apps/ai-gateway-service/evidence/phase-143a-role-tier-event-ledger.json",
  "apps/ai-gateway-service/evidence/phase-144a-execution-readiness-preflight.json",
  "apps/ai-gateway-service/evidence/phase-145a-external-omx-runner-design.json",
  "apps/ai-gateway-service/evidence/phase-146a-runner-request-review-queue.json",
  "apps/ai-gateway-service/evidence/phase-147a-execution-approval-record.json",
  "apps/ai-gateway-service/evidence/phase-148a-external-runner-protocol-freeze.json",
  "apps/ai-gateway-service/evidence/phase-149a-agent-workforce-preview-final-ux-seal.json",
  "apps/ai-gateway-service/evidence/phase-107a-secret-safety.json",
  "apps/ai-gateway-service/evidence/phase-105a-user-journey.json",
];
const requiredCapabilities = [
  "omxHandoffPreview",
  "roleTiers",
  "eventLedgerPreview",
  "hudPreview",
  "executionReadinessPreflight",
  "externalOmxRunnerDesign",
  "runnerRequestQueuePreview",
  "executionApprovalRecordPreview",
  "externalRunnerProtocolFreeze",
];
const requiredChecklistItems = [
  "Can open /ui",
  "Can enter a goal and generate an Agent Workforce plan",
  "Can see the 7 preview roles and role tiers",
  "Can see clarification, consensus, and review package previews",
  "Can see approval gate preview",
  "Can see OMX handoff preview",
  "Can see execution readiness preflight blocked",
  "Can see external runner design, queue, approval, and protocol freeze previews",
  "Can save a plan",
  "Can view history",
  "Can export JSON and Markdown",
  "UI clearly shows Execution disabled",
  "UI clearly shows External Runner disabled",
];

try {
  const [
    acceptancePack,
    readme,
    agentsDoc,
    userManual,
    rootPackageText,
    servicePackageText,
    ...evidenceTexts
  ] = await Promise.all([
    readRequired(acceptancePackPath),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("docs/USER_MANUAL.md"),
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    ...requiredEvidence.map((path) => readRequired(path)),
  ]);
  const priorEvidence = evidenceTexts.map((text) => JSON.parse(text));
  const phase149 = priorEvidence.find((item) => item.phase === "phase-149a-agent-workforce-preview-final-ux-seal");
  const rootPackage = JSON.parse(rootPackageText);
  const servicePackage = JSON.parse(servicePackageText);
  const allText = [acceptancePack, readme, agentsDoc, userManual, rootPackageText, servicePackageText].join("\n\n");
  const secretFindings = findPlainSecretFindings(allText, phase);

  const checks = {
    phase149EvidencePassed: phase149?.status === "passed",
    priorEvidencePresentAndPassed: priorEvidence.every((item) => item.status === "passed"),
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase150a-agent-workforce-preview-acceptance-pack"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase150a-agent-workforce-preview-acceptance-pack",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase150a-agent-workforce-preview-acceptance-pack"] ===
      "node ./src/entrypoints/verifyAgentWorkforcePreviewAcceptancePack.js",
    productSummaryPresent:
      acceptancePack.includes("Agent Workforce Preview is an AI team planning, clarification, role assignment") &&
      acceptancePack.includes("does not execute code, call oh-my-codex, create worktrees, or dispatch real Agents"),
    userAndAdminPathsPresent:
      acceptancePack.includes("## Ordinary User Path") &&
      acceptancePack.includes("## Administrator / Developer Verification Path"),
    capabilitiesIndexed: requiredCapabilities.every((item) => acceptancePack.includes(item)),
    evidenceIndexPresent: requiredEvidence.every((path) => acceptancePack.includes(path.split("/").at(-1))),
    checklistComplete: requiredChecklistItems.every((item) => acceptancePack.includes(item)),
    boundariesPresent:
      acceptancePack.includes("No real Agent execution") &&
      acceptancePack.includes("No oh-my-codex runtime call") &&
      acceptancePack.includes("No worktree creation") &&
      acceptancePack.includes("No workflow run handoff") &&
      acceptancePack.includes("No default NVIDIA /chat lane change") &&
      acceptancePack.includes("Approval-preview is not execution approval"),
    blockerAndNextDecisionPresent:
      acceptancePack.includes("## Known Blockers") &&
      acceptancePack.includes("## Next Decision Point") &&
      acceptancePack.includes("Design external runner implementation"),
    docsSynchronized:
      readme.includes("Phase 150A") &&
      agentsDoc.includes("Phase 150A Agent Workforce Preview Acceptance Pack Boundary") &&
      userManual.includes("verify:phase150a-agent-workforce-preview-acceptance-pack"),
    disabledExecutionEvidence:
      phase149?.workforce?.executionEnabled === false &&
      phase149?.workforce?.runnerEnabled === false &&
      phase149?.workforce?.workflowRunEnabled === false &&
      phase149?.workforce?.externalRunnerDispatchEnabled === false &&
      phase149?.workforce?.omxExecutionEnabled === false,
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
    acceptancePackPath,
    checks,
    coveredCapabilities: requiredCapabilities,
    evidenceIndex: requiredEvidence,
    userAcceptanceChecklist: requiredChecklistItems,
    safety: {
      runtimeCapabilityAdded: false,
      realAgentExecution: false,
      callsOhMyCodex: false,
      createsWorktrees: false,
      workflowRunHandoff: false,
      realExternalRunnerDispatch: false,
      defaultNvidiaChatLaneChanged: false,
      approvalPreviewIsExecutionPermission: false,
      plaintextApiKeyRecorded: false,
    },
    disabledState: {
      executionEnabled: false,
      runnerEnabled: false,
      workflowRunEnabled: false,
      externalRunnerDispatchEnabled: false,
      omxExecutionEnabled: false,
    },
    knownBlockers: [
      "real Agent execution remains disabled",
      "external runner dispatch remains disabled",
      "workflow run handoff remains disabled",
      "worktree creation remains disabled",
      "approval-preview is not execution approval",
    ],
    recommendedNextStep: "Design external runner implementation only after an explicit new mainline approval.",
    secretFindingCount: secretFindings.length,
    conclusion: passed
      ? "agent-workforce-preview-acceptance-pack-sealed"
      : "agent-workforce-preview-acceptance-pack-not-sealed",
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
    conclusion: "agent-workforce-preview-acceptance-pack-not-sealed",
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
  return `# Phase 150A Agent Workforce Preview Acceptance Pack Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Acceptance pack: ${body.acceptancePackPath ?? "n/a"}
- Execution enabled: ${body.disabledState?.executionEnabled ?? false}
- Runner enabled: ${body.disabledState?.runnerEnabled ?? false}
- Workflow run enabled: ${body.disabledState?.workflowRunEnabled ?? false}
- External runner dispatch enabled: ${body.disabledState?.externalRunnerDispatchEnabled ?? false}
- OMX execution enabled: ${body.disabledState?.omxExecutionEnabled ?? false}
- Calls oh-my-codex: ${body.safety?.callsOhMyCodex ?? false}
- Creates worktrees: ${body.safety?.createsWorktrees ?? false}
- Default NVIDIA chat lane changed: ${body.safety?.defaultNvidiaChatLaneChanged ?? false}
- Plain secret findings: ${body.secretFindingCount ?? "n/a"}
- Conclusion: ${body.conclusion}

## Covered Capabilities

${(body.coveredCapabilities ?? []).map((item) => `- ${item}`).join("\n")}

## Evidence Index

${(body.evidenceIndex ?? []).map((item) => `- ${item}`).join("\n")}

## User Acceptance Checklist

${(body.userAcceptanceChecklist ?? []).map((item) => `- ${item}`).join("\n")}

## Known Blockers

${(body.knownBlockers ?? []).map((item) => `- ${item}`).join("\n")}

## Checks

${Object.entries(body.checks ?? {}).map(([name, value]) => `- ${name}: ${value ? "passed" : "failed"}`).join("\n")}
`;
}
