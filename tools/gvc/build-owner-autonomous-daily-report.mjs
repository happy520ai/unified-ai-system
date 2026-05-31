import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { analyzeGvcBatch } from "./gvc-batch-analysis.mjs";

const repoRoot = process.cwd();
const summary = analyzeGvcBatch({ repoRoot });
const statePath = path.join(repoRoot, "docs/project-brain/timed-runner-state.json");
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8").replace(/^\uFEFF/, "")) : {};
const report = {
  phaseId: "Phase2042-GVC-Owner-Autonomous-Daily-Report",
  status: summary.realMutationCount > 0 ? "passed" : "blocked",
  generatedAt: new Date().toISOString(),
  todayLoopCount: summary.loopCount,
  todayRealModifiedFiles: summary.realModifiedFiles,
  todayFailureCount: summary.failedMutationCount,
  todayRollbackCount: summary.rollbackCount,
  currentBlocker: state.currentBlocker || "none",
  tomorrowSuggestion: "Review the autonomous value report, then approve the next low-risk batch only if quality gate remains green.",
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
};

write("apps/ai-gateway-service/evidence/phase2042-gvc-owner-autonomous-daily-report/owner-autonomous-daily-report.json", report);
write("apps/ai-gateway-service/evidence/phase2042-gvc-owner-autonomous-daily-report/owner-autonomous-daily-report.md", [
  "# Phase2042 Owner Autonomous Daily Report",
  "",
  `- 今日 loop 次数: ${report.todayLoopCount}`,
  `- 今日真实修改: ${report.todayRealModifiedFiles.join(", ") || "none"}`,
  `- 今日失败/回滚: failed=${report.todayFailureCount}, rollback=${report.todayRollbackCount}`,
  `- 当前 blocker: ${report.currentBlocker}`,
  `- 明天建议: ${report.tomorrowSuggestion}`,
  "",
].join("\n"));

console.log(JSON.stringify({ status: report.status, todayLoopCount: report.todayLoopCount, todayRealModifiedFiles: report.todayRealModifiedFiles.length }, null, 2));
if (report.status !== "passed") process.exit(1);

function write(relativePath, content) {
  const filePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`, "utf8");
}
