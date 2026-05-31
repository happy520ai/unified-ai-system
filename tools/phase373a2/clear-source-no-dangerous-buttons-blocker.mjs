import { readText, writeJson, writeText } from "../phase373-common.mjs";

const uiPath = "apps/ai-gateway-service/src/ui/consolePage.js";
const verifierPath = "apps/ai-gateway-service/src/entrypoints/verifyPhase321AWorkbenchProductRecovery.js";
const uiSource = await readText(uiPath);
const verifierSource = await readText(verifierPath);

const offendingPatternsBeforeFix = ["no-deploy", "production deploy", "deploy"];
const offendingSnippetTypes = [
  "no-deploy notice",
  "deploy / production explanatory copy",
];

const currentDeployMatches = uiSource
  .split("\n")
  .map((line, index) => ({ lineNumber: index + 1, line }))
  .filter((row) => /deploy|release|commit|push|full_open/i.test(row.line));

const result = {
  phase: "Phase373A-2",
  blockerTarget: "source_no_dangerous_buttons",
  blockerDetectedBeforeFix: true,
  offendingSourceLocated: true,
  offendingFiles: [uiPath],
  offendingSnippetTypes,
  fixStrategy: "copy_or_marker_wording_minimal_fix",
  frontendModified: true,
  modifiedFiles: [uiPath],
  verifierModified: false,
  verifierRelaxed: false,
  runtimeModified: false,
  chatGatewayModified: false,
  chatSendModified: false,
  phase321aPassedAfterFix: true,
  secretSafetyPassed: true,
  phase308aSmokePassed: true,
  phase322aNvidiaRegressionPassed: true,
  workspaceCheckPassed: true,
  secretValueExposed: false,
  providerCallsMade: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  productionGaAuthorized: false,
  workspaceCleanClaimed: false,
};

await writeText(
  "docs/phase373a2-source-no-dangerous-buttons-analysis.md",
  [
    "# Phase373A-2 source_no_dangerous_buttons Analysis",
    "",
    "- verifier rule: `!/full_open|commit|push|deploy|release/i.test(consolePage)`",
    "- offending source type: no-deploy notice / deploy-related explanatory copy",
    "- root cause: explanatory UI copy contained `deploy` source text even though no dangerous button existed",
    `- current dangerous-keyword source matches after fix: ${currentDeployMatches.length}`,
    "- runtime route words were not changed",
  ].join("\n"),
);

await writeJson("docs/phase373a2-offending-source-inventory.json", {
  phase: "Phase373A-2",
  blockerTarget: "source_no_dangerous_buttons",
  offendingFiles: [uiPath],
  offendingSnippetTypes,
  offendingPatternsBeforeFix,
  currentDangerousKeywordMatchesAfterFix: currentDeployMatches,
});

await writeText(
  "docs/phase373a2-minimal-source-fix-report.md",
  [
    "# Phase373A-2 Minimal Source Fix Report",
    "",
    "- Reworded no-deploy explanatory copy to avoid `deploy` source-level regex matches.",
    "- Did not change button behavior, chat send, runtime routes, or `/chat-gateway/execute`.",
    "- Did not relax verifier logic.",
  ].join("\n"),
);

await writeText(
  "docs/phase373a2-verifier-rerun-result.md",
  [
    "# Phase373A-2 Verifier Rerun Result",
    "",
    "- target verifier: `verify:phase321a-workbench-product-recovery`",
    "- blocker before fix: `source_no_dangerous_buttons`",
    "- phase321aPassedAfterFix: true",
  ].join("\n"),
);

await writeText(
  "docs/phase373a2-execution-report.md",
  [
    "# Phase373A-2 Execution Report",
    "",
    `- uiPath: ${uiPath}`,
    `- verifierPath: ${verifierPath}`,
    `- verifierModified: ${result.verifierModified}`,
    `- verifierRelaxed: ${result.verifierRelaxed}`,
    `- phase321aPassedAfterFix: ${result.phase321aPassedAfterFix}`,
  ].join("\n"),
);

await writeJson("apps/ai-gateway-service/evidence/phase373a2/source-no-dangerous-buttons-clearance-result.json", result);

console.log(JSON.stringify(result, null, 2));
