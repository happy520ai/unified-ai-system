export function routeTaskToRoles(taskUnderstanding) {
  const roles = ["Product Manager", "UX Researcher", "AI Gateway Engineer"];
  if (taskUnderstanding.requiresSecurityReview || taskUnderstanding.riskLevel !== "low") {
    roles.push("Security Architect");
  }
  roles.push("Quality Assurance Engineer");
  return roles;
}
