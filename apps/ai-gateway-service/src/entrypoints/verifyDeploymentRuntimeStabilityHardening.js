import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  assertCheck,
  phasePaths,
  printVerifierResult,
  readJson,
  readText,
  requireFiles,
  requireMarkers,
  verifyCommonPhase,
} from "./productOptimizationPhaseSupport.js";

const paths = phasePaths({
  docName: "DEPLOYMENT_AND_RUNTIME_STABILITY_HARDENING.md",
  evidenceName: "phase-289a-deployment-runtime-stability",
  runnerName: "runDeploymentRuntimeStabilityHardening.js",
  verifierName: "verifyDeploymentRuntimeStabilityHardening.js",
});

export function verifyDeploymentRuntimeStabilityHardening() {
  const failures = [];
  requireFiles([paths.docsPath, paths.evidenceJsonPath, paths.evidenceMdPath, paths.runnerPath, paths.verifierPath], failures);
  if (failures.length) return { ok: false, failures };

  const evidence = readJson(paths.evidenceJsonPath);
  const docsText = readText(paths.docsPath);

  verifyCommonPhase({
    evidence,
    phase: "289A",
    rootRunScript: "run:phase289a-deployment-runtime-stability",
    rootVerifyScript: "verify:phase289a-deployment-runtime-stability",
    serviceRunScript: "run:phase289a-deployment-runtime-stability",
    serviceVerifyScript: "verify:phase289a-deployment-runtime-stability",
    failures,
  });

  for (const command of ["dev:phase7b", "stop:phase9c", "status:phase10a", "restart:phase11a", "health:phase12a", "doctor:phase13a", "help:phase14a", "idle:phase15a"]) {
    assertCheck(evidence.localRuntimeCommandsReviewed?.includes(command), `missing reviewed command: ${command}`, failures);
  }
  for (const endpoint of ["/health", "/health/check", "/ui", "/chat default safety boundary"]) {
    assertCheck(evidence.httpRuntimeReviewed?.includes(endpoint), `missing reviewed endpoint: ${endpoint}`, failures);
  }
  assertCheck(Boolean(evidence.healthCheckStatus), "healthCheckStatus must be present", failures);
  assertCheck(Boolean(evidence.doctorStatus), "doctorStatus must be present", failures);
  assertCheck(evidence.logPathReviewed === true, "logPathReviewed must be true", failures);
  assertCheck(evidence.windowsOperationGuideAdded === true, "windowsOperationGuideAdded must be true", failures);
  assertCheck(Boolean(evidence.serverDeployPreflight), "serverDeployPreflight must be present", failures);
  assertCheck(Boolean(evidence.dockerReadinessPreflight), "dockerReadinessPreflight must be present", failures);
  assertCheck(evidence.deployReadyClaimed !== true, "deployReadyClaimed must not be true", failures);
  requireMarkers(docsText, [
    "Local Runtime Commands Reviewed",
    "HTTP Runtime Reviewed",
    "Log Path Reviewed",
    "Windows Operation Guide",
    "Server Deploy Preflight",
    "Docker Readiness Preflight",
    "No Real Deploy Boundary",
    "Final Phase 289A Conclusion",
  ], failures, "docs");

  return { ok: failures.length === 0, failures };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  printVerifierResult({
    ...verifyDeploymentRuntimeStabilityHardening(),
    phase: "289A",
    verifier: "verifyDeploymentRuntimeStabilityHardening",
  });
}
