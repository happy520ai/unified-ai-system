import { validateCapabilityNeuronManifest } from "./capabilityNeuronManifest.js";

export function generateVerifierEvidenceRollback(spec, manifest, dryRunResult) {
  const manifestValidation = validateCapabilityNeuronManifest(manifest);
  const verifierResult = {
    verifierVersion: "phase651-666-verifier-v1",
    capabilityId: manifest.capabilityId,
    passed: manifestValidation.valid && dryRunResult.status === "passed",
    unsupportedClaims: [],
    hallucinatedFacts: [],
    unsupportedClaimCount: 0,
    hallucinatedFactCount: 0,
    checks: [
      { id: "manifest_valid", passed: manifestValidation.valid, details: manifestValidation.failures },
      { id: "dry_run_passed", passed: dryRunResult.status === "passed" },
      { id: "runtime_disabled", passed: manifest.runtime.enabledByDefault === false },
      { id: "approval_required", passed: manifest.approval.requiredForRuntime === true },
      { id: "provider_calls_false", passed: dryRunResult.providerCallsMade === false },
    ],
  };

  return {
    capabilityId: manifest.capabilityId,
    verifierResult,
    evidenceSchema: {
      schema: "gateway-capability-evidence-v1",
      requiredFields: ["capabilityId", "manifest", "riskClassification", "dryRunResult", "rollbackPlan"],
    },
    rollbackPlan: {
      disableFlag: manifest.rollback.disableFlag,
      deletePaths: manifest.rollback.deletePaths,
      steps: [
        "remove generated dry-run adapter preview",
        "remove registry preview entry",
        "remove synapse preview entry",
        "keep /chat and /chat-gateway/execute unchanged",
      ],
    },
    spec,
  };
}

export function generateVerifierEvidenceRollbacks(specs, manifests, dryRunResults) {
  return specs.map((spec, index) => generateVerifierEvidenceRollback(spec, manifests[index], dryRunResults[index]));
}
