import { pathExists, readJson, check } from "../phase1903a/ownerAutomationSealCommon.mjs";

const result = readJson("apps/ai-gateway-service/evidence/phase1928a/controlled-owner-pilot-plan-result.json").data ?? {};
const checks = [
  check("docs", pathExists("docs/phase1928a-controlled-owner-pilot-plan.md")),
  check("template", pathExists("local-self-use/v1/owner-pilot/phase1928a-seven-day-pilot-log.input.json.template")),
  check("completed", result.completed === true),
  check("sealed", result.recommended_sealed === true),
  check("blocker", result.blocker === "owner_pilot_not_yet_executed"),
  check("plan", result.sevenDayPilotPlanGenerated === true),
  check("template_generated", result.ownerPilotLogTemplateGenerated === true),
  check("metrics", result.successMetricsGenerated === true),
  check("not_executed", result.ownerPilotExecuted === false && result.ownerPilotRecordsFabricated === false),
  check("provider_false", result.providerCallsMade === false),
  check("secret_false", result.secretValueExposed === false),
  check("deploy_false", result.deployExecuted === false),
  check("production_ready_false", result.productionReadyClaimed === false),
];
const passed = checks.every((item) => item.passed);
console.log(JSON.stringify({ ...result, completed: passed, recommended_sealed: passed, checks }, null, 2));
if (!passed) process.exitCode = 1;
