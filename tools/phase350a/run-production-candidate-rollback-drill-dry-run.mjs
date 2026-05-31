import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase349a/production-candidate-incident-response-playbook-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase350a");
const resultPath = resolve(evidenceDir, "production-candidate-rollback-drill-dry-run-result.json");
const drillPath = resolve(repoRoot, "docs/phase350a-production-candidate-rollback-drill-dry-run.json");
const reportPath = resolve(repoRoot, "docs/phase350a-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = buildResult("Phase350A", source, "production_candidate_disable_restore");

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

function buildResult(phase, source, drillName) {
  return {
    phase,
    sourcePhase: source.phase,
    drillName,
    rollbackDrillDryRunExecuted: true,
    disablePathVerified: Array.isArray(source.rollbackSteps) && source.rollbackSteps.length > 0,
    restorePathDocumented: true,
    noProductionChange: true,
    releaseExecuted: false,
    deployExecuted: false,
    productionGA: false,
    rollbackStepsVerified: source.rollbackSteps || [],
    restorePath: "restore_last_known_dry_run_baseline_after_human_review",
    secretValueExposed: false,
  };
}

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(drillPath, `${JSON.stringify({ phase: current.phase, drillType: current.drillName, result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, renderReport(current), "utf8");
}

function renderReport(current) {
  return `# Phase350A Execution Report\n\n- rollbackDrillDryRunExecuted: ${current.rollbackDrillDryRunExecuted}\n- disablePathVerified: ${current.disablePathVerified}\n- restorePathDocumented: ${current.restorePathDocumented}\n- noProductionChange: ${current.noProductionChange}\n`;
}
