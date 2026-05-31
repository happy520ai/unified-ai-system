import { writeJson } from "../phase373-common.mjs";

const examples = [
  {
    id: "normal_chat",
    promptInjectionRisk: "none",
    secretLeakRisk: "none",
    systemPromptLeakRisk: "none",
    providerCallRisk: "dry_run_only",
    deployRisk: "none",
    billingRisk: "none",
    excessiveAgencyRisk: "low",
    unboundedConsumptionRisk: "low",
    evidenceIntegrityRisk: "low",
    recommendedMode: "normal",
    recommendedPanel: "normal_mode_panel",
    humanApprovalRequired: false,
    blockedActions: [],
    explanation: "普通对话路径，保持 evidence 记录。",
  },
  {
    id: "secret_request",
    promptInjectionRisk: "high",
    secretLeakRisk: "high",
    systemPromptLeakRisk: "medium",
    providerCallRisk: "blocked",
    deployRisk: "none",
    billingRisk: "none",
    excessiveAgencyRisk: "medium",
    unboundedConsumptionRisk: "low",
    evidenceIntegrityRisk: "medium",
    recommendedMode: "red_team_playground",
    recommendedPanel: "security_shield_panel",
    humanApprovalRequired: false,
    blockedActions: ["secret_read", "system_prompt_read"],
    explanation: "敏感信息请求被固定 gate 拦截。",
  },
];

const requiredFields = ["promptInjectionRisk", "secretLeakRisk", "systemPromptLeakRisk", "providerCallRisk", "deployRisk", "billingRisk", "excessiveAgencyRisk", "unboundedConsumptionRisk", "evidenceIntegrityRisk", "recommendedMode", "recommendedPanel", "humanApprovalRequired", "blockedActions", "explanation"];
const validationErrors = examples.flatMap((item) => requiredFields.filter((field) => !(field in item)).map((field) => `${item.id}:${field}`));

const result = {
  phase: "Phase375A",
  taskRiskScoreValidationExecuted: true,
  validationPassed: validationErrors.length === 0,
  exampleCount: examples.length,
  validationErrors,
  providerCallsMade: false,
  secretValueExposed: false,
};

await writeJson("docs/phase375a-task-risk-score.schema.json", {
  type: "object",
  required: requiredFields,
});
await writeJson("docs/phase375a-task-risk-score-examples.json", examples);
await writeJson("apps/ai-gateway-service/evidence/phase375a/task-risk-score-validation-result.json", result);

console.log(JSON.stringify(result, null, 2));
if (!result.validationPassed) process.exitCode = 1;
