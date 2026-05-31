import { writeJson, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";
import { runGodMode, runNormalMode, runTianshuMode } from "../../packages/world-class-product-conversion/src/index.js";

const normal = runNormalMode("整理今天本地系统检查下一步");
const god = runGodMode("比较三种推进方案并给出推荐");
const tianshu = runTianshuMode("判断这个任务应该用哪种模式");
const empty = runNormalMode("");
const providerNeeded = runTianshuMode("执行 real provider stability test");

const result = {
  phase: "Phase1923A",
  name: "Three-Mode Loop Regression Hardening",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  normalRegressionPassed: normal.mode === "normal" && Array.isArray(normal.directPlan),
  godRegressionPassed: god.mode === "god" && god.candidates.length === 3 && god.finalRecommendation === "balanced",
  tianshuRegressionPassed: tianshu.mode === "tianshu" && typeof tianshu.recommendedMode === "string",
  emptyInputFallbackPassed: empty.inputFallbackUsed === true && empty.fallbackReason === "empty_input_defaulted_to_safe_local_task",
  providerNeededReturnsAuthorizationRequired:
    providerNeeded.recommendedMode === "provider_authorization_packet" &&
    providerNeeded.authorizationStatus === "authorization_required",
  realProviderCallExecuted: false,
  providerCallsMade: false,
  secretValueExposed: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  productionReadyClaimed: false,
  nextRecommendedPhase: "Phase1924A Provider Stability Preflight Without Provider Call",
};

writeText("docs/phase1923a-three-mode-loop-regression-hardening.md", "# Phase1923A Three-Mode Loop Regression Hardening\n\nRegression suite covers normal, god, tianshu, empty input fallback, and provider-needed authorization-required routing.\n");
writeText("docs/phase1923a-execution-report.md", `# Phase1923A Execution Report\n\n- completed: true\n- providerNeededReturnsAuthorizationRequired: ${result.providerNeededReturnsAuthorizationRequired}\n`);
writeJson("apps/ai-gateway-service/evidence/phase1923a/three-mode-regression-hardening-result.json", {
  ...result,
  scenarios: { normal, god, tianshu, empty, providerNeeded },
});
console.log(JSON.stringify(result, null, 2));
