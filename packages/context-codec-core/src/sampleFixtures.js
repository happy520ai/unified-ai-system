const commonBoundary = {
  providerCallsAllowed: false,
  secretReadAllowed: false,
  deployAllowed: false,
  chatMutationAllowed: false,
  chatGatewayExecuteMutationAllowed: false,
  codexConfigMutationAllowed: false,
};

const sharedEvidenceRefs = [
  "apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json",
  "apps/ai-gateway-service/evidence/phase641r/context-codec-core-shared-result.json",
];

export function buildPhase641rAioSampleFixtures() {
  const secretPrefix = "sk";
  const secretLike = `${secretPrefix}-test-should-not-leak`;
  return [
    {
      requestId: "phase641r-aio-normal-dry-run",
      source: "main-gateway",
      mode: "normal",
      userMessage: "帮我总结任务",
      conversationDigest: "Normal mode dry-run context compilation.",
      missionState: {
        mission: "normal question context compression",
        recommendedMode: "normal",
        noProviderCall: true,
      },
      providerRef: "providerRef:dry-run",
      credentialRef: "credentialRef:dry-run",
      safetyBoundary: commonBoundary,
      evidenceRefs: sharedEvidenceRefs,
      docsRefs: ["docs/phase641r-aio-main-gateway-context-codec-dry-run.md"],
      requiredFacts: [{ key: "current_goal", value: "context-codec-shared-integration" }],
    },
    {
      requestId: "phase641r-aio-god-dry-run",
      source: "main-gateway",
      mode: "god",
      userMessage: "Run multi-review dry-run without Provider calls.",
      conversationDigest: "God mode preserves multi-review intent and evidence pointer.",
      missionState: {
        mission: "multi-review intent dry-run",
        recommendedMode: "god",
        noProviderCall: true,
      },
      providerRef: "providerRef:multi-review-disabled",
      credentialRef: "credentialRef:review-redacted",
      safetyBoundary: commonBoundary,
      evidenceRefs: sharedEvidenceRefs,
      docsRefs: ["docs/phase641r-aio-main-gateway-context-codec-dry-run.md"],
    },
    {
      requestId: "phase641r-aio-tianshu-dry-run",
      source: "main-gateway",
      mode: "tianshu",
      userMessage: "Plan next safe engineering task without real Tianshu runtime.",
      conversationDigest: "Tianshu dry-run preserves mission, recommendedMode, and boundary.",
      missionState: {
        mission: "automatic planning dry-run",
        recommendedMode: "tianshu",
        noProviderCall: true,
      },
      providerRef: "providerRef:tianshu-disabled",
      credentialRef: "credentialRef:planning-redacted",
      safetyBoundary: commonBoundary,
      evidenceRefs: sharedEvidenceRefs,
      docsRefs: ["docs/phase641r-aio-main-gateway-context-codec-dry-run.md"],
    },
    {
      requestId: "phase641r-aio-secret-boundary-dry-run",
      source: "main-gateway",
      mode: "normal",
      userMessage: `Mask this sample value ${secretLike} and keep provider off.`,
      conversationDigest: "Secret-like strings must be redacted before compact context output.",
      missionState: {
        mission: "secret boundary dry-run",
        recommendedMode: "normal",
        noProviderCall: true,
        sampleToken: secretLike,
      },
      providerRef: "providerRef:safety",
      credentialRef: "credentialRef:safety-redacted",
      safetyBoundary: commonBoundary,
      evidenceRefs: sharedEvidenceRefs,
      docsRefs: ["docs/phase641r-aio-safety-boundary-report.md"],
    },
  ];
}
