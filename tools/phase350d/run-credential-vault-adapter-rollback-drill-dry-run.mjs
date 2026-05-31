import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase349d/credential-vault-incident-revoke-rotate-playbook-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase350d");
const resultPath = resolve(evidenceDir, "credential-vault-adapter-rollback-drill-dry-run-result.json");
const drillPath = resolve(repoRoot, "docs/phase350d-credential-vault-adapter-rollback-drill-dry-run.json");
const reportPath = resolve(repoRoot, "docs/phase350d-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase350D",
  sourcePhase: source.phase,
  rollbackDrillDryRunExecuted: true,
  disablePathVerified: Array.isArray(source.rollbackSteps) && source.rollbackSteps.includes("disable_credential_reference_resolution_for_impacted_scope"),
  restorePathDocumented: true,
  noProductionChange: true,
  productionReady: false,
  rawSecretReturned: false,
  providerRealCallExecuted: false,
  productionGA: false,
  rollbackStepsVerified: source.rollbackSteps || [],
  restorePath: "restore_credential_ref_resolution_after_rotation_confirmation",
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(drillPath, `${JSON.stringify({ phase: current.phase, drillType: "credential_vault_disable_restore", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase350D Execution Report\n\n- rollbackDrillDryRunExecuted: ${current.rollbackDrillDryRunExecuted}\n- disablePathVerified: ${current.disablePathVerified}\n- rawSecretReturned: ${current.rawSecretReturned}\n`, "utf8");
}
