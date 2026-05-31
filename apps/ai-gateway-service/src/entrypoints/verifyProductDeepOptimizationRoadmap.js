import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertCheck,
  consolePagePath,
  phasePaths,
  printVerifierResult,
  readJson,
  readText,
  requireFiles,
  requireMarkers,
  verifyCommonPhase,
} from "./productOptimizationPhaseSupport.js";

const paths = phasePaths({
  docName: "PRODUCT_DEEP_OPTIMIZATION_ROADMAP.md",
  evidenceName: "phase-286a-product-deep-optimization-roadmap",
  runnerName: "runProductDeepOptimizationRoadmap.js",
  verifierName: "verifyProductDeepOptimizationRoadmap.js",
});
const roadmapPanelPath = resolve(dirname(paths.verifierPath), "../ui/productOptimizationPanels.js");

export function verifyProductDeepOptimizationRoadmap() {
  const failures = [];
  requireFiles([paths.docsPath, paths.evidenceJsonPath, paths.evidenceMdPath, paths.runnerPath, paths.verifierPath], failures);
  if (failures.length) return { ok: false, failures };

  const evidence = readJson(paths.evidenceJsonPath);
  const docsText = readText(paths.docsPath);
  const consoleText = [
    existsSync(consolePagePath) ? readText(consolePagePath) : "",
    existsSync(roadmapPanelPath) ? readText(roadmapPanelPath) : "",
  ].join("\n");

  verifyCommonPhase({
    evidence,
    phase: "286A",
    rootRunScript: "run:phase286a-product-deep-optimization-roadmap",
    rootVerifyScript: "verify:phase286a-product-deep-optimization-roadmap",
    serviceRunScript: "run:phase286a-product-deep-optimization-roadmap",
    serviceVerifyScript: "verify:phase286a-product-deep-optimization-roadmap",
    failures,
  });

  const directions = ["coreWorkflow", "productConsole", "knowledgeSystem", "providerCostGovernance", "deploymentOperations", "regressionQuality"];
  for (const direction of directions) {
    assertCheck(evidence.analysisDirections?.includes(direction), `missing analysis direction: ${direction}`, failures);
  }

  const nextPhases = [
    "Phase287A Core / Architecture Refactor",
    "Phase288A Architecture Debt Cleanup",
    "Phase289A Deployment Runtime Stability",
    "Phase290A Provider Cost Governance",
    "Phase291A Unified Regression Matrix",
    "Phase292A Product Operation Manual",
  ];
  for (const phase of nextPhases) {
    assertCheck(evidence.recommendedNextPhases?.includes(phase), `missing recommended phase: ${phase}`, failures);
  }

  assertCheck(evidence.salesMaterialCreated === false, "salesMaterialCreated must be false", failures);
  assertCheck(evidence.roadmapPanelAdded === true, "roadmapPanelAdded must be true", failures);
  requireMarkers(docsText, [
    "Executive Summary",
    "Analysis Direction: coreWorkflow",
    "Analysis Direction: productConsole",
    "Analysis Direction: knowledgeSystem",
    "Analysis Direction: providerCostGovernance",
    "Analysis Direction: deploymentOperations",
    "Analysis Direction: regressionQuality",
    "Recommended Later Phases",
    "UI Roadmap Panel",
    "Final Phase 286A Conclusion",
  ], failures, "docs");
  requireMarkers(consoleText, [
    "phase286a-product-deep-optimization-roadmap",
    "Phase 286A Product Deep Optimization Roadmap",
    "Phase 286A roadmap analysis panel",
  ], failures, "UI");

  return { ok: failures.length === 0, failures };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  printVerifierResult({
    ...verifyProductDeepOptimizationRoadmap(),
    phase: "286A",
    verifier: "verifyProductDeepOptimizationRoadmap",
  });
}
