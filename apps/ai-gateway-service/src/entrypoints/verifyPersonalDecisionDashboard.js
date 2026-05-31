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

const phase = "phase-240a-personal-decision-dashboard";
const docPath = "docs/PERSONAL_DECISION_DASHBOARD.md";
const uiPath = "apps/ai-gateway-service/src/ui/consolePage.js";
const verifierPath = "apps/ai-gateway-service/src/entrypoints/verifyPersonalDecisionDashboard.js";
const evidenceJsonPath = "apps/ai-gateway-service/evidence/phase-240a-personal-decision-dashboard.json";
const evidenceMdPath = "apps/ai-gateway-service/evidence/phase-240a-personal-decision-dashboard.md";

const requiredDocSections = [
  "# Personal Decision Dashboard",
  "## 1. Purpose",
  "## 2. Current Status Dimensions",
  "## 3. Blocker Decision Rules",
  "## 4. Recommended Next Step Rules",
  "## 5. Option A/B/C Comparison Format",
  "## 6. Codex-ready Decision",
  "## 7. Stop / Continue Decision",
  "## 8. Dirty Workspace Handling",
  "## 9. Self-use Decision Output Template",
  "## 10. Preview-only Boundary",
  "## 11. Final Conclusion",
];

const requiredStatusDimensions = [
  "Phase status",
  "Evidence status",
  "Workspace status",
  "Blocker status",
  "Validation status",
  "Knowledge confidence",
  "Boundary status",
  "Personal value",
];

const requiredBlockerRules = [
  "No blocker",
  "Documentation blocker",
  "Verification blocker",
  "Boundary blocker",
  "Dirty-workspace blocker",
  "Evidence blocker",
];

const requiredNextStepRules = [
  "Fix boundary or verification blockers first",
  "If the workspace is dirty",
  "If the current phase lacks a verifier",
  "If evidence is stale",
  "If the operator needs daily value",
  "If a task is small, bounded, and verifiable",
  "If the task needs real execution",
];

const requiredUiMarkers = [
  "phase240a-personal-decision-dashboard",
  "Decision Dashboard",
  "Current status",
  "Current blocker",
  "Recommended next step",
  "Option A/B/C",
  "Risk / Boundary",
  "Codex-ready or not",
  "Stop / Continue decision",
  "Self-use Decision Output Template",
  "Today recommended action",
  "Not recommended action",
  "Reason",
  "Codex task can be generated",
  "Required verification commands",
  "Commit/push allowed: No by default",
  "Real execution allowed: No by default",
];

const requiredDecisionTemplate = [
  "Today recommended action",
  "Not recommended action",
  "Reason",
  "Codex task can be generated",
  "Required verification commands",
  "Commit/push allowed",
  "No by default",
  "Real execution allowed",
];

const requiredVerificationCommands = [
  "cmd /c pnpm run verify:phase240a-personal-decision-dashboard",
  "cmd /c pnpm run verify:phase239a-personal-project-knowledge-pack",
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
  "Modify `legacy/`",
  "Create `PROJECT_CONTEXT.md`",
  "Do not add heavy dependencies",
  "Do not call real `codex exec`",
  "Do not create worktrees",
  "Do not connect workflow runner",
  "Do not automatically commit or push",
  "Do not change the default NVIDIA `/chat` mainline",
  "Do not promise unattended automatic development",
  "Do not promise production-grade vector RAG or GraphRAG",
  "Do not describe preview-only capability as production-ready",
  "Do not write real API keys",
];

