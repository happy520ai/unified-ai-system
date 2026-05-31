import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase340a");
const resultPath = resolve(evidenceDir, "limited-beta-dry-run-closure-report-result.json");
const recommendationPath = resolve(repoRoot, "docs/phase340a-next-stage-readiness-recommendation.json");
const reportPath = resolve(repoRoot, "docs/phase340a-execution-report.md");

const phase339a = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase339a/limited-beta-final-dry-run-rehearsal-result.json"), "utf8"));
const noDeployLock = JSON.parse(await readFile(resolve(repoRoot, "docs/phase339a-no-deploy-evidence-lock.json"), "utf8"));

const recommendation = {
  phase: "Phase340A",
  closureReportsGenerated: true,
  nextStageReadinessRecommendationPresent: true,
  limitedBetaDryRunClosed: phase339a.finalDryRunRehearsalExecuted === true && phase339a.noDeployEvidenceLocked === true,
  recommendation: "enter_phase341_guarded_enablement_planning",
  releaseExecuted: false,
  deployExecuted: false,
  noDeployBoundaryPreserved: noDeployLock.deployApproved === false,
};

const result = {
  phase: "Phase340A",
  closureReportsGenerated: true,
  nextStageReadinessRecommendationPresent: true,
  limitedBetaDryRunClosed: recommendation.limitedBetaDryRunClosed,
  productionGA: false,
  releaseExecuted: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(recommendationPath, `${JSON.stringify(recommendation, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase340A Execution Report",
    "",
    `- closureReportsGenerated: ${current.closureReportsGenerated}`,
    `- nextStageReadinessRecommendationPresent: ${current.nextStageReadinessRecommendationPresent}`,
    `- limitedBetaDryRunClosed: ${current.limitedBetaDryRunClosed}`,
    "",
  ].join("\n");
}
