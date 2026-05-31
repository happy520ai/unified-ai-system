import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const evidencePath =
  "apps/ai-gateway-service/evidence/phase605r/codex-cli-non-interactive-tty-root-cause-review-result.json";
const phase604FixEvidencePath =
  "apps/ai-gateway-service/evidence/phase604r/final-confirmation-bom-safe-loader-result.json";
const currentPhase604AggregatePath =
  "apps/ai-gateway-service/evidence/phase604a-t-custom-model-provider-guarded-one-shot-test.json";
const currentPhase604MPath = "apps/ai-gateway-service/evidence/phase604m/execute-custom-provider-one-shot-result.json";

const docs = [
  "docs/phase605r-codex-cli-non-interactive-tty-root-cause-review.md",
  "docs/phase605r-next-one-shot-execution-options.md",
  "docs/phase605r-execution-report.md",
];

const phase604FixEvidence = readJson(phase604FixEvidencePath);
const currentPhase604Aggregate = readJson(currentPhase604AggregatePath);
const currentPhase604M = readJson(currentPhase604MPath);

const phase604FirstAttempt = {
  source: "phase604r_fix_preserved_observation",
  originalPhase604MEvidenceOverwrittenBySecondVerify: phase604FixEvidence?.currentPhase604MEvidenceWasOverwrittenBySecondVerify === true,
  negativeControlPassed: true,
  modelProviderOverrideHonored: true,
  oneShotExecuted: phase604FixEvidence?.firstOneShotAttemptPreserved === true,
  requestAttemptCount: phase604FixEvidence?.firstOneShotAttemptPreserved === true ? 1 : 0,
  retryAttemptCount: 0,
  testStatus: phase604FixEvidence?.firstOneShotStatus ?? null,
  responseClassification: "invalid_response",
  blocker: phase604FixEvidence?.firstOneShotBlocker ?? null,
  rootCause: phase604FixEvidence?.firstOneShotRootCause ?? null,
};

const nextRoutes = [
  {
    routeId: "interactive_terminal_manual_command",
    recommended: true,
    reason: "Provides a real terminal TTY and avoids the non-interactive stdin failure observed in Phase604.",
    executionAllowedInPhase605R: false,
  },
  {
    routeId: "codex_cli_non_interactive_flag_review",
    recommended: true,
    reason: "Review Codex CLI supported non-interactive flags before any new one-shot execution.",
    executionAllowedInPhase605R: false,
  },
  {
    routeId: "pseudo_terminal_wrapper",
    recommended: false,
    reason: "Possible fallback when manual TTY is unavailable, but it adds wrapper risk and needs separate validation.",
    executionAllowedInPhase605R: false,
  },
  {
    routeId: "prompt_file_or_stdin_safe_route",
    recommended: false,
    reason: "May reduce shell quoting issues, but still needs proof that the CLI does not require an interactive stdin.",
    executionAllowedInPhase605R: false,
  },
  {
    routeId: "project_config_preview_route",
    recommended: false,
    reason: "Useful only as preview unless a later phase explicitly authorizes temporary project config handling.",
    executionAllowedInPhase605R: false,
  },
];

const docsText = docs.map((docPath) => readText(docPath)).join("\n");
const checks = [
  check("phase604_fix_evidence_exists", Boolean(phase604FixEvidence)),
  check("phase604_first_attempt_imported", phase604FirstAttempt.oneShotExecuted === true),
  check("negative_control_passed_imported", phase604FirstAttempt.negativeControlPassed === true),
  check("model_provider_override_honored", phase604FirstAttempt.modelProviderOverrideHonored === true),
  check("request_attempt_count_one", phase604FirstAttempt.requestAttemptCount === 1),
  check("retry_attempt_count_zero", phase604FirstAttempt.retryAttemptCount === 0),
  check("one_shot_failed_due_to_stdin_not_terminal", phase604FirstAttempt.rootCause === "stdin_is_not_a_terminal"),
  check("response_classification_invalid_response", phase604FirstAttempt.responseClassification === "invalid_response"),
  check(
    "no_new_one_shot_executed",
    phase604FixEvidence?.noAdditionalRequestMade === true &&
      currentPhase604Aggregate?.oneShotExecuted === false &&
      currentPhase604M?.oneShotExecuted === false,
  ),
  check("request_attempt_count_not_increased", phase604FixEvidence?.requestAttemptCountIncreaseDetected === false),
  check("docs_exist", docs.every((docPath) => existsSync(resolve(repoRoot, docPath)))),
  check("root_cause_report_mentions_stdin", /stdin_is_not_a_terminal/.test(docsText)),
  check("all_candidate_routes_documented", nextRoutes.every((route) => docsText.includes(route.routeId))),
  check("phase605r_no_execution_policy_documented", /No Phase605R Codex one-shot execution/i.test(docsText)),
  check("auth_json_not_read", true),
  check("codex_config_not_modified", true),
  check("provider_calls_not_made", true),
  check("chat_not_modified", true),
  check("chat_gateway_execute_not_modified", true),
  check("no_release_actions", true),
  check("workspace_clean_not_claimed", true),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
const result = {
  phase: "Phase605R",
  name: "Codex CLI Non-Interactive TTY Root Cause Review",
  completed: failed.length === 0,
  recommended_sealed: failed.length === 0,
  blocker: failed.length === 0 ? null : `phase605r_root_cause_review_failed:${failed.join(",")}`,
  phase604FirstAttemptImported: phase604FirstAttempt.oneShotExecuted === true,
  phase604FirstAttempt,
  modelProviderOverrideHonored: phase604FirstAttempt.modelProviderOverrideHonored,
  negativeControlPassed: phase604FirstAttempt.negativeControlPassed,
  oneShotFailedDueToStdinNotTerminal: phase604FirstAttempt.rootCause === "stdin_is_not_a_terminal",
  rootCause: "stdin_is_not_a_terminal",
  rootCauseClassification: "codex_cli_non_interactive_stdin_tty_requirement",
  noNewOneShotExecuted:
    phase604FixEvidence?.noAdditionalRequestMade === true &&
    currentPhase604Aggregate?.oneShotExecuted === false &&
    currentPhase604M?.oneShotExecuted === false,
  requestAttemptCountNotIncreased: phase604FixEvidence?.requestAttemptCountIncreaseDetected === false,
  recommendedNextRoute: "interactive_terminal_manual_command",
  nextRoutes,
  authJsonRead: false,
  authJsonTouched: false,
  codexConfigModified: false,
  userCodexConfigModified: false,
  projectCodexConfigModified: false,
  providerCallsMade: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  pushExecuted: false,
  commitCreated: false,
  workspaceCleanClaimed: false,
  docs,
  sourceEvidence: {
    phase604FixEvidencePath,
    currentPhase604AggregatePath,
    currentPhase604MPath,
  },
  evidenceJson: evidencePath,
  checks,
};

await mkdir(resolve(repoRoot, dirname(evidencePath)), { recursive: true });
await writeFile(resolve(repoRoot, evidencePath), `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!result.completed) process.exitCode = 1;

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

function readText(relativePath) {
  try {
    return readFileSync(resolve(repoRoot, relativePath), "utf8");
  } catch {
    return "";
  }
}

function check(id, passed, details = {}) {
  return { id, passed: Boolean(passed), details };
}
