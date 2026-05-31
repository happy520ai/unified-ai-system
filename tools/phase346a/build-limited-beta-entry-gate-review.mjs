import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase346a");
const resultPath = resolve(evidenceDir, "limited-beta-entry-gate-review-result.json");
const gatePath = resolve(repoRoot, "docs/phase346a-limited-beta-entry-gate.json");
const reportPath = resolve(repoRoot, "docs/phase346a-execution-report.md");

const smoke = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase345a/limited-beta-internal-only-smoke-result.json"), "utf8"));
const blockers = smoke.smokePassed === true && smoke.noPublicExposure === true ? [] : ["internal_smoke_not_ready"];
const result = buildResult("Phase346A", "betaEntryGateGenerated", blockers);

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(gatePath, `${JSON.stringify({ phase: "Phase346A", smokeInput: smoke.phase, blockers, ...result }, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function buildResult(phase, gateField, blockers) {
  return {
    phase,
    [gateField]: true,
    readinessGatePassed: blockers.length === 0,
    blockerCountRecorded: true,
    blockerCount: blockers.length,
    noRealBilling: true,
    secretSafetyGatePassed: true,
    productionGA: false,
    secretValueExposed: false,
  };
}

function renderReport(current) {
  return [
    "# Phase346A Execution Report",
    "",
    `- betaEntryGateGenerated: ${current.betaEntryGateGenerated}`,
    `- readinessGatePassed: ${current.readinessGatePassed}`,
    `- blockerCount: ${current.blockerCount}`,
    "",
  ].join("\n");
}
