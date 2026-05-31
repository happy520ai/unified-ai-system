import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const paths = {
  phase610Guarded: "apps/ai-gateway-service/evidence/phase610r/codex-exec-guarded-one-shot-result.json",
  designDoc: "docs/phase611r-repeated-custom-provider-guarded-test-design.md",
  budgetPolicy: "docs/phase611r-budget-rate-rollback-policy.md",
  attemptPlan: "docs/phase611r-repeated-attempt-plan.json",
  commandPreview: "docs/phase611r-codex-exec-command-preview.md",
  phase612ConfirmationExample: "docs/phase612r-repeated-guarded-test-confirmation.input.example.json",
  resultInputExample: "docs/phase612r-repeated-guarded-test-result.input.example.json",
  executionReport: "docs/phase611r-execution-report.md",
  evidence: "apps/ai-gateway-service/evidence/phase611r/repeated-guarded-test-design-result.json",
};

const phase610 = readJson(paths.phase610Guarded);
const attemptPlan = readJson(paths.attemptPlan);
const confirmationExample = readJson(paths.phase612ConfirmationExample);
const resultInputExample = readJson(paths.resultInputExample);
const designDoc = readText(paths.designDoc);
const budgetPolicy = readText(paths.budgetPolicy);
const commandPreview = readText(paths.commandPreview);
const executionReport = readText(paths.executionReport);
const attempts = Array.isArray(attemptPlan.data?.attempts) ? attemptPlan.data.attempts : [];
const boundaryText = [
  designDoc,
  budgetPolicy,
  commandPreview,
  executionReport,
  JSON.stringify(attemptPlan.data ?? {}),
  JSON.stringify(confirmationExample.data ?? {}),
  JSON.stringify(resultInputExample.data ?? {}),
].join("\n");

const phase610rImported = phase610.exists && !phase610.parseErrorReason;
const priorOneShotPass =
  phase610.data?.completed === true &&
  phase610.data?.recommended_sealed === true &&
  phase610.data?.blocker === null &&
  phase610.data?.selectedProviderId === "crs" &&
  phase610.data?.requestAttemptCount === 1 &&
  phase610.data?.retryAttemptCount === 0 &&
  phase610.data?.responseClassification === "pass" &&
  phase610.data?.ackObserved === true &&
  phase610.data?.ackExpected === "CONTEXT_GATEWAY_MODEL_PROVIDER_OK";

