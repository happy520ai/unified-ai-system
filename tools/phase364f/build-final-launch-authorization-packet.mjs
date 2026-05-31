import { readJson, writeJson, writeText } from "../phase364-common.mjs";

const phase364b = await readJson("docs/phase364b-go-no-go-decision-validation-state.json");
const phase364c = await readJson("docs/phase364c-final-deploy-authorization-lock-state.json");

const state = {
  phase: "Phase364F",
  finalLaunchAuthorizationPacketGenerated: true,
  launchAuthorizationEligible: phase364b.launchAuthorizationEligible === true,
  goNoGoDecisionValidated: phase364b.goNoGoDecisionValidated === true,
  deployAuthorizationLocked: phase364c.finalDeployAuthorizationLocked === true,
  requiresFinalManualExecutionConfirmation: true,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  productionGaAuthorized: false,
  remainingBlockers:
    phase364b.launchAuthorizationEligible === true && phase364c.finalDeployAuthorizationLocked === true
      ? ["final_manual_execution_confirmation_required"]
      : [...(phase364b.remainingBlockers || [])],
  conditions: phase364c.conditions || [],
  safety: {
    secretValueExposed: false,
    approvalForged: false,
    goNoGoForged: false,
    workspaceCleanClaimed: false,
  },
};

await writeText("docs/phase364f-final-launch-authorization-packet.md", [
  "# Phase364F Final Launch Authorization Packet",
  "",
  `- launchAuthorizationEligible: ${state.launchAuthorizationEligible}`,
  `- goNoGoDecisionValidated: ${state.goNoGoDecisionValidated}`,
  `- deployAuthorizationLocked: ${state.deployAuthorizationLocked}`,
  "- requiresFinalManualExecutionConfirmation: true",
  "- deployExecuted: false",
].join("\n"));
await writeJson("docs/phase364f-final-launch-authorization-state.json", state);
await writeText("docs/phase364f-final-launch-readiness-summary.md", [
  "# Phase364F Final Launch Readiness Summary",
  "",
  `- remainingBlockers: ${state.remainingBlockers.join(", ") || "none"}`,
].join("\n"));
await writeText("docs/phase364f-final-launch-risk-register.md", [
  "# Phase364F Final Launch Risk Register",
  "",
  "- Final manual execution confirmation is still required.",
  "- No deploy or release has been executed.",
].join("\n"));
await writeText("docs/phase364f-execution-report.md", [
  "# Phase364F Execution Report",
  "",
  "- final launch packet generated",
  `- launchAuthorizationEligible: ${state.launchAuthorizationEligible}`,
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase364f/final-launch-authorization-packet-result.json", state);

console.log(JSON.stringify(state, null, 2));
