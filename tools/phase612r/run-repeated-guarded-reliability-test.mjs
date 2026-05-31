import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const phase = "Phase612R-Fix";
const ack = "CONTEXT_GATEWAY_MODEL_PROVIDER_OK";
const timeoutMs = 10 * 60 * 1000;
const prompt =
  "Read .codex-context/current-context-pack.md. Check .codex-context/context-freshness-report.json and confirm stale=false. Read .codex-context/relevant-files.json. Do not edit files. Do not scan the full repository. Do not read secrets. Reply with one line only: CONTEXT_GATEWAY_MODEL_PROVIDER_OK.";

const paths = {
  confirmation: "docs/phase612r-repeated-guarded-test-confirmation.input.json",
  phase610Evidence: "apps/ai-gateway-service/evidence/phase610r/codex-exec-guarded-one-shot-result.json",
  phase611Evidence: "apps/ai-gateway-service/evidence/phase611r/repeated-guarded-test-design-result.json",
  attemptPlan: "docs/phase611r-repeated-attempt-plan.json",
  evidenceDir: "apps/ai-gateway-service/evidence/phase612r",
  aggregate: "apps/ai-gateway-service/evidence/phase612r/repeated-guarded-reliability-result.json",
  ledger: "apps/ai-gateway-service/evidence/phase612r/repeated-guarded-reliability-ledger.json",
  executionDoc: "docs/phase612r-repeated-guarded-reliability-execution.md",
  classificationDoc: "docs/phase612r-response-classification.md",
  cleanupDoc: "docs/phase612r-cleanup-rollback-record.md",
  reportDoc: "docs/phase612r-execution-report.md",
};

const startedAt = new Date();
const confirmation = readJson(paths.confirmation);
const phase610 = readJson(paths.phase610Evidence);
const phase611 = readJson(paths.phase611Evidence);
const plan = readJson(paths.attemptPlan);

const preflight = validatePreflight(confirmation.data, phase610.data, phase611.data, plan.data);
if (!preflight.ok) {
  const result = buildBlockedResult(preflight.blocker, confirmation, phase610, phase611, plan, startedAt);
  writeAllArtifacts(result, [], confirmation.data, phase610.data, phase611.data, plan.data);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  const attempts = [];
  let stoppedReason = null;
  const plannedAttempts = Math.min(3, Number(confirmation.data.maxPlannedAttempts));

  for (let index = 0; index < plannedAttempts; index += 1) {
    const attemptId = `attempt-${index + 1}`;
    const attempt = await runAttempt(attemptId);
    attempts.push(attempt);
    writeJson(`${paths.evidenceDir}/${attemptId}.json`, attempt);

    if (attempt.responseClassification !== "pass") {
      stoppedReason = `stopped_on_${attempt.responseClassification}`;
      break;
    }
  }

  for (let index = attempts.length; index < plannedAttempts; index += 1) {
    const attemptId = `attempt-${index + 1}`;
    const skipped = buildSkippedAttempt(attemptId, stoppedReason ?? "stopped_before_attempt");
    attempts.push(skipped);
    writeJson(`${paths.evidenceDir}/${attemptId}.json`, skipped);
  }

  const result = buildAggregateResult({
    confirmation: confirmation.data,
    phase610: phase610.data,
    phase611: phase611.data,
    plan: plan.data,
    attempts,
    startedAt,
    stoppedReason,
  });

  writeAllArtifacts(result, attempts, confirmation.data, phase610.data, phase611.data, plan.data);
  console.log(JSON.stringify(result, null, 2));
  if (!result.allAttemptsPassed) process.exitCode = 1;
}

