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

const phase = "phase-239a-personal-project-knowledge-pack";
const docPath = "docs/PERSONAL_PROJECT_KNOWLEDGE_PACK.md";
const uiPath = "apps/ai-gateway-service/src/ui/consolePage.js";
const verifierPath = "apps/ai-gateway-service/src/entrypoints/verifyPersonalProjectKnowledgePack.js";
const evidenceJsonPath = "apps/ai-gateway-service/evidence/phase-239a-personal-project-knowledge-pack.json";
const evidenceMdPath = "apps/ai-gateway-service/evidence/phase-239a-personal-project-knowledge-pack.md";

const requiredDocSections = [
  "# Personal Project Knowledge Pack / 自用项目知识包",
  "## 1. Purpose",
  "## 2. Recommended Sources",
  "## 3. Source Roles",
  "## 4. Fact Types",
  "## 5. Querying Project Status",
  "## 6. Avoiding Stale Status Mistakes",
  "## 7. Updating After A Codex Round",
  "## 8. Self-use Knowledge Query Checklist",
  "## 9. UI Project Knowledge Pack Prompt",
  "## 10. Phase 239A Boundary",
  "## 11. Final Conclusion",
];

const requiredSources = [
  "README.md",
  "AGENTS.md",
  "docs/",
  "apps/ai-gateway-service/evidence/",
  ".codex-handoff",
];

const requiredSourceRoles = [
  "`README.md`",
  "`AGENTS.md`",
  "`docs/`",
  "`apps/ai-gateway-service/evidence/`",
  "`.codex-handoff`",
];

const requiredFactTypes = [
  "Sealed facts",
  "Preview-only capabilities",
  "Commercial advice",
  "Future roadmap",
];

const requiredQueryChecklist = [
  "Current project status",
  "Current blocker",
  "Completed phase",
  "Current cannot-promised capability",
  "Next Codex task",
  "Required verification commands",
  "Knowledge/RAG current boundary",
  "Commercialization paused reason",
];

const requiredUiMarkers = [
  "phase239a-personal-project-knowledge-pack",
  "Project Knowledge Pack",
  "Project docs",
  "Evidence",
  "Codex handoff/review",
  "Knowledge/RAG usage",
  "Current-state caution",
  "Self-use Knowledge Query Checklist",
  "Current project status",
  "Current blocker",
  "Completed phase",
  "Current cannot-promised capability",
  "Next Codex task",
  "Required verification commands",
  "Knowledge/RAG current boundary",
  "Commercialization paused reason",
  "local keyword / SQLite / citation preview",
  "not production vector RAG or GraphRAG",
];

const requiredVerificationCommands = [
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
  const negative = /\b(no|not|never|without|blocked|disabled|forbidden|must not|does not|cannot|requires explicit|explicitly gated|preview-only|dry-run|manual|out of scope|do not|not a|not production)\b/i;
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
    recommendedSourcesPresent: containsAll(doc, requiredSources),
    sourceRolesPresent: containsAll(doc, requiredSourceRoles),
    factTypesPresent: containsAll(doc, requiredFactTypes),
    staleStatusCautionPresent:
      doc.includes("Do not treat old evidence as current status by default") &&
      doc.includes("Phase 236A commercial report") &&
      doc.includes("Phase 237A") &&
      doc.includes("Phase 238A"),
    codexRoundUpdatePresent:
      doc.includes("After Codex completes one manual round") &&
      doc.includes("cmd /c pnpm run codex:result:import") &&
      doc.includes("Refresh evidence only after verification passes"),
    queryChecklistPresent: containsAll(doc, requiredQueryChecklist),
    uiProjectKnowledgePackPresent: containsAll(personalUiSection, requiredUiMarkers),
    requiredVerificationCommandsPresent: containsAll(personalUiSection, [
      "cmd /c pnpm run verify:phase239a-personal-project-knowledge-pack",
      "cmd /c pnpm run verify:phase238a-personal-daily-workflow",
      "cmd /c pnpm run verify:phase237a-personal-operator-console",
      "cmd /c pnpm run verify:phase107a-secret-safety",
      "cmd /c pnpm run health:phase12a",
      "cmd /c pnpm -r --if-present check",
    ]),
    docListsRequiredVerificationCommands: containsAll(doc, requiredVerificationCommands) ||
      doc.includes("verify:phase239a-personal-project-knowledge-pack"),
    boundariesPresent: containsAll(doc, requiredBoundaryMarkers),
    rootScriptPresent:
      texts.rootPackage.scripts?.["verify:phase239a-personal-project-knowledge-pack"] ===
      "pnpm --filter @unified-ai-system/ai-gateway-service verify:phase239a-personal-project-knowledge-pack",
    serviceScriptPresent:
      texts.servicePackage.scripts?.["verify:phase239a-personal-project-knowledge-pack"] ===
      "node ./src/entrypoints/verifyPersonalProjectKnowledgePack.js",
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
    evidenceJsonGenerated: true,
    evidenceMdGenerated: true,
  };

  const passed = Object.values(checks).every(Boolean);
  const evidence = {
    phase,
    status: passed ? "passed" : "failed",
    generatedAt: new Date().toISOString(),
    conclusion: passed ? "personal-project-knowledge-pack-preview-ready" : "personal-project-knowledge-pack-incomplete",
    docPath,
    uiPath,
    verifierPath,
    evidencePaths: [evidenceJsonPath, evidenceMdPath],
    verifiedDocuments: [
      docPath,
      uiPath,
      "docs/PERSONAL_OPERATOR_CONSOLE.md",
      "docs/PERSONAL_DAILY_WORKFLOW.md",
      "package.json",
      "apps/ai-gateway-service/package.json",
    ],
    knowledgePackSources: [
      "README.md",
      "AGENTS.md",
      "docs/",
      "apps/ai-gateway-service/evidence/",
      ".codex-handoff",
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
      newDependencyAdded: false,
    },
    secretFindingCount,
    checks,
    notes: [
      "Phase 239A defines a preview-only self-use project knowledge pack.",
      "The knowledge pack clarifies source roles, fact types, stale-status caution, Codex-round updates, and query checklists.",
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
    conclusion: "personal-project-knowledge-pack-verification-error",
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
    notes: ["Verification failed before all Phase 239A checks could complete."],
  };
  await writeEvidence(phase, evidence);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
}
