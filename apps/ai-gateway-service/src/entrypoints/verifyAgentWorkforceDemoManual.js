import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findPlainSecretFindings } from "../security/secretSafety.js";

const phase = "phase-152a-agent-workforce-demo-manual";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, `${phase}.json`);
const evidenceMdPath = resolve(evidenceDir, `${phase}.md`);
const demoScriptPath = "docs/AGENT_WORKFORCE_DEMO_SCRIPT.md";
const userManualPath = "docs/USER_MANUAL.md";
const phase151EvidencePath = "apps/ai-gateway-service/evidence/phase-151a-agent-workforce-stage-closure.json";
const requiredDemoSteps = [
  "Start the local system",
  "http://127.0.0.1:3100/ui",
  "Check Setup / Readiness",
  "Enter Agent Workforce",
  "Input A Sample Goal",
  "Generate The Plan",
  "Review The 7 Roles And Role Tiers",
  "Review Clarification Questions",
  "Review Consensus Preview",
  "Review The Review Package",
  "Review Approval Gate Preview",
  "Review OMX Handoff Preview",
  "Review Execution Readiness",
  "Review External Runner Sections",
  "Save The Plan",
  "View History",
  "Export JSON / Markdown",
  "Execution disabled. External Runner disabled. OMX handoff is preview-only.",
];
const plainUserExplanations = [
  "AI team planning console",
  "break down a goal",
  "assign preview roles",
  "does not automatically execute code",
  "does not call oh-my-codex",
  "does not create a worktree",
  "does not change your project files",
  "OMX-related sections are only a future handoff package preview",
];
const regressionCommands = [
  "cmd /c pnpm verify:phase152a-agent-workforce-demo-manual",
  "cmd /c pnpm verify:phase151a-agent-workforce-stage-closure",
  "cmd /c pnpm verify:phase150a-agent-workforce-preview-acceptance-pack",
  "cmd /c pnpm verify:phase149a-agent-workforce-preview-final-ux-seal",
  "cmd /c pnpm verify:phase148a-external-runner-protocol-freeze",
  "cmd /c pnpm verify:phase147a-execution-approval-record",
  "cmd /c pnpm verify:phase146a-runner-request-review-queue",
  "cmd /c pnpm verify:phase145a-external-omx-runner-design",
  "cmd /c pnpm verify:phase144a-execution-readiness-preflight",
  "cmd /c pnpm verify:phase143a-role-tier-event-ledger",
  "cmd /c pnpm verify:phase142a-omx-handoff-preview",
  "cmd /c pnpm verify:phase107a-secret-safety",
  "cmd /c pnpm verify:phase105a-user-journey",
  "cmd /c pnpm health:phase12a",
  "cmd /c pnpm doctor:phase13a",
  "cmd /c pnpm -r --if-present check",
];

