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
  docName: "MODULAR_ARCHITECTURE_REFACTOR_FIRST_CUT.md",
  evidenceName: "phase-287a-modular-architecture-refactor-first-cut",
  runnerName: "runModularArchitectureRefactorFirstCut.js",
  verifierName: "verifyModularArchitectureRefactorFirstCut.js",
});

export function verifyModularArchitectureRefactorFirstCut() {
  const failures = [];
  requireFiles([paths.docsPath, paths.evidenceJsonPath, paths.evidenceMdPath, paths.runnerPath, paths.verifierPath], failures);
  if (failures.length) return { ok: false, failures };

  const evidence = readJson(paths.evidenceJsonPath);
  const docsText = readText(paths.docsPath);

  verifyCommonPhase({
    evidence,
    phase: "287A",
    rootRunScript: "run:phase287a-modular-architecture-refactor-first-cut",
    rootVerifyScript: "verify:phase287a-modular-architecture-refactor-first-cut",
    serviceRunScript: "run:phase287a-modular-architecture-refactor-first-cut",
    serviceVerifyScript: "verify:phase287a-modular-architecture-refactor-first-cut",
    failures,
  });

  assertCheck(evidence.architectureReviewed === true, "architectureReviewed must be true", failures);
  assertCheck(Array.isArray(evidence.modulesReviewed) && evidence.modulesReviewed.length >= 4, "modulesReviewed must cover reviewed modules", failures);
  assertCheck(Array.isArray(evidence.modulesRefactored) && evidence.modulesRefactored.length >= 2, "modulesRefactored must include helper modules", failures);
  assertCheck(evidence.entrypointsSlimmed === true, "entrypointsSlimmed must be true", failures);
  assertCheck(evidence.evidenceUtilitiesAdded === true, "evidenceUtilitiesAdded must be true", failures);
  assertCheck(evidence.uiPanelsSeparated === true, "uiPanelsSeparated must be true", failures);
  assertCheck(Array.isArray(evidence.performanceOptimizationsApplied), "performanceOptimizationsApplied must be an array", failures);
  assertCheck(evidence.publicApiChanged === false, "publicApiChanged must be false", failures);
  assertCheck(evidence.providerDefaultChanged === false, "providerDefaultChanged must be false", failures);
  assertCheck(evidence.compatibilityPreserved === true, "compatibilityPreserved must be true", failures);
  assertCheck(evidence.perfectionClaimed === false, "perfectionClaimed must be false", failures);
  assertCheck(existsSync(`${repoRoot}/apps/ai-gateway-service/src/entrypoints/productOptimizationPhaseSupport.js`), "phase support helper missing", failures);
  assertCheck(existsSync(`${repoRoot}/apps/ai-gateway-service/src/ui/productOptimizationPanels.js`), "UI panel helper missing", failures);
  requireMarkers(docsText, [
    "Modules Reviewed",
    "Modules Refactored",
    "Real Refactor Applied",
    "Performance Optimizations Applied",
    "Compatibility Boundary",
    "Final Phase 287A Conclusion",
  ], failures, "docs");

  return { ok: failures.length === 0, failures };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  printVerifierResult({
    ...verifyModularArchitectureRefactorFirstCut(),
    phase: "287A",
    verifier: "verifyModularArchitectureRefactorFirstCut",
  });
}
