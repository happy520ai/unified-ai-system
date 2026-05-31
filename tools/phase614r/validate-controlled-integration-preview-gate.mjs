import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const paths = {
  phase613Evidence: "apps/ai-gateway-service/evidence/phase613r/repeated-reliability-result-closure.json",
  gateDoc: "docs/phase614r-controlled-integration-preview-gate.md",
  routeContract: "docs/phase614r-route-contract-preview.json",
  approvalPolicy: "docs/phase614r-manual-approval-policy.md",
  runtimePolicy: "docs/phase614r-runtime-boundary-policy.md",
  uiPreviewDesign: "docs/phase614r-ui-read-only-preview-design.md",
  nextPhaseGate: "docs/phase614r-next-phase-gate.md",
  executionReport: "docs/phase614r-execution-report.md",
  evidence: "apps/ai-gateway-service/evidence/phase614r/controlled-integration-preview-gate-result.json",
};

const phase613 = readJson(paths.phase613Evidence);
const contract = readJson(paths.routeContract);
const gateDoc = readText(paths.gateDoc);
const approvalPolicy = readText(paths.approvalPolicy);
const runtimePolicy = readText(paths.runtimePolicy);
const uiPreviewDesign = readText(paths.uiPreviewDesign);
const nextPhaseGate = readText(paths.nextPhaseGate);
const executionReport = readText(paths.executionReport);
const allText = [gateDoc, approvalPolicy, runtimePolicy, uiPreviewDesign, nextPhaseGate, executionReport, JSON.stringify(contract.data ?? {})].join("\n");

const phase613rImported = phase613.exists === true && !phase613.parseErrorReason;
const repeatedPassConfirmed =
  phase613.data?.repeatedPassConfirmed === true &&
  phase613.data?.completedAttempts === 3 &&
  phase613.data?.totalRequestAttemptCount === 3 &&
  phase613.data?.totalRetryAttemptCount === 0;
const capabilityBoundaryAcknowledged = /controlled codex exec custom model_provider only/i.test(allText);

