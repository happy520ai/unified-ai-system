import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { getProviderCostGovernancePolicy } from "../cost/providerCostGovernancePolicy.js";
import { baseSafetyEvidence, phasePaths, writeEvidencePair } from "./productOptimizationPhaseSupport.js";

const paths = phasePaths({
  docName: "PROVIDER_COST_AND_FREE_MODEL_GOVERNANCE.md",
  evidenceName: "phase-290a-provider-cost-free-model-governance",
  runnerName: "runProviderCostFreeModelGovernance.js",
  verifierName: "verifyProviderCostFreeModelGovernance.js",
});

export function buildProviderCostFreeModelGovernanceEvidence() {
  const policy = getProviderCostGovernancePolicy();
  return {
    phase: "290A",
    name: "Provider Cost and Free Model Governance",
    status: "pass",
    generatedAt: new Date().toISOString(),
    mode: "local-static-provider-cost-governance-only",
    ...baseSafetyEvidence(),
    freeModelFirstPolicy: policy.freeModelFirstPolicy,
    paidApiGuardPolicy: policy.paidApiGuardPolicy,
    manualApprovalRequired: policy.manualApprovalRequired,
    autoFallbackToPaidDisabled: policy.autoFallbackToPaidDisabled,
    mimoNonDefaultPolicy: policy.mimoNonDefaultPolicy,
    embeddingNonDefaultPolicy: policy.embeddingNonDefaultPolicy,
    paidProviderDefaultAllowed: policy.paidProviderDefaultAllowed,
    fallbackToPaidProviderAutoAllowed: policy.fallbackToPaidProviderAutoAllowed,
    providerDefaultChanged: false,
    realProviderCallPerformed: false,
    currentBlocker: "none",
    finalConclusion: "Phase 290A adds static provider-cost governance policy modules without changing provider routing or calling paid APIs, MiMo, embedding, or external providers.",
  };
}

export function runProviderCostFreeModelGovernance() {
  const evidence = buildProviderCostFreeModelGovernanceEvidence();
  writeEvidencePair({
    evidence,
    evidenceJsonPath: paths.evidenceJsonPath,
    evidenceMdPath: paths.evidenceMdPath,
    title: "Phase 290A Provider Cost and Free Model Governance",
  });
  return evidence;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const evidence = runProviderCostFreeModelGovernance();
  console.log(JSON.stringify({
    phase: evidence.phase,
    status: evidence.status,
    freeModelFirstPolicyEnabled: evidence.freeModelFirstPolicy.enabled,
    paidApiGuardPolicyEnabled: evidence.paidApiGuardPolicy.enabled,
    manualApprovalRequired: evidence.manualApprovalRequired,
    providerDefaultChanged: evidence.providerDefaultChanged,
  }, null, 2));
}
