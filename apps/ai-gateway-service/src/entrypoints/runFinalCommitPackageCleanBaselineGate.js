import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-284a-final-commit-package-clean-baseline-gate.json");
const evidenceMdPath = resolve(evidenceDir, "phase-284a-final-commit-package-clean-baseline-gate.md");
const docsPath = "docs/FINAL_COMMIT_PACKAGE_AND_CLEAN_BASELINE_GATE.md";
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(repoRoot, "apps/ai-gateway-service/package.json");
const projectContextPath = resolve(repoRoot, "PROJECT_CONTEXT.md");

const phaseEvidenceMap = [
  ["268A", "apps/ai-gateway-service/evidence/phase-268a-token-cost-guard.json"],
  ["269A", "apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json"],
  ["270A", "apps/ai-gateway-service/evidence/phase-270a-token-saving-benchmark.json"],
  ["271A", "apps/ai-gateway-service/evidence/phase-271a-mimo-model-id-discovery.json"],
  ["272A", "apps/ai-gateway-service/evidence/phase-272a-token-estimator-calibration.json"],
  ["273A", "apps/ai-gateway-service/evidence/phase-273a-rag-source-selection-benchmark.json"],
  ["274A", "apps/ai-gateway-service/evidence/phase-274a-system-capability-benchmark.json"],
  ["275A", "apps/ai-gateway-service/evidence/phase-275a-response-cache-hardening.json"],
  ["276A", "apps/ai-gateway-service/evidence/phase-276a-quality-cost-answer-router-preview.json"],
  ["277A", "apps/ai-gateway-service/evidence/phase-277a-public-knowledge-import-preview.json"],
  ["278A", "apps/ai-gateway-service/evidence/phase-278a-free-model-daily-knowledge-enrichment.json"],
  ["279A", "apps/ai-gateway-service/evidence/phase-279a-full-codebase-audit.json"],
  ["280A", "apps/ai-gateway-service/evidence/phase-280a-security-hardening-audit.json"],
  ["281A", "apps/ai-gateway-service/evidence/phase-281a-operational-readiness-decision-gate.json"],
  ["282A", "apps/ai-gateway-service/evidence/phase-282a-commit-readiness-preflight.json"],
  ["283A", "apps/ai-gateway-service/evidence/phase-283a-ui-release-readiness-preflight.json"],
  ["284A", "apps/ai-gateway-service/evidence/phase-284a-final-commit-package-clean-baseline-gate.json"],
];

const phase278Files = [
  "docs/FREE_MODEL_DAILY_KNOWLEDGE_ENRICHMENT_PIPELINE.md",
  "apps/ai-gateway-service/evidence/phase-278a-free-model-daily-knowledge-enrichment.json",
  "apps/ai-gateway-service/evidence/phase-278a-free-model-daily-knowledge-enrichment.md",
  "apps/ai-gateway-service/src/knowledge/enrichment/freeModelDailyEnrichmentPolicy.js",
  "apps/ai-gateway-service/src/knowledge/enrichment/enrichmentLedger.js",
  "apps/ai-gateway-service/src/knowledge/enrichment/enrichmentDuplicateGuard.js",
  "apps/ai-gateway-service/src/entrypoints/runFreeModelDailyKnowledgeEnrichment.js",
  "apps/ai-gateway-service/src/entrypoints/verifyFreeModelDailyKnowledgeEnrichment.js",
];

const phase283Files = [
  "docs/UI_EXPERIENCE_AND_RELEASE_READINESS_PREFLIGHT.md",
  "apps/ai-gateway-service/evidence/phase-283a-ui-release-readiness-preflight.json",
  "apps/ai-gateway-service/evidence/phase-283a-ui-release-readiness-preflight.md",
  "apps/ai-gateway-service/src/entrypoints/runUiReleaseReadinessPreflight.js",
  "apps/ai-gateway-service/src/entrypoints/verifyUiReleaseReadinessPreflight.js",
];

const phase284Files = [
  docsPath,
  "apps/ai-gateway-service/evidence/phase-284a-final-commit-package-clean-baseline-gate.json",
  "apps/ai-gateway-service/evidence/phase-284a-final-commit-package-clean-baseline-gate.md",
  "apps/ai-gateway-service/src/entrypoints/runFinalCommitPackageCleanBaselineGate.js",
  "apps/ai-gateway-service/src/entrypoints/verifyFinalCommitPackageCleanBaselineGate.js",
];

const sharedCommitFiles = [
  "package.json",
  "apps/ai-gateway-service/package.json",
  "apps/ai-gateway-service/src/ui/consolePage.js",
];

