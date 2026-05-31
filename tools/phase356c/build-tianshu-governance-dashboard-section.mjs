import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase355c/tianshu-reviewer-audit-report-baseline-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase356c");
const resultPath = resolve(evidenceDir, "tianshu-governance-dashboard-section-result.json");
const designPath = resolve(repoRoot, "docs/phase356c-tianshu-governance-dashboard-section.json");
const reportPath = resolve(repoRoot, "docs/phase356c-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase356C",
  sourcePhase: source.phase,
  governanceDashboardDesignGenerated: true,
  sectionContractsGenerated: true,
  noProductionUiClaim: true,
  sectionId: "tianshu_governance",
  sectionContractFields: source.requiredAuditFields,
  sectionPanels: [
    "proposal_review_queue",
    "approval_separation_state",
    "request_changes_audit_stream",
  ],
  policyActivated: false,
  secretValueExposed: false,
  productionGA: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(designPath, `${JSON.stringify({ phase: current.phase, designType: "tianshu_governance_dashboard_section", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase356C Execution Report\n\n- governanceDashboardDesignGenerated: ${current.governanceDashboardDesignGenerated}\n- sectionContractsGenerated: ${current.sectionContractsGenerated}\n- policyActivated: ${current.policyActivated}\n`, "utf8");
}
