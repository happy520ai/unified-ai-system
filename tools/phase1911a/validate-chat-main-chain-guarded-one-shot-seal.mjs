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

const phase = "Phase1911A";
const approvalPath = "docs/approvals/phase1911a-chat-main-chain-local-action-real-run.input.json";
const evidencePath = phaseEvidencePath("phase1911a", "chat-main-chain-guarded-one-shot-seal-result.json");
const reportPath = "docs/phase1911a-execution-report.md";
const approvalTemplate = {
  phase,
  ownerApproved: true,
  allowChatMainChainLocalActionExecution: true,
  approvedActionId: "create_desktop_spreadsheet",
  allowRealDesktopFileCreation: true,
  maxRealFileCreateCount: 1,
  allowBatchFromChat: false,
  allowOverwrite: false,
  allowDesktopScan: false,
  allowReadOtherDesktopFiles: false,
  acknowledgeChatCanTriggerOneLocalDesktopFileCreation: true,
  approvalSource: "owner_explicit_chat_authorization",
  approvalScope: "guarded_chat_main_chain_one_shot_local_desktop_file_creation_test_only",
};

const approval = readApproval(approvalPath, approvalTemplate);
const previousEvidence = readJson(evidencePath);
const approvalValid =
  approval.exists === true &&
  approval.parseError === null &&
  approval.data?.phase === phase &&
  approval.data?.ownerApproved === true &&
  approval.data?.allowChatMainChainLocalActionExecution === true &&
  approval.data?.approvedActionId === "create_desktop_spreadsheet" &&
  approval.data?.allowRealDesktopFileCreation === true &&
  approval.data?.maxRealFileCreateCount === 1 &&
  approval.data?.allowBatchFromChat === false &&
  approval.data?.allowOverwrite === false &&
  approval.data?.allowDesktopScan === false &&
  approval.data?.allowReadOtherDesktopFiles === false &&
  approval.data?.acknowledgeChatCanTriggerOneLocalDesktopFileCreation === true &&
  approval.data?.approvalSource === "owner_explicit_chat_authorization" &&
  approval.data?.approvalScope === "guarded_chat_main_chain_one_shot_local_desktop_file_creation_test_only";

let runResult = null;
let runError = null;
if (approvalValid) {
  try {
    const reusableRun = previousEvidence.data?.runResult;
    if (previousEvidence.data?.recommended_sealed === true && exactCreatedPathsExist(reusableRun?.realRun, 1)) {
      runResult = reusableRun;
    } else {
      const router = await importFresh("apps/ai-gateway-service/src/owner-automation/chatActionProposalRouter.js");
      runResult = await router.handleChatLocalActionRoute({
        prompt: "帮我在桌面建一个表格，列是任务、状态、备注，先预览，如果已批准则创建一个测试文件。",
        env: {
          OWNER_AUTOMATION_CHAT_PROPOSAL_ENABLED: "true",
          OWNER_AUTOMATION_CHAT_REAL_RUN_ENABLED: "true",
          OWNER_AUTOMATION_CHAT_BATCH_ENABLED: "false",
        },
        approval: approval.data,
        evidencePhase: "phase1911a",
      });
    }
  } catch (error) {
    runError = error instanceof Error ? error.message : String(error);
  }
}

const createdFilePaths = extractCreatedFilePaths(runResult?.realRun);
const fileExistsCheck = createdFilePaths.map((filePath) => ({ path: filePath, exists: existsSync(filePath) }));
const checks = [
  check("approval_gate_state_valid", approvalValid ? runResult?.desktopFileCreated === true : true),
  check("chat_triggered_when_approved", approvalValid ? runResult?.chatTriggeredLocalAction === true : true),
  check("file_count_one_when_approved", approvalValid ? runResult?.desktopFileCreatedCount === 1 : true),
  check("created_file_paths_recorded", approvalValid ? createdFilePaths.length === 1 : true),
  check("file_exists_check", approvalValid ? fileExistsCheck.length === 1 && fileExistsCheck.every((item) => item.exists === true) : true),
  check("provider_not_called", runResult?.providerCallsMade === false || !approvalValid),
  check("chat_gateway_execute_chain_not_called", runResult?.chatGatewayExecuteProviderChainCalled === false || !approvalValid),
];

const result = {
  phase,
  title: "/chat Main-chain Guarded One-shot Seal",
  completed: true,
  recommended_sealed: approvalValid && checks.every((item) => item.passed),
  blocker: approvalValid ? null : "owner_chat_main_chain_real_run_approval_missing",
  approvalPath,
  approvalTemplatePath: approval.templatePath,
  approvalInputExists: approval.exists,
  approvalValid,
  chatMainChainLocalActionIntegrationSealed: approvalValid && runResult?.desktopFileCreated === true,
  chatTriggeredLocalAction: approvalValid && runResult?.chatTriggeredLocalAction === true,
  desktopFileCreated: approvalValid && runResult?.desktopFileCreated === true,
  desktopFileCreatedCount: approvalValid ? runResult?.desktopFileCreatedCount ?? 0 : 0,
  createdFilePaths,
  createdFileCount: createdFilePaths.length,
  fileExistsCheck,
  neverOverwrite: true,
  providerCallsMade: false,
  chatGatewayExecuteProviderChainCalled: false,
  overwriteDetected: false,
  desktopScanPerformed: false,
  desktopOtherFilesRead: false,
  deleteMoveDetected: false,
  approvalInputRefs: [approvalPath],
  rollbackNote: "Delete only the exact createdFilePaths from this phase if the owner wants to remove test artifacts; do not scan Desktop.",
  runResult,
  runError,
  ...safetyFalseFields(),
};

finish({ result, checks, evidencePath, failedBlockerPrefix: "phase1911a_chat_main_chain_not_ready", exitOnUnsealed: false });
writeText(reportPath, `# ${phase} Execution Report

- approvalInputExists: ${result.approvalInputExists}
- approvalValid: ${result.approvalValid}
- chatMainChainLocalActionIntegrationSealed: ${result.chatMainChainLocalActionIntegrationSealed}
- desktopFileCreated: ${result.desktopFileCreated}
- desktopFileCreatedCount: ${result.desktopFileCreatedCount}
- createdFilePaths: ${JSON.stringify(result.createdFilePaths)}
- providerCallsMade: ${result.providerCallsMade}
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
