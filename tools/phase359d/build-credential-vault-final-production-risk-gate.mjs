import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase358d/credential-vault-production-evidence-bundle-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase359d");
const resultPath = resolve(evidenceDir, "credential-vault-final-production-risk-gate-result.json");
const gatePath = resolve(repoRoot, "docs/phase359d-credential-vault-final-production-risk-gate.json");
const reportPath = resolve(repoRoot, "docs/phase359d-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const blockers = source.missingEvidence || [];
const result = {
  phase: "Phase359D",
  sourcePhase: source.phase,
  finalNoDeployGateGenerated: true,
  deployApproved: false,
  releaseApproved: false,
  productionGaApproved: false,
  blockerCountRecorded: true,
  blockerCount: blockers.length,
  blockers,
  rawSecretReturned: false,
  providerRealCallExecuted: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(gatePath, `${JSON.stringify({ phase: current.phase, gateType: "credential_vault_final_production_risk", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase359D Execution Report\n\n- finalNoDeployGateGenerated: ${current.finalNoDeployGateGenerated}\n- blockerCount: ${current.blockerCount}\n- rawSecretReturned: ${current.rawSecretReturned}\n`, "utf8");
}
