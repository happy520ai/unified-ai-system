import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase341a");
const resultPath = resolve(evidenceDir, "limited-beta-guarded-enablement-plan-result.json");
const planPath = resolve(repoRoot, "docs/phase341a-limited-beta-guarded-enablement-plan.json");
const reportPath = resolve(repoRoot, "docs/phase341a-execution-report.md");

const closure = JSON.parse(await readFile(resolve(repoRoot, "docs/phase340a-next-stage-readiness-recommendation.json"), "utf8"));

const plan = {
  phase: "Phase341A",
  betaCohortBoundaryDefined: true,
  guardedEnablementPlanGenerated: true,
  recommendationInput: closure.recommendation,
  cohortBoundary: {
    cohortType: "internal_limited_beta",
    maxUsers: 20,
    explicitAllowListRequired: true,
    defaultEnabled: false,
  },
  releaseExecuted: false,
  deployExecuted: false,
};

const result = {
  phase: "Phase341A",
  betaCohortBoundaryDefined: true,
  guardedEnablementPlanGenerated: true,
  noReleaseExecuted: true,
  noDeployExecuted: true,
  productionGA: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase341A Execution Report",
    "",
    `- betaCohortBoundaryDefined: ${current.betaCohortBoundaryDefined}`,
    `- guardedEnablementPlanGenerated: ${current.guardedEnablementPlanGenerated}`,
    "",
  ].join("\n");
}
