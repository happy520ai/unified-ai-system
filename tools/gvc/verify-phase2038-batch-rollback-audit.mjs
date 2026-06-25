import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { analyzeGvcBatch } from "./gvc-batch-analysis.mjs";
import { writeEvidenceFile } from "../lib/evidenceWriter.mjs";

const repoRoot = process.cwd();
const summary = analyzeGvcBatch({ repoRoot });
const checks = [
  ["real_mutation_executed", summary.realMutationCount > 0],
  ["rollback_failed_zero", summary.rollbackFailedCount === 0],
  ["forbidden_flags_false", !summary.providerCallsMade && !summary.secretRead && !summary.deployExecuted && !summary.chatGatewayExecuteModified && !summary.legacyModified && !summary.projectContextModified],
  ["modified_files_safe", summary.realModifiedFiles.every((file) => file.startsWith("apps/ai-gateway-service/evidence/") || file.startsWith("tools/gvc/") || file.startsWith("docs/phase") || file.startsWith("tools/phase") || file === "package.json")],
];
const failed = checks.filter(([, pass]) => !pass);
const result = {
  phaseId: "Phase2038-GVC-Batch-Verification-And-Rollback-Audit",
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  ...summary,
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map(([id]) => id).join(", "),
  checks: checks.map(([id, pass]) => ({ id, pass })),
};
writeEvidenceFile("apps/ai-gateway-service/evidence/phase2038-gvc-batch-rollback-audit/batch-rollback-audit-result.json", result, repoRoot);
console.log(JSON.stringify({ status: result.status, blocker: result.blocker, realMutationCount: result.realMutationCount, rollbackFailedCount: result.rollbackFailedCount }, null, 2));
if (failed.length > 0) process.exit(1);

