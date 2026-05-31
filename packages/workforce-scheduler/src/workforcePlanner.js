export function understandWorkforceTask(input) {
  const text = String(input || "");
  return {
    originalTask: text,
    taskType: /UX|试用|体验|用户|feedback/i.test(text) ? "ux_refinement_plan" : "architecture_review",
    riskLevel: /secret|provider|deploy|billing|invoice/i.test(text) ? "high" : "medium",
    requiresSecurityReview: /secret|provider|deploy|billing|invoice|安全/i.test(text),
    requiresUxReview: /UX|试用|体验|用户|feedback/i.test(text),
  };
}
