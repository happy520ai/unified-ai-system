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

const phase = "phase-237a-personal-operator-console";
const docPath = "docs/PERSONAL_OPERATOR_CONSOLE.md";
const uiPath = "apps/ai-gateway-service/src/ui/consolePage.js";
const verifierPath = "apps/ai-gateway-service/src/entrypoints/verifyPersonalOperatorConsole.js";
const evidenceJsonPath = "apps/ai-gateway-service/evidence/phase-237a-personal-operator-console.json";
const evidenceMdPath = "apps/ai-gateway-service/evidence/phase-237a-personal-operator-console.md";

const requiredDocSections = [
  "# Personal Operator Console / Self-use Project Console",
  "## 1. Purpose",
  "## 2. Current Project Status",
  "## 3. Common Verification Commands",
  "## 4. System Status Cards",
  "## 5. Next Codex Task Template",
  "## 6. Codex Result Review Checklist",
  "## 7. Knowledge/RAG Self-use Guide",
  "## 8. Phase 237A Boundary",
  "## 9. Final Conclusion",
];

const requiredVerificationCommands = [
  "cmd /c pnpm run verify:phase237a-personal-operator-console",
  "cmd /c pnpm run verify:phase236a-commercial-business-report",
  "cmd /c pnpm run verify:phase199a-real-ui-trial-runtime-sync",
  "cmd /c pnpm run verify:phase107a-secret-safety",
  "cmd /c pnpm run verify:phase105a-user-journey",
  "cmd /c pnpm run health:phase12a",
  "cmd /c pnpm run doctor:phase13a",
  "cmd /c pnpm -r --if-present check",
];

const requiredBoundaries = [
  "Do not modify legacy/",
  "Do not create PROJECT_CONTEXT.md",
  "Do not change the default NVIDIA /chat lane",
  "Default no commit/push",
  "Default no real Codex exec",
  "Do not create worktrees",
  "Do not connect workflow run",
  "Do not write plaintext API keys",
  "approval-preview is not execution approval",
];

const requiredUiMarkers = [
  "phase237a-personal-operator-console",
  "Personal Operator Console",
  "Current project status",
  "Current blocker",
  "Recommended next step",
  "Common verification commands",
  "Agent Workforce / Codex Bridge / Knowledge Base status",
  "Next Codex Task Template",
  "Codex Result Review checklist",
  "Knowledge/RAG self-use guide",
  "Default no commit/push",
  "Default no real Codex exec",
  "Local keyword / SQLite / citation preview",
  "Production vector RAG is not promised",
];

const requiredReviewSignals = [
  "legacy/",
  "PROJECT_CONTEXT.md",
  "evidence was refreshed",
  "verification commands passed",
  "conclusions are overstated",
  "preview-only",
  "approval claims",
];

const requiredKnowledgeSignals = [
  "README",
  "AGENTS",
  "docs",
  "evidence",
  "project status",
  "phase conclusions",
  "current blocker",
  "local keyword / SQLite / citation preview",
  "production-grade vector RAG",
];

const blockedHeavyDependencies = [
  "chromadb",
  "langchain",
  "@langchain/core",
  "@pinecone-database/pinecone",
  "weaviate-client",
  "pgvector",
  "vectordb",
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
  const negative = /\b(no|not|never|without|blocked|disabled|forbidden|must not|does not|cannot|requires explicit|explicitly gated|preview-only|dry-run|manual|out of scope)\b/i;
  return text
    .split(/\r?\n/)
    .some((line) => checks.some((terms) => terms.every((term) => line.toLowerCase().includes(term))) && !negative.test(line));
}

function hasBlockedHeavyDependency(rootPackage, servicePackage) {
  const packageMaps = [
    rootPackage.dependencies,
    rootPackage.devDependencies,
    rootPackage.optionalDependencies,
    servicePackage.dependencies,
    servicePackage.devDependencies,
    servicePackage.optionalDependencies,
  ].filter(Boolean);
  return blockedHeavyDependencies.some((name) => packageMaps.some((deps) => Object.hasOwn(deps, name)));
}

