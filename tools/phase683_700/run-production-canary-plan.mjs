import { boundary, readJsonIfExists, phaseEvidencePath, writeJson, writePhaseDoc } from "./phase683_700_common.mjs";

const readiness = await readJsonIfExists(phaseEvidencePath(698, "production-readiness-gate-result.json"), {});
const passed = readiness.productionReady === true;
const canaryPlan = {
  canaryPercent: 1,
  allowedUsers: ["internal-operator"],
  maxRequests: 10,
  maxCostUsd: 0,
  rollbackTrigger: "any failed or blocked provider runtime marked as pass, cost cap breach, secret risk, or operator disable",
  killSwitch: "TAIJI_BEIDOU_MAIN_CHAIN_ENABLED=false",
  owner: "human-user",
  monitoring: "read-only evidence and operator dashboard",
  goNoGoChecklist: ["Phase675-682 pass", "main-chain ready", "chat integrated", "execute integrated", "rollback ready", "no deploy by this phase"],
};
const evidence = boundary({
  phase: "Phase699",
  completed: passed,
  recommended_sealed: passed,
  blocker: passed ? null : "production_canary_plan_inputs_missing",
  productionReady: passed,
  canaryPlanReady: passed,
  productionDeployExecuted: false,
  canaryPlan,
});

await writeJson(phaseEvidencePath(699, "production-canary-plan-result.json"), evidence);
await writePhaseDoc(699, "Production Canary Plan No-deploy Closure", evidence, [
  "## Canary Plan",
  "",
  "```json",
  JSON.stringify(canaryPlan, null, 2),
  "```",
]);
console.log(JSON.stringify(evidence, null, 2));
if (!passed) process.exitCode = 1;
