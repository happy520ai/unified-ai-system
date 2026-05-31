import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const paths = {
  manualInput: "docs/phase607r-interactive-terminal-result.input.json",
  phase604FixEvidence:
    "apps/ai-gateway-service/evidence/phase604r/final-confirmation-bom-safe-loader-result.json",
  phase605Evidence:
    "apps/ai-gateway-service/evidence/phase605r/codex-cli-non-interactive-tty-root-cause-review-result.json",
  phase607FixEvidence:
    "apps/ai-gateway-service/evidence/phase607r/interactive-terminal-execution-intake-result.json",
  resultEvidence:
    "apps/ai-gateway-service/evidence/phase608r/manual-result-intake-review-result.json",
  ledgerEvidence:
    "apps/ai-gateway-service/evidence/phase608r/manual-result-evidence-ledger.json",
};

const docs = [
  "docs/phase608r-manual-result-intake-review.md",
  "docs/phase608r-response-classification.md",
  "docs/phase608r-execution-report.md",
];

const manualRead = readJson(paths.manualInput);
const manual = manualRead.data;
const phase604Fix = readJson(paths.phase604FixEvidence).data;
const phase605 = readJson(paths.phase605Evidence).data;
const phase607Fix = readJson(paths.phase607FixEvidence).data;

const manualResultInputExists = manualRead.exists;
const manualResultInputParseError = manualRead.parseErrorReason;
const validationErrors =
  manualResultInputExists && !manualResultInputParseError ? validateManualInput(manual) : [];
const boundary = buildBoundary(manual);
const responseClassification = classifyResponse({
  manual,
  manualResultInputExists,
  manualResultInputParseError,
  validationErrors,
  boundary,
});
const blocker = blockerFromClassification(responseClassification);
const testStatus = statusFromClassification(responseClassification);
const selectedProviderId =
  manual?.selectedProviderId ?? phase607Fix?.selectedProviderId ?? "crs";
const requestAttemptCount = Number(manual?.requestAttemptCount ?? 0);
const retryAttemptCount = Number(manual?.retryAttemptCount ?? 0);
const ackObserved =
  typeof manual?.stdoutSanitized === "string" &&
  manual.stdoutSanitized.includes("CONTEXT_GATEWAY_MODEL_PROVIDER_OK");

const result = {
  phase: "Phase608R-Fix",
  name: "Manual Interactive Terminal Result Intake Review",
  completed: true,
  recommended_sealed:
    responseClassification === "pass" ||
    responseClassification === "blocked_by_missing_manual_result" ||
    responseClassification === "blocked_by_invalid_manual_result",
  blocker,
  manualResultInputExists,
  manualResultInputParseError: manualResultInputParseError ?? null,
  manualInputValidationErrors: validationErrors,
  codexOneShotExecutedByThisPhase: false,
  providerCallsMadeByThisPhase: false,
  oneShotExecutionIntakeCompleted: blocker === null,
  selectedProviderId,
  selectedProviderIdRecorded: Boolean(selectedProviderId) || Boolean(blocker),
  requestAttemptCount,
  retryAttemptCount,
  maxRequests: Number(manual?.maxRequests ?? 1),
  testStatus,
  responseClassification,
  responseClassified: Boolean(responseClassification),
  passRequiresContextGatewayAck: true,
  ackExpected: "CONTEXT_GATEWAY_MODEL_PROVIDER_OK",
  ackObserved,
  cleanupCompleted: manual?.cleanupCompleted === true,
  cleanupRecorded: manualResultInputExists && !manualResultInputParseError && validationErrors.length === 0,
  rollbackNeeded: manual?.rollbackNeeded === true,
  authJsonRead: false,
  authJsonAccessed: boundary.authJsonAccessed,
  authJsonTouched: false,
  codexConfigModified: boundary.codexConfigModified,
  projectCodexConfigModified: boundary.projectCodexConfigModified,
  persistentConfigWritePerformed: false,
  secretValueExposed: boundary.secretValueExposed,
  rawBaseUrlValueExposed: boundary.rawBaseUrlValueExposed,
  webhookValueExposed: boundary.webhookValueExposed,
  chatModified: boundary.chatModified,
  chatGatewayExecuteModified: boundary.chatGatewayExecuteModified,
  providerRuntimeModified: false,
  deployExecuted: boundary.deployExecuted,
  releaseExecuted: boundary.releaseExecuted,
  tagCreated: boundary.tagCreated,
  artifactUploaded: boundary.artifactUploaded,
  pushExecuted: boundary.pushExecuted,
  commitCreated: boundary.commitCreated,
  characterModuleRestored: false,
  workspaceCleanClaimed: false,
  phase604FixImported:
    phase604Fix?.completed === true &&
    phase604Fix?.recommended_sealed === true &&
    phase604Fix?.firstOneShotAttemptPreserved === true,
  phase605Imported:
    phase605?.completed === true &&
    phase605?.recommended_sealed === true &&
    phase605?.rootCause === "stdin_is_not_a_terminal",
  phase607FixImported:
    phase607Fix?.completed === true &&
    phase607Fix?.recommended_sealed === true &&
    phase607Fix?.blocker === "manual_result_input_missing",
  nextAction: nextActionFromClassification(responseClassification),
  docs,
  evidenceJson: paths.resultEvidence,
  ledgerJson: paths.ledgerEvidence,
};

