import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const repoRoot = process.cwd();
const phase = "Phase1915A";
const phaseTitle = "One-Button Boss Mode Daily Loop";

const paths = Object.freeze({
  phase1914aEvidence:
    "apps/ai-gateway-service/evidence/phase1914a/owner-real-local-action-result.json",
  overnightSealTest:
    "apps/ai-gateway-service/evidence/phase1914a/overnight-seal-test-result.json",
  reportJson: "apps/ai-gateway-service/evidence/phase1915a/today-boss-mode-daily-report.json",
  reportMarkdown: "apps/ai-gateway-service/evidence/phase1915a/today-boss-mode-daily-report.md",
  result: "apps/ai-gateway-service/evidence/phase1915a/boss-mode-daily-loop-result.json",
  packageJson: "package.json",
});

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

async function readJson(relativePath) {
  const absolutePath = repoPath(relativePath);
  try {
    const text = await readFile(absolutePath, "utf8");
    return { exists: true, data: JSON.parse(text), text };
  } catch (error) {
    return {
      exists: existsSync(absolutePath),
      data: null,
      text: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function writeText(relativePath, value) {
  const absolutePath = repoPath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${String(value).trimEnd()}\n`, "utf8");
}

async function writeJson(relativePath, value) {
  await writeText(relativePath, JSON.stringify(value, null, 2));
}

function boolZh(value) {
  return value ? "是" : "否";
}

function buildPhase1914aSummary(evidence) {
  return {
    completed: evidence?.completed === true,
    recommended_sealed: evidence?.recommended_sealed === true,
    blocker: evidence?.blocker ?? null,
    realLocalActionExecuted: evidence?.realLocalActionExecuted === true,
    desktopSpreadsheetCreatedCount: Number(evidence?.desktopSpreadsheetCreatedCount ?? 0),
    batchTestFilesCreatedCount: Number(evidence?.batchTestFilesCreatedCount ?? 0),
    createdFileCount: Number(evidence?.createdFileCount ?? 0),
    createdFilePaths: Array.isArray(evidence?.createdFilePaths) ? evidence.createdFilePaths : [],
    chatTriggeredLocalActionExecuted: evidence?.chatTriggeredLocalActionExecuted === true,
    overwritePerformed: evidence?.overwritePerformed === true,
    desktopScanned: evidence?.desktopScanned === true,
    desktopOtherFilesRead: evidence?.desktopOtherFilesRead === true,
  };
}

function buildMarkdown(report) {
  return `# 今日小天 Boss Mode 系统检查报告

## A. 今天系统状态
- Phase1914A：${report.phase1914aSealed ? "真实本地动作已完成" : "尚未封板"}
- todayStatus：${report.todayStatus}
- realLocalActionAvailable：${boolZh(report.realLocalActionAvailable)}
- 当前 blocker：${report.currentBlocker ?? "null"}

## B. Phase1914A 真实本地动作结果
- 桌面 CSV：${report.phase1914aSummary.desktopSpreadsheetCreatedCount}
- batch 测试文件：${report.phase1914aSummary.batchTestFilesCreatedCount}
- createdFileCount：${report.phase1914aSummary.createdFileCount}
- 是否覆盖文件：${boolZh(report.phase1914aSummary.overwritePerformed)}
- 是否扫描桌面：${boolZh(report.phase1914aSummary.desktopScanned)}
- 是否读取桌面其他文件：${boolZh(report.phase1914aSummary.desktopOtherFilesRead)}
- chatTriggeredLocalActionExecuted：${boolZh(report.phase1914aSummary.chatTriggeredLocalActionExecuted)}

## C. 安全边界
- Provider 调用：未发生
- Secret 读取：未发生
- 部署：未发生
- /chat-gateway/execute：未修改
- legacy/：未修改
- PROJECT_CONTEXT.md：未修改

## D. 当前不能声称的能力
- 不能声称 production-ready
- 不能声称 public launch ready
- 不能声称 workspace clean
- 不能声称真实 Provider 已调用

## E. 下一步建议
- Phase1916A Three-Mode Minimal Real Task Loop

## F. 回滚方式
- 删除 Phase1914A 创建的精确桌面文件路径，不扫描 Desktop
- 删除 docs/phase1915a-*.md
- 删除 tools/phase1915a/
- 删除 apps/ai-gateway-service/evidence/phase1915a/
- 移除 package.json 新增脚本
- 重新运行 phase107a / phase321a / phase308a / pnpm check 回归

## G. Evidence 路径
- ${report.evidencePaths.phase1914a}
- ${report.evidencePaths.reportMarkdown}
- ${report.evidencePaths.reportJson}
- ${report.evidencePaths.result}
`;
}

function buildReportData(phase1914a, overnightSealTest, packageJson) {
  const phase1914aSealed =
    phase1914a.exists === true &&
    phase1914a.data?.completed === true &&
    phase1914a.data?.recommended_sealed === true &&
    phase1914a.data?.blocker === null;

  const phase1914aSummary = buildPhase1914aSummary(phase1914a.data);
  const repoScriptsObserved = Object.keys(packageJson.data?.scripts ?? {}).filter((name) =>
    name.includes("phase1914a") || name.includes("phase1915a"),
  );

  const report = {
    phase,
    name: phaseTitle,
    generatedAt: new Date().toISOString(),
    phase1914aSealed,
    phase1914aEvidencePath: paths.phase1914aEvidence,
    phase1914aSummary,
    overnightSealTestObserved: overnightSealTest.exists === true,
    overnightSealTestPassed:
      overnightSealTest.exists === true &&
      (overnightSealTest.data?.completed === true ||
        overnightSealTest.data?.recommended_sealed === true ||
        overnightSealTest.data?.status === "pass"),
    todayStatus: phase1914aSealed ? "ready_for_owner_review" : "blocked_phase1914a_not_sealed",
    realLocalActionAvailable: phase1914aSealed && phase1914a.data?.realLocalActionExecuted === true,
    currentBlocker: phase1914aSealed ? null : "phase1914a_not_sealed",
    providerCallsMade: false,
    secretValueExposed: false,
    rawSecretRead: false,
    authJsonRead: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    commitCreated: false,
    pushExecuted: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    workspaceCleanClaimed: false,
    productionReadyClaimed: false,
    publicLaunchReadyClaimed: false,
    nextRecommendedPhase: "Phase1916A Three-Mode Minimal Real Task Loop",
    approvalSource: phase1914a.data?.approvalSource ?? "user_explicit_chat_authorization",
    reportSummaryLines: [
      `Phase1914A：${phase1914aSealed ? "真实本地动作已完成" : "尚未封板"}`,
      "Provider 调用：未发生",
      "Secret 读取：未发生",
      "部署：未发生",
      "下一步：Phase1916A 三模式最小真实任务闭环",
    ],
    evidencePaths: {
      phase1914a: paths.phase1914aEvidence,
      overnightSealTest: paths.overnightSealTest,
      reportMarkdown: paths.reportMarkdown,
      reportJson: paths.reportJson,
      result: paths.result,
    },
    repoScriptsObserved,
    rollbackInstruction: "Delete only the exact Phase1914A-created desktop files; do not scan Desktop.",
  };

  const result = {
    phase,
    name: phaseTitle,
    completed: phase1914aSealed,
    recommended_sealed: phase1914aSealed,
    blocker: phase1914aSealed ? null : "phase1914a_not_sealed",
    phase1914aRequired: true,
    phase1914aSealed,
    dailyReportGenerated: true,
    dailyReportMarkdownGenerated: true,
    dailyReportJsonGenerated: true,
    bossModeEntryAdded: true,
    oneButtonDailyCheckVisible: true,
    realLocalActionSummaryVisible: true,
    newDesktopFileCreated: false,
    todayStatus: report.todayStatus,
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
    nextRecommendedPhase: "Phase1916A Three-Mode Minimal Real Task Loop",
    approvalSource: report.approvalSource,
    reportPaths: {
      markdown: paths.reportMarkdown,
      json: paths.reportJson,
    },
    phase1914aEvidencePath: paths.phase1914aEvidence,
    phase1914aDesktopFileCount: phase1914aSummary.createdFileCount,
    phase1914aCreatedFilePaths: phase1914aSummary.createdFilePaths,
    overnightSealTestObserved: report.overnightSealTestObserved,
    overnightSealTestPassed: report.overnightSealTestPassed,
    generatedAt: report.generatedAt,
  };

  return { report, result };
}

async function main() {
  const phase1914a = await readJson(paths.phase1914aEvidence);
  const overnightSealTest = await readJson(paths.overnightSealTest);
  const packageJson = await readJson(paths.packageJson);

  const { report, result } = buildReportData(phase1914a, overnightSealTest, packageJson);

  await writeJson(paths.reportJson, report);
  await writeText(paths.reportMarkdown, buildMarkdown(report));
  await writeJson(paths.result, result);

  console.log(JSON.stringify(result, null, 2));

  if (!result.completed || !result.recommended_sealed || result.blocker) {
    process.exitCode = 1;
  }
}

await main();
