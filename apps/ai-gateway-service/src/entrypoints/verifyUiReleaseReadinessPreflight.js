import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "./entrypointUtils.js"

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const docsPath = resolve(repoRoot, "docs/UI_EXPERIENCE_AND_RELEASE_READINESS_PREFLIGHT.md");
const evidenceJsonPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-283a-ui-release-readiness-preflight.json");
const evidenceMdPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-283a-ui-release-readiness-preflight.md");
const runPath = resolve(repoRoot, "apps/ai-gateway-service/src/entrypoints/runUiReleaseReadinessPreflight.js");
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

export function verifyUiReleaseReadinessPreflight() {
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

  assertCheck(evidence.phase === "283A", "phase must be 283A", failures);
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
  assertCheck(evidence.productionReadyClaimed === false, "productionReadyClaimed must be false", failures);
  assertCheck(evidence.releaseReadyClaimed !== true, "releaseReadyClaimed must not be true", failures);
  assertCheck(evidence.deployReadyClaimed === false, "deployReadyClaimed must be false", failures);
  assertCheck(Boolean(evidence.phaseReadinessPanel?.enabled), "phaseReadinessPanel must exist", failures);
  assertCheck(Boolean(evidence.evidenceOverviewPanel?.enabled), "evidenceOverviewPanel must exist", failures);
  assertCheck(Boolean(evidence.safetyBoundaryPanel?.enabled), "safetyBoundaryPanel must exist", failures);
  assertCheck(Boolean(evidence.nextActionGuidancePanel?.enabled), "nextActionGuidancePanel must exist", failures);
  assertCheck(Boolean(evidence.releaseReadinessPreflightPanel?.enabled), "releaseReadinessPreflightPanel must exist", failures);

  const requiredDocsMarkers = [
    "Executive Summary",
    "UI Polish Scope",
    "Release Readiness Scope",
    "Local Preview Boundary",
    "Safety Boundary",
    "Evidence Overview",
    "Current Phase Status",
    "Not Production Ready Boundary",
    "No Remote Deploy Boundary",
    "No Real Release Boundary",
    "Recommended UI Improvements",
    "Recommended Release Preflight Checklist",
    "Final Phase 283A Conclusion",
    "only does UI polish and release readiness preflight",
    "does not perform a real release",
    "does not perform remote deploy",
  ];

  for (const marker of requiredDocsMarkers) {
    assertCheck(docsText.includes(marker), `docs missing marker: ${marker}`, failures);
  }

  assertCheck(packageScriptExists(rootPackagePath, "run:phase283a-ui-release-readiness-preflight"), "root run script missing", failures);
  assertCheck(packageScriptExists(rootPackagePath, "verify:phase283a-ui-release-readiness-preflight"), "root verify script missing", failures);
  assertCheck(packageScriptExists(servicePackagePath, "run:phase283a-ui-release-readiness-preflight"), "service run script missing", failures);
  assertCheck(packageScriptExists(servicePackagePath, "verify:phase283a-ui-release-readiness-preflight"), "service verify script missing", failures);
  assertCheck(consoleText.includes("UI Experience Polish / Release Readiness Preflight"), "UI marker missing", failures);
  assertCheck(consoleText.includes("Phase Readiness Panel"), "Phase Readiness Panel UI marker missing", failures);
  assertCheck(consoleText.includes("Evidence Overview Panel"), "Evidence Overview Panel UI marker missing", failures);
  assertCheck(consoleText.includes("Safety Boundary Panel"), "Safety Boundary Panel UI marker missing", failures);
  assertCheck(consoleText.includes("Next Action Guidance Panel"), "Next Action Guidance Panel UI marker missing", failures);
  assertCheck(consoleText.includes("Release Readiness Preflight Panel"), "Release Readiness Preflight Panel UI marker missing", failures);

  return { ok: failures.length === 0, failures };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const result = verifyUiReleaseReadinessPreflight();
  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({
    status: "passed",
    phase: "283A",
    verifier: "verifyUiReleaseReadinessPreflight",
  }, null, 2));
}
