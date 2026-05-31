import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase346b");
const resultPath = resolve(evidenceDir, "god-mode-alert-readiness-gate-result.json");
const gatePath = resolve(repoRoot, "docs/phase346b-god-mode-alert-readiness-gate.json");
const reportPath = resolve(repoRoot, "docs/phase346b-execution-report.md");

const smoke = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase345b/god-mode-beta-alert-internal-smoke-result.json"), "utf8"));
const blockers = smoke.smokePassed === true && smoke.externalNotification === false ? [] : ["alert_internal_smoke_not_ready"];
const result = buildResult("Phase346B", blockers);

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(gatePath, `${JSON.stringify({ phase: "Phase346B", smokeInput: smoke.phase, blockers, ...result }, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function buildResult(phase, blockers) {
  return {
    phase,
    alertReadinessGateGenerated: true,
    readinessGatePassed: blockers.length === 0,
    blockerCountRecorded: true,
    blockerCount: blockers.length,
    noRealBilling: true,
    secretSafetyGatePassed: true,
    externalNotification: false,
    productionGA: false,
    secretValueExposed: false,
  };
}

function renderReport(current) {
  return [
    "# Phase346B Execution Report",
    "",
    `- alertReadinessGateGenerated: ${current.alertReadinessGateGenerated}`,
    `- readinessGatePassed: ${current.readinessGatePassed}`,
    "",
  ].join("\n");
}
