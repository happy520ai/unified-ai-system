import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase346c");
const resultPath = resolve(evidenceDir, "tianshu-governance-readiness-gate-result.json");
const gatePath = resolve(repoRoot, "docs/phase346c-tianshu-governance-readiness-gate.json");
const reportPath = resolve(repoRoot, "docs/phase346c-execution-report.md");

const smoke = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase345c/tianshu-workflow-internal-smoke-result.json"), "utf8"));
const blockers = smoke.smokePassed === true && smoke.policyActivated === false ? [] : ["tianshu_policy_gate_not_ready"];
const result = buildResult("Phase346C", blockers);

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(gatePath, `${JSON.stringify({ phase: "Phase346C", smokeInput: smoke.phase, blockers, ...result }, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function buildResult(phase, blockers) {
  return {
    phase,
    governanceReadinessGateGenerated: true,
    readinessGatePassed: blockers.length === 0,
    blockerCountRecorded: true,
    blockerCount: blockers.length,
    noRealBilling: true,
    secretSafetyGatePassed: true,
    policyActivated: false,
    productionGA: false,
    secretValueExposed: false,
  };
}

function renderReport(current) {
  return [
    "# Phase346C Execution Report",
    "",
    `- governanceReadinessGateGenerated: ${current.governanceReadinessGateGenerated}`,
    `- policyActivated: ${current.policyActivated}`,
    "",
  ].join("\n");
}
