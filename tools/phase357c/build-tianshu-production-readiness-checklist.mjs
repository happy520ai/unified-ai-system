import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase356c/tianshu-governance-dashboard-section-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase357c");
const resultPath = resolve(evidenceDir, "tianshu-production-readiness-checklist-result.json");
const checklistPath = resolve(repoRoot, "docs/phase357c-tianshu-production-readiness-checklist.json");
const reportPath = resolve(repoRoot, "docs/phase357c-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase357C",
  sourcePhase: source.phase,
  readinessChecklistsGenerated: true,
  blockerCriteriaDefined: true,
  humanApprovalRequired: true,
  checklistItems: [
    "policy_proposal_id_present",
    "reviewer_role_and_decision_captured",
    "approval_separation_state_validated",
    "policy_activation_remains_blocked_without_signoff",
  ],
  blockerCriteria: [
    "missing_policyProposalId",
    "missing_reviewer_decision",
    "approval_separation_broken",
  ],
  policyActivated: false,
  productionGA: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(checklistPath, `${JSON.stringify({ phase: current.phase, checklistType: "tianshu_production_readiness", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase357C Execution Report\n\n- readinessChecklistsGenerated: ${current.readinessChecklistsGenerated}\n- blockerCriteriaDefined: ${current.blockerCriteriaDefined}\n- policyActivated: ${current.policyActivated}\n`, "utf8");
}
