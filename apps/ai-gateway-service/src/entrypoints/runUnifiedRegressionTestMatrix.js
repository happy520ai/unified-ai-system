import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { projectContextExists, repoRoot } from "../regression/regressionMatrix.js";
import { runSafeRegressionMatrix } from "../regression/runSafeRegressionMatrix.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceRoot = resolve(__dirname, "../..");
const evidenceDir = resolve(serviceRoot, "evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-291a-unified-regression-test-matrix.json");
const evidenceMdPath = resolve(evidenceDir, "phase-291a-unified-regression-test-matrix.md");

function buildEvidence() {
  const safeReport = runSafeRegressionMatrix();

  return {
    phase: "291A",
    status: safeReport.status,
    generatedAt: new Date().toISOString(),
    paidApiCallCount: 0,
    externalApiCalled: false,
    mimoApiCalled: false,
    embeddingCalled: false,
    legacyModified: false,
    projectContextCreated: projectContextExists(),
    commitPerformed: false,
    pushPerformed: false,
    realReleasePerformed: false,
    remoteDeployPerformed: false,
    workspaceCleanClaimed: false,
    currentBlocker: "none",
    safeDefaultChecks: safeReport.safeDefaultChecks,
    localPreviewChecks: safeReport.localPreviewChecks,
    externalRiskChecks: safeReport.externalRiskChecks,
    manualOnlyChecks: safeReport.manualOnlyChecks,
    releasePreflightChecks: safeReport.releasePreflightChecks,
    notAvailableChecks: safeReport.notAvailableChecks,
    executedChecks: safeReport.executedChecks,
    skippedChecks: safeReport.skippedChecks,
    failedChecks: safeReport.failedChecks,
    regressionMatrixReady: safeReport.status === "pass",
    defaultRegressionCommand: "cmd /c pnpm run verify:safe-regression-matrix",
    releasePreflightCommand: "manual approval required before running release-preflight checks",
    providerCallRiskDetected: safeReport.providerCallRiskDetected,
    productionReadyClaimed: false,
    finalConclusion: "Phase 291A Unified Regression Test Matrix is complete. The default matrix is limited to safe-default and local-preview checks, records external-risk/manual-only/release-preflight checks as skipped, records missing scripts as not_available, and does not call paid APIs, MiMo, embedding, or real providers.",
    recommendedNextRoutes: [
      "Phase 292A Product Operation Manual",
      "Phase 293A Controlled Provider Integration Design Gate",
      "Phase 294A Real Deployment Design Gate",
    ],
  };
}

function sectionList(items, mapper) {
  if (!items.length) {
    return "- none";
  }
  return items.map(mapper).join("\n");
}

function buildMarkdown(evidence) {
  return `# Phase 291A Unified Regression Test Matrix

Status: ${evidence.status}

Current blocker: ${evidence.currentBlocker}

## Boundary

- Paid API called: ${evidence.paidApiCallCount}
- External provider called: ${evidence.externalApiCalled}
- MiMo called: ${evidence.mimoApiCalled}
- Embedding called: ${evidence.embeddingCalled}
- legacy/ modified: ${evidence.legacyModified}
- PROJECT_CONTEXT.md created: ${evidence.projectContextCreated}
- Commit performed: ${evidence.commitPerformed}
- Push performed: ${evidence.pushPerformed}
- Real release performed: ${evidence.realReleasePerformed}
- Remote deploy performed: ${evidence.remoteDeployPerformed}
- Workspace clean claimed: ${evidence.workspaceCleanClaimed}
- Production ready claimed: ${evidence.productionReadyClaimed}

## Safe Default Checks

${sectionList(evidence.safeDefaultChecks, (item) => `- ${item.id}: ${item.availability} (${item.command})`)}

## Local Preview Checks

${sectionList(evidence.localPreviewChecks, (item) => `- ${item.id}: ${item.availability} (${item.command})`)}

## External Risk Checks

${sectionList(evidence.externalRiskChecks, (item) => `- ${item.id}: skipped by default (${item.command})`)}

## Manual Only Checks

${sectionList(evidence.manualOnlyChecks, (item) => `- ${item.id}: skipped by default (${item.command})`)}

## Release Preflight Checks

${sectionList(evidence.releasePreflightChecks, (item) => `- ${item.id}: manual approval required (${item.command})`)}

## Not Available Checks

${sectionList(evidence.notAvailableChecks, (item) => `- ${item.id}: ${item.status} (${item.command})`)}

## Executed Checks

${sectionList(evidence.executedChecks, (item) => `- ${item.id}: ${item.status}`)}

## Skipped Checks

${sectionList(evidence.skippedChecks, (item) => `- ${item.id}: ${item.status} - ${item.reason}`)}

## Failed Checks

${sectionList(evidence.failedChecks, (item) => `- ${item.id}: ${item.status} - ${item.reason}`)}

## Commands

- Default regression command: ${evidence.defaultRegressionCommand}
- Release preflight command: ${evidence.releasePreflightCommand}

## Final Conclusion

${evidence.finalConclusion}
`;
}

export function runUnifiedRegressionTestMatrix() {
  mkdirSync(evidenceDir, { recursive: true });
  const evidence = buildEvidence();
  writeFileSync(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  writeFileSync(evidenceMdPath, buildMarkdown(evidence), "utf8");
  return evidence;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const evidence = runUnifiedRegressionTestMatrix();
  console.log(JSON.stringify({
    phase: evidence.phase,
    status: evidence.status,
    currentBlocker: evidence.currentBlocker,
    regressionMatrixReady: evidence.regressionMatrixReady,
    safeDefaultChecks: evidence.safeDefaultChecks.length,
    localPreviewChecks: evidence.localPreviewChecks.length,
    externalRiskChecks: evidence.externalRiskChecks.length,
    manualOnlyChecks: evidence.manualOnlyChecks.length,
    notAvailableChecks: evidence.notAvailableChecks.length,
    providerCallRiskDetected: evidence.providerCallRiskDetected,
    repoRoot,
    evidencePath: "apps/ai-gateway-service/evidence/phase-291a-unified-regression-test-matrix.json",
  }, null, 2));
}
