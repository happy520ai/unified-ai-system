import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const paths = {
  input: "docs/phase610r-codex-exec-one-shot-result.input.json",
  intakeDoc: "docs/phase610r-codex-exec-one-shot-result-intake.md",
  classificationDoc: "docs/phase610r-response-classification.md",
  executionReport: "docs/phase610r-execution-report.md",
  commandPreview: "docs/phase609r-codex-exec-command-preview.md",
  intakeEvidence: "apps/ai-gateway-service/evidence/phase610r/codex-exec-one-shot-result-intake.json",
  ledgerEvidence: "apps/ai-gateway-service/evidence/phase610r/codex-exec-one-shot-evidence-ledger.json",
};

const input = readJson(paths.input);
const resultInput = input.data ?? {};
const stdout = String(resultInput.stdoutSanitized ?? "");
const stderrSummary = String(resultInput.stderrSanitizedSummary ?? "");
const passMarker = String(resultInput.passMarker ?? "");
const responseClassification = classify(resultInput);
const testStatus = responseClassification === "pass" ? "pass" : "blocked";
const combinedSanitizedText = `${stdout}\n${stderrSummary}\n${passMarker}`;

const evidence = {
  phase: "Phase610R-Fix",
  name: "Codex Exec Custom Model Provider One-Shot Result Intake",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  resultInputExists: input.exists,
  resultInputParseErrorReason: input.parseErrorReason,
  intakeId: resultInput.intakeId ?? null,
  reportedBy: resultInput.reportedBy ?? null,
  executionMode: resultInput.executionMode ?? null,
  selectedProviderId: resultInput.selectedProviderId ?? null,
  commandSource: resultInput.commandSource ?? null,
  maxRequests: Number(resultInput.maxRequests ?? 0),
  requestAttemptCount: Number(resultInput.requestAttemptCount ?? 0),
  retryAttemptCount: Number(resultInput.retryAttemptCount ?? -1),
  exitCode: Number(resultInput.exitCode ?? -1),
  passMarker,
  stdoutSanitized: sanitize(stdout),
  stderrSanitizedSummary: sanitize(stderrSummary),
  stderrWarningNonBlocking: /non-blocking warnings only/i.test(stderrSummary),
  testStatus,
  responseClassification,
  cleanupCompleted: resultInput.cleanupCompleted === true,
  rollbackNeeded: resultInput.rollbackNeeded === true,
  passRequiresContextGatewayAck: true,
  codexOneShotExecutedByThisPhase: false,
  providerCallsMadeByThisPhase: false,
  authJsonRead: false,
  authJsonAccessed: resultInput.authJsonAccessed === true,
  codexConfigModified: resultInput.codexConfigModified === true,
  projectCodexConfigModified: resultInput.projectCodexConfigModified === true,
  persistentConfigWritePerformed: resultInput.codexConfigModified === true || resultInput.projectCodexConfigModified === true,
  rawBaseUrlValueIncluded: resultInput.rawBaseUrlValueIncluded === true,
  secretValueIncluded: resultInput.secretValueIncluded === true,
  webhookValueIncluded: resultInput.webhookValueIncluded === true,
  secretValueExposed: resultInput.secretValueIncluded === true || containsSecretLikeValue(combinedSanitizedText),
  rawBaseUrlValueExposed: resultInput.rawBaseUrlValueIncluded === true || containsRawBaseUrlValue(combinedSanitizedText),
  webhookValueExposed: resultInput.webhookValueIncluded === true || containsWebhookLikeValue(combinedSanitizedText),
  chatModified: resultInput.chatModified === true,
  chatGatewayExecuteModified: resultInput.chatGatewayExecuteModified === true,
  deployExecuted: resultInput.deployExecuted === true,
  releaseExecuted: resultInput.releaseExecuted === true,
  tagCreated: resultInput.tagCreated === true,
  artifactUploaded: resultInput.artifactUploaded === true,
  pushExecuted: resultInput.pushExecuted === true,
  commitCreated: resultInput.commitCreated === true,
  characterModuleRestored: false,
  productionReadyClaimed: /production ready|production-ready|release ready|release-ready|GA|general availability/i.test(String(resultInput.notes ?? "")),
  repeatedReliabilityProven: false,
  chatIntegrationComplete: false,
  workspaceCleanClaimed: false,
  missionControlPreview: {
    status: "custom model_provider one-shot pass once",
    selectedProviderId: resultInput.selectedProviderId ?? null,
    requestAttemptCount: Number(resultInput.requestAttemptCount ?? 0),
    retryAttemptCount: Number(resultInput.retryAttemptCount ?? -1),
    responseClassification,
    notProductionReady: true,
    notRepeatedReliabilityProven: true,
    noChatIntegration: true,
  },
  docs: [paths.input, paths.intakeDoc, paths.classificationDoc, paths.executionReport],
  evidenceJson: paths.intakeEvidence,
  ledgerJson: paths.ledgerEvidence,
};

