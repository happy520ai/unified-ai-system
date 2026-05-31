import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import "./build-owner-autonomous-daily-report.mjs";

const repoRoot = process.cwd();
const reportPath = path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2042-gvc-owner-autonomous-daily-report/owner-autonomous-daily-report.json");
const reportMdPath = path.join(repoRoot, "apps/ai-gateway-service/evidence/phase2042-gvc-owner-autonomous-daily-report/owner-autonomous-daily-report.md");
const rootPackage = readJson("package.json") ?? {};
const report = readJson("apps/ai-gateway-service/evidence/phase2042-gvc-owner-autonomous-daily-report/owner-autonomous-daily-report.json") ?? {};
const reportMd = existsSync(reportMdPath) ? readFileSync(reportMdPath, "utf8") : "";
const checks = [
  ["report_json_exists", existsSync(reportPath)],
  ["report_md_exists", existsSync(reportMdPath)],
  ["status_passed", report.status === "passed"],
  ["loop_count_recorded", Number.isInteger(report.todayLoopCount) && report.todayLoopCount > 0],
  ["real_modified_files_recorded", Array.isArray(report.todayRealModifiedFiles) && report.todayRealModifiedFiles.length > 0],
  ["rollback_count_recorded", Number.isInteger(report.todayRollbackCount)],
  ["current_blocker_recorded", typeof report.currentBlocker === "string" && report.currentBlocker.length > 0],
  ["tomorrow_suggestion_recorded", typeof report.tomorrowSuggestion === "string" && report.tomorrowSuggestion.length > 0],
  ["provider_false", report.providerCallsMade === false],
  ["secret_false", report.secretRead === false],
  ["deploy_false", report.deployExecuted === false],
  ["chat_gateway_false", report.chatGatewayExecuteModified === false],
  ["markdown_owner_readable", reportMd.includes("今日 loop 次数") && reportMd.includes("明天建议")],
  ["root_verify_script", rootPackage.scripts?.["verify:phase2042-gvc-owner-autonomous-daily-report"] === "node tools/gvc/verify-owner-autonomous-daily-report.mjs"],
];
const failed = checks.filter(([, pass]) => !pass);
const result = {
  phaseId: "Phase2042-GVC-Owner-Autonomous-Daily-Report",
  status: failed.length === 0 ? "passed" : "failed",
  generatedAt: new Date().toISOString(),
  reportPath: "apps/ai-gateway-service/evidence/phase2042-gvc-owner-autonomous-daily-report/owner-autonomous-daily-report.json",
  todayLoopCount: report.todayLoopCount ?? 0,
  todayRealModifiedFiles: report.todayRealModifiedFiles ?? [],
  providerCallsMade: false,
  secretRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  recommendedSealed: failed.length === 0,
  blocker: failed.length === 0 ? "none" : failed.map(([id]) => id).join(", "),
  checks: checks.map(([id, pass]) => ({ id, pass })),
};

writeEvidence("phase2042-gvc-owner-autonomous-daily-report/owner-autonomous-daily-report-verify-result.json", result);
console.log(JSON.stringify({ status: result.status, blocker: result.blocker, todayLoopCount: result.todayLoopCount }, null, 2));
if (failed.length > 0) process.exit(1);

function readJson(relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeEvidence(relativePath, value) {
  const filePath = path.join(repoRoot, "apps/ai-gateway-service/evidence", relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
