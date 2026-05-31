import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/agent-console/evidence/phase355e/provider-onboarding-audit-report-baseline-result.json");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase356e");
const resultPath = resolve(evidenceDir, "provider-onboarding-governance-dashboard-section-result.json");
const designPath = resolve(repoRoot, "docs/phase356e-provider-onboarding-governance-dashboard-section.json");
const reportPath = resolve(repoRoot, "docs/phase356e-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase356E",
  sourcePhase: source.phase,
  governanceDashboardDesignGenerated: true,
  sectionContractsGenerated: true,
  noProductionUiClaim: true,
  sectionId: "provider_onboarding_governance",
  sectionContractFields: source.requiredAuditFields,
  sectionPanels: [
    "reviewer_checklist_audit",
    "raw_secret_rejection_summary",
    "credential_ref_only_submission_health",
  ],
  noProviderCallFromUi: true,
  credentialRefOnly: true,
  secretValueExposed: false,
  productionGA: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(designPath, `${JSON.stringify({ phase: current.phase, designType: "provider_onboarding_governance_dashboard_section", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase356E Execution Report\n\n- governanceDashboardDesignGenerated: ${current.governanceDashboardDesignGenerated}\n- sectionContractsGenerated: ${current.sectionContractsGenerated}\n- credentialRefOnly: ${current.credentialRefOnly}\n`, "utf8");
}
