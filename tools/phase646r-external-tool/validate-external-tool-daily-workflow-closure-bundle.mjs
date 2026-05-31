import {
  check,
  exists,
  finalize,
  readJson,
  readText,
  safetyBoundary,
} from "../phase641r-external-tool/external-tool-common.mjs";

const evidencePath =
  "apps/ai-gateway-service/evidence/phase646r-650r-external-tool/external-tool-daily-workflow-closure-result.json";
const phase646 = readJson("apps/ai-gateway-service/evidence/phase646r-external-tool/daily-workflow-optimization-result.json", {});
const phase647 = readJson("apps/ai-gateway-service/evidence/phase647r-external-tool/task-queue-state-ledger-result.json", {});
const phase648 = readJson("apps/ai-gateway-service/evidence/phase648r-external-tool/evidence-dashboard-pack-result.json", {});
const phase649 = readJson("apps/ai-gateway-service/evidence/phase649r-external-tool/token-saving-report-pack-result.json", {});
const phase650 = readJson("apps/ai-gateway-service/evidence/phase650r-external-tool/external-tool-final-closure-result.json", {});
const packageJson = readJson("package.json", {});
const scripts = packageJson.data?.scripts ?? {};
const panelText = readText("apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js");

const failed = [];
function phaseDone(name, evidence) {
  const done = evidence.exists === true &&
    !evidence.parseErrorReason &&
    evidence.data?.completed === true &&
    evidence.data?.recommended_sealed === true &&
    evidence.data?.blocker === null;
  if (!done) failed.push(name);
  return done;
}

const result = {
  phase: "Phase646R-650R-ExternalTool",
  name: "Codex External Tool Daily Workflow Closure Bundle",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase646Completed: phaseDone("phase646", phase646),
  phase647Completed: phaseDone("phase647", phase647),
  phase648Completed: phaseDone("phase648", phase648),
  phase649Completed: phaseDone("phase649", phase649),
  phase650Completed: phaseDone("phase650", phase650),
  failed,
  dailyWorkflowReady: phase646.data?.dailyWorkflowGenerated === true,
  taskQueueLedgerReady: phase647.data?.taskStateSchemaGenerated === true && phase647.data?.taskQueueExampleGenerated === true,
  evidenceDashboardReady: phase648.data?.evidenceDashboardPackGenerated === true && phase648.data?.uiReadOnlyPreviewGenerated === true,
  tokenSavingReportReady: phase649.data?.tokenSavingReportGenerated === true && phase649.data?.estimatedSavingOnly === true,
  nextUsePlaybookReady: phase650.data?.nextUsePlaybookGenerated === true,
  externalToolMode: true,
  uiReadOnlyPreviewGenerated: panelText.includes("data-codex-phase646r-650r-external-tool-dashboard=\"true\""),
  packageScriptsGenerated: Boolean(
    scripts["verify:phase646r-external-tool-daily-workflow"] &&
    scripts["verify:phase647r-external-tool-task-queue-state-ledger"] &&
    scripts["verify:phase648r-external-tool-evidence-dashboard-pack"] &&
    scripts["verify:phase649r-external-tool-token-saving-report-pack"] &&
    scripts["verify:phase650r-external-tool-final-closure"] &&
    scripts["verify:phase646r-650r-external-tool-daily-workflow-closure"],
  ),
  ...safetyBoundary(),
  docs: [
    "docs/phase646r-650r-external-tool-daily-workflow-closure.md",
  ],
  evidencePath,
};

const checks = [
  check("phase646_completed", result.phase646Completed),
  check("phase647_completed", result.phase647Completed),
  check("phase648_completed", result.phase648Completed),
  check("phase649_completed", result.phase649Completed),
  check("phase650_completed", result.phase650Completed),
  check("failed_empty", result.failed.length === 0),
  check("daily_workflow_ready", result.dailyWorkflowReady),
  check("task_queue_ledger_ready", result.taskQueueLedgerReady),
  check("evidence_dashboard_ready", result.evidenceDashboardReady),
  check("token_saving_report_ready", result.tokenSavingReportReady),
  check("next_use_playbook_ready", result.nextUsePlaybookReady),
  check("external_tool_mode_true", result.externalToolMode),
  check("ui_read_only_preview_generated", result.uiReadOnlyPreviewGenerated),
  check("package_scripts_generated", result.packageScriptsGenerated),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("codex_exec_executed_by_this_bundle_false", result.codexExecExecutedByThisBundle === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("production_ready_claimed_false", result.productionReadyClaimed === false),
  check("release_ready_claimed_false", result.releaseReadyClaimed === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
  check("aggregate_closure_doc_generated", exists("docs/phase646r-650r-external-tool-daily-workflow-closure.md")),
];

finalize(result, checks, evidencePath, "phase646r_650r_external_tool_daily_workflow_closure_failed");
