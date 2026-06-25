import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { analyzeGvcBatch } from "./gvc-batch-analysis.mjs";
import { writeEvidenceFile } from "../lib/evidenceWriter.mjs";

const repoRoot = process.cwd();
const summary = analyzeGvcBatch({ repoRoot });
const mutationFailureRate = summary.realMutationCount + summary.failedMutationCount === 0
  ? 0
  : summary.failedMutationCount / (summary.realMutationCount + summary.failedMutationCount);
const sameFileOverLimit = Object.values(summary.touchedCounts).some((count) => count > 3);
const checks = [
  ["no_three_consecutive_noop", summary.noOpCount < 3],
  ["low_value_blocked_under_limit", summary.qualityGateBlockedCount < 2 || summary.realMutationCount > 0],
  ["mutation_failure_rate_under_30", mutationFailureRate <= 0.3],
  ["same_file_not_touched_over_3", !sameFileOverLimit],
];
const failed = checks.filter(([, pass]) => !pass);
const result = {
  phaseId: "Phase2040-GVC-Runner-Runaway-Guard",
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  mutationFailureRate,
  noOpCount: summary.noOpCount,
  qualityGateBlockedCount: summary.qualityGateBlockedCount,
  sameFileTouchedOverLimit: sameFileOverLimit,
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map(([id]) => id).join(", "),
  checks: checks.map(([id, pass]) => ({ id, pass })),
};
writeEvidenceFile("apps/ai-gateway-service/evidence/phase2040-gvc-runaway-guard/runaway-guard-result.json", result, repoRoot);
console.log(JSON.stringify({ status: result.status, blocker: result.blocker, mutationFailureRate }, null, 2));
if (failed.length > 0) process.exit(1);