const checks = [
  check("result_input_exists", evidence.resultInputExists === true),
  check("result_input_parseable", evidence.resultInputExists === true && !evidence.resultInputParseErrorReason),
  check("execution_mode_codex_exec_non_interactive", evidence.executionMode === "codex_exec_non_interactive"),
  check("selected_provider_crs", evidence.selectedProviderId === "crs"),
  check("max_requests_one", evidence.maxRequests === 1),
  check("request_attempt_count_one", evidence.requestAttemptCount === 1),
  check("retry_attempt_count_zero", evidence.retryAttemptCount === 0),
  check("exit_code_zero", evidence.exitCode === 0),
  check("pass_marker_expected", evidence.passMarker === "CONTEXT_GATEWAY_MODEL_PROVIDER_OK"),
  check("stdout_contains_pass_marker", stdout.includes("CONTEXT_GATEWAY_MODEL_PROVIDER_OK")),
  check("response_classification_pass", evidence.responseClassification === "pass"),
  check("cleanup_completed_true", evidence.cleanupCompleted === true),
  check("codex_one_shot_executed_by_this_phase_false", evidence.codexOneShotExecutedByThisPhase === false),
  check("provider_calls_made_by_this_phase_false", evidence.providerCallsMadeByThisPhase === false),
  check("auth_json_accessed_false", evidence.authJsonAccessed === false),
  check("auth_json_read_false", evidence.authJsonRead === false),
  check("codex_config_modified_false", evidence.codexConfigModified === false),
  check("project_codex_config_modified_false", evidence.projectCodexConfigModified === false),
  check("persistent_config_write_false", evidence.persistentConfigWritePerformed === false),
  check("secret_value_exposed_false", evidence.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", evidence.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", evidence.webhookValueExposed === false),
  check("chat_modified_false", evidence.chatModified === false),
  check("chat_gateway_execute_modified_false", evidence.chatGatewayExecuteModified === false),
  check("deploy_executed_false", evidence.deployExecuted === false),
  check("release_executed_false", evidence.releaseExecuted === false),
  check("tag_created_false", evidence.tagCreated === false),
  check("artifact_uploaded_false", evidence.artifactUploaded === false),
  check("push_executed_false", evidence.pushExecuted === false),
  check("commit_created_false", evidence.commitCreated === false),
  check("production_ready_claimed_false", evidence.productionReadyClaimed === false),
  check("workspace_clean_claimed_false", evidence.workspaceCleanClaimed === false),
  check("intake_doc_exists", exists(paths.intakeDoc)),
  check("classification_doc_exists", exists(paths.classificationDoc)),
  check("execution_report_exists", exists(paths.executionReport)),
  check("command_preview_exists", exists(paths.commandPreview)),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  evidence.completed = false;
  evidence.recommended_sealed = false;
  evidence.blocker = `phase610r_codex_exec_result_intake_failed:${failed.join(",")}`;
}

