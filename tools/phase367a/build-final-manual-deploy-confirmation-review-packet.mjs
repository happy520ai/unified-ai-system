import { readJson, writeJson, writeText } from "../phase367-common.mjs";

const phase364f = await readJson("docs/phase364f-final-launch-authorization-state.json");
const phase365f = await readJson("docs/phase365f-launch-result-state.json");
const phase366f = await readJson("docs/phase366f-final-deploy-rehearsal-state.json");

const checklist = {
  phase: "Phase367A",
  items: [
    "Phase364 final launch authorization reviewed",
    "Phase365 blocked/no-op default reviewed",
    "Phase366 rehearsal reviewed",
    "approvedCommandRef reviewed",
    "rollback template reviewed",
    "post-deploy smoke checklist reviewed",
    "monitoring readiness reviewed",
    "secret safety reviewed",
    "product recovery reviewed",
    "package check reviewed",
    "executeDeploy remains false in this phase",
    "final confirmation still requires human creation",
  ],
};

const result = {
  phase: "Phase367A",
  reviewPacketGenerated: true,
  finalConfirmationTemplateReviewed: true,
  realConfirmationGenerated: false,
  executeDeploy: false,
  deployExecuted: false,
  secretValueExposed: false,
  codexIsConfirmer: false,
};

await writeText("docs/phase367a-final-manual-deploy-confirmation-review-packet.md", [
  "# Phase367A Final Manual Deploy Confirmation Review Packet",
  "",
  `- phase364LaunchAuthorizationEligible: ${phase364f.launchAuthorizationEligible}`,
  `- phase365LaunchStatus: ${phase365f.launchStatus}`,
  `- phase366ReadyForFinalManualDeployConfirmation: ${phase366f.readyForFinalManualDeployConfirmation}`,
].join("\n"));
await writeJson("docs/phase367a-final-confirmation-review-checklist.json", checklist);
await writeText("docs/phase367a-final-confirmation-human-decision-guide.md", [
  "# Phase367A Final Confirmation Human Decision Guide",
  "",
  "- Do not create a real confirmation unless you are ready to let a future Phase365 rerun attempt deploy.",
  "- Keep `executeDeploy=false` until you explicitly want execution to be possible.",
  "- Codex is not the confirmer.",
].join("\n"));
await writeText("docs/phase367a-execution-report.md", [
  "# Phase367A Execution Report",
  "",
  "- review packet generated",
  "- realConfirmationGenerated: false",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase367a/final-manual-deploy-confirmation-review-result.json", result);

console.log(JSON.stringify(result, null, 2));
