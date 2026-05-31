import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildProviderOnboardingWizardState } from "../../apps/agent-console/src/providerOnboardingWizard.js";
import { validateProviderOnboardingInput } from "../../apps/agent-console/src/providerOnboardingValidation.js";
import { mapProviderOnboardingError } from "../../apps/agent-console/src/providerOnboardingErrorMapper.js";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase331e");
const evidencePath = resolve(evidenceDir, "provider-onboarding-beta-usability-smoke.json");
const checklistPath = resolve(repoRoot, "docs/phase331e-provider-onboarding-usability-checklist.json");
const errorMapPath = resolve(repoRoot, "docs/phase331e-provider-onboarding-error-message-map.json");
const reportPath = resolve(repoRoot, "docs/phase331e-provider-onboarding-usability-report.md");

const wizard = buildProviderOnboardingWizardState();
const rawSecret = validateProviderOnboardingInput({ providerId: "openai", credentialRefType: "env_key_name", credentialRef: "sk-forbidden", confirmation: true });
const rawSecretMessage = mapProviderOnboardingError(rawSecret.code);
const smoke = {
  phase: "Phase331E",
  wizardVisible: wizard.wizardVisible,
  progressVisible: wizard.progress?.progressVisible === true,
  helpTextVisible: Boolean(wizard.helpText?.credentialRef),
  rawSecretRejected: rawSecret.code === "RAW_SECRET_REJECTED",
  rawSecretRejectionMessageVisible: rawSecretMessage.includes("secret"),
  credentialRefExampleSafe: wizard.credentialRefExampleSafe === true && wizard.credentialRefExample === "OPENAI_API_KEY",
  betaOnlyBadgeVisible: wizard.betaOnlyBadgeVisible === true,
  costWarningVisible: wizard.costWarningVisible === true,
  quotaWarningVisible: wizard.quotaWarningVisible === true,
  revokeRotateDisableHelpVisible: wizard.revokeRotateDisableHelpVisible === true,
  noProviderCallFromUi: wizard.directProviderCallFromUi === false,
};

await mkdir(evidenceDir, { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(smoke, null, 2)}\n`, "utf8");
await writeFile(checklistPath, `${JSON.stringify(buildChecklist(), null, 2)}\n`, "utf8");
await writeFile(errorMapPath, `${JSON.stringify(buildErrorMap(), null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(smoke), "utf8");
await writeFile(resolve(repoRoot, "docs/phase331e-provider-onboarding-beta-usability-design.md"), renderDesign(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase331e-execution-report.md"), renderReport(smoke), "utf8");
console.log(JSON.stringify(smoke, null, 2));

function buildChecklist() {
  return {
    phase: "Phase331E",
    checks: [
      "step labels clear",
      "progress indicator visible",
      "help text visible",
      "blocked reason readable",
      "raw secret rejection explanation visible",
      "credentialRef example uses key name only",
      "provider disabled reason clear",
      "quota and budget warnings clear",
      "cost warning clear",
      "revoke rotate disable next steps clear",
      "beta only and not production wording clear",
    ],
  };
}

function buildErrorMap() {
  return {
    phase: "Phase331E",
    RAW_SECRET_REJECTED: mapProviderOnboardingError("RAW_SECRET_REJECTED"),
    CREDENTIAL_REF_MISSING: mapProviderOnboardingError("CREDENTIAL_REF_MISSING"),
    UNSUPPORTED_PROVIDER: mapProviderOnboardingError("UNSUPPORTED_PROVIDER"),
    PRODUCTION_ENABLEMENT_BLOCKED_FROM_BETA_UI: mapProviderOnboardingError("PRODUCTION_ENABLEMENT_BLOCKED_FROM_BETA_UI"),
  };
}

function renderDesign() {
  return [
    "# Phase331E Provider Onboarding Beta Usability Design",
    "",
    "This pass adds progress, readable help text, safe credentialRef examples, and governance error messages.",
    "The UI remains beta-only and does not call providers directly.",
    "",
  ].join("\n");
}

function renderReport(smoke) {
  return [
    "# Phase331E Provider Onboarding Usability Report",
    "",
    `- wizardVisible: ${smoke.wizardVisible}`,
    `- progressVisible: ${smoke.progressVisible}`,
    `- helpTextVisible: ${smoke.helpTextVisible}`,
    `- rawSecretRejected: ${smoke.rawSecretRejected}`,
    `- credentialRefExampleSafe: ${smoke.credentialRefExampleSafe}`,
    `- noProviderCallFromUi: ${smoke.noProviderCallFromUi}`,
    "",
  ].join("\n");
}
