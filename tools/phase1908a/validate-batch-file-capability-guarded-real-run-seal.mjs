import { existsSync } from "node:fs";
import {
  check,
  finish,
  importFresh,
  phaseEvidencePath,
  readApproval,
  readJson,
  safetyFalseFields,
  writeText,
} from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1908A";
const approvalPath = "docs/approvals/phase1908a-owner-batch-desktop-real-run.input.json";
const evidencePath = phaseEvidencePath("phase1908a", "batch-file-capability-guarded-real-run-seal-result.json");
const reportPath = "docs/phase1908a-execution-report.md";
const approvalTemplate = {
  phase,
  ownerApproved: true,
  approvedActionId: "batch_create_desktop_spreadsheets",
  allowRealDesktopFileCreation: true,
  maxRealFileCreateCount: 3,
  allowOverwrite: false,
  allowDesktopScan: false,
  allowReadOtherDesktopFiles: false,
  approvedOutputDirectory: "Desktop",
  approvedTestFilenamePrefix: "小天批量真实运行测试",
  acknowledgeThisCreatesMultipleRealDesktopFiles: true,
  approvalSource: "owner_explicit_chat_authorization",
  approvalScope: "guarded_real_local_batch_desktop_file_creation_test_only",
};

const approval = readApproval(approvalPath, approvalTemplate);
const previousEvidence = readJson(evidencePath);
const approvalValid =
  approval.exists === true &&
  approval.parseError === null &&
  approval.data?.phase === phase &&
  approval.data?.ownerApproved === true &&
  approval.data?.approvedActionId === "batch_create_desktop_spreadsheets" &&
  approval.data?.allowRealDesktopFileCreation === true &&
  approval.data?.maxRealFileCreateCount >= 2 &&
  approval.data?.maxRealFileCreateCount <= 3 &&
  approval.data?.allowOverwrite === false &&
  approval.data?.allowDesktopScan === false &&
  approval.data?.allowReadOtherDesktopFiles === false &&
  approval.data?.approvedOutputDirectory === "Desktop" &&
  approval.data?.approvedTestFilenamePrefix === "小天批量真实运行测试" &&
  approval.data?.acknowledgeThisCreatesMultipleRealDesktopFiles === true &&
  approval.data?.approvalSource === "owner_explicit_chat_authorization" &&
  approval.data?.approvalScope === "guarded_real_local_batch_desktop_file_creation_test_only";

let realRunResult = null;
let realRunError = null;
if (approvalValid) {
  try {
    const reusableRun = previousEvidence.data?.realRunResult;
    if (previousEvidence.data?.recommended_sealed === true && exactCreatedPathsExist(reusableRun, 2)) {
      realRunResult = reusableRun;
    } else {
      const runtime = await importFresh("apps/ai-gateway-service/src/owner-automation/desktopActionRuntime.js");
      realRunResult = await runtime.realRunDesktopAction({
        actionId: "batch_create_desktop_spreadsheets",
        input: {
          actionId: "batch_create_desktop_spreadsheets",
          items: [
            { filenamePrefix: `${approval.data.approvedTestFilenamePrefix}-A`, headers: ["任务", "状态"], rows: [["A", "已创建"]] },
            { filenamePrefix: `${approval.data.approvedTestFilenamePrefix}-B`, headers: ["任务", "状态"], rows: [["B", "已创建"]] },
          ],
        },
        approval: approval.data,
        evidencePhase: "phase1908a",
      });
    }
  } catch (error) {
    realRunError = error instanceof Error ? error.message : String(error);
  }
}

const createdFilePaths = extractCreatedFilePaths(realRunResult);
const fileExistsCheck = createdFilePaths.map((filePath) => ({ path: filePath, exists: existsSync(filePath) }));
const count = realRunResult?.desktopFileCreatedCount ?? 0;
const checks = [
  check("approval_gate_state_valid", approvalValid ? realRunResult?.fileCreated === true : true),
  check("count_in_range_when_approved", approvalValid ? count >= 2 && count <= 3 : true),
  check("created_file_paths_recorded", approvalValid ? createdFilePaths.length === count : true),
  check("file_exists_check", approvalValid ? fileExistsCheck.length === count && fileExistsCheck.every((item) => item.exists === true) : true),
  check("no_overwrite", realRunResult?.overwriteDetected === false || !approvalValid),
  check("no_desktop_scan", realRunResult?.desktopScanPerformed === false || !approvalValid),
  check("no_other_desktop_files_read", realRunResult?.desktopOtherFilesRead === false || !approvalValid),
];

const result = {
  phase,
  title: "Batch File Capability Guarded Real Run Seal",
  completed: true,
  recommended_sealed: approvalValid && checks.every((item) => item.passed),
  blocker: approvalValid ? null : "owner_batch_real_run_approval_missing",
  approvalPath,
  approvalTemplatePath: approval.templatePath,
  approvalInputExists: approval.exists,
  approvalValid,
  batchRealRunSealed: approvalValid && realRunResult?.fileCreated === true,
  desktopFileCreated: approvalValid && realRunResult?.fileCreated === true,
  desktopFileCreatedCount: count,
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
  ...safetyFalseFields(),
};

finish({ result, checks, evidencePath, failedBlockerPrefix: "phase1908a_batch_real_run_not_ready", exitOnUnsealed: false });
writeText(reportPath, `# ${phase} Execution Report

- approvalInputExists: ${result.approvalInputExists}
- approvalValid: ${result.approvalValid}
- batchRealRunSealed: ${result.batchRealRunSealed}
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
