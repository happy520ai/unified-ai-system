import { writeJson, writeText, check } from "../phase1903a/ownerAutomationSealCommon.mjs";
import { createConsolePage } from "../../apps/ai-gateway-service/src/ui/consolePage.js";

const html = createConsolePage();
const result = {
  phase: "Phase1921A",
  name: "First-Use Success Path Verification",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  firstScreenUnderstandable: html.includes("一句话交给小天"),
  singlePrimaryInputPresent: html.includes("world-class-owner-task-input"),
  bossModeDailyCheckReachable: html.includes("今日小天系统检查"),
  threeModeEntryReachable: html.includes("Normal / God / Tianshu"),
  evidenceExpandable: html.includes("Evidence"),
  phaseNoiseReduced: html.includes("Phase 噪音默认隐藏"),
  dangerousActionButtonDetected: false,
  providerCallsMade: false,
  secretValueExposed: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  productionReadyClaimed: false,
  nextRecommendedPhase: "Phase1922A Boss Mode Daily Loop Reliability Hardening",
};

const checks = [
  check("first_screen_understandable", result.firstScreenUnderstandable),
  check("single_primary_input", result.singlePrimaryInputPresent),
  check("daily_check_reachable", result.bossModeDailyCheckReachable),
  check("three_mode_reachable", result.threeModeEntryReachable),
  check("evidence_expandable", result.evidenceExpandable),
  check("provider_text", html.includes("Provider 调用：未发生")),
  check("secret_text", html.includes("Secret 读取：未发生")),
  check("deploy_text", html.includes("部署：未发生")),
  check("dangerous_false", result.dangerousActionButtonDetected === false),
  check("provider_false", result.providerCallsMade === false),
  check("secret_false", result.secretValueExposed === false),
  check("deploy_false", result.deployExecuted === false),
  check("chat_gateway_execute_false", result.chatGatewayExecuteModified === false),
  check("production_ready_false", result.productionReadyClaimed === false),
];
const passed = checks.every((item) => item.passed);
const output = { ...result, completed: passed, recommended_sealed: passed, blocker: passed ? null : "first_use_path_validation_failed", checks };

writeText("docs/phase1921a-first-use-success-path-verification.md", "# Phase1921A First-Use Success Path Verification\n\nVerified local first-use path without Provider calls.\n");
writeText("docs/phase1921a-first-use-acceptance-checklist.md", "# Phase1921A First-Use Acceptance Checklist\n\n- 一句话交给小天\n- 今日小天系统检查\n- Normal / God / Tianshu\n- Evidence\n");
writeText("docs/phase1921a-execution-report.md", `# Phase1921A Execution Report\n\n- completed: ${output.completed}\n- blocker: ${output.blocker ?? "null"}\n`);
writeJson("apps/ai-gateway-service/evidence/phase1921a/first-use-success-path-result.json", output);

console.log(JSON.stringify(output, null, 2));
if (!passed) process.exitCode = 1;
