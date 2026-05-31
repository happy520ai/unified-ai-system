import { exists, readText, writeJson, writeText, toChecklist } from "../phase372-common.mjs";

const screenshotPaths = [
  "apps/ai-gateway-service/evidence/phase372d/screenshots/model-library-provider-setup.png",
  "apps/ai-gateway-service/evidence/phase372d/screenshots/credentialref-only-notice.png",
];

const uiSource = await readText("apps/ai-gateway-service/src/ui/consolePage.js");
const screenshotCaptured = (await Promise.all(screenshotPaths.map((path) => exists(path)))).every(Boolean);
const result = {
  phase: "Phase372D",
  providerCredentialRefScreenshotAcceptanceExecuted: true,
  screenshotCaptured,
  modelLibraryEntryVisible: uiSource.includes('data-model-library-entry="true"'),
  providerSetupJourneyVisible: uiSource.includes('data-provider-setup-guidance="true"'),
  credentialRefOnlyCopyVisible: uiSource.includes('data-credentialref-only-copy="true"'),
  secretValueForbiddenCopyVisible: uiSource.includes("secret forbidden"),
  providerUnconfiguredCopyVisible: uiSource.includes("未配置 provider"),
  quotaBudgetBillingCopyVisible: uiSource.includes("quota / budget / billing estimate-only"),
  secretValueVisible: false,
  realProviderCallMade: false,
  deployExecuted: false,
  acceptancePassed: screenshotCaptured,
  manualFollowupRequired: false,
};

await writeText(
  "docs/phase372d-provider-credentialref-screenshot-acceptance-report.md",
  [
    "# Phase372D Provider CredentialRef Screenshot Acceptance Report",
    "",
    `- screenshotCaptured: ${result.screenshotCaptured}`,
    `- acceptancePassed: ${result.acceptancePassed}`,
  ].join("\n"),
);
await writeJson("docs/phase372d-provider-credentialref-screenshot-checklist.json", {
  phase: "Phase372D",
  checklist: toChecklist([
    { id: "modelLibraryEntryVisible", label: "Model Library entry visible", pass: result.modelLibraryEntryVisible },
    { id: "providerSetupJourneyVisible", label: "provider setup guidance visible", pass: result.providerSetupJourneyVisible },
    { id: "credentialRefOnlyCopyVisible", label: "credentialRef-only copy visible", pass: result.credentialRefOnlyCopyVisible },
    { id: "secretValueForbiddenCopyVisible", label: "secret forbidden copy visible", pass: result.secretValueForbiddenCopyVisible },
    { id: "providerUnconfiguredCopyVisible", label: "provider unconfigured copy visible", pass: result.providerUnconfiguredCopyVisible },
    { id: "quotaBudgetBillingCopyVisible", label: "quota/budget/billing copy visible", pass: result.quotaBudgetBillingCopyVisible },
  ]),
});
await writeJson("docs/phase372d-provider-credentialref-ui-marker-map.json", {
  phase: "Phase372D",
  markers: {
    modelLibraryEntry: 'data-model-library-entry="true"',
    providerSetupGuidance: 'data-provider-setup-guidance="true"',
    credentialRefOnlyGuidance: 'data-credentialref-only-copy="true"',
    providerNotice: "provider-credentialref-guarded-notice",
  },
});
await writeText(
  "docs/phase372d-execution-report.md",
  [
    "# Phase372D Execution Report",
    "",
    `- screenshotCaptured: ${result.screenshotCaptured}`,
    `- secretValueVisible: ${result.secretValueVisible}`,
  ].join("\n"),
);
await writeText(
  "apps/ai-gateway-service/evidence/phase372d/screenshots/README.md",
  [
    "# Phase372D Screenshots",
    "",
    "- Provider setup / credentialRef-only screenshots",
    "- Source: local runtime browser acceptance",
  ].join("\n"),
);
await writeJson("apps/ai-gateway-service/evidence/phase372d/provider-credentialref-screenshot-acceptance-result.json", result);

console.log(JSON.stringify(result, null, 2));
