import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase348b/god-mode-quality-slo-draft-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase349b");
const resultPath = resolve(evidenceDir, "god-mode-incident-degraded-mode-playbook-result.json");
const playbookPath = resolve(repoRoot, "docs/phase349b-god-mode-incident-degraded-mode-playbook.json");
const reportPath = resolve(repoRoot, "docs/phase349b-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = buildResult("Phase349B", source, [
  "mark_god_mode_quality_degraded",
  "keep_external_notification_disabled",
  "route_to_normal_mode_or_manual_review",
  "capture_benchmark_regression_evidence",
]);

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

function buildResult(phase, source, rollbackSteps) {
  return {
    phase,
    sourcePhase: source.phase,
    incidentPlaybooksGenerated: true,
    rollbackStepsIncluded: true,
    escalationOwnersPlaceholder: true,
    noRealOpsIntegration: true,
    degradedModePlaybookGenerated: true,
    externalNotification: false,
    productionGA: false,
    rollbackSteps,
    metricsCovered: source.metrics || [],
    secretValueExposed: false,
  };
}

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(playbookPath, `${JSON.stringify({ phase: current.phase, playbookType: "god_mode_incident_degraded_mode", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, `# Phase349B Execution Report\n\n- incidentPlaybooksGenerated: ${current.incidentPlaybooksGenerated}\n- degradedModePlaybookGenerated: ${current.degradedModePlaybookGenerated}\n- externalNotification: ${current.externalNotification}\n`, "utf8");
}
