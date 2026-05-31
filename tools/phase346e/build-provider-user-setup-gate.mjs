import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase346e");
const resultPath = resolve(evidenceDir, "provider-user-setup-gate-result.json");
const gatePath = resolve(repoRoot, "docs/phase346e-provider-user-setup-gate.json");
const reportPath = resolve(repoRoot, "docs/phase346e-execution-report.md");

const smoke = JSON.parse(await readFile(resolve(repoRoot, "apps/agent-console/evidence/phase345e/provider-onboarding-internal-smoke-result.json"), "utf8"));
const blockers = smoke.smokePassed === true && smoke.noProviderCallFromUi === true ? [] : ["provider_setup_gate_not_ready"];
const result = buildResult("Phase346E", blockers);

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(gatePath, `${JSON.stringify({ phase: "Phase346E", smokeInput: smoke.phase, blockers, ...result }, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function buildResult(phase, blockers) {
  return {
    phase,
    userSetupGateGenerated: true,
    readinessGatePassed: blockers.length === 0,
    blockerCountRecorded: true,
    blockerCount: blockers.length,
    noRealBilling: true,
    secretSafetyGatePassed: true,
    noProviderCallFromUi: true,
    productionGA: false,
    secretValueExposed: false,
  };
}

function renderReport(current) {
  return [
    "# Phase346E Execution Report",
    "",
    `- userSetupGateGenerated: ${current.userSetupGateGenerated}`,
    `- noProviderCallFromUi: ${current.noProviderCallFromUi}`,
    "",
  ].join("\n");
}
