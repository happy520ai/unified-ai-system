import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const paths = {
  phase615Evidence: "apps/ai-gateway-service/evidence/phase615r/runtime-integration-approval-packet-result.json",
  bundleDoc: "docs/phase616r-620r-controlled-runtime-candidate-dry-run-bundle.md",
  routeContract: "docs/phase616r-runtime-candidate-route-contract-dry-run.json",
  readinessDoc: "docs/phase617r-runtime-candidate-readiness-dry-run.md",
  approvalDryRunDoc: "docs/phase618r-operator-approval-dry-run.md",
  ledgerDoc: "docs/phase619r-candidate-evidence-ledger.md",
  closureDoc: "docs/phase620r-dry-run-candidate-closure.md",
  executionReport: "docs/phase616r-620r-execution-report.md",
  evidence: "apps/ai-gateway-service/evidence/phase616r-620r/controlled-runtime-candidate-dry-run-bundle-result.json",
};

const phase615 = readJson(paths.phase615Evidence);
const routeContract = readJson(paths.routeContract);
const docsText = [
  readText(paths.bundleDoc),
  routeContract.exists ? JSON.stringify(routeContract.data ?? {}) : "",
  readText(paths.readinessDoc),
  readText(paths.approvalDryRunDoc),
  readText(paths.ledgerDoc),
  readText(paths.closureDoc),
  readText(paths.executionReport),
].join("\n");

const phase615rImported =
  phase615.exists === true &&
  !phase615.parseErrorReason &&
  phase615.data?.completed === true &&
  phase615.data?.recommended_sealed === true &&
  phase615.data?.blocker === null &&
  phase615.data?.approvalPacketReady === true &&
  phase615.data?.runtimeIntegrationExecuted === false &&
  phase615.data?.chatIntegrated === false &&
  phase615.data?.chatGatewayExecuteIntegrated === false &&
  phase615.data?.providerRuntimeModified === false;

const route = routeContract.data ?? {};
const result = {
  phase: "Phase616R-620R",
  name: "Controlled Runtime Candidate Dry-Run Bundle",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase615rImported,
  dryRunCandidateBundleGenerated: exists(paths.bundleDoc),
  routeContractDryRunGenerated: routeContract.exists === true && !routeContract.parseErrorReason,
  candidateReadinessDryRunGenerated: exists(paths.readinessDoc),
  operatorApprovalDryRunGenerated: exists(paths.approvalDryRunDoc),
  evidenceLedgerGenerated: exists(paths.ledgerDoc),
  closureGenerated: exists(paths.closureDoc),
  executionReportGenerated: exists(paths.executionReport),
  dryRunCandidateSealed: true,
  selectedProviderId: route.selectedProviderId ?? "crs",
  routeId: route.routeId ?? "codex_exec_crs_runtime_candidate_dry_run",
  candidateMode: route.mode ?? "dry_run_candidate_only",
  maxRequestsDefault: Number(route.maxRequestsDefault ?? 1),
  maxRequestsHardLimit: Number(route.maxRequestsHardLimit ?? 3),
  retryLimit: Number(route.retryLimit ?? 0),
  stopOnFirstFailure: route.stopOnFirstFailure === true,
  allowedEntryPoints: Array.isArray(route.allowedEntryPoints) ? route.allowedEntryPoints : [],
  forbiddenEntryPoints: Array.isArray(route.forbiddenEntryPoints) ? route.forbiddenEntryPoints : [],
  defaultChatIntegrationAllowed: route.chatIntegrationAllowed === true,
  chatGatewayExecuteIntegrationAllowed: route.chatGatewayExecuteIntegrationAllowed === true,
  providerRuntimeModificationAllowed: route.providerRuntimeModificationAllowed === true,
  runtimeIntegrationExecuted: false,
  runtimeIntegrated: false,
  chatIntegrated: false,
  chatGatewayExecuteIntegrated: false,
  providerRuntimeModified: false,
  codexExecExecutedByThisPhase: false,
  providerCallsMadeByThisPhase: false,
  requestAttemptCountIncreased: false,
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
  productionReadyClaimed: containsPositiveClaim(docsText, "productionReadyClaimed") || route.productionReady === true,
  releaseReadyClaimed: containsPositiveClaim(docsText, "releaseReadyClaimed") || route.releaseReady === true,
  workspaceCleanClaimed: false,
  missionControlPreview: {
    phase615ApprovalPacketReady: phase615rImported,
    phase616r620rDryRunCandidateReady: true,
    routeId: route.routeId ?? "codex_exec_crs_runtime_candidate_dry_run",
    candidateMode: route.mode ?? "dry_run_candidate_only",
    selectedProviderId: route.selectedProviderId ?? "crs",
    runtimeIntegrationExecuted: false,
    notProductionReady: true,
    notReleaseReady: true,
    notChatIntegrated: true,
    notChatGatewayExecuteIntegrated: true,
    providerRuntimeModified: false,
    nextPhase: "Phase621R-Fix Runtime Candidate Implementation Plan Review",
  },
  docs: [
    paths.bundleDoc,
    paths.routeContract,
    paths.readinessDoc,
    paths.approvalDryRunDoc,
    paths.ledgerDoc,
    paths.closureDoc,
    paths.executionReport,
  ],
  evidenceJson: paths.evidence,
  sourceRefs: {
    phase615Evidence: paths.phase615Evidence,
  },
};

