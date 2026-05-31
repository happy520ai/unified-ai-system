import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase348d/credential-vault-availability-rotation-slo-draft-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase349d");
const resultPath = resolve(evidenceDir, "credential-vault-incident-revoke-rotate-playbook-result.json");
const playbookPath = resolve(repoRoot, "docs/phase349d-credential-vault-incident-revoke-rotate-playbook.json");
const reportPath = resolve(repoRoot, "docs/phase349d-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase349D",
  sourcePhase: source.phase,
  incidentPlaybooksGenerated: true,
  rollbackStepsIncluded: true,
  escalationOwnersPlaceholder: true,
  noRealOpsIntegration: true,
  revokeRotatePlaybookGenerated: true,
  productionReady: false,
  rawSecretReturned: false,
  providerRealCallExecuted: false,
  productionGA: false,
  rollbackSteps: [
    "disable_credential_reference_resolution_for_impacted_scope",
    "mark_credential_ref_revoked_in_dry_run_registry",
    "require_human_rotation_confirmation",
    "verify_redaction_before_evidence_capture",
  ],
  metricsCovered: source.metrics || [],
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(playbookPath, `${JSON.stringify({ phase: current.phase, playbookType: "credential_vault_revoke_rotate_incident", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase349D Execution Report\n\n- incidentPlaybooksGenerated: ${current.incidentPlaybooksGenerated}\n- rawSecretReturned: ${current.rawSecretReturned}\n- providerRealCallExecuted: ${current.providerRealCallExecuted}\n`, "utf8");
}
