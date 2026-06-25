import { runContextCodecAdapter } from "./contextCodecAdapter.js";
import { buildPhase641rAioSampleFixtures } from "@unified-ai-system/context-codec-core";

export function runMainGatewayContextCodecDryRun() {
  const scenarios = buildPhase641rAioSampleFixtures().map((fixture) => runContextCodecAdapter(fixture));

  return {
    completed: scenarios.every((scenario) => scenario.providerCallsMade === false),
    phase: "Phase641R-AIO",
    mainGatewayCodecAvailable: true,
    providerCallsMade: false,
    secretRead: false,
    chatBehaviorChanged: false,
    chatGatewayExecuteBehaviorChanged: false,
    scenarios,
    aggregate: {
      minTokenSavingPercent: Math.min(...scenarios.map((item) => item.tokenSavingPercent)),
      minFactRecoveryAccuracy: Math.min(...scenarios.map((item) => item.factRecoveryAccuracy)),
      minPointerCoverage: Math.min(...scenarios.map((item) => item.pointerCoverage)),
      unsupportedClaimCount: scenarios.reduce((sum, item) => sum + item.unsupportedClaimCount, 0),
      hallucinatedFactCount: scenarios.reduce((sum, item) => sum + item.hallucinatedFactCount, 0),
      safetyBoundaryPreserved: scenarios.every((item) => item.safetyBoundaryPreserved === true),
      secretValueExposed: scenarios.some((item) => item.secretValueExposed === true),
      secretLikeRejected: scenarios.some((item) => item.secretLikeRejected === true),
      yamlStateGenerated: scenarios.every((item) => typeof item.formats?.yaml_state === "string"),
      jsonlFactsGenerated: scenarios.every((item) => typeof item.formats?.jsonl_facts === "string"),
      compactTraceGenerated: scenarios.every((item) => typeof item.formats?.compact_trace === "string"),
    },
  };
}
