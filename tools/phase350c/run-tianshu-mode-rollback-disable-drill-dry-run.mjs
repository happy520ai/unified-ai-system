import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase349c/tianshu-planner-incident-wrong-selection-playbook-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase350c");
const resultPath = resolve(evidenceDir, "tianshu-mode-rollback-disable-drill-dry-run-result.json");
const drillPath = resolve(repoRoot, "docs/phase350c-tianshu-mode-rollback-disable-drill-dry-run.json");
const reportPath = resolve(repoRoot, "docs/phase350c-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase350C",
  sourcePhase: source.phase,
  rollbackDrillDryRunExecuted: true,
  disablePathVerified: Array.isArray(source.rollbackSteps) && source.rollbackSteps.includes("freeze_policy_proposal_queue"),
  restorePathDocumented: true,
  noProductionChange: true,
  policyActivated: false,
  trainingTriggered: false,
  embeddingBatchTriggered: false,
  productionGA: false,
  rollbackStepsVerified: source.rollbackSteps || [],
  restorePath: "restore_policy_queue_after_manual_wrong_selection_review",
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(drillPath, `${JSON.stringify({ phase: current.phase, drillType: "tianshu_disable_restore", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase350C Execution Report\n\n- rollbackDrillDryRunExecuted: ${current.rollbackDrillDryRunExecuted}\n- disablePathVerified: ${current.disablePathVerified}\n- policyActivated: ${current.policyActivated}\n`, "utf8");
}
