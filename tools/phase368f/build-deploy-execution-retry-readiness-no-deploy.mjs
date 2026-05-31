import { readJson, writeJson, writeText } from "../phase368-common.mjs";

const phase368a = await readJson("apps/ai-gateway-service/evidence/phase368a/deployment-target-options-result.json");
const phase368d = await readJson("apps/ai-gateway-service/evidence/phase368d/deploy-command-ref-executable-adapter-design-result.json");
const phase368e = await readJson("apps/ai-gateway-service/evidence/phase368e/deployment-path-selection-packet-result.json");

const result = {
  phase: "Phase368F",
  deployRetryReadinessGenerated: true,
  phase365BlockerAddressed: false,
  blocker: "production_deploy_command_missing",
  deploymentTargetSelected: phase368e.humanTargetSelectionPresent === true,
  executableCommandRefReady: false,
  readyToRerunPhase365D: false,
  nextRequiredHumanAction: "select_deployment_target",
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  productionGaAuthorized: false,
  secretValueExposed: false,
  workspaceCleanClaimed: false,
};

await writeText(
  "docs/phase368f-deploy-execution-retry-readiness-report.md",
  [
    "# Phase368F Deploy Execution Retry Readiness Report",
    "",
    `- existingDeployScriptFound: ${phase368a.existingDeployScriptFound}`,
    `- deploymentTargetSelected: ${result.deploymentTargetSelected}`,
    `- executableCommandRefReady: ${result.executableCommandRefReady}`,
    `- blocker: ${result.blocker}`,
  ].join("\n"),
);
await writeJson("docs/phase368f-deploy-execution-retry-readiness-state.json", result);
await writeText(
  "docs/phase368f-next-step-target-selection-instructions.md",
  [
    "# Phase368F Next Step Target Selection Instructions",
    "",
    "- Step 1: human selects one deployment target in docs/approvals/phase368/deployment-target-selection.json.",
    "- Step 2: only after valid target selection, enter Phase369 to generate an executable commandRef.",
    "- Step 3: rerun Phase365A-F only after executable commandRef and final manual deploy confirmation both align.",
  ].join("\n"),
);
await writeText(
  "docs/phase368f-execution-report.md",
  [
    "# Phase368F Execution Report",
    "",
    `- requiresHumanTargetSelection: ${phase368d.requiresHumanTargetSelection}`,
    `- readyToRerunPhase365D: ${result.readyToRerunPhase365D}`,
  ].join("\n"),
);
await writeJson(
  "apps/ai-gateway-service/evidence/phase368f/deploy-execution-retry-readiness-no-deploy-result.json",
  result,
);

console.log(JSON.stringify(result, null, 2));
