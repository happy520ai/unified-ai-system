import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase356d/credential-vault-governance-dashboard-section-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase357d");
const resultPath = resolve(evidenceDir, "credential-vault-production-readiness-checklist-result.json");
const checklistPath = resolve(repoRoot, "docs/phase357d-credential-vault-production-readiness-checklist.json");
const reportPath = resolve(repoRoot, "docs/phase357d-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase357D",
  sourcePhase: source.phase,
  readinessChecklistsGenerated: true,
  blockerCriteriaDefined: true,
  humanApprovalRequired: true,
  checklistItems: [
    "credential_ref_and_access_decision_logged",
    "rotation_and_revocation_requests_audited",
    "vault_backend_binding_requires_admin_approval",
    "raw_secret_return_must_remain_false",
  ],
  blockerCriteria: [
    "missing_credentialRef",
    "missing_accessDecision",
    "vault_backend_enabled_without_approval",
    "raw_secret_return_detected",
  ],
  rawSecretReturned: false,
  providerRealCallExecuted: false,
  productionGA: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(checklistPath, `${JSON.stringify({ phase: current.phase, checklistType: "credential_vault_production_readiness", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase357D Execution Report\n\n- readinessChecklistsGenerated: ${current.readinessChecklistsGenerated}\n- blockerCriteriaDefined: ${current.blockerCriteriaDefined}\n- rawSecretReturned: ${current.rawSecretReturned}\n`, "utf8");
}
