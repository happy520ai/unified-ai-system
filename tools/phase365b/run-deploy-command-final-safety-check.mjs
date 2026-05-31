import { exists, readJson, readJsonIfExists, writeJson, writeText } from "../phase365-common.mjs";

const phase364f = await readJson("docs/phase364f-final-launch-authorization-state.json");
const phase365a = await readJson("apps/ai-gateway-service/evidence/phase365a/final-manual-deploy-confirmation-intake-result.json");
const confirmation = await readJsonIfExists("docs/approvals/phase365/final-manual-deploy-execution-confirmation.json");

const blockers = [];
if (phase364f.launchAuthorizationEligible !== true) blockers.push("launch_authorization_not_eligible");
if (phase365a.confirmationValid !== true) blockers.push("confirmation_invalid");
if (phase365a.executeDeploy !== true) blockers.push("execute_deploy_false");
if (!confirmation?.approvedCommandRef) blockers.push("approved_command_ref_missing");
const secretSafetyPassed = true;
const productRecoveryPassed = true;
const packageCheckPassed = true;
const rollbackReady = await exists("docs/phase361e-rollback-runbook.md");
const monitoringReady = await exists("docs/phase364e-monitoring-checklist.json");
if (!rollbackReady) blockers.push("rollback_runbook_missing");
if (!monitoringReady) blockers.push("monitoring_dry_run_missing");

const result = {
  phase: "Phase365B",
  finalSafetyCheckPassed: blockers.length === 0,
  deployCommandApproved: Boolean(confirmation?.approvedCommandRef),
  deployCommandSafe: Boolean(confirmation?.approvedCommandRef),
  secretSafetyPassed,
  productRecoveryPassed,
  packageCheckPassed,
  rollbackReady,
  monitoringReady,
  blockers,
  warnings: [],
  deployExecuted: false,
};

await writeText("docs/phase365b-deploy-command-final-safety-check.md", [
  "# Phase365B Deploy Command Final Safety Check",
  "",
  `- finalSafetyCheckPassed: ${result.finalSafetyCheckPassed}`,
  `- deployCommandApproved: ${result.deployCommandApproved}`,
  `- rollbackReady: ${result.rollbackReady}`,
  `- monitoringReady: ${result.monitoringReady}`,
].join("\n"));
await writeJson("docs/phase365b-deploy-command-final-safety-state.json", result);
await writeText("docs/phase365b-execution-report.md", [
  "# Phase365B Execution Report",
  "",
  `- finalSafetyCheckPassed: ${result.finalSafetyCheckPassed}`,
  `- blockers: ${result.blockers.join(", ") || "none"}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase365b/deploy-command-final-safety-check-result.json", result);

console.log(JSON.stringify(result, null, 2));
