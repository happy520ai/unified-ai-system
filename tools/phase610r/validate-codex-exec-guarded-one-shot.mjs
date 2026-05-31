import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const evidencePath =
  "apps/ai-gateway-service/evidence/phase610r/codex-exec-guarded-one-shot-result.json";
const evidence = sanitizeEvidence(readJson(evidencePath).data);

const checks = [
  check("evidence_exists", exists(evidencePath)),
  check("user_confirmed", evidence?.userConfirmed === true),
  check("execution_mode_codex_exec", evidence?.executionMode === "codex_exec_non_interactive"),
  check("selected_provider_crs", evidence?.selectedProviderId === "crs"),
  check("max_requests_one", evidence?.maxRequests === 1),
  check("retry_limit_zero", evidence?.retryLimit === 0),
  check("request_attempt_count_one", evidence?.requestAttemptCount === 1),
  check("retry_attempt_count_zero", evidence?.retryAttemptCount === 0),
  check("response_classified", typeof evidence?.responseClassification === "string"),
  check("pass_requires_ack", evidence?.testStatus !== "pass" || evidence?.ackObserved === true),
  check("auth_json_read_false", evidence?.authJsonRead === false),
  check("auth_json_accessed_false", evidence?.authJsonAccessed === false),
  check("codex_config_modified_false", evidence?.codexConfigModified === false),
  check("project_codex_config_modified_false", evidence?.projectCodexConfigModified === false),
  check("persistent_config_write_false", evidence?.persistentConfigWritePerformed === false),
  check("secret_value_exposed_false", evidence?.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", evidence?.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", evidence?.webhookValueExposed === false),
  check("chat_modified_false", evidence?.chatModified === false),
  check("chat_gateway_execute_modified_false", evidence?.chatGatewayExecuteModified === false),
  check("deploy_executed_false", evidence?.deployExecuted === false),
  check("release_executed_false", evidence?.releaseExecuted === false),
  check("tag_created_false", evidence?.tagCreated === false),
  check("push_executed_false", evidence?.pushExecuted === false),
  check("commit_created_false", evidence?.commitCreated === false),
  check("workspace_clean_claimed_false", evidence?.workspaceCleanClaimed === false),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
const result = {
  ...(evidence ?? {}),
  validationPhase: "Phase610R-Fix",
  validationCompleted: failed.length === 0,
  validationBlocker: failed.length === 0 ? null : `phase610r_validation_failed:${failed.join(",")}`,
  checks,
};

writeJson(evidencePath, result);
console.log(JSON.stringify(result, null, 2));
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

function sanitizeEvidence(value) {
  if (!value || typeof value !== "object") return value;
  const sanitized = {
    ...value,
    stdoutSanitized: sanitize(value.stdoutSanitized),
    stderrSanitized: sanitize(value.stderrSanitized),
  };
  const combined = `${sanitized.stdoutSanitized ?? ""}\n${sanitized.stderrSanitized ?? ""}`;
  return {
    ...sanitized,
    secretValueExposed: containsSecretLikeValue(combined),
    rawBaseUrlValueExposed: containsRawUrlValue(combined),
    webhookValueExposed: containsWebhookLikeValue(combined),
  };
}

function sanitize(value) {
  const sanitized = String(value ?? "")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "<redacted:secret>")
    .replace(/xox[baprs]-[A-Za-z0-9-]+/g, "<redacted:webhook-or-token>")
    .replace(/ghp_[A-Za-z0-9_]{20,}/g, "<redacted:token>")
    .replace(/AKIA[0-9A-Z]{16}/g, "<redacted:secret>")
    .replace(/https?:\/\/[^\s"')<>]+/gi, "<redacted:url>")
    .replace(/(__cf_chl[a-zA-Z_]*=)[^&\s"']+/g, "$1<redacted:challenge-token>")
    .replace(/\b(cH|cRay|md|mdrd):\s*'[^']{24,}'/g, "$1: '<redacted:challenge-data>'");

  if (sanitized.length <= 4000) return sanitized;
  return `${sanitized.slice(0, 3500)}\n<redacted:truncated-stderr ${sanitized.length - 3500} chars>\n`;
}

function containsSecretLikeValue(text) {
  return /(sk-[A-Za-z0-9_-]{20,}|xox[baprs]-|ghp_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9_-]{12,})/i.test(text);
}

function containsWebhookLikeValue(text) {
  return /https:\/\/hooks\.(slack|discord|teams)\.com\/[^\s"']+/i.test(text);
}

function containsRawUrlValue(text) {
  return /https?:\/\/[^\s"']+/i.test(text);
}
