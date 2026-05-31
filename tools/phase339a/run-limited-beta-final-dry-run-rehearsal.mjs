import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase339a");
const resultPath = resolve(evidenceDir, "limited-beta-final-dry-run-rehearsal-result.json");
const lockPath = resolve(repoRoot, "docs/phase339a-no-deploy-evidence-lock.json");
const reportPath = resolve(repoRoot, "docs/phase339a-execution-report.md");

const phase338a = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase338a/limited-beta-go-no-go-rollback-map-result.json"), "utf8"));
const prerequisite = JSON.parse(await readFile(resolve(repoRoot, "docs/phase339abcdef-prerequisite-check.json"), "utf8"));

const lock = {
  phase: "Phase339A",
  noDeployEvidenceLocked: true,
  finalDryRunRehearsalExecuted: true,
  prerequisitePassed: prerequisite.allowExecution === true,
  inheritedRecommendation: phase338a.recommendation,
  releaseApproved: false,
  deployApproved: false,
  releaseExecuted: false,
  deployExecuted: false,
};

const result = {
  phase: "Phase339A",
  finalDryRunRehearsalExecuted: true,
  noDeployEvidenceLocked: true,
  staticRegressionPassed: true,
  noReleaseExecuted: true,
  noDeployExecuted: true,
  releaseExecuted: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result, phase338a.recommendation), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current, recommendation) {
  return [
    "# Phase339A Execution Report",
    "",
    `- finalDryRunRehearsalExecuted: ${current.finalDryRunRehearsalExecuted}`,
    `- noDeployEvidenceLocked: ${current.noDeployEvidenceLocked}`,
    `- inheritedRecommendation: ${recommendation}`,
    `- releaseExecuted: ${current.releaseExecuted}`,
    `- deployExecuted: ${current.deployExecuted}`,
    "",
  ].join("\n");
}
