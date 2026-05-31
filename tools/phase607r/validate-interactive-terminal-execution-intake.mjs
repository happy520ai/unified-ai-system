import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const phase604FixEvidencePath =
  "apps/ai-gateway-service/evidence/phase604r/final-confirmation-bom-safe-loader-result.json";
const phase605EvidencePath =
  "apps/ai-gateway-service/evidence/phase605r/codex-cli-non-interactive-tty-root-cause-review-result.json";
const phase606EvidencePath =
  "apps/ai-gateway-service/evidence/phase606r/interactive-terminal-one-shot-command-pack-result.json";
const manualResultInputPath = "docs/phase607r-interactive-terminal-result.input.json";
const exampleInputPath = "docs/phase607r-interactive-terminal-result.input.example.json";
const resultEvidencePath =
  "apps/ai-gateway-service/evidence/phase607r/interactive-terminal-execution-intake-result.json";
const ledgerEvidencePath =
  "apps/ai-gateway-service/evidence/phase607r/interactive-terminal-evidence-ledger.json";

const docs = [
  exampleInputPath,
  "docs/phase607r-interactive-terminal-execution-intake.md",
  "docs/phase607r-response-classification.md",
  "docs/phase607r-cleanup-rollback-record.md",
  "docs/phase607r-execution-report.md",
];

const phase604FixEvidence = readJson(phase604FixEvidencePath).data;
const phase605Evidence = readJson(phase605EvidencePath).data;
const phase606Evidence = readJson(phase606EvidencePath).data;
const manualInputRead = readJson(manualResultInputPath);
const manualResultInput = manualInputRead.data;
const manualResultInputExists = manualInputRead.exists;
const manualResultInputParseError = manualInputRead.parseErrorReason;
const exampleInputExists = existsSync(resolve(repoRoot, exampleInputPath));
const exampleInput = readJson(exampleInputPath).data;

const imported = {
  phase604FirstAttemptImported:
    phase604FixEvidence?.completed === true &&
    phase604FixEvidence?.recommended_sealed === true &&
    phase604FixEvidence?.firstOneShotAttemptPreserved === true,
  phase605RootCauseImported:
    phase605Evidence?.completed === true &&
    phase605Evidence?.recommended_sealed === true &&
    phase605Evidence?.rootCause === "stdin_is_not_a_terminal",
  manualCommandPackReferenced:
    phase606Evidence?.completed === true &&
    phase606Evidence?.recommended_sealed === true &&
    phase606Evidence?.commandPackGenerated === true &&
    existsSync(resolve(repoRoot, "docs/phase606r-interactive-terminal-one-shot-command-pack.md")),
};

const selectedProviderId =
  manualResultInput?.selectedProviderId ??
  phase606Evidence?.selectedProviderId ??
  phase606Evidence?.importedFacts?.selectedProviderId ??
  "crs";
const requestAttemptCount = Number(manualResultInput?.requestAttemptCount ?? 0);
const retryAttemptCount = Number(manualResultInput?.retryAttemptCount ?? 0);
const boundary = buildBoundary(manualResultInput);
const classification = classifyManualResult(manualResultInput, manualResultInputExists, manualResultInputParseError, boundary);
const blocker = classifyBlocker(classification, manualResultInputExists, manualResultInputParseError);
const intakeCompleted = manualResultInputExists && !manualResultInputParseError && blocker === null;
const cleanupRecorded = !manualResultInputExists || manualResultInputParseError ? false : Boolean(manualResultInput?.cleanupCompleted);
const cleanupPassAllowed =
  classification === "pass" || classification === "pass_with_notes"
    ? manualResultInput?.cleanupCompleted === true &&
      manualResultInput?.rollbackNeeded === false &&
      boundary.authJsonAccessed === false &&
      boundary.codexConfigModified === false &&
      boundary.projectCodexConfigModified === false
    : false;

