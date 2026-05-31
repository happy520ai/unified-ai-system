import { readJson, writeJson, writeText } from "../phase372-common.mjs";

const phase372a = await readJson("apps/ai-gateway-service/evidence/phase372a/three-mode-real-browser-ui-acceptance-result.json");
const phase372b = await readJson("apps/ai-gateway-service/evidence/phase372b/god-mode-screenshot-acceptance-result.json");
const phase372c = await readJson("apps/ai-gateway-service/evidence/phase372c/tianshu-screenshot-acceptance-result.json");
const phase372d = await readJson("apps/ai-gateway-service/evidence/phase372d/provider-credentialref-screenshot-acceptance-result.json");
const phase372e = await readJson("apps/ai-gateway-service/evidence/phase372e/phase308a-smoke-marker-repair-result.json");

const result = {
  phase: "Phase372F",
  noDeployUiAcceptanceClosureGenerated: true,
  realBrowserAcceptanceCompleted: phase372a.realBrowserUsed === true,
  screenshotAcceptanceCompleted: phase372a.screenshotCaptured === true && phase372b.screenshotCaptured === true && phase372c.screenshotCaptured === true && phase372d.screenshotCaptured === true,
  godModeAcceptancePassed: phase372b.acceptancePassed === true,
  tianshuAcceptancePassed: phase372c.acceptancePassed === true,
  providerCredentialRefAcceptancePassed: phase372d.acceptancePassed === true,
  phase308aSmokeMarkerRepaired: phase372e.smokeScriptUpdated === true,
  remainingUiQaGapsGenerated: true,
  launchRecommended: false,
  deployRecommended: false,
  productionGaAuthorized: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  secretValueExposed: false,
  workspaceCleanClaimed: false,
};

await writeText(
  "docs/phase372f-no-deploy-ui-acceptance-closure-report.md",
  [
    "# Phase372F No-deploy UI Acceptance Closure Report",
    "",
    `- realBrowserAcceptanceCompleted: ${result.realBrowserAcceptanceCompleted}`,
    `- screenshotAcceptanceCompleted: ${result.screenshotAcceptanceCompleted}`,
    `- phase308aSmokeMarkerRepaired: ${result.phase308aSmokeMarkerRepaired}`,
    "- still no production deploy",
    "- still no GA",
  ].join("\n"),
);
await writeText(
  "docs/phase372f-three-mode-screenshot-acceptance-summary.md",
  [
    "# Phase372F Three-mode Screenshot Acceptance Summary",
    "",
    `- Phase372A acceptancePassed: ${phase372a.acceptancePassed}`,
    `- Phase372B acceptancePassed: ${phase372b.acceptancePassed}`,
    `- Phase372C acceptancePassed: ${phase372c.acceptancePassed}`,
    `- Phase372D acceptancePassed: ${phase372d.acceptancePassed}`,
  ].join("\n"),
);
await writeText(
  "docs/phase372f-smoke-marker-repair-summary.md",
  [
    "# Phase372F Smoke Marker Repair Summary",
    "",
    `- oldMarkerDriftDetected: ${phase372e.oldMarkerDriftDetected}`,
    `- smokeScriptUpdated: ${phase372e.smokeScriptUpdated}`,
  ].join("\n"),
);
await writeJson("docs/phase372f-remaining-ui-qa-gaps.json", {
  phase: "Phase372F",
  gaps: [
    {
      id: "real-browser-text-encoding",
      status: "open",
      note: "Browser screenshots show visible encoding/copy rendering defects that still need polish.",
    },
    {
      id: "three-mode-mode-switch-verification",
      status: "open",
      note: "Screenshots exist, but real browser interaction-level confirmation for God/Tianshu active state still needs follow-up.",
    },
  ],
});
await writeText(
  "docs/phase372f-next-ui-hardening-roadmap.md",
  [
    "# Phase372F Next UI Hardening Roadmap",
    "",
    "1. Fix browser-visible encoding and copy rendering issues.",
    "2. Add interaction-level browser acceptance for Three Mode tab switching.",
    "3. Re-run screenshot acceptance and smoke regression.",
  ].join("\n"),
);
await writeText(
  "docs/phase372f-execution-report.md",
  [
    "# Phase372F Execution Report",
    "",
    `- launchRecommended: ${result.launchRecommended}`,
    `- deployRecommended: ${result.deployRecommended}`,
  ].join("\n"),
);
await writeJson("apps/ai-gateway-service/evidence/phase372f/no-deploy-ui-acceptance-closure-result.json", result);

console.log(JSON.stringify(result, null, 2));
