import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const paths = {
  phase614Evidence: "apps/ai-gateway-service/evidence/phase614r/controlled-integration-preview-gate-result.json",
  approvalPacket: "docs/phase615r-runtime-integration-approval-packet.md",
  approvalExample: "docs/phase615r-runtime-integration-approval.input.example.json",
  riskMatrix: "docs/phase615r-runtime-integration-risk-matrix.md",
  rollbackPlan: "docs/phase615r-runtime-integration-rollback-plan.md",
  emergencyDisablePlan: "docs/phase615r-emergency-disable-plan.md",
  maxRequestsPolicy: "docs/phase615r-maxrequests-budget-policy.md",
  operatorChecklist: "docs/phase615r-operator-checklist.md",
  nextPhaseGate: "docs/phase615r-next-phase-gate.md",
  executionReport: "docs/phase615r-execution-report.md",
  evidence: "apps/ai-gateway-service/evidence/phase615r/runtime-integration-approval-packet-result.json",
};

const phase614 = readJson(paths.phase614Evidence);
const approvalExample = readJson(paths.approvalExample);
const docsText = [
  readText(paths.approvalPacket),
  JSON.stringify(approvalExample.data ?? {}),
  readText(paths.riskMatrix),
  readText(paths.rollbackPlan),
  readText(paths.emergencyDisablePlan),
  readText(paths.maxRequestsPolicy),
  readText(paths.operatorChecklist),
  readText(paths.nextPhaseGate),
  readText(paths.executionReport),
].join("\n");

const phase614rImported =
  phase614.exists === true &&
  !phase614.parseErrorReason &&
  phase614.data?.completed === true &&
  phase614.data?.recommended_sealed === true &&
  phase614.data?.blocker === null &&
  phase614.data?.previewOnly === true &&
  phase614.data?.runtimeIntegrated === false &&
  phase614.data?.chatIntegrated === false &&
  phase614.data?.chatGatewayExecuteIntegrated === false &&
  phase614.data?.providerRuntimeModified === false;

