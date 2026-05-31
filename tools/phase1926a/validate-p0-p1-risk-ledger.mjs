import { readJson, check } from "../phase1903a/ownerAutomationSealCommon.mjs";

const result = readJson("apps/ai-gateway-service/evidence/phase1926a/p0-p1-risk-ledger-result.json").data ?? {};
const ledger = readJson("apps/ai-gateway-service/evidence/phase1926a/p0-p1-risk-ledger.json").data ?? {};
const required = [
  "real_provider_stability_not_executed",
  "production_ready_not_claimable",
  "public_launch_not_claimable",
  "owner_dogfooding_records_missing",
  "first_use_success_rate_not_measured_by_real_owner",
  "operator_runbook_needs_human_rehearsal",
  "commercial_readiness_not_verified",
  "real_chat_triggered_local_action_not_connected",
  "multi_provider_stability_not_verified",
];
const ids = new Set((ledger.risks ?? []).map((risk) => risk.id));
const checks = [
  check("completed", result.completed === true),
  check("sealed", result.recommended_sealed === true),
  check("blocker", result.blocker === "p0_p1_risks_remain"),
  check("required_risks", required.every((id) => ids.has(id))),
  check("p0", result.p0RiskCountGreaterThanZero === true),
  check("p1", result.p1RiskCountGreaterThanZero === true),
  check("non_claims", result.productionReadyClaimed === false && result.publicLaunchReadyClaimed === false),
  check("provider_false", result.providerCallsMade === false),
  check("secret_false", result.secretValueExposed === false),
  check("deploy_false", result.deployExecuted === false),
  check("chat_gateway_execute_false", result.chatGatewayExecuteModified === false),
];
const passed = checks.every((item) => item.passed);
console.log(JSON.stringify({ ...result, completed: passed, recommended_sealed: passed, blocker: result.blocker, checks }, null, 2));
if (!passed) process.exitCode = 1;
