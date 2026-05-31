import { PROVIDER_ONBOARDING_STEPS } from "./providerOnboardingSteps.js";
import { getProviderOnboardingHelpText } from "./providerOnboardingHelpText.js";
import { buildProviderOnboardingProgress } from "./providerOnboardingProgress.js";

export function buildProviderOnboardingWizardState() {
  return {
    wizardId: "provider-onboarding-wizard",
    wizardVisible: true,
    steps: PROVIDER_ONBOARDING_STEPS,
    progress: buildProviderOnboardingProgress(PROVIDER_ONBOARDING_STEPS),
    helpText: getProviderOnboardingHelpText(),
    betaBadgeVisible: true,
    betaOnlyBadgeVisible: true,
    costWarningVisible: true,
    quotaWarningVisible: true,
    revokeInstructionsVisible: true,
    revokeRotateDisableHelpVisible: true,
    credentialRefExample: "OPENAI_API_KEY",
    credentialRefExampleSafe: true,
    directProviderCallFromUi: false,
  };
}
