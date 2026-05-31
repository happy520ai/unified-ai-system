import { check, finish, importFresh, phaseEvidencePath, readText, safetyFalseFields, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1907A";
const evidencePath = phaseEvidencePath("phase1907a", "batch-file-capability-dry-run-v1-result.json");
const docsPath = "docs/phase1907a-batch-file-capability-dry-run-v1.md";
const reportPath = "docs/phase1907a-execution-report.md";

let batchDryRun = null;
let batchError = null;
try {
  const batch = await importFresh("apps/ai-gateway-service/src/owner-automation/actions/batchCreateDesktopSpreadsheets.js");
  batchDryRun = batch.dryRun({
    actionId: "batch_create_desktop_spreadsheets",
    items: [
      { filenamePrefix: "batch-a", headers: ["task"], rows: [["a"]] },
      { filenamePrefix: "batch-b", headers: ["task"], rows: [["b"]] },
      { filenamePrefix: "batch-c", headers: ["task"], rows: [["c"]] },
    ],
  });
} catch (error) {
  batchError = error instanceof Error ? error.message : String(error);
}

const docsText = readText(docsPath);
const checks = [
  check("docs_exists", docsText.includes("Phase1907A") && docsText.includes("Batch File Capability Dry-run v1")),
  check("batch_module_imports", batchError === null, batchError),
  check("batch_dry_run_ready", batchDryRun?.dryRun === true && batchDryRun?.actionId === "batch_create_desktop_spreadsheets"),
  check("max_batch_count_three", batchDryRun?.maxBatchCount === 3),
  check("hard_max_batch_count_lte_five", batchDryRun?.hardMaxBatchCount <= 5),
  check("real_run_blocked_default", batchDryRun?.realRunDefaultBlocked === true),
  check("timestamp_each_file", Array.isArray(batchDryRun?.items) && batchDryRun.items.every((item) => item.timestampAppended === true)),
  check("no_desktop_scan", batchDryRun?.desktopScanPerformed === false),
  check("no_other_desktop_files_read", batchDryRun?.desktopOtherFilesRead === false),
];

const passed = checks.every((item) => item.passed);
const result = {
  phase,
  title: "Batch File Capability Dry-run v1",
  completed: true,
  recommended_sealed: passed,
  blocker: null,
  batchDryRunReady: passed,
  batchRealRunDefaultBlocked: batchDryRun?.realRunDefaultBlocked === true,
  maxBatchCount: batchDryRun?.maxBatchCount ?? null,
  hardMaxBatchCount: batchDryRun?.hardMaxBatchCount ?? null,
  desktopFileCreated: false,
  desktopScanPerformed: false,
  desktopOtherFilesRead: false,
  bulkDeleteMoveOverwriteCapability: false,
  batchDryRun,
  batchError,
  ...safetyFalseFields(),
};

finish({ result, checks, evidencePath, failedBlockerPrefix: "phase1907a_batch_dry_run_not_ready" });
writeText(reportPath, `# ${phase} Execution Report

- batchDryRunReady: ${result.batchDryRunReady}
- batchRealRunDefaultBlocked: ${result.batchRealRunDefaultBlocked}
- maxBatchCount: ${result.maxBatchCount}
- hardMaxBatchCount: ${result.hardMaxBatchCount}
- desktopFileCreated: ${result.desktopFileCreated}
- blocker: ${result.blocker}
`);