const ledger = {
  phase: "Phase608R-Fix",
  ledgerName: "Manual Result Evidence Ledger",
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  refs: {
    phase604FixEvidence: {
      path: paths.phase604FixEvidence,
      imported: result.phase604FixImported,
      firstOneShotAttemptPreserved: phase604Fix?.firstOneShotAttemptPreserved === true,
      firstOneShotRootCause: phase604Fix?.firstOneShotRootCause ?? null,
    },
    phase605RootCauseEvidence: {
      path: paths.phase605Evidence,
      imported: result.phase605Imported,
      rootCause: phase605?.rootCause ?? null,
      recommendedNextRoute: phase605?.recommendedNextRoute ?? null,
    },
    phase607FixIntakeEvidence: {
      path: paths.phase607FixEvidence,
      imported: result.phase607FixImported,
      previousBlocker: phase607Fix?.blocker ?? null,
    },
    manualResultInput: {
      path: paths.manualInput,
      exists: result.manualResultInputExists,
      parseErrorReason: result.manualResultInputParseError,
      validationErrors: result.manualInputValidationErrors,
    },
  },
  selectedProviderId: result.selectedProviderId,
  requestAttemptCount: result.requestAttemptCount,
  retryAttemptCount: result.retryAttemptCount,
  testStatus: result.testStatus,
  responseClassification: result.responseClassification,
  cleanup: {
    cleanupCompleted: result.cleanupCompleted,
    cleanupRecorded: result.cleanupRecorded,
    rollbackNeeded: result.rollbackNeeded,
  },
  safetyBoundary: {
    codexOneShotExecutedByThisPhase: result.codexOneShotExecutedByThisPhase,
    providerCallsMadeByThisPhase: result.providerCallsMadeByThisPhase,
    authJsonRead: result.authJsonRead,
    authJsonAccessed: result.authJsonAccessed,
    codexConfigModified: result.codexConfigModified,
    projectCodexConfigModified: result.projectCodexConfigModified,
    secretValueExposed: result.secretValueExposed,
    rawBaseUrlValueExposed: result.rawBaseUrlValueExposed,
    webhookValueExposed: result.webhookValueExposed,
    chatModified: result.chatModified,
    chatGatewayExecuteModified: result.chatGatewayExecuteModified,
    deployExecuted: result.deployExecuted,
    releaseExecuted: result.releaseExecuted,
    tagCreated: result.tagCreated,
    artifactUploaded: result.artifactUploaded,
    pushExecuted: result.pushExecuted,
    commitCreated: result.commitCreated,
    workspaceCleanClaimed: result.workspaceCleanClaimed,
  },
};