try {
  const [
    demoScript,
    userManual,
    readme,
    agentsDoc,
    rootPackageText,
    servicePackageText,
    phase151EvidenceText,
  ] = await Promise.all([
    readRequired(demoScriptPath),
    readRequired(userManualPath),
    readRequired("README.md"),
    readRequired("AGENTS.md"),
    readRequired("package.json"),
    readRequired("apps/ai-gateway-service/package.json"),
    readRequired(phase151EvidencePath),
  ]);
  const phase151Evidence = JSON.parse(phase151EvidenceText);
  const rootPackage = JSON.parse(rootPackageText);
  const servicePackage = JSON.parse(servicePackageText);
  const allText = [demoScript, userManual, readme, agentsDoc, rootPackageText, servicePackageText].join("\n\n");
  const secretFindings = findPlainSecretFindings(allText, phase);

  const checks = {
    phase151EvidencePassed: phase151Evidence.status === "passed",
    phase151ClosureBaseline:
      phase151Evidence.stageClosureConclusion === "preview/design product baseline" &&
      phase151Evidence.boundaries?.executionEnabled === false &&
      phase151Evidence.boundaries?.runnerEnabled === false &&
      phase151Evidence.boundaries?.workflowRunEnabled === false &&
      phase151Evidence.boundaries?.externalRunnerDispatchEnabled === false,
    rootScriptPresent:
      rootPackage.scripts?.["verify:phase152a-agent-workforce-demo-manual"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase152a-agent-workforce-demo-manual",
    serviceScriptPresent:
      servicePackage.scripts?.["verify:phase152a-agent-workforce-demo-manual"] ===
      "node ./src/entrypoints/verifyAgentWorkforceDemoManual.js",
    demoScriptPresent: demoScript.includes("# Agent Workforce Demo Script"),
    demoStepsComplete: requiredDemoSteps.every((step) => demoScript.includes(step)),
    plainUserExplanationsPresent: plainUserExplanations.every((text) => demoScript.includes(text)),
    manualHardeningPresent:
      userManual.includes("The Agent Workforce demo script and hardened user manual command is:") &&
      userManual.includes("Agent Workforce is an AI team planning control panel") &&
      userManual.includes("will not automatically execute code") &&
      userManual.includes("will not call oh-my-codex") &&
      userManual.includes("will not create a worktree") &&
      userManual.includes("will not change your project files") &&
      userManual.includes("future handoff package preview"),
    developerVerificationPathPresent: regressionCommands.every((command) => demoScript.includes(command)),
    docsSynchronized:
      readme.includes("Phase 152A") &&
      readme.includes("docs/AGENT_WORKFORCE_DEMO_SCRIPT.md") &&
      agentsDoc.includes("Phase 152A Agent Workforce Demo Script / User Manual Hardening Boundary") &&
      userManual.includes("verify:phase152a-agent-workforce-demo-manual"),
    boundariesPresent:
      demoScript.includes("Execution disabled") &&
      demoScript.includes("External Runner disabled") &&
      demoScript.includes("workflow run remains disabled") &&
      demoScript.includes("worktrees are not created") &&
      demoScript.includes("oh-my-codex is not called") &&
      demoScript.includes("default NVIDIA /chat lane is unchanged"),
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
    demoScriptPath,
    userManualPath,
    checks,
    demoCoverage: requiredDemoSteps,
    plainUserExplanationCoverage: plainUserExplanations,
    developerVerificationPath: regressionCommands,
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
    disabledState: {
      executionEnabled: false,
      runnerEnabled: false,
      workflowRunEnabled: false,
      externalRunnerDispatchEnabled: false,
    },
    secretFindingCount: secretFindings.length,
    conclusion: passed
      ? "agent-workforce-demo-script-user-manual-hardened"
      : "agent-workforce-demo-script-user-manual-not-hardened",
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
    conclusion: "agent-workforce-demo-script-user-manual-not-hardened",
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
  return `# Phase 152A Agent Workforce Demo / Manual Evidence

- Phase: ${body.phase}
- Status: ${body.status}
- Generated at: ${body.generatedAt}
- Demo script: ${body.demoScriptPath ?? "n/a"}
- User manual: ${body.userManualPath ?? "n/a"}
- Execution enabled: ${body.disabledState?.executionEnabled ?? false}
- Runner enabled: ${body.disabledState?.runnerEnabled ?? false}
- Workflow run enabled: ${body.disabledState?.workflowRunEnabled ?? false}
- External runner dispatch enabled: ${body.disabledState?.externalRunnerDispatchEnabled ?? false}
- Calls oh-my-codex: ${body.safety?.callsOhMyCodex ?? false}
- Creates worktrees: ${body.safety?.createsWorktrees ?? false}
- Default NVIDIA chat lane changed: ${body.safety?.defaultNvidiaChatLaneChanged ?? false}
- Plain secret findings: ${body.secretFindingCount ?? "n/a"}
- Conclusion: ${body.conclusion}

## Demo Coverage

${(body.demoCoverage ?? []).map((item) => `- ${item}`).join("\n")}

## Plain User Explanation Coverage

${(body.plainUserExplanationCoverage ?? []).map((item) => `- ${item}`).join("\n")}

## Developer Verification Path

${(body.developerVerificationPath ?? []).map((item) => `- ${item}`).join("\n")}

## Checks

${Object.entries(body.checks ?? {}).map(([name, value]) => `- ${name}: ${value ? "passed" : "failed"}`).join("\n")}
`;
}
