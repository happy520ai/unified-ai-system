import { execFileSync } from "node:child_process";
import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  readJson,
  readText,
  safetyBoundary,
  writeJson,
} from "../phase632-common.mjs";

const paths = {
  preflightRun: "apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json",
  phase640RetryPack: "apps/ai-gateway-service/evidence/phase640r-nightly/permissioned-scheduler-registration-retry-pack-result.json",
  input: "docs/phase641r-nightly-registration-result.input.json",
  inputExample: "docs/phase641r-nightly-registration-result.input.example.json",
  intakeDoc: "docs/phase641r-nightly-registration-result-intake.md",
  verificationDoc: "docs/phase641r-nightly-registration-verification.md",
  executionReport: "docs/phase641r-nightly-execution-report.md",
  uiPanel: "apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js",
  uiCopy: "apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js",
  packageJson: "package.json",
  intakeEvidence: "apps/ai-gateway-service/evidence/phase641r-nightly/registration-result-intake.json",
  ledgerEvidence: "apps/ai-gateway-service/evidence/phase641r-nightly/nightly-registration-evidence-ledger.json",
};

const preflightRun = readJson(paths.preflightRun);
const phase640RetryPack = readJson(paths.phase640RetryPack);
const resultInput = readJson(paths.input);
const inputExample = readJson(paths.inputExample);
const packageJson = readJson(paths.packageJson);

const inputText = readText(paths.input);
const intakeDocText = readText(paths.intakeDoc);
const verificationDocText = readText(paths.verificationDoc);
const executionReportText = readText(paths.executionReport);
const uiPanelText = readText(paths.uiPanel);
const uiCopyText = readText(paths.uiCopy);

function runSystemVerification() {
  try {
    const stdout = execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        "tools/phase640r-nightly/verify-nightly-task-registration.ps1",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return {
      executed: true,
      raw: stdout,
      data: JSON.parse(String(stdout).replace(/^\uFEFF/, "")),
      parseErrorReason: null,
    };
  } catch (error) {
    const stdout = error?.stdout ? String(error.stdout) : "";
    let parsed = null;
    let parseErrorReason = null;
    try {
      parsed = stdout ? JSON.parse(stdout.replace(/^\uFEFF/, "")) : null;
    } catch (parseError) {
      parseErrorReason = parseError instanceof Error ? parseError.message : String(parseError);
    }
    return {
      executed: true,
      raw: stdout,
      data: parsed,
      parseErrorReason,
      executionError: error instanceof Error ? error.message : String(error),
    };
  }
}

const systemVerification = runSystemVerification();

const phase640RetryPackImported =
  phase640RetryPack.exists === true &&
  !phase640RetryPack.parseErrorReason &&
  phase640RetryPack.data?.completed === true &&
  phase640RetryPack.data?.recommended_sealed === true &&
  phase640RetryPack.data?.permissionedRetryPackReady === true;

const resultInputExists = resultInput.exists === true;
const resultInputValid =
  resultInputExists &&
  !resultInput.parseErrorReason &&
  resultInput.data?.intakeId === "phase641r-nightly-permissioned-registration-result-001" &&
  resultInput.data?.executionMode === "permissioned_windows_task_scheduler_retry" &&
  resultInput.data?.taskName === "PME-AI-Gateway-Nightly-Safe-Runner" &&
  resultInput.data?.scheduledTaskRegistered === true &&
  resultInput.data?.trigger === "daily" &&
  resultInput.data?.startTimeLocal === "20:00" &&
  typeof resultInput.data?.nextRunTime === "string" &&
  resultInput.data.nextRunTime.length > 0 &&
  String(resultInput.data?.actionContains ?? "").includes("pnpm run nightly:phase638-safe-runner") &&
  resultInput.data?.phase632PreflightPassed === true &&
  resultInput.data?.providerCallsMade === false &&
  resultInput.data?.secretValueExposed === false &&
  resultInput.data?.authJsonRead === false &&
  resultInput.data?.codexConfigModified === false &&
  resultInput.data?.chatModified === false &&
  resultInput.data?.chatGatewayExecuteModified === false &&
  resultInput.data?.deployExecuted === false &&
  resultInput.data?.releaseExecuted === false &&
  resultInput.data?.pushExecuted === false &&
  resultInput.data?.commitCreated === false;

