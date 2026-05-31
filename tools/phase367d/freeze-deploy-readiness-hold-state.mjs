import { exists, readJson, writeJson, writeText } from "../phase367-common.mjs";

const phase366f = await readJson("docs/phase366f-final-deploy-rehearsal-state.json");
const phase367b = await readJson("docs/phase367b-approved-command-ref-redaction-check.json");
const phase367c = await readJson("apps/ai-gateway-service/evidence/phase367c/rollback-post-deploy-smoke-operator-review-result.json");
const monitoringReady = await exists("docs/phase364e-monitoring-checklist.json");
const finalManualConfirmationPresent = await exists("docs/approvals/phase365/final-manual-deploy-execution-confirmation.json");

const state = {
  phase: "Phase367D",
  deployReadinessHoldFrozen: true,
  readyForFinalManualDeployConfirmation: phase366f.readyForFinalManualDeployConfirmation === true,
  approvedCommandRefReady: phase367b.commandRefSafe === true,
  environmentReady: phase366f.environmentReady === true,
  rollbackReady: phase367c.rollbackOperatorChecklistReady === true,
  postDeploySmokeReady: phase367c.postDeploySmokeOperatorChecklistReady === true,
  monitoringReady,
  finalManualConfirmationPresent,
  executeDeploy: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  productionGaAuthorized: false,
  remainingBlockers: ["final_manual_deploy_execution_confirmation_required"],
  safety: {
    secretValueExposed: false,
    workspaceCleanClaimed: false,
  },
};

await writeJson("docs/phase367d-deploy-readiness-hold-state.json", state);
await writeText("docs/phase367d-deploy-readiness-hold-report.md", [
  "# Phase367D Deploy Readiness Hold Report",
  "",
  `- readyForFinalManualDeployConfirmation: ${state.readyForFinalManualDeployConfirmation}`,
  `- finalManualConfirmationPresent: ${state.finalManualConfirmationPresent}`,
].join("\n"));
await writeText("docs/phase367d-no-deploy-freeze-boundary.md", [
  "# Phase367D No-Deploy Freeze Boundary",
  "",
  "- Deploy remains frozen.",
  "- No deploy, release, tag, or artifact upload is allowed in Phase367.",
].join("\n"));
await writeText("docs/phase367d-execution-report.md", [
  "# Phase367D Execution Report",
  "",
  "- hold state frozen",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase367d/deploy-readiness-hold-state-result.json", state);

console.log(JSON.stringify(state, null, 2));
