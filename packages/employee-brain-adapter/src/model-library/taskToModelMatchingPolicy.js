export function matchTaskToModel(taskUnderstanding, bindings = []) {
  const taskType = taskUnderstanding?.taskType || "general_review";
  return bindings.find((binding) => (binding.allowedTaskTypes || []).includes(taskType)) || bindings[0] || null;
}