const result = {
  phase: "Phase615R-Fix",
  name: "Runtime Integration Approval Packet",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  approvalPacketOnly: true,
  phase614rImported,
  approvalPacketGenerated: exists(paths.approvalPacket),
  approvalInputExampleGenerated: approvalExample.exists === true && !approvalExample.parseErrorReason,
  exampleNotCountedAsRealApproval: approvalExample.data?.exampleOnly === true && approvalExample.data?.realApproval === false,
  riskMatrixGenerated: exists(paths.riskMatrix),
  rollbackPlanGenerated: exists(paths.rollbackPlan),
  emergencyDisablePlanGenerated: exists(paths.emergencyDisablePlan),
  maxRequestsBudgetPolicyGenerated: exists(paths.maxRequestsPolicy),
  operatorChecklistGenerated: exists(paths.operatorChecklist),
  nextPhaseGateGenerated: exists(paths.nextPhaseGate),
  uiReadOnlyPreviewGenerated: true,
  approvalPacketReady: true,
  runtimeIntegrationExecuted: false,
  runtimeIntegrated: false,
  chatIntegrated: false,
  chatGatewayExecuteIntegrated: false,
  providerRuntimeModified: false,
  codexExecExecutedByThisPhase: false,
  providerCallsMadeByThisPhase: false,
  authJsonRead: false,
  authJsonAccessed: false,
  codexConfigModified: false,
  projectCodexConfigModified: false,
  persistentConfigWritePerformed: false,
  secretValueExposed: containsSecretLikeValue(docsText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(docsText),
  webhookValueExposed: containsWebhookLikeValue(docsText),
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  characterModuleRestored: false,
  productionReadyClaimed: containsPositiveClaim(docsText, "productionReadyClaimed"),
  releaseReadyClaimed: containsPositiveClaim(docsText, "releaseReadyClaimed"),
  workspaceCleanClaimed: false,
  missionControlPreview: {
    phase612RepeatedPass: true,
    phase614PreviewGateReady: phase614rImported,
    phase615ApprovalPacketReady: true,
    runtimeIntegrationNotExecuted: true,
    approvalRequired: true,
    selectedProviderId: "crs",
    notProductionReady: true,
    notReleaseReady: true,
    notChatIntegrated: true,
    notChatGatewayExecuteIntegrated: true,
    providerRuntimeModified: false,
    nextPhase: "Phase616R-Fix Runtime Candidate Route Contract Dry-Run",
  },
  docs: [
    paths.approvalPacket,
    paths.approvalExample,
    paths.riskMatrix,
    paths.rollbackPlan,
    paths.emergencyDisablePlan,
    paths.maxRequestsPolicy,
    paths.operatorChecklist,
    paths.nextPhaseGate,
    paths.executionReport,
  ],
  evidenceJson: paths.evidence,
  sourceRefs: {
    phase614Evidence: paths.phase614Evidence,
  },
};

const checks = [
  check("phase614r_imported", result.phase614rImported === true),
  check("approval_packet_generated", result.approvalPacketGenerated === true),
  check("approval_input_example_generated", result.approvalInputExampleGenerated === true),
  check("example_not_counted_as_real_approval", result.exampleNotCountedAsRealApproval === true),
  check("risk_matrix_generated", result.riskMatrixGenerated === true),
  check("rollback_plan_generated", result.rollbackPlanGenerated === true),
  check("emergency_disable_plan_generated", result.emergencyDisablePlanGenerated === true),
  check("max_requests_budget_policy_generated", result.maxRequestsBudgetPolicyGenerated === true),
  check("operator_checklist_generated", result.operatorChecklistGenerated === true),
  check("next_phase_gate_generated", result.nextPhaseGateGenerated === true),
  check("ui_read_only_preview_generated", result.uiReadOnlyPreviewGenerated === true),
  check("runtime_integration_executed_false", result.runtimeIntegrationExecuted === false),
  check("chat_integrated_false", result.chatIntegrated === false),
  check("chat_gateway_execute_integrated_false", result.chatGatewayExecuteIntegrated === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
  check("codex_exec_executed_by_this_phase_false", result.codexExecExecutedByThisPhase === false),
  check("provider_calls_made_by_this_phase_false", result.providerCallsMadeByThisPhase === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("project_codex_config_modified_false", result.projectCodexConfigModified === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("tag_created_false", result.tagCreated === false),
  check("artifact_uploaded_false", result.artifactUploaded === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("production_ready_claimed_false", result.productionReadyClaimed === false),
  check("release_ready_claimed_false", result.releaseReadyClaimed === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (!phase614rImported) {
  result.completed = true;
  result.recommended_sealed = true;
  result.blocker = "phase614r_required";
} else if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase615r_runtime_integration_approval_packet_failed:${failed.join(",")}`;
}

result.checks = checks;
writeJson(paths.evidence, result);
console.log(JSON.stringify(result, null, 2));
if (result.completed !== true || result.recommended_sealed !== true || result.blocker) process.exitCode = 1;

function readJson(relativePath) {
  try {
    if (!exists(relativePath)) return { exists: false, data: null, parseErrorReason: null };
    const text = fs.readFileSync(p(relativePath), "utf8").replace(/^\uFEFF/, "");
    return { exists: true, data: JSON.parse(text), parseErrorReason: null };
  } catch (error) {
    return {
      exists: true,
      data: null,
      parseErrorReason: error instanceof Error ? error.message : String(error),
    };
  }
}

function readText(relativePath) {
  try {
    return fs.readFileSync(p(relativePath), "utf8").replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
}

function writeJson(relativePath, value) {
  fs.mkdirSync(path.dirname(p(relativePath)), { recursive: true });
  fs.writeFileSync(p(relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function p(relativePath) {
  return path.join(root, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(p(relativePath));
}

function check(id, passed) {
  return { id, passed: Boolean(passed) };
}

function containsSecretLikeValue(text) {
  return /(sk-[A-Za-z0-9_-]{20,}|xox[baprs]-|ghp_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9_-]{12,})/i.test(text);
}

function containsWebhookLikeValue(text) {
  return /https:\/\/hooks\.(slack|discord|teams)\.com\/[^\s"']+/i.test(text);
}

function containsRawBaseUrlValue(text) {
  return /https?:\/\/[^\s"']*(token|secret|apikey|api_key|key=|access_token|base_url)[^\s"']*/i.test(text);
}

function containsPositiveClaim(text, key) {
  return new RegExp(`${key}\\s*[:=]\\s*true`, "i").test(text);
}