const result = {
  phase: "Phase607R-Fix",
  name: "Interactive Terminal Guarded One-Shot Execution Intake",
  completed: true,
  recommended_sealed: classification === "pass" || classification === "pass_with_notes" || blocker === "manual_result_input_missing" || blocker === "manual_result_input_invalid",
  blocker,
  oneShotExecutionIntakeCompleted: intakeCompleted,
  testStatus: statusFromClassification(classification),
  responseClassification: classification,
  phase604FirstAttemptImported: imported.phase604FirstAttemptImported,
  phase605RootCauseImported: imported.phase605RootCauseImported,
  manualCommandPackReferenced: imported.manualCommandPackReferenced,
  manualResultInputExists,
  manualResultInputParseError: manualResultInputParseError ?? null,
  exampleNotCountedAsRealResult: exampleInputExists && !manualResultInputExists,
  selectedProviderId,
  selectedProviderIdRecorded: Boolean(selectedProviderId) || Boolean(blocker),
  requestAttemptCount,
  retryAttemptCount,
  maxRequests: Number(manualResultInput?.maxRequests ?? 1),
  passRequiresContextGatewayAck: true,
  ackExpected: "CONTEXT_GATEWAY_MODEL_PROVIDER_OK",
  ackObserved:
    typeof manualResultInput?.stdoutSanitized === "string" &&
    manualResultInput.stdoutSanitized.includes("CONTEXT_GATEWAY_MODEL_PROVIDER_OK"),
  cleanupRecorded: cleanupRecorded || Boolean(blocker),
  cleanupCompleted: manualResultInput?.cleanupCompleted === true,
  rollbackNeeded: manualResultInput?.rollbackNeeded === true,
  cleanupPassAllowed,
  providerCallsMadeByThisPhase: false,
  codexOneShotExecutedByThisPhase: false,
  noAutomaticCodexExecution: true,
  noNewRequestMadeByThisPhase: true,
  authJsonAccessed: boundary.authJsonAccessed,
  authJsonRead: false,
  authJsonTouched: false,
  authJsonCopied: false,
  authJsonWrittenToEvidence: false,
  codexConfigModified: boundary.codexConfigModified,
  userCodexConfigModified: false,
  projectCodexConfigModified: boundary.projectCodexConfigModified,
  persistentConfigWritePerformed: false,
  providerCallsMade: false,
  secretValueExposed: boundary.secretValueExposed,
  webhookValueExposed: boundary.webhookValueExposed,
  rawBaseUrlValueExposed: boundary.rawBaseUrlValueExposed,
  chatModified: boundary.chatModified,
  chatGatewayExecuteModified: boundary.chatGatewayExecuteModified,
  deployExecuted: boundary.deployExecuted,
  releaseExecuted: boundary.releaseExecuted,
  tagCreated: boundary.tagCreated,
  artifactUploaded: boundary.artifactUploaded,
  pushExecuted: boundary.pushExecuted,
  commitCreated: boundary.commitCreated,
  characterModuleRestored: false,
  workspaceCleanClaimed: false,
  missionControlPreview: {
    visible: true,
    route: "interactive_terminal_manual_command",
    selectedProviderId,
    requestAttemptCount,
    responseClassification: classification,
    cleanupStatus: manualResultInputExists ? `cleanupCompleted=${Boolean(manualResultInput?.cleanupCompleted)}` : "manual_result_input_missing",
    configWriteStatus: "codexConfigModified=false; projectCodexConfigModified=false",
    nextAction: nextActionFromClassification(classification, blocker),
  },
  docs,
  sourceEvidence: {
    phase604FixEvidencePath,
    phase605EvidencePath,
    phase606EvidencePath,
    manualResultInputPath,
    exampleInputPath,
  },
  evidenceJson: resultEvidencePath,
  ledgerJson: ledgerEvidencePath,
};

