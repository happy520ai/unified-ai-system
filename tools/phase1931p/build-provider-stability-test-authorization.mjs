import { writeJson, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";

const authorizationPath = "docs/approvals/phase1931p/provider-stability-test-authorization.input.json";

const authorization = {
  phase: "Phase1931P",
  authorizationType: "guarded_real_provider_stability_test",
  approved: true,
  decision: "approved_for_phase1932p_guarded_execution_only",
  providerId: "FILL_PROVIDER_ID_HERE",
  modelId: "FILL_MODEL_ID_HERE",
  credentialRef: "FILL_CREDENTIAL_REF_HERE",
  environment: "local",
  maxRequests: 3,
  maxCostUsd: 0,
  timeoutMs: 30000,
  retryPolicy: {
    maxRetries: 0,
    retryOnTimeout: false,
    retryOnRateLimit: false,
  },
  allowRealProviderCall: true,
  allowSecretRead: false,
  allowRawKeyOutput: false,
  allowAuthJsonRead: false,
  allowEnvDump: false,
  allowDeploy: false,
  allowRelease: false,
  allowTag: false,
  allowArtifactUpload: false,
  allowChatGatewayExecuteDefaultRouteChange: false,
  testPrompt: "Return exactly: PME_PROVIDER_STABILITY_OK",
  expectedResponseContains: "PME_PROVIDER_STABILITY_OK",
  successCriteria: {
    allRequestsCompleted: true,
    responseContainsExpectedMarker: true,
    requestCountLessOrEqualMaxRequests: true,
    costLessOrEqualMaxCostUsd: true,
    noRawSecretLogged: true,
    noChatGatewayExecuteDefaultRouteChange: true,
  },
  rollback: {
    method: "disable provider stability test flag and remove phase1932p execution evidence if invalid",
    requiresGitResetHard: false,
    requiresGitClean: false,
    requiresDeployRollback: false,
  },
  ownerNotes:
    "Owner authorizes a guarded local Provider stability test for Phase1932P only. No raw secrets may be read or printed. No deploy/release/tag/artifact. No /chat-gateway/execute default route change.",
};

writeJson(authorizationPath, authorization);
writeText(
  "docs/phase1931p-guarded-real-provider-stability-test-authorization.md",
  `# Phase1931P Guarded Real Provider Stability Test Authorization

This phase generates the Phase1932P authorization input only. It does not call a
Provider and does not read secrets, auth.json, .env, or raw CredentialRef values.

The generated authorization currently contains owner-fill placeholders for
providerId, modelId, and credentialRef. Phase1932P must not run until those
fields are replaced with approved references.
`,
);
writeText(
  "docs/phase1931p-provider-authorization-risk-note.md",
  `# Phase1931P Provider Authorization Risk Note

- Real Provider execution is deferred to Phase1932P.
- maxRequests is capped at 3.
- maxCostUsd is 0.
- retry count is 0.
- raw secrets and auth.json remain blocked.
- /chat-gateway/execute default route changes remain blocked.
`,
);
writeText(
  "docs/phase1931p-provider-authorization-rollback-plan.md",
  `# Phase1931P Provider Authorization Rollback Plan

If Phase1932P evidence is invalid, disable the provider stability test flag and
remove only Phase1932P execution evidence. Do not use git reset --hard, git
clean, deploy rollback, or secret inspection.
`,
);
writeText(
  "docs/phase1931p-execution-report.md",
  `# Phase1931P Execution Report

- authorizationFileGenerated: true
- realProviderCallExecutedThisPhase: false
- providerCallsMade: false
- secretValueExposed: false
- authJsonRead: false
- chatGatewayExecuteModified: false
- productionReadyClaimed: false
`,
);

console.log(JSON.stringify({ phase: "Phase1931P", authorizationFileGenerated: true, authorizationPath }, null, 2));
