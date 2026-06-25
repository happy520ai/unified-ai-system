import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "./entrypointUtils.js"

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const docsPath = resolve(repoRoot, "docs/FINAL_COMMIT_PACKAGE_AND_CLEAN_BASELINE_GATE.md");
const evidenceJsonPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-284a-final-commit-package-clean-baseline-gate.json");
const evidenceMdPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-284a-final-commit-package-clean-baseline-gate.md");
const runPath = resolve(repoRoot, "apps/ai-gateway-service/src/entrypoints/runFinalCommitPackageCleanBaselineGate.js");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(repoRoot, "apps/ai-gateway-service/package.json");
const consolePagePath = resolve(repoRoot, "apps/ai-gateway-service/src/ui/consolePage.js");


function assertCheck(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

function packageScriptExists(filePath, scriptName) {
  if (!existsSync(filePath)) {
    return false;
  }
  const packageJson = readJson(filePath);
  return Boolean(packageJson.scripts?.[scriptName]);
}

export function verifyFinalCommitPackageCleanBaselineGate() {
  const failures = [];
  const requiredFiles = [
    docsPath,
    evidenceJsonPath,
    evidenceMdPath,
    runPath,
  ];

  for (const filePath of requiredFiles) {
    assertCheck(existsSync(filePath), `missing required file: ${filePath}`, failures);
  }

  if (failures.length > 0) {
    return { ok: false, failures };
  }

  const evidence = readJson(evidenceJsonPath);
  const docsText = readFileSync(docsPath, "utf8");
  const consoleText = existsSync(consolePagePath) ? readFileSync(consolePagePath, "utf8") : "";

  assertCheck(evidence.phase === "284A", "phase must be 284A", failures);
  assertCheck(evidence.status === "pass", "status must be pass", failures);
  assertCheck(evidence.currentBlocker === "none", "currentBlocker must be none", failures);
  assertCheck(evidence.paidApiCallCount === 0, "paidApiCallCount must be 0", failures);
  assertCheck(evidence.externalApiCalled === false, "externalApiCalled must be false", failures);
  assertCheck(evidence.mimoApiCalled === false, "mimoApiCalled must be false", failures);
  assertCheck(evidence.embeddingCalled === false, "embeddingCalled must be false", failures);
  assertCheck(evidence.legacyModified === false, "legacyModified must be false", failures);
  assertCheck(evidence.projectContextCreated === false, "projectContextCreated must be false", failures);
  assertCheck(evidence.commitPerformed === false, "commitPerformed must be false", failures);
  assertCheck(evidence.pushPerformed === false, "pushPerformed must be false", failures);
  assertCheck(evidence.realReleasePerformed === false, "realReleasePerformed must be false", failures);
  assertCheck(evidence.remoteDeployPerformed === false, "remoteDeployPerformed must be false", failures);
  assertCheck(evidence.workspaceCleanClaimed === false, "workspaceCleanClaimed must be false", failures);
  assertCheck(evidence.dirtyWorkspaceObserved === true, "dirtyWorkspaceObserved must be true", failures);
  assertCheck(evidence.manualCommitRequired === true, "manualCommitRequired must be true", failures);
  assertCheck(evidence.productionReadyClaimed === false, "productionReadyClaimed must be false", failures);
  assertCheck(Array.isArray(evidence.commitCandidateFiles), "commitCandidateFiles must be an array", failures);
  assertCheck(Array.isArray(evidence.nonCommitCandidateFiles), "nonCommitCandidateFiles must be an array", failures);
  assertCheck(Array.isArray(evidence.riskFiles), "riskFiles must be an array", failures);
  assertCheck(Object.prototype.hasOwnProperty.call(evidence, "finalCommitPackageReady"), "finalCommitPackageReady must exist", failures);

  const requiredDocsMarkers = [
    "Executive Summary",
    "Current Workspace Reality",
    "Dirty Workspace Boundary",
    "Phase-Based Change Classification",
    "Commit Candidate Files",
    "Non-Commit Candidate Files",
    "Temporary / Generated / Risk Files",
    "Evidence Completeness Review",
    "Verifier Completeness Review",
    "Package Scripts Review",
    "Documentation Completeness Review",
    "Secret Safety Review",
    "legacy/ Boundary Review",
    "PROJECT_CONTEXT.md Boundary Review",
    "Production-Ready Claim Boundary",
    "Final Commit Package Plan",
    "Manual Commit Recommendation",
    "Final Phase 284A Conclusion",
    "no commit",
    "no push",
    "no release",
    "no deploy",
    "workspace dirty is observed and classified",
    "human confirmation",
  ];

  for (const marker of requiredDocsMarkers) {
    assertCheck(docsText.includes(marker), `docs missing marker: ${marker}`, failures);
  }

  assertCheck(packageScriptExists(rootPackagePath, "run:phase284a-final-commit-package-clean-baseline-gate"), "root run script missing", failures);
  assertCheck(packageScriptExists(rootPackagePath, "verify:phase284a-final-commit-package-clean-baseline-gate"), "root verify script missing", failures);
  assertCheck(packageScriptExists(servicePackagePath, "run:phase284a-final-commit-package-clean-baseline-gate"), "service run script missing", failures);
  assertCheck(packageScriptExists(servicePackagePath, "verify:phase284a-final-commit-package-clean-baseline-gate"), "service verify script missing", failures);
  assertCheck(consoleText.includes("Final Commit Package and Clean Baseline Gate"), "UI marker missing", failures);

  return { ok: failures.length === 0, failures };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = verifyFinalCommitPackageCleanBaselineGate();
  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({
    status: "passed",
    phase: "284A",
    verifier: "verifyFinalCommitPackageCleanBaselineGate",
  }, null, 2));
}
