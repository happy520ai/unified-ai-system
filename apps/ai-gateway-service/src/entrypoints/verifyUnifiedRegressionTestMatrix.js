import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "./entrypointUtils.js"

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const docsPath = resolve(repoRoot, "docs/UNIFIED_REGRESSION_TEST_MATRIX.md");
const evidenceJsonPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-291a-unified-regression-test-matrix.json");
const evidenceMdPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-291a-unified-regression-test-matrix.md");
const matrixPath = resolve(repoRoot, "apps/ai-gateway-service/src/regression/regressionMatrix.js");
const safeRunnerPath = resolve(repoRoot, "apps/ai-gateway-service/src/regression/runSafeRegressionMatrix.js");
const runnerPath = resolve(repoRoot, "apps/ai-gateway-service/src/entrypoints/runUnifiedRegressionTestMatrix.js");
const rootPackagePath = resolve(repoRoot, "package.json");
const servicePackagePath = resolve(repoRoot, "apps/ai-gateway-service/package.json");


function assertCheck(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

function packageScriptExists(filePath, scriptName) {
  if (!existsSync(filePath)) {
    return false;
  }
  return Boolean(readJson(filePath).scripts?.[scriptName]);
}

function hasPlaintextApiKey(text) {
  const patterns = [
    /sk-[A-Za-z0-9]{20,}/,
    /nvapi-[A-Za-z0-9_-]{20,}/,
    /Authorization:\s*Bearer\s+[A-Za-z0-9._-]{20,}/i,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

export function verifyUnifiedRegressionTestMatrix() {
  const failures = [];
  const requiredFiles = [
    docsPath,
    evidenceJsonPath,
    evidenceMdPath,
    matrixPath,
    safeRunnerPath,
    runnerPath,
  ];

  for (const filePath of requiredFiles) {
    assertCheck(existsSync(filePath), `missing required file: ${filePath}`, failures);
  }

  if (failures.length > 0) {
    return { ok: false, failures };
  }

  const evidence = readJson(evidenceJsonPath);
  const docsText = readFileSync(docsPath, "utf8");
  const evidenceText = readFileSync(evidenceJsonPath, "utf8");
  const mdText = readFileSync(evidenceMdPath, "utf8");

  assertCheck(evidence.phase === "291A", "phase must be 291A", failures);
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
  assertCheck(Array.isArray(evidence.safeDefaultChecks), "safeDefaultChecks must be an array", failures);
  assertCheck(Array.isArray(evidence.localPreviewChecks), "localPreviewChecks must be an array", failures);
  assertCheck(Array.isArray(evidence.externalRiskChecks), "externalRiskChecks must be an array", failures);
  assertCheck(Array.isArray(evidence.manualOnlyChecks), "manualOnlyChecks must be an array", failures);
  assertCheck(Array.isArray(evidence.releasePreflightChecks), "releasePreflightChecks must be an array", failures);
  assertCheck(Array.isArray(evidence.notAvailableChecks), "notAvailableChecks must be an array", failures);
  assertCheck(Array.isArray(evidence.executedChecks), "executedChecks must be an array", failures);
  assertCheck(Array.isArray(evidence.failedChecks), "failedChecks must be an array", failures);
  assertCheck(Array.isArray(evidence.skippedChecks), "skippedChecks must be an array", failures);
  assertCheck(evidence.regressionMatrixReady === true, "regressionMatrixReady must be true", failures);
  assertCheck(evidence.providerCallRiskDetected === false, "providerCallRiskDetected must be false", failures);
  assertCheck(evidence.productionReadyClaimed === false, "productionReadyClaimed must be false", failures);
  assertCheck(evidence.executedChecks.every((item) => item.category !== "external-risk" && item.category !== "manual-only"), "executedChecks must not include external-risk/manual-only", failures);
  assertCheck(evidence.skippedChecks.every((item) => item.status === "skipped"), "skippedChecks must have skipped status", failures);
  assertCheck(evidence.notAvailableChecks.every((item) => item.status === "not_available"), "notAvailableChecks must have not_available status", failures);

  const requiredDocsMarkers = [
    "Executive Summary",
    "Regression Matrix Purpose",
    "Safe Default Checks",
    "Local Preview Checks",
    "External Risk Checks",
    "Manual Only Checks",
    "Release Preflight Checks",
    "Not Available Checks",
    "Environment Variable Requirements",
    "No Provider Call Boundary",
    "Daily Check Recommendation",
    "Release Preflight Recommendation",
    "Failure Handling",
    "Final Phase 291A Conclusion",
    "external-risk / manual-only checks are not executed by default",
    "skipped is not passed",
    "not_available is not passed",
  ];

  for (const marker of requiredDocsMarkers) {
    assertCheck(docsText.includes(marker), `docs missing marker: ${marker}`, failures);
  }

  assertCheck(!hasPlaintextApiKey(docsText), "docs must not contain plaintext API keys", failures);
  assertCheck(!hasPlaintextApiKey(evidenceText), "evidence JSON must not contain plaintext API keys", failures);
  assertCheck(!hasPlaintextApiKey(mdText), "evidence MD must not contain plaintext API keys", failures);
  assertCheck(packageScriptExists(rootPackagePath, "run:phase291a-unified-regression-test-matrix"), "root run script missing", failures);
  assertCheck(packageScriptExists(rootPackagePath, "verify:phase291a-unified-regression-test-matrix"), "root verify script missing", failures);
  assertCheck(packageScriptExists(rootPackagePath, "verify:safe-regression-matrix"), "root safe regression script missing", failures);
  assertCheck(packageScriptExists(servicePackagePath, "run:phase291a-unified-regression-test-matrix"), "service run script missing", failures);
  assertCheck(packageScriptExists(servicePackagePath, "verify:phase291a-unified-regression-test-matrix"), "service verify script missing", failures);
  assertCheck(packageScriptExists(servicePackagePath, "verify:safe-regression-matrix"), "service safe regression script missing", failures);

  return { ok: failures.length === 0, failures };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = verifyUnifiedRegressionTestMatrix();
  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({
    status: "passed",
    phase: "291A",
    verifier: "verifyUnifiedRegressionTestMatrix",
  }, null, 2));
}