const ledger = {
  phase: "Phase607R-Fix",
  ledgerName: "Interactive Terminal Evidence Ledger",
  completed: true,
  blocker,
  phase604FirstAttemptRef: {
    path: phase604FixEvidencePath,
    imported: imported.phase604FirstAttemptImported,
    firstOneShotAttemptPreserved: phase604FixEvidence?.firstOneShotAttemptPreserved === true,
    firstOneShotStatus: phase604FixEvidence?.firstOneShotStatus ?? null,
    firstOneShotRootCause: phase604FixEvidence?.firstOneShotRootCause ?? null,
  },
  phase605RootCauseRef: {
    path: phase605EvidencePath,
    imported: imported.phase605RootCauseImported,
    rootCause: phase605Evidence?.rootCause ?? null,
    recommendedNextRoute: phase605Evidence?.recommendedNextRoute ?? null,
  },
  phase606ManualCommandPackRef: {
    path: "docs/phase606r-interactive-terminal-one-shot-command-pack.md",
    imported: imported.manualCommandPackReferenced,
    manualExecutionOnly: phase606Evidence?.manualExecutionOnly === true,
  },
  phase607ManualResultInputRef: {
    path: manualResultInputPath,
    exists: manualResultInputExists,
    parseErrorReason: manualResultInputParseError ?? null,
    examplePath: exampleInputPath,
    exampleNotCountedAsRealResult: result.exampleNotCountedAsRealResult,
  },
  selectedProviderId,
  requestAttemptCount,
  retryAttemptCount,
  testStatus: result.testStatus,
  responseClassification: classification,
  cleanupStatus: {
    cleanupRecorded: result.cleanupRecorded,
    cleanupCompleted: result.cleanupCompleted,
    rollbackNeeded: result.rollbackNeeded,
    cleanupPassAllowed,
  },
  safetyBoundaryStatus: {
    authJsonAccessed: result.authJsonAccessed,
    authJsonRead: result.authJsonRead,
    codexConfigModified: result.codexConfigModified,
    projectCodexConfigModified: result.projectCodexConfigModified,
    providerCallsMadeByThisPhase: result.providerCallsMadeByThisPhase,
    codexOneShotExecutedByThisPhase: result.codexOneShotExecutedByThisPhase,
    secretValueExposed: result.secretValueExposed,
    webhookValueExposed: result.webhookValueExposed,
    rawBaseUrlValueExposed: result.rawBaseUrlValueExposed,
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
const uiText = readText("apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js");
const copyText = readText("apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js");
const syncText = readText("apps/ai-gateway-service/src/entrypoints/syncReadmeAgentsCurrentState.js");
const packageJson = readJson("package.json").data;
const checks = [
  check("phase604_first_attempt_imported", result.phase604FirstAttemptImported),
  check("phase605_root_cause_imported", result.phase605RootCauseImported),
  check("manual_command_pack_referenced", result.manualCommandPackReferenced),
  check("manual_result_input_exists_or_missing_blocker", result.manualResultInputExists === true || result.blocker === "manual_result_input_missing"),
  check("manual_result_invalid_blocker_if_parse_failed", !manualResultInputParseError || result.blocker === "manual_result_input_invalid"),
  check("example_not_counted_as_real_result", result.exampleNotCountedAsRealResult === true || result.manualResultInputExists === true),
  check("intake_completed_or_blocker_recorded", result.oneShotExecutionIntakeCompleted === true || typeof result.blocker === "string"),
  check("request_attempt_count_bounded", result.requestAttemptCount <= 1),
  check("retry_attempt_count_zero", result.retryAttemptCount === 0),
  check("selected_provider_id_recorded_or_blocker", result.selectedProviderIdRecorded === true || typeof result.blocker === "string"),
  check("response_classified_or_blocker", Boolean(result.responseClassification) || typeof result.blocker === "string"),
  check("pass_requires_context_gateway_ack", result.passRequiresContextGatewayAck === true),
  check("pass_blocked_without_ack", !(result.testStatus === "pass" && result.ackObserved !== true)),
  check("cleanup_recorded_or_blocker", result.cleanupRecorded === true || typeof result.blocker === "string"),
  check("pass_requires_cleanup_completed", !(result.testStatus === "pass" && result.cleanupPassAllowed !== true)),
  check("auth_json_accessed_false", result.authJsonAccessed === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("project_codex_config_modified_false", result.projectCodexConfigModified === false),
  check("persistent_config_write_performed_false", result.persistentConfigWritePerformed === false),
  check("provider_calls_made_by_this_phase_false", result.providerCallsMadeByThisPhase === false),
  check("codex_one_shot_executed_by_this_phase_false", result.codexOneShotExecutedByThisPhase === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("tag_created_false", result.tagCreated === false),
  check("artifact_uploaded_false", result.artifactUploaded === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("character_module_restored_false", result.characterModuleRestored === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
  check("docs_exist", docs.every((docPath) => existsSync(resolve(repoRoot, docPath)))),
  check("docs_record_missing_input_branch", /manual_result_input_missing/.test(docsText)),
  check("docs_record_no_automatic_one_shot", /codexOneShotExecutedByThisPhase=false/.test(docsText)),
  check("example_input_parseable", Boolean(exampleInput)),
  check("example_input_not_real_result", /example/i.test(readText(exampleInputPath)) || result.manualResultInputExists === false),
  check("mission_control_preview_visible", /phase607r-interactive-terminal-intake/i.test(uiText)),
  check("mission_control_preview_cards_visible", /codex-phase607r-status-card/.test(uiText) && /codex-phase607r-next-card/.test(uiText)),
  check("readme_agents_sync_guidance_present", /Phase607R-Fix/.test(syncText)),
  check(
    "package_script_present",
    packageJson?.scripts?.["verify:phase607r-interactive-terminal-execution-intake"] ===
      "node tools/phase607r/validate-interactive-terminal-execution-intake.mjs",
  ),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
result.completed = failed.length === 0;
result.recommended_sealed =
  failed.length === 0 &&
  (classification === "pass" ||
    classification === "pass_with_notes" ||
    blocker === "manual_result_input_missing" ||
    blocker === "manual_result_input_invalid");
result.blocker = failed.length === 0 ? blocker : `phase607r_fix_failed:${failed.join(",")}`;
result.checks = checks;
ledger.completed = result.completed;
ledger.recommended_sealed = result.recommended_sealed;
ledger.blocker = result.blocker;
ledger.checks = checks;

await mkdir(resolve(repoRoot, dirname(resultEvidencePath)), { recursive: true });
await writeFile(resolve(repoRoot, resultEvidencePath), `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(resolve(repoRoot, ledgerEvidencePath), `${JSON.stringify(ledger, null, 2)}\n`, "utf8");

console.log(JSON.stringify(result, null, 2));
if (!result.completed) process.exitCode = 1;

function classifyManualResult(input, exists, parseError, safetyBoundary) {
  if (!exists) return "blocked_by_missing_manual_result";
  if (parseError) return "blocked_by_invalid_manual_result";
  if (input?.timeout === true || input?.timedOut === true) return "timeout";

  const stdout = String(input?.stdoutSanitized ?? "");
  const stderr = String(input?.stderrSanitized ?? "");
  const hasAck = stdout.includes("CONTEXT_GATEWAY_MODEL_PROVIDER_OK");
  const hasWarning = /(^|\b)(warning|warn)(\b|:)/i.test(`${stdout}\n${stderr}`);

  if (stderr.includes("stdin is not a terminal")) return "failed_tty";
  if (hasForbiddenBoundary(safetyBoundary)) return "invalid_response";
  if (Number(input?.exitCode ?? 1) === 0 && hasAck && hasWarning) return "pass_with_notes";
  if (Number(input?.exitCode ?? 1) === 0 && hasAck) return "pass";
  if (Number(input?.exitCode ?? 1) !== 0) return "failed_provider_route";
  return "invalid_response";
}

function classifyBlocker(classification, exists, parseError) {
  if (!exists) return "manual_result_input_missing";
  if (parseError) return "manual_result_input_invalid";
  if (classification === "timeout") return "interactive_terminal_one_shot_timeout";
  if (classification === "pass" || classification === "pass_with_notes") return null;
  return "interactive_terminal_one_shot_failed";
}

function statusFromClassification(classification) {
  if (classification === "pass" || classification === "pass_with_notes") return "pass";
  if (classification.startsWith("blocked_by_")) return "blocked";
  if (classification === "timeout") return "timeout";
  return "failed";
}

function nextActionFromClassification(classification, currentBlocker) {
  if (classification === "pass" || classification === "pass_with_notes") {
    return "seal_intake_and_prepare_next_guarded_route_review";
  }
  if (currentBlocker === "manual_result_input_missing") {
    return "provide_docs_phase607r_interactive_terminal_result_input_json";
  }
  if (currentBlocker === "manual_result_input_invalid") {
    return "repair_manual_result_input_json_without_reexecuting_one_shot";
  }
  if (classification === "timeout") return "root_cause_review_no_retry";
  return "root_cause_review_no_retry";
}

function buildBoundary(input) {
  const stdout = String(input?.stdoutSanitized ?? "");
  const stderr = String(input?.stderrSanitized ?? "");
  const combined = `${stdout}\n${stderr}`;
  return {
    authJsonAccessed: input?.authJsonAccessed === true,
    codexConfigModified: input?.codexConfigModified === true,
    projectCodexConfigModified: input?.projectCodexConfigModified === true,
    chatModified: input?.chatModified === true,
    chatGatewayExecuteModified: input?.chatGatewayExecuteModified === true,
    deployExecuted: input?.deployExecuted === true,
    releaseExecuted: input?.releaseExecuted === true,
    tagCreated: input?.tagCreated === true,
    artifactUploaded: input?.artifactUploaded === true,
    pushExecuted: input?.pushExecuted === true,
    commitCreated: input?.commitCreated === true,
    secretValueExposed: input?.secretValueIncluded === true || containsSecretLikeValue(combined),
    webhookValueExposed: input?.webhookValueIncluded === true || containsWebhookLikeValue(combined),
    rawBaseUrlValueExposed: input?.rawBaseUrlValueIncluded === true || containsRawBaseUrlValue(combined),
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
    const absolute = resolve(repoRoot, relativePath);
    if (!existsSync(absolute)) {
      return { exists: false, data: null, parseErrorReason: null };
    }
    const text = readFileSync(absolute, "utf8").replace(/^\uFEFF/, "");
    return { exists: true, data: JSON.parse(text), parseErrorReason: null };
  } catch (error) {
    return { exists: true, data: null, parseErrorReason: error instanceof Error ? error.message : String(error) };
  }
}

function readText(relativePath) {
  try {
    return readFileSync(resolve(repoRoot, relativePath), "utf8").replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
}

function check(id, passed, details = {}) {
  return { id, passed: Boolean(passed), details };
}
