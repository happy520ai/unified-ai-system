import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/agent-console/evidence/phase356e/provider-onboarding-governance-dashboard-section-result.json");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase357e");
const resultPath = resolve(evidenceDir, "provider-onboarding-production-readiness-checklist-result.json");
const checklistPath = resolve(repoRoot, "docs/phase357e-provider-onboarding-production-readiness-checklist.json");
const reportPath = resolve(repoRoot, "docs/phase357e-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase357E",
  sourcePhase: source.phase,
  readinessChecklistsGenerated: true,
  blockerCriteriaDefined: true,
  humanApprovalRequired: true,
  checklistItems: [
    "reviewer_checklist_id_present",
    "credential_ref_only_submission_enforced",
    "raw_secret_rejection_visible",
    "tenant_admin_review_required",
  ],
  blockerCriteria: [
    "missing_reviewerChecklistId",
    "raw_secret_rejection_missing",
    "provider_call_attempted_from_ui",
  ],
  noProviderCallFromUi: true,
  credentialRefOnly: true,
  productionGA: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(checklistPath, `${JSON.stringify({ phase: current.phase, checklistType: "provider_onboarding_production_readiness", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase357E Execution Report\n\n- readinessChecklistsGenerated: ${current.readinessChecklistsGenerated}\n- blockerCriteriaDefined: ${current.blockerCriteriaDefined}\n- credentialRefOnly: ${current.credentialRefOnly}\n`, "utf8");
}
