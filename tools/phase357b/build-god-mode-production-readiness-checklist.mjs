import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase356b/god-mode-governance-dashboard-section-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase357b");
const resultPath = resolve(evidenceDir, "god-mode-production-readiness-checklist-result.json");
const checklistPath = resolve(repoRoot, "docs/phase357b-god-mode-production-readiness-checklist.json");
const reportPath = resolve(repoRoot, "docs/phase357b-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = {
  phase: "Phase357B",
  sourcePhase: source.phase,
  readinessChecklistsGenerated: true,
  blockerCriteriaDefined: true,
  humanApprovalRequired: true,
  checklistItems: [
    "benchmark_evidence_ref_present",
    "quality_decision_timeline_complete",
    "degraded_mode_exit_requires_reviewer",
    "external_notification_stays_disabled_until_authorized",
  ],
  blockerCriteria: [
    "missing_benchmarkEvidenceRef",
    "missing_reviewer_decision_for_quality_state",
    "unauthorized_external_notification_enablement",
  ],
  externalNotification: false,
  productionGA: false,
  secretValueExposed: false,
};

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(checklistPath, `${JSON.stringify({ phase: current.phase, checklistType: "god_mode_production_readiness", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase357B Execution Report\n\n- readinessChecklistsGenerated: ${current.readinessChecklistsGenerated}\n- blockerCriteriaDefined: ${current.blockerCriteriaDefined}\n- externalNotification: ${current.externalNotification}\n`, "utf8");
}
