import { readText, writeJson, writeText } from "../phase371-common.mjs";

const uiSource = await readText("apps/ai-gateway-service/src/ui/consolePage.js");
const helpTextSource = await readText("apps/agent-console/src/providerOnboardingHelpText.js");
const credentialRefSource = await readText("apps/agent-console/src/credentialRefForm.js");

const state = {
  phase: "Phase371D",
  providerSetupCredentialRefUxAcceptanceExecuted: true,
  modelLibraryEntryCovered: uiSource.includes("模型配置") || uiSource.includes("Model"),
  providerSetupJourneyCovered: uiSource.includes("API Key") && uiSource.includes("NVIDIA Base URL"),
  credentialRefOnlyCopyCovered: uiSource.includes("credentialRefOnly") || helpTextSource.includes("credential reference"),
  secretValueForbiddenCopyCovered: helpTextSource.includes("secret-looking values are rejected") || credentialRefSource.includes("SECRET_LIKE_INPUT_REJECTED"),
  providerUnconfiguredCopyCovered: uiSource.includes("未配置 API Key") || uiSource.includes("provider or model setup required"),
  quotaBudgetBillingCopyCovered: helpTextSource.includes("quota, budget") || uiSource.includes("quota / budget"),
  secretValueVisible: false,
  realProviderCallMade: false,
  deployExecuted: false,
  acceptancePassed: false,
  manualBrowserVerificationRequired: true,
};

await writeText(
  "docs/phase371d-provider-setup-credentialref-ux-acceptance-report.md",
  [
    "# Phase371D Provider Setup / CredentialRef UX Acceptance Report",
    "",
    "- Static copy/source acceptance executed.",
    "- Manual browser verification still required.",
    `- modelLibraryEntryCovered: ${state.modelLibraryEntryCovered}`,
    `- providerSetupJourneyCovered: ${state.providerSetupJourneyCovered}`,
    `- credentialRefOnlyCopyCovered: ${state.credentialRefOnlyCopyCovered}`,
  ].join("\n"),
);
await writeJson("docs/phase371d-provider-setup-credentialref-checklist.json", state);
await writeText(
  "docs/phase371d-provider-setup-ux-gap-list.md",
  [
    "# Phase371D Provider Setup UX Gap List",
    "",
    "- manual browser verification pending",
    "- credential revoke / rotation real interaction walkthrough pending",
    "- quota / budget / estimate-only visual wording review pending",
  ].join("\n"),
);
await writeText(
  "docs/phase371d-execution-report.md",
  [
    "# Phase371D Execution Report",
    "",
    "- static credentialRef UX acceptance executed",
    "- manualBrowserVerificationRequired: true",
  ].join("\n"),
);
await writeJson(
  "apps/ai-gateway-service/evidence/phase371d/provider-setup-credentialref-ux-acceptance-result.json",
  state,
);

console.log(JSON.stringify(state, null, 2));
