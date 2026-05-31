import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase348a/production-candidate-slo-sla-draft-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase349a");
const resultPath = resolve(evidenceDir, "production-candidate-incident-response-playbook-result.json");
const playbookPath = resolve(repoRoot, "docs/phase349a-production-candidate-incident-response-playbook.json");
const reportPath = resolve(repoRoot, "docs/phase349a-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const playbook = buildPlaybook("Phase349A", source, [
  "triage_gateway_availability_regression",
  "disable_guarded_candidate_flags",
  "restore_last_known_dry_run_baseline",
  "record_evidence_and_human_review_decision",
]);

await writeOutputs(playbook);
console.log(JSON.stringify(playbook, null, 2));

function buildPlaybook(phase, source, rollbackSteps) {
  return {
    phase,
    sourcePhase: source.phase,
    incidentPlaybooksGenerated: true,
    rollbackStepsIncluded: true,
    escalationOwnersPlaceholder: true,
    noRealOpsIntegration: true,
    productionGA: false,
    releaseAuthorized: false,
    deployAuthorized: false,
    rollbackSteps,
    escalationOwnerPlaceholder: "TBD-human-owner-before-real-production",
    metricsCovered: source.metrics || [],
    secretValueExposed: false,
  };
}

async function writeOutputs(result) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(playbookPath, `${JSON.stringify({ phase: result.phase, playbookType: "production_candidate_incident_response", result }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, renderReport(result), "utf8");
}

function renderReport(result) {
  return [
    "# Phase349A Execution Report",
    "",
    `- incidentPlaybooksGenerated: ${result.incidentPlaybooksGenerated}`,
    `- rollbackStepsIncluded: ${result.rollbackStepsIncluded}`,
    `- noRealOpsIntegration: ${result.noRealOpsIntegration}`,
    "",
  ].join("\n");
}
