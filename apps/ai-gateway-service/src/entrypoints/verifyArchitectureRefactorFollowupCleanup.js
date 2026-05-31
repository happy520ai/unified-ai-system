import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCheck,
  phasePaths,
  printVerifierResult,
  readJson,
  readText,
  repoRoot,
  requireFiles,
  requireMarkers,
  verifyCommonPhase,
} from "./productOptimizationPhaseSupport.js";

const paths = phasePaths({
  docName: "ARCHITECTURE_REFACTOR_FOLLOWUP_CLEANUP.md",
  evidenceName: "phase-288a-architecture-refactor-followup-cleanup",
  runnerName: "runArchitectureRefactorFollowupCleanup.js",
  verifierName: "verifyArchitectureRefactorFollowupCleanup.js",
});
const guidePath = resolve(repoRoot, "docs/ARCHITECTURE_EXTENSION_GUIDE.md");

export function verifyArchitectureRefactorFollowupCleanup() {
  const failures = [];
  requireFiles([paths.docsPath, guidePath, paths.evidenceJsonPath, paths.evidenceMdPath, paths.runnerPath, paths.verifierPath], failures);
  if (failures.length) return { ok: false, failures };

  const evidence = readJson(paths.evidenceJsonPath);
  const docsText = readText(paths.docsPath);
  const guideText = readText(guidePath);

  verifyCommonPhase({
    evidence,
    phase: "288A",
    rootRunScript: "run:phase288a-architecture-refactor-followup-cleanup",
    rootVerifyScript: "verify:phase288a-architecture-refactor-followup-cleanup",
    serviceRunScript: "run:phase288a-architecture-refactor-followup-cleanup",
    serviceVerifyScript: "verify:phase288a-architecture-refactor-followup-cleanup",
    failures,
  });

  for (const [key, expected] of Object.entries({
    basedOnPhase287A: true,
    remainingArchitectureDebtReviewed: true,
    safeCleanupApplied: true,
    riskyCleanupSkipped: true,
    entrypointCleanupApplied: true,
    evidenceVerifierCleanupApplied: true,
    uiPanelCleanupApplied: true,
    architectureExtensionGuideAdded: true,
    compatibilityPreserved: true,
    publicApiChanged: false,
    providerDefaultChanged: false,
    perfectionClaimed: false,
  })) {
    assertCheck(evidence[key] === expected, `${key} must be ${expected}`, failures);
  }

  assertCheck(existsSync(guidePath), "architecture extension guide missing", failures);
  requireMarkers(docsText, [
    "Based On Phase 287A",
    "Remaining Architecture Debt Reviewed",
    "Safe Cleanup Applied",
    "Risky Cleanup Skipped",
    "Entrypoint Cleanup Applied",
    "Evidence Verifier Cleanup Applied",
    "UI Panel Cleanup Applied",
    "Final Phase 288A Conclusion",
  ], failures, "docs");
  requireMarkers(guideText, [
    "How To Add A Phase",
    "How To Add A Runner",
    "How To Add A Verifier",
    "How To Add Evidence",
    "How To Add A UI Panel",
    "How To Safely Add Provider",
    "How To Safely Add Knowledge Feature",
    "Safety Checklist",
    "Testing Checklist",
  ], failures, "extension guide");

  return { ok: failures.length === 0, failures };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  printVerifierResult({
    ...verifyArchitectureRefactorFollowupCleanup(),
    phase: "288A",
    verifier: "verifyArchitectureRefactorFollowupCleanup",
  });
}
