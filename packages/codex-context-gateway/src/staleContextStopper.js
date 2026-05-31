import { runFreshnessGate } from "./freshnessGate.js";

export function stopWhenContextStale(options = {}) {
  const freshness = options.freshness || runFreshnessGate(options);
  const simulatedStaleBlocked = freshness.staleTrueBlocks === true;
  return {
    completed: freshness.freshnessGateWorks === true && freshness.stale === false && simulatedStaleBlocked,
    staleFalseAllows: freshness.staleFalseAllows === true,
    staleTrueBlocks: freshness.staleTrueBlocks === true,
    simulatedStaleBlocked,
    actionWhenStale: "stop-and-rebuild-context-pack-before-codex-task",
    blocker: freshness.stale ? "stale-context-blocked" : null,
    providerCallsMade: false,
  };
}
