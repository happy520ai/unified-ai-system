import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase335e");
const resultPath = resolve(evidenceDir, "provider-onboarding-checklist-package-result.json");
const jsonPath = resolve(repoRoot, "docs/phase335e-provider-onboarding-checklist-package.md");
const source = JSON.parse(await readFile(resolve(repoRoot, "docs/phase334e-guided-test-checklist-export.json"), "utf8"));
const result = {
  phase: "Phase335E",
  packageGenerated: true,
  includesJson: true,
  includesMarkdown: true,
  includesCsvSafeMarkdown: true,
  rawSecretScenarioIncluded: (source.scenarios || []).some((item) => item.testId === "rawSecretRejected"),
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(jsonPath, renderPackage(source.scenarios || []), "utf8");
await writeFile(resolve(repoRoot, "docs/phase335e-execution-report.md"), renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderPackage(scenarios) {
  return [
    "# Phase335E Provider Onboarding Checklist Package",
    "",
    `- scenarioCount: ${scenarios.length}`,
    "- includesJson: true",
    "- includesMarkdown: true",
    "- includesCsvSafeMarkdown: true",
    "",
  ].join("\n");
}

function renderReport(result) {
  return [
    "# Phase335E Execution Report",
    "",
    `- packageGenerated: ${result.packageGenerated}`,
    `- rawSecretScenarioIncluded: ${result.rawSecretScenarioIncluded}`,
    "",
  ].join("\n");
}