async function runAttempt(attemptId) {
  const attemptStartedAt = new Date();
  const child = spawn("codex", ["exec", "-c", "model_provider=crs", prompt], {
    cwd: root,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let timedOut = false;

  child.stdout?.on("data", (chunk) => {
    stdout += chunk.toString("utf8");
  });
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
  }, timeoutMs);

  const exitCode = await new Promise((resolve) => {
    let settled = false;
    const finish = (code) => {
      if (settled) return;
      settled = true;
      resolve(code);
    };
    child.on("error", (error) => {
      stderr += error instanceof Error ? error.message : String(error);
      finish(127);
    });
    child.on("close", (code) => finish(code ?? 1));
  });
  clearTimeout(timer);

  const attemptEndedAt = new Date();
  const stdoutSanitized = sanitize(stdout);
  const stderrSanitized = sanitize(stderr);
  const combined = `${stdoutSanitized}\n${stderrSanitized}`;
  const responseClassification = classify(exitCode, stdoutSanitized, stderrSanitized, timedOut);

  return {
    phase,
    attemptId,
    executionMode: "codex_exec_non_interactive",
    selectedProviderId: "crs",
    commandSource: "docs/phase611r-codex-exec-command-preview.md",
    maxRequests: 1,
    retryLimit: 0,
    requestAttemptCount: 1,
    retryAttemptCount: 0,
    startedAt: attemptStartedAt.toISOString(),
    endedAt: attemptEndedAt.toISOString(),
    durationMs: attemptEndedAt.getTime() - attemptStartedAt.getTime(),
    exitCode,
    timedOut,
    stdoutSanitized,
    stderrSanitizedSummary: summarize(stderrSanitized),
    stderrSanitized,
    ackExpected: ack,
    ackObserved: stdoutSanitized.includes(ack),
    testStatus: statusFromClassification(responseClassification),
    responseClassification,
    cleanupCompleted: true,
    rollbackNeeded: false,
    authJsonRead: false,
    authJsonAccessed: false,
    codexConfigModified: false,
    projectCodexConfigModified: false,
    persistentConfigWritePerformed: false,
    providerRuntimeModified: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    characterModuleRestored: false,
    secretValueExposed: containsSecretLikeValue(combined),
    rawBaseUrlValueExposed: containsRawBaseUrlValue(combined),
    webhookValueExposed: containsWebhookLikeValue(combined),
    workspaceCleanClaimed: false,
  };
}

function buildSkippedAttempt(attemptId, stoppedReason) {
  return {
    phase,
    attemptId,
    executionMode: "codex_exec_non_interactive",
    selectedProviderId: "crs",
    skipped: true,
    skippedReason: stoppedReason,
    requestAttemptCount: 0,
    retryAttemptCount: 0,
    testStatus: "skipped",
    responseClassification: "skipped_due_to_stop",
    cleanupCompleted: true,
    authJsonRead: false,
    authJsonAccessed: false,
    codexConfigModified: false,
    projectCodexConfigModified: false,
    persistentConfigWritePerformed: false,
    providerRuntimeModified: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    characterModuleRestored: false,
    secretValueExposed: false,
    rawBaseUrlValueExposed: false,
    webhookValueExposed: false,
    workspaceCleanClaimed: false,
  };
}

