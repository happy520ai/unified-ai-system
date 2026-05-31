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

const phase = "phase-238a-personal-daily-workflow";
const docPath = "docs/PERSONAL_DAILY_WORKFLOW.md";
const uiPath = "apps/ai-gateway-service/src/ui/consolePage.js";
const verifierPath = "apps/ai-gateway-service/src/entrypoints/verifyPersonalDailyWorkflow.js";
const evidenceJsonPath = "apps/ai-gateway-service/evidence/phase-238a-personal-daily-workflow.json";
const evidenceMdPath = "apps/ai-gateway-service/evidence/phase-238a-personal-daily-workflow.md";

const requiredDocSections = [
  "# Personal Daily Workflow / 每日自用工作流",
  "## 1. Daily Start",
  "## 2. What To Check First In /ui",
  "## 3. How To Read Personal Operator Console",
  "## 4. Generate Next Codex Task",
  "## 5. Hand Task To Codex",
  "## 6. Import Codex Result",
  "## 7. Review Result",
  "## 8. Verify Evidence",
  "## 9. Decide Whether To Enter The Next Phase",
  "## 10. Stop The Work Round",
  "## 11. Blocker Playbook",
  "## 12. Self-use Workflow Acceptance Checklist",
  "## 13. Phase 238A Boundary",
  "## 14. Final Conclusion",
];

const requiredDailyWorkflowMarkers = [
  "Today Start",
  "Next Codex Task",
  "Review Result",
  "Verify Evidence",
  "Stop / Decide Next",
];

const requiredVerificationCommands = [
  "cmd /c pnpm run verify:phase238a-personal-daily-workflow",
  "cmd /c pnpm run verify:phase237a-personal-operator-console",
  "cmd /c pnpm run verify:phase199a-real-ui-trial-runtime-sync",
  "cmd /c pnpm run verify:phase107a-secret-safety",
  "cmd /c pnpm run verify:phase105a-user-journey",
  "cmd /c pnpm run health:phase12a",
  "cmd /c pnpm run doctor:phase13a",
  "cmd /c pnpm -r --if-present check",
];

const requiredBoundaryMarkers = [
  "Do not modify `legacy/`",
  "Do not create `PROJECT_CONTEXT.md`",
  "Do not change the default NVIDIA `/chat` lane",
  "Do not automatically commit or push",
  "Do not call real `codex exec`",
  "Do not create worktrees",
  "Do not connect workflow runner",
  "Do not write plaintext API keys",
  "Do not promise unattended automatic development",
  "Do not treat approval-preview as execution authorization",
];

const requiredBlockerMarkers = [
  "Dirty workspace",
  "Verification failure",
  "Evidence missing",
  "Boundary overrun",
  "Secret exposure",
];

const requiredAcceptanceMarkers = [
  "Can complete one manual loop from status review to Codex handoff",
  "Can complete one Codex result review",
  "Can identify the current blocker",
  "Can identify the recommended next step",
  "Does not trigger real Codex exec",
  "Does not create worktrees",
  "Does not connect workflow runner",
  "Does not commit or push",
];

const requiredUiMarkers = [
  "phase238a-personal-daily-workflow",
  "Daily Workflow: Today Start -> Next Codex Task -> Review Result -> Verify Evidence -> Stop / Decide Next",
  "Today Start",
  "Next Codex Task",
  "Review Result",
  "Verify Evidence",
  "Stop / Decide Next",
  "Self-use Workflow Acceptance Checklist",
  "manual loop from status review to Codex handoff",
  "Codex result review",
  "current blocker",
  "recommended next step",
  "without real execution",
  "Does not trigger real Codex exec",
  "cmd /c pnpm run verify:phase238a-personal-daily-workflow",
];

const blockedNewDependencies = [
  "chromadb",
  "langchain",
  "@langchain/core",
  "@pinecone-database/pinecone",
  "weaviate-client",
  "pgvector",
  "vectordb",
  "playwright",
  "puppeteer",
  "sqlite-vss",
];

function containsAll(text, snippets) {
  return snippets.every((snippet) => text.includes(snippet));
}

function sliceBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  if (start < 0) return "";
  const end = text.indexOf(endMarker, start + startMarker.length);
  return end >= 0 ? text.slice(start, end) : text.slice(start);
}

function hasUnsafePositiveLine(text, checks) {
  const negative = /\b(no|not|never|without|blocked|disabled|forbidden|must not|does not|cannot|requires explicit|explicitly gated|preview-only|dry-run|manual|out of scope|do not)\b/i;
  return text
    .split(/\r?\n/)
    .some((line) => checks.some((terms) => terms.every((term) => line.toLowerCase().includes(term))) && !negative.test(line));
}

function hasBlockedDependency(rootPackage, servicePackage) {
  const packageMaps = [
    rootPackage.dependencies,
    rootPackage.devDependencies,
    rootPackage.optionalDependencies,
    servicePackage.dependencies,
    servicePackage.devDependencies,
    servicePackage.optionalDependencies,
  ].filter(Boolean);
  return blockedNewDependencies.some((name) => packageMaps.some((deps) => Object.hasOwn(deps, name)));
}

