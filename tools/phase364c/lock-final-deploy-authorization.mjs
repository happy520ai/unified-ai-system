import { readJson, writeJson, writeText } from "../phase364-common.mjs";

const phase363d = await readJson("docs/phase363d-deploy-authorization-state-rerun.json");
const phase363e = await readJson("docs/phase363e-signoff-verification-rerun-state.json");
const phase364b = await readJson("docs/phase364b-go-no-go-decision-validation-state.json");
const finalDeployAuthorizationLocked =
  phase363d.deployAuthorized === true &&
  phase363e.signoffsVerified === true &&
  phase364b.launchAuthorizationEligible === true &&
  phase364b.decisionRecordValid === true;

const state = {
  phase: "Phase364C",
  finalDeployAuthorizationLocked,
  deployAuthorized: finalDeployAuthorizationLocked,
  deployAuthorizationSource: "explicit_human_instruction",
  goNoGoDecisionRef: "docs/approvals/phase364/go-no-go-decision-record.json",
  requiresFinalManualExecutionConfirmation: true,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  productionGaAuthorized: false,
  conditions: phase364b.conditions || [],
  safety: {
    secretValueExposed: false,
    approvalForged: false,
  },
};

await writeText("docs/phase364c-final-deploy-authorization-lock.md", [
  "# Phase364C Final Deploy Authorization Lock",
  "",
  `- finalDeployAuthorizationLocked: ${state.finalDeployAuthorizationLocked}`,
  "- requiresFinalManualExecutionConfirmation: true",
  "- deployExecuted: false",
].join("\n"));
await writeJson("docs/phase364c-final-deploy-authorization-lock-state.json", state);
await writeText("docs/phase364c-execution-report.md", [
  "# Phase364C Execution Report",
  "",
  `- finalDeployAuthorizationLocked: ${state.finalDeployAuthorizationLocked}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase364c/final-deploy-authorization-lock-result.json", state);

console.log(JSON.stringify(state, null, 2));
