export function guardStaleContext(freshnessReport) {
  const staleBlocked = freshnessReport.staleContextDetectedWhenExpected === true;
  return {
    completed: true,
    activePackHash: freshnessReport.currentHash,
    staleBlocked,
    activePackAllowed: true,
    blocker: staleBlocked ? null : "stale_context_not_detected",
    actionWhenStale: "rebuild-context-pack-before-codex-execution",
  };
}
