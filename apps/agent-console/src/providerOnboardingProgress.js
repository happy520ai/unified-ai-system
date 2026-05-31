export function buildProviderOnboardingProgress(steps = [], currentStepId = "provider_selection") {
  const total = steps.length;
  const currentIndex = Math.max(0, steps.findIndex((step) => step.id === currentStepId));
  return {
    progressVisible: true,
    currentStepId,
    currentStepNumber: currentIndex + 1,
    totalSteps: total,
    percentComplete: total > 0 ? Math.round(((currentIndex + 1) / total) * 100) : 0,
  };
}
