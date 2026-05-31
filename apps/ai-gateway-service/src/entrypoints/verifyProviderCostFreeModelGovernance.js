import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getFreeModelFirstPolicy } from "../cost/freeModelFirstPolicy.js";
import { getPaidApiGuardPolicy } from "../cost/paidProviderApprovalPolicy.js";
import { getProviderCostGovernancePolicy } from "../cost/providerCostGovernancePolicy.js";
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
  docName: "PROVIDER_COST_AND_FREE_MODEL_GOVERNANCE.md",
  evidenceName: "phase-290a-provider-cost-free-model-governance",
  runnerName: "runProviderCostFreeModelGovernance.js",
  verifierName: "verifyProviderCostFreeModelGovernance.js",
});
const costFiles = [
  resolve(repoRoot, "apps/ai-gateway-service/src/cost/providerCostGovernancePolicy.js"),
  resolve(repoRoot, "apps/ai-gateway-service/src/cost/freeModelFirstPolicy.js"),
  resolve(repoRoot, "apps/ai-gateway-service/src/cost/paidProviderApprovalPolicy.js"),
];

export function verifyProviderCostFreeModelGovernance() {
  const failures = [];
  requireFiles([paths.docsPath, paths.evidenceJsonPath, paths.evidenceMdPath, paths.runnerPath, paths.verifierPath, ...costFiles], failures);
  if (failures.length) return { ok: false, failures };

  const evidence = readJson(paths.evidenceJsonPath);
  const docsText = readText(paths.docsPath);
  const freePolicy = getFreeModelFirstPolicy();
  const paidPolicy = getPaidApiGuardPolicy();
  const governancePolicy = getProviderCostGovernancePolicy();

  verifyCommonPhase({
    evidence,
    phase: "290A",
    rootRunScript: "run:phase290a-provider-cost-free-model-governance",
    rootVerifyScript: "verify:phase290a-provider-cost-free-model-governance",
    serviceRunScript: "run:phase290a-provider-cost-free-model-governance",
    serviceVerifyScript: "verify:phase290a-provider-cost-free-model-governance",
    failures,
  });

  assertCheck(freePolicy.enabled === true, "freeModelFirstPolicy.enabled must be true", failures);
  assertCheck(paidPolicy.enabled === true, "paidApiGuardPolicy.enabled must be true", failures);
  assertCheck(governancePolicy.manualApprovalRequired === true, "manualApprovalRequired must be true", failures);
  assertCheck(governancePolicy.autoFallbackToPaidDisabled === true, "autoFallbackToPaidDisabled must be true", failures);
  assertCheck(governancePolicy.mimoNonDefaultPolicy.enabled === true, "mimoNonDefaultPolicy.enabled must be true", failures);
  assertCheck(governancePolicy.embeddingNonDefaultPolicy.enabled === true, "embeddingNonDefaultPolicy.enabled must be true", failures);
  assertCheck(governancePolicy.paidProviderDefaultAllowed === false, "paidProviderDefaultAllowed must be false", failures);
  assertCheck(governancePolicy.fallbackToPaidProviderAutoAllowed === false, "fallbackToPaidProviderAutoAllowed must be false", failures);
  assertCheck(evidence.freeModelFirstPolicy?.enabled === true, "evidence freeModelFirstPolicy.enabled must be true", failures);
  assertCheck(evidence.paidApiGuardPolicy?.enabled === true, "evidence paidApiGuardPolicy.enabled must be true", failures);
  assertCheck(evidence.manualApprovalRequired === true, "evidence manualApprovalRequired must be true", failures);
  assertCheck(evidence.autoFallbackToPaidDisabled === true, "evidence autoFallbackToPaidDisabled must be true", failures);
  assertCheck(evidence.mimoNonDefaultPolicy?.enabled === true, "evidence mimoNonDefaultPolicy.enabled must be true", failures);
  assertCheck(evidence.embeddingNonDefaultPolicy?.enabled === true, "evidence embeddingNonDefaultPolicy.enabled must be true", failures);
  assertCheck(evidence.paidProviderDefaultAllowed === false, "evidence paidProviderDefaultAllowed must be false", failures);
  assertCheck(evidence.fallbackToPaidProviderAutoAllowed === false, "evidence fallbackToPaidProviderAutoAllowed must be false", failures);
  assertCheck(evidence.providerDefaultChanged === false, "providerDefaultChanged must be false", failures);
  assertCheck(evidence.realProviderCallPerformed === false, "realProviderCallPerformed must be false", failures);
  for (const filePath of costFiles) {
    assertCheck(existsSync(filePath), `cost policy file missing: ${filePath}`, failures);
  }
  requireMarkers(docsText, [
    "Free Model First Policy",
    "Paid API Guard Policy",
    "Manual Approval Required",
    "Auto Fallback To Paid Disabled",
    "MiMo Non Default Policy",
    "Embedding Non Default Policy",
    "Provider Default Boundary",
    "Final Phase 290A Conclusion",
  ], failures, "docs");

  return { ok: failures.length === 0, failures };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  printVerifierResult({
    ...verifyProviderCostFreeModelGovernance(),
    phase: "290A",
    verifier: "verifyProviderCostFreeModelGovernance",
  });
}
