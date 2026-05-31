import { readJson, writeJson, writeText } from "../phase365-common.mjs";

const gate = await readJson("docs/phase365c-deploy-execution-gate-state.json");
const deployState = await readJson("docs/phase365d-deploy-execution-state.json");
const smokeState = await readJson("docs/phase365e-post-deploy-smoke-state.json");

let launchStatus = "blocked";
if (gate.deployGateOpen === false) launchStatus = "blocked";
else if (deployState.deployExecuted === false) launchStatus = "not_deployed";
else if (deployState.deployFailed === true) launchStatus = "deploy_failed";
else if (smokeState.postDeploySmokeExecuted === true && smokeState.postDeploySmokePassed === true) launchStatus = "deployed_smoke_passed";
else if (smokeState.postDeploySmokeExecuted === true && smokeState.postDeploySmokePassed === false) launchStatus = "deployed_smoke_failed";

const result = {
  phase: "Phase365F",
  launchResultPackageGenerated: true,
  deployAttempted: deployState.deployAttempted,
  deployExecuted: deployState.deployExecuted,
  deploySucceeded: deployState.deploySucceeded,
  deployFailed: deployState.deployFailed,
  postDeploySmokeExecuted: smokeState.postDeploySmokeExecuted,
  postDeploySmokePassed: smokeState.postDeploySmokePassed,
  launchStatus,
  rollbackRecommended: deployState.rollbackRecommended || smokeState.rollbackRecommended,
  rollbackExecuted: false,
  productionGaAuthorized: false,
  followUpActions: deployState.deployExecuted ? [] : ["await_final_manual_confirmation_or_approved_command_execution_path"],
  safety: {
    secretValueExposed: false,
    workspaceCleanClaimed: false,
  },
};

await writeText("docs/phase365f-launch-result-evidence-package.md", [
  "# Phase365F Launch Result Evidence Package",
  "",
  `- launchStatus: ${result.launchStatus}`,
  `- deployExecuted: ${result.deployExecuted}`,
  `- postDeploySmokeExecuted: ${result.postDeploySmokeExecuted}`,
].join("\n"));
await writeJson("docs/phase365f-launch-result-state.json", result);
await writeText("docs/phase365f-launch-risk-and-follow-up.md", [
  "# Phase365F Launch Risk And Follow-up",
  "",
  ...result.followUpActions.map((item) => `- ${item}`),
].join("\n"));
await writeText("docs/phase365f-execution-report.md", [
  "# Phase365F Execution Report",
  "",
  `- launchStatus: ${result.launchStatus}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase365f/launch-result-evidence-package-result.json", result);

console.log(JSON.stringify(result, null, 2));
