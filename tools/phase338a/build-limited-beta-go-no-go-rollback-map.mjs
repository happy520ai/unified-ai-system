import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase338a");
const resultPath = resolve(evidenceDir, "limited-beta-go-no-go-rollback-map-result.json");
const matrixPath = resolve(repoRoot, "docs/phase338a-go-no-go-decision-matrix.json");
const rollbackPath = resolve(repoRoot, "docs/phase338a-rollback-trigger-map.json");
const reportPath = resolve(repoRoot, "docs/phase338a-execution-report.md");

const manifest = JSON.parse(await readFile(resolve(repoRoot, "docs/phase337a-limited-beta-audit-ready-manifest.json"), "utf8"));

const matrix = {
  phase: "Phase338A",
  goNoGoMatrixGenerated: true,
  decisions: [
    { gate: "evidence_index", status: manifest.auditReadyManifestGenerated ? "ready" : "blocked" },
    { gate: "unresolved_blocker_tracking", status: manifest.unresolvedBlockersTracked ? "watch" : "ready" },
    { gate: "release_boundary", status: manifest.noReleaseBoundary ? "ready" : "blocked" },
  ],
  recommendation: manifest.unresolvedBlockersTracked ? "limited_beta_hold_for_tracked_blockers" : "limited_beta_dry_run_ready",
};
const rollbackMap = {
  phase: "Phase338A",
  rollbackTriggerMapGenerated: true,
  triggers: [
    "secret_safety_regression",
    "provider_real_call_without_gate",
    "credential_ref_bypass",
    "mock_billing_claims_actual_invoice",
    "unreviewed_policy_activation",
  ],
  releaseExecuted: false,
  deployExecuted: false,
};

const result = {
  phase: "Phase338A",
  goNoGoMatrixGenerated: true,
  rollbackTriggerMapGenerated: true,
  recommendation: matrix.recommendation,
  releaseExecuted: false,
  deployExecuted: false,
  secretValueExposed: false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(matrixPath, `${JSON.stringify(matrix, null, 2)}\n`, "utf8");
await writeFile(rollbackPath, `${JSON.stringify(rollbackMap, null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function renderReport(current) {
  return [
    "# Phase338A Execution Report",
    "",
    `- goNoGoMatrixGenerated: ${current.goNoGoMatrixGenerated}`,
    `- rollbackTriggerMapGenerated: ${current.rollbackTriggerMapGenerated}`,
    `- recommendation: ${current.recommendation}`,
    "",
  ].join("\n");
}
