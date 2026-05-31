import { pathExists, readJson, check } from "../phase1903a/ownerAutomationSealCommon.mjs";

const result =
  readJson("apps/ai-gateway-service/evidence/phase1922a/boss-mode-daily-loop-reliability-result.json").data ?? {};
const checks = [
  check("doc_exists", pathExists("docs/phase1922a-boss-mode-daily-loop-reliability-hardening.md")),
  check("completed_true", result.completed === true),
  check("recommended_sealed_true", result.recommended_sealed === true),
  check("blocker_null", result.blocker === null),
  check("rerunnable", result.dailyLoopRerunnable === true),
  check("missing_optional_handled", result.missingOptionalEvidenceHandled === true),
  check("degraded_safe", result.degradedButSafeSupported === true),
  check("new_desktop_false", result.newDesktopFileCreated === false),
  check("provider_false", result.providerCallsMade === false),
  check("secret_false", result.secretValueExposed === false),
  check("deploy_false", result.deployExecuted === false),
  check("chat_gateway_execute_false", result.chatGatewayExecuteModified === false),
  check("production_ready_false", result.productionReadyClaimed === false),
];
const passed = checks.every((item) => item.passed);
console.log(JSON.stringify({ ...result, completed: passed, recommended_sealed: passed, blocker: passed ? null : "boss_mode_daily_loop_reliability_failed", checks }, null, 2));
if (!passed) process.exitCode = 1;
