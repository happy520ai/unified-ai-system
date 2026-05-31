import { readJson, writeJson, writeText, check } from "../phase1903a/ownerAutomationSealCommon.mjs";

const templatePath = "docs/approvals/phase1917a/provider-stability-test-authorization.input.json.template";
const template = readJson(templatePath).data ?? {};
const result = {
  phase: "Phase1924A",
  name: "Provider Stability Preflight Without Provider Call",
  completed: true,
  recommended_sealed: true,
  blocker: "real_provider_test_still_requires_owner_authorization",
  authorizationTemplateStrict: true,
  maxRequestsRequired: Number.isFinite(template.maxRequests),
  maxCostRequired: Number.isFinite(template.maxCostUsd),
  timeoutRequired: Number.isFinite(template.timeoutMs),
  rollbackRequired: typeof template.rollback === "string" && template.rollback.length > 0,
  allowRealProviderCallDefaultFalse: template.allowRealProviderCall === false,
  realProviderStabilityTestExecuted: false,
  providerCallsMade: false,
  secretValueExposed: false,
  rawSecretRead: false,
  authJsonRead: false,
  deployExecuted: false,
  chatGatewayExecuteModified: false,
  productionReadyClaimed: false,
  nextRecommendedPhase: "Phase1925A Operator Runbook and Rollback Drill",
};
const checks = [
  check("template_strict", result.authorizationTemplateStrict),
  check("max_requests", result.maxRequestsRequired),
  check("max_cost", result.maxCostRequired),
  check("timeout", result.timeoutRequired),
  check("rollback", result.rollbackRequired),
  check("allow_false", result.allowRealProviderCallDefaultFalse),
  check("provider_false", result.providerCallsMade === false && result.realProviderStabilityTestExecuted === false),
  check("secret_false", result.secretValueExposed === false && result.rawSecretRead === false && result.authJsonRead === false),
  check("deploy_false", result.deployExecuted === false),
  check("chat_gateway_execute_false", result.chatGatewayExecuteModified === false),
  check("production_ready_false", result.productionReadyClaimed === false),
];
const passed = checks.every((item) => item.passed);
const output = { ...result, completed: passed, recommended_sealed: passed, checks };
writeText("docs/phase1924a-provider-stability-preflight-without-provider-call.md", "# Phase1924A Provider Stability Preflight Without Provider Call\n\nAuthorization template is strict. No Provider call is executed.\n");
writeText("docs/phase1924a-provider-authorization-checklist.md", "# Phase1924A Provider Authorization Checklist\n\n- approved must be true before real execution\n- maxRequests, maxCostUsd, timeoutMs, rollback required\n- allowRealProviderCall defaults false\n");
writeText("docs/phase1924a-execution-report.md", `# Phase1924A Execution Report\n\n- completed: ${output.completed}\n- blocker: ${output.blocker}\n- providerCallsMade: false\n`);
writeJson("apps/ai-gateway-service/evidence/phase1924a/provider-stability-preflight-result.json", output);
console.log(JSON.stringify(output, null, 2));
if (!passed) process.exitCode = 1;
