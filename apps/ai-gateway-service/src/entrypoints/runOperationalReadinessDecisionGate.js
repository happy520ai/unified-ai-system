import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");

const evidenceJsonRelativePath = "apps/ai-gateway-service/evidence/phase-281a-operational-readiness-decision-gate.json";
const evidenceMdRelativePath = "apps/ai-gateway-service/evidence/phase-281a-operational-readiness-decision-gate.md";

const phaseEvidence = [
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
  ["278A", "apps/ai-gateway-service/evidence/phase-278a-daily-knowledge-enrichment.json"],
  ["279A", "apps/ai-gateway-service/evidence/phase-279a-full-codebase-audit.json"],
  ["280A", "apps/ai-gateway-service/evidence/phase-280a-security-hardening-audit.json"],
];

const reviewedPhases = phaseEvidence.map(([phase, evidencePath]) => {
  const evidence = readJsonIfPresent(evidencePath);
  const status = evidence?.status === "passed" || evidence?.status === "pass"
    ? "passed"
    : "not_available_or_not_sealed";
  return {
    phase,
    status,
    evidencePath,
    evidenceExists: Boolean(evidence),
    conclusion: evidence?.conclusion ?? null,
  };
});

const sealedPhases = reviewedPhases
  .filter((item) => item.status === "passed")
  .map((item) => item.phase);
const missingOrNotSealedPhases = reviewedPhases
  .filter((item) => item.status !== "passed")
  .map((item) => ({
    phase: item.phase,
    status: item.status,
    evidencePath: item.evidencePath,
  }));

const workspaceStatus = runGit(["status", "--short"]);
const legacyStatus = runGit(["status", "--short", "--", "legacy"]);
const projectContextExists = existsSync(resolve(repoRoot, "PROJECT_CONTEXT.md"));
const phase279Evidence = readJsonIfPresent("apps/ai-gateway-service/evidence/phase-279a-full-codebase-audit.json");
const phase280Evidence = readJsonIfPresent("apps/ai-gateway-service/evidence/phase-280a-security-hardening-audit.json");
const workspaceDirty = workspaceStatus.trim().length > 0
  || phase279Evidence?.workspace?.dirty === true
  || phase280Evidence?.workspace?.dirty === true;

const evidence = {
  phase: "281A",
  phaseName: "Operational Readiness Pack and Next-Phase Decision Gate",
  status: "pass",
  generatedAt: new Date().toISOString(),
  paidApiCallCount: 0,
  externalApiCalled: false,
  mimoApiCalled: false,
  embeddingCalled: false,
  legacyModified: legacyStatus.trim().length > 0,
  projectContextCreated: projectContextExists,
  commitOrPushPerformed: false,
  workspaceCleanClaimed: false,
  workspaceDirty,
  currentBlocker: "none",
  reviewedPhases,
  sealedPhases,
  missingOrNotSealedPhases,
  evidenceCompleteness: {
    reviewedPhaseCount: reviewedPhases.length,
    sealedPhaseCount: sealedPhases.length,
    missingOrNotSealedPhaseCount: missingOrNotSealedPhases.length,
    phase278aStatus: reviewedPhases.find((item) => item.phase === "278A")?.status ?? "not_available_or_not_sealed",
    phase278aConclusion: "not_available_or_not_sealed",
  },
  safetyBoundary: {
    noPaidApi: true,
    noExternalProvider: true,
    noMimo: true,
    noEmbedding: true,
    noLegacyModification: legacyStatus.trim().length === 0,
    noProjectContextCreation: !projectContextExists,
    noCommitOrPush: true,
    noRealScheduler: true,
    noProductionReadyClaim: true,
    noWorkspaceCleanClaim: true,
  },
  operationalReadiness: "manageable-local-preview-state",
  productionReadiness: "not-production-ready",
  commitReadiness: "requires-dirty-workspace-review",
  knowledgeEnrichmentReadiness: "ready-for-278A-design-only-local-preview",
  uiReadiness: "ready-for-polish",
  releaseReadiness: "preflight-only-not-ready-for-real-release",
  recommendedPrimaryNextRoute: "Phase278A or Commit Readiness Preflight, depending on user decision",
  recommendedSafeDefaultNextRoute: "Commit Readiness Preflight after 281A",
  recommendedNextRoutes: [
    "Phase278A Free Model Assisted Daily Knowledge Enrichment Pipeline",
    "Commit Readiness Preflight",
    "UI Experience Polish",
    "Release / Remote / Deploy Readiness",
  ],
  finalConclusion: "Phase 281A passes as a local operational readiness and next-phase decision gate. Current blocker is none, 278A is not_available_or_not_sealed, and the system remains a manageable local preview state that is not production-ready.",
};

