import { check, finish, importFresh, phaseEvidencePath, readText, safetyFalseFields, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1904A";
const evidencePath = phaseEvidencePath("phase1904a", "guarded-desktop-action-runtime-v1-result.json");
const docsPath = "docs/phase1904a-guarded-desktop-action-runtime-v1.md";
const reportPath = "docs/phase1904a-execution-report.md";

let runtimeResult = {};
let runtimeError = null;
try {
  const runtime = await importFresh("apps/ai-gateway-service/src/owner-automation/desktopActionRuntime.js");
  const action = await importFresh("apps/ai-gateway-service/src/owner-automation/actions/createDesktopSpreadsheet.js");
  const input = {
    actionId: "create_desktop_spreadsheet",
    filenamePrefix: "phase1904-runtime-test",
    fileType: "csv",
    headers: ["task", "status", "note"],
    rows: [["sample", "todo", "dry run only"]],
  };
  const dryRun = action.dryRun(input);
  const xlsxDryRun = action.dryRun({ ...input, fileType: "xlsx" });
  const blockedNoApproval = await runtime.realRunDesktopAction({ actionId: "create_desktop_spreadsheet", input, approval: null }).catch((error) => ({
    blocked: true,
    code: error.code,
    message: error.message,
  }));
  const blockedOverwriteApproval = await runtime.realRunDesktopAction({
    actionId: "create_desktop_spreadsheet",
    input,
    approval: {
      phase,
      ownerApproved: true,
      approvedActionId: "create_desktop_spreadsheet",
      allowRealDesktopFileCreation: true,
      maxRealFileCreateCount: 1,
      allowOverwrite: true,
      allowDesktopScan: false,
      allowReadOtherDesktopFiles: false,
      approvedOutputDirectory: "Desktop",
      approvedTestFilenamePrefix: "phase1904-runtime-test",
      acknowledgeThisCreatesARealDesktopFile: true,
    },
  }).catch((error) => ({ blocked: true, code: error.code, message: error.message }));
  runtimeResult = { dryRun, xlsxDryRun, blockedNoApproval, blockedOverwriteApproval };
} catch (error) {
  runtimeError = error instanceof Error ? error.message : String(error);
}

const docsText = readText(docsPath);
const dryRun = runtimeResult.dryRun ?? {};
const xlsxDryRun = runtimeResult.xlsxDryRun ?? {};
const blockedNoApproval = runtimeResult.blockedNoApproval ?? {};
const blockedOverwriteApproval = runtimeResult.blockedOverwriteApproval ?? {};
const checks = [
  check("docs_exists", docsText.includes("Phase1904A") && docsText.includes("Guarded Desktop Action Runtime v1")),
  check("runtime_imports", runtimeError === null, runtimeError),
  check("dry_run_ready", dryRun.actionId === "create_desktop_spreadsheet" && dryRun.dryRun === true),
  check("desktop_only_output", dryRun.outputDirectory === "Desktop" && dryRun.outputPathPreviewInsideDesktop === true),
  check("xlsx_preview_supported", xlsxDryRun.outputDirectory === "Desktop" && String(xlsxDryRun.fileName ?? "").endsWith(".xlsx")),
  check("timestamp_appended", dryRun.timestampAppended === true && /-\d{8}-\d{6}/u.test(dryRun.fileName ?? "")),
  check("never_overwrite", dryRun.neverOverwrite === true),
  check("no_approval_blocked", blockedNoApproval.blocked === true && blockedNoApproval.code === "owner_approval_required"),
  check("overwrite_approval_blocked", blockedOverwriteApproval.blocked === true && blockedOverwriteApproval.code === "overwrite_forbidden"),
  check("desktop_scan_false", dryRun.desktopScanPerformed === false),
  check("desktop_other_files_read_false", dryRun.desktopOtherFilesRead === false),
];

const passed = checks.every((item) => item.passed);
const result = {
  phase,
  title: "Guarded Desktop Action Runtime v1",
  completed: true,
  recommended_sealed: passed,
  blocker: null,
  guardedDesktopActionRuntimeReady: passed,
  createDesktopSpreadsheetRuntimeReady: dryRun.actionId === "create_desktop_spreadsheet",
  realRunWithoutApprovalBlocked: blockedNoApproval.blocked === true,
  overwriteBlocked: blockedOverwriteApproval.blocked === true,
  desktopScanPerformed: false,
  desktopOtherFilesRead: false,
  desktopFileCreated: false,
  runtimeError,
  runtimeResult,
  ...safetyFalseFields(),
};

finish({ result, checks, evidencePath, failedBlockerPrefix: "phase1904a_runtime_not_ready" });
writeText(reportPath, `# ${phase} Execution Report

- guardedDesktopActionRuntimeReady: ${result.guardedDesktopActionRuntimeReady}
- createDesktopSpreadsheetRuntimeReady: ${result.createDesktopSpreadsheetRuntimeReady}
- realRunWithoutApprovalBlocked: ${result.realRunWithoutApprovalBlocked}
- overwriteBlocked: ${result.overwriteBlocked}
- desktopScanPerformed: false
- desktopOtherFilesRead: false
`);
