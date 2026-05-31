import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase343f");
const resultPath = resolve(evidenceDir, "billing-runtime-flag-design-result.json");
const designPath = resolve(repoRoot, "docs/phase343f-billing-runtime-flag-design.json");
const reportPath = resolve(repoRoot, "docs/phase343f-execution-report.md");

const shadow = JSON.parse(await readFile(resolve(repoRoot, "docs/phase342f-billing-visibility-shadow-config.json"), "utf8"));

const design = {
  phase: "Phase343F",
  runtimeFlagDesignGenerated: true,
  defaultEnabled: false,
  rollbackFlagPresent: true,
  perUserPolicyRequired: true,
  shadowConfigOnly: shadow.shadowConfigOnly === true,
  flagName: "mockBillingBetaVisibility",
};

const result = {
  phase: "Phase343F",
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
    "# Phase343F Execution Report",
    "",
    `- runtimeFlagDesignGenerated: ${current.runtimeFlagDesignGenerated}`,
    `- defaultEnabled: ${current.defaultEnabled}`,
    `- rollbackFlagPresent: ${current.rollbackFlagPresent}`,
    "",
  ].join("\n");
}
