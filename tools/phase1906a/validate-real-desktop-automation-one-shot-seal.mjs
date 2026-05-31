import { existsSync } from "node:fs";
import { check, finish, phaseEvidencePath, readJson, readText, safetyFalseFields, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1906A";
const evidencePath = phaseEvidencePath("phase1906a", "real-desktop-automation-one-shot-seal-result.json");
const docsPath = "docs/phase1906a-real-desktop-automation-one-shot-seal.md";
const reportPath = "docs/phase1906a-execution-report.md";
const phase1904 = readJson("apps/ai-gateway-service/evidence/phase1904a/guarded-desktop-action-runtime-v1-result.json");
const phase1905 = readJson("apps/ai-gateway-service/evidence/phase1905a/command-palette-gated-real-run-entry-result.json");
const docsText = readText(docsPath);

const oneShotSealed =
  phase1904.data?.recommended_sealed === true &&
  phase1905.data?.recommended_sealed === true &&
  phase1905.data?.desktopFileCreated === true &&
  phase1905.data?.desktopFileCreatedCount === 1;
const createdFilePaths = Array.isArray(phase1905.data?.createdFilePaths) ? phase1905.data.createdFilePaths : [];
const fileExistsCheck = createdFilePaths.map((filePath) => ({ path: filePath, exists: existsSync(filePath) }));

const checks = [
  check("docs_exists", docsText.includes("Phase1906A") && docsText.includes("Real Desktop Automation One-shot Seal")),
  check("phase1904_sealed", phase1904.data?.recommended_sealed === true),
  check("phase1905_sealed", phase1905.data?.recommended_sealed === true),
  check("desktop_file_created", phase1905.data?.desktopFileCreated === true),
  check("desktop_file_created_count_one", phase1905.data?.desktopFileCreatedCount === 1),
  check("created_file_paths_recorded", createdFilePaths.length === 1),
  check("file_exists_check", fileExistsCheck.length === 1 && fileExistsCheck.every((item) => item.exists === true)),
  check("no_overwrite", phase1905.data?.overwriteDetected === false),
  check("no_desktop_scan", phase1905.data?.desktopScanPerformed === false),
  check("no_other_desktop_files_read", phase1905.data?.desktopOtherFilesRead === false),
];

const result = {
  phase,
  title: "Real Desktop Automation One-shot Seal",
  completed: true,
  recommended_sealed: oneShotSealed,
  blocker: oneShotSealed ? null : "real_desktop_one_shot_not_sealed",
  realDesktopAutomationSealed: oneShotSealed,
  realRunEntrySealed: phase1905.data?.recommended_sealed === true,
  desktopFileCreated: phase1905.data?.desktopFileCreated === true,
  desktopFileCreatedCount: phase1905.data?.desktopFileCreatedCount ?? 0,
  createdFilePaths,
  createdFileCount: createdFilePaths.length,
  fileExistsCheck,
  neverOverwrite: true,
  evidenceVisibleInOwnerOs: phase1905.data?.gatedRealRunEntryVisible === true,
  noOverwrite: phase1905.data?.overwriteDetected === false,
  noDesktopScan: phase1905.data?.desktopScanPerformed === false,
  noOtherDesktopFilesRead: phase1905.data?.desktopOtherFilesRead === false,
  deleteMoveDetected: false,
  approvalInputRefs: phase1905.data?.approvalInputRefs ?? [],
  rollbackNote: "Delete only the exact createdFilePaths from Phase1905A if the owner wants to remove test artifacts; do not scan Desktop.",
  rollbackDocReady: docsText.includes("Rollback"),
  screenshotsCaptured: false,
  screenshotPath: null,
  ...safetyFalseFields(),
};

finish({ result, checks, evidencePath, failedBlockerPrefix: "phase1906a_one_shot_not_ready", exitOnUnsealed: false });
writeText(reportPath, `# ${phase} Execution Report

- realDesktopAutomationSealed: ${result.realDesktopAutomationSealed}
- realRunEntrySealed: ${result.realRunEntrySealed}
- desktopFileCreated: ${result.desktopFileCreated}
- createdFilePaths: ${JSON.stringify(result.createdFilePaths)}
- blocker: ${result.blocker}
`);
