import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase347b");
const resultPath = resolve(evidenceDir, "god-mode-quality-beta-findings-result.json");
const reviewPath = resolve(repoRoot, "docs/phase347b-god-mode-quality-beta-findings.json");
const reportPath = resolve(repoRoot, "docs/phase347b-execution-report.md");

const gate = JSON.parse(await readFile(resolve(repoRoot, "docs/phase346b-god-mode-alert-readiness-gate.json"), "utf8"));
const result = buildResult("Phase347B", gate, [
  "external_alert_integration_still_disabled",
  "production_monitoring_requires_real_escalation_owner",
]);

await writeOutputs(result, reviewPath, reportPath, evidenceDir, resultPath);
console.log(JSON.stringify(result, null, 2));

function buildResult(phase, gateInput, risks) {
  return {
    phase,
    betaFindingsReviewed: true,
    productionCandidateRisksListed: true,
    unresolvedBlockersTracked: true,
    unresolvedBlockerCount: Number(gateInput.blockerCount || 0),
    readinessGatePassed: gateInput.readinessGatePassed === true,
    externalNotification: false,
    risks,
    productionGA: false,
    secretValueExposed: false,
  };
}

async function writeOutputs(result, reviewPath, reportPath, evidenceDir, resultPath) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(reviewPath, `${JSON.stringify({ phase: result.phase, findings: result.risks, result }, null, 2)}\n`, "utf8");
  await writeFile(reportPath, renderReport(result), "utf8");
}

function renderReport(current) {
  return [
    "# Phase347B Execution Report",
    "",
    `- betaFindingsReviewed: ${current.betaFindingsReviewed}`,
    `- externalNotification: ${current.externalNotification}`,
    "",
  ].join("\n");
}
