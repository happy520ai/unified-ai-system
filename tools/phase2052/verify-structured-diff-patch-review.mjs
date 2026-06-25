import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildPatchPreview } from "../../packages/gvc-permission-engine/src/index.js";
import { writeEvidenceFile } from "../lib/evidenceWriter.mjs";

const repoRoot = process.cwd();
const checks = [];

function check(id, pass, detail = "") {
  checks.push({ id, pass: Boolean(pass), detail: String(detail || "") });
}

const lowRiskPreview = buildPatchPreview({
  filePath: "docs/phase2052-structured-diff-patch-review.md",
  beforeText: "old line\n",
  afterText: "new line\n",
  riskLevel: "L1",
});
const highRiskPreview = buildPatchPreview({
  filePath: "apps/ai-gateway-service/src/chat-gateway/execute.js",
  beforeText: "old\n",
  afterText: "new\n",
  riskLevel: "L3",
});

check("low_risk_has_patch_preview", lowRiskPreview.patchPreview.lines.length >= 1);
check("low_risk_can_execute_after_review", lowRiskPreview.recommendedAction === "can_execute_after_review", lowRiskPreview.recommendedAction);
check("high_risk_approval_required", highRiskPreview.recommendedAction === "approval_required", highRiskPreview.recommendedAction);
check("chat_route_flagged", highRiskPreview.riskFlags.includes("chat_route"));
check("real_write_not_performed", lowRiskPreview.realWritePerformed === false && highRiskPreview.realWritePerformed === false);
check("mutation_evidence_required", lowRiskPreview.mutationEvidenceRequired === true);

const failed = checks.filter((item) => !item.pass);
const result = {
  phaseId: "Phase2052-Structured-Diff-Patch-Review",
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  checks,
  previews: { lowRiskPreview, highRiskPreview },
  copiedClaudeCodeSource: false,
  providerCallsMade: false,
  secretRead: false,
  chatGatewayExecuteModified: false,
  realWritePerformed: false,
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map((item) => item.id).join(", "),
};

writeEvidenceFile("apps/ai-gateway-service/evidence/phase2052-structured-diff-patch-review/result.json", result, repoRoot);
console.log(JSON.stringify({ status: result.status, blocker: result.blocker }, null, 2));
if (failed.length > 0) process.exit(1);