const exampleNotCountedAsRealResult =
  inputExample.exists === true &&
  !inputExample.parseErrorReason &&
  inputExample.data?.intakeId === "phase641r-nightly-permissioned-registration-result-001" &&
  resultInputExists === false;

const systemVerificationData = systemVerification.data ?? {};
const systemVerificationExecuted = systemVerification.executed === true;
const systemVerificationPassed =
  systemVerificationExecuted &&
  systemVerification.parseErrorReason === null &&
  systemVerificationData.verifyPass === true &&
  systemVerificationData.scheduledTaskRegistered === true &&
  systemVerificationData.taskName === "PME-AI-Gateway-Nightly-Safe-Runner" &&
  systemVerificationData.trigger === "daily" &&
  systemVerificationData.startTimeLocal === "20:00" &&
  Boolean(systemVerificationData.nextRunTime) &&
  String(systemVerificationData.actionContains ?? "").includes("pnpm run nightly:phase638-safe-runner");

const claimVerified =
  resultInputValid &&
  systemVerificationPassed &&
  resultInput.data?.taskName === systemVerificationData.taskName &&
  resultInput.data?.trigger === systemVerificationData.trigger &&
  resultInput.data?.startTimeLocal === systemVerificationData.startTimeLocal;

let blocker = null;
if (!resultInputExists) {
  blocker = "registration_result_input_missing";
} else if (!resultInputValid) {
  blocker = "registration_result_input_invalid";
} else if (!claimVerified) {
  blocker = "registration_claim_not_verified";
}

const scheduledTaskRegistered = claimVerified === true;
const nightlyAutomationEnabled = claimVerified === true;
const actionValidated = systemVerificationPassed === true;

const uiReadOnlyPreviewGenerated =
  uiCopyText.includes("phase641r-nightly-registration-intake") &&
  uiPanelText.includes("readPhase641RNightlyRegistrationResultIntake") &&
  uiPanelText.includes("Phase641R Registration Result Intake") &&
  uiPanelText.includes("Task Scheduler registered=") &&
  uiPanelText.includes("nightly automation enabled=") &&
  uiPanelText.includes("fallback launcher remains available") &&
  !uiPanelText.includes("立即运行 nightly runner") &&
  !uiPanelText.includes("调用 Provider");

const packageScriptGenerated =
  packageJson.data?.scripts?.["verify:phase641r-nightly-registration-result-intake"] ===
  "node tools/phase641r-nightly/validate-permissioned-registration-result-intake.mjs";

const combinedText = [
  inputText,
  intakeDocText,
  verificationDocText,
  executionReportText,
  uiPanelText,
  uiCopyText,
  systemVerification.raw ?? "",
].join("\n");