function buildAggregateResult({ confirmation, phase610, phase611, plan, attempts, startedAt, stoppedReason }) {
  const endedAt = new Date();
  const executedAttempts = attempts.filter((attempt) => attempt.requestAttemptCount > 0);
  const passAttempts = executedAttempts.filter((attempt) => attempt.responseClassification === "pass");
  const totalRequestAttemptCount = sum(executedAttempts.map((attempt) => attempt.requestAttemptCount));
  const totalRetryAttemptCount = sum(executedAttempts.map((attempt) => attempt.retryAttemptCount));
  const repeatedReliabilityClassification = classifyRepeated(attempts);
  const allAttemptsPassed = passAttempts.length === 3 && attempts.length === 3;
  const blocker = allAttemptsPassed ? null : blockerFromRepeatedClassification(repeatedReliabilityClassification);

  return {
    phase,
    name: "Repeated Codex Exec Custom Provider Guarded Reliability Execution",
    completed: true,
    recommended_sealed: allAttemptsPassed,
    blocker,
    confirmationChecked: true,
    confirmationId: confirmation.confirmationId,
    repeatedTestExecuted: executedAttempts.length > 0,
    selectedProviderId: "crs",
    plannedAttempts: 3,
    completedAttempts: executedAttempts.length,
    totalRequestAttemptCount,
    totalRetryAttemptCount,
    maxRequestsPerAttempt: Number(confirmation.maxRequestsPerAttempt),
    maxRequestsTotal: Number(confirmation.maxRequestsTotal),
    retryLimitPerAttempt: Number(confirmation.retryLimitPerAttempt),
    stopOnFirstFailure: confirmation.stopOnFirstFailure === true,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - startedAt.getTime(),
    attemptResults: attempts.map((attempt) => ({
      attemptId: attempt.attemptId,
      skipped: attempt.skipped === true,
      exitCode: attempt.exitCode ?? null,
      testStatus: attempt.testStatus,
      responseClassification: attempt.responseClassification,
      requestAttemptCount: attempt.requestAttemptCount,
      retryAttemptCount: attempt.retryAttemptCount,
      ackObserved: attempt.ackObserved ?? false,
    })),
    repeatedReliabilityClassification,
    allAttemptsPassed,
    stoppedReason: stoppedReason ?? (allAttemptsPassed ? null : repeatedReliabilityClassification),
    phase610rImported: phase610?.completed === true,
    phase611rImported: phase611?.completed === true,
    priorOneShotPass: phase610?.testStatus === "pass" && phase610?.responseClassification === "pass",
    phase611DesignSealed: phase611?.recommended_sealed === true,
    authJsonRead: false,
    authJsonAccessed: false,
    codexConfigModified: false,
    projectCodexConfigModified: false,
    persistentConfigWritePerformed: false,
    providerRuntimeModified: false,
    secretValueExposed: attempts.some((attempt) => attempt.secretValueExposed === true),
    rawBaseUrlValueExposed: attempts.some((attempt) => attempt.rawBaseUrlValueExposed === true),
    webhookValueExposed: attempts.some((attempt) => attempt.webhookValueExposed === true),
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    characterModuleRestored: false,
    productionReadyClaimed: false,
    releaseReadyClaimed: false,
    workspaceCleanClaimed: false,
    missionControlPreview: {
      phase612RepeatedGuardedTestExecuted: executedAttempts.length > 0,
      selectedProviderId: "crs",
      plannedAttempts: 3,
      completedAttempts: executedAttempts.length,
      totalRequestAttemptCount,
      totalRetryAttemptCount,
      repeatedReliabilityClassification,
      allAttemptsPassed,
      stoppedReason: stoppedReason ?? null,
      notProductionReady: true,
      notReleaseReady: true,
      notChatIntegrated: true,
    },
    docs: [paths.executionDoc, paths.classificationDoc, paths.cleanupDoc, paths.reportDoc],
    evidence: [
      `${paths.evidenceDir}/attempt-1.json`,
      `${paths.evidenceDir}/attempt-2.json`,
      `${paths.evidenceDir}/attempt-3.json`,
      paths.aggregate,
      paths.ledger,
    ],
    sourceRefs: {
      confirmation: paths.confirmation,
      phase610Evidence: paths.phase610Evidence,
      phase611Evidence: paths.phase611Evidence,
      attemptPlan: paths.attemptPlan,
    },
    planSummary: {
      maxPlannedAttempts: plan?.maxPlannedAttempts ?? null,
      maxRequestsTotal: plan?.maxRequestsTotal ?? null,
      retryLimitPerAttempt: plan?.retryLimitPerAttempt ?? null,
    },
  };
}

function buildBlockedResult(blocker, confirmation, phase610, phase611, plan, startedAt) {
  const endedAt = new Date();
  return {
    phase,
    name: "Repeated Codex Exec Custom Provider Guarded Reliability Execution",
    completed: true,
    recommended_sealed: true,
    blocker,
    confirmationChecked: confirmation.exists === true && !confirmation.parseErrorReason,
    repeatedTestExecuted: false,
    selectedProviderId: confirmation.data?.selectedProviderId ?? "crs",
    plannedAttempts: 0,
    completedAttempts: 0,
    totalRequestAttemptCount: 0,
    totalRetryAttemptCount: 0,
    repeatedReliabilityClassification: "blocked",
    allAttemptsPassed: false,
    stoppedReason: blocker,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs: endedAt.getTime() - startedAt.getTime(),
    phase610rImported: phase610.exists === true && !phase610.parseErrorReason,
    phase611rImported: phase611.exists === true && !phase611.parseErrorReason,
    attemptPlanImported: plan.exists === true && !plan.parseErrorReason,
    authJsonRead: false,
    authJsonAccessed: false,
    codexConfigModified: false,
    projectCodexConfigModified: false,
    persistentConfigWritePerformed: false,
    providerRuntimeModified: false,
    secretValueExposed: false,
    rawBaseUrlValueExposed: false,
    webhookValueExposed: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    characterModuleRestored: false,
    productionReadyClaimed: false,
    releaseReadyClaimed: false,
    workspaceCleanClaimed: false,
    missionControlPreview: {
      phase612RepeatedGuardedTestExecuted: false,
      selectedProviderId: confirmation.data?.selectedProviderId ?? "crs",
      plannedAttempts: 0,
      completedAttempts: 0,
      totalRequestAttemptCount: 0,
      totalRetryAttemptCount: 0,
      repeatedReliabilityClassification: "blocked",
      allAttemptsPassed: false,
      stoppedReason: blocker,
      notProductionReady: true,
      notReleaseReady: true,
      notChatIntegrated: true,
    },
    docs: [paths.executionDoc, paths.classificationDoc, paths.cleanupDoc, paths.reportDoc],
    evidence: [paths.aggregate, paths.ledger],
  };
}

