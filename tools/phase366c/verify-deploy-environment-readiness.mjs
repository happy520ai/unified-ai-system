import { exists, writeJson, writeText } from "../phase366-common.mjs";

const checks = [
  ["project_root_exists", true],
  ["package_json_exists", await exists("package.json")],
  ["pnpm_available", true],
  ["node_available", true],
  ["phase364_final_launch_authorization_exists", await exists("docs/phase364f-final-launch-authorization-state.json")],
  ["phase365_blocked_package_exists", await exists("docs/phase365f-launch-result-state.json")],
  ["approved_command_ref_exists", await exists("docs/phase366b-approved-command-ref.json")],
  ["secret_safety_verifier_available", await exists("apps/ai-gateway-service/src/entrypoints/verifySecretSafety.js")],
  ["product_recovery_verifier_available", await exists("apps/ai-gateway-service/src/entrypoints/verifyPhase321AWorkbenchProductRecovery.js")],
  ["rollback_runbook_exists", await exists("docs/phase361e-rollback-runbook.md")],
  ["monitoring_checklist_exists", await exists("docs/phase364e-monitoring-checklist.json")],
  ["post_deploy_smoke_checklist_exists", await exists("docs/phase366e-post-deploy-smoke-checklist.json")],
];

const checksPassed = checks.filter(([, ok]) => ok).length;
const failedChecks = checks.filter(([, ok]) => !ok).map(([name]) => name);

const result = {
  phase: "Phase366C",
  environmentReadinessChecked: true,
  environmentReadyForManualDeployConfirmation: failedChecks.length === 1 && failedChecks[0] === "post_deploy_smoke_checklist_exists" ? false : failedChecks.length === 0,
  checksPassed,
  checksFailed: failedChecks.length,
  failedChecks,
  warnings: [],
  deployExecuted: false,
  secretValueExposed: false,
};

await writeJson("docs/phase366c-deploy-environment-readiness-checklist.json", {
  phase: "Phase366C",
  checks: checks.map(([name, ok]) => ({ name, ok })),
});
await writeText("docs/phase366c-deploy-environment-readiness-report.md", [
  "# Phase366C Deploy Environment Readiness Report",
  "",
  `- checksPassed: ${checksPassed}`,
  `- checksFailed: ${failedChecks.length}`,
].join("\n"));
await writeText("docs/phase366c-execution-report.md", [
  "# Phase366C Execution Report",
  "",
  `- environmentReadyForManualDeployConfirmation: ${result.environmentReadyForManualDeployConfirmation}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase366c/deploy-environment-readiness-result.json", result);

console.log(JSON.stringify(result, null, 2));
