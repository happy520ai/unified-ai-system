import { createModelLibraryStore } from "../../apps/ai-gateway-service/src/model-library/modelLibraryStore.js";
import { createNvidiaUnifiedClient } from "../../apps/ai-gateway-service/src/providers/nvidia/nvidiaUnifiedClient.js";
import {
  buildGodRerunBlockedResult,
  normalizeGodDualReviewerRerunResult,
  runWithIsolatedCredentialSecret,
} from "../../packages/model-routing-engine/src/index.js";
import { baseSafety, ensurePhaseDirs, paths, readJsonIfPresent, writeDoc, writeJson } from "./phase966-970-common.mjs";

ensurePhaseDirs();

const approval = readJsonIfPresent(paths.approval) || {};
const contract = readJsonIfPresent(paths.contract) || {};
const previousAttempts = readJsonIfPresent(paths.rerunAttempts)?.attempts || [];
const existingRerunResult = readJsonIfPresent(paths.rerun) || {};
let newProviderAttempt = null;
let result;

if (approval.authorizationComplete !== true) {
  result = {
    ...buildGodRerunBlockedResult({ blocker: approval.blocker || "phase966_970_approval_missing", contract }),
    ...baseSafety(),
  };
} else if (contract.promptMarkerContractReady !== true) {
  result = {
    ...buildGodRerunBlockedResult({ blocker: "god_prompt_marker_contract_not_ready", contract }),
    ...baseSafety(),
  };
} else if (previousAttempts.length >= (approval.maxTotalProviderRequests || 4)) {
  result = {
    ...buildGodRerunBlockedResult({ blocker: "god_marker_rerun_request_limit_reached", contract }),
    responseClassification: "blocked_by_gate",
    ...baseSafety(),
  };
} else if (
  existingRerunResult.godModeSmallScopeRerunPassed === true
  && previousAttempts.some((attempt) => attempt.responseClassification === "pass")
) {
  result = {
    ...existingRerunResult,
    providerCallsMade: true,
    totalProviderRequests: previousAttempts.length,
    requestAttemptCount: previousAttempts.length,
    maxTotalProviderRequestsRespected: previousAttempts.length <= (approval.maxTotalProviderRequests || 4),
    ...baseSafety(),
  };
} else {
  const bridge = await runWithIsolatedCredentialSecret({
    credentialRef: "credentialRef:nvidia:default",
    providerId: "nvidia",
    env: process.env,
    operation: async ({ runtimeCredentialStore, providerEnv }) => {
      const modelLibraryStore = createModelLibraryStore({ env: providerEnv, runtimeCredentialStore });
      const client = createNvidiaUnifiedClient({ env: providerEnv, runtimeCredentialStore, modelLibraryStore, timeoutMs: 60_000 });
      const startedAt = Date.now();
      const envelope = await client.chatCompletion({
        modelId: contract.modelId,
        messages: [{ role: "user", content: contract.prompt }],
        maxTokens: 120,
        temperature: 0,
      });
      return normalizeGodDualReviewerRerunResult({
        envelope,
        contract,
        latencyMs: Date.now() - startedAt,
      });
    },
  });
  result = bridge.ok === true
    ? { ...bridge.result, ...baseSafety() }
    : { ...buildGodRerunBlockedResult({ blocker: bridge.blocker || "god_marker_rerun_credential_ref_blocked", contract }), ...baseSafety() };
  if (result.totalProviderRequests > 0) {
    newProviderAttempt = {
      attemptIndex: previousAttempts.length + 1,
      modelId: result.modelId,
      providerId: result.providerId,
      responseClassification: result.responseClassification,
      externalProviderApiCallConfirmed: result.externalProviderApiCallConfirmed === true,
      networkAttemptRecorded: result.networkAttemptRecorded === true,
      reviewerAFound: result.reviewerAFound === true,
      reviewerBFound: result.reviewerBFound === true,
      synthesisFound: result.synthesisFound === true,
      finalAnswerFound: result.finalAnswerFound === true,
      markerFound: result.markerFound === true,
      qualityScore: result.qualityScore || 0,
      estimatedCostUsd: result.estimatedCostUsd || 0,
      latencyMs: result.latencyMs ?? null,
    };
  }
}

const attempts = newProviderAttempt
  ? [
    ...previousAttempts,
    newProviderAttempt,
  ]
  : previousAttempts;

if (attempts.length > 0) {
  result.requestAttemptCount = attempts.length;
  result.totalProviderRequests = attempts.length;
  result.maxTotalProviderRequestsRespected = attempts.length <= (approval.maxTotalProviderRequests || 4);
}

writeJson(paths.rerun, result);
writeJson(paths.rerunAttempts, {
  phaseRange: "Phase966-970",
  targetScenario: "god_dual_reviewer",
  maxTotalProviderRequests: approval.maxTotalProviderRequests || 4,
  totalProviderRequests: attempts.length,
  maxTotalProviderRequestsRespected: attempts.length <= (approval.maxTotalProviderRequests || 4),
  maxRetriesRespected: true,
  attempts,
  rawSecretRead: false,
  secretValueExposed: false,
  authJsonRead: false,
});
writeJson(paths.qualityLedger, {
  phaseRange: "Phase966-970",
  targetScenario: "god_dual_reviewer",
  rerunResultPath: paths.rerun,
  rerunAttemptsPath: paths.rerunAttempts,
  providerCallsMade: result.providerCallsMade === true,
  totalProviderRequests: attempts.length || result.totalProviderRequests || 0,
  responseClassification: result.responseClassification,
  godModeSmallScopeRerunPassed: result.godModeSmallScopeRerunPassed === true,
  originalEvidenceMutated: false,
});
writeDoc("phase968-god-dual-reviewer-small-scope-real-rerun.md", {
  title: "Phase968 God Dual Reviewer Small-scope Real Rerun",
  goal: "Run or block the God dual reviewer small-scope rerun.",
  facts: [
    `providerCallsMade=${result.providerCallsMade}`,
    `totalProviderRequests=${result.totalProviderRequests}`,
    `responseClassification=${result.responseClassification}`,
  ],
  boundaries: ["Max 4 requests.", "No retries.", "No non-NVIDIA provider."],
  outputs: [paths.rerun],
});

console.log(JSON.stringify(result, null, 2));
