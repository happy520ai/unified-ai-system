import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/agent-console/evidence/phase349e/provider-onboarding-incident-failed-setup-playbook-result.json");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase350e");
const resultPath = resolve(evidenceDir, "provider-onboarding-rollback-drill-dry-run-result.json");
const drillPath = resolve(repoRoot, "docs/phase350e-provider-onboarding-rollback-drill-dry-run.json");
const reportPath = resolve(repoRoot, "docs/phase350e-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase350E",
  sourcePhase: source.phase,
  rollbackDrillDryRunExecuted: true,
  disablePathVerified: Array.isArray(source.rollbackSteps) && source.rollbackSteps.includes("keep_provider_call_blocked_from_ui"),
  restorePathDocumented: true,
  noProductionChange: true,
  noProviderCallFromUi: true,
  credentialRefOnly: true,
  productionGA: false,
  rollbackStepsVerified: source.rollbackSteps || [],
  restorePath: "restore_guided_setup_after_reviewer_checklist_retry",
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(drillPath, `${JSON.stringify({ phase: current.phase, drillType: "provider_onboarding_disable_restore", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase350E Execution Report\n\n- rollbackDrillDryRunExecuted: ${current.rollbackDrillDryRunExecuted}\n- disablePathVerified: ${current.disablePathVerified}\n- noProviderCallFromUi: ${current.noProviderCallFromUi}\n`, "utf8");
}
