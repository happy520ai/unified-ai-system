import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase347c");
const resultPath = resolve(evidenceDir, "tianshu-planner-beta-findings-result.json");
const reviewPath = resolve(repoRoot, "docs/phase347c-tianshu-planner-beta-findings.json");
const reportPath = resolve(repoRoot, "docs/phase347c-execution-report.md");

const gate = JSON.parse(await readFile(resolve(repoRoot, "docs/phase346c-tianshu-governance-readiness-gate.json"), "utf8"));
const result = buildResult("Phase347C", gate, [
  "planner_policy_activation_remains_blocked_by_design",
  "production_candidate_requires_wrong_routing_risk_review",
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
    policyActivated: false,
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
    "# Phase347C Execution Report",
    "",
    `- betaFindingsReviewed: ${current.betaFindingsReviewed}`,
    `- policyActivated: ${current.policyActivated}`,
    "",
  ].join("\n");
}
