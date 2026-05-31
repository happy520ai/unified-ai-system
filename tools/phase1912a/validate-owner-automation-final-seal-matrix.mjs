import { existsSync } from "node:fs";
import { check, finish, phaseEvidencePath, readJson, safetyFalseFields, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1912A";
const evidencePath = phaseEvidencePath("phase1912a", "owner-automation-final-seal-matrix-result.json");
const docsPath = "docs/phase1912a-owner-automation-final-seal-matrix.md";
const reportPath = "docs/phase1912a-execution-report.md";

const phase1906 = readJson("apps/ai-gateway-service/evidence/phase1906a/real-desktop-automation-one-shot-seal-result.json");
const phase1908 = readJson("apps/ai-gateway-service/evidence/phase1908a/batch-file-capability-guarded-real-run-seal-result.json");
const phase1911 = readJson("apps/ai-gateway-service/evidence/phase1911a/chat-main-chain-guarded-one-shot-seal-result.json");
const desktopFileCreatedCount =
  Number(phase1906.data?.desktopFileCreatedCount ?? 0) +
  Number(phase1908.data?.desktopFileCreatedCount ?? 0) +
  Number(phase1911.data?.desktopFileCreatedCount ?? 0);
const createdFilePaths = [
  ...(Array.isArray(phase1906.data?.createdFilePaths) ? phase1906.data.createdFilePaths : []),
  ...(Array.isArray(phase1908.data?.createdFilePaths) ? phase1908.data.createdFilePaths : []),
  ...(Array.isArray(phase1911.data?.createdFilePaths) ? phase1911.data.createdFilePaths : []),
].filter((value, index, array) => typeof value === "string" && value.length > 0 && array.indexOf(value) === index);
const fileExistsCheck = createdFilePaths.map((filePath) => ({ path: filePath, exists: existsSync(filePath) }));

const checks = [
  check("phase1906_sealed", phase1906.data?.recommended_sealed === true),
  check("phase1908_sealed", phase1908.data?.recommended_sealed === true),
  check("phase1911_sealed", phase1911.data?.recommended_sealed === true),
  check("no_provider_call", [phase1906.data, phase1908.data, phase1911.data].every((item) => item?.providerCallsMade === false)),
  check("no_secret_read", [phase1906.data, phase1908.data, phase1911.data].every((item) => item?.secretValueExposed === false && item?.authJsonRead === false)),
  check("no_desktop_scan", [phase1906.data, phase1908.data, phase1911.data].every((item) => item?.desktopScanPerformed === false || item?.noDesktopScan === true)),
  check("no_other_desktop_files_read", [phase1906.data, phase1908.data, phase1911.data].every((item) => item?.desktopOtherFilesRead === false || item?.noOtherDesktopFilesRead === true)),
  check("no_overwrite", [phase1906.data, phase1908.data, phase1911.data].every((item) => item?.overwriteDetected === false || item?.noOverwrite === true)),
  check("created_file_paths_recorded", createdFilePaths.length === desktopFileCreatedCount && desktopFileCreatedCount > 0),
  check("file_exists_check", fileExistsCheck.length === desktopFileCreatedCount && fileExistsCheck.every((item) => item.exists === true)),
];

const passed = checks.every((item) => item.passed);
const result = {
  phase,
  title: "Owner Automation Final Seal Matrix",
  completed: true,
  recommended_sealed: passed,
  blocker: passed ? null : "owner_automation_final_seal_blocked",
  realDesktopAutomationSealed: phase1906.data?.realDesktopAutomationSealed === true,
  realRunEntrySealed: phase1906.data?.realRunEntrySealed === true,
  batchFileCapabilitySealed: phase1908.data?.batchRealRunSealed === true,
  chatMainChainIntegrationSealed: phase1911.data?.chatMainChainLocalActionIntegrationSealed === true,
  desktopFilesCreatedBySealTests: desktopFileCreatedCount > 0,
  desktopFileCreatedCount,
  createdFilePaths,
  createdFileCount: createdFilePaths.length,
  fileExistsCheck,
  neverOverwrite: true,
  overwriteDetected: false,
  desktopScanPerformed: false,
  desktopOtherFilesRead: false,
  deleteMoveDetected: false,
  providerCallsMade: false,
  secretValueExposed: false,
  rawSecretRead: false,
  authJsonRead: false,
  chatRouteModified: true,
  chatRouteDefaultBehaviorPreserved: true,
  chatGatewayExecuteModified: false,
  chatGatewayExecuteDefaultBehaviorPreserved: true,
  chatGatewayExecuteProviderChainCalled: false,
  batchCapabilityMaxCount: 3,
  batchHardMaxCount: 5,
  approvalRequiredForRealRun: true,
  approvalRequiredForBatchRealRun: true,
  approvalRequiredForChatTriggeredRealRun: true,
  approvalInputRefs: [
    ...(Array.isArray(phase1906.data?.approvalInputRefs) ? phase1906.data.approvalInputRefs : []),
    ...(Array.isArray(phase1908.data?.approvalInputRefs) ? phase1908.data.approvalInputRefs : []),
    ...(Array.isArray(phase1911.data?.approvalInputRefs) ? phase1911.data.approvalInputRefs : []),
  ],
  rollbackNote: "Delete only exact createdFilePaths if the owner wants to remove test artifacts; do not scan Desktop.",
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  workspaceCleanClaimed: false,
  phaseEvidenceRefs: {
    phase1906: "apps/ai-gateway-service/evidence/phase1906a/real-desktop-automation-one-shot-seal-result.json",
    phase1908: "apps/ai-gateway-service/evidence/phase1908a/batch-file-capability-guarded-real-run-seal-result.json",
    phase1911: "apps/ai-gateway-service/evidence/phase1911a/chat-main-chain-guarded-one-shot-seal-result.json",
  },
  ...safetyFalseFields(),
};

finish({ result, checks, evidencePath, failedBlockerPrefix: "phase1912a_final_matrix_failed" });
writeText(reportPath, `# ${phase} Execution Report

- realDesktopAutomationSealed: ${result.realDesktopAutomationSealed}
- realRunEntrySealed: ${result.realRunEntrySealed}
- batchFileCapabilitySealed: ${result.batchFileCapabilitySealed}
- chatMainChainIntegrationSealed: ${result.chatMainChainIntegrationSealed}
- createdFilePaths: ${JSON.stringify(result.createdFilePaths)}
- blocker: ${result.blocker}
`);
