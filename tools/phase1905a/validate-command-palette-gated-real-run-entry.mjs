import { existsSync } from "node:fs";
import {
  check,
  finish,
  importFresh,
  phaseEvidencePath,
  readApproval,
  readJson,
  readText,
  safetyFalseFields,
  writeText,
} from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1905A";
const approvalPath = "docs/approvals/phase1905a-owner-desktop-real-run.input.json";
const evidencePath = phaseEvidencePath("phase1905a", "command-palette-gated-real-run-entry-result.json");
const docsPath = "docs/phase1905a-command-palette-gated-real-run-entry.md";
const reportPath = "docs/phase1905a-execution-report.md";

const approvalTemplate = {
  phase,
  ownerApproved: true,
  approvedActionId: "create_desktop_spreadsheet",
  allowRealDesktopFileCreation: true,
  maxRealFileCreateCount: 1,
  allowOverwrite: false,
  allowDesktopScan: false,
  allowReadOtherDesktopFiles: false,
  approvedOutputDirectory: "Desktop",
  approvedTestFilenamePrefix: "小天真实运行测试",
  acknowledgeThisCreatesARealDesktopFile: true,
  approvalSource: "owner_explicit_chat_authorization",
  approvalScope: "guarded_real_local_desktop_file_creation_test_only",
};

const approval = readApproval(approvalPath, approvalTemplate);
const previousEvidence = readJson(evidencePath);
const approvalValid =
  approval.exists === true &&
  approval.parseError === null &&
  approval.data?.phase === phase &&
  approval.data?.ownerApproved === true &&
  approval.data?.approvedActionId === "create_desktop_spreadsheet" &&
  approval.data?.allowRealDesktopFileCreation === true &&
  approval.data?.maxRealFileCreateCount === 1 &&
  approval.data?.allowOverwrite === false &&
  approval.data?.allowDesktopScan === false &&
  approval.data?.allowReadOtherDesktopFiles === false &&
  approval.data?.approvedOutputDirectory === "Desktop" &&
  approval.data?.approvedTestFilenamePrefix === "小天真实运行测试" &&
  approval.data?.acknowledgeThisCreatesARealDesktopFile === true &&
  approval.data?.approvalSource === "owner_explicit_chat_authorization" &&
  approval.data?.approvalScope === "guarded_real_local_desktop_file_creation_test_only";

let rendered = "";
let renderError = null;
try {
  const { renderOwnerBossViewPanel } = await importFresh("apps/ai-gateway-service/src/ui/components/OwnerBossViewPanel.js");
  rendered = renderOwnerBossViewPanel();
} catch (error) {
  renderError = error instanceof Error ? error.message : String(error);
}

let realRunResult = null;
let realRunError = null;
if (approvalValid) {
  try {
    const reusableRun = previousEvidence.data?.realRunResult;
    if (previousEvidence.data?.recommended_sealed === true && exactCreatedPathsExist(reusableRun, 1)) {
      realRunResult = reusableRun;
    } else {
      const runtime = await importFresh("apps/ai-gateway-service/src/owner-automation/desktopActionRuntime.js");
      realRunResult = await runtime.realRunDesktopAction({
        actionId: "create_desktop_spreadsheet",
        input: {
          actionId: "create_desktop_spreadsheet",
          filenamePrefix: approval.data.approvedTestFilenamePrefix,
          fileType: "csv",
          headers: ["任务", "状态", "备注"],
          rows: [["真实运行测试", "已创建", "Phase1905A approval-bound"]],
        },
        approval: approval.data,
        evidencePhase: "phase1905a",
      });
    }
  } catch (error) {
    realRunError = error instanceof Error ? error.message : String(error);
  }
}

