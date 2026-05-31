import { normalizeRoutingInput } from "./modelRoutingContract.js";

export function resolveModeRoutingPolicy(input = {}, pressure = {}) {
  const normalized = normalizeRoutingInput(input);
  const mode = normalized.mode === "auto" ? pressure.modeRecommendation || "normal" : normalized.mode;
  return {
    phase: "Phase803",
    modeRoutingPolicyReady: true,
    requestedMode: normalized.mode,
    resolvedMode: mode,
    runtimeEnabled: false,
    providerCallsMade: false,
    secretRead: false,
    policy: {
      normal: "single best selectable smoke-passed chat model",
      god: "reviewer pool plus adjudicator, dry-run by default",
      tianshu: "planner plus executor pool, dry-run by default",
    },
  };
}
