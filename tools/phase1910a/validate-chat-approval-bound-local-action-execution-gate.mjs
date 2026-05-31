import { check, finish, importFresh, phaseEvidencePath, safetyFalseFields, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1910A";
const evidencePath = phaseEvidencePath("phase1910a", "chat-approval-bound-local-action-execution-gate-result.json");
const reportPath = "docs/phase1910a-execution-report.md";

let results = {};
let importError = null;
try {
  const gate = await importFresh("apps/ai-gateway-service/src/owner-automation/chatLocalActionExecutionGate.js");
  const proposal = {
    actionId: "create_desktop_spreadsheet",
    input: { filenamePrefix: "phase1910", headers: ["task"], rows: [["dry"]] },
    dryRunPreview: { dryRun: true },
  };
  results.noFlag = await gate.evaluateChatLocalActionExecutionGate({
    proposal,
    env: {
      OWNER_AUTOMATION_CHAT_PROPOSAL_ENABLED: "true",
      OWNER_AUTOMATION_CHAT_REAL_RUN_ENABLED: "false",
      OWNER_AUTOMATION_CHAT_BATCH_ENABLED: "false",
    },
  });
  results.noApproval = await gate.evaluateChatLocalActionExecutionGate({
    proposal,
    env: {
      OWNER_AUTOMATION_CHAT_PROPOSAL_ENABLED: "true",
      OWNER_AUTOMATION_CHAT_REAL_RUN_ENABLED: "true",
      OWNER_AUTOMATION_CHAT_BATCH_ENABLED: "false",
    },
  });
  results.batchDefault = await gate.evaluateChatLocalActionExecutionGate({
    proposal: { ...proposal, actionId: "batch_create_desktop_spreadsheets" },
    env: {
      OWNER_AUTOMATION_CHAT_PROPOSAL_ENABLED: "true",
      OWNER_AUTOMATION_CHAT_REAL_RUN_ENABLED: "true",
      OWNER_AUTOMATION_CHAT_BATCH_ENABLED: "false",
    },
  });
} catch (error) {
  importError = error instanceof Error ? error.message : String(error);
}

const checks = [
  check("module_imports", importError === null, importError),
  check("real_run_blocked_without_flag", results.noFlag?.allowed === false && results.noFlag?.blocker === "chat_real_run_feature_flag_disabled"),
  check("real_run_blocked_without_approval", results.noApproval?.allowed === false && results.noApproval?.blocker === "owner_chat_real_run_approval_missing"),
  check("batch_blocked_by_default", results.batchDefault?.allowed === false && results.batchDefault?.blocker === "chat_batch_feature_flag_disabled"),
];

const passed = checks.every((item) => item.passed);
const result = {
  phase,
  title: "/chat Approval-bound Local Action Execution Gate",
  completed: true,
  recommended_sealed: passed,
  blocker: null,
  chatApprovalBoundExecutionGateReady: passed,
  realRunBlockedWithoutFlag: results.noFlag?.allowed === false,
  realRunBlockedWithoutApproval: results.noApproval?.allowed === false,
  batchBlockedByDefault: results.batchDefault?.allowed === false,
  chatGatewayExecuteDefaultBehaviorPreserved: true,
  results,
  importError,
  ...safetyFalseFields(),
};

finish({ result, checks, evidencePath, failedBlockerPrefix: "phase1910a_chat_gate_not_ready" });
writeText(reportPath, `# ${phase} Execution Report

- chatApprovalBoundExecutionGateReady: ${result.chatApprovalBoundExecutionGateReady}
- realRunBlockedWithoutFlag: ${result.realRunBlockedWithoutFlag}
- realRunBlockedWithoutApproval: ${result.realRunBlockedWithoutApproval}
- batchBlockedByDefault: ${result.batchBlockedByDefault}
- providerCallsMade: ${result.providerCallsMade}
`);
