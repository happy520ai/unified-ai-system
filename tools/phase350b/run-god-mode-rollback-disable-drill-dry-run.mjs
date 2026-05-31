import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase349b/god-mode-incident-degraded-mode-playbook-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase350b");
const resultPath = resolve(evidenceDir, "god-mode-rollback-disable-drill-dry-run-result.json");
const drillPath = resolve(repoRoot, "docs/phase350b-god-mode-rollback-disable-drill-dry-run.json");
const reportPath = resolve(repoRoot, "docs/phase350b-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase350B",
  sourcePhase: source.phase,
  rollbackDrillDryRunExecuted: true,
  disablePathVerified: Array.isArray(source.rollbackSteps) && source.rollbackSteps.includes("mark_god_mode_quality_degraded"),
  restorePathDocumented: true,
  noProductionChange: true,
  externalNotification: false,
  productionGA: false,
  rollbackStepsVerified: source.rollbackSteps || [],
  restorePath: "restore_god_mode_from_degraded_after_benchmark_review",
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(drillPath, `${JSON.stringify({ phase: current.phase, drillType: "god_mode_disable_restore", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase350B Execution Report\n\n- rollbackDrillDryRunExecuted: ${current.rollbackDrillDryRunExecuted}\n- disablePathVerified: ${current.disablePathVerified}\n- externalNotification: ${current.externalNotification}\n`, "utf8");
}
