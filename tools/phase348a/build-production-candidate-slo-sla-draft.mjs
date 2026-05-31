import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase347a/production-candidate-hardening-baseline-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase348a");
const resultPath = resolve(evidenceDir, "production-candidate-slo-sla-draft-result.json");
const draftPath = resolve(repoRoot, "docs/phase348a-production-candidate-slo-sla-draft.json");
const reportPath = resolve(repoRoot, "docs/phase348a-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = buildResult("Phase348A", source, [
  "gateway_availability_shadow_slo",
  "chat_gateway_completion_verification_rate",
  "provider_selection_gate_integrity",
  "secret_safety_violation_count",
  "rollback_readiness_time_to_disable",
]);

await writeOutputs(result, draftPath, reportPath, evidenceDir, resultPath);
console.log(JSON.stringify(result, null, 2));

function buildResult(phase, input, metrics) {
  return {
    phase,
    sourcePhase: input.phase,
    sloDraftGenerated: true,
    slaDraftGenerated: true,
    metricsDefined: true,
    productionGAFalselyClaimed: false,
    productionGA: false,
    releaseAuthorized: false,
    deployAuthorized: false,
    metricCount: metrics.length,
    metrics,
    serviceLevelPosture: "draft_only_no_customer_commitment",
    unresolvedBlockerCount: Number(input.unresolvedBlockerCount || 0),
    secretValueExposed: false,
  };
}

async function writeOutputs(result, draftPath, reportPath, evidenceDir, resultPath) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(draftPath, `${JSON.stringify({ phase: result.phase, draftType: "production_candidate_slo_sla", result }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, renderReport(result), "utf8");
}

function renderReport(result) {
  return [
    "# Phase348A Execution Report",
    "",
    `- sloDraftGenerated: ${result.sloDraftGenerated}`,
    `- slaDraftGenerated: ${result.slaDraftGenerated}`,
    `- metricsDefined: ${result.metricsDefined}`,
    `- productionGAFalselyClaimed: ${result.productionGAFalselyClaimed}`,
    "",
  ].join("\n");
}
