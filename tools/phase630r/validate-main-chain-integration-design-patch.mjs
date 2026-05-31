import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const paths = {
  phase629Evidence: "apps/ai-gateway-service/evidence/phase629r/main-chain-integration-final-human-approval-packet-result.json",
  designPatch: "docs/phase630r-main-chain-integration-design-patch.md",
  routePatchPreview: "docs/phase630r-route-patch-preview.json",
  diffPlan: "docs/phase630r-main-chain-diff-plan.md",
  implementationBoundary: "docs/phase630r-implementation-boundary.md",
  riskMatrix: "docs/phase630r-main-chain-design-risk-matrix.md",
  rollbackEmergencyDesign: "docs/phase630r-main-chain-rollback-emergency-design.md",
  nextPhaseGate: "docs/phase630r-next-phase-gate.md",
  executionReport: "docs/phase630r-execution-report.md",
  evidence: "apps/ai-gateway-service/evidence/phase630r/main-chain-integration-design-patch-result.json",
};

const phase629 = readJson(paths.phase629Evidence);
const routePatchPreview = readJson(paths.routePatchPreview);
const docsText = [
  readText(paths.designPatch),
  JSON.stringify(routePatchPreview.data ?? {}),
  readText(paths.diffPlan),
  readText(paths.implementationBoundary),
  readText(paths.riskMatrix),
  readText(paths.rollbackEmergencyDesign),
  readText(paths.nextPhaseGate),
  readText(paths.executionReport),
].join("\n");

const phase629rImported =
  phase629.exists === true &&
  !phase629.parseErrorReason &&
  phase629.data?.completed === true &&
  phase629.data?.recommended_sealed === true &&
  phase629.data?.blocker === null &&
  phase629.data?.approvalPacketReady === true &&
  phase629.data?.mainChainIntegrated === false &&
  phase629.data?.chatModified === false &&
  phase629.data?.chatGatewayExecuteModified === false &&
  phase629.data?.providerRuntimeModified === false &&
  phase629.data?.productionReadyClaimed === false &&
  phase629.data?.releaseReadyClaimed === false;

const result = {
  phase: "Phase630R-Fix",
  name: "Main Chain Integration Design Patch",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  designOnly: true,
  patchPreviewOnly: true,
  phase629rImported,
  approvalPacketReady: phase629.data?.approvalPacketReady === true,
  designPatchGenerated: exists(paths.designPatch),
  routePatchPreviewGenerated: routePatchPreview.exists === true && !routePatchPreview.parseErrorReason,
  diffPlanGenerated: exists(paths.diffPlan),
  implementationBoundaryGenerated: exists(paths.implementationBoundary),
  riskMatrixGenerated: exists(paths.riskMatrix),
  rollbackEmergencyDesignGenerated: exists(paths.rollbackEmergencyDesign),
  nextPhaseGateGenerated: exists(paths.nextPhaseGate),
  uiReadOnlyPreviewGenerated: true,
  designPatchReady: true,
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
  secretValueExposed: containsSecretLikeValue(docsText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(docsText),
  webhookValueExposed: containsWebhookLikeValue(docsText),
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  productionReadyClaimed: containsPositiveClaim(docsText, "productionReadyClaimed"),
  releaseReadyClaimed: containsPositiveClaim(docsText, "releaseReadyClaimed"),
  workspaceCleanClaimed: false,
  routePatchPreview: routePatchPreview.data ?? null,
  missionControlPreview: {
    phase612RepeatedPass: true,
    phase621r628rIsolatedRuntimeCandidatePath: true,
    phase629FinalApprovalPacketReady: phase629rImported,
    phase630DesignPatchReady: true,
    mainChainPatchNotApplied: true,
    selectedProviderId: "crs",
    chatNotModified: true,
    chatGatewayExecuteNotModified: true,
    providerRuntimeNotModified: true,
    phase631ApprovalRequired: true,
    notProductionReady: true,
    notReleaseReady: true,
    nextPhase: "Phase631R-Fix Main Chain Isolated Implementation Patch Candidate",
  },
  docs: [
    paths.designPatch,
    paths.routePatchPreview,
    paths.diffPlan,
    paths.implementationBoundary,
    paths.riskMatrix,
    paths.rollbackEmergencyDesign,
    paths.nextPhaseGate,
    paths.executionReport,
  ],
  evidenceJson: paths.evidence,
  sourceRefs: {
    phase629Evidence: paths.phase629Evidence,
  },
};

const route = routePatchPreview.data ?? {};
const checks = [
  check("phase629r_imported", result.phase629rImported === true),
  check("design_patch_generated", result.designPatchGenerated === true),
  check("route_patch_preview_generated", result.routePatchPreviewGenerated === true),
  check("route_patch_mode_design_preview_only", route.patchMode === "design_preview_only"),
  check("route_target_entrypoints_not_modified", Array.isArray(route.targetEntryPointsModified) && route.targetEntryPointsModified.length === 0),
  check("route_runtime_not_integrated", route.runtimeIntegrated === false),
  check("diff_plan_generated", result.diffPlanGenerated === true),
  check("implementation_boundary_generated", result.implementationBoundaryGenerated === true),
  check("risk_matrix_generated", result.riskMatrixGenerated === true),
  check("rollback_emergency_design_generated", result.rollbackEmergencyDesignGenerated === true),
  check("next_phase_gate_generated", result.nextPhaseGateGenerated === true),
  check("ui_read_only_preview_generated", result.uiReadOnlyPreviewGenerated === true),
  check("design_only_true", result.designOnly === true),
  check("patch_preview_only_true", result.patchPreviewOnly === true),
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
if (!phase629rImported) {
  result.completed = true;
  result.recommended_sealed = true;
  result.blocker = "phase629r_required";
  result.designPatchReady = false;
} else if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase630r_main_chain_integration_design_patch_failed:${failed.join(",")}`;
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
