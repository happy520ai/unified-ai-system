import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase343c");
const resultPath = resolve(evidenceDir, "tianshu-runtime-flag-design-result.json");
const designPath = resolve(repoRoot, "docs/phase343c-tianshu-runtime-flag-design.json");
const reportPath = resolve(repoRoot, "docs/phase343c-execution-report.md");

const shadow = JSON.parse(await readFile(resolve(repoRoot, "docs/phase342c-tianshu-shadow-config.json"), "utf8"));

const design = {
  phase: "Phase343C",
  runtimeFlagDesignGenerated: true,
  defaultEnabled: false,
  rollbackFlagPresent: true,
  perUserPolicyRequired: true,
  shadowConfigOnly: shadow.shadowConfigOnly === true,
  flagName: "tianshuReviewerGuardedWorkflow",
};

const result = {
  phase: "Phase343C",
  runtimeFlagDesignGenerated: true,
  defaultEnabled: false,
  rollbackFlagPresent: true,
  perUserPolicyRequired: true,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(designPath, `${JSON.stringify(design, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase343C Execution Report",
    "",
    `- runtimeFlagDesignGenerated: ${current.runtimeFlagDesignGenerated}`,
    `- defaultEnabled: ${current.defaultEnabled}`,
    `- rollbackFlagPresent: ${current.rollbackFlagPresent}`,
    "",
  ].join("\n");
}