try {
  const [doc, texts] = await Promise.all([
    readRequired(docPath),
    readWorkspaceTexts(),
  ]);

  const scannedText = [
    doc,
    texts.ui,
    texts.rootPackageText,
    texts.servicePackageText,
  ].join("\n");
  const personalUiSection = sliceBetween(
    texts.ui,
    'data-phase="phase237a-personal-operator-console"',
    'data-phase="phase102c-agent-workforce-product-closure"',
  );
  const claimScanText = [doc, personalUiSection].join("\n");
  const secretFindingCount = countSecretFindings(scannedText, phase);
  const checks = {
    docExists: existsSync(resolve(repoRoot, docPath)),
    uiSourceExists: existsSync(resolve(repoRoot, uiPath)),
    verifierExists: existsSync(resolve(repoRoot, verifierPath)),
    allRequiredDocSectionsPresent: containsAll(doc, requiredDocSections),
    allRequiredVerificationCommandsPresent: containsAll(doc, requiredVerificationCommands),
    allRequiredBoundariesPresent: containsAll(doc, requiredBoundaries),
    allRequiredUiMarkersPresent: containsAll(personalUiSection, requiredUiMarkers),
    nextCodexTaskTemplateCoversRequiredFields:
      doc.includes("Goal:") &&
      doc.includes("Boundary:") &&
      doc.includes("Allowed modification range:") &&
      doc.includes("Verification commands:") &&
      doc.includes("Output format:") &&
      personalUiSection.includes("Goal:") &&
      personalUiSection.includes("Allowed modification range:") &&
      personalUiSection.includes("Output format:"),
    codexResultReviewCoversBoundaryChecks: containsAll(doc, requiredReviewSignals) && containsAll(personalUiSection, requiredReviewSignals),
    knowledgeGuideCoversSelfUseAndLimits: containsAll(doc, requiredKnowledgeSignals) && containsAll(personalUiSection, requiredKnowledgeSignals),
    rootScriptPresent:
      texts.rootPackage.scripts?.["verify:phase237a-personal-operator-console"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase237a-personal-operator-console",
    serviceScriptPresent:
      texts.servicePackage.scripts?.["verify:phase237a-personal-operator-console"] ===
      "node ./src/entrypoints/verifyPersonalOperatorConsole.js",
    noProjectContext: noProjectContext(),
    noOhMyCodexDependency: noOhMyCodexDependency(texts.rootPackageText, texts.servicePackageText),
    noHeavyDependencyAdded: !hasBlockedHeavyDependency(texts.rootPackage, texts.servicePackage),
    noPlainSecrets: secretFindingCount === 0,
    doesNotClaimUnattendedDevelopment: !hasUnsafePositiveLine(claimScanText, [
      ["unattended", "development"],
      ["unattended", "automatic"],
      ["autonomous", "development"],
      ["real", "agent", "execution"],
    ]),
    doesNotClaimApprovalPreviewAsExecutionApproval: !hasUnsafePositiveLine(claimScanText, [
      ["approval-preview", "execution approval"],
      ["approval preview", "execution permission"],
      ["approval-preview", "execution authorization"],
    ]),
    doesNotClaimProductionVectorRag: !hasUnsafePositiveLine(claimScanText, [
      ["production-grade", "vector", "rag"],
      ["production", "vector", "rag"],
      ["production-grade", "graphrag"],
    ]),
    evidenceJsonGenerated: true,
    evidenceMdGenerated: true,
  };

  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    phase,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    conclusion: passed ? "personal-operator-console-preview-ready" : "personal-operator-console-incomplete",
    docPath,
    uiPath,
    verifierPath,
    evidencePaths: [evidenceJsonPath, evidenceMdPath],
    verifiedDocuments: [
      docPath,
      uiPath,
      "package.json",
      "apps/ai-gateway-service/package.json",
    ],
    consoleSections: [
      "current-project-status",
      "current-blocker",
      "recommended-next-step",
      "verification-commands",
      "agent-workforce-codex-bridge-knowledge-status",
      "next-codex-task-template",
      "codex-result-review-checklist",
      "knowledge-rag-self-use-guide",
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
      approvalPreviewAsExecutionApproval: false,
      unattendedDevelopmentClaimed: false,
      productionVectorRagClaimed: false,
    },
    secretFindingCount,
    checks,
    notes: [
      "Phase 237A adds a preview-only personal operator console in /ui and docs.",
      "The console helps generate bounded Codex task prompts and review Codex results, but does not execute Codex or apply results.",
      "Knowledge/RAG is documented as local keyword / SQLite / citation preview only.",
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
    conclusion: "personal-operator-console-verification-error",
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
      approvalPreviewAsExecutionApproval: false,
    },
    secretFindingCount: "unknown",
    checks: {},
    notes: ["Verification failed before all Phase 237A checks could complete."],
  };
  await writeEvidence(phase, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}
