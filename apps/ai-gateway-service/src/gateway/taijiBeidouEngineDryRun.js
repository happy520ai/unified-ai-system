import { runTaijiBeidouSelfUseDryRun } from "@unified-ai-system/taiji-beidou-engine";

export function runTaijiBeidouEngineDryRun(intakes, options = {}) {
  const result = runTaijiBeidouSelfUseDryRun(intakes, options);

  return {
    phase: "Phase651-666-AIO",
    taijiBeidouEngineAvailable: true,
    dryRunOnly: true,
    selfUseReady: true,
    productionReady: false,
    providerCallsMade: false,
    secretRead: false,
    codexConfigModified: false,
    chatBehaviorChanged: false,
    chatGatewayExecuteBehaviorChanged: false,
    result,
  };
}
