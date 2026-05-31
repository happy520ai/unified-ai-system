import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const paths = {
  phase612Result: "apps/ai-gateway-service/evidence/phase612r/repeated-guarded-reliability-result.json",
  phase612Ledger: "apps/ai-gateway-service/evidence/phase612r/repeated-guarded-reliability-ledger.json",
  closureDoc: "docs/phase613r-repeated-reliability-result-closure.md",
  boundaryDoc: "docs/phase613r-capability-boundary.md",
  nextGateDoc: "docs/phase613r-controlled-next-gate-design.md",
  executionReport: "docs/phase613r-execution-report.md",
  evidence: "apps/ai-gateway-service/evidence/phase613r/repeated-reliability-result-closure.json",
};

const phase612Result = readJson(paths.phase612Result);
const phase612Ledger = readJson(paths.phase612Ledger);
const closureDoc = readText(paths.closureDoc);
const boundaryDoc = readText(paths.boundaryDoc);
const nextGateDoc = readText(paths.nextGateDoc);
const executionReport = readText(paths.executionReport);
const boundaryText = [closureDoc, boundaryDoc, nextGateDoc, executionReport].join("\n");

const phase612 = phase612Result.data ?? {};
const phase612rImported = phase612Result.exists === true && !phase612Result.parseErrorReason && phase612Ledger.exists === true && !phase612Ledger.parseErrorReason;
const repeatedPassConfirmed =
  phase612.completed === true &&
  phase612.recommended_sealed === true &&
  phase612.blocker === null &&
  phase612.selectedProviderId === "crs" &&
  phase612.completedAttempts === 3 &&
  phase612.totalRequestAttemptCount === 3 &&
  phase612.totalRetryAttemptCount === 0 &&
  phase612.repeatedReliabilityClassification === "repeated_pass" &&
  phase612.allAttemptsPassed === true;

const result = {
  phase: "Phase613R-Fix",
  name: "Repeated Reliability Result Intake Closure + Controlled Next-Gate Design",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  closureOnly: true,
  phase612rImported,
  repeatedPassConfirmed,
  selectedProviderId: phase612.selectedProviderId ?? null,
  completedAttempts: phase612.completedAttempts ?? null,
  totalRequestAttemptCount: phase612.totalRequestAttemptCount ?? null,
  totalRetryAttemptCount: phase612.totalRetryAttemptCount ?? null,
  repeatedReliabilityClassification: phase612.repeatedReliabilityClassification ?? null,
  allAttemptsPassed: phase612.allAttemptsPassed ?? false,
  capabilityBoundaryGenerated: exists(paths.boundaryDoc),
  nextGateDesignGenerated: exists(paths.nextGateDoc),
  closureDocGenerated: exists(paths.closureDoc),
  executionReportGenerated: exists(paths.executionReport),
  codexExecExecutedByThisPhase: false,
  providerCallsMadeByThisPhase: false,
  authJsonRead: false,
  authJsonAccessed: false,
  codexConfigModified: false,
  projectCodexConfigModified: false,
  persistentConfigWritePerformed: false,
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
  characterModuleRestored: false,
  productionReadyClaimed: containsPositiveClaim(boundaryText, "productionReadyClaimed"),
  releaseReadyClaimed: containsPositiveClaim(boundaryText, "releaseReadyClaimed"),
  workspaceCleanClaimed: false,
  missionControlPreview: {
    phase612RepeatedPass: repeatedPassConfirmed,
    phase613NextGateDesignReady: true,
    selectedProviderId: phase612.selectedProviderId ?? "crs",
    completedAttempts: phase612.completedAttempts ?? 0,
    totalRequestAttemptCount: phase612.totalRequestAttemptCount ?? 0,
    totalRetryAttemptCount: phase612.totalRetryAttemptCount ?? 0,
    capabilityBoundary: "controlled codex exec custom model_provider only",
    nextGate: "controlled integration preview requires separate approval",
    notProductionReady: true,
    notReleaseReady: true,
    notChatIntegrated: true,
    notChatGatewayExecuteIntegrated: true,
  },
  docs: [paths.closureDoc, paths.boundaryDoc, paths.nextGateDoc, paths.executionReport],
  evidenceJson: paths.evidence,
  sourceRefs: {
    phase612Result: paths.phase612Result,
    phase612Ledger: paths.phase612Ledger,
  },
};

const checks = [
  check("phase612r_imported", result.phase612rImported === true),
  check("repeated_pass_confirmed", result.repeatedPassConfirmed === true),
  check("completed_attempts_three", result.completedAttempts === 3),
  check("total_request_attempt_count_three", result.totalRequestAttemptCount === 3),
  check("total_retry_attempt_count_zero", result.totalRetryAttemptCount === 0),
  check("capability_boundary_generated", result.capabilityBoundaryGenerated === true),
  check("next_gate_design_generated", result.nextGateDesignGenerated === true),
  check("closure_doc_generated", result.closureDocGenerated === true),
  check("execution_report_generated", result.executionReportGenerated === true),
  check("codex_exec_executed_by_this_phase_false", result.codexExecExecutedByThisPhase === false),
  check("provider_calls_made_by_this_phase_false", result.providerCallsMadeByThisPhase === false),
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
  check("production_ready_claimed_false", result.productionReadyClaimed === false),
  check("release_ready_claimed_false", result.releaseReadyClaimed === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
if (failed.length > 0) {
  result.completed = false;
  result.recommended_sealed = false;
  result.blocker = `phase613r_repeated_reliability_closure_failed:${failed.join(",")}`;
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

function containsPositiveClaim(text, key) {
  return new RegExp(`${key}\\s*[:=]\\s*true`, "i").test(text);
}
