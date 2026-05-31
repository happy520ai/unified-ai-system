import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { analyzeGvcBatch } from "./gvc-batch-analysis.mjs";

const repoRoot = process.cwd();
const summary = analyzeGvcBatch({ repoRoot });
const checks = [
  ["loops_lte_500", summary.loopCount <= 500],
  ["real_mutation_loops_lte_100", summary.realMutationCount <= 100],
  ["failed_mutation_loops_lte_10", summary.failedMutationCount <= 10],
  ["rollback_failures_zero", summary.rollbackFailedCount === 0],
];
const failed = checks.filter(([, pass]) => !pass);
const result = {
  phaseId: "Phase2041-GVC-Daily-Cap-Enforcer",
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  loopCount: summary.loopCount,
  realMutationLoops: summary.realMutationCount,
  failedMutationLoops: summary.failedMutationCount,
  rollbackFailures: summary.rollbackFailedCount,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map(([id]) => id).join(", "),
  checks: checks.map(([id, pass]) => ({ id, pass })),
};
writeEvidence("phase2041-gvc-daily-cap-enforcer/daily-cap-enforcer-result.json", result);
console.log(JSON.stringify({ status: result.status, blocker: result.blocker, realMutationLoops: result.realMutationLoops }, null, 2));
if (failed.length > 0) process.exit(1);

function writeEvidence(relativePath, value) {
  const filePath = path.join(repoRoot, "apps/ai-gateway-service/evidence", relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
