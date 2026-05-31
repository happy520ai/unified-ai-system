import { runBoundedSmokeExecutorV0 } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, readJson, writeJson, writeText } from "./phase781-800-common.mjs";

const smokeApprovalIntake = readJson("provider-expansion/smoke/smoke-approval-intake-result.json");
const readiness = readJson("apps/ai-gateway-service/evidence/phase781_800/provider-credential-readiness-gate-result.json");
const smoke = runBoundedSmokeExecutorV0({ smokeApprovalIntake, readiness });
const result = {
  ...smoke,
  completed: true,
  boundedSmokeExecutorReady: true,
  ...baseSafety(),
};
writeJson("provider-expansion/smoke/bounded-smoke-executor-result.json", result);
writeJson("apps/ai-gateway-service/evidence/phase781_800/bounded-smoke-executor-result.json", result);
writeText("docs/phase781-800/phase788-bounded-smoke-executor-v0.md", phaseDoc({
  phase: "Phase788",
  title: "Bounded Smoke Executor v0",
  goal: "执行 bounded smoke executor v0；无合规 approval 时不执行真实 smoke。",
  facts: [`status=${result.status}`, `realSmokeExecuted=${result.realSmokeExecuted}`, `requestAttemptCount=${result.requestAttemptCount}`],
  boundaries: ["maxRetries=0", "providerCallsMade=false when no approval", "marker missing must not pass"],
  outputs: ["provider-expansion/smoke/bounded-smoke-executor-result.json"],
}));
console.log(JSON.stringify(result, null, 2));
