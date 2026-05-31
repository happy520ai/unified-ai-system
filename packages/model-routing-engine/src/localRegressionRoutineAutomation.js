import { safetyFields } from "./localSelfUseV1ClosureCommon.js";

export function buildLocalRegressionRoutineAutomation() {
  return {
    phase: "Phase986",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    localRegressionRoutineReady: true,
    dailyCommands: [
      "pnpm run verify:phase107a-secret-safety",
      "pnpm run verify:phase321a-workbench-product-recovery",
      "pnpm smoke:phase308a-desktop-workbench-ui",
    ],
    weeklyCommands: [
      "pnpm run verify:phase916-930-real-route-quality-test",
      "pnpm run verify:phase931-940-quality-result-audit",
      "pnpm run verify:phase966-970-god-marker-rerun",
      "pnpm run verify:phase971-1000-local-self-use-routing-v1",
    ],
    ...safetyFields(),
  };
}
