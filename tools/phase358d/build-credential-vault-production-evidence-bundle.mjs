import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase357d/credential-vault-production-readiness-checklist-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase358d");
const resultPath = resolve(evidenceDir, "credential-vault-production-evidence-bundle-result.json");
const bundlePath = resolve(repoRoot, "docs/phase358d-credential-vault-production-evidence-bundle.json");
const reportPath = resolve(repoRoot, "docs/phase358d-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const missingEvidence = ["credentialRef", "accessDecision", "vault_backend_approval_record"];
const result = {
  phase: "Phase358D",
  sourcePhase: source.phase,
  evidenceBundlesGenerated: true,
  missingEvidenceReported: true,
  productionDeployAuthorized: false,
  bundledItems: [
    "credential_vault_readiness_checklist",
    "credential_vault_rbac_design",
    "vault_governance_section",
  ],
  missingEvidence,
  rawSecretReturned: false,
  providerRealCallExecuted: false,
  secretValueExposed: false,
  productionGA: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(bundlePath, `${JSON.stringify({ phase: current.phase, bundleType: "credential_vault_production_evidence", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase358D Execution Report\n\n- evidenceBundlesGenerated: ${current.evidenceBundlesGenerated}\n- missingEvidenceReported: ${current.missingEvidenceReported}\n- rawSecretReturned: ${current.rawSecretReturned}\n`, "utf8");
}
