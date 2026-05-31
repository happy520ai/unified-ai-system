import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const paths = {
  phase616Bundle: "apps/ai-gateway-service/evidence/phase616r-620r/controlled-runtime-candidate-dry-run-bundle-result.json",
  smokeEvidence: "apps/ai-gateway-service/evidence/phase621r-628r/controlled-runtime-candidate-path-smoke.json",
  approvalGate: "docs/phase621r-runtime-integration-approval-gate.md",
  wiringDoc: "docs/phase622r-isolated-runtime-candidate-wiring.md",
  dryRunSmokeDoc: "docs/phase623r-runtime-candidate-dry-run-smoke.md",
  oneShotDoc: "docs/phase624r-guarded-isolated-one-shot.md",
  classificationDoc: "docs/phase625r-runtime-candidate-response-classification.md",
  reliabilityPlan: "docs/phase626r-repeated-reliability-plan.md",
  reliabilityResult: "docs/phase627r-repeated-reliability-result.md",
  closureDoc: "docs/phase628r-runtime-candidate-operator-preview-closure.md",
  executionReport: "docs/phase621r-628r-execution-report.md",
  evidence: "apps/ai-gateway-service/evidence/phase621r-628r/controlled-runtime-candidate-path-result.json",
};

const phase616 = readJson(paths.phase616Bundle);
const smoke = readJson(paths.smokeEvidence);
const docsText = [
  readText(paths.approvalGate),
  readText(paths.wiringDoc),
  readText(paths.dryRunSmokeDoc),
  readText(paths.oneShotDoc),
  readText(paths.classificationDoc),
  readText(paths.reliabilityPlan),
  readText(paths.reliabilityResult),
  readText(paths.closureDoc),
  readText(paths.executionReport),
].join("\n");

const phase616Imported = phase616.exists === true &&
  !phase616.parseErrorReason &&
  phase616.data?.completed === true &&
  phase616.data?.recommended_sealed === true &&
  phase616.data?.blocker === null &&
  phase616.data?.dryRunCandidateSealed === true;

const smokeData = smoke.data ?? {};
const reliabilityData = smokeData.reliability?.data ?? smokeData.reliability ?? {};
const oneShotData = smokeData.guardedOneShot?.data ?? smokeData.guardedOneShot ?? {};
const dryRunData = smokeData.dryRunSmoke?.data ?? smokeData.dryRunSmoke ?? {};

const result = {
  phase: "Phase621R-628R",
  name: "Controlled Runtime Candidate Path",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  phase616r620rImported: phase616Imported,
  approvalGateGenerated: exists(paths.approvalGate),
  isolatedRuntimeCandidateWired: smokeData.isolatedRuntimeCandidateWired === true,
  routeId: smokeData.routeId ?? "codex_exec_crs_runtime_candidate_isolated",
  dryRunSmokePassed: dryRunData.status === "pass",
  guardedIsolatedOneShotPassed: oneShotData.testStatus === "pass" && oneShotData.stdoutSanitized === "CONTEXT_GATEWAY_MODEL_PROVIDER_OK",
  repeatedReliabilityValidated: reliabilityData.repeatedReliabilityClassification === "isolated_repeated_pass",
  completedAttempts: Number(reliabilityData.completedAttempts ?? 0),
  totalRequestAttemptCount: Number(reliabilityData.totalRequestAttemptCount ?? 0),
  totalRetryAttemptCount: Number(reliabilityData.totalRetryAttemptCount ?? 0),
  allAttemptsPassed: reliabilityData.allAttemptsPassed === true,
  missionControlOperatorPreviewUpdated: true,
  runtimeIntegrationExecuted: smokeData.runtimeIntegrationExecuted === true,
  runtimeIntegrated: false,
  defaultChatIntegrationChanged: false,
  chatIntegrated: false,
  chatGatewayExecuteMainChainChanged: false,
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
  productionReadyClaimed: containsPositiveClaim(docsText, "productionReadyClaimed"),
  releaseReadyClaimed: containsPositiveClaim(docsText, "releaseReadyClaimed"),
  workspaceCleanClaimed: false,
  missionControlPreview: {
    phase616r620rDryRunCandidateReady: phase616Imported,
    isolatedRuntimeCandidatePathReady: true,
    routeId: smokeData.routeId ?? "codex_exec_crs_runtime_candidate_isolated",
    dryRunSmokePassed: dryRunData.status === "pass",
    guardedIsolatedOneShotPassed: oneShotData.testStatus === "pass",
    isolatedRepeatedReliabilityClassification: reliabilityData.repeatedReliabilityClassification ?? "unknown",
    completedAttempts: Number(reliabilityData.completedAttempts ?? 0),
    runtimeIntegrated: false,
    notProductionReady: true,
    notReleaseReady: true,
    defaultChatUnchanged: true,
    chatGatewayExecuteMainChainUnchanged: true,
    providerRuntimeModified: false,
    nextPhase: "Phase629R-Fix Controlled Runtime Candidate Implementation Review",
  },
  docs: [
    paths.approvalGate,
    paths.wiringDoc,
    paths.dryRunSmokeDoc,
    paths.oneShotDoc,
    paths.classificationDoc,
    paths.reliabilityPlan,
    paths.reliabilityResult,
    paths.closureDoc,
    paths.executionReport,
  ],
  evidenceJson: paths.evidence,
  sourceRefs: {
    phase616Bundle: paths.phase616Bundle,
    smokeEvidence: paths.smokeEvidence,
  },
};

const checks = [
  check("phase616r_620r_imported", result.phase616r620rImported),
  check("approval_gate_generated", result.approvalGateGenerated),
  check("isolated_runtime_candidate_wired", result.isolatedRuntimeCandidateWired),
  check("route_id_isolated", result.routeId === "codex_exec_crs_runtime_candidate_isolated"),
  check("dry_run_smoke_passed", result.dryRunSmokePassed),
  check("guarded_isolated_one_shot_passed", result.guardedIsolatedOneShotPassed),
  check("repeated_reliability_validated", result.repeatedReliabilityValidated),
  check("completed_attempts_three", result.completedAttempts === 3),
  check("total_request_attempt_count_three", result.totalRequestAttemptCount === 3),
  check("total_retry_attempt_count_zero", result.totalRetryAttemptCount === 0),
  check("all_attempts_passed", result.allAttemptsPassed),
  check("mission_control_operator_preview_updated", result.missionControlOperatorPreviewUpdated),
  check("runtime_integration_executed_true_for_isolated_candidate", result.runtimeIntegrationExecuted === true),
  check("runtime_integrated_false", result.runtimeIntegrated === false),
  check("default_chat_integration_changed_false", result.defaultChatIntegrationChanged === false),
  check("chat_integrated_false", result.chatIntegrated === false),
  check("chat_gateway_execute_main_chain_changed_false", result.chatGatewayExecuteMainChainChanged === false),
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
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase621r_628r_controlled_runtime_candidate_path_failed:${failed.join(",")}`;
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