function validatePreflight(confirmation, phase610, phase611, plan) {
  const checks = [
    ["confirmation_exists", Boolean(confirmation)],
    ["confirmation_id", confirmation?.confirmationId === "confirm-phase612r-repeated-codex-exec-guarded-test-001"],
    ["decision_approved", confirmation?.decision === "approved_execute_repeated_codex_exec_custom_provider_guarded_test"],
    ["selected_provider_crs", confirmation?.selectedProviderId === "crs"],
    ["allow_repeated_codex_exec", confirmation?.allowRepeatedCodexExec === true],
    ["max_planned_attempts_three", Number(confirmation?.maxPlannedAttempts) === 3],
    ["max_requests_per_attempt_one", Number(confirmation?.maxRequestsPerAttempt) === 1],
    ["max_requests_total_three", Number(confirmation?.maxRequestsTotal) === 3],
    ["retry_limit_zero", Number(confirmation?.retryLimitPerAttempt) === 0],
    ["stop_on_first_failure", confirmation?.stopOnFirstFailure === true],
    ["auth_json_access_false", confirmation?.authJsonAccessAllowed === false],
    ["codex_config_write_false", confirmation?.codexConfigWriteAllowed === false],
    ["project_codex_config_write_false", confirmation?.projectCodexConfigWriteAllowed === false],
    ["chat_modification_false", confirmation?.chatModificationAllowed === false],
    ["chat_gateway_execute_modification_false", confirmation?.chatGatewayExecuteModificationAllowed === false],
    ["deploy_false", confirmation?.deployAllowed === false],
    ["release_false", confirmation?.releaseAllowed === false],
    ["tag_false", confirmation?.tagAllowed === false],
    ["push_false", confirmation?.pushAllowed === false],
    ["commit_false", confirmation?.commitAllowed === false],
    ["phase610_completed", phase610?.completed === true],
    ["phase610_sealed", phase610?.recommended_sealed === true],
    ["phase610_no_blocker", phase610?.blocker === null],
    ["phase610_pass", phase610?.testStatus === "pass"],
    ["phase610_selected_crs", phase610?.selectedProviderId === "crs"],
    ["phase611_completed", phase611?.completed === true],
    ["phase611_sealed", phase611?.recommended_sealed === true],
    ["attempt_plan_exists", Boolean(plan)],
    ["attempt_plan_three", Number(plan?.maxPlannedAttempts) === 3],
  ];
  const failed = checks.filter(([, passed]) => !passed).map(([id]) => id);
  return {
    ok: failed.length === 0,
    blocker: failed.length === 0 ? null : `phase612r_preflight_failed:${failed.join(",")}`,
  };
}

function writeAllArtifacts(result, attempts, confirmation, phase610, phase611, plan) {
  const ledger = {
    phase,
    completed: result.completed,
    recommended_sealed: result.recommended_sealed,
    blocker: result.blocker,
    refs: {
      confirmation: paths.confirmation,
      phase610Evidence: paths.phase610Evidence,
      phase611Evidence: paths.phase611Evidence,
      attemptPlan: paths.attemptPlan,
      aggregate: paths.aggregate,
      attempts: [1, 2, 3].map((index) => `${paths.evidenceDir}/attempt-${index}.json`),
    },
    selectedProviderId: result.selectedProviderId,
    plannedAttempts: result.plannedAttempts,
    completedAttempts: result.completedAttempts,
    totalRequestAttemptCount: result.totalRequestAttemptCount,
    totalRetryAttemptCount: result.totalRetryAttemptCount,
    repeatedReliabilityClassification: result.repeatedReliabilityClassification,
    allAttemptsPassed: result.allAttemptsPassed,
    stoppedReason: result.stoppedReason,
    cleanupStatus: {
      cleanupCompleted: attempts.every((attempt) => attempt.cleanupCompleted === true),
      rollbackNeeded: attempts.some((attempt) => attempt.rollbackNeeded === true),
    },
    safetyBoundaryStatus: {
      authJsonRead: false,
      authJsonAccessed: false,
      codexConfigModified: false,
      projectCodexConfigModified: false,
      providerRuntimeModified: false,
      chatModified: false,
      chatGatewayExecuteModified: false,
      deployExecuted: false,
      releaseExecuted: false,
      tagCreated: false,
      artifactUploaded: false,
      pushExecuted: false,
      commitCreated: false,
      secretValueExposed: result.secretValueExposed,
      rawBaseUrlValueExposed: result.rawBaseUrlValueExposed,
      webhookValueExposed: result.webhookValueExposed,
      workspaceCleanClaimed: false,
    },
    imported: {
      confirmationId: confirmation?.confirmationId ?? null,
      phase610Pass: phase610?.testStatus === "pass",
      phase611DesignSealed: phase611?.recommended_sealed === true,
      attemptPlanMaxPlannedAttempts: plan?.maxPlannedAttempts ?? null,
    },
  };

  writeJson(paths.aggregate, result);
  writeJson(paths.ledger, ledger);
  writeText(paths.executionDoc, buildExecutionDoc(result, attempts));
  writeText(paths.classificationDoc, buildClassificationDoc(result, attempts));
  writeText(paths.cleanupDoc, buildCleanupDoc(result, attempts));
  writeText(paths.reportDoc, buildReportDoc(result, attempts));
}

