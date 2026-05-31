import { pathExists, readJson, check } from "../phase1903a/ownerAutomationSealCommon.mjs";

const result =
  readJson("apps/ai-gateway-service/evidence/phase1925a/operator-runbook-rollback-drill-result.json").data ?? {};
const checks = [
  check("runbook", pathExists("docs/phase1925a-operator-runbook-and-rollback-drill.md")),
  check("emergency", pathExists("docs/phase1925a-emergency-stop-guide.md")),
  check("rollback_report", pathExists("docs/phase1925a-rollback-drill-report.md")),
  check("completed", result.completed === true),
  check("sealed", result.recommended_sealed === true),
  check("blocker_null", result.blocker === null),
  check("dry_run", result.rollbackDrillDryRunExecuted === true && result.realRollbackExecuted === false),
  check("provider_false", result.providerCallsMade === false),
  check("secret_false", result.secretValueExposed === false),
  check("deploy_false", result.deployExecuted === false),
  check("chat_gateway_execute_false", result.chatGatewayExecuteModified === false),
  check("production_ready_false", result.productionReadyClaimed === false),
];
const passed = checks.every((item) => item.passed);
console.log(JSON.stringify({ ...result, completed: passed, recommended_sealed: passed, blocker: passed ? null : "operator_runbook_validation_failed", checks }, null, 2));
if (!passed) process.exitCode = 1;
