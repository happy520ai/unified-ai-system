export const MODEL_ROLES = Object.freeze([
  "default_chat",
  "fast_chat",
  "cheap_chat",
  "reasoning",
  "coding",
  "chinese",
  "long_context",
  "json_mode",
  "tool_calling",
  "god_reviewer",
  "god_adjudicator",
  "tianshu_planner",
  "tianshu_executor",
  "fallback",
]);

export function assignModelRoles(model = {}) {
  const id = String(model.modelId || "").toLowerCase();
  const roles = new Set(["default_chat", "fallback"]);
  if (model.capabilities?.lowLatency || /mini|nano|flash|1b|3b|4b|8b/.test(id)) roles.add("fast_chat");
  if (model.capabilities?.lowCost || /mini|nano|flash|1b|3b|4b|8b/.test(id)) roles.add("cheap_chat");
  if (model.capabilities?.reasoning || /reason|deepseek|nemotron|qwq|qwen|kimi/.test(id)) roles.add("reasoning");
  if (model.capabilities?.coding || /code|coder|codegemma/.test(id)) roles.add("coding");
  if (model.capabilities?.chineseOptimized || /qwen|deepseek|kimi|minimax|glm|yi|baichuan/.test(id)) roles.add("chinese");
  if (model.capabilities?.longContext || /128k|long/.test(id)) roles.add("long_context");
  if (model.capabilities?.jsonMode) roles.add("json_mode");
  if (model.capabilities?.toolCalling) roles.add("tool_calling");
  if (roles.has("reasoning")) {
    roles.add("god_reviewer");
    roles.add("god_adjudicator");
    roles.add("tianshu_planner");
  }
  roles.add("tianshu_executor");
  return [...roles].filter((role) => MODEL_ROLES.includes(role));
}

export function buildModelRoleAssignment(models = []) {
  return {
    phase: "Phase805",
    modelRoleAssignmentReady: true,
    roles: MODEL_ROLES,
    assignments: models.map((model) => ({
      modelId: model.modelId,
      providerId: model.providerId,
      runtimeEligible: model.runtimeEligible === true,
      notRuntimeEligible: model.notRuntimeEligible === true,
      roles: assignModelRoles(model),
    })),
    providerCallsMade: false,
    secretRead: false,
  };
}
