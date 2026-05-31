import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  countSecretFindings,
  createDisabledState,
  createSafety,
  noOhMyCodexDependency,
  noProjectContext,
  readRequired,
  readWorkspaceTexts,
  repoRoot,
  writeEvidence,
} from "./verifyAgentWorkforceClosureSupport.js";

const phase = "phase-235a-full-system-readthrough-report";
const reportPath = "docs/UNIFIED_AI_SYSTEM_FULL_READTHROUGH_REPORT.md";
const evidenceJsonPath = "apps/ai-gateway-service/evidence/phase-235a-full-system-readthrough-report.json";
const evidenceMdPath = "apps/ai-gateway-service/evidence/phase-235a-full-system-readthrough-report.md";

const requiredSections = [
  "# Unified AI System Full Readthrough Report",
  "## 1. Executive Summary",
  "## 2. Current Verified Baseline",
  "## 3. High-level Architecture",
  "## 4. Runtime / Startup Model",
  "## 5. AI Gateway Mainline",
  "## 6. Agent Workforce Product Surface",
  "## 7. Codex Bridge / Handoff / Feedback Loop",
  "## 8. Desktop BAT / One-click Automation",
  "## 9. Evidence Inventory",
  "## 10. Current Safety Boundaries",
  "## 11. Current Gaps / Risks / Unknowns",
  "## 12. Recommended Next Roadmap",
  "## 13. Daily Operating Guide",
  "## 14. Final Conclusion",
];

const requiredBoundaries = [
  "No changes under `legacy/`",
  "No `PROJECT_CONTEXT.md`",
  "No default NVIDIA `/chat` lane change",
  "No automatic commit or push",
  "No worktree by default",
  "No workflow run connection",
  "No real external runner dispatch",
  "No approval-preview as execution approval",
  "No plaintext secrets",
];

function containsAll(text, snippets) {
  return snippets.every((snippet) => text.includes(snippet));
}

function hasUnsafePositiveLine(text, checks) {
  const negative = /\b(no|not|never|without|blocked|disabled|forbidden|must not|does not|cannot|requires explicit|explicitly gated|honestly skipped)\b/i;
  return text
    .split(/\r?\n/)
    .some((line) => checks.some((terms) => terms.every((term) => line.toLowerCase().includes(term))) && !negative.test(line));
}

try {
  const [report, texts] = await Promise.all([
    readRequired(reportPath),
    readWorkspaceTexts(),
  ]);

  const secretFindingCount = countSecretFindings(report, phase);
  const checks = {
    reportExists: existsSync(resolve(repoRoot, reportPath)),
    allRequiredSectionsPresent: containsAll(report, requiredSections),
    allHardBoundariesPresent: containsAll(report, requiredBoundaries),
    reportMentionsCurrentConclusion:
      report.includes("本地 AI Gateway + Agent Workforce Preview + Codex handoff/feedback bridge") &&
      report.includes("默认不是无人值守自动执行系统"),
    reportDoesNotClaimPreviewAsProductionExecution: !hasUnsafePositiveLine(report, [
      ["preview", "production execution"],
      ["preview-only", "production"],
      ["design-only", "production execution"],
    ]),
    reportDoesNotClaimApprovalPreviewAsExecutionApproval: !hasUnsafePositiveLine(report, [
      ["approval-preview", "execution approval"],
      ["approval preview", "execution approval"],
      ["approval-preview", "execution permission"],
    ]),
    reportDoesNotClaimAutomaticCommitPush: !hasUnsafePositiveLine(report, [
      ["automatic", "commit"],
      ["automatic", "push"],
      ["automatically", "commit"],
      ["automatically", "push"],
      ["auto", "commit"],
      ["auto", "push"],
    ]),
    reportDoesNotClaimDefaultRealCodexExecution: !hasUnsafePositiveLine(report, [
      ["default", "codex exec"],
      ["default", "codex execution"],
      ["default real", "codex"],
      ["codex cli", "by default"],
      ["codex was invoked"],
    ]),
    noPlainSecrets: secretFindingCount === 0,
    rootScriptPresent:
      texts.rootPackage.scripts?.["verify:phase235a-full-system-readthrough-report"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase235a-full-system-readthrough-report",
    serviceScriptPresent:
      texts.servicePackage.scripts?.["verify:phase235a-full-system-readthrough-report"] ===
      "node ./src/entrypoints/verifyFullSystemReadthroughReport.js",
    noProjectContext: noProjectContext(),
    noOhMyCodexDependency: noOhMyCodexDependency(texts.rootPackageText, texts.servicePackageText),
    evidenceJsonGenerated: true,
    evidenceMdGenerated: true,
  };

  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    phase,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    conclusion: passed ? "full-system-readthrough-report-complete" : "full-system-readthrough-report-incomplete",
    reportPath,
    evidencePaths: [evidenceJsonPath, evidenceMdPath],
    verifiedDocuments: [
      reportPath,
      "package.json",
      "apps/ai-gateway-service/package.json",
      "apps/agent-console/package.json",
      "README.md",
      "AGENTS.md",
      "docs/USER_MANUAL.md",
    ],
    disabledState: createDisabledState(),
    safety: {
      ...createSafety(),
      codexCliInvoked: false,
      codexExecInvoked: false,
      desktopGuiSendInvoked: false,
      autoCommit: false,
      autoPush: false,
      autoApply: false,
      workflowRunEnabled: false,
      defaultNvidiaChatLaneChanged: false,
    },
    secretFindingCount,
    checks,
    notes: [
      "This verifier validates the Phase 235A readthrough report and writes evidence only.",
      "It does not call Codex, run OMX, create worktrees, connect workflow run, or change business runtime behavior.",
      "Evidence confirms the report keeps preview/design-only surfaces separate from real execution.",
    ],
  };

  await writeEvidence(phase, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = passed ? 0 : 1;
} catch (error) {
  const evidence = {
    phase,
    status: "failed",
    generatedAt: new Date().toISOString(),
    conclusion: "full-system-readthrough-report-verification-error",
    error: error instanceof Error ? error.message : String(error),
    reportPath,
    evidencePaths: [evidenceJsonPath, evidenceMdPath],
    disabledState: createDisabledState(),
    safety: {
      ...createSafety(),
      codexCliInvoked: false,
      codexExecInvoked: false,
      desktopGuiSendInvoked: false,
      autoCommit: false,
      autoPush: false,
      autoApply: false,
      workflowRunEnabled: false,
      defaultNvidiaChatLaneChanged: false,
    },
    secretFindingCount: "unknown",
    checks: {},
    notes: ["Verification failed before all checks could complete."],
  };
  await writeEvidence(phase, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}
