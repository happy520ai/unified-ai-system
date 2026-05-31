import { createModelLibraryStore } from "../../apps/ai-gateway-service/src/model-library/modelLibraryStore.js";
import { createNvidiaUnifiedClient } from "../../apps/ai-gateway-service/src/providers/nvidia/nvidiaUnifiedClient.js";
import {
  buildRound2DryRunRouteResult,
  normalizeRound2RouteResult,
  runWithIsolatedCredentialSecret,
  summarizeRound2ModeResult,
} from "../../packages/model-routing-engine/src/index.js";
import { blockedModeResult, paths, readJsonIfPresent } from "./phase941-960-common.mjs";

export async function runRound2Mode({ mode, outputPhase }) {
  const approval = readJsonIfPresent(paths.approval) || {};
  if (approval.authorizationComplete !== true) {
    return blockedModeResult(mode, approval.blocker || "phase941_960_approval_missing");
  }
  const matrix = readJsonIfPresent(paths.scenarioMatrix) || {};
  const scenarios = (matrix.scenarios || []).filter((scenario) => scenario.mode === mode);
  const bridge = await runWithIsolatedCredentialSecret({
    credentialRef: "credentialRef:nvidia:default",
    providerId: "nvidia",
    env: process.env,
    operation: async ({ runtimeCredentialStore, providerEnv }) => {
      const modelLibraryStore = createModelLibraryStore({ env: providerEnv, runtimeCredentialStore });
      const client = createNvidiaUnifiedClient({ env: providerEnv, runtimeCredentialStore, modelLibraryStore, timeoutMs: 60_000 });
      const routeResults = [];
      for (const scenario of scenarios) {
        if (scenario.dryRunOnly === true) {
          routeResults.push(buildRound2DryRunRouteResult({ scenario }));
          continue;
        }
        const startedAt = Date.now();
        const envelope = await client.chatCompletion({
          modelId: scenario.modelId,
          messages: [{ role: "user", content: scenario.prompt }],
          maxTokens: 96,
          temperature: 0,
        });
        routeResults.push(normalizeRound2RouteResult({
          scenario,
          envelope,
          latencyMs: Date.now() - startedAt,
        }));
      }
      return routeResults;
    },
  });
  if (bridge.ok !== true) {
    return blockedModeResult(mode, bridge.blocker || "round2_credential_ref_resolution_blocked");
  }
  return {
    ...summarizeRound2ModeResult({ mode, routeResults: bridge.result || [] }),
    phase: outputPhase,
  };
}
