import { readJson, check } from "../phase1903a/ownerAutomationSealCommon.mjs";

const result =
  readJson("apps/ai-gateway-service/evidence/phase1923a/three-mode-regression-hardening-result.json").data ?? {};
const checks = [
  check("completed_true", result.completed === true),
  check("recommended_sealed_true", result.recommended_sealed === true),
  check("blocker_null", result.blocker === null),
  check("normal", result.normalRegressionPassed === true),
  check("god", result.godRegressionPassed === true),
  check("tianshu", result.tianshuRegressionPassed === true),
  check("empty_fallback", result.emptyInputFallbackPassed === true),
  check("provider_auth_required", result.providerNeededReturnsAuthorizationRequired === true),
  check("real_provider_false", result.realProviderCallExecuted === false && result.providerCallsMade === false),
  check("secret_false", result.secretValueExposed === false),
  check("deploy_false", result.deployExecuted === false),
  check("chat_gateway_execute_false", result.chatGatewayExecuteModified === false),
  check("production_ready_false", result.productionReadyClaimed === false),
];
const passed = checks.every((item) => item.passed);
console.log(JSON.stringify({ ...result, completed: passed, recommended_sealed: passed, blocker: passed ? null : "three_mode_regression_failed", checks }, null, 2));
if (!passed) process.exitCode = 1;
