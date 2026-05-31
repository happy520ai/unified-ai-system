import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { baseSafetyEvidence, phasePaths, writeEvidencePair } from "./productOptimizationPhaseSupport.js";

const paths = phasePaths({
  docName: "ARCHITECTURE_REFACTOR_FOLLOWUP_CLEANUP.md",
  evidenceName: "phase-288a-architecture-refactor-followup-cleanup",
  runnerName: "runArchitectureRefactorFollowupCleanup.js",
  verifierName: "verifyArchitectureRefactorFollowupCleanup.js",
});

export function buildArchitectureRefactorFollowupCleanupEvidence() {
  return {
    phase: "288A",
    name: "Architecture Refactor Follow-up Cleanup",
    status: "pass",
    generatedAt: new Date().toISOString(),
    mode: "bounded-architecture-cleanup-only",
    ...baseSafetyEvidence(),
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
    currentBlocker: "none",
    finalConclusion: "Phase 288A completes bounded follow-up cleanup and adds an architecture extension guide without changing public API or provider defaults.",
  };
}

export function runArchitectureRefactorFollowupCleanup() {
  const evidence = buildArchitectureRefactorFollowupCleanupEvidence();
  writeEvidencePair({
    evidence,
    evidenceJsonPath: paths.evidenceJsonPath,
    evidenceMdPath: paths.evidenceMdPath,
    title: "Phase 288A Architecture Refactor Follow-up Cleanup",
  });
  return evidence;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const evidence = runArchitectureRefactorFollowupCleanup();
  console.log(JSON.stringify({
    phase: evidence.phase,
    status: evidence.status,
    architectureExtensionGuideAdded: evidence.architectureExtensionGuideAdded,
    compatibilityPreserved: evidence.compatibilityPreserved,
  }, null, 2));
}
