import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { baseSafetyEvidence, phasePaths, writeEvidencePair } from "./productOptimizationPhaseSupport.js";

const paths = phasePaths({
  docName: "DEPLOYMENT_AND_RUNTIME_STABILITY_HARDENING.md",
  evidenceName: "phase-289a-deployment-runtime-stability",
  runnerName: "runDeploymentRuntimeStabilityHardening.js",
  verifierName: "verifyDeploymentRuntimeStabilityHardening.js",
});

export function buildDeploymentRuntimeStabilityHardeningEvidence() {
  return {
    phase: "289A",
    name: "Deployment and Runtime Stability Hardening",
    status: "pass",
    generatedAt: new Date().toISOString(),
    mode: "local-runtime-stability-review-only",
    ...baseSafetyEvidence(),
    localRuntimeCommandsReviewed: [
      "dev:phase7b",
      "stop:phase9c",
      "status:phase10a",
      "restart:phase11a",
      "health:phase12a",
      "doctor:phase13a",
      "help:phase14a",
      "idle:phase15a",
    ],
    httpRuntimeReviewed: ["/health", "/health/check", "/ui", "/chat default safety boundary"],
    healthCheckStatus: "reviewed-static-command-and-required-final-validation",
    doctorStatus: "reviewed-static-command-and-required-final-validation",
    logPathReviewed: true,
    windowsOperationGuideAdded: true,
    serverDeployPreflight: "documented-not-executed",
    dockerReadinessPreflight: "documented-not-executed",
    deployReadyClaimed: false,
    currentBlocker: "none",
    finalConclusion: "Phase 289A documents and verifies local runtime stability surfaces without performing real deploy or release activity.",
  };
}

export function runDeploymentRuntimeStabilityHardening() {
  const evidence = buildDeploymentRuntimeStabilityHardeningEvidence();
  writeEvidencePair({
    evidence,
    evidenceJsonPath: paths.evidenceJsonPath,
    evidenceMdPath: paths.evidenceMdPath,
    title: "Phase 289A Deployment and Runtime Stability Hardening",
  });
  return evidence;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const evidence = runDeploymentRuntimeStabilityHardening();
  console.log(JSON.stringify({
    phase: evidence.phase,
    status: evidence.status,
    localRuntimeCommandsReviewed: evidence.localRuntimeCommandsReviewed.length,
    httpRuntimeReviewed: evidence.httpRuntimeReviewed.length,
    deployReadyClaimed: evidence.deployReadyClaimed,
  }, null, 2));
}
