import assert from "node:assert/strict";

import {
  DEFAULT_CONTEXT_CODEC_POLICY,
  buildCompactTraceContext,
  buildJsonlFactsContext,
  buildNativeNotationContext,
  buildPhase641rAioSampleFixtures,
  buildYamlStateContext,
  estimateContextTokens,
  guardSecretLikeValues,
  runContextCodecDryRun,
  validateFactRecovery,
  validateSafetyBoundary,
} from "../src/index.js";

const sampleInput = {
  requestId: "phase641r-aio-test-request",
  source: "fixture",
  mode: "god",
  userMessage: "Review gateway readiness without calling providers. api_key=demo-secret-placeholder",
  conversationDigest: "User asks for dry-run gateway review with no provider calls.",
  missionState: {
    mission: "context codec shared integration",
    recommendedMode: "god",
    noProviderCall: true,
  },
  providerRef: "providerRef:nvidia",
  credentialRef: "credentialRef:local-redacted",
  safetyBoundary: {
    providerCallsAllowed: false,
    secretReadAllowed: false,
    codexConfigWriteAllowed: false,
    chatBehaviorChangeAllowed: false,
  },
  evidenceRefs: [
    "apps/ai-gateway-service/evidence/phase632i/token-saving-preflight-run.json",
    "apps/ai-gateway-service/evidence/phase641r/context-codec-core-shared-result.json",
  ],
};

const result = buildNativeNotationContext(sampleInput, {
  format: "yaml_state",
  policy: DEFAULT_CONTEXT_CODEC_POLICY,
});

assert.equal(result.codecVersion, "phase641r-aio-native-notation-v1");
assert.equal(result.format, "yaml_state");
assert.equal(result.selectedFormat, "yaml_state");
assert.equal(result.selectedDefaultFormat, "yaml_state");
assert.equal(result.source, "fixture");
assert.equal(result.providerCallsMade, false);
assert.equal(result.secretRead, false);
assert.equal(result.safetyBoundaryPreserved, true);
assert.ok(result.compactContext.includes("mode: god"));
assert.ok(result.compactContext.includes("[REDACTED_SECRET]"));
assert.ok(!result.compactContext.includes("demo-secret-placeholder"));
assert.ok(result.formats.yaml_state.includes("Phase641R-AIO"));
assert.ok(result.formats.jsonl_facts.includes("\"key\":\"phase\""));
assert.ok(result.formats.compact_trace.includes("P=641R-AIO"));
assert.ok(result.tokenEstimateBefore > result.tokenEstimateAfter);
assert.ok(result.tokenSavingPercent >= 30);
assert.ok(result.pointerCoverage >= 0.9);
assert.equal(result.unsupportedClaims.length, 0);
assert.equal(result.hallucinatedFactCount, 0);
assert.equal(result.chatBehaviorChanged, false);
assert.equal(result.chatGatewayExecuteBehaviorChanged, false);

const yaml = buildYamlStateContext(sampleInput);
const jsonl = buildJsonlFactsContext(sampleInput);
const trace = buildCompactTraceContext(sampleInput);
assert.equal(yaml.selectedFormat, "yaml_state");
assert.equal(jsonl.selectedFormat, "jsonl_facts");
assert.equal(trace.selectedFormat, "compact_trace");

const dryRun = runContextCodecDryRun(sampleInput);
assert.equal(dryRun.providerCallsMade, false);
assert.equal(dryRun.codexConfigModified, false);

const guarded = guardSecretLikeValues(sampleInput);
assert.equal(guarded.secretLikeRejected, true);
assert.ok(!JSON.stringify(guarded.value).includes("demo-secret-placeholder"));

const fixtures = buildPhase641rAioSampleFixtures();
assert.ok(fixtures.length >= 4);
assert.ok(fixtures.every((fixture) => fixture.safetyBoundary.providerCallsAllowed === false));

const tokenEstimate = estimateContextTokens(JSON.stringify(sampleInput));
assert.ok(tokenEstimate > 0);

const recovery = validateFactRecovery({
  sourceFacts: result.factsRecovered,
  compactContext: result.compactContext,
});
assert.ok(recovery.factRecoveryAccuracy >= 0.95);

const safety = validateSafetyBoundary({
  compactContext: result.compactContext,
  safetyBoundary: sampleInput.safetyBoundary,
});
assert.equal(safety.safetyBoundaryPreserved, true);
assert.equal(safety.secretValueExposed, false);
