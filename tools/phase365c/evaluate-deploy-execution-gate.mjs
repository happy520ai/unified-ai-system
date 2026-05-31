import { readJson, writeJson, writeText } from "../phase365-common.mjs";

const phase364f = await readJson("docs/phase364f-final-launch-authorization-state.json");
const phase365a = await readJson("apps/ai-gateway-service/evidence/phase365a/final-manual-deploy-confirmation-intake-result.json");
const phase365b = await readJson("docs/phase365b-deploy-command-final-safety-state.json");

const blockers = [
  ...(phase364f.launchAuthorizationEligible === true ? [] : ["launch_authorization_not_eligible"]),
  ...(phase364f.deployAuthorizationLocked === true ? [] : ["deploy_authorization_not_locked"]),
  ...(phase364f.goNoGoDecisionValidated === true ? [] : ["go_no_go_not_validated"]),
  ...(phase365a.confirmationValid === true ? [] : ["confirmation_invalid"]),
  ...(phase365a.executeDeploy === true ? [] : ["execute_deploy_false"]),
  ...(phase365b.finalSafetyCheckPassed === true ? [] : [...phase365b.blockers]),
];

const result = {
  phase: "Phase365C",
  deployGateOpen: blockers.length === 0,
  deployExecutionAllowed: blockers.length === 0,
  blockers,
  warnings: [],
  requiresExplicitExecution: true,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
};

await writeJson("docs/phase365c-deploy-execution-gate-state.json", result);
await writeText("docs/phase365c-deploy-execution-gate-report.md", [
  "# Phase365C Deploy Execution Gate Report",
  "",
  `- deployGateOpen: ${result.deployGateOpen}`,
  `- deployExecutionAllowed: ${result.deployExecutionAllowed}`,
  `- blockers: ${result.blockers.join(", ") || "none"}`,
].join("\n"));
await writeText("docs/phase365c-execution-report.md", [
  "# Phase365C Execution Report",
  "",
  `- deployGateOpen: ${result.deployGateOpen}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase365c/deploy-execution-gate-result.json", result);

console.log(JSON.stringify(result, null, 2));