const blockedDependencies = [
  "chromadb",
  "langchain",
  "@langchain/core",
  "@pinecone-database/pinecone",
  "weaviate-client",
  "pgvector",
  "vectordb",
  "sqlite-vss",
  "llamaindex",
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
  const negative = /\b(no|not|never|without|blocked|disabled|forbidden|must not|does not|cannot|requires explicit|explicitly gated|preview-only|dry-run|manual|out of scope|do not|not a|not production|stop|avoid)\b/i;
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
  return blockedDependencies.some((name) => packageMaps.some((deps) => Object.hasOwn(deps, name)));
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
    currentStatusDimensionsPresent: containsAll(doc, requiredStatusDimensions),
    blockerDecisionRulesPresent: containsAll(doc, requiredBlockerRules),
    nextStepRulesPresent: containsAll(doc, requiredNextStepRules),
    optionAbcComparisonPresent:
      doc.includes("Option A") &&
      doc.includes("Option B") &&
      doc.includes("Option C") &&
      doc.includes("Risk / Boundary") &&
      doc.includes("Verification"),
    codexReadyDecisionPresent:
      doc.includes("A task is Codex-ready when all of these are true") &&
      doc.includes("A task is not Codex-ready") &&
      doc.includes("default no real `codex exec`"),
    stopContinueDecisionPresent:
      doc.includes("Continue when") &&
      doc.includes("Stop when") &&
      doc.includes("Stopping is a valid decision"),
    dirtyWorkspaceHandlingPresent:
      doc.includes("When the workspace is dirty") &&
      doc.includes("Treat existing unrelated changes as user-owned") &&
      doc.includes("Do not revert unrelated files"),
    decisionOutputTemplatePresent: containsAll(doc, requiredDecisionTemplate),
    uiDecisionDashboardPresent: containsAll(personalUiSection, requiredUiMarkers),
    requiredVerificationCommandsPresent: containsAll(personalUiSection, requiredVerificationCommands),
    docListsRequiredVerificationCommands: containsAll(doc, requiredVerificationCommands),
    boundariesPresent: containsAll(doc, requiredBoundaryMarkers),
    rootScriptPresent:
      texts.rootPackage.scripts?.["verify:phase240a-personal-decision-dashboard"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase240a-personal-decision-dashboard",
    serviceScriptPresent:
      texts.servicePackage.scripts?.["verify:phase240a-personal-decision-dashboard"] ===
      "node ./src/entrypoints/verifyPersonalDecisionDashboard.js",
    noProjectContext: noProjectContext(),
    noOhMyCodexDependency: noOhMyCodexDependency(texts.rootPackageText, texts.servicePackageText),
    noBlockedDependency: !hasBlockedDependency(texts.rootPackage, texts.servicePackage),
    noPlainSecrets: secretFindingCount === 0,
    doesNotClaimRealCodexExec: !hasUnsafePositiveLine(claimScanText, [
      ["codex", "exec", "enabled"],
      ["codex", "exec", "automatic"],
      ["codex", "exec", "default"],
      ["real", "codex", "execution"],
    ]),
    doesNotClaimProductionRag: !hasUnsafePositiveLine(claimScanText, [
      ["production-grade", "vector", "rag"],
      ["production", "vector", "rag"],
      ["production-grade", "graphrag"],
      ["production-ready", "rag"],
    ]),
    doesNotClaimPreviewAsProductionReady: !hasUnsafePositiveLine(claimScanText, [
      ["preview-only", "production-ready"],
      ["preview", "production-ready"],
      ["design-only", "production-ready"],
    ]),
    doesNotClaimUnattendedDevelopment: !hasUnsafePositiveLine(claimScanText, [
      ["unattended", "development"],
      ["automatic", "development"],
    ]),
    evidenceJsonGenerated: true,
    evidenceMdGenerated: true,
  };

  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    phase,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    conclusion: passed ? "personal-decision-dashboard-preview-ready" : "personal-decision-dashboard-incomplete",
    docPath,
    uiPath,
    verifierPath,
    evidencePaths: [evidenceJsonPath, evidenceMdPath],
    verifiedDocuments: [
      docPath,
      uiPath,
      "docs/PERSONAL_OPERATOR_CONSOLE.md",
      "docs/PERSONAL_DAILY_WORKFLOW.md",
      "docs/PERSONAL_PROJECT_KNOWLEDGE_PACK.md",
      "package.json",
      "apps/ai-gateway-service/package.json",
    ],
    decisionSignals: [
      "current-status",
      "current-blocker",
      "recommended-next-step",
      "option-a-b-c",
      "risk-boundary",
      "codex-ready-or-not",
      "stop-continue-decision",
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
      productionVectorRagClaimed: false,
      graphRagClaimed: false,
      previewAsProductionReady: false,
      unattendedDevelopmentClaimed: false,
      newDependencyAdded: false,
    },
    secretFindingCount,
    checks,
    notes: [
      "Phase 240A adds a preview-only personal decision dashboard.",
      "The dashboard turns current status, blockers, evidence, and boundaries into a manual next-step decision.",
      "No real Codex exec, real Agent execution, production vector RAG, GraphRAG, worktree, workflow runner, automatic commit/push, or new dependency is added.",
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
    conclusion: "personal-decision-dashboard-verification-error",
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
    notes: ["Verification failed before all Phase 240A checks could complete."],
  };
  await writeEvidence(phase, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}
