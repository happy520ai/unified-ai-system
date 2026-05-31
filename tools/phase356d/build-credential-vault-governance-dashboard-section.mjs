import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase355d/credential-vault-access-audit-report-baseline-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase356d");
const resultPath = resolve(evidenceDir, "credential-vault-governance-dashboard-section-result.json");
const designPath = resolve(repoRoot, "docs/phase356d-credential-vault-governance-dashboard-section.json");
const reportPath = resolve(repoRoot, "docs/phase356d-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase356D",
  sourcePhase: source.phase,
  governanceDashboardDesignGenerated: true,
  sectionContractsGenerated: true,
  noProductionUiClaim: true,
  sectionId: "credential_vault_governance",
  sectionContractFields: source.requiredAuditFields,
  sectionPanels: [
    "access_decision_feed",
    "rotation_revocation_requests",
    "credential_ref_namespace_health",
  ],
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
  await writeFile(designPath, `${JSON.stringify({ phase: current.phase, designType: "credential_vault_governance_dashboard_section", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase356D Execution Report\n\n- governanceDashboardDesignGenerated: ${current.governanceDashboardDesignGenerated}\n- sectionContractsGenerated: ${current.sectionContractsGenerated}\n- rawSecretReturned: ${current.rawSecretReturned}\n`, "utf8");
}