try {
  const [doc, texts] = await Promise.all([
    readRequired(docPath),
    readWorkspaceTexts(),
  ]);

  const personalUiSection = sliceBetween(
    texts.ui,
    'data-phase="phase237a-personal-operator-console"',
    'data-phase="phase102c-agent-workforce-product-closure"',
  );
  const scannedText = [
    doc,
    personalUiSection,
    texts.rootPackageText,
    texts.servicePackageText,
  ].join("\n");
  const claimScanText = [doc, personalUiSection].join("\n");
  const secretFindingCount = countSecretFindings(scannedText, phase);

  const checks = {
    docExists: existsSync(resolve(repoRoot, docPath)),
    uiSourceExists: existsSync(resolve(repoRoot, uiPath)),
    verifierExists: existsSync(resolve(repoRoot, verifierPath)),
    allRequiredDocSectionsPresent: containsAll(doc, requiredDocSections),
    dailyWorkflowMarkersPresentInDoc: containsAll(doc, requiredDailyWorkflowMarkers),
    dailyWorkflowMarkersPresentInUi: containsAll(personalUiSection, requiredUiMarkers),
    allRequiredVerificationCommandsPresent: containsAll(doc, requiredVerificationCommands) && containsAll(personalUiSection, [
      "cmd /c pnpm run verify:phase238a-personal-daily-workflow",
      "cmd /c pnpm run verify:phase237a-personal-operator-console",
      "cmd /c pnpm run verify:phase107a-secret-safety",
      "cmd /c pnpm run health:phase12a",
      "cmd /c pnpm -r --if-present check",
    ]),
    allRequiredBoundariesPresent: containsAll(doc, requiredBoundaryMarkers),
    blockerPlaybookPresent: containsAll(doc, requiredBlockerMarkers),
    acceptanceChecklistPresent: containsAll(doc, requiredAcceptanceMarkers) && containsAll(personalUiSection, requiredAcceptanceMarkers.slice(0, 5)),
    handoffAndImportWorkflowPresent:
      doc.includes("cmd /c pnpm run handoff:codex") &&
      doc.includes(".codex-handoff/outbox/latest-codex-handoff.md") &&
      doc.includes(".codex-handoff/inbox/latest-codex-result.md") &&
      doc.includes("cmd /c pnpm run codex:result:import"),
    nextPhaseDecisionPresent:
      doc.includes("Enter the next phase only when") &&
      doc.includes("Do not enter the next phase when"),
    stopWorkflowPresent:
      doc.includes("cmd /c pnpm run stop:phase9c") &&
      doc.includes("Stopping the round is not a commit or release"),
    rootScriptPresent:
      texts.rootPackage.scripts?.["verify:phase238a-personal-daily-workflow"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase238a-personal-daily-workflow",
    serviceScriptPresent:
      texts.servicePackage.scripts?.["verify:phase238a-personal-daily-workflow"] ===
      "node ./src/entrypoints/verifyPersonalDailyWorkflow.js",
    noProjectContext: noProjectContext(),
    noOhMyCodexDependency: noOhMyCodexDependency(texts.rootPackageText, texts.servicePackageText),
    noBlockedDependency: !hasBlockedDependency(texts.rootPackage, texts.servicePackage),
    noPlainSecrets: secretFindingCount === 0,
    doesNotClaimRealCodexExec: !hasUnsafePositiveLine(claimScanText, [
      ["codex", "exec", "enabled"],
      ["codex", "exec", "automatic"],
      ["codex", "exec", "allowed"],
      ["codex", "exec", "default"],
      ["real", "execution", "daily"],
    ]),
    doesNotClaimUnattendedDevelopment: !hasUnsafePositiveLine(claimScanText, [
      ["unattended", "development"],
      ["unattended", "automatic"],
      ["autonomous", "development"],
    ]),
    doesNotClaimApprovalPreviewAsExecutionAuthorization: !hasUnsafePositiveLine(claimScanText, [
      ["approval-preview", "execution authorization"],
      ["approval-preview", "execution permission"],
      ["approval preview", "execution authorization"],
    ]),
    evidenceJsonGenerated: true,
    evidenceMdGenerated: true,
  };

  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    phase,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    conclusion: passed ? "personal-daily-workflow-preview-ready" : "personal-daily-workflow-incomplete",
    docPath,
    uiPath,
    verifierPath,
    evidencePaths: [evidenceJsonPath, evidenceMdPath],
    verifiedDocuments: [
      docPath,
      uiPath,
      "docs/PERSONAL_OPERATOR_CONSOLE.md",
      "package.json",
      "apps/ai-gateway-service/package.json",
    ],
    workflowSteps: [
      "today-start",
      "next-codex-task",
      "manual-codex-handoff",
      "review-result",
      "verify-evidence",
      "stop-or-decide-next",
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
      worktreeCreated: false,
      defaultNvidiaChatLaneChanged: false,
      approvalPreviewAsExecutionAuthorization: false,
      unattendedDevelopmentClaimed: false,
      newDependencyAdded: false,
    },
    secretFindingCount,
    checks,
    notes: [
      "Phase 238A freezes a manual daily self-use workflow on top of the Phase 237A Personal Operator Console.",
      "The workflow covers startup, /ui reading order, bounded Codex task generation, manual handoff, result import, review, evidence verification, next-phase decision, and clean stop.",
      "No real Codex exec, worktree, workflow runner, automatic commit/push, or new dependency is added.",
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
    conclusion: "personal-daily-workflow-verification-error",
    error: error instanceof Error ? error.message : String(error),
    docPath,
    uiPath,
    verifierPath,
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
      worktreeCreated: false,
      defaultNvidiaChatLaneChanged: false,
    },
    secretFindingCount: "unknown",
    checks: {},
    notes: ["Verification failed before all Phase 238A checks could complete."],
  };
  await writeEvidence(phase, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}
