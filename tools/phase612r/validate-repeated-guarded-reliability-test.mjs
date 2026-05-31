import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const paths = {
  confirmation: "docs/phase612r-repeated-guarded-test-confirmation.input.json",
  aggregate: "apps/ai-gateway-service/evidence/phase612r/repeated-guarded-reliability-result.json",
  ledger: "apps/ai-gateway-service/evidence/phase612r/repeated-guarded-reliability-ledger.json",
  attempts: [
    "apps/ai-gateway-service/evidence/phase612r/attempt-1.json",
    "apps/ai-gateway-service/evidence/phase612r/attempt-2.json",
    "apps/ai-gateway-service/evidence/phase612r/attempt-3.json",
  ],
  docs: [
    "docs/phase612r-repeated-guarded-reliability-execution.md",
    "docs/phase612r-response-classification.md",
    "docs/phase612r-cleanup-rollback-record.md",
    "docs/phase612r-execution-report.md",
  ],
};

const confirmation = readJson(paths.confirmation);
const aggregate = readJson(paths.aggregate);
const ledger = readJson(paths.ledger);
const attempts = paths.attempts.map((attemptPath) => ({ path: attemptPath, ...readJson(attemptPath) }));

const data = aggregate.data ?? {};
const attemptData = attempts.map((attempt) => attempt.data).filter(Boolean);
const executedAttempts = attemptData.filter((attempt) => Number(attempt.requestAttemptCount ?? 0) > 0);
const allAttemptsPassed = executedAttempts.length === 3 && executedAttempts.every((attempt) => attempt.responseClassification === "pass");

const checks = [
  check("confirmation_exists", confirmation.exists === true && !confirmation.parseErrorReason),
  check("confirmation_checked", data.confirmationChecked === true),
  check("confirmation_selected_provider_crs", confirmation.data?.selectedProviderId === "crs"),
  check("confirmation_max_requests_total_three", Number(confirmation.data?.maxRequestsTotal) === 3),
  check("aggregate_exists", aggregate.exists === true && !aggregate.parseErrorReason),
  check("ledger_exists", ledger.exists === true && !ledger.parseErrorReason),
  check("docs_generated", paths.docs.every((docPath) => exists(docPath))),
  check("attempt_evidence_parseable", attempts.every((attempt) => attempt.exists === true && !attempt.parseErrorReason)),
  check("repeated_test_executed", data.repeatedTestExecuted === true),
  check("selected_provider_crs", data.selectedProviderId === "crs"),
  check("planned_attempts_three", data.plannedAttempts === 3),
  check("completed_attempts_lte_three", Number(data.completedAttempts ?? 0) <= 3),
  check("total_request_attempt_count_lte_three", Number(data.totalRequestAttemptCount ?? 0) <= 3),
  check("total_retry_attempt_count_zero", Number(data.totalRetryAttemptCount ?? 0) === 0),
  check("stop_on_first_failure_true", data.stopOnFirstFailure === true),
  check("all_executed_attempts_request_one", executedAttempts.every((attempt) => attempt.requestAttemptCount === 1)),
  check("all_executed_attempts_retry_zero", executedAttempts.every((attempt) => attempt.retryAttemptCount === 0)),
  check("pass_requires_ack", executedAttempts.every((attempt) => attempt.responseClassification !== "pass" || attempt.ackObserved === true)),
  check("all_attempts_passed_consistent", data.allAttemptsPassed === allAttemptsPassed),
  check("repeated_pass_requires_three", data.repeatedReliabilityClassification !== "repeated_pass" || allAttemptsPassed),
  check("failure_has_stopped_reason", data.allAttemptsPassed === true || typeof data.stoppedReason === "string"),
  check("auth_json_read_false", data.authJsonRead === false),
  check("auth_json_accessed_false", data.authJsonAccessed === false),
  check("codex_config_modified_false", data.codexConfigModified === false),
  check("project_codex_config_modified_false", data.projectCodexConfigModified === false),
  check("persistent_config_write_false", data.persistentConfigWritePerformed === false),
  check("provider_runtime_modified_false", data.providerRuntimeModified === false),
  check("secret_value_exposed_false", data.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", data.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", data.webhookValueExposed === false),
  check("chat_modified_false", data.chatModified === false),
  check("chat_gateway_execute_modified_false", data.chatGatewayExecuteModified === false),
  check("deploy_executed_false", data.deployExecuted === false),
  check("release_executed_false", data.releaseExecuted === false),
  check("tag_created_false", data.tagCreated === false),
  check("artifact_uploaded_false", data.artifactUploaded === false),
  check("push_executed_false", data.pushExecuted === false),
  check("commit_created_false", data.commitCreated === false),
  check("production_ready_claimed_false", data.productionReadyClaimed === false),
  check("release_ready_claimed_false", data.releaseReadyClaimed === false),
  check("workspace_clean_claimed_false", data.workspaceCleanClaimed === false),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
const validationResult = {
  ...data,
  validationPhase: "Phase612R-Fix",
  validationCompleted: failed.length === 0,
  validationBlocker: failed.length === 0 ? null : `phase612r_validation_failed:${failed.join(",")}`,
  checks,
};

writeJson(paths.aggregate, validationResult);
console.log(JSON.stringify(validationResult, null, 2));
if (failed.length > 0) process.exitCode = 1;

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
