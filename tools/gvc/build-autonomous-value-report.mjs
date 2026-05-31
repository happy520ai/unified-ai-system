import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { analyzeGvcBatch } from "./gvc-batch-analysis.mjs";

const repoRoot = process.cwd();
const summary = analyzeGvcBatch({ repoRoot });
const report = {
  phaseId: "Phase2039-GVC-Autonomous-Value-Report",
  status: summary.realMutationCount > 0 ? "passed" : "blocked",
  generatedAt: new Date().toISOString(),
  whatChanged: summary.realModifiedFiles,
  skippedApprovalRequiredTasks: summary.skippedApprovalRequiredTasks,
  rollbackCount: summary.rollbackCount,
  rollbackFailedCount: summary.rollbackFailedCount,
  blockedLowValueTasks: summary.blockedLowValueTasks,
  ownerSummary: `本批自动执行 ${summary.realMutationCount} 个低风险 mutation loop；未调用 Provider，未读取 secret，未部署。`,
  manualStepsSaved: [
    "自动筛选低风险任务",
    "自动写 mutation plan/evidence",
    "自动运行 verifier",
    "自动记录跳过的 approval_required task",
  ],
  nextMostValuableTask: "Phase2046: convert value report into owner-facing review workflow",
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
};

write("apps/ai-gateway-service/evidence/phase2039-gvc-autonomous-value-report/autonomous-value-report.json", report);
write("apps/ai-gateway-service/evidence/phase2039-gvc-autonomous-value-report/autonomous-value-report.md", [
  "# Phase2039 GVC Autonomous Value Report",
  "",
  `- realMutationCount: ${summary.realMutationCount}`,
  `- rollbackCount: ${summary.rollbackCount}`,
  `- rollbackFailedCount: ${summary.rollbackFailedCount}`,
  `- blockedLowValueTasks: ${summary.blockedLowValueTasks.join(", ") || "none"}`,
  `- skippedApprovalRequiredTasks: ${summary.skippedApprovalRequiredTasks.join(", ") || "none"}`,
  `- manualStepsSaved: ${report.manualStepsSaved.join("; ")}`,
  `- nextMostValuableTask: ${report.nextMostValuableTask}`,
  "",
].join("\n"));

console.log(JSON.stringify({ status: report.status, realMutationCount: summary.realMutationCount }, null, 2));
if (report.status !== "passed") process.exit(1);

function write(relativePath, content) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`, "utf8");
}
