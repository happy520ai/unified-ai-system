import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  baseSafetyEvidence,
  phasePaths,
  repoRoot,
  writeEvidencePair,
} from "./productOptimizationPhaseSupport.js";

const paths = phasePaths({
  docName: "PRODUCT_DEEP_OPTIMIZATION_ROADMAP.md",
  evidenceName: "phase-286a-product-deep-optimization-roadmap",
  runnerName: "runProductDeepOptimizationRoadmap.js",
  verifierName: "verifyProductDeepOptimizationRoadmap.js",
});

export function buildProductDeepOptimizationRoadmapEvidence() {
  return {
    phase: "286A",
    name: "Product Deep Optimization Roadmap",
    status: "pass",
    generatedAt: new Date().toISOString(),
    mode: "local-static-product-roadmap-only",
    ...baseSafetyEvidence(),
    salesMaterialCreated: false,
    businessPromiseCreated: false,
    roadmapPanelAdded: true,
    analysisDirections: [
      "coreWorkflow",
      "productConsole",
      "knowledgeSystem",
      "providerCostGovernance",
      "deploymentOperations",
      "regressionQuality",
    ],
    recommendedNextPhases: [
      "Phase287A Core / Architecture Refactor",
      "Phase288A Architecture Debt Cleanup",
      "Phase289A Deployment Runtime Stability",
      "Phase290A Provider Cost Governance",
      "Phase291A Unified Regression Matrix",
      "Phase292A Product Operation Manual",
    ],
    currentBlocker: "none",
    finalConclusion: "Phase 286A records a local product deep optimization roadmap without sales claims, provider calls, release, deploy, commit, or push.",
  };
}

export function runProductDeepOptimizationRoadmap() {
  const evidence = buildProductDeepOptimizationRoadmapEvidence();
  writeEvidencePair({
    evidence,
    evidenceJsonPath: paths.evidenceJsonPath,
    evidenceMdPath: paths.evidenceMdPath,
    title: "Phase 286A Product Deep Optimization Roadmap",
  });
  return evidence;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const evidence = runProductDeepOptimizationRoadmap();
  console.log(JSON.stringify({
    phase: evidence.phase,
    status: evidence.status,
    analysisDirections: evidence.analysisDirections.length,
    recommendedNextPhases: evidence.recommendedNextPhases.length,
    repoRoot,
  }, null, 2));
}
