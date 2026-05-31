import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const paths = {
  commandPack: "docs/phase606r-interactive-terminal-one-shot-command-pack.md",
  instruction: "docs/phase609r-manual-interactive-terminal-run-instruction.md",
  template: "docs/phase607r-interactive-terminal-result.input.template.json",
  realInput: "docs/phase607r-interactive-terminal-result.input.json",
  report: "docs/phase609r-manual-result-capture-kit-execution-report.md",
  evidence: "apps/ai-gateway-service/evidence/phase609r/manual-result-capture-kit-result.json",
};

const commandPackExists = exists(paths.commandPack);
const instructionGenerated = exists(paths.instruction);
const resultTemplateGenerated = exists(paths.template);
const realInputRead = readJson(paths.realInput);
const realResultInputExists = realInputRead.exists;
const realResultInputParseError = realInputRead.parseErrorReason;
const templateRead = readJson(paths.template);
const templateParseable = templateRead.exists && !templateRead.parseErrorReason;
const reportText = readText(paths.report);
const instructionText = readText(paths.instruction);
const templateText = readText(paths.template);
const realInput = realInputRead.data;

const boundary = buildBoundary(realInput);
const blocker = chooseBlocker();
const result = {
  phase: "Phase609R-Fix",
  name: "Manual Interactive Terminal Result Capture Kit + Phase608R Intake Re-run",
  completed: true,
  recommended_sealed: blocker === "manual_result_input_missing" || blocker === null,
  blocker,
  commandPackExists,
  instructionGenerated,
  resultTemplateGenerated,
  realResultInputExists,
  realResultInputParseError: realResultInputParseError ?? null,
  exampleOrTemplateNotCountedAsRealResult: realResultInputExists === false && resultTemplateGenerated === true,
  codexOneShotExecutedByThisPhase: false,
  providerCallsMadeByThisPhase: false,
  requestAttemptCountNotIncreased: true,
  authJsonRead: false,
  authJsonAccessed: boundary.authJsonAccessed,
  codexConfigModified: boundary.codexConfigModified,
  projectCodexConfigModified: boundary.projectCodexConfigModified,
  secretValueExposed: boundary.secretValueExposed,
  rawBaseUrlValueExposed: boundary.rawBaseUrlValueExposed,
  webhookValueExposed: boundary.webhookValueExposed,
  chatModified: boundary.chatModified,
  chatGatewayExecuteModified: boundary.chatGatewayExecuteModified,
  deployExecuted: boundary.deployExecuted,
  releaseExecuted: boundary.releaseExecuted,
  tagCreated: boundary.tagCreated,
  artifactUploaded: boundary.artifactUploaded,
  pushExecuted: boundary.pushExecuted,
  commitCreated: boundary.commitCreated,
  workspaceCleanClaimed: false,
  selectedProviderId: realInput?.selectedProviderId ?? "crs",
  requestAttemptCount: Number(realInput?.requestAttemptCount ?? 0),
  retryAttemptCount: Number(realInput?.retryAttemptCount ?? 0),
  phase608IntakeReRunExpected: true,
  testStatus: realResultInputExists ? "ready_for_phase608_intake" : "blocked",
  responseClassification: realResultInputExists
    ? "pending_phase608_intake_classification"
    : "blocked_by_missing_manual_result",
  docs: [paths.instruction, paths.template, paths.report],
  evidenceJson: paths.evidence,
};

const checks = [
  check("command_pack_exists", result.commandPackExists === true),
  check("instruction_generated", result.instructionGenerated === true),
  check("result_template_generated", result.resultTemplateGenerated === true),
  check("real_result_input_exists_or_missing_blocker", result.realResultInputExists === true || result.blocker === "manual_result_input_missing"),
  check("real_input_parseable_when_present", !result.realResultInputExists || !realResultInputParseError),
  check("example_or_template_not_counted_as_real_result", result.exampleOrTemplateNotCountedAsRealResult === true || result.realResultInputExists === true),
  check("codex_one_shot_executed_by_this_phase_false", result.codexOneShotExecutedByThisPhase === false),
  check("provider_calls_made_by_this_phase_false", result.providerCallsMadeByThisPhase === false),
  check("request_attempt_count_not_increased", result.requestAttemptCountNotIncreased === true),
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
  check("template_parseable", templateParseable === true),
  check("template_has_required_shape", templateRead.data?.executionMode === "interactive_terminal_manual_command" && templateRead.data?.selectedProviderId === "crs"),
  check("instruction_records_manual_only", /Codex must not execute the one-shot in this phase/.test(instructionText)),
  check("instruction_records_sanitized_capture", /sanitized stdout/.test(instructionText) && /raw base_url/.test(instructionText)),
  check("report_records_missing_branch", /manual_result_input_missing/.test(reportText)),
  check("template_does_not_contain_real_ack", !templateText.includes("CONTEXT_GATEWAY_MODEL_PROVIDER_OK")),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
result.checks = checks;
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase609r_fix_failed:${failed.join(",")}`;
}

writeJson(paths.evidence, result);
console.log(JSON.stringify(result, null, 2));
if (!result.completed) process.exitCode = 1;

function chooseBlocker() {
  if (!commandPackExists) return "command_pack_missing";
  if (!instructionGenerated) return "instruction_missing";
  if (!resultTemplateGenerated) return "result_template_missing";
  if (!realResultInputExists) return "manual_result_input_missing";
  if (realResultInputParseError) return "manual_result_input_invalid";
  if (hasForbiddenBoundary(boundary)) return "manual_result_input_forbidden_boundary";
  return null;
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