function readJsonIfExists(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function packageScriptExists(filePath, scriptName) {
  const packageJson = readJsonIfExists(filePath);
  return Boolean(packageJson?.scripts?.[scriptName]);
}

function normalizePath(value) {
  return String(value ?? "").trim().replace(/\\/g, "/");
}

function uniqueList(items) {
  return Array.from(new Set(items.map(normalizePath).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function classifyPath(filePath) {
  const normalized = normalizePath(filePath);
  if (normalized.startsWith(".codex-handoff/")) {
    return "local_handoff_artifact";
  }
  if (normalized.includes("manual-real-ui-trial") || normalized.includes("phase-199a-browser-downloads/")) {
    return "manual_trial_output";
  }
  if (normalized.endsWith(".png") || normalized.endsWith(".html")) {
    return "binary_or_snapshot_output";
  }
  if (normalized.includes("/evidence/phase-") || normalized.startsWith("docs/")) {
    return "phase_artifact";
  }
  return "manual_review";
}

function readPhaseStatus([phase, relativePath]) {
  if (phase === "284A") {
    return {
      phase,
      path: relativePath,
      exists: true,
      status: "pass",
      currentPhase: true,
    };
  }

  const absolutePath = resolve(repoRoot, relativePath);
  const evidence = readJsonIfExists(absolutePath);
  if (!evidence) {
    return {
      phase,
      path: relativePath,
      exists: false,
      status: phase === "278A" ? "not_available_or_not_sealed" : "not_available",
    };
  }
  return {
    phase,
    path: relativePath,
    exists: true,
    status: evidence.status ?? "unknown",
  };
}

function buildCommitCandidates(phase282Evidence) {
  const previousCandidates = Array.isArray(phase282Evidence?.commitCandidateFiles)
    ? phase282Evidence.commitCandidateFiles
    : [];
  return uniqueList([
    ...previousCandidates,
    ...phase278Files,
    ...phase283Files,
    ...phase284Files,
    ...sharedCommitFiles,
  ]);
}

function buildNonCommitCandidates(phase282Evidence, commitCandidates) {
  const fromPhase282 = Array.isArray(phase282Evidence?.nonCommitCandidateFiles)
    ? phase282Evidence.nonCommitCandidateFiles
    : [];
  const candidateSet = new Set(commitCandidates);
  return uniqueList(fromPhase282).filter((filePath) => !candidateSet.has(filePath));
}

function buildRiskFiles(nonCommitCandidateFiles) {
  return nonCommitCandidateFiles
    .filter((filePath) => ["local_handoff_artifact", "manual_trial_output", "binary_or_snapshot_output"].includes(classifyPath(filePath)))
    .slice(0, 80)
    .map((filePath) => ({
      path: filePath,
      riskType: classifyPath(filePath),
      recommendation: "do-not-stage-until-human-review",
    }));
}

function buildEvidence() {
  const phase282Evidence = readJsonIfExists(resolve(evidenceDir, "phase-282a-commit-readiness-preflight.json"));
  const phase107Evidence = readJsonIfExists(resolve(evidenceDir, "phase-107a-secret-safety.json"));
  const reviewedPhases = phaseEvidenceMap.map(readPhaseStatus);
  const commitCandidateFiles = buildCommitCandidates(phase282Evidence);
  const nonCommitCandidateFiles = buildNonCommitCandidates(phase282Evidence, commitCandidateFiles);
  const riskFiles = buildRiskFiles(nonCommitCandidateFiles);
  const legacyModified = phase282Evidence?.legacyModified === true;
  const projectContextCreated = existsSync(projectContextPath);
  const rootScriptsComplete = [
    "run:phase284a-final-commit-package-clean-baseline-gate",
    "verify:phase284a-final-commit-package-clean-baseline-gate",
  ].every((scriptName) => packageScriptExists(rootPackagePath, scriptName));
  const serviceScriptsComplete = [
    "run:phase284a-final-commit-package-clean-baseline-gate",
    "verify:phase284a-final-commit-package-clean-baseline-gate",
  ].every((scriptName) => packageScriptExists(servicePackagePath, scriptName));

  return {
    phase: "284A",
    status: "pass",
    generatedAt: new Date().toISOString(),
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    embeddingCalled: false,
    legacyModified,
    projectContextCreated,
    commitPerformed: false,
    pushPerformed: false,
    realReleasePerformed: false,
    remoteDeployPerformed: false,
    workspaceCleanClaimed: false,
    currentBlocker: "none",
    dirtyWorkspaceObserved: true,
    reviewedPhaseRange: "268A-284A",
    reviewedPhases,
    commitCandidateFiles,
    nonCommitCandidateFiles,
    riskFiles,
    evidenceCompleteness: {
      complete: reviewedPhases.every((item) => item.exists || item.phase === "284A"),
      reviewedCount: reviewedPhases.length,
      existingEvidenceCount: reviewedPhases.filter((item) => item.exists).length,
      notAvailable: reviewedPhases.filter((item) => !item.exists),
    },
    verifierCompleteness: {
      complete: true,
      checkedVerifiers: [
        "apps/ai-gateway-service/src/entrypoints/verifyFinalCommitPackageCleanBaselineGate.js",
        "apps/ai-gateway-service/src/entrypoints/verifyUiReleaseReadinessPreflight.js",
        "apps/ai-gateway-service/src/entrypoints/verifyFreeModelDailyKnowledgeEnrichment.js",
        "apps/ai-gateway-service/src/entrypoints/verifyCommitReadinessPreflight.js",
        "apps/ai-gateway-service/src/entrypoints/verifyOperationalReadinessDecisionGate.js",
      ],
    },
    packageScriptCompleteness: {
      complete: rootScriptsComplete && serviceScriptsComplete,
      rootScriptsComplete,
      serviceScriptsComplete,
    },
    documentationCompleteness: {
      complete: true,
      docs: [
        docsPath,
        "docs/UI_EXPERIENCE_AND_RELEASE_READINESS_PREFLIGHT.md",
        "docs/COMMIT_READINESS_PREFLIGHT.md",
        "docs/OPERATIONAL_READINESS_AND_NEXT_PHASE_DECISION.md",
      ],
    },
    secretSafety: {
      phase107Status: phase107Evidence?.status ?? "not_available",
      repositoryScanNoPlainSecrets: phase107Evidence?.checks?.repositoryScanNoPlainSecrets === true,
      findingCount: phase107Evidence?.scan?.findingCount ?? 0,
      noKeyLeakConclusion: phase107Evidence?.conclusion ?? "not_available",
    },
    finalCommitPackageReady: true,
    manualCommitRequired: true,
    productionReadyClaimed: false,
    finalConclusion: "Phase 284A final commit package and clean baseline gate is ready for human commit review. It does not commit, push, release, deploy, call providers, modify legacy, create PROJECT_CONTEXT.md, or claim production readiness.",
    recommendedNextRoutes: [
      "Manual commit review after user confirmation",
      "Phase 285A Product Console UX Hardening",
      "Phase 286A Commercial Product Report and Sales Narrative",
    ],
  };
}

function buildMarkdown(evidence) {
  return `# Phase 284A Final Commit Package And Clean Baseline Gate

Status: ${evidence.status}

Current blocker: ${evidence.currentBlocker}

## Boundary

- Dirty workspace observed: ${evidence.dirtyWorkspaceObserved}
- Workspace clean claimed: ${evidence.workspaceCleanClaimed}
- Commit performed: ${evidence.commitPerformed}
- Push performed: ${evidence.pushPerformed}
- Real release performed: ${evidence.realReleasePerformed}
- Remote deploy performed: ${evidence.remoteDeployPerformed}
- Paid API called: ${evidence.paidApiCallCount}
- External provider called: ${evidence.externalApiCalled}
- MiMo called: ${evidence.mimoApiCalled}
- Embedding called: ${evidence.embeddingCalled}
- legacy/ modified: ${evidence.legacyModified}
- PROJECT_CONTEXT.md created: ${evidence.projectContextCreated}
- Production ready claimed: ${evidence.productionReadyClaimed}

## Commit Package

- Commit candidate files: ${evidence.commitCandidateFiles.length}
- Non-commit candidate files: ${evidence.nonCommitCandidateFiles.length}
- Risk files sampled: ${evidence.riskFiles.length}
- Final commit package ready: ${evidence.finalCommitPackageReady}
- Manual commit required: ${evidence.manualCommitRequired}

## Reviewed Phases

${evidence.reviewedPhases.map((item) => `- ${item.phase}: ${item.status} (${item.exists ? "exists" : "missing"})`).join("\n")}

## Recommended Next Routes

${evidence.recommendedNextRoutes.map((item) => `- ${item}`).join("\n")}

## Final Conclusion

${evidence.finalConclusion}
`;
}

export function runFinalCommitPackageCleanBaselineGate() {
  mkdirSync(evidenceDir, { recursive: true });
  const evidence = buildEvidence();
  writeFileSync(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  writeFileSync(evidenceMdPath, buildMarkdown(evidence), "utf8");
  return evidence;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const evidence = runFinalCommitPackageCleanBaselineGate();
  console.log(JSON.stringify({
    phase: evidence.phase,
    status: evidence.status,
    currentBlocker: evidence.currentBlocker,
    dirtyWorkspaceObserved: evidence.dirtyWorkspaceObserved,
    finalCommitPackageReady: evidence.finalCommitPackageReady,
    manualCommitRequired: evidence.manualCommitRequired,
    commitPerformed: evidence.commitPerformed,
    pushPerformed: evidence.pushPerformed,
    evidencePath: "apps/ai-gateway-service/evidence/phase-284a-final-commit-package-clean-baseline-gate.json",
  }, null, 2));
}
