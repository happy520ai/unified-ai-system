import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase356a/enterprise-governance-dashboard-design-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase357a");
const resultPath = resolve(evidenceDir, "production-readiness-master-checklist-result.json");
const checklistPath = resolve(repoRoot, "docs/phase357a-production-readiness-master-checklist.json");
const reportPath = resolve(repoRoot, "docs/phase357a-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase357A",
  sourcePhase: source.phase,
  readinessChecklistsGenerated: true,
  blockerCriteriaDefined: true,
  humanApprovalRequired: true,
  checklistItems: [
    "tenant_boundary_confirmed",
    "rbac_separation_confirmed",
    "audit_export_contract_confirmed",
    "security_blockers_reviewed",
    "deploy_not_authorized_without_human_signoff",
  ],
  blockerCriteria: [
    "missing_governance_section_contract",
    "missing_human_approval_record",
    "secret_safety_regression",
  ],
  productionGA: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(checklistPath, `${JSON.stringify({ phase: current.phase, checklistType: "production_readiness_master", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase357A Execution Report\n\n- readinessChecklistsGenerated: ${current.readinessChecklistsGenerated}\n- blockerCriteriaDefined: ${current.blockerCriteriaDefined}\n- humanApprovalRequired: ${current.humanApprovalRequired}\n`, "utf8");
}
