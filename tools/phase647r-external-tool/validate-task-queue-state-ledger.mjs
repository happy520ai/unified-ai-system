import {
  check,
  exists,
  finalize,
  readJson,
  readText,
  safetyBoundary,
} from "../phase641r-external-tool/external-tool-common.mjs";

const evidencePath =
  "apps/ai-gateway-service/evidence/phase647r-external-tool/task-queue-state-ledger-result.json";
const schema = readJson("docs/phase647r-external-tool-task-state-schema.json", {});
const queue = readJson("docs/phase647r-external-tool-task-queue.example.json", {});
const docsText = readText("docs/phase647r-external-tool-task-queue-state-ledger.md");

const allowedStatuses = ["pending", "running", "completed", "blocked", "skipped", "needs_approval", "failed"];
const tasks = Array.isArray(queue.data?.tasks) ? queue.data.tasks : [];
const everyTaskHasStatus = tasks.length > 0 && tasks.every((task) => allowedStatuses.includes(task.status));
const everyTaskHasRequiredFields = tasks.length > 0 && tasks.every((task) =>
  [
    "taskId",
    "title",
    "riskTier",
    "status",
    "allowedFiles",
    "forbiddenFiles",
    "validationCommands",
    "evidencePath",
    "rollbackNote",
  ].every((field) => Object.prototype.hasOwnProperty.call(task, field)));
const allTaskBoundariesFalse = tasks.length > 0 && tasks.every((task) =>
  task.providerCallsAllowed === false &&
  task.secretAccessAllowed === false &&
  task.chatModificationAllowed === false &&
  task.chatGatewayExecuteModificationAllowed === false &&
  task.deployAllowed === false &&
  task.pushAllowed === false &&
  task.commitAllowed === false);

const result = {
  phase: "Phase647R-ExternalTool",
  name: "External Tool Task Queue State Ledger",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  taskQueueLedgerGenerated: exists("docs/phase647r-external-tool-task-queue-state-ledger.md"),
  taskStateSchemaGenerated: schema.exists === true && !schema.parseErrorReason,
  taskQueueExampleGenerated: queue.exists === true && !queue.parseErrorReason,
  states: allowedStatuses,
  everyTaskHasStatus,
  everyTaskHasRequiredFields,
  highRiskAutoExecute: queue.data?.highRiskAutoExecute === true,
  highRiskAutoExecuteFalse: queue.data?.highRiskAutoExecute === false,
  providerCallsAllowed: tasks.some((task) => task.providerCallsAllowed === true),
  secretAccessAllowed: tasks.some((task) => task.secretAccessAllowed === true),
  chatModificationAllowed: tasks.some((task) => task.chatModificationAllowed === true),
  chatGatewayExecuteModificationAllowed: tasks.some((task) => task.chatGatewayExecuteModificationAllowed === true),
  deployAllowed: tasks.some((task) => task.deployAllowed === true),
  pushAllowed: tasks.some((task) => task.pushAllowed === true),
  commitAllowed: tasks.some((task) => task.commitAllowed === true),
  allTaskBoundariesFalse,
  docsMentionStates: allowedStatuses.every((status) => docsText.includes(status)),
  ...safetyBoundary(),
  docs: [
    "docs/phase647r-external-tool-task-queue-state-ledger.md",
    "docs/phase647r-external-tool-task-state-schema.json",
    "docs/phase647r-external-tool-task-queue.example.json",
    "docs/phase647r-external-tool-execution-report.md",
  ],
  evidencePath,
};

const checks = [
  check("task_queue_ledger_generated", result.taskQueueLedgerGenerated),
  check("task_state_schema_generated", result.taskStateSchemaGenerated),
  check("task_queue_example_generated", result.taskQueueExampleGenerated),
  check("docs_mention_states", result.docsMentionStates),
  check("every_task_has_status", result.everyTaskHasStatus),
  check("every_task_has_required_fields", result.everyTaskHasRequiredFields),
  check("high_risk_auto_execute_false", result.highRiskAutoExecute === false && result.highRiskAutoExecuteFalse),
  check("provider_calls_allowed_false", result.providerCallsAllowed === false),
  check("secret_access_allowed_false", result.secretAccessAllowed === false),
  check("chat_modification_allowed_false", result.chatModificationAllowed === false),
  check("chat_gateway_execute_modification_allowed_false", result.chatGatewayExecuteModificationAllowed === false),
  check("deploy_allowed_false", result.deployAllowed === false),
  check("push_allowed_false", result.pushAllowed === false),
  check("commit_allowed_false", result.commitAllowed === false),
  check("all_task_boundaries_false", result.allTaskBoundariesFalse),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

finalize(result, checks, evidencePath, "phase647r_external_tool_task_queue_ledger_failed");
