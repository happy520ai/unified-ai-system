import {
  ensure,
  makePhase384Result,
  phase384Safety,
  readText,
  writeJson,
  writeText,
} from "../phase384-common.mjs";

const prompt = await readText("docs/phase-orchestrator/next-codex-prompt.md");
ensure(prompt.includes("selectedNextPhase: Phase384"), "Next prompt must target Phase384.");
ensure(prompt.includes("humanApprovalRequired: true"), "Phase384 must remain human approval required.");

const authorizationRecord = {
  phase: "Phase384",
  title: "Yiyi Guarded Real Provider Test Authorization Gate",
  authorizationType: "enter_authorization_gate_only",
  userMessage: "授权进入",
  authorizedByHuman: true,
  allowProviderCall: false,
  allowedProviderRefs: [],
  allowedCredentialRefs: [],
  allowedModelRefs: [],
  maxRequests: 0,
  maxEstimatedCostUsd: 0,
  noSecretOutputAllowed: true,
  noActionExecutionAllowed: true,
  noDeployAllowed: true,
  providerTestExecutionStatus: "blocked_pending_specific_authorization",
  requiredBeforeRealProviderTest: [
    "allowedProviderRefs",
    "allowedCredentialRefs",
    "allowedModelRefs",
    "maxRequests",
    "maxEstimatedCostUsd",
    "explicit_allowProviderCall_true",
  ],
  safety: { ...phase384Safety },
};

const result = makePhase384Result({
  authorizationRecordCreated: true,
  authorizationRecord,
  blocker: "real_provider_test_requires_specific_provider_model_credentialref_limits",
});

await writeJson("docs/phase384-yiyi-guarded-real-provider-test-authorization-record.json", authorizationRecord);
await writeText(
  "docs/phase384-yiyi-guarded-real-provider-test-authorization-gate.md",
  [
    "# Phase384 Yiyi Guarded Real Provider Test Authorization Gate",
    "",
    "The user authorized entry into the Phase384 authorization gate with: `授权进入`.",
    "",
    "This is not sufficient to execute a real provider test because the required provider/model/credentialRef/request/cost limits were not specified.",
    "",
    "Current decision:",
    "- authorizedByHuman: true",
    "- allowProviderCall: false",
    "- providerTestExecutionStatus: blocked_pending_specific_authorization",
    "- providerCallsMade: false",
    "- rawSecretAccessed: false",
    "- secretValueExposed: false",
    "- deployExecuted: false",
    "- billingExecuted: false",
    "",
    "Required before any real provider test:",
    "- allowedProviderRefs",
    "- allowedCredentialRefs",
    "- allowedModelRefs",
    "- maxRequests",
    "- maxEstimatedCostUsd",
    "- explicit allowProviderCall=true",
  ].join("\n"),
);
await writeJson("apps/ai-gateway-service/evidence/phase384/yiyi-guarded-real-provider-test-authorization-gate-closure-result.json", result);

console.log(JSON.stringify(result, null, 2));