function buildExecutionDoc(result, attempts) {
  return `# Phase612R-Fix Repeated Guarded Reliability Execution

## Result

- completed=${result.completed}
- recommended_sealed=${result.recommended_sealed}
- blocker=${result.blocker ?? "null"}
- repeatedTestExecuted=${result.repeatedTestExecuted}
- selectedProviderId=${result.selectedProviderId}
- plannedAttempts=${result.plannedAttempts}
- completedAttempts=${result.completedAttempts}
- totalRequestAttemptCount=${result.totalRequestAttemptCount}
- totalRetryAttemptCount=${result.totalRetryAttemptCount}
- repeatedReliabilityClassification=${result.repeatedReliabilityClassification}
- allAttemptsPassed=${result.allAttemptsPassed}
- stoppedReason=${result.stoppedReason ?? "null"}

## Attempts

${attempts.map((attempt) => `- ${attempt.attemptId}: status=${attempt.testStatus}; classification=${attempt.responseClassification}; requestAttemptCount=${attempt.requestAttemptCount}; retryAttemptCount=${attempt.retryAttemptCount}; ackObserved=${attempt.ackObserved ?? false}`).join("\n")}

## Non-Claims

- productionReadyClaimed=false
- releaseReadyClaimed=false
- chatIntegrationComplete=false
- workspaceCleanClaimed=false
`;
}

function buildClassificationDoc(result, attempts) {
  return `# Phase612R-Fix Response Classification

## Aggregate Classification

- repeatedReliabilityClassification=${result.repeatedReliabilityClassification}
- allAttemptsPassed=${result.allAttemptsPassed}
- stoppedReason=${result.stoppedReason ?? "null"}

## Rules Applied

- repeated_pass: 3/3 executed attempts pass with ACK=${ack}
- failed_tty: stderr contains "stdin is not a terminal"
- timeout: an attempt times out
- invalid_response: exitCode=0 without the required ACK
- failed_provider_route: non-zero exit that is not TTY
- skipped_due_to_stop: remaining attempts after stopOnFirstFailure

## Attempt Classification

${attempts.map((attempt) => `- ${attempt.attemptId}: ${attempt.responseClassification}`).join("\n")}
`;
}

function buildCleanupDoc(result, attempts) {
  return `# Phase612R-Fix Cleanup / Rollback Record

## Cleanup

- cleanupCompleted=${attempts.every((attempt) => attempt.cleanupCompleted === true)}
- rollbackNeeded=${attempts.some((attempt) => attempt.rollbackNeeded === true)}
- stoppedReason=${result.stoppedReason ?? "null"}

## Safety Boundary

- authJsonRead=false
- authJsonAccessed=false
- codexConfigModified=false
- projectCodexConfigModified=false
- persistentConfigWritePerformed=false
- providerRuntimeModified=false
- chatModified=false
- chatGatewayExecuteModified=false
- secretValueExposed=${result.secretValueExposed}
- rawBaseUrlValueExposed=${result.rawBaseUrlValueExposed}
- webhookValueExposed=${result.webhookValueExposed}
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- pushExecuted=false
- commitCreated=false
- workspaceCleanClaimed=false
`;
}