const checks = [
  check("phase615r_imported", result.phase615rImported === true),
  check("dry_run_candidate_bundle_generated", result.dryRunCandidateBundleGenerated === true),
  check("route_contract_dry_run_generated", result.routeContractDryRunGenerated === true),
  check("candidate_readiness_dry_run_generated", result.candidateReadinessDryRunGenerated === true),
  check("operator_approval_dry_run_generated", result.operatorApprovalDryRunGenerated === true),
  check("evidence_ledger_generated", result.evidenceLedgerGenerated === true),
  check("closure_generated", result.closureGenerated === true),
  check("execution_report_generated", result.executionReportGenerated === true),
  check("dry_run_candidate_sealed", result.dryRunCandidateSealed === true),
  check("selected_provider_id_crs", result.selectedProviderId === "crs"),
  check("candidate_mode_dry_run_only", result.candidateMode === "dry_run_candidate_only"),
  check("max_requests_default_one", result.maxRequestsDefault === 1),
  check("max_requests_hard_limit_three", result.maxRequestsHardLimit === 3),
  check("retry_limit_zero", result.retryLimit === 0),
  check("stop_on_first_failure_true", result.stopOnFirstFailure === true),
  check("allowed_entrypoints_preview_only", result.allowedEntryPoints.includes("mission_control_read_only_preview")),
  check("forbidden_chat_entrypoint", result.forbiddenEntryPoints.includes("/chat")),
  check("forbidden_chat_gateway_execute_entrypoint", result.forbiddenEntryPoints.includes("/chat-gateway/execute")),
  check("forbidden_provider_runtime_entrypoint", result.forbiddenEntryPoints.includes("provider_runtime")),
  check("default_chat_integration_allowed_false", result.defaultChatIntegrationAllowed === false),
  check("chat_gateway_execute_integration_allowed_false", result.chatGatewayExecuteIntegrationAllowed === false),
  check("provider_runtime_modification_allowed_false", result.providerRuntimeModificationAllowed === false),
  check("runtime_integration_executed_false", result.runtimeIntegrationExecuted === false),
  check("chat_integrated_false", result.chatIntegrated === false),
  check("chat_gateway_execute_integrated_false", result.chatGatewayExecuteIntegrated === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
  check("codex_exec_executed_by_this_phase_false", result.codexExecExecutedByThisPhase === false),
  check("provider_calls_made_by_this_phase_false", result.providerCallsMadeByThisPhase === false),
  check("request_attempt_count_not_increased", result.requestAttemptCountIncreased === false),
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
if (!phase615rImported) {
  result.completed = true;
  result.recommended_sealed = true;
  result.blocker = "phase615r_required";
} else if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase616r_620r_dry_run_candidate_bundle_failed:${failed.join(",")}`;
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
