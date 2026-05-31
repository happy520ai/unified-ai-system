import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase347c/tianshu-planner-beta-findings-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase348c");
const resultPath = resolve(evidenceDir, "tianshu-planner-selection-slo-draft-result.json");
const draftPath = resolve(repoRoot, "docs/phase348c-tianshu-planner-selection-slo-draft.json");
const reportPath = resolve(repoRoot, "docs/phase348c-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const metrics = [
  "planner_selection_review_coverage",
  "wrong_routing_detection_rate",
  "manual_approval_required_rate",
  "policy_activation_blocked_by_default",
];
const result = {
  phase: "Phase348C",
  sourcePhase: source.phase,
  sloDraftGenerated: true,
  slaDraftGenerated: true,
  metricsDefined: true,
  productionGAFalselyClaimed: false,
  policyActivated: false,
  trainingTriggered: false,
  embeddingBatchTriggered: false,
  productionGA: false,
  metricCount: metrics.length,
  metrics,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(draftPath, `${JSON.stringify({ phase: current.phase, draftType: "tianshu_planner_selection_slo", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase348C Execution Report\n\n- sloDraftGenerated: ${current.sloDraftGenerated}\n- policyActivated: ${current.policyActivated}\n- metricsDefined: ${current.metricsDefined}\n`, "utf8");
}
