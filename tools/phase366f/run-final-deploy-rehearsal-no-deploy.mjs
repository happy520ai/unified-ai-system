import { exists, readJson, writeJson, writeText } from "../phase366-common.mjs";

const phase365f = await readJson("docs/phase365f-launch-result-state.json");
const phase366a = await readJson("apps/ai-gateway-service/evidence/phase366a/deploy-blocker-remediation-result.json");
const phase366b = await readJson("docs/phase366b-approved-command-ref.json");
const phase366c = await readJson("apps/ai-gateway-service/evidence/phase366c/deploy-environment-readiness-result.json");
const phase366d = await readJson("apps/ai-gateway-service/evidence/phase366d/rollback-execution-confirmation-template-result.json");
const phase366e = await readJson("apps/ai-gateway-service/evidence/phase366e/post-deploy-smoke-checklist-hardening-result.json");
const finalConfirmationExists = await exists("docs/approvals/phase365/final-manual-deploy-execution-confirmation.json");

const result = {
  phase: "Phase366F",
  finalDeployRehearsalExecuted: true,
  readyForFinalManualDeployConfirmation:
    phase365f.launchStatus === "blocked" &&
    phase366a.finalConfirmationTemplateGenerated === true &&
    Boolean(phase366b.commandRefId) &&
    phase366c.checksFailed === 0 &&
    phase366d.rollbackTemplateGenerated === true &&
    phase366e.requiredChecksCovered === true,
  approvedCommandRefReady: Boolean(phase366b.commandRefId),
  environmentReady: phase366c.checksFailed === 0,
  rollbackTemplateReady: phase366d.rollbackTemplateGenerated === true,
  postDeploySmokeChecklistReady: phase366e.requiredChecksCovered === true,
  remainingBlockers: finalConfirmationExists ? [] : ["final_manual_deploy_execution_confirmation_required"],
  nextRequiredHumanAction: "create_final_manual_deploy_execution_confirmation",
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  productionGaAuthorized: false,
  secretValueExposed: false,
  workspaceCleanClaimed: false,
};

if (result.readyForFinalManualDeployConfirmation) {
  result.remainingBlockers = ["final_manual_deploy_execution_confirmation_required"];
}

await writeText("docs/phase366f-final-deploy-rehearsal-report.md", [
  "# Phase366F Final Deploy Rehearsal Report",
  "",
  `- readyForFinalManualDeployConfirmation: ${result.readyForFinalManualDeployConfirmation}`,
  `- remainingBlockers: ${result.remainingBlockers.join(", ") || "none"}`,
].join("\n"));
await writeJson("docs/phase366f-final-deploy-rehearsal-state.json", result);
await writeText("docs/phase366f-next-step-deploy-confirmation-instructions.md", [
  "# Phase366F Next Step Deploy Confirmation Instructions",
  "",
  "- Review the final confirmation template from Phase366A.",
  "- Review the approved commandRef from Phase366B.",
  "- Create the real final manual deploy execution confirmation only when you are ready to authorize a future Phase365 rerun.",
].join("\n"));
await writeText("docs/phase366f-execution-report.md", [
  "# Phase366F Execution Report",
  "",
  "- rehearsal executed",
  `- readyForFinalManualDeployConfirmation: ${result.readyForFinalManualDeployConfirmation}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase366f/final-deploy-rehearsal-no-deploy-result.json", result);

console.log(JSON.stringify(result, null, 2));