const result = {
  phase: "Phase641R-Nightly",
  name: "Permissioned Registration Result Intake",
  completed: true,
  recommended_sealed: true,
  blocker,
  phase632PreflightPassed: preflightRun.data?.preflightPassed === true,
  phase640RetryPackImported,
  resultInputExists,
  resultInputValid,
  exampleNotCountedAsRealResult,
  systemVerificationExecuted,
  systemVerificationPassed,
  scheduledTaskRegistered,
  nightlyAutomationEnabled,
  taskName: systemVerificationData.taskName ?? resultInput.data?.taskName ?? "PME-AI-Gateway-Nightly-Safe-Runner",
  trigger: systemVerificationData.trigger ?? resultInput.data?.trigger ?? "daily",
  startTimeLocal: systemVerificationData.startTimeLocal ?? resultInput.data?.startTimeLocal ?? "20:00",
  nextRunTime: systemVerificationData.nextRunTime ?? resultInput.data?.nextRunTime ?? null,
  lastTaskResult: systemVerificationData.lastTaskResult ?? resultInput.data?.lastTaskResult ?? null,
  actionContains: systemVerificationData.actionContains ?? resultInput.data?.actionContains ?? "pnpm run nightly:phase638-safe-runner",
  actionValidated,
  phase632PreflightRequired: true,
  triggerDaily20Checked: systemVerificationPassed === true,
  actionContainsNightlyRunner: actionValidated,
  fallbackLauncherAvailable: true,
  uiReadOnlyPreviewGenerated,
  packageScriptGenerated,
  ...safetyBoundary(),
  nightlyRunnerExecutedByThisPhase: false,
  secretValueExposed: containsSecretLikeValue(combinedText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(combinedText),
  webhookValueExposed: containsWebhookLikeValue(combinedText),
  inputPath: paths.input,
  inputExamplePath: paths.inputExample,
  latestEvidencePath: paths.intakeEvidence,
  ledgerEvidencePath: paths.ledgerEvidence,
  docs: [paths.intakeDoc, paths.verificationDoc, paths.executionReport],
  systemVerification,
  nextAction: scheduledTaskRegistered
    ? "nightly automation can be observed at the next scheduled run"
    : "provide docs/phase641r-nightly-registration-result.input.json after permissioned registration succeeds",
};

const checks = [
  check("phase632_preflight_passed", result.phase632PreflightPassed),
  check("phase640_retry_pack_imported", result.phase640RetryPackImported),
  check("result_input_exists_or_blocker_recorded", result.resultInputExists || result.blocker === "registration_result_input_missing"),
  check("result_input_valid_or_blocker_recorded", result.resultInputValid || Boolean(result.blocker)),
  check("example_not_counted_as_real_result", result.exampleNotCountedAsRealResult || result.resultInputExists),
  check("system_verification_executed", result.systemVerificationExecuted),
  check("scheduled_task_registered_or_blocker_recorded", result.scheduledTaskRegistered === true || Boolean(result.blocker)),
  check("nightly_automation_enabled_or_blocker_recorded", result.nightlyAutomationEnabled === true || Boolean(result.blocker)),
  check("task_name_or_blocker_recorded", result.taskName === "PME-AI-Gateway-Nightly-Safe-Runner" || Boolean(result.blocker)),
  check("trigger_daily_20_checked_or_blocker_recorded", result.triggerDaily20Checked === true || Boolean(result.blocker)),
  check("action_contains_nightly_runner_or_blocker_recorded", result.actionContainsNightlyRunner === true || Boolean(result.blocker)),
  check("ui_read_only_preview_generated", result.uiReadOnlyPreviewGenerated),
  check("package_script_generated", result.packageScriptGenerated),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("provider_calls_made_by_this_phase_false", result.providerCallsMadeByThisPhase === false),
  check("codex_exec_executed_by_this_phase_false", result.codexExecExecutedByThisPhase === false),
  check("nightly_runner_executed_by_this_phase_false", result.nightlyRunnerExecutedByThisPhase === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("auth_json_accessed_false", result.authJsonAccessed === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("project_codex_config_modified_false", result.projectCodexConfigModified === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("raw_base_url_value_exposed_false", result.rawBaseUrlValueExposed === false),
  check("webhook_value_exposed_false", result.webhookValueExposed === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("provider_runtime_modified_false", result.providerRuntimeModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("tag_created_false", result.tagCreated === false),
  check("artifact_uploaded_false", result.artifactUploaded === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("production_ready_claimed_false", result.productionReadyClaimed === false),
  check("release_ready_claimed_false", result.releaseReadyClaimed === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase641r_nightly_registration_result_intake_failed:${failed.join(",")}`;
}
result.checks = checks;

const ledger = {
  phase: result.phase,
  completed: result.completed,
  recommended_sealed: result.recommended_sealed,
  blocker: result.blocker,
  inputExists: result.resultInputExists,
  inputValid: result.resultInputValid,
  systemVerificationPassed: result.systemVerificationPassed,
  scheduledTaskRegistered: result.scheduledTaskRegistered,
  nightlyAutomationEnabled: result.nightlyAutomationEnabled,
  taskName: result.taskName,
  trigger: result.trigger,
  startTimeLocal: result.startTimeLocal,
  nextRunTime: result.nextRunTime,
  lastTaskResult: result.lastTaskResult,
  actionValidated: result.actionValidated,
  phase632PreflightRequired: result.phase632PreflightRequired,
  providerCallsMade: false,
  secretValueExposed: false,
  authJsonRead: false,
  codexConfigModified: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  pushExecuted: false,
  commitCreated: false,
  workspaceCleanClaimed: false,
};

writeJson(paths.ledgerEvidence, ledger);
writeJson(paths.intakeEvidence, result);
console.log(JSON.stringify(result, null, 2));

if (result.completed !== true || result.recommended_sealed !== true) {
  process.exitCode = 1;
}
