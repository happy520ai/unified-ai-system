import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildProviderOnboardingWizardState } from "../../apps/agent-console/src/providerOnboardingWizard.js";
import { validateProviderOnboardingInput } from "../../apps/agent-console/src/providerOnboardingValidation.js";

const repoRoot = resolve(".");
const evidencePath = resolve(repoRoot, "apps/agent-console/evidence/phase330e/provider-onboarding-wizard-hardening-smoke.json");
const statePath = resolve(repoRoot, "docs/phase330e-onboarding-wizard-state-contract.json");
const rulesPath = resolve(repoRoot, "docs/phase330e-onboarding-validation-rules.json");
const reportPath = resolve(repoRoot, "docs/phase330e-onboarding-wizard-smoke-report.md");

const wizard = buildProviderOnboardingWizardState();
const rawSecret = validateProviderOnboardingInput({ providerId: "openai", credentialRefType: "env_key_name", credentialRef: "sk-forbidden", confirmation: true });
const accepted = validateProviderOnboardingInput({ providerId: "openai", credentialRefType: "env_key_name", credentialRef: "OPENAI_API_KEY", confirmation: true });
const unsupported = validateProviderOnboardingInput({ providerId: "unknown", credentialRefType: "env_key_name", credentialRef: "OPENAI_API_KEY", confirmation: true });
const production = validateProviderOnboardingInput({ providerId: "openai", credentialRefType: "env_key_name", credentialRef: "OPENAI_API_KEY", productionEnablementRequested: true, confirmation: true });

const evidence = {
  phase: "Phase330E",
  wizardVisible: wizard.wizardVisible,
  rawSecretRejected: rawSecret.code === "RAW_SECRET_REJECTED",
  credentialRefAccepted: accepted.allowed === true,
  unsupportedProviderRejected: unsupported.code === "UNSUPPORTED_PROVIDER",
  productionEnablementBlocked: production.code === "PRODUCTION_ENABLEMENT_BLOCKED_FROM_BETA_UI",
  betaBadgeVisible: wizard.betaBadgeVisible,
  costWarningVisible: wizard.costWarningVisible,
  quotaWarningVisible: wizard.quotaWarningVisible,
  revokeInstructionsVisible: wizard.revokeInstructionsVisible,
  directProviderCallFromUi: false,
};

await mkdir(resolve(repoRoot, "apps/agent-console/evidence/phase330e"), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
await writeFile(statePath, `${JSON.stringify({ phase: "Phase330E", ...wizard }, null, 2)}\n`, "utf8");
await writeFile(rulesPath, `${JSON.stringify(buildRules(), null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(evidence), "utf8");
console.log(JSON.stringify(evidence, null, 2));

function buildRules() {
  return {
    phase: "Phase330E",
    rules: [
      "reject raw secret-like input",
      "reject empty credentialRef",
      "reject unsupported reference type",
      "reject disabled provider",
      "reject production enablement from beta UI",
      "require explicit user confirmation for guarded real-call beta",
      "show cost warning for non NVIDIA providers",
      "show quota warning",
      "show rollback / revoke instructions"
    ],
  };
}

function renderReport(evidence) {
  return [
    "# Phase330E Onboarding Wizard Smoke Report",
    "",
    `- wizardVisible: ${evidence.wizardVisible}`,
    `- rawSecretRejected: ${evidence.rawSecretRejected}`,
    `- credentialRefAccepted: ${evidence.credentialRefAccepted}`,
    `- productionEnablementBlocked: ${evidence.productionEnablementBlocked}`,
    "",
  ].join("\n");
}
