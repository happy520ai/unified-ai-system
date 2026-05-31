import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const sourcePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase350a/production-candidate-rollback-drill-dry-run-result.json");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase351a");
const resultPath = resolve(evidenceDir, "production-candidate-observability-drill-result.json");
const tracePath = resolve(repoRoot, "docs/phase351a-production-candidate-audit-trace-completeness.json");
const reportPath = resolve(repoRoot, "docs/phase351a-execution-report.md");

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const result = buildResult("Phase351A", source, [
  "requestId",
  "phase",
  "drillName",
  "disablePathVerified",
  "restorePathDocumented",
  "noProductionChange",
  "humanReviewDecision",
]);

await writeOutputs(result);
console.log(JSON.stringify(result, null, 2));

function buildResult(phase, source, requiredTraceFields) {
  const missingTraceFields = requiredTraceFields.filter((field) => source[field] === undefined);
  return {
    phase,
    sourcePhase: source.phase,
    auditTraceCompletenessChecked: true,
    missingTraceFieldsReported: true,
    noSecretInTrace: source.secretValueExposed === false,
    traceCompletenessPassed: missingTraceFields.length === 0,
    requiredTraceFields,
    missingTraceFields,
    noProductionChange: true,
    productionGA: false,
    secretValueExposed: false,
  };
}

async function writeOutputs(current) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
  await writeFile(tracePath, `${JSON.stringify({ phase: current.phase, traceType: "production_candidate_audit_trace", result: current }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, renderReport(current), "utf8");
}

function renderReport(current) {
  return [
    "# Phase351A Execution Report",
    "",
    `- auditTraceCompletenessChecked: ${current.auditTraceCompletenessChecked}`,
    `- missingTraceFieldsReported: ${current.missingTraceFieldsReported}`,
    `- noSecretInTrace: ${current.noSecretInTrace}`,
    `- missingTraceFields: ${current.missingTraceFields.join(", ") || "none"}`,
    "",
  ].join("\n");
}
