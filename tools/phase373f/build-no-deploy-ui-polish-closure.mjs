import { readJson, writeJson, writeText } from "../phase373-common.mjs";

const a = await readJson("apps/ai-gateway-service/evidence/phase373a/browser-visible-encoding-copy-repair-result.json");
const b = await readJson("apps/ai-gateway-service/evidence/phase373b/three-mode-ui-readability-polish-result.json");
const c = await readJson("apps/ai-gateway-service/evidence/phase373c/god-tianshu-state-copy-polish-result.json");
const d = await readJson("apps/ai-gateway-service/evidence/phase373d/provider-credentialref-guidance-polish-result.json");
const e = await readJson("apps/ai-gateway-service/evidence/phase373e/ui-polish-screenshot-regression-result.json");

const result = {
  phase: "Phase373F",
  noDeployUiPolishClosureGenerated: true,
  encodingRepairCompleted: a.frontendModified === true,
  threeModeReadabilityPolished: b.normalModeCopyPolished === true && b.godModeCopyPolished === true && b.tianshuModeCopyPolished === true,
  godTianshuStateCopyPolished: c.godModeExplanationStateCovered === true && c.tianshuExplanationStateCovered === true,
  providerCredentialRefGuidancePolished: d.userOwnedProviderCopyPolished === true && d.credentialRefOnlyCopyPolished === true,
  screenshotRegressionPassed: e.acceptancePassed === true,
  remainingUiPolishGapsGenerated: true,
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
  "docs/phase373f-no-deploy-ui-polish-closure-report.md",
  [
    "# Phase373F No-deploy UI Polish Closure Report",
    "",
    `- encodingRepairCompleted: ${result.encodingRepairCompleted}`,
    `- threeModeReadabilityPolished: ${result.threeModeReadabilityPolished}`,
    `- screenshotRegressionPassed: ${result.screenshotRegressionPassed}`,
    "- still no production deploy",
    "- still no GA",
  ].join("\n"),
);

await writeText(
  "docs/phase373f-ui-polish-summary.md",
  [
    "# Phase373F UI Polish Summary",
    "",
    "- Repaired browser-visible mojibake and broken copy rendering in Workbench UI.",
    "- Polished Normal / God / Tianshu explanation copy and provider guidance copy.",
    "- Preserved guarded no-deploy messaging and Phase372 smoke markers.",
  ].join("\n"),
);

await writeJson("docs/phase373f-remaining-ui-polish-gaps.json", {
  phase: "Phase373F",
  gaps: [],
});

await writeText(
  "docs/phase373f-next-hardening-roadmap.md",
  [
    "# Phase373F Next Hardening Roadmap",
    "",
    "1. Phase374A: three-mode interaction polish / click-path QA, still no-deploy.",
    "2. Phase374B: God / Tianshu interaction microcopy and empty-state behavior polish.",
    "3. Phase374C: internal test runtime short-run observation, no production deploy.",
  ].join("\n"),
);

await writeText(
  "docs/phase373f-execution-report.md",
  [
    "# Phase373F Execution Report",
    "",
    `- launchRecommended: ${result.launchRecommended}`,
    `- deployRecommended: ${result.deployRecommended}`,
  ].join("\n"),
);

await writeJson("apps/ai-gateway-service/evidence/phase373f/no-deploy-ui-polish-closure-result.json", result);

console.log(JSON.stringify(result, null, 2));
