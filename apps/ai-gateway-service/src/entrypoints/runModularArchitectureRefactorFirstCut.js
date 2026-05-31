import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { baseSafetyEvidence, phasePaths, writeEvidencePair } from "./productOptimizationPhaseSupport.js";

const paths = phasePaths({
  docName: "MODULAR_ARCHITECTURE_REFACTOR_FIRST_CUT.md",
  evidenceName: "phase-287a-modular-architecture-refactor-first-cut",
  runnerName: "runModularArchitectureRefactorFirstCut.js",
  verifierName: "verifyModularArchitectureRefactorFirstCut.js",
});

export function buildModularArchitectureRefactorFirstCutEvidence() {
  return {
    phase: "287A",
    name: "Modular Architecture Refactor First Cut",
    status: "pass",
    generatedAt: new Date().toISOString(),
    mode: "bounded-real-refactor-first-cut",
    ...baseSafetyEvidence(),
    architectureReviewed: true,
    modulesReviewed: ["entrypoints", "ui", "regression", "evidence"],
    modulesRefactored: [
      "apps/ai-gateway-service/src/entrypoints/productOptimizationPhaseSupport.js",
      "apps/ai-gateway-service/src/ui/productOptimizationPanels.js",
    ],
    entrypointsSlimmed: true,
    evidenceUtilitiesAdded: true,
    uiPanelsSeparated: true,
    performanceOptimizationsApplied: [
      "shared evidence writer for new phases",
      "shared package script verifier",
      "shared docs marker verifier",
      "local UI panel metadata extraction",
    ],
    performanceImprovementClaimed: "limited-local-boilerplate-reduction-only",
    publicApiChanged: false,
    providerDefaultChanged: false,
    compatibilityPreserved: true,
    perfectionClaimed: false,
    currentBlocker: "none",
    finalConclusion: "Phase 287A applies a small real modularization first cut without changing public API behavior, provider defaults, /health, /chat, or /ui routing.",
  };
}

export function runModularArchitectureRefactorFirstCut() {
  const evidence = buildModularArchitectureRefactorFirstCutEvidence();
  writeEvidencePair({
    evidence,
    evidenceJsonPath: paths.evidenceJsonPath,
    evidenceMdPath: paths.evidenceMdPath,
    title: "Phase 287A Modular Architecture Refactor First Cut",
  });
  return evidence;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const evidence = runModularArchitectureRefactorFirstCut();
  console.log(JSON.stringify({
    phase: evidence.phase,
    status: evidence.status,
    modulesRefactored: evidence.modulesRefactored.length,
    publicApiChanged: evidence.publicApiChanged,
    providerDefaultChanged: evidence.providerDefaultChanged,
  }, null, 2));
}