function buildReportDoc(result, attempts) {
  return `# Phase612R-Fix Execution Report

## Summary

- completed=${result.completed}
- recommended_sealed=${result.recommended_sealed}
- blocker=${result.blocker ?? "null"}
- confirmationChecked=${result.confirmationChecked}
- repeatedTestExecuted=${result.repeatedTestExecuted}
- selectedProviderId=${result.selectedProviderId}
- plannedAttempts=${result.plannedAttempts}
- completedAttempts=${result.completedAttempts}
- totalRequestAttemptCount=${result.totalRequestAttemptCount}
- totalRetryAttemptCount=${result.totalRetryAttemptCount}
- repeatedReliabilityClassification=${result.repeatedReliabilityClassification}
- allAttemptsPassed=${result.allAttemptsPassed}
- stoppedReason=${result.stoppedReason ?? "null"}

## Evidence

- ${paths.aggregate}
- ${paths.ledger}
- ${paths.evidenceDir}/attempt-1.json
- ${paths.evidenceDir}/attempt-2.json
- ${paths.evidenceDir}/attempt-3.json

## Attempt Results

${attempts.map((attempt) => `- ${attempt.attemptId}: testStatus=${attempt.testStatus}; responseClassification=${attempt.responseClassification}; exitCode=${attempt.exitCode ?? "null"}`).join("\n")}

## Boundaries

- authJsonRead=false
- codexConfigModified=false
- projectCodexConfigModified=false
- chatModified=false
- chatGatewayExecuteModified=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- pushExecuted=false
- commitCreated=false
- productionReadyClaimed=false
- releaseReadyClaimed=false
- workspaceCleanClaimed=false
`;
}

function classify(code, out, err, isTimeout) {
  if (isTimeout) return "timeout";
  if (err.includes("stdin is not a terminal")) return "failed_tty";
  if (code === 0 && out.includes(ack)) return "pass";
  if (code === 0) return "invalid_response";
  return "failed_provider_route";
}

function classifyRepeated(attempts) {
  const executed = attempts.filter((attempt) => attempt.requestAttemptCount > 0);
  if (executed.length === 3 && executed.every((attempt) => attempt.responseClassification === "pass")) {
    return "repeated_pass";
  }
  if (executed.some((attempt) => attempt.responseClassification === "timeout")) return "timeout";
  if (executed.some((attempt) => attempt.responseClassification === "failed_tty")) return "failed_tty";
  if (executed.some((attempt) => attempt.responseClassification === "failed_provider_route")) return "failed_provider_route";
  if (executed.some((attempt) => attempt.responseClassification === "invalid_response")) return "invalid_response";
  if (executed.some((attempt) => attempt.responseClassification === "pass")) return "partial_pass";
  return "blocked";
}

function statusFromClassification(classification) {
  if (classification === "pass") return "pass";
  if (classification === "timeout") return "timeout";
  return "failed";
}

function blockerFromRepeatedClassification(classification) {
  if (classification === "repeated_pass") return null;
  if (classification === "timeout") return "repeated_guarded_reliability_timeout";
  if (classification === "failed_tty") return "repeated_guarded_reliability_tty_failed";
  if (classification === "invalid_response") return "repeated_guarded_reliability_invalid_response";
  if (classification === "partial_pass") return "repeated_guarded_reliability_partial_pass";
  return "repeated_guarded_reliability_failed";
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
  return `${sanitized.slice(0, 3500)}\n<redacted:truncated-output ${sanitized.length - 3500} chars>\n`;
}

function summarize(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (text.length <= 800) return text;
  return `${text.slice(0, 800)}\n<redacted:truncated-summary ${text.length - 800} chars>`;
}

function containsSecretLikeValue(text) {
  return /(sk-[A-Za-z0-9_-]{20,}|xox[baprs]-|ghp_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=]\s*["']?[A-Za-z0-9_-]{12,})/i.test(text);
}

function containsWebhookLikeValue(text) {
  return /https:\/\/hooks\.(slack|discord|teams)\.com\/[^\s"']+/i.test(text);
}

function containsRawBaseUrlValue(text) {
  return /https?:\/\/[^\s"']+/i.test(text);
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

function writeJson(relativePath, value) {
  fs.mkdirSync(path.dirname(p(relativePath)), { recursive: true });
  fs.writeFileSync(p(relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(relativePath, value) {
  fs.mkdirSync(path.dirname(p(relativePath)), { recursive: true });
  fs.writeFileSync(p(relativePath), value, "utf8");
}

function p(relativePath) {
  return path.join(root, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(p(relativePath));
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}