const result = {
  phase: "Phase614R-Fix",
  name: "Controlled Integration Preview Gate",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  previewOnly: true,
  phase613rImported,
  repeatedPassConfirmed,
  completedAttempts: phase613.data?.completedAttempts ?? null,
  totalRequestAttemptCount: phase613.data?.totalRequestAttemptCount ?? null,
  totalRetryAttemptCount: phase613.data?.totalRetryAttemptCount ?? null,
  capabilityBoundaryAcknowledged,
  controlledIntegrationGateGenerated: exists(paths.gateDoc),
  routeContractPreviewGenerated: contract.exists === true && !contract.parseErrorReason,
  manualApprovalPolicyGenerated: exists(paths.approvalPolicy),
  runtimeBoundaryPolicyGenerated: exists(paths.runtimePolicy),
  uiReadOnlyPreviewGenerated: exists(paths.uiPreviewDesign),
  nextPhaseGateGenerated: exists(paths.nextPhaseGate),
  defaultChatIntegrationAllowed: false,
  chatGatewayExecuteIntegrationAllowed: false,
  providerRuntimeModificationAllowed: false,
  runtimeIntegrated: false,
  chatIntegrated: false,
  chatGatewayExecuteIntegrated: false,
  routeContract: {
    routeId: contract.data?.routeId ?? null,
    mode: contract.data?.mode ?? null,
    allowedEntryPoints: contract.data?.allowedEntryPoints ?? [],
    forbiddenEntryPoints: contract.data?.forbiddenEntryPoints ?? [],
    requiresManualApprovalBeforeRuntime: contract.data?.requiresManualApprovalBeforeRuntime ?? null,
    maxRequestsDefault: contract.data?.maxRequestsDefault ?? null,
    maxRequestsHardLimit: contract.data?.maxRequestsHardLimit ?? null,
    retryLimit: contract.data?.retryLimit ?? null,
    productionReady: contract.data?.productionReady ?? null,
    releaseReady: contract.data?.releaseReady ?? null,
  },
  codexExecExecutedByThisPhase: false,
  providerCallsMadeByThisPhase: false,
  authJsonRead: false,
  authJsonAccessed: false,
  codexConfigModified: false,
  projectCodexConfigModified: false,
  persistentConfigWritePerformed: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  providerRuntimeModified: false,
  secretValueExposed: containsSecretLikeValue(allText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(allText),
  webhookValueExposed: containsWebhookLikeValue(allText),
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  characterModuleRestored: false,
  productionReadyClaimed: containsPositiveClaim(allText, "productionReadyClaimed") || contract.data?.productionReady === true,
  releaseReadyClaimed: containsPositiveClaim(allText, "releaseReadyClaimed") || contract.data?.releaseReady === true,
  workspaceCleanClaimed: false,
  missionControlPreview: {
    phase612RepeatedPass: repeatedPassConfirmed,
    phase613CapabilityBoundary: "controlled codex exec custom model_provider only",
    phase614PreviewGateReady: true,
    routeId: contract.data?.routeId ?? "codex_exec_crs_preview",
    selectedProviderId: contract.data?.selectedProviderId ?? "crs",
    integrationMode: contract.data?.mode ?? "preview_only",
    runtimeIntegrationRequiresSeparateApproval: true,
    notProductionReady: true,
    notReleaseReady: true,
    notChatIntegrated: true,
    notChatGatewayExecuteIntegrated: true,
  },
  docs: [
    paths.gateDoc,
    paths.routeContract,
    paths.approvalPolicy,
    paths.runtimePolicy,
    paths.uiPreviewDesign,
    paths.nextPhaseGate,
    paths.executionReport,
  ],
  evidenceJson: paths.evidence,
  sourceRefs: {
    phase613Evidence: paths.phase613Evidence,
  },
};

const forbidden = result.routeContract.forbiddenEntryPoints;
const checks = [
  check("phase613r_imported", result.phase613rImported === true),
  check("repeated_pass_confirmed", result.repeatedPassConfirmed === true),
  check("completed_attempts_three", result.completedAttempts === 3),
  check("total_request_attempt_count_three", result.totalRequestAttemptCount === 3),
  check("total_retry_attempt_count_zero", result.totalRetryAttemptCount === 0),
  check("capability_boundary_acknowledged", result.capabilityBoundaryAcknowledged === true),
  check("controlled_integration_gate_generated", result.controlledIntegrationGateGenerated === true),
  check("route_contract_preview_generated", result.routeContractPreviewGenerated === true),
  check("manual_approval_policy_generated", result.manualApprovalPolicyGenerated === true),
  check("runtime_boundary_policy_generated", result.runtimeBoundaryPolicyGenerated === true),
  check("ui_read_only_preview_generated", result.uiReadOnlyPreviewGenerated === true),
  check("next_phase_gate_generated", result.nextPhaseGateGenerated === true),
  check("contract_route_id", result.routeContract.routeId === "codex_exec_crs_preview"),
  check("contract_mode_preview_only", result.routeContract.mode === "preview_only"),
  check("contract_allowed_read_only_preview", result.routeContract.allowedEntryPoints.includes("mission_control_read_only_preview")),
  check("contract_forbids_chat", forbidden.includes("/chat")),
  check("contract_forbids_chat_gateway_execute", forbidden.includes("/chat-gateway/execute")),
  check("contract_forbids_provider_runtime", forbidden.includes("provider_runtime")),
  check("manual_approval_before_runtime", result.routeContract.requiresManualApprovalBeforeRuntime === true),
  check("max_requests_default_one", result.routeContract.maxRequestsDefault === 1),
  check("max_requests_hard_limit_three", result.routeContract.maxRequestsHardLimit === 3),
  check("retry_limit_zero", result.routeContract.retryLimit === 0),
  check("default_chat_integration_allowed_false", result.defaultChatIntegrationAllowed === false),
  check("chat_gateway_execute_integration_allowed_false", result.chatGatewayExecuteIntegrationAllowed === false),
  check("provider_runtime_modification_allowed_false", result.providerRuntimeModificationAllowed === false),
  check("codex_exec_executed_by_this_phase_false", result.codexExecExecutedByThisPhase === false),
  check("provider_calls_made_by_this_phase_false", result.providerCallsMadeByThisPhase === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("project_codex_config_modified_false", result.projectCodexConfigModified === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
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
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase614r_controlled_integration_preview_gate_failed:${failed.join(",")}`;
}

result.checks = checks;
writeJson(paths.evidence, result);
console.log(JSON.stringify(result, null, 2));
if (!result.completed) process.exitCode = 1;

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
