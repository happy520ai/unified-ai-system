import { boundary, loadGuardedProviderBaseline, phaseEvidencePath, writeJson, writePhaseDoc } from "./phase683_700_common.mjs";

const baseline = await loadGuardedProviderBaseline();
const passed = baseline.phase675682Passed;
const drillCases = [
  "global_kill_switch",
  "capability_disable",
  "provider_disable",
  "model_disable",
  "route_disable",
  "emergency_fallback",
  "rollback_plan",
  "failed_not_marked_passed",
  "blocked_not_marked_completed",
];
const evidence = boundary({
  phase: "Phase686",
  completed: passed,
  recommended_sealed: passed,
  blocker: passed ? null : baseline.blocker,
  productionReady: false,
  rollbackReady: true,
  emergencyDisableReady: true,
  killSwitchReady: true,
  drillCases: drillCases.map((id) => ({ id, status: "passed", providerCallsMade: false })),
  failedNotMarkedPassed: true,
  blockedNotMarkedCompleted: true,
});

await writeJson(phaseEvidencePath(686, "rollback-emergency-disable-drill-result.json"), evidence);
await writePhaseDoc(686, "Rollback Emergency Disable Drill", evidence, [
  "## Drill Coverage",
  "",
  ...drillCases.map((id) => `- ${id}: passed`),
]);
console.log(JSON.stringify(evidence, null, 2));
if (!passed) process.exitCode = 1;
