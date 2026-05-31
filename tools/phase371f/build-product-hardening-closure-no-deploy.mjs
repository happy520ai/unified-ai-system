import { readJson, writeJson, writeText } from "../phase371-common.mjs";

const phase371a = await readJson("apps/agent-console/evidence/phase371a/three-mode-ui-implementation-candidate-result.json");
const phase371b = await readJson("apps/agent-console/evidence/phase371b/god-mode-visual-acceptance-result.json");
const phase371c = await readJson("apps/agent-console/evidence/phase371c/tianshu-visual-acceptance-result.json");
const phase371d = await readJson("apps/ai-gateway-service/evidence/phase371d/provider-setup-credentialref-ux-acceptance-result.json");
const phase371e = await readJson("apps/ai-gateway-service/evidence/phase371e/internal-test-runtime-long-run-observation-result.json");

const gaps = {
  phase: "Phase371F",
  remainingGaps: [
    "manual browser verification pending",
    "long-run observation pending",
    "candidate UI still not screenshot-accepted",
    "provider setup / credentialRef UX still needs manual walkthrough",
    "three-mode visual polish still needs follow-up",
  ],
};

const state = {
  phase: "Phase371F",
  productHardeningClosureGenerated: true,
  threeModeUiAcceptanceSummaryGenerated: true,
  remainingProductGapsGenerated: true,
  noProductionDeployClosureGenerated: true,
  launchRecommended: false,
  deployRecommended: false,
  productionGaAuthorized: false,
  manualBrowserVerificationPending:
    phase371b.manualBrowserVerificationRequired === true ||
    phase371c.manualBrowserVerificationRequired === true ||
    phase371d.manualBrowserVerificationRequired === true,
  longRunObservationPending: phase371e.longRunExecuted !== true,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  secretValueExposed: false,
  workspaceCleanClaimed: false,
};

await writeText(
  "docs/phase371f-product-hardening-closure-report.md",
  [
    "# Phase371F Product Hardening Closure Report",
    "",
    "- Phase371 remained in UI implementation / visual acceptance / internal test observation planning.",
    "- This phase is not production deploy and not GA.",
    `- frontendCandidateModified: ${phase371a.frontendCandidateModified}`,
    `- manualBrowserVerificationPending: ${state.manualBrowserVerificationPending}`,
    `- longRunObservationPending: ${state.longRunObservationPending}`,
  ].join("\n"),
);
await writeText(
  "docs/phase371f-three-mode-ui-acceptance-summary.md",
  [
    "# Phase371F Three-mode UI Acceptance Summary",
    "",
    `- God Mode candidate visible by source check: ${phase371b.godModePanelVisible}`,
    `- Tianshu candidate visible by source check: ${phase371c.tianshuPanelVisible}`,
    `- Provider setup copy covered by source check: ${phase371d.providerSetupJourneyCovered}`,
    "- Manual browser verification still pending.",
  ].join("\n"),
);
await writeJson("docs/phase371f-remaining-product-gaps.json", gaps);
await writeText(
  "docs/phase371f-no-production-deploy-closure.md",
  [
    "# Phase371F No Production Deploy Closure",
    "",
    "- candidate only",
    "- no production deploy",
    "- no GA",
    "- do not return to deploy line after this phase",
  ].join("\n"),
);
await writeText(
  "docs/phase371f-next-hardening-roadmap.md",
  [
    "# Phase371F Next Hardening Roadmap",
    "",
    "- real browser / screenshot-driven three-mode acceptance",
    "- provider setup / credentialRef UX manual walkthrough",
    "- internal test runtime short-run or long-run observation",
    "- follow-up UI polish after visual QA",
  ].join("\n"),
);
await writeText(
  "docs/phase371f-execution-report.md",
  [
    "# Phase371F Execution Report",
    "",
    `- manualBrowserVerificationPending: ${state.manualBrowserVerificationPending}`,
    `- longRunObservationPending: ${state.longRunObservationPending}`,
  ].join("\n"),
);
await writeJson(
  "apps/ai-gateway-service/evidence/phase371f/product-hardening-closure-no-deploy-result.json",
  state,
);

console.log(JSON.stringify(state, null, 2));