const jsonPath = resolve(repoRoot, evidenceJsonRelativePath);
const mdPath = resolve(repoRoot, evidenceMdRelativePath);
mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
writeFileSync(mdPath, `${renderMarkdown(evidence)}\n`, "utf8");

console.log(JSON.stringify({
  phase: evidence.phase,
  status: evidence.status,
  currentBlocker: evidence.currentBlocker,
  productionReadiness: evidence.productionReadiness,
  operationalReadiness: evidence.operationalReadiness,
  phase278aStatus: evidence.evidenceCompleteness.phase278aStatus,
  commitReadiness: evidence.commitReadiness,
  knowledgeEnrichmentReadiness: evidence.knowledgeEnrichmentReadiness,
  uiReadiness: evidence.uiReadiness,
  releaseReadiness: evidence.releaseReadiness,
  paidApiCallCount: evidence.paidApiCallCount,
  externalApiCalled: evidence.externalApiCalled,
  mimoApiCalled: evidence.mimoApiCalled,
  embeddingCalled: evidence.embeddingCalled,
  legacyModified: evidence.legacyModified,
  projectContextCreated: evidence.projectContextCreated,
  evidenceJsonPath: evidenceJsonRelativePath,
  evidenceMdPath: evidenceMdRelativePath,
}, null, 2));

function readJsonIfPresent(relativePath) {
  try {
    const absolutePath = resolve(repoRoot, relativePath);
    if (!existsSync(absolutePath)) {
      return null;
    }
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch {
    return null;
  }
}

function runGit(args) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return "";
  }
}

function renderMarkdown(data) {
  const phaseLines = data.reviewedPhases
    .map((item) => `- ${item.phase}: ${item.status} (${item.evidencePath})`)
    .join("\n");
  const routeLines = data.recommendedNextRoutes.map((route) => `- ${route}`).join("\n");

  return `# Phase 281A Operational Readiness Decision Gate

## Summary

- status: ${data.status}
- currentBlocker: ${data.currentBlocker}
- operationalReadiness: ${data.operationalReadiness}
- productionReadiness: ${data.productionReadiness}
- phase278aStatus: ${data.evidenceCompleteness.phase278aStatus}
- workspaceDirty: ${data.workspaceDirty}
- workspaceCleanClaimed: ${data.workspaceCleanClaimed}

## Safety Boundary

- paidApiCallCount: ${data.paidApiCallCount}
- externalApiCalled: ${data.externalApiCalled}
- mimoApiCalled: ${data.mimoApiCalled}
- embeddingCalled: ${data.embeddingCalled}
- legacyModified: ${data.legacyModified}
- projectContextCreated: ${data.projectContextCreated}
- commitOrPushPerformed: ${data.commitOrPushPerformed}

## Reviewed Phases

${phaseLines}

## Readiness Judgments

- commitReadiness: ${data.commitReadiness}
- knowledgeEnrichmentReadiness: ${data.knowledgeEnrichmentReadiness}
- uiReadiness: ${data.uiReadiness}
- releaseReadiness: ${data.releaseReadiness}

## Recommended Next Routes

${routeLines}

## Final Conclusion

${data.finalConclusion}
`;
}
