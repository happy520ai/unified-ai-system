import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase355a/enterprise-audit-report-baseline-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase356a");
const resultPath = resolve(evidenceDir, "enterprise-governance-dashboard-design-result.json");
const designPath = resolve(repoRoot, "docs/phase356a-enterprise-governance-dashboard-design.json");
const reportPath = resolve(repoRoot, "docs/phase356a-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase356A",
  sourcePhase: source.phase,
  governanceDashboardDesignGenerated: true,
  sectionContractsGenerated: true,
  noProductionUiClaim: true,
  dashboardSections: [
    "tenant_boundary_overview",
    "rbac_summary",
    "audit_export_health",
    "governance_risk_register",
  ],
  sectionContractFields: source.requiredAuditFields,
  exportFormats: source.exportFormats,
  secretValueExposed: false,
  productionGA: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(designPath, `${JSON.stringify({ phase: current.phase, designType: "enterprise_governance_dashboard", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase356A Execution Report\n\n- governanceDashboardDesignGenerated: ${current.governanceDashboardDesignGenerated}\n- sectionContractsGenerated: ${current.sectionContractsGenerated}\n- noProductionUiClaim: ${current.noProductionUiClaim}\n`, "utf8");
}
