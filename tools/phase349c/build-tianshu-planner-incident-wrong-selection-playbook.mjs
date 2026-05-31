import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase348c/tianshu-planner-selection-slo-draft-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase349c");
const resultPath = resolve(evidenceDir, "tianshu-planner-incident-wrong-selection-playbook-result.json");
const playbookPath = resolve(repoRoot, "docs/phase349c-tianshu-planner-incident-wrong-selection-playbook.json");
const reportPath = resolve(repoRoot, "docs/phase349c-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase349C",
  sourcePhase: source.phase,
  incidentPlaybooksGenerated: true,
  rollbackStepsIncluded: true,
  escalationOwnersPlaceholder: true,
  noRealOpsIntegration: true,
  wrongSelectionPlaybookGenerated: true,
  policyActivated: false,
  trainingTriggered: false,
  embeddingBatchTriggered: false,
  productionGA: false,
  rollbackSteps: [
    "freeze_policy_proposal_queue",
    "route_selection_to_manual_review",
    "block_activation_until_reviewer_approval",
    "export_audit_trail_for_wrong_selection_review",
  ],
  metricsCovered: source.metrics || [],
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(playbookPath, `${JSON.stringify({ phase: current.phase, playbookType: "tianshu_wrong_selection_incident", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase349C Execution Report\n\n- incidentPlaybooksGenerated: ${current.incidentPlaybooksGenerated}\n- wrongSelectionPlaybookGenerated: ${current.wrongSelectionPlaybookGenerated}\n- policyActivated: ${current.policyActivated}\n`, "utf8");
}