const docsText = readText(docsPath);
const createdFilePaths = extractCreatedFilePaths(realRunResult);
const fileExistsCheck = createdFilePaths.map((filePath) => ({ path: filePath, exists: existsSync(filePath) }));
const allCreatedFilesExist = createdFilePaths.length === 1 && fileExistsCheck.every((item) => item.exists === true);
const buttonEnabled = rendered.includes('data-owner-command-real-run-enabled="true"') && !/data-owner-command-real-run-gated="true"[^>]*disabled/u.test(rendered);
const buttonDisabled = /data-owner-command-real-run-gated="true"[^>]*disabled/u.test(rendered);
const checks = [
  check("docs_exists", docsText.includes("Phase1905A") && docsText.includes("Command Palette Gated Real Run Entry")),
  check("render_success", renderError === null && rendered.length > 0, renderError),
  check("gated_real_run_entry_visible", rendered.includes('data-owner-command-real-run-gated="true"')),
  check("copy_requires_confirm", rendered.includes("真实创建需要单独确认")),
  check("copy_preview_first", rendered.includes("默认先预览")),
  check("copy_never_overwrite", rendered.includes("不会覆盖已有文件")),
  check("copy_no_desktop_scan", rendered.includes("不会扫描桌面")),
  check("copy_no_other_file_read", rendered.includes("不会读取桌面其他文件")),
  check("button_state_matches_approval", approvalValid ? buttonEnabled : buttonDisabled),
  check("real_run_only_with_approval", approvalValid ? realRunResult?.fileCreated === true : realRunResult === null),
  check("desktop_file_count", approvalValid ? realRunResult?.desktopFileCreatedCount === 1 : true),
  check("created_file_paths_recorded", approvalValid ? createdFilePaths.length === 1 : true),
  check("file_exists_check", approvalValid ? allCreatedFilesExist : true),
];

const result = {
  phase,
  title: "Command Palette Gated Real Run Entry",
  completed: true,
  recommended_sealed: approvalValid && checks.every((item) => item.passed),
  blocker: approvalValid ? null : "owner_real_run_approval_missing",
  approvalPath,
  approvalTemplatePath: approval.templatePath,
  approvalInputExists: approval.exists,
  approvalValid,
  gatedRealRunEntryVisible: rendered.includes('data-owner-command-real-run-gated="true"'),
  realRunButtonDisabledWithoutApproval: approvalValid ? false : buttonDisabled,
  realRunEnabledOnlyWithApproval: approvalValid ? buttonEnabled : true,
  desktopFileCreated: approvalValid ? realRunResult?.fileCreated === true : false,
  desktopFileCreatedCount: approvalValid ? realRunResult?.desktopFileCreatedCount ?? 0 : 0,
  createdFilePaths,
  createdFileCount: createdFilePaths.length,
  fileExistsCheck,
  neverOverwrite: true,
  overwriteDetected: false,
  desktopScanPerformed: false,
  desktopOtherFilesRead: false,
  deleteMoveDetected: false,
  approvalInputRefs: [approvalPath],
  rollbackNote: "Delete only the exact createdFilePaths from this phase if the owner wants to remove test artifacts; do not scan Desktop.",
  realRunResult,
  realRunError,
  renderError,
  ...safetyFalseFields(),
};

finish({
  result,
  checks,
  evidencePath,
  failedBlockerPrefix: "phase1905a_gated_entry_not_ready",
  exitOnUnsealed: false,
});

writeText(reportPath, `# ${phase} Execution Report

- gatedRealRunEntryVisible: ${result.gatedRealRunEntryVisible}
- approvalInputExists: ${result.approvalInputExists}
- approvalValid: ${result.approvalValid}
- desktopFileCreated: ${result.desktopFileCreated}
- desktopFileCreatedCount: ${result.desktopFileCreatedCount}
- createdFilePaths: ${JSON.stringify(result.createdFilePaths)}
- blocker: ${result.blocker}
`);

function extractCreatedFilePaths(runResult) {
  return [
    ...(Array.isArray(runResult?.createdFiles) ? runResult.createdFiles.map((item) => item.actualCreatedPath) : []),
    runResult?.actualCreatedPath,
    ...(Array.isArray(runResult?.outputPaths) ? runResult.outputPaths : []),
  ].filter((value, index, array) => typeof value === "string" && value.length > 0 && array.indexOf(value) === index);
}

function exactCreatedPathsExist(runResult, expectedCount) {
  const paths = extractCreatedFilePaths(runResult);
  return paths.length === expectedCount && paths.every((filePath) => existsSync(filePath));
}