evidence.checks = checks;

const ledger = {
  phase: "Phase610R-Fix",
  ledgerName: "Codex Exec One-Shot Evidence Ledger",
  completed: evidence.completed,
  recommended_sealed: evidence.recommended_sealed,
  blocker: evidence.blocker,
  refs: {
    phase609CommandPreview: paths.commandPreview,
    phase610ResultInput: paths.input,
    phase610ResultIntakeDoc: paths.intakeDoc,
    phase610ClassificationDoc: paths.classificationDoc,
    phase610ExecutionReport: paths.executionReport,
  },
  selectedProviderId: evidence.selectedProviderId,
  requestAttemptCount: evidence.requestAttemptCount,
  retryAttemptCount: evidence.retryAttemptCount,
  testStatus: evidence.testStatus,
  responseClassification: evidence.responseClassification,
  stderrWarningNonBlocking: evidence.stderrWarningNonBlocking,
  cleanup: {
    cleanupCompleted: evidence.cleanupCompleted,
    rollbackNeeded: evidence.rollbackNeeded,
    codexConfigModified: evidence.codexConfigModified,
    projectCodexConfigModified: evidence.projectCodexConfigModified,
  },
  safetyBoundary: {
    codexOneShotExecutedByThisPhase: evidence.codexOneShotExecutedByThisPhase,
    providerCallsMadeByThisPhase: evidence.providerCallsMadeByThisPhase,
    authJsonRead: evidence.authJsonRead,
    authJsonAccessed: evidence.authJsonAccessed,
    secretValueExposed: evidence.secretValueExposed,
    rawBaseUrlValueExposed: evidence.rawBaseUrlValueExposed,
    webhookValueExposed: evidence.webhookValueExposed,
    chatModified: evidence.chatModified,
    chatGatewayExecuteModified: evidence.chatGatewayExecuteModified,
    deployExecuted: evidence.deployExecuted,
    releaseExecuted: evidence.releaseExecuted,
    tagCreated: evidence.tagCreated,
    artifactUploaded: evidence.artifactUploaded,
    pushExecuted: evidence.pushExecuted,
    commitCreated: evidence.commitCreated,
    productionReadyClaimed: evidence.productionReadyClaimed,
    workspaceCleanClaimed: evidence.workspaceCleanClaimed,
  },
  missionControlPreview: evidence.missionControlPreview,
};

writeJson(paths.intakeEvidence, evidence);
writeJson(paths.ledgerEvidence, ledger);

console.log(JSON.stringify(evidence, null, 2));
if (!evidence.completed) process.exitCode = 1;

function classify(value) {
  const exitCode = Number(value.exitCode ?? -1);
  const out = String(value.stdoutSanitized ?? "");
  const marker = String(value.passMarker ?? "");
  const err = String(value.stderrSanitizedSummary ?? "");
  if (/timeout/i.test(err)) return "timeout";
  if (/stdin is not a terminal/i.test(err)) return "failed_tty";
  if (exitCode === 0 && (out.includes("CONTEXT_GATEWAY_MODEL_PROVIDER_OK") || marker === "CONTEXT_GATEWAY_MODEL_PROVIDER_OK")) {
    return "pass";
  }
  if (exitCode !== 0) return "failed_provider_route";
  return "invalid_response";
}

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

function sanitize(value) {
  return String(value ?? "")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "<redacted:secret>")
    .replace(/xox[baprs]-[A-Za-z0-9-]+/g, "<redacted:webhook-or-token>")
    .replace(/ghp_[A-Za-z0-9_]{20,}/g, "<redacted:token>")
    .replace(/AKIA[0-9A-Z]{16}/g, "<redacted:secret>")
    .replace(/https?:\/\/[^\s"')<>]+/gi, "<redacted:url>");
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
