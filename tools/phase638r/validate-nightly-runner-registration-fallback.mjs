import {
  check,
  containsRawBaseUrlValue,
  containsSecretLikeValue,
  containsWebhookLikeValue,
  finalize,
  has,
  readJson,
  readText,
  safetyBoundary,
} from "../phase632-common.mjs";

const paths = {
  registrationEvidence: "apps/ai-gateway-service/evidence/phase638r/windows-task-registration-result.json",
  diagnosisDoc: "docs/phase638r-fix-windows-task-access-denied-diagnosis.md",
  fallbackDoc: "docs/phase638r-fix-nightly-runner-fallback-options.md",
  report: "docs/phase638r-fix-execution-report.md",
  fallbackCmd: "tools/phase638r/run-nightly-safe-runner-once.cmd",
  fallbackPs1: "tools/phase638r/run-nightly-safe-runner-once.ps1",
  evidence: "apps/ai-gateway-service/evidence/phase638r/nightly-runner-registration-fallback-result.json",
};

const registrationEvidence = readJson(paths.registrationEvidence);
const diagnosisDoc = readText(paths.diagnosisDoc);
const fallbackDoc = readText(paths.fallbackDoc);
const report = readText(paths.report);
const fallbackCmd = readText(paths.fallbackCmd);
const fallbackPs1 = readText(paths.fallbackPs1);
const combinedText = [
  diagnosisDoc,
  fallbackDoc,
  report,
  fallbackCmd,
  fallbackPs1,
].join("\n");

const fallbackCmdGenerated =
  has(fallbackCmd, "pnpm run preflight:phase632-token-saving") &&
  has(fallbackCmd, "pnpm run nightly:phase638-safe-runner");
const fallbackPs1Generated =
  has(fallbackPs1, "preflight:phase632-token-saving") &&
  has(fallbackPs1, "nightly:phase638-safe-runner") &&
  !/while\s*\(|for\s*\(/i.test(fallbackPs1);
const fallbackDocsGenerated =
  has(diagnosisDoc, "originalBlocker=windows_task_scheduler_access_denied") &&
  has(diagnosisDoc, "scheduledTaskRegistered=false") &&
  has(diagnosisDoc, "Get-ScheduledTask task not found") &&
  has(diagnosisDoc, "schtasks /Query task not found") &&
  has(fallbackDoc, "Task Scheduler registration is currently unavailable") &&
  has(report, "fallbackCmdGenerated=true");

const result = {
  phase: "Phase638R-Fix",
  name: "Nightly Runner Registration Fallback Pack",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  originalBlocker: registrationEvidence.data?.blocker ?? null,
  registrationEvidenceImported: registrationEvidence.exists === true && !registrationEvidence.parseErrorReason,
  scheduledTaskRegistered: registrationEvidence.data?.scheduledTaskRegistered === true,
  taskName: registrationEvidence.data?.taskName ?? null,
  fallbackCmdGenerated,
  fallbackPs1Generated,
  fallbackDocsGenerated,
  phase632PreflightRequired:
    registrationEvidence.data?.phase632PreflightRequired === true &&
    has(fallbackCmd, "preflight:phase632-token-saving") &&
    has(fallbackPs1, "preflight:phase632-token-saving"),
  ...safetyBoundary(),
  secretValueExposed: containsSecretLikeValue(combinedText),
  rawBaseUrlValueExposed: containsRawBaseUrlValue(combinedText),
  webhookValueExposed: containsWebhookLikeValue(combinedText),
  docs: ["diagnosisDoc", paths.fallbackDoc, paths.report],
  fallbackLaunchers: [paths.fallbackCmd, paths.fallbackPs1],
  evidenceJson: paths.evidence,
  sourceRegistrationEvidence: paths.registrationEvidence,
};

const checks = [
  check("original_blocker_windows_task_scheduler_access_denied", result.originalBlocker === "windows_task_scheduler_access_denied"),
  check("scheduled_task_registered_false", result.scheduledTaskRegistered === false),
  check("fallback_cmd_generated", result.fallbackCmdGenerated),
  check("fallback_ps1_generated", result.fallbackPs1Generated),
  check("fallback_docs_generated", result.fallbackDocsGenerated),
  check("phase632_preflight_required", result.phase632PreflightRequired),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("codex_config_modified_false", result.codexConfigModified === false),
  check("chat_modified_false", result.chatModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("push_executed_false", result.pushExecuted === false),
  check("commit_created_false", result.commitCreated === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

finalize(result, checks, paths.evidence, "phase638r_registration_fallback_failed");
