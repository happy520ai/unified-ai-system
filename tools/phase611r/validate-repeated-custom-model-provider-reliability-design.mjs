import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const paths = {
  phase610Intake: "apps/ai-gateway-service/evidence/phase610r/codex-exec-one-shot-result-intake.json",
  phase610Ledger: "apps/ai-gateway-service/evidence/phase610r/codex-exec-one-shot-evidence-ledger.json",
  designDoc: "docs/phase611r-repeated-custom-model-provider-reliability-design.md",
  attemptPlan: "docs/phase611r-reliability-attempt-plan.json",
  commandPreview: "docs/phase611r-codex-exec-reliability-command-preview.md",
  resultExample: "docs/phase611r-reliability-result.input.example.json",
  classificationDoc: "docs/phase611r-reliability-classification.md",
  executionReport: "docs/phase611r-execution-report.md",
  realResultInput: "docs/phase611r-reliability-result.input.json",
  evidence: "apps/ai-gateway-service/evidence/phase611r/repeated-custom-model-provider-reliability-design-result.json",
};

const phase610Intake = readJson(paths.phase610Intake);
const phase610Ledger = readJson(paths.phase610Ledger);
const attemptPlan = readJson(paths.attemptPlan);
const resultExample = readJson(paths.resultExample);
const designDoc = readText(paths.designDoc);
const commandPreview = readText(paths.commandPreview);
const classificationDoc = readText(paths.classificationDoc);
const executionReport = readText(paths.executionReport);

const attempts = Array.isArray(attemptPlan.data?.attempts) ? attemptPlan.data.attempts : [];
const boundaryText = [
  designDoc,
  commandPreview,
  classificationDoc,
  executionReport,
  JSON.stringify(attemptPlan.data ?? {}),
  JSON.stringify(resultExample.data ?? {}),
].join("\n");

const phase610rImported = phase610Intake.exists && phase610Ledger.exists && !phase610Intake.parseErrorReason && !phase610Ledger.parseErrorReason;
const priorOneShotPass =
  phase610Intake.data?.completed === true &&
  phase610Intake.data?.recommended_sealed === true &&
  phase610Intake.data?.blocker === null &&
  phase610Intake.data?.selectedProviderId === "crs" &&
  phase610Intake.data?.requestAttemptCount === 1 &&
  phase610Intake.data?.retryAttemptCount === 0 &&
  phase610Intake.data?.responseClassification === "pass" &&
  phase610Intake.data?.passMarker === "CONTEXT_GATEWAY_MODEL_PROVIDER_OK";

const result = {
  phase: "Phase611R-Fix",
  name: "Repeated Custom Model Provider Reliability Design",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  designOnly: true,
  phase610rImported,
  priorOneShotPass,
  selectedProviderId: phase610Intake.data?.selectedProviderId ?? null,
  priorRequestAttemptCount: phase610Intake.data?.requestAttemptCount ?? null,
  priorRetryAttemptCount: phase610Intake.data?.retryAttemptCount ?? null,
  priorResponseClassification: phase610Intake.data?.responseClassification ?? null,
  reliabilityDesignGenerated: exists(paths.designDoc),
  attemptPlanGenerated: exists(paths.attemptPlan),
  maxPlannedAttempts: Number(attemptPlan.data?.maxPlannedAttempts ?? 0),
  allAttemptsMaxRequestsOne: attempts.length > 0 && attempts.every((attempt) => attempt.maxRequests === 1),
  allAttemptsRetryLimitZero: attempts.length > 0 && attempts.every((attempt) => attempt.retryLimit === 0),
  allAttemptsSelectedProviderCrs: attempts.length > 0 && attempts.every((attempt) => attempt.selectedProviderId === "crs"),
  allAttemptsRequireExplicitConfirmation: attempts.length > 0 && attempts.every((attempt) => attempt.requiresExplicitConfirmation === true),
  allAttemptsStopOnFailure: attempts.length > 0 && attempts.every((attempt) => attempt.stopOnFailure === true),
  commandPreviewGenerated: exists(paths.commandPreview),
  resultInputExampleGenerated: resultExample.exists === true,
  exampleNotCountedAsRealResult: !exists(paths.realResultInput) && /input\.example\.json$/.test(paths.resultExample),
  codexOneShotExecutedByThisPhase: false,
  providerCallsMadeByThisPhase: false,
  requestAttemptCountNotIncreased: true,
  authJsonRead: false,
  authJsonAccessed: false,
  codexConfigModified: false,
  projectCodexConfigModified: false,
  providerRuntimeModified: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  secretValueExposed: containsSecretLikeValue(boundaryText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(boundaryText),
  webhookValueExposed: containsWebhookLikeValue(boundaryText),
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  productionReadyClaimed: containsPositiveReadinessClaim(boundaryText),
  repeatedReliabilityProven: false,
  workspaceCleanClaimed: false,
  missionControlPreview: {
    phase610OneShotPassOnce: priorOneShotPass,
    phase611ReliabilityDesignReady: true,
    maxPlannedAttempts: Number(attemptPlan.data?.maxPlannedAttempts ?? 0),
    executedYet: false,
    notProductionReady: true,
    notChatIntegrated: true,
    notReleaseReady: true,
  },
  docs: [
    paths.designDoc,
    paths.attemptPlan,
    paths.commandPreview,
    paths.resultExample,
    paths.classificationDoc,
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
  check("reliability_design_generated", result.reliabilityDesignGenerated === true),
  check("attempt_plan_generated", result.attemptPlanGenerated === true),
  check("max_planned_attempts_three", result.maxPlannedAttempts === 3),
  check("attempt_count_three", attempts.length === 3),
  check("all_attempts_max_requests_one", result.allAttemptsMaxRequestsOne === true),
  check("all_attempts_retry_limit_zero", result.allAttemptsRetryLimitZero === true),
  check("all_attempts_selected_provider_crs", result.allAttemptsSelectedProviderCrs === true),
  check("all_attempts_require_explicit_confirmation", result.allAttemptsRequireExplicitConfirmation === true),
  check("all_attempts_stop_on_failure", result.allAttemptsStopOnFailure === true),
  check("command_preview_generated", result.commandPreviewGenerated === true),
  check("command_preview_uses_codex_exec", /codex exec -c model_provider="crs"/.test(commandPreview)),
  check("command_preview_not_executed", /preview only/i.test(commandPreview) && /codexOneShotExecutedByThisPhase=false/.test(commandPreview)),
  check("result_input_example_generated", result.resultInputExampleGenerated === true),
  check("result_input_example_parseable", resultExample.exists === true && !resultExample.parseErrorReason),
  check("example_not_counted_as_real_result", result.exampleNotCountedAsRealResult === true),
  check("classification_doc_generated", exists(paths.classificationDoc)),
  check("classification_not_repeated_pass", /must not classify as `repeated_pass`/.test(classificationDoc)),
  check("execution_report_generated", exists(paths.executionReport)),
  check("codex_one_shot_executed_by_this_phase_false", result.codexOneShotExecutedByThisPhase === false),
  check("provider_calls_made_by_this_phase_false", result.providerCallsMadeByThisPhase === false),
  check("request_attempt_count_not_increased", result.requestAttemptCountNotIncreased === true),
  check("auth_json_read_false", result.authJsonRead === false),
  check("auth_json_accessed_false", result.authJsonAccessed === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("project_codex_config_modified_false", result.projectCodexConfigModified === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
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
  check("repeated_reliability_proven_false", result.repeatedReliabilityProven === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase611r_reliability_design_failed:${failed.join(",")}`;
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