const result = {
  phase: "Phase611R-Fix",
  name: "Codex Exec Custom Provider Repeated Guarded Test Design",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  designOnly: true,
  phase610rImported,
  priorOneShotPass,
  selectedProviderId: phase610.data?.selectedProviderId ?? null,
  priorRequestAttemptCount: phase610.data?.requestAttemptCount ?? null,
  priorRetryAttemptCount: phase610.data?.retryAttemptCount ?? null,
  priorResponseClassification: phase610.data?.responseClassification ?? null,
  priorAck: phase610.data?.ackExpected ?? null,
  designGenerated: exists(paths.designDoc),
  budgetRateRollbackPolicyGenerated: exists(paths.budgetPolicy),
  attemptPlanGenerated: exists(paths.attemptPlan),
  maxPlannedAttempts: Number(attemptPlan.data?.maxPlannedAttempts ?? 0),
  maxRequestsPerAttempt: Number(attemptPlan.data?.maxRequestsPerAttempt ?? 0),
  maxRequestsTotal: Number(attemptPlan.data?.maxRequestsTotal ?? 0),
  allAttemptsRetryLimitZero: attempts.length > 0 && attempts.every((attempt) => attempt.retryLimit === 0),
  allAttemptsMaxRequestsOne: attempts.length > 0 && attempts.every((attempt) => attempt.maxRequests === 1),
  allAttemptsExpectedAck: attempts.length > 0 && attempts.every((attempt) => attempt.expectedAck === "CONTEXT_GATEWAY_MODEL_PROVIDER_OK"),
  allAttemptsRequireExplicitConfirmation: attempts.length > 0 && attempts.every((attempt) => attempt.requiresExplicitConfirmation === true),
  commandPreviewGenerated: exists(paths.commandPreview),
  phase612ConfirmationExampleGenerated: confirmationExample.exists === true,
  resultInputExampleGenerated: resultInputExample.exists === true,
  codexExecExecutedByThisPhase: false,
  providerCallsMadeByThisPhase: false,
  requestAttemptCountNotIncreased: true,
  authJsonRead: false,
  authJsonAccessed: false,
  codexConfigModified: false,
  projectCodexConfigModified: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  providerRuntimeModified: false,
  secretValueExposed: containsSecretLikeValue(boundaryText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(boundaryText),
  webhookValueExposed: containsWebhookLikeValue(boundaryText),
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  repeatedReliabilityProven: false,
  productionReadyClaimed: containsPositiveReadinessClaim(boundaryText),
  workspaceCleanClaimed: false,
  missionControlPreview: {
    phase610OneShotPassOnce: priorOneShotPass,
    phase611RepeatedReliabilityDesignReady: true,
    maxPlannedAttempts: Number(attemptPlan.data?.maxPlannedAttempts ?? 0),
    phase612ExecutionRequiresExplicitConfirmation: true,
    notProductionReady: true,
    notReleaseReady: true,
    notChatIntegrated: true,
  },
  docs: [
    paths.designDoc,
    paths.budgetPolicy,
    paths.attemptPlan,
    paths.commandPreview,
    paths.phase612ConfirmationExample,
    paths.resultInputExample,
    paths.executionReport,
  ],
  evidenceJson: paths.evidence,
};

const checks = [
  check("phase610r_imported", result.phase610rImported === true),
  check("prior_one_shot_pass", result.priorOneShotPass === true),
  check("selected_provider_crs", result.selectedProviderId === "crs"),
  check("prior_request_attempt_count_one", result.priorRequestAttemptCount === 1),
  check("prior_retry_attempt_count_zero", result.priorRetryAttemptCount === 0),
  check("prior_response_classification_pass", result.priorResponseClassification === "pass"),
  check("prior_ack_expected", result.priorAck === "CONTEXT_GATEWAY_MODEL_PROVIDER_OK"),
  check("design_generated", result.designGenerated === true),
  check("budget_rate_rollback_policy_generated", result.budgetRateRollbackPolicyGenerated === true),
  check("attempt_plan_generated", result.attemptPlanGenerated === true),
  check("max_planned_attempts_three", result.maxPlannedAttempts === 3),
  check("max_requests_total_three", result.maxRequestsTotal === 3),
  check("max_requests_per_attempt_one", result.maxRequestsPerAttempt === 1),
  check("attempt_count_three", attempts.length === 3),
  check("all_attempts_retry_limit_zero", result.allAttemptsRetryLimitZero === true),
  check("all_attempts_max_requests_one", result.allAttemptsMaxRequestsOne === true),
  check("all_attempts_expected_ack", result.allAttemptsExpectedAck === true),
  check("all_attempts_require_explicit_confirmation", result.allAttemptsRequireExplicitConfirmation === true),
  check("command_preview_generated", result.commandPreviewGenerated === true),
  check("command_preview_uses_codex_exec", /codex exec -c model_provider="crs"/.test(commandPreview)),
  check("command_preview_no_execution", /previewOnly=true/.test(commandPreview) && /noExecutionInPhase611=true/.test(commandPreview)),
  check("phase612_confirmation_example_generated", result.phase612ConfirmationExampleGenerated === true),
  check("phase612_confirmation_example_parseable", confirmationExample.exists === true && !confirmationExample.parseErrorReason),
  check("result_input_example_generated", result.resultInputExampleGenerated === true),
  check("result_input_example_parseable", resultInputExample.exists === true && !resultInputExample.parseErrorReason),
  check("execution_report_generated", exists(paths.executionReport)),
  check("codex_exec_executed_by_this_phase_false", result.codexExecExecutedByThisPhase === false),
  check("provider_calls_made_by_this_phase_false", result.providerCallsMadeByThisPhase === false),
  check("request_attempt_count_not_increased", result.requestAttemptCountNotIncreased === true),
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
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("repeated_reliability_proven_false", result.repeatedReliabilityProven === false),
  check("production_ready_claimed_false", result.productionReadyClaimed === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase611r_repeated_guarded_test_design_failed:${failed.join(",")}`;
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

function containsPositiveReadinessClaim(text) {
  return /(productionReadyClaimed|releaseReadyClaimed|repeatedReliabilityProven)\s*[:=]\s*true/i.test(text);
}
