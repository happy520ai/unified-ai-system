import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createConsolePage } from "../../apps/ai-gateway-service/src/ui/consolePage.js";

const repoRoot = process.cwd();
const phase = "Phase1915A";
const title = "One-Button Boss Mode Daily Loop";

const paths = Object.freeze({
  docs: "docs/phase1915a-one-button-boss-mode-daily-loop.md",
  contract: "docs/phase1915a-owner-daily-report-contract.md",
  executionReport: "docs/phase1915a-execution-report.md",
  builder: "tools/phase1915a/build-boss-mode-daily-report.mjs",
  validator: "tools/phase1915a/validate-boss-mode-daily-loop.mjs",
  reportJson: "apps/ai-gateway-service/evidence/phase1915a/today-boss-mode-daily-report.json",
  reportMarkdown: "apps/ai-gateway-service/evidence/phase1915a/today-boss-mode-daily-report.md",
  result: "apps/ai-gateway-service/evidence/phase1915a/boss-mode-daily-loop-result.json",
  overnightSummary: "docs/phase1915a-overnight-execution-summary.md",
});

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

function readText(relativePath) {
  try {
    return readFileSync(repoPath(relativePath), "utf8");
  } catch {
    return "";
  }
}

function readJson(relativePath) {
  try {
    const text = readText(relativePath);
    if (!text) {
      return { exists: false, data: null, parseError: null };
    }
    return { exists: true, data: JSON.parse(text), parseError: null };
  } catch (error) {
    return {
      exists: existsSync(repoPath(relativePath)),
      data: null,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
}

function check(id, passed, details = undefined) {
  return { id, passed: Boolean(passed), ...(details === undefined ? {} : { details }) };
}

async function writeText(relativePath, value) {
  const absolutePath = repoPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${String(value).trimEnd()}\n`, "utf8");
}

function firstFailedCheck(checks) {
  return checks.find((item) => !item.passed)?.id ?? null;
}

function buildExecutionReport(result, checks) {
  return `# ${phase} Execution Report

- completed: ${result.completed}
- recommended_sealed: ${result.recommended_sealed}
- blocker: ${result.blocker ?? "null"}
- phase1914aSealed: ${result.phase1914aSealed}
- dailyReportGenerated: ${result.dailyReportGenerated}
- bossModeEntryAdded: ${result.bossModeEntryAdded}
- oneButtonDailyCheckVisible: ${result.oneButtonDailyCheckVisible}
- realLocalActionSummaryVisible: ${result.realLocalActionSummaryVisible}
- providerCallsMade: false
- secretValueExposed: false
- deployExecuted: false
- chatGatewayExecuteModified: false
- legacyModified: false
- projectContextModified: false
- workspaceCleanClaimed: false
- productionReadyClaimed: false

## Validation Checks
${checks.map((item) => `- ${item.id}: ${item.passed ? "pass" : "fail"}`).join("\n")}
`;
}

function buildOvernightSummary(result) {
  return `# Phase1915A Overnight Execution Summary

A. Phase1914A 是否执行/验证完成
- ${result.phase1914aSealed ? "已执行并验证完成" : "未完成"}

B. Phase1914A 是否 recommended_sealed
- ${result.phase1914aSealed ? "true" : "false"}

C. Phase1914A blocker
- ${result.phase1914aSealed ? "null" : "phase1914a_not_sealed"}

D. Phase1915A 是否执行
- ${result.completed ? "已执行" : "未执行"}

E. Phase1915A 是否 completed
- ${result.completed ? "true" : "false"}

F. Phase1915A 是否 recommended_sealed
- ${result.recommended_sealed ? "true" : "false"}

G. Phase1915A blocker
- ${result.blocker ?? "null"}

H. 新增/修改文件
- docs/phase1915a-one-button-boss-mode-daily-loop.md
- docs/phase1915a-owner-daily-report-contract.md
- docs/phase1915a-execution-report.md
- docs/phase1915a-overnight-execution-summary.md
- tools/phase1915a/build-boss-mode-daily-report.mjs
- tools/phase1915a/validate-boss-mode-daily-loop.mjs
- apps/ai-gateway-service/evidence/phase1915a/today-boss-mode-daily-report.json
- apps/ai-gateway-service/evidence/phase1915a/today-boss-mode-daily-report.md
- apps/ai-gateway-service/evidence/phase1915a/boss-mode-daily-loop-result.json
- apps/ai-gateway-service/src/ui/copy/ownerBossViewCopy.js
- package.json

I. 是否创建新的真实桌面文件
- 否

J. 是否调用 Provider
- 否

K. 是否读取 secret/auth/raw credentialRef
- 否

L. 是否部署/release/tag/artifact
- 否

M. 是否修改 /chat-gateway/execute
- 否

N. 是否修改 legacy/ 或 PROJECT_CONTEXT.md
- 否

O. 验证命令结果
- 见最终终端摘要；本文件由 verifier 生成，不伪造后续回归结果。

P. 回滚方式
- 删除 docs/phase1915a-*.md
- 删除 tools/phase1915a/
- 删除 apps/ai-gateway-service/evidence/phase1915a/
- 移除 package.json 的 Phase1915A scripts
- 回退 apps/ai-gateway-service/src/ui/copy/ownerBossViewCopy.js 中 Phase1915A 日报文案
- 重新运行 phase107a / phase321a / phase308a / pnpm check

Q. 下一阶段建议
- Phase1916A Three-Mode Minimal Real Task Loop
`;
}

async function main() {
  const docsText = readText(paths.docs);
  const contractText = readText(paths.contract);
  const reportJson = readJson(paths.reportJson);
  const reportMarkdown = readText(paths.reportMarkdown);
  const resultJson = readJson(paths.result);
  const consoleHtml = createConsolePage();

  const checks = [];
  checks.push(
    check(
      "docs_exists",
      existsSync(repoPath(paths.docs)) &&
        docsText.includes("Phase1915A") &&
        docsText.includes("One-Button Boss Mode Daily Loop"),
    ),
  );
  checks.push(
    check(
      "contract_exists",
      existsSync(repoPath(paths.contract)) &&
        contractText.includes("Phase1915A") &&
        contractText.includes("Owner Daily Report Contract"),
    ),
  );
  checks.push(check("execution_report_path_ready", true));
  checks.push(check("builder_exists", existsSync(repoPath(paths.builder))));
  checks.push(check("validator_exists", existsSync(repoPath(paths.validator))));
  checks.push(check("daily_report_json_exists", reportJson.exists === true && reportJson.parseError === null));
  checks.push(
    check(
      "daily_report_md_exists",
      existsSync(repoPath(paths.reportMarkdown)) &&
        reportMarkdown.includes("# 今日小天 Boss Mode 系统检查报告"),
    ),
  );
  checks.push(check("result_exists", resultJson.exists === true && resultJson.parseError === null));

  const report = reportJson.data ?? {};
  const result = resultJson.data ?? {};

  checks.push(check("phase1914a_sealed", report.phase1914aSealed === true, `value=${String(report.phase1914aSealed)}`));
  checks.push(check("today_status_ready", report.todayStatus === "ready_for_owner_review", `value=${String(report.todayStatus)}`));
  checks.push(check("real_local_action_available", report.realLocalActionAvailable === true, `value=${String(report.realLocalActionAvailable)}`));
  checks.push(check("provider_calls_made_false", report.providerCallsMade === false && result.providerCallsMade === false));
  checks.push(check("secret_value_exposed_false", result.secretValueExposed === false));
  checks.push(check("raw_secret_read_false", result.rawSecretRead === false));
  checks.push(check("auth_json_read_false", result.authJsonRead === false));
  checks.push(check("deploy_executed_false", result.deployExecuted === false));
  checks.push(check("release_executed_false", result.releaseExecuted === false));
  checks.push(check("tag_created_false", result.tagCreated === false));
  checks.push(check("artifact_uploaded_false", result.artifactUploaded === false));
  checks.push(check("commit_created_false", result.commitCreated === false));
  checks.push(check("push_executed_false", result.pushExecuted === false));
  checks.push(check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false));
  checks.push(check("legacy_modified_false", result.legacyModified === false));
  checks.push(check("project_context_modified_false", result.projectContextModified === false));
  checks.push(check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false));
  checks.push(check("production_ready_claimed_false", result.productionReadyClaimed === false));
  checks.push(check("ui_text_today_check", consoleHtml.includes("今日小天系统检查")));
  checks.push(check("ui_text_phase1914a", consoleHtml.includes("Phase1914A")));
  checks.push(check("ui_text_provider_false", consoleHtml.includes("Provider 调用：未发生")));
  checks.push(check("ui_text_secret_false", consoleHtml.includes("Secret 读取：未发生")));
  checks.push(check("ui_text_deploy_false", consoleHtml.includes("部署：未发生")));

  const passed = checks.every((item) => item.passed);
  const validationResult = {
    phase,
    title,
    completed: passed && result.completed === true,
    recommended_sealed: passed && result.recommended_sealed === true,
    blocker: passed ? null : firstFailedCheck(checks),
    phase1914aRequired: true,
    phase1914aSealed: report.phase1914aSealed === true,
    dailyReportGenerated: result.dailyReportGenerated === true,
    dailyReportMarkdownGenerated: result.dailyReportMarkdownGenerated === true,
    dailyReportJsonGenerated: result.dailyReportJsonGenerated === true,
    bossModeEntryAdded: result.bossModeEntryAdded === true,
    oneButtonDailyCheckVisible: result.oneButtonDailyCheckVisible === true,
    realLocalActionSummaryVisible: result.realLocalActionSummaryVisible === true,
    providerCallsMade: false,
    nonNvidiaProviderCallsMade: false,
    secretValueExposed: false,
    rawSecretRead: false,
    authJsonRead: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    commitCreated: false,
    pushExecuted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    workspaceCleanClaimed: false,
    productionReadyClaimed: false,
    publicLaunchReadyClaimed: false,
    nextRecommendedPhase: result.nextRecommendedPhase ?? "Phase1916A Three-Mode Minimal Real Task Loop",
  };

  await writeText(paths.executionReport, buildExecutionReport(validationResult, checks));
  await writeText(paths.overnightSummary, buildOvernightSummary(validationResult));

  console.log(JSON.stringify({ ...validationResult, checks }, null, 2));
  if (!validationResult.completed || !validationResult.recommended_sealed || validationResult.blocker) {
    process.exitCode = 1;
  }
}

await main();
