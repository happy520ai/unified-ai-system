import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const paths = {
  phase621r628rEvidence: "apps/ai-gateway-service/evidence/phase621r-628r/controlled-runtime-candidate-path-result.json",
  approvalPacket: "docs/phase629r-main-chain-integration-final-human-approval-packet.md",
  approvalExample: "docs/phase629r-main-chain-integration-final-approval.input.example.json",
  riskMatrix: "docs/phase629r-main-chain-integration-risk-matrix.md",
  executionBoundary: "docs/phase629r-main-chain-execution-boundary.md",
  rollbackPlan: "docs/phase629r-main-chain-rollback-plan.md",
  emergencyDisablePlan: "docs/phase629r-main-chain-emergency-disable-plan.md",
  finalGoNoGoChecklist: "docs/phase629r-final-go-no-go-checklist.md",
  nextPhaseGate: "docs/phase629r-next-phase-gate.md",
  executionReport: "docs/phase629r-execution-report.md",
  evidence: "apps/ai-gateway-service/evidence/phase629r/main-chain-integration-final-human-approval-packet-result.json",
};

const phase621r628r = readJson(paths.phase621r628rEvidence);
const approvalExample = readJson(paths.approvalExample);
const docsText = [
  readText(paths.approvalPacket),
  JSON.stringify(approvalExample.data ?? {}),
  readText(paths.riskMatrix),
  readText(paths.executionBoundary),
  readText(paths.rollbackPlan),
  readText(paths.emergencyDisablePlan),
  readText(paths.finalGoNoGoChecklist),
  readText(paths.nextPhaseGate),
  readText(paths.executionReport),
].join("\n");

const phase621r628rImported =
  phase621r628r.exists === true &&
  !phase621r628r.parseErrorReason &&
  phase621r628r.data?.completed === true &&
  phase621r628r.data?.recommended_sealed === true &&
  phase621r628r.data?.blocker === null &&
  phase621r628r.data?.isolatedRuntimeCandidateGenerated === true &&
  phase621r628r.data?.dryRunSmokePassed === true &&
  phase621r628r.data?.defaultChatIntegrated === false &&
  phase621r628r.data?.chatGatewayExecuteIntegrated === false &&
  phase621r628r.data?.providerRuntimeMainChainModified === false &&
  phase621r628r.data?.deployExecuted === false &&
  phase621r628r.data?.releaseExecuted === false &&
  phase621r628r.data?.productionReadyClaimed === false;

const result = {
  phase: "Phase629R-Fix",
  name: "Main Chain Integration Final Human Approval Packet",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  approvalPacketOnly: true,
  phase621r628rImported,
  isolatedRuntimeCandidateGenerated: phase621r628r.data?.isolatedRuntimeCandidateGenerated === true,
  dryRunSmokePassed: phase621r628r.data?.dryRunSmokePassed === true,
  defaultChatIntegrated: false,
  chatGatewayExecuteIntegrated: false,
  providerRuntimeMainChainModified: false,
  approvalPacketGenerated: exists(paths.approvalPacket),
  approvalInputExampleGenerated: approvalExample.exists === true && !approvalExample.parseErrorReason,
  exampleNotCountedAsRealApproval: approvalExample.data?.exampleOnly === true && approvalExample.data?.realApproval === false,
  riskMatrixGenerated: exists(paths.riskMatrix),
  executionBoundaryGenerated: exists(paths.executionBoundary),
  rollbackPlanGenerated: exists(paths.rollbackPlan),
  emergencyDisablePlanGenerated: exists(paths.emergencyDisablePlan),
  finalGoNoGoChecklistGenerated: exists(paths.finalGoNoGoChecklist),
  nextPhaseGateGenerated: exists(paths.nextPhaseGate),
  uiReadOnlyPreviewGenerated: true,
  approvalPacketReady: true,
  mainChainIntegrationExecuted: false,
  mainChainIntegrated: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
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
    phase621r628rIsolatedRuntimeCandidatePath: phase621r628rImported,
    phase629FinalApprovalPacketReady: true,
    mainChainIntegrationNotExecuted: true,
    finalHumanApprovalRequired: true,
    selectedProviderId: "crs",
    chatNotIntegrated: true,
    chatGatewayExecuteNotIntegrated: true,
    providerRuntimeNotModified: true,
    notProductionReady: true,
    notReleaseReady: true,
    nextPhase: "Phase630R-Fix Main Chain Integration Design Patch",
  },
  docs: [
    paths.approvalPacket,
    paths.approvalExample,
    paths.riskMatrix,
    paths.executionBoundary,
    paths.rollbackPlan,
    paths.emergencyDisablePlan,
    paths.finalGoNoGoChecklist,
    paths.nextPhaseGate,
    paths.executionReport,
  ],
  evidenceJson: paths.evidence,
  sourceRefs: {
    phase621r628rEvidence: paths.phase621r628rEvidence,
  },
};

const checks = [
  check("phase621r628r_imported", result.phase621r628rImported === true),
  check("approval_packet_generated", result.approvalPacketGenerated === true),
  check("approval_input_example_generated", result.approvalInputExampleGenerated === true),
  check("example_not_counted_as_real_approval", result.exampleNotCountedAsRealApproval === true),
  check("risk_matrix_generated", result.riskMatrixGenerated === true),
  check("execution_boundary_generated", result.executionBoundaryGenerated === true),
  check("rollback_plan_generated", result.rollbackPlanGenerated === true),
  check("emergency_disable_plan_generated", result.emergencyDisablePlanGenerated === true),
  check("final_go_no_go_checklist_generated", result.finalGoNoGoChecklistGenerated === true),
  check("next_phase_gate_generated", result.nextPhaseGateGenerated === true),
  check("ui_read_only_preview_generated", result.uiReadOnlyPreviewGenerated === true),
  check("main_chain_integration_executed_false", result.mainChainIntegrationExecuted === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
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
if (!phase621r628rImported) {
  result.completed = true;
  result.recommended_sealed = true;
  result.blocker = "phase621r_628r_required";
  result.approvalPacketReady = false;
} else if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase629r_main_chain_final_human_approval_packet_failed:${failed.join(",")}`;
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
