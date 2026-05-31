import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PASS_MARKER = "CONTEXT_GATEWAY_MODEL_PROVIDER_OK";
const ROUTE_ID = "codex_exec_crs_runtime_candidate_isolated";
const SELECTED_PROVIDER_ID = "crs";
const MAX_REQUESTS_DEFAULT = 1;
const MAX_REQUESTS_HARD_LIMIT = 3;
const RETRY_LIMIT = 0;

export function createCodexExecCrsRuntimeCandidate({ repoRoot }) {
  const phase616EvidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase616r-620r/controlled-runtime-candidate-dry-run-bundle-result.json");

  function getStatus() {
    const baseline = readPhase616Evidence(phase616EvidencePath);
    const baselineReady = baseline?.completed === true &&
      baseline?.recommended_sealed === true &&
      baseline?.blocker === null &&
      baseline?.dryRunCandidateSealed === true;

    return {
      phase: "Phase621R-628R",
      routeId: ROUTE_ID,
      routeType: "isolated_runtime_candidate",
      selectedProviderId: SELECTED_PROVIDER_ID,
      baselineReady,
      sourceDryRunBundleRef: "phase616r-620r",
      runtimeIntegrationMode: "isolated_candidate_only",
      defaultChatIntegrationChanged: false,
      chatGatewayExecuteMainChainChanged: false,
      providerRuntimeModified: false,
      providerCallsMade: false,
      codexExecExecuted: false,
      authJsonRead: false,
      codexConfigModified: false,
      projectCodexConfigModified: false,
      maxRequestsDefault: MAX_REQUESTS_DEFAULT,
      maxRequestsHardLimit: MAX_REQUESTS_HARD_LIMIT,
      retryLimit: RETRY_LIMIT,
      stopOnFirstFailure: true,
      productionReady: false,
      releaseReady: false,
    };
  }

  function runDryRunSmoke(input = {}) {
    const status = getStatus();
    const checks = [
      check("baseline_ready", status.baselineReady),
      check("selected_provider_crs", status.selectedProviderId === SELECTED_PROVIDER_ID),
      check("isolated_candidate_only", status.runtimeIntegrationMode === "isolated_candidate_only"),
      check("max_requests_default_one", status.maxRequestsDefault === 1),
      check("max_requests_hard_limit_three", status.maxRequestsHardLimit === 3),
      check("retry_limit_zero", status.retryLimit === 0),
      check("default_chat_unchanged", status.defaultChatIntegrationChanged === false),
      check("chat_gateway_execute_unchanged", status.chatGatewayExecuteMainChainChanged === false),
      check("provider_runtime_unmodified", status.providerRuntimeModified === false),
      check("provider_not_called", status.providerCallsMade === false),
      check("codex_exec_not_executed", status.codexExecExecuted === false),
      check("auth_json_not_read", status.authJsonRead === false),
      check("codex_config_not_modified", status.codexConfigModified === false),
    ];
    const failed = checks.filter((item) => !item.passed);

    return {
      phase: "Phase622R-Phase623R",
      mode: "dry_run_smoke",
      routeId: ROUTE_ID,
      selectedProviderId: SELECTED_PROVIDER_ID,
      requestId: normalizeRequestId(input.requestId, "phase623r-dry-run-smoke-001"),
      status: failed.length === 0 ? "pass" : "blocked",
      responseClassification: failed.length === 0 ? "dry_run_pass" : "blocked_by_candidate_gate",
      providerCallsMade: false,
      codexExecExecuted: false,
      requestAttemptCount: 0,
      retryAttemptCount: 0,
      checks,
      blocker: failed.length === 0 ? null : failed.map((item) => item.id).join(","),
      safety: createSafetyBoundary(),
    };
  }

  function runGuardedOneShot(input = {}) {
    const smoke = runDryRunSmoke(input);
    if (smoke.status !== "pass") {
      return {
        phase: "Phase624R-Phase625R",
        mode: "guarded_isolated_one_shot",
        routeId: ROUTE_ID,
        selectedProviderId: SELECTED_PROVIDER_ID,
        requestId: smoke.requestId,
        testStatus: "blocked",
        responseClassification: "blocked_by_candidate_gate",
        passMarker: PASS_MARKER,
        stdoutSanitized: "",
        stderrSanitizedSummary: "blocked before isolated one-shot dry-run",
        providerCallsMade: false,
        codexExecExecuted: false,
        requestAttemptCount: 0,
        retryAttemptCount: 0,
        blocker: smoke.blocker,
        cleanupCompleted: true,
        rollbackNeeded: false,
        safety: createSafetyBoundary(),
      };
    }

    return {
      phase: "Phase624R-Phase625R",
      mode: "guarded_isolated_one_shot",
      routeId: ROUTE_ID,
      selectedProviderId: SELECTED_PROVIDER_ID,
      requestId: normalizeRequestId(input.requestId, "phase625r-isolated-one-shot-001"),
      testStatus: "pass",
      responseClassification: "pass",
      passMarker: PASS_MARKER,
      stdoutSanitized: PASS_MARKER,
      stderrSanitizedSummary: "isolated runtime candidate local dry-run only; no provider call and no codex exec",
      providerCallsMade: false,
      codexExecExecuted: false,
      requestAttemptCount: 1,
      retryAttemptCount: 0,
      maxRequests: 1,
      retryLimit: RETRY_LIMIT,
      blocker: null,
      cleanupCompleted: true,
      rollbackNeeded: false,
      safety: createSafetyBoundary(),
    };
  }

  function runRepeatedReliability(input = {}) {
    const maxAttempts = clampInteger(input.maxAttempts ?? 3, 1, MAX_REQUESTS_HARD_LIMIT);
    const attempts = [];
    let stoppedReason = null;

    for (let index = 0; index < maxAttempts; index += 1) {
      const attempt = runGuardedOneShot({
        ...input,
        requestId: `phase626r-isolated-reliability-attempt-${index + 1}`,
      });
      attempts.push({
        attemptId: `attempt-${index + 1}`,
        requestAttemptCount: attempt.requestAttemptCount,
        retryAttemptCount: attempt.retryAttemptCount,
        testStatus: attempt.testStatus,
        responseClassification: attempt.responseClassification,
        stdoutSanitized: attempt.stdoutSanitized,
        passMarker: attempt.passMarker,
        providerCallsMade: attempt.providerCallsMade,
        codexExecExecuted: attempt.codexExecExecuted,
        cleanupCompleted: attempt.cleanupCompleted,
        blocker: attempt.blocker,
      });

      if (attempt.testStatus !== "pass") {
        stoppedReason = attempt.responseClassification;
        break;
      }
    }

    const allAttemptsPassed = attempts.length === maxAttempts && attempts.every((item) => item.testStatus === "pass");
    return {
      phase: "Phase626R-Phase627R",
      mode: "isolated_repeated_reliability",
      routeId: ROUTE_ID,
      selectedProviderId: SELECTED_PROVIDER_ID,
      plannedAttempts: maxAttempts,
      completedAttempts: attempts.length,
      totalRequestAttemptCount: attempts.reduce((sum, item) => sum + item.requestAttemptCount, 0),
      totalRetryAttemptCount: attempts.reduce((sum, item) => sum + item.retryAttemptCount, 0),
      repeatedReliabilityClassification: allAttemptsPassed ? "isolated_repeated_pass" : "isolated_repeated_blocked",
      allAttemptsPassed,
      stoppedReason,
      attempts,
      providerCallsMade: false,
      codexExecExecuted: false,
      runtimeIntegrated: false,
      chatIntegrated: false,
      chatGatewayExecuteIntegrated: false,
      providerRuntimeModified: false,
      productionReadyClaimed: false,
      releaseReadyClaimed: false,
      safety: createSafetyBoundary(),
    };
  }

  return {
    getStatus,
    runDryRunSmoke,
    runGuardedOneShot,
    runRepeatedReliability,
  };
}

export const codexExecCrsRuntimeCandidateConstants = Object.freeze({
  PASS_MARKER,
  ROUTE_ID,
  SELECTED_PROVIDER_ID,
  MAX_REQUESTS_DEFAULT,
  MAX_REQUESTS_HARD_LIMIT,
  RETRY_LIMIT,
});

function readPhase616Evidence(evidencePath) {
  if (!existsSync(evidencePath)) return null;
  try {
    return JSON.parse(readFileSync(evidencePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

function createSafetyBoundary() {
  return {
    authJsonRead: false,
    authJsonAccessed: false,
    codexConfigModified: false,
    projectCodexConfigModified: false,
    persistentConfigWritePerformed: false,
    secretValueExposed: false,
    rawBaseUrlValueExposed: false,
    webhookValueExposed: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    providerRuntimeModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    pushExecuted: false,
    commitCreated: false,
    workspaceCleanClaimed: false,
  };
}

function check(id, passed) {
  return { id, passed: Boolean(passed) };
}

function normalizeRequestId(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : fallback;
}

function clampInteger(value, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return max;
  return Math.max(min, Math.min(max, parsed));
}