const docsText = docs.map((docPath) => readText(docPath)).join("\n");
const checks = [
  check(
    "manual_result_input_exists_or_missing_blocker",
    result.manualResultInputExists === true || result.blocker === "manual_result_input_missing",
  ),
  check("codex_one_shot_executed_by_this_phase_false", result.codexOneShotExecutedByThisPhase === false),
  check("provider_calls_made_by_this_phase_false", result.providerCallsMadeByThisPhase === false),
  check("request_attempt_count_bounded", result.requestAttemptCount <= 1),
  check("retry_attempt_count_zero", result.retryAttemptCount === 0),
  check("response_classified_or_blocker", result.responseClassified === true || Boolean(result.blocker)),
  check("pass_requires_context_gateway_ack", result.passRequiresContextGatewayAck === true),
  check("pass_requires_ack_observed", !(result.testStatus === "pass" && result.ackObserved !== true)),
  check("pass_requires_cleanup_completed", !(result.testStatus === "pass" && result.cleanupCompleted !== true)),
  check("auth_json_read_false", result.authJsonRead === false),
  check("auth_json_accessed_false", result.authJsonAccessed === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("project_codex_config_modified_false", result.projectCodexConfigModified === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("tag_created_false", result.tagCreated === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
  check("docs_exist", docs.every((docPath) => exists(docPath))),
  check("docs_record_no_auto_one_shot", /codexOneShotExecutedByThisPhase=false/.test(docsText)),
  check("docs_record_missing_input_branch", /manual_result_input_missing/.test(docsText)),
  check("phase604_fix_imported", result.phase604FixImported === true),
  check("phase605_imported", result.phase605Imported === true),
  check("phase607_fix_imported", result.phase607FixImported === true),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
result.checks = checks;
ledger.checks = checks;
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase608r_fix_failed:${failed.join(",")}`;
  ledger.completed = false;
  ledger.recommended_sealed = false;
  ledger.blocker = result.blocker;
}

writeJson(paths.resultEvidence, result);
writeJson(paths.ledgerEvidence, ledger);

console.log(JSON.stringify(result, null, 2));
if (!result.completed) process.exitCode = 1;

function classifyResponse({
  manual,
  manualResultInputExists,
  manualResultInputParseError,
  validationErrors,
  boundary,
}) {
  if (!manualResultInputExists) return "blocked_by_missing_manual_result";
  if (manualResultInputParseError || validationErrors.length > 0) return "blocked_by_invalid_manual_result";
  if (manual?.timeout === true || manual?.timedOut === true) return "timeout";

  const stdout = String(manual?.stdoutSanitized ?? "");
  const stderr = String(manual?.stderrSanitized ?? "");
  const exitCode = Number(manual?.exitCode ?? 1);
  if (stderr.includes("stdin is not a terminal")) return "failed_tty";
  if (hasForbiddenBoundary(boundary)) return "blocked_by_invalid_manual_result";
  if (exitCode === 0 && stdout.includes("CONTEXT_GATEWAY_MODEL_PROVIDER_OK") && manual.cleanupCompleted === true) {
    return "pass";
  }
  if (exitCode !== 0) return "failed_provider_route";
  return "invalid_response";
}

function blockerFromClassification(classification) {
  if (classification === "pass") return null;
  if (classification === "blocked_by_missing_manual_result") return "manual_result_input_missing";
  if (classification === "blocked_by_invalid_manual_result") return "manual_result_input_invalid";
  if (classification === "timeout") return "interactive_terminal_one_shot_timeout";
  return "interactive_terminal_one_shot_failed";
}

function statusFromClassification(classification) {
  if (classification === "pass") return "pass";
  if (classification.startsWith("blocked_by_")) return "blocked";
  if (classification === "timeout") return "timeout";
  return "failed";
}

function nextActionFromClassification(classification) {
  if (classification === "pass") return "prepare_phase609r_post_success_context_gateway_route_review";
  if (classification === "blocked_by_missing_manual_result") {
    return "create_docs_phase607r_interactive_terminal_result_input_json_from_manual_terminal_result";
  }
  if (classification === "blocked_by_invalid_manual_result") {
    return "repair_manual_result_input_json_without_reexecuting_one_shot";
  }
  return "root_cause_review_no_retry";
}

function validateManualInput(input) {
  const errors = [];
  const expected = {
    executionMode: "interactive_terminal_manual_command",
    selectedProviderId: "crs",
    maxRequests: 1,
    retryAttemptCount: 0,
    authJsonAccessed: false,
    codexConfigModified: false,
    projectCodexConfigModified: false,
    rawBaseUrlValueIncluded: false,
    secretValueIncluded: false,
    webhookValueIncluded: false,
  };

  for (const [key, value] of Object.entries(expected)) {
    if (input?.[key] !== value) errors.push(`${key}_must_be_${String(value)}`);
  }

  if (Number(input?.requestAttemptCount ?? Number.POSITIVE_INFINITY) > 1) {
    errors.push("requestAttemptCount_must_be_lte_1");
  }

  if (
    Number(input?.exitCode ?? 1) === 0 &&
    String(input?.stdoutSanitized ?? "").includes("CONTEXT_GATEWAY_MODEL_PROVIDER_OK") &&
    input?.cleanupCompleted !== true
  ) {
    errors.push("cleanupCompleted_true_required_for_pass");
  }

  return errors;
}

function buildBoundary(input) {
  const combined = `${String(input?.stdoutSanitized ?? "")}\n${String(input?.stderrSanitized ?? "")}`;
  return {
    authJsonAccessed: input?.authJsonAccessed === true,
    codexConfigModified: input?.codexConfigModified === true,
    projectCodexConfigModified: input?.projectCodexConfigModified === true,
    secretValueExposed: input?.secretValueIncluded === true || containsSecretLikeValue(combined),
    rawBaseUrlValueExposed: input?.rawBaseUrlValueIncluded === true || containsRawBaseUrlValue(combined),
    webhookValueExposed: input?.webhookValueIncluded === true || containsWebhookLikeValue(combined),
    chatModified: input?.chatModified === true,
    chatGatewayExecuteModified: input?.chatGatewayExecuteModified === true,
    deployExecuted: input?.deployExecuted === true,
    releaseExecuted: input?.releaseExecuted === true,
    tagCreated: input?.tagCreated === true,
    artifactUploaded: input?.artifactUploaded === true,
    pushExecuted: input?.pushExecuted === true,
    commitCreated: input?.commitCreated === true,
  };
}

function hasForbiddenBoundary(boundary) {
  return Object.values(boundary).some((value) => value === true);
}

function containsSecretLikeValue(text) {
  return /(sk-[A-Za-z0-9_-]{20,}|xox[baprs]-|ghp_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9_-]{12,})/i.test(text);
}

function containsWebhookLikeValue(text) {
  return /https:\/\/hooks\.(slack|discord|teams)\.com\/[^\s"']+/i.test(text);
}

function containsRawBaseUrlValue(text) {
  return /https?:\/\/[^\s"']*(token|secret|apikey|api_key|key=|access_token)[^\s"']*/i.test(text);
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
